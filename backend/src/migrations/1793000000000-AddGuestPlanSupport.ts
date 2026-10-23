import { MigrationInterface, QueryRunner } from "typeorm";

export class AddGuestPlanSupport1793000000000 implements MigrationInterface {
    name = 'AddGuestPlanSupport1793000000000'

    public async up(queryRunner: QueryRunner): Promise<void> {
        // Guest plans are lead-in builds that exist without a user or project.
        // They are reachable only via a high-entropy token for 24h (Redis TTL),
        // so the scoping columns must be nullable.
        await queryRunner.query(`ALTER TABLE "dra_paid_media_plans" ALTER COLUMN "project_id" DROP NOT NULL`);
        await queryRunner.query(`ALTER TABLE "dra_paid_media_plans" ALTER COLUMN "organization_id" DROP NOT NULL`);
        await queryRunner.query(`ALTER TABLE "dra_paid_media_plans" ALTER COLUMN "workspace_id" DROP NOT NULL`);
        await queryRunner.query(`ALTER TABLE "dra_paid_media_plans" ALTER COLUMN "created_by" DROP NOT NULL`);
        await queryRunner.query(`ALTER TABLE "dra_paid_media_plans" ADD COLUMN "is_guest" boolean NOT NULL DEFAULT false`);
        await queryRunner.query(`ALTER TABLE "dra_paid_media_plans" ADD COLUMN "guest_token" character varying(128)`);
        await queryRunner.query(`CREATE INDEX IF NOT EXISTS "IDX_dra_paid_media_plans_guest_token" ON "dra_paid_media_plans" ("guest_token")`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`DROP INDEX IF EXISTS "IDX_dra_paid_media_plans_guest_token"`);
        await queryRunner.query(`ALTER TABLE "dra_paid_media_plans" DROP COLUMN IF EXISTS "guest_token"`);
        await queryRunner.query(`ALTER TABLE "dra_paid_media_plans" DROP COLUMN IF EXISTS "is_guest"`);
        await queryRunner.query(`ALTER TABLE "dra_paid_media_plans" ALTER COLUMN "created_by" SET NOT NULL`);
        await queryRunner.query(`ALTER TABLE "dra_paid_media_plans" ALTER COLUMN "workspace_id" SET NOT NULL`);
        await queryRunner.query(`ALTER TABLE "dra_paid_media_plans" ALTER COLUMN "organization_id" SET NOT NULL`);
        await queryRunner.query(`ALTER TABLE "dra_paid_media_plans" ALTER COLUMN "project_id" SET NOT NULL`);
    }
}
