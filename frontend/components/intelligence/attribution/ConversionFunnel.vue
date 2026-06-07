<script setup lang="ts">
/**
 * ConversionFunnel — Renders the overall conversion funnel as a
 * stacked-visual with drop-off rates between each stage.
 *
 * Composes FunnelStage components for each stage and shows:
 *   - Overall completion rate
 *   - Per-stage counts and conversion rates
 *   - Drop-off indicators between stages
 *   - Time-per-stage estimates (when available)
 */
import type { IFunnelStage, ITimePerStage } from '@/composables/useFunnelAnalysis';

interface Props {
    stages: IFunnelStage[];
    timePerStage: ITimePerStage[];
    maxCount: number;
    completionRate: number | null;
    formatNumber: (v: number) => string;
    formatPercent: (v: number) => string;
    isLoading: boolean;
}

const props = defineProps<Props>();

function getTimeBetween(fromStage: string): ITimePerStage | null {
    return props.timePerStage.find(t => t.fromStage === fromStage) ?? null;
}
</script>

<template>
    <div class="conversion-funnel">
        <!-- Loading skeleton -->
        <div v-if="isLoading" class="space-y-4 animate-pulse">
            <div v-for="i in 4" :key="i" class="flex items-center gap-3">
                <div class="w-7 h-7 rounded-full bg-gray-200" />
                <div class="flex-1 space-y-1">
                    <div class="h-3 bg-gray-200 rounded w-24" />
                    <div class="h-2.5 bg-gray-200 rounded-full" />
                </div>
            </div>
        </div>

        <!-- Empty state -->
        <div v-else-if="!stages.length" class="text-center py-10">
            <font-awesome-icon :icon="['fas', 'filter']" class="text-3xl text-gray-300 mb-3" />
            <p class="text-sm text-gray-400">
                No funnel data detected for this data model.
            </p>
            <p class="text-xs text-gray-400 mt-1">
                Ensure your table contains columns like <span class="font-mono text-gray-500">impressions</span>,
                <span class="font-mono text-gray-500">clicks</span>,
                <span class="font-mono text-gray-500">conversions</span> for auto-detection.
            </p>
        </div>

        <!-- Funnel visualization -->
        <div v-else class="space-y-0">
            <!-- Overall completion rate summary -->
            <div v-if="completionRate !== null" class="flex items-center gap-3 mb-5 pb-4 border-b border-gray-100">
                <div class="flex items-center justify-center w-10 h-10 rounded-lg bg-emerald-50">
                    <font-awesome-icon :icon="['fas', 'filter']" class="text-emerald-500" />
                </div>
                <div>
                    <span class="text-xs text-gray-500 block">Overall Funnel Completion</span>
                    <span class="text-lg font-bold text-emerald-600">{{ formatPercent(completionRate) }}</span>
                    <span class="text-xs text-gray-400 ml-1">
                        ({{ formatNumber(stages[stages.length - 1].count) }} / {{ formatNumber(stages[0].count) }})
                    </span>
                </div>
            </div>

            <!-- Stages -->
            <FunnelStage
                v-for="(stage, index) in stages"
                :key="stage.id"
                :stage="stage"
                :max-count="maxCount"
                :format-number="formatNumber"
                :format-percent="formatPercent"
                :is-last="index === stages.length - 1"
                :show-drop-off="index < stages.length - 1"
            />

            <!-- Time-per-stage section -->
            <div v-if="timePerStage.length" class="mt-6 pt-4 border-t border-gray-100">
                <h4 class="text-xs font-semibold text-gray-500 mb-3 flex items-center gap-1.5">
                    <font-awesome-icon :icon="['fas', 'clock']" class="text-amber-400" />
                    Time Between Stages
                </h4>
                <div class="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    <div
                        v-for="tps in timePerStage"
                        :key="`${tps.fromStage}-${tps.toStage}`"
                        class="flex items-center gap-2 bg-gray-50 rounded-lg px-3 py-2"
                    >
                        <div class="text-[10px] text-gray-400 flex-1">
                            <span class="font-medium text-gray-600">{{ tps.fromStage }}</span>
                            <font-awesome-icon :icon="['fas', 'arrow-right']" class="mx-1 text-gray-300" />
                            <span class="font-medium text-gray-600">{{ tps.toStage }}</span>
                        </div>
                        <span class="text-xs font-bold text-amber-600">
                            {{ tps.averageDays }}d avg
                        </span>
                    </div>
                </div>
            </div>
        </div>
    </div>
</template>