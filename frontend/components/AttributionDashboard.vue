<script setup lang="ts">
/**
 * AttributionDashboard — Comprehensive attribution analysis dashboard.
 *
 * ATTR-004: Attribution Panel Integration with Real Data
 *
 * Full-page dashboard that composes all attribution sub-components:
 *   - AttributionModelSelector
 *   - ChannelAttributionTable
 *   - ConversionPathSankey
 *   - ConversionFunnel / ChannelFunnelComparison
 *   - TimeToConversion
 *   - AttributionROI
 *   - AI Attribution Insights
 *
 * All data is fetched from the real ATTR-002 backend endpoint
 * (POST /attribution/analyze) — no mock data.
 *
 * Handles loading, error, and empty states gracefully.
 */
import { useAttribution, ATTRIBUTION_MODELS } from '@/composables/useAttribution';
import type { AttributionModel } from '@/composables/useAttribution';
import { useFunnelAnalysis } from '@/composables/useFunnelAnalysis';
import { useAttributionStore } from '@/stores/attributionStore';

interface Props {
    dataModelId: number | null;
    startDate: string | null;
    endDate: string | null;
}

const props = defineProps<Props>();

const emit = defineEmits<{
    'model-change': [model: AttributionModel];
}>();

// --- Attribution composable (real API via ATTR-002) ---
const {
    selectedModel,
    currentModel,
    rawData,
    isLoading,
    hasFetched,
    hasData,
    error,
    selectModel,
    fetch: refetchAttribution,
    formatCurrency,
    formatNumber,
    formatRatio,
    formatPercent,
} = useAttribution({
    dataModelId: computed(() => props.dataModelId),
    startDate: computed(() => props.startDate),
    endDate: computed(() => props.endDate),
});

// --- Funnel Analysis (ATTR-003) ---
const {
    stages: funnelStages,
    channelFunnels,
    timePerStage: funnelTimePerStage,
    maxCount: funnelMaxCount,
    completionRate: funnelCompletionRate,
    isLoading: funnelLoading,
    hasData: funnelHasData,
    formatNumber: funnelFormatNumber,
    formatPercent: funnelFormatPercent,
} = useFunnelAnalysis({
    dataModelId: computed(() => props.dataModelId),
    startDate: computed(() => props.startDate),
    endDate: computed(() => props.endDate),
});

const activeFunnelTab = ref<'overall' | 'channels'>('overall');

/** Label for the current model */
const currentModelLabel = computed(() => currentModel.value?.label ?? 'Last Touch');

// --- Model selection handler ---
function onModelChange(model: string) {
    selectModel(model as AttributionModel);
    emit('model-change', model as AttributionModel);
}

// --- Refresh handler ---
function handleRefresh() {
    if (props.dataModelId && props.startDate && props.endDate) {
        refetchAttribution();
    }
}

// --- State derivation ---
const isInitialLoad = computed(() => !hasFetched.value && isLoading.value);
const showEmptyState = computed(() => hasFetched.value && !hasData.value && !error.value);
const showErrorState = computed(() => hasFetched.value && !!error.value);
const showData = computed(() => hasData.value);

/** Top channel by conversions */
const topChannel = computed(() => {
    if (!rawData.value || rawData.value.channelAttribution.length === 0) return null;
    return [...rawData.value.channelAttribution].sort(
        (a, b) => b.attributedConversions - a.attributedConversions,
    )[0];
});

/** Total attributed conversions */
const totalConversions = computed(() =>
    rawData.value?.channelAttribution.reduce((s, c) => s + c.attributedConversions, 0) ?? 0,
);

/** Total attributed revenue */
const totalRevenue = computed(() =>
    rawData.value?.channelAttribution.reduce((s, c) => s + c.attributedRevenue, 0) ?? 0,
);

/** Average ROAS */
const avgROAS = computed(() => {
    if (!rawData.value || rawData.value.roiByChannel.length === 0) return 0;
    const withSpend = rawData.value.roiByChannel.filter(r => r.spend > 0);
    if (withSpend.length === 0) return 0;
    return withSpend.reduce((s, r) => s + r.attributedROAS, 0) / withSpend.length;
});
</script>

<template>
    <div class="attribution-dashboard space-y-6">
        <!-- Dashboard Header -->
        <div class="flex items-center justify-between">
            <div>
                <h2 class="text-lg font-bold text-gray-900 flex items-center gap-2">
                    <div class="w-9 h-9 rounded-xl bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center">
                        <font-awesome-icon :icon="['fas', 'scale-balanced']" class="text-white text-sm" />
                    </div>
                    Attribution Analysis
                </h2>
                <p class="text-xs text-gray-500 mt-1 ml-11">
                    Multi-touch attribution across all connected channels and campaigns
                </p>
            </div>
            <button
                v-if="showData"
                class="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-gray-600 bg-gray-50 hover:bg-gray-100 rounded-lg transition-colors border border-gray-200"
                :disabled="isLoading"
                @click="handleRefresh"
            >
                <font-awesome-icon
                    :icon="['fas', 'sync-alt']"
                    class="text-[10px]"
                    :class="{ 'animate-spin': isLoading }"
                />
                Refresh
            </button>
        </div>

        <!-- Loading State (initial load) -->
        <div v-if="isInitialLoad" class="space-y-4">
            <div class="bg-white rounded-xl border border-gray-100 shadow-sm p-6">
                <div class="flex items-center justify-center py-12">
                    <div class="flex flex-col items-center gap-3">
                        <div class="w-10 h-10 border-2 border-blue-200 border-t-blue-500 rounded-full animate-spin" />
                        <span class="text-sm text-gray-500">Loading attribution data...</span>
                        <span class="text-xs text-gray-400">Analyzing conversion paths across channels</span>
                    </div>
                </div>
            </div>
        </div>

        <!-- Error State -->
        <div v-else-if="showErrorState" class="bg-white rounded-xl border border-gray-100 shadow-sm p-6">
            <div class="flex flex-col items-center justify-center py-12 text-center">
                <div class="w-14 h-14 rounded-full bg-red-50 flex items-center justify-center mb-4">
                    <font-awesome-icon :icon="['fas', 'exclamation-triangle']" class="text-red-400 text-lg" />
                </div>
                <h3 class="text-sm font-semibold text-gray-800 mb-1">Unable to load attribution data</h3>
                <p class="text-xs text-gray-500 mb-4 max-w-sm">{{ error }}</p>
                <button
                    class="px-4 py-2 text-xs font-medium text-white bg-blue-500 hover:bg-blue-600 rounded-lg transition-colors"
                    @click="handleRefresh"
                >
                    Try Again
                </button>
            </div>
        </div>

        <!-- Empty State -->
        <div v-else-if="showEmptyState" class="bg-white rounded-xl border border-gray-100 shadow-sm p-6">
            <div class="flex flex-col items-center justify-center py-12 text-center">
                <div class="w-16 h-16 rounded-full bg-gray-50 flex items-center justify-center mb-4">
                    <font-awesome-icon :icon="['fas', 'scale-balanced']" class="text-gray-300 text-2xl" />
                </div>
                <h3 class="text-sm font-semibold text-gray-800 mb-1">No attribution data available</h3>
                <p class="text-xs text-gray-500 mb-2 max-w-md">
                    Attribution data requires touchpoint information from connected ad platforms
                    (Google Ads, Meta Ads, LinkedIn Ads) or CRM data.
                </p>
                <div class="bg-gray-50 rounded-lg p-3 mt-2 max-w-sm">
                    <p class="text-[11px] text-gray-600 font-medium mb-1.5">To get started:</p>
                    <ul class="text-[11px] text-gray-500 text-left space-y-1">
                        <li class="flex items-start gap-1.5">
                            <span class="text-blue-500 mt-0.5">1.</span>
                            Connect an ad platform data source
                        </li>
                        <li class="flex items-start gap-1.5">
                            <span class="text-blue-500 mt-0.5">2.</span>
                            Ensure campaign data has been imported
                        </li>
                        <li class="flex items-start gap-1.5">
                            <span class="text-blue-500 mt-0.5">3.</span>
                            Select a data model with touchpoint data
                        </li>
                    </ul>
                </div>
            </div>
        </div>

        <!-- Data Content -->
        <template v-else-if="showData">
            <!-- Summary KPI Cards -->
            <div class="grid grid-cols-2 lg:grid-cols-4 gap-4">
                <div class="bg-white rounded-xl border border-gray-100 shadow-sm p-4">
                    <p class="text-[10px] font-medium text-gray-400 uppercase tracking-wider">Total Conversions</p>
                    <p class="text-xl font-bold text-gray-800 mt-1">{{ formatNumber(totalConversions) }}</p>
                    <p class="text-[10px] text-gray-400 mt-0.5">
                        via {{ currentModelLabel }} model
                    </p>
                </div>
                <div class="bg-white rounded-xl border border-gray-100 shadow-sm p-4">
                    <p class="text-[10px] font-medium text-gray-400 uppercase tracking-wider">Attributed Revenue</p>
                    <p class="text-xl font-bold text-gray-800 mt-1">{{ formatCurrency(totalRevenue) }}</p>
                    <p class="text-[10px] text-gray-400 mt-0.5">
                        across {{ rawData?.channelAttribution.length ?? 0 }} channels
                    </p>
                </div>
                <div class="bg-white rounded-xl border border-gray-100 shadow-sm p-4">
                    <p class="text-[10px] font-medium text-gray-400 uppercase tracking-wider">Average ROAS</p>
                    <p
                        class="text-xl font-bold mt-1"
                        :class="avgROAS >= 2 ? 'text-emerald-600' : avgROAS >= 1 ? 'text-amber-600' : 'text-red-500'"
                    >
                        {{ formatRatio(avgROAS) }}
                    </p>
                    <p class="text-[10px] text-gray-400 mt-0.5">return on ad spend</p>
                </div>
                <div class="bg-white rounded-xl border border-gray-100 shadow-sm p-4">
                    <p class="text-[10px] font-medium text-gray-400 uppercase tracking-wider">Top Channel</p>
                    <p class="text-xl font-bold text-gray-800 mt-1 truncate">
                        {{ topChannel?.channel ?? 'N/A' }}
                    </p>
                    <p class="text-[10px] text-gray-400 mt-0.5">
                        {{ topChannel ? formatNumber(topChannel.attributedConversions) + ' conversions' : '' }}
                    </p>
                </div>
            </div>

            <!-- Model Selector -->
            <div class="bg-white rounded-xl border border-gray-100 shadow-sm p-5">
                <div class="flex items-center justify-between mb-4">
                    <div>
                        <h3 class="text-sm font-semibold text-gray-800 flex items-center gap-2">
                            <font-awesome-icon :icon="['fas', 'scale-balanced']" class="text-blue-500" />
                            Attribution Model
                        </h3>
                        <p class="text-xs text-gray-500 mt-0.5">
                            Select how conversion credit is distributed across touchpoints
                        </p>
                    </div>
                    <!-- Loading indicator for model switches -->
                    <div v-if="isLoading" class="flex items-center gap-1.5 text-xs text-gray-400">
                        <div class="w-3.5 h-3.5 border-2 border-blue-200 border-t-blue-500 rounded-full animate-spin" />
                        Updating...
                    </div>
                </div>
                <AttributionModelSelector
                    :selected="selectedModel"
                    :disabled="isLoading"
                    @update:selected="onModelChange"
                />
            </div>

            <!-- Channel Attribution Table -->
            <div class="bg-white rounded-xl border border-gray-100 shadow-sm p-5">
                <div class="flex items-center justify-between mb-4">
                    <div>
                        <h3 class="text-sm font-semibold text-gray-800 flex items-center gap-2">
                            <font-awesome-icon :icon="['fas', 'table']" class="text-indigo-500" />
                            Channel Attribution
                        </h3>
                        <p class="text-xs text-gray-500 mt-0.5">
                            Conversions and revenue attributed to each channel using the {{ currentModelLabel }} model
                        </p>
                    </div>
                </div>
                <ChannelAttributionTable
                    :channels="rawData?.channelAttribution ?? []"
                    :is-loading="isLoading"
                />
            </div>

            <!-- Conversion Paths -->
            <div class="bg-white rounded-xl border border-gray-100 shadow-sm p-5">
                <div class="flex items-center justify-between mb-4">
                    <div>
                        <h3 class="text-sm font-semibold text-gray-800 flex items-center gap-2">
                            <font-awesome-icon :icon="['fas', 'route']" class="text-purple-500" />
                            Conversion Paths
                        </h3>
                        <p class="text-xs text-gray-500 mt-0.5">
                            Most common multi-channel journeys leading to conversions
                        </p>
                    </div>
                </div>
                <ConversionPathSankey
                    :paths="rawData?.conversionPaths ?? []"
                    :is-loading="isLoading"
                />
            </div>

            <!-- Funnel Analysis -->
            <div class="bg-white rounded-xl border border-gray-100 shadow-sm p-5">
                <div class="flex items-center justify-between mb-4">
                    <div>
                        <h3 class="text-sm font-semibold text-gray-800 flex items-center gap-2">
                            <font-awesome-icon :icon="['fas', 'filter']" class="text-violet-500" />
                            Conversion Funnel
                        </h3>
                        <p class="text-xs text-gray-500 mt-0.5">
                            Multi-step funnel with drop-off rates, auto-detected from your data model columns
                        </p>
                    </div>
                    <div v-if="funnelHasData" class="flex bg-gray-100 rounded-lg p-0.5">
                        <button
                            class="px-3 py-1 text-[11px] font-medium rounded-md transition-colors"
                            :class="activeFunnelTab === 'overall'
                                ? 'bg-white text-gray-800 shadow-sm'
                                : 'text-gray-500 hover:text-gray-700'"
                            @click="activeFunnelTab = 'overall'"
                        >
                            Overall
                        </button>
                        <button
                            class="px-3 py-1 text-[11px] font-medium rounded-md transition-colors"
                            :class="activeFunnelTab === 'channels'
                                ? 'bg-white text-gray-800 shadow-sm'
                                : 'text-gray-500 hover:text-gray-700'"
                            @click="activeFunnelTab = 'channels'"
                        >
                            By Channel
                        </button>
                    </div>
                </div>
                <ConversionFunnel
                    v-if="activeFunnelTab === 'overall'"
                    :stages="funnelStages"
                    :time-per-stage="funnelTimePerStage"
                    :max-count="funnelMaxCount"
                    :completion-rate="funnelCompletionRate"
                    :format-number="funnelFormatNumber"
                    :format-percent="funnelFormatPercent"
                    :is-loading="funnelLoading"
                />
                <ChannelFunnelComparison
                    v-else
                    :channel-funnels="channelFunnels"
                    :format-number="funnelFormatNumber"
                    :format-percent="funnelFormatPercent"
                    :is-loading="funnelLoading"
                />
            </div>

            <!-- Bottom row: Time to Conversion + Attribution ROI side by side -->
            <div class="grid grid-cols-1 xl:grid-cols-2 gap-6">
                <!-- Time to Conversion -->
                <div class="bg-white rounded-xl border border-gray-100 shadow-sm p-5">
                    <div class="flex items-center justify-between mb-4">
                        <div>
                            <h3 class="text-sm font-semibold text-gray-800 flex items-center gap-2">
                                <font-awesome-icon :icon="['fas', 'stopwatch']" class="text-amber-500" />
                                Time to Conversion
                            </h3>
                            <p class="text-xs text-gray-500 mt-0.5">
                                How long it takes for users to convert after their first touchpoint
                            </p>
                        </div>
                    </div>
                    <TimeToConversion
                        :data="rawData?.timeToConversion ?? null"
                        :is-loading="isLoading"
                    />
                </div>

                <!-- Attribution ROI -->
                <div class="bg-white rounded-xl border border-gray-100 shadow-sm p-5">
                    <div class="flex items-center justify-between mb-4">
                        <div>
                            <h3 class="text-sm font-semibold text-gray-800 flex items-center gap-2">
                                <font-awesome-icon :icon="['fas', 'chart-line']" class="text-emerald-500" />
                                Attribution ROI
                            </h3>
                            <p class="text-xs text-gray-500 mt-0.5">
                                Attributed ROAS and net profit by channel
                            </p>
                        </div>
                    </div>
                    <AttributionROI
                        :channels="rawData?.roiByChannel ?? []"
                        :is-loading="isLoading"
                    />
                </div>
            </div>

            <!-- AI Attribution Insights -->
            <div v-if="rawData?.aiInsights" class="bg-white rounded-xl border border-gray-100 shadow-sm p-5">
                <div class="flex items-center justify-between mb-4">
                    <div>
                        <h3 class="text-sm font-semibold text-gray-800 flex items-center gap-2">
                            <font-awesome-icon :icon="['fas', 'wand-magic-sparkles']" class="text-violet-500" />
                            AI Attribution Insights
                        </h3>
                        <p class="text-xs text-gray-500 mt-0.5">
                            AI-powered analysis of your attribution patterns
                        </p>
                    </div>
                </div>
                <div class="bg-gradient-to-r from-violet-50 to-indigo-50 rounded-lg p-4">
                    <p class="text-sm text-violet-800 leading-relaxed whitespace-pre-line">
                        {{ rawData.aiInsights }}
                    </p>
                </div>
            </div>
        </template>
    </div>
</template>