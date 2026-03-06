import { Router, Request, Response } from 'express';
import { validateJWT } from '../../middleware/authenticate.js';
import { EUserType } from '../../types/EUserType.js';
import { AdminStatsProcessor } from '../../processors/AdminStatsProcessor.js';

const router = Router();
const processor = AdminStatsProcessor.getInstance();

async function requireAdmin(req: any, res: any, next: any) {
    const tokenDetails = req.tokenDetails || req.body.tokenDetails;
    if (!tokenDetails || tokenDetails.user_type !== EUserType.ADMIN) {
        return res.status(403).json({ success: false, message: 'Admin access required' });
    }
    next();
}

/**
 * GET /admin/stats/overview
 * Returns platform-wide aggregate counts for the admin dashboard.
 */
router.get('/overview', validateJWT, requireAdmin, async (req: Request, res: Response) => {
    try {
        const data = await processor.getOverviewStats();
        res.json({ success: true, data });
    } catch (error: any) {
        console.error('[AdminStats] Error fetching overview:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

/**
 * GET /admin/stats/timeseries?metric=signups&days=30
 * Returns daily counts for the given metric over the last N days.
 * Valid metrics: signups | projects | data_sources | ai_messages | ai_conversations | cancellations
 */
router.get('/timeseries', validateJWT, requireAdmin, async (req: Request, res: Response) => {
    try {
        const metric = String(req.query.metric || 'signups');
        const days = parseInt(String(req.query.days || '30'), 10);
        const data = await processor.getTimeSeriesData(metric, days);
        res.json({ success: true, data });
    } catch (error: any) {
        console.error('[AdminStats] Error fetching timeseries:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

/**
 * GET /admin/stats/sync-health
 * Returns per-data-source sync status rows.
 */
router.get('/sync-health', validateJWT, requireAdmin, async (req: Request, res: Response) => {
    try {
        const data = await processor.getSyncHealthData();
        res.json({ success: true, data });
    } catch (error: any) {
        console.error('[AdminStats] Error fetching sync health:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

/**
 * GET /admin/stats/system-health
 * Returns DB, Redis, and backup scheduler health probes.
 */
router.get('/system-health', validateJWT, requireAdmin, async (req: Request, res: Response) => {
    try {
        const data = await processor.getSystemHealth();
        res.json({ success: true, data });
    } catch (error: any) {
        console.error('[AdminStats] Error fetching system health:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

/**
 * GET /admin/stats/datasource-types
 * Returns data source type breakdown for donut chart.
 */
router.get('/datasource-types', validateJWT, requireAdmin, async (req: Request, res: Response) => {
    try {
        const data = await processor.getDataSourceTypeBreakdown();
        res.json({ success: true, data });
    } catch (error: any) {
        console.error('[AdminStats] Error fetching datasource types:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

export default router;
