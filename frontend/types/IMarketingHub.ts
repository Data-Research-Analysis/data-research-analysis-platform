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

export interface IIntelligenceTotals {
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

/**
 * Website traffic (GA4) metrics. Reported separately from the paid channel
 * comparison because GA4 has no spend data.
 */
export interface IWebTrafficMetrics {
    dataSourceId: number;
    dataSourceName: string | null;
    sessions: number;
    totalUsers: number;
    newUsers: number;
    topChannelGroups: Array<{ channelGroup: string; sessions: number }>;
    topPages: Array<{ pagePath: string; pageViews: number }>;
}

export interface IIntelligenceHubSummary {
    channels: IChannelMetrics[];
    priorChannels?: IChannelMetrics[];
    totals: IIntelligenceTotals;
    priorPeriodTotals: IIntelligenceTotals;
    weeklyTrend: IWeeklyTrendPoint[];
    webTraffic?: IWebTrafficMetrics[];
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

export interface IIntelligenceDateRange {
    start: Date;
    end: Date;
}
