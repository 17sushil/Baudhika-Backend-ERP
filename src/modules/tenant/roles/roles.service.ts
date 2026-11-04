import { BadRequestException, ConflictException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { EntityManager, In } from 'typeorm';
import { isUniqueViolation } from '../../../common/utils/sql.util';
import { TOP_ROLE } from '../../../database/tenant/seed-permissions';
import { AccessService } from '../access/access.service';
import { Permission } from '../access/entities/permission.tenant.entity';
import { RolePermission } from '../access/entities/role-permission.tenant.entity';
import { Role } from '../access/entities/role.tenant.entity';
import { AuditAction } from '../audit/audit.enums';
import { AuditService } from '../audit/audit.service';
import type { TenantAuth } from '../auth/auth.types';
import { TenantContext } from '../context/tenant-context';
import { CreateRoleDto, UpdateRoleDto } from './dto/role.dto';

/** The one role that can always set up everything (principal). It keeps every permission and always requires OTP. */
export const SUPER_ROLE = TOP_ROLE;

/**
 * Role management. The hierarchy is defined by permission sets: a caller can only create, edit, delete
 * (or assign/revoke, see UsersService) roles whose permissions are all held by the caller institution-wide.
 * The principal holds everything, so nobody below it can touch it.
 */
@Injectable()
export class RolesService {
  constructor(
    private ctx: TenantContext,
    private access: AccessService,
    private audit: AuditService,
  ) {}

  listPermissions() {
    return this.ctx.repo(Permission).find({ order: { code: 'ASC' } });
  }

  async list(auth: TenantAuth) {
    const roles = await this.ctx.repo(Role).find();
    const [perms, counts] = await Promise.all([this.permissionsByRole(), this.userCounts()]);
    const own = await this.own(auth);
    // Hierarchy order: the broadest roles (principal) first.
    return roles
      .map((r) => this.view(r, perms.get(r.id) ?? [], counts.get(r.id) ?? 0, own))
      .sort((x, y) => y.permissions.length - x.permissions.length || x.code.localeCompare(y.code));
  }

  async get(id: string, auth: TenantAuth) {
    const r = await this.find(id);
    const [perms, counts] = await Promise.all([this.permissionsByRole(id), this.userCounts(id)]);
    return this.view(r, perms.get(id) ?? [], counts.get(id) ?? 0, await this.own(auth));
  }

  async create(dto: CreateRoleDto, auth: TenantAuth) {
    const permissions = await this.resolvePermissions(dto.permissions);
    await this.assertWithinOwn(auth, new Set(permissions.map((p) => p.code)));
    try {
      const id = await this.ctx.dataSource.transaction(async (m) => {
        const repo = m.getRepository(Role);
        const role = await repo.save(repo.create({ code: dto.code, name: dto.name, requiresMfa: dto.requiresMfa ?? false, isSystem: false }));
        await this.setPermissions(m, role.id, permissions);
        await this.audit.record(auth, { table: 'roles', recordId: role.id, action: AuditAction.INSERT, after: { ...role, permissions: dto.permissions } }, m);
        return role.id;
      });
      return this.get(id, auth);
    } catch (e) {
      if (isUniqueViolation(e)) throw new ConflictException('A role with this code already exists');
      throw e;
    }
  }

  async update(id: string, dto: UpdateRoleDto, auth: TenantAuth) {
    const before = await this.find(id);
    const current = (await this.permissionsByRole(id)).get(id) ?? [];
    if (before.code === SUPER_ROLE && (dto.permissions !== undefined || dto.requiresMfa !== undefined)) {
      throw new BadRequestException('The principal role always has every permission and requires OTP; only its name can change');
    }
    // Editing a role is managing everything it grants: the caller must hold its current permissions...
    await this.assertWithinOwn(auth, new Set(current));
    // ...and every permission it would grant afterwards.
    const next = dto.permissions === undefined ? null : await this.resolvePermissions(dto.permissions);
    if (next) await this.assertWithinOwn(auth, new Set(next.map((p) => p.code)));

    await this.ctx.dataSource.transaction(async (m) => {
      const changes: Partial<Role> = {};
      if (dto.name !== undefined) changes.name = dto.name;
      if (dto.requiresMfa !== undefined) changes.requiresMfa = dto.requiresMfa;
      if (Object.keys(changes).length) await m.getRepository(Role).update(id, changes);
      if (next) await this.setPermissions(m, id, next);
      const after = await m.getRepository(Role).findOneOrFail({ where: { id } });
      await this.audit.record(
        auth,
        {
          table: 'roles',
          recordId: id,
          action: AuditAction.UPDATE,
          before: { ...before, permissions: current.join(',') },
          after: { ...after, permissions: (next ? next.map((p) => p.code) : current).join(',') },
        },
        m,
      );
    });
    return this.get(id, auth);
  }

  async remove(id: string, auth: TenantAuth) {
    const before = await this.find(id);
    if (before.isSystem) throw new BadRequestException('Built-in roles cannot be deleted');
    const current = (await this.permissionsByRole(id)).get(id) ?? [];
    await this.assertWithinOwn(auth, new Set(current));
    const [{ n }] = await this.ctx.dataSource.query(`SELECT count(*)::int AS n FROM user_roles WHERE role_id = $1`, [id]);
    if (n) throw new ConflictException(`Role is assigned ${n} time(s); revoke those assignments first`);
    await this.ctx.dataSource.transaction(async (m) => {
      await m.getRepository(Role).delete(id); // role_permissions rows cascade
      await this.audit.record(auth, { table: 'roles', recordId: id, action: AuditAction.DELETE, before: { ...before, permissions: current.join(',') } }, m);
    });
  }

  // ---------------------------------------------------------------- helpers

  private view(r: Role, permissions: string[], userCount: number, own: Set<string>) {
    return {
      id: r.id,
      code: r.code,
      name: r.name,
      isSystem: r.isSystem,
      requiresMfa: r.requiresMfa,
      permissions,
      userCount,
      manageable: permissions.every((p) => own.has(p)),
      createdAt: r.createdAt,
      updatedAt: r.updatedAt,
    };
  }

  private async find(id: string) {
    const r = await this.ctx.repo(Role).findOne({ where: { id } });
    if (!r) throw new NotFoundException('Role not found');
    return r;
  }

  private own(auth: TenantAuth): Promise<Set<string>> {
    return auth.permissions ? Promise.resolve(auth.permissions) : this.access.institutionPermissions(auth.userId);
  }

  private async assertWithinOwn(auth: TenantAuth, needed: Set<string>) {
    const own = await this.own(auth);
    const missing = [...needed].filter((p) => !own.has(p));
    if (missing.length) throw new ForbiddenException(`You cannot manage permissions you do not hold: ${missing.join(', ')}`);
  }

  private async resolvePermissions(codes: string[]) {
    if (!codes.length) return [];
    const found = await this.ctx.repo(Permission).find({ where: { code: In(codes) } });
    const unknown = codes.filter((c) => !found.some((p) => p.code === c));
    if (unknown.length) throw new BadRequestException(`Unknown permission(s): ${unknown.join(', ')}`);
    return found;
  }

  private async setPermissions(m: EntityManager, roleId: string, permissions: Permission[]) {
    const repo = m.getRepository(RolePermission);
    await repo.delete({ roleId });
    if (permissions.length) await repo.insert(permissions.map((p) => ({ roleId, permissionId: p.id })));
  }

  private async permissionsByRole(roleId?: string): Promise<Map<string, string[]>> {
    const rows: { roleId: string; code: string }[] = await this.ctx.dataSource.query(
      `SELECT rp.role_id AS "roleId", p.code FROM role_permissions rp JOIN permissions p ON p.id = rp.permission_id
        WHERE $1::uuid IS NULL OR rp.role_id = $1 ORDER BY p.code`,
      [roleId ?? null],
    );
    const out = new Map<string, string[]>();
    for (const r of rows) out.set(r.roleId, [...(out.get(r.roleId) ?? []), r.code]);
    return out;
  }

  private async userCounts(roleId?: string): Promise<Map<string, number>> {
    const rows: { roleId: string; n: number }[] = await this.ctx.dataSource.query(
      `SELECT ur.role_id AS "roleId", count(DISTINCT ur.user_id)::int AS n
         FROM user_roles ur JOIN users u ON u.id = ur.user_id AND u.deleted_at IS NULL
        WHERE ($1::uuid IS NULL OR ur.role_id = $1)
          AND (ur.valid_from IS NULL OR ur.valid_from <= CURRENT_DATE) AND (ur.valid_to IS NULL OR ur.valid_to >= CURRENT_DATE)
        GROUP BY ur.role_id`,
      [roleId ?? null],
    );
    return new Map(rows.map((r) => [r.roleId, r.n]));
  }
}
