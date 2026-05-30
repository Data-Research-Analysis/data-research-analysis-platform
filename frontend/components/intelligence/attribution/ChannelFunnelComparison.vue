<script setup lang="ts">
/**
 * ChannelFunnelComparison — Side-by-side mini-funnels for each
 * marketing channel so users can compare conversion paths.
 *
 * Each channel shows a compact representation of its funnel stages
 * with a completion-rate badge. Channels are sorted by completion rate
 * descending.
 */
import type { IChannelFunnel } from '@/composables/useFunnelAnalysis';

interface Props {
    channelFunnels: IChannelFunnel[];
    formatNumber: (v: number) => string;
    formatPercent: (v: number) => string;
    isLoading: boolean;
}

const props = defineProps<Props>();

/** Sorted by completion rate descending */
const sortedChannels = computed(() =>
    [...props.channelFunnels].sort((a, b) => b.completionRate - a.completionRate),
);

/** Max first-stage count across all channels for scaling */
const globalMax = computed(() => {
    let max = 0;
    for (const ch of props.channelFunnels) {
        const first = ch.stages[0]?.count ?? 0;
        if (first > max) max = first;
    }
    return max || 1;
});

/** Mini colour palette for stage bars */
const barColors = ['bg-blue-400', 'bg-indigo-400', 'bg-purple-400', 'bg-pink-400', 'bg-rose-400'];

function stageBarWidth(count: number): string {
    return `${Math.max(6, (count / globalMax.value) * 100)}%`;
}
</script>

<template>
    <div class="channel-funnel-comparison">
        <!-- Loading skeleton -->
        <div v-if="isLoading" class="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div v-for="i in 4" :key="i" class="rounded-xl border border-gray-200 p-4 animate-pulse">
                <div class="h-4 bg-gray-200 rounded w-24 mb-3" />
                <div v-for="j in 3" :key="j" class="h-2 bg-gray-100 rounded-full mb-2" />
            </div>
        </div>

        <!-- Empty state -->
        <div v-else-if="!sortedChannels.length" class="text-center py-8">
            <font-awesome-icon :icon="['fas', 'chart-bar']" class="text-2xl text-gray-300 mb-2" />
            <p class="text-sm text-gray-400">No per-channel funnel data available.</p>
            <p class="text-xs text-gray-400 mt-1">
                Ensure your data contains a channel/source column for per-channel breakdowns.
            </p>
        </div>

        <!-- Channel cards -->
        <div v-else class="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div
                v-for="channel in sortedChannels"
                :key="channel.channel"
                class="rounded-xl border border-gray-200 bg-white p-4 hover:border-indigo-200 transition-colors"
            >
                <!-- Header -->
                <div class="flex items-center justify-between mb-3">
                    <h4 class="text-sm font-semibold text-gray-700 truncate max-w-[180px]">
                        {{ channel.channel }}
                    </h4>
                    <span
                        class="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold"
                        :class="
                            channel.completionRate >= 5
                                ? 'bg-emerald-50 text-emerald-700'
                                : channel.completionRate >= 1
                                    ? 'bg-amber-50 text-amber-700'
                                    : 'bg-red-50 text-red-700'
                        "
                    >
                        {{ formatPercent(channel.completionRate) }} complete
                    </span>
                </div>

                <!-- Mini funnel bars -->
                <div class="space-y-1.5">
                    <div
                        v-for="(stage, idx) in channel.stages"
                        :key="stage.id"
                        class="flex items-center gap-2"
                    >
                        <span class="text-[9px] text-gray-400 w-16 truncate flex-shrink-0 text-right">
                            {{ stage.name }}
                        </span>
                        <div class="flex-1 bg-gray-100 rounded-full h-1.5 overflow-hidden">
                            <div
                                class="h-full rounded-full"
                                :class="barColors[idx % barColors.length]"
                                :style="{ width: stageBarWidth(stage.count) }"
                            />
                        </div>
                        <span class="text-[9px] font-mono text-gray-500 w-12 text-right flex-shrink-0">
                            {{ formatNumber(stage.count) }}
                        </span>
                    </div>
                </div>

                <!-- Stage-level conversion rates -->
                <div v-if="channel.stages.length >= 2" class="mt-3 pt-2 border-t border-gray-50">
                    <div class="flex flex-wrap gap-1.5">
                        <span
                            v-for="(stage, idx) in channel.stages.slice(0, -1)"
                            :key="`rate-${stage.id}`"
                            class="inline-flex items-center text-[9px] bg-gray-50 text-gray-500 rounded px-1.5 py-0.5"
                        >
                            {{ stage.name }}
                            <font-awesome-icon :icon="['fas', 'arrow-right']" class="mx-0.5 text-gray-300 text-[7px]" />
                            {{ channel.stages[idx + 1]?.name }}:
                            <span
                                class="ml-0.5 font-semibold"
                                :class="
                                    (stage.conversionRateToNext ?? 0) >= 50
                                        ? 'text-emerald-600'
                                        : (stage.conversionRateToNext ?? 0) >= 20
                                            ? 'text-amber-600'
                                            : 'text-red-500'
                                "
                            >
                                {{ stage.conversionRateToNext !== null ? formatPercent(stage.conversionRateToNext) : '—' }}
                            </span>
                        </span>
                    </div>
                </div>
            </div>
        </div>
    </div>
</template>