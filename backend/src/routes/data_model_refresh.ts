import express, { Request, Response } from 'express';
import { validateJWT } from '../middleware/authenticate.js';
import { validate } from '../middleware/validator.js';
import { param, matchedData } from 'express-validator';
import { DataModelProcessor } from '../processors/DataModelProcessor.js';
import { requireDataModelPermission } from '../middleware/rbacMiddleware.js';
import { EAction } from '../services/PermissionService.js';
import { rateLimit } from 'express-rate-limit';

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

            const { dataModel, queueStats } = await DataModelProcessor.getInstance().getDataModelRefreshStatus(dataModelId);

            if (!dataModel) {
                return res.status(404).send({ message: 'Data model not found' });
            }

            res.status(200).send({ dataModel, queueStats });
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

            const jobId = await DataModelProcessor.getInstance().triggerDataModelRefresh(dataModelId, userId);

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

            const { modelIds, jobIds } = await DataModelProcessor.getInstance().triggerCascadeRefresh(dataSourceId, userId);

            if (modelIds.length === 0) {
                return res.status(200).send({
                    message: 'No dependent models found',
                    dataSourceId,
                    modelCount: 0
                });
            }

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

            const history = await DataModelProcessor.getInstance().getDataModelRefreshHistory(dataModelId);

            res.status(200).send({ dataModelId, history });
        } catch (error: any) {
            console.error('[RefreshAPI] Error getting refresh history:', error);
            res.status(500).send({ message: 'Failed to get refresh history', error: error.message });
        }
    }
);

export default router;
