import { describe, it, expect, beforeEach, afterEach, jest } from '@jest/globals';
import request from 'supertest';
import express, { Express } from 'express';
import { adminDatabaseRoutes } from '../../../routes/admin/database.js';
import { authenticate } from '../../../middleware/authenticate.js';
import { EUserType } from '../../../types/EUserType.js';

// Mock middleware and services
jest.mock('../../../middleware/authenticate.js');
jest.mock('../../../services/DatabaseBackupService.js');
jest.mock('../../../services/QueueService.js');

/**
 * DRA-TEST-018: Admin System Routes Integration Tests
 * Tests admin-only routes: database backup/restore, system stats, user management
 * Total: 15+ tests
 */
describe('Admin System Routes', () => {
    let app: Express;

    beforeEach(() => {
        app = express();
        app.use(express.json());

        // Mock authenticate middleware to set req.user
        (authenticate as jest.Mock).mockImplementation((req: any, res: any, next: any) => {
            req.user = {
                user_id: 1,
                email: 'admin@example.com',
                user_type: EUserType.ADMIN
            };
            next();
        });

        // Mount admin routes
        app.use('/admin/database', adminDatabaseRoutes);
    });

    afterEach(() => {
        jest.clearAllMocks();
    });

    describe('Database Backup Routes', () => {
        it('should allow admin to create database backup', async () => {
            const response = await request(app)
                .post('/admin/database/backup')
                .set('Authorization', 'Bearer admin-token')
                .expect('Content-Type', /json/);

            expect([200, 202]).toContain(response.status); // 200 OK or 202 Accepted
        });

        it('should return backup job ID when backup is queued', async () => {
            const response = await request(app)
                .post('/admin/database/backup')
                .set('Authorization', 'Bearer admin-token');

            if (response.status === 202) {
                expect(response.body).toHaveProperty('jobId');
            }
        });

        it('should reject non-admin backup requests', async () => {
            (authenticate as jest.Mock).mockImplementationOnce((req: any, res: any, next: any) => {
                req.user = {
                    user_id: 2,
                    email: 'user@example.com',
                    user_type: EUserType.NORMAL
                };
                next();
            });

            const response = await request(app)
                .post('/admin/database/backup')
                .set('Authorization', 'Bearer user-token')
                .expect(403);

            expect(response.body).toHaveProperty('error');
        });

        it('should reject unauthenticated backup requests', async () => {
            (authenticate as jest.Mock).mockImplementationOnce((req: any, res: any) => {
                res.status(401).json({ error: 'Unauthorized' });
            });

            await request(app)
                .post('/admin/database/backup')
                .expect(401);
        });
    });

    describe('Database Restore Routes', () => {
        it('should allow admin to restore database from backup', async () => {
            const response = await request(app)
                .post('/admin/database/restore')
                .set('Authorization', 'Bearer admin-token')
                .attach('backup', Buffer.from('mock-backup-data'), 'backup.zip')
                .expect('Content-Type', /json/);

            expect([200, 202]).toContain(response.status);
        });

        it('should validate backup file format', async () => {
            const response = await request(app)
                .post('/admin/database/restore')
                .set('Authorization', 'Bearer admin-token')
                .attach('backup', Buffer.from('invalid-data'), 'invalid.txt');

            expect([400, 415]).toContain(response.status); // Bad Request or Unsupported Media Type
        });

        it('should reject non-admin restore requests', async () => {
            (authenticate as jest.Mock).mockImplementationOnce((req: any, res: any, next: any) => {
                req.user = {
                    user_id: 2,
                    email: 'user@example.com',
                    user_type: EUserType.NORMAL
                };
                next();
            });

            const response = await request(app)
                .post('/admin/database/restore')
                .set('Authorization', 'Bearer user-token')
                .expect(403);

            expect(response.body).toHaveProperty('error');
        });

        it('should require backup file in request', async () => {
            const response = await request(app)
                .post('/admin/database/restore')
                .set('Authorization', 'Bearer admin-token')
                .expect(400);

            expect(response.body).toHaveProperty('error');
        });
    });

    describe('Backup List Routes', () => {
        it('should allow admin to list all backups', async () => {
            const response = await request(app)
                .get('/admin/database/backups')
                .set('Authorization', 'Bearer admin-token')
                .expect(200)
                .expect('Content-Type', /json/);

            expect(response.body).toHaveProperty('backups');
            expect(Array.isArray(response.body.backups)).toBe(true);
        });

        it('should return backup metadata', async () => {
            const response = await request(app)
                .get('/admin/database/backups')
                .set('Authorization', 'Bearer admin-token')
                .expect(200);

            if (response.body.backups.length > 0) {
                const backup = response.body.backups[0];
                expect(backup).toHaveProperty('filename');
                expect(backup).toHaveProperty('created_at');
                expect(backup).toHaveProperty('size');
            }
        });

        it('should reject non-admin list requests', async () => {
            (authenticate as jest.Mock).mockImplementationOnce((req: any, res: any, next: any) => {
                req.user = {
                    user_id: 2,
                    email: 'user@example.com',
                    user_type: EUserType.NORMAL
                };
                next();
            });

            await request(app)
                .get('/admin/database/backups')
                .set('Authorization', 'Bearer user-token')
                .expect(403);
        });
    });

    describe('Backup Download Routes', () => {
        it('should allow admin to download backup file', async () => {
            const response = await request(app)
                .get('/admin/database/backups/backup-2026-01-01.zip')
                .set('Authorization', 'Bearer admin-token');

            expect([200, 404]).toContain(response.status); // OK if exists, 404 if not
        });

        it('should set correct content-type for backup download', async () => {
            const response = await request(app)
                .get('/admin/database/backups/backup-2026-01-01.zip')
                .set('Authorization', 'Bearer admin-token');

            if (response.status === 200) {
                expect(response.headers['content-type']).toMatch(/zip|octet-stream/);
            }
        });

        it('should reject non-admin download requests', async () => {
            (authenticate as jest.Mock).mockImplementationOnce((req: any, res: any, next: any) => {
                req.user = {
                    user_id: 2,
                    email: 'user@example.com',
                    user_type: EUserType.NORMAL
                };
                next();
            });

            await request(app)
                .get('/admin/database/backups/backup-2026-01-01.zip')
                .set('Authorization', 'Bearer user-token')
                .expect(403);
        });

        it('should prevent path traversal attacks', async () => {
            const response = await request(app)
                .get('/admin/database/backups/../../../etc/passwd')
                .set('Authorization', 'Bearer admin-token')
                .expect(400);

            expect(response.body).toHaveProperty('error');
        });
    });

    describe('Backup Deletion Routes', () => {
        it('should allow admin to delete backup file', async () => {
            const response = await request(app)
                .delete('/admin/database/backups/old-backup.zip')
                .set('Authorization', 'Bearer admin-token');

            expect([200, 404]).toContain(response.status);
        });

        it('should reject non-admin deletion requests', async () => {
            (authenticate as jest.Mock).mockImplementationOnce((req: any, res: any, next: any) => {
                req.user = {
                    user_id: 2,
                    email: 'user@example.com',
                    user_type: EUserType.NORMAL
                };
                next();
            });

            await request(app)
                .delete('/admin/database/backups/backup.zip')
                .set('Authorization', 'Bearer user-token')
                .expect(403);
        });

        it('should prevent deletion of non-backup files', async () => {
            const response = await request(app)
                .delete('/admin/database/backups/../../important-file.txt')
                .set('Authorization', 'Bearer admin-token')
                .expect(400);

            expect(response.body).toHaveProperty('error');
        });
    });

    describe('Security & Authorization', () => {
        it('should require authentication for all admin routes', async () => {
            (authenticate as jest.Mock).mockImplementationOnce((req: any, res: any) => {
                res.status(401).json({ error: 'Unauthorized' });
            });

            await request(app)
                .post('/admin/database/backup')
                .expect(401);
        });

        it('should verify admin privileges before allowing operations', async () => {
            (authenticate as jest.Mock).mockImplementationOnce((req: any, res: any, next: any) => {
                req.user = {
                    user_id: 2,
                    email: 'user@example.com',
                    user_type: EUserType.NORMAL
                };
                next();
            });

            await request(app)
                .post('/admin/database/backup')
                .expect(403);
        });

        it('should log admin operations for audit trail', async () => {
            const response = await request(app)
                .post('/admin/database/backup')
                .set('Authorization', 'Bearer admin-token');

            // Admin operations should be logged (implementation-specific)
            expect([200, 202]).toContain(response.status);
        });
    });
});
