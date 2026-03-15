/**
 * Composable for normalizing data values across file types
 * Handles time, date, and number conversions from various formats
 * 
 * Used by Excel, PDF, and CSV file uploads
 */

export interface DataNormalizationOptions {
    /**
     * Enable debug logging
     */
    debug?: boolean;
}

export const useDataNormalization = (options: DataNormalizationOptions = {}) => {
    const debug = options.debug ?? false;
    
    /**
     * Convert Excel decimal time to HH:MM:SS format
     * Excel stores times as fractions of a day (0.5 = 12:00:00)
     */
    function decimalToTime(decimal: number): string {
        const totalSeconds = Math.round(decimal * 86400);
        const hours = Math.floor(totalSeconds / 3600);
        const minutes = Math.floor((totalSeconds % 3600) / 60);
        const seconds = totalSeconds % 60;
        
        return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
    }
    
    /**
     * Extract time from Excel date object (1899-12-31T23:22:44.000Z)
     */
    function extractTimeFromDate(value: any): string {
        const date = value instanceof Date ? value : new Date(value);
        if (isNaN(date.getTime())) return String(value);
        
        const hours = date.getUTCHours();
        const minutes = date.getUTCMinutes();
        const seconds = date.getUTCSeconds();
        
        return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
    }
    
    /**
     * Check if value is an Excel time-only date object
     */
    function isExcelTimeDate(value: any): boolean {
        const strValue = String(value);
        if (!strValue.includes('1899') || !strValue.includes('T')) return false;
        
        const date = new Date(value);
        if (isNaN(date.getTime())) return false;
        
        const year = date.getUTCFullYear();
        const month = date.getUTCMonth();
        const day = date.getUTCDate();
        
        return year === 1899 && month === 11 && (day === 30 || day === 31);
    }
    
    /**
     * Normalize time values in rows
     * Converts Excel decimals (0.5) and date objects (1899-12-31T12:00:00Z) to HH:MM:SS format
     */
    function normalizeTimeValues(rows: any[], columns: any[]): any[] {
        const timeColumns = columns.filter(col => col.type === 'time');
        if (timeColumns.length === 0) return rows;
        
        if (debug) {
            console.log(`[useDataNormalization] Normalizing ${timeColumns.length} time columns across ${rows.length} rows`);
        }
        
        return rows.map(row => {
            const rowData = row.data || row;
            const normalizedData = { ...rowData };
            
            timeColumns.forEach(column => {
                const value = normalizedData[column.key];
                if (value === null || value === undefined || value === '') return;
                
                // Handle Excel decimal times
                if (typeof value === 'number' && value >= 0 && value < 1) {
                    normalizedData[column.key] = decimalToTime(value);
                    if (debug) {
                        console.log(`[Time Normalize] ${column.key}: ${value} → ${normalizedData[column.key]}`);
                    }
                }
                // Handle Date objects (Excel time-only values with 1899-12-31 base)
                else if (value instanceof Date || isExcelTimeDate(value)) {
                    normalizedData[column.key] = extractTimeFromDate(value);
                    if (debug) {
                        console.log(`[Time Normalize] ${column.key}: ${value} → ${normalizedData[column.key]}`);
                    }
                }
            });
            
            return row.data ? { ...row, data: normalizedData } : normalizedData;
        });
    }
    
    /**
     * Normalize date values in rows
     * Ensures consistent date format (ISO 8601)
     */
    function normalizeDateValues(rows: any[], columns: any[]): any[] {
        const dateColumns = columns.filter(col => col.type === 'date');
        if (dateColumns.length === 0) return rows;
        
        if (debug) {
            console.log(`[useDataNormalization] Normalizing ${dateColumns.length} date columns across ${rows.length} rows`);
        }
        
        return rows.map(row => {
            const rowData = row.data || row;
            const normalizedData = { ...rowData };
            
            dateColumns.forEach(column => {
                const value = normalizedData[column.key];
                if (value === null || value === undefined || value === '') return;
                
                const date = new Date(value);
                if (!isNaN(date.getTime())) {
                    // Convert to ISO date string (YYYY-MM-DD)
                    normalizedData[column.key] = date.toISOString().split('T')[0];
                }
            });
            
            return row.data ? { ...row, data: normalizedData } : normalizedData;
        });
    }
    
    /**
     * Normalize number values in rows
     * Removes currency symbols, commas, percentages
     */
    function normalizeNumberValues(rows: any[], columns: any[]): any[] {
        const numberColumns = columns.filter(col => col.type === 'number');
        if (numberColumns.length === 0) return rows;
        
        if (debug) {
            console.log(`[useDataNormalization] Normalizing ${numberColumns.length} number columns across ${rows.length} rows`);
        }
        
        return rows.map(row => {
            const rowData = row.data || row;
            const normalizedData = { ...rowData };
            
            numberColumns.forEach(column => {
                const value = normalizedData[column.key];
                if (value === null || value === undefined || value === '') return;
                
                // Skip if already a valid number
                if (typeof value === 'number') return;
                
                // Remove currency symbols, commas, spaces
                let cleaned = String(value)
                    .replace(/[$€£¥,\s]/g, '')
                    .replace(/%$/, ''); // Remove trailing %
                
                const num = Number(cleaned);
                if (!isNaN(num) && isFinite(num)) {
                    normalizedData[column.key] = num;
                }
            });
            
            return row.data ? { ...row, data: normalizedData } : normalizedData;
        });
    }
    
    /**
     * Normalize boolean values to consistent format
     * Converts various representations to true/false
     */
    function normalizeBooleanValues(rows: any[], columns: any[]): any[] {
        const booleanColumns = columns.filter(col => col.type === 'boolean');
        if (booleanColumns.length === 0) return rows;
        
        if (debug) {
            console.log(`[useDataNormalization] Normalizing ${booleanColumns.length} boolean columns across ${rows.length} rows`);
        }
        
        return rows.map(row => {
            const rowData = row.data || row;
            const normalizedData = { ...rowData };
            
            booleanColumns.forEach(column => {
                const value = normalizedData[column.key];
                if (value === null || value === undefined || value === '') return;
                
                const str = String(value).toLowerCase().trim();
                const truthyValues = ['true', '1', 'yes', 'y'];
                const falsyValues = ['false', '0', 'no', 'n'];
                
                if (truthyValues.includes(str)) {
                    normalizedData[column.key] = true;
                } else if (falsyValues.includes(str)) {
                    normalizedData[column.key] = false;
                }
            });
            
            return row.data ? { ...row, data: normalizedData } : normalizedData;
        });
    }
    
    /**
     * Master normalizer - applies all normalizations in sequence
     */
    function normalizeAll(rows: any[], columns: any[]): any[] {
        if (!rows || rows.length === 0) return rows;
        
        let normalized = rows;
        normalized = normalizeTimeValues(normalized, columns);
        normalized = normalizeDateValues(normalized, columns);
        normalized = normalizeNumberValues(normalized, columns);
        normalized = normalizeBooleanValues(normalized, columns);
        
        if (debug) {
            console.log(`[useDataNormalization] Completed normalization of ${rows.length} rows`);
        }
        
        return normalized;
    }
    
    /**
     * Normalize a single value based on its type
     */
    function normalizeValue(value: any, type: string): any {
        if (value === null || value === undefined || value === '') return value;
        
        switch (type) {
            case 'time':
                if (typeof value === 'number' && value >= 0 && value < 1) {
                    return decimalToTime(value);
                }
                if (value instanceof Date || isExcelTimeDate(value)) {
                    return extractTimeFromDate(value);
                }
                return value;
                
            case 'date':
                const date = new Date(value);
                if (!isNaN(date.getTime())) {
                    return date.toISOString().split('T')[0];
                }
                return value;
                
            case 'number':
                if (typeof value === 'number') return value;
                const cleaned = String(value).replace(/[$€£¥,\s%]/g, '');
                const num = Number(cleaned);
                return !isNaN(num) && isFinite(num) ? num : value;
                
            case 'boolean':
                const str = String(value).toLowerCase().trim();
                if (['true', '1', 'yes', 'y'].includes(str)) return true;
                if (['false', '0', 'no', 'n'].includes(str)) return false;
                return value;
                
            default:
                return value;
        }
    }
    
    return {
        // Utility functions
        decimalToTime,
        extractTimeFromDate,
        isExcelTimeDate,
        
        // Type-specific normalizers
        normalizeTimeValues,
        normalizeDateValues,
        normalizeNumberValues,
        normalizeBooleanValues,
        
        // Master functions
        normalizeAll,
        normalizeValue,
    };
};
