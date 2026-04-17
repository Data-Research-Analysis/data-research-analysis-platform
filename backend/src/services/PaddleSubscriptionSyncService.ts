import { AppDataSource } from '../datasources/PostgresDS.js';
import { DRAOrganizationSubscription } from '../models/DRAOrganizationSubscription.js';
import { PaddleService } from './PaddleService.js';

/**
 * PaddleSubscriptionSyncService - Sync local subscription state with Paddle
 * 
 * Ensures local database reflects Paddle's actual subscription state.
 * Paddle is the source of truth - local state should always match Paddle.
 * 
 * Key Scenarios:
 * - Subscription shown as cancelled locally but active in Paddle
 * - Subscription updated in Paddle but not reflected locally
 * - Missed webhook events causing state drift
 * 
 * Usage:
 * - Run periodically via cron job (daily recommended)
 * - Manual trigger via admin endpoint after fixing Paddle issues
 * - Automatic sync after failed webhook processing
 */
export class PaddleSubscriptionSyncService {
    private static instance: PaddleSubscriptionSyncService;
    
    private constructor() {
        console.log('📘 Paddle Subscription Sync Service initialized');
    }
    
    public static getInstance(): PaddleSubscriptionSyncService {
        if (!PaddleSubscriptionSyncService.instance) {
            PaddleSubscriptionSyncService.instance = new PaddleSubscriptionSyncService();
        }
        return PaddleSubscriptionSyncService.instance;
    }
    
    /**
     * Sync all active subscriptions with Paddle
     * 
     * Queries Paddle API for each subscription with a paddle_subscription_id
     * and updates local state to match Paddle's actual state.
     * 
     * @returns Summary of sync results
     */
    async syncAllSubscriptions(): Promise<{
        total: number;
        synced: number;
        corrected: number;
        errors: Array<{ subscriptionId: number; error: string }>;
    }> {
        const manager = AppDataSource.manager;
        const paddle = PaddleService.getInstance();
        
        // Find all subscriptions with Paddle IDs (active or inactive)
        const subscriptions = await manager.find(DRAOrganizationSubscription, {
            where: {},
            relations: ['organization', 'subscription_tier']
        });
        
        const subscriptionsWithPaddleId = subscriptions.filter(sub => sub.paddle_subscription_id);
        
        console.log(`🔄 Starting Paddle sync for ${subscriptionsWithPaddleId.length} subscriptions...`);
        
        const results = {
            total: subscriptionsWithPaddleId.length,
            synced: 0,
            corrected: 0,
            errors: [] as Array<{ subscriptionId: number; error: string }>
        };
        
        for (const subscription of subscriptionsWithPaddleId) {
            try {
                const changed = await this.syncSubscription(subscription.id);
                results.synced++;
                if (changed) {
                    results.corrected++;
                }
            } catch (error: any) {
                console.error(`❌ Failed to sync subscription ${subscription.id}:`, error.message);
                results.errors.push({
                    subscriptionId: subscription.id,
                    error: error.message
                });
            }
        }
        
        console.log(`✅ Paddle sync complete: ${results.synced}/${results.total} synced, ${results.corrected} corrected, ${results.errors.length} errors`);
        
        return results;
    }
    
    /**
     * Sync a single subscription with Paddle
     * 
     * Queries Paddle API for the subscription's current state and updates
     * local database if there are discrepancies.
     * 
     * @param subscriptionId - Local subscription ID
     * @returns True if changes were made, false if already in sync
     */
    async syncSubscription(subscriptionId: number): Promise<boolean> {
        const manager = AppDataSource.manager;
        const paddle = PaddleService.getInstance();
        
        const subscription = await manager.findOne(DRAOrganizationSubscription, {
            where: { id: subscriptionId },
            relations: ['organization', 'subscription_tier']
        });
        
        if (!subscription) {
            throw new Error(`Subscription ${subscriptionId} not found`);
        }
        
        if (!subscription.paddle_subscription_id) {
            throw new Error(`Subscription ${subscriptionId} has no Paddle ID`);
        }
        
        // Query Paddle API for actual subscription state
        let paddleSubscription;
        try {
            paddleSubscription = await paddle.getSubscription(subscription.paddle_subscription_id);
        } catch (error: any) {
            // If subscription not found in Paddle (404), it was deleted
            if (error.message?.includes('404') || error.message?.includes('not found')) {
                console.log(`   ⚠️ Subscription ${subscription.paddle_subscription_id} not found in Paddle (deleted)`);
                // Mark as inactive locally
                if (subscription.is_active) {
                    subscription.is_active = false;
                    await manager.save(subscription);
                    console.log(`   ✅ Marked subscription ${subscriptionId} as inactive (deleted in Paddle)`);
                    return true;
                }
                return false;
            }
            throw error;
        }
        
        // Compare local state with Paddle state
        let changed = false;
        
        // Check cancellation status
        const paddleStatus = paddleSubscription.status;
        const paddleScheduledChange = paddleSubscription.scheduledChange;
        const paddleCancelledAt = paddleSubscription.canceledAt;
        
        // Paddle statuses: active, canceled, past_due, paused, trialing
        const isPaddleActive = paddleStatus === 'active' || paddleStatus === 'trialing';
        const isPaddleCancelled = paddleStatus === 'canceled' || paddleScheduledChange?.action === 'cancel';
        
        // Sync cancelled_at field
        if (isPaddleCancelled && !subscription.cancelled_at) {
            // Paddle shows cancelled but local doesn't
            subscription.cancelled_at = paddleCancelledAt ? new Date(paddleCancelledAt) : new Date();
            changed = true;
            console.log(`   🔄 Set cancelled_at for subscription ${subscriptionId} (Paddle: ${paddleStatus})`);
        } else if (!isPaddleCancelled && subscription.cancelled_at) {
            // Local shows cancelled but Paddle doesn't - clear it
            subscription.cancelled_at = null;
            changed = true;
            console.log(`   🔄 Cleared cancelled_at for subscription ${subscriptionId} (Paddle: ${paddleStatus}, was incorrectly marked as cancelled locally)`);
        }
        
        // Sync is_active field
        if (isPaddleActive && !subscription.is_active) {
            subscription.is_active = true;
            changed = true;
            console.log(`   🔄 Set is_active=true for subscription ${subscriptionId} (Paddle: ${paddleStatus})`);
        } else if (!isPaddleActive && subscription.is_active && paddleStatus === 'canceled') {
            subscription.is_active = false;
            changed = true;
            console.log(`   🔄 Set is_active=false for subscription ${subscriptionId} (Paddle: ${paddleStatus})`);
        }
        
        // Sync current_period_end (ends_at in Paddle becomes our ends_at)
        if (paddleSubscription.currentBillingPeriod?.endsAt) {
            const paddleEndsAt = new Date(paddleSubscription.currentBillingPeriod.endsAt);
            const localEndsAt = subscription.ends_at ? new Date(subscription.ends_at) : null;
            
            if (!localEndsAt || Math.abs(paddleEndsAt.getTime() - localEndsAt.getTime()) > 1000) {
                subscription.ends_at = paddleEndsAt;
                changed = true;
                console.log(`   🔄 Updated ends_at for subscription ${subscriptionId} to ${paddleEndsAt.toISOString()}`);
            }
        }
        
        if (changed) {
            await manager.save(subscription);
            console.log(`   ✅ Synced subscription ${subscriptionId} (org: ${subscription.organization?.name || subscription.organization_id})`);
        } else {
            console.log(`   ✓ Subscription ${subscriptionId} already in sync`);
        }
        
        return changed;
    }
}
