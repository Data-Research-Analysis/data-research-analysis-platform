import express, { Request, Response } from 'express';
import { validateJWT } from '../middleware/authenticate.js';
import { schedulerService } from '../services/SchedulerService.js';
import { DataSourceProcessor } from '../processors/DataSourceProcessor.js';
import { IAPIConnectionDetails } from '../types/IAPIConnectionDetails.js';

const router = express.Router();

/**
 * GET /api/scheduler/jobs
 * Get all scheduled jobs
 */
router.get('/jobs',
    async (req: Request, res: Response, next: any) => {
        next();
    },
    validateJWT,
    async (req: Request, res: Response) => {
        try {
            const jobs = schedulerService.getScheduledJobs();
            
            res.status(200).send({
                success: true,
                data: jobs,
                count: jobs.length
            });
        } catch (error: any) {
            console.error('❌ Failed to get scheduled jobs:', error);
            res.status(500).send({
                success: false,
                message: error.message || 'Failed to get scheduled jobs'
            });
        }
    }
);

/**
 * GET /api/scheduler/jobs/:dataSourceId
 * Get job information for a specific data source
 */
router.get('/jobs/:dataSourceId',
    async (req: Request, res: Response, next: any) => {
        next();
    },
    validateJWT,
    async (req: Request, res: Response) => {
        try {
            const dataSourceId = parseInt(req.params.dataSourceId);
            
            if (isNaN(dataSourceId)) {
                return res.status(400).send({
                    success: false,
                    message: 'Invalid data source ID'
                });
            }
            
            const job = schedulerService.getJob(dataSourceId);
            
            if (!job) {
                return res.status(404).send({
                    success: false,
                    message: 'No scheduled job found for this data source'
                });
            }
            
            res.status(200).send({
                success: true,
                data: job
            });
        } catch (error: any) {
            console.error('❌ Failed to get job:', error);
            res.status(500).send({
                success: false,
                message: error.message || 'Failed to get job'
            });
        }
    }
);

/**
 * POST /api/scheduler/jobs/:dataSourceId/schedule
 * Schedule a new job or update existing schedule
 */
router.post('/jobs/:dataSourceId/schedule',
    async (req: Request, res: Response, next: any) => {
        next();
    },
    validateJWT,
    async (req: Request, res: Response) => {
        try {
            const dataSourceId = parseInt(req.params.dataSourceId);
            
            if (isNaN(dataSourceId)) {
                return res.status(400).send({
                    success: false,
                    message: 'Invalid data source ID'
                });
            }
            
            // Get connection details
            const processor = await DataSourceProcessor.getInstance();
            const connectionDetails = await processor.getDataSource(dataSourceId);
            
            if (!connectionDetails) {
                return res.status(404).send({
                    success: false,
                    message: 'Data source not found'
                });
            }
            
            // Schedule or update job
            const success = await schedulerService.updateJobSchedule(
                dataSourceId,
                connectionDetails as IAPIConnectionDetails
            );
            
            if (success) {
                res.status(200).send({
                    success: true,
                    message: 'Job scheduled successfully'
                });
            } else {
                res.status(500).send({
                    success: false,
                    message: 'Failed to schedule job'
                });
            }
        } catch (error: any) {
            console.error('❌ Failed to schedule job:', error);
            res.status(500).send({
                success: false,
                message: error.message || 'Failed to schedule job'
            });
        }
    }
);

/**
 * POST /api/scheduler/jobs/:dataSourceId/pause
 * Pause a scheduled job
 */
router.post('/jobs/:dataSourceId/pause',
    async (req: Request, res: Response, next: any) => {
        next();
    },
    validateJWT,
    async (req: Request, res: Response) => {
        try {
            const dataSourceId = parseInt(req.params.dataSourceId);
            
            if (isNaN(dataSourceId)) {
                return res.status(400).send({
                    success: false,
                    message: 'Invalid data source ID'
                });
            }
            
            const success = await schedulerService.pauseJob(dataSourceId);
            
            if (success) {
                res.status(200).send({
                    success: true,
                    message: 'Job paused successfully'
                });
            } else {
                res.status(404).send({
                    success: false,
                    message: 'Job not found or already paused'
                });
            }
        } catch (error: any) {
            console.error('❌ Failed to pause job:', error);
            res.status(500).send({
                success: false,
                message: error.message || 'Failed to pause job'
            });
        }
    }
);

/**
 * POST /api/scheduler/jobs/:dataSourceId/resume
 * Resume a paused job
 */
router.post('/jobs/:dataSourceId/resume',
    async (req: Request, res: Response, next: any) => {
        next();
    },
    validateJWT,
    async (req: Request, res: Response) => {
        try {
            const dataSourceId = parseInt(req.params.dataSourceId);
            
            if (isNaN(dataSourceId)) {
                return res.status(400).send({
                    success: false,
                    message: 'Invalid data source ID'
                });
            }
            
            const success = await schedulerService.resumeJob(dataSourceId);
            
            if (success) {
                res.status(200).send({
                    success: true,
                    message: 'Job resumed successfully'
                });
            } else {
                res.status(404).send({
                    success: false,
                    message: 'Job not found or already running'
                });
            }
        } catch (error: any) {
            console.error('❌ Failed to resume job:', error);
            res.status(500).send({
                success: false,
                message: error.message || 'Failed to resume job'
            });
        }
    }
);

/**
 * POST /api/scheduler/jobs/:dataSourceId/trigger
 * Manually trigger a job immediately
 */
router.post('/jobs/:dataSourceId/trigger',
    async (req: Request, res: Response, next: any) => {
        next();
    },
    validateJWT,
    async (req: Request, res: Response) => {
        try {
            const dataSourceId = parseInt(req.params.dataSourceId);
            
            if (isNaN(dataSourceId)) {
                return res.status(400).send({
                    success: false,
                    message: 'Invalid data source ID'
                });
            }
            
            const success = await schedulerService.triggerJob(dataSourceId);
            
            if (success) {
                res.status(200).send({
                    success: true,
                    message: 'Job triggered successfully'
                });
            } else {
                res.status(404).send({
                    success: false,
                    message: 'Job not found'
                });
            }
        } catch (error: any) {
            console.error('❌ Failed to trigger job:', error);
            res.status(500).send({
                success: false,
                message: error.message || 'Failed to trigger job'
            });
        }
    }
);

/**
 * DELETE /api/scheduler/jobs/:dataSourceId
 * Cancel a scheduled job
 */
router.delete('/jobs/:dataSourceId',
    async (req: Request, res: Response, next: any) => {
        next();
    },
    validateJWT,
    async (req: Request, res: Response) => {
        try {
            const dataSourceId = parseInt(req.params.dataSourceId);
            
            if (isNaN(dataSourceId)) {
                return res.status(400).send({
                    success: false,
                    message: 'Invalid data source ID'
                });
            }
            
            const success = await schedulerService.cancelJob(dataSourceId);
            
            if (success) {
                res.status(200).send({
                    success: true,
                    message: 'Job cancelled successfully'
                });
            } else {
                res.status(404).send({
                    success: false,
                    message: 'Job not found'
                });
            }
        } catch (error: any) {
            console.error('❌ Failed to cancel job:', error);
            res.status(500).send({
                success: false,
                message: error.message || 'Failed to cancel job'
            });
        }
    }
);

/**
 * GET /api/scheduler/stats
 * Get scheduler statistics
 */
router.get('/stats',
    async (req: Request, res: Response, next: any) => {
        next();
    },
    validateJWT,
    async (req: Request, res: Response) => {
        try {
            const stats = schedulerService.getStats();
            
            res.status(200).send({
                success: true,
                data: stats
            });
        } catch (error: any) {
            console.error('❌ Failed to get scheduler stats:', error);
            res.status(500).send({
                success: false,
                message: error.message || 'Failed to get scheduler stats'
            });
        }
    }
);

export default router;
