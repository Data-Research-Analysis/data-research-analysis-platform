import { MigrationInterface, QueryRunner } from "typeorm";

/**
 * Issue #361 - Medallion Architecture: Add Data Layer Classification
 *
 * Replaces the current model_type system with a proper medallion architecture
 * using three data quality layers:
 *   - raw_data (Bronze): Preserves source data structure
 *   - clean_data (Silver): Cleaned, joined, deduplicated
 *   - business_ready (Gold): Aggregated, business-ready metrics
 *
 * Creates:
 *   - data_layer enum column for layer classification
 *   - layer_config JSONB column for layer-specific settings
 *   - Indexes for efficient layer-based queries
 *
 * Backward compatibility:
 *   - model_type column is preserved but deprecated
 *   - Existing models default to 'raw_data' layer
 */
export class AddDataModelLayers1774500000000 implements MigrationInterface {

    public async up(queryRunner: QueryRunner): Promise<void> {
        console.log('🚀 Starting migration: AddDataModelLayers');

        // Create enum type for data layers
        await queryRunner.query(`
            CREATE TYPE "data_layer_enum" AS ENUM (
                'raw_data',
                'clean_data', 
                'business_ready'
            )
        `);

        // Add data_layer column (nullable initially for migration)
        await queryRunner.query(`
            ALTER TABLE "dra_data_models"
            ADD COLUMN IF NOT EXISTS "data_layer" "data_layer_enum"
        `);

        // Add layer_config JSONB column for layer-specific configuration
        await queryRunner.query(`
            ALTER TABLE "dra_data_models"
            ADD COLUMN IF NOT EXISTS "layer_config" JSONB DEFAULT '{}'::jsonb
        `);

        // Default all existing models to 'raw_data' layer
        // This preserves data integrity - users can reclassify as needed
        await queryRunner.query(`
            UPDATE "dra_data_models"
            SET "data_layer" = 'raw_data'
            WHERE "data_layer" IS NULL
        `);

        // Now make data_layer NOT NULL with default
        await queryRunner.query(`
            ALTER TABLE "dra_data_models"
            ALTER COLUMN "data_layer" SET DEFAULT 'raw_data',
            ALTER COLUMN "data_layer" SET NOT NULL
        `);

        // Create index for efficient layer-based queries
        await queryRunner.query(`
            CREATE INDEX IF NOT EXISTS "idx_data_models_layer"
            ON "dra_data_models" ("data_layer")
        `);

        // Create composite index for common query patterns (project + layer)
        await queryRunner.query(`
            CREATE INDEX IF NOT EXISTS "idx_data_models_project_layer"
            ON "dra_data_models" ("organization_id", "workspace_id", "data_layer")
        `);

        console.log('✅ Migration AddDataModelLayers complete');
        console.log('📊 All existing models defaulted to raw_data layer');
        console.log('⚠️  Note: model_type column is deprecated but preserved for backward compatibility');
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        console.log('⏪ Rolling back migration: AddDataModelLayers');

        // Drop indexes
        await queryRunner.query(`
            DROP INDEX IF EXISTS "idx_data_models_project_layer"
        `);

        await queryRunner.query(`
            DROP INDEX IF EXISTS "idx_data_models_layer"
        `);

        // Drop columns
        await queryRunner.query(`
            ALTER TABLE "dra_data_models"
            DROP COLUMN IF EXISTS "layer_config"
        `);

        await queryRunner.query(`
            ALTER TABLE "dra_data_models"
            DROP COLUMN IF EXISTS "data_layer"
        `);

        // Drop enum type
        await queryRunner.query(`
            DROP TYPE IF EXISTS "data_layer_enum"
        `);

        console.log('✅ Rollback AddDataModelLayers complete');
    }
}
