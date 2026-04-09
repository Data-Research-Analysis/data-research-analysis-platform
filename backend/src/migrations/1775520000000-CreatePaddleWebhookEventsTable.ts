import { MigrationInterface, QueryRunner, Table, TableIndex } from 'typeorm';

/**
 * Migration to create Paddle webhook events table
 * 
 * Logs all webhook events from Paddle for:
 * - Debugging webhook failures
 * - Idempotency (prevent duplicate processing)
 * - Audit trail of payment events
 * - Retry capability
 * 
 * Event types include:
 * - subscription.created
 * - subscription.updated
 * - subscription.canceled
 * - subscription.payment_succeeded
 * - subscription.payment_failed
 * - customer.updated
 * 
 * Part of Paddle.com payment integration
 * @see documentation/paddle-integration-plan.md
 */
export class CreatePaddleWebhookEventsTable1775520000000 implements MigrationInterface {
    name = 'CreatePaddleWebhookEventsTable1775520000000';

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.createTable(new Table({
            name: 'dra_paddle_webhook_events',
            columns: [
                {
                    name: 'id',
                    type: 'int',
                    isPrimary: true,
                    isGenerated: true,
                    generationStrategy: 'increment'
                },
                {
                    name: 'event_type',
                    type: 'varchar',
                    length: '100',
                    comment: 'Paddle event type (e.g., subscription.created)'
                },
                {
                    name: 'payload',
                    type: 'jsonb',
                    comment: 'Full webhook payload from Paddle'
                },
                {
                    name: 'processed',
                    type: 'boolean',
                    default: false,
                    comment: 'Whether event has been successfully processed'
                },
                {
                    name: 'error_message',
                    type: 'text',
                    isNullable: true,
                    comment: 'Error message if processing failed'
                },
                {
                    name: 'received_at',
                    type: 'timestamp',
                    default: 'CURRENT_TIMESTAMP',
                    comment: 'When webhook was received'
                },
                {
                    name: 'processed_at',
                    type: 'timestamp',
                    isNullable: true,
                    comment: 'When event was successfully processed'
                }
            ]
        }));
        
        // Index for faster event type lookups
        await queryRunner.createIndex('dra_paddle_webhook_events', new TableIndex({
            name: 'IDX_paddle_webhook_event_type',
            columnNames: ['event_type']
        }));
        
        // Index for filtering processed vs unprocessed
        await queryRunner.createIndex('dra_paddle_webhook_events', new TableIndex({
            name: 'IDX_paddle_webhook_processed',
            columnNames: ['processed']
        }));
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.dropIndex('dra_paddle_webhook_events', 'IDX_paddle_webhook_processed');
        await queryRunner.dropIndex('dra_paddle_webhook_events', 'IDX_paddle_webhook_event_type');
        await queryRunner.dropTable('dra_paddle_webhook_events');
    }
}
