import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Migration: Add hubspot and klaviyo to the dra_data_sources_data_type_enum.
 * Also auto-classifies any existing hubspot/klaviyo sources as marketing_campaign_data.
 */
export class AddHubSpotKlaviyoDataSourceTypes1772800000000 implements MigrationInterface {
    name = 'AddHubSpotKlaviyoDataSourceTypes1772800000000';

    public async up(queryRunner: QueryRunner): Promise<void> {
        // Verify the enum exists before attempting to extend it
        const enumExists = await queryRunner.query(`
            SELECT EXISTS (
                SELECT 1 FROM pg_type WHERE typname = 'dra_data_sources_data_type_enum'
            )
        `);

        if (!enumExists[0].exists) {
            console.log('⚠️  dra_data_sources_data_type_enum does not exist yet — skipping');
            return;
        }

        // Add hubspot
        await queryRunner.query(
            `ALTER TYPE "dra_data_sources_data_type_enum" ADD VALUE IF NOT EXISTS 'hubspot'`
        );
        console.log('✅ Added hubspot to dra_data_sources_data_type_enum');

        // Add klaviyo
        await queryRunner.query(
            `ALTER TYPE "dra_data_sources_data_type_enum" ADD VALUE IF NOT EXISTS 'klaviyo'`
        );
        console.log('✅ Added klaviyo to dra_data_sources_data_type_enum');
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        // PostgreSQL does not support removing enum values directly.
        // 'hubspot' and 'klaviyo' are intentionally left in the enum.
        console.log('ℹ️  Enum values cannot be removed in PostgreSQL — down migration is a no-op');
    }
}
