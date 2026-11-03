import { MigrationInterface, QueryRunner } from "typeorm";

/**
 * Backfill the variable-credit Pro override for existing paid subscriptions.
 *
 * The Pro tier is priced per 1,000 credits and stores its monthly allowance on
 * the subscription (`credits_per_month_override`). Subscriptions created before
 * the credit model (or migrated from the legacy Starter/Professional tiers)
 * have no override, and the Pro tier's own `credits_per_month` is 0 — without
 * this backfill the monthly grant job would skip them entirely.
 *
 * Only active, non-Free subscriptions with a positive tier allowance are
 * touched; Free keeps its 500-credit grant.
 */
export class BackfillProCreditOverrides1800000002000 implements MigrationInterface {
    name = 'BackfillProCreditOverrides1800000002000'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`
            UPDATE "dra_organization_subscriptions" AS s
            SET "credits_per_month_override" = t."credits_per_month"
            FROM "dra_subscription_tiers" AS t
            WHERE s."subscription_tier_id" = t."id"
              AND s."credits_per_month_override" IS NULL
              AND s."is_active" = true
              AND t."credits_per_month" > 0
              AND UPPER(t."tier_name") <> 'FREE'
        `);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        // Cannot distinguish backfilled overrides from real ones — no-op.
    }
}
