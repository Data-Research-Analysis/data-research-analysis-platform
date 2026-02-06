<template>
    <div class="space-y-6">
        <!-- Path Visualization -->
        <div class="bg-white rounded-lg shadow p-6">
            <h3 class="text-lg font-semibold text-gray-800 mb-4">Top Conversion Paths</h3>
            <div class="space-y-4">
                <div
                    v-for="(path, index) in paths"
                    :key="index"
                    class="border border-gray-200 rounded-lg p-4 hover:shadow-md transition-shadow duration-200"
                >
                    <!-- Path Header -->
                    <div class="flex items-center justify-between mb-3">
                        <div class="flex items-center gap-3">
                            <div class="flex items-center justify-center w-8 h-8 bg-blue-100 text-blue-600 rounded-full font-bold text-sm">
                                {{ index + 1 }}
                            </div>
                            <div>
                                <p class="font-semibold text-gray-900">
                                    {{ path.conversions }} conversions
                                </p>
                                <p class="text-sm text-gray-500">
                                    ${{ path.revenue.toLocaleString('en-US', { minimumFractionDigits: 2 }) }} revenue
                                </p>
                            </div>
                        </div>
                        <div class="text-right">
                            <p class="text-sm text-gray-600">
                                {{ path.avgTouchpoints.toFixed(1) }} avg touchpoints
                            </p>
                        </div>
                    </div>

                    <!-- Path Flow -->
                    <div class="flex items-center gap-2 overflow-x-auto pb-2">
                        <span
                            v-for="(channel, channelIndex) in path.path"
                            :key="channelIndex"
                            class="flex items-center gap-2"
                        >
                            <div class="px-3 py-2 bg-blue-50 text-blue-700 rounded-lg font-medium text-sm whitespace-nowrap border border-blue-200">
                                {{ channel }}
                            </div>
                            <span v-if="channelIndex < path.path.length - 1" class="text-gray-400 text-xl">
                                →
                            </span>
                        </span>
                    </div>

                    <!-- Path Metrics -->
                    <div class="mt-3 pt-3 border-t border-gray-200 grid grid-cols-3 gap-4 text-sm">
                        <div>
                            <p class="text-gray-500">Path Length</p>
                            <p class="font-semibold text-gray-900">{{ path.path.length }} steps</p>
                        </div>
                        <div>
                            <p class="text-gray-500">Avg Revenue/Conv</p>
                            <p class="font-semibold text-gray-900">
                                ${{ (path.revenue / path.conversions).toFixed(2) }}
                            </p>
                        </div>
                        <div>
                            <p class="text-gray-500">Conversion Rate</p>
                            <p class="font-semibold text-gray-900">
                                {{ ((path.conversions / (path.avgTouchpoints * 100)) * 100).toFixed(2) }}%
                            </p>
                        </div>
                    </div>
                </div>
            </div>
        </div>

        <!-- Path Length Distribution -->
        <div class="bg-white rounded-lg shadow p-6">
            <h3 class="text-lg font-semibold text-gray-800 mb-4">Path Length Distribution</h3>
            <div class="space-y-3">
                <div
                    v-for="length in pathLengthDistribution"
                    :key="length.steps"
                    class="relative"
                >
                    <div class="flex items-center justify-between mb-1">
                        <span class="text-sm font-medium text-gray-700">{{ length.steps }} steps</span>
                        <span class="text-sm text-gray-600">
                            {{ length.count }} paths ({{ length.percentage.toFixed(1) }}%)
                        </span>
                    </div>
                    <div class="w-full bg-gray-200 rounded-full h-6">
                        <div
                            class="bg-blue-500 h-6 rounded-full transition-all duration-500 flex items-center justify-end pr-2"
                            :style="{ width: `${length.percentage}%` }"
                        >
                            <span v-if="length.percentage > 15" class="text-white font-medium text-xs">
                                ${{ length.revenue.toLocaleString('en-US', { minimumFractionDigits: 0 }) }}
                            </span>
                        </div>
                    </div>
                </div>
            </div>
        </div>

        <!-- Channel Frequency in Paths -->
        <div class="bg-white rounded-lg shadow p-6">
            <h3 class="text-lg font-semibold text-gray-800 mb-4">Most Common Channels in Paths</h3>
            <div class="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div
                    v-for="channel in channelFrequency"
                    :key="channel.name"
                    class="bg-gray-50 rounded-lg p-4 text-center"
                >
                    <p class="text-2xl font-bold text-blue-600">{{ channel.count }}</p>
                    <p class="text-sm font-medium text-gray-700 mt-1">{{ channel.name }}</p>
                    <p class="text-xs text-gray-500 mt-1">
                        {{ channel.percentage.toFixed(1) }}% of paths
                    </p>
                </div>
            </div>
        </div>

        <!-- Empty State -->
        <div v-if="paths.length === 0" class="text-center py-12 text-gray-500">
            <div class="text-6xl mb-4">🛤️</div>
            <p class="text-lg mb-2">No conversion paths available</p>
            <p class="text-sm">Start tracking events to see customer conversion journeys</p>
        </div>
    </div>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import type { IConversionPath } from '~/stores/attribution';

interface Props {
    paths: IConversionPath[];
}

const props = defineProps<Props>();

const pathLengthDistribution = computed(() => {
    const distribution = new Map<number, { count: number; revenue: number }>();
    
    props.paths.forEach(path => {
        const length = path.path.length;
        const current = distribution.get(length) || { count: 0, revenue: 0 };
        distribution.set(length, {
            count: current.count + path.conversions,
            revenue: current.revenue + path.revenue
        });
    });

    const totalPaths = Array.from(distribution.values()).reduce((sum, d) => sum + d.count, 0);

    return Array.from(distribution.entries())
        .map(([steps, data]) => ({
            steps,
            count: data.count,
            revenue: data.revenue,
            percentage: (data.count / totalPaths) * 100
        }))
        .sort((a, b) => a.steps - b.steps);
});

const channelFrequency = computed(() => {
    const frequency = new Map<string, number>();
    
    props.paths.forEach(path => {
        path.path.forEach(channel => {
            frequency.set(channel, (frequency.get(channel) || 0) + path.conversions);
        });
    });

    const total = Array.from(frequency.values()).reduce((sum, count) => sum + count, 0);

    return Array.from(frequency.entries())
        .map(([name, count]) => ({
            name,
            count,
            percentage: (count / total) * 100
        }))
        .sort((a, b) => b.count - a.count)
        .slice(0, 8); // Top 8 channels
});
</script>
