/**
 * Attribution Module Interfaces
 * Phase 2: Marketing Attribution Engine
 */

// ========== Channel Interfaces ==========

export interface IAttributionChannel {
    id: number;
    name: string;
    category: 'organic' | 'paid' | 'social' | 'email' | 'direct' | 'referral' | 'other';
    source?: string;
    medium?: string;
    campaign?: string;
    projectId: number;
    createdAt: Date;
    updatedAt: Date;
}

export interface IChannelPerformance {
    channelId: number;
    channelName: string;
    channelCategory: string;
    totalTouchpoints: number;
    totalConversions: number;
    totalRevenue: number;
    avgTimeToConversion: number;
    conversionRate: number;
    roi?: number;
    costPerConversion?: number;
}

// ========== Event Interfaces ==========

export interface IAttributionEvent {
    id: number;
    projectId: number;
    userIdentifier: string;
    sessionId?: string;
    eventType: 'page_view' | 'conversion' | 'click' | 'form_submit' | 'signup' | 'purchase' | 'custom';
    eventName?: string;
    eventValue?: number;
    channelId?: number;
    utmSource?: string;
    utmMedium?: string;
    utmCampaign?: string;
    utmTerm?: string;
    utmContent?: string;
    referrer?: string;
    landingPage?: string;
    pageUrl?: string;
    metadata?: Record<string, any>;
    eventTimestamp: Date;
    createdAt: Date;
}

export interface IEventTrackingRequest {
    projectId: number;
    userIdentifier: string;
    sessionId?: string;
    eventType: string;
    eventName?: string;
    eventValue?: number;
    utmParams?: IUTMParameters;
    referrer?: string;
    pageUrl?: string;
    metadata?: Record<string, any>;
}

export interface IUTMParameters {
    source?: string;
    medium?: string;
    campaign?: string;
    term?: string;
    content?: string;
}

// ========== Touchpoint Interfaces ==========

export interface IAttributionTouchpoint {
    id: number;
    projectId: number;
    userIdentifier: string;
    conversionEventId: number;
    touchpointEventId: number;
    channelId: number;
    touchpointPosition: number;
    timeToConversionHours?: number;
    attributionWeightFirstTouch?: number;
    attributionWeightLastTouch?: number;
    attributionWeightLinear?: number;
    attributionWeightTimeDecay?: number;
    attributionWeightUShaped?: number;
    createdAt: Date;
}

export interface ITouchpointWithDetails extends IAttributionTouchpoint {
    channelName: string;
    channelCategory: string;
    eventType: string;
    eventTimestamp: Date;
    eventValue?: number;
}

// ========== Attribution Model Interfaces ==========

export type AttributionModel = 'first_touch' | 'last_touch' | 'linear' | 'time_decay' | 'u_shaped';

export interface IAttributionWeights {
    firstTouch: number;
    lastTouch: number;
    linear: number;
    timeDecay: number;
    uShaped: number;
}

export interface IAttributionCalculationRequest {
    projectId: number;
    userIdentifier: string;
    conversionEventId: number;
    model: AttributionModel;
    touchpoints: IAttributionEvent[];
}

export interface IAttributionCalculationResult {
    conversionEventId: number;
    model: AttributionModel;
    touchpoints: Array<{
        touchpointEventId: number;
        channelId: number;
        weight: number;
        attributedValue: number;
        position: number;
        timeToConversionHours: number;
    }>;
    totalAttributedValue: number;
}

// ========== Report Interfaces ==========

export interface IAttributionReport {
    id: number;
    projectId: number;
    reportType: 'channel_performance' | 'funnel_analysis' | 'journey_map' | 'roi_report';
    attributionModel: AttributionModel;
    dateRangeStart: Date;
    dateRangeEnd: Date;
    totalConversions: number;
    totalRevenue: number;
    channelBreakdown?: IChannelBreakdown[];
    topPaths?: IConversionPath[];
    avgTimeToConversionHours?: number;
    avgTouchpointsPerConversion?: number;
    generatedByUserId?: number;
    createdAt: Date;
    updatedAt: Date;
}

export interface IChannelBreakdown {
    channelId: number;
    channelName: string;
    channelCategory: string;
    conversions: number;
    revenue: number;
    revenuePercentage: number;
    avgTimeToConversion: number;
    avgTouchpoints: number;
}

export interface IConversionPath {
    path: string[];
    pathString: string;
    conversions: number;
    revenue: number;
    avgTimeToConversion: number;
    avgTouchpoints: number;
}

export interface IAttributionReportRequest {
    projectId: number;
    reportType: 'channel_performance' | 'funnel_analysis' | 'journey_map' | 'roi_report';
    attributionModel: AttributionModel;
    dateRangeStart: Date;
    dateRangeEnd: Date;
    userId?: number;
}

export interface IAttributionReportResponse {
    success: boolean;
    data?: IAttributionReport;
    error?: string;
}

// ========== Funnel Interfaces ==========

export interface IConversionFunnel {
    id: number;
    projectId: number;
    funnelName: string;
    funnelSteps: IFunnelStep[];
    totalEntered: number;
    totalCompleted: number;
    conversionRate?: number;
    stepCompletionRates?: IStepCompletionRate[];
    dropOffAnalysis?: IDropOffPoint[];
    avgTimeToCompleteMinutes?: number;
    createdByUserId?: number;
    createdAt: Date;
    updatedAt: Date;
}

export interface IFunnelStep {
    stepNumber: number;
    stepName: string;
    eventType: string;
    eventName?: string;
    requiredMetadata?: Record<string, any>;
}

export interface IStepCompletionRate {
    stepNumber: number;
    stepName: string;
    usersEntered: number;
    usersCompleted: number;
    completionRate: number;
    dropOffRate: number;
    avgTimeToNextStepMinutes?: number;
}

export interface IDropOffPoint {
    fromStep: number;
    toStep: number;
    dropOffCount: number;
    dropOffRate: number;
    primaryReasons?: string[];
}

export interface IFunnelAnalysisRequest {
    projectId: number;
    funnelName: string;
    funnelSteps: IFunnelStep[];
    dateRangeStart: Date;
    dateRangeEnd: Date;
    userId?: number;
}

export interface IFunnelAnalysisResponse {
    success: boolean;
    data?: IConversionFunnel;
    error?: string;
}

// ========== Journey Map Interfaces ==========

export interface ICustomerJourney {
    userIdentifier: string;
    journeyStart: Date;
    journeyEnd?: Date;
    totalTouchpoints: number;
    touchpoints: IJourneyTouchpoint[];
    conversions: IJourneyConversion[];
    totalRevenue: number;
    journeyDurationHours: number;
}

export interface IJourneyTouchpoint {
    eventId: number;
    eventType: string;
    channelName: string;
    channelCategory: string;
    timestamp: Date;
    pageUrl?: string;
    eventValue?: number;
}

export interface IJourneyConversion {
    eventId: number;
    eventName: string;
    conversionValue: number;
    timestamp: Date;
    attributedChannels: Array<{
        channelName: string;
        weight: number;
        attributedValue: number;
    }>;
}

export interface IJourneyMapRequest {
    projectId: number;
    userIdentifier?: string;
    dateRangeStart: Date;
    dateRangeEnd: Date;
    limit?: number;
}

export interface IJourneyMapResponse {
    success: boolean;
    data?: ICustomerJourney[];
    totalJourneys: number;
    error?: string;
}

// ========== ROI Interfaces ==========

export interface IROIMetrics {
    channelId: number;
    channelName: string;
    totalSpend?: number;
    totalRevenue: number;
    totalConversions: number;
    roi?: number; // (revenue - spend) / spend * 100
    roas?: number; // revenue / spend
    costPerConversion?: number;
    revenuePerConversion: number;
    profitMargin?: number;
}

export interface IROIReportRequest {
    projectId: number;
    dateRangeStart: Date;
    dateRangeEnd: Date;
    attributionModel: AttributionModel;
    includeSpendData?: boolean;
}

export interface IROIReportResponse {
    success: boolean;
    data?: {
        channels: IROIMetrics[];
        totalSpend?: number;
        totalRevenue: number;
        totalConversions: number;
        overallROI?: number;
        overallROAS?: number;
    };
    error?: string;
}

// ========== AI Attribution Insights Interfaces ==========

export interface IAttributionInsightRequest {
    projectId: number;
    attributionReport: IAttributionReport;
    includeRecommendations?: boolean;
}

export interface IAttributionInsight {
    insightType: 'anomaly' | 'trend' | 'recommendation' | 'optimization';
    title: string;
    description: string;
    severity: 'high' | 'medium' | 'low';
    affectedChannels?: string[];
    suggestedActions?: string[];
    potentialImpact?: string;
    confidence: number;
}

export interface IAttributionInsightResponse {
    success: boolean;
    insights?: IAttributionInsight[];
    summary?: string;
    error?: string;
}
