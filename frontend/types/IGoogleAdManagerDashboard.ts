/**
 * Google Ad Manager Dashboard Interfaces
 */

export interface DashboardStats {
    totalDataSources: number;
    activeDataSources: number;
    totalSyncs: number;
    successfulSyncs: number;
    failedSyncs: number;
    totalRecordsSynced: number;
    totalExports: number;
    avgSyncDuration: number;
}

export interface GAMSyncStatus {
    id: number;
    dataSourceId: number;
    dataSourceName: string;
    status: 'PENDING' | 'IN_PROGRESS' | 'COMPLETED' | 'FAILED' | 'PARTIAL';
    reportTypes: string[];
    startedAt: string;
    completedAt?: string;
    recordsSynced: number;
    recordsFailed: number;
    duration?: number;
    error?: string;
}

export interface DataSourceHealth {
    id: number;
    name: string;
    networkCode: string;
    status: 'healthy' | 'warning' | 'error' | 'inactive';
    lastSyncAt?: string;
    lastSyncStatus?: string;
    totalSyncs: number;
    successRate: number;
    avgDuration: number;
    nextScheduledSync?: string;
}

export interface RecentActivity {
    id: number;
    type: 'sync' | 'export' | 'error' | 'config_change';
    message: string;
    dataSourceName?: string;
    timestamp: string;
    status: 'success' | 'failure' | 'info' | 'warning';
}
