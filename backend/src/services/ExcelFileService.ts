import xlsx from 'node-xlsx';
import { dirname } from 'path';
import { fileURLToPath } from 'url';
import CPage from '../types/CPage.js';
import * as XLSX from 'xlsx';
import { WinstonLoggerService } from './WinstonLoggerService.js';

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
            let data = await this.convertToDataArray(page);
            const worksheet = XLSX.utils.json_to_sheet(data);
            const workbook = XLSX.utils.book_new();
            XLSX.utils.book_append_sheet(workbook, worksheet, "Data");
            XLSX.writeFile(workbook, fileName, { compression: true });
            return resolve();
        });
    }
    public async convertToDataArray(page: CPage): Promise<any[]> {
        return new Promise<any[]>(async (resolve, reject) => {
            let fileMapping = new Map<string, string>();
            let data = [];
            for (let i = 0; i < page.getLines().length; i++) {
                const line = page.getLines()[i];
                if (!line.getIgnoreLine()) {
                    line.getWords().forEach((word, index) => {
                    fileMapping.set(`column${index}`, word.getText());
                    });
                    let rowData = Object.fromEntries(fileMapping);
                    data.push(rowData);
                    fileMapping.clear();
                }
            }
            return resolve(data);
        });
    }

    /**
     * Parse Excel file from disk path and extract all sheets with data
     * Optimized for large files - processes row by row
     * @param filePath - Full path to the Excel file
     * @returns Promise with array of sheets containing columns and rows
     */
    public async parseExcelFileFromPath(filePath: string): Promise<{
        sheets: Array<{
            name: string;
            index: number;
            columns: Array<{
                title: string;
                key: string;
                type: string;
                column_name: string;
            }>;
            rows: any[];
            metadata: {
                originalSheetName: string;
                rowCount: number;
                columnCount: number;
            };
        }>;
        fileName: string;
    }> {
        return new Promise(async (resolve, reject) => {
            try {
                console.log('Parsing Excel file:', filePath);
                
                // Read the workbook
                const workbook = XLSX.readFile(filePath, {
                    cellDates: true,
                    cellNF: false,
                    cellText: false
                });
                
                const sheets = [];
                
                // Process each sheet
                for (let i = 0; i < workbook.SheetNames.length; i++) {
                    const sheetName = workbook.SheetNames[i];
                    const worksheet = workbook.Sheets[sheetName];
                    
                    // Convert to JSON (array of objects)
                    const jsonData = XLSX.utils.sheet_to_json(worksheet, {
                        header: 1, // Get raw array format first
                        defval: null,
                        blankrows: false
                    });
                    
                    if (!jsonData || jsonData.length === 0) {
                        console.log(`Skipping empty sheet: ${sheetName}`);
                        continue;
                    }
                    
                    // First row is headers
                    const headers = jsonData[0] as any[];
                    const dataRows = jsonData.slice(1);
                    
                    if (!headers || headers.length === 0) {
                        console.log(`Skipping sheet with no headers: ${sheetName}`);
                        continue;
                    }
                    
                    // Build column definitions
                    const columns = headers.map((header, index) => {
                        const title = header?.toString() || `Column_${index + 1}`;
                        const sanitizedKey = title
                            .toLowerCase()
                            .replace(/[^a-z0-9]/g, '_')
                            .substring(0, 63);
                        
                        // Infer type from first non-null value
                        let type = 'text';
                        for (const row of dataRows) {
                            const value = row[index];
                            if (value !== null && value !== undefined && value !== '') {
                                if (typeof value === 'number') {
                                    type = Number.isInteger(value) ? 'integer' : 'decimal';
                                } else if (value instanceof Date) {
                                    type = 'date';
                                } else if (typeof value === 'boolean') {
                                    type = 'boolean';
                                }
                                break;
                            }
                        }
                        
                        return {
                            title,
                            key: sanitizedKey,
                            type,
                            column_name: sanitizedKey
                        };
                    });
                    
                    // Convert rows to object format with column keys
                    const rows = dataRows.map(row => {
                        const rowObj: any = {};
                        columns.forEach((col, idx) => {
                            rowObj[col.key] = row[idx] !== undefined ? row[idx] : null;
                        });
                        return rowObj;
                    });
                    
                    sheets.push({
                        name: sheetName,
                        index: i,
                        columns,
                        rows,
                        metadata: {
                            originalSheetName: sheetName,
                            rowCount: rows.length,
                            columnCount: columns.length
                        }
                    });
                    
                    console.log(`Parsed sheet: ${sheetName} (${rows.length} rows, ${columns.length} columns)`);
                }
                
                resolve({
                    sheets,
                    fileName: filePath.split('/').pop() || 'unknown'
                });
                
            } catch (error) {
                console.error('Error parsing Excel file:', error);
                reject(error);
            }
        });
    }
}