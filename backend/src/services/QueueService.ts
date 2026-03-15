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
    private excelUploadQueue: Queue;
    
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
            this.excelUploadQueue = new Queue('DRAExcelUploadQueue');
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
    
    public async addExcelUploadJob(jobData: {
        userId: number;
        projectId: number;
        dataSourceName: string;
        fileId: string;
        data: string;
        dataSourceId?: number;
        uploadSessionId?: string;
        sheetInfo?: any;
        classification?: string | null;
    }): Promise<string> {
        return new Promise<string>(async (resolve, reject) => {
            const index = await this.excelUploadQueue.getNextIndex();
            const jobId = `excel_upload_${Date.now()}_${index}`;
            let response: Document = new Document({
                id: index,
                key: jobId,
                content: JSON.stringify(jobData)
            });
            await this.excelUploadQueue.enqueue(response);
            await this.excelUploadQueue.commit();
            resolve(jobId);
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
    
    public async getNextExcelUploadJob(): Promise<Document | null> {
        return new Promise<Document | null>(async (resolve, reject) => {
            const job = await this.excelUploadQueue.dequeue();
            await this.excelUploadQueue.commit();
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
    
    public async purgeExcelUploadQueue(): Promise<void> {
        return new Promise<void>(async (resolve, reject) => {
            await this.excelUploadQueue.purge();
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
            await this.purgeExcelUploadQueue();
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
                const numExcelUpload = await this.excelUploadQueue.length();
                if (numExcelUpload > 0) {
                    const job: Document | null = await this.excelUploadQueue.dequeue();
                    if (job) {
                        console.log('Processing Excel Upload Job:', job.getKey());
                        const jobContent = JSON.parse(job.getContent());
                        await this.processExcelUploadJob(job.getKey(), jobContent);
                    }
                }
            }, UtilityService.getInstance().getConstants('QUEUE_STATUS_INTERVAL'));
            resolve();
        });
    }
    
    private async processMongoDBSyncJob(jobData: { dataSourceId: number; syncType: string; userId?: number }): Promise<void> {
        const { dataSourceId, syncType, userId } = jobData;
        
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
                incremental: syncType === 'incremental',
                adaptiveBatchSize: true  // Enable adaptive batch sizing
            }, userId);
            
            console.log(`[QueueService] MongoDB sync completed for data source ${dataSourceId}`);
            
        } catch (error: any) {
            console.error(`[QueueService] MongoDB sync failed for data source ${dataSourceId}:`, error);
        }
    }

    private async processExcelUploadJob(jobId: string, jobData: {
        userId: number;
        projectId: number;
        dataSourceName: string;
        fileId: string;
        data: string;
        dataSourceId?: number;
        uploadSessionId?: string;
        sheetInfo?: any;
        classification?: string | null;
    }): Promise<void> {
        const { userId, projectId, dataSourceName, fileId, data, dataSourceId, uploadSessionId, sheetInfo, classification } = jobData;
        const maxRetries = 3;
        let retryCount = 0;
        
        const emitProgress = async (phase: string, progress: number, message?: string, error?: string, resultDataSourceId?: number) => {
            const { SocketIODriver } = await import('../drivers/SocketIODriver.js');
            const { ISocketEvent } = await import('../types/ISocketEvent.js');
            
            const event = {
                jobId,
                userId,
                fileId,
                fileName: sheetInfo?.file_name || fileId,
                phase,
                progress,
                message,
                error,
                dataSourceId: resultDataSourceId,
                timestamp: new Date()
            };
            
            await SocketIODriver.getInstance().emitEvent(ISocketEvent.EXCEL_UPLOAD_PROGRESS, JSON.stringify(event));
        };
        
        try {
            // Emit queued status
            await emitProgress('queued', 0, 'Upload queued');
            
            // Emit processing start
            await emitProgress('processing', 10, 'Starting Excel data processing');
            
            while (retryCount < maxRetries) {
                try {
                    const { ExcelDataSourceProcessor } = await import('../processors/ExcelDataSourceProcessor.js');
                    
                    await emitProgress('processing', 25, 'Creating table structure');
                    
                    const result = await ExcelDataSourceProcessor.getInstance().addExcelDataSource(
                        dataSourceName,
                        fileId,
                        data,
                        { user_id: userId } as any,
                        projectId,
                        dataSourceId,
                        uploadSessionId,
                        sheetInfo,
                        classification
                    );
                    
                    if (result.status === 'success') {
                        await emitProgress('completed', 100, 'Excel upload completed successfully', undefined, result.data_source_id);
                        console.log(`[QueueService] Excel upload completed: ${jobId}`);
                        return;
                    } else {
                        throw new Error('Excel upload returned error status');
                    }
                    
                } catch (error: any) {
                    retryCount++;
                    console.error(`[QueueService] Excel upload attempt ${retryCount} failed for job ${jobId}:`, error.message);
                    
                    if (retryCount < maxRetries) {
                        const backoffDelay = Math.pow(2, retryCount) * 1000; // Exponential backoff: 2s, 4s, 8s
                        await emitProgress('processing', 10 + (retryCount * 20), `Retrying upload (attempt ${retryCount + 1}/${maxRetries})...`);
                        await new Promise(resolve => setTimeout(resolve, backoffDelay));
                    } else {
                        // Parse structured error if available
                        let detailedError: any;
                        try {
                            detailedError = JSON.parse(error.message);
                        } catch {
                            detailedError = null;
                        }
                        
                        // Build user-friendly error message
                        let errorMessage = error.message;
                        if (detailedError && detailedError.rowNumber) {
                            errorMessage = `Error at row ${detailedError.rowNumber}`;
                            if (detailedError.columnName) {
                                errorMessage += ` in column "${detailedError.columnName}"`;
                            }
                            errorMessage += `: ${detailedError.detailedError || 'Data validation failed'}`;
                        }
                        
                        throw Object.assign(error, { 
                            userFriendlyMessage: errorMessage,
                            details: detailedError 
                        });
                    }
                }
            }
            
        } catch (error: any) {
            console.error(`[QueueService] Excel upload failed permanently for job ${jobId}:`, error);
            
            // Use user-friendly message if available
            const errorMessage = error.userFriendlyMessage || error.message || 'Excel upload failed after all retry attempts';
            
            await emitProgress('failed', 0, undefined, errorMessage);
        }
    }
}