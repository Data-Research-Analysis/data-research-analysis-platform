<template>
    <div class="space-y-6">
        <!-- Summary Cards -->
        <div class="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div class="bg-white rounded-lg shadow p-6 border-l-4 border-green-500">
                <p class="text-sm font-medium text-gray-600">Total ROI</p>
                <p class="text-3xl font-bold text-gray-900 mt-2">
                    {{ avgROI.toFixed(1) }}%
                </p>
                <p class="text-sm text-gray-500 mt-1">Average across channels</p>
            </div>
            <div class="bg-white rounded-lg shadow p-6 border-l-4 border-blue-500">
                <p class="text-sm font-medium text-gray-600">Total ROAS</p>
                <p class="text-3xl font-bold text-gray-900 mt-2">
                    {{ avgROAS.toFixed(2) }}x
                </p>
                <p class="text-sm text-gray-500 mt-1">Return on ad spend</p>
            </div>
            <div class="bg-white rounded-lg shadow p-6 border-l-4 border-purple-500">
                <p class="text-sm font-medium text-gray-600">Avg Cost/Conversion</p>
                <p class="text-3xl font-bold text-gray-900 mt-2">
                    ${{ avgCostPerConversion.toFixed(2) }}
                </p>
                <p class="text-sm text-gray-500 mt-1">Across all channels</p>
            </div>
        </div>

        <!-- ROI Metrics Table -->
        <div class="bg-white rounded-lg shadow overflow-hidden">
            <div class="px-6 py-4 border-b border-gray-200">
                <h3 class="text-lg font-semibold text-gray-800">ROI by Channel</h3>
            </div>
            <div class="overflow-x-auto">
                <table class="w-full">
                    <thead class="bg-gray-50">
                        <tr>
                            <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                Channel
                            </th>
                            <th class="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                                Revenue
                            </th>
                            <th class="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                                Spend
                            </th>
                            <th class="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                                ROI
                            </th>
                            <th class="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                                ROAS
                            </th>
                            <th class="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                                Cost/Conv
                            </th>
                            <th class="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                                Profit Margin
                            </th>
                        </tr>
                    </thead>
                    <tbody class="bg-white divide-y divide-gray-200">
                        <tr
                            v-for="metric in sortedMetrics"
                            :key="metric.channelId"
                            class="hover:bg-gray-50 transition-colors duration-150"
                        >
                            <td class="px-6 py-4 whitespace-nowrap">
                                <span class="font-medium text-gray-900">{{ metric.channelName }}</span>
                            </td>
                            <td class="px-6 py-4 whitespace-nowrap text-right text-sm font-medium text-gray-900">
                                ${{ metric.totalRevenue.toLocaleString('en-US', { minimumFractionDigits: 2 }) }}
                            </td>
                            <td class="px-6 py-4 whitespace-nowrap text-right text-sm text-gray-900">
                                <span v-if="metric.totalSpend">
                                    ${{ metric.totalSpend.toLocaleString('en-US', { minimumFractionDigits: 2 }) }}
                                </span>
                                <span v-else class="text-gray-400">-</span>
                            </td>
                            <td class="px-6 py-4 whitespace-nowrap text-right">
                                <span v-if="metric.roi !== undefined" class="font-semibold" :class="getROIColor(metric.roi)">
                                    {{ metric.roi.toFixed(1) }}%
                                </span>
                                <span v-else class="text-gray-400">-</span>
                            </td>
                            <td class="px-6 py-4 whitespace-nowrap text-right">
                                <span v-if="metric.roas !== undefined" class="font-medium text-gray-900">
                                    {{ metric.roas.toFixed(2) }}x
                                </span>
                                <span v-else class="text-gray-400">-</span>
                            </td>
                            <td class="px-6 py-4 whitespace-nowrap text-right text-sm text-gray-900">
                                <span v-if="metric.costPerConversion">
                                    ${{ metric.costPerConversion.toFixed(2) }}
                                </span>
                                <span v-else class="text-gray-400">-</span>
                            </td>
                            <td class="px-6 py-4 whitespace-nowrap text-right">
                                <span v-if="metric.profitMargin !== undefined" class="font-medium" :class="getProfitMarginColor(metric.profitMargin)">
                                    {{ metric.profitMargin.toFixed(1) }}%
                                </span>
                                <span v-else class="text-gray-400">-</span>
                            </td>
                        </tr>
                    </tbody>
                </table>
            </div>
        </div>

        <!-- ROI Visualization -->
        <div class="bg-white rounded-lg shadow p-6">
            <h3 class="text-lg font-semibold text-gray-800 mb-4">ROI Comparison</h3>
            <div class="space-y-4">
                <div
                    v-for="metric in metricsWithROI"
                    :key="metric.channelId"
                    class="relative"
                >
                    <div class="flex items-center justify-between mb-1">
                        <span class="text-sm font-medium text-gray-700">{{ metric.channelName }}</span>
                        <div class="flex items-center gap-2">
                            <span class="text-sm text-gray-500">
                                ${{ metric.totalSpend?.toLocaleString() || 0 }} spend
                            </span>
                            <span class="text-sm font-bold" :class="getROIColor(metric.roi!)">
                                {{ metric.roi!.toFixed(1) }}% ROI
                            </span>
                        </div>
                    </div>
                    <div class="w-full bg-gray-200 rounded-full h-8 relative overflow-hidden">
                        <div
                            class="h-8 rounded-full transition-all duration-500 flex items-center justify-end pr-2"
                            :class="getROIBarColor(metric.roi!)"
                            :style="{ width: `${getROIBarWidth(metric.roi!)}%` }"
                        >
                            <span class="text-white font-medium text-xs">
                                ${{ metric.totalRevenue.toLocaleString('en-US', { minimumFractionDigits: 0 }) }}
                            </span>
                        </div>
                    </div>
                </div>
            </div>
        </div>

        <!-- Revenue vs Spend Chart -->
        <div class="bg-white rounded-lg shadow p-6">
            <h3 class="text-lg font-semibold text-gray-800 mb-4">Revenue vs Spend</h3>
            <div class="space-y-4">
                <div
                    v-for="metric in metricsWithROI"
                    :key="`chart-${metric.channelId}`"
                    class="border-b border-gray-200 pb-4 last:border-0"
                >
                    <div class="flex items-center justify-between mb-2">
                        <span class="font-medium text-gray-800">{{ metric.channelName }}</span>
                        <span class="text-sm text-gray-500">
                            {{ metric.roas?.toFixed(2) }}x ROAS
                        </span>
                    </div>
                    <div class="grid grid-cols-2 gap-4">
                        <div>
                            <p class="text-xs text-gray-500 mb-1">Revenue</p>
                            <div class="h-8 bg-green-500 rounded flex items-center justify-center text-white font-medium text-sm">
                                ${{ metric.totalRevenue.toLocaleString('en-US', { minimumFractionDigits: 0 }) }}
                            </div>
                        </div>
                        <div>
                            <p class="text-xs text-gray-500 mb-1">Spend</p>
                            <div class="h-8 bg-red-500 rounded flex items-center justify-center text-white font-medium text-sm">
                                ${{ metric.totalSpend?.toLocaleString('en-US', { minimumFractionDigits: 0 }) || 0 }}
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>

        <!-- No Spend Data Notice -->
        <div v-if="metricsWithROI.length === 0" class="bg-yellow-50 border border-yellow-200 rounded-lg p-6">
            <div class="flex items-start gap-3">
                <span class="text-2xl">⚠️</span>
                <div>
                    <h4 class="font-semibold text-yellow-800 mb-1">No Spend Data Available</h4>
                    <p class="text-sm text-yellow-700">
                        Add channel spend data to calculate ROI, ROAS, and other profitability metrics.
                        Revenue data is available, but without spend information we cannot determine profitability.
                    </p>
                </div>
            </div>
        </div>

        <!-- Loading State -->
        <div v-if="loading" class="flex items-center justify-center py-12">
            <div class="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
        </div>
    </div>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import type { IROIMetrics } from '~/stores/attribution';

interface Props {
    metrics: IROIMetrics[];
    loading?: boolean;
}

const props = defineProps<Props>();

const sortedMetrics = computed(() => {
    return [...props.metrics].sort((a, b) => {
        // Sort by ROI if available, otherwise by revenue
        if (a.roi !== undefined && b.roi !== undefined) {
            return b.roi - a.roi;
        }
        return b.totalRevenue - a.totalRevenue;
    });
});

const metricsWithROI = computed(() => {
    return props.metrics.filter(m => m.roi !== undefined);
});

const avgROI = computed(() => {
    const withROI = metricsWithROI.value;
    if (withROI.length === 0) return 0;
    return withROI.reduce((sum, m) => sum + (m.roi || 0), 0) / withROI.length;
});

const avgROAS = computed(() => {
    const withROAS = props.metrics.filter(m => m.roas !== undefined);
    if (withROAS.length === 0) return 0;
    return withROAS.reduce((sum, m) => sum + (m.roas || 0), 0) / withROAS.length;
});

const avgCostPerConversion = computed(() => {
    const withCost = props.metrics.filter(m => m.costPerConversion !== undefined);
    if (withCost.length === 0) return 0;
    return withCost.reduce((sum, m) => sum + (m.costPerConversion || 0), 0) / withCost.length;
});

function getROIColor(roi: number): string {
    if (roi >= 100) return 'text-green-600';
    if (roi >= 0) return 'text-yellow-600';
    return 'text-red-600';
}

function getProfitMarginColor(margin: number): string {
    if (margin >= 50) return 'text-green-600';
    if (margin >= 20) return 'text-yellow-600';
    return 'text-red-600';
}

function getROIBarColor(roi: number): string {
    if (roi >= 100) return 'bg-green-500';
    if (roi >= 0) return 'bg-yellow-500';
    return 'bg-red-500';
}

function getROIBarWidth(roi: number): number {
    // Normalize ROI to 0-100% bar width
    // Assume 200% ROI = 100% bar width
    const normalized = Math.min(Math.max((roi + 50) / 250 * 100, 10), 100);
    return normalized;
}
</script>
