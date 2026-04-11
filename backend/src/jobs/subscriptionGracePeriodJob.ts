import cron from 'node-cron';
import { SubscriptionProcessor } from '../processors/SubscriptionProcessor.js';
import { EmailService } from '../services/EmailService.js';
import { AppDataSource } from '../datasources/PostgresDS.js';
import { DRAOrganizationSubscription } from '../models/DRAOrganizationSubscription.js';
import { DRASubscriptionTier } from '../models/DRASubscriptionTier.js';

/**
 * Cron Job: Subscription Grace Period Management
 * 
 * Runs daily at 2 AM UTC to:
 * 1. Process expired grace periods (downgrade to FREE)
 * 2. Send reminder emails at 7, 3, and 1 days before grace period expiry
 * 
 * Schedule: '0 2 * * *' = Daily at 2:00 AM UTC
 * 
 * @see SubscriptionProcessor.processGracePeriodExpiry()
 * @see documentation/paddle-integration-plan.md
 */
export function startSubscriptionGracePeriodJob() {
    console.log('📅 Initializing subscription grace period cron job (runs daily at 2 AM UTC)');
    
    cron.schedule('0 2 * * *', async () => {
        await runGracePeriodCheck();
    });
    
    console.log('✅ Subscription grace period cron job scheduled successfully');
}

/**
 * One-time manual execution (useful for testing or immediate processing)
 */
export async function runGracePeriodCheckNow(): Promise<{ expiredCount: number; remindersCount: number }> {
    console.log('🔧 Manually running subscription grace period check...');
    return await runGracePeriodCheck();
}

/**
 * Core grace period check logic (shared by cron and manual execution)
 */
async function runGracePeriodCheck(): Promise<{ expiredCount: number; remindersCount: number }> {
    console.log('🔄 Running subscription grace period check...');
    const startTime = Date.now();
    
    let expiredCount = 0;
    let remindersCount = 0;
    
    try {
        const processor = SubscriptionProcessor.getInstance();
        
        // Process expired grace periods (downgrade to FREE)
        expiredCount = await processor.processGracePeriodExpiry();
        console.log(`   ✅ Processed ${expiredCount} expired grace periods`);
        
        // Send reminders for grace periods ending soon
        remindersCount = await sendGracePeriodReminders();
        console.log(`   📧 Sent ${remindersCount} grace period reminder emails`);
        
        const duration = Date.now() - startTime;
        console.log(`✅ Grace period check complete: ${expiredCount} expired, ${remindersCount} reminders sent (${duration}ms)`);
        
    } catch (error) {
        console.error('❌ Error in grace period job:', error);
    }
    
    return { expiredCount, remindersCount };
}

/**
 * Send reminders at 7, 3, and 1 days before grace period expires
 * 
 * Queries subscriptions with grace_period_ends_at matching target dates.
 * Sends urgent reminder emails to encourage payment method updates.
 * 
 * @returns Total number of reminder emails sent
 */
async function sendGracePeriodReminders(): Promise<number> {
    const manager = AppDataSource.manager;
    const now = new Date();
    let totalReminders = 0;
    
    // Calculate dates for 7, 3, and 1 days from now
    const reminderDays = [7, 3, 1];
    
    for (const days of reminderDays) {
        const targetDate = new Date(now);
        targetDate.setDate(targetDate.getDate() + days);
        
        // Find subscriptions expiring on this day (within 24 hour window)
        const startWindow = new Date(targetDate);
        startWindow.setHours(0, 0, 0, 0);
        
        const endWindow = new Date(targetDate);
        endWindow.setHours(23, 59, 59, 999);
        
        const expiringSubscriptions = await manager
            .createQueryBuilder(DRAOrganizationSubscription, 'sub')
            .leftJoinAndSelect('sub.organization', 'org')
            .leftJoinAndSelect('sub.subscription_tier', 'tier')
            .where('sub.grace_period_ends_at >= :start', { start: startWindow })
            .andWhere('sub.grace_period_ends_at <= :end', { end: endWindow })
            .andWhere('sub.is_active = true')
            .getMany();
            
        for (const subscription of expiringSubscriptions) {
            const ownerEmail = subscription.organization.settings?.owner_email || '';
            const ownerName = subscription.organization.settings?.owner_name || subscription.organization.name;
            
            if (ownerEmail && subscription.grace_period_ends_at) {
                const tier = await manager.findOne(DRASubscriptionTier, {
                    where: { id: subscription.subscription_tier_id }
                });
                
                try {
                    await EmailService.getInstance().sendGracePeriodExpiring(
                        ownerEmail,
                        ownerName,
                        tier?.tier_name.toUpperCase() || 'UNKNOWN',
                        subscription.grace_period_ends_at,
                        days
                    );
                    totalReminders++;
                } catch (error) {
                    console.error(`   ❌ Failed to send reminder for subscription ${subscription.id}:`, error);
                }
            }
        }
        
        if (expiringSubscriptions.length > 0) {
            console.log(`   📧 Sent ${expiringSubscriptions.length} grace period reminders (${days} days)`);
        }
    }
    
    return totalReminders;
}
