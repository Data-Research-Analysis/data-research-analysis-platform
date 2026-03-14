/**
 * Composable for file upload validation
 * Validates file types, sizes, and content structure
 * 
 * Used by Excel, PDF, and CSV file uploads
 */

export interface FileValidationOptions {
    /**
     * Maximum file size in bytes (default: 100MB)
     */
    maxFileSize?: number;
    
    /**
     * Maximum number of files to upload at once (default: 10)
     */
    maxFiles?: number;
    
    /**
     * Custom MIME types to allow
     */
    allowedMimeTypes?: Record<string, string[]>;
}

export interface ValidationResult {
    valid: boolean;
    error?: string;
    errorCode?: string;
}

const DEFAULT_MAX_FILE_SIZE = 100 * 1024 * 1024; // 100MB
const DEFAULT_MAX_FILES = 10;

const DEFAULT_MIME_TYPES: Record<string, string[]> = {
    excel: [
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', // .xlsx
        'application/vnd.ms-excel', // .xls
    ],
    pdf: [
        'application/pdf',
    ],
    csv: [
        'text/csv',
        'text/plain', // Some systems report CSV as text/plain
        'application/csv',
    ],
};

export const useFileValidation = (options: FileValidationOptions = {}) => {
    const maxFileSize = options.maxFileSize ?? DEFAULT_MAX_FILE_SIZE;
    const maxFiles = options.maxFiles ?? DEFAULT_MAX_FILES;
    const allowedMimeTypes = options.allowedMimeTypes ?? DEFAULT_MIME_TYPES;
    
    /**
     * Format bytes to human-readable string
     */
    function formatFileSize(bytes: number): string {
        if (bytes === 0) return '0 Bytes';
        
        const k = 1024;
        const sizes = ['Bytes', 'KB', 'MB', 'GB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        
        return Math.round((bytes / Math.pow(k, i)) * 100) / 100 + ' ' + sizes[i];
    }
    
    /**
     * Get file extension from filename
     */
    function getFileExtension(filename: string): string {
        return filename.slice(((filename.lastIndexOf('.') - 1) >>> 0) + 2).toLowerCase();
    }
    
    /**
     * Validate file size
     */
    function validateFileSize(file: File): ValidationResult {
        if (file.size === 0) {
            return {
                valid: false,
                error: 'File is empty',
                errorCode: 'EMPTY_FILE',
            };
        }
        
        if (file.size > maxFileSize) {
            return {
                valid: false,
                error: `File size (${formatFileSize(file.size)}) exceeds maximum allowed size (${formatFileSize(maxFileSize)})`,
                errorCode: 'FILE_TOO_LARGE',
            };
        }
        
        return { valid: true };
    }
    
    /**
     * Validate file type for specific file format
     */
    function validateFileType(file: File, fileType: 'excel' | 'pdf' | 'csv'): ValidationResult {
        const extension = getFileExtension(file.name);
        const mimeType = file.type;
        
        const validExtensions: Record<string, string[]> = {
            excel: ['xlsx', 'xls'],
            pdf: ['pdf'],
            csv: ['csv', 'txt'],
        };
        
        const validMimeTypes = allowedMimeTypes[fileType] || [];
        
        // Check extension
        if (!validExtensions[fileType]?.includes(extension)) {
            return {
                valid: false,
                error: `Invalid file extension. Expected ${validExtensions[fileType]?.join(', ')}, got .${extension}`,
                errorCode: 'INVALID_EXTENSION',
            };
        }
        
        // Check MIME type (if provided by browser)
        if (mimeType && !validMimeTypes.includes(mimeType)) {
            // For CSV, be lenient since browsers report it differently
            if (fileType === 'csv' && extension === 'csv') {
                return { valid: true };
            }
            
            return {
                valid: false,
                error: `Invalid file type. Expected ${fileType.toUpperCase()} file`,
                errorCode: 'INVALID_MIME_TYPE',
            };
        }
        
        return { valid: true };
    }
    
    /**
     * Validate a single file
     */
    function validateFile(file: File, fileType: 'excel' | 'pdf' | 'csv'): ValidationResult {
        // Check size
        const sizeValidation = validateFileSize(file);
        if (!sizeValidation.valid) return sizeValidation;
        
        // Check type
        const typeValidation = validateFileType(file, fileType);
        if (!typeValidation.valid) return typeValidation;
        
        return { valid: true };
    }
    
    /**
     * Validate multiple files
     */
    function validateFiles(files: File[], fileType: 'excel' | 'pdf' | 'csv'): {
        valid: boolean;
        errors: Array<{ file: File; error: string; errorCode: string }>;
    } {
        const errors: Array<{ file: File; error: string; errorCode: string }> = [];
        
        // Check file count
        if (files.length > maxFiles) {
            return {
                valid: false,
                errors: [{
                    file: files[0],
                    error: `Too many files. Maximum ${maxFiles} files allowed, got ${files.length}`,
                    errorCode: 'TOO_MANY_FILES',
                }],
            };
        }
        
        // Validate each file
        files.forEach(file => {
            const result = validateFile(file, fileType);
            if (!result.valid) {
                errors.push({
                    file,
                    error: result.error!,
                    errorCode: result.errorCode!,
                });
            }
        });
        
        return {
            valid: errors.length === 0,
            errors,
        };
    }
    
    /**
     * Check if file has valid structure (after parsing)
     */
    function validateFileStructure(data: {
        sheets?: any[];
        rows?: any[];
        columns?: any[];
    }): ValidationResult {
        // Check for sheets (Excel/PDF) or rows (CSV)
        if (data.sheets) {
            if (!Array.isArray(data.sheets) || data.sheets.length === 0) {
                return {
                    valid: false,
                    error: 'File contains no sheets or pages',
                    errorCode: 'NO_SHEETS',
                };
            }
            
            // Check that at least one sheet has data
            const hasData = data.sheets.some(sheet => 
                sheet.rows && Array.isArray(sheet.rows) && sheet.rows.length > 0
            );
            
            if (!hasData) {
                return {
                    valid: false,
                    error: 'File contains no data',
                    errorCode: 'NO_DATA',
                };
            }
        } else if (data.rows) {
            if (!Array.isArray(data.rows) || data.rows.length === 0) {
                return {
                    valid: false,
                    error: 'File contains no data',
                    errorCode: 'NO_DATA',
                };
            }
        } else {
            return {
                valid: false,
                error: 'Invalid file structure',
                errorCode: 'INVALID_STRUCTURE',
            };
        }
        
        return { valid: true };
    }
    
    /**
     * Quick check if file is valid (used in drag-and-drop handlers)
     */
    function isValidFile(file: File, fileType: 'excel' | 'pdf' | 'csv'): boolean {
        return validateFile(file, fileType).valid;
    }
    
    /**
     * Get user-friendly error message
     */
    function getErrorMessage(errorCode: string, context?: any): string {
        const messages: Record<string, string> = {
            EMPTY_FILE: 'The file is empty',
            FILE_TOO_LARGE: `File is too large. Maximum size is ${formatFileSize(maxFileSize)}`,
            INVALID_EXTENSION: 'Invalid file extension',
            INVALID_MIME_TYPE: 'Invalid file type',
            TOO_MANY_FILES: `Too many files. Maximum ${maxFiles} files allowed`,
            NO_SHEETS: 'File contains no sheets or pages',
            NO_DATA: 'File contains no data',
            INVALID_STRUCTURE: 'File structure is invalid',
        };
        
        return messages[errorCode] || 'An unknown error occurred';
    }
    
    return {
        // Core validation functions
        validateFile,
        validateFiles,
        validateFileSize,
        validateFileType,
        validateFileStructure,
        
        // Utility functions
        isValidFile,
        formatFileSize,
        getFileExtension,
        getErrorMessage,
        
        // Configuration
        maxFileSize,
        maxFiles,
        allowedMimeTypes,
    };
};
