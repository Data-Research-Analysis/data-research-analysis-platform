import express, { Request, Response } from 'express';
import { validateJWT } from '../../middleware/authenticate.js';
import { EUserType } from '../../types/EUserType.js';
import { runExpiredSubscriptionCheckNow } from '../../jobs/expiredSubscriptionDowngradeJob.js';
import { runGracePeriodCheckNow } from '../../jobs/subscriptionGracePeriodJob.js';

const router = express.Router();

async function requireAdmin(req: any, res: any, next: any) {
    const tokenDetails = req.tokenDetails || req.body.tokenDetails;
    if (!tokenDetails || tokenDetails.user_type !== EUserType.ADMIN) {
        return res.status(403).json({ success: false, message: 'Admin access required' });
    }
    next();
}

/**
 * POST /admin/jobs/expired-subscriptions
 * Manually trigger expired cancelled subscription downgrade process.
 * Finds subscriptions with cancelled_at set and ends_at < NOW(), downgrades to FREE.
 * Admin-only. Safe to run multiple times (idempotent).
 */
router.post('/expired-subscriptions', validateJWT, requireAdmin, async (req: Request, res: Response) => {
    try {
        console.log('[AdminJobsRoute] Manual expired subscription check triggered by admin');
        const results = await runExpiredSubscriptionCheckNow();
        res.json({ 
            success: true, 
            message: `Processed ${results.downgradedCount} expired subscriptions`,
            data: results 
        });
    } catch (error: any) {
        console.error('[AdminJobsRoute] Expired subscription check failed:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

/**
 * POST /admin/jobs/grace-periods
 * Manually trigger grace period processing and reminder emails.
 * Downgrades expired grace periods and sends 7/3/1 day reminders.
 * Admin-only. Safe to run multiple times (idempotent).
 */
router.post('/grace-periods', validateJWT, requireAdmin, async (req: Request, res: Response) => {
    try {
        console.log('[AdminJobsRoute] Manual grace period check triggered by admin');
        const results = await runGracePeriodCheckNow();
        res.json({ 
            success: true, 
            message: `Processed ${results.expiredCount} expired grace periods, sent ${results.remindersCount} reminders`,
            data: results 
        });
    } catch (error: any) {
        console.error('[AdminJobsRoute] Grace period check failed:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

export default router;
