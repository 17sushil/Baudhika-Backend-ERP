import { MigrationInterface, QueryRunner } from 'typeorm';
import { seedPermissions } from '../../database/tenant/seed-permissions';

/**
 * Shared basics (design doc 6.1) + audit_logs (6.8): campuses (any mix of school/college branches),
 * departments, designations, number_sequences with next_code(), files (metadata only) and the audit trail.
 */
export class OrganizationAndAudit1793700000000 implements MigrationInterface {
  name = 'OrganizationAndAudit1793700000000';

  public async up(q: QueryRunner): Promise<void> {
    // Trusted extension (contrib): trigram indexes make name search fast at scale.
    await q.query(`CREATE EXTENSION IF NOT EXISTS pg_trgm`);

    await q.query(`CREATE TYPE "campus_kind" AS ENUM ('school', 'college', 'other')`);
    // 'read' is beyond the doc's list: it records access to sensitive data (health records).
    await q.query(`CREATE TYPE "audit_action" AS ENUM ('insert', 'update', 'delete', 'read')`);

    // Append-only tables (audit_logs, student_status_history) reject UPDATE / DELETE outright.
    await q.query(`
      CREATE OR REPLACE FUNCTION forbid_mutation() RETURNS trigger AS $$
      BEGIN
        RAISE EXCEPTION '% is append-only', TG_TABLE_NAME;
      END
      $$ LANGUAGE plpgsql`);

    // ---- files: metadata only; the object lives in private storage (S3 later)
    await q.query(`
      CREATE TABLE "files" (
        "id" uuid NOT NULL DEFAULT gen_random_uuid(),
        "storage_key" text NOT NULL,
        "original_name" text NOT NULL,
        "mime_type" text NOT NULL,
        "size_bytes" bigint NOT NULL,
        "checksum" text,
        "uploaded_by" uuid,
        "created_at" timestamptz NOT NULL DEFAULT now(),
        "deleted_at" timestamptz,
        CONSTRAINT "pk_files" PRIMARY KEY ("id"),
        CONSTRAINT "uq_files_storage_key" UNIQUE ("storage_key"),
        CONSTRAINT "chk_files_size" CHECK (size_bytes >= 0)
      )`);

    // ---- campuses
    await q.query(`
      CREATE TABLE "campuses" (
        "id" uuid NOT NULL DEFAULT gen_random_uuid(),
        "code" text NOT NULL,
        "name" text NOT NULL,
        "kind" "campus_kind" NOT NULL DEFAULT 'school',
        "emis_school_code" text,
        "address" text,
        "phone" text,
        "is_active" boolean NOT NULL DEFAULT true,
        "created_at" timestamptz NOT NULL DEFAULT now(),
        "updated_at" timestamptz NOT NULL DEFAULT now(),
        "deleted_at" timestamptz,
        CONSTRAINT "pk_campuses" PRIMARY KEY ("id")
      )`);
    await q.query(`CREATE UNIQUE INDEX "uq_campuses_code_live" ON "campuses" ("code") WHERE deleted_at IS NULL`);
    await q.query(`CREATE TRIGGER "trg_campuses_updated_at" BEFORE UPDATE ON "campuses" FOR EACH ROW EXECUTE FUNCTION set_updated_at()`);

    // ---- departments (campus_id NULL = whole institution)
    await q.query(`
      CREATE TABLE "departments" (
        "id" uuid NOT NULL DEFAULT gen_random_uuid(),
        "campus_id" uuid,
        "code" text,
        "name" text NOT NULL,
        "is_active" boolean NOT NULL DEFAULT true,
        "created_at" timestamptz NOT NULL DEFAULT now(),
        "updated_at" timestamptz NOT NULL DEFAULT now(),
        "deleted_at" timestamptz,
        CONSTRAINT "pk_departments" PRIMARY KEY ("id"),
        CONSTRAINT "fk_departments_campus" FOREIGN KEY ("campus_id") REFERENCES "campuses"("id")
      )`);
    await q.query(`CREATE INDEX "idx_departments_campus" ON "departments" ("campus_id")`);
    await q.query(`
      CREATE UNIQUE INDEX "uq_departments_name_live" ON "departments"
        (COALESCE("campus_id", '00000000-0000-0000-0000-000000000000'::uuid), lower("name")) WHERE deleted_at IS NULL`);
    await q.query(`CREATE TRIGGER "trg_departments_updated_at" BEFORE UPDATE ON "departments" FOR EACH ROW EXECUTE FUNCTION set_updated_at()`);

    // ---- designations
    await q.query(`
      CREATE TABLE "designations" (
        "id" uuid NOT NULL DEFAULT gen_random_uuid(),
        "name" text NOT NULL,
        "is_active" boolean NOT NULL DEFAULT true,
        "created_at" timestamptz NOT NULL DEFAULT now(),
        "updated_at" timestamptz NOT NULL DEFAULT now(),
        "deleted_at" timestamptz,
        CONSTRAINT "pk_designations" PRIMARY KEY ("id")
      )`);
    await q.query(`CREATE UNIQUE INDEX "uq_designations_name_live" ON "designations" (lower("name")) WHERE deleted_at IS NULL`);
    await q.query(`CREATE TRIGGER "trg_designations_updated_at" BEFORE UPDATE ON "designations" FOR EACH ROW EXECUTE FUNCTION set_updated_at()`);

    // ---- number_sequences + next_code()
    await q.query(`
      CREATE TABLE "number_sequences" (
        "code" text NOT NULL,
        "prefix" text NOT NULL DEFAULT '',
        "padding" integer NOT NULL DEFAULT 4,
        "next_value" bigint NOT NULL DEFAULT 1,
        "reset_yearly" boolean NOT NULL DEFAULT false,
        "last_reset_year" integer,
        CONSTRAINT "pk_number_sequences" PRIMARY KEY ("code"),
        CONSTRAINT "chk_number_sequences_padding" CHECK (padding BETWEEN 1 AND 12),
        CONSTRAINT "chk_number_sequences_next_value" CHECK (next_value >= 1)
      )`);
    // Locks the series row, so concurrent admissions can never get the same number. Called inside the
    // inserting transaction: a rollback also rolls back the counter, keeping the series gap-free.
    await q.query(`
      CREATE OR REPLACE FUNCTION next_code(p_code text) RETURNS text AS $$
      DECLARE
        s number_sequences%ROWTYPE;
        y integer := EXTRACT(YEAR FROM now())::integer;
        v bigint;
      BEGIN
        SELECT * INTO s FROM number_sequences WHERE code = p_code FOR UPDATE;
        IF NOT FOUND THEN
          RAISE EXCEPTION 'Unknown number sequence %', p_code;
        END IF;
        v := CASE WHEN s.reset_yearly AND s.last_reset_year IS DISTINCT FROM y THEN 1 ELSE s.next_value END;
        UPDATE number_sequences
           SET next_value = v + 1,
               last_reset_year = CASE WHEN s.reset_yearly THEN y ELSE last_reset_year END
         WHERE code = p_code;
        RETURN s.prefix
          || CASE WHEN s.reset_yearly THEN y::text || '-' ELSE '' END
          || CASE WHEN length(v::text) >= s.padding THEN v::text ELSE lpad(v::text, s.padding, '0') END;
      END
      $$ LANGUAGE plpgsql`);
    await q.query(`
      INSERT INTO number_sequences (code, prefix, padding, reset_yearly) VALUES
        ('admission_no', 'ADM-', 5, true),
        ('employee_code', 'EMP-', 4, false)
      ON CONFLICT (code) DO NOTHING`);

    // ---- audit_logs (no FKs on purpose: survives deletions and describes any table)
    await q.query(`
      CREATE TABLE "audit_logs" (
        "id" bigserial NOT NULL,
        "table_name" text NOT NULL,
        "record_id" uuid NOT NULL,
        "action" "audit_action" NOT NULL,
        "old_data" jsonb,
        "new_data" jsonb,
        "changed_by" uuid,
        "changed_at" timestamptz NOT NULL DEFAULT now(),
        "ip_address" inet,
        CONSTRAINT "pk_audit_logs" PRIMARY KEY ("id")
      )`);
    await q.query(`CREATE INDEX "idx_audit_logs_record" ON "audit_logs" ("table_name", "record_id")`);
    await q.query(`CREATE INDEX "idx_audit_logs_changed_at" ON "audit_logs" ("changed_at")`);
    await q.query(`CREATE TRIGGER "trg_audit_logs_append_only" BEFORE UPDATE OR DELETE ON "audit_logs" FOR EACH ROW EXECUTE FUNCTION forbid_mutation()`);

    await seedPermissions(q, [
      ['org.read', 'View campuses, departments, designations and number series'],
      ['org.manage', 'Create, edit and remove campuses, departments, designations; configure number series'],
    ], {
      principal: ['org.read'],
      hod: ['org.read'],
      class_teacher: ['org.read'],
      teacher: ['org.read'],
      accountant: ['org.read'],
    });
  }

  public async down(q: QueryRunner): Promise<void> {
    await q.query(`DELETE FROM permissions WHERE code IN ('org.read', 'org.manage')`);
    await q.query(`DROP TABLE "audit_logs"`);
    await q.query(`DROP FUNCTION next_code(text)`);
    await q.query(`DROP TABLE "number_sequences"`);
    await q.query(`DROP TABLE "designations"`);
    await q.query(`DROP TABLE "departments"`);
    await q.query(`DROP TABLE "campuses"`);
    await q.query(`DROP TABLE "files"`);
    await q.query(`DROP FUNCTION forbid_mutation()`);
    await q.query(`DROP TYPE "audit_action"`);
    await q.query(`DROP TYPE "campus_kind"`);
  }
}
