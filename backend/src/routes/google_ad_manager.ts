import express, { Request, Response } from 'express';
import { validateJWT } from '../middleware/authenticate.js';
import { validate } from '../middleware/validator.js';
import { body, param, matchedData } from 'express-validator';
import { GoogleAdManagerService } from '../services/GoogleAdManagerService.js';
import { GoogleAdManagerDriver } from '../drivers/GoogleAdManagerDriver.js';
import { DataSourceProcessor } from '../processors/DataSourceProcessor.js';
import { IAPIConnectionDetails } from '../types/IAPIConnectionDetails.js';
import { EDataSourceType } from '../types/EDataSourceType.js';
import { expensiveOperationsLimiter } from '../middleware/rateLimit.js';

const router = express.Router();

/**
 * List accessible Google Ad Manager networks
 * POST /api/google-ad-manager/networks
 */
router.post('/networks',
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
            const gamService = GoogleAdManagerService.getInstance();
            
            console.log('📊 Fetching GAM networks for user');
            const networks = await gamService.listNetworks(access_token);
            
            res.status(200).send({
                networks: networks,
                count: networks.length,
                message: 'Networks retrieved successfully'
            });
        } catch (error) {
            console.error('❌ Error listing GAM networks:', error);
            res.status(500).send({
                message: 'Failed to retrieve Google Ad Manager networks'
            });
        }
    }
);

/**
 * Get available report types
 * GET /api/google-ad-manager/report-types
 */
router.get('/report-types',
    async (req: Request, res: Response, next: any) => {
        next();
    },
    validateJWT,
    async (req: Request, res: Response) => {
        try {
            const reportTypes = [
                {
                    id: 'revenue',
                    name: 'Revenue Report',
                    description: 'Ad revenue, impressions, clicks, CPM, and CTR by ad unit and country',
                    dimensions: ['Date', 'Ad Unit', 'Country'],
                    metrics: ['Impressions', 'Clicks', 'Revenue', 'CPM', 'CTR']
                },
                {
                    id: 'inventory',
                    name: 'Inventory Report',
                    description: 'Ad inventory performance including requests, matched requests, and fill rates',
                    dimensions: ['Date', 'Ad Unit', 'Device Category'],
                    metrics: ['Ad Requests', 'Matched Requests', 'Impressions', 'Fill Rate']
                },
                {
                    id: 'orders',
                    name: 'Orders & Line Items',
                    description: 'Campaign delivery tracking by order, line item, and advertiser',
                    dimensions: ['Date', 'Order', 'Line Item', 'Advertiser'],
                    metrics: ['Impressions', 'Clicks', 'Revenue', 'Delivery Status']
                },
                {
                    id: 'geography',
                    name: 'Geographic Performance',
                    description: 'Ad performance broken down by country, region, and city',
                    dimensions: ['Date', 'Country', 'Region', 'City'],
                    metrics: ['Impressions', 'Clicks', 'Revenue']
                },
                {
                    id: 'device',
                    name: 'Device & Browser',
                    description: 'Performance by device category, browser, and operating system',
                    dimensions: ['Date', 'Device Category', 'Browser', 'Operating System'],
                    metrics: ['Impressions', 'Clicks', 'Revenue']
                }
            ];
            
            res.status(200).send({
                report_types: reportTypes,
                count: reportTypes.length,
                message: 'Report types retrieved successfully'
            });
        } catch (error) {
            console.error('❌ Error getting report types:', error);
            res.status(500).send({
                message: 'Failed to retrieve report types'
            });
        }
    }
);

/**
 * Add Google Ad Manager data source
 * POST /api/google-ad-manager/add-data-source
 */
router.post('/add-data-source',
    expensiveOperationsLimiter,
    async (req: Request, res: Response, next: any) => {
        next();
    },
    validateJWT,
    validate([
        body('name').notEmpty().trim().escape().withMessage('Data source name is required'),
        body('network_code').notEmpty().withMessage('Network code is required'),
        body('network_id').notEmpty().withMessage('Network ID is required'),
        body('network_name').optional().trim(),
        body('access_token').notEmpty().withMessage('Access token is required'),
        body('refresh_token').notEmpty().withMessage('Refresh token is required'),
        body('token_expiry').notEmpty().withMessage('Token expiry is required'),
        body('project_id').notEmpty().toInt().withMessage('Project ID is required'),
        body('report_types').isArray({ min: 1 }).withMessage('At least one report type is required'),
        body('start_date').optional().isISO8601().withMessage('Start date must be ISO 8601 format'),
        body('end_date').optional().isISO8601().withMessage('End date must be ISO 8601 format'),
        body('sync_frequency').optional().isIn(['hourly', 'daily', 'weekly', 'manual'])
    ]),
    async (req: Request, res: Response) => {
        try {
            const {
                name,
                network_code,
                network_id,
                network_name,
                access_token,
                refresh_token,
                token_expiry,
                project_id,
                report_types,
                start_date,
                end_date,
                sync_frequency
            } = matchedData(req);
            
            console.log('📊 Adding GAM data source:', {
                name,
                network_code,
                report_types,
                project_id
            });
            
            // Create connection details
            const connectionDetails: IAPIConnectionDetails = {
                oauth_access_token: access_token,
                oauth_refresh_token: refresh_token,
                token_expiry: new Date(token_expiry),
                api_config: {
                    network_code: network_code,
                    network_id: network_id,
                    network_name: network_name,
                    report_types: report_types,
                    start_date: start_date,
                    end_date: end_date,
                    sync_frequency: sync_frequency || 'manual'
                }
            };
            
            // Add data source using processor
            const dataSourceId = await DataSourceProcessor.getInstance().addGoogleAdManagerDataSource(
                name,
                connectionDetails,
                req.body.tokenDetails,
                project_id
            );
            
            if (dataSourceId) {
                console.log('✅ GAM data source added successfully:', dataSourceId);
                res.status(201).send({
                    success: true,
                    data_source_id: dataSourceId,
                    message: 'Google Ad Manager data source added successfully'
                });
            } else {
                console.error('❌ Failed to add GAM data source');
                res.status(400).send({
                    success: false,
                    message: 'Failed to add Google Ad Manager data source'
                });
            }
        } catch (error) {
            console.error('❌ Error adding GAM data source:', error);
            res.status(500).send({
                message: 'Failed to add Google Ad Manager data source',
                error: error.message
            });
        }
    }
);

/**
 * Trigger manual sync for Google Ad Manager data source
 * POST /api/google-ad-manager/sync/:dataSourceId
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
                console.error('[GAM Sync] Invalid data source ID:', dataSourceId);
                return res.status(400).send({
                    success: false,
                    message: 'Invalid data source ID provided'
                });
            }
            
            console.log(`📊 [GAM Sync] Starting sync for data source ID: ${dataSourceId}`);
            
            // Trigger sync
            const result = await DataSourceProcessor.getInstance().syncGoogleAdManagerDataSource(
                dataSourceId,
                req.body.tokenDetails
            );
            
            if (result) {
                console.log(`✅ [GAM Sync] Sync completed successfully for data source ID: ${dataSourceId}`);
                res.status(200).send({
                    success: true,
                    message: 'Sync completed successfully'
                });
            } else {
                console.error(`❌ [GAM Sync] Sync failed for data source ID: ${dataSourceId}`);
                res.status(400).send({
                    success: false,
                    message: 'Sync failed'
                });
            }
        } catch (error) {
            console.error('[GAM Sync] Error syncing GAM data:', error);
            res.status(500).send({
                success: false,
                message: 'Failed to sync Google Ad Manager data',
                error: error.message
            });
        }
    }
);

/**
 * Get sync status and history
 * GET /api/google-ad-manager/sync-status/:dataSourceId
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
            
            const gamDriver = GoogleAdManagerDriver.getInstance();
            
            const lastSync = await gamDriver.getLastSyncTime(dataSourceId);
            const history = await gamDriver.getSyncHistory(dataSourceId, 10);
            
            // Transform history to match frontend expectations
            const transformedHistory = history.map((record: any) => ({
                id: record.id,
                sync_started_at: record.startedAt,
                sync_completed_at: record.completedAt,
                status: record.status?.toLowerCase() || 'idle',
                rows_synced: record.recordsSynced,
                error_message: record.errorMessage
            }));
            
            res.status(200).send({
                last_sync: lastSync,
                sync_history: transformedHistory,
                message: 'Sync status retrieved successfully'
            });
        } catch (error) {
            console.error('❌ Error getting sync status:', error);
            res.status(500).send({
                message: 'Failed to retrieve sync status'
            });
        }
    }
);

/**
 * Delete Google Ad Manager data source
 * DELETE /api/google-ad-manager/data-source/:dataSourceId
 */
router.delete('/data-source/:dataSourceId',
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
            
            if (!dataSourceId || isNaN(dataSourceId) || dataSourceId < 1) {
                return res.status(400).send({
                    success: false,
                    message: 'Invalid data source ID provided'
                });
            }
            
            console.log(`📊 Deleting GAM data source: ${dataSourceId}`);
            
            const result = await DataSourceProcessor.getInstance().deleteDataSource(
                dataSourceId,
                req.body.tokenDetails
            );
            
            if (result) {
                console.log(`✅ GAM data source deleted successfully: ${dataSourceId}`);
                res.status(200).send({
                    success: true,
                    message: 'Google Ad Manager data source deleted successfully'
                });
            } else {
                res.status(400).send({
                    success: false,
                    message: 'Failed to delete data source'
                });
            }
        } catch (error) {
            console.error('❌ Error deleting GAM data source:', error);
            res.status(500).send({
                success: false,
                message: 'Failed to delete Google Ad Manager data source',
                error: error.message
            });
        }
    }
);

/**
 * Get rate limit status for Google Ad Manager API
 * GET /api/google-ad-manager/rate-limit
 */
router.get('/rate-limit',
    async (req: Request, res: Response, next: any) => {
        next();
    },
    validateJWT,
    async (req: Request, res: Response) => {
        try {
            const gamService = GoogleAdManagerService.getInstance();
            const status = gamService.getRateLimitStatus();
            const stats = gamService.getRateLimitStats();
            
            res.status(200).send({
                success: true,
                data: {
                    status,
                    stats
                }
            });
        } catch (error) {
            console.error('❌ Error retrieving rate limit status:', error);
            res.status(500).send({
                success: false,
                message: 'Failed to retrieve rate limit status'
            });
        }
    }
);






export default router;
