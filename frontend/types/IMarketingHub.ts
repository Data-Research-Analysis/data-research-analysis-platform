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

export interface IIntelligenceHubSummary {
    channels: IChannelMetrics[];
    totals: IIntelligenceTotals;
    priorPeriodTotals: IIntelligenceTotals;
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

export interface IIntelligenceDateRange {
    start: Date;
    end: Date;
}
