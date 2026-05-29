/**
 * useCampaignDrillDown — Composable for fetching detailed campaign-level
 * analysis data for the Campaign Drill-Down Page (CMP-001).
 *
 * Calls the campaign analysis endpoint and provides reactive KPIs,
 * daily trend data, dimension breakdowns, and AI analysis.
 */
import { useAppFetch } from '@/composables/useAppFetch';
import { baseUrl } from '~/composables/Utils';
import { getAuthToken } from '~/composables/AuthToken';

export interface ICampaignKPIs {
    spend: number;
    conversions: number;
    cpa: number;
    roas: number;
    ctr: number;
    cpc: number;
    impressions: number;
    clicks: number;
    revenue: number;
}

export interface ICampaignKPIDelta {
    spend: number | null;
    conversions: number | null;
    cpa: number | null;
    roas: number | null;
    ctr: number | null;
    cpc: number | null;
}

export interface IDailyTrendPoint {
    date: string;
    spend: number;
    conversions: number;
    cpa: number;
}

export interface IDimensionRow {
    name: string;
    spend: number;
    impressions: number;
    clicks: number;
    conversions: number;
    ctr: number;
    cpc: number;
    cpa: number;
    roas: number;
    score: number;
}

export interface IDimensionBreakdown {
    dimension: string;
    label: string;
    rows: IDimensionRow[];
}

export interface ICampaignDrillDownData {
    campaignId: string;
    campaignName: string;
    channel: string;
    status: string;
    kpis: ICampaignKPIs;
    kpiDeltas: ICampaignKPIDelta;
    dailyTrend: IDailyTrendPoint[];
    dimensionBreakdowns: IDimensionBreakdown[];
    aiAnalysis: string | null;
    recommendations: string[];
}

export interface UseCampaignDrillDownOptions {
    dataModelId?: MaybeRef<number | null>;
    campaignId?: MaybeRef<string | null>;
    startDate?: MaybeRef<string | null>;
    endDate?: MaybeRef<string | null>;
}

export function useCampaignDrillDown(options: UseCampaignDrillDownOptions) {
    const {
        dataModelId,
        campaignId,
        startDate,
        endDate,
    } = options;

    const data = ref<ICampaignDrillDownData | null>(null);
    const isLoading = ref(false);
    const hasFetched = ref(false);
    const error = ref<string | null>(null);

    async function fetch() {
        const dmId = toValue(dataModelId);
        const cId = toValue(campaignId);
        const start = toValue(startDate);
        const end = toValue(endDate);

        if (!dmId || !cId || !start || !end) {
            data.value = null;
            return;
        }

        isLoading.value = true;
        error.value = null;
        try {
            const token = getAuthToken();
            if (!token) {
                data.value = null;
                return;
            }
            const params = new URLSearchParams({
                dataModelId: String(dmId),
                startDate: start,
                endDate: end,
            }).toString();
            const url = `${baseUrl()}/campaigns/${cId}/analysis?${params}`;
            const response = await useAppFetch<{
                success: boolean;
                data: ICampaignDrillDownData;
            }>(url, {
                headers: {
                    Authorization: `Bearer ${token}`,
                    'Authorization-Type': 'auth',
                },
            });

            data.value = response?.data ?? null;
            hasFetched.value = true;
        } catch (err: any) {
            error.value = err?.message || 'Failed to load campaign analysis';
            data.value = null;
        } finally {
            isLoading.value = false;
        }
    }

    // Formatting helpers
    function formatCurrency(value: number): string {
        if (value >= 1_000_000) return `$${(value / 1_000_000).toFixed(1)}M`;
        if (value >= 1_000) return `$${(value / 1_000).toFixed(1)}K`;
        return `$${value.toFixed(2)}`;
    }

    function formatNumber(value: number): string {
        if (value >= 1_000_000) return `${(value / 1_000_000).toFixed(1)}M`;
        if (value >= 1_000) return `${(value / 1_000).toFixed(1)}K`;
        return value.toLocaleString();
    }

    function formatPercent(value: number): string {
        return `${value.toFixed(2)}%`;
    }

    function formatRatio(value: number): string {
        return `${value.toFixed(2)}x`;
    }

    // Auto-fetch when dependencies change
    watch(
        [
            () => toValue(dataModelId),
            () => toValue(campaignId),
            () => toValue(startDate),
            () => toValue(endDate),
        ],
        () => { fetch(); },
        { immediate: true },
    );

    return {
        data,
        isLoading,
        hasFetched,
        error,
        fetch,
        formatCurrency,
        formatNumber,
        formatPercent,
        formatRatio,
    };
}
