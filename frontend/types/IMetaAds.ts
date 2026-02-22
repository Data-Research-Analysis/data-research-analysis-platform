/**
 * Meta (Facebook) Ads TypeScript Interfaces
 * Mirrors backend/src/types/IMetaAds.ts
 */

/**
 * Meta Ads report types available for sync
 */
export enum MetaAdsReportType {
    CAMPAIGNS = 'campaigns',
    ADSETS = 'adsets',
    ADS = 'ads',
    INSIGHTS = 'insights'
}

/**
 * Meta Ad Account
 */
export interface IMetaAdAccount {
    id: string;                    // Format: act_123456789
    account_id: string;            // Numeric ID
    name: string;
    currency: string;              // e.g., 'USD', 'EUR'
    account_status: number;        // 1 = Active, 2 = Disabled, etc.
}

/**
 * Meta Campaign
 */
export interface IMetaCampaign {
    id: string;
    account_id: string;
    name: string;
    objective: string;             // e.g., 'OUTCOME_TRAFFIC', 'OUTCOME_SALES'
    status: string;                // 'ACTIVE', 'PAUSED', 'DELETED'
    daily_budget: number | null;   // In cents
    lifetime_budget: number | null;
    start_time: string | null;
    stop_time: string | null;
    created_time: string;
    updated_time: string;
}

/**
 * Meta Ad Set
 */
export interface IMetaAdSet {
    id: string;
    campaign_id: string;
    account_id: string;
    name: string;
    status: string;
    billing_event: string | null;
    optimization_goal: string | null;
    bid_amount: number | null;     // In cents
    daily_budget: number | null;
    lifetime_budget: number | null;
    start_time: string | null;
    end_time: string | null;
    targeting: any;                // JSONB - complex targeting object
    created_time: string;
    updated_time: string;
}

/**
 * Meta Ad
 */
export interface IMetaAd {
    id: string;
    adset_id: string;
    campaign_id: string;
    account_id: string;
    name: string;
    status: string;
    creative_id: string | null;
    preview_shareable_link: string | null;
    created_time: string;
    updated_time: string;
}

/**
 * Meta Insights (Performance Metrics)
 */
export interface IMetaInsights {
    id: string;
    account_id: string;
    campaign_id: string | null;
    adset_id: string | null;
    ad_id: string | null;
    date_start: string;
    date_stop: string;
    impressions: number;
    clicks: number;
    spend: number;                 // In dollars (converted from cents)
    reach: number;
    actions: any | null;           // JSONB - conversions, engagement actions
    action_values: any | null;     // JSONB - monetary values
}

/**
 * Insights query parameters
 */
export interface IInsightsParams {
    time_range: {
        since: string;
        until: string;
    };
    level: 'account' | 'campaign' | 'adset' | 'ad';
    fields: string[];
    breakdowns?: string[];
}

/**
 * Meta OAuth tokens
 */
export interface IMetaTokens {
    access_token: string;
    token_type: string;
    expires_in: number;            // Seconds until expiry (60 days for long-lived)
}

/**
 * Configuration for Meta Ads sync
 */
export interface IMetaSyncConfig {
    name: string;
    adAccountId: string;
    accessToken: string;
    syncTypes: string[];           // Array of MetaAdsReportType values
    startDate: string;             // YYYY-MM-DD
    endDate: string;               // YYYY-MM-DD
}

/**
 * Sync status response
 */
export interface IMetaSyncStatus {
    lastSyncTime: Date | null;
    syncHistory: Array<{
        status: string;
        started_at: Date;
        completed_at: Date | null;
        records_synced: number;
        error_message: string | null;
    }>;
}

/**
 * Meta API response wrapper
 */
export interface IMetaAPIResponse<T> {
    data: T[];
    paging?: {
        cursors: {
            before: string;
            after: string;
        };
        next?: string;
    };
}

/**
 * Meta API error response
 */
export interface IMetaAPIError {
    error: {
        message: string;
        type: string;
        code: number;
        error_subcode?: number;
        fbtrace_id: string;
    };
}
