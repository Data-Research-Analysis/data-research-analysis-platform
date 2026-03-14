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
                    // Track sanitized names to detect duplicates
                    const sanitizedNamesCount = new Map<string, number>();
                    const renamedColumns: Array<{
                        originalIndex: number;
                        originalTitle: string;
                        sanitizedName: string;
                        finalName: string;
                        reason: string;
                    }> = [];
                    
                    // First pass: count occurrences of each sanitized name
                    headers.forEach((header, index) => {
                        const title = header?.toString() || `Column_${index + 1}`;
                        const sanitized = title
                            .toLowerCase()
                            .replace(/[^a-z0-9]/g, '_')
                            .substring(0, 63);
                        
                        const count = sanitizedNamesCount.get(sanitized) || 0;
                        sanitizedNamesCount.set(sanitized, count + 1);
                    });
                    
                    // Second pass: build columns with duplicate detection
                    const finalNamesUsed = new Set<string>();
                    const columns = headers.map((header, index) => {
                        const title = header?.toString() || `Column_${index + 1}`;
                        let sanitizedKey = title
                            .toLowerCase()
                            .replace(/[^a-z0-9]/g, '_')
                            .substring(0, 63);
                        
                        let finalKey = sanitizedKey;
                        
                        // If this sanitized name appears multiple times, add suffix
                        if (sanitizedNamesCount.get(sanitizedKey)! > 1) {
                            let suffixCounter = 1;
                            while (finalNamesUsed.has(`${sanitizedKey}_${suffixCounter}`)) {
                                suffixCounter++;
                            }
                            finalKey = `${sanitizedKey}_${suffixCounter}`;
                            
                            renamedColumns.push({
                                originalIndex: index,
                                originalTitle: title,
                                sanitizedName: sanitizedKey,
                                finalName: finalKey,
                                reason: 'duplicate'
                            });
                            
                            console.log(`[Duplicate Column] Column ${index}: "${title}" → "${finalKey}" (duplicate of "${sanitizedKey}")`);
                        }
                        
                        finalNamesUsed.add(finalKey);
                        
                        // Infer type by checking ALL values in the column
                        // Track min/max to choose the most appropriate numeric type
                        let type = 'text';
                        let maxNumericValue = -Infinity;
                        let minNumericValue = Infinity;
                        let hasDecimal = false;
                        let hasInteger = false;
                        let hasNonNumeric = false;
                        
                        // PostgreSQL type ranges:
                        // SMALLINT: -32,768 to 32,767
                        // INTEGER: -2,147,483,648 to 2,147,483,647
                        // BIGINT: -9,223,372,036,854,775,808 to 9,223,372,036,854,775,807
                        const MAX_INT32 = 2147483647;
                        const MIN_INT32 = -2147483648;
                        const MAX_SMALLINT = 32767;
                        const MIN_SMALLINT = -32768;
                        
                        // Common null placeholder strings to skip during type detection
                        const NULL_PLACEHOLDERS = ['NIL', 'N/A', 'NA', '#N/A', 'NULL', 'null', 'Nil', 'nil', '-', '--', 'NONE', 'None', 'none'];
                        
                        // Scan all values in this column
                        for (const row of dataRows) {
                            const value = row[index];
                            
                            // Skip null, undefined, empty strings, and common null placeholders
                            const isNullPlaceholder = typeof value === 'string' && NULL_PLACEHOLDERS.includes(value.trim());
                            if (value !== null && value !== undefined && value !== '' && !isNullPlaceholder) {
                                if (typeof value === 'number' && isFinite(value)) {
                                    // Track numeric range
                                    maxNumericValue = Math.max(maxNumericValue, value);
                                    minNumericValue = Math.min(minNumericValue, value);
                                    
                                    if (Number.isInteger(value)) {
                                        hasInteger = true;
                                    } else {
                                        hasDecimal = true;
                                    }
                                } else if (value instanceof Date) {
                                    type = 'date';
                                    hasNonNumeric = true;
                                    break;
                                } else if (typeof value === 'boolean') {
                                    type = 'boolean';
                                    hasNonNumeric = true;
                                    break;
                                } else {
                                    hasNonNumeric = true;
                                }
                            }
                        }
                        
                        // Determine best numeric type based on actual range
                        if (!hasNonNumeric && (hasInteger || hasDecimal)) {
                            if (hasDecimal) {
                                // Any decimal values → use DECIMAL
                                type = 'decimal';
                            } else if (hasInteger) {
                                // Pure integers → choose smallest type that fits
                                if (maxNumericValue <= MAX_INT32 && minNumericValue >= MIN_INT32) {
                                    type = 'integer';  // Fits in 32-bit INTEGER
                                    console.log(`[Type Detection] Column "${title}": INTEGER (range: ${minNumericValue} to ${maxNumericValue})`);
                                } else {
                                    type = 'bigint';   // Needs 64-bit BIGINT
                                    console.log(`[Type Detection] Column "${title}": BIGINT (range: ${minNumericValue} to ${maxNumericValue}) - exceeds INT32 limits`);
                                }
                            }
                        } else if (type === 'date') {
                            console.log(`[Type Detection] Column "${title}": DATE`);
                        } else if (type === 'boolean') {
                            console.log(`[Type Detection] Column "${title}": BOOLEAN`);
                        }
                        
                        return {
                            title,
                            key: finalKey,
                            originalKey: sanitizedKey,
                            type,
                            column_name: finalKey
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
                        renamedColumns,
                        hasDuplicates: renamedColumns.length > 0,
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