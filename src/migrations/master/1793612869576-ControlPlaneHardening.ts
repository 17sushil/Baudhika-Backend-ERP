import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Brings the master schema in line with the entities.
 *
 * Idempotent on purpose: some databases already got tenants.status / custom_domain from a
 * migration file that was later deleted, while a fresh database never did.
 */
export class ControlPlaneHardening1793612869576 implements MigrationInterface {
  name = 'ControlPlaneHardening1793612869576';

  public async up(q: QueryRunner): Promise<void> {
    // Unused, and its entity was declared twice (metadata conflict).
    await q.query(`DROP TABLE IF EXISTS "provisioning_jobs"`);

    // ---- tenants: columns that were never in a committed migration
    await q.query(`ALTER TABLE "tenants" ADD COLUMN IF NOT EXISTS "status" varchar(20) NOT NULL DEFAULT 'provisioning'`);
    await q.query(`ALTER TABLE "tenants" ADD COLUMN IF NOT EXISTS "custom_domain" varchar`);
    await q.query(`ALTER TABLE "tenants" ADD COLUMN IF NOT EXISTS "updatedAt" TIMESTAMP NOT NULL DEFAULT now()`);
    await q.query(`
      DO $$ BEGIN
        IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'UQ_c985fa3986f7383dff567479e5d') THEN
          ALTER TABLE "tenants" ADD CONSTRAINT "UQ_c985fa3986f7383dff567479e5d" UNIQUE ("custom_domain");
        END IF;
      END $$`);
    await q.query(`
      DO $$ BEGIN
        IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'chk_tenants_status') THEN
          ALTER TABLE "tenants" ADD CONSTRAINT "chk_tenants_status"
            CHECK ("status" IN ('provisioning', 'active', 'suspended', 'failed'));
        END IF;
      END $$`);

    // Per-tenant connection target, so a big tenant can live on its own server / role.
    await q.query(`ALTER TABLE "tenants" ADD COLUMN IF NOT EXISTS "db_host" varchar(255)`);
    await q.query(`ALTER TABLE "tenants" ADD COLUMN IF NOT EXISTS "db_port" integer`);
    await q.query(`ALTER TABLE "tenants" ADD COLUMN IF NOT EXISTS "db_user" varchar(63)`);
    await q.query(`ALTER TABLE "tenants" ADD COLUMN IF NOT EXISTS "db_password_enc" text`);
    await q.query(`ALTER TABLE "tenants" ADD COLUMN IF NOT EXISTS "provisioning_error" text`);

    // ---- consistent snake_case, timezone-aware timestamps everywhere
    await this.toTimestamptz(q, 'tenants', 'createdAt', 'created_at');
    await this.toTimestamptz(q, 'tenants', 'updatedAt', 'updated_at');
    await this.toTimestamptz(q, 'platform_users', 'createdAt', 'created_at');
    await this.toTimestamptz(q, 'platform_users', 'updatedAt', 'updated_at');
    await this.toTimestamptz(q, 'platform_audit_events', 'createdAt', 'created_at');
    await this.toTimestamptz(q, 'platform_otp_challenges', 'createdAt', 'created_at');
    await this.toTimestamptz(q, 'platform_refresh_tokens', 'createdAt', 'created_at');

    // ---- integrity: session rows must belong to a real platform user
    await q.query(`DELETE FROM "platform_otp_challenges" c WHERE NOT EXISTS (SELECT 1 FROM "platform_users" u WHERE u.id = c.user_id)`);
    await q.query(`DELETE FROM "platform_refresh_tokens" t WHERE NOT EXISTS (SELECT 1 FROM "platform_users" u WHERE u.id = t.user_id)`);
    await q.query(`ALTER TABLE "platform_otp_challenges" ADD CONSTRAINT "fk_platform_otp_challenges_user" FOREIGN KEY ("user_id") REFERENCES "platform_users"("id") ON DELETE CASCADE`);
    await q.query(`ALTER TABLE "platform_refresh_tokens" ADD CONSTRAINT "fk_platform_refresh_tokens_user" FOREIGN KEY ("user_id") REFERENCES "platform_users"("id") ON DELETE CASCADE`);

    await q.query(`CREATE INDEX IF NOT EXISTS "idx_platform_audit_events_actor" ON "platform_audit_events" ("actor_id", "created_at")`);
    await q.query(`CREATE INDEX IF NOT EXISTS "idx_platform_audit_events_created_at" ON "platform_audit_events" ("created_at")`);

    // Tenant roles must not even open the control-plane database (Postgres grants CONNECT to PUBLIC).
    await q.query(`
      DO $$ BEGIN
        EXECUTE format('GRANT CONNECT, TEMPORARY ON DATABASE %I TO %I', current_database(), current_user);
        EXECUTE format('REVOKE CONNECT, TEMPORARY ON DATABASE %I FROM PUBLIC', current_database());
      END $$`);
  }

  public async down(q: QueryRunner): Promise<void> {
    await q.query(`DO $$ BEGIN EXECUTE format('GRANT CONNECT, TEMPORARY ON DATABASE %I TO PUBLIC', current_database()); END $$`);
    await q.query(`DROP INDEX IF EXISTS "idx_platform_audit_events_created_at"`);
    await q.query(`DROP INDEX IF EXISTS "idx_platform_audit_events_actor"`);
    await q.query(`ALTER TABLE "platform_refresh_tokens" DROP CONSTRAINT IF EXISTS "fk_platform_refresh_tokens_user"`);
    await q.query(`ALTER TABLE "platform_otp_challenges" DROP CONSTRAINT IF EXISTS "fk_platform_otp_challenges_user"`);

    await this.toTimestamp(q, 'platform_refresh_tokens', 'created_at', 'createdAt');
    await this.toTimestamp(q, 'platform_otp_challenges', 'created_at', 'createdAt');
    await this.toTimestamp(q, 'platform_audit_events', 'created_at', 'createdAt');
    await this.toTimestamp(q, 'platform_users', 'updated_at', 'updatedAt');
    await this.toTimestamp(q, 'platform_users', 'created_at', 'createdAt');
    await this.toTimestamp(q, 'tenants', 'updated_at', 'updatedAt');
    await this.toTimestamp(q, 'tenants', 'created_at', 'createdAt');

    await q.query(`ALTER TABLE "tenants" DROP COLUMN IF EXISTS "provisioning_error"`);
    await q.query(`ALTER TABLE "tenants" DROP COLUMN IF EXISTS "db_password_enc"`);
    await q.query(`ALTER TABLE "tenants" DROP COLUMN IF EXISTS "db_user"`);
    await q.query(`ALTER TABLE "tenants" DROP COLUMN IF EXISTS "db_port"`);
    await q.query(`ALTER TABLE "tenants" DROP COLUMN IF EXISTS "db_host"`);
    await q.query(`ALTER TABLE "tenants" DROP CONSTRAINT IF EXISTS "chk_tenants_status"`);
    // status / custom_domain / provisioning_jobs are left in place: older code depends on them.
  }

  // Existing values were written by now() in the session time zone; a plain cast reads them back the same way.
  private async toTimestamptz(q: QueryRunner, table: string, from: string, to: string) {
    await q.query(`ALTER TABLE "${table}" RENAME COLUMN "${from}" TO "${to}"`);
    await q.query(`ALTER TABLE "${table}" ALTER COLUMN "${to}" TYPE timestamptz USING "${to}"::timestamptz`);
  }

  private async toTimestamp(q: QueryRunner, table: string, from: string, to: string) {
    await q.query(`ALTER TABLE "${table}" ALTER COLUMN "${from}" TYPE timestamp USING "${from}"::timestamp`);
    await q.query(`ALTER TABLE "${table}" RENAME COLUMN "${from}" TO "${to}"`);
  }
}
