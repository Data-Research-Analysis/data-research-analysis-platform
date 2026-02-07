import express, { Request, Response } from 'express';
import { AttributionProcessor } from '../processors/AttributionProcessor.js';
import { validateJWT } from '../middleware/authenticate.js';
import { expensiveOperationsLimiter } from '../middleware/rateLimit.js';
import {
    IAttributionEvent,
    AttributionModel,
    IFunnelAnalysisRequest,
    IJourneyMapRequest
} from '../interfaces/IAttribution.js';

const router = express.Router();
const attributionProcessor = AttributionProcessor.getInstance();

/**
 * Track an event (pageview, interaction, conversion)
 * POST /attribution/track
 */
router.post('/attribution/track', validateJWT, async (req: Request, res: Response): Promise<void> => {
    try {
        const {
            projectId,
            userIdentifier,
            eventType,
            eventName,
            eventValue,
            eventTimestamp,
            pageUrl,
            referrer,
            userAgent,
            ipAddress,
            utmParams,
            customData
        } = req.body;

        if (!projectId || !userIdentifier || !eventType) {
            res.status(400).json({
                success: false,
                error: 'Missing required fields: projectId, userIdentifier, eventType'
            });
            return;
        }

        const eventData: Partial<IAttributionEvent> = {
            eventType,
            eventName,
            eventValue,
            eventTimestamp: eventTimestamp ? new Date(eventTimestamp) : new Date(),
            pageUrl,
            referrer,
            metadata: {
                userAgent,
                ipAddress,
                ...customData
            }
        };

        const result = await attributionProcessor.trackEvent(
            projectId,
            userIdentifier,
            eventData
        );

        if (result.success) {
            res.status(201).json(result);
        } else {
            res.status(500).json(result);
        }

    } catch (error) {
        console.error('[AttributionRoutes] Error tracking event:', error);
        res.status(500).json({
            success: false,
            error: error instanceof Error ? error.message : 'Unknown error'
        });
    }
});

/**
 * Generate attribution report
 * POST /attribution/reports
 */
router.post('/attribution/reports', validateJWT, expensiveOperationsLimiter, async (req: Request, res: Response): Promise<void> => {
    try {
        const {
            projectId,
            reportName,
            attributionModel,
            startDate,
            endDate
        } = req.body;

        if (!projectId || !reportName || !attributionModel || !startDate || !endDate) {
            res.status(400).json({
                success: false,
                error: 'Missing required fields: projectId, reportName, attributionModel, startDate, endDate'
            });
            return;
        }

        const validModels: AttributionModel[] = ['first_touch', 'last_touch', 'linear', 'time_decay', 'u_shaped'];
        if (!validModels.includes(attributionModel)) {
            res.status(400).json({
                success: false,
                error: `Invalid attribution model. Must be one of: ${validModels.join(', ')}`
            });
            return;
        }

        const userId = (req as any).user_id;

        const result = await attributionProcessor.generateReport(
            projectId,
            reportName,
            attributionModel,
            new Date(startDate),
            new Date(endDate),
            userId
        );

        if (result.success) {
            res.status(201).json(result);
        } else {
            res.status(500).json(result);
        }

    } catch (error) {
        console.error('[AttributionRoutes] Error generating report:', error);
        res.status(500).json({
            success: false,
            error: error instanceof Error ? error.message : 'Unknown error'
        });
    }
});

/**
 * Get all reports for a project
 * GET /attribution/reports/:projectId
 */
router.get('/attribution/reports/:projectId', validateJWT, async (req: Request, res: Response): Promise<void> => {
    try {
        const projectId = parseInt(req.params.projectId);

        if (isNaN(projectId)) {
            res.status(400).json({
                success: false,
                error: 'Invalid project ID'
            });
            return;
        }

        const reports = await attributionProcessor.listProjectReports(projectId);

        res.status(200).json({
            success: true,
            data: reports
        });

    } catch (error) {
        console.error('[AttributionRoutes] Error listing reports:', error);
        res.status(500).json({
            success: false,
            error: error instanceof Error ? error.message : 'Unknown error'
        });
    }
});

/**
 * Get specific report by ID
 * GET /attribution/report/:reportId
 */
router.get('/attribution/report/:reportId', validateJWT, async (req: Request, res: Response): Promise<void> => {
    try {
        const reportId = parseInt(req.params.reportId);

        if (isNaN(reportId)) {
            res.status(400).json({
                success: false,
                error: 'Invalid report ID'
            });
            return;
        }

        const report = await attributionProcessor.getReportById(reportId);

        if (!report) {
            res.status(404).json({
                success: false,
                error: 'Report not found'
            });
            return;
        }

        res.status(200).json({
            success: true,
            data: report
        });

    } catch (error) {
        console.error('[AttributionRoutes] Error getting report:', error);
        res.status(500).json({
            success: false,
            error: error instanceof Error ? error.message : 'Unknown error'
        });
    }
});

/**
 * Delete report
 * DELETE /attribution/report/:reportId
 */
router.delete('/attribution/report/:reportId', validateJWT, async (req: Request, res: Response): Promise<void> => {
    try {
        const reportId = parseInt(req.params.reportId);

        if (isNaN(reportId)) {
            res.status(400).json({
                success: false,
                error: 'Invalid report ID'
            });
            return;
        }

        const success = await attributionProcessor.deleteReport(reportId);

        if (success) {
            res.status(200).json({
                success: true,
                message: 'Report deleted successfully'
            });
        } else {
            res.status(500).json({
                success: false,
                error: 'Failed to delete report'
            });
        }

    } catch (error) {
        console.error('[AttributionRoutes] Error deleting report:', error);
        res.status(500).json({
            success: false,
            error: error instanceof Error ? error.message : 'Unknown error'
        });
    }
});

/**
 * Get channel performance metrics
 * POST /attribution/channel-performance
 */
router.post('/attribution/channel-performance', validateJWT, async (req: Request, res: Response): Promise<void> => {
    try {
        const { projectId, attributionModel, startDate, endDate } = req.body;

        if (!projectId || !attributionModel || !startDate || !endDate) {
            res.status(400).json({
                success: false,
                error: 'Missing required fields: projectId, attributionModel, startDate, endDate'
            });
            return;
        }

        const performance = await attributionProcessor.getChannelPerformance(
            projectId,
            attributionModel,
            new Date(startDate),
            new Date(endDate)
        );

        res.status(200).json({
            success: true,
            data: performance
        });

    } catch (error) {
        console.error('[AttributionRoutes] Error getting channel performance:', error);
        res.status(500).json({
            success: false,
            error: error instanceof Error ? error.message : 'Unknown error'
        });
    }
});

/**
 * Calculate ROI metrics
 * POST /attribution/roi
 */
router.post('/attribution/roi', validateJWT, async (req: Request, res: Response): Promise<void> => {
    try {
        const { projectId, attributionModel, startDate, endDate, channelSpend } = req.body;

        if (!projectId || !attributionModel || !startDate || !endDate) {
            res.status(400).json({
                success: false,
                error: 'Missing required fields: projectId, attributionModel, startDate, endDate'
            });
            return;
        }

        // Convert channelSpend object to Map if provided
        const spendMap = channelSpend ? new Map(Object.entries(channelSpend).map(([k, v]) => [parseInt(k), v as number])) : undefined;

        const roiMetrics = await attributionProcessor.calculateROI(
            projectId,
            attributionModel,
            new Date(startDate),
            new Date(endDate),
            spendMap
        );

        res.status(200).json({
            success: true,
            data: roiMetrics
        });

    } catch (error) {
        console.error('[AttributionRoutes] Error calculating ROI:', error);
        res.status(500).json({
            success: false,
            error: error instanceof Error ? error.message : 'Unknown error'
        });
    }
});

/**
 * Compare attribution models for a channel
 * POST /attribution/compare-models
 */
router.post('/attribution/compare-models', validateJWT, async (req: Request, res: Response): Promise<void> => {
    try {
        const { projectId, channelId, startDate, endDate } = req.body;

        if (!projectId || !channelId || !startDate || !endDate) {
            res.status(400).json({
                success: false,
                error: 'Missing required fields: projectId, channelId, startDate, endDate'
            });
            return;
        }

        const comparison = await attributionProcessor.compareModels(
            projectId,
            channelId,
            new Date(startDate),
            new Date(endDate)
        );

        res.status(200).json({
            success: true,
            data: comparison
        });

    } catch (error) {
        console.error('[AttributionRoutes] Error comparing models:', error);
        res.status(500).json({
            success: false,
            error: error instanceof Error ? error.message : 'Unknown error'
        });
    }
});

/**
 * Analyze conversion funnel
 * POST /attribution/analyze-funnel
 */
router.post('/attribution/analyze-funnel', validateJWT, expensiveOperationsLimiter, async (req: Request, res: Response): Promise<void> => {
    try {
        const funnelRequest: IFunnelAnalysisRequest = {
            projectId: req.body.projectId,
            funnelName: req.body.funnelName,
            funnelSteps: req.body.funnelSteps,
            dateRangeStart: new Date(req.body.dateRangeStart),
            dateRangeEnd: new Date(req.body.dateRangeEnd),
            userId: (req as any).user_id
        };

        if (!funnelRequest.projectId || !funnelRequest.funnelName || !funnelRequest.funnelSteps) {
            res.status(400).json({
                success: false,
                error: 'Missing required fields: projectId, funnelName, funnelSteps'
            });
            return;
        }

        const result = await attributionProcessor.analyzeFunnel(funnelRequest);

        if (result.success) {
            res.status(200).json(result);
        } else {
            res.status(500).json(result);
        }

    } catch (error) {
        console.error('[AttributionRoutes] Error analyzing funnel:', error);
        res.status(500).json({
            success: false,
            error: error instanceof Error ? error.message : 'Unknown error'
        });
    }
});

/**
 * Get customer journey map
 * POST /attribution/journey-map
 */
router.post('/attribution/journey-map', validateJWT, expensiveOperationsLimiter, async (req: Request, res: Response): Promise<void> => {
    try {
        const journeyRequest: IJourneyMapRequest = {
            projectId: req.body.projectId,
            dateRangeStart: new Date(req.body.dateRangeStart),
            dateRangeEnd: new Date(req.body.dateRangeEnd),
            userIdentifier: req.body.userIdentifier,
            limit: req.body.limit
        };

        if (!journeyRequest.projectId || !journeyRequest.dateRangeStart || !journeyRequest.dateRangeEnd) {
            res.status(400).json({
                success: false,
                error: 'Missing required fields: projectId, dateRangeStart, dateRangeEnd'
            });
            return;
        }

        const result = await attributionProcessor.getJourneyMap(journeyRequest);

        if (result.success) {
            res.status(200).json(result);
        } else {
            res.status(500).json(result);
        }

    } catch (error) {
        console.error('[AttributionRoutes] Error getting journey map:', error);
        res.status(500).json({
            success: false,
            error: error instanceof Error ? error.message : 'Unknown error'
        });
    }
});

/**
 * Get attribution status for a project
 * GET /attribution/status/:projectId
 */
router.get('/attribution/status/:projectId', validateJWT, async (req: Request, res: Response): Promise<void> => {
    try {
        const projectId = parseInt(req.params.projectId);

        if (isNaN(projectId)) {
            res.status(400).json({
                success: false,
                error: 'Invalid project ID'
            });
            return;
        }

        const channels = await attributionProcessor.getProjectChannels(projectId);
        const enabled = channels.length > 0;

        res.status(200).json({
            success: true,
            enabled: enabled,
            channelCount: channels.length
        });

    } catch (error) {
        console.error('[AttributionRoutes] Error getting attribution status:', error);
        res.status(500).json({
            success: false,
            error: error instanceof Error ? error.message : 'Unknown error'
        });
    }
});

/**
 * Get all channels for a project
 * GET /attribution/channels/:projectId
 */
router.get('/attribution/channels/:projectId', validateJWT, async (req: Request, res: Response): Promise<void> => {
    try {
        const projectId = parseInt(req.params.projectId);

        if (isNaN(projectId)) {
            res.status(400).json({
                success: false,
                error: 'Invalid project ID'
            });
            return;
        }

        const channels = await attributionProcessor.getProjectChannels(projectId);

        res.status(200).json({
            success: true,
            data: channels
        });

    } catch (error) {
        console.error('[AttributionRoutes] Error getting channels:', error);
        res.status(500).json({
            success: false,
            error: error instanceof Error ? error.message : 'Unknown error'
        });
    }
});

/**
 * Initialize attribution tracking with default channels
 * POST /attribution/initialize
 */
router.post('/attribution/initialize', validateJWT, async (req: Request, res: Response): Promise<void> => {
    try {
        const { projectId } = req.body;

        if (!projectId) {
            res.status(400).json({
                success: false,
                error: 'Missing required field: projectId'
            });
            return;
        }

        // Check if channels already exist
        const existingChannels = await attributionProcessor.getProjectChannels(projectId);
        if (existingChannels.length > 0) {
            res.status(200).json({
                success: true,
                message: 'Attribution already initialized',
                data: { channelCount: existingChannels.length }
            });
            return;
        }

        // Create default channels
        const defaultChannels = [
            { name: 'Organic Search', category: 'organic', source: 'Google', medium: 'organic' },
            { name: 'Paid Search', category: 'paid', source: 'Google Ads', medium: 'cpc' },
            { name: 'Social Media', category: 'social', source: 'Facebook', medium: 'social' },
            { name: 'Email Marketing', category: 'email', source: 'Email Campaign', medium: 'email' },
            { name: 'Direct Traffic', category: 'direct', source: 'Direct', medium: 'none' },
            { name: 'Referral', category: 'referral', source: 'Partner Sites', medium: 'referral' },
            { name: 'Display Ads', category: 'paid', source: 'Google Display', medium: 'display' },
            { name: 'Other', category: 'other', source: null, medium: null }
        ];

        const createdChannels = await attributionProcessor.createDefaultChannels(projectId, defaultChannels);

        res.status(201).json({
            success: true,
            message: `Successfully initialized attribution tracking with ${createdChannels.length} default channels`,
            data: {
                channelCount: createdChannels.length,
                channels: createdChannels
            }
        });

    } catch (error) {
        console.error('[AttributionRoutes] Error initializing attribution:', error);
        res.status(500).json({
            success: false,
            error: error instanceof Error ? error.message : 'Unknown error'
        });
    }
});

/**
 * Get top conversion paths
 * POST /attribution/conversion-paths
 */
router.post('/attribution/conversion-paths', validateJWT, async (req: Request, res: Response): Promise<void> => {
    try {
        const { projectId, attributionModel, startDate, endDate, limit } = req.body;

        if (!projectId || !attributionModel || !startDate || !endDate) {
            res.status(400).json({
                success: false,
                error: 'Missing required fields: projectId, attributionModel, startDate, endDate'
            });
            return;
        }

        const paths = await attributionProcessor.getTopConversionPaths(
            projectId,
            attributionModel,
            new Date(startDate),
            new Date(endDate),
            limit
        );

        res.status(200).json({
            success: true,
            data: paths
        });

    } catch (error) {
        console.error('[AttributionRoutes] Error getting conversion paths:', error);
        res.status(500).json({
            success: false,
            error: error instanceof Error ? error.message : 'Unknown error'
        });
    }
});

/**
 * Get user event history
 * GET /attribution/user-events/:projectId/:userIdentifier
 */
router.get('/attribution/user-events/:projectId/:userIdentifier', validateJWT, async (req: Request, res: Response): Promise<void> => {
    try {
        const projectId = parseInt(req.params.projectId);
        const userIdentifier = req.params.userIdentifier;

        if (isNaN(projectId)) {
            res.status(400).json({
                success: false,
                error: 'Invalid project ID'
            });
            return;
        }

        const events = await attributionProcessor.getUserEventHistory(projectId, userIdentifier);

        res.status(200).json({
            success: true,
            data: events
        });

    } catch (error) {
        console.error('[AttributionRoutes] Error getting user events:', error);
        res.status(500).json({
            success: false,
            error: error instanceof Error ? error.message : 'Unknown error'
        });
    }
});

export default router;
