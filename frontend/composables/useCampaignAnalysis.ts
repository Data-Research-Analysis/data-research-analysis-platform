/**
 * useCampaignAnalysis — Composable for fetching campaign drill-down data.
 *
 * Calls GET /campaign-analysis/:campaignId with projectId (preferred) or
 * dataModelId (legacy), startDate, and endDate as query parameters.
 *
 * Returns full campaign analysis including KPIs, daily trend, dimension
 * breakdowns, AI analysis, and recommendations.
 */
import { useAppFetch } from '@/composables/useAppFetch';
import { baseUrl } from '~/composables/Utils';
import { getAuthToken } from '~/composables/AuthToken';

export interface ICampaignKPI {
    kpi: string;
    label: string;
    value: string;
}

export interface IDailyTrendRow {
    date: string;
    spend: number;
    impressions: number;
    clicks: number;
    conversions: number;
    revenue: number;
    ctr: number;
    cpc: number;
    cpa: number;
    roas: number;
}

export interface IDimensionRow {
    label: string;
    spend: number;
    impressions: number;
    clicks: number;
    conversions: number;
    revenue: number;
    ctr: number;
    cpc: number;
    cpa: number;
    roas: number;
    performanceScore: number;
    status: 'outperforming' | 'on-track' | 'underperforming';
}

export interface IDimensionBreakdown {
    dimension: string;
    available: boolean;
    rows: IDimensionRow[];
}

export interface ICampaignAnalysisData {
    campaignId: string;
    campaignName: string;
    channel: string;
    kpis: ICampaignKPI[];
    dailyTrend: IDailyTrendRow[];
    dimensionBreakdowns: IDimensionBreakdown[];
    aiAnalysis: string | null;
    recommendations: string[];
}

export interface ICampaignAnalysisResponse {
    success: boolean;
    data: ICampaignAnalysisData;
}

export interface UseCampaignAnalysisOptions {
    campaignId: Ref<string>;
    projectId?: Ref<number | null>;
    dataModelId?: Ref<number | null>;
    startDate: Ref<string>;
    endDate: Ref<string>;
    enabled?: Ref<boolean>;
}

export function useCampaignAnalysis(options: UseCampaignAnalysisOptions) {
    const data = ref<ICampaignAnalysisData | null>(null);
    const isLoading = ref(false);
    const error = ref<string | null>(null);

    async function fetchAnalysis() {
        const cid = options.campaignId.value;
        const pid = options.projectId?.value;
        const dmid = options.dataModelId?.value;

        if (!cid || (!pid && !dmid)) {
            data.value = null;
            return;
        }

        isLoading.value = true;
        error.value = null;

        try {
            const token = getAuthToken();
            const queryParams: Record<string, string> = {
                startDate: options.startDate.value,
                endDate: options.endDate.value,
            };

            // Prefer projectId over dataModelId
            if (pid) {
                queryParams.projectId = String(pid);
            } else if (dmid) {
                queryParams.dataModelId = String(dmid);
            }

            const queryString = new URLSearchParams(queryParams).toString();
            const url = `${baseUrl()}/campaign-analysis/${encodeURIComponent(cid)}?${queryString}`;

            const response = await useAppFetch<ICampaignAnalysisResponse>(url, {
                headers: {
                    Authorization: `Bearer ${token}`,
                    'Authorization-Type': 'auth',
                },
            });

            if (response?.success && response.data) {
                data.value = response.data;
            } else {
                data.value = null;
                error.value = 'Failed to load campaign analysis';
            }
        } catch (err: any) {
            console.error('[useCampaignAnalysis] Error:', err);
            error.value = err?.message || 'Failed to load campaign analysis';
            data.value = null;
        } finally {
            isLoading.value = false;
        }
    }

    // Watch for changes and refetch
    watch(
        [options.campaignId, options.startDate, options.endDate],
        () => {
            if (options.enabled?.value !== false) {
                fetchAnalysis();
            }
        },
        { immediate: false },
    );

    // Watch projectId/dataModelId
    if (options.projectId) {
        watch(options.projectId, () => {
            if (options.enabled?.value !== false) {
                fetchAnalysis();
            }
        });
    }
    if (options.dataModelId) {
        watch(options.dataModelId, () => {
            if (options.enabled?.value !== false) {
                fetchAnalysis();
            }
        });
    }

    return {
        data,
        isLoading,
        error,
        fetchAnalysis,
    };
}