/**
 * Google Ad Manager Export Interfaces
 */

export interface ExportOptions {
    format: 'csv' | 'json' | 'excel';
    dateRange?: {
        start: string;
        end: string;
    };
    reportTypes?: string[];
    includeMetadata?: boolean;
}

export interface ExportResult {
    success: boolean;
    fileUrl?: string;
    fileName?: string;
    fileSize?: number;
    recordCount?: number;
    error?: string;
}

export interface ExportHistoryEntry {
    id: number;
    dataSourceId: number;
    dataSourceName: string;
    format: string;
    createdAt: string;
    fileSize: number;
    recordCount: number;
    status: 'completed' | 'failed';
}
