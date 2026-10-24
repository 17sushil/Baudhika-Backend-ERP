import { MigrationInterface, QueryRunner } from "typeorm";

export class PlatformSessionAuth1792825922948 implements MigrationInterface {
    name = 'PlatformSessionAuth1792825922948'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`CREATE TABLE "platform_otp_challenges" ("id" uuid NOT NULL DEFAULT gen_random_uuid(), "user_id" uuid NOT NULL, "code_hash" character varying(64) NOT NULL, "expires_at" TIMESTAMP WITH TIME ZONE NOT NULL, "attempts" integer NOT NULL DEFAULT '0', "consumed_at" TIMESTAMP WITH TIME ZONE, "createdAt" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "PK_493c170123081c906087bec6350" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE INDEX "IDX_a1a3f74be80595960edc91e9bd" ON "platform_otp_challenges"  ("user_id") `);
        await queryRunner.query(`CREATE TABLE "platform_refresh_tokens" ("id" uuid NOT NULL DEFAULT gen_random_uuid(), "family_id" uuid NOT NULL, "user_id" uuid NOT NULL, "token_hash" character varying(64) NOT NULL, "expires_at" TIMESTAMP WITH TIME ZONE NOT NULL, "session_expires_at" TIMESTAMP WITH TIME ZONE NOT NULL, "revoked_at" TIMESTAMP WITH TIME ZONE, "replaced_by_id" uuid, "createdAt" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "PK_5c2e776a445e812f49b71d1bcfd" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE INDEX "IDX_282c64982bd2dca36702f9ed26" ON "platform_refresh_tokens"  ("family_id") `);
        await queryRunner.query(`CREATE INDEX "IDX_2cf3935a0db0b2c2b4b6fa5ace" ON "platform_refresh_tokens"  ("user_id") `);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`DROP INDEX "public"."IDX_2cf3935a0db0b2c2b4b6fa5ace"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_282c64982bd2dca36702f9ed26"`);
        await queryRunner.query(`DROP TABLE "platform_refresh_tokens"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_a1a3f74be80595960edc91e9bd"`);
        await queryRunner.query(`DROP TABLE "platform_otp_challenges"`);
    }

}
