<script setup lang="ts">
import type { IChannelMetrics } from '~/types/IMarketingHub';

interface Props {
    channels: IChannelMetrics[];
    isLoading?: boolean;
}

const props = withDefaults(defineProps<Props>(), {
    isLoading: false,
});

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

// Build data in the format expected by charts/donut-chart.vue:
// Array of { category: string, value: number, color: string }
const chartData = computed(() =>
    props.channels
        .filter(c => c.channelType !== 'google_analytics' && c.spend > 0)
        .map(c => ({
            category: c.channelLabel,
            value: c.spend,
            color: channelColor(c.channelType),
        })),
);

const totalSpend = computed(() => chartData.value.reduce((s, d) => s + d.value, 0));

function fmtPct(spend: number): string {
    if (totalSpend.value === 0) return '0%';
    return `${((spend / totalSpend.value) * 100).toFixed(0)}%`;
}

const isEmpty = computed(() => chartData.value.length === 0);
</script>

<template>
    <div class="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <div class="px-5 py-4 border-b border-gray-100 flex items-center gap-2">
            <font-awesome-icon :icon="['fas', 'chart-pie']" class="text-primary-blue-100" />
            <h3 class="text-sm font-semibold text-gray-700">Channel Mix</h3>
        </div>

        <!-- Loading -->
        <div v-if="isLoading" class="p-5 flex items-center justify-center h-48">
            <font-awesome-icon :icon="['fas', 'spinner']" class="animate-spin text-2xl text-gray-300" />
        </div>

        <!-- Empty -->
        <div v-else-if="isEmpty" class="flex flex-col items-center justify-center py-12 text-center px-6">
            <font-awesome-icon :icon="['fas', 'circle-question']" class="text-3xl text-gray-300 mb-3" />
            <p class="text-sm text-gray-400">No paid spend to display</p>
        </div>

        <!-- Chart + legend -->
        <div v-else class="p-4">
            <ChartsDonutChart
                chart-id="channel-mix-hub"
                :data="chartData"
                :height="280"
                :inner-radius="80"
                category-column="category"
                column-name="Spend"
            />

            <!-- Legend below chart -->
            <ul class="mt-3 flex flex-wrap gap-x-4 gap-y-1 justify-center">
                <li
                    v-for="item in chartData"
                    :key="item.category"
                    class="flex items-center gap-1.5 text-xs text-gray-600"
                >
                    <span class="w-2.5 h-2.5 rounded-full flex-shrink-0" :style="{ background: item.color }"></span>
                    <span>{{ item.category }}</span>
                    <span class="text-gray-400 font-medium">{{ fmtPct(item.value) }}</span>
                </li>
            </ul>
        </div>
    </div>
</template>
