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
                let socketEvent: string = '';
                const extension = path.extname(fileName)
                const fileNameWithoutExtension = fileName.replace(extension, '');
                console.log('Message:', message.message);
                if (message && message.message === EOperation.EXTRACT_TEXT_FROM_IMAGE_COMPLETE) {
                    socketEvent = ISocketEvent.EXTRACT_TEXT_FROM_IMAGE_COMPLETE;
                    const data = { file_name: path.basename(fileNameWithoutExtension), data: message.data, operation };
                    console.log('Emitting event:', socketEvent, data);
                    await SocketIODriver.getInstance().emitEvent(socketEvent, JSON.stringify(data));
                } else if (message && message.message === EOperation.PDF_TO_IMAGES_COMPLETE) {
                    socketEvent = ISocketEvent.PDF_TO_IMAGES_COMPLETE;
                    const directoryPath = await FilesService.getInstance().getDirectoryPath('public/uploads/pdfs/images');
                    const files = await FilesService.getInstance().readDir(directoryPath);
                    const imageFiles = files.filter(file => file.startsWith(fileNameWithoutExtension)).map(file => path.join('public', 'uploads', 'pdfs', 'images', file));
                    const data = { file_name: fileNameWithoutExtension, num_pages: imageFiles.length, operation };
                    console.log('PDF_TO_IMAGES_COMPLETE data', data);
                    await SocketIODriver.getInstance().emitEvent(socketEvent, JSON.stringify(data));
                    for (let i = 0; i < imageFiles.length; i++) {
                        await QueueService.getInstance().addTextExtractionJob(imageFiles[i]);
                    }
                }
            });
            worker.on('error', (error) => {
                console.error('Worker error:', error);
                return reject();
            });
            worker.on('exit', async (code) => {
                if (code === 0) {
                    console.log(`Worker has exited successfully with exit code ${code}`);
                } else {
                    console.log(`Something has gone wrong and the worker has exited with error code ${code}`);
                }
                return resolve();
            });
        });
    }
}