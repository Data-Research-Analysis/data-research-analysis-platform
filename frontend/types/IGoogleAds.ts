/**
 * Google Ads Frontend Types
 */

export interface IGoogleAdsAccount {
    customerId: string;
    descriptiveName: string;
    currencyCode: string;
    timeZone: string;
}

export interface IGoogleAdsReportTypeDefinition {
    id: string;
    name: string;
    description: string;
    dimensions: string[];
    metrics: string[];
}

export interface IGoogleAdsSyncConfig {
    name: string;
    customerId: string;
    accessToken: string;
    refreshToken: string;
    reportTypes: string[];
    startDate: string;
    endDate: string;
}

export interface IGoogleAdsSyncStatus {
    lastSyncTime: string | null;
    status: 'IDLE' | 'RUNNING' | 'COMPLETED' | 'FAILED';
    recordsSynced: number;
    recordsFailed: number;
    error?: string;
}
