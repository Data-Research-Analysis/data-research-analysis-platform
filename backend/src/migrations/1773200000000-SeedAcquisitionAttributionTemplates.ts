import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Superseded by 1782000000000000000-SeedGA4DashboardTemplates.
 *
 * See the note in 1773000000000-SeedWebsiteAnalyticsDashboardTemplate: template
 * seeding must run after the Phase 2 organization/workspace enforcement
 * migration. This migration is intentionally a no-op.
 */
export class SeedAcquisitionAttributionTemplates1773200000000 implements MigrationInterface {
    name = 'SeedAcquisitionAttributionTemplates1773200000000';

    public async up(_queryRunner: QueryRunner): Promise<void> {
        console.log('ℹ️  Acquisition/Attribution template seed deferred to 1782000000000');
    }

    public async down(_queryRunner: QueryRunner): Promise<void> {
        // no-op
    }
}
