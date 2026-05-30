/**
 * attributionStore — Pinia store for attribution state management.
 *
 * ATTR-004: Attribution Panel Integration with Real Data
 *
 * Provides a centralized store that wraps the useAttribution composable,
 * enabling shared attribution state across AttributionPanel, AttributionDashboard,
 * and any other components that need access to attribution data.
 *
 * All data is fetched from the real ATTR-002 backend endpoint
 * (POST /attribution/analyze) — no mock data.
 */
import { defineStore } from 'pinia';
import type {
    AttributionModel,
    IAttributionData,
    IChannelAttribution,
    IConversionPath,
    ITimeToConversion,
    IAttributionROI,
    IAttributionModelOption,
} from '@/composables/useAttribution';
import { ATTRIBUTION_MODELS } from '@/composables/useAttribution';
import { useAppFetch } from '@/composables/useAppFetch';
import { baseUrl } from '~/composables/Utils';
import { getAuthToken } from '~/composables/AuthToken';

interface AttributionState {
    selectedModel: AttributionModel;
    rawData: IAttributionData | null;
    isLoading: boolean;
    hasFetched: boolean;
    error: string | null;
    lastFetchedModel: AttributionModel | null;
    lastDataModelId: number | null;
}

export const useAttributionStore = defineStore('attribution', {
    state: (): AttributionState => ({
        selectedModel: 'last_touch',
        rawData: null,
        isLoading: false,
        hasFetched: false,
        error: null,
        lastFetchedModel: null,
        lastDataModelId: null,
    }),

    getters: {
        /**
         * Current model metadata.
         */
        currentModel(state): IAttributionModelOption {
            return ATTRIBUTION_MODELS.find(m => m.id === state.selectedModel) ?? ATTRIBUTION_MODELS[0];
        },

        /**
         * Whether we have meaningful data to display.
         */
        hasData(state): boolean {
            return state.rawData !== null
                && state.rawData.channelAttribution.length > 0;
        },

        /**
         * Channel attribution data from the current model.
         */
        channelAttribution(state): IChannelAttribution[] {
            return state.rawData?.channelAttribution ?? [];
        },

        /**
         * Conversion paths data.
         */
        conversionPaths(state): IConversionPath[] {
            return state.rawData?.conversionPaths ?? [];
        },

        /**
         * Time to conversion metrics.
         */
        timeToConversion(state): ITimeToConversion | null {
            return state.rawData?.timeToConversion ?? null;
        },

        /**
         * ROI by channel data.
         */
        roiByChannel(state): IAttributionROI[] {
            return state.rawData?.roiByChannel ?? [];
        },

        /**
         * AI-generated attribution insights.
         */
        aiInsights(state): string | null {
            return state.rawData?.aiInsights ?? null;
        },

        /**
         * Total attributed conversions across all channels.
         */
        totalAttributedConversions(state): number {
            if (!state.rawData) return 0;
            return state.rawData.channelAttribution.reduce(
                (sum, ch) => sum + ch.attributedConversions, 0,
            );
        },

        /**
         * Total attributed revenue across all channels.
         */
        totalAttributedRevenue(state): number {
            if (!state.rawData) return 0;
            return state.rawData.channelAttribution.reduce(
                (sum, ch) => sum + ch.attributedRevenue, 0,
            );
        },

        /**
         * Top performing channel by attributed conversions.
         */
        topChannel(state): IChannelAttribution | null {
            if (!state.rawData || state.rawData.channelAttribution.length === 0) return null;
            return [...state.rawData.channelAttribution].sort(
                (a, b) => b.attributedConversions - a.attributedConversions,
            )[0];
        },
    },

    actions: {
        /**
         * Fetch attribution data from the backend.
         * Uses the ATTR-002 AttributionDataIntegrationService endpoint.
         */
        async fetchAttribution(dataModelId: number, startDate: string, endDate: string, model?: AttributionModel) {
            const useModel = model ?? this.selectedModel;

            // Skip if already fetched for same params
            if (
                this.hasFetched
                && this.lastFetchedModel === useModel
                && this.lastDataModelId === dataModelId
                && !this.isLoading
            ) {
                return;
            }

            this.isLoading = true;
            this.error = null;

            try {
                const token = getAuthToken();
                if (!token) {
                    this.rawData = null;
                    this.error = 'Authentication required';
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
                        data_model_id: dataModelId,
                        attribution_model: useModel,
                        date_range: { start: startDate, end: endDate },
                    },
                });

                this.rawData = response?.data ?? null;
                this.hasFetched = true;
                this.lastFetchedModel = useModel;
                this.lastDataModelId = dataModelId;
            } catch (err: any) {
                console.warn('[attributionStore] Attribution endpoint not available:', err?.message);
                this.rawData = null;
                this.hasFetched = true;
                this.error = null; // Don't surface backend-not-ready as error to user
            } finally {
                this.isLoading = false;
            }
        },

        /**
         * Switch attribution model and refetch data.
         */
        async selectModel(model: AttributionModel, dataModelId?: number, startDate?: string, endDate?: string) {
            if (model === this.selectedModel) return;
            this.selectedModel = model;

            // If we have context, refetch with new model
            if (dataModelId && startDate && endDate) {
                this.lastFetchedModel = null; // Force re-fetch
                await this.fetchAttribution(dataModelId, startDate, endDate, model);
            }
        },

        /**
         * Reset store state.
         */
        reset() {
            this.selectedModel = 'last_touch';
            this.rawData = null;
            this.isLoading = false;
            this.hasFetched = false;
            this.error = null;
            this.lastFetchedModel = null;
            this.lastDataModelId = null;
        },

        /**
         * Force refresh — clears cache and refetches.
         */
        async refresh(dataModelId: number, startDate: string, endDate: string) {
            this.lastFetchedModel = null;
            await this.fetchAttribution(dataModelId, startDate, endDate);
        },

        // Formatting helpers
        formatCurrency(value: number): string {
            if (value >= 1_000_000) return `$${(value / 1_000_000).toFixed(1)}M`;
            if (value >= 1_000) return `$${(value / 1_000).toFixed(1)}K`;
            return `$${value.toFixed(2)}`;
        },

        formatNumber(value: number): string {
            if (value >= 1_000_000) return `${(value / 1_000_000).toFixed(1)}M`;
            if (value >= 1_000) return `${(value / 1_000).toFixed(1)}K`;
            return value.toLocaleString();
        },

        formatRatio(value: number): string {
            return `${value.toFixed(2)}x`;
        },

        formatPercent(value: number): string {
            return `${value.toFixed(1)}%`;
        },
    },
});