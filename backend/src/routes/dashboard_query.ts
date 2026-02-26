import express, { Request, Response } from 'express';
import { validateJWT } from '../middleware/authenticate.js';
import { validate } from '../middleware/validator.js';
import { body, param, matchedData } from 'express-validator';
import { DashboardProcessor } from '../processors/DashboardProcessor.js';
import { requireDataModelPermission } from '../middleware/rbacMiddleware.js';
import { EAction } from '../services/PermissionService.js';
import { rateLimit } from 'express-rate-limit';

const router = express.Router();

// Rate limiter for dashboard queries (30 requests per minute per user)
const dashboardQueryLimiter = rateLimit({
    windowMs: 60 * 1000, // 1 minute
    max: 30,
    message: 'Too many dashboard query requests. Please try again later.',
    standardHeaders: true,
    legacyHeaders: false,
});

/**
 * POST /api/dashboard/query
 * Execute a dynamic query on a data model for dashboard charts
 */
router.post('/query',
    validateJWT,
    dashboardQueryLimiter,
    validate([
        body('data_model_id').notEmpty().isInt().toInt(),
        body('query').notEmpty().isString().trim(),
        body('query_params').optional().isObject()
    ]),
    requireDataModelPermission(EAction.READ, 'data_model_id'),
    async (req: Request, res: Response) => {
        try {
            const { data_model_id, query, query_params } = matchedData(req);

            const result = await DashboardProcessor.getInstance().executeChartQuery(
                data_model_id,
                query,
                query_params
            );

            return res.status(200).json({
                success: true,
                data: result,
                message: `Query executed successfully in ${result.executionTimeMs}ms`
            });

        } catch (error: any) {
            console.error('[Dashboard Query] Error:', error.message);
            return res.status(400).json({
                success: false,
                message: error.message || 'Failed to execute dashboard query'
            });
        }
    }
);

export default router;
