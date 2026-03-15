/**
 * CSVParser
 * 
 * Parser for CSV files (.csv, .txt)
 * Uses ColumnTypeInferenceService and ColumnSanitizerService
 * for unified type detection and column sanitization
 * 
 * Demonstrates the value of consolidation - entire CSV support
 * in ~80 lines vs ~300 if built standalone
 */

import * as XLSX from 'xlsx';
import { IFileParser, ParseResult, ParsedSheet, ParsedColumn } from './IFileParser.js';
import { ColumnTypeInferenceService } from '../ColumnTypeInferenceService.js';
import { ColumnSanitizerService } from '../ColumnSanitizerService.js';

export class CSVParser implements IFileParser {
    private static instance: CSVParser;
    
    private typeInferenceService: ColumnTypeInferenceService;
    private columnSanitizer: ColumnSanitizerService;
    
    private constructor() {
        this.typeInferenceService = ColumnTypeInferenceService.getInstance();
        this.columnSanitizer = ColumnSanitizerService.getInstance();
        console.log('📄 CSVParser initialized');
    }
    
    public static getInstance(): CSVParser {
        if (!CSVParser.instance) {
            CSVParser.instance = new CSVParser();
        }
        return CSVParser.instance;
    }
    
    public getParserName(): string {
        return 'CSV';
    }
    
    public getSupportedExtensions(): string[] {
        return ['csv', 'txt', 'tsv'];
    }
    
    /**
     * Parse CSV file from disk path
     * Uses xlsx library which supports CSV parsing
     */
    public async parseFile(filePath: string): Promise<ParseResult> {
        try {
            console.log('Parsing CSV file:', filePath);
            
            // Read CSV file using xlsx (supports CSV)
            const workbook = XLSX.readFile(filePath, {
                cellDates: true,
                cellNF: false,
                cellText: false,
                raw: false  // Parse values
            });
            
            // CSV files typically have one sheet
            const sheetName = workbook.SheetNames[0];
            const worksheet = workbook.Sheets[sheetName];
            
            // Convert to JSON
            const jsonData = XLSX.utils.sheet_to_json(worksheet, {
                header: 1,
                defval: null,
                blankrows: false
            });
            
            if (!jsonData || jsonData.length === 0) {
                return {
                    sheets: [],
                    fileName: filePath.split('/').pop() || 'unknown',
                    success: false,
                    error: 'CSV file is empty'
                };
            }
            
            // First row is headers
            const headers = jsonData[0] as any[];
            const dataRows = jsonData.slice(1);
            
            if (!headers || headers.length === 0) {
                return {
                    sheets: [],
                    fileName: filePath.split('/').pop() || 'unknown',
                    success: false,
                    error: 'CSV file has no headers'
                };
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
            
            const sheet: ParsedSheet = {
                name: 'CSV Data',
                index: 0,
                columns,
                rows,
                renamedColumns: sanitizationResult.renamedColumns,
                hasDuplicates: sanitizationResult.hasDuplicates,
                metadata: {
                    originalSheetName: 'CSV Data',
                    rowCount: rows.length,
                    columnCount: columns.length
                }
            };
            
            console.log(`Parsed CSV: ${rows.length} rows, ${columns.length} columns`);
            
            return {
                sheets: [sheet],
                fileName: filePath.split('/').pop() || 'unknown',
                success: true
            };
            
        } catch (error) {
            console.error('Error parsing CSV file:', error);
            return {
                sheets: [],
                fileName: filePath.split('/').pop() || 'unknown',
                success: false,
                error: error instanceof Error ? error.message : 'Unknown error'
            };
        }
    }
}
