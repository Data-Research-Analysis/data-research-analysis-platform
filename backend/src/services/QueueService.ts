import { Queue, Document } from "theta-mn-queue";

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
    public initializeQueues(): void {
        this.pdfConversionQueue = new Queue('DRAPdfConversionQueue');
        this.textExtractionQueue = new Queue('DRATextExtractionQueue');
        this.pdfConversionQueue.purge();
        this.textExtractionQueue.purge();
    }
    public async addPDFConversionJob(fileName: string): Promise<void> {
        return new Promise<void>(async (resolve, reject) => {
            const index = await this.pdfConversionQueue.getNextIndex();
            let response:Document = new Document({id: index, key: 'pdfConversion', content: JSON.stringify({ fileName })});
            this.pdfConversionQueue.enqueue(response);
            this.pdfConversionQueue.commit();
            resolve();
        });
    }
    public async addTextExtractionJob(fileName: string): Promise<void> {
        return new Promise<void>(async (resolve, reject) => {
            const index = await this.textExtractionQueue.getNextIndex();
            let response:Document = new Document({id: index, key: 'textExtraction', content: JSON.stringify({ fileName })});
            this.textExtractionQueue.enqueue(response);
            this.pdfConversionQueue.commit();
            resolve();
        });
    }
    public async getNextPDFConversionJob(): Promise<Document | null> {
        return new Promise<Document | null>(async (resolve, reject) => {
            const job = this.pdfConversionQueue.dequeue();
            resolve(job);
        });
    }
    public async getNextTextExtractionJob(): Promise<Document | null> {
        return new Promise<Document | null>(async (resolve, reject) => {
            const job = this.textExtractionQueue.dequeue();
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
            this.initializeQueues();
            setInterval(async () => {
                console.log('--- Queue Status ---');
                console.log(`PDF Conversion Queue Size: ${await this.pdfConversionQueue.length()}`);
                console.log(`Text Extraction Queue Size: ${await this.textExtractionQueue.length()}`);
            }, 2000);
            resolve();
        });
    }
}