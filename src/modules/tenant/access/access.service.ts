import { Injectable } from '@nestjs/common';
import { EntityManager } from 'typeorm';
import { TenantContext } from '../context/tenant-context';

// An assignment counts only inside its validity window (valid_from / valid_to are inclusive dates).
const ACTIVE_ASSIGNMENT = `(ur.valid_from IS NULL OR ur.valid_from <= CURRENT_DATE)
  AND (ur.valid_to IS NULL OR ur.valid_to >= CURRENT_DATE)`;

export interface RoleGrant {
  /** user_roles.id, used to revoke this assignment. */
  assignmentId: string;
  code: string;
  name: string;
  scopeType: string;
  scopeId: string | null;
  validFrom: string | null;
  validTo: string | null;
}

/** Where a permission applies: everywhere, and/or on specific campuses. */
export interface PermissionGrant {
  institution: boolean;
  campusIds: Set<string>;
}
export type Grants = Map<string, PermissionGrant>;

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

  /** Every currently valid permission with its scopes. Department/class/section scopes don't grant these yet. */
  async grants(userId: string, m: EntityManager = this.m): Promise<Grants> {
    const rows: { code: string; scopeType: string; scopeId: string | null }[] = await m.query(
      `SELECT DISTINCT p.code, ur.scope_type AS "scopeType", ur.scope_id AS "scopeId"
         FROM user_roles ur
         JOIN role_permissions rp ON rp.role_id = ur.role_id
         JOIN permissions p ON p.id = rp.permission_id
        WHERE ur.user_id = $1 AND ur.scope_type IN ('institution', 'campus') AND ${ACTIVE_ASSIGNMENT}`,
      [userId],
    );
    const out: Grants = new Map();
    for (const r of rows) {
      const g = out.get(r.code) ?? { institution: false, campusIds: new Set<string>() };
      if (r.scopeType === 'institution') g.institution = true;
      else if (r.scopeId) g.campusIds.add(r.scopeId);
      out.set(r.code, g);
    }
    return out;
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
      `SELECT ur.user_id AS "userId", ur.id AS "assignmentId", r.code, r.name, ur.scope_type AS "scopeType",
              ur.scope_id AS "scopeId", to_char(ur.valid_from, 'YYYY-MM-DD') AS "validFrom",
              to_char(ur.valid_to, 'YYYY-MM-DD') AS "validTo"
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

  /** The live person a login belongs to (for /auth/me). */
  linkedPerson(userId: string, m: EntityManager = this.m): Promise<{ id: string; displayName: string; photoFileId: string | null }[]> {
    return m.query(
      `SELECT id, display_name AS "displayName", photo_file_id AS "photoFileId" FROM persons
        WHERE user_id = $1 AND deleted_at IS NULL LIMIT 1`,
      [userId],
    );
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
