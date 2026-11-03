import { MigrationInterface, QueryRunner } from "typeorm";

/**
 * Remove per-tier feature-gate flags.
 *
 * The product is now un-gated in credit-pricing mode: data models, dashboards,
 * reports, AI insights, plan advanced mode, AI chat and the client
 * presentation deck are available on every plan.
 */
export class DropTierFeatureGates1800000000000 implements MigrationInterface {
    name = 'DropTierFeatureGates1800000000000'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`
            ALTER TABLE "dra_subscription_tiers"
                DROP COLUMN IF EXISTS "advanced_tools_allowed",
                DROP COLUMN IF EXISTS "plan_advanced_mode_allowed",
                DROP COLUMN IF EXISTS "plan_ai_chat_allowed",
                DROP COLUMN IF EXISTS "plan_deck_export_allowed"
        `);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`
            ALTER TABLE "dra_subscription_tiers"
                ADD COLUMN IF NOT EXISTS "advanced_tools_allowed" boolean NOT NULL DEFAULT false,
                ADD COLUMN IF NOT EXISTS "plan_advanced_mode_allowed" boolean NOT NULL DEFAULT false,
                ADD COLUMN IF NOT EXISTS "plan_ai_chat_allowed" boolean NOT NULL DEFAULT false,
                ADD COLUMN IF NOT EXISTS "plan_deck_export_allowed" boolean NOT NULL DEFAULT false
        `);
    }
}
