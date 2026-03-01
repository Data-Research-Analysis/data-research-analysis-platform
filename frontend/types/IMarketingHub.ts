export interface IChannelMetrics {
    channelType: string;
    channelLabel: string;
    spend: number;
    impressions: number;
    clicks: number;
    ctr: number;
    conversions: number;
    cpl: number;
    roas: number;
    pipelineValue: number;
    dataSourceId: number | null;
}

export interface IMarketingTotals {
    spend: number;
    impressions: number;
    clicks: number;
    conversions: number;
    cpl: number;
    pipelineValue: number;
}

export interface IWeeklyTrendPoint {
    weekStart: string;
    byChannel: Record<string, number>;
}

export interface IMarketingHubSummary {
    channels: IChannelMetrics[];
    totals: IMarketingTotals;
    priorPeriodTotals: IMarketingTotals;
    weeklyTrend: IWeeklyTrendPoint[];
}

export interface ITopCampaign {
    campaignId: string;
    campaignName: string;
    status: string;
    platform: string;    // 'google_ads' | 'linkedin_ads' | 'meta_ads'
    spend: number;
    impressions: number;
    clicks: number;
    conversions: number;
    cpl: number;
}

export interface IMarketingDateRange {
    start: Date;
    end: Date;
}
