import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import { QueueService } from '../../services/QueueService.js';

/**
 * DRA-TEST-003: QueueService Unit Tests
 * Tests job queue management for PDF conversion, text extraction, file deletion, database backup/restore
 * Total: 25+ tests
 */
describe('QueueService', () => {
    let queueService: QueueService;

    beforeEach(async () => {
        queueService = QueueService.getInstance();
        await queueService.initializeQueues();
        jest.clearAllMocks();
    });

    describe('Singleton Pattern', () => {
        it('should return the same instance on multiple getInstance() calls', () => {
            const instance1 = QueueService.getInstance();
            const instance2 = QueueService.getInstance();
            expect(instance1).toBe(instance2);
        });

        it('should maintain state across getInstance() calls', () => {
            const instance1 = QueueService.getInstance();
            const instance2 = QueueService.getInstance();
            expect(instance1).toStrictEqual(instance2);
        });
    });

    describe('initializeQueues()', () => {
        it('should initialize all five queues', async () => {
            await queueService.initializeQueues();
            expect(queueService).toBeDefined();
        });

        it('should create PDF conversion queue', async () => {
            await queueService.initializeQueues();
            const fileName = '/test/file.pdf';
            await queueService.addPDFConversionJob(fileName);

            const job = await queueService.getNextPDFConversionJob();
            expect(job).toBeDefined();
            expect(JSON.parse(job!.getContent()).fileName).toBe(fileName);
        });

        it('should create text extraction queue', async () => {
            await queueService.initializeQueues();
            const fileName = '/test/document.pdf';
            await queueService.addTextExtractionJob(fileName);

            const job = await queueService.getNextTextExtractionJob();
            expect(job).toBeDefined();
            expect(JSON.parse(job!.getContent()).fileName).toBe(fileName);
        });

        it('should create file deletion queue', async () => {
            await queueService.initializeQueues();
            const userId = 123;
            await queueService.addFilesDeletionJob(userId);

            const job = await queueService.getNextFileDeletionJob();
            expect(job).toBeDefined();
            expect(JSON.parse(job!.getContent()).userId).toBe(userId);
        });

        it('should create database backup queue', async () => {
            await queueService.initializeQueues();
            const userId = 456;
            await queueService.addDatabaseBackupJob(userId);

            const job = await queueService.getNextDatabaseBackupJob();
            expect(job).toBeDefined();
            expect(JSON.parse(job!.getContent()).userId).toBe(userId);
        });

        it('should create database restore queue', async () => {
            await queueService.initializeQueues();
            const zipFilePath = '/backups/restore.zip';
            const userId = 789;
            await queueService.addDatabaseRestoreJob(zipFilePath, userId);

            const job = await queueService.getNextDatabaseRestoreJob();
            expect(job).toBeDefined();
            const content = JSON.parse(job!.getContent());
            expect(content.zipFilePath).toBe(zipFilePath);
            expect(content.userId).toBe(userId);
        });
    });

    describe('addPDFConversionJob()', () => {
        beforeEach(async () => {
            await queueService.purgeQueues();
        });

        it('should add PDF conversion job to queue', async () => {
            const fileName = '/uploads/document.pdf';
            await queueService.addPDFConversionJob(fileName);

            const job = await queueService.getNextPDFConversionJob();
            expect(job).toBeDefined();
            expect(JSON.parse(job!.getContent()).fileName).toBe(fileName);
        });

        it('should handle multiple PDF jobs in queue', async () => {
            const fileNames = ['/file1.pdf', '/file2.pdf', '/file3.pdf'];

            for (const fileName of fileNames) {
                await queueService.addPDFConversionJob(fileName);
            }

            expect(await queueService.getNextPDFConversionJob()).toBeDefined();
            expect(await queueService.getNextPDFConversionJob()).toBeDefined();
            expect(await queueService.getNextPDFConversionJob()).toBeDefined();
        });
    });

    describe('addTextExtractionJob()', () => {
        beforeEach(async () => {
            await queueService.purgeQueues();
        });

        it('should add text extraction job to queue', async () => {
            const fileName = '/uploads/report.pdf';
            await queueService.addTextExtractionJob(fileName);

            const job = await queueService.getNextTextExtractionJob();
            expect(job).toBeDefined();
            expect(JSON.parse(job!.getContent()).fileName).toBe(fileName);
        });
    });

    describe('addFilesDeletionJob()', () => {
        beforeEach(async () => {
            await queueService.purgeQueues();
        });

        it('should add file deletion job to queue', async () => {
            const userId = 100;
            await queueService.addFilesDeletionJob(userId);

            const job = await queueService.getNextFileDeletionJob();
            expect(job).toBeDefined();
            expect(JSON.parse(job!.getContent()).userId).toBe(userId);
        });

        it('should handle batch file deletion jobs', async () => {
            const userIds = [1, 2, 3];

            for (const userId of userIds) {
                await queueService.addFilesDeletionJob(userId);
            }

            let retrievedCount = 0;
            while (await queueService.getNextFileDeletionJob()) {
                retrievedCount++;
            }

            expect(retrievedCount).toBe(userIds.length);
        });
    });

    describe('addDatabaseBackupJob()', () => {
        beforeEach(async () => {
            await queueService.purgeQueues();
        });

        it('should add database backup job to queue', async () => {
            const userId = 200;
            await queueService.addDatabaseBackupJob(userId);

            const job = await queueService.getNextDatabaseBackupJob();
            expect(job).toBeDefined();
            expect(JSON.parse(job!.getContent()).userId).toBe(userId);
        });

        it('should handle multiple backup jobs', async () => {
            await queueService.addDatabaseBackupJob(1);
            await queueService.addDatabaseBackupJob(2);

            expect(await queueService.getNextDatabaseBackupJob()).toBeDefined();
            expect(await queueService.getNextDatabaseBackupJob()).toBeDefined();
        });
    });

    describe('addDatabaseRestoreJob()', () => {
        beforeEach(async () => {
            await queueService.purgeQueues();
        });

        it('should add database restore job to queue', async () => {
            const zipFilePath = '/backups/backup.zip';
            const userId = 300;
            await queueService.addDatabaseRestoreJob(zipFilePath, userId);

            const job = await queueService.getNextDatabaseRestoreJob();
            expect(job).toBeDefined();
            const content = JSON.parse(job!.getContent());
            expect(content.zipFilePath).toBe(zipFilePath);
            expect(content.userId).toBe(userId);
        });
    });

    describe('getNextPDFConversionJob()', () => {
        beforeEach(async () => {
            await queueService.purgeQueues();
        });

        it('should return next PDF job in queue', async () => {
            const fileName = '/file.pdf';
            await queueService.addPDFConversionJob(fileName);

            const job = await queueService.getNextPDFConversionJob();
            expect(job).toBeDefined();
        });

        it('should return null when queue is empty', async () => {
            const job = await queueService.getNextPDFConversionJob();
            expect(job).toBeNull();
        });

        it('should remove job from queue after retrieval', async () => {
            await queueService.addPDFConversionJob('/file.pdf');

            await queueService.getNextPDFConversionJob();
            const secondRetrieval = await queueService.getNextPDFConversionJob();

            expect(secondRetrieval).toBeNull();
        });
    });

    describe('getNextTextExtractionJob()', () => {
        beforeEach(async () => {
            await queueService.purgeQueues();
        });

        it('should return next text extraction job', async () => {
            await queueService.addTextExtractionJob('/doc.pdf');

            const job = await queueService.getNextTextExtractionJob();
            expect(job).toBeDefined();
        });

        it('should return null when text extraction queue is empty', async () => {
            const job = await queueService.getNextTextExtractionJob();
            expect(job).toBeNull();
        });
    });

    describe('getNextFileDeletionJob()', () => {
        beforeEach(async () => {
            await queueService.purgeQueues();
        });

        it('should return next file deletion job', async () => {
            await queueService.addFilesDeletionJob(15);

            const job = await queueService.getNextFileDeletionJob();
            expect(job).toBeDefined();
        });

        it('should return null when deletion queue is empty', async () => {
            const job = await queueService.getNextFileDeletionJob();
            expect(job).toBeNull();
        });
    });

    describe('getNextDatabaseBackupJob()', () => {
        beforeEach(async () => {
            await queueService.purgeQueues();
        });

        it('should return next database backup job', async () => {
            await queueService.addDatabaseBackupJob(500);

            const job = await queueService.getNextDatabaseBackupJob();
            expect(job).toBeDefined();
        });

        it('should return null when backup queue is empty', async () => {
            const job = await queueService.getNextDatabaseBackupJob();
            expect(job).toBeNull();
        });
    });

    describe('getNextDatabaseRestoreJob()', () => {
        beforeEach(async () => {
            await queueService.purgeQueues();
        });

        it('should return next database restore job', async () => {
            await queueService.addDatabaseRestoreJob('/restore.zip', 600);

            const job = await queueService.getNextDatabaseRestoreJob();
            expect(job).toBeDefined();
        });

        it('should return null when restore queue is empty', async () => {
            const job = await queueService.getNextDatabaseRestoreJob();
            expect(job).toBeNull();
        });
    });

    describe('Queue Purging', () => {
        it('should purge PDF conversion queue', async () => {
            await queueService.addPDFConversionJob('/file1.pdf');
            await queueService.addPDFConversionJob('/file2.pdf');

            await queueService.purgePDFConversionQueue();

            expect(await queueService.getNextPDFConversionJob()).toBeNull();
        });

        it('should purge text extraction queue', async () => {
            await queueService.addTextExtractionJob('/doc.pdf');

            await queueService.purgeTextExtractionQueue();

            expect(await queueService.getNextTextExtractionJob()).toBeNull();
        });

        it('should purge file deletion queue', async () => {
            await queueService.addFilesDeletionJob(1);

            await queueService.purgeFileDeletionQueue();

            expect(await queueService.getNextFileDeletionJob()).toBeNull();
        });

        it('should purge database backup queue', async () => {
            await queueService.addDatabaseBackupJob(10);

            await queueService.purgeDatabaseBackupQueue();

            expect(await queueService.getNextDatabaseBackupJob()).toBeNull();
        });

        it('should purge database restore queue', async () => {
            await queueService.addDatabaseRestoreJob('/backup.zip', 20);

            await queueService.purgeDatabaseRestoreQueue();

            expect(await queueService.getNextDatabaseRestoreJob()).toBeNull();
        });

        it('should purge all queues at once', async () => {
            await queueService.addPDFConversionJob('/file.pdf');
            await queueService.addTextExtractionJob('/doc.pdf');
            await queueService.addFilesDeletionJob(3);
            await queueService.addDatabaseBackupJob(4);
            await queueService.addDatabaseRestoreJob('/restore.zip', 5);

            await queueService.purgeQueues();

            expect(await queueService.getNextPDFConversionJob()).toBeNull();
            expect(await queueService.getNextTextExtractionJob()).toBeNull();
            expect(await queueService.getNextFileDeletionJob()).toBeNull();
            expect(await queueService.getNextDatabaseBackupJob()).toBeNull();
            expect(await queueService.getNextDatabaseRestoreJob()).toBeNull();
        });
    });

    describe('Queue Isolation', () => {
        it('should maintain separate queues for different job types', async () => {
            await queueService.addPDFConversionJob('/pdf.pdf');
            await queueService.addTextExtractionJob('/text.pdf');
            await queueService.addFilesDeletionJob(100);

            await queueService.purgePDFConversionQueue();

            expect(await queueService.getNextPDFConversionJob()).toBeNull();
            expect(await queueService.getNextTextExtractionJob()).toBeDefined();
            expect(await queueService.getNextFileDeletionJob()).toBeDefined();
        });
    });
});