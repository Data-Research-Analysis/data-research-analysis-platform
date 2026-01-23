import { MigrationInterface, QueryRunner } from "typeorm";

export class AddDataModelRefreshTracking1768300000000 implements MigrationInterface {

    public async up(queryRunner: QueryRunner): Promise<void> {
        // Add refresh tracking columns to dra_data_models
        await queryRunner.query(`
            ALTER TABLE "dra_data_models" 
                ADD COLUMN "last_refreshed_at" TIMESTAMP,
                ADD COLUMN "refresh_status" VARCHAR(20) DEFAULT 'IDLE' 
                    CHECK ("refresh_status" IN ('IDLE', 'QUEUED', 'REFRESHING', 'COMPLETED', 'FAILED')),
                ADD COLUMN "refresh_error" TEXT,
                ADD COLUMN "row_count" INTEGER,
                ADD COLUMN "last_refresh_duration_ms" INTEGER,
                ADD COLUMN "auto_refresh_enabled" BOOLEAN DEFAULT true
        `);

        // Create indexes for query performance
        await queryRunner.query(`
            CREATE INDEX "idx_data_models_refresh_status" 
            ON "dra_data_models"("refresh_status")
        `);

        await queryRunner.query(`
            CREATE INDEX "idx_data_models_last_refreshed" 
            ON "dra_data_models"("last_refreshed_at")
        `);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        // Drop indexes first
        await queryRunner.query(`DROP INDEX IF EXISTS "idx_data_models_last_refreshed"`);
        await queryRunner.query(`DROP INDEX IF EXISTS "idx_data_models_refresh_status"`);

        // Drop columns
        await queryRunner.query(`
            ALTER TABLE "dra_data_models" 
                DROP COLUMN "auto_refresh_enabled",
                DROP COLUMN "last_refresh_duration_ms",
                DROP COLUMN "row_count",
                DROP COLUMN "refresh_error",
                DROP COLUMN "refresh_status",
                DROP COLUMN "last_refreshed_at"
        `);
    }

}
