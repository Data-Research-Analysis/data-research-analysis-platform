import express, { Request, Response } from 'express';
import { validateJWT } from '../../middleware/authenticate.js';
import multer from 'multer';
import { DatabaseBackupService } from '../../services/DatabaseBackupService.js';
import { QueueService } from '../../services/QueueService.js';
import { EUserType } from '../../types/EUserType.js';
import path from 'path';
import fs from 'fs';

const router = express.Router();

// Middleware to check if user is admin
async function requireAdmin(req: any, res: any, next: any) {
    const tokenDetails = req.tokenDetails || req.body.tokenDetails;
    console.log('Checking admin access for user type:', tokenDetails);
    if (!tokenDetails || tokenDetails.user_type !== EUserType.ADMIN) {
        return res.status(403).send({ message: 'Admin access required' });
    }
    next();
}

// Configure multer for ZIP file uploads
const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        const uploadPath = 'backend/public/uploads/backups';
        if (!fs.existsSync(uploadPath)) {
            fs.mkdirSync(uploadPath, { recursive: true });
        }
        cb(null, uploadPath);
    },
    filename: (req, file, cb) => {
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        cb(null, 'restore-' + uniqueSuffix + path.extname(file.originalname));
    }
});

const upload = multer({
    storage: storage,
    limits: { 
        fileSize: (parseInt(process.env.BACKUP_MAX_SIZE_MB || '500')) * 1024 * 1024 
    },
    fileFilter: (req, file, cb) => {
        if (file.mimetype === 'application/zip' || 
            file.mimetype === 'application/x-zip-compressed' || 
            file.originalname.endsWith('.zip')) {
            cb(null, true);
        } else {
            cb(new Error('Only ZIP files are allowed'));
        }
    }
});

/**
 * Create backup - Add to queue
 * POST /admin/database/backup
 */
router.post('/backup', validateJWT, requireAdmin, async (req: Request, res: Response) => {
    try {
        const tokenDetails = (req as any).tokenDetails || req.body.tokenDetails;
        const userId = tokenDetails.user_id;
        await QueueService.getInstance().addDatabaseBackupJob(userId);
        
        res.status(202).send({ 
            message: 'Backup job queued successfully',
            status: 'processing' 
        });
    } catch (error) {
        console.error('Error queueing backup job:', error);
        res.status(500).send({ 
            message: 'Failed to queue backup job',
            error: error instanceof Error ? error.message : 'Unknown error'
        });
    }
});

/**
 * Upload and restore backup
 * POST /admin/database/restore
 */
router.post('/restore', validateJWT, requireAdmin, upload.single('backup'), async (req: Request, res: Response) => {
    try {
        if (!req.file) {
            return res.status(400).send({ message: 'No backup file uploaded' });
        }

        const tokenDetails = (req as any).tokenDetails || req.body.tokenDetails;
        console.log('Restore - tokenDetails:', tokenDetails);
        if (!tokenDetails || !tokenDetails.user_id) {
            return res.status(400).send({ message: 'Token details not found' });
        }
        const userId = tokenDetails.user_id;
        const zipFilePath = req.file.path;

        // Validate backup file
        const isValid = await DatabaseBackupService.getInstance().validateBackupFile(zipFilePath);
        
        if (!isValid) {
            // Delete invalid file
            if (fs.existsSync(zipFilePath)) {
                fs.unlinkSync(zipFilePath);
            }
            return res.status(400).send({ 
                message: 'Invalid backup file. Please upload a valid database backup ZIP file.' 
            });
        }

        // Add restore job to queue
        await QueueService.getInstance().addDatabaseRestoreJob(zipFilePath, userId);
        
        res.status(202).send({ 
            message: 'Restore job queued successfully',
            status: 'processing',
            filename: req.file.originalname
        });
    } catch (error) {
        console.error('Error queueing restore job:', error);
        
        // Cleanup uploaded file on error
        if (req.file && fs.existsSync(req.file.path)) {
            fs.unlinkSync(req.file.path);
        }
        
        res.status(500).send({ 
            message: 'Failed to queue restore job',
            error: error instanceof Error ? error.message : 'Unknown error'
        });
    }
});

/**
 * List available backups
 * GET /admin/database/backups
 */
router.get('/backups', validateJWT, requireAdmin, async (req: Request, res: Response) => {
    try {
        const backups = await DatabaseBackupService.getInstance().listBackups();
        res.status(200).send({
            message: 'Backups retrieved successfully',
            backups: backups,
            count: backups.length
        });
    } catch (error) {
        console.error('Error listing backups:', error);
        res.status(500).send({ 
            message: 'Failed to retrieve backups',
            error: error instanceof Error ? error.message : 'Unknown error'
        });
    }
});

/**
 * Download backup
 * GET /admin/database/backup/:backupId
 */
router.get('/backup/:backupId', validateJWT, requireAdmin, async (req: Request, res: Response) => {
    try {
        const backupId = req.params.backupId;
        const backup = await DatabaseBackupService.getInstance().getBackup(backupId);
        
        if (!backup) {
            return res.status(404).send({ message: 'Backup not found' });
        }

        // Check if file exists
        if (!fs.existsSync(backup.filepath)) {
            return res.status(404).send({ message: 'Backup file not found on disk' });
        }

        // Send file for download
        res.download(backup.filepath, backup.filename, (err) => {
            if (err) {
                console.error('Error downloading backup:', err);
                if (!res.headersSent) {
                    res.status(500).send({ 
                        message: 'Failed to download backup',
                        error: err.message 
                    });
                }
            }
        });
    } catch (error) {
        console.error('Error retrieving backup:', error);
        res.status(500).send({ 
            message: 'Failed to retrieve backup',
            error: error instanceof Error ? error.message : 'Unknown error'
        });
    }
});

/**
 * Delete backup
 * DELETE /admin/database/backup/:backupId
 */
router.delete('/backup/:backupId', validateJWT, requireAdmin, async (req: Request, res: Response) => {
    try {
        const backupId = req.params.backupId;
        const success = await DatabaseBackupService.getInstance().deleteBackup(backupId);
        
        if (success) {
            res.status(200).send({ 
                message: 'Backup deleted successfully',
                backupId: backupId
            });
        } else {
            res.status(404).send({ message: 'Backup not found' });
        }
    } catch (error) {
        console.error('Error deleting backup:', error);
        res.status(500).send({ 
            message: 'Failed to delete backup',
            error: error instanceof Error ? error.message : 'Unknown error'
        });
    }
});

/**
 * Get backup metadata
 * GET /admin/database/backup/:backupId/info
 */
router.get('/backup/:backupId/info', validateJWT, requireAdmin, async (req: Request, res: Response) => {
    try {
        const backupId = req.params.backupId;
        const backup = await DatabaseBackupService.getInstance().getBackup(backupId);
        
        if (!backup) {
            return res.status(404).send({ message: 'Backup not found' });
        }

        res.status(200).send({
            message: 'Backup info retrieved successfully',
            backup: backup
        });
    } catch (error) {
        console.error('Error retrieving backup info:', error);
        res.status(500).send({ 
            message: 'Failed to retrieve backup info',
            error: error instanceof Error ? error.message : 'Unknown error'
        });
    }
});

/**
 * Cleanup old backups
 * POST /admin/database/cleanup
 */
router.post('/cleanup', validateJWT, requireAdmin, async (req: Request, res: Response) => {
    try {
        const deletedCount = await DatabaseBackupService.getInstance().cleanupOldBackups();
        
        res.status(200).send({ 
            message: `Successfully cleaned up ${deletedCount} old backup(s)`,
            deletedCount: deletedCount
        });
    } catch (error) {
        console.error('Error cleaning up backups:', error);
        res.status(500).send({ 
            message: 'Failed to cleanup old backups',
            error: error instanceof Error ? error.message : 'Unknown error'
        });
    }
});

export default router;
