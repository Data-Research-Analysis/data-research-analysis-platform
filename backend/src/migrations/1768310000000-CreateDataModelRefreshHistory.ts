import { MigrationInterface, QueryRunner } from "typeorm";

export class CreateDataModelRefreshHistory1768310000000 implements MigrationInterface {

    public async up(queryRunner: QueryRunner): Promise<void> {
        // Create refresh history table
        await queryRunner.query(`
            CREATE TABLE "dra_data_model_refresh_history" (
                "id" SERIAL PRIMARY KEY,
                "data_model_id" INTEGER NOT NULL,
                "status" VARCHAR(20) NOT NULL 
                    CHECK ("status" IN ('QUEUED', 'RUNNING', 'COMPLETED', 'FAILED')),
                "started_at" TIMESTAMP NOT NULL DEFAULT NOW(),
                "completed_at" TIMESTAMP,
                "duration_ms" INTEGER,
                "rows_before" INTEGER,
                "rows_after" INTEGER,
                "rows_changed" INTEGER,
                "triggered_by" VARCHAR(50) NOT NULL,
                "trigger_user_id" INTEGER,
                "trigger_source_id" INTEGER,
                "reason" TEXT,
                "error_message" TEXT,
                "error_stack" TEXT,
                "query_executed" TEXT,
                "created_at" TIMESTAMP DEFAULT NOW(),
                CONSTRAINT "fk_refresh_history_model" 
                    FOREIGN KEY ("data_model_id") 
                    REFERENCES "dra_data_models"("id") 
                    ON DELETE CASCADE,
                CONSTRAINT "fk_refresh_history_user" 
                    FOREIGN KEY ("trigger_user_id") 
                    REFERENCES "dra_users_platform"("id") 
                    ON DELETE SET NULL,
                CONSTRAINT "fk_refresh_history_source" 
                    FOREIGN KEY ("trigger_source_id") 
                    REFERENCES "dra_data_sources"("id") 
                    ON DELETE SET NULL
            )
        `);

        // Create indexes for query performance
        await queryRunner.query(`
            CREATE INDEX "idx_refresh_history_model" 
            ON "dra_data_model_refresh_history"("data_model_id")
        `);

        await queryRunner.query(`
            CREATE INDEX "idx_refresh_history_started" 
            ON "dra_data_model_refresh_history"("started_at" DESC)
        `);

        await queryRunner.query(`
            CREATE INDEX "idx_refresh_history_status" 
            ON "dra_data_model_refresh_history"("status")
        `);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        // Drop table (cascade will handle indexes)
        await queryRunner.query(`DROP TABLE IF EXISTS "dra_data_model_refresh_history" CASCADE`);
    }

}
