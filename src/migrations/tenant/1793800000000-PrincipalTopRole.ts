import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * The principal becomes the top role (every permission, locked); admin keeps everything except role.manage.
 * Existing institution-wide admin assignments (the account created at provisioning) become principal.
 * Campus-scoped admin assignments (branch admins) stay admin.
 */
export class PrincipalTopRole1793800000000 implements MigrationInterface {
  name = 'PrincipalTopRole1793800000000';

  public async up(q: QueryRunner): Promise<void> {
    await q.query(`
      INSERT INTO role_permissions (role_id, permission_id)
      SELECT r.id, p.id FROM roles r CROSS JOIN permissions p WHERE r.code = 'principal'
      ON CONFLICT DO NOTHING`);
    await q.query(`
      INSERT INTO role_permissions (role_id, permission_id)
      SELECT r.id, p.id FROM roles r CROSS JOIN permissions p WHERE r.code = 'admin' AND p.code <> 'role.manage'
      ON CONFLICT DO NOTHING`);
    await q.query(`
      DELETE FROM role_permissions rp USING roles r, permissions p
       WHERE rp.role_id = r.id AND rp.permission_id = p.id AND r.code = 'admin' AND p.code = 'role.manage'`);
    await q.query(`UPDATE roles SET requires_mfa = true WHERE code IN ('principal', 'admin')`);

    // Convert school-wide admins to principals (keeps validity window and creator).
    await q.query(`
      INSERT INTO user_roles (user_id, role_id, scope_type, scope_id, valid_from, valid_to, created_by)
      SELECT ur.user_id, (SELECT id FROM roles WHERE code = 'principal'), 'institution', NULL, ur.valid_from, ur.valid_to, ur.created_by
        FROM user_roles ur JOIN roles r ON r.id = ur.role_id
       WHERE r.code = 'admin' AND ur.scope_type = 'institution'
      ON CONFLICT DO NOTHING`);
    await q.query(`
      DELETE FROM user_roles ur USING roles r
       WHERE ur.role_id = r.id AND r.code = 'admin' AND ur.scope_type = 'institution'`);
  }

  public async down(q: QueryRunner): Promise<void> {
    // Restores the previous permission sets. User assignments are not converted back: after this migration
    // a principal can't be told apart from a former admin.
    await q.query(`
      INSERT INTO role_permissions (role_id, permission_id)
      SELECT r.id, p.id FROM roles r JOIN permissions p ON p.code = 'role.manage' WHERE r.code = 'admin'
      ON CONFLICT DO NOTHING`);
    await q.query(`
      DELETE FROM role_permissions rp USING roles r, permissions p
       WHERE rp.role_id = r.id AND rp.permission_id = p.id AND r.code = 'principal'
         AND p.code IN ('user.create', 'user.update', 'role.assign', 'role.manage', 'org.manage',
                        'student.delete', 'guardian.delete', 'staff.delete')`);
  }
}
