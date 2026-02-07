import { MigrationInterface, QueryRunner } from "typeorm";

/**
 * Migration: Create Data Quality Tables
 * Creates tables for data quality reporting, cleaning history, and quality rules
 * Part of Phase 1: Data Quality & Marketing Attribution Engine
 */
export class CreateDataQualityTables1738713600000 implements MigrationInterface {
    name = 'CreateDataQualityTables1738713600000'

    public async up(queryRunner: QueryRunner): Promise<void> {
        // Create dra_data_quality_reports table
        await queryRunner.query(`
            CREATE TABLE "dra_data_quality_reports" (
                "id" SERIAL PRIMARY KEY,
                "data_model_id" INTEGER NOT NULL,
                "user_id" INTEGER NOT NULL,
                "quality_score" DECIMAL(5,2) NOT NULL DEFAULT 0,
                "completeness_score" DECIMAL(5,2) NOT NULL DEFAULT 0,
                "uniqueness_score" DECIMAL(5,2) NOT NULL DEFAULT 0,
                "validity_score" DECIMAL(5,2) NOT NULL DEFAULT 0,
                "consistency_score" DECIMAL(5,2),
                "total_rows" BIGINT NOT NULL DEFAULT 0,
                "duplicate_count" INTEGER DEFAULT 0,
                "null_count" INTEGER DEFAULT 0,
                "outlier_count" INTEGER DEFAULT 0,
                "issues_detected" JSONB,
                "recommendations" JSONB,
                "status" VARCHAR(20) DEFAULT 'pending',
                "created_at" TIMESTAMP DEFAULT NOW(),
                "updated_at" TIMESTAMP DEFAULT NOW(),
                CONSTRAINT "FK_dra_data_quality_reports_data_model"
                    FOREIGN KEY ("data_model_id")
                    REFERENCES "dra_data_models"("id")
                    ON DELETE CASCADE,
                CONSTRAINT "FK_dra_data_quality_reports_user"
                    FOREIGN KEY ("user_id")
                    REFERENCES "dra_users_platform"("id")
                    ON DELETE CASCADE
            )
        `);

        // Create indexes for dra_data_quality_reports
        await queryRunner.query(`
            CREATE INDEX "IDX_dra_data_quality_reports_data_model" 
                ON "dra_data_quality_reports" ("data_model_id")
        `);
        
        await queryRunner.query(`
            CREATE INDEX "IDX_dra_data_quality_reports_user" 
                ON "dra_data_quality_reports" ("user_id")
        `);
        
        await queryRunner.query(`
            CREATE INDEX "IDX_dra_data_quality_reports_created_at" 
                ON "dra_data_quality_reports" ("created_at" DESC)
        `);

        await queryRunner.query(`
            CREATE INDEX "IDX_dra_data_quality_reports_status" 
                ON "dra_data_quality_reports" ("status")
        `);

        // Create dra_data_cleaning_history table
        await queryRunner.query(`
            CREATE TABLE "dra_data_cleaning_history" (
                "id" SERIAL PRIMARY KEY,
                "data_model_id" INTEGER NOT NULL,
                "user_id" INTEGER NOT NULL,
                "cleaning_type" VARCHAR(50) NOT NULL,
                "affected_columns" TEXT[],
                "rows_affected" INTEGER DEFAULT 0,
                "configuration" JSONB,
                "status" VARCHAR(20) DEFAULT 'completed',
                "error_message" TEXT,
                "execution_time_ms" INTEGER,
                "created_at" TIMESTAMP DEFAULT NOW(),
                CONSTRAINT "FK_dra_data_cleaning_history_data_model"
                    FOREIGN KEY ("data_model_id")
                    REFERENCES "dra_data_models"("id")
                    ON DELETE CASCADE,
                CONSTRAINT "FK_dra_data_cleaning_history_user"
                    FOREIGN KEY ("user_id")
                    REFERENCES "dra_users_platform"("id")
                    ON DELETE CASCADE
            )
        `);

        // Create indexes for dra_data_cleaning_history
        await queryRunner.query(`
            CREATE INDEX "IDX_dra_data_cleaning_history_data_model" 
                ON "dra_data_cleaning_history" ("data_model_id")
        `);
        
        await queryRunner.query(`
            CREATE INDEX "IDX_dra_data_cleaning_history_user" 
                ON "dra_data_cleaning_history" ("user_id")
        `);
        
        await queryRunner.query(`
            CREATE INDEX "IDX_dra_data_cleaning_history_created_at" 
                ON "dra_data_cleaning_history" ("created_at" DESC)
        `);

        await queryRunner.query(`
            CREATE INDEX "IDX_dra_data_cleaning_history_cleaning_type" 
                ON "dra_data_cleaning_history" ("cleaning_type")
        `);

        // Create dra_data_quality_rules table
        await queryRunner.query(`
            CREATE TABLE "dra_data_quality_rules" (
                "id" SERIAL PRIMARY KEY,
                "data_model_id" INTEGER NOT NULL,
                "rule_name" VARCHAR(255) NOT NULL,
                "rule_type" VARCHAR(50) NOT NULL,
                "column_name" VARCHAR(255) NOT NULL,
                "rule_config" JSONB NOT NULL,
                "threshold" DECIMAL(5,2),
                "is_active" BOOLEAN DEFAULT true,
                "created_by_user_id" INTEGER,
                "created_at" TIMESTAMP DEFAULT NOW(),
                "updated_at" TIMESTAMP DEFAULT NOW(),
                CONSTRAINT "FK_dra_data_quality_rules_data_model"
                    FOREIGN KEY ("data_model_id")
                    REFERENCES "dra_data_models"("id")
                    ON DELETE CASCADE,
                CONSTRAINT "FK_dra_data_quality_rules_user"
                    FOREIGN KEY ("created_by_user_id")
                    REFERENCES "dra_users_platform"("id")
                    ON DELETE SET NULL
            )
        `);

        // Create indexes for dra_data_quality_rules
        await queryRunner.query(`
            CREATE INDEX "IDX_dra_data_quality_rules_data_model" 
                ON "dra_data_quality_rules" ("data_model_id")
        `);
        
        await queryRunner.query(`
            CREATE INDEX "IDX_dra_data_quality_rules_rule_type" 
                ON "dra_data_quality_rules" ("rule_type")
        `);
        
        await queryRunner.query(`
            CREATE INDEX "IDX_dra_data_quality_rules_is_active" 
                ON "dra_data_quality_rules" ("is_active")
        `);

        // Add comment explaining the purpose
        await queryRunner.query(`
            COMMENT ON TABLE "dra_data_quality_reports" IS 
                'Stores data quality analysis results including quality scores and detected issues'
        `);
        
        await queryRunner.query(`
            COMMENT ON TABLE "dra_data_cleaning_history" IS 
                'Audit trail of all data cleaning operations executed on data models'
        `);
        
        await queryRunner.query(`
            COMMENT ON TABLE "dra_data_quality_rules" IS 
                'User-defined data quality rules that can be applied to data models'
        `);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        // Drop tables in reverse order (to handle foreign key constraints)
        await queryRunner.query(`DROP TABLE IF EXISTS "dra_data_quality_rules" CASCADE`);
        await queryRunner.query(`DROP TABLE IF EXISTS "dra_data_cleaning_history" CASCADE`);
        await queryRunner.query(`DROP TABLE IF EXISTS "dra_data_quality_reports" CASCADE`);
    }
}
