/**
 * ColumnSanitizerService
 * 
 * Handles column name sanitization and duplicate detection for file uploads
 * Ensures PostgreSQL-compatible column names and resolves conflicts
 * 
 * Features:
 * - Sanitizes column names (lowercase, alphanumeric + underscore only)
 * - Detects duplicate column names
 * - Generates unique names with numeric suffixes
 * - Tracks renamed columns for user review
 * - 63-character limit (PostgreSQL constraint)
 */

export interface RenamedColumn {
    originalIndex: number;
    originalTitle: string;
    sanitizedName: string;
    finalName: string;
    reason: 'duplicate' | 'invalid_chars' | 'too_long';
}

export interface SanitizationResult {
    columns: Array<{
        originalTitle: string;
        sanitizedKey: string;
        finalKey: string;
    }>;
    hasDuplicates: boolean;
    renamedColumns: RenamedColumn[];
}

export class ColumnSanitizerService {
    private static instance: ColumnSanitizerService;
    
    private constructor() {
        console.log('🧹 ColumnSanitizerService initialized');
    }
    
    public static getInstance(): ColumnSanitizerService {
        if (!ColumnSanitizerService.instance) {
            ColumnSanitizerService.instance = new ColumnSanitizerService();
        }
        return ColumnSanitizerService.instance;
    }
    
    private readonly MAX_COLUMN_LENGTH = 63; // PostgreSQL limit
    
    /**
     * Sanitize a single column name
     * @param name - Original column name
     * @returns Sanitized name (lowercase, alphanumeric + underscore, max 63 chars)
     */
    public sanitizeColumnName(name: string): string {
        return name
            .toLowerCase()
            .replace(/[^a-z0-9]/g, '_')
            .substring(0, this.MAX_COLUMN_LENGTH);
    }
    
    /**
     * Sanitize multiple column names and resolve duplicates
     * @param columnTitles - Array of original column titles
     * @returns Sanitization result with final column keys
     */
    public sanitizeColumns(columnTitles: string[]): SanitizationResult {
        const sanitizedNamesCount = new Map<string, number>();
        const finalNamesUsed = new Set<string>();
        const renamedColumns: RenamedColumn[] = [];
        const columns: Array<{
            originalTitle: string;
            sanitizedKey: string;
            finalKey: string;
        }> = [];
        
        // First pass: count occurrences of each sanitized name
        columnTitles.forEach((title, index) => {
            const displayTitle = title?.toString() || `Column_${index + 1}`;
            const sanitized = this.sanitizeColumnName(displayTitle);
            const count = sanitizedNamesCount.get(sanitized) || 0;
            sanitizedNamesCount.set(sanitized, count + 1);
        });
        
        // Second pass: build final column keys with duplicate resolution
        columnTitles.forEach((title, index) => {
            const displayTitle = title?.toString() || `Column_${index + 1}`;
            const sanitizedKey = this.sanitizeColumnName(displayTitle);
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
                    originalTitle: displayTitle,
                    sanitizedName: sanitizedKey,
                    finalName: finalKey,
                    reason: 'duplicate'
                });
                
                console.log(`[Duplicate Column] Column ${index}: "${displayTitle}" → "${finalKey}" (duplicate of "${sanitizedKey}")`);
            }
            // Check if sanitization changed the name significantly
            else if (sanitizedKey !== displayTitle.toLowerCase()) {
                const hasInvalidChars = /[^a-z0-9_]/.test(displayTitle.toLowerCase());
                const isTooLong = displayTitle.length > this.MAX_COLUMN_LENGTH;
                
                if (hasInvalidChars || isTooLong) {
                    renamedColumns.push({
                        originalIndex: index,
                        originalTitle: displayTitle,
                        sanitizedName: sanitizedKey,
                        finalName: finalKey,
                        reason: isTooLong ? 'too_long' : 'invalid_chars'
                    });
                    
                    console.log(`[Column Sanitization] Column ${index}: "${displayTitle}" → "${finalKey}"`);
                }
            }
            
            finalNamesUsed.add(finalKey);
            
            columns.push({
                originalTitle: displayTitle,
                sanitizedKey,
                finalKey
            });
        });
        
        return {
            columns,
            hasDuplicates: renamedColumns.length > 0,
            renamedColumns
        };
    }
    
    /**
     * Get unique column name by appending suffix
     * @param baseName - Base column name
     * @param existingNames - Set of already used names
     * @returns Unique column name
     */
    public getUniqueColumnName(baseName: string, existingNames: Set<string>): string {
        const sanitized = this.sanitizeColumnName(baseName);
        
        if (!existingNames.has(sanitized)) {
            return sanitized;
        }
        
        let counter = 1;
        let uniqueName = `${sanitized}_${counter}`;
        
        while (existingNames.has(uniqueName)) {
            counter++;
            uniqueName = `${sanitized}_${counter}`;
        }
        
        return uniqueName;
    }
    
    /**
     * Validate that a column name is PostgreSQL-compatible
     * @param name - Column name to validate
     * @returns True if valid, false otherwise
     */
    public isValidColumnName(name: string): boolean {
        // Must be lowercase alphanumeric + underscore only
        if (!/^[a-z0-9_]+$/.test(name)) {
            return false;
        }
        
        // Must not exceed PostgreSQL limit
        if (name.length > this.MAX_COLUMN_LENGTH) {
            return false;
        }
        
        // Must not start with a number (PostgreSQL rule)
        if (/^\d/.test(name)) {
            return false;
        }
        
        return true;
    }
}
