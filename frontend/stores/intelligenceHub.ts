import { defineStore } from 'pinia';
import { useAppFetch } from '@/composables/useAppFetch';
import { baseUrl } from '~/composables/Utils';
import { getAuthToken } from '~/composables/AuthToken';
import type {
    IIntelligenceHubSummary,
    ITopCampaign,
    IIntelligenceDateRange,
} from '~/types/IMarketingHub';

export const useIntelligenceHubStore = defineStore('intelligenceHub', () => {
    const hubSummary = ref<IIntelligenceHubSummary | null>(null);
    const topCampaigns = ref<ITopCampaign[]>([]);
    const selectedCampaignId = ref<number | null>(null);
    const dateRange = ref<IIntelligenceDateRange>({ start: new Date(), end: new Date() });
    const isLoading = ref(false);
    const error = ref<string | null>(null);

    function getHubSummary(): IIntelligenceHubSummary | null {
        return hubSummary.value;
    }

    function getTopCampaigns(): ITopCampaign[] {
        return topCampaigns.value;
    }

    function getDateRange(): IIntelligenceDateRange {
        return dateRange.value;
    }

    async function retrieveHubSummary(projectId: number): Promise<void> {
        const token = getAuthToken();
        if (!token) return;

        isLoading.value = true;
        error.value = null;
        try {
            const { start, end } = dateRange.value;
            const params: Record<string, string> = {
                startDate: start.toISOString().split('T')[0],
                endDate: end.toISOString().split('T')[0],
            };
            if (selectedCampaignId.value !== null) {
                params.campaignId = String(selectedCampaignId.value);
            }

            const qs = new URLSearchParams(params).toString();
            const url = `${baseUrl()}/intelligence/hub/${projectId}?${qs}`;

            const result = await useAppFetch<{ success: boolean; data: IIntelligenceHubSummary }>(
                url,
                {
                    headers: {
                        Authorization: `Bearer ${token}`,
                        'Authorization-Type': 'auth',
                    },
                },
            );
            hubSummary.value = result.data;
        } catch (err: any) {
            error.value = err?.message ?? 'Failed to load hub data';
            hubSummary.value = null;
        } finally {
            isLoading.value = false;
        }
    }

    async function retrieveTopCampaigns(projectId: number, limit = 5): Promise<void> {
        const token = getAuthToken();
        if (!token) return;

        try {
            const { start, end } = dateRange.value;
            const qs = new URLSearchParams({
                startDate: start.toISOString().split('T')[0],
                endDate: end.toISOString().split('T')[0],
                limit: String(limit),
            }).toString();

            const url = `${baseUrl()}/intelligence/top-campaigns/${projectId}?${qs}`;

            const result = await useAppFetch<{ success: boolean; data: ITopCampaign[] }>(
                url,
                {
                    headers: {
                        Authorization: `Bearer ${token}`,
                        'Authorization-Type': 'auth',
                    },
                },
            );
            topCampaigns.value = result.data ?? [];
        } catch (err: any) {
            topCampaigns.value = [];
        }
    }

    function setDateRange(start: Date, end: Date): void {
        const prev = dateRange.value;
        const toDateKey = (d: Date) => d.toISOString().split('T')[0];
        const changed = toDateKey(prev.start) !== toDateKey(start) || toDateKey(prev.end) !== toDateKey(end);
        dateRange.value = { start, end };
        if (changed) {
            hubSummary.value = null;
            topCampaigns.value = [];
        }
    }

    function setCampaignFilter(campaignId: number | null): void {
        selectedCampaignId.value = campaignId;
        hubSummary.value = null;
    }

    function clearStore(): void {
        hubSummary.value = null;
        topCampaigns.value = [];
        selectedCampaignId.value = null;
        isLoading.value = false;
        error.value = null;
    }

    return {
        hubSummary,
        topCampaigns,
        selectedCampaignId,
        dateRange,
        isLoading,
        error,
        getHubSummary,
        getTopCampaigns,
        getDateRange,
        retrieveHubSummary,
        retrieveTopCampaigns,
        setDateRange,
        setCampaignFilter,
        clearStore,
    };
});
