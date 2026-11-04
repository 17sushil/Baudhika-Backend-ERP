import { MigrationInterface, QueryRunner } from 'typeorm';
import { seedPermissions } from '../../database/tenant/seed-permissions';

/** Student (6.4), Guardian (6.5) and Staff (6.6) profiles. Foreign keys never cascade: rows are soft deleted. */
export class StudentsGuardiansStaff1793700000002 implements MigrationInterface {
  name = 'StudentsGuardiansStaff1793700000002';

  public async up(q: QueryRunner): Promise<void> {
    await q.query(`CREATE TYPE "admission_kind" AS ENUM ('new', 'transfer_in', 'readmission')`);
    await q.query(`CREATE TYPE "student_status" AS ENUM ('applicant', 'active', 'alumni', 'transferred_out', 'dropped', 'suspended')`);
    await q.query(`CREATE TYPE "guardian_relation" AS ENUM ('father', 'mother', 'legal_guardian', 'grandparent', 'uncle_aunt', 'other')`);
    await q.query(`CREATE TYPE "staff_kind" AS ENUM ('teaching', 'non_teaching', 'admin', 'driver', 'support', 'management')`);
    await q.query(`CREATE TYPE "employment_kind" AS ENUM ('permanent', 'contract', 'visiting', 'part_time')`);
    await q.query(`CREATE TYPE "staff_status" AS ENUM ('active', 'on_leave', 'resigned', 'terminated', 'retired')`);

    // ---- students
    await q.query(`
      CREATE TABLE "students" (
        "id" uuid NOT NULL DEFAULT gen_random_uuid(),
        "person_id" uuid NOT NULL,
        "campus_id" uuid,
        "emis_id" text,
        "admission_no" text NOT NULL DEFAULT next_code('admission_no'),
        "admission_date" date NOT NULL,
        "admission_type" "admission_kind" NOT NULL DEFAULT 'new',
        "previous_school_name" text,
        "previous_school_class" text,
        "previous_tc_no" text,
        "has_special_needs" boolean NOT NULL DEFAULT false,
        "status" "student_status" NOT NULL DEFAULT 'active',
        "leaving_date" date,
        "leaving_reason" text,
        "tc_issued_no" text,
        "remarks" text,
        "created_at" timestamptz NOT NULL DEFAULT now(),
        "updated_at" timestamptz NOT NULL DEFAULT now(),
        "created_by" uuid,
        "updated_by" uuid,
        "deleted_at" timestamptz,
        CONSTRAINT "pk_students" PRIMARY KEY ("id"),
        CONSTRAINT "fk_students_person" FOREIGN KEY ("person_id") REFERENCES "persons"("id"),
        CONSTRAINT "fk_students_campus" FOREIGN KEY ("campus_id") REFERENCES "campuses"("id"),
        CONSTRAINT "chk_students_leaving_date" CHECK (leaving_date IS NULL OR leaving_date >= admission_date)
      )`);
    await q.query(`CREATE UNIQUE INDEX "uq_students_person_live" ON "students" ("person_id") WHERE deleted_at IS NULL`);
    await q.query(`CREATE UNIQUE INDEX "uq_students_admission_no_live" ON "students" ("admission_no") WHERE deleted_at IS NULL`);
    await q.query(`CREATE UNIQUE INDEX "uq_students_emis_id_live" ON "students" ("emis_id") WHERE emis_id IS NOT NULL AND deleted_at IS NULL`);
    await q.query(`CREATE INDEX "idx_students_status" ON "students" ("status")`);
    await q.query(`CREATE INDEX "idx_students_campus" ON "students" ("campus_id")`);
    await q.query(`CREATE TRIGGER "trg_students_updated_at" BEFORE UPDATE ON "students" FOR EACH ROW EXECUTE FUNCTION set_updated_at()`);

    await q.query(`
      CREATE TABLE "student_health" (
        "student_id" uuid NOT NULL,
        "allergies" text,
        "medical_conditions" text,
        "medications" text,
        "disability_type" text,
        "disability_notes" text,
        "doctor_name" text,
        "doctor_phone" text,
        "insurance_no" text,
        "emergency_instructions" text,
        "updated_at" timestamptz NOT NULL DEFAULT now(),
        "updated_by" uuid,
        CONSTRAINT "pk_student_health" PRIMARY KEY ("student_id"),
        CONSTRAINT "fk_student_health_student" FOREIGN KEY ("student_id") REFERENCES "students"("id")
      )`);
    await q.query(`CREATE TRIGGER "trg_student_health_updated_at" BEFORE UPDATE ON "student_health" FOR EACH ROW EXECUTE FUNCTION set_updated_at()`);

    await q.query(`
      CREATE TABLE "student_status_history" (
        "id" uuid NOT NULL DEFAULT gen_random_uuid(),
        "student_id" uuid NOT NULL,
        "from_status" "student_status",
        "to_status" "student_status" NOT NULL,
        "reason" text,
        "changed_by" uuid,
        "changed_at" timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT "pk_student_status_history" PRIMARY KEY ("id"),
        CONSTRAINT "fk_student_status_history_student" FOREIGN KEY ("student_id") REFERENCES "students"("id")
      )`);
    await q.query(`CREATE INDEX "idx_student_status_history_student" ON "student_status_history" ("student_id")`);
    await q.query(`CREATE TRIGGER "trg_student_status_history_append_only" BEFORE UPDATE OR DELETE ON "student_status_history" FOR EACH ROW EXECUTE FUNCTION forbid_mutation()`);

    // ---- guardians
    await q.query(`
      CREATE TABLE "guardians" (
        "id" uuid NOT NULL DEFAULT gen_random_uuid(),
        "person_id" uuid NOT NULL,
        "qualification" text,
        "occupation" text,
        "employer" text,
        "annual_income" numeric(14,2),
        "created_at" timestamptz NOT NULL DEFAULT now(),
        "updated_at" timestamptz NOT NULL DEFAULT now(),
        "created_by" uuid,
        "updated_by" uuid,
        "deleted_at" timestamptz,
        CONSTRAINT "pk_guardians" PRIMARY KEY ("id"),
        CONSTRAINT "fk_guardians_person" FOREIGN KEY ("person_id") REFERENCES "persons"("id"),
        CONSTRAINT "chk_guardians_annual_income" CHECK (annual_income IS NULL OR annual_income >= 0)
      )`);
    await q.query(`CREATE UNIQUE INDEX "uq_guardians_person_live" ON "guardians" ("person_id") WHERE deleted_at IS NULL`);
    await q.query(`CREATE TRIGGER "trg_guardians_updated_at" BEFORE UPDATE ON "guardians" FOR EACH ROW EXECUTE FUNCTION set_updated_at()`);

    await q.query(`
      CREATE TABLE "student_guardians" (
        "student_id" uuid NOT NULL,
        "guardian_id" uuid NOT NULL,
        "relation" "guardian_relation" NOT NULL,
        "is_primary" boolean NOT NULL DEFAULT false,
        "is_emergency_contact" boolean NOT NULL DEFAULT false,
        "lives_with_student" boolean NOT NULL DEFAULT true,
        "can_pickup" boolean NOT NULL DEFAULT true,
        "can_view_results" boolean NOT NULL DEFAULT true,
        "can_pay_fees" boolean NOT NULL DEFAULT true,
        "has_custody" boolean NOT NULL DEFAULT true,
        "valid_from" date,
        "valid_to" date,
        "created_at" timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT "pk_student_guardians" PRIMARY KEY ("student_id", "guardian_id"),
        CONSTRAINT "fk_student_guardians_student" FOREIGN KEY ("student_id") REFERENCES "students"("id"),
        CONSTRAINT "fk_student_guardians_guardian" FOREIGN KEY ("guardian_id") REFERENCES "guardians"("id"),
        CONSTRAINT "chk_student_guardians_validity" CHECK (valid_to IS NULL OR valid_from IS NULL OR valid_to >= valid_from)
      )`);
    await q.query(`CREATE UNIQUE INDEX "uq_student_guardians_primary" ON "student_guardians" ("student_id") WHERE is_primary`);
    await q.query(`CREATE INDEX "idx_student_guardians_guardian" ON "student_guardians" ("guardian_id")`);

    // ---- staff
    await q.query(`
      CREATE TABLE "staff" (
        "id" uuid NOT NULL DEFAULT gen_random_uuid(),
        "person_id" uuid NOT NULL,
        "campus_id" uuid,
        "employee_code" text NOT NULL DEFAULT next_code('employee_code'),
        "staff_type" "staff_kind" NOT NULL,
        "department_id" uuid,
        "designation_id" uuid,
        "reports_to" uuid,
        "employment_type" "employment_kind",
        "joining_date" date NOT NULL,
        "probation_end_date" date,
        "leaving_date" date,
        "leaving_reason" text,
        "emergency_contact_name" text,
        "emergency_contact_phone" text,
        "status" "staff_status" NOT NULL DEFAULT 'active',
        "created_at" timestamptz NOT NULL DEFAULT now(),
        "updated_at" timestamptz NOT NULL DEFAULT now(),
        "created_by" uuid,
        "updated_by" uuid,
        "deleted_at" timestamptz,
        CONSTRAINT "pk_staff" PRIMARY KEY ("id"),
        CONSTRAINT "fk_staff_person" FOREIGN KEY ("person_id") REFERENCES "persons"("id"),
        CONSTRAINT "fk_staff_campus" FOREIGN KEY ("campus_id") REFERENCES "campuses"("id"),
        CONSTRAINT "fk_staff_department" FOREIGN KEY ("department_id") REFERENCES "departments"("id"),
        CONSTRAINT "fk_staff_designation" FOREIGN KEY ("designation_id") REFERENCES "designations"("id"),
        CONSTRAINT "fk_staff_reports_to" FOREIGN KEY ("reports_to") REFERENCES "staff"("id"),
        CONSTRAINT "chk_staff_not_own_manager" CHECK (reports_to IS NULL OR reports_to <> id),
        CONSTRAINT "chk_staff_leaving_date" CHECK (leaving_date IS NULL OR leaving_date >= joining_date),
        CONSTRAINT "chk_staff_probation_end_date" CHECK (probation_end_date IS NULL OR probation_end_date >= joining_date)
      )`);
    await q.query(`CREATE UNIQUE INDEX "uq_staff_person_live" ON "staff" ("person_id") WHERE deleted_at IS NULL`);
    await q.query(`CREATE UNIQUE INDEX "uq_staff_employee_code_live" ON "staff" ("employee_code") WHERE deleted_at IS NULL`);
    await q.query(`CREATE INDEX "idx_staff_department" ON "staff" ("department_id")`);
    await q.query(`CREATE INDEX "idx_staff_campus" ON "staff" ("campus_id")`);
    await q.query(`CREATE INDEX "idx_staff_status" ON "staff" ("status")`);
    await q.query(`CREATE TRIGGER "trg_staff_updated_at" BEFORE UPDATE ON "staff" FOR EACH ROW EXECUTE FUNCTION set_updated_at()`);

    await q.query(`
      CREATE TABLE "teacher_profiles" (
        "staff_id" uuid NOT NULL,
        "highest_qualification" text,
        "specialization" text,
        "experience_years" numeric(4,1),
        "max_weekly_periods" integer,
        "teaching_license_no" text,
        CONSTRAINT "pk_teacher_profiles" PRIMARY KEY ("staff_id"),
        CONSTRAINT "fk_teacher_profiles_staff" FOREIGN KEY ("staff_id") REFERENCES "staff"("id"),
        CONSTRAINT "chk_teacher_profiles_experience" CHECK (experience_years IS NULL OR experience_years >= 0),
        CONSTRAINT "chk_teacher_profiles_periods" CHECK (max_weekly_periods IS NULL OR max_weekly_periods >= 0)
      )`);

    await q.query(`
      CREATE TABLE "driver_profiles" (
        "staff_id" uuid NOT NULL,
        "license_no" text NOT NULL,
        "license_class" text,
        "license_expiry" date NOT NULL,
        "medical_fitness_expiry" date,
        "police_verification_date" date,
        CONSTRAINT "pk_driver_profiles" PRIMARY KEY ("staff_id"),
        CONSTRAINT "fk_driver_profiles_staff" FOREIGN KEY ("staff_id") REFERENCES "staff"("id")
      )`);

    await q.query(`
      CREATE TABLE "staff_qualifications" (
        "id" uuid NOT NULL DEFAULT gen_random_uuid(),
        "staff_id" uuid NOT NULL,
        "degree" text NOT NULL,
        "institution" text,
        "passed_year" integer,
        "grade" text,
        "created_at" timestamptz NOT NULL DEFAULT now(),
        "deleted_at" timestamptz,
        CONSTRAINT "pk_staff_qualifications" PRIMARY KEY ("id"),
        CONSTRAINT "fk_staff_qualifications_staff" FOREIGN KEY ("staff_id") REFERENCES "staff"("id"),
        CONSTRAINT "chk_staff_qualifications_year" CHECK (passed_year IS NULL OR passed_year BETWEEN 1900 AND 2200)
      )`);
    await q.query(`CREATE INDEX "idx_staff_qualifications_staff" ON "staff_qualifications" ("staff_id")`);

    // Teachers/HODs get student access later through section allocations, never institution-wide here.
    await seedPermissions(q, [
      ['student.read', 'View students, their guardians and status history'],
      ['student.create', 'Admit students'],
      ['student.update', 'Edit students, change their status, link guardians'],
      ['student.delete', 'Remove applicant records entered by mistake'],
      ['student.health.update', 'Edit student health and disability records'],
      ['guardian.read', 'View guardians'],
      ['guardian.create', 'Create guardians'],
      ['guardian.update', 'Edit guardians'],
      ['guardian.delete', 'Remove guardians with no linked students'],
      ['staff.read', 'View staff, profiles and qualifications'],
      ['staff.create', 'Onboard staff'],
      ['staff.update', 'Edit staff, profiles, qualifications and status'],
      ['staff.delete', 'Remove staff records entered by mistake'],
    ], {
      principal: [
        'student.read', 'student.create', 'student.update', 'student.health.update',
        'guardian.read', 'guardian.create', 'guardian.update',
        'staff.read', 'staff.create', 'staff.update',
      ],
      accountant: ['student.read', 'guardian.read'],
    });
  }

  public async down(q: QueryRunner): Promise<void> {
    await q.query(`DELETE FROM permissions WHERE code LIKE 'student.%' AND code <> 'student.health.read'`);
    await q.query(`DELETE FROM permissions WHERE code IN ('guardian.read', 'guardian.create', 'guardian.update', 'guardian.delete')`);
    await q.query(`DELETE FROM permissions WHERE code LIKE 'staff.%'`);
    await q.query(`DROP TABLE "staff_qualifications"`);
    await q.query(`DROP TABLE "driver_profiles"`);
    await q.query(`DROP TABLE "teacher_profiles"`);
    await q.query(`DROP TABLE "staff"`);
    await q.query(`DROP TABLE "student_guardians"`);
    await q.query(`DROP TABLE "guardians"`);
    await q.query(`DROP TABLE "student_status_history"`);
    await q.query(`DROP TABLE "student_health"`);
    await q.query(`DROP TABLE "students"`);
    await q.query(`DROP TYPE "staff_status"`);
    await q.query(`DROP TYPE "employment_kind"`);
    await q.query(`DROP TYPE "staff_kind"`);
    await q.query(`DROP TYPE "guardian_relation"`);
    await q.query(`DROP TYPE "student_status"`);
    await q.query(`DROP TYPE "admission_kind"`);
  }
}
