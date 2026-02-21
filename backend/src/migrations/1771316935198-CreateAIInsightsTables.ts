import { MigrationInterface, QueryRunner } from "typeorm";

export class CreateAIInsightsTables1771316935198 implements MigrationInterface {
    name = 'CreateAIInsightsTables1771316935198'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "dra_mongodb_sync_history" DROP CONSTRAINT "fk_sync_history_data_source"`);
        await queryRunner.query(`DROP INDEX "public"."idx_sync_history_data_source"`);
        await queryRunner.query(`DROP INDEX "public"."idx_sync_history_status"`);
        await queryRunner.query(`DROP INDEX "public"."idx_sync_history_started_at"`);
        await queryRunner.query(`COMMENT ON COLUMN "dra_mongodb_sync_history"."table_name" IS NULL`);
        await queryRunner.query(`COMMENT ON COLUMN "dra_mongodb_sync_history"."sync_type" IS NULL`);
        await queryRunner.query(`COMMENT ON COLUMN "dra_mongodb_sync_history"."status" IS NULL`);
        await queryRunner.query(`COMMENT ON COLUMN "dra_mongodb_sync_history"."sync_metadata" IS NULL`);
        await queryRunner.query(`COMMENT ON COLUMN "dra_data_sources"."connection_string" IS NULL`);
        await queryRunner.query(`COMMENT ON COLUMN "dra_data_sources"."sync_status" IS NULL`);
        await queryRunner.query(`COMMENT ON COLUMN "dra_data_sources"."last_sync_at" IS NULL`);
        await queryRunner.query(`COMMENT ON COLUMN "dra_data_sources"."sync_error_message" IS NULL`);
        await queryRunner.query(`COMMENT ON COLUMN "dra_data_sources"."total_records_synced" IS NULL`);
        await queryRunner.query(`COMMENT ON COLUMN "dra_data_sources"."sync_config" IS NULL`);
        await queryRunner.query(`ALTER TABLE "dra_mongodb_sync_history" ADD CONSTRAINT "FK_06b4c8711f46773aae4f2de27af" FOREIGN KEY ("data_source_id") REFERENCES "dra_data_sources"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "dra_mongodb_sync_history" DROP CONSTRAINT "FK_06b4c8711f46773aae4f2de27af"`);
        await queryRunner.query(`COMMENT ON COLUMN "dra_data_sources"."sync_config" IS 'Sync configuration: schedule, batch size, incremental settings'`);
        await queryRunner.query(`COMMENT ON COLUMN "dra_data_sources"."total_records_synced" IS 'Total number of records synced'`);
        await queryRunner.query(`COMMENT ON COLUMN "dra_data_sources"."sync_error_message" IS 'Error message from last sync attempt'`);
        await queryRunner.query(`COMMENT ON COLUMN "dra_data_sources"."last_sync_at" IS 'Timestamp of last successful sync'`);
        await queryRunner.query(`COMMENT ON COLUMN "dra_data_sources"."sync_status" IS 'Sync status: pending, in_progress, completed, failed'`);
        await queryRunner.query(`COMMENT ON COLUMN "dra_data_sources"."connection_string" IS 'MongoDB connection string (e.g., mongodb+srv://...). Used as alternative to individual connection fields.'`);
        await queryRunner.query(`COMMENT ON COLUMN "dra_mongodb_sync_history"."sync_metadata" IS 'Additional sync metadata: timestamps, filters, etc.'`);
        await queryRunner.query(`COMMENT ON COLUMN "dra_mongodb_sync_history"."status" IS 'in_progress, completed, failed'`);
        await queryRunner.query(`COMMENT ON COLUMN "dra_mongodb_sync_history"."sync_type" IS 'full or incremental'`);
        await queryRunner.query(`COMMENT ON COLUMN "dra_mongodb_sync_history"."table_name" IS 'PostgreSQL table name in dra_mongodb schema'`);
        await queryRunner.query(`CREATE INDEX "idx_sync_history_started_at" ON "dra_mongodb_sync_history" ("started_at") `);
        await queryRunner.query(`CREATE INDEX "idx_sync_history_status" ON "dra_mongodb_sync_history" ("status") `);
        await queryRunner.query(`CREATE INDEX "idx_sync_history_data_source" ON "dra_mongodb_sync_history" ("data_source_id") `);
        await queryRunner.query(`ALTER TABLE "dra_mongodb_sync_history" ADD CONSTRAINT "fk_sync_history_data_source" FOREIGN KEY ("data_source_id") REFERENCES "dra_data_sources"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
    }

}
