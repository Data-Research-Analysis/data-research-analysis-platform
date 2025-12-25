/**
 * Sync Status Interfaces
 */

export interface SyncStatus {
    dataSourceId: number;
    status: 'idle' | 'syncing' | 'completed' | 'failed';
    progress: number;
    currentReport?: string;
    startedAt?: Date;
    completedAt?: Date;
    error?: string;
}

export interface SyncEvent {
    type: 'started' | 'progress' | 'report_completed' | 'report_failed' | 'completed' | 'failed';
    dataSourceId: number;
    reportType?: string;
    progress?: number;
    recordsProcessed?: number;
    totalRecords?: number;
    error?: string;
    timestamp: Date;
}
