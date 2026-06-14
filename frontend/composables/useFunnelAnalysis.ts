/**
 * useFunnelAnalysis — Composable for fetching conversion funnel data
 * within the Attribution tab of the Intelligence Hub.
 *
 * Calls POST /attribution/funnel and returns:
 *   - Overall funnel stages with drop-off rates
 *   - Per-channel funnel breakdowns
 *   - Time-per-stage estimates
 *
 * When the endpoint is not available, falls back to structured empty
 * states so the UI remains functional.
 */
import { useAppFetch } from '@/composables/useAppFetch';
import { baseUrl } from '~/composables/Utils';
import { getAuthToken } from '~/composables/AuthToken';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface IFunnelStage {
    id: string;
    name: string;
    order: number;
    count: number;
    conversionRateToNext: number | null;
    dropOffPercent: number | null;
}

export interface IChannelFunnel {
    channel: string;
    stages: IFunnelStage[];
    completionRate: number;
}

export interface ITimePerStage {
    fromStage: string;
    toStage: string;
    averageDays: number;
}

export interface IFunnelData {
    stages: IFunnelStage[];
    channelFunnels: IChannelFunnel[];
    timePerStage: ITimePerStage[];
}

export interface UseFunnelAnalysisOptions {
    dataModelId?: MaybeRef<number | null>;
    startDate?: MaybeRef<string | null>;
    endDate?: MaybeRef<string | null>;
    /** Whether to auto-fetch on mount. Defaults to true. */
    immediate?: boolean;
}

// ---------------------------------------------------------------------------
// Composable
// ---------------------------------------------------------------------------

export function useFunnelAnalysis(options: UseFunnelAnalysisOptions) {
    const {
        dataModelId,
        startDate,
        endDate,
        immediate = true,
    } = options;

    const rawData = ref<IFunnelData | null>(null);
    const isLoading = ref(false);
    const hasFetched = ref(false);
    const error = ref<string | null>(null);

    /**
     * Fetch funnel data from the API.
     */
    async function fetch() {
        const dmId = toValue(dataModelId);
        const start = toValue(startDate);
        const end = toValue(endDate);

        if (!dmId || !start || !end) {
            rawData.value = null;
            return;
        }

        isLoading.value = true;
        error.value = null;

        try {
            const token = getAuthToken();
            if (!token) {
                rawData.value = null;
                return;
            }

            const url = `${baseUrl()}/attribution/funnel`;
            const response = await useAppFetch<{ success: boolean; data: IFunnelData }>(url, {
                method: 'POST',
                headers: {
                    Authorization: `Bearer ${token}`,
                    'Authorization-Type': 'auth',
                    'Content-Type': 'application/json',
                },
                body: {
                    data_model_id: dmId,
                    date_range: { start, end },
                },
            });

            rawData.value = response?.data ?? null;
            hasFetched.value = true;
        } catch (err: any) {
            console.warn('[useFunnelAnalysis] Funnel endpoint not available:', err?.message);
            rawData.value = null;
            hasFetched.value = true;
            error.value = null;
        } finally {
            isLoading.value = false;
        }
    }

    /**
     * Whether we have data to display.
     */
    const hasData = computed(() =>
        rawData.value !== null && rawData.value.stages.length > 0,
    );

    /**
     * The funnel stages from the data.
     */
    const stages = computed(() => rawData.value?.stages ?? []);

    /**
     * Channel-specific funnel breakdowns.
     */
    const channelFunnels = computed(() => rawData.value?.channelFunnels ?? []);

    /**
     * Time per stage estimates.
     */
    const timePerStage = computed(() => rawData.value?.timePerStage ?? []);

    /**
     * The max count (first stage) for scaling the funnel width.
     */
    const maxCount = computed(() => {
        if (!stages.value.length) return 0;
        return Math.max(...stages.value.map(s => s.count));
    });

    /**
     * Overall completion rate (last stage / first stage).
     */
    const completionRate = computed(() => {
        if (stages.value.length < 2) return null;
        const first = stages.value[0].count;
        const last = stages.value[stages.value.length - 1].count;
        if (first === 0) return 0;
        return Math.round((last / first) * 1000) / 10;
    });

    // Formatting helpers
    function formatNumber(value: number): string {
        if (value >= 1_000_000) return `${(value / 1_000_000).toFixed(1)}M`;
        if (value >= 1_000) return `${(value / 1_000).toFixed(1)}K`;
        return value.toLocaleString();
    }

    function formatPercent(value: number): string {
        return `${value.toFixed(1)}%`;
    }

    // Auto-fetch when dependencies change
    if (immediate) {
        watch(
            [() => toValue(dataModelId), () => toValue(startDate), () => toValue(endDate)],
            () => { fetch(); },
            { immediate: true },
        );
    }

    return {
        rawData,
        isLoading,
        hasFetched,
        hasData,
        error,
        stages,
        channelFunnels,
        timePerStage,
        maxCount,
        completionRate,
        fetch,
        formatNumber,
        formatPercent,
    };
}