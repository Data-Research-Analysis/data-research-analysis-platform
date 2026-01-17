import express, { Request, Response } from 'express';
import { validateJWT } from '../../middleware/authenticate.js';
import { ScheduledBackupService } from '../../services/ScheduledBackupService.js';
import { ScheduledBackupProcessor } from '../../processors/ScheduledBackupProcessor.js';
import { EUserType } from '../../types/EUserType.js';
import { EBackupRunStatus } from '../../types/EBackupRunStatus.js';
import { EBackupTriggerType } from '../../types/EBackupTriggerType.js';

const router = express.Router();

// Middleware to check if user is admin
async function requireAdmin(req: any, res: any, next: any) {
    const tokenDetails = req.tokenDetails || req.body.tokenDetails;
    if (!tokenDetails || tokenDetails.user_type !== EUserType.ADMIN) {
        return res.status(403).send({ message: 'Admin access required' });
    }
    next();
}

/**
 * Get scheduler status
 * GET /admin/scheduled-backups/status
 */
router.get('/status', validateJWT, requireAdmin, async (req: Request, res: Response) => {
    try {
        const service = ScheduledBackupService.getInstance();
        const status = await service.getStatus();
        
        res.status(200).send(status);
    } catch (error) {
        console.error('Error getting scheduler status:', error);
        res.status(500).send({ 
            message: 'Failed to get scheduler status',
            error: error instanceof Error ? error.message : 'Unknown error'
        });
    }
});

/**
 * Start scheduler
 * POST /admin/scheduled-backups/start
 */
router.post('/start', validateJWT, requireAdmin, async (req: Request, res: Response) => {
    try {
        const service = ScheduledBackupService.getInstance();
        const success = await service.startScheduler();
        
        if (success) {
            res.status(200).send({ 
                message: 'Scheduler started successfully',
                status: await service.getStatus()
            });
        } else {
            res.status(400).send({ message: 'Failed to start scheduler' });
        }
    } catch (error) {
        console.error('Error starting scheduler:', error);
        res.status(500).send({ 
            message: 'Failed to start scheduler',
            error: error instanceof Error ? error.message : 'Unknown error'
        });
    }
});

/**
 * Stop scheduler
 * POST /admin/scheduled-backups/stop
 */
router.post('/stop', validateJWT, requireAdmin, async (req: Request, res: Response) => {
    try {
        const service = ScheduledBackupService.getInstance();
        const success = service.stopScheduler();
        
        if (success) {
            res.status(200).send({ 
                message: 'Scheduler stopped successfully',
                status: await service.getStatus()
            });
        } else {
            res.status(400).send({ message: 'Failed to stop scheduler' });
        }
    } catch (error) {
        console.error('Error stopping scheduler:', error);
        res.status(500).send({ 
            message: 'Failed to stop scheduler',
            error: error instanceof Error ? error.message : 'Unknown error'
        });
    }
});

/**
 * Update schedule
 * PUT /admin/scheduled-backups/schedule
 */
router.put('/schedule', validateJWT, requireAdmin, async (req: Request, res: Response) => {
    try {
        const { schedule } = req.body;
        
        if (!schedule) {
            return res.status(400).send({ message: 'Schedule is required' });
        }

        const service = ScheduledBackupService.getInstance();
        const success = service.updateSchedule(schedule);
        
        if (success) {
            res.status(200).send({ 
                message: 'Schedule updated successfully',
                status: await service.getStatus()
            });
        } else {
            res.status(400).send({ message: 'Invalid cron expression' });
        }
    } catch (error) {
        console.error('Error updating schedule:', error);
        res.status(500).send({ 
            message: 'Failed to update schedule',
            error: error instanceof Error ? error.message : 'Unknown error'
        });
    }
});

/**
 * Trigger manual backup
 * POST /admin/scheduled-backups/trigger-now
 */
router.post('/trigger-now', validateJWT, requireAdmin, async (req: Request, res: Response) => {
    try {
        const tokenDetails = (req as any).tokenDetails || req.body.tokenDetails;
        const userId = tokenDetails.user_id;

        const service = ScheduledBackupService.getInstance();
        await service.triggerManualBackup(userId);
        
        res.status(202).send({ 
            message: 'Manual backup triggered successfully',
            status: 'processing'
        });
    } catch (error) {
        console.error('Error triggering manual backup:', error);
        res.status(500).send({ 
            message: 'Failed to trigger manual backup',
            error: error instanceof Error ? error.message : 'Unknown error'
        });
    }
});

/**
 * Get backup runs history with pagination
 * GET /admin/scheduled-backups/runs
 */
router.get('/runs', validateJWT, requireAdmin, async (req: Request, res: Response) => {
    try {
        const page = parseInt(req.query.page as string) || 1;
        const limit = parseInt(req.query.limit as string) || 20;
        const status = req.query.status as EBackupRunStatus | undefined;
        const trigger_type = req.query.trigger_type as EBackupTriggerType | undefined;

        const filters: any = {};
        if (status) filters.status = status;
        if (trigger_type) filters.trigger_type = trigger_type;

        const processor = ScheduledBackupProcessor.getInstance();
        const { runs, total } = await processor.getBackupRuns(page, limit, filters);

        const totalPages = Math.ceil(total / limit);

        res.status(200).send({
            runs,
            pagination: {
                total,
                page,
                limit,
                total_pages: totalPages
            }
        });
    } catch (error) {
        console.error('Error fetching backup runs:', error);
        res.status(500).send({ 
            message: 'Failed to fetch backup runs',
            error: error instanceof Error ? error.message : 'Unknown error'
        });
    }
});

/**
 * Get specific backup run details
 * GET /admin/scheduled-backups/runs/:runId
 */
router.get('/runs/:runId', validateJWT, requireAdmin, async (req: Request, res: Response) => {
    try {
        const runId = parseInt(req.params.runId);

        if (isNaN(runId)) {
            return res.status(400).send({ message: 'Invalid run ID' });
        }

        const processor = ScheduledBackupProcessor.getInstance();
        const run = await processor.getBackupRunById(runId);

        if (!run) {
            return res.status(404).send({ message: 'Backup run not found' });
        }

        res.status(200).send(run);
    } catch (error) {
        console.error('Error fetching backup run:', error);
        res.status(500).send({ 
            message: 'Failed to fetch backup run',
            error: error instanceof Error ? error.message : 'Unknown error'
        });
    }
});

/**
 * Get backup statistics
 * GET /admin/scheduled-backups/stats
 */
router.get('/stats', validateJWT, requireAdmin, async (req: Request, res: Response) => {
    try {
        const processor = ScheduledBackupProcessor.getInstance();
        const stats = await processor.getBackupStats();

        res.status(200).send(stats);
    } catch (error) {
        console.error('Error fetching backup stats:', error);
        res.status(500).send({ 
            message: 'Failed to fetch backup stats',
            error: error instanceof Error ? error.message : 'Unknown error'
        });
    }
});

/**
 * Get scheduler configuration
 * GET /admin/scheduled-backups/config
 */
router.get('/config', validateJWT, requireAdmin, async (req: Request, res: Response) => {
    try {
        const service = ScheduledBackupService.getInstance();
        const config = service.getConfig();

        res.status(200).send(config);
    } catch (error) {
        console.error('Error fetching scheduler config:', error);
        res.status(500).send({ 
            message: 'Failed to fetch scheduler config',
            error: error instanceof Error ? error.message : 'Unknown error'
        });
    }
});

/**
 * Update scheduler configuration
 * PUT /admin/scheduled-backups/config
 */
router.put('/config', validateJWT, requireAdmin, async (req: Request, res: Response) => {
    try {
        const { schedule, enabled, retention_days, system_user_id } = req.body;

        const service = ScheduledBackupService.getInstance();
        await service.updateConfig({
            schedule,
            enabled,
            retention_days,
            system_user_id
        });

        res.status(200).send({ 
            message: 'Configuration updated successfully',
            config: service.getConfig()
        });
    } catch (error) {
        console.error('Error updating scheduler config:', error);
        res.status(500).send({ 
            message: 'Failed to update scheduler config',
            error: error instanceof Error ? error.message : 'Unknown error'
        });
    }
});

export default router;
