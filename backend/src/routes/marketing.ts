import express, { Request, Response } from 'express';
import { validateJWT } from '../middleware/authenticate.js';
import { validate } from '../middleware/validator.js';
import { param, query } from 'express-validator';
import { MarketingReportProcessor } from '../processors/MarketingReportProcessor.js';

const router = express.Router();
const marketingReportProcessor = MarketingReportProcessor.getInstance();

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function parseDateParam(value: string | undefined, fallback: Date): Date {
    if (!value) return fallback;
    const d = new Date(value);
    return isNaN(d.getTime()) ? fallback : d;
}

function defaultStart(): Date {
    const d = new Date();
    d.setDate(d.getDate() - 30);
    return d;
}

// ---------------------------------------------------------------------------
// Routes
// ---------------------------------------------------------------------------

/**
 * GET /marketing/hub/:projectId
 * Returns full IMarketingHubSummary for the dashboard.
 * Query params: startDate, endDate, campaignId (optional)
 */
router.get(
    '/hub/:projectId',
    validateJWT,
    validate([
        param('projectId').notEmpty().isInt().withMessage('projectId must be an integer').toInt(),
        query('startDate').optional().isISO8601(),
        query('endDate').optional().isISO8601(),
        query('campaignId').optional().isInt().toInt(),
    ]),
    async (req: Request, res: Response): Promise<void> => {
        try {
            const projectId = parseInt(req.params.projectId, 10);
            const startDate = parseDateParam(req.query.startDate as string, defaultStart());
            const endDate = parseDateParam(req.query.endDate as string, new Date());
            const campaignId = req.query.campaignId ? parseInt(req.query.campaignId as string, 10) : undefined;

            const summary = await marketingReportProcessor.getMarketingHubSummary(
                projectId,
                startDate,
                endDate,
                campaignId,
            );

            res.status(200).json({ success: true, data: summary });
        } catch (err: any) {
            console.error('[GET /marketing/hub/:projectId]', err);
            res.status(500).json({ success: false, error: err.message });
        }
    },
);

/**
 * GET /marketing/top-campaigns/:projectId
 * Returns top N campaigns by spend.
 * Query params: startDate, endDate, limit (optional, default 5)
 */
router.get(
    '/top-campaigns/:projectId',
    validateJWT,
    validate([
        param('projectId').notEmpty().isInt().withMessage('projectId must be an integer').toInt(),
        query('startDate').optional().isISO8601(),
        query('endDate').optional().isISO8601(),
        query('limit').optional().isInt({ min: 1, max: 20 }).toInt(),
    ]),
    async (req: Request, res: Response): Promise<void> => {
        try {
            const projectId = parseInt(req.params.projectId, 10);
            const startDate = parseDateParam(req.query.startDate as string, defaultStart());
            const endDate = parseDateParam(req.query.endDate as string, new Date());
            const limit = req.query.limit ? parseInt(req.query.limit as string, 10) : 5;

            const campaigns = await marketingReportProcessor.getTopCampaigns(
                projectId,
                startDate,
                endDate,
                limit,
            );

            res.status(200).json({ success: true, data: campaigns });
        } catch (err: any) {
            console.error('[GET /marketing/top-campaigns/:projectId]', err);
            res.status(500).json({ success: false, error: err.message });
        }
    },
);

/**
 * GET /marketing/digital-spend/:campaignId
 * Returns total digital spend for a campaign (used by Budget vs Digital chart).
 * Query params: startDate, endDate
 */
router.get(
    '/digital-spend/:campaignId',
    validateJWT,
    validate([
        param('campaignId').notEmpty().isInt().withMessage('campaignId must be an integer').toInt(),
        query('startDate').optional().isISO8601(),
        query('endDate').optional().isISO8601(),
    ]),
    async (req: Request, res: Response): Promise<void> => {
        try {
            const campaignId = parseInt(req.params.campaignId, 10);
            const startDate = parseDateParam(req.query.startDate as string, defaultStart());
            const endDate = parseDateParam(req.query.endDate as string, new Date());

            const digitalSpend = await marketingReportProcessor.getDigitalSpendForCampaign(
                campaignId,
                startDate,
                endDate,
            );

            res.status(200).json({ success: true, data: { digitalSpend } });
        } catch (err: any) {
            console.error('[GET /marketing/digital-spend/:campaignId]', err);
            res.status(500).json({ success: false, error: err.message });
        }
    },
);

export default router;
