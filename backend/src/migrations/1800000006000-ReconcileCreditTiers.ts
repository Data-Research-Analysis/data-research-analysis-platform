import { MigrationInterface, QueryRunner } from "typeorm";

/**
 * Reconcile tier rows with the Free/Pro credit model.
 *
 * Seeders only create missing tiers and never update existing rows, so this
 * migration fixes databases that were seeded before the credit model:
 *
 * - Free tiers created by the seeder have credits_per_month = 0 (the credit
 *   migration ran before the tier rows existed), so they never receive the
 *   monthly grant. Restore the 500-credit, non-rollover allowance.
 * - Pro tiers with no configured allowance fall back to the default 10,000
 *   credits. Subscriptions with credits_per_month_override keep their value.
 * - Zero row allowances are replaced with the seeded Free/Pro values; positive
 *   and -1 (unlimited) values are left untouched for admin customization.
 * - Starter and Professional Plus are retired plans. Deactivate them when no
 *   active subscription still references them.
 */
export class ReconcileCreditTiers1800000006000 implements MigrationInterface {
    name = 'ReconcileCreditTiers1800000006000';

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`
            UPDATE "dra_subscription_tiers"
            SET "credits_per_month" = 500,
                "credits_rollover" = false
            WHERE UPPER("tier_name") = 'FREE'
              AND "credits_per_month" = 0
        `);

        await queryRunner.query(`
            UPDATE "dra_subscription_tiers"
            SET "credits_per_month" = 10000,
                "credits_rollover" = true
            WHERE "tier_name" ILIKE '%pro%'
              AND "tier_name" NOT ILIKE '%plus%'
              AND "tier_name" NOT ILIKE '%free%'
              AND "tier_name" NOT ILIKE '%enterprise%'
              AND "credits_per_month" = 0
        `);

        await queryRunner.query(`
            UPDATE "dra_subscription_tiers"
            SET "max_rows_per_data_model" = 50000
            WHERE UPPER("tier_name") = 'FREE'
              AND "max_rows_per_data_model" = 0
        `);

        await queryRunner.query(`
            UPDATE "dra_subscription_tiers"
            SET "max_rows_per_data_model" = 5000000
            WHERE "tier_name" ILIKE '%pro%'
              AND "tier_name" NOT ILIKE '%plus%'
              AND "tier_name" NOT ILIKE '%free%'
              AND "tier_name" NOT ILIKE '%enterprise%'
              AND "max_rows_per_data_model" = 0
        `);

        await queryRunner.query(`
            UPDATE "dra_subscription_tiers" AS t
            SET "is_active" = false
            WHERE (
                    t."tier_rank" IN (10, 30)
                    OR UPPER(t."tier_name") LIKE '%STARTER%'
                    OR UPPER(t."tier_name") LIKE '%PROFESSIONAL PLUS%'
                    OR UPPER(t."tier_name") = 'PRO_PLUS'
                )
              AND NOT EXISTS (
                    SELECT 1
                    FROM "dra_organization_subscriptions" AS s
                    WHERE s."subscription_tier_id" = t."id"
                      AND s."is_active" = true
                )
        `);
    }

    public async down(): Promise<void> {
        // Data-only reconciliation: previous values cannot be reconstructed
        // (0 and 500 are both valid admin configurations), so this is a no-op.
    }
}
