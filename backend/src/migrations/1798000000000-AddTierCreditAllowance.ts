import { MigrationInterface, QueryRunner } from "typeorm";

/**
 * Maps each subscription tier to its monthly credit allowance (plan §5/§6).
 *
 * In credit-pricing mode a subscription grants credits_per_month to the org
 * wallet each month; credits_rollover=false (FREE) means the previous month's
 * grant expires when the new one is applied. ENTERPRISE is 0 (custom —
 * allowance is set via admin adjustments / custom contract).
 */
export class AddTierCreditAllowance1798000000000 implements MigrationInterface {
    name = 'AddTierCreditAllowance1798000000000'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "dra_subscription_tiers" ADD COLUMN "credits_per_month" numeric(14,2) NOT NULL DEFAULT 0`);
        await queryRunner.query(`ALTER TABLE "dra_subscription_tiers" ADD COLUMN "credits_rollover" boolean NOT NULL DEFAULT true`);

        await queryRunner.query(`UPDATE "dra_subscription_tiers" SET "credits_per_month" = 500, "credits_rollover" = false WHERE UPPER("tier_name") = 'FREE'`);
        await queryRunner.query(`UPDATE "dra_subscription_tiers" SET "credits_per_month" = 5000 WHERE UPPER("tier_name") = 'STARTER'`);
        await queryRunner.query(`UPDATE "dra_subscription_tiers" SET "credits_per_month" = 10000 WHERE UPPER("tier_name") = 'PROFESSIONAL'`);
        await queryRunner.query(`UPDATE "dra_subscription_tiers" SET "credits_per_month" = 25000 WHERE UPPER("tier_name") IN ('PROFESSIONAL PLUS', 'PRO_PLUS')`);
        await queryRunner.query(`UPDATE "dra_subscription_tiers" SET "credits_per_month" = 0 WHERE UPPER("tier_name") = 'ENTERPRISE'`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "dra_subscription_tiers" DROP COLUMN IF EXISTS "credits_rollover"`);
        await queryRunner.query(`ALTER TABLE "dra_subscription_tiers" DROP COLUMN IF EXISTS "credits_per_month"`);
    }
}
