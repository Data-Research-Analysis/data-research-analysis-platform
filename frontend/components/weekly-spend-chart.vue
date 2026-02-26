<script setup lang="ts">
import type { IWeeklyTrendPoint } from '~/types/IMarketingHub';

interface Props {
    trend: IWeeklyTrendPoint[];
    isLoading?: boolean;
}

const props = withDefaults(defineProps<Props>(), {
    isLoading: false,
});

// Colour palette per channel
const CHANNEL_COLORS: Record<string, string> = {
    google_ads: '#4285F4',
    meta_ads: '#1877F2',
    linkedin_ads: '#0A66C2',
    google_analytics: '#34A853',
};

function channelColor(type: string): string {
    if (type.startsWith('offline_')) return '#6B7280';
    return CHANNEL_COLORS[type] ?? '#94A3B8';
}

const CHANNEL_LABELS: Record<string, string> = {
    google_ads: 'Google Ads',
    meta_ads: 'Meta Ads',
    linkedin_ads: 'LinkedIn Ads',
    google_analytics: 'GA4',
};

function channelLabel(type: string): string {
    if (type.startsWith('offline_')) return `Offline – ${type.replace('offline_', '')}`;
    return CHANNEL_LABELS[type] ?? type;
}

// Build chart data in the format expected by charts/multi-line-chart.vue:
// { categories: string[], series: Array<{ name, data: number[], color }> }
const chartData = computed(() => {
    if (props.trend.length === 0) return null;

    const categories = props.trend.map(p => {
        const d = new Date(p.weekStart);
        return `${d.getMonth() + 1}/${d.getDate()}`;
    });

    // Collect all channel types across all weeks
    const allChannels = new Set<string>();
    for (const point of props.trend) {
        Object.keys(point.byChannel).forEach(k => allChannels.add(k));
    }

    const series = Array.from(allChannels).map(type => ({
        name: channelLabel(type),
        color: channelColor(type),
        data: props.trend.map(p => p.byChannel[type] ?? 0),
    }));

    return { categories, series };
});

const isEmpty = computed(() => !props.trend.length || !chartData.value?.series.length);
</script>

<template>
    <div class="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <div class="px-5 py-4 border-b border-gray-100 flex items-center gap-2">
            <font-awesome-icon :icon="['fas', 'chart-line']" class="text-primary-blue-100" />
            <h3 class="text-sm font-semibold text-gray-700">Weekly Spend Trend</h3>
        </div>

        <!-- Loading -->
        <div v-if="isLoading" class="p-5 flex items-center justify-center h-48">
            <font-awesome-icon :icon="['fas', 'spinner']" class="animate-spin text-2xl text-gray-300" />
        </div>

        <!-- Empty -->
        <div v-else-if="isEmpty" class="flex flex-col items-center justify-center py-12 text-center px-6">
            <font-awesome-icon :icon="['fas', 'chart-area']" class="text-3xl text-gray-300 mb-3" />
            <p class="text-sm text-gray-400">No weekly spend data for this period</p>
        </div>

        <!-- Chart -->
        <div v-else class="p-4">
            <ChartsMultiLineChart
                chart-id="weekly-spend-hub"
                :data="chartData"
                :height="300"
                y-axis-label="Spend ($)"
                :show-data-points="true"
                :enable-tooltips="true"
                legend-position="bottom"
            />
        </div>
    </div>
</template>
