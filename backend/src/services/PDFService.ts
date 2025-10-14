import { dirname } from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';
import { QueueService } from './QueueService.js';

export class PDFService {
    private static instance: PDFService;
    private constructor() {}
    
    public static getInstance(): PDFService {
        if (!PDFService.instance) {
            PDFService.instance = new PDFService();
        }
        return PDFService.instance;
    }

    public async extractPDFContent(fileName: string): Promise<any> {
        return new Promise<any>(async (resolve, reject) => {
            try {
                const __filename = fileURLToPath(import.meta.url);
                const __dirname = dirname(__filename);
                let baseUrl = __dirname.split('/');
                const filePath = `${baseUrl.slice(0, baseUrl.length - 2).join('/')}/public/uploads/pdf/${fileName}`;
                
                // Check if file exists
                if (!fs.existsSync(filePath)) {
                    return reject(new Error('PDF file not found'));
                }

                // For now, return basic file info
                // TODO: Add actual PDF parsing with libraries like pdf-parse
                const stats = fs.statSync(filePath);
                const fileInfo = {
                    fileName: fileName,
                    fileSize: stats.size,
                    filePath: filePath,
                    extractedAt: new Date(),
                    // Placeholder data structure - in real implementation, this would be extracted from PDF
                    tables: [],
                    text: '',
                    metadata: {
                        pages: 1,
                        hasImages: false,
                        hasTables: false
                    }
                };

                return resolve(fileInfo);
            } catch (error) {
                return reject(error);
            }
        });
    }

    public async validatePDFFile(fileName: string): Promise<boolean> {
        return new Promise<boolean>(async (resolve, reject) => {
            try {
                const __filename = fileURLToPath(import.meta.url);
                const __dirname = dirname(__filename);
                let baseUrl = __dirname.split('/');
                const filePath = `${baseUrl.slice(0, baseUrl.length - 2).join('/')}/public/uploads/pdfs/${fileName}`;
                // Check if file exists
                if (!fs.existsSync(filePath)) {
                    return resolve(false);
                }

                // Check file size (20MB limit)
                const stats = fs.statSync(filePath);
                const maxSize = 20 * 1024 * 1024; // 20MB
                if (stats.size > maxSize) {
                    return resolve(false);
                }

                return resolve(true);
            } catch (error) {
                return resolve(false);
            }
        });
    }

    public async preparePDFForDataExtraction(fileName: string): Promise<boolean> {
        return new Promise<boolean>(async (resolve, reject) => {
            try {
                // Validate PDF first
                const isValid = await this.validatePDFFile(fileName);
                if (!isValid) {
                    return reject(new Error('Invalid PDF file'));
                }
                QueueService.getInstance().addPDFConversionJob(fileName);
                return resolve(true);
            } catch (error) {
                return reject(false);
            }
        });
    }
}