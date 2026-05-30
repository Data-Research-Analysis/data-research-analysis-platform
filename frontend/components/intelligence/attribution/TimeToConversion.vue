<script setup lang="ts">
/**
 * TimeToConversion — Displays time-to-conversion metrics with a
 * histogram distribution.
 *
 * Shows average, median, min, and max time-to-conversion as summary
 * cards, with a horizontal bar chart showing the distribution buckets.
 */
import type { ITimeToConversion } from '@/composables/useAttribution';

interface Props {
    data: ITimeToConversion | null;
    isLoading?: boolean;
}

const props = withDefaults(defineProps<Props>(), { isLoading: false });

const maxCount = computed(() => {
    if (!props.data || props.data.distribution.length === 0) return 1;
    return Math.max(...props.data.distribution.map(b => b.count));
});

const summaryCards = computed(() => {
    if (!props.data) return [];
    return [
        { label: 'Average', value: props.data.average, icon: ['fas', 'clock'] as [string, string], color: 'text-blue-600 bg-blue-50' },
        { label: 'Median', value: props.data.median, icon: ['fas', 'clock-rotate-left'] as [string, string], color: 'text-purple-600 bg-purple-50' },
        { label: 'Fastest', value: props.data.min, icon: ['fas', 'bolt'] as [string, string], color: 'text-emerald-600 bg-emerald-50' },
        { label: 'Slowest', value: props.data.max, icon: ['fas', 'hourglass-half'] as [string, string], color: 'text-amber-600 bg-amber-50' },
    ];
});

function formatHours(hours: number): string {
    if (hours < 1) return `${Math.round(hours * 60)}m`;
    if (hours < 24) return `${hours.toFixed(1)}h`;
    const days = hours / 24;
    if (days < 7) return `${days.toFixed(1)}d`;
    const weeks = days / 7;
    return `${weeks.toFixed(1)}w`;
}
</script>

<template>
    <div class="time-to-conversion">
        <!-- Loading skeleton -->
        <div v-if="isLoading" class="space-y-4">
            <div class="grid grid-cols-2 lg:grid-cols-4 gap-3">
                <div v-for="i in 4" :key="i" class="h-20 bg-gray-100 rounded-xl animate-pulse" />
            </div>
            <div class="h-40 bg-gray-100 rounded animate-pulse" />
        </div>

        <template v-else-if="data">
            <!-- Summary cards -->
            <div class="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-5">
                <div
                    v-for="card in summaryCards"
                    :key="card.label"
                    class="p-3 rounded-xl border border-gray-100 bg-white hover:shadow-sm transition-shadow"
                >
                    <div class="flex items-center gap-2 mb-1">
                        <span class="w-6 h-6 rounded-lg flex items-center justify-center text-xs" :class="card.color">
                            <font-awesome-icon :icon="card.icon" />
                        </span>
                        <span class="text-xs text-gray-500 font-medium">{{ card.label }}</span>
                    </div>
                    <p class="text-lg font-bold text-gray-800">{{ formatHours(card.value) }}</p>
                </div>
            </div>

            <!-- Distribution histogram -->
            <div v-if="data.distribution.length > 0" class="space-y-1.5">
                <div
                    v-for="bucket in data.distribution"
                    :key="bucket.label"
                    class="flex items-center gap-2"
                >
                    <span class="text-xs text-gray-500 w-16 text-right flex-shrink-0">{{ bucket.label }}</span>
                    <div class="flex-1 h-5 bg-gray-50 rounded overflow-hidden">
                        <div
                            class="h-full bg-gradient-to-r from-indigo-400 to-indigo-500 rounded transition-all duration-500 flex items-center"
                            :style="{ width: Math.max((bucket.count / maxCount) * 100, 2) + '%' }"
                        >
                            <span
                                v-if="(bucket.count / maxCount) > 0.15"
                                class="text-[10px] font-semibold text-white pl-1.5"
                            >
                                {{ bucket.count }}
                            </span>
                        </div>
                    </div>
                    <span
                        v-if="(bucket.count / maxCount) <= 0.15"
                        class="text-[10px] text-gray-400 w-8 flex-shrink-0"
                    >
                        {{ bucket.count }}
                    </span>
                </div>
            </div>

            <!-- No distribution data -->
            <div v-else class="text-center py-6">
                <p class="text-xs text-gray-400">Distribution data not available</p>
            </div>
        </template>

        <!-- Empty state -->
        <div v-else class="text-center py-10">
            <font-awesome-icon :icon="['fas', 'stopwatch']" class="text-3xl text-gray-300 mb-3" />
            <p class="text-sm text-gray-500">No time-to-conversion data available</p>
            <p class="text-xs text-gray-400 mt-1">
                This data will appear once conversion journey data is available
            </p>
        </div>
    </div>
</template>