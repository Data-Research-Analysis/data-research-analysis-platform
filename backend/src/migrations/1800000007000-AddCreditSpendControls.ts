import { MigrationInterface, QueryRunner } from "typeorm";

/**
 * Credit spend controls (product-market business review, 2026-11-01).
 *
 * Adds workspace-level monthly spend caps and low-balance alert tracking, an
 * explicit auto-recharge consent timestamp, first-consumption instrumentation,
 * and per-member monthly limits.
 */
export class AddCreditSpendControls1800000007000 implements MigrationInterface {
    name = 'AddCreditSpendControls1800000007000'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(
            `ALTER TABLE "dra_credit_wallets" ADD COLUMN "spend_cap_credits" numeric(14,2)`
        );
        await queryRunner.query(
            `ALTER TABLE "dra_credit_wallets" ADD COLUMN "monthly_spent_credits" numeric(14,2) NOT NULL DEFAULT 0`
        );
        await queryRunner.query(
            `ALTER TABLE "dra_credit_wallets" ADD COLUMN "first_consumption_at" timestamp`
        );
        await queryRunner.query(
            `ALTER TABLE "dra_credit_wallets" ADD COLUMN "low_balance_alert_20_sent_at" timestamp`
        );
        await queryRunner.query(
            `ALTER TABLE "dra_credit_wallets" ADD COLUMN "low_balance_alert_10_sent_at" timestamp`
        );
        await queryRunner.query(
            `ALTER TABLE "dra_credit_wallets" ADD COLUMN "auto_recharge_consent_at" timestamp`
        );

        await queryRunner.query(`
            CREATE TABLE "dra_credit_member_limits" (
                "id" SERIAL PRIMARY KEY,
                "org_id" integer NOT NULL,
                "user_id" integer NOT NULL,
                "monthly_limit_credits" numeric(14,2),
                "monthly_spent_credits" numeric(14,2) NOT NULL DEFAULT 0,
                "period_start" date NOT NULL,
                "created_at" TIMESTAMP NOT NULL DEFAULT now(),
                "updated_at" TIMESTAMP NOT NULL DEFAULT now()
            )
        `);
        await queryRunner.query(
            `CREATE UNIQUE INDEX "idx_credit_member_limits_org_user" ON "dra_credit_member_limits" ("org_id", "user_id")`
        );
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`DROP TABLE IF EXISTS "dra_credit_member_limits"`);
        await queryRunner.query(`ALTER TABLE "dra_credit_wallets" DROP COLUMN IF EXISTS "auto_recharge_consent_at"`);
        await queryRunner.query(`ALTER TABLE "dra_credit_wallets" DROP COLUMN IF EXISTS "low_balance_alert_10_sent_at"`);
        await queryRunner.query(`ALTER TABLE "dra_credit_wallets" DROP COLUMN IF EXISTS "low_balance_alert_20_sent_at"`);
        await queryRunner.query(`ALTER TABLE "dra_credit_wallets" DROP COLUMN IF EXISTS "first_consumption_at"`);
        await queryRunner.query(`ALTER TABLE "dra_credit_wallets" DROP COLUMN IF EXISTS "monthly_spent_credits"`);
        await queryRunner.query(`ALTER TABLE "dra_credit_wallets" DROP COLUMN IF EXISTS "spend_cap_credits"`);
    }
}
