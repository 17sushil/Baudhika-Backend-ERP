import { MigrationInterface, QueryRunner } from 'typeorm';
import { seedPermissions } from '../../database/tenant/seed-permissions';

// Must match Person.displayName asExpression exactly (also recorded in typeorm_metadata for the drift check).
const DISPLAY_NAME_EXPR = `first_name || COALESCE(' ' || middle_name, '') || COALESCE(' ' || last_name, '')`;

/** Person core identity (design doc 6.3): one row per human, with contacts and addresses. */
export class People1793700000001 implements MigrationInterface {
  name = 'People1793700000001';

  public async up(q: QueryRunner): Promise<void> {
    await q.query(`CREATE TYPE "gender_kind" AS ENUM ('male', 'female', 'other')`);
    await q.query(`CREATE TYPE "blood_group_kind" AS ENUM ('A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-')`);
    await q.query(`CREATE TYPE "contact_kind" AS ENUM ('phone', 'email', 'whatsapp')`);
    await q.query(`CREATE TYPE "address_kind" AS ENUM ('current', 'permanent', 'work')`);

    await q.query(`
      CREATE TABLE "persons" (
        "id" uuid NOT NULL DEFAULT gen_random_uuid(),
        "user_id" uuid,
        "first_name" text NOT NULL,
        "middle_name" text,
        "last_name" text,
        "display_name" text GENERATED ALWAYS AS (${DISPLAY_NAME_EXPR}) STORED NOT NULL,
        "gender" "gender_kind",
        "dob" date,
        "birth_place" text,
        "blood_group" "blood_group_kind",
        "nationality" text,
        "national_id" text,
        "mother_tongue" text,
        "religion" text,
        "ethnicity" text,
        "photo_file_id" uuid,
        "created_at" timestamptz NOT NULL DEFAULT now(),
        "updated_at" timestamptz NOT NULL DEFAULT now(),
        "created_by" uuid,
        "updated_by" uuid,
        "deleted_at" timestamptz,
        CONSTRAINT "pk_persons" PRIMARY KEY ("id"),
        CONSTRAINT "fk_persons_user" FOREIGN KEY ("user_id") REFERENCES "users"("id"),
        CONSTRAINT "fk_persons_photo_file" FOREIGN KEY ("photo_file_id") REFERENCES "files"("id")
      )`);
    // One login belongs to at most one live person.
    await q.query(`CREATE UNIQUE INDEX "uq_persons_user_live" ON "persons" ("user_id") WHERE user_id IS NOT NULL AND deleted_at IS NULL`);
    await q.query(`CREATE INDEX "idx_persons_name" ON "persons" (lower("first_name"), lower("last_name"))`);
    await q.query(`CREATE INDEX "idx_persons_display_name_trgm" ON "persons" USING gin ("display_name" gin_trgm_ops)`);
    await q.query(`CREATE TRIGGER "trg_persons_updated_at" BEFORE UPDATE ON "persons" FOR EACH ROW EXECUTE FUNCTION set_updated_at()`);
    // TypeORM compares generated-column expressions through this table; without the row the drift check
    // would want to recreate display_name.
    await q.query(`
      CREATE TABLE IF NOT EXISTS "typeorm_metadata" (
        "type" varchar NOT NULL, "database" varchar, "schema" varchar, "table" varchar, "name" varchar, "value" text
      )`);
    await q.query(
      `INSERT INTO "typeorm_metadata" ("database", "schema", "table", "type", "name", "value")
       VALUES (current_database(), 'public', 'persons', 'GENERATED_COLUMN', 'display_name', $1)`,
      [DISPLAY_NAME_EXPR],
    );

    await q.query(`
      CREATE TABLE "person_contacts" (
        "id" uuid NOT NULL DEFAULT gen_random_uuid(),
        "person_id" uuid NOT NULL,
        "type" "contact_kind" NOT NULL,
        "value" text NOT NULL,
        "is_primary" boolean NOT NULL DEFAULT false,
        "verified_at" timestamptz,
        "created_at" timestamptz NOT NULL DEFAULT now(),
        "deleted_at" timestamptz,
        CONSTRAINT "pk_person_contacts" PRIMARY KEY ("id"),
        CONSTRAINT "fk_person_contacts_person" FOREIGN KEY ("person_id") REFERENCES "persons"("id")
      )`);
    await q.query(`CREATE INDEX "idx_person_contacts_person" ON "person_contacts" ("person_id")`);
    // Not unique: families often share one phone number. Used to find a parent by phone during admission.
    await q.query(`CREATE INDEX "idx_person_contacts_value" ON "person_contacts" ("value")`);
    // At most one live primary contact per type (the doc leaves this to the app; the DB makes it race-proof).
    await q.query(`
      CREATE UNIQUE INDEX "uq_person_contacts_primary" ON "person_contacts" ("person_id", "type")
        WHERE is_primary AND deleted_at IS NULL`);

    await q.query(`
      CREATE TABLE "person_addresses" (
        "id" uuid NOT NULL DEFAULT gen_random_uuid(),
        "person_id" uuid NOT NULL,
        "type" "address_kind" NOT NULL,
        "line1" text,
        "line2" text,
        "ward" text,
        "municipality" text,
        "district" text,
        "province" text,
        "postal_code" text,
        "country" text NOT NULL DEFAULT 'NP',
        "latitude" numeric(9,6),
        "longitude" numeric(9,6),
        "created_at" timestamptz NOT NULL DEFAULT now(),
        "updated_at" timestamptz NOT NULL DEFAULT now(),
        "deleted_at" timestamptz,
        CONSTRAINT "pk_person_addresses" PRIMARY KEY ("id"),
        CONSTRAINT "fk_person_addresses_person" FOREIGN KEY ("person_id") REFERENCES "persons"("id"),
        CONSTRAINT "chk_person_addresses_lat" CHECK (latitude IS NULL OR latitude BETWEEN -90 AND 90),
        CONSTRAINT "chk_person_addresses_lng" CHECK (longitude IS NULL OR longitude BETWEEN -180 AND 180)
      )`);
    await q.query(`CREATE INDEX "idx_person_addresses_person" ON "person_addresses" ("person_id")`);
    await q.query(`CREATE TRIGGER "trg_person_addresses_updated_at" BEFORE UPDATE ON "person_addresses" FOR EACH ROW EXECUTE FUNCTION set_updated_at()`);

    await seedPermissions(q, [
      ['person.read', 'View people (names, contacts, addresses)'],
      ['person.create', 'Create people'],
      ['person.update', 'Edit people, their contacts and addresses; link a login'],
    ], {
      principal: ['person.read', 'person.create', 'person.update'],
      accountant: ['person.read'],
    });
  }

  public async down(q: QueryRunner): Promise<void> {
    await q.query(`DELETE FROM permissions WHERE code IN ('person.read', 'person.create', 'person.update')`);
    await q.query(`DROP TABLE "person_addresses"`);
    await q.query(`DROP TABLE "person_contacts"`);
    await q.query(`DELETE FROM "typeorm_metadata" WHERE "table" = 'persons' AND "name" = 'display_name'`);
    await q.query(`DROP TABLE "persons"`);
    await q.query(`DROP TYPE "address_kind"`);
    await q.query(`DROP TYPE "contact_kind"`);
    await q.query(`DROP TYPE "blood_group_kind"`);
    await q.query(`DROP TYPE "gender_kind"`);
  }
}
