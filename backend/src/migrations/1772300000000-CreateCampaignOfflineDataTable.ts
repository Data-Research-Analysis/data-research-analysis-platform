import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateCampaignOfflineDataTable1772300000000 implements MigrationInterface {
    name = 'CreateCampaignOfflineDataTable1772300000000';

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`
            CREATE TABLE IF NOT EXISTS dra_campaign_offline_data (
                id                    SERIAL PRIMARY KEY,
                campaign_channel_id   INTEGER NOT NULL REFERENCES dra_campaign_channels(id) ON DELETE CASCADE,
                entry_date            DATE NOT NULL,
                actual_spend          NUMERIC(12,2) NOT NULL DEFAULT 0,
                impressions_estimated BIGINT DEFAULT 0,
                leads_generated       INTEGER DEFAULT 0,
                pipeline_value        NUMERIC(12,2),
                notes                 TEXT,
                created_at            TIMESTAMP DEFAULT NOW(),
                updated_at            TIMESTAMP DEFAULT NOW(),
                UNIQUE (campaign_channel_id, entry_date)
            )
        `);

        await queryRunner.query(`
            CREATE INDEX IF NOT EXISTS idx_dra_campaign_offline_data_channel_id
            ON dra_campaign_offline_data(campaign_channel_id)
        `);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`DROP TABLE IF EXISTS dra_campaign_offline_data`);
    }
}
