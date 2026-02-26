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

// ---------------------------------------------------------------------------
// Widget data endpoints (Option A — queries connected ad data sources)
// ---------------------------------------------------------------------------

/**
 * GET /marketing/widget/kpi-scorecard/:projectId
 */
router.get(
    '/widget/kpi-scorecard/:projectId',
    validateJWT,
    validate([
        param('projectId').notEmpty().isInt().toInt(),
        query('startDate').optional().isISO8601(),
        query('endDate').optional().isISO8601(),
        query('metric').optional().isString().trim(),
    ]),
    async (req: Request, res: Response): Promise<void> => {
        try {
            const projectId = parseInt(req.params.projectId, 10);
            const startDate = parseDateParam(req.query.startDate as string, defaultStart());
            const endDate = parseDateParam(req.query.endDate as string, new Date());
            const metric = (req.query.metric as string) || 'spend';
            const data = await marketingReportProcessor.getKpiScorecardWidgetData(projectId, metric, startDate, endDate);
            res.status(200).json({ success: true, data });
        } catch (err: any) {
            console.error('[GET /marketing/widget/kpi-scorecard]', err);
            res.status(500).json({ success: false, error: err.message });
        }
    },
);

/**
 * GET /marketing/widget/budget-gauge/:projectId
 */
router.get(
    '/widget/budget-gauge/:projectId',
    validateJWT,
    validate([
        param('projectId').notEmpty().isInt().toInt(),
        query('campaignId').optional().isInt().toInt(),
        query('startDate').optional().isISO8601(),
        query('endDate').optional().isISO8601(),
    ]),
    async (req: Request, res: Response): Promise<void> => {
        try {
            const projectId = parseInt(req.params.projectId, 10);
            const campaignId = req.query.campaignId ? parseInt(req.query.campaignId as string, 10) : null;
            const startDate = parseDateParam(req.query.startDate as string, defaultStart());
            const endDate = parseDateParam(req.query.endDate as string, new Date());
            const data = await marketingReportProcessor.getBudgetGaugeWidgetData(projectId, campaignId, startDate, endDate);
            res.status(200).json({ success: true, data });
        } catch (err: any) {
            console.error('[GET /marketing/widget/budget-gauge]', err);
            res.status(500).json({ success: false, error: err.message });
        }
    },
);

/**
 * GET /marketing/widget/channel-comparison/:projectId
 */
router.get(
    '/widget/channel-comparison/:projectId',
    validateJWT,
    validate([
        param('projectId').notEmpty().isInt().toInt(),
        query('startDate').optional().isISO8601(),
        query('endDate').optional().isISO8601(),
    ]),
    async (req: Request, res: Response): Promise<void> => {
        try {
            const projectId = parseInt(req.params.projectId, 10);
            const startDate = parseDateParam(req.query.startDate as string, defaultStart());
            const endDate = parseDateParam(req.query.endDate as string, new Date());
            const data = await marketingReportProcessor.getChannelComparisonWidgetData(projectId, startDate, endDate);
            res.status(200).json({ success: true, data });
        } catch (err: any) {
            console.error('[GET /marketing/widget/channel-comparison]', err);
            res.status(500).json({ success: false, error: err.message });
        }
    },
);

/**
 * GET /marketing/widget/journey-sankey/:projectId
 */
router.get(
    '/widget/journey-sankey/:projectId',
    validateJWT,
    validate([
        param('projectId').notEmpty().isInt().toInt(),
        query('startDate').optional().isISO8601(),
        query('endDate').optional().isISO8601(),
        query('maxPaths').optional().isInt({ min: 1, max: 10 }).toInt(),
    ]),
    async (req: Request, res: Response): Promise<void> => {
        try {
            const projectId = parseInt(req.params.projectId, 10);
            const startDate = parseDateParam(req.query.startDate as string, defaultStart());
            const endDate = parseDateParam(req.query.endDate as string, new Date());
            const maxPaths = req.query.maxPaths ? parseInt(req.query.maxPaths as string, 10) : 5;
            const data = await marketingReportProcessor.getJourneySankeyWidgetData(projectId, maxPaths, startDate, endDate);
            res.status(200).json({ success: true, data });
        } catch (err: any) {
            console.error('[GET /marketing/widget/journey-sankey]', err);
            res.status(500).json({ success: false, error: err.message });
        }
    },
);

/**
 * GET /marketing/widget/roi-waterfall/:projectId
 */
router.get(
    '/widget/roi-waterfall/:projectId',
    validateJWT,
    validate([
        param('projectId').notEmpty().isInt().toInt(),
        query('startDate').optional().isISO8601(),
        query('endDate').optional().isISO8601(),
        query('groupBy').optional().isString().trim(),
        query('includeOffline').optional().isBoolean().toBoolean(),
        query('campaignId').optional().isInt().toInt(),
    ]),
    async (req: Request, res: Response): Promise<void> => {
        try {
            const projectId = parseInt(req.params.projectId, 10);
            const startDate = parseDateParam(req.query.startDate as string, defaultStart());
            const endDate = parseDateParam(req.query.endDate as string, new Date());
            const groupBy = (req.query.groupBy as string) || 'channel';
            const includeOffline = req.query.includeOffline === 'true';
            const campaignId = req.query.campaignId ? parseInt(req.query.campaignId as string, 10) : undefined;
            const data = await marketingReportProcessor.getRoiWaterfallWidgetData(projectId, groupBy, includeOffline, startDate, endDate, campaignId);
            res.status(200).json({ success: true, data });
        } catch (err: any) {
            console.error('[GET /marketing/widget/roi-waterfall]', err);
            res.status(500).json({ success: false, error: err.message });
        }
    },
);

/**
 * GET /marketing/widget/campaign-timeline/:projectId
 */
router.get(
    '/widget/campaign-timeline/:projectId',
    validateJWT,
    validate([
        param('projectId').notEmpty().isInt().toInt(),
        query('startDate').optional().isISO8601(),
        query('endDate').optional().isISO8601(),
        query('showOnlyActive').optional().isBoolean().toBoolean(),
    ]),
    async (req: Request, res: Response): Promise<void> => {
        try {
            const projectId = parseInt(req.params.projectId, 10);
            const startDate = parseDateParam(req.query.startDate as string, defaultStart());
            const endDate = parseDateParam(req.query.endDate as string, new Date());
            const showOnlyActive = req.query.showOnlyActive === 'true';
            const data = await marketingReportProcessor.getCampaignTimelineWidgetData(projectId, showOnlyActive, startDate, endDate);
            res.status(200).json({ success: true, data });
        } catch (err: any) {
            console.error('[GET /marketing/widget/campaign-timeline]', err);
            res.status(500).json({ success: false, error: err.message });
        }
    },
);

/**
 * GET /marketing/widget/anomaly-alert/:projectId
 */
router.get(
    '/widget/anomaly-alert/:projectId',
    validateJWT,
    validate([
        param('projectId').notEmpty().isInt().toInt(),
        query('metric').optional().isString().trim(),
        query('thresholdPct').optional().isFloat({ min: 1, max: 100 }).toFloat(),
        query('comparisonWindow').optional().isString().trim(),
        query('alertDirection').optional().isString().trim(),
    ]),
    async (req: Request, res: Response): Promise<void> => {
        try {
            const projectId = parseInt(req.params.projectId, 10);
            const metric = (req.query.metric as string) || 'spend';
            const thresholdPct = req.query.thresholdPct ? parseFloat(req.query.thresholdPct as string) : 20;
            const comparisonWindow = (req.query.comparisonWindow as string) || '4_week_avg';
            const alertDirection = (req.query.alertDirection as string) || 'both';
            const data = await marketingReportProcessor.getAnomalyAlertWidgetData(projectId, metric, thresholdPct, comparisonWindow, alertDirection);
            res.status(200).json({ success: true, data });
        } catch (err: any) {
            console.error('[GET /marketing/widget/anomaly-alert]', err);
            res.status(500).json({ success: false, error: err.message });
        }
    },
);

export default router;
