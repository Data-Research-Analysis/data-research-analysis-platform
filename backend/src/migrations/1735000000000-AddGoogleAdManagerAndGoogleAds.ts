import { MigrationInterface, QueryRunner } from "typeorm";

/**
 * Migration to add Google Ad Manager and Google Ads as data source types
 * Adds 'google_ad_manager' and 'google_ads' to the data_type enum in dra_data_sources table
 */
export class AddGoogleAdManagerAndGoogleAds1735000000000 implements MigrationInterface {
    name = 'AddGoogleAdManagerAndGoogleAds1735000000000'

    public async up(queryRunner: QueryRunner): Promise<void> {
        // Check if the enum type exists first
        const enumExists = await queryRunner.query(`
            SELECT EXISTS (
                SELECT 1 
                FROM pg_type 
                WHERE typname = 'dra_data_sources_data_type_enum'
            );
        `);
        
        if (!enumExists[0].exists) {
            console.log('⚠️  Enum type does not exist yet, skipping this migration');
            console.log('   This migration will be applied after CreateTables migration runs');
            return;
        }
        
        // Check and add google_ad_manager
        const gamExists = await queryRunner.query(`
            SELECT EXISTS (
                SELECT 1 
                FROM pg_enum 
                WHERE enumlabel = 'google_ad_manager' 
                AND enumtypid = (SELECT oid FROM pg_type WHERE typname = 'dra_data_sources_data_type_enum')
            );
        `);
        
        if (!gamExists[0].exists) {
            await queryRunner.query(`
                ALTER TYPE "dra_data_sources_data_type_enum" 
                ADD VALUE 'google_ad_manager'
            `);
            console.log('✅ Successfully added google_ad_manager to data source types');
        } else {
            console.log('✅ google_ad_manager already exists in data source types');
        }

        // Check and add google_ads
        const gaExists = await queryRunner.query(`
            SELECT EXISTS (
                SELECT 1 
                FROM pg_enum 
                WHERE enumlabel = 'google_ads' 
                AND enumtypid = (SELECT oid FROM pg_type WHERE typname = 'dra_data_sources_data_type_enum')
            );
        `);
        
        if (!gaExists[0].exists) {
            await queryRunner.query(`
                ALTER TYPE "dra_data_sources_data_type_enum" 
                ADD VALUE 'google_ads'
            `);
            console.log('✅ Successfully added google_ads to data source types');
        } else {
            console.log('✅ google_ads already exists in data source types');
        }
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
