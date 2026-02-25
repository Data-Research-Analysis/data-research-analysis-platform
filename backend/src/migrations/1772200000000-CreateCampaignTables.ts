import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateCampaignTables1772200000000 implements MigrationInterface {
    name = 'CreateCampaignTables1772200000000';

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`
            CREATE TABLE IF NOT EXISTS dra_campaigns (
                id              SERIAL PRIMARY KEY,
                project_id      INTEGER NOT NULL REFERENCES dra_projects(id) ON DELETE CASCADE,
                created_by      INTEGER NOT NULL REFERENCES dra_users_platform(id) ON DELETE RESTRICT,
                name            VARCHAR(255) NOT NULL,
                description     TEXT,
                objective       VARCHAR(50) NOT NULL,
                status          VARCHAR(20) NOT NULL DEFAULT 'draft',
                budget_total    NUMERIC(12,2),
                target_leads    INTEGER,
                target_cpl      NUMERIC(10,2),
                target_roas     NUMERIC(6,2),
                target_impressions BIGINT,
                start_date      DATE,
                end_date        DATE,
                created_at      TIMESTAMP DEFAULT NOW(),
                updated_at      TIMESTAMP DEFAULT NOW()
            )
        `);

        await queryRunner.query(`
            CREATE TABLE IF NOT EXISTS dra_campaign_channels (
                id              SERIAL PRIMARY KEY,
                campaign_id     INTEGER NOT NULL REFERENCES dra_campaigns(id) ON DELETE CASCADE,
                channel_type    VARCHAR(50) NOT NULL,
                data_source_id  INTEGER REFERENCES dra_data_sources(id) ON DELETE SET NULL,
                channel_name    VARCHAR(255),
                is_offline      BOOLEAN NOT NULL DEFAULT FALSE,
                created_at      TIMESTAMP DEFAULT NOW()
            )
        `);

        await queryRunner.query(`
            CREATE INDEX IF NOT EXISTS idx_dra_campaigns_project_id ON dra_campaigns(project_id)
        `);
        await queryRunner.query(`
            CREATE INDEX IF NOT EXISTS idx_dra_campaign_channels_campaign_id ON dra_campaign_channels(campaign_id)
        `);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`DROP TABLE IF EXISTS dra_campaign_channels`);
        await queryRunner.query(`DROP TABLE IF EXISTS dra_campaigns`);
    }
}
