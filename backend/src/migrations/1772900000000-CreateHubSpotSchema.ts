import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Migration: Create dra_hubspot schema with contacts, deals, and pipeline_snapshot_daily tables.
 */
export class CreateHubSpotSchema1772900000000 implements MigrationInterface {
    name = 'CreateHubSpotSchema1772900000000';

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`CREATE SCHEMA IF NOT EXISTS dra_hubspot`);

        await queryRunner.query(`
            CREATE TABLE IF NOT EXISTS dra_hubspot.contacts (
                id              SERIAL PRIMARY KEY,
                data_source_id  INTEGER NOT NULL REFERENCES dra_data_sources(id) ON DELETE CASCADE,
                hubspot_id      VARCHAR(50) NOT NULL,
                email           VARCHAR(320),
                first_name      VARCHAR(255),
                last_name       VARCHAR(255),
                lifecycle_stage VARCHAR(100),
                lead_source     VARCHAR(255),
                utm_source      VARCHAR(255),
                utm_campaign    VARCHAR(255),
                utm_medium      VARCHAR(100),
                created_date    TIMESTAMP,
                UNIQUE(data_source_id, hubspot_id)
            )
        `);
        console.log('✅ Created dra_hubspot.contacts');

        await queryRunner.query(`
            CREATE TABLE IF NOT EXISTS dra_hubspot.deals (
                id              SERIAL PRIMARY KEY,
                data_source_id  INTEGER NOT NULL REFERENCES dra_data_sources(id) ON DELETE CASCADE,
                hubspot_id      VARCHAR(50) NOT NULL,
                deal_name       VARCHAR(512),
                pipeline        VARCHAR(255),
                deal_stage      VARCHAR(255),
                amount          NUMERIC(15,2),
                close_date      DATE,
                create_date     TIMESTAMP,
                is_closed_won   BOOLEAN DEFAULT FALSE,
                UNIQUE(data_source_id, hubspot_id)
            )
        `);
        console.log('✅ Created dra_hubspot.deals');

        await queryRunner.query(`
            CREATE TABLE IF NOT EXISTS dra_hubspot.pipeline_snapshot_daily (
                id                     SERIAL PRIMARY KEY,
                data_source_id         INTEGER NOT NULL REFERENCES dra_data_sources(id) ON DELETE CASCADE,
                snapshot_date          DATE NOT NULL,
                total_open_deals       INTEGER DEFAULT 0,
                total_pipeline_value   NUMERIC(15,2) DEFAULT 0,
                deals_closed_won       INTEGER DEFAULT 0,
                revenue_closed_won     NUMERIC(15,2) DEFAULT 0,
                new_leads_created      INTEGER DEFAULT 0,
                UNIQUE(data_source_id, snapshot_date)
            )
        `);
        console.log('✅ Created dra_hubspot.pipeline_snapshot_daily');

        // Indexes for common query patterns
        await queryRunner.query(`
            CREATE INDEX IF NOT EXISTS idx_hubspot_contacts_ds_id
            ON dra_hubspot.contacts(data_source_id)
        `);
        await queryRunner.query(`
            CREATE INDEX IF NOT EXISTS idx_hubspot_deals_ds_id
            ON dra_hubspot.deals(data_source_id)
        `);
        await queryRunner.query(`
            CREATE INDEX IF NOT EXISTS idx_hubspot_deals_closed_won
            ON dra_hubspot.deals(data_source_id, is_closed_won)
        `);
        await queryRunner.query(`
            CREATE INDEX IF NOT EXISTS idx_hubspot_snapshot_date
            ON dra_hubspot.pipeline_snapshot_daily(data_source_id, snapshot_date)
        `);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`DROP SCHEMA IF EXISTS dra_hubspot CASCADE`);
        console.log('✅ Dropped dra_hubspot schema');
    }
}
