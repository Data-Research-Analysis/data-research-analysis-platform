import { MigrationInterface, QueryRunner } from "typeorm";

/**
 * Migration to add Google Ad Manager as a data source type
 * Adds 'google_ad_manager' to the data_type enum in dra_data_sources table
 * and creates the dra_google_ad_manager schema
 */
export class AddGoogleAdManagerDataSource1765698670655 implements MigrationInterface {
    name = 'AddGoogleAdManagerDataSource1765698670655'

    public async up(queryRunner: QueryRunner): Promise<void> {
        // Add google_ad_manager to the enum type
        await queryRunner.query(`
            ALTER TYPE "dra_data_sources_data_type_enum" 
            ADD VALUE IF NOT EXISTS 'google_ad_manager'
        `);
        
        console.log('✅ Successfully added google_ad_manager to data source types');
        
        // Create schema for Google Ad Manager data
        await queryRunner.query(`
            CREATE SCHEMA IF NOT EXISTS dra_google_ad_manager
        `);
        
        console.log('✅ Successfully created dra_google_ad_manager schema');
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        // Drop the schema (will fail if it contains tables)
        await queryRunner.query(`
            DROP SCHEMA IF EXISTS dra_google_ad_manager CASCADE
        `);
        
        console.log('✅ Successfully dropped dra_google_ad_manager schema');
        
        // Note: PostgreSQL doesn't support removing enum values directly
        // To rollback the enum change, you would need to:
        // 1. Create a new enum without 'google_ad_manager'
        // 2. Alter the column to use the new enum
        // 3. Drop the old enum
        
        console.log('⚠️  Enum rollback not implemented - removing enum values requires manual intervention');
        console.log('   Manual steps if needed:');
        console.log('   1. Ensure no data sources use google_ad_manager type');
        console.log('   2. Create new enum without google_ad_manager');
        console.log('   3. Alter column to use new enum');
        console.log('   4. Drop old enum');
    }
}
