/**
 * IFileParser
 * 
 * Interface for file parsers (Excel, PDF, CSV)
 * Defines common contract for parsing different file formats
 * into a unified data structure
 */

export interface ParsedColumn {
    title: string;           // Original column title
    key: string;             // Sanitized key (final)
    originalKey: string;     // Sanitized key (before duplicate resolution)
    type: string;            // Inferred type: text, integer, bigint, decimal, date, time, boolean
    column_name: string;     // Database column name (same as key)
}

export interface ParsedSheet {
    name: string;
    index: number;
    columns: ParsedColumn[];
    rows: any[];
    renamedColumns?: Array<{
        originalIndex: number;
        originalTitle: string;
        sanitizedName: string;
        finalName: string;
        reason: string;
    }>;
    hasDuplicates?: boolean;
    metadata: {
        originalSheetName: string;
        rowCount: number;
        columnCount: number;
    };
}

export interface ParseResult {
    sheets: ParsedSheet[];
    fileName: string;
    success: boolean;
    error?: string;
}

/**
 * Base interface for all file parsers
 */
export interface IFileParser {
    /**
     * Parse file from disk path
     * @param filePath - Full path to file on disk
     * @returns Promise with parse result
     */
    parseFile(filePath: string): Promise<ParseResult>;
    
    /**
     * Get supported file extensions
     * @returns Array of file extensions (e.g., ['xlsx', 'xls'])
     */
    getSupportedExtensions(): string[];
    
    /**
     * Get parser name
     * @returns Parser name (e.g., 'Excel', 'PDF', 'CSV')
     */
    getParserName(): string;
}
