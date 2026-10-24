import { MigrationInterface, QueryRunner } from "typeorm";

export class ControlPlaneEntities1792822680796 implements MigrationInterface {
    name = 'ControlPlaneEntities1792822680796'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`CREATE TABLE "platform_audit_events" ("id" uuid NOT NULL DEFAULT gen_random_uuid(), "actor_id" uuid, "action" character varying(100) NOT NULL, "target_type" character varying(50), "target_id" character varying(100), "metadata" jsonb, "createdAt" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "PK_402e868f2d94e98f39869fb3dbb" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE TABLE "platform_users" ("id" uuid NOT NULL DEFAULT gen_random_uuid(), "email" character varying NOT NULL, "name" character varying NOT NULL, "password_hash" character varying NOT NULL, "is_active" boolean NOT NULL DEFAULT true, "createdAt" TIMESTAMP NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "UQ_b616fa69a7b331fc2a7906a83d2" UNIQUE ("email"), CONSTRAINT "PK_69bfedb2b67d1014d7b7741f5b4" PRIMARY KEY ("id"))`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`DROP TABLE "platform_users"`);
        await queryRunner.query(`DROP TABLE "platform_audit_events"`);
    }

}
