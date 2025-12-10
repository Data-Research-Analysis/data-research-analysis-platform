import { MigrationInterface, QueryRunner } from "typeorm";

/**
 * Migration to add Google Analytics as a data source type
 * Adds 'google_analytics' to the data_type enum in dra_data_sources table
 */
export class AddGoogleAnalyticsDataSource1733788800000 implements MigrationInterface {
    name = 'AddGoogleAnalyticsDataSource1733788800000'

    public async up(queryRunner: QueryRunner): Promise<void> {
        // Add google_analytics to the enum type
        await queryRunner.query(`
            ALTER TYPE "dra_data_sources_data_type_enum" 
            ADD VALUE IF NOT EXISTS 'google_analytics'
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
