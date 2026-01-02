import { MigrationInterface, QueryRunner } from "typeorm";

/**
 * Migration to add Google Analytics as a data source type
 * Adds 'google_analytics' to the data_type enum in dra_data_sources table
 */
export class AddGoogleAnalyticsDataSource1733788800000 implements MigrationInterface {
    name = 'AddGoogleAnalyticsDataSource1733788800000'

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
        
        // Check if the value already exists in the enum
        const valueExists = await queryRunner.query(`
            SELECT EXISTS (
                SELECT 1 
                FROM pg_enum 
                WHERE enumlabel = 'google_analytics' 
                AND enumtypid = (
                    SELECT oid 
                    FROM pg_type 
                    WHERE typname = 'dra_data_sources_data_type_enum'
                )
            );
        `);
        
        if (valueExists[0].exists) {
            console.log('✅ google_analytics already exists in data source types');
            return;
        }
        
        // Add google_analytics to the enum type
        await queryRunner.query(`
            ALTER TYPE "dra_data_sources_data_type_enum" 
            ADD VALUE 'google_analytics'
        `);
        
        console.log('✅ Successfully added google_analytics to data source types');
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        // Note: PostgreSQL doesn't support removing enum values directly
        // To rollback, you would need to:
        // 1. Create a new enum without 'google_analytics'
        // 2. Alter the column to use the new enum
        // 3. Drop the old enum
        
        console.log('⚠️  Rollback not implemented - removing enum values requires manual intervention');
        console.log('   Manual steps if needed:');
        console.log('   1. Ensure no data sources use google_analytics type');
        console.log('   2. Create new enum without google_analytics');
        console.log('   3. Alter column to use new enum');
        console.log('   4. Drop old enum');
    }
}
