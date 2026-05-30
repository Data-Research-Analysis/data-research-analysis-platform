/**
 * useAttribution — Composable for fetching and managing multi-touch
 * attribution data within the Intelligence Hub.
 *
 * Calls the backend POST /attribution/analyze endpoint and returns
 * channel attribution, conversion paths, time-to-conversion, and
 * ROI data. Supports switching between 5 attribution models:
 *   First Touch, Last Touch, Linear, Time Decay, U-Shaped
 *
 * When the ATTR-002 backend service is not yet available, the composable
 * falls back to structured empty states so the UI remains functional.
 */
import { useAppFetch } from '@/composables/useAppFetch';
import { baseUrl } from '~/composables/Utils';
import { getAuthToken } from '~/composables/AuthToken';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type AttributionModel = 'first_touch' | 'last_touch' | 'linear' | 'time_decay' | 'u_shaped';

export interface IAttributionModelOption {
    id: AttributionModel;
    label: string;
    shortLabel: string;
    description: string;
    icon: [string, string];
}

export interface IChannelAttribution {
    channel: string;
    attributedConversions: number;
    attributedRevenue: number;
    attributedROAS: number;
    /** Percentage of total attributed conversions (0-100) */
    conversionShare: number;
}

export interface IConversionPath {
    /** Ordered list of channel touchpoints in this path */
    path: string[];
    /** Frequency — how many users followed this path */
    frequency: number;
    /** Number of conversions from this path */
    conversions: number;
}

export interface ITimeToConversion {
    average: number;
    median: number;
    min: number;
    max: number;
    /** Distribution buckets for histogram: { label, count } */
    distribution: { label: string; count: number }[];
}

export interface IAttributionROI {
    channel: string;
    spend: number;
    attributedConversions: number;
    attributedRevenue: number;
    attributedROAS: number;
}

export interface IAttributionData {
    channelAttribution: IChannelAttribution[];
    conversionPaths: IConversionPath[];
    timeToConversion: ITimeToConversion;
    roiByChannel: IAttributionROI[];
    aiInsights: string;
}

export interface UseAttributionOptions {
    dataModelId?: MaybeRef<number | null>;
    startDate?: MaybeRef<string | null>;
    endDate?: MaybeRef<string | null>;
    /** Whether to auto-fetch on mount. Defaults to true. */
    immediate?: boolean;
}

// ---------------------------------------------------------------------------
// Available attribution models
// ---------------------------------------------------------------------------

export const ATTRIBUTION_MODELS: IAttributionModelOption[] = [
    {
        id: 'first_touch',
        label: 'First Touch',
        shortLabel: 'First',
        description: '100% credit to the first touchpoint in the journey',
        icon: ['fas', 'flag'],
    },
    {
        id: 'last_touch',
        label: 'Last Touch',
        shortLabel: 'Last',
        description: '100% credit to the last touchpoint before conversion',
        icon: ['fas', 'flag-checkered'],
    },
    {
        id: 'linear',
        label: 'Linear',
        shortLabel: 'Linear',
        description: 'Equal credit distributed across all touchpoints',
        icon: ['fas', 'arrows-left-right'],
    },
    {
        id: 'time_decay',
        label: 'Time Decay',
        shortLabel: 'Decay',
        description: 'More credit to touchpoints closer to conversion',
        icon: ['fas', 'clock-rotate-left'],
    },
    {
        id: 'u_shaped',
        label: 'U-Shaped',
        shortLabel: 'U-Shape',
        description: '40% first, 40% last, 20% distributed among middle',
        icon: ['fas', 'bezier-curve'],
    },
];

// ---------------------------------------------------------------------------
// Composable
// ---------------------------------------------------------------------------

export function useAttribution(options: UseAttributionOptions) {
    const {
        dataModelId,
        startDate,
        endDate,
        immediate = true,
    } = options;

    const selectedModel = ref<AttributionModel>('last_touch');
    const rawData = ref<IAttributionData | null>(null);
    const isLoading = ref(false);
    const hasFetched = ref(false);
    const error = ref<string | null>(null);

    /**
     * Fetch attribution data from the API.
     */
    async function fetch(model?: AttributionModel) {
        const dmId = toValue(dataModelId);
        const start = toValue(startDate);
        const end = toValue(endDate);
        const useModel = model ?? selectedModel.value;

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

            const url = `${baseUrl()}/attribution/analyze`;
            const response = await useAppFetch<{ success: boolean; data: IAttributionData }>(url, {
                method: 'POST',
                headers: {
                    Authorization: `Bearer ${token}`,
                    'Authorization-Type': 'auth',
                    'Content-Type': 'application/json',
                },
                body: {
                    data_model_id: dmId,
                    attribution_model: useModel,
                    date_range: { start, end },
                },
            });

            rawData.value = response?.data ?? null;
            hasFetched.value = true;
        } catch (err: any) {
            // Endpoint not yet available (ATTR-002) — silently use null
            console.warn('[useAttribution] Attribution endpoint not available:', err?.message);
            rawData.value = null;
            hasFetched.value = true;
            error.value = null; // Don't surface backend-not-ready as error
        } finally {
            isLoading.value = false;
        }
    }

    /**
     * Switch attribution model and refetch.
     */
    async function selectModel(model: AttributionModel) {
        if (model === selectedModel.value) return;
        selectedModel.value = model;
        await fetch(model);
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

    function formatRatio(value: number): string {
        return `${value.toFixed(2)}x`;
    }

    function formatPercent(value: number): string {
        return `${value.toFixed(1)}%`;
    }

    /**
     * Current model metadata.
     */
    const currentModel = computed(() =>
        ATTRIBUTION_MODELS.find(m => m.id === selectedModel.value)!,
    );

    /**
     * Whether we have data to display.
     */
    const hasData = computed(() => rawData.value !== null
        && rawData.value.channelAttribution.length > 0,
    );

    // Auto-fetch when dependencies change
    if (immediate) {
        watch(
            [() => toValue(dataModelId), () => toValue(startDate), () => toValue(endDate)],
            () => { fetch(); },
            { immediate: true },
        );
    }

    return {
        selectedModel,
        currentModel,
        rawData,
        isLoading,
        hasFetched,
        hasData,
        error,
        fetch,
        selectModel,
        formatCurrency,
        formatNumber,
        formatRatio,
        formatPercent,
    };
}