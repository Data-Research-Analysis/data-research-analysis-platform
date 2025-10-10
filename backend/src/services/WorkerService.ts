import { EOperation } from "../types/EOperation.js";
import fs from 'fs';
import path from 'path';
import { Worker } from "worker_threads";
import { dirname } from 'path';
import { fileURLToPath } from 'url';
import { SocketIODriver } from "../drivers/SocketIODriver.js";
import { ISocketEvent } from "../types/ISocketEvent.js";
import { FilesService } from "./FilesService.js";
import { QueueService } from "./QueueService.js";

export class WorkerService {
    private static instance: WorkerService;
    private constructor() {}
    public static getInstance(): WorkerService {
        if (!WorkerService.instance) {
            WorkerService.instance = new WorkerService();
        }
        return WorkerService.instance;
    }
    public runWorker(operation: EOperation, fileName: string): Promise<void> {
        return new Promise<void>(async (resolve, reject) => {
            const __filename = fileURLToPath(import.meta.url);
            const __dirname = dirname(__filename);
            const workerData = { fileName, operation, identifier: `worker-${Date.now()}` };
            const fileNameParts = __filename.split(path.sep);
            fileNameParts.pop();
            fileNameParts.pop();
            const worker = new Worker(`${fileNameParts.join(path.sep)}${path.sep}workers${path.sep}service.js`, { 
                workerData
            });
            worker.on('message', async (message) => {
                console.log('Worker message:', message);
            });
            worker.on('error', (error) => {
                console.error('Worker error:', error);
                return reject();
            });
            worker.on('exit', async (code) => {
                if (code === 0) {
                    console.log(`Worker has exited successfully with exit code ${code}`);
                    let socketEvent: string = '';
                    if (operation === EOperation.PDF_TO_IMAGES) {
                        socketEvent = ISocketEvent.PDF_TO_IMAGES_COMPLETE;
                        const extension = path.extname(fileName)
                        const fileNameWithoutExtension = fileName.replace(extension, '');
                        const directoryPath = await FilesService.getInstance().getDirectoryPath('public/uploads/pdfs/images');
                        const files = await FilesService.getInstance().readDir(directoryPath);
                        const imageFiles = files.filter(file => file.startsWith(fileNameWithoutExtension)).map(file => path.join('public', 'uploads', 'pdfs', 'images', file));
                        imageFiles.forEach(async (file) => {
                            await QueueService.getInstance().addTextExtractionJob(file);
                        });
                        await SocketIODriver.getInstance().emitEvent(socketEvent, { fileName, operation });
                    } else if (operation === EOperation.EXTRACT_TEXT_FROM_IMAGE) {
                        socketEvent = ISocketEvent.EXTRACT_TEXT_FROM_IMAGE_COMPLETE;
                        await SocketIODriver.getInstance().emitEvent(socketEvent, { fileName, operation });
                    }
                } else {
                    console.log(`Something has gone wrong and the worker has exited with error code ${code}`);
                }
                return resolve();
            });
        });
    }
}