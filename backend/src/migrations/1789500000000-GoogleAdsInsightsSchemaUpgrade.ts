import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Migration: GoogleAdsInsightsSchemaUpgrade
 *
 * Cleans up Google Ads tables created by the pre-v25 driver so sources re-sync
 * into the new schema (settings tables + `*_insights` performance tables).
 *
 * The old driver stored daily performance under logical table names that either
 * no longer exist (`keywords`, `geographic`, `device`) or that are now reused
 * with a different shape (`campaigns`, `ad_groups` — settings instead of daily
 * performance). Legacy performance variants are identified by the presence of a
 * `date` column, so reused names are only dropped when they are the old shape.
 *
 * Dropping these tables is safe: the Google Ads driver recreates them with the
 * correct new schema on the next sync.
 */
export class GoogleAdsInsightsSchemaUpgrade1789500000000 implements MigrationInterface {
    name = 'GoogleAdsInsightsSchemaUpgrade1789500000000';

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`
            DO $$
            DECLARE
                tbl RECORD;
            BEGIN
                FOR tbl IN
                    SELECT tm.id AS metadata_id, tm.schema_name, tm.physical_table_name, tm.logical_table_name
                    FROM dra_table_metadata tm
                    WHERE tm.schema_name = 'dra_google_ads'
                      AND tm.logical_table_name IN ('campaigns', 'ad_groups', 'keywords', 'geographic', 'device')
                LOOP
                    IF tbl.logical_table_name IN ('keywords', 'geographic', 'device')
                       OR (
                           SELECT EXISTS (
                               SELECT 1 FROM information_schema.columns
                               WHERE table_schema = tbl.schema_name
                                 AND table_name = tbl.physical_table_name
                                 AND column_name = 'date'
                           )
                       )
                    THEN
                        EXECUTE format('DROP TABLE IF EXISTS %I.%I', tbl.schema_name, tbl.physical_table_name);
                        DELETE FROM dra_table_metadata WHERE id = tbl.metadata_id;
                    END IF;
                END LOOP;
            END $$;
        `);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        // No-op: the cleaned tables are recreated by the driver on sync.
    }
}
