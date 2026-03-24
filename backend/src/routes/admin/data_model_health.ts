import { Router, Request, Response } from 'express';
import { validateJWT } from '../../middleware/authenticate.js';
import { EUserType } from '../../types/EUserType.js';

const router = Router();

async function requireAdmin(req: any, res: any, next: any) {
    const tokenDetails = req.tokenDetails || req.body.tokenDetails;
    if (!tokenDetails || tokenDetails.user_type !== EUserType.ADMIN) {
        return res.status(403).json({ success: false, message: 'Admin access required' });
    }
    next();
}
/**
 * GET /admin/data-model-health/summary
 * Returns platform-wide health summary: counts per status + top blocked/warning models.
 */
router.get('/summary', validateJWT, requireAdmin, async (_req: Request, res: Response) => {
    try {
        const { AppDataSource } = await import('../../datasources/PostgresDS.js');
        const manager = AppDataSource.manager;

        // Aggregate counts per health_status
        const counts: { health_status: string; count: string }[] = await manager.query(
            `SELECT health_status, COUNT(*) AS count
             FROM dra_data_models
             GROUP BY health_status`
        );

        const summary = { healthy: 0, warning: 0, blocked: 0, unknown: 0 };
        for (const row of counts) {
            const key = row.health_status as keyof typeof summary;
            if (key in summary) summary[key] = parseInt(row.count, 10);
        }

        // Fetch blocked and warning models with project info via a JOIN
        const problemModels: any[] = await manager.query(
            `SELECT
                dm.id,
                dm.name,
                dm.health_status,
                dm.model_type,
                dm.row_count,
                dm.source_row_count,
                dm.health_issues,
                dm.created_at,
                p.id   AS project_id,
                p.name AS project_name,
                up.email AS owner_email
             FROM dra_data_models dm
             LEFT JOIN dra_data_sources ds ON ds.id = dm.data_source_id
             LEFT JOIN dra_projects p ON p.id = ds.project_id
             LEFT JOIN dra_users_platform up ON up.id = dm.users_platform_id
             WHERE dm.health_status IN ('blocked', 'warning')
             ORDER BY
                CASE dm.health_status WHEN 'blocked' THEN 0 ELSE 1 END,
                dm.source_row_count DESC NULLS LAST
             LIMIT 100`
        );

        res.json({ success: true, summary, problemModels });
    } catch (error: any) {
        console.error('[AdminDataModelHealth] Error fetching summary:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

/**
 * POST /admin/data-model-health/reanalyze
 * Triggers a full platform-wide health re-analysis immediately (admin only).
 * Runs the same logic as the nightly cron job.
 */
router.post('/reanalyze', validateJWT, requireAdmin, async (_req: Request, res: Response) => {
    try {
        const { runDataModelHealthReanalysis } = await import('../../jobs/reanalyzeDataModelHealth.js');
        // Fire-and-forget — respond immediately so the HTTP request doesn't time out
        runDataModelHealthReanalysis().catch((err: any) =>
            console.error('[AdminDataModelHealth] Manual re-analysis failed:', err)
        );
        res.json({ success: true, message: 'Health re-analysis started in the background.' });
    } catch (error: any) {
        console.error('[AdminDataModelHealth] Error starting re-analysis:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

export default router;
