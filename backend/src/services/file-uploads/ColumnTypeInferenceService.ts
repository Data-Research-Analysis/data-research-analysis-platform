/**
 * ColumnTypeInferenceService
 * 
 * Unified type inference for file uploads (Excel, PDF, CSV)
 * Determines appropriate PostgreSQL column types based on data values
 * 
 * Supported Types:
 * - text: Default for string data
 * - integer: 32-bit integers (-2,147,483,648 to 2,147,483,647)
 * - bigint: 64-bit integers (exceeds INT32 range)
 * - decimal: Floating point numbers
 * - date: Date values
 * - time: Time-only values
 * - boolean: Boolean values
 */

export interface ColumnTypeResult {
    type: 'text' | 'integer' | 'bigint' | 'decimal' | 'date' | 'time' | 'boolean';
    confidence?: number;
    metadata?: {
        minValue?: number;
        maxValue?: number;
        hasDecimal?: boolean;
        hasInteger?: boolean;
    };
}

export class ColumnTypeInferenceService {
    private static instance: ColumnTypeInferenceService;
    
    private constructor() {
        console.log('📊 ColumnTypeInferenceService initialized');
    }
    
    public static getInstance(): ColumnTypeInferenceService {
        if (!ColumnTypeInferenceService.instance) {
            ColumnTypeInferenceService.instance = new ColumnTypeInferenceService();
        }
        return ColumnTypeInferenceService.instance;
    }
    
    // Common null placeholder strings to skip during type detection
    private readonly NULL_PLACEHOLDERS = [
        'NIL', 'N/A', 'NA', '#N/A', 'NULL', 'null', 'Nil', 'nil', 
        '-', '--', 'NONE', 'None', 'none'
    ];
    
    // PostgreSQL type ranges
    private readonly MAX_INT32 = 2147483647;
    private readonly MIN_INT32 = -2147483648;
    private readonly MAX_SMALLINT = 32767;
    private readonly MIN_SMALLINT = -32768;
    
    /**
     * Check if value is a null placeholder
     */
    private isNullPlaceholder(value: any): boolean {
        return typeof value === 'string' && this.NULL_PLACEHOLDERS.includes(value.trim());
    }
    
    /**
     * Check if string value is a time-only value (HH:MM:SS, HH:MM:SS.mmm, HH:MM)
     * Does NOT match if it contains date components
     */
    private isTimeOnly(value: string): boolean {
        const trimmed = value.trim();
        
        // Match HH:MM:SS.mmm, HH:MM:SS, or HH:MM format
        // Must NOT contain date separators (/, -) or date words
        const timeRegex = /^(?:[01]\d|2[0-3]):[0-5]\d(?::[0-5]\d(?:\.\d{1,6})?)?$/;
        
        if (!timeRegex.test(trimmed)) {
            return false;
        }
        
        // Ensure no date components
        if (trimmed.includes('/') || trimmed.includes('-') || /\d{4}/.test(trimmed)) {
            return false;
        }
        
        return true;
    }
    
    /**
     * Check if string value is a date value (with or without time component)
     * Supports various formats: ISO, US, European, etc.
     */
    private isDateString(value: string): boolean {
        const trimmed = value.trim();
        
        // Skip pure time values
        if (this.isTimeOnly(trimmed)) {
            return false;
        }
        
        // Try parsing as date
        const parsed = new Date(trimmed);
        return !isNaN(parsed.getTime());
    }
    
    /**
     * Infer column type from array of values
     * @param values - Array of column values to analyze
     * @param columnTitle - Optional column title for context-based inference
     * @returns Inferred type with metadata
     */
    public inferColumnType(values: any[], columnTitle?: string): ColumnTypeResult {
        // Filter out null, undefined, empty strings, and null placeholders
        const nonEmptyValues = values.filter(v => 
            v !== null && 
            v !== undefined && 
            v !== '' && 
            !this.isNullPlaceholder(v)
        );
        
        if (nonEmptyValues.length === 0) {
            return { type: 'text' };
        }
        
        // Track numeric range
        let maxNumericValue = -Infinity;
        let minNumericValue = Infinity;
        let hasDecimal = false;
        let hasInteger = false;
        let hasNonNumeric = false;
        let allDates = true;
        let allTimes = true;
        let allBooleans = true;
        
        // Scan all non-empty values
        for (const value of nonEmptyValues) {
            // Check for numbers
            if (typeof value === 'number' && isFinite(value)) {
                allDates = false;
                allTimes = false;
                allBooleans = false;
                
                maxNumericValue = Math.max(maxNumericValue, value);
                minNumericValue = Math.min(minNumericValue, value);
                
                if (Number.isInteger(value)) {
                    hasInteger = true;
                } else {
                    hasDecimal = true;
                }
            }
            // Check for Date objects
            else if (value instanceof Date) {
                allBooleans = false;
                allTimes = false;
                hasNonNumeric = true;
                if (!allDates) {
                    // Mixed types - default to text
                    return { type: 'text' };
                }
            }
            // Check for time-only strings (before checking dates, since dates can parse times)
            else if (typeof value === 'string' && this.isTimeOnly(value)) {
                allDates = false;
                allBooleans = false;
                hasNonNumeric = true;
                if (!allTimes) {
                    // Mixed types - default to text
                    return { type: 'text' };
                }
            }
            // Check for date strings (after time check)
            else if (typeof value === 'string' && this.isDateString(value)) {
                allBooleans = false;
                allTimes = false;
                hasNonNumeric = true;
                if (!allDates) {
                    // Mixed types - default to text
                    return { type: 'text' };
                }
            }
            // Check for booleans
            else if (typeof value === 'boolean') {
                allDates = false;
                allTimes = false;
                hasNonNumeric = true;
                if (!allBooleans) {
                    // Mixed types - default to text
                    return { type: 'text' };
                }
            }
            // Everything else is non-numeric
            else {
                allDates = false;
                allTimes = false;
                allBooleans = false;
                hasNonNumeric = true;
            }
        }
        
        // Determine best type based on analysis
        if (allBooleans && !hasNonNumeric && !hasInteger && !hasDecimal) {
            return { type: 'boolean' };
        }
        
        if (allTimes && hasNonNumeric && !hasInteger && !hasDecimal && !allDates) {
            return { type: 'time' };
        }
        
        if (allDates && hasNonNumeric && !hasInteger && !hasDecimal && !allTimes) {
            return { type: 'date' };
        }
        
        if (!hasNonNumeric && (hasInteger || hasDecimal)) {
            if (hasDecimal) {
                // Any decimal values → use DECIMAL
                return {
                    type: 'decimal',
                    metadata: {
                        minValue: minNumericValue,
                        maxValue: maxNumericValue,
                        hasDecimal: true,
                        hasInteger: hasInteger
                    }
                };
            } else if (hasInteger) {
                // Pure integers → choose smallest type that fits
                if (maxNumericValue <= this.MAX_INT32 && minNumericValue >= this.MIN_INT32) {
                    return {
                        type: 'integer',
                        metadata: {
                            minValue: minNumericValue,
                            maxValue: maxNumericValue,
                            hasInteger: true
                        }
                    };
                } else {
                    // Needs 64-bit BIGINT
                    return {
                        type: 'bigint',
                        metadata: {
                            minValue: minNumericValue,
                            maxValue: maxNumericValue,
                            hasInteger: true
                        }
                    };
                }
            }
        }
        
        // Default to text for mixed or unknown types
        return { type: 'text' };
    }
    
    /**
     * Infer types for multiple columns at once
     * @param rows - Array of row objects
     * @param columnKeys - Array of column keys to analyze
     * @returns Map of column key to type result
     */
    public inferTypes(rows: any[], columnKeys: string[]): Map<string, ColumnTypeResult> {
        const typeMap = new Map<string, ColumnTypeResult>();
        
        for (const key of columnKeys) {
            const values = rows.map(row => row[key]);
            const result = this.inferColumnType(values, key);
            typeMap.set(key, result);
        }
        
        return typeMap;
    }
    
    /**
     * Log type inference result for debugging
     */
    public logTypeInference(columnTitle: string, result: ColumnTypeResult): void {
        if (result.type !== 'text') {
            let message = `[Type Detection] Column "${columnTitle}": ${result.type.toUpperCase()}`;
            
            if (result.metadata) {
                const { minValue, maxValue } = result.metadata;
                if (minValue !== undefined && maxValue !== undefined) {
                    message += ` (range: ${minValue} to ${maxValue})`;
                }
                
                if (result.type === 'bigint') {
                    message += ' - exceeds INT32 limits';
                }
            }
            
            if (result.type === 'time') {
                message += ' - time-only values detected (HH:MM:SS format)';
            }
            
            console.log(message);
        }
    }
}
