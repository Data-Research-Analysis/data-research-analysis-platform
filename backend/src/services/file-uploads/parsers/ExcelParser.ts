/**
 * ExcelParser
 * 
 * Parser for Excel files (.xlsx, .xls)
 * Uses ColumnTypeInferenceService and ColumnSanitizerService
 * for unified type detection and column sanitization
 */

import * as XLSX from 'xlsx';
import { IFileParser, ParseResult, ParsedSheet, ParsedColumn } from './IFileParser.js';
import { ColumnTypeInferenceService } from '../ColumnTypeInferenceService.js';
import { ColumnSanitizerService } from '../ColumnSanitizerService.js';

export class ExcelParser implements IFileParser {
    private static instance: ExcelParser;
    
    private typeInferenceService: ColumnTypeInferenceService;
    private columnSanitizer: ColumnSanitizerService;
    
    private constructor() {
        this.typeInferenceService = ColumnTypeInferenceService.getInstance();
        this.columnSanitizer = ColumnSanitizerService.getInstance();
        console.log('📗 ExcelParser initialized');
    }
    
    public static getInstance(): ExcelParser {
        if (!ExcelParser.instance) {
            ExcelParser.instance = new ExcelParser();
        }
        return ExcelParser.instance;
    }
    
    public getParserName(): string {
        return 'Excel';
    }
    
    public getSupportedExtensions(): string[] {
        return ['xlsx', 'xls', 'xlsm', 'csv'];
    }
    
    /**
     * Parse Excel file from disk path
     */
    public async parseFile(filePath: string): Promise<ParseResult> {
        try {
            console.log('Parsing Excel file:', filePath);
            
            // Read the workbook
            const workbook = XLSX.readFile(filePath, {
                cellDates: true,
                cellNF: false,
                cellText: false
            });
            
            const sheets: ParsedSheet[] = [];
            
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
                
                // Sanitize column names and detect duplicates
                const sanitizationResult = this.columnSanitizer.sanitizeColumns(headers);
                
                // Build column definitions with type inference
                const columns: ParsedColumn[] = sanitizationResult.columns.map((col, index) => {
                    // Extract all values for this column
                    const columnValues = dataRows.map(row => row[index]);
                    
                    // Infer type using shared service
                    const typeResult = this.typeInferenceService.inferColumnType(columnValues, col.originalTitle);
                    
                    // Log type inference for debugging
                    this.typeInferenceService.logTypeInference(col.originalTitle, typeResult);
                    
                    return {
                        title: col.originalTitle,
                        key: col.finalKey,
                        originalKey: col.sanitizedKey,
                        type: typeResult.type,
                        column_name: col.finalKey
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
                    renamedColumns: sanitizationResult.renamedColumns,
                    hasDuplicates: sanitizationResult.hasDuplicates,
                    metadata: {
                        originalSheetName: sheetName,
                        rowCount: rows.length,
                        columnCount: columns.length
                    }
                });
                
                console.log(`Parsed sheet: ${sheetName} (${rows.length} rows, ${columns.length} columns)`);
            }
            
            return {
                sheets,
                fileName: filePath.split('/').pop() || 'unknown',
                success: true
            };
            
        } catch (error) {
            console.error('Error parsing Excel file:', error);
            return {
                sheets: [],
                fileName: filePath.split('/').pop() || 'unknown',
                success: false,
                error: error instanceof Error ? error.message : 'Unknown error'
            };
        }
    }
}
