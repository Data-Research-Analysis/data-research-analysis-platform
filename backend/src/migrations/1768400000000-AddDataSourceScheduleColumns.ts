import { MigrationInterface, QueryRunner } from "typeorm";

export class AddDataSourceScheduleColumns1768400000000 implements MigrationInterface {
    name = 'AddDataSourceScheduleColumns1768400000000'

    public async up(queryRunner: QueryRunner): Promise<void> {
        // Check if columns already exist (may have been added by another migration)
        const syncScheduleExists = await queryRunner.query(`
            SELECT EXISTS (
                SELECT FROM information_schema.columns 
                WHERE table_schema = 'public' 
                AND table_name = 'dra_data_sources'
                AND column_name = 'sync_schedule'
            );
        `);

        if (!syncScheduleExists[0].exists) {
            console.log('  ✓ Adding schedule columns to dra_data_sources...');
            // Add schedule-related columns to dra_data_sources table
            await queryRunner.query(`
                ALTER TABLE "dra_data_sources"
                ADD COLUMN "sync_schedule" VARCHAR(20) DEFAULT 'manual',
                ADD COLUMN "sync_schedule_time" TIME,
                ADD COLUMN "sync_enabled" BOOLEAN DEFAULT true,
                ADD COLUMN "next_scheduled_sync" TIMESTAMP
            `);
        } else {
            console.log('  ⚠️  Schedule columns already exist in dra_data_sources, skipping');
        }

        // Create index for efficient queries of due syncs (with IF NOT EXISTS)
        await queryRunner.query(`
            CREATE INDEX IF NOT EXISTS "idx_data_sources_next_sync"
            ON "dra_data_sources"("next_scheduled_sync")
        `);

        // Create index for schedule queries (with IF NOT EXISTS)
        await queryRunner.query(`
            CREATE INDEX IF NOT EXISTS "idx_data_sources_schedule"
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
