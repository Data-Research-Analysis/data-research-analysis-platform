import { MigrationInterface, QueryRunner } from "typeorm";

/**
 * Tracks how much of the current month's *granted* credits are still unused.
 *
 * Free (non-rollover) plans reset their monthly grant at the start of the next
 * month. Without a dedicated counter the reset would have to be clamped to the
 * whole balance, which can also wipe purchased pack credits. This column lets
 * grantMonthly expire only the unused monthly grant and leave pack credits
 * untouched (packs always roll over).
 */
export class AddMonthlyCreditTracking1800000001000 implements MigrationInterface {
    name = 'AddMonthlyCreditTracking1800000001000'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(
            `ALTER TABLE "dra_credit_wallets" ADD COLUMN "monthly_credits_remaining" numeric(14,2) NOT NULL DEFAULT 0`
        );
        await queryRunner.query(`
            UPDATE "dra_credit_wallets"
            SET "monthly_credits_remaining" = LEAST("balance_credits", "monthly_grant_amount")
            WHERE "monthly_credits_granted_at" IS NOT NULL
        `);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "dra_credit_wallets" DROP COLUMN IF EXISTS "monthly_credits_remaining"`);
    }
}
