import { useAppFetch } from '@/composables/useAppFetch';
import { baseUrl } from '~/composables/Utils';
import { getAuthToken } from '~/composables/AuthToken';

export type AttributionModel = 'first_touch' | 'last_touch' | 'linear' | 'time_decay' | 'u_shaped' | 'data_driven';

export interface IChannelAttribution {
    channelId: number;
    channelName: string;
    conversions: number;
    revenue: number;
    revenuePercentage: number;
    conversionPercentage: number;
}

export interface IFunnelAttributionData {
    model: AttributionModel;
    funnelName: string;
    totalConversions: number;
    totalRevenue: number;
    channelBreakdown: IChannelAttribution[];
}

export interface IModelComparison {
    model: AttributionModel;
    label: string;
    channels: Array<{
        channelId: number;
        channelName: string;
        conversions: number;
        revenue: number;
        revenuePercentage: number;
    }>;
}

export interface IAttributionSummaryData {
    models: IModelComparison[];
    message?: string;
}

export const ATTRIBUTION_MODEL_LABELS: Record<AttributionModel, string> = {
    first_touch: 'First Touch',
    last_touch: 'Last Touch',
    linear: 'Linear',
    time_decay: 'Time Decay',
    u_shaped: 'Position Based',
    data_driven: 'Data Driven',
};

export const ATTRIBUTION_MODEL_DESCRIPTIONS: Record<AttributionModel, string> = {
    first_touch: '100% credit to the first interaction a user had with your brand.',
    last_touch: '100% credit to the last interaction before conversion.',
    linear: 'Equal credit distributed across all touchpoints in the journey.',
    time_decay: 'More credit to recent touchpoints — exponential decay with 7-day half-life.',
    u_shaped: '40% to first touch, 40% to last touch, 20% split among middle touchpoints.',
    data_driven: 'Shapley Value algorithm — fair credit based on each channel\'s marginal contribution across all possible channel combinations.',
};

export function useAttributionModels() {
    const isLoading = ref(false);
    const error = ref<string | null>(null);

    async function fetchFunnelAttribution(
        funnelId: number,
        model: AttributionModel,
        startDate: string,
        endDate: string,
        source?: 'ad_platforms',
    ): Promise<IFunnelAttributionData | null> {
        isLoading.value = true;
        error.value = null;
        try {
            const token = getAuthToken();
            if (!token) return null;

            let url = `${baseUrl()}/funnels/${funnelId}/attribution?model=${encodeURIComponent(model)}&startDate=${encodeURIComponent(startDate)}&endDate=${encodeURIComponent(endDate)}`;
            if (source) url += `&source=${source}`;
            const response = await useAppFetch<{ success: boolean; data: IFunnelAttributionData }>(url, {
                headers: {
                    Authorization: `Bearer ${token}`,
                    'Authorization-Type': 'auth',
                },
            });
            return response?.data ?? null;
        } catch (err: any) {
            error.value = err?.message || 'Failed to fetch attribution data';
            return null;
        } finally {
            isLoading.value = false;
        }
    }

    async function fetchAttributionSummary(
        projectId: number,
        startDate: string,
        endDate: string,
        funnelId?: number,
        source?: 'ad_platforms',
    ): Promise<IAttributionSummaryData | null> {
        isLoading.value = true;
        error.value = null;
        try {
            const token = getAuthToken();
            if (!token) return null;

            let url = `${baseUrl()}/funnels/attribution-summary?projectId=${projectId}&startDate=${encodeURIComponent(startDate)}&endDate=${encodeURIComponent(endDate)}`;
            if (funnelId) url += `&funnelId=${funnelId}`;
            if (source) url += `&source=${source}`;
            const response = await useAppFetch<{ success: boolean; data: IAttributionSummaryData }>(url, {
                headers: {
                    Authorization: `Bearer ${token}`,
                    'Authorization-Type': 'auth',
                },
            });
            return response?.data ?? null;
        } catch (err: any) {
            error.value = err?.message || 'Failed to fetch attribution summary';
            return null;
        } finally {
            isLoading.value = false;
        }
    }

    return {
        isLoading,
        error,
        fetchFunnelAttribution,
        fetchAttributionSummary,
    };
}
