import { MigrationInterface, QueryRunner } from "typeorm";

export class AddGAMSyncHistoryTable1765706563000 implements MigrationInterface {
    name = 'AddGAMSyncHistoryTable1765706563000'

    public async up(queryRunner: QueryRunner): Promise<void> {
        // Create sync history table
        await queryRunner.query(`
            CREATE TABLE IF NOT EXISTS sync_history (
                id SERIAL PRIMARY KEY,
                data_source_id INTEGER NOT NULL,
                sync_type VARCHAR(50) NOT NULL,
                status VARCHAR(20) NOT NULL,
                started_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
                completed_at TIMESTAMP,
                duration_ms INTEGER,
                records_synced INTEGER DEFAULT 0,
                records_failed INTEGER DEFAULT 0,
                error_message TEXT,
                metadata JSONB,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                CONSTRAINT fk_data_source
                    FOREIGN KEY (data_source_id)
                    REFERENCES dra_data_sources(id)
                    ON DELETE CASCADE
            )
        `);

        // Create indexes for common queries
        await queryRunner.query(`
            CREATE INDEX idx_sync_history_data_source_id ON sync_history(data_source_id)
        `);

        await queryRunner.query(`
            CREATE INDEX idx_sync_history_status ON sync_history(status)
        `);

        await queryRunner.query(`
            CREATE INDEX idx_sync_history_started_at ON sync_history(started_at DESC)
        `);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`DROP INDEX IF EXISTS idx_sync_history_started_at`);
        await queryRunner.query(`DROP INDEX IF EXISTS idx_sync_history_status`);
        await queryRunner.query(`DROP INDEX IF EXISTS idx_sync_history_data_source_id`);
        await queryRunner.query(`DROP TABLE IF EXISTS sync_history`);
    }
}
