import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import request from 'supertest';
import express from 'express';
import databaseRouter from '../../admin/database.js';
import { EUserType } from '../../../../../types/EUserType.js';

// Mock dependencies
jest.mock('../../../services/DatabaseBackupService.js');
jest.mock('../../../services/QueueService.js');
jest.mock('../../../middleware/authenticate.js', () => ({
    validateJWT: (req: any, res: any, next: any) => {
        // Attach mock token details
        req.tokenDetails = req.body.mockTokenDetails || {
            user_id: 1,
            email: 'admin@test.com',
            user_type: EUserType.ADMIN,
            iat: Math.floor(Date.now() / 1000)
        };
        next();
    }
}));

describe('Admin Database Routes', () => {
    let app: express.Application;
    let mockQueueService: any;
    let mockDatabaseBackupService: any;

    beforeEach(() => {
        // Setup Express app
        app = express();
        app.use(express.json());
        app.use('/admin/database', databaseRouter);

        // Get mocked services
        const { QueueService } = require('../../../services/QueueService.js');
        const { DatabaseBackupService } = require('../../../services/DatabaseBackupService.js');

        mockQueueService = {
            addDatabaseBackupJob: jest.fn<any>().mockResolvedValue(undefined) as any,
            addDatabaseRestoreJob: jest.fn<any>().mockResolvedValue(undefined) as any
        };

        mockDatabaseBackupService = {
            listBackups: jest.fn<any>().mockResolvedValue([]) as any,
            getBackup: jest.fn<any>().mockResolvedValue(null) as any,
            deleteBackup: jest.fn<any>().mockResolvedValue(false) as any,
            validateBackupFile: jest.fn<any>().mockResolvedValue(true) as any,
            cleanupOldBackups: jest.fn<any>().mockResolvedValue(0) as any
        };

        QueueService.getInstance = jest.fn().mockReturnValue(mockQueueService);
        DatabaseBackupService.getInstance = jest.fn().mockReturnValue(mockDatabaseBackupService);

        jest.clearAllMocks();
    });

    describe('POST /admin/database/backup', () => {
        it('should queue a backup job for admin users', async () => {
            const response = await request(app)
                .post('/admin/database/backup')
                .send({
                    mockTokenDetails: {
                        user_id: 1,
                        email: 'admin@test.com',
                        user_type: EUserType.ADMIN,
                        iat: Math.floor(Date.now() / 1000)
                    }
                });

            expect(response.status).toBe(202);
            expect(response.body.message).toContain('Backup job queued successfully');
            expect(response.body.status).toBe('processing');
            expect(mockQueueService.addDatabaseBackupJob).toHaveBeenCalledWith(1);
        });

        it('should reject non-admin users', async () => {
            const response = await request(app)
                .post('/admin/database/backup')
                .send({
                    mockTokenDetails: {
                        user_id: 2,
                        email: 'user@test.com',
                        user_type: EUserType.NORMAL,
                        iat: Math.floor(Date.now() / 1000)
                    }
                });

            expect(response.status).toBe(403);
            expect(response.body.message).toContain('Admin access required');
        });

        it('should handle errors when queueing backup', async () => {
            mockQueueService.addDatabaseBackupJob.mockRejectedValue(new Error('Queue error'));

            const response = await request(app)
                .post('/admin/database/backup')
                .send({});

            expect(response.status).toBe(500);
            expect(response.body.message).toContain('Failed to queue backup job');
        });
    });

    describe('GET /admin/database/backups', () => {
        it('should list all backups for admin users', async () => {
            const mockBackups = [
                {
                    id: '1',
                    filename: 'backup_2024-01-01.zip',
                    size: 1024000,
                    created_at: new Date()
                },
                {
                    id: '2',
                    filename: 'backup_2024-01-02.zip',
                    size: 2048000,
                    created_at: new Date()
                }
            ];

            mockDatabaseBackupService.listBackups.mockResolvedValue(mockBackups);

            const response = await request(app)
                .get('/admin/database/backups')
                .send({});

            expect(response.status).toBe(200);
            expect(response.body.backups).toHaveLength(2);
            expect(response.body.count).toBe(2);
        });

        it('should reject non-admin users', async () => {
            const response = await request(app)
                .get('/admin/database/backups')
                .send({
                    mockTokenDetails: {
                        user_id: 2,
                        email: 'user@test.com',
                        user_type: EUserType.NORMAL,
                        iat: Math.floor(Date.now() / 1000)
                    }
                });

            expect(response.status).toBe(403);
        });

        it('should return empty array when no backups exist', async () => {
            mockDatabaseBackupService.listBackups.mockResolvedValue([]);

            const response = await request(app)
                .get('/admin/database/backups')
                .send({});

            expect(response.status).toBe(200);
            expect(response.body.backups).toEqual([]);
            expect(response.body.count).toBe(0);
        });
    });

    describe('GET /admin/database/backup/:backupId/info', () => {
        it('should return backup info for valid backup ID', async () => {
            const mockBackup = {
                id: '123',
                filename: 'backup_test.zip',
                size: 5000000,
                created_at: new Date()
            };

            mockDatabaseBackupService.getBackup.mockResolvedValue(mockBackup);

            const response = await request(app)
                .get('/admin/database/backup/123/info')
                .send({});

            expect(response.status).toBe(200);
            expect(response.body.backup.id).toBe('123');
            expect(response.body.backup.filename).toBe('backup_test.zip');
        });

        it('should return 404 for non-existent backup', async () => {
            mockDatabaseBackupService.getBackup.mockResolvedValue(null);

            const response = await request(app)
                .get('/admin/database/backup/999/info')
                .send({});

            expect(response.status).toBe(404);
            expect(response.body.message).toContain('Backup not found');
        });
    });

    describe('DELETE /admin/database/backup/:backupId', () => {
        it('should delete backup successfully', async () => {
            mockDatabaseBackupService.deleteBackup.mockResolvedValue(true);

            const response = await request(app)
                .delete('/admin/database/backup/123')
                .send({});

            expect(response.status).toBe(200);
            expect(response.body.message).toContain('Backup deleted successfully');
            expect(response.body.backupId).toBe('123');
        });

        it('should return 404 if backup not found', async () => {
            mockDatabaseBackupService.deleteBackup.mockResolvedValue(false);

            const response = await request(app)
                .delete('/admin/database/backup/999')
                .send({});

            expect(response.status).toBe(404);
            expect(response.body.message).toContain('Backup not found');
        });

        it('should reject non-admin users', async () => {
            const response = await request(app)
                .delete('/admin/database/backup/123')
                .send({
                    mockTokenDetails: {
                        user_id: 2,
                        email: 'user@test.com',
                        user_type: EUserType.NORMAL,
                        iat: Math.floor(Date.now() / 1000)
                    }
                });

            expect(response.status).toBe(403);
        });
    });

    describe('POST /admin/database/cleanup', () => {
        it('should cleanup old backups successfully', async () => {
            mockDatabaseBackupService.cleanupOldBackups.mockResolvedValue(3);

            const response = await request(app)
                .post('/admin/database/cleanup')
                .send({});

            expect(response.status).toBe(200);
            expect(response.body.message).toContain('Successfully cleaned up 3 old backup(s)');
            expect(response.body.deletedCount).toBe(3);
        });

        it('should handle cleanup with no old backups', async () => {
            mockDatabaseBackupService.cleanupOldBackups.mockResolvedValue(0);

            const response = await request(app)
                .post('/admin/database/cleanup')
                .send({});

            expect(response.status).toBe(200);
            expect(response.body.deletedCount).toBe(0);
        });

        it('should handle cleanup errors', async () => {
            mockDatabaseBackupService.cleanupOldBackups.mockRejectedValue(new Error('Cleanup failed'));

            const response = await request(app)
                .post('/admin/database/cleanup')
                .send({});

            expect(response.status).toBe(500);
            expect(response.body.message).toContain('Failed to cleanup old backups');
        });
    });
});
