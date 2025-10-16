import { Queue, Document } from "theta-mn-queue";
import { UtilityService } from "./UtilityService.js";
import { WorkerService } from "./WorkerService.js";
import { EOperation } from "../types/EOperation.js";

export class QueueService {

    private static instance: QueueService;
    private pdfConversionQueue: Queue;
    private textExtractionQueue: Queue;
    private fileDeletionQueue: Queue;
    
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
    public async purgeQueues(): Promise<void> {
        return new Promise<void>(async (resolve, reject) => {
            await this.purgePDFConversionQueue();
            await this.purgeTextExtractionQueue();
            await this.purgeFileDeletionQueue();
            resolve();
        });
    }
    public run(): Promise<void> {
        return new Promise<void>(async (resolve, reject) => {
            await this.initializeQueues();
            setInterval(async () => {
                console.log('--- Queue Status ---');
                const numPDFConverion = await this.pdfConversionQueue.length();
                if (numPDFConverion > 0) {
                    const job: Document | null = await this.pdfConversionQueue.dequeue();
                    if (job) {
                        console.log('Processing PDF Conversion Job:', job);
                        await WorkerService.getInstance().runWorker(EOperation.PDF_TO_IMAGES, JSON.parse(job.getContent()).fileName);
                    }
                }
                const numTextExtraction = await this.textExtractionQueue.length();
                if (numTextExtraction > 0) {
                    const job: Document | null = await this.textExtractionQueue.dequeue();
                    if (job) {
                        console.log('Processing Text Extraction Job:', job);
                        await WorkerService.getInstance().runWorker(EOperation.EXTRACT_TEXT_FROM_IMAGE, JSON.parse(job.getContent()).fileName);
                    }
                }
                const numFileDeletion = await this.fileDeletionQueue.length();
                if (numFileDeletion > 0) {
                    const job: Document | null = await this.fileDeletionQueue.dequeue();
                    if (job) {
                        console.log('Processing File Deletion Job:', job);
                        await WorkerService.getInstance().runWorker(EOperation.DELETE_FILES, JSON.parse(job.getContent()).userId);
                    }
                }
            }, UtilityService.getInstance().getConstants('QUEUE_STATUS_INTERVAL'));
            resolve();
        });
    }
}