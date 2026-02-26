import express, { Request, Response } from 'express';
import { validateJWT } from '../middleware/authenticate.js';
import { validate } from '../middleware/validator.js';
import { body, param, query, matchedData } from 'express-validator';
import { GoogleAnalyticsProcessor } from '../processors/GoogleAnalyticsProcessor.js';
import { expensiveOperationsLimiter } from '../middleware/rateLimit.js';

const router = express.Router();

/**
 * List accessible Google Analytics properties
 * POST /google-analytics/properties
 */
router.post('/properties',
    async (_req: Request, _res: Response, next: any) => { next(); },
    validateJWT,
    validate([
        body('access_token').notEmpty().withMessage('Access token is required'),
    ]),
    async (req: Request, res: Response) => {
        try {
            const { access_token } = matchedData(req);
            const properties = await GoogleAnalyticsProcessor.getInstance().listGA4Properties(access_token);
            res.status(200).send({ properties, count: properties.length, message: 'Properties retrieved successfully' });
        } catch (error) {
            console.error('[GA] Error listing properties:', error);
            res.status(500).send({ message: 'Failed to retrieve Google Analytics properties' });
        }
    }
);

/**
 * Get metadata for a specific GA4 property
 * GET /google-analytics/metadata/:propertyId
 */
router.get('/metadata/:propertyId',
    async (_req: Request, _res: Response, next: any) => { next(); },
    validateJWT,
    validate([
        param('propertyId').notEmpty().withMessage('Property ID is required'),
        body('access_token').notEmpty().withMessage('Access token is required'),
        body('refresh_token').notEmpty().withMessage('Refresh token is required'),
    ]),
    async (req: Request, res: Response) => {
        try {
            const { propertyId, access_token, refresh_token } = matchedData(req);
            const metadata = await GoogleAnalyticsProcessor.getInstance().getGA4PropertyMetadata(
                propertyId, access_token, refresh_token
            );
            res.status(200).send({ metadata, message: 'Metadata retrieved successfully' });
        } catch (error) {
            console.error('[GA] Error getting metadata:', error);
            res.status(500).send({ message: 'Failed to retrieve metadata' });
        }
    }
);

/**
 * Get available report presets
 * GET /google-analytics/report-presets
 */
router.get('/report-presets',
    async (_req: Request, _res: Response, next: any) => { next(); },
    validateJWT,
    async (_req: Request, res: Response) => {
        try {
            const presets = GoogleAnalyticsProcessor.getInstance().getGA4ReportPresets();
            res.status(200).send({ presets, message: 'Report presets retrieved successfully' });
        } catch (error) {
            console.error('[GA] Error getting report presets:', error);
            res.status(500).send({ message: 'Failed to retrieve report presets' });
        }
    }
);

/**
 * Add Google Analytics data source
 * POST /google-analytics/add-data-source
 */
router.post('/add-data-source',
    expensiveOperationsLimiter,
    async (_req: Request, _res: Response, next: any) => { next(); },
    validateJWT,
    validate([
        body('name').notEmpty().trim().escape().withMessage('Data source name is required'),
        body('property_id').notEmpty().withMessage('Property ID is required'),
        body('access_token').notEmpty().withMessage('Access token is required'),
        body('refresh_token').notEmpty().withMessage('Refresh token is required'),
        body('token_expiry').notEmpty().withMessage('Token expiry is required'),
        body('project_id').notEmpty().toInt().withMessage('Project ID is required'),
        body('sync_frequency').optional().isIn(['hourly', 'daily', 'weekly', 'manual']),
        body('account_name').optional().trim(),
    ]),
    async (req: Request, res: Response) => {
        try {
            const { name, property_id, access_token, refresh_token, token_expiry, project_id, sync_frequency, account_name } = matchedData(req);
            const dataSourceId = await GoogleAnalyticsProcessor.getInstance().addGA4DataSource(
                name, property_id, access_token, refresh_token, token_expiry,
                project_id, req.body.tokenDetails, sync_frequency, account_name
            );
            if (dataSourceId) {
                res.status(201).send({ success: true, data_source_id: dataSourceId, message: 'Google Analytics data source added successfully' });
            } else {
                res.status(400).send({ success: false, message: 'Failed to add Google Analytics data source' });
            }
        } catch (error) {
            console.error('[GA] Error adding data source:', error);
            res.status(500).send({ message: 'Failed to add Google Analytics data source' });
        }
    }
);

/**
 * Trigger manual sync for Google Analytics data source
 * POST /google-analytics/sync/:dataSourceId
 */
router.post('/sync/:dataSourceId',
    expensiveOperationsLimiter,
    async (_req: Request, _res: Response, next: any) => { next(); },
    validateJWT,
    validate([
        param('dataSourceId').notEmpty().isInt({ min: 1 }).toInt().withMessage('Data source ID must be a positive integer'),
    ]),
    async (req: Request, res: Response) => {
        try {
            const { dataSourceId } = matchedData(req);
            const result = await GoogleAnalyticsProcessor.getInstance().syncGoogleAnalyticsDataSource(
                dataSourceId, req.body.tokenDetails
            );
            if (result) {
                res.status(200).send({ success: true, message: 'Sync completed successfully' });
            } else {
                res.status(400).send({ success: false, message: 'Sync failed - check server logs for details' });
            }
        } catch (error) {
            console.error('[GA] Error syncing data source:', error);
            res.status(500).send({ success: false, message: 'Failed to sync Google Analytics data' });
        }
    }
);

/**
 * Get sync status and history
 * GET /google-analytics/sync-status/:dataSourceId
 */
router.get('/sync-status/:dataSourceId',
    async (_req: Request, _res: Response, next: any) => { next(); },
    validateJWT,
    validate([
        param('dataSourceId').notEmpty().isInt({ min: 1 }).toInt().withMessage('Data source ID must be a positive integer'),
    ]),
    async (req: Request, res: Response) => {
        try {
            const { dataSourceId } = matchedData(req);
            const { lastSync, history } = await GoogleAnalyticsProcessor.getInstance().getGA4SyncStatus(dataSourceId);
            res.status(200).send({ last_sync: lastSync, sync_history: history, message: 'Sync status retrieved successfully' });
        } catch (error) {
            console.error('[GA] Error getting sync status:', error);
            res.status(500).send({ message: 'Failed to retrieve sync status' });
        }
    }
);

/**
 * Get total web sessions for a project from GA4 traffic_overview data
 * GET /google-analytics/sessions-summary/:projectId
 */
router.get('/sessions-summary/:projectId',
    validateJWT,
    validate([
        param('projectId').notEmpty().isInt({ min: 1 }).toInt(),
        query('startDate').optional().isDate(),
        query('endDate').optional().isDate(),
    ]),
    async (req: Request, res: Response) => {
        try {
            const { projectId } = matchedData(req);
            const startDate = req.query.startDate as string | undefined;
            const endDate = req.query.endDate as string | undefined;
            const totalSessions = await GoogleAnalyticsProcessor.getInstance().getGA4SessionsSummary(
                projectId, startDate, endDate
            );
            res.status(200).json({
                success: true,
                data: totalSessions !== null ? { totalSessions } : null,
            });
        } catch (error) {
            console.error('[GA] Error getting sessions summary:', error);
            res.status(500).json({ success: false, error: 'Failed to retrieve sessions summary' });
        }
    }
);

export default router;
