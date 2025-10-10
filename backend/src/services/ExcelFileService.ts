import xlsx from 'node-xlsx';
import { dirname } from 'path';
import { fileURLToPath } from 'url';
import CPage from '../types/CPage.js';
import * as XLSX from 'xlsx';

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
    public async writeCPageToExcelFile(fileName: string, page: CPage): Promise<void> {   
        return new Promise<void>(async (resolve, reject) => {
            console.log('writeCPageToExcelFile', fileName);
            let fileMapping = new Map<string, string>();
            let data = [{}];
            page.getLines().forEach(line => {
            if (!line.getIgnoreLine()) {
                line.getWords().forEach((word, index) => {
                fileMapping.set(`column${index}`, word.getText());
                });
                let rowData = Object.fromEntries(fileMapping);
                data.push(rowData);
                fileMapping.clear();
            }
            });
            const worksheet = XLSX.utils.json_to_sheet(data);
            const workbook = XLSX.utils.book_new();
            XLSX.utils.book_append_sheet(workbook, worksheet, "Data");
            XLSX.writeFile(workbook, fileName, { compression: true });        
            return resolve();
        });
    }
}