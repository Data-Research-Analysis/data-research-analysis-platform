/**
 * Composable for column type detection and inference
 * Used by Excel, PDF, and CSV file uploads
 * 
 * Supports: boolean, number, time, date, email, url, text
 */

export interface ColumnTypeDetectionOptions {
    /**
     * Enable strict mode (require higher accuracy thresholds)
     */
    strictMode?: boolean;
    
    /**
     * Custom type detection threshold (0-1)
     */
    accuracyThreshold?: number;
}

export const useColumnTypeDetection = (options: ColumnTypeDetectionOptions = {}) => {
    const strictMode = options.strictMode ?? false;
    const defaultThreshold = options.accuracyThreshold ?? 0.8;
    const timeThreshold = 0.9; // Stricter for time detection
    
    /**
     * Check if values are boolean type
     */
    function isBooleanType(values: any[]): boolean {
        const validCount = values.filter(v => {
            if (v === null || v === '') return true;
            const str = String(v).toLowerCase().trim();
            return ['true', 'false', '1', '0', 'yes', 'no', 'y', 'n'].includes(str);
        }).length;
        return validCount / values.length >= defaultThreshold;
    }
    
    /**
     * Check if values are numeric type
     */
    function isNumberType(values: any[]): boolean {
        const validCount = values.filter(v => {
            if (v === null || v === '') return true;
            const num = Number(v);
            return !isNaN(num) && isFinite(num);
        }).length;
        return validCount / values.length >= defaultThreshold;
    }
    
    /**
     * Check if values are date type
     */
    function isDateType(values: any[]): boolean {
        const validCount = values.filter(v => {
            if (v === null || v === '') return true;
            const date = new Date(v);
            return !isNaN(date.getTime());
        }).length;
        return validCount / values.length >= defaultThreshold;
    }
    
    /**
     * Check if values are time-only type
     * Handles Excel decimals, formatted times, and Excel epoch dates
     */
    function isTimeType(values: any[]): boolean {
        const validCount = values.filter(v => {
            if (v === null || v === '') return true;
            
            const strValue = String(v).trim();
            
            // Pattern 1: HH:MM or HH:MM:SS (24-hour)
            const time24Pattern = /^([0-1]?[0-9]|2[0-3]):([0-5][0-9])(:([0-5][0-9]))?$/;
            if (time24Pattern.test(strValue)) return true;
            
            // Pattern 2: HH:MM AM/PM or HH:MM:SS AM/PM (12-hour)
            const time12Pattern = /^([0]?[1-9]|1[0-2]):([0-5][0-9])(:([0-5][0-9]))?\s*(AM|PM|am|pm)$/;
            if (time12Pattern.test(strValue)) return true;
            
            // Pattern 3: Excel numeric time (decimal between 0 and 1)
            const numValue = Number(v);
            if (!isNaN(numValue) && numValue > 0 && numValue < 1) {
                const decimalPlaces = (numValue.toString().split('.')[1] || '').length;
                if (decimalPlaces >= 5) return true; // Excel times have high precision
            }
            
            // Pattern 4: Excel time-only dates (1899-12-30 or 1899-12-31 base dates)
            if (v instanceof Date || (strValue.includes('1899') && strValue.includes('T'))) {
                const date = v instanceof Date ? v : new Date(v);
                if (!isNaN(date.getTime())) {
                    const year = date.getUTCFullYear();
                    const month = date.getUTCMonth();
                    const day = date.getUTCDate();
                    
                    if (year === 1899 && month === 11 && (day === 30 || day === 31)) {
                        return true;
                    }
                }
            }
            
            return false;
        }).length;
        
        return validCount / values.length >= timeThreshold;
    }
    
    /**
     * Check if column name suggests it's a time column
     */
    function hasTimeColumnName(columnTitle: string): boolean {
        const timeKeywords = /\b(time|hour|minute|second|duration|interval|elapsed|start_time|end_time)\b/i;
        const excludeKeywords = /\btimestamp\b/i;
        return timeKeywords.test(columnTitle) && !excludeKeywords.test(columnTitle);
    }
    
    /**
     * Find a corresponding date column for a time column
     * Used for smart detection: if "TRANSACTION TIME" has "TRANSACTION DATE", force time type
     */
    function findCorrespondingDateColumn(columnTitle: string, allColumns: Array<{ title: string }>): { title: string } | null {
        if (!hasTimeColumnName(columnTitle)) return null;
        
        const normalized = columnTitle.toLowerCase().trim();
        const baseName = normalized.replace(/[_\s]*(time|hour|minute|second)s?[_\s]*/gi, '').trim();
        
        if (!baseName) return null;
        
        return allColumns.find(col => {
            const colNormalized = col.title.toLowerCase().trim();
            const hasDateKeyword = /\b(date|day|dated)\b/i.test(colNormalized) && !/\btime\b/i.test(colNormalized);
            if (!hasDateKeyword) return false;
            
            const colBaseName = colNormalized.replace(/[_\s]*(date|day|dated)s?[_\s]*/gi, '').trim();
            return baseName === colBaseName;
        }) || null;
    }
    
    /**
     * Check if values are email type
     */
    function isEmailType(values: any[]): boolean {
        const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        const validCount = values.filter(v => 
            v === null || v === '' || emailPattern.test(String(v).trim())
        ).length;
        return validCount / values.length >= defaultThreshold;
    }
    
    /**
     * Check if values are URL type
     */
    function isUrlType(values: any[]): boolean {
        const urlPattern = /^(https?:\/\/)?([\da-z\.-]+)\.([a-z\.]{2,6})[\/\w .-]*\/?$/;
        const validCount = values.filter(v => 
            v === null || v === '' || urlPattern.test(String(v).trim())
        ).length;
        return validCount / values.length >= defaultThreshold;
    }
    
    /**
     * Infer column type from values and context
     * Order matters: boolean → number → time → date → email → url → text
     */
    function inferColumnType(
        columnValues: any[], 
        columnTitle: string = '', 
        allColumns: Array<{ title: string }> = []
    ): string {
        const nonEmptyValues = columnValues.filter(v => v !== null && v !== '');
        
        if (nonEmptyValues.length === 0) return 'text';
        
        if (isBooleanType(nonEmptyValues)) return 'boolean';
        if (isNumberType(nonEmptyValues)) return 'number';
        
        // Check for time BEFORE date (time values are valid dates, but not vice versa)
        // Smart detection: if this looks like a time column AND there's a paired date column, force time type
        if (isTimeType(nonEmptyValues) || 
            (hasTimeColumnName(columnTitle) && findCorrespondingDateColumn(columnTitle, allColumns))) {
            return 'time';
        }
        
        if (isDateType(nonEmptyValues)) return 'date';
        if (isEmailType(nonEmptyValues)) return 'email';
        if (isUrlType(nonEmptyValues)) return 'url';
        
        return 'text';
    }
    
    /**
     * Calculate optimal column width based on content and type
     */
    function calculateColumnWidth(title: string, values: any[], type: string): number {
        const maxValueLength = Math.max(
            title.length,
            ...values.map(v => String(v || '').length)
        );
        
        let width = Math.min(Math.max(maxValueLength * 10, 100), 400);
        
        // Adjust by type
        if (type === 'time') width = Math.max(width, 120);
        if (type === 'date') width = Math.max(width, 150);
        if (type === 'email') width = Math.max(width, 200);
        if (type === 'url') width = Math.max(width, 250);
        if (type === 'boolean') width = Math.max(width, 80);
        
        return width;
    }
    
    /**
     * Analyze all columns in a dataset
     * Returns columns with inferred types and calculated widths
     */
    function analyzeColumns(
        rows: Array<any>, 
        existingColumns: Array<any> = [],
        options?: { preserveForcedTypes?: boolean }
    ): Array<any> {
        if (!rows || rows.length === 0) return existingColumns;
        
        const preserveForcedTypes = options?.preserveForcedTypes ?? true;
        
        return existingColumns.map(column => {
            const columnValues = rows.map(row => {
                const rowData = row.data || row;
                return rowData[column.key];
            });
            
            let inferredType = column.inferredType || column.type || 
                inferColumnType(columnValues, column.title, existingColumns);
            const forcedType = column.forcedType || undefined;
            
            // Smart detection: if this looks like a time column AND there's a corresponding date column, force time type
            if (!forcedType && hasTimeColumnName(column.title)) {
                const correspondingDateCol = findCorrespondingDateColumn(column.title, existingColumns);
                if (correspondingDateCol) {
                    inferredType = 'time';
                }
            }
            
            const finalType = (preserveForcedTypes && forcedType) ? forcedType : inferredType;
            const width = calculateColumnWidth(column.title, columnValues, finalType);
            
            return {
                ...column,
                type: finalType,
                inferredType,
                forcedType,
                width,
                visible: column.visible ?? true,
                sortable: column.sortable ?? true,
                editable: column.editable ?? true
            };
        });
    }
    
    return {
        // Type checkers
        isBooleanType,
        isNumberType,
        isDateType,
        isTimeType,
        isEmailType,
        isUrlType,
        
        // Context helpers
        hasTimeColumnName,
        findCorrespondingDateColumn,
        
        // Main functions
        inferColumnType,
        calculateColumnWidth,
        analyzeColumns,
    };
};
