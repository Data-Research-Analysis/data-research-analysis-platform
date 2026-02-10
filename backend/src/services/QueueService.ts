import { Queue, Document } from "theta-mn-queue";
import { UtilityService } from "./UtilityService.js";
import { WorkerService } from "./WorkerService.js";
import { EOperation } from "../types/EOperation.js";

export class QueueService {

    private static instance: QueueService;
    private pdfConversionQueue: Queue;
    private textExtractionQueue: Queue;
    private fileDeletionQueue: Queue;
    private databaseBackupQueue: Queue;
    private databaseRestoreQueue: Queue;
    private mongodbSyncQueue: Queue;
    
    private constructor() {}

    public static getInstance(): QueueService {
        if (!QueueService.instance) {
            QueueService.instance = new QueueService();
        }
        return QueueService.instance;
    }
    public async initializeQueues(): Promise<void> {
        return new Promise<void>(async (resolve, reject) => {
            this.pdfConversionQueue = new Queue('DRAPdfConversionQueue');
            this.textExtractionQueue = new Queue('DRATextExtractionQueue');
            this.fileDeletionQueue = new Queue('DRAFileDeletionQueue');
            this.databaseBackupQueue = new Queue('DRADatabaseBackupQueue');
            this.databaseRestoreQueue = new Queue('DRADatabaseRestoreQueue');
            this.mongodbSyncQueue = new Queue('DRAMongoDBSyncQueue');
            await this.purgeQueues();
            return resolve();
        });
    }
    public async addPDFConversionJob(fileName: string): Promise<void> {
        return new Promise<void>(async (resolve, reject) => {
            const index = await this.pdfConversionQueue.getNextIndex();
            let response:Document = new Document({id: index, key: 'pdfConversion', content: JSON.stringify({ fileName })});
            await this.pdfConversionQueue.enqueue(response);
            await this.pdfConversionQueue.commit();
            resolve();
        });
    }
    public async addTextExtractionJob(fileName: string): Promise<void> {
        return new Promise<void>(async (resolve, reject) => {
            const index = await this.textExtractionQueue.getNextIndex();
            let response:Document = new Document({id: index, key: 'textExtraction', content: JSON.stringify({ fileName })});
            await this.textExtractionQueue.enqueue(response);
            await this.textExtractionQueue.commit();
            resolve();
        });
    }
    public async addFilesDeletionJob(userId: number): Promise<void> {
        return new Promise<void>(async (resolve, reject) => {
            const index = await this.fileDeletionQueue.getNextIndex();
            let response:Document = new Document({id: index, key: 'fileDeletion', content: JSON.stringify({ userId })});
            await this.fileDeletionQueue.enqueue(response);
            await this.fileDeletionQueue.commit();
            resolve();
        });
    }
    public async addDatabaseBackupJob(userId: number): Promise<void> {
        return new Promise<void>(async (resolve, reject) => {
            const index = await this.databaseBackupQueue.getNextIndex();
            let response:Document = new Document({id: index, key: 'databaseBackup', content: JSON.stringify({ userId })});
            await this.databaseBackupQueue.enqueue(response);
            await this.databaseBackupQueue.commit();
            resolve();
        });
    }
    public async addDatabaseRestoreJob(zipFilePath: string, userId: number): Promise<void> {
        return new Promise<void>(async (resolve, reject) => {
            const index = await this.databaseRestoreQueue.getNextIndex();
            let response:Document = new Document({id: index, key: 'databaseRestore', content: JSON.stringify({ zipFilePath, userId })});
            await this.databaseRestoreQueue.enqueue(response);
            await this.databaseRestoreQueue.commit();
            resolve();
        });
    }
    
    public async addJob(jobType: string, jobData: any): Promise<void> {
        if (jobType === 'mongodb-import' || jobType === 'mongodb-sync') {
            return this.addMongoDBSyncJob(jobData.dataSourceId, jobData.syncType || 'full', jobData.userId);
        }
        throw new Error(`Unknown job type: ${jobType}`);
    }
    
    public async addMongoDBSyncJob(dataSourceId: number, syncType: string, userId?: number): Promise<void> {
        return new Promise<void>(async (resolve, reject) => {
            const index = await this.mongodbSyncQueue.getNextIndex();
            let response:Document = new Document({
                id: index, 
                key: 'mongodbSync', 
                content: JSON.stringify({ dataSourceId, syncType, userId })
            });
            await this.mongodbSyncQueue.enqueue(response);
            await this.mongodbSyncQueue.commit();
            resolve();
        });
    }
    
    public async getNextPDFConversionJob(): Promise<Document | null> {
        return new Promise<Document | null>(async (resolve, reject) => {
            const job = await this.pdfConversionQueue.dequeue();
            await this.pdfConversionQueue.commit();
            resolve(job);
        });
    }
    public async getNextTextExtractionJob(): Promise<Document | null> {
        return new Promise<Document | null>(async (resolve, reject) => {
            const job = await this.textExtractionQueue.dequeue();
            await this.textExtractionQueue.commit();
            resolve(job);
        });
    }
    public async getNextFileDeletionJob(): Promise<Document | null> {
        return new Promise<Document | null>(async (resolve, reject) => {
            const job = await this.fileDeletionQueue.dequeue();
            await this.fileDeletionQueue.commit();
            resolve(job);
        });
    }
    public async getNextDatabaseBackupJob(): Promise<Document | null> {
        return new Promise<Document | null>(async (resolve, reject) => {
            const job = await this.databaseBackupQueue.dequeue();
            await this.databaseBackupQueue.commit();
            resolve(job);
        });
    }
    public async getNextDatabaseRestoreJob(): Promise<Document | null> {
        return new Promise<Document | null>(async (resolve, reject) => {
            const job = await this.databaseRestoreQueue.dequeue();
            await this.databaseRestoreQueue.commit();
            resolve(job);
        });
    }
    
    public async getNextMongoDBSyncJob(): Promise<Document | null> {
        return new Promise<Document | null>(async (resolve, reject) => {
            const job = await this.mongodbSyncQueue.dequeue();
            await this.mongodbSyncQueue.commit();
            resolve(job);
        });
    }
    
    public async purgePDFConversionQueue(): Promise<void> {
        return new Promise<void>(async (resolve, reject) => {
            await this.pdfConversionQueue.purge();
            resolve();
        });
    }
    public async purgeTextExtractionQueue(): Promise<void> {
        return new Promise<void>(async (resolve, reject) => {
            await this.textExtractionQueue.purge();
            resolve();
        });
    }
    public async purgeFileDeletionQueue(): Promise<void> {
        return new Promise<void>(async (resolve, reject) => {
            await this.fileDeletionQueue.purge();
            resolve();
        });
    }
    public async purgeDatabaseBackupQueue(): Promise<void> {
        return new Promise<void>(async (resolve, reject) => {
            await this.databaseBackupQueue.purge();
            resolve();
        });
    }
    public async purgeDatabaseRestoreQueue(): Promise<void> {
        return new Promise<void>(async (resolve, reject) => {
            await this.databaseRestoreQueue.purge();
            resolve();
        });
    }
    
    public async purgeMongoDBSyncQueue(): Promise<void> {
        return new Promise<void>(async (resolve, reject) => {
            await this.mongodbSyncQueue.purge();
            resolve();
        });
    }
    
    public async purgeQueues(): Promise<void> {
        return new Promise<void>(async (resolve, reject) => {
            await this.purgePDFConversionQueue();
            await this.purgeTextExtractionQueue();
            await this.purgeFileDeletionQueue();
            await this.purgeDatabaseBackupQueue();
            await this.purgeDatabaseRestoreQueue();
            await this.purgeMongoDBSyncQueue();
            resolve();
        });
    }
    public run(): Promise<void> {
        return new Promise<void>(async (resolve, reject) => {
            await this.initializeQueues();
            setInterval(async () => {
                // console.log('--- Queue Status ---');
                const numPDFConverion = await this.pdfConversionQueue.length();
                if (numPDFConverion > 0) {
                    const job: Document | null = await this.pdfConversionQueue.dequeue();
                    if (job) {
                        console.log('Processing PDF Conversion Job:', job);
                        await WorkerService.getInstance().runWorker(EOperation.PDF_TO_IMAGES, JSON.parse(job.getContent()).fileName, 0);
                    }
                }
                const numTextExtraction = await this.textExtractionQueue.length();
                if (numTextExtraction > 0) {
                    const job: Document | null = await this.textExtractionQueue.dequeue();
                    if (job) {
                        console.log('Processing Text Extraction Job:', job);
                        await WorkerService.getInstance().runWorker(EOperation.EXTRACT_TEXT_FROM_IMAGE, JSON.parse(job.getContent()).fileName, 0);
                    }
                }
                const numFileDeletion = await this.fileDeletionQueue.length();
                if (numFileDeletion > 0) {
                    const job: Document | null = await this.fileDeletionQueue.dequeue();
                    if (job) {
                        console.log('Processing File Deletion Job:', job);
                        await WorkerService.getInstance().runWorker(EOperation.DELETE_FILES, " ", JSON.parse(job.getContent()).userId as number);
                    }
                }
                const numDatabaseBackup = await this.databaseBackupQueue.length();
                if (numDatabaseBackup > 0) {
                    const job: Document | null = await this.databaseBackupQueue.dequeue();
                    if (job) {
                        console.log('Processing Database Backup Job:', job);
                        await WorkerService.getInstance().runWorker(EOperation.DATABASE_BACKUP, " ", JSON.parse(job.getContent()).userId as number);
                    }
                }
                const numDatabaseRestore = await this.databaseRestoreQueue.length();
                if (numDatabaseRestore > 0) {
                    const job: Document | null = await this.databaseRestoreQueue.dequeue();
                    if (job) {
                        console.log('Processing Database Restore Job:', job);
                        const jobContent = JSON.parse(job.getContent());
                        await WorkerService.getInstance().runWorker(EOperation.DATABASE_RESTORE, jobContent.zipFilePath, jobContent.userId as number);
                    }
                }
                const numMongoDBSync = await this.mongodbSyncQueue.length();
                if (numMongoDBSync > 0) {
                    const job: Document | null = await this.mongodbSyncQueue.dequeue();
                    if (job) {
                        console.log('Processing MongoDB Sync Job:', job);
                        const jobContent = JSON.parse(job.getContent());
                        await this.processMongoDBSyncJob(jobContent);
                    }
                }
            }, UtilityService.getInstance().getConstants('QUEUE_STATUS_INTERVAL'));
            resolve();
        });
    }
    
    private async processMongoDBSyncJob(jobData: { dataSourceId: number; syncType: string; userId?: number }): Promise<void> {
        const { dataSourceId, syncType } = jobData;
        
        try {
            const { DataSourceProcessor } = await import('../processors/DataSourceProcessor.js');
            const { DBDriver } = await import('../drivers/DBDriver.js');
            const { EDataSourceType } = await import('../types/EDataSourceType.js');
            const { MongoDBImportService } = await import('./MongoDBImportService.js');
            
            const processor = DataSourceProcessor.getInstance();
            const dataSource = await processor.getDataSourceById(dataSourceId);
            
            if (!dataSource) {
                console.error(`[QueueService] Data source ${dataSourceId} not found for MongoDB sync`);
                return;
            }
            
            // Get PostgreSQL DataSource instance
            const driver = await DBDriver.getInstance().getDriver(EDataSourceType.POSTGRESQL);
            if (!driver) {
                console.error(`[QueueService] PostgreSQL driver not available`);
                return;
            }
            const pgDataSource = await driver.getConcreteDriver();
            
            const importService = MongoDBImportService.getInstance(pgDataSource);
            
            await importService.importDataSource(dataSource, {
                batchSize: 1000,
                incremental: syncType === 'incremental'
            });
            
            console.log(`[QueueService] MongoDB sync completed for data source ${dataSourceId}`);
            
        } catch (error: any) {
            console.error(`[QueueService] MongoDB sync failed for data source ${dataSourceId}:`, error);
        }
    }
}