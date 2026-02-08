<template>
    <div class="space-y-6">
        <div v-for="(funnel, index) in funnels" :key="funnel.id" class="bg-white rounded-lg shadow border border-gray-200">
            <div class="px-6 py-4 border-b border-gray-200 flex items-center justify-between">
                <div>
                    <h3 class="text-lg font-semibold text-gray-800">{{ funnel.funnelName }}</h3>
                    <p class="text-sm text-gray-500 mt-1">
                        {{ funnel.totalEntered.toLocaleString() }} entered • 
                        {{ funnel.totalCompleted.toLocaleString() }} completed • 
                        {{ funnel.conversionRate?.toFixed(2) }}% conversion rate
                    </p>
                </div>
                <button
                    @click="emit('select', funnel)"
                    class="px-4 py-2 text-blue-600 bg-blue-50 rounded-lg hover:bg-blue-100 transition-colors duration-200"
                >
                    View Details
                </button>
            </div>
            <div class="p-6">
                <div class="relative">
                    <!-- Funnel Steps -->
                    <div class="space-y-4">
                        <div
                            v-for="(step, stepIndex) in funnel.stepCompletionRates"
                            :key="stepIndex"
                            class="relative"
                        >
                            <!-- Step Bar -->
                            <div class="flex items-center gap-4">
                                <div class="flex-shrink-0 w-8 h-8 bg-blue-600 text-white rounded-full flex items-center justify-center font-bold text-sm">
                                    {{ step.stepNumber }}
                                </div>
                                <div class="flex-1">
                                    <div class="flex items-center justify-between mb-2">
                                        <span class="font-medium text-gray-800">{{ step.stepName }}</span>
                                        <div class="flex items-center gap-4 text-sm">
                                            <span class="text-gray-600">
                                                {{ step.usersCompleted.toLocaleString() }} users
                                            </span>
                                            <span class="font-semibold" :class="getCompletionRateColor(step.completionRate)">
                                                {{ step.completionRate.toFixed(1) }}%
                                            </span>
                                        </div>
                                    </div>
                                    <div class="w-full bg-gray-200 rounded-full h-8 relative overflow-hidden">
                                        <div
                                            class="h-8 rounded-full transition-all duration-500 flex items-center justify-center text-white font-medium text-sm"
                                            :class="getBarColor(step.completionRate)"
                                            :style="{ width: `${(step.usersCompleted / funnel.totalEntered) * 100}%` }"
                                        >
                                            <span v-if="(step.usersCompleted / funnel.totalEntered) * 100 > 15">
                                                {{ ((step.usersCompleted / funnel.totalEntered) * 100).toFixed(1) }}%
                                            </span>
                                        </div>
                                    </div>
                                </div>
                            </div>

                            <!-- Drop-off Indicator -->
                            <div
                                v-if="stepIndex < funnel.stepCompletionRates.length - 1"
                                class="ml-16 mt-2 flex items-center gap-2 text-sm text-red-600"
                            >
                                <span>↓</span>
                                <span>{{ getDropOffInfo(funnel, stepIndex) }}</span>
                            </div>
                        </div>
                    </div>
                </div>

                <!-- Summary Stats -->
                <div class="mt-6 pt-6 border-t border-gray-200 grid grid-cols-3 gap-4">
                    <div class="text-center">
                        <p class="text-2xl font-bold text-gray-800">
                            {{ ((funnel.totalCompleted / funnel.totalEntered) * 100).toFixed(1) }}%
                        </p>
                        <p class="text-sm text-gray-600 mt-1">Overall Conversion</p>
                    </div>
                    <div class="text-center">
                        <p class="text-2xl font-bold text-gray-800">
                            {{ funnel.stepCompletionRates.length }}
                        </p>
                        <p class="text-sm text-gray-600 mt-1">Total Steps</p>
                    </div>
                    <div class="text-center">
                        <p class="text-2xl font-bold text-gray-800">
                            {{ Math.round(funnel.avgTimeToCompleteMinutes || 0) }}m
                        </p>
                        <p class="text-sm text-gray-600 mt-1">Avg Time to Complete</p>
                    </div>
                </div>
            </div>
        </div>

        <!-- Empty State -->
        <div v-if="funnels.length === 0" class="text-center py-12 text-gray-500">
            <div class="text-6xl mb-4">📊</div>
            <p class="text-lg mb-2">No funnels created yet</p>
            <p class="text-sm">Create a funnel to analyze your conversion paths</p>
        </div>
    </div>
</template>

<script setup lang="ts">
import type { IConversionFunnel } from '~/stores/attribution';

interface Props {
    funnels: IConversionFunnel[];
}

interface Emits {
    (e: 'select', funnel: IConversionFunnel): void;
}

const props = defineProps<Props>();
const emit = defineEmits<Emits>();

function getCompletionRateColor(rate: number): string {
    if (rate >= 70) return 'text-green-600';
    if (rate >= 40) return 'text-yellow-600';
    return 'text-red-600';
}

function getBarColor(rate: number): string {
    if (rate >= 70) return 'bg-green-600';
    if (rate >= 40) return 'bg-yellow-500';
    return 'bg-red-500';
}

function getDropOffInfo(funnel: IConversionFunnel, stepIndex: number): string {
    if (!funnel.dropOffAnalysis || stepIndex >= funnel.stepCompletionRates.length - 1) {
        return '';
    }

    const dropOff = funnel.dropOffAnalysis.find(
        d => d.fromStep === funnel.stepCompletionRates[stepIndex].stepNumber
    );

    if (dropOff) {
        return `${dropOff.dropOffCount.toLocaleString()} users dropped off (${dropOff.dropOffRate.toFixed(1)}%)`;
    }

    const current = funnel.stepCompletionRates[stepIndex];
    const next = funnel.stepCompletionRates[stepIndex + 1];
    const dropOffCount = current.usersCompleted - next.usersCompleted;
    const dropOffRate = (dropOffCount / current.usersCompleted) * 100;

    return `${dropOffCount.toLocaleString()} users dropped off (${dropOffRate.toFixed(1)}%)`;
}
</script>
