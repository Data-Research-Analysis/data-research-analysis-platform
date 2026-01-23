import express, { Request, Response } from 'express';
import { validateJWT } from '../middleware/authenticate.js';
import { validate } from '../middleware/validator.js';
import { param, matchedData } from 'express-validator';
import { DataModelRefreshService } from '../services/DataModelRefreshService.js';
import { RefreshQueueService } from '../services/RefreshQueueService.js';
import { requireDataModelPermission } from '../middleware/rbacMiddleware.js';
import { EAction } from '../services/PermissionService.js';
import { rateLimit } from 'express-rate-limit';
import { PostgresDataSource } from '../datasources/PostgresDataSource.js';
import { DRADataModelRefreshHistory } from '../models/DRADataModelRefreshHistory.js';
import dotenv from 'dotenv';

dotenv.config();

const router = express.Router();

// Rate limiters
const manualRefreshLimiter = rateLimit({
    windowMs: 60 * 60 * 1000, // 1 hour
    max: 10, // 10 requests per hour
    message: 'Too many refresh requests. Please try again later.',
    standardHeaders: true,
    legacyHeaders: false,
});

const cascadeRefreshLimiter = rateLimit({
    windowMs: 60 * 60 * 1000, // 1 hour
    max: 5, // 5 requests per hour
    message: 'Too many cascade refresh requests. Please try again later.',
    standardHeaders: true,
    legacyHeaders: false,
});

/**
 * GET /api/refresh/data-model/:id
 * Get current refresh status for a data model
 */
router.get('/data-model/:id', 
    validateJWT, 
    validate([param('id').notEmpty().isInt().toInt()]),
    requireDataModelPermission(EAction.READ, 'id'),
    async (req: Request, res: Response) => {
        try {
            const { id } = matchedData(req);
            const dataModelId = parseInt(String(id), 10);

            // Get data source
            const host = process.env.POSTGRESQL_HOST || 'localhost';
            const port = parseInt(process.env.POSTGRESQL_PORT || '5432');
            const database = process.env.POSTGRESQL_DB_NAME || 'dataresearchanalysisdb';
            const username = process.env.POSTGRESQL_USERNAME || 'dataresearchanalysisuser';
            const password = process.env.POSTGRESQL_PASSWORD || 'password';
            const dataSource = PostgresDataSource.getInstance().getDataSource(host, port, database, username, password);

            if (!dataSource.isInitialized) {
                await dataSource.initialize();
            }

            // Get data model with refresh status
            const dataModel = await dataSource
                .getRepository('DRADataModel')
                .createQueryBuilder('model')
                .where('model.id = :id', { id: dataModelId })
                .select([
                    'model.id',
                    'model.name',
                    'model.refresh_status',
                    'model.last_refreshed_at',
                    'model.row_count',
                    'model.last_refresh_duration_ms',
                    'model.refresh_error',
                    'model.auto_refresh_enabled'
                ])
                .getOne();

            if (!dataModel) {
                return res.status(404).send({ message: 'Data model not found' });
            }

            // Check queue status
            const refreshQueue = RefreshQueueService.getInstance();
            const queueStats = refreshQueue.getQueueStats();

            res.status(200).send({
                dataModel,
                queueStats
            });
        } catch (error: any) {
            console.error('[RefreshAPI] Error getting refresh status:', error);
            res.status(500).send({ message: 'Failed to get refresh status', error: error.message });
        }
    }
);

/**
 * POST /api/refresh/data-model/:id
 * Manually trigger refresh for a data model
 */
router.post('/data-model/:id',
    validateJWT,
    manualRefreshLimiter,
    validate([param('id').notEmpty().isInt().toInt()]),
    requireDataModelPermission(EAction.UPDATE, 'id'),
    async (req: Request, res: Response) => {
        try {
            const { id } = matchedData(req);
            const dataModelId = parseInt(String(id), 10);
            const userId = req.body.tokenDetails.id;

            console.log(`[RefreshAPI] Manual refresh requested for data model ${dataModelId} by user ${userId}`);

            // Queue the refresh job
            const refreshQueue = RefreshQueueService.getInstance();
            const jobId = await refreshQueue.addJob(dataModelId, {
                triggeredBy: 'user',
                triggerUserId: userId,
                reason: 'Manual refresh triggered by user'
            });

            res.status(202).send({
                message: 'Refresh job queued successfully',
                jobId,
                dataModelId
            });
        } catch (error: any) {
            console.error('[RefreshAPI] Error triggering refresh:', error);
            res.status(500).send({ message: 'Failed to trigger refresh', error: error.message });
        }
    }
);

/**
 * POST /api/refresh/cascade/:sourceId
 * Trigger cascade refresh for all models dependent on a data source
 */
router.post('/cascade/:sourceId',
    validateJWT,
    cascadeRefreshLimiter,
    validate([param('sourceId').notEmpty().isInt().toInt()]),
    async (req: Request, res: Response) => {
        try {
            const { sourceId } = matchedData(req);
            const dataSourceId = parseInt(String(sourceId), 10);
            const userId = req.body.tokenDetails.id;

            console.log(`[RefreshAPI] Cascade refresh requested for data source ${dataSourceId} by user ${userId}`);

            // Find dependent models
            const refreshService = DataModelRefreshService.getInstance();
            const modelIds = await refreshService.findDependentModels(dataSourceId);

            if (modelIds.length === 0) {
                return res.status(200).send({
                    message: 'No dependent models found',
                    dataSourceId,
                    modelCount: 0
                });
            }

            // Queue refresh jobs
            const refreshQueue = RefreshQueueService.getInstance();
            const jobIds = await refreshQueue.queueRefreshForModels(modelIds, {
                triggeredBy: 'user',
                triggerUserId: userId,
                triggerSourceId: dataSourceId,
                reason: `Manual cascade refresh for data source ${dataSourceId}`
            });

            res.status(202).send({
                message: `Cascade refresh queued for ${modelIds.length} models`,
                dataSourceId,
                modelCount: modelIds.length,
                modelIds,
                jobIds
            });
        } catch (error: any) {
            console.error('[RefreshAPI] Error triggering cascade refresh:', error);
            res.status(500).send({ message: 'Failed to trigger cascade refresh', error: error.message });
        }
    }
);

/**
 * GET /api/refresh/history/:id
 * Get refresh history for a data model (last 20 records)
 */
router.get('/history/:id',
    validateJWT,
    validate([param('id').notEmpty().isInt().toInt()]),
    requireDataModelPermission(EAction.READ, 'id'),
    async (req: Request, res: Response) => {
        try {
            const { id } = matchedData(req);
            const dataModelId = parseInt(String(id), 10);

            // Get data source
            const host = process.env.POSTGRESQL_HOST || 'localhost';
            const port = parseInt(process.env.POSTGRESQL_PORT || '5432');
            const database = process.env.POSTGRESQL_DB_NAME || 'dataresearchanalysisdb';
            const username = process.env.POSTGRESQL_USERNAME || 'dataresearchanalysisuser';
            const password = process.env.POSTGRESQL_PASSWORD || 'password';
            const dataSource = PostgresDataSource.getInstance().getDataSource(host, port, database, username, password);

            if (!dataSource.isInitialized) {
                await dataSource.initialize();
            }

            // Get refresh history
            const history = await dataSource
                .getRepository(DRADataModelRefreshHistory)
                .createQueryBuilder('history')
                .where('history.data_model_id = :dataModelId', { dataModelId })
                .orderBy('history.started_at', 'DESC')
                .limit(20)
                .getMany();

            res.status(200).send({
                dataModelId,
                history
            });
        } catch (error: any) {
            console.error('[RefreshAPI] Error getting refresh history:', error);
            res.status(500).send({ message: 'Failed to get refresh history', error: error.message });
        }
    }
);

export default router;
