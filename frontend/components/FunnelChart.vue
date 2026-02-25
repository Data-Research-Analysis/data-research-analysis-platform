<script setup lang="ts">
import type { IConversionFunnel } from '@/stores/attribution';

const props = defineProps<{
    funnel: IConversionFunnel | null;
    loading?: boolean;
    ga4Sessions?: number | null;
}>();

function barWidth(usersEntered: number): number {
    if (!props.funnel || props.funnel.totalEntered === 0) return 0;
    return Math.max(4, (usersEntered / props.funnel.totalEntered) * 100);
}

function dropOffBetween(fromStepNumber: number): number | null {
    if (!props.funnel) return null;
    const point = props.funnel.dropOffAnalysis.find((d) => d.fromStep === fromStepNumber);
    return point ? Math.round(point.dropOffRate * 100) / 100 : null;
}

const completionRates = computed(() => props.funnel?.stepCompletionRates ?? []);
</script>

<template>
    <!-- Loading skeleton -->
    <div v-if="loading" class="space-y-4 animate-pulse">
        <div class="h-6 bg-gray-200 rounded w-1/3"></div>
        <div v-for="i in 4" :key="i" class="space-y-2">
            <div class="h-4 bg-gray-100 rounded w-1/4"></div>
            <div class="h-10 bg-gray-200 rounded" :style="{ width: `${90 - i * 15}%` }"></div>
        </div>
    </div>

    <!-- Empty state -->
    <div v-else-if="!funnel" class="py-16 text-center text-gray-400">
        <font-awesome-icon :icon="['fas', 'filter']" class="text-4xl mb-3 text-gray-300" />
        <p class="text-sm font-medium text-gray-500">No funnel data available</p>
        <p class="text-xs mt-1">Configure and run a funnel analysis to see results here.</p>
    </div>

    <!-- Funnel visualisation -->
    <div v-else class="space-y-1">
        <!-- Summary header -->
        <div class="flex items-center justify-between mb-4">
            <h3 class="text-base font-semibold text-gray-800">{{ funnel.funnelName }}</h3>
            <div class="flex items-center gap-4 text-sm text-gray-500">
                <span>
                    <span class="font-semibold text-gray-800">{{ funnel.totalEntered.toLocaleString() }}</span> entered
                </span>
                <span>
                    <span class="font-semibold text-green-600">{{ funnel.totalCompleted.toLocaleString() }}</span> converted
                </span>
                <span class="px-2.5 py-0.5 bg-green-50 text-green-700 text-xs rounded-full font-medium border border-green-100">
                    {{ funnel.conversionRate != null ? funnel.conversionRate.toFixed(1) : '—' }}% overall
                </span>
            </div>
        </div>

        <!-- GA4 Web Sessions top-of-funnel row -->
        <div v-if="ga4Sessions != null" class="mb-3">
            <div class="flex items-center gap-3">
                <div class="w-7 h-7 rounded-full bg-green-500 text-white flex items-center justify-center text-xs font-bold flex-shrink-0">
                    <font-awesome-icon :icon="['fab', 'google']" />
                </div>
                <div class="flex-1 min-w-0">
                    <div class="flex items-center justify-between mb-1">
                        <span class="text-sm font-medium text-gray-700">Web Sessions <span class="text-xs font-normal text-green-600 ml-1">(GA4)</span></span>
                        <span class="text-xs text-gray-500">{{ ga4Sessions.toLocaleString() }} sessions</span>
                    </div>
                    <div class="h-9 bg-gray-100 rounded-lg overflow-hidden">
                        <div class="h-full bg-gradient-to-r from-green-400 to-green-500 rounded-lg flex items-center px-3" style="width: 100%">
                            <span class="text-xs font-semibold text-white">{{ ga4Sessions.toLocaleString() }}</span>
                        </div>
                    </div>
                </div>
            </div>
            <!-- Arrow to first funnel step -->
            <div class="ml-10 flex items-center gap-2 py-1">
                <div class="w-px h-5 bg-gray-300 ml-3"></div>
                <div class="flex items-center gap-1.5 bg-gray-50 border border-gray-200 rounded-full px-2.5 py-0.5">
                    <font-awesome-icon :icon="['fas', 'arrow-down']" class="text-gray-400 text-xs" />
                    <span class="text-xs text-gray-500 font-medium">into funnel</span>
                </div>
            </div>
        </div>

        <template v-for="(step, idx) in completionRates" :key="step.stepNumber">
            <!-- Step bar -->
            <div class="flex items-center gap-3">
                <!-- Step number badge -->
                <div class="w-7 h-7 rounded-full bg-primary-blue-100 text-white flex items-center justify-center text-xs font-bold flex-shrink-0">
                    {{ step.stepNumber }}
                </div>

                <div class="flex-1 min-w-0">
                    <div class="flex items-center justify-between mb-1">
                        <span class="text-sm font-medium text-gray-700 truncate">{{ step.stepName }}</span>
                        <span class="text-xs text-gray-500 ml-2 flex-shrink-0">
                            {{ step.usersEntered.toLocaleString() }} users
                            <span class="ml-2 text-green-600 font-medium">{{ step.completionRate.toFixed(1) }}%</span>
                        </span>
                    </div>
                    <div class="h-9 bg-gray-100 rounded-lg overflow-hidden">
                        <div
                            class="h-full bg-gradient-to-r from-primary-blue-100 to-blue-400 rounded-lg transition-all duration-500 flex items-center px-3"
                            :style="{ width: `${barWidth(step.usersEntered)}%` }"
                        >
                            <span v-if="barWidth(step.usersEntered) > 25" class="text-xs font-semibold text-white">
                                {{ step.usersEntered.toLocaleString() }}
                            </span>
                        </div>
                    </div>
                </div>
            </div>

            <!-- Drop-off arrow between steps -->
            <div
                v-if="idx < completionRates.length - 1"
                class="ml-10 flex items-center gap-2 py-1"
            >
                <div class="w-px h-5 bg-gray-300 ml-3"></div>
                <div class="flex items-center gap-1.5 bg-red-50 border border-red-100 rounded-full px-2.5 py-0.5">
                    <font-awesome-icon :icon="['fas', 'arrow-down']" class="text-red-400 text-xs" />
                    <span class="text-xs text-red-600 font-medium">
                        {{ dropOffBetween(step.stepNumber) != null ? `${dropOffBetween(step.stepNumber)}% drop-off` : `${step.dropOffRate.toFixed(1)}% drop-off` }}
                    </span>
                    <span class="text-xs text-red-400">
                        ({{ (step.usersEntered - (completionRates[idx + 1]?.usersEntered ?? 0)).toLocaleString() }} exited)
                    </span>
                </div>
            </div>
        </template>

        <!-- Avg time -->
        <div v-if="funnel.avgTimeToCompleteMinutes != null" class="mt-4 text-xs text-gray-400 text-right">
            Avg. completion time: <span class="font-medium text-gray-600">{{ funnel.avgTimeToCompleteMinutes.toFixed(0) }} min</span>
        </div>
    </div>
</template>
