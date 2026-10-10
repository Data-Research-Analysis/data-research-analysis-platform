/**
 * AI Marketing Analysis — frontend types mirroring the backend response.
 */

export type AIAnalysisStatus = 'success' | 'degraded';

export type AIAnalysisChartType =
    | 'vertical_bar'
    | 'horizontal_bar'
    | 'line'
    | 'donut'
    | 'pie'
    | 'bubble'
    | 'table';

export interface IAIMarketingAnalysisChart {
    chartType: AIAnalysisChartType;
    title: string;
    data: any;
}

export interface IAIMarketingSpendRecommendation {
    entity: string;
    entityType: 'channel' | 'campaign' | 'ad_set' | 'ad_group';
    action: 'increase_budget' | 'decrease_budget' | 'maintain' | 'pause';
    currentSpend: number | null;
    suggestedAllocation: string | null;
    rationale: string;
}

export interface IAIMarketingSection {
    heading: string;
    content: string;
    recommendations?: string[];
}

export interface IAIMarketingReport {
    title: string;
    executiveSummary: string;
    sections: IAIMarketingSection[];
    spendRecommendations: IAIMarketingSpendRecommendation[];
    risksAndAlerts: string[];
    nextSteps: string[];
}

export interface IAIMarketingTargetRow {
    entity: string;
    level: 'campaign' | 'ad_set';
    channel: string | null;
    spend: number;
    conversions: number;
    conversionsTarget: number | null;
    roas: number | null;
    roasTarget: number | null;
    cpa: number | null;
    cpaTarget: number | null;
    status: 'on-target' | 'above-target' | 'below-target' | 'no-target';
}

export interface IAIMarketingSourceSummary {
    hasMarketingData: boolean;
    campaignCount: number;
    targetCount: number;
    alertCount: number;
    totalSpend: number;
    totalConversions: number;
    overallRoas: number | null;
    overallCpl: number | null;
}

export type AIAnalysisScopeType = 'project' | 'campaign' | 'ad_set';

export interface IAIMarketingAnalysisScope {
    type: AIAnalysisScopeType;
    campaignId?: string | null;
    campaignName?: string | null;
    channel?: string | null;
    adSetName?: string | null;
}

export interface IAIMarketingAdSetScope {
    name: string;
    spend: number;
    conversions: number;
    roas: number | null;
    cpl: number | null;
    status: string;
}

export interface IAIMarketingAnalysisResponse {
    aiStatus: AIAnalysisStatus;
    fromCache: boolean;
    generatedAt: string;
    dateRange: { start: string; end: string };
    report: IAIMarketingReport;
    charts: {
        channelSpend: IAIMarketingAnalysisChart;
        channelRoas: IAIMarketingAnalysisChart;
        spendAllocation: IAIMarketingAnalysisChart;
        weeklyTrend: IAIMarketingAnalysisChart;
        dailySpend: IAIMarketingAnalysisChart;
        topCampaigns: IAIMarketingAnalysisChart;
        adSetPerformance: IAIMarketingAnalysisChart;
        spendByAge: IAIMarketingAnalysisChart;
        spendByGender: IAIMarketingAnalysisChart;
        spendByDevice: IAIMarketingAnalysisChart;
        spendByPlatform: IAIMarketingAnalysisChart;
    };
    targetComparison: IAIMarketingTargetRow[];
    sourceSummary: IAIMarketingSourceSummary;
    /** What this report covers (project / campaign / single ad set). */
    scope: IAIMarketingAnalysisScope;
    /** Ad groups / ad sets available in the campaign (for the scope selector). */
    adSetScopes: IAIMarketingAdSetScope[];
}
