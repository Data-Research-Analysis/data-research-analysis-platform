/**
 * Meta Ads Integration Types
 * TypeScript interfaces for Meta Marketing API integration
 */

// Meta Ads Report Types
export enum MetaAdsReportType {
    CAMPAIGNS = 'CAMPAIGNS',
    ADSETS = 'ADSETS',
    ADS = 'ADS',
    INSIGHTS = 'INSIGHTS'
}

// Meta Ad Account
export interface IMetaAdAccount {
    id: string;              // act_123456789
    name: string;
    account_status: number;  // 1 = Active, 2 = Disabled, etc.
    currency: string;        // USD, EUR, etc.
    timezone_name: string;
}

// Meta Campaign
export interface IMetaCampaign {
    id: string;
    name: string;
    objective: string;
    status: string;
    daily_budget?: string;
    lifetime_budget?: string;
    created_time: string;
    updated_time: string;
    start_time?: string;
    stop_time?: string;
}

// Meta Ad Set
export interface IMetaAdSet {
    id: string;
    name: string;
    campaign_id: string;
    status: string;
    billing_event: string;
    optimization_goal: string;
    daily_budget?: string;
    lifetime_budget?: string;
    bid_amount?: string;
    targeting?: object;
    start_time?: string;
    end_time?: string;
    created_time: string;
    updated_time: string;
}

// Meta Ad
export interface IMetaAd {
    id: string;
    name: string;
    adset_id: string;
    campaign_id: string;
    status: string;
    creative?: { id: string };
    created_time: string;
    updated_time: string;
}

// Meta Insights
export interface IMetaInsights {
    campaign_id?: string;    // returned when level=campaign
    campaign_name?: string;  // returned when level=campaign
    impressions: string;
    clicks: string;
    spend: string;
    reach?: string;
    frequency?: string;
    ctr?: string;
    cpc?: string;
    cpm?: string;
    conversions?: string;          // NOT from API directly — computed client-side
    conversion_values?: string;
    actions?: Array<{ action_type: string; value: string }>;  // conversion action breakdown
    date_start: string;
    date_stop: string;
}

// Insights Query Parameters
export interface IInsightsParams {
    time_range: {
        since: string;  // YYYY-MM-DD
        until: string;  // YYYY-MM-DD
    };
    level: 'campaign' | 'adset' | 'ad';
    fields: string[];
    breakdowns?: string[];  // ['age', 'gender', 'placement']
    time_increment?: number; // 1 = daily
}

// OAuth Tokens
export interface IMetaTokens {
    access_token: string;
    token_type: string;
    expires_in: number;
}

// Sync Configuration
export interface IMetaSyncConfig {
    name: string;
    adAccountId: string;
    accessToken: string;
    syncTypes: string[];  // ['campaigns', 'adsets', 'ads', 'insights']
    startDate: string;
    endDate: string;
}

// Sync Status
export interface IMetaSyncStatus {
    lastSyncTime: string | null;
    status: 'IDLE' | 'RUNNING' | 'COMPLETED' | 'FAILED';
    recordsSynced: number;
    recordsFailed: number;
    errorMessage?: string;
}

// API Response Wrapper
export interface IMetaAPIResponse<T> {
    data: T[];
    paging?: {
        cursors: {
            before: string;
            after: string;
        };
        next?: string;
        previous?: string;
    };
}

// Error Response
export interface IMetaAPIError {
    message: string;
    type: string;
    code: number;
    error_subcode?: number;
    fbtrace_id: string;
}
