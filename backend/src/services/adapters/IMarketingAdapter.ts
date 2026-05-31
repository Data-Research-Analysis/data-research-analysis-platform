/**
 * IMarketingAdapter — Interface for marketing platform data adapters
 *
 * Each adapter knows how to query a specific API-synced data source
 * (Google Ads, Meta Ads, LinkedIn Ads, HubSpot, Klaviyo) directly
 * from its physical tables, without requiring a data model.
 */

export interface ICampaignRow {
    campaign_id: string;
    campaign_name: string;
    platform: string;
    spend: number;
    impressions: number;
    clicks: number;
    conversions: number;
    ctr: number;
    cpc: number;
    roas: number;
    revenue: number;
    date?: string;
    status?: string;
}

export interface IChannelSummary {
    channel: string;
    spend: number;
    impressions: number;
    clicks: number;
    conversions: number;
    ctr: number;
    cpc: number;
    cpa: number;
    roas: number;
    revenue: number;
}

export interface IKPISummary {
    totalSpend: number;
    totalImpressions: number;
    totalClicks: number;
    totalConversions: number;
    overallCTR: number;
    overallCPC: number;
    overallCPA: number;
    overallROAS: number;
    totalRevenue: number;
    campaignCount: number;
}

export interface IDateRange {
    start: string;
    end: string;
}

export interface IMarketingAdapter {
    /** The platform identifier (e.g., 'google_ads', 'meta_ads') */
    readonly platform: string;

    /** Check if the adapter can handle this data source type */
    canHandle(dataSourceType: string): boolean;

    /**
     * Fetch campaign-level performance data
     */
    getCampaigns(dataSourceId: number, dateRange: IDateRange, limit?: number): Promise<ICampaignRow[]>;

    /**
     * Fetch channel-level summary (aggregated across campaigns)
     */
    getChannelSummary(dataSourceId: number, dateRange: IDateRange): Promise<IChannelSummary>;

    /**
     * Fetch KPI totals
     */
    getKPISummary(dataSourceId: number, dateRange: IDateRange): Promise<IKPISummary>;

    /**
     * Fetch daily trend data
     */
    getDailyTrend(dataSourceId: number, dateRange: IDateRange): Promise<Array<{
        date: string;
        spend: number;
        impressions: number;
        clicks: number;
        conversions: number;
        revenue: number;
    }>>;
}