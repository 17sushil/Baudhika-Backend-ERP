import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { In, QueryFailedError } from 'typeorm';
import { hashPassword } from '../../../common/utils/password.util';
import { isUniqueViolation } from '../../../common/utils/sql.util';
import { TOP_ROLE } from '../../../database/tenant/seed-permissions';
import { ScopeKind, UserStatus } from '../access/access.enums';
import { AccessService, RoleGrant } from '../access/access.service';
import { Role } from '../access/entities/role.tenant.entity';
import { UserRole } from '../access/entities/user-role.tenant.entity';
import { User } from '../access/entities/user.tenant.entity';
import { TenantAuth } from '../auth/auth.types';
import { TenantTokenService } from '../auth/services/tenant-token.service';
import { AuditAction } from '../audit/audit.enums';
import { AuditService } from '../audit/audit.service';
import { TenantContext } from '../context/tenant-context';
import { AssignRoleDto } from './dto/assign-role.dto';
import { CreateUserDto } from './dto/create-user.dto';
import { ListUsersDto } from './dto/list-users.dto';
import { ResetPasswordDto } from './dto/reset-password.dto';

/** The only shape a user leaves the API in. password_hash is never selected nor mapped. */
function toUserView(u: User, roles: RoleGrant[] = []) {
  return {
    id: u.id,
    username: u.username,
    email: u.email,
    phone: u.phone,
    status: u.status,
    mustChangePassword: u.mustChangePassword,
    mfaEnabled: u.mfaEnabled,
    locale: u.locale,
    lockedUntil: u.lockedUntil,
    lastLoginAt: u.lastLoginAt,
    createdAt: u.createdAt,
    roles,
  };
}

const escapeLike = (s: string) => s.replace(/[\\%_]/g, (c) => `\\${c}`);

@Injectable()
export class UsersService {
  constructor(
    private ctx: TenantContext,
    private access: AccessService,
    private tokens: TenantTokenService,
    private audit: AuditService,
  ) {}

  async create(dto: CreateUserDto, actor: TenantAuth) {
    if (!dto.username && !dto.email && !dto.phone) {
      throw new BadRequestException('Provide at least one of username, email or phone');
    }

    const roleCodes = dto.roles ?? [];
    let roles: Role[] = [];
    if (roleCodes.length) {
      if (!actor.permissions?.has('role.assign')) throw new ForbiddenException('Missing permission: role.assign');
      roles = await this.ctx.repo(Role).find({ where: { code: In(roleCodes) } });
      if (roles.length !== roleCodes.length) throw new BadRequestException('Unknown role');
      await this.assertCanGrant(actor, await this.access.rolePermissions(roles.map((r) => r.id)));
    }

    const passwordHash = await hashPassword(dto.password);
    try {
      const user = await this.ctx.dataSource.transaction(async (m) => {
        const repo = m.getRepository(User);
        const saved = await repo.save(
          repo.create({
            username: dto.username ?? null,
            email: dto.email ?? null,
            phone: dto.phone ?? null,
            passwordHash,
            mustChangePassword: dto.mustChangePassword ?? true,
            mfaEnabled: dto.mfaEnabled ?? false,
            locale: dto.locale ?? 'en',
            createdBy: actor.userId,
            updatedBy: actor.userId,
          }),
        );
        if (roles.length) {
          await m.getRepository(UserRole).insert(
            roles.map((r) => ({ userId: saved.id, roleId: r.id, scopeType: ScopeKind.INSTITUTION, createdBy: actor.userId })),
          );
        }
        // snapshot() drops passwordHash.
        await this.audit.record(
          actor,
          { table: 'users', recordId: saved.id, action: AuditAction.INSERT, after: { ...saved, roles: roleCodes.join(',') } },
          m,
        );
        return saved;
      });
      return this.get(user.id);
    } catch (e) {
      if (e instanceof QueryFailedError && (e as any).code === '23505') {
        throw new ConflictException('Username, email or phone already in use');
      }
      throw e;
    }
  }

  async list(q: ListUsersDto) {
    const qb = this.ctx.repo(User).createQueryBuilder('u').orderBy('u.created_at', 'DESC');
    if (q.status) qb.andWhere('u.status = :status', { status: q.status });
    if (q.search) {
      qb.andWhere(`(u.username ILIKE :s ESCAPE '\\' OR u.email ILIKE :s ESCAPE '\\' OR u.phone ILIKE :s ESCAPE '\\')`, {
        s: `%${escapeLike(q.search.trim())}%`,
      });
    }
    const [rows, total] = await qb
      .skip((q.page - 1) * q.limit)
      .take(q.limit)
      .getManyAndCount();
    const roles = await this.access.roles(rows.map((u) => u.id));
    return { items: rows.map((u) => toUserView(u, roles.get(u.id))), total, page: q.page, limit: q.limit };
  }

  async get(id: string) {
    const user = await this.ctx.repo(User).findOne({ where: { id } });
    if (!user) throw new NotFoundException('User not found');
    const roles = await this.access.roles([id]);
    return toUserView(user, roles.get(id));
  }

  async setStatus(id: string, status: UserStatus, actor: TenantAuth) {
    if (id === actor.userId) throw new BadRequestException('You cannot change your own status');
    const before = await this.findManageable(id, actor);

    await this.ctx.dataSource.transaction(async (m) => {
      await m.getRepository(User).update(id, { status, updatedBy: actor.userId });
      if (status !== UserStatus.ACTIVE) await this.tokens.revokeAllForUser(id, m);
      const after = await m.getRepository(User).findOneOrFail({ where: { id } });
      await this.audit.record(actor, { table: 'users', recordId: id, action: AuditAction.UPDATE, before, after }, m);
    });
    return this.get(id);
  }

  async resetPassword(id: string, dto: ResetPasswordDto, actor: TenantAuth) {
    if (id === actor.userId) throw new BadRequestException('Use change-password for your own account');
    await this.findManageable(id, actor);

    const passwordHash = await hashPassword(dto.password);
    await this.ctx.dataSource.transaction(async (m) => {
      await m.getRepository(User).update(id, {
        passwordHash,
        mustChangePassword: dto.mustChangePassword ?? true,
        passwordChangedAt: new Date(),
        failedLoginCount: 0,
        lockedUntil: null,
        updatedBy: actor.userId,
      });
      await this.tokens.revokeAllForUser(id, m);
      // Record that a reset happened and by whom; never the password or its hash.
      await this.audit.record(
        actor,
        { table: 'users', recordId: id, action: AuditAction.UPDATE, after: { passwordReset: true, mustChangePassword: dto.mustChangePassword ?? true } },
        m,
      );
    });
    return this.get(id);
  }

  /** Grants a role, optionally limited to one campus (branch admin) or department (HOD). */
  async assignRole(userId: string, dto: AssignRoleDto, actor: TenantAuth) {
    const user = await this.ctx.repo(User).findOne({ where: { id: userId } });
    if (!user) throw new NotFoundException('User not found');
    const role = await this.ctx.repo(Role).findOne({ where: { code: dto.role } });
    if (!role) throw new BadRequestException('Unknown role');
    await this.assertCanGrant(actor, await this.access.rolePermissions([role.id]));

    const scopeType = dto.scopeType ?? ScopeKind.INSTITUTION;
    if (scopeType === ScopeKind.INSTITUTION && dto.scopeId) throw new BadRequestException('Institution scope takes no scopeId');
    if (scopeType !== ScopeKind.INSTITUTION && !dto.scopeId) throw new BadRequestException(`scopeId is required for ${scopeType} scope`);
    if (scopeType === ScopeKind.CLASS || scopeType === ScopeKind.SECTION) {
      throw new BadRequestException('Class and section scopes become available with the academic module');
    }
    if (scopeType === ScopeKind.CAMPUS || scopeType === ScopeKind.DEPARTMENT) {
      const table = scopeType === ScopeKind.CAMPUS ? 'campuses' : 'departments';
      // table is one of two literals, never user input.
      const [{ ok }] = await this.ctx.dataSource.query(
        `SELECT EXISTS (SELECT 1 FROM ${table} WHERE id = $1 AND deleted_at IS NULL) AS ok`,
        [dto.scopeId],
      );
      if (!ok) throw new BadRequestException(`${scopeType} not found`);
    }
    if (dto.validFrom && dto.validTo && dto.validTo < dto.validFrom) throw new BadRequestException('validTo must be on or after validFrom');

    try {
      await this.ctx.dataSource.transaction(async (m) => {
        const repo = m.getRepository(UserRole);
        const row = await repo.save(
          repo.create({
            userId,
            roleId: role.id,
            scopeType,
            scopeId: dto.scopeId ?? null,
            validFrom: dto.validFrom ?? null,
            validTo: dto.validTo ?? null,
            createdBy: actor.userId,
          }),
        );
        await this.audit.record(actor, { table: 'user_roles', recordId: row.id, action: AuditAction.INSERT, after: { ...row, roleCode: role.code } }, m);
      });
    } catch (e) {
      if (isUniqueViolation(e, 'uq_user_roles_assignment')) throw new ConflictException('User already has this role on this scope');
      throw e;
    }
    return this.get(userId);
  }

  async revokeRole(userId: string, assignmentId: string, actor: TenantAuth) {
    const row = await this.ctx.repo(UserRole).findOne({ where: { id: assignmentId, userId }, relations: { role: true } });
    if (!row) throw new NotFoundException('Role assignment not found');
    // Revoking is as powerful as granting: an admin can't strip a principal.
    await this.assertCanGrant(actor, await this.access.rolePermissions([row.roleId]));

    if (row.role!.code === TOP_ROLE && row.scopeType === ScopeKind.INSTITUTION) {
      const [{ n }] = await this.ctx.dataSource.query(
        `SELECT count(*)::int AS n FROM user_roles ur JOIN roles r ON r.id = ur.role_id JOIN users u ON u.id = ur.user_id
          WHERE r.code = $2 AND ur.scope_type = 'institution' AND ur.id <> $1
            AND u.deleted_at IS NULL AND u.status = 'active'
            AND (ur.valid_from IS NULL OR ur.valid_from <= CURRENT_DATE) AND (ur.valid_to IS NULL OR ur.valid_to >= CURRENT_DATE)`,
        [assignmentId, TOP_ROLE],
      );
      if (!n) throw new ConflictException('Cannot remove the last school principal');
    }
    await this.ctx.dataSource.transaction(async (m) => {
      await m.getRepository(UserRole).delete(assignmentId);
      await this.audit.record(actor, { table: 'user_roles', recordId: assignmentId, action: AuditAction.DELETE, before: { ...row, roleCode: row.role!.code } }, m);
    });
    return this.get(userId);
  }

  /** Target must exist and hold no permission the actor lacks (a principal can't lock out an admin). */
  private async findManageable(id: string, actor: TenantAuth) {
    const user = await this.ctx.repo(User).findOne({ where: { id } });
    if (!user) throw new NotFoundException('User not found');
    await this.assertCanGrant(actor, await this.access.allPermissions(id));
    return user;
  }

  private async assertCanGrant(actor: TenantAuth, needed: Set<string>) {
    // Only institution-wide grants count for the actor: a department-scoped HOD can't escalate.
    const own = actor.permissions ?? (await this.access.institutionPermissions(actor.userId));
    for (const p of needed) {
      if (!own.has(p)) throw new ForbiddenException('You cannot manage users with more access than you');
    }
  }
}
