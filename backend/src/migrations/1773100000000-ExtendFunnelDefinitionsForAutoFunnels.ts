import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Extend funnel definitions to support auto-generated, stage-metric funnels.
 *
 * - is_auto: distinguishes generated funnels from user-created ones
 * - auto_key: stable key per project for idempotent regeneration
 * - source: which data plane powers the funnel (google_analytics, blended, ...)
 * - date_range_preset: default date range for the funnel
 * - attribution_model: default attribution model
 *
 * A partial unique index guarantees one auto funnel per (project, auto_key)
 * while leaving manually-created funnels unconstrained.
 */
export class ExtendFunnelDefinitionsForAutoFunnels1773100000000 implements MigrationInterface {
    name = 'ExtendFunnelDefinitionsForAutoFunnels1773100000000';

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "dra_funnel_definitions" ADD COLUMN IF NOT EXISTS is_auto boolean NOT NULL DEFAULT false`);
        await queryRunner.query(`ALTER TABLE "dra_funnel_definitions" ADD COLUMN IF NOT EXISTS auto_key varchar(100)`);
        await queryRunner.query(`ALTER TABLE "dra_funnel_definitions" ADD COLUMN IF NOT EXISTS source varchar(50)`);
        await queryRunner.query(`ALTER TABLE "dra_funnel_definitions" ADD COLUMN IF NOT EXISTS date_range_preset varchar(50)`);
        await queryRunner.query(`ALTER TABLE "dra_funnel_definitions" ADD COLUMN IF NOT EXISTS attribution_model varchar(50)`);

        await queryRunner.query(
            `CREATE UNIQUE INDEX IF NOT EXISTS uq_funnel_definitions_auto_key
             ON "dra_funnel_definitions" (project_id, auto_key)
             WHERE is_auto = true`,
        );
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`DROP INDEX IF EXISTS uq_funnel_definitions_auto_key`);
        await queryRunner.query(`ALTER TABLE "dra_funnel_definitions" DROP COLUMN IF EXISTS attribution_model`);
        await queryRunner.query(`ALTER TABLE "dra_funnel_definitions" DROP COLUMN IF EXISTS date_range_preset`);
        await queryRunner.query(`ALTER TABLE "dra_funnel_definitions" DROP COLUMN IF EXISTS source`);
        await queryRunner.query(`ALTER TABLE "dra_funnel_definitions" DROP COLUMN IF EXISTS auto_key`);
        await queryRunner.query(`ALTER TABLE "dra_funnel_definitions" DROP COLUMN IF EXISTS is_auto`);
    }
}
