import { MigrationInterface, QueryRunner } from "typeorm";

export class AddAdvancedToolsAllowedToTiers1793005000000 implements MigrationInterface {
    name = 'AddAdvancedToolsAllowedToTiers1793005000000'

    public async up(queryRunner: QueryRunner): Promise<void> {
        // The BI layer (data models, custom dashboards, reports, AI insights,
        // engineering connectors) becomes a Professional+ entitlement. Free and
        // Starter keep the marketing workspace only.
        await queryRunner.query(
            `ALTER TABLE "dra_subscription_tiers" ADD COLUMN "advanced_tools_allowed" boolean NOT NULL DEFAULT false`
        );
        await queryRunner.query(
            `UPDATE "dra_subscription_tiers"
             SET "advanced_tools_allowed" = true
             WHERE "tier_rank" >= 20`
        );
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(
            `ALTER TABLE "dra_subscription_tiers" DROP COLUMN IF EXISTS "advanced_tools_allowed"`
        );
    }
}
