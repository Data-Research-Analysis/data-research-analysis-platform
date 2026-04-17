import cron from 'node-cron';
import { AppDataSource } from '../datasources/PostgresDS.js';

/**
 * Cron Job: Webhook Event Retention Cleanup
 *
 * Runs weekly (Sunday 3 AM UTC) to hard-delete processed webhook events that
 * are older than 90 days. Paddle webhook payloads contain raw payment data
 * including customer emails and billing addresses, so retention must be bounded
 * to satisfy GDPR Art. 17 (right to erasure / storage limitation).
 *
 * Unprocessed events with errors are retained indefinitely for manual review.
 *
 * Schedule: '0 3 * * 0' = Sunday at 03:00 UTC
 */
export function startWebhookCleanupJob() {
    console.log('📅 Initializing webhook event cleanup job (runs weekly Sun 3 AM UTC)');

    cron.schedule('0 3 * * 0', async () => {
        await runWebhookCleanup();
    });

    console.log('✅ Webhook event cleanup job scheduled');
}

/**
 * Manual trigger — useful for admin endpoint or testing
 */
export async function runWebhookCleanupNow(): Promise<{ deletedCount: number }> {
    console.log('🔧 Manually running webhook event cleanup...');
    return runWebhookCleanup();
}

async function runWebhookCleanup(): Promise<{ deletedCount: number }> {
    const manager = AppDataSource.manager;
    const retentionDays = 90;

    console.log(`[WebhookCleanup] Deleting processed webhook events older than ${retentionDays} days`);

    try {
        const result = await manager
            .createQueryBuilder()
            .delete()
            .from('dra_paddle_webhook_events')
            .where('processed = true')
            .andWhere(`received_at < NOW() - INTERVAL '${retentionDays} days'`)
            .execute();

        const deletedCount = result.affected ?? 0;
        console.log(`[WebhookCleanup] ✅ Deleted ${deletedCount} old webhook events`);
        return { deletedCount };
    } catch (error) {
        console.error('[WebhookCleanup] ❌ Error during cleanup:', error);
        return { deletedCount: 0 };
    }
}
