import express, { Request, Response } from 'express';
import { validateJWT } from '../../middleware/authenticate.js';
import { EUserType } from '../../types/EUserType.js';
import { runExpiredSubscriptionCheckNow } from '../../jobs/expiredSubscriptionDowngradeJob.js';
import { runGracePeriodCheckNow } from '../../jobs/subscriptionGracePeriodJob.js';
import { runCreditRolloverNow } from '../../jobs/creditRolloverJob.js';
import { expireInvitationsNow } from '../../jobs/expireInvitations.js';
import { runDataModelHealthReanalysis } from '../../jobs/reanalyzeDataModelHealth.js';
import { runWebhookCleanupNow } from '../../jobs/cleanupWebhookEventsJob.js';
import { runPaymentMethodExpiryCheckNow } from '../../jobs/paymentMethodExpiryJob.js';
import { getCronRuntimeStatus, recordManualRun } from '../../jobs/cronRegistry.js';

const router = express.Router();

async function requireAdmin(req: any, res: any, next: any) {
    const tokenDetails = req.tokenDetails || req.body.tokenDetails;
    if (!tokenDetails || tokenDetails.user_type !== EUserType.ADMIN) {
        return res.status(403).json({ success: false, message: 'Admin access required' });
    }
    next();
}

/**
 * Registry of every scheduled cron job. Mirrors the schedules started in
 * backend/src/index.ts. Jobs expose a manual `run` so admins can trigger them
 * immediately (idempotent where documented).
 */
interface JobDefinition {
    key: string;
    name: string;
    description: string;
    cron: string;
    schedule: string;
    run: () => Promise<Record<string, number>>;
}

const jobs: JobDefinition[] = [
    {
        key: 'credit-rollover',
        name: 'Monthly credit grant / rollover',
        description:
            'Grants each org its monthly credit allowance (idempotent per UTC month); expires unused Free monthly credits and rolls over Pro credits. Skipped when CREDITS_ENABLED=false.',
        cron: '15 0 * * *',
        schedule: 'Daily at 00:15 UTC',
        run: runCreditRolloverNow,
    },
    {
        key: 'expired-subscriptions',
        name: 'Expired subscription downgrade',
        description:
            'Finds subscriptions with cancelled_at set where ends_at has passed and downgrades them to the FREE tier. Keeps downgrades close to the billing-period end required by the cancellation policy.',
        cron: '5 * * * *',
        schedule: 'Hourly at :05 UTC',
        run: runExpiredSubscriptionCheckNow,
    },
    {
        key: 'grace-periods',
        name: 'Grace period expiry & reminders',
        description:
            'Downgrades subscriptions whose grace period has expired to FREE and sends 7/3/1-day payment reminder emails with a billing portal link.',
        cron: '0 2 * * *',
        schedule: 'Daily at 02:00 UTC',
        run: runGracePeriodCheckNow,
    },
    {
        key: 'payment-method-expiry',
        name: 'Payment method expiry alerts',
        description:
            'Emails owners of active paid subscriptions whose card expires in the following calendar month to reduce involuntary churn from expired cards.',
        cron: '0 9 1 * *',
        schedule: '1st of month at 09:00 UTC',
        run: runPaymentMethodExpiryCheckNow,
    },
    {
        key: 'webhook-cleanup',
        name: 'Webhook event retention cleanup',
        description:
            'Hard-deletes processed Paddle webhook events older than 90 days (GDPR Art. 17 storage limitation). Events with errors are retained for review.',
        cron: '0 3 * * 0',
        schedule: 'Weekly (Sunday) at 03:00 UTC',
        run: runWebhookCleanupNow,
    },
    {
        key: 'invitation-expiration',
        name: 'Invitation expiration',
        description:
            'Marks project invitations older than 7 days as expired.',
        cron: '0 * * * *',
        schedule: 'Hourly at :00',
        run: expireInvitationsNow,
    },
    {
        key: 'data-model-health',
        name: 'Data model health re-analysis',
        description:
            'Re-runs health analysis across every data model so persisted health_status/health_issues stay accurate. Disabled when HEALTH_REANALYSIS_ENABLED=false.',
        cron: '0 2 * * *',
        schedule: 'Daily at 02:00 UTC',
        run: runDataModelHealthReanalysis,
    },
];

function findJob(key: string): JobDefinition | undefined {
    return jobs.find((j) => j.key === key);
}

/**
 * GET /admin/jobs
 * Lists all scheduled jobs with their schedule and runtime status (scheduled,
 * running, disabled, …), plus last-run timestamps where known.
 */
router.get('/', validateJWT, requireAdmin, async (req: Request, res: Response) => {
    const data = [];
    for (const { key, name, description, cron, schedule } of jobs) {
        const runtime = await getCronRuntimeStatus(key);
        data.push({
            key,
            name,
            description,
            cron,
            schedule,
            runnable: true,
            runtime: runtime ?? { enabled: false, status: 'not-registered', nextRunAt: null, lastStartedAt: null, lastFinishedAt: null, lastFailedAt: null, lastManualRunAt: null, lastManualResult: null },
        });
    }
    res.json({ success: true, data });
});

/**
 * POST /admin/jobs/run/:key
 * Manually trigger a scheduled job by key. All jobs are safe to run repeatedly.
 */
router.post('/run/:key', validateJWT, requireAdmin, async (req: Request, res: Response) => {
    const job = findJob(req.params.key);
    if (!job) {
        return res.status(404).json({ success: false, error: `Unknown job key: ${req.params.key}` });
    }
    try {
        console.log(`[AdminJobsRoute] Manual trigger of job "${job.key}" by admin`);
        const results = await job.run();
        const message = summarize(job.key, results);
        recordManualRun(job.key, message);
        res.json({ success: true, message, data: results });
    } catch (error: any) {
        console.error(`[AdminJobsRoute] Job "${job.key}" failed:`, error);
        res.status(500).json({ success: false, error: error.message });
    }
});

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

function summarize(key: string, data: Record<string, number>): string {
    switch (key) {
        case 'credit-rollover':
            return `Granted ${data.granted ?? 0} orgs, ${data.failed ?? 0} failed`;
        case 'expired-subscriptions':
            return `Processed ${data.downgradedCount ?? 0} expired subscriptions`;
        case 'grace-periods':
            return `Processed ${data.expiredCount ?? 0} expired grace periods, sent ${data.remindersCount ?? 0} reminders`;
        case 'payment-method-expiry':
            return `Sent ${data.alertCount ?? 0} payment method expiry alerts`;
        case 'webhook-cleanup':
            return `Deleted ${data.deletedCount ?? 0} processed webhook events`;
        case 'invitation-expiration':
            return `Expired ${data.expiredCount ?? 0} invitations`;
        case 'data-model-health':
            return `Re-analyzed ${data.updated ?? 0}/${data.total ?? 0} data models, ${data.failed ?? 0} failed`;
        default:
            return 'Job completed';
    }
}

export default router;
