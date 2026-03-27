import { MigrationInterface, QueryRunner } from "typeorm";

/**
 * Issue #1 — Intelligent Data Model Health Enforcement
 *
 * Adds four columns to dra_data_models to support health tracking and model
 * classification. These are required by every other issue in the
 * "Intelligent Data Model Builder + Large Dataset Protection" epic.
 *
 *   model_type       — user/AI classification: 'dimension' | 'fact' | 'aggregated' | NULL
 *                      Dimension models bypass all aggregation enforcement checks.
 *
 *   health_status    — computed by DataModelHealthService:
 *                      'healthy' | 'warning' | 'blocked' | 'unknown'
 *                      Persisted at save time so it is readable everywhere without
 *                      re-running analysis.
 *
 *   health_issues    — JSONB array of IHealthIssue objects describing which checks
 *                      failed and what the user should do to fix them.
 *
 *   source_row_count — cached sum of all source table row counts from
 *                      dra_table_metadata. Stored so model list / dashboards can
 *                      show source size without a JOIN.
 */
export class AddModelHealthToDRADataModels1774370000000 implements MigrationInterface {

    public async up(queryRunner: QueryRunner): Promise<void> {
        console.log('🚀 Starting migration: AddModelHealthToDRADataModels');

        // model_type — nullable so existing rows stay NULL (unclassified) until
        // a user or the AI assigns a type
        await queryRunner.query(`
            ALTER TABLE "dra_data_models"
            ADD COLUMN IF NOT EXISTS "model_type" VARCHAR(50) DEFAULT NULL
        `);

        // health_status — defaults to 'unknown' so existing rows are treated as
        // unanalysed rather than healthy/blocked
        await queryRunner.query(`
            ALTER TABLE "dra_data_models"
            ADD COLUMN IF NOT EXISTS "health_status" VARCHAR(50) NOT NULL DEFAULT 'unknown'
        `);

        // health_issues — JSONB array of issue objects; empty array for existing rows
        await queryRunner.query(`
            ALTER TABLE "dra_data_models"
            ADD COLUMN IF NOT EXISTS "health_issues" JSONB NOT NULL DEFAULT '[]'
        `);

        // source_row_count — nullable; populated by DataModelHealthService at save time
        await queryRunner.query(`
            ALTER TABLE "dra_data_models"
            ADD COLUMN IF NOT EXISTS "source_row_count" BIGINT DEFAULT NULL
        `);

        // Index on health_status so the model list page can filter/sort efficiently
        await queryRunner.query(`
            CREATE INDEX IF NOT EXISTS "idx_dra_data_models_health_status"
            ON "dra_data_models" ("health_status")
        `);

        console.log('✅ Migration AddModelHealthToDRADataModels complete');
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        console.log('⏪ Rolling back migration: AddModelHealthToDRADataModels');

        await queryRunner.query(`
            DROP INDEX IF EXISTS "idx_dra_data_models_health_status"
        `);

        await queryRunner.query(`
            ALTER TABLE "dra_data_models"
            DROP COLUMN IF EXISTS "source_row_count"
        `);

        await queryRunner.query(`
            ALTER TABLE "dra_data_models"
            DROP COLUMN IF EXISTS "health_issues"
        `);

        await queryRunner.query(`
            ALTER TABLE "dra_data_models"
            DROP COLUMN IF EXISTS "health_status"
        `);

        await queryRunner.query(`
            ALTER TABLE "dra_data_models"
            DROP COLUMN IF EXISTS "model_type"
        `);

        console.log('✅ Rollback AddModelHealthToDRADataModels complete');
    }
}
