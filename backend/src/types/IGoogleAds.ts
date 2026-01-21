/**
 * Google Ads Integration Types
 * TypeScript interfaces for Google Ads API integration
 */

// Google Ads Report Types
export enum GoogleAdsReportType {
    CAMPAIGN = 'CAMPAIGN',
    KEYWORD = 'KEYWORD',
    GEOGRAPHIC = 'GEOGRAPHIC',
    DEVICE = 'DEVICE'
}

// API Query Structure
export interface IGoogleAdsReportQuery {
    customerId: string;        // Google Ads customer ID (format: 123-456-7890)
    startDate: string;          // YYYY-MM-DD
    endDate: string;            // YYYY-MM-DD
    reportType: GoogleAdsReportType;
    metrics: string[];          // e.g., ['impressions', 'clicks', 'cost']
    dimensions: string[];       // e.g., ['campaign_name', 'date']
}

// API Response
export interface IGoogleAdsReportResponse {
    rows: IGoogleAdsRow[];
    totalRows: number;
    queryResourceConsumption: number;
}

export interface IGoogleAdsRow {
    campaign?: {
        id: string;
        name: string;
        status: string;
    };
    adGroup?: {
        name: string;
    };
    adGroupCriterion?: {
        keyword?: {
            text: string;
            matchType: string;
        };
        qualityInfo?: {
            qualityScore: number;
        };
    };
    metrics: {
        impressions: number;
        clicks: number;
        costMicros: number;        // Cost in micros (1,000,000 = $1)
        conversions: number;
        conversionsValue: number;
        ctr: number;
        averageCpc: number;
        averageCpm: number;
    };
    segments?: {
        date: string;
        device: string;
        geoTargetCountry: string;
        geoTargetRegion: string;
        geoTargetCity: string;
    };
}

// Sync Configuration
export interface IGoogleAdsSyncConfig {
    name: string;
    customerId: string;
    accessToken: string;
    refreshToken: string;
    reportTypes: string[];      // ['campaign', 'keyword', 'geographic', 'device']
    startDate: string;
    endDate: string;
}

// Frontend Types
export interface IGoogleAdsAccount {
    customerId: string;
    descriptiveName: string;
    currencyCode: string;
    timeZone: string;
    isManager?: boolean;
    clientAccounts?: IGoogleAdsClientAccount[];
}

export interface IGoogleAdsClientAccount {
    customerId: string;
    descriptiveName: string;
}

export interface IGoogleAdsReportTypeDefinition {
    id: string;
    name: string;
    description: string;
    dimensions: string[];
    metrics: string[];
}

// Sync Status
export interface IGoogleAdsSyncStatus {
    lastSyncTime: string | null;
    status: 'IDLE' | 'RUNNING' | 'COMPLETED' | 'FAILED';
    recordsSynced: number;
    recordsFailed: number;
    error?: string;
}
