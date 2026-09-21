/**
 * Google Analytics Property
 * Represents a GA4 property accessible to the user
 */
export interface IGoogleAnalyticsProperty {
    name: string; // Format: properties/123456789
    displayName: string;
    propertyType?: string;
    createTime?: string;
    updateTime?: string;
    parent?: string; // Parent account
    timeZone?: string;
    currencyCode?: string;
}

/**
 * Google Analytics Sync Configuration
 */
export interface IGoogleAnalyticsSyncConfig {
    name: string;
    property_id: string;
    access_token: string;
    refresh_token: string;
    token_expiry: string;
    project_id: number;
    sync_frequency?: 'hourly' | 'daily' | 'weekly' | 'manual';
    account_name?: string;
}

/**
 * Available Report Presets
 */
export interface IReportPreset {
    name: string;
    dimensions: string[];
    metrics: string[];
}

/**
 * API Connection Details for OAuth-based data sources
 */
export interface IAPIConnectionDetails {
    data_source_type: string;
    oauth_access_token: string;
    oauth_refresh_token: string;
    token_expiry: string; // ISO date string
    api_config: {
        property_id?: string;
        view_id?: string;
        account_name?: string;
        last_sync?: string; // ISO date string
        sync_frequency?: 'hourly' | 'daily' | 'weekly' | 'manual';
    };
}
