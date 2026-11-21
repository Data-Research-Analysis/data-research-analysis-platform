import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Disconnect Google Ad Manager from the marketing data-source set.
 *
 * GAM is publisher-side ad monetization (supply side), not an acquisition
 * channel, so it is no longer auto-classified as 'marketing_campaign_data'
 * and is no longer treated as a marketing channel by the intelligence hub,
 * campaigns, or onboarding. This migration clears the stored auto-classified
 * value on existing GAM sources so they behave like generic data sources
 * (PostgreSQL, Excel, ...) and require a manual classification if any.
 */
export class DisconnectGAMFromMarketing1800000010000 implements MigrationInterface {
    name = 'DisconnectGAMFromMarketing1800000010000';

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`
            UPDATE dra_data_sources
            SET classification = NULL
            WHERE data_type::text = 'google_ad_manager'
              AND classification = 'marketing_campaign_data'
        `);
    }

    public async down(): Promise<void> {
        // Data-only reconciliation: the previous auto-classified value cannot
        // be reconstructed reliably (users may have reclassified manually).
    }
}
