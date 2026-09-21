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
    INSIGHTS = 'insights',
    ADSET_INSIGHTS = 'adset_insights',
    DEMOGRAPHIC_INSIGHTS = 'demographic_insights',
    DEVICE_INSIGHTS = 'device_insights',
    PLACEMENT_INSIGHTS = 'placement_insights',
    CREATIVES = 'creatives',
    CUSTOM_CONVERSIONS = 'custom_conversions'
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
    effective_status?: string | null;
    buying_type?: string | null;   // 'AUCTION' | 'RESERVED'
    bid_strategy?: string | null;
    special_ad_categories?: string[] | null;
    spend_cap?: number | null;     // In account currency
    budget_remaining?: number | null;
    daily_budget: number | null;   // In account currency
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
    effective_status?: string | null;
    billing_event: string | null;
    optimization_goal: string | null;
    bid_strategy?: string | null;
    bid_amount: number | null;     // In account currency
    bid_constraints?: any | null;
    daily_budget: number | null;
    lifetime_budget: number | null;
    daily_min_spend_target?: number | null;
    daily_spend_cap?: number | null;
    destination_type?: string | null;
    attribution_spec?: any | null;
    promoted_object?: any | null;
    pacing_type?: string[] | null;
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
    campaign_name?: string | null;
    adset_id: string | null;
    adset_name?: string | null;
    ad_id: string | null;
    date_start: string;
    date_stop: string;
    impressions: number;
    clicks: number;
    spend: number;                 // In dollars (converted from cents)
    reach: number;
    frequency?: number | null;
    ctr?: number | null;
    cpc?: number | null;
    cpm?: number | null;
    conversions?: number | null;
    conversion_value?: number | null;
    inline_link_clicks?: number | null;
    unique_clicks?: number | null;
    unique_ctr?: number | null;
    unique_impressions?: number | null;
    cost_per_unique_click?: number | null;
    // Breakdown dimensions
    age?: string | null;
    gender?: string | null;
    impression_device?: string | null;
    publisher_platform?: string | null;
    platform_position?: string | null;
    device_platform?: string | null;
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
    syncTypes: string[];           // e.g. campaigns/adsets/ads/insights/creatives/custom_conversions
    startDate: string;             // YYYY-MM-DD
    endDate: string;               // YYYY-MM-DD
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
