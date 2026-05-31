<script setup lang="ts">
/**
 * CampaignTrendChart — Displays daily trend data for a single campaign.
 *
 * Renders a multi-line chart showing spend, impressions, clicks, conversions,
 * and revenue over time using simple CSS bars.
 */
import type { IDailyTrendRow } from '@/composables/useCampaignAnalysis';

interface Props {
    dailyTrend: IDailyTrendRow[];
    isLoading?: boolean;
}

const props = withDefaults(defineProps<Props>(), {
    isLoading: false,
});

const activeMetric = ref<'spend' | 'impressions' | 'clicks' | 'conversions' | 'revenue'>('spend');

const metricColors: Record<string, string> = {
    spend: '#6366f1',
    impressions: '#8b5cf6',
    clicks: '#3b82f6',
    conversions: '#10b981',
    revenue: '#f59e0b',
};

const metricLabels: Record<string, string> = {
    spend: 'Spend',
    impressions: 'Impressions',
    clicks: 'Clicks',
    conversions: 'Conversions',
    revenue: 'Revenue',
};

const maxValue = computed(() => {
    if (!props.dailyTrend.length) return 1;
    return Math.max(...props.dailyTrend.map(r => r[activeMetric.value])) || 1;
});

function formatMetricValue(val: number, metric: string): string {
    if (metric === 'spend' || metric === 'revenue' || metric === 'cpc' || metric === 'cpa') {
        return `$${val.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;
    }
    if (metric === 'ctr') return `${val.toFixed(2)}%`;
    if (metric === 'roas') return `${val.toFixed(2)}x`;
    return val.toLocaleString('en-US');
}

function formatDate(dateStr: string): string {
    const d = new Date(dateStr);
    return `${d.getMonth() + 1}/${d.getDate()}`;
}

function barHeight(val: number): string {
    const pct = (val / maxValue.value) * 100;
    return `${Math.max(pct, 2)}%`;
}
</script>

<template>
    <div class="bg-white rounded-xl border border-gray-200 p-5">
        <div class="flex items-center justify-between mb-4">
            <h3 class="text-sm font-semibold text-gray-800">Daily Trend</h3>
            <div class="flex gap-1">
                <button
                    v-for="metric in (['spend', 'impressions', 'clicks', 'conversions', 'revenue'] as const)"
                    :key="metric"
                    class="px-2 py-1 text-[10px] font-medium rounded-md transition-colors"
                    :class="activeMetric === metric
                        ? 'bg-gray-900 text-white'
                        : 'bg-gray-100 text-gray-500 hover:bg-gray-200'"
                    @click="activeMetric = metric"
                >
                    {{ metricLabels[metric] }}
                </button>
            </div>
        </div>

        <!-- Loading state -->
        <div v-if="isLoading" class="h-48 flex items-center justify-center">
            <div class="h-8 w-8 border-2 border-gray-200 border-t-indigo-500 rounded-full animate-spin" />
        </div>

        <!-- No data -->
        <div v-else-if="!dailyTrend.length" class="h-48 flex items-center justify-center">
            <p class="text-sm text-gray-400">No trend data available</p>
        </div>

        <!-- Chart -->
        <div v-else class="h-48 flex items-end gap-1">
            <div
                v-for="row in dailyTrend"
                :key="row.date"
                class="flex-1 flex flex-col items-center gap-1 group relative"
            >
                <!-- Tooltip -->
                <div class="absolute bottom-full mb-2 hidden group-hover:block z-10">
                    <div class="bg-gray-900 text-white text-[10px] rounded-lg px-3 py-2 whitespace-nowrap shadow-lg">
                        <div class="font-semibold mb-1">{{ formatDate(row.date) }}</div>
                        <div>{{ metricLabels[activeMetric] }}: {{ formatMetricValue(row[activeMetric], activeMetric) }}</div>
                    </div>
                </div>
                <!-- Bar -->
                <div
                    class="w-full rounded-t transition-all duration-300 min-h-[2px]"
                    :style="{
                        height: barHeight(row[activeMetric]),
                        backgroundColor: metricColors[activeMetric],
                        opacity: 0.8,
                    }"
                />
                <!-- Date label (show every Nth) -->
                <span
                    v-if="dailyTrend.indexOf(row) % Math.max(1, Math.floor(dailyTrend.length / 7)) === 0"
                    class="text-[8px] text-gray-400 mt-1"
                >
                    {{ formatDate(row.date) }}
                </span>
            </div>
        </div>
    </div>
</template>