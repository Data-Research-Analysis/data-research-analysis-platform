import { Router, Request, Response } from 'express';
import { DataQualityProcessor } from '../processors/DataQualityProcessor.js';
import { validateJWT } from '../middleware/authenticate.js';
import { authorize } from '../middleware/authorize.js';
import { Permission } from '../constants/permissions.js';

const router = Router();

/**
 * Data Quality Routes
 * Endpoints for data quality analysis and cleaning operations
 * Part of Phase 1: Data Quality & Marketing Attribution Engine
 */

/**
 * POST /data-quality/analyze/:data_model_id
 * Analyze data model and generate quality report
 */
router.post(
    '/analyze/:data_model_id',
    validateJWT,
    authorize(Permission.DATA_MODEL_VIEW),
    async (req: Request, res: Response) => {
        try {
            const dataModelId = parseInt(req.params.data_model_id);
            
            if (isNaN(dataModelId)) {
                return res.status(400).json({
                    error: 'Invalid data model ID'
                });
            }

            const result = await DataQualityProcessor.getInstance()
                .analyzeDataModel(dataModelId, req.tokenDetails);

            res.status(200).json(result);
        } catch (error) {
            console.error('Error analyzing data model:', error);
            res.status(500).json({
                error: 'Failed to analyze data model',
                message: error.message
            });
        }
    }
);

/**
 * POST /data-quality/clean/:data_model_id
 * Apply cleaning rules to data model
 */
router.post(
    '/clean/:data_model_id',
    validateJWT,
    authorize(Permission.DATA_MODEL_EDIT),
    async (req: Request, res: Response) => {
        try {
            const dataModelId = parseInt(req.params.data_model_id);
            
            if (isNaN(dataModelId)) {
                return res.status(400).json({
                    error: 'Invalid data model ID'
                });
            }

            const { cleaningConfig } = req.body;
            
            if (!cleaningConfig) {
                return res.status(400).json({
                    error: 'Cleaning configuration is required'
                });
            }

            // Merge dataModelId into cleaningConfig
            const config = {
                ...cleaningConfig,
                dataModelId
            };

            const result = await DataQualityProcessor.getInstance()
                .applyCleaningRules(dataModelId, config, req.tokenDetails);

            res.status(200).json(result);
        } catch (error) {
            console.error('Error applying cleaning rules:', error);
            res.status(500).json({
                error: 'Failed to apply cleaning rules',
                message: error.message
            });
        }
    }
);

/**
 * GET /data-quality/report/:data_model_id/latest
 * Get latest quality report for data model
 */
router.get(
    '/report/:data_model_id/latest',
    validateJWT,
    authorize(Permission.DATA_MODEL_VIEW),
    async (req: Request, res: Response) => {
        try {
            const dataModelId = parseInt(req.params.data_model_id);
            
            if (isNaN(dataModelId)) {
                return res.status(400).json({
                    error: 'Invalid data model ID'
                });
            }

            const report = await DataQualityProcessor.getInstance()
                .getLatestReport(dataModelId);

            if (!report) {
                return res.status(404).json({
                    error: 'No quality report found for this data model'
                });
            }

            res.status(200).json(report);
        } catch (error) {
            console.error('Error fetching quality report:', error);
            res.status(500).json({
                error: 'Failed to fetch quality report',
                message: error.message
            });
        }
    }
);

/**
 * GET /data-quality/history/:data_model_id
 * Get cleaning history for data model
 */
router.get(
    '/history/:data_model_id',
    validateJWT,
    authorize(Permission.DATA_MODEL_VIEW),
    async (req: Request, res: Response) => {
        try {
            const dataModelId = parseInt(req.params.data_model_id);
            
            if (isNaN(dataModelId)) {
                return res.status(400).json({
                    error: 'Invalid data model ID'
                });
            }

            const limit = parseInt(req.query.limit as string) || 50;
            const offset = parseInt(req.query.offset as string) || 0;

            const result = await DataQualityProcessor.getInstance()
                .getCleaningHistory(dataModelId, limit, offset);

            res.status(200).json(result);
        } catch (error) {
            console.error('Error fetching cleaning history:', error);
            res.status(500).json({
                error: 'Failed to fetch cleaning history',
                message: error.message
            });
        }
    }
);

export default router;
