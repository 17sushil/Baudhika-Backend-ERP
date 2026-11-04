import type { QueryRunner } from 'typeorm';

/** The top role of every school: holds every permission (see RolesService SUPER_ROLE). */
export const TOP_ROLE = 'principal';
/** admin gets every permission except these (role design stays with the principal). */
export const ADMIN_EXCLUDED = ['role.manage'];

// Lives outside src/migrations: TypeORM treats every exported function there as a migration class.
/**
 * Inserts permissions and grants them: all to the principal, all except ADMIN_EXCLUDED to admin,
 * plus the listed extra grants for other roles. Idempotent; grants are unioned, never narrowed.
 */
export async function seedPermissions(q: QueryRunner, permissions: [string, string][], grants: Record<string, string[]>) {
  for (const [code, description] of permissions) {
    await q.query(`INSERT INTO permissions (code, description) VALUES ($1, $2) ON CONFLICT (code) DO NOTHING`, [code, description]);
  }
  const codes = permissions.map(([c]) => c);
  const all = new Map<string, Set<string>>([
    [TOP_ROLE, new Set(codes)],
    ['admin', new Set(codes.filter((c) => !ADMIN_EXCLUDED.includes(c)))],
  ]);
  for (const [role, perms] of Object.entries(grants)) {
    all.set(role, new Set([...(all.get(role) ?? []), ...perms]));
  }
  for (const [role, perms] of all) {
    await q.query(
      `INSERT INTO role_permissions (role_id, permission_id)
       SELECT r.id, p.id FROM roles r JOIN permissions p ON p.code = ANY($2::text[])
       WHERE r.code = $1
       ON CONFLICT DO NOTHING`,
      [role, [...perms]],
    );
  }
}
