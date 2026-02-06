<template>
    <div class="space-y-6">
        <!-- Summary Cards -->
        <div class="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div class="bg-gradient-to-br from-blue-500 to-blue-600 rounded-lg shadow p-6 text-white">
                <p class="text-sm font-medium opacity-90">Total Touchpoints</p>
                <p class="text-3xl font-bold mt-2">
                    {{ totalTouchpoints.toLocaleString() }}
                </p>
            </div>
            <div class="bg-gradient-to-br from-green-500 to-green-600 rounded-lg shadow p-6 text-white">
                <p class="text-sm font-medium opacity-90">Total Conversions</p>
                <p class="text-3xl font-bold mt-2">
                    {{ totalConversions.toLocaleString() }}
                </p>
            </div>
            <div class="bg-gradient-to-br from-purple-500 to-purple-600 rounded-lg shadow p-6 text-white">
                <p class="text-sm font-medium opacity-90">Total Revenue</p>
                <p class="text-3xl font-bold mt-2">
                    ${{ totalRevenue.toLocaleString('en-US', { minimumFractionDigits: 2 }) }}
                </p>
            </div>
            <div class="bg-gradient-to-br from-orange-500 to-orange-600 rounded-lg shadow p-6 text-white">
                <p class="text-sm font-medium opacity-90">Avg Conversion Rate</p>
                <p class="text-3xl font-bold mt-2">
                    {{ avgConversionRate.toFixed(2) }}%
                </p>
            </div>
        </div>

        <!-- Channel Performance Table -->
        <div class="bg-white rounded-lg shadow overflow-hidden">
            <div class="px-6 py-4 border-b border-gray-200">
                <h3 class="text-lg font-semibold text-gray-800">Channel Performance</h3>
            </div>
            <div class="overflow-x-auto">
                <table class="w-full">
                    <thead class="bg-gray-50">
                        <tr>
                            <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                Channel
                            </th>
                            <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                Category
                            </th>
                            <th class="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                                Touchpoints
                            </th>
                            <th class="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                                Conversions
                            </th>
                            <th class="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                                Revenue
                            </th>
                            <th class="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                                Conv. Rate
                            </th>
                            <th class="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                                Avg Time
                            </th>
                        </tr>
                    </thead>
                    <tbody class="bg-white divide-y divide-gray-200">
                        <tr
                            v-for="channel in sortedPerformance"
                            :key="channel.channelId"
                            class="hover:bg-gray-50 transition-colors duration-150"
                        >
                            <td class="px-6 py-4 whitespace-nowrap">
                                <div class="flex items-center">
                                    <span class="text-2xl mr-2">{{ getCategoryEmoji(channel.channelCategory) }}</span>
                                    <span class="font-medium text-gray-900">{{ channel.channelName }}</span>
                                </div>
                            </td>
                            <td class="px-6 py-4 whitespace-nowrap">
                                <span class="px-2 py-1 text-xs font-medium rounded-full" :class="getCategoryBadgeClass(channel.channelCategory)">
                                    {{ channel.channelCategory }}
                                </span>
                            </td>
                            <td class="px-6 py-4 whitespace-nowrap text-right text-sm text-gray-900">
                                {{ channel.totalTouchpoints.toLocaleString() }}
                            </td>
                            <td class="px-6 py-4 whitespace-nowrap text-right text-sm text-gray-900">
                                {{ channel.totalConversions.toLocaleString() }}
                            </td>
                            <td class="px-6 py-4 whitespace-nowrap text-right text-sm font-medium text-gray-900">
                                ${{ channel.totalRevenue.toLocaleString('en-US', { minimumFractionDigits: 2 }) }}
                            </td>
                            <td class="px-6 py-4 whitespace-nowrap text-right">
                                <span class="font-medium" :class="getConversionRateColor(channel.conversionRate)">
                                    {{ channel.conversionRate.toFixed(2) }}%
                                </span>
                            </td>
                            <td class="px-6 py-4 whitespace-nowrap text-right text-sm text-gray-500">
                                {{ formatTime(channel.avgTimeToConversion) }}
                            </td>
                        </tr>
                    </tbody>
                </table>
            </div>
        </div>

        <!-- Channel Performance Chart -->
        <div class="bg-white rounded-lg shadow p-6">
            <h3 class="text-lg font-semibold text-gray-800 mb-4">Revenue by Channel</h3>
            <div class="space-y-3">
                <div
                    v-for="channel in sortedPerformance"
                    :key="channel.channelId"
                    class="relative"
                >
                    <div class="flex items-center justify-between mb-1">
                        <span class="text-sm font-medium text-gray-700">{{ channel.channelName }}</span>
                        <span class="text-sm font-semibold text-gray-900">
                            ${{ channel.totalRevenue.toLocaleString('en-US', { minimumFractionDigits: 2 }) }}
                        </span>
                    </div>
                    <div class="w-full bg-gray-200 rounded-full h-6 relative overflow-hidden">
                        <div
                            class="h-6 rounded-full transition-all duration-500"
                            :class="getChannelBarColor(channel.channelCategory)"
                            :style="{ width: `${(channel.totalRevenue / maxRevenue) * 100}%` }"
                        >
                            <span v-if="(channel.totalRevenue / maxRevenue) * 100 > 10" class="absolute inset-0 flex items-center justify-center text-white font-medium text-xs">
                                {{ ((channel.totalRevenue / totalRevenue) * 100).toFixed(1) }}%
                            </span>
                        </div>
                    </div>
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
import type { IChannelPerformance } from '~/stores/attribution';

interface Props {
    performance: IChannelPerformance[];
    loading?: boolean;
}

const props = defineProps<Props>();

const sortedPerformance = computed(() => {
    return [...props.performance].sort((a, b) => b.totalRevenue - a.totalRevenue);
});

const totalTouchpoints = computed(() => {
    return props.performance.reduce((sum, ch) => sum + ch.totalTouchpoints, 0);
});

const totalConversions = computed(() => {
    return props.performance.reduce((sum, ch) => sum + ch.totalConversions, 0);
});

const totalRevenue = computed(() => {
    return props.performance.reduce((sum, ch) => sum + ch.totalRevenue, 0);
});

const avgConversionRate = computed(() => {
    if (props.performance.length === 0) return 0;
    return props.performance.reduce((sum, ch) => sum + ch.conversionRate, 0) / props.performance.length;
});

const maxRevenue = computed(() => {
    return Math.max(...props.performance.map(ch => ch.totalRevenue), 1);
});

function getCategoryEmoji(category: string): string {
    const emojiMap: Record<string, string> = {
        'organic': '🌱',
        'paid': '💰',
        'social': '📱',
        'email': '📧',
        'direct': '🎯',
        'referral': '🔗',
        'display': '🖼️'
    };
    return emojiMap[category] || '📊';
}

function getCategoryBadgeClass(category: string): string {
    const classMap: Record<string, string> = {
        'organic': 'bg-green-100 text-green-800',
        'paid': 'bg-purple-100 text-purple-800',
        'social': 'bg-blue-100 text-blue-800',
        'email': 'bg-orange-100 text-orange-800',
        'direct': 'bg-gray-100 text-gray-800',
        'referral': 'bg-cyan-100 text-cyan-800',
        'display': 'bg-pink-100 text-pink-800'
    };
    return classMap[category] || 'bg-gray-100 text-gray-800';
}

function getChannelBarColor(category: string): string {
    const colorMap: Record<string, string> = {
        'organic': 'bg-green-500',
        'paid': 'bg-purple-500',
        'social': 'bg-blue-500',
        'email': 'bg-orange-500',
        'direct': 'bg-gray-500',
        'referral': 'bg-cyan-500',
        'display': 'bg-pink-500'
    };
    return colorMap[category] || 'bg-gray-500';
}

function getConversionRateColor(rate: number): string {
    if (rate >= 5) return 'text-green-600';
    if (rate >= 2) return 'text-yellow-600';
    return 'text-red-600';
}

function formatTime(hours: number): string {
    if (hours < 1) {
        return `${Math.round(hours * 60)}m`;
    } else if (hours < 24) {
        return `${hours.toFixed(1)}h`;
    } else {
        return `${(hours / 24).toFixed(1)}d`;
    }
}
</script>
