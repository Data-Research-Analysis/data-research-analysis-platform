import { MigrationInterface, QueryRunner } from "typeorm";

/**
 * Migration to add Google Ad Manager as a data source type
 * Adds 'google_ad_manager' to the data_type enum in dra_data_sources table
 * and creates the dra_google_ad_manager schema
 */
export class AddGoogleAdManagerDataSource1765698670655 implements MigrationInterface {
    name = 'AddGoogleAdManagerDataSource1765698670655'

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
            console.log('⚠️  Enum type does not exist yet, skipping enum alteration');
            console.log('   This migration will be applied after CreateTables migration runs');
        } else {
            // Check if the value already exists
            const valueExists = await queryRunner.query(`
                SELECT EXISTS (
                    SELECT 1 
                    FROM pg_enum 
                    WHERE enumlabel = 'google_ad_manager' 
                    AND enumtypid = (
                        SELECT oid 
                        FROM pg_type 
                        WHERE typname = 'dra_data_sources_data_type_enum'
                    )
                );
            `);
            
            if (!valueExists[0].exists) {
                // Add google_ad_manager to the enum type
                await queryRunner.query(`
                    ALTER TYPE "dra_data_sources_data_type_enum" 
                    ADD VALUE 'google_ad_manager'
                `);
                
                console.log('✅ Successfully added google_ad_manager to data source types');
            } else {
                console.log('✅ google_ad_manager already exists in data source types');
            }
        }
        
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
