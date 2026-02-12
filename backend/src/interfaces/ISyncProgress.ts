/**
 * Interface for MongoDB sync progress tracking
 * Used to provide real-time updates during data import operations
 */
export interface ISyncProgress {
    /** Unique identifier for the data source being synced */
    dataSourceId: number;
    
    /** User ID who initiated the sync */
    userId: number;
    
    /** Current sync status: initializing, in_progress, completed, failed */
    status: 'initializing' | 'in_progress' | 'completed' | 'failed';
    
    /** Total number of collections to sync */
    totalCollections: number;
    
    /** Number of collections processed so far */
    processedCollections: number;
    
    /** Name of collection currently being processed */
    currentCollection: string | null;
    
    /** Total records across all collections (estimated or final) */
    totalRecords: number;
    
    /** Number of records processed so far */
    processedRecords: number;
    
    /** Number of records that failed to import */
    failedRecords: number;
    
    /** Overall progress percentage (0-100) */
    percentage: number;
    
    /** Estimated time to completion in milliseconds */
    estimatedTimeRemaining: number | null;
    
    /** When the sync operation started */
    startTime: Date;
    
    /** When the last progress update was sent */
    lastUpdateTime: Date;
    
    /** Error message if sync failed */
    errorMessage?: string;
    
    /** Array of collection names with their processing status */
    collections?: {
        name: string;
        status: 'pending' | 'in_progress' | 'completed' | 'failed';
        recordCount: number;
        processedCount: number;
    }[];
}

/**
 * Interface for collection-level progress tracking
 */
export interface ICollectionProgress {
    collectionName: string;
    totalRecords: number;
    processedRecords: number;
    failedRecords: number;
    status: 'pending' | 'in_progress' | 'completed' | 'failed';
}
