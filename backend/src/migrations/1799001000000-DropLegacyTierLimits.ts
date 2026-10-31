import { MigrationInterface, QueryRunner } from "typeorm";

/**
 * Remove legacy count-based tier limits.
 *
 * The product now uses the un-gated credit model: projects, channels, data
 * models, dashboards, AI generations, plan builds and seats are unlimited on
 * every plan. Only the data row allowance remains as a capacity guardrail.
 */
export class DropLegacyTierLimits1799001000000 implements MigrationInterface {
    name = 'DropLegacyTierLimits1799001000000'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`
            ALTER TABLE "dra_subscription_tiers"
                DROP COLUMN IF EXISTS "max_projects",
                DROP COLUMN IF EXISTS "max_data_sources_per_project",
                DROP COLUMN IF EXISTS "max_data_models_per_data_source",
                DROP COLUMN IF EXISTS "max_dashboards",
                DROP COLUMN IF EXISTS "max_members_per_project",
                DROP COLUMN IF EXISTS "ai_generations_per_month",
                DROP COLUMN IF EXISTS "max_plans_per_month"
        `);

        await queryRunner.query(`
            ALTER TABLE "dra_organization_subscriptions"
                DROP COLUMN IF EXISTS "max_members"
        `);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`
            ALTER TABLE "dra_subscription_tiers"
                ADD COLUMN IF NOT EXISTS "max_projects" integer,
                ADD COLUMN IF NOT EXISTS "max_data_sources_per_project" integer,
                ADD COLUMN IF NOT EXISTS "max_data_models_per_data_source" integer,
                ADD COLUMN IF NOT EXISTS "max_dashboards" integer,
                ADD COLUMN IF NOT EXISTS "max_members_per_project" integer,
                ADD COLUMN IF NOT EXISTS "ai_generations_per_month" integer,
                ADD COLUMN IF NOT EXISTS "max_plans_per_month" integer
        `);

        await queryRunner.query(`
            ALTER TABLE "dra_organization_subscriptions"
                ADD COLUMN IF NOT EXISTS "max_members" integer
        `);
    }
}
