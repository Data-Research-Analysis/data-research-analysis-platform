import { MigrationInterface, QueryRunner } from "typeorm";

export class AddDataSourceScheduleColumns1768400000000 implements MigrationInterface {
    name = 'AddDataSourceScheduleColumns1768400000000'

    public async up(queryRunner: QueryRunner): Promise<void> {
        // Add schedule-related columns to dra_data_sources table
        await queryRunner.query(`
            ALTER TABLE "dra_data_sources"
            ADD COLUMN "sync_schedule" VARCHAR(20) DEFAULT 'manual',
            ADD COLUMN "sync_schedule_time" TIME,
            ADD COLUMN "sync_enabled" BOOLEAN DEFAULT true,
            ADD COLUMN "next_scheduled_sync" TIMESTAMP
        `);

        // Create index for efficient queries of due syncs
        await queryRunner.query(`
            CREATE INDEX "idx_data_sources_next_sync"
            ON "dra_data_sources"("next_scheduled_sync")
        `);

        // Create index for schedule queries
        await queryRunner.query(`
            CREATE INDEX "idx_data_sources_schedule"
            ON "dra_data_sources"("sync_schedule", "sync_enabled")
        `);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        // Drop indexes first
        await queryRunner.query(`DROP INDEX IF EXISTS "idx_data_sources_schedule"`);
        await queryRunner.query(`DROP INDEX IF EXISTS "idx_data_sources_next_sync"`);

        // Drop columns
        await queryRunner.query(`
            ALTER TABLE "dra_data_sources"
            DROP COLUMN IF EXISTS "next_scheduled_sync",
            DROP COLUMN IF EXISTS "sync_enabled",
            DROP COLUMN IF EXISTS "sync_schedule_time",
            DROP COLUMN IF EXISTS "sync_schedule"
        `);
    }
}
