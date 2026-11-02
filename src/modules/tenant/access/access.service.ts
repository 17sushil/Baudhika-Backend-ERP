import { Injectable } from '@nestjs/common';
import { EntityManager } from 'typeorm';
import { TenantContext } from '../context/tenant-context';

// An assignment counts only inside its validity window (valid_from / valid_to are inclusive dates).
const ACTIVE_ASSIGNMENT = `(ur.valid_from IS NULL OR ur.valid_from <= CURRENT_DATE)
  AND (ur.valid_to IS NULL OR ur.valid_to >= CURRENT_DATE)`;

export interface RoleGrant {
  code: string;
  name: string;
  scopeType: string;
  scopeId: string | null;
}

/** Resolves what a user may do. Role checks always go through permissions, never role codes. */
@Injectable()
export class AccessService {
  constructor(private ctx: TenantContext) {}

  private get m(): EntityManager {
    return this.ctx.dataSource.manager;
  }

  /** Permissions granted at institution scope, i.e. valid everywhere in the school. */
  async institutionPermissions(userId: string, m: EntityManager = this.m): Promise<Set<string>> {
    const rows: { code: string }[] = await m.query(
      `SELECT DISTINCT p.code
         FROM user_roles ur
         JOIN role_permissions rp ON rp.role_id = ur.role_id
         JOIN permissions p ON p.id = rp.permission_id
        WHERE ur.user_id = $1 AND ur.scope_type = 'institution' AND ${ACTIVE_ASSIGNMENT}`,
      [userId],
    );
    return new Set(rows.map((r) => r.code));
  }

  /** Every permission a user holds at any scope; used to stop privilege escalation. */
  async allPermissions(userId: string, m: EntityManager = this.m): Promise<Set<string>> {
    const rows: { code: string }[] = await m.query(
      `SELECT DISTINCT p.code
         FROM user_roles ur
         JOIN role_permissions rp ON rp.role_id = ur.role_id
         JOIN permissions p ON p.id = rp.permission_id
        WHERE ur.user_id = $1 AND ${ACTIVE_ASSIGNMENT}`,
      [userId],
    );
    return new Set(rows.map((r) => r.code));
  }

  async rolePermissions(roleIds: string[], m: EntityManager = this.m): Promise<Set<string>> {
    if (!roleIds.length) return new Set();
    const rows: { code: string }[] = await m.query(
      `SELECT DISTINCT p.code FROM role_permissions rp JOIN permissions p ON p.id = rp.permission_id
        WHERE rp.role_id = ANY($1::uuid[])`,
      [roleIds],
    );
    return new Set(rows.map((r) => r.code));
  }

  async roles(userIds: string[], m: EntityManager = this.m): Promise<Map<string, RoleGrant[]>> {
    const out = new Map<string, RoleGrant[]>();
    if (!userIds.length) return out;
    const rows: (RoleGrant & { userId: string })[] = await m.query(
      `SELECT ur.user_id AS "userId", r.code, r.name, ur.scope_type AS "scopeType", ur.scope_id AS "scopeId"
         FROM user_roles ur JOIN roles r ON r.id = ur.role_id
        WHERE ur.user_id = ANY($1::uuid[]) AND ${ACTIVE_ASSIGNMENT}
        ORDER BY r.code`,
      [userIds],
    );
    for (const { userId, ...grant } of rows) {
      if (!out.has(userId)) out.set(userId, []);
      out.get(userId)!.push(grant);
    }
    return out;
  }

  /** True when any currently valid role of the user demands OTP at login (admin, principal). */
  async requiresMfa(userId: string, m: EntityManager = this.m): Promise<boolean> {
    const [row] = await m.query(
      `SELECT EXISTS (
         SELECT 1 FROM user_roles ur JOIN roles r ON r.id = ur.role_id
          WHERE ur.user_id = $1 AND r.requires_mfa AND ${ACTIVE_ASSIGNMENT}
       ) AS required`,
      [userId],
    );
    return row.required === true;
  }
}
