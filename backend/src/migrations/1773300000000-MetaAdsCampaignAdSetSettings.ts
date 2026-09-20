import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Migration: MetaAdsCampaignAdSetSettings
 *
 * Adds campaign-level and ad set-level settings columns to all existing
 * dra_meta_ads physical `campaigns` and `adsets` tables so configuration
 * (budgets, bid strategy, special ad categories, attribution, targeting
 * summary inputs, etc.) can be tracked in the Intelligence UI and used by AI.
 *
 * Budget/money columns are stored in account currency (Meta returns minor
 * units, the driver divides by 100).
 */
export class MetaAdsCampaignAdSetSettings1773300000000 implements MigrationInterface {
    name = 'MetaAdsCampaignAdSetSettings1773300000000';

    public async up(queryRunner: QueryRunner): Promise<void> {
        const campaignTables: Array<{ physical_table_name: string }> = await queryRunner.query(`
            SELECT physical_table_name
            FROM dra_table_metadata
            WHERE schema_name = 'dra_meta_ads'
              AND logical_table_name = 'campaigns'
        `);

        for (const row of campaignTables) {
            const fullName = `dra_meta_ads."${row.physical_table_name}"`;

            await queryRunner.query(`
                ALTER TABLE ${fullName}
                ADD COLUMN IF NOT EXISTS effective_status VARCHAR(50),
                ADD COLUMN IF NOT EXISTS buying_type VARCHAR(20),
                ADD COLUMN IF NOT EXISTS bid_strategy VARCHAR(50),
                ADD COLUMN IF NOT EXISTS special_ad_categories JSONB,
                ADD COLUMN IF NOT EXISTS spend_cap DECIMAL(14,2),
                ADD COLUMN IF NOT EXISTS budget_remaining DECIMAL(14,2)
            `);
        }

        const adSetTables: Array<{ physical_table_name: string }> = await queryRunner.query(`
            SELECT physical_table_name
            FROM dra_table_metadata
            WHERE schema_name = 'dra_meta_ads'
              AND logical_table_name = 'adsets'
        `);

        for (const row of adSetTables) {
            const fullName = `dra_meta_ads."${row.physical_table_name}"`;

            await queryRunner.query(`
                ALTER TABLE ${fullName}
                ADD COLUMN IF NOT EXISTS effective_status VARCHAR(50),
                ADD COLUMN IF NOT EXISTS bid_strategy VARCHAR(50),
                ADD COLUMN IF NOT EXISTS bid_constraints JSONB,
                ADD COLUMN IF NOT EXISTS daily_min_spend_target DECIMAL(12,2),
                ADD COLUMN IF NOT EXISTS daily_spend_cap DECIMAL(12,2),
                ADD COLUMN IF NOT EXISTS destination_type VARCHAR(50),
                ADD COLUMN IF NOT EXISTS attribution_spec JSONB,
                ADD COLUMN IF NOT EXISTS promoted_object JSONB,
                ADD COLUMN IF NOT EXISTS pacing_type JSONB
            `);
        }
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        const campaignTables: Array<{ physical_table_name: string }> = await queryRunner.query(`
            SELECT physical_table_name
            FROM dra_table_metadata
            WHERE schema_name = 'dra_meta_ads'
              AND logical_table_name = 'campaigns'
        `);

        for (const row of campaignTables) {
            const fullName = `dra_meta_ads."${row.physical_table_name}"`;

            await queryRunner.query(`
                ALTER TABLE ${fullName}
                DROP COLUMN IF EXISTS effective_status,
                DROP COLUMN IF EXISTS buying_type,
                DROP COLUMN IF EXISTS bid_strategy,
                DROP COLUMN IF EXISTS special_ad_categories,
                DROP COLUMN IF EXISTS spend_cap,
                DROP COLUMN IF EXISTS budget_remaining
            `);
        }

        const adSetTables: Array<{ physical_table_name: string }> = await queryRunner.query(`
            SELECT physical_table_name
            FROM dra_table_metadata
            WHERE schema_name = 'dra_meta_ads'
              AND logical_table_name = 'adsets'
        `);

        for (const row of adSetTables) {
            const fullName = `dra_meta_ads."${row.physical_table_name}"`;

            await queryRunner.query(`
                ALTER TABLE ${fullName}
                DROP COLUMN IF EXISTS effective_status,
                DROP COLUMN IF EXISTS bid_strategy,
                DROP COLUMN IF EXISTS bid_constraints,
                DROP COLUMN IF EXISTS daily_min_spend_target,
                DROP COLUMN IF EXISTS daily_spend_cap,
                DROP COLUMN IF EXISTS destination_type,
                DROP COLUMN IF EXISTS attribution_spec,
                DROP COLUMN IF EXISTS promoted_object,
                DROP COLUMN IF EXISTS pacing_type
            `);
        }
    }
}
