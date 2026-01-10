export type ExportFormat = 'csv' | 'json' | 'xlsx';

export interface IExportOptions {
    dataSourceId: number;
    format: ExportFormat;
    reportType: string;
    networkCode: string;
    startDate?: string;
    endDate?: string;
    columns?: string[];
    limit?: number;
    includeHeaders?: boolean;
}

export interface IExportResult {
    success: boolean;
    filePath?: string;
    fileName?: string;
    fileSize?: number;
    recordCount?: number;
    format?: ExportFormat;
    error?: string;
    downloadUrl?: string;
}

export interface IExportHistoryEntry {
    id: number;
    dataSourceId: number;
    userId: number;
    reportType: string;
    format: ExportFormat;
    fileName: string;
    filePath: string;
    fileSize: number;
    recordCount: number;
    status: 'pending' | 'completed' | 'failed';
    error?: string;
    createdAt: string;
    completedAt?: string;
    expiresAt?: string;
}
