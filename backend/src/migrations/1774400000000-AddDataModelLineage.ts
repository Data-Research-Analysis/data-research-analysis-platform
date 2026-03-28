import { MigrationInterface, QueryRunner } from "typeorm";

/**
 * Issue #361 Phase 1 — Data Model Composition: Lineage Tracking
 *
 * Creates infrastructure to track which data models are built from other
 * data models. This enables dependency resolution, staleness detection, and
 * circular dependency prevention.
 *
 * Creates:
 *   - dra_data_model_lineage table: tracks parent-child relationships between data models
 *   - uses_data_models column: boolean flag indicates if a model uses other models as sources
 *
 * This is the foundation for staged data model construction, allowing users to
 * build complex models incrementally by composing smaller validated models.
 */
export class AddDataModelLineage1774400000000 implements MigrationInterface {

    public async up(queryRunner: QueryRunner): Promise<void> {
        console.log('🚀 Starting migration: AddDataModelLineage');

        // Create the lineage tracking table
        await queryRunner.query(`
            CREATE TABLE IF NOT EXISTS "dra_data_model_lineage" (
                "id" SERIAL PRIMARY KEY,
                "child_data_model_id" INTEGER NOT NULL,
                "parent_data_model_id" INTEGER NOT NULL,
                "parent_data_model_name" TEXT NOT NULL,
                "parent_last_refreshed_at" TIMESTAMP,
                "created_at" TIMESTAMP NOT NULL DEFAULT NOW(),
                CONSTRAINT "fk_child_data_model"
                    FOREIGN KEY ("child_data_model_id")
                    REFERENCES "dra_data_models"("id")
                    ON DELETE CASCADE,
                CONSTRAINT "fk_parent_data_model"
                    FOREIGN KEY ("parent_data_model_id")
                    REFERENCES "dra_data_models"("id")
                    ON DELETE CASCADE,
                CONSTRAINT "uq_lineage_pair"
                    UNIQUE ("child_data_model_id", "parent_data_model_id")
            )
        `);

        // Create indexes for efficient lineage queries
        await queryRunner.query(`
            CREATE INDEX IF NOT EXISTS "idx_child_model"
            ON "dra_data_model_lineage" ("child_data_model_id")
        `);

        await queryRunner.query(`
            CREATE INDEX IF NOT EXISTS "idx_parent_model"
            ON "dra_data_model_lineage" ("parent_data_model_id")
        `);

        // Add uses_data_models flag to dra_data_models
        await queryRunner.query(`
            ALTER TABLE "dra_data_models"
            ADD COLUMN IF NOT EXISTS "uses_data_models" BOOLEAN NOT NULL DEFAULT FALSE
        `);

        // Create index for filtering models that use data models
        await queryRunner.query(`
            CREATE INDEX IF NOT EXISTS "idx_uses_data_models"
            ON "dra_data_models" ("uses_data_models")
        `);

        console.log('✅ Migration AddDataModelLineage complete');
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        console.log('⏪ Rolling back migration: AddDataModelLineage');

        // Drop index on uses_data_models
        await queryRunner.query(`
            DROP INDEX IF EXISTS "idx_uses_data_models"
        `);

        // Drop uses_data_models column
        await queryRunner.query(`
            ALTER TABLE "dra_data_models"
            DROP COLUMN IF EXISTS "uses_data_models"
        `);

        // Drop lineage table indexes
        await queryRunner.query(`
            DROP INDEX IF EXISTS "idx_parent_model"
        `);

        await queryRunner.query(`
            DROP INDEX IF EXISTS "idx_child_model"
        `);

        // Drop lineage table
        await queryRunner.query(`
            DROP TABLE IF EXISTS "dra_data_model_lineage"
        `);

        console.log('✅ Rollback AddDataModelLineage complete');
    }
}
