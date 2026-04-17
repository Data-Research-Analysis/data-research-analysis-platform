import cron from 'node-cron';
import { AppDataSource } from '../datasources/PostgresDS.js';
import { DRAOrganizationSubscription } from '../models/DRAOrganizationSubscription.js';
import { DRASubscriptionTier } from '../models/DRASubscriptionTier.js';
import { SubscriptionProcessor } from '../processors/SubscriptionProcessor.js';
import { EmailService } from '../services/EmailService.js';
import { TemplateEngineService } from '../services/TemplateEngineService.js';

/**
 * Cron Job: Proactive Payment Method Expiry Alerts
 *
 * Runs on the 1st of each month at 09:00 UTC. Identifies active paid subscriptions
 * whose card expires in the following calendar month and sends a warning email.
 * This gives the org owner at minimum ~1–30 days notice before the card expires,
 * dramatically reducing involuntary churn from expired cards.
 *
 * Schedule: '0 9 1 * *' = 1st of month at 09:00 UTC
 */
export function startPaymentMethodExpiryJob() {
    console.log('📅 Initializing payment method expiry check job (runs 1st of month 9 AM UTC)');

    cron.schedule('0 9 1 * *', async () => {
        await checkExpiringPaymentMethods();
    });

    console.log('✅ Payment method expiry check job scheduled');
}

/**
 * Manual trigger — useful for admin endpoint or testing
 */
export async function runPaymentMethodExpiryCheckNow(): Promise<{ alertCount: number }> {
    console.log('🔧 Manually running payment method expiry check...');
    return checkExpiringPaymentMethods();
}

async function checkExpiringPaymentMethods(): Promise<{ alertCount: number }> {
    const manager = AppDataSource.manager;
    const processor = SubscriptionProcessor.getInstance();
    const emailService = EmailService.getInstance();
    const templateService = TemplateEngineService.getInstance();

    // Determine which calendar month/year to warn about
    const now = new Date();
    const nextMonthRaw = now.getMonth() + 2; // getMonth() is 0-indexed; +2 = next month (1-indexed)
    const targetMonth = nextMonthRaw > 12 ? nextMonthRaw - 12 : nextMonthRaw;
    const targetYear  = nextMonthRaw > 12 ? now.getFullYear() + 1 : now.getFullYear();

    console.log(`[ExpiryCheck] Checking for cards expiring in ${targetMonth}/${targetYear}`);

    // Find all active paid subscriptions with a Paddle customer ID
    const activeSubs = await manager
        .createQueryBuilder(DRAOrganizationSubscription, 'sub')
        .leftJoinAndSelect('sub.organization', 'org')
        .leftJoinAndSelect('sub.subscription_tier', 'tier')
        .where('sub.is_active = true')
        .andWhere('sub.paddle_customer_id IS NOT NULL')
        .getMany();

    let alertCount = 0;

    for (const sub of activeSubs) {
        // Skip free tier — no card needed
        if (sub.subscription_tier?.tier_name === 'free') continue;

        try {
            const validation = await processor.validatePaymentMethod(sub.organization_id);

            // Skip already-expired cards — grace period job handles those
            if (!validation.isValid || !validation.expiryMonth || !validation.expiryYear) continue;

            const expiresInTargetMonth =
                validation.expiryYear === targetYear && validation.expiryMonth === targetMonth;

            if (!expiresInTargetMonth) continue;

            const ownerEmail = sub.organization.settings?.owner_email;
            const ownerName  = sub.organization.settings?.owner_name || sub.organization.name;

            if (!ownerEmail) continue;

            const tierName = sub.subscription_tier?.tier_name?.toUpperCase() ?? '';

            try {
                const html = await templateService.render('payment-method-expiry-warning.html', [
                    { key: 'user_first_name', value: ownerName },
                    { key: 'card_last4',      value: validation.last4 ?? '****' },
                    { key: 'expiry_month',    value: String(targetMonth).padStart(2, '0') },
                    { key: 'expiry_year',     value: String(targetYear) },
                    { key: 'tier_name',       value: tierName },
                ]);

                await emailService.sendEmailImmediately({
                    to: ownerEmail,
                    subject: `Your payment card expires soon — action needed`,
                    html,
                    text: `Your card ending in ${validation.last4 ?? '****'} expires ${String(targetMonth).padStart(2, '0')}/${targetYear}. Please update your payment method to avoid service interruption on your ${tierName} plan.`,
                });

                alertCount++;
                console.log(`[ExpiryCheck] Sent expiry warning to ${ownerEmail} (org ${sub.organization_id})`);
            } catch (emailErr) {
                console.error(`[ExpiryCheck] Failed to send email to ${ownerEmail}:`, emailErr);
            }
        } catch (validationErr) {
            console.error(`[ExpiryCheck] Failed to validate payment for sub ${sub.id}:`, validationErr);
        }
    }

    console.log(`[ExpiryCheck] ✅ Sent ${alertCount} expiry warning email(s)`);
    return { alertCount };
}
