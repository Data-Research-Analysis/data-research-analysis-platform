import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn } from 'typeorm';

/**
 * Paddle Webhook Event entity
 * 
 * Logs all webhook events received from Paddle for:
 * - Debugging and troubleshooting
 * - Idempotency (prevent duplicate processing of same event)
 * - Audit trail of payment and subscription events
 * - Manual retry capability if processing fails
 * 
 * Event types processed:
 * - subscription.created: New subscription activated
 * - subscription.updated: Tier or billing cycle changed
 * - subscription.canceled: Subscription cancelled
 * - subscription.payment_succeeded: Successful payment clears grace period
 * - subscription.payment_failed: Payment failure starts grace period
 * - customer.updated: Customer information changed
 * 
 * @see backend/src/routes/paddle-webhook.ts for webhook handler
 * @see documentation/paddle-integration-plan.md
 */
@Entity('dra_paddle_webhook_events')
export class DRAPaddleWebhookEvent {
    @PrimaryGeneratedColumn()
    id!: number;
    
    @Column({ type: 'varchar', length: 100 })
    event_type!: string;
    
    @Column({ type: 'jsonb' })
    payload!: any;
    
    @Column({ type: 'boolean', default: false })
    processed!: boolean;
    
    @Column({ type: 'text', nullable: true })
    error_message!: string | null;
    
    @CreateDateColumn({ type: 'timestamp' })
    received_at!: Date;
    
    @Column({ type: 'timestamp', nullable: true })
    processed_at!: Date | null;
}
