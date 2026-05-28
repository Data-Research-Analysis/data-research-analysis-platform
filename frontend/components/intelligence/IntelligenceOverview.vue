<script setup lang="ts">
/**
 * IntelligenceOverview — shell for the Intelligence Hub "Overview" tab.
 *
 * Sections:
 *   - Header: "Marketing Intelligence" title, date range selector, refresh button
 *   - KPI Summary section      (Marketing KPI Intelligence Dashboard — live)
 *   - Channel Comparison section (placeholder — populated in Channel Comparison Table)
 *   - AI Alerts section         (placeholder — populated in AI-Powered Anomaly Alerts)
 *   - Campaign Summary section  (placeholder — populated in Phase 5)
 *
 * When no data sources are connected, an empty state with CTA is shown instead.
 */

import type { DateRangeValue } from '@/components/intelligence/DateRangeSelector.vue';
import type { IMarketingHubSummary } from '@/types/marketing-hub';
import type { IChannelRow } from '@/composables/useChannelComparison';
import { useChannelComparison } from '@/composables/useChannelComparison';

interface Props {
    /** The project id */
    projectId: number
    /** Whether there are connected data sources with data */
    hasData: boolean
    /** Whether data is currently loading */
    isLoading: boolean
    /** Marketing hub summary data (null if not yet loaded) */
    summary: IMarketingHubSummary | null
    /** First data model ID for the project (used by campaign table) */
    dataModelId?: number | null
    /** ISO date string — start of reporting period */
    startDate?: string | null
    /** ISO date string — end of reporting period */
    endDate?: string | null
}

const props = withDefaults(defineProps<Props>(), {
    hasData: false,
    isLoading: false,
    summary: null,
    dataModelId: null,
    startDate: null,
    endDate: null,
});

// ── Refresh state ─────────────────────────────────────────────────────────────
const isRefreshing = ref(false);

interface Emits {
    (e: 'refresh'): void
    (e: 'update:range', range: DateRangeValue): void
}

const emit = defineEmits<Emits>();

async function handleRefresh() {
    isRefreshing.value = true;
    emit('refresh');
    // Minimum spinner duration for UX feedback
    await new Promise(resolve => setTimeout(resolve, 800));
    isRefreshing.value = false;
}

function onRangeChange(range: DateRangeValue) {
    emit('update:range', range);
}

// ── Channel Comparison logic (delegated to composable) ──────────────────────

/** Map summary channels to IChannelRow[] */
const channelRows = computed<IChannelRow[]>(() => {
    if (!props.summary?.channels?.length) return [];
    return props.summary.channels.map(ch => ({
        channel: ch.channelLabel || ch.channelType || 'Unknown',
        spend: ch.spend,
        impressions: ch.impressions,
        clicks: ch.clicks,
        conversions: ch.conversions,
        revenue: ch.pipelineValue,
        ctr: ch.ctr,
        cpc: ch.clicks > 0 ? ch.spend / ch.clicks : 0,
        cpa: ch.cpl,
        roas: ch.roas,
    }));
});

const {
    sortedChannels,
    totals: channelTotals,
    sortBy: channelSortBy,
    sortDir: channelSortDir,
    toggleSort: toggleChannelSort,
    hasFetched: channelHasFetched,
    formatCurrency: fmtCurrency,
    formatNumber: fmtNumber,
    formatPercent: fmtPercent,
    formatRatio: fmtRatio,
} = useChannelComparison({
    channelData: channelRows,
    immediate: false,
});
</script>

<template>
    <!-- ── Empty state (no data sources) ────────────────────────────── -->
    <IntelligenceEmptyState
        v-if="!hasData && !isLoading"
        :project-id="projectId"
    />

    <!-- ── Overview content (placeholder skeleton) ──────────────────── -->
    <div v-else class="intelligence-overview space-y-6 animate-fade-in">

        <!-- Header row -->
        <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
                <h2 class="text-lg font-bold text-gray-900">Marketing Intelligence</h2>
                <p class="text-sm text-gray-400 mt-0.5">
                    Cross-channel performance at a glance
                </p>
            </div>
            <div class="flex items-center gap-2">
                <!-- Date range selector -->
                <IntelligenceDateRangeSelector @update:range="onRangeChange" />

                <!-- Refresh button -->
                <button
                    type="button"
                    class="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium text-gray-600 bg-white border border-gray-200 rounded-lg hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-primary-blue-100 transition-colors cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                    :disabled="isRefreshing"
                    @click="handleRefresh"
                >
                    <font-awesome-icon
                        :icon="['fas', 'arrow-rotate-right']"
                        class="w-3.5 h-3.5"
                        :class="{ 'animate-spin': isRefreshing }"
                    />
                    {{ isRefreshing ? 'Refreshing…' : 'Refresh' }}
                </button>
            </div>
        </div>

        <!-- ── KPI Summary Section (Marketing KPI Intelligence Dashboard) ── -->
        <section class="bg-white rounded-xl border border-gray-200 p-5">
            <div class="flex items-center gap-2 mb-4">
                <div class="w-8 h-8 rounded-lg bg-blue-50 flex items-center justify-center">
                    <font-awesome-icon :icon="['fas', 'chart-pie']" class="text-sm text-blue-400" />
                </div>
                <h3 class="text-sm font-semibold text-gray-700">KPI Summary</h3>
            </div>
            <IntelligenceKpiKpiSummarySection
                :summary="summary"
                :is-loading="isLoading"
            />
        </section>

        <!-- ── Channel Comparison Section (MKT-003) ──────────────────── -->
        <section class="bg-white rounded-xl border border-gray-200 p-5">
            <div class="flex items-center gap-2 mb-4">
                <div class="w-8 h-8 rounded-lg bg-indigo-50 flex items-center justify-center">
                    <font-awesome-icon :icon="['fas', 'chart-bar']" class="text-sm text-indigo-400" />
                </div>
                <h3 class="text-sm font-semibold text-gray-700">Channel Comparison</h3>
            </div>
            <IntelligenceChannelChannelComparisonTable
                :channels="sortedChannels"
                :totals="channelTotals"
                :is-loading="isLoading"
                :has-fetched="channelHasFetched"
                :sort-by="channelSortBy"
                :sort-dir="channelSortDir"
                :toggle-sort="toggleChannelSort"
                :format-currency="fmtCurrency"
                :format-number="fmtNumber"
                :format-percent="fmtPercent"
                :format-ratio="fmtRatio"
            />
        </section>

        <!-- ── AI Alerts Section (placeholder) ────────────────────────── -->
        <section class="bg-white rounded-xl border border-gray-200 p-5">
            <div class="flex items-center gap-2 mb-4">
                <div class="w-8 h-8 rounded-lg bg-emerald-50 flex items-center justify-center">
                    <font-awesome-icon :icon="['fas', 'robot']" class="text-sm text-emerald-400" />
                </div>
                <h3 class="text-sm font-semibold text-gray-700">AI Alerts</h3>
                <span class="ml-auto text-[10px] font-medium px-2 py-0.5 rounded-full bg-amber-50 text-amber-600 border border-amber-100">
                    Coming in AI-Powered Anomaly Alerts
                </span>
            </div>
            <div v-if="isLoading" class="space-y-2">
                <div v-for="i in 2" :key="i" class="h-14 rounded-lg bg-gray-50 animate-pulse" />
            </div>
            <div v-else class="flex flex-col items-center justify-center py-8 text-center">
                <font-awesome-icon :icon="['fas', 'bell']" class="text-2xl text-gray-200 mb-2" />
                <p class="text-sm text-gray-400">AI-powered anomaly alerts will appear here</p>
                <p class="text-xs text-gray-300 mt-1">Powered by statistical analysis and Gemini AI</p>
            </div>
        </section>

        <!-- ── Campaign Summary Section (MKT-004) ──────────────────────── -->
        <section class="bg-white rounded-xl border border-gray-200 p-5">
            <div class="flex items-center gap-2 mb-4">
                <div class="w-8 h-8 rounded-lg bg-rose-50 flex items-center justify-center">
                    <font-awesome-icon :icon="['fas', 'bullhorn']" class="text-sm text-rose-400" />
                </div>
                <h3 class="text-sm font-semibold text-gray-700">Campaign Performance</h3>
            </div>
            <IntelligenceCampaignCampaignPerformanceTable
                :data-model-id="dataModelId"
                :start-date="startDate"
                :end-date="endDate"
                :channels="summary?.channels?.map(ch => ch.channelLabel || ch.channelType || 'Unknown') || []"
                :max-height="400"
                :show-filters="true"
            />
        </section>
    </div>
</template>