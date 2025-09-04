import xlsx from 'node-xlsx';
import { dirname } from 'path';
import { fileURLToPath } from 'url';

export class ExcelFileService {
    private static instance: ExcelFileService;
    private constructor() {}
    public static getInstance(): ExcelFileService {
        if (!ExcelFileService.instance) {
            ExcelFileService.instance = new ExcelFileService();
        }
        return ExcelFileService.instance;
    }

    public async readExcelFile(fileName: string): Promise<any> {
        return new Promise<any>(async (resolve, reject) => {
            const __filename = fileURLToPath(import.meta.url);
            const __dirname = dirname(__filename);
            let baseUrl = __dirname.split('/');
            const path = `${baseUrl.slice(0, baseUrl.length - 2).join('/')}/public/uploads/${fileName}`;
            const workSheetsFromFile = xlsx.parse(path, {cellDates: true, cellHTML: false});
            return resolve(workSheetsFromFile);
        });
    }    
}