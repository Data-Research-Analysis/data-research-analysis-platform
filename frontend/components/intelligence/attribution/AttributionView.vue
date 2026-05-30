<script setup lang="ts">
/**
 * AttributionView — Main view for the Attribution tab in the
 * Intelligence Hub.
 *
 * Composes:
 *   - AttributionModelSelector
 *   - ChannelAttributionTable
 *   - ConversionPathSankey
 *   - TimeToConversion
 *   - AttributionROI
 *
 * Orchestrates the useAttribution composable and passes data down
 * to child components. Handles the "not yet available" graceful
 * degradation when the ATTR-002 backend service has not been
 * deployed.
 */
import { useAttribution } from '@/composables/useAttribution';
import { useFunnelAnalysis } from '@/composables/useFunnelAnalysis';
import { AttributionModelSelector } from './';
import { ChannelAttributionTable } from './';
import { ConversionPathSankey } from './';
import { TimeToConversion } from './';
import { AttributionROI } from './';
import { ConversionFunnel } from './';
import { ChannelFunnelComparison } from './';

interface Props {
    dataModelId: number | null;
    startDate: string | null;
    endDate: string | null;
}

const props = defineProps<Props>();

const {
    selectedModel,
    rawData,
    isLoading,
    hasFetched,
    hasData,
    selectModel,
    formatCurrency,
    formatNumber,
    formatRatio,
} = useAttribution({
    dataModelId: computed(() => props.dataModelId),
    startDate: computed(() => props.startDate),
    endDate: computed(() => props.endDate),
});

function onModelChange(model: string) {
    selectModel(model as any);
}

/** Determine if the backend attribution service is available */
const backendAvailable = computed(() => hasFetched.value && rawData.value !== null);

// ---- Funnel Analysis (ATTR-003) ----
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
</script>

<template>
    <div class="attribution-view space-y-6">
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
                        Conversions and revenue attributed to each channel using the selected model
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

        <!-- Funnel Analysis (ATTR-003) -->
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
                <!-- Funnel sub-tabs -->
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

        <!-- Bottom row: Time to Conversion + Attribution ROI side by side on large screens -->
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
    </div>
</template>