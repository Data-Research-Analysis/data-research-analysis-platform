/**
 * localStorage Migration Plugin
 * 
 * Phase 1 Performance Optimization: Migrate data model tables to exclude row data
 * 
 * This plugin runs once on app startup to migrate old localStorage format that
 * included full row data (causing QuotaExceededError) to new format with only
 * metadata and row counts.
 */

export default defineNuxtPlugin(() => {
    if (typeof window === 'undefined') return;
    
    const MIGRATION_FLAG = 'storage_migrated_v2_metadata_only';
    
    // Check if migration already completed
    const migrated = localStorage.getItem(MIGRATION_FLAG);
    if (migrated === 'true') {
        return;
    }
    
    console.log('[Migration] Starting localStorage migration to metadata-only format...');
    
    try {
        // Migrate dataModelTables - remove rows array, keep row_count
        const dataModelTablesRaw = localStorage.getItem('dataModelTables');
        if (dataModelTablesRaw) {
            try {
                const parsed = JSON.parse(dataModelTablesRaw);
                if (Array.isArray(parsed) && parsed.length > 0) {
                    // Check if any table has a 'rows' field (old format)
                    const hasOldFormat = parsed.some((table: any) => table.rows !== undefined);
                    
                    if (hasOldFormat) {
                        console.log(`[Migration] Found ${parsed.length} data model tables with old format. Migrating...`);
                        
                        // Remove rows field, keep/add row_count
                        const migrated = parsed.map((table: any) => ({
                            ...table,
                            rows: undefined,
                            row_count: table.row_count || table.rows?.length || 0
                        }));
                        
                        // Try to save migrated data
                        try {
                            localStorage.setItem('dataModelTables', JSON.stringify(migrated));
                            console.log('[Migration] Successfully migrated dataModelTables');
                        } catch (quotaError: any) {
                            if (quotaError.name === 'QuotaExceededError') {
                                console.warn('[Migration] Still exceeds quota after migration. Storing minimal metadata only.');
                                // Fallback to minimal metadata
                                const minimal = migrated.map((t: any) => ({
                                    data_model_id: t.data_model_id,
                                    table_name: t.table_name,
                                    logical_name: t.logical_name,
                                    schema: t.schema,
                                    row_count: t.row_count || 0
                                }));
                                localStorage.setItem('dataModelTables', JSON.stringify(minimal));
                                console.log('[Migration] Saved minimal metadata for dataModelTables');
                            } else {
                                throw quotaError;
                            }
                        }
                    } else {
                        console.log('[Migration] dataModelTables already in new format');
                    }
                } else {
                    console.log('[Migration] No dataModelTables to migrate');
                }
            } catch (parseError) {
                console.warn('[Migration] Failed to parse dataModelTables, clearing corrupt data:', parseError);
                localStorage.removeItem('dataModelTables');
            }
        } else {
            console.log('[Migration] No dataModelTables in localStorage');
        }
        
        // Check overall localStorage usage
        if (import.meta.client) {
            let totalSize = 0;
            for (const key in localStorage) {
                if (localStorage.hasOwnProperty(key)) {
                    totalSize += localStorage.getItem(key)?.length || 0;
                }
            }
            const sizeMB = (totalSize / (1024 * 1024)).toFixed(2);
            console.log(`[Migration] Total localStorage usage: ${sizeMB} MB`);
            
            if (totalSize > 5 * 1024 * 1024) {
                console.warn('[Migration] localStorage usage exceeds 5MB. Consider clearing old data.');
            }
        }
        
        // Mark migration as complete
        localStorage.setItem(MIGRATION_FLAG, 'true');
        console.log('[Migration] Migration complete ✓');
        
    } catch (error) {
        console.error('[Migration] Migration failed:', error);
        // Don't block app startup on migration failure
        // Mark as migrated anyway to avoid repeated failures
        localStorage.setItem(MIGRATION_FLAG, 'true');
    }
});
