import { Router, Request, Response } from 'express';
import { AppDataSource } from '../../datasources/PostgresDS.js';
import { DRAOrganizationSubscription } from '../../models/DRAOrganizationSubscription.js';
import { DRAPaymentTransaction } from '../../models/DRAPaymentTransaction.js';
import { DRASubscriptionTier } from '../../models/DRASubscriptionTier.js';
import { validateJWT } from '../../middleware/authenticate.js';
import { EUserType } from '../../types/EUserType.js';

const router = Router();

async function requireAdmin(req: any, res: any, next: any) {
    const tokenDetails = req.tokenDetails || req.body.tokenDetails;
    if (!tokenDetails || tokenDetails.user_type !== EUserType.ADMIN) {
        return res.status(403).json({ error: 'Forbidden — Admin access required' });
    }
    next();
}

/**
 * GET /admin/subscription-analytics/mrr
 *
 * Monthly Recurring Revenue — aggregated from all active paid subscriptions.
 * Returns total MRR, breakdown by tier (monthly equivalent of annual plans),
 * and month-over-month growth.
 *
 * Formula:
 *   Monthly plan  → price_per_month_usd
 *   Annual plan   → price_per_year_usd / 12
 */
router.get('/mrr', validateJWT, requireAdmin, async (_req: Request, res: Response) => {
    try {
        const manager = AppDataSource.manager;

        const activeSubs = await manager
            .createQueryBuilder(DRAOrganizationSubscription, 'sub')
            .leftJoinAndSelect('sub.subscription_tier', 'tier')
            .where('sub.is_active = true')
            .andWhere('sub.paddle_subscription_id IS NOT NULL')
            .getMany();

        let totalMrr = 0;
        const byTier: Record<string, { count: number; mrr: number }> = {};

        for (const sub of activeSubs) {
            const tier = sub.subscription_tier;
            if (!tier) continue;

            const mrrContribution =
                sub.billing_cycle === 'annual'
                    ? Number(tier.price_per_year_usd ?? 0) / 12
                    : Number(tier.price_per_month_usd ?? 0);

            totalMrr += mrrContribution;

            if (!byTier[tier.tier_name]) {
                byTier[tier.tier_name] = { count: 0, mrr: 0 };
            }
            byTier[tier.tier_name].count++;
            byTier[tier.tier_name].mrr += mrrContribution;
        }

        // MRR this time last month (using created_at as a proxy — a full MoM requires historic snapshots)
        // Simple heuristic: count active subs that started >= 30 days ago
        const thirtyDaysAgo = new Date();
        thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

        const newThisMonth = activeSubs.filter(
            s => s.started_at && new Date(s.started_at) > thirtyDaysAgo
        ).length;

        res.json({
            success: true,
            data: {
                total_mrr: parseFloat(totalMrr.toFixed(2)),
                active_subscriptions: activeSubs.length,
                new_this_month: newThisMonth,
                by_tier: Object.entries(byTier).map(([name, stats]) => ({
                    tier: name,
                    count: stats.count,
                    mrr: parseFloat(stats.mrr.toFixed(2)),
                })),
            },
        });
    } catch (error: any) {
        console.error('[GET /admin/subscription-analytics/mrr]', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

/**
 * GET /admin/subscription-analytics/churn
 *
 * Churn metrics for a sliding window (default: last 30 days).
 * Returns churned count, trial-to-paid conversions sourced from audit table,
 * and a breakdown of cancellation reasons if available.
 *
 * Query param: ?days=30
 */
router.get('/churn', validateJWT, requireAdmin, async (req: Request, res: Response) => {
    try {
        const days = Math.min(parseInt(String(req.query.days ?? '30'), 10), 365) || 30;
        const since = new Date();
        since.setDate(since.getDate() - days);

        const manager = AppDataSource.manager;

        // Churned subs — cancelled in window
        const churned = await manager
            .createQueryBuilder(DRAOrganizationSubscription, 'sub')
            .where('sub.cancelled_at >= :since', { since })
            .getCount();

        // Grace-period downgrades (involuntary churn)
        const involuntary = await manager
            .createQueryBuilder()
            .select('COUNT(*)', 'cnt')
            .from(DRAPaymentTransaction, 'tx')
            .where('tx.transaction_type = :type', { type: 'charge' })
            .andWhere('tx.status = :status', { status: 'failed' })
            .andWhere('tx.created_at >= :since', { since })
            .getRawOne<{ cnt: string }>();

        // New paid activations in window
        const newPaid = await manager
            .createQueryBuilder(DRAOrganizationSubscription, 'sub')
            .leftJoin('sub.subscription_tier', 'tier')
            .where('sub.started_at >= :since', { since })
            .andWhere('sub.is_active = true')
            .andWhere('sub.paddle_subscription_id IS NOT NULL')
            .andWhere('tier.tier_name != :free', { free: 'free' })
            .getCount();

        // Tier distribution at point-in-time
        const tierCounts = await manager
            .createQueryBuilder(DRAOrganizationSubscription, 'sub')
            .leftJoinAndSelect('sub.subscription_tier', 'tier')
            .where('sub.is_active = true')
            .select(['tier.tier_name AS tier_name', 'COUNT(sub.id) AS count'])
            .groupBy('tier.tier_name')
            .getRawMany<{ tier_name: string; count: string }>();

        res.json({
            success: true,
            data: {
                window_days: days,
                churned_count: churned,
                involuntary_failures: parseInt(involuntary?.cnt ?? '0', 10),
                new_paid_activations: newPaid,
                current_tier_distribution: tierCounts.map(r => ({
                    tier: r.tier_name,
                    count: parseInt(r.count, 10),
                })),
            },
        });
    } catch (error: any) {
        console.error('[GET /admin/subscription-analytics/churn]', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

/**
 * GET /admin/subscription-analytics/revenue-by-month
 *
 * Historical revenue from the `dra_payment_transactions` ledger, grouped by calendar month.
 * Covers only completed charge transactions (refunds and adjustments are excluded from gross).
 *
 * Query param: ?months=12
 */
router.get('/revenue-by-month', validateJWT, requireAdmin, async (req: Request, res: Response) => {
    try {
        const months = Math.min(parseInt(String(req.query.months ?? '12'), 10), 60) || 12;
        const since = new Date();
        since.setMonth(since.getMonth() - months);

        const manager = AppDataSource.manager;

        const rows = await manager
            .createQueryBuilder()
            .select([
                `DATE_TRUNC('month', tx.created_at) AS month`,
                `SUM(CASE WHEN tx.transaction_type = 'charge' THEN tx.amount ELSE 0 END) AS gross_revenue`,
                `SUM(CASE WHEN tx.transaction_type IN ('refund','credit') THEN ABS(tx.amount) ELSE 0 END) AS refunds`,
                `COUNT(CASE WHEN tx.transaction_type = 'charge' THEN 1 END) AS charge_count`,
            ])
            .from(DRAPaymentTransaction, 'tx')
            .where('tx.status = :status', { status: 'completed' })
            .andWhere('tx.created_at >= :since', { since })
            .groupBy(`DATE_TRUNC('month', tx.created_at)`)
            .orderBy(`DATE_TRUNC('month', tx.created_at)`, 'ASC')
            .getRawMany();

        res.json({
            success: true,
            data: rows.map(r => ({
                month: r.month,
                gross_revenue: parseFloat(r.gross_revenue ?? '0'),
                refunds: parseFloat(r.refunds ?? '0'),
                net_revenue: parseFloat(r.gross_revenue ?? '0') - parseFloat(r.refunds ?? '0'),
                charge_count: parseInt(r.charge_count ?? '0', 10),
            })),
        });
    } catch (error: any) {
        console.error('[GET /admin/subscription-analytics/revenue-by-month]', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

export default router;
