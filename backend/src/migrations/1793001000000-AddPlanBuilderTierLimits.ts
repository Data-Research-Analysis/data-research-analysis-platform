import { MigrationInterface, QueryRunner } from "typeorm";

export class AddPlanBuilderTierLimits1793001000000 implements MigrationInterface {
    name = 'AddPlanBuilderTierLimits1793001000000'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "dra_subscription_tiers" ADD COLUMN "max_plans_per_month" integer`);
        await queryRunner.query(`ALTER TABLE "dra_subscription_tiers" ADD COLUMN "plan_advanced_mode_allowed" boolean NOT NULL DEFAULT false`);
        await queryRunner.query(`ALTER TABLE "dra_subscription_tiers" ADD COLUMN "plan_ai_chat_allowed" boolean NOT NULL DEFAULT false`);
        await queryRunner.query(`ALTER TABLE "dra_subscription_tiers" ADD COLUMN "plan_deck_export_allowed" boolean NOT NULL DEFAULT false`);

        // Apply the plan-builder entitlement matrix to existing tiers.
        // -1 = unlimited. Free/Starter get PDF/CSV export (default), no deck;
        //   Professional+ unlock advanced mode, AI chat and the deck.
        await queryRunner.query(`
            UPDATE "dra_subscription_tiers" SET
                "max_plans_per_month" = CASE "tier_rank"
                    WHEN 0 THEN 1
                    WHEN 10 THEN 3
                    WHEN 20 THEN 10
                    WHEN 30 THEN -1
                    WHEN 40 THEN -1
                    ELSE "max_plans_per_month"
                END,
                "plan_advanced_mode_allowed" = "tier_rank" >= 10,
                "plan_ai_chat_allowed" = "tier_rank" >= 20,
                "plan_deck_export_allowed" = "tier_rank" >= 20
        `);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "dra_subscription_tiers" DROP COLUMN IF EXISTS "plan_deck_export_allowed"`);
        await queryRunner.query(`ALTER TABLE "dra_subscription_tiers" DROP COLUMN IF EXISTS "plan_ai_chat_allowed"`);
        await queryRunner.query(`ALTER TABLE "dra_subscription_tiers" DROP COLUMN IF EXISTS "plan_advanced_mode_allowed"`);
        await queryRunner.query(`ALTER TABLE "dra_subscription_tiers" DROP COLUMN IF EXISTS "max_plans_per_month"`);
    }
}
