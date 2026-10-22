import { MigrationInterface, QueryRunner } from "typeorm";

/**
 * 2026-10 plan update (documentation/ai-usage-instrumentation-plan.md §2):
 *
 *  - Free:       1 project, 4 channels/project, 1 plan build/mo (unchanged)
 *  - Starter:    1 project, unlimited channels, 5 plan builds/mo, deck export ON
 *  - Professional: unlimited plan builds, unlimited AI generations
 *                (cost-based fair-use ceiling via ai_cost_ceiling_usd)
 *  - Pro+/Enterprise: unlimited as before
 *
 * Also adds ai_cost_ceiling_usd — a monthly AI cost ceiling per org used by
 * the fair-use enforcement hook (AICallTrackerService). Null/-1 = no ceiling.
 * Values here are starting anchors (Pro ~$10, Pro+ ~$50); final numbers are
 * set from live rollups after ~2 months of data, per the plan doc §6.4.
 */
export class UpdateTierLimitsFor2026Plans1796001000000 implements MigrationInterface {
    name = 'UpdateTierLimitsFor2026Plans1796001000000'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "dra_subscription_tiers" ADD COLUMN "ai_cost_ceiling_usd" numeric(12,2)`);

        await queryRunner.query(`
            UPDATE "dra_subscription_tiers" SET
                "max_projects" = CASE "tier_rank"
                    WHEN 0 THEN 1
                    WHEN 10 THEN 1
                    ELSE "max_projects"
                END,
                "max_data_sources_per_project" = CASE "tier_rank"
                    WHEN 0 THEN 4
                    WHEN 10 THEN -1
                    ELSE "max_data_sources_per_project"
                END,
                "max_plans_per_month" = CASE "tier_rank"
                    WHEN 10 THEN 5
                    WHEN 20 THEN -1
                    ELSE "max_plans_per_month"
                END,
                "plan_deck_export_allowed" = "tier_rank" >= 10,
                "ai_generations_per_month" = CASE "tier_rank"
                    WHEN 20 THEN -1
                    WHEN 30 THEN -1
                    WHEN 40 THEN -1
                    ELSE "ai_generations_per_month"
                END,
                "ai_cost_ceiling_usd" = CASE "tier_rank"
                    WHEN 20 THEN 10
                    WHEN 30 THEN 50
                    ELSE NULL
                END
        `);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "dra_subscription_tiers" DROP COLUMN IF EXISTS "ai_cost_ceiling_usd"`);
        await queryRunner.query(`
            UPDATE "dra_subscription_tiers" SET
                "max_projects" = CASE "tier_rank"
                    WHEN 0 THEN 3
                    WHEN 10 THEN 10
                    ELSE "max_projects"
                END,
                "max_data_sources_per_project" = CASE "tier_rank"
                    WHEN 0 THEN 5
                    WHEN 10 THEN 15
                    ELSE "max_data_sources_per_project"
                END,
                "max_plans_per_month" = CASE "tier_rank"
                    WHEN 10 THEN 3
                    WHEN 20 THEN 10
                    ELSE "max_plans_per_month"
                END,
                "plan_deck_export_allowed" = "tier_rank" >= 20,
                "ai_generations_per_month" = CASE "tier_rank"
                    WHEN 20 THEN 500
                    ELSE "ai_generations_per_month"
                END
        `);
    }
}
