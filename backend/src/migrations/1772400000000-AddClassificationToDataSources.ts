import { MigrationInterface, QueryRunner, TableColumn } from 'typeorm';

export class AddClassificationToDataSources1772400000000 implements MigrationInterface {
    name = 'AddClassificationToDataSources1772400000000';

    public async up(queryRunner: QueryRunner): Promise<void> {
        // Add tiktok_ads to the data source type enum if not already present
        await queryRunner.query(`ALTER TYPE "dra_data_sources_data_type_enum" ADD VALUE IF NOT EXISTS 'tiktok_ads'`);

        await queryRunner.addColumn('dra_data_sources', new TableColumn({
            name: 'classification',
            type: 'varchar',
            length: '50',
            isNullable: true,
            comment: "User-selected data category: 'marketing_campaign_data' | 'crm_sales' | 'budget_finance' | 'offline_marketing' | 'brand_research' | 'general_analytics'"
        }));

        // Auto-classify existing advertising platform sources
        await queryRunner.query(`
            UPDATE dra_data_sources
            SET classification = 'marketing_campaign_data'
            WHERE data_type::text IN ('google_ads', 'meta_ads', 'linkedin_ads', 'google_analytics', 'google_ad_manager', 'tiktok_ads')
              AND classification IS NULL
        `);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.dropColumn('dra_data_sources', 'classification');
        // Note: PostgreSQL does not support removing enum values directly.
        // 'tiktok_ads' is intentionally left in dra_data_sources_data_type_enum.
    }
}
