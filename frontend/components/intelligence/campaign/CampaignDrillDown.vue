<script setup lang="ts">
/**
 * CampaignDrillDown — Main component for the Campaign Drill-Down page (CMP-001).
 *
 * Composes CampaignKPICards, CampaignTrendChart, and DimensionBreakdown
 * into a full campaign performance analysis view.
 *
 * Sections:
 *   - Header: Campaign name, channel badge, date range, status
 *   - KPIs Row: Spend, Conversions, CPA, ROAS, CTR, CPC with period comparison
 *   - Daily Trend Chart: Line chart showing spend, conversions, CPA over time
 *   - Dimension Breakdowns: Tabs for ad group, keyword, device, geo
 *   - AI Analysis: AI-generated analysis specific to this campaign
 *   - Recommendations: Actionable suggestions
 */
import type { ICampaignPerformanceRow } from '~/composables/useCampaignPerformance';
import { useCampaignDrillDown } from '~/composables/useCampaignDrillDown';
import CampaignKPICards from './CampaignKPICards.vue';
import CampaignTrendChart from './CampaignTrendChart.vue';
import DimensionBreakdown from './DimensionBreakdown.vue';

interface Props {
    /** Data model ID to query */
    dataModelId: number | null;
    /** Campaign ID from URL */
    campaignId: string;
    /** Campaign name (from table row or URL) */
    campaignName?: string;
    /** Channel name (from table row or URL) */
    channel?: string;
    /** ISO date string — start */
    startDate: string | null;
    /** ISO date string — end */
    endDate: string | null;
}

const props = withDefaults(defineProps<Props>(), {
    campaignName: '',
    channel: '',
});

const emit = defineEmits<{
    back: [];
}>();

const {
    data,
    isLoading,
    hasFetched,
    error,
    fetch: fetchDrillDown,
    formatCurrency,
    formatNumber,
    formatPercent,
    formatRatio,
} = useCampaignDrillDown({
    dataModelId: computed(() => props.dataModelId),
    campaignId: computed(() => props.campaignId),
    startDate: computed(() => props.startDate),
    endDate: computed(() => props.endDate),
});

const displayName = computed(() => data.value?.campaignName || props.campaignName || 'Campaign');
const displayChannel = computed(() => data.value?.channel || props.channel || '');
const displayStatus = computed(() => data.value?.status || 'active');

function statusClasses(status: string): string {
    const map: Record<string, string> = {
        active: 'bg-green-100 text-green-700',
        paused: 'bg-yellow-100 text-yellow-700',
        completed: 'bg-blue-100 text-blue-700',
    };
    return map[status] ?? 'bg-gray-100 text-gray-600';
}
</script>

<template>
    <div class="campaign-drill-down space-y-6">
        <!-- ── Header ─────────────────────────────────────────────────── -->
        <div class="flex items-start justify-between gap-4">
            <div class="flex-1 min-w-0">
                <!-- Back button + breadcrumb -->
                <div class="flex items-center gap-2 mb-2">
                    <button
                        type="button"
                        class="inline-flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-700 transition-colors cursor-pointer"
                        @click="emit('back')"
                    >
                        <font-awesome-icon :icon="['fas', 'arrow-left']" class="w-3.5 h-3.5" />
                        Back to Campaigns
                    </button>
                </div>

                <!-- Campaign name + channel badge + status -->
                <div class="flex items-center gap-3 flex-wrap">
                    <h1 class="text-xl font-bold text-gray-900 truncate">
                        {{ displayName }}
                    </h1>
                    <span
                        v-if="displayChannel"
                        class="inline-flex items-center gap-1 text-xs font-medium px-2.5 py-0.5 rounded-full bg-blue-50 text-blue-700"
                    >
                        <font-awesome-icon :icon="['fas', 'chart-bar']" class="w-3 h-3" />
                        {{ displayChannel }}
                    </span>
                    <span
                        class="inline-flex items-center text-xs font-medium px-2.5 py-0.5 rounded-full"
                        :class="statusClasses(displayStatus)"
                    >
                        {{ displayStatus }}
                    </span>
                </div>
            </div>

            <!-- Refresh button -->
            <button
                type="button"
                class="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium text-gray-600 bg-white border border-gray-200 rounded-lg hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-primary-blue-100 transition-colors cursor-pointer disabled:opacity-50"
                :disabled="isLoading"
                @click="fetchDrillDown()"
            >
                <font-awesome-icon
                    :icon="['fas', 'arrow-rotate-right']"
                    class="w-3.5 h-3.5"
                    :class="{ 'animate-spin': isLoading }"
                />
                Refresh
            </button>
        </div>

        <!-- ── Error state ────────────────────────────────────────────── -->
        <div
            v-if="error"
            class="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-800"
        >
            {{ error }}
        </div>

        <!-- ── KPIs Row ───────────────────────────────────────────────── -->
        <section>
            <CampaignKPICards
                :kpis="data?.kpis ?? null"
                :deltas="data?.kpiDeltas ?? null"
                :is-loading="isLoading"
                :format-currency="formatCurrency"
                :format-number="formatNumber"
                :format-percent="formatPercent"
                :format-ratio="formatRatio"
            />
        </section>

        <!-- ── Daily Trend Chart ──────────────────────────────────────── -->
        <section class="bg-white rounded-xl border border-gray-200 p-5">
            <div class="flex items-center gap-2 mb-4">
                <div class="w-8 h-8 rounded-lg bg-blue-50 flex items-center justify-center">
                    <font-awesome-icon :icon="['fas', 'chart-line']" class="text-sm text-blue-400" />
                </div>
                <h3 class="text-sm font-semibold text-gray-700">Daily Trend</h3>
            </div>
            <CampaignTrendChart
                :data="data?.dailyTrend ?? []"
                :is-loading="isLoading"
                :format-currency="formatCurrency"
                :format-number="formatNumber"
            />
        </section>

        <!-- ── Dimension Breakdowns ───────────────────────────────────── -->
        <section class="bg-white rounded-xl border border-gray-200 p-5">
            <div class="flex items-center gap-2 mb-4">
                <div class="w-8 h-8 rounded-lg bg-indigo-50 flex items-center justify-center">
                    <font-awesome-icon :icon="['fas', 'table']" class="text-sm text-indigo-400" />
                </div>
                <h3 class="text-sm font-semibold text-gray-700">Dimension Breakdowns</h3>
            </div>
            <DimensionBreakdown
                :breakdowns="data?.dimensionBreakdowns ?? []"
                :is-loading="isLoading"
                :format-currency="formatCurrency"
                :format-number="formatNumber"
                :format-percent="formatPercent"
                :format-ratio="formatRatio"
            />
        </section>

        <!-- ── AI Analysis ────────────────────────────────────────────── -->
        <section class="bg-white rounded-xl border border-gray-200 p-5">
            <div class="flex items-center gap-2 mb-4">
                <div class="w-8 h-8 rounded-lg bg-emerald-50 flex items-center justify-center">
                    <font-awesome-icon :icon="['fas', 'robot']" class="text-sm text-emerald-400" />
                </div>
                <h3 class="text-sm font-semibold text-gray-700">AI Analysis</h3>
            </div>

            <!-- Loading skeleton -->
            <div v-if="isLoading" class="space-y-2">
                <div class="h-4 w-full rounded bg-gray-100 animate-pulse" />
                <div class="h-4 w-5/6 rounded bg-gray-100 animate-pulse" />
                <div class="h-4 w-4/6 rounded bg-gray-100 animate-pulse" />
            </div>

            <!-- AI analysis content -->
            <div
                v-else-if="data?.aiAnalysis"
                class="prose prose-sm max-w-none text-gray-600"
            >
                <p>{{ data.aiAnalysis }}</p>
            </div>

            <!-- Empty state -->
            <div
                v-else
                class="flex flex-col items-center justify-center py-8 text-center"
            >
                <font-awesome-icon :icon="['fas', 'robot']" class="text-2xl text-gray-300 mb-2" />
                <p class="text-sm text-gray-400">
                    {{ hasFetched ? 'No AI analysis available for this campaign' : 'AI analysis will appear once data loads' }}
                </p>
            </div>
        </section>

        <!-- ── Recommendations ────────────────────────────────────────── -->
        <section
            v-if="data?.recommendations && data.recommendations.length > 0"
            class="bg-white rounded-xl border border-gray-200 p-5"
        >
            <div class="flex items-center gap-2 mb-4">
                <div class="w-8 h-8 rounded-lg bg-amber-50 flex items-center justify-center">
                    <font-awesome-icon :icon="['fas', 'lightbulb']" class="text-sm text-amber-400" />
                </div>
                <h3 class="text-sm font-semibold text-gray-700">Recommendations</h3>
            </div>
            <ul class="space-y-3">
                <li
                    v-for="(rec, idx) in data.recommendations"
                    :key="idx"
                    class="flex items-start gap-3 text-sm text-gray-600"
                >
                    <span class="flex-shrink-0 w-5 h-5 rounded-full bg-amber-100 text-amber-700 flex items-center justify-center text-[10px] font-bold mt-0.5">
                        {{ idx + 1 }}
                    </span>
                    <span>{{ rec }}</span>
                </li>
            </ul>
        </section>
    </div>
</template>
