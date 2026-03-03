import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Migration: AddPlatformCampaignToChannels
 *
 * Issue 1 (GitHub #352):
 *   - Adds platform_campaign_id VARCHAR(255) (nullable) to dra_campaign_channels.
 *   - Adds platform_campaign_name VARCHAR(255) (nullable) to dra_campaign_channels.
 *   - Adds a composite index on (data_source_id, platform_campaign_id) to support
 *     efficient lookups when filtering digital spend by campaign.
 *
 * Both columns are nullable so existing channel rows are unaffected (no back-fill needed).
 * platform_campaign_id stores the raw platform campaign ID as a string regardless of type:
 *   Google Ads: campaign.id (e.g. "12345678")
 *   LinkedIn Ads: campaign id BIGINT stored as string
 *   Meta Ads: campaign id (e.g. "23847592735")
 *   Google Ad Manager: order_id string
 *
 * platform_campaign_name is a denormalised cache of the name at time of linking —
 * avoids repeated joins to synced tables at query time.
 */
export class AddPlatformCampaignToChannels1773300000000 implements MigrationInterface {
    name = 'AddPlatformCampaignToChannels1773300000000';

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`
            ALTER TABLE dra_campaign_channels
            ADD COLUMN IF NOT EXISTS platform_campaign_id VARCHAR(255) NULL
        `);

        await queryRunner.query(`
            ALTER TABLE dra_campaign_channels
            ADD COLUMN IF NOT EXISTS platform_campaign_name VARCHAR(255) NULL
        `);

        await queryRunner.query(`
            CREATE INDEX IF NOT EXISTS idx_campaign_channels_ds_platform
            ON dra_campaign_channels (data_source_id, platform_campaign_id)
        `);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`
            DROP INDEX IF EXISTS idx_campaign_channels_ds_platform
        `);

        await queryRunner.query(`
            ALTER TABLE dra_campaign_channels
            DROP COLUMN IF EXISTS platform_campaign_name
        `);

        await queryRunner.query(`
            ALTER TABLE dra_campaign_channels
            DROP COLUMN IF EXISTS platform_campaign_id
        `);
    }
}
