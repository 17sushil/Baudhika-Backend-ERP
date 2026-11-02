import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Tenant "Login and access" group (design doc 6.2) plus the auth session tables.
 * Seeds the system roles and permissions so every tenant starts identical.
 */
export class AccessAndAuth1793612900000 implements MigrationInterface {
  name = 'AccessAndAuth1793612900000';

  public async up(q: QueryRunner): Promise<void> {
    // citext ships with postgresql-contrib and is "trusted" (PG13+): the database owner can create it.
    // gen_random_uuid() is built into PG13+, so pgcrypto is not needed.
    await q.query(`CREATE EXTENSION IF NOT EXISTS citext`);

    await q.query(`
      CREATE OR REPLACE FUNCTION set_updated_at() RETURNS trigger AS $$
      BEGIN
        NEW.updated_at = now();
        RETURN NEW;
      END
      $$ LANGUAGE plpgsql`);

    await q.query(`CREATE TYPE "user_status" AS ENUM ('active', 'suspended', 'disabled')`);
    await q.query(`CREATE TYPE "scope_kind" AS ENUM ('institution', 'campus', 'department', 'class', 'section')`);

    // ---- users
    await q.query(`
      CREATE TABLE "users" (
        "id" uuid NOT NULL DEFAULT gen_random_uuid(),
        "username" citext,
        "email" citext,
        "phone" text,
        "password_hash" text NOT NULL,
        "status" "user_status" NOT NULL DEFAULT 'active',
        "must_change_password" boolean NOT NULL DEFAULT false,
        "email_verified_at" timestamptz,
        "phone_verified_at" timestamptz,
        "mfa_enabled" boolean NOT NULL DEFAULT false,
        "failed_login_count" integer NOT NULL DEFAULT 0,
        "locked_until" timestamptz,
        "password_changed_at" timestamptz,
        "last_login_at" timestamptz,
        "locale" text NOT NULL DEFAULT 'en',
        "created_at" timestamptz NOT NULL DEFAULT now(),
        "updated_at" timestamptz NOT NULL DEFAULT now(),
        "created_by" uuid,
        "updated_by" uuid,
        "deleted_at" timestamptz,
        CONSTRAINT "pk_users" PRIMARY KEY ("id"),
        CONSTRAINT "chk_users_identifier" CHECK (username IS NOT NULL OR email IS NOT NULL OR phone IS NOT NULL)
      )`);
    // Partial unique: a soft-deleted user does not block reuse of the identifier.
    await q.query(`CREATE UNIQUE INDEX "uq_users_username_live" ON "users" ("username") WHERE deleted_at IS NULL`);
    await q.query(`CREATE UNIQUE INDEX "uq_users_email_live" ON "users" ("email") WHERE deleted_at IS NULL`);
    await q.query(`CREATE UNIQUE INDEX "uq_users_phone_live" ON "users" ("phone") WHERE deleted_at IS NULL`);
    await q.query(`CREATE TRIGGER "trg_users_updated_at" BEFORE UPDATE ON "users" FOR EACH ROW EXECUTE FUNCTION set_updated_at()`);

    // ---- roles / permissions
    await q.query(`
      CREATE TABLE "roles" (
        "id" uuid NOT NULL DEFAULT gen_random_uuid(),
        "code" text NOT NULL,
        "name" text NOT NULL,
        "is_system" boolean NOT NULL DEFAULT false,
        "requires_mfa" boolean NOT NULL DEFAULT false,
        "created_at" timestamptz NOT NULL DEFAULT now(),
        "updated_at" timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT "pk_roles" PRIMARY KEY ("id"),
        CONSTRAINT "uq_roles_code" UNIQUE ("code")
      )`);
    await q.query(`CREATE TRIGGER "trg_roles_updated_at" BEFORE UPDATE ON "roles" FOR EACH ROW EXECUTE FUNCTION set_updated_at()`);

    await q.query(`
      CREATE TABLE "permissions" (
        "id" uuid NOT NULL DEFAULT gen_random_uuid(),
        "code" text NOT NULL,
        "description" text,
        CONSTRAINT "pk_permissions" PRIMARY KEY ("id"),
        CONSTRAINT "uq_permissions_code" UNIQUE ("code")
      )`);

    await q.query(`
      CREATE TABLE "role_permissions" (
        "role_id" uuid NOT NULL,
        "permission_id" uuid NOT NULL,
        CONSTRAINT "pk_role_permissions" PRIMARY KEY ("role_id", "permission_id"),
        CONSTRAINT "fk_role_permissions_role" FOREIGN KEY ("role_id") REFERENCES "roles"("id") ON DELETE CASCADE,
        CONSTRAINT "fk_role_permissions_permission" FOREIGN KEY ("permission_id") REFERENCES "permissions"("id") ON DELETE CASCADE
      )`);
    await q.query(`CREATE INDEX "idx_role_permissions_permission" ON "role_permissions" ("permission_id")`);

    await q.query(`
      CREATE TABLE "user_roles" (
        "id" uuid NOT NULL DEFAULT gen_random_uuid(),
        "user_id" uuid NOT NULL,
        "role_id" uuid NOT NULL,
        "scope_type" "scope_kind" NOT NULL DEFAULT 'institution',
        "scope_id" uuid,
        "valid_from" date,
        "valid_to" date,
        "created_at" timestamptz NOT NULL DEFAULT now(),
        "created_by" uuid,
        CONSTRAINT "pk_user_roles" PRIMARY KEY ("id"),
        CONSTRAINT "fk_user_roles_user" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE,
        CONSTRAINT "fk_user_roles_role" FOREIGN KEY ("role_id") REFERENCES "roles"("id") ON DELETE RESTRICT,
        CONSTRAINT "chk_user_roles_scope" CHECK ((scope_type = 'institution') = (scope_id IS NULL)),
        CONSTRAINT "chk_user_roles_validity" CHECK (valid_to IS NULL OR valid_from IS NULL OR valid_to >= valid_from)
      )`);
    await q.query(`CREATE INDEX "idx_user_roles_user" ON "user_roles" ("user_id")`);
    await q.query(`CREATE INDEX "idx_user_roles_role" ON "user_roles" ("role_id")`);
    // Same role twice on the same scope is meaningless. COALESCE because NULLs are distinct in PG14.
    await q.query(`
      CREATE UNIQUE INDEX "uq_user_roles_assignment" ON "user_roles"
        ("user_id", "role_id", "scope_type", COALESCE("scope_id", '00000000-0000-0000-0000-000000000000'::uuid))`);

    // ---- auth: refresh-token sessions and OTP challenges
    await q.query(`
      CREATE TABLE "user_sessions" (
        "id" uuid NOT NULL DEFAULT gen_random_uuid(),
        "family_id" uuid NOT NULL,
        "user_id" uuid NOT NULL,
        "token_hash" varchar(64) NOT NULL,
        "expires_at" timestamptz NOT NULL,
        "session_expires_at" timestamptz NOT NULL,
        "revoked_at" timestamptz,
        "replaced_by_id" uuid,
        "ip" inet,
        "user_agent" varchar(255),
        "created_at" timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT "pk_user_sessions" PRIMARY KEY ("id"),
        CONSTRAINT "fk_user_sessions_user" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE
      )`);
    await q.query(`CREATE INDEX "idx_user_sessions_family" ON "user_sessions" ("family_id")`);
    await q.query(`CREATE INDEX "idx_user_sessions_user" ON "user_sessions" ("user_id")`);

    await q.query(`
      CREATE TABLE "user_otp_challenges" (
        "id" uuid NOT NULL DEFAULT gen_random_uuid(),
        "user_id" uuid NOT NULL,
        "code_hash" varchar(64) NOT NULL,
        "expires_at" timestamptz NOT NULL,
        "attempts" integer NOT NULL DEFAULT 0,
        "consumed_at" timestamptz,
        "created_at" timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT "pk_user_otp_challenges" PRIMARY KEY ("id"),
        CONSTRAINT "fk_user_otp_challenges_user" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE
      )`);
    await q.query(`CREATE INDEX "idx_user_otp_challenges_user" ON "user_otp_challenges" ("user_id")`);

    await this.seed(q);
  }

  public async down(q: QueryRunner): Promise<void> {
    await q.query(`DROP TABLE "user_otp_challenges"`);
    await q.query(`DROP TABLE "user_sessions"`);
    await q.query(`DROP TABLE "user_roles"`);
    await q.query(`DROP TABLE "role_permissions"`);
    await q.query(`DROP TABLE "permissions"`);
    await q.query(`DROP TABLE "roles"`);
    await q.query(`DROP TABLE "users"`);
    await q.query(`DROP TYPE "scope_kind"`);
    await q.query(`DROP TYPE "user_status"`);
    await q.query(`DROP FUNCTION set_updated_at()`);
  }

  private async seed(q: QueryRunner) {
    const permissions: [string, string][] = [
      ['user.read', 'View user accounts'],
      ['user.create', 'Create user accounts'],
      ['user.update', 'Edit, suspend or disable user accounts and reset their passwords'],
      ['role.read', 'View roles and their permissions'],
      ['role.assign', 'Assign roles to users'],
      ['role.manage', 'Create, edit and delete custom roles'],
      ['person.sensitive.read', 'View religion and ethnicity'],
      ['guardian.sensitive.read', 'View guardian annual income'],
      ['student.health.read', 'View student health and disability records'],
      ['document.read', 'View uploaded documents'],
      ['document.verify', 'Verify or reject uploaded documents'],
      ['audit.read', 'View the audit trail'],
    ];
    // [code, name, requires_mfa]
    const roles: [string, string, boolean][] = [
      ['admin', 'Administrator', true],
      ['principal', 'Principal', true],
      ['hod', 'Head of Department', false],
      ['class_teacher', 'Class Teacher', false],
      ['teacher', 'Teacher', false],
      ['accountant', 'Accountant', false],
      ['parent', 'Parent', false],
      ['student', 'Student', false],
      ['driver', 'Driver', false],
    ];
    const grants: Record<string, string[] | '*'> = {
      admin: '*',
      principal: [
        'user.read', 'role.read', 'person.sensitive.read', 'guardian.sensitive.read',
        'student.health.read', 'document.read', 'document.verify', 'audit.read',
      ],
      accountant: ['guardian.sensitive.read'],
      class_teacher: ['student.health.read'],
    };

    for (const [code, description] of permissions) {
      await q.query(`INSERT INTO permissions (code, description) VALUES ($1, $2) ON CONFLICT (code) DO NOTHING`, [code, description]);
    }
    for (const [code, name, mfa] of roles) {
      await q.query(
        `INSERT INTO roles (code, name, is_system, requires_mfa) VALUES ($1, $2, true, $3) ON CONFLICT (code) DO NOTHING`,
        [code, name, mfa],
      );
    }
    for (const [role, perms] of Object.entries(grants)) {
      await q.query(
        `INSERT INTO role_permissions (role_id, permission_id)
         SELECT r.id, p.id FROM roles r CROSS JOIN permissions p
         WHERE r.code = $1 AND ($2::text[] IS NULL OR p.code = ANY($2::text[]))
         ON CONFLICT DO NOTHING`,
        [role, perms === '*' ? null : perms],
      );
    }
  }
}
