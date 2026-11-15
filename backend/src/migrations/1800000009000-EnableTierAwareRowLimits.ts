import { MigrationInterface, QueryRunner } from "typeorm";

/**
 * Make data-model row limits tier-aware.
 *
 * Historically the platform-wide `max_data_model_rows` setting (seeded to
 * 50,000) was enforced for every tier, which capped Pro (5,000,000) and
 * Enterprise (unlimited) far below their configured limits. The backend now
 * resolves the effective limit as min(tier limit, platform ceiling), and the
 * platform ceiling is disabled by default (0) so the tier limits govern.
 *
 * This migration only rewrites the old seeded default (50000); a value an
 * admin has explicitly changed is left untouched.
 */
export class EnableTierAwareRowLimits1800000009000 implements MigrationInterface {
    name = 'EnableTierAwareRowLimits1800000009000';

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`
            UPDATE "dra_platform_settings"
            SET "setting_value" = '0'
            WHERE "setting_key" = 'max_data_model_rows'
              AND "setting_value" = '50000'
        `);
    }

    public async down(): Promise<void> {
        // Data-only reconciliation: the previous value cannot be reconstructed
        // reliably (0 and 50000 are both valid admin configurations).
    }
}
