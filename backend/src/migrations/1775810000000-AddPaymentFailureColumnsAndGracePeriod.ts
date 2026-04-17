import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Adds payment failure tracking columns to dra_organization_subscriptions:
 *   - payment_failure_code: Paddle error code from the failed transaction (e.g. 'insufficient_funds')
 *   - payment_retry_count:  Number of times payment has failed in the current grace period cycle
 *
 * Adds configurable grace period to dra_subscription_tiers:
 *   - grace_period_days: How many days the org retains access after a payment failure.
 *     Previously hardcoded to 14 everywhere; now each tier can have a different value.
 *     Defaults: 14 days. Can be raised for higher tiers (e.g. 30 for Enterprise).
 */
export class AddPaymentFailureColumnsAndGracePeriod1775810000000 implements MigrationInterface {
    public async up(queryRunner: QueryRunner): Promise<void> {
        // Payment failure tracking on subscriptions
        await queryRunner.query(`
            ALTER TABLE dra_organization_subscriptions
            ADD COLUMN IF NOT EXISTS payment_failure_code VARCHAR(100) NULL,
            ADD COLUMN IF NOT EXISTS payment_retry_count  INT NOT NULL DEFAULT 0;
        `);

        // Configurable grace period on subscription tiers
        await queryRunner.query(`
            ALTER TABLE dra_subscription_tiers
            ADD COLUMN IF NOT EXISTS grace_period_days INT NOT NULL DEFAULT 14;
        `);

        // Set sensible per-tier defaults
        await queryRunner.query(`
            UPDATE dra_subscription_tiers SET grace_period_days = 14 WHERE tier_name IN ('free', 'starter');
            UPDATE dra_subscription_tiers SET grace_period_days = 21 WHERE tier_name IN ('professional', 'professional_plus');
            UPDATE dra_subscription_tiers SET grace_period_days = 30 WHERE tier_name = 'enterprise';
        `);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`
            ALTER TABLE dra_organization_subscriptions
            DROP COLUMN IF EXISTS payment_failure_code,
            DROP COLUMN IF EXISTS payment_retry_count;
        `);
        await queryRunner.query(`
            ALTER TABLE dra_subscription_tiers
            DROP COLUMN IF EXISTS grace_period_days;
        `);
    }
}
