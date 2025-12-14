/**
 * Google Ad Manager Type Definitions (Frontend)
 */

/**
 * GAM Network
 */
export interface IGAMNetwork {
    networkCode: string;
    networkId: string;
    displayName: string;
    timeZone?: string;
    currencyCode?: string;
}

/**
 * GAM Report Type Definition
 */
export interface IGAMReportType {
    id: string;
    name: string;
    description: string;
    dimensions: string[];
    metrics: string[];
}

/**
 * GAM Sync Configuration
 */
export interface IGAMSyncConfig {
    name: string;
    network_code: string;
    network_id: string;
    network_name: string;
    access_token: string;
    refresh_token: string;
    token_expiry: string;
    project_id: number;
    report_types: string[];
    start_date?: string;
    end_date?: string;
    sync_frequency?: 'hourly' | 'daily' | 'weekly' | 'manual';
}

/**
 * GAM Sync Status
 */
export interface IGAMSyncStatus {
    last_sync: string | null;
    sync_history: IGAMSyncHistoryItem[];
    message: string;
}

/**
 * GAM Sync History Item
 */
export interface IGAMSyncHistoryItem {
    id: number;
    data_source_id: number;
    sync_started: string;
    sync_completed: string | null;
    status: 'pending' | 'in_progress' | 'completed' | 'failed';
    rows_synced: number;
    error_message?: string;
}
