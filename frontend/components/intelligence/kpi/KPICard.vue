<script setup lang="ts">
/**
 * KPICard — Individual marketing KPI metric card.
 *
 * Displays a single KPI with its formatted value, trend indicator (up/down/flat),
 * and a D3.js sparkline showing the weekly trend. Used inside KPISummarySection.
 */

interface Props {
    /** Metric label (e.g. "ROAS", "CPA") */
    label: string;
    /** Formatted display value (e.g. "4.2x", "$32.50") */
    value: string;
    /** Percentage change vs prior period */
    trend: number;
    /** Trend direction arrow */
    trendDirection: 'up' | 'down' | 'flat';
    /**
     * Whether the trend is *positive* for this metric.
     * CPA ↓ is positive; ROAS ↑ is positive.
     */
    trendIsPositive: boolean;
    /** Weekly data points for the sparkline */
    sparklineData: number[];
    /** Accent color for sparkline and icon */
    color?: string;
    /** FontAwesome icon name (without prefix) */
    icon?: string;
    /** Whether data is loading */
    isLoading?: boolean;
}

const props = withDefaults(defineProps<Props>(), {
    color: '#3b82f6',
    icon: 'chart-line',
    isLoading: false,
});

const trendColor = computed(() => {
    if (props.trendDirection === 'flat') return 'text-gray-400';
    return props.trendIsPositive
        ? (props.trendDirection === 'up' ? 'text-emerald-600' : 'text-red-500')
        : (props.trendDirection === 'up' ? 'text-red-500' : 'text-emerald-600');
});

const trendBgColor = computed(() => {
    if (props.trendDirection === 'flat') return 'bg-gray-50 text-gray-400';
    return props.trendIsPositive
        ? (props.trendDirection === 'up' ? 'bg-emerald-50 text-emerald-600' : 'bg-red-50 text-red-500')
        : (props.trendDirection === 'up' ? 'bg-red-50 text-red-500' : 'bg-emerald-50 text-emerald-600');
});

const trendIcon = computed(() => {
    if (props.trendDirection === 'flat') return 'minus';
    return props.trendDirection === 'up' ? 'arrow-up' : 'arrow-down';
});

const formattedTrend = computed(() => {
    if (props.trendDirection === 'flat') return '0%';
    const abs = Math.abs(props.trend);
    return abs < 0.1 ? '<0.1%' : `${abs.toFixed(1)}%`;
});

const emit = defineEmits<{
    (e: 'click'): void;
}>();
</script>

<template>
    <div
        class="kpi-card group relative bg-white rounded-xl border border-gray-200 p-4 transition-all duration-200 hover:shadow-md hover:border-gray-300 cursor-pointer overflow-hidden"
        @click="emit('click')"
    >
        <!-- Loading skeleton -->
        <template v-if="isLoading">
            <div class="space-y-3">
                <div class="h-3 w-16 rounded bg-gray-100 animate-pulse" />
                <div class="h-6 w-24 rounded bg-gray-100 animate-pulse" />
                <div class="h-3 w-12 rounded bg-gray-100 animate-pulse" />
                <div class="h-8 w-full rounded bg-gray-50 animate-pulse" />
            </div>
        </template>

        <!-- Loaded content -->
        <template v-else>
            <!-- Header: icon + label -->
            <div class="flex items-center gap-2 mb-2">
                <div
                    class="w-6 h-6 rounded-md flex items-center justify-center flex-shrink-0"
                    :style="{ backgroundColor: `${color}10` }"
                >
                    <font-awesome-icon
                        :icon="['fas', icon]"
                        class="text-[10px]"
                        :style="{ color }"
                    />
                </div>
                <span class="text-[11px] font-medium text-gray-500 uppercase tracking-wide">
                    {{ label }}
                </span>
            </div>

            <!-- Value -->
            <div class="text-xl font-bold text-gray-900 leading-tight mb-1.5">
                {{ value }}
            </div>

            <!-- Trend badge -->
            <div class="flex items-center gap-1.5 mb-3">
                <span
                    class="inline-flex items-center gap-0.5 text-[10px] font-semibold px-1.5 py-0.5 rounded-full"
                    :class="trendBgColor"
                >
                    <font-awesome-icon :icon="['fas', trendIcon]" class="w-2.5 h-2.5" />
                    {{ formattedTrend }}
                </span>
                <span class="text-[10px] text-gray-400">vs prior</span>
            </div>

            <!-- Sparkline -->
            <div v-if="sparklineData.length >= 2" class="mt-auto">
                <TrendSparkline
                    :data="sparklineData"
                    :color="color"
                    :height="28"
                />
            </div>
            <!-- No data state for sparkline -->
            <div
                v-else
                class="h-7 flex items-center justify-center rounded bg-gray-50 border border-dashed border-gray-200"
            >
                <span class="text-[9px] text-gray-300">No trend data</span>
            </div>
        </template>
    </div>
</template>