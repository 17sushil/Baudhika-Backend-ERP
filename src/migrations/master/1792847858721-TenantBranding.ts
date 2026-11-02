import { MigrationInterface, QueryRunner } from "typeorm";

export class TenantBranding1792847858721 implements MigrationInterface {
    name = 'TenantBranding1792847858721'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`CREATE TABLE "tenant_branding" ("tenant_id" uuid NOT NULL, "display_name" character varying(100) NOT NULL, "short_name" character varying(30), "description" character varying(300), "logo_url" character varying(500), "favicon_url" character varying(500), "primary_color" character varying(7) NOT NULL DEFAULT '#2563EB', "secondary_color" character varying(7) NOT NULL DEFAULT '#0F172A', "language" character varying(10) NOT NULL DEFAULT 'en', "published_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "PK_7b5ee1c1efb8a10a3ca744fe60c" PRIMARY KEY ("tenant_id"))`);
        await queryRunner.query(`ALTER TABLE "tenant_branding" ADD CONSTRAINT "FK_7b5ee1c1efb8a10a3ca744fe60c" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "tenant_branding" DROP CONSTRAINT "FK_7b5ee1c1efb8a10a3ca744fe60c"`);
        await queryRunner.query(`DROP TABLE "tenant_branding"`);
    }

}
