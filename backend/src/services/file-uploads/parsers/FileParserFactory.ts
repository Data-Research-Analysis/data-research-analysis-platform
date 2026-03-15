/**
 * FileParserFactory
 * 
 * Factory for creating appropriate file parser based on file extension
 * Routes files to ExcelParser, CSVParser, or future parsers
 */

import { IFileParser } from './IFileParser.js';
import { ExcelParser } from './ExcelParser.js';
import { CSVParser } from './CSVParser.js';

export class FileParserFactory {
    private static instance: FileParserFactory;
    
    private excelParser: ExcelParser;
    private csvParser: CSVParser;
    
    private constructor() {
        this.excelParser = ExcelParser.getInstance();
        this.csvParser = CSVParser.getInstance();
        console.log('🏭 FileParserFactory initialized');
    }
    
    public static getInstance(): FileParserFactory {
        if (!FileParserFactory.instance) {
            FileParserFactory.instance = new FileParserFactory();
        }
        return FileParserFactory.instance;
    }
    
    /**
     * Get appropriate parser for file based on extension
     * @param filePath - Path to file
     * @returns Parser instance
     */
    public getParser(filePath: string): IFileParser {
        const extension = this.getFileExtension(filePath);
        
        switch (extension) {
            case 'csv':
            case 'txt':
            case 'tsv':
                return this.csvParser;
            
            case 'xlsx':
            case 'xls':
            case 'xlsm':
                return this.excelParser;
            
            // Future: Add more parsers
            // case 'pdf':
            //     return this.pdfParser;
            
            default:
                // Default to Excel parser for unknown extensions
                // (will fail gracefully if not supported)
                return this.excelParser;
        }
    }
    
    /**
     * Check if file extension is supported
     * @param filePath - Path to file
     * @returns True if supported
     */
    public isSupported(filePath: string): boolean {
        const extension = this.getFileExtension(filePath);
        const supportedExtensions = [
            ...this.excelParser.getSupportedExtensions(),
            ...this.csvParser.getSupportedExtensions()
        ];
        return supportedExtensions.includes(extension);
    }
    
    /**
     * Get list of all supported extensions
     * @returns Array of extensions
     */
    public getSupportedExtensions(): string[] {
        return [
            ...this.excelParser.getSupportedExtensions(),
            ...this.csvParser.getSupportedExtensions()
        ];
    }
    
    /**
     * Extract file extension from path
     * @param filePath - Path to file
     * @returns Extension in lowercase
     */
    private getFileExtension(filePath: string): string {
        const parts = filePath.split('.');
        return parts.length > 1 ? parts[parts.length - 1].toLowerCase() : '';
    }
}
