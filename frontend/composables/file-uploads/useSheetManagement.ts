/**
 * Composable for managing sheets/pages in file uploads
 * Handles sheet selection, navigation, and metadata
 * 
 * Used by Excel (sheets), PDF (pages), and CSV (single sheet)
 */

export interface Sheet {
    id: string;
    name: string;
    fileId: string;
    fileName: string;
    rows: any[];
    columns: any[];
    metadata: {
        rowCount: number;
        columnCount: number;
        selected: boolean;
        hasErrors: boolean;
        errorMessage?: string;
        created: Date;
        modified: Date;
    };
}

export interface SheetManagementOptions {
    /**
     * Enable performance mode for large datasets
     */
    performanceMode?: boolean;
    
    /**
     * Pagination size when performance mode is enabled
     */
    pageSize?: number;
}

export const useSheetManagement = (options: SheetManagementOptions = {}) => {
    const performanceMode = options.performanceMode ?? false;
    const pageSize = options.pageSize ?? 5000;
    
    /**
     * Generate unique sheet ID
     */
    function generateSheetId(fileId: string, sheetName: string): string {
        return `${fileId}_${sheetName.toLowerCase().replace(/[^a-z0-9]/g, '_')}`;
    }
    
    /**
     * Create sheet metadata
     */
    function createSheetMetadata(sheet: Partial<Sheet>): Sheet['metadata'] {
        return {
            rowCount: sheet.rows?.length || 0,
            columnCount: sheet.columns?.length || 0,
            selected: sheet.metadata?.selected ?? true,
            hasErrors: sheet.metadata?.hasErrors ?? false,
            errorMessage: sheet.metadata?.errorMessage,
            created: sheet.metadata?.created || new Date(),
            modified: new Date(),
        };
    }
    
    /**
     * Create a normalized sheet object
     */
    function createSheet(
        fileId: string,
        fileName: string,
        sheetName: string,
        rows: any[],
        columns: any[]
    ): Sheet {
        const id = generateSheetId(fileId, sheetName);
        
        return {
            id,
            name: sheetName,
            fileId,
            fileName,
            rows,
            columns,
            metadata: createSheetMetadata({ rows, columns }),
        };
    }
    
    /**
     * Get sheets by file ID
     */
    function getSheetsByFileId(sheets: Sheet[], fileId: string): Sheet[] {
        return sheets.filter(sheet => sheet.fileId === fileId);
    }
    
    /**
     * Get selected sheets
     */
    function getSelectedSheets(sheets: Sheet[]): Sheet[] {
        return sheets.filter(sheet => sheet.metadata.selected);
    }
    
    /**
     * Toggle sheet selection
     */
    function toggleSheetSelection(sheets: Sheet[], sheetId: string): Sheet[] {
        return sheets.map(sheet => {
            if (sheet.id === sheetId) {
                return {
                    ...sheet,
                    metadata: {
                        ...sheet.metadata,
                        selected: !sheet.metadata.selected,
                        modified: new Date(),
                    },
                };
            }
            return sheet;
        });
    }
    
    /**
     * Select all sheets
     */
    function selectAllSheets(sheets: Sheet[]): Sheet[] {
        return sheets.map(sheet => ({
            ...sheet,
            metadata: {
                ...sheet.metadata,
                selected: true,
                modified: new Date(),
            },
        }));
    }
    
    /**
     * Deselect all sheets
     */
    function deselectAllSheets(sheets: Sheet[]): Sheet[] {
        return sheets.map(sheet => ({
            ...sheet,
            metadata: {
                ...sheet.metadata,
                selected: false,
                modified: new Date(),
            },
        }));
    }
    
    /**
     * Update sheet data
     */
    function updateSheet(
        sheets: Sheet[],
        sheetId: string,
        updates: Partial<Omit<Sheet, 'id' | 'fileId'>>
    ): Sheet[] {
        return sheets.map(sheet => {
            if (sheet.id === sheetId) {
                return {
                    ...sheet,
                    ...updates,
                    metadata: {
                        ...sheet.metadata,
                        ...updates.metadata,
                        rowCount: updates.rows?.length ?? sheet.metadata.rowCount,
                        columnCount: updates.columns?.length ?? sheet.metadata.columnCount,
                        modified: new Date(),
                    },
                };
            }
            return sheet;
        });
    }
    
    /**
     * Remove sheet by ID
     */
    function removeSheet(sheets: Sheet[], sheetId: string): Sheet[] {
        return sheets.filter(sheet => sheet.id !== sheetId);
    }
    
    /**
     * Remove all sheets for a file
     */
    function removeSheetsByFileId(sheets: Sheet[], fileId: string): Sheet[] {
        return sheets.filter(sheet => sheet.fileId !== fileId);
    }
    
    /**
     * Check if performance mode should be enabled for sheet
     */
    function shouldUsePerformanceMode(sheet: Sheet): boolean {
        return performanceMode || sheet.metadata.rowCount > pageSize;
    }
    
    /**
     * Get paginated rows for performance mode
     */
    function getPaginatedRows(sheet: Sheet, page: number = 1): any[] {
        if (!shouldUsePerformanceMode(sheet)) {
            return sheet.rows;
        }
        
        const startIndex = (page - 1) * pageSize;
        const endIndex = startIndex + pageSize;
        
        return sheet.rows.slice(startIndex, endIndex);
    }
    
    /**
     * Calculate total pages for sheet
     */
    function getTotalPages(sheet: Sheet): number {
        if (!shouldUsePerformanceMode(sheet)) {
            return 1;
        }
        
        return Math.ceil(sheet.metadata.rowCount / pageSize);
    }
    
    /**
     * Validate sheet has required data
     */
    function validateSheet(sheet: Sheet): { valid: boolean; error?: string } {
        if (!sheet.rows || sheet.rows.length === 0) {
            return {
                valid: false,
                error: 'Sheet contains no data',
            };
        }
        
        if (!sheet.columns || sheet.columns.length === 0) {
            return {
                valid: false,
                error: 'Sheet has no columns defined',
            };
        }
        
        return { valid: true };
    }
    
    /**
     * Get sheet statistics
     */
    function getSheetStats(sheet: Sheet): {
        rowCount: number;
        columnCount: number;
        selectedColumnCount: number;
        hasErrors: boolean;
        isEmpty: boolean;
        usesPerformanceMode: boolean;
    } {
        return {
            rowCount: sheet.metadata.rowCount,
            columnCount: sheet.metadata.columnCount,
            selectedColumnCount: sheet.columns.filter(col => col.visible !== false).length,
            hasErrors: sheet.metadata.hasErrors,
            isEmpty: sheet.metadata.rowCount === 0,
            usesPerformanceMode: shouldUsePerformanceMode(sheet),
        };
    }
    
    /**
     * Sort sheets by name
     */
    function sortSheetsByName(sheets: Sheet[], ascending: boolean = true): Sheet[] {
        return [...sheets].sort((a, b) => {
            const comparison = a.name.localeCompare(b.name);
            return ascending ? comparison : -comparison;
        });
    }
    
    /**
     * Sort sheets by row count
     */
    function sortSheetsBySize(sheets: Sheet[], ascending: boolean = false): Sheet[] {
        return [...sheets].sort((a, b) => {
            const comparison = a.metadata.rowCount - b.metadata.rowCount;
            return ascending ? comparison : -comparison;
        });
    }
    
    return {
        // Create/Update
        createSheet,
        updateSheet,
        createSheetMetadata,
        
        // Selection
        toggleSheetSelection,
        selectAllSheets,
        deselectAllSheets,
        getSelectedSheets,
        
        // Query
        getSheetsByFileId,
        getSheetStats,
        
        // Remove
        removeSheet,
        removeSheetsByFileId,
        
        // Performance
        shouldUsePerformanceMode,
        getPaginatedRows,
        getTotalPages,
        
        // Validation
        validateSheet,
        
        // Sorting
        sortSheetsByName,
        sortSheetsBySize,
        
        // Utilities
        generateSheetId,
    };
};
