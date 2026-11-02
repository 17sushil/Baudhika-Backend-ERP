import { MigrationInterface, QueryRunner } from "typeorm";

export class Init1792762276784 implements MigrationInterface {
    name = 'Init1792762276784'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`CREATE TABLE "tenants" ("id" uuid NOT NULL DEFAULT gen_random_uuid(), "slug" character varying NOT NULL, "name" character varying NOT NULL, "db_name" character varying NOT NULL, "createdAt" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "UQ_2310ecc5cb8be427097154b18fc" UNIQUE ("slug"), CONSTRAINT "UQ_0c23f1899cc408cd82281983b3a" UNIQUE ("db_name"), CONSTRAINT "PK_53be67a04681c66b87ee27c9321" PRIMARY KEY ("id"))`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`DROP TABLE "tenants"`);
    }

}
