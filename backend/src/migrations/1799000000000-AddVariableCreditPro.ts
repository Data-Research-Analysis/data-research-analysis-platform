import { MigrationInterface, QueryRunner } from "typeorm";

/**
 * Variable-credit Pro plan.
 *
 * - users_platform.interested_credits: credit volume chosen on the pricing card
 *   before registration, carried to checkout like interested_subscription_tier.
 * - dra_organization_subscriptions.credits_per_month_override: per-subscription
 *   monthly allowance that overrides the tier's fixed credits_per_month.
 * - dra_subscription_tiers.paddle_credits_unit_price_id_monthly/_annual:
 *   Paddle recurring price IDs for 1,000 Pro credits, used with
 *   quantity = credits / 1000 when checking out the variable-credit Pro plan.
 */
export class AddVariableCreditPro1799000000000 implements MigrationInterface {
    name = 'AddVariableCreditPro1799000000000'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "dra_users_platform" ADD COLUMN "interested_credits" integer NULL`);
        await queryRunner.query(`ALTER TABLE "dra_organization_subscriptions" ADD COLUMN "credits_per_month_override" integer NULL`);
        await queryRunner.query(`ALTER TABLE "dra_subscription_tiers" ADD COLUMN "paddle_credits_unit_price_id_monthly" varchar(100) NULL`);
        await queryRunner.query(`ALTER TABLE "dra_subscription_tiers" ADD COLUMN "paddle_credits_unit_price_id_annual" varchar(100) NULL`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "dra_subscription_tiers" DROP COLUMN IF EXISTS "paddle_credits_unit_price_id_annual"`);
        await queryRunner.query(`ALTER TABLE "dra_subscription_tiers" DROP COLUMN IF EXISTS "paddle_credits_unit_price_id_monthly"`);
        await queryRunner.query(`ALTER TABLE "dra_organization_subscriptions" DROP COLUMN IF EXISTS "credits_per_month_override"`);
        await queryRunner.query(`ALTER TABLE "dra_users_platform" DROP COLUMN IF EXISTS "interested_credits"`);
    }
}
