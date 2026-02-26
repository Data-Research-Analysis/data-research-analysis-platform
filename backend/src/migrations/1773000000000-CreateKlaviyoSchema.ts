import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Migration: Create dra_klaviyo schema with campaigns, campaign_metrics, and flow_metrics tables.
 */
export class CreateKlaviyoSchema1773000000000 implements MigrationInterface {
    name = 'CreateKlaviyoSchema1773000000000';

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`CREATE SCHEMA IF NOT EXISTS dra_klaviyo`);

        await queryRunner.query(`
            CREATE TABLE IF NOT EXISTS dra_klaviyo.campaigns (
                id              SERIAL PRIMARY KEY,
                data_source_id  INTEGER NOT NULL REFERENCES dra_data_sources(id) ON DELETE CASCADE,
                klaviyo_id      VARCHAR(100) NOT NULL,
                campaign_name   VARCHAR(512),
                subject_line    VARCHAR(512),
                send_time       TIMESTAMP,
                status          VARCHAR(50),
                UNIQUE(data_source_id, klaviyo_id)
            )
        `);
        console.log('✅ Created dra_klaviyo.campaigns');

        await queryRunner.query(`
            CREATE TABLE IF NOT EXISTS dra_klaviyo.campaign_metrics (
                id              SERIAL PRIMARY KEY,
                data_source_id  INTEGER NOT NULL REFERENCES dra_data_sources(id) ON DELETE CASCADE,
                campaign_id     VARCHAR(100) NOT NULL,
                metric_date     DATE NOT NULL,
                sends           INTEGER DEFAULT 0,
                opens           INTEGER DEFAULT 0,
                unique_opens    INTEGER DEFAULT 0,
                clicks          INTEGER DEFAULT 0,
                unique_clicks   INTEGER DEFAULT 0,
                unsubscribes    INTEGER DEFAULT 0,
                bounces         INTEGER DEFAULT 0,
                revenue         NUMERIC(12,2) DEFAULT 0,
                placed_orders   INTEGER DEFAULT 0,
                UNIQUE(data_source_id, campaign_id, metric_date)
            )
        `);
        console.log('✅ Created dra_klaviyo.campaign_metrics');

        await queryRunner.query(`
            CREATE TABLE IF NOT EXISTS dra_klaviyo.flow_metrics (
                id              SERIAL PRIMARY KEY,
                data_source_id  INTEGER NOT NULL REFERENCES dra_data_sources(id) ON DELETE CASCADE,
                flow_id         VARCHAR(100) NOT NULL,
                flow_name       VARCHAR(512),
                metric_date     DATE NOT NULL,
                emails_sent     INTEGER DEFAULT 0,
                opens           INTEGER DEFAULT 0,
                clicks          INTEGER DEFAULT 0,
                revenue         NUMERIC(12,2) DEFAULT 0,
                UNIQUE(data_source_id, flow_id, metric_date)
            )
        `);
        console.log('✅ Created dra_klaviyo.flow_metrics');

        // Indexes for query patterns used by MarketingReportProcessor
        await queryRunner.query(`
            CREATE INDEX IF NOT EXISTS idx_klaviyo_campaigns_ds_id
            ON dra_klaviyo.campaigns(data_source_id)
        `);
        await queryRunner.query(`
            CREATE INDEX IF NOT EXISTS idx_klaviyo_campaign_metrics_ds_date
            ON dra_klaviyo.campaign_metrics(data_source_id, metric_date)
        `);
        await queryRunner.query(`
            CREATE INDEX IF NOT EXISTS idx_klaviyo_flow_metrics_ds_date
            ON dra_klaviyo.flow_metrics(data_source_id, metric_date)
        `);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`DROP SCHEMA IF EXISTS dra_klaviyo CASCADE`);
        console.log('✅ Dropped dra_klaviyo schema');
    }
}
