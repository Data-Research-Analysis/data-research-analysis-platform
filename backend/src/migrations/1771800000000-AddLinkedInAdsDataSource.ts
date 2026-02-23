import { MigrationInterface, QueryRunner } from "typeorm";

/**
 * Migration: Add LinkedIn Ads as a data source type.
 *
 * What this migration does:
 *  1. Adds 'linkedin_ads' to the dra_data_sources_data_type_enum PostgreSQL enum.
 *  2. Creates the dra_linkedin_ads schema (tables are created dynamically by
 *     LinkedInAdsDriver the first time a data source is synced).
 *
 * Note: Tables in dra_linkedin_ads are created on-demand by LinkedInAdsDriver
 * using CREATE TABLE IF NOT EXISTS — this migration only provisions the schema.
 */
export class AddLinkedInAdsDataSource1771800000000 implements MigrationInterface {
    name = 'AddLinkedInAdsDataSource1771800000000';

    public async up(queryRunner: QueryRunner): Promise<void> {
        // ── 1. Add 'linkedin_ads' to the data_type enum ─────────────────────

        const enumExists = await queryRunner.query(`
            SELECT EXISTS (
                SELECT 1
                FROM pg_type
                WHERE typname = 'dra_data_sources_data_type_enum'
            );
        `);

        if (!enumExists[0].exists) {
            console.log('⚠️  Enum type does not exist yet — skipping enum alteration.');
            console.log('   This migration will need to be re-run after CreateTables migration.');
        } else {
            const valueExists = await queryRunner.query(`
                SELECT EXISTS (
                    SELECT 1
                    FROM pg_enum
                    WHERE enumlabel = 'linkedin_ads'
                    AND enumtypid = (
                        SELECT oid FROM pg_type WHERE typname = 'dra_data_sources_data_type_enum'
                    )
                );
            `);

            if (!valueExists[0].exists) {
                await queryRunner.query(`
                    ALTER TYPE "dra_data_sources_data_type_enum"
                    ADD VALUE 'linkedin_ads'
                `);
                console.log('✅ Added linkedin_ads to dra_data_sources_data_type_enum');
            } else {
                console.log('✅ linkedin_ads already present in dra_data_sources_data_type_enum');
            }
        }

        // ── 2. Create the dra_linkedin_ads schema ────────────────────────────

        const schemaExists = await queryRunner.query(`
            SELECT schema_name
            FROM information_schema.schemata
            WHERE schema_name = 'dra_linkedin_ads'
        `);

        if (schemaExists.length === 0) {
            await queryRunner.query(`CREATE SCHEMA "dra_linkedin_ads"`);
            console.log('✅ Created schema dra_linkedin_ads');
        } else {
            console.log('✅ Schema dra_linkedin_ads already exists');
        }

        console.log(`
        ================================================================
        LinkedIn Ads Data Source Migration Complete
        ================================================================

        Next Steps:
        1. Configure environment variables:
           - LINKEDIN_CLIENT_ID
           - LINKEDIN_CLIENT_SECRET
           - LINKEDIN_REDIRECT_URI  (e.g. https://yourdomain.com/linkedin-ads/callback)

        2. Set up a LinkedIn App at https://www.linkedin.com/developers/apps
           - Add the "Marketing Developer Platform" product
           - Request r_ads + r_ads_reporting access
           - Configure the OAuth redirect URL

        3. Required OAuth Scopes:
           - r_ads           (read ad accounts, campaigns, campaign groups, creatives)
           - r_ads_reporting (read adAnalytics — performance, demographic, revenue)

        4. API Version in use: 202601 (LinkedIn-Version: 202601 header)
           - Do NOT use 202501 (sunset)

        Tables are created dynamically by LinkedInAdsDriver on first sync:
           Schema: dra_linkedin_ads
           Tables (per data source ID suffix):
             - ad_accounts_{id}
             - campaign_groups_{id}
             - campaigns_{id}
             - creatives_{id}
             - campaign_analytics_{id}
             - account_analytics_{id}
        ================================================================
        `);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        // Drop the schema (cascades all dynamic tables created by the driver)
        await queryRunner.query(`DROP SCHEMA IF EXISTS "dra_linkedin_ads" CASCADE`);
        console.log('✅ Dropped schema dra_linkedin_ads (and all tables within it)');

        // PostgreSQL does not support removing individual enum values.
        // Manual intervention is required to remove 'linkedin_ads' from the enum
        // if a complete rollback is needed.
        console.log('⚠️  Note: the linkedin_ads enum value remains in dra_data_sources_data_type_enum.');
        console.log('   PostgreSQL does not support removing individual enum values without recreating the enum.');
        console.log('   Manual cleanup is required for a full rollback.');
    }
}
