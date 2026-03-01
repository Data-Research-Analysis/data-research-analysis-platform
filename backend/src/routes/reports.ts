import { Router, Request, Response } from 'express';
import { validateJWT } from '../middleware/authenticate.js';
import { requiresProjectRole } from '../middleware/requiresProjectRole.js';
import { ReportProcessor } from '../processors/ReportProcessor.js';

const router = Router();
const processor = ReportProcessor.getInstance();

// ─── Helpers ────────────────────────────────────────────────────────────────

function projectId(req: Request): number {
    // Prefer query param (GET list), then body (POST/PATCH)
    const raw = (req.query.projectId ?? req.body.projectId) as string | undefined;
    return parseInt(raw ?? '0', 10);
}

function userId(req: Request): number {
    return (req as any).body?.tokenDetails?.user_id ?? 0;
}

function reportId(req: Request): number {
    return parseInt(req.params.id, 10);
}

// ─── Public endpoint (no auth required) ─────────────────────────────────────

/**
 * GET /reports/public/:key
 * Returns the full report for an unexpired public share key.
 */
router.get('/public/:key', async (req: Request, res: Response) => {
    try {
        const report = await processor.getReportByKey(req.params.key);
        if (!report) {
            return res.status(404).json({ success: false, error: 'Report not found or link has expired.' });
        }
        res.json({ success: true, report });
    } catch (error: any) {
        res.status(500).json({ success: false, error: error.message });
    }
});

// ─── Authenticated endpoints ─────────────────────────────────────────────────

/**
 * GET /reports?projectId=123
 * All roles may list reports.
 */
router.get(
    '/',
    validateJWT,
    requiresProjectRole(['analyst', 'manager', 'cmo']),
    async (req: Request, res: Response) => {
        try {
            const pid = projectId(req);
            if (!pid) return res.status(400).json({ success: false, error: 'projectId is required.' });
            const reports = await processor.getReports(pid);
            res.json({ success: true, reports });
        } catch (error: any) {
            res.status(500).json({ success: false, error: error.message });
        }
    },
);

/**
 * GET /reports/:id?projectId=123
 * All roles may view an individual report.
 */
router.get(
    '/:id',
    validateJWT,
    requiresProjectRole(['analyst', 'manager', 'cmo']),
    async (req: Request, res: Response) => {
        try {
            const report = await processor.getReport(reportId(req));
            if (!report) return res.status(404).json({ success: false, error: 'Report not found.' });
            res.json({ success: true, report });
        } catch (error: any) {
            res.status(500).json({ success: false, error: error.message });
        }
    },
);

/**
 * POST /reports
 * Create a new draft report (analyst only).
 * Body: { projectId, name, description? }
 */
router.post(
    '/',
    validateJWT,
    requiresProjectRole(['analyst']),
    async (req: Request, res: Response) => {
        try {
            const { name, description } = req.body;
            const pid = projectId(req);
            if (!pid) return res.status(400).json({ success: false, error: 'projectId is required.' });
            if (!name?.trim()) return res.status(400).json({ success: false, error: 'name is required.' });
            const report = await processor.createReport(pid, userId(req), name, description);
            res.json({ success: true, report });
        } catch (error: any) {
            res.status(500).json({ success: false, error: error.message });
        }
    },
);

/**
 * PATCH /reports/:id
 * Update report name/description/status (analyst + manager).
 * Body: { projectId, name?, description?, status? }
 */
router.patch(
    '/:id',
    validateJWT,
    requiresProjectRole(['analyst', 'manager']),
    async (req: Request, res: Response) => {
        try {
            const { name, description, status } = req.body;
            await processor.updateReport(reportId(req), { name, description, status });
            res.json({ success: true });
        } catch (error: any) {
            res.status(500).json({ success: false, error: error.message });
        }
    },
);

/**
 * DELETE /reports/:id
 * Delete report (analyst only).
 * Body: { projectId }
 */
router.delete(
    '/:id',
    validateJWT,
    requiresProjectRole(['analyst']),
    async (req: Request, res: Response) => {
        try {
            await processor.deleteReport(reportId(req));
            res.json({ success: true });
        } catch (error: any) {
            res.status(500).json({ success: false, error: error.message });
        }
    },
);

/**
 * PUT /reports/:id/items
 * Replace the full item list (analyst + manager).
 * Body: { projectId, items: IReportItemDTO[] }
 */
router.put(
    '/:id/items',
    validateJWT,
    requiresProjectRole(['analyst', 'manager']),
    async (req: Request, res: Response) => {
        try {
            const { items } = req.body;
            if (!Array.isArray(items)) return res.status(400).json({ success: false, error: 'items must be an array.' });
            await processor.updateItems(reportId(req), items);
            res.json({ success: true });
        } catch (error: any) {
            res.status(500).json({ success: false, error: error.message });
        }
    },
);

/**
 * POST /reports/:id/publish
 * Publish a report (analyst + manager).
 * Body: { projectId }
 */
router.post(
    '/:id/publish',
    validateJWT,
    requiresProjectRole(['analyst', 'manager']),
    async (req: Request, res: Response) => {
        try {
            await processor.publishReport(reportId(req));
            res.json({ success: true });
        } catch (error: any) {
            res.status(500).json({ success: false, error: error.message });
        }
    },
);

/**
 * POST /reports/:id/share
 * Generate / replace a share key (analyst + manager).
 * Body: { projectId, expiryHours? }   defaults to 168 (7 days)
 */
router.post(
    '/:id/share',
    validateJWT,
    requiresProjectRole(['analyst', 'manager']),
    async (req: Request, res: Response) => {
        try {
            const expiryHours = parseInt(req.body.expiryHours ?? '168', 10);
            const result = await processor.generateShareKey(reportId(req), userId(req), expiryHours);
            res.json({ success: true, key: result.key, expiresAt: result.expiresAt });
        } catch (error: any) {
            res.status(500).json({ success: false, error: error.message });
        }
    },
);

/**
 * DELETE /reports/:id/share
 * Revoke the share key (analyst + manager).
 * Body: { projectId }
 */
router.delete(
    '/:id/share',
    validateJWT,
    requiresProjectRole(['analyst', 'manager']),
    async (req: Request, res: Response) => {
        try {
            await processor.revokeShareKey(reportId(req));
            res.json({ success: true });
        } catch (error: any) {
            res.status(500).json({ success: false, error: error.message });
        }
    },
);

export default router;
