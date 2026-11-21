import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Superseded by 1782000000000000000-SeedGA4DashboardTemplates.
 *
 * Dashboard templates must be seeded AFTER the Phase 2 organization/workspace
 * enforcement migration (1774110000000), which makes dra_dashboards.organization_id
 * and workspace_id NOT NULL and removes orphaned (null-org) templates. Seeding
 * before that migration either fails on existing databases or is deleted on
 * fresh ones. This migration is intentionally a no-op.
 */
export class SeedWebsiteAnalyticsDashboardTemplate1773000000000 implements MigrationInterface {
    name = 'SeedWebsiteAnalyticsDashboardTemplate1773000000000';

    public async up(_queryRunner: QueryRunner): Promise<void> {
        console.log('ℹ️  Website Analytics template seed deferred to 1782000000000');
    }

    public async down(_queryRunner: QueryRunner): Promise<void> {
        // no-op
    }
}
