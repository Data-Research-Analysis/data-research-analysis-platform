import { defineStore } from 'pinia'

/**
 * Attribution Store
 * Phase 2: Marketing Attribution Engine
 * 
 * Manages attribution reports, channel performance, funnels, and ROI metrics
 */

export interface IAttributionReport {
    id: number;
    projectId: number;
    reportName: string;
    attributionModel: AttributionModel;
    dateRangeStart: string;
    dateRangeEnd: string;
    totalConversions: number;
    totalRevenue: number;
    avgConversionRate?: number;
    channelBreakdown: IChannelBreakdown[];
    conversionPaths: IConversionPath[];
    generatedByUserId?: number;
    createdAt: string;
    updatedAt: string;
}

export interface IChannelBreakdown {
    channelName: string;
    touchpoints: number;
    conversions: number;
    revenue: number;
    conversionRate: number;
}

export interface IConversionPath {
    path: string[];
    pathString: string;
    conversions: number;
    revenue: number;
    avgTouchpoints: number;
    avgTimeToConversion: number;
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
}

export interface IROIMetrics {
    channelId: number;
    channelName: string;
    totalRevenue: number;
    totalConversions: number;
    revenuePerConversion: number;
    totalSpend?: number;
    roi?: number;
    roas?: number;
    costPerConversion?: number;
    profitMargin?: number;
}

export interface IConversionFunnel {
    id: number;
    projectId: number;
    funnelName: string;
    funnelSteps: IFunnelStep[];
    totalEntered: number;
    totalCompleted: number;
    conversionRate?: number;
    stepCompletionRates: IStepCompletionRate[];
    dropOffAnalysis: IDropOffPoint[];
    avgTimeToCompleteMinutes?: number;
    createdByUserId?: number;
    createdAt: string;
    updatedAt: string;
}

export interface IFunnelStep {
    stepNumber: number;
    stepName: string;
    eventType: string;
    eventName?: string;
}

export interface IStepCompletionRate {
    stepNumber: number;
    stepName: string;
    usersEntered: number;
    usersCompleted: number;
    completionRate: number;
    dropOffRate: number;
}

export interface IDropOffPoint {
    fromStep: number;
    toStep: number;
    dropOffCount: number;
    dropOffRate: number;
}

export interface ICustomerJourney {
    userIdentifier: string;
    journeyStart: string;
    journeyEnd: string;
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
    timestamp: string;
    pageUrl?: string;
    eventValue?: number;
}

export interface IJourneyConversion {
    eventId: number;
    eventName: string;
    conversionValue: number;
    timestamp: string;
    attributedChannels: Array<{
        channelName: string;
        weight: number;
        attributedValue: number;
    }>;
}

export interface IAttributionChannel {
    id: number;
    name: string;
    category: string;
    source?: string;
    medium?: string;
    campaign?: string;
    projectId: number;
    createdAt: string;
    updatedAt: string;
}

export type AttributionModel = 'first_touch' | 'last_touch' | 'linear' | 'time_decay' | 'u_shaped';

export interface IModelComparisonResult {
    channelId: number;
    channelName: string;
    models: {
        model: AttributionModel;
        attributionCredit: number;
        conversions: number;
        revenue: number;
    }[];
}

export const useAttributionStore = defineStore('attributionDRA', () => {
    const reports = ref<IAttributionReport[]>([])
    const selectedReport = ref<IAttributionReport>()
    const channelPerformance = ref<IChannelPerformance[]>([])
    const roiMetrics = ref<IROIMetrics[]>([])
    const funnels = ref<IConversionFunnel[]>([])
    const selectedFunnel = ref<IConversionFunnel>()
    const customerJourneys = ref<ICustomerJourney[]>([])
    const channels = ref<IAttributionChannel[]>([])
    const conversionPaths = ref<IConversionPath[]>([])
    const modelComparison = ref<IModelComparisonResult[]>([])
    const ga4Sessions = ref<number | null>(null)
    
    // Loading states
    const loading = ref({
        reports: false,
        channelPerformance: false,
        roi: false,
        funnels: false,
        journeys: false,
        channels: false,
        modelComparison: false,
        ga4Sessions: false,
    })

    // ===== Reports Management =====
    
    function setReports(reportsList: IAttributionReport[]) {
        reports.value = reportsList;
        if (import.meta.client) {
            localStorage.setItem('attributionReports', JSON.stringify(reportsList));
            enableRefreshDataFlag('setAttributionReports');
        }
    }

    function setSelectedReport(report: IAttributionReport) {
        selectedReport.value = report;
        if (import.meta.client) {
            localStorage.setItem('selectedAttributionReport', JSON.stringify(report));
        }
    }

    function getReports() {
        if (import.meta.client && localStorage.getItem('attributionReports')) {
            reports.value = JSON.parse(localStorage.getItem('attributionReports') || '[]');
        }
        return reports.value;
    }

    function getSelectedReport() {
        if (import.meta.client && localStorage.getItem('selectedAttributionReport')) {
            selectedReport.value = JSON.parse(localStorage.getItem('selectedAttributionReport') || 'null');
        }
        return selectedReport.value;
    }

    async function retrieveReports(projectId: number) {
        loading.value.reports = true;
        try {
            const token = getAuthToken();
            if (!token) {
                reports.value = [];
                return;
            }
            const config = useRuntimeConfig();
            const data = await $fetch<{ success: boolean; data: IAttributionReport[] }>(
                `${config.public.apiBase}/attribution/reports/${projectId}`,
                {
                    method: 'GET',
                    credentials: 'include',
                    headers: {
                        'Authorization': `Bearer ${token}`,
                        'Authorization-Type': 'auth',
                    }
                }
            );
            if (data.success) {
                setReports(data.data);
            }
        } catch (error) {
            console.error('Error retrieving attribution reports:', error);
            reports.value = [];
        } finally {
            loading.value.reports = false;
        }
    }

    async function generateReport(
        projectId: number,
        reportName: string,
        attributionModel: AttributionModel,
        startDate: string,
        endDate: string
    ): Promise<{ success: boolean; report?: IAttributionReport; error?: string }> {
        try {
            const token = getAuthToken();
            if (!token) {
                return { success: false, error: 'Not authenticated' };
            }
            const config = useRuntimeConfig();
            const data = await $fetch<{ success: boolean; report?: IAttributionReport; error?: string }>(
                `${config.public.apiBase}/attribution/reports`,
                {
                    method: 'POST',
                    credentials: 'include',
                    headers: {
                        'Authorization': `Bearer ${token}`,
                        'Authorization-Type': 'auth',
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({
                        projectId,
                        reportName,
                        attributionModel,
                        startDate,
                        endDate
                    })
                }
            );
            
            if (data.success && data.report) {
                // Add report to local state
                reports.value.unshift(data.report);
                setReports(reports.value);
            }
            
            return data;
        } catch (error) {
            console.error('Error generating attribution report:', error);
            return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
        }
    }

    async function deleteReport(reportId: number): Promise<boolean> {
        try {
            const token = getAuthToken();
            if (!token) return false;
            
            const config = useRuntimeConfig();
            const data = await $fetch<{ success: boolean }>(
                `${config.public.apiBase}/attribution/report/${reportId}`,
                {
                    method: 'DELETE',
                    credentials: 'include',
                    headers: {
                        'Authorization': `Bearer ${token}`,
                        'Authorization-Type': 'auth',
                    }
                }
            );
            
            if (data.success) {
                reports.value = reports.value.filter(r => r.id !== reportId);
                setReports(reports.value);
                return true;
            }
            return false;
        } catch (error) {
            console.error('Error deleting report:', error);
            return false;
        }
    }

    // ===== Channel Performance =====
    
    function setChannelPerformance(performance: IChannelPerformance[]) {
        channelPerformance.value = performance;
        if (import.meta.client) {
            localStorage.setItem('channelPerformance', JSON.stringify(performance));
        }
    }

    async function retrieveChannelPerformance(
        projectId: number,
        attributionModel: AttributionModel,
        startDate: string,
        endDate: string,
        campaignId?: number
    ) {
        loading.value.channelPerformance = true;
        try {
            const token = getAuthToken();
            if (!token) {
                channelPerformance.value = [];
                return;
            }
            const config = useRuntimeConfig();
            const data = await $fetch<{ success: boolean; data: IChannelPerformance[] }>(
                `${config.public.apiBase}/attribution/channel-performance`,
                {
                    method: 'POST',
                    credentials: 'include',
                    headers: {
                        'Authorization': `Bearer ${token}`,
                        'Authorization-Type': 'auth',
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({
                        projectId,
                        attributionModel,
                        startDate,
                        endDate,
                        ...(campaignId ? { campaign_id: campaignId } : {})
                    })
                }
            );
            
            if (data.success) {
                setChannelPerformance(data.data);
            }
        } catch (error) {
            console.error('Error retrieving channel performance:', error);
            channelPerformance.value = [];
        } finally {
            loading.value.channelPerformance = false;
        }
    }

    // ===== ROI Metrics =====
    
    function setROIMetrics(metrics: IROIMetrics[]) {
        roiMetrics.value = metrics;
        if (import.meta.client) {
            localStorage.setItem('roiMetrics', JSON.stringify(metrics));
        }
    }

    async function retrieveROIMetrics(
        projectId: number,
        attributionModel: AttributionModel,
        startDate: string,
        endDate: string,
        channelSpend?: Record<number, number>,
        campaignId?: number
    ) {
        loading.value.roi = true;
        try {
            const token = getAuthToken();
            if (!token) {
                roiMetrics.value = [];
                return;
            }
            const config = useRuntimeConfig();
            const data = await $fetch<{ success: boolean; data: IROIMetrics[] }>(
                `${config.public.apiBase}/attribution/roi`,
                {
                    method: 'POST',
                    credentials: 'include',
                    headers: {
                        'Authorization': `Bearer ${token}`,
                        'Authorization-Type': 'auth',
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({
                        projectId,
                        attributionModel,
                        startDate,
                        endDate,
                        channelSpend,
                        ...(campaignId ? { campaign_id: campaignId } : {})
                    })
                }
            );
            
            if (data.success) {
                setROIMetrics(data.data);
            }
        } catch (error) {
            console.error('Error retrieving ROI metrics:', error);
            roiMetrics.value = [];
        } finally {
            loading.value.roi = false;
        }
    }

    // ===== Funnels =====
    
    function setFunnels(funnelsList: IConversionFunnel[]) {
        funnels.value = funnelsList;
        if (import.meta.client) {
            localStorage.setItem('attributionFunnels', JSON.stringify(funnelsList));
        }
    }

    function setSelectedFunnel(funnel: IConversionFunnel) {
        selectedFunnel.value = funnel;
        if (import.meta.client) {
            localStorage.setItem('selectedFunnel', JSON.stringify(funnel));
        }
    }

    async function analyzeFunnel(
        projectId: number,
        funnelName: string,
        funnelSteps: IFunnelStep[],
        dateRangeStart: string,
        dateRangeEnd: string,
        campaignId?: number
    ): Promise<{ success: boolean; data?: IConversionFunnel; error?: string }> {
        loading.value.funnels = true;
        try {
            const token = getAuthToken();
            if (!token) {
                return { success: false, error: 'Not authenticated' };
            }
            const config = useRuntimeConfig();
            const result = await $fetch<{ success: boolean; data?: IConversionFunnel; error?: string }>(
                `${config.public.apiBase}/attribution/analyze-funnel`,
                {
                    method: 'POST',
                    credentials: 'include',
                    headers: {
                        'Authorization': `Bearer ${token}`,
                        'Authorization-Type': 'auth',
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({
                        projectId,
                        funnelName,
                        funnelSteps,
                        dateRangeStart,
                        dateRangeEnd,
                        ...(campaignId ? { campaign_id: campaignId } : {})
                    })
                }
            );
            
            if (result.success && result.data) {
                funnels.value.unshift(result.data);
                setFunnels(funnels.value);
            }
            
            return result;
        } catch (error) {
            console.error('Error analyzing funnel:', error);
            return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
        } finally {
            loading.value.funnels = false;
        }
    }

    // ===== Customer Journeys =====
    
    function setCustomerJourneys(journeys: ICustomerJourney[]) {
        customerJourneys.value = journeys;
        if (import.meta.client) {
            localStorage.setItem('customerJourneys', JSON.stringify(journeys));
        }
    }

    async function retrieveJourneyMap(
        projectId: number,
        dateRangeStart: string,
        dateRangeEnd: string,
        userIdentifier?: string,
        limit?: number,
        campaignId?: number
    ): Promise<{ success: boolean; totalJourneys: number; error?: string }> {
        loading.value.journeys = true;
        try {
            const token = getAuthToken();
            if (!token) {
                customerJourneys.value = [];
                return { success: false, totalJourneys: 0, error: 'Not authenticated' };
            }
            const config = useRuntimeConfig();
            const result = await $fetch<{ 
                success: boolean; 
                data?: ICustomerJourney[];
                totalJourneys: number;
                error?: string;
            }>(
                `${config.public.apiBase}/attribution/journey-map`,
                {
                    method: 'POST',
                    credentials: 'include',
                    headers: {
                        'Authorization': `Bearer ${token}`,
                        'Authorization-Type': 'auth',
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({
                        projectId,
                        dateRangeStart,
                        dateRangeEnd,
                        userIdentifier,
                        limit,
                        ...(campaignId ? { campaign_id: campaignId } : {})
                    })
                }
            );
            
            if (result.success && result.data) {
                setCustomerJourneys(result.data);
            }
            
            return result;
        } catch (error) {
            console.error('Error retrieving journey map:', error);
            customerJourneys.value = [];
            return { success: false, totalJourneys: 0, error: error instanceof Error ? error.message : 'Unknown error' };
        } finally {
            loading.value.journeys = false;
        }
    }

    // ===== Model Comparison =====

    function setModelComparison(data: IModelComparisonResult[]) {
        modelComparison.value = data;
    }

    async function compareModels(
        projectId: number,
        startDate: string,
        endDate: string,
        campaignId?: number
    ): Promise<{ success: boolean; error?: string }> {
        loading.value.modelComparison = true;
        try {
            const token = getAuthToken();
            if (!token) {
                modelComparison.value = [];
                return { success: false, error: 'Not authenticated' };
            }
            const config = useRuntimeConfig();
            const result = await $fetch<{ success: boolean; data?: IModelComparisonResult[]; error?: string }>(
                `${config.public.apiBase}/attribution/compare-models`,
                {
                    method: 'POST',
                    credentials: 'include',
                    headers: {
                        'Authorization': `Bearer ${token}`,
                        'Authorization-Type': 'auth',
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({
                        projectId,
                        startDate,
                        endDate,
                        ...(campaignId ? { campaign_id: campaignId } : {})
                    })
                }
            );
            if (result.success && result.data) {
                setModelComparison(result.data);
            }
            return { success: result.success, error: result.error };
        } catch (error) {
            console.error('Error comparing attribution models:', error);
            modelComparison.value = [];
            return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
        } finally {
            loading.value.modelComparison = false;
        }
    }

    // ===== Channels =====
    
    function setChannels(channelsList: IAttributionChannel[]) {
        channels.value = channelsList;
        if (import.meta.client) {
            localStorage.setItem('attributionChannels', JSON.stringify(channelsList));
        }
    }

    async function retrieveChannels(projectId: number) {
        loading.value.channels = true;
        try {
            const token = getAuthToken();
            if (!token) {
                channels.value = [];
                return;
            }
            const config = useRuntimeConfig();
            const data = await $fetch<{ success: boolean; data: IAttributionChannel[] }>(
                `${config.public.apiBase}/attribution/channels/${projectId}`,
                {
                    method: 'GET',
                    credentials: 'include',
                    headers: {
                        'Authorization': `Bearer ${token}`,
                        'Authorization-Type': 'auth',
                    }
                }
            );
            
            if (data.success) {
                setChannels(data.data);
            }
        } catch (error) {
            console.error('Error retrieving channels:', error);
            channels.value = [];
        } finally {
            loading.value.channels = false;
        }
    }

    // ===== Conversion Paths =====
    
    function setConversionPaths(paths: IConversionPath[]) {
        conversionPaths.value = paths;
        if (import.meta.client) {
            localStorage.setItem('conversionPaths', JSON.stringify(paths));
        }
    }

    async function retrieveConversionPaths(
        projectId: number,
        attributionModel: AttributionModel,
        startDate: string,
        endDate: string,
        limit?: number
    ) {
        try {
            const token = getAuthToken();
            if (!token) {
                conversionPaths.value = [];
                return;
            }
            const config = useRuntimeConfig();
            const data = await $fetch<{ success: boolean; data: IConversionPath[] }>(
                `${config.public.apiBase}/attribution/conversion-paths`,
                {
                    method: 'POST',
                    credentials: 'include',
                    headers: {
                        'Authorization': `Bearer ${token}`,
                        'Authorization-Type': 'auth',
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({
                        projectId,
                        attributionModel,
                        startDate,
                        endDate,
                        limit
                    })
                }
            );
            
            if (data.success) {
                setConversionPaths(data.data);
            }
        } catch (error) {
            console.error('Error retrieving conversion paths:', error);
            conversionPaths.value = [];
        }
    }

    // ===== Event Tracking =====
    
    async function trackEvent(
        projectId: number,
        userIdentifier: string,
        eventType: string,
        eventData: {
            eventName?: string;
            eventValue?: number;
            eventTimestamp?: string;
            pageUrl?: string;
            referrer?: string;
            userAgent?: string;
            ipAddress?: string;
            utmParams?: Record<string, string>;
            customData?: Record<string, any>;
        }
    ): Promise<{ success: boolean; eventId?: number; error?: string }> {
        try {
            const token = getAuthToken();
            if (!token) {
                return { success: false, error: 'Not authenticated' };
            }
            const config = useRuntimeConfig();
            const result = await $fetch<{ success: boolean; eventId?: number; error?: string }>(
                `${config.public.apiBase}/attribution/track`,
                {
                    method: 'POST',
                    credentials: 'include',
                    headers: {
                        'Authorization': `Bearer ${token}`,
                        'Authorization-Type': 'auth',
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({
                        projectId,
                        userIdentifier,
                        eventType,
                        ...eventData
                    })
                }
            );
            
            return result;
        } catch (error) {
            console.error('Error tracking event:', error);
            return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
        }
    }

    // ===== Clear Functions =====
    
    function clearReports() {
        reports.value = [];
        if (import.meta.client) {
            localStorage.removeItem('attributionReports');
        }
    }

    function clearAll() {
        reports.value = [];
        selectedReport.value = undefined;
        channelPerformance.value = [];
        roiMetrics.value = [];
        funnels.value = [];
        selectedFunnel.value = undefined;
        customerJourneys.value = [];
        channels.value = [];
        conversionPaths.value = [];
        modelComparison.value = [];
        
        if (import.meta.client) {
            localStorage.removeItem('attributionReports');
            localStorage.removeItem('selectedAttributionReport');
            localStorage.removeItem('channelPerformance');
            localStorage.removeItem('roiMetrics');
            localStorage.removeItem('attributionFunnels');
            localStorage.removeItem('selectedFunnel');
            localStorage.removeItem('customerJourneys');
            localStorage.removeItem('attributionChannels');
            localStorage.removeItem('conversionPaths');
        }
    }

    // ===== GA4 Web Sessions =====

    async function retrieveGA4Sessions(
        projectId: number,
        startDate: string,
        endDate: string
    ): Promise<void> {
        loading.value.ga4Sessions = true;
        try {
            const config = useRuntimeConfig();
            const token = getAuthToken();
            const result = await $fetch<{ success: boolean; data: { totalSessions: number } | null }>(
                `${config.public.apiBase}/google-analytics/sessions-summary/${projectId}?startDate=${startDate}&endDate=${endDate}`,
                {
                    credentials: 'include',
                    headers: token
                        ? { 'Authorization': `Bearer ${token}`, 'Authorization-Type': 'auth' }
                        : {},
                }
            );
            ga4Sessions.value = result.success && result.data ? result.data.totalSessions : null;
        } catch {
            ga4Sessions.value = null;
        } finally {
            loading.value.ga4Sessions = false;
        }
    }

    return {
        // State
        reports,
        selectedReport,
        channelPerformance,
        roiMetrics,
        funnels,
        selectedFunnel,
        customerJourneys,
        channels,
        conversionPaths,
        modelComparison,
        ga4Sessions,
        loading,
        
        // Reports
        setReports,
        setSelectedReport,
        getReports,
        getSelectedReport,
        retrieveReports,
        generateReport,
        deleteReport,
        
        // Channel Performance
        setChannelPerformance,
        retrieveChannelPerformance,
        
        // ROI
        setROIMetrics,
        retrieveROIMetrics,
        
        // Funnels
        setFunnels,
        setSelectedFunnel,
        analyzeFunnel,
        
        // Journeys
        setCustomerJourneys,
        retrieveJourneyMap,
        
        // Channels
        setChannels,
        retrieveChannels,
        
        // Conversion Paths
        setConversionPaths,
        retrieveConversionPaths,
        
        // Event Tracking
        trackEvent,
        
        // Model Comparison
        setModelComparison,
        compareModels,
        modelComparison,

        // GA4 Sessions
        ga4Sessions,
        retrieveGA4Sessions,

        // Clear
        clearReports,
        clearAll
    }
});
