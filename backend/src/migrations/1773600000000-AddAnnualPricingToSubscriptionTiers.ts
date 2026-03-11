import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddAnnualPricingToSubscriptionTiers1773600000000 implements MigrationInterface {
    name = 'AddAnnualPricingToSubscriptionTiers1773600000000';

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`
            ALTER TABLE "dra_subscription_tiers"
            ADD COLUMN IF NOT EXISTS "price_per_year_usd" NUMERIC(10,2) NULL
        `);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`
            ALTER TABLE "dra_subscription_tiers"
            DROP COLUMN IF EXISTS "price_per_year_usd"
        `);
    }
}
