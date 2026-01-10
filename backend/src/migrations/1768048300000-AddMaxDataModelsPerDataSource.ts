import { MigrationInterface, QueryRunner } from "typeorm";

export class AddMaxDataModelsPerDataSource1768048300000 implements MigrationInterface {
    name = 'AddMaxDataModelsPerDataSource1768048300000'

    public async up(queryRunner: QueryRunner): Promise<void> {
        // Add max_data_models_per_data_source column to subscription tiers table
        await queryRunner.query(`
            ALTER TABLE "dra_subscription_tiers" 
            ADD COLUMN "max_data_models_per_data_source" integer NULL
        `);

        // Set default values for existing tiers
        // FREE: 3 data models per data source
        await queryRunner.query(`
            UPDATE "dra_subscription_tiers" 
            SET "max_data_models_per_data_source" = 3 
            WHERE "tier_name" = 'free'
        `);

        // PRO: 10 data models per data source
        await queryRunner.query(`
            UPDATE "dra_subscription_tiers" 
            SET "max_data_models_per_data_source" = 10 
            WHERE "tier_name" = 'pro'
        `);

        // TEAM: 25 data models per data source
        await queryRunner.query(`
            UPDATE "dra_subscription_tiers" 
            SET "max_data_models_per_data_source" = 25 
            WHERE "tier_name" = 'team'
        `);

        // BUSINESS: 50 data models per data source
        await queryRunner.query(`
            UPDATE "dra_subscription_tiers" 
            SET "max_data_models_per_data_source" = 50 
            WHERE "tier_name" = 'business'
        `);

        // ENTERPRISE: Unlimited (null)
        await queryRunner.query(`
            UPDATE "dra_subscription_tiers" 
            SET "max_data_models_per_data_source" = NULL 
            WHERE "tier_name" = 'enterprise'
        `);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        // Remove the column
        await queryRunner.query(`
            ALTER TABLE "dra_subscription_tiers" 
            DROP COLUMN "max_data_models_per_data_source"
        `);
    }
}
