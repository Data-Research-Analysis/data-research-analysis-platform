import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Migration: MetaAdsInsightsAddCampaignFields
 *
 * Issues 1 + 6 (GitHub #353):
 *   - Adds campaign_id VARCHAR(255) and campaign_name VARCHAR(255) to all existing
 *     dra_meta_ads insights physical tables.
 *   - Adds conversions BIGINT DEFAULT 0 column.
 *   - Drops the old UNIQUE constraint on (entity_type, date_start, date_stop).
 *   - Adds a new UNIQUE constraint on (campaign_id, date_start, date_stop).
 *   - Creates a campaign_id index on each table.
 */
export class MetaAdsInsightsAddCampaignFields1773200000000 implements MigrationInterface {
    name = 'MetaAdsInsightsAddCampaignFields1773200000000';

    public async up(queryRunner: QueryRunner): Promise<void> {
        // Find all physical insights tables in dra_meta_ads schema
        const metaInsightsTables: Array<{ physical_table_name: string }> = await queryRunner.query(`
            SELECT physical_table_name
            FROM dra_table_metadata
            WHERE schema_name = 'dra_meta_ads'
              AND logical_table_name = 'insights'
        `);

        for (const row of metaInsightsTables) {
            const fullName = `dra_meta_ads."${row.physical_table_name}"`;

            // Add new columns if they don't exist
            await queryRunner.query(`
                ALTER TABLE ${fullName}
                ADD COLUMN IF NOT EXISTS campaign_id VARCHAR(255),
                ADD COLUMN IF NOT EXISTS campaign_name VARCHAR(255),
                ADD COLUMN IF NOT EXISTS conversions BIGINT DEFAULT 0
            `);

            // Add campaign_id index
            await queryRunner.query(`
                CREATE INDEX IF NOT EXISTS idx_${row.physical_table_name}_campaign_id
                ON ${fullName}(campaign_id)
            `);

            // Drop old UNIQUE constraint on (entity_type, date_start, date_stop)
            await queryRunner.query(`
                ALTER TABLE ${fullName}
                DROP CONSTRAINT IF EXISTS ${row.physical_table_name}_entity_type_date_start_date_stop_key
            `);

            // Add new UNIQUE constraint on (campaign_id, date_start, date_stop)
            await queryRunner.query(`
                DO $$
                BEGIN
                    IF NOT EXISTS (
                        SELECT 1 FROM pg_constraint
                        WHERE conrelid = 'dra_meta_ads.${row.physical_table_name}'::regclass
                          AND conname = '${row.physical_table_name}_campaign_id_date_start_date_stop_key'
                    ) THEN
                        ALTER TABLE ${fullName}
                        ADD CONSTRAINT ${row.physical_table_name}_campaign_id_date_start_date_stop_key
                        UNIQUE (campaign_id, date_start, date_stop);
                    END IF;
                END $$
            `);
        }
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        const metaInsightsTables: Array<{ physical_table_name: string }> = await queryRunner.query(`
            SELECT physical_table_name
            FROM dra_table_metadata
            WHERE schema_name = 'dra_meta_ads'
              AND logical_table_name = 'insights'
        `);

        for (const row of metaInsightsTables) {
            const fullName = `dra_meta_ads."${row.physical_table_name}"`;

            // Drop new UNIQUE constraint
            await queryRunner.query(`
                ALTER TABLE ${fullName}
                DROP CONSTRAINT IF EXISTS ${row.physical_table_name}_campaign_id_date_start_date_stop_key
            `);

            // Restore old UNIQUE constraint on (entity_type, date_start, date_stop)
            await queryRunner.query(`
                DO $$
                BEGIN
                    IF NOT EXISTS (
                        SELECT 1 FROM pg_constraint
                        WHERE conrelid = 'dra_meta_ads.${row.physical_table_name}'::regclass
                          AND conname = '${row.physical_table_name}_entity_type_date_start_date_stop_key'
                    ) THEN
                        ALTER TABLE ${fullName}
                        ADD CONSTRAINT ${row.physical_table_name}_entity_type_date_start_date_stop_key
                        UNIQUE (entity_type, date_start, date_stop);
                    END IF;
                END $$
            `);

            // Drop campaign_id index
            await queryRunner.query(`
                DROP INDEX IF EXISTS dra_meta_ads.idx_${row.physical_table_name}_campaign_id
            `);

            // Remove added columns
            await queryRunner.query(`
                ALTER TABLE ${fullName}
                DROP COLUMN IF EXISTS campaign_id,
                DROP COLUMN IF EXISTS campaign_name,
                DROP COLUMN IF EXISTS conversions
            `);
        }
    }
}
