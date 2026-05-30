<script setup lang="ts">
/**
 * AttributionPanel — Embeddable attribution summary panel.
 *
 * ATTR-004: Attribution Panel Integration with Real Data
 *
 * A compact, embeddable panel that shows key attribution metrics
 * (top channels, model info, quick ROI summary) powered by the real
 * ATTR-002 backend endpoint. Designed to be embedded in dashboards,
 * overview pages, or sidebar widgets.
 *
 * No mock data — fetches from POST /attribution/analyze.
 */
import { useAttribution, ATTRIBUTION_MODELS } from '@/composables/useAttribution';
import type { AttributionModel } from '@/composables/useAttribution';

interface Props {
    dataModelId: number | null;
    startDate: string | null;
    endDate: string | null;
    /** Maximum number of top channels to show. Defaults to 5. */
    maxChannels?: number;
    /** Whether to show the model selector. Defaults to true. */
    showModelSelector?: boolean;
    /** Whether to show AI insights. Defaults to true. */
    showInsights?: boolean;
}

const props = withDefaults(defineProps<Props>(), {
    maxChannels: 5,
    showModelSelector: true,
    showInsights: true,
});

const emit = defineEmits<{
    'view-full': [];
    'model-change': [model: AttributionModel];
}>();

const {
    selectedModel,
    rawData,
    isLoading,
    hasFetched,
    hasData,
    error,
    selectModel,
    formatCurrency,
    formatNumber,
    formatPercent,
    formatRatio,
} = useAttribution({
    dataModelId: computed(() => props.dataModelId),
    startDate: computed(() => props.startDate),
    endDate: computed(() => props.endDate),
});

const currentModelLabel = computed(() =>
    ATTRIBUTION_MODELS.find(m => m.id === selectedModel.value)?.label ?? 'Last Touch',
);

/** Top channels sorted by attributed conversions, limited by maxChannels */
const topChannels = computed(() => {
    if (!rawData.value) return [];
    return [...rawData.value.channelAttribution]
        .sort((a, b) => b.attributedConversions - a.attributedConversions)
        .slice(0, props.maxChannels);
});

/** Total attributed conversions across all channels */
const totalConversions = computed(() =>
    rawData.value?.channelAttribution.reduce((s, c) => s + c.attributedConversions, 0) ?? 0,
);

/** Total attributed revenue across all channels */
const totalRevenue = computed(() =>
    rawData.value?.channelAttribution.reduce((s, c) => s + c.attributedRevenue, 0) ?? 0,
);

/** Top channel by conversions */
const topChannel = computed(() => topChannels.value[0] ?? null);

/** Average ROAS across channels with spend > 0 */
const avgROAS = computed(() => {
    if (!rawData.value || rawData.value.roiByChannel.length === 0) return 0;
    const withSpend = rawData.value.roiByChannel.filter(r => r.spend > 0);
    if (withSpend.length === 0) return 0;
    return withSpend.reduce((s, r) => s + r.attributedROAS, 0) / withSpend.length;
});

/** Whether the backend has returned real data */
const backendAvailable = computed(() => hasFetched.value && rawData.value !== null);

function onModelChange(model: string) {
    selectModel(model as AttributionModel);
    emit('model-change', model as AttributionModel);
}

/** Get a channel color based on index */
function channelColor(index: number): string {
    const colors = [
        'bg-blue-500', 'bg-emerald-500', 'bg-amber-500',
        'bg-purple-500', 'bg-pink-500', 'bg-cyan-500',
        'bg-orange-500', 'bg-teal-500',
    ];
    return colors[index % colors.length];
}
</script>

<template>
    <div class="attribution-panel bg-white rounded-xl border border-gray-100 shadow-sm">
        <!-- Header -->
        <div class="p-4 border-b border-gray-100">
            <div class="flex items-center justify-between">
                <div class="flex items-center gap-2">
                    <div class="w-8 h-8 rounded-lg bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center">
                        <font-awesome-icon :icon="['fas', 'scale-balanced']" class="text-white text-xs" />
                    </div>
                    <div>
                        <h3 class="text-sm font-semibold text-gray-800">Attribution</h3>
                        <p class="text-[10px] text-gray-400">{{ currentModelLabel }} Model</p>
                    </div>
                </div>
                <button
                    class="text-[11px] text-blue-600 hover:text-blue-700 font-medium transition-colors"
                    @click="emit('view-full')"
                >
                    View Full Report →
                </button>
            </div>
        </div>

        <!-- Loading State -->
        <div v-if="isLoading" class="p-6 space-y-4">
            <div class="flex items-center justify-center py-8">
                <div class="flex flex-col items-center gap-3">
                    <div class="w-8 h-8 border-2 border-blue-200 border-t-blue-500 rounded-full animate-spin" />
                    <span class="text-xs text-gray-400">Loading attribution data...</span>
                </div>
            </div>
        </div>

        <!-- Error State -->
        <div v-else-if="hasFetched && error" class="p-6">
            <div class="flex flex-col items-center justify-center py-6 text-center">
                <div class="w-10 h-10 rounded-full bg-red-50 flex items-center justify-center mb-3">
                    <font-awesome-icon :icon="['fas', 'exclamation-triangle']" class="text-red-400 text-sm" />
                </div>
                <p class="text-sm font-medium text-gray-700 mb-1">Failed to load attribution</p>
                <p class="text-xs text-gray-400">{{ error }}</p>
            </div>
        </div>

        <!-- Empty State -->
        <div v-else-if="hasFetched && !hasData" class="p-6">
            <div class="flex flex-col items-center justify-center py-6 text-center">
                <div class="w-10 h-10 rounded-full bg-gray-50 flex items-center justify-center mb-3">
                    <font-awesome-icon :icon="['fas', 'scale-balanced']" class="text-gray-300 text-sm" />
                </div>
                <p class="text-sm font-medium text-gray-700 mb-1">No attribution data</p>
                <p class="text-xs text-gray-400 max-w-[200px]">
                    Connect ad platforms and generate touchpoint data to see attribution insights.
                </p>
            </div>
        </div>

        <!-- Data Content -->
        <div v-else-if="hasData" class="p-4 space-y-4">
            <!-- Model Selector (compact) -->
            <div v-if="showModelSelector" class="flex items-center gap-1.5 overflow-x-auto pb-1">
                <button
                    v-for="model in ATTRIBUTION_MODELS"
                    :key="model.id"
                    class="flex-shrink-0 px-2.5 py-1 text-[10px] font-medium rounded-full transition-all border"
                    :class="selectedModel === model.id
                        ? 'bg-blue-50 text-blue-700 border-blue-200'
                        : 'bg-white text-gray-500 border-gray-200 hover:bg-gray-50 hover:text-gray-700'"
                    @click="onModelChange(model.id)"
                >
                    {{ model.shortLabel }}
                </button>
            </div>

            <!-- KPI Summary Row -->
            <div class="grid grid-cols-3 gap-3">
                <div class="text-center">
                    <p class="text-lg font-bold text-gray-800">{{ formatNumber(totalConversions) }}</p>
                    <p class="text-[10px] text-gray-400 mt-0.5">Conversions</p>
                </div>
                <div class="text-center">
                    <p class="text-lg font-bold text-gray-800">{{ formatCurrency(totalRevenue) }}</p>
                    <p class="text-[10px] text-gray-400 mt-0.5">Revenue</p>
                </div>
                <div class="text-center">
                    <p class="text-lg font-bold"
                       :class="avgROAS >= 2 ? 'text-emerald-600' : avgROAS >= 1 ? 'text-amber-600' : 'text-red-500'"
                    >
                        {{ formatRatio(avgROAS) }}
                    </p>
                    <p class="text-[10px] text-gray-400 mt-0.5">Avg ROAS</p>
                </div>
            </div>

            <!-- Top Channels List -->
            <div>
                <p class="text-[11px] font-semibold text-gray-600 mb-2">Top Channels</p>
                <div class="space-y-2">
                    <div
                        v-for="(channel, idx) in topChannels"
                        :key="channel.channel"
                        class="flex items-center gap-2.5"
                    >
                        <div class="w-1.5 h-1.5 rounded-full flex-shrink-0" :class="channelColor(idx)" />
                        <span class="text-xs text-gray-700 flex-1 truncate">{{ channel.channel }}</span>
                        <span class="text-xs font-semibold text-gray-800 tabular-nums">
                            {{ formatNumber(channel.attributedConversions) }}
                        </span>
                        <span class="text-[10px] text-gray-400 tabular-nums w-12 text-right">
                            {{ formatPercent(channel.conversionShare) }}
                        </span>
                        <!-- Share bar -->
                        <div class="w-16 h-1.5 bg-gray-100 rounded-full overflow-hidden flex-shrink-0">
                            <div
                                class="h-full rounded-full transition-all duration-500"
                                :class="channelColor(idx)"
                                :style="{ width: `${Math.min(channel.conversionShare, 100)}%` }"
                            />
                        </div>
                    </div>
                </div>
            </div>

            <!-- Top Channel Highlight -->
            <div v-if="topChannel" class="bg-gradient-to-r from-blue-50 to-indigo-50 rounded-lg p-3">
                <div class="flex items-center gap-2">
                    <font-awesome-icon :icon="['fas', 'trophy']" class="text-amber-500 text-xs" />
                    <span class="text-[11px] font-semibold text-gray-700">
                        {{ topChannel.channel }}
                    </span>
                    <span class="text-[10px] text-gray-500">
                        leads with {{ formatNumber(topChannel.attributedConversions) }} conversions
                    </span>
                </div>
                <div class="flex items-center gap-4 mt-1.5">
                    <span class="text-[10px] text-gray-500">
                        Revenue: <span class="font-semibold text-gray-700">{{ formatCurrency(topChannel.attributedRevenue) }}</span>
                    </span>
                    <span class="text-[10px] text-gray-500">
                        ROAS: <span class="font-semibold"
                        :class="topChannel.attributedROAS >= 2 ? 'text-emerald-600' : topChannel.attributedROAS >= 1 ? 'text-amber-600' : 'text-red-500'"
                    >{{ formatRatio(topChannel.attributedROAS) }}</span>
                    </span>
                </div>
            </div>

            <!-- AI Insights (compact) -->
            <div v-if="showInsights && rawData?.aiInsights" class="bg-violet-50 rounded-lg p-3">
                <div class="flex items-start gap-2">
                    <font-awesome-icon :icon="['fas', 'wand-magic-sparkles']" class="text-violet-500 text-xs mt-0.5 flex-shrink-0" />
                    <p class="text-[11px] text-violet-700 leading-relaxed line-clamp-3">
                        {{ rawData.aiInsights }}
                    </p>
                </div>
            </div>
        </div>

        <!-- Initial State (not yet fetched) -->
        <div v-else class="p-6">
            <div class="flex flex-col items-center justify-center py-6 text-center">
                <div class="w-10 h-10 rounded-full bg-gray-50 flex items-center justify-center mb-3">
                    <font-awesome-icon :icon="['fas', 'scale-balanced']" class="text-gray-300 text-sm" />
                </div>
                <p class="text-sm font-medium text-gray-700 mb-1">Select a data model</p>
                <p class="text-xs text-gray-400">
                    Choose a connected data model to view attribution analysis.
                </p>
            </div>
        </div>
    </div>
</template>