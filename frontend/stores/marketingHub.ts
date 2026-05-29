import { defineStore } from 'pinia';
import { useAppFetch } from '@/composables/useAppFetch';
import { baseUrl } from '~/composables/Utils';
import { getAuthToken } from '~/composables/AuthToken';
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
        console.log('[MarketingHub] 🚀 retrieveHubSummary() called for projectId:', projectId);
        if (!token) {
            console.warn('[MarketingHub] ⚠️ No auth token available — aborting retrieveHubSummary');
            return;
        }

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
            const url = `${baseUrl()}/marketing/hub/${projectId}?${qs}`;
            console.log('[MarketingHub] 🌐 Fetching hub summary from:', url);
            console.log('[MarketingHub] 🌐 Base URL:', baseUrl(), '| Token exists:', !!token, '| Token prefix:', token?.substring(0, 20) + '...');

            const result = await useAppFetch<{ success: boolean; data: IMarketingHubSummary }>(
                url,
                {
                    headers: {
                        Authorization: `Bearer ${token}`,
                        'Authorization-Type': 'auth',
                    },
                },
            );
            console.log('[MarketingHub] ✅ Hub summary response received:', {
                success: result?.success,
                hasData: !!result?.data,
                channelsCount: result?.data?.channels?.length,
                totals: result?.data?.totals,
                priorPeriodTotals: result?.data?.priorPeriodTotals,
                weeklyTrendCount: result?.data?.weeklyTrend?.length,
            });
            hubSummary.value = result.data;
        } catch (err: any) {
            console.error('[MarketingHub] ❌ retrieveHubSummary failed:', {
                message: err?.message,
                statusCode: err?.statusCode || err?.response?.status,
                statusMessage: err?.statusMessage || err?.response?.statusText,
                data: err?.data || err?.response?._data,
                fullError: err,
            });
            error.value = err?.message ?? 'Failed to load marketing hub data';
            hubSummary.value = null;
        } finally {
            isLoading.value = false;
            console.log('[MarketingHub] 🏁 retrieveHubSummary finished. isLoading:', isLoading.value, '| hubSummary:', !!hubSummary.value, '| error:', error.value);
        }
    }

    /**
     * Fetch top campaigns by spend for a project.
     */
    async function retrieveTopCampaigns(projectId: number, limit = 5): Promise<void> {
        const token = getAuthToken();
        console.log('[MarketingHub] 🚀 retrieveTopCampaigns() called for projectId:', projectId, '| limit:', limit);
        if (!token) {
            console.warn('[MarketingHub] ⚠️ No auth token available — aborting retrieveTopCampaigns');
            return;
        }

        try {
            const { start, end } = dateRange.value;
            const qs = new URLSearchParams({
                startDate: start.toISOString().split('T')[0],
                endDate: end.toISOString().split('T')[0],
                limit: String(limit),
            }).toString();

            const url = `${baseUrl()}/marketing/top-campaigns/${projectId}?${qs}`;
            console.log('[MarketingHub] 🌐 Fetching top campaigns from:', url);

            const result = await useAppFetch<{ success: boolean; data: ITopCampaign[] }>(
                url,
                {
                    headers: {
                        Authorization: `Bearer ${token}`,
                        'Authorization-Type': 'auth',
                    },
                },
            );
            console.log('[MarketingHub] ✅ Top campaigns response:', {
                success: result?.success,
                count: result?.data?.length,
                data: result?.data,
            });
            topCampaigns.value = result.data ?? [];
        } catch (err: any) {
            console.error('[MarketingHub] ❌ retrieveTopCampaigns failed:', {
                message: err?.message,
                statusCode: err?.statusCode || err?.response?.status,
                fullError: err,
            });
            topCampaigns.value = [];
        }
    }

    /**
     * Update the date range and clear cached data so the next retrieve re-fetches.
     */
    function setDateRange(start: Date, end: Date): void {
        console.log('[MarketingHub] 📅 setDateRange():', { start: start.toISOString(), end: end.toISOString() });
        dateRange.value = { start, end };
        hubSummary.value = null;
        topCampaigns.value = [];
    }

    /**
     * Set the active campaign filter (null = All Campaigns).
     */
    function setCampaignFilter(campaignId: number | null): void {
        console.log('[MarketingHub] 🔍 setCampaignFilter():', campaignId);
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
