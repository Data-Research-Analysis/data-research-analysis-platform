import express, { Request, Response } from 'express';
import { validateJWT } from '../middleware/authenticate.js';
import { globalPerformanceAggregator } from '../utils/PerformanceMetrics.js';

const router = express.Router();

/**
 * Get aggregated performance metrics for all operations
 * GET /api/performance/metrics
 */
router.get('/metrics',
    async (req: Request, res: Response, next: any) => {
        next();
    },
    validateJWT,
    async (req: Request, res: Response) => {
        try {
            const metrics = globalPerformanceAggregator.getAllMetrics();
            
            res.status(200).send({
                success: true,
                data: metrics,
                count: metrics.length
            });
        } catch (error) {
            console.error('❌ Error retrieving performance metrics:', error);
            res.status(500).send({
                success: false,
                message: 'Failed to retrieve performance metrics'
            });
        }
    }
);

/**
 * Get performance metrics for a specific operation
 * GET /api/performance/metrics/:operationName
 */
router.get('/metrics/:operationName',
    async (req: Request, res: Response, next: any) => {
        next();
    },
    validateJWT,
    async (req: Request, res: Response) => {
        try {
            const { operationName } = req.params;
            const metrics = globalPerformanceAggregator.getMetrics(operationName);
            
            if (!metrics) {
                return res.status(404).send({
                    success: false,
                    message: `No metrics found for operation: ${operationName}`
                });
            }
            
            res.status(200).send({
                success: true,
                data: metrics
            });
        } catch (error) {
            console.error('❌ Error retrieving operation metrics:', error);
            res.status(500).send({
                success: false,
                message: 'Failed to retrieve operation metrics'
            });
        }
    }
);

/**
 * Get slowest operations
 * GET /api/performance/slowest?limit=10
 */
router.get('/slowest',
    async (req: Request, res: Response, next: any) => {
        next();
    },
    validateJWT,
    async (req: Request, res: Response) => {
        try {
            const limit = parseInt(req.query.limit as string) || 10;
            const slowest = globalPerformanceAggregator.getSlowestOperations(limit);
            
            res.status(200).send({
                success: true,
                data: slowest,
                count: slowest.length
            });
        } catch (error) {
            console.error('❌ Error retrieving slowest operations:', error);
            res.status(500).send({
                success: false,
                message: 'Failed to retrieve slowest operations'
            });
        }
    }
);

/**
 * Get bottleneck analysis
 * GET /api/performance/bottlenecks
 */
router.get('/bottlenecks',
    async (req: Request, res: Response, next: any) => {
        next();
    },
    validateJWT,
    async (req: Request, res: Response) => {
        try {
            const bottlenecks = globalPerformanceAggregator.getBottleneckAnalysis();
            
            res.status(200).send({
                success: true,
                data: bottlenecks,
                count: bottlenecks.length
            });
        } catch (error) {
            console.error('❌ Error retrieving bottleneck analysis:', error);
            res.status(500).send({
                success: false,
                message: 'Failed to retrieve bottleneck analysis'
            });
        }
    }
);

/**
 * Get snapshot count
 * GET /api/performance/count?operation=operationName
 */
router.get('/count',
    async (req: Request, res: Response, next: any) => {
        next();
    },
    validateJWT,
    async (req: Request, res: Response) => {
        try {
            const operation = req.query.operation as string | undefined;
            const count = globalPerformanceAggregator.getSnapshotCount(operation);
            
            res.status(200).send({
                success: true,
                data: {
                    operation: operation || 'all',
                    count
                }
            });
        } catch (error) {
            console.error('❌ Error retrieving snapshot count:', error);
            res.status(500).send({
                success: false,
                message: 'Failed to retrieve snapshot count'
            });
        }
    }
);

/**
 * Clear performance metrics
 * DELETE /api/performance/metrics?operation=operationName
 */
router.delete('/metrics',
    async (req: Request, res: Response, next: any) => {
        next();
    },
    validateJWT,
    async (req: Request, res: Response) => {
        try {
            const operation = req.query.operation as string | undefined;
            
            if (operation) {
                globalPerformanceAggregator.clearOperation(operation);
            } else {
                globalPerformanceAggregator.clear();
            }
            
            res.status(200).send({
                success: true,
                message: operation 
                    ? `Cleared metrics for operation: ${operation}`
                    : 'Cleared all performance metrics'
            });
        } catch (error) {
            console.error('❌ Error clearing performance metrics:', error);
            res.status(500).send({
                success: false,
                message: 'Failed to clear performance metrics'
            });
        }
    }
);

export default router;
