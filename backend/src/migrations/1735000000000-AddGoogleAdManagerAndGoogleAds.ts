import { MigrationInterface, QueryRunner } from "typeorm";

/**
 * Migration to add Google Ad Manager and Google Ads as data source types
 * Adds 'google_ad_manager' and 'google_ads' to the data_type enum in dra_data_sources table
 */
export class AddGoogleAdManagerAndGoogleAds1735000000000 implements MigrationInterface {
    name = 'AddGoogleAdManagerAndGoogleAds1735000000000'

    public async up(queryRunner: QueryRunner): Promise<void> {
        // Add google_ad_manager to the enum type
        await queryRunner.query(`
            ALTER TYPE "dra_data_sources_data_type_enum" 
            ADD VALUE IF NOT EXISTS 'google_ad_manager'
        `);
        
        console.log('✅ Successfully added google_ad_manager to data source types');

        // Add google_ads to the enum type
        await queryRunner.query(`
            ALTER TYPE "dra_data_sources_data_type_enum" 
            ADD VALUE IF NOT EXISTS 'google_ads'
        `);
        
        console.log('✅ Successfully added google_ads to data source types');
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        // Note: PostgreSQL doesn't support removing enum values directly
        // To rollback, you would need to:
        // 1. Create a new enum without 'google_ad_manager' and 'google_ads'
        // 2. Alter the column to use the new enum
        // 3. Drop the old enum
        
        console.log('⚠️  Rollback not implemented - removing enum values requires manual intervention');
        console.log('   Manual steps if needed:');
        console.log('   1. Ensure no data sources use google_ad_manager or google_ads type');
        console.log('   2. Create new enum without google_ad_manager and google_ads');
        console.log('   3. Alter column to use new enum');
        console.log('   4. Drop old enum');
    }
}
