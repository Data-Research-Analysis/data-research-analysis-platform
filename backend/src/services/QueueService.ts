import { Queue, Document } from "theta-mn-queue";
import { UtilityService } from "./UtilityService.js";
import { WorkerService } from "./WorkerService.js";
import { EOperation } from "../types/EOperation.js";

export class QueueService {

    private static instance: QueueService;
    private pdfConversionQueue: Queue;
    private textExtractionQueue: Queue;
    
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
    public async purgeQueues(): Promise<void> {
        return new Promise<void>(async (resolve, reject) => {
            await this.purgePDFConversionQueue();
            await this.purgeTextExtractionQueue();
            resolve();
        });
    }
    public run(): Promise<void> {
        return new Promise<void>(async (resolve, reject) => {
            await this.initializeQueues();
            setInterval(async () => {
                console.log('--- Queue Status ---');
                console.log(`PDF Conversion Queue Size: ${await this.pdfConversionQueue.length()}`);
                console.log(`Text Extraction Queue Size: ${await this.textExtractionQueue.length()}`);
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
            }, UtilityService.getInstance().getConstants('QUEUE_STATUS_INTERVAL'));
            resolve();
        });
    }
}