<script setup lang="ts">
/**
 * FunnelStage — Single stage within a conversion funnel.
 *
 * Renders a horizontally-scaled bar with:
 *   - Stage name
 *   - Count (formatted)
 *   - Conversion rate to next stage
 *   - Drop-off % (only shown between stages)
 *   - Coloured indicator dot
 *
 * The width of the bar is proportional to `maxCount` (the first stage).
 */
import type { IFunnelStage } from '@/composables/useFunnelAnalysis';

interface Props {
    stage: IFunnelStage;
    maxCount: number;
    formatNumber: (v: number) => string;
    formatPercent: (v: number) => string;
    /** Whether this is the last stage (no arrow / drop-off below) */
    isLast: boolean;
    /** Show the drop-off connector arrow between stages */
    showDropOff: boolean;
}

const props = defineProps<Props>();

const barWidth = computed(() => {
    if (props.maxCount === 0) return '100%';
    return `${Math.max(8, (props.stage.count / props.maxCount) * 100)}%`;
});

/** Gradient colours from top-of-funnel to bottom */
const stageColors = ['bg-blue-500', 'bg-indigo-500', 'bg-purple-500', 'bg-pink-500', 'bg-rose-500'];
const stageTextColors = ['text-blue-500', 'text-indigo-500', 'text-purple-500', 'text-pink-500', 'text-rose-500'];

const colorClass = computed(() => stageColors[(props.stage.order - 1) % stageColors.length]);
const textColorClass = computed(() => stageTextColors[(props.stage.order - 1) % stageTextColors.length]);

const dotColor = computed(() => {
    const colors = ['bg-blue-400', 'bg-indigo-400', 'bg-purple-400', 'bg-pink-400', 'bg-rose-400'];
    return colors[(props.stage.order - 1) % colors.length];
});
</script>

<template>
    <div class="funnel-stage-group">
        <!-- Stage bar -->
        <div class="flex items-center gap-3 mb-1">
            <!-- Order dot -->
            <div class="flex-shrink-0 w-7 h-7 rounded-full flex items-center justify-center text-[10px] font-bold text-white"
                :class="dotColor"
            >
                {{ stage.order }}
            </div>

            <!-- Stage info + bar -->
            <div class="flex-1 min-w-0">
                <div class="flex items-center justify-between mb-0.5">
                    <span class="text-xs font-semibold text-gray-700">{{ stage.name }}</span>
                    <span class="text-xs font-mono font-bold" :class="textColorClass">
                        {{ formatNumber(stage.count) }}
                    </span>
                </div>
                <!-- Bar -->
                <div class="w-full bg-gray-100 rounded-full h-2.5 overflow-hidden">
                    <div
                        class="h-full rounded-full transition-all duration-500 ease-out"
                        :class="colorClass"
                        :style="{ width: barWidth }"
                    />
                </div>
            </div>

            <!-- Conversion rate to next (if not last) -->
            <div v-if="stage.conversionRateToNext !== null" class="flex-shrink-0 text-right w-16">
                <span class="text-[10px] text-gray-400 block leading-tight">→ next</span>
                <span class="text-xs font-semibold text-emerald-600">
                    {{ formatPercent(stage.conversionRateToNext) }}
                </span>
            </div>
        </div>

        <!-- Drop-off indicator between stages -->
        <div v-if="showDropOff && stage.dropOffPercent !== null" class="ml-3.5 flex items-center gap-2 my-1">
            <div class="w-5 flex justify-center">
                <div class="w-px h-4 bg-gray-200" />
            </div>
            <div class="flex items-center gap-1">
                <font-awesome-icon :icon="['fas', 'arrow-down']" class="text-[9px] text-red-400" />
                <span class="text-[10px] font-medium text-red-400">
                    -{{ formatPercent(stage.dropOffPercent) }} drop-off
                </span>
            </div>
        </div>
    </div>
</template>