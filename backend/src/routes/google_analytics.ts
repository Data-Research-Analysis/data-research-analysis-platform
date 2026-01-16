import express, { Request, Response } from 'express';
import { validateJWT } from '../middleware/authenticate.js';
import { validate } from '../middleware/validator.js';
import { body, param, matchedData } from 'express-validator';
import { GoogleAnalyticsService } from '../services/GoogleAnalyticsService.js';
import { GoogleAnalyticsDriver } from '../drivers/GoogleAnalyticsDriver.js';
import { DataSourceProcessor } from '../processors/DataSourceProcessor.js';
import { IAPIConnectionDetails } from '../types/IAPIConnectionDetails.js';
import { EDataSourceType } from '../types/EDataSourceType.js';
import { expensiveOperationsLimiter, oauthCallbackLimiter } from '../middleware/rateLimit.js';

const router = express.Router();

/**
 * List accessible Google Analytics properties
 * POST /api/google-analytics/properties
 */
router.post('/properties',
    async (req: Request, res: Response, next: any) => {
        next();
    },
    validateJWT,
    validate([
        body('access_token').notEmpty().withMessage('Access token is required')
    ]),
    async (req: Request, res: Response) => {
        try {
            const { access_token } = matchedData(req);
            const gaService = GoogleAnalyticsService.getInstance();
            
            const properties = await gaService.listProperties(access_token);
            
            res.status(200).send({
                properties: properties,
                count: properties.length,
                message: 'Properties retrieved successfully'
            });
        } catch (error) {
            console.error('Error listing GA properties:', error);
            res.status(500).send({
                message: 'Failed to retrieve Google Analytics properties'
            });
        }
    }
);

/**
 * Get metadata for a specific GA4 property
 * GET /api/google-analytics/metadata/:propertyId
 */
router.get('/metadata/:propertyId',
    async (req: Request, res: Response, next: any) => {
        next();
    },
    validateJWT,
    validate([
        param('propertyId').notEmpty().withMessage('Property ID is required'),
        body('access_token').notEmpty().withMessage('Access token is required'),
        body('refresh_token').notEmpty().withMessage('Refresh token is required')
    ]),
    async (req: Request, res: Response) => {
        try {
            const { propertyId, access_token, refresh_token } = matchedData(req);
            const gaService = GoogleAnalyticsService.getInstance();
            
            // Create temporary connection details
            const connectionDetails: IAPIConnectionDetails = {
                oauth_access_token: access_token,
                oauth_refresh_token: refresh_token,
                token_expiry: new Date(Date.now() + 3600000), // 1 hour from now
                api_config: {
                    property_id: propertyId
                }
            };
            
            const metadata = await gaService.getMetadata(propertyId, connectionDetails);
            
            res.status(200).send({
                metadata: metadata,
                message: 'Metadata retrieved successfully'
            });
        } catch (error) {
            console.error('Error getting GA metadata:', error);
            res.status(500).send({
                message: 'Failed to retrieve metadata'
            });
        }
    }
);

/**
 * Get available report presets
 * GET /api/google-analytics/report-presets
 */
router.get('/report-presets',
    async (req: Request, res: Response, next: any) => {
        next();
    },
    validateJWT,
    async (req: Request, res: Response) => {
        try {
            const presets = GoogleAnalyticsService.getReportPresets();
            
            res.status(200).send({
                presets: presets,
                message: 'Report presets retrieved successfully'
            });
        } catch (error) {
            console.error('Error getting report presets:', error);
            res.status(500).send({
                message: 'Failed to retrieve report presets'
            });
        }
    }
);

/**
 * Add Google Analytics data source
 * POST /api/google-analytics/add-data-source
 */
router.post('/add-data-source',
    expensiveOperationsLimiter,
    async (req: Request, res: Response, next: any) => {
        next();
    },
    validateJWT,
    validate([
        body('name').notEmpty().trim().escape().withMessage('Data source name is required'),
        body('property_id').notEmpty().withMessage('Property ID is required'),
        body('access_token').notEmpty().withMessage('Access token is required'),
        body('refresh_token').notEmpty().withMessage('Refresh token is required'),
        body('token_expiry').notEmpty().withMessage('Token expiry is required'),
        body('project_id').notEmpty().toInt().withMessage('Project ID is required'),
        body('sync_frequency').optional().isIn(['hourly', 'daily', 'weekly', 'manual']),
        body('account_name').optional().trim()
    ]),
    async (req: Request, res: Response) => {
        try {
            const {
                name,
                property_id,
                access_token,
                refresh_token,
                token_expiry,
                project_id,
                sync_frequency,
                account_name
            } = matchedData(req);
            
            // Create connection details
            const connectionDetails: IAPIConnectionDetails = {
                oauth_access_token: access_token,
                oauth_refresh_token: refresh_token,
                token_expiry: new Date(token_expiry),
                api_config: {
                    property_id: property_id,
                    account_name: account_name,
                    sync_frequency: sync_frequency || 'manual'
                }
            };
            
            // Add data source using processor
            const dataSourceId = await DataSourceProcessor.getInstance().addGoogleAnalyticsDataSource(
                name,
                connectionDetails,
                req.body.tokenDetails,
                project_id
            );
            
            if (dataSourceId) {
                res.status(201).send({
                    success: true,
                    data_source_id: dataSourceId,
                    message: 'Google Analytics data source added successfully'
                });
            } else {
                res.status(400).send({
                    success: false,
                    message: 'Failed to add Google Analytics data source'
                });
            }
        } catch (error) {
            console.error('Error adding GA data source:', error);
            res.status(500).send({
                message: 'Failed to add Google Analytics data source'
            });
        }
    }
);

/**
 * Trigger manual sync for Google Analytics data source
 * POST /api/google-analytics/sync/:dataSourceId
 */
router.post('/sync/:dataSourceId',
    expensiveOperationsLimiter,
    async (req: Request, res: Response, next: any) => {
        next();
    },
    validateJWT,
    validate([
        param('dataSourceId')
            .notEmpty().withMessage('Data source ID is required')
            .isInt({ min: 1 }).withMessage('Data source ID must be a positive integer')
            .toInt()
    ]),
    async (req: Request, res: Response) => {
        try {
            const { dataSourceId } = matchedData(req);
            
            // Defensive check for NaN or invalid ID
            if (!dataSourceId || isNaN(dataSourceId) || !Number.isInteger(dataSourceId) || dataSourceId < 1) {
                console.error('[Google Analytics Sync] Invalid data source ID:', dataSourceId);
                return res.status(400).send({
                    success: false,
                    message: 'Invalid data source ID provided'
                });
            }
            
            console.log(`[Google Analytics Sync] Starting sync for data source ID: ${dataSourceId}`);
            console.log(`[Google Analytics Sync] Token details:`, req.body.tokenDetails ? 'Present' : 'Missing');
            
            // Trigger sync
            const result = await DataSourceProcessor.getInstance().syncGoogleAnalyticsDataSource(
                dataSourceId,
                req.body.tokenDetails
            );
            
            console.log(`[Google Analytics Sync] Sync result for data source ${dataSourceId}:`, result);
            
            if (result) {
                console.log(`[Google Analytics Sync] Sync completed successfully for data source ID: ${dataSourceId}`);
                res.status(200).send({
                    success: true,
                    message: 'Sync completed successfully'
                });
            } else {
                console.error(`[Google Analytics Sync] Sync returned false for data source ID: ${dataSourceId}`);
                res.status(400).send({
                    success: false,
                    message: 'Sync failed - check server logs for details'
                });
            }
        } catch (error) {
            console.error('[Google Analytics Sync] Error syncing GA data:', error);
            res.status(500).send({
                success: false,
                message: 'Failed to sync Google Analytics data',
                error: error.message
            });
        }
    }
);

/**
 * Get sync status and history
 * GET /api/google-analytics/sync-status/:dataSourceId
 */
router.get('/sync-status/:dataSourceId',
    async (req: Request, res: Response, next: any) => {
        next();
    },
    validateJWT,
    validate([
        param('dataSourceId')
            .notEmpty().withMessage('Data source ID is required')
            .isInt({ min: 1 }).withMessage('Data source ID must be a positive integer')
            .toInt()
    ]),
    async (req: Request, res: Response) => {
        try {
            const { dataSourceId } = matchedData(req);
            
            // Defensive check
            if (!dataSourceId || isNaN(dataSourceId) || dataSourceId < 1) {
                return res.status(400).send({
                    message: 'Invalid data source ID provided'
                });
            }
            
            const gaDriver = GoogleAnalyticsDriver.getInstance();
            
            const lastSync = await gaDriver.getLastSyncTime(dataSourceId);
            const history = await gaDriver.getSyncHistory(dataSourceId, 10);
            
            res.status(200).send({
                last_sync: lastSync,
                sync_history: history,
                message: 'Sync status retrieved successfully'
            });
        } catch (error) {
            console.error('Error getting sync status:', error);
            res.status(500).send({
                message: 'Failed to retrieve sync status'
            });
        }
    }
);

export default router;
