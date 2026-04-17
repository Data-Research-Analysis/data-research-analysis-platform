import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Adds event_id column to dra_paddle_webhook_events with a unique index.
 *
 * Previously idempotency was checked via a jsonb scan (payload->>'event_id').
 * Promoting event_id to a dedicated column + unique index allows an atomic
 * ON CONFLICT DO NOTHING insert that eliminates the race condition where two
 * simultaneous Paddle deliveries could both pass the duplicate check.
 */
export class AddWebhookEventIdColumn1775800000000 implements MigrationInterface {
    public async up(queryRunner: QueryRunner): Promise<void> {
        // Add dedicated event_id column
        await queryRunner.query(`
            ALTER TABLE dra_paddle_webhook_events
            ADD COLUMN IF NOT EXISTS event_id VARCHAR(100) NULL;
        `);

        // Backfill from existing payload jsonb
        await queryRunner.query(`
            UPDATE dra_paddle_webhook_events
            SET event_id = payload->>'event_id'
            WHERE event_id IS NULL
              AND payload->>'event_id' IS NOT NULL;
        `);

        // Create unique partial index (only on non-null values)
        await queryRunner.query(`
            CREATE UNIQUE INDEX IF NOT EXISTS idx_paddle_webhook_event_id
            ON dra_paddle_webhook_events (event_id)
            WHERE event_id IS NOT NULL;
        `);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`DROP INDEX IF EXISTS idx_paddle_webhook_event_id;`);
        await queryRunner.query(`
            ALTER TABLE dra_paddle_webhook_events DROP COLUMN IF EXISTS event_id;
        `);
    }
}
