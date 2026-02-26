import { defineStore } from 'pinia';
import type {
    IMarketingHubSummary,
    ITopCampaign,
    IMarketingDateRange,
} from '~/types/IMarketingHub';

export const useMarketingHubStore = defineStore('marketingHub', () => {
    // -------------------------------------------------------------------------
    // State
    // -------------------------------------------------------------------------
    const hubSummary = ref<IMarketingHubSummary | null>(null);
    const topCampaigns = ref<ITopCampaign[]>([]);
    const selectedCampaignId = ref<number | null>(null);
    const dateRange = ref<IMarketingDateRange>({ start: new Date(), end: new Date() });
    const isLoading = ref(false);
    const error = ref<string | null>(null);

    // -------------------------------------------------------------------------
    // Getters
    // -------------------------------------------------------------------------
    function getHubSummary(): IMarketingHubSummary | null {
        return hubSummary.value;
    }

    function getTopCampaigns(): ITopCampaign[] {
        return topCampaigns.value;
    }

    function getDateRange(): IMarketingDateRange {
        return dateRange.value;
    }

    // -------------------------------------------------------------------------
    // Actions
    // -------------------------------------------------------------------------

    /**
     * Fetch the full marketing hub summary for a project.
     */
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
            const result = await $fetch<{ success: boolean; data: IMarketingHubSummary }>(
                `${baseUrl()}/marketing/hub/${projectId}?${qs}`,
                {
                    headers: {
                        Authorization: `Bearer ${token}`,
                        'Authorization-Type': 'auth',
                    },
                },
            );
            hubSummary.value = result.data;
        } catch (err: any) {
            error.value = err?.message ?? 'Failed to load marketing hub data';
            hubSummary.value = null;
        } finally {
            isLoading.value = false;
        }
    }

    /**
     * Fetch top campaigns by spend for a project.
     */
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

            const result = await $fetch<{ success: boolean; data: ITopCampaign[] }>(
                `${baseUrl()}/marketing/top-campaigns/${projectId}?${qs}`,
                {
                    headers: {
                        Authorization: `Bearer ${token}`,
                        'Authorization-Type': 'auth',
                    },
                },
            );
            topCampaigns.value = result.data ?? [];
        } catch {
            topCampaigns.value = [];
        }
    }

    /**
     * Update the date range and clear cached data so the next retrieve re-fetches.
     */
    function setDateRange(start: Date, end: Date): void {
        dateRange.value = { start, end };
        hubSummary.value = null;
        topCampaigns.value = [];
    }

    /**
     * Set the active campaign filter (null = All Campaigns).
     */
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
        // State
        hubSummary,
        topCampaigns,
        selectedCampaignId,
        dateRange,
        isLoading,
        error,
        // Getters
        getHubSummary,
        getTopCampaigns,
        getDateRange,
        // Actions
        retrieveHubSummary,
        retrieveTopCampaigns,
        setDateRange,
        setCampaignFilter,
        clearStore,
    };
});
