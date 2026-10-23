import { Router, Request, Response } from 'express';
import { AppDataSource } from '../../datasources/PostgresDS.js';
import { DRAAICallLog } from '../../models/DRAAICallLog.js';
import { AICallTrackerService, AI_FEATURE_KEYS } from '../../services/AICallTrackerService.js';
import { validateJWT } from '../../middleware/authenticate.js';
import { EUserType } from '../../types/EUserType.js';

const router = Router();
const tracker = AICallTrackerService.getInstance();

async function requireAdmin(req: any, res: any, next: any) {
    const tokenDetails = req.tokenDetails || req.body.tokenDetails;
    if (!tokenDetails || tokenDetails.user_type !== EUserType.ADMIN) {
        return res.status(403).json({ error: 'Forbidden — Admin access required' });
    }
    next();
}

function monthBounds(raw: string | undefined): { start: Date; end: Date } {
    const now = new Date();
    let start: Date;
    if (raw && /^\d{4}-\d{2}$/.test(raw)) {
        const [y, m] = raw.split('-').map((n) => parseInt(n, 10));
        start = new Date(Date.UTC(y, m - 1, 1));
    } else {
        start = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
    }
    const end = new Date(start);
    end.setUTCMonth(end.getUTCMonth() + 1);
    return { start, end };
}

/**
 * GET /admin/ai-usage/org/:orgId?month=YYYY-MM
 * Monthly AI cost rollup per feature for one organization.
 */
router.get('/org/:orgId', validateJWT, requireAdmin, async (req: Request, res: Response) => {
    try {
        const orgId = parseInt(req.params.orgId, 10);
        if (!orgId) {
            res.status(400).json({ success: false, error: 'orgId is required' });
            return;
        }
        const { start, end } = monthBounds(String(req.query.month ?? ''));
        const byFeature = await tracker.getMonthlyOrgRollup(orgId, start, end);
        const total = await tracker.getMonthlyOrgCost(orgId, start, end);

        res.json({
            success: true,
            data: {
                org_id: orgId,
                month: start.toISOString().slice(0, 7),
                total_cost_usd: total,
                by_feature: byFeature,
            },
        });
    } catch (error: any) {
        console.error('[GET /admin/ai-usage/org/:orgId]', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

/**
 * GET /admin/ai-usage/user/:userId?month=YYYY-MM
 * Monthly AI cost rollup per feature for one user.
 */
router.get('/user/:userId', validateJWT, requireAdmin, async (req: Request, res: Response) => {
    try {
        const userId = parseInt(req.params.userId, 10);
        if (!userId) {
            res.status(400).json({ success: false, error: 'userId is required' });
            return;
        }
        const { start, end } = monthBounds(String(req.query.month ?? ''));
        const byFeature = await tracker.getMonthlyUserRollup(userId, start, end);

        res.json({
            success: true,
            data: {
                user_id: userId,
                month: start.toISOString().slice(0, 7),
                by_feature: byFeature,
            },
        });
    } catch (error: any) {
        console.error('[GET /admin/ai-usage/user/:userId]', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

/**
 * GET /admin/ai-usage/actions/:orgId?month=YYYY-MM&feature=plan_build&limit=20
 * Per-action cost for one org+feature (which plan/conversation is expensive).
 */
router.get('/actions/:orgId', validateJWT, requireAdmin, async (req: Request, res: Response) => {
    try {
        const orgId = parseInt(req.params.orgId, 10);
        const feature = String(req.query.feature ?? AI_FEATURE_KEYS.PLAN_BUILD) as any;
        const limit = Math.min(parseInt(String(req.query.limit ?? '20'), 10), 100);
        if (!orgId) {
            res.status(400).json({ success: false, error: 'orgId is required' });
            return;
        }
        const { start, end } = monthBounds(String(req.query.month ?? ''));
        const actions = await tracker.getActionCosts(orgId, feature, start, end, limit);

        res.json({
            success: true,
            data: {
                org_id: orgId,
                feature,
                month: start.toISOString().slice(0, 7),
                actions,
            },
        });
    } catch (error: any) {
        console.error('[GET /admin/ai-usage/actions/:orgId]', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

/**
 * GET /admin/ai-usage/overview?month=YYYY-MM
 * Platform-wide AI cost: total, per feature, per model, and recent top orgs.
 */
router.get('/overview', validateJWT, requireAdmin, async (req: Request, res: Response) => {
    try {
        const { start, end } = monthBounds(String(req.query.month ?? ''));
        const manager = AppDataSource.manager;

        const totalRow = await manager
            .createQueryBuilder(DRAAICallLog, 'log')
            .select('COALESCE(SUM(log.cost_usd), 0)', 'total')
            .addSelect('COUNT(*)', 'calls')
            .where('log.created_at >= :start', { start })
            .andWhere('log.created_at < :end', { end })
            .getRawOne();

        const byFeature = await manager
            .createQueryBuilder(DRAAICallLog, 'log')
            .select('log.feature_key', 'feature_key')
            .addSelect('COUNT(*)', 'call_count')
            .addSelect('SUM(log.cost_usd)', 'cost_usd')
            .where('log.created_at >= :start', { start })
            .andWhere('log.created_at < :end', { end })
            .groupBy('log.feature_key')
            .orderBy('SUM(log.cost_usd)', 'DESC')
            .getRawMany();

        const byModel = await manager
            .createQueryBuilder(DRAAICallLog, 'log')
            .select('log.model_id', 'model_id')
            .addSelect('COUNT(*)', 'call_count')
            .addSelect('SUM(log.cost_usd)', 'cost_usd')
            .where('log.created_at >= :start', { start })
            .andWhere('log.created_at < :end', { end })
            .groupBy('log.model_id')
            .orderBy('SUM(log.cost_usd)', 'DESC')
            .getRawMany();

        const topOrgs = await manager
            .createQueryBuilder(DRAAICallLog, 'log')
            .select('log.org_id', 'org_id')
            .addSelect('COUNT(*)', 'call_count')
            .addSelect('SUM(log.cost_usd)', 'cost_usd')
            .where('log.org_id IS NOT NULL')
            .andWhere('log.created_at >= :start', { start })
            .andWhere('log.created_at < :end', { end })
            .groupBy('log.org_id')
            .orderBy('SUM(log.cost_usd)', 'DESC')
            .limit(20)
            .getRawMany();

        res.json({
            success: true,
            data: {
                month: start.toISOString().slice(0, 7),
                total_cost_usd: Number(totalRow?.total ?? 0),
                total_calls: parseInt(totalRow?.calls ?? '0', 10),
                by_feature: byFeature.map((r) => ({
                    feature_key: r.feature_key,
                    call_count: parseInt(r.call_count, 10),
                    cost_usd: Number(r.cost_usd ?? 0),
                })),
                by_model: byModel.map((r) => ({
                    model_id: r.model_id,
                    call_count: parseInt(r.call_count, 10),
                    cost_usd: Number(r.cost_usd ?? 0),
                })),
                top_orgs: topOrgs.map((r) => ({
                    org_id: r.org_id,
                    call_count: parseInt(r.call_count, 10),
                    cost_usd: Number(r.cost_usd ?? 0),
                })),
            },
        });
    } catch (error: any) {
        console.error('[GET /admin/ai-usage/overview]', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

export default router;
