import cron from 'node-cron';
import { SubscriptionProcessor } from '../processors/SubscriptionProcessor.js';

/**
 * Cron Job: Expired Cancelled Subscription Downgrade
 * 
 * Runs daily at 3 AM UTC to:
 * 1. Find subscriptions with cancelled_at set where ends_at has passed
 * 2. Downgrade them to FREE tier
 * 3. Set is_active = false
 * 4. Send notification emails
 * 
 * Schedule: '0 3 * * *' = Daily at 3:00 AM UTC
 * 
 * Background:
 * When a user cancels their subscription through Paddle, the subscription remains
 * active until the current period ends (ends_at date). This job processes those
 * subscriptions after they expire.
 * 
 * @see SubscriptionProcessor.processExpiredCancelledSubscriptions()
 */
export function startExpiredSubscriptionDowngradeJob() {
    console.log('📅 Initializing expired subscription downgrade cron job (runs daily at 3 AM UTC)');
    
    cron.schedule('0 3 * * *', async () => {
        await runExpiredSubscriptionCheck();
    });
    
    console.log('✅ Expired subscription downgrade cron job scheduled successfully');
}

/**
 * One-time manual execution (useful for testing or immediate processing)
 */
export async function runExpiredSubscriptionCheckNow(): Promise<{ downgradedCount: number }> {
    console.log('🔧 Manually running expired subscription check...');
    return await runExpiredSubscriptionCheck();
}

/**
 * Core expired subscription check logic (shared by cron and manual execution)
 */
async function runExpiredSubscriptionCheck(): Promise<{ downgradedCount: number }> {
    console.log('🔄 Running expired cancelled subscription check...');
    const startTime = Date.now();
    
    let downgradedCount = 0;
    
    try {
        const processor = SubscriptionProcessor.getInstance();
        
        // Process expired cancelled subscriptions (downgrade to FREE)
        downgradedCount = await processor.processExpiredCancelledSubscriptions();
        console.log(`   ✅ Downgraded ${downgradedCount} expired cancelled subscriptions to FREE`);
        
        const duration = Date.now() - startTime;
        console.log(`✅ Expired subscription check complete: ${downgradedCount} downgraded (${duration}ms)`);
        
    } catch (error) {
        console.error('❌ Error in expired subscription downgrade job:', error);
    }
    
    return { downgradedCount };
}
