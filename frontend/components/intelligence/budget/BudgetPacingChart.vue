<script setup lang="ts">
/**
 * BudgetPacingChart — Daily budget pacing visualization.
 *
 * Renders a simple bar chart comparing actual vs recommended daily spend
 * with color-coded status indicators (on_track/emerald, overspend/amber,
 * underspend/blue). Includes an area chart overlay showing variance %.
 */

interface PacingDay {
    date: string;
    actual_spend: number;
    recommended_spend: number;
    variance: number;
    variance_percent: number;
    status: 'on_track' | 'overspend' | 'underspend';
}

interface Props {
    pacingData: PacingDay[];
    isLoading?: boolean;
}

const props = withDefaults(defineProps<Props>(), {
    isLoading: false,
});

const maxSpend = computed(() => {
    if (props.pacingData.length === 0) return 1;
    return Math.max(
        ...props.pacingData.map(d => Math.max(d.actual_spend, d.recommended_spend)),
        1,
    );
});

function barHeight(value: number): string {
    return `${(value / maxSpend.value) * 100}%`;
}

function statusColor(status: string): string {
    switch (status) {
        case 'on_track': return 'bg-emerald-400';
        case 'overspend': return 'bg-amber-400';
        case 'underspend': return 'bg-blue-400';
        default: return 'bg-gray-300';
    }
}

function statusText(status: string): string {
    switch (status) {
        case 'on_track': return 'On Track';
        case 'overspend': return 'Overspend';
        case 'underspend': return 'Underspend';
        default: return status;
    }
}

function statusBadgeClass(status: string): string {
    switch (status) {
        case 'on_track': return 'text-emerald-700 bg-emerald-50';
        case 'overspend': return 'text-amber-700 bg-amber-50';
        case 'underspend': return 'text-blue-700 bg-blue-50';
        default: return 'text-gray-500 bg-gray-50';
    }
}

function formatCurrency(value: number): string {
    if (Math.abs(value) >= 1_000_000) return `$${(value / 1_000_000).toFixed(1)}M`;
    if (Math.abs(value) >= 1_000) return `$${(value / 1_000).toFixed(1)}K`;
    return `$${value.toFixed(0)}`;
}

function formatDate(dateStr: string): string {
    const d = new Date(dateStr);
    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

/** Summary counts */
const statusSummary = computed(() => {
    const counts = { on_track: 0, overspend: 0, underspend: 0 };
    for (const d of props.pacingData) {
        counts[d.status as keyof typeof counts] = (counts[d.status as keyof typeof counts] || 0) + 1;
    }
    return counts;
});
</script>

<template>
    <div>
        <!-- Loading skeleton -->
        <template v-if="isLoading">
            <div class="flex items-end gap-1 h-40">
                <div
                    v-for="i in 14"
                    :key="i"
                    class="flex-1 rounded-t bg-gray-100 animate-pulse"
                    :style="{ height: `${30 + Math.random() * 60}%` }"
                />
            </div>
        </template>

        <!-- Empty state -->
        <div
            v-else-if="pacingData.length === 0"
            class="py-8 text-center text-sm text-gray-400"
        >
            No pacing data available.
        </div>

        <!-- Chart -->
        <template v-else>
            <!-- Status summary chips -->
            <div class="flex items-center gap-3 mb-4">
                <span
                    v-if="statusSummary.on_track > 0"
                    class="inline-flex items-center gap-1 text-[10px] font-semibold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full"
                >
                    <span class="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                    {{ statusSummary.on_track }} On Track
                </span>
                <span
                    v-if="statusSummary.overspend > 0"
                    class="inline-flex items-center gap-1 text-[10px] font-semibold text-amber-700 bg-amber-50 px-2 py-0.5 rounded-full"
                >
                    <span class="w-1.5 h-1.5 rounded-full bg-amber-500" />
                    {{ statusSummary.overspend }} Overspend
                </span>
                <span
                    v-if="statusSummary.underspend > 0"
                    class="inline-flex items-center gap-1 text-[10px] font-semibold text-blue-700 bg-blue-50 px-2 py-0.5 rounded-full"
                >
                    <span class="w-1.5 h-1.5 rounded-full bg-blue-500" />
                    {{ statusSummary.underspend }} Underspend
                </span>
            </div>

            <!-- Bar chart area -->
            <div class="relative">
                <!-- Y-axis grid lines -->
                <div class="absolute inset-0 flex flex-col justify-between pointer-events-none">
                    <div v-for="i in 4" :key="i" class="border-b border-gray-100 w-full" style="height: 25%;" />
                </div>

                <!-- Bars container -->
                <div class="relative flex items-end gap-px h-40 overflow-x-auto pb-6">
                    <div
                        v-for="day in pacingData"
                        :key="day.date"
                        class="flex-1 min-w-[16px] flex flex-col items-center group relative"
                    >
                        <!-- Bars -->
                        <div class="flex items-end gap-px w-full h-32">
                            <!-- Actual spend bar -->
                            <div
                                class="flex-1 rounded-t-sm transition-all duration-300"
                                :class="statusColor(day.status)"
                                :style="{ height: barHeight(day.actual_spend) }"
                            />
                            <!-- Recommended spend bar (outline) -->
                            <div
                                class="flex-1 rounded-t-sm border border-dashed border-gray-300 bg-gray-50/50 transition-all duration-300"
                                :style="{ height: barHeight(day.recommended_spend) }"
                            />
                        </div>

                        <!-- Date label -->
                        <span class="absolute bottom-0 left-1/2 -translate-x-1/2 text-[8px] text-gray-400 whitespace-nowrap">
                            {{ formatDate(day.date) }}
                        </span>

                        <!-- Hover tooltip -->
                        <div class="absolute bottom-full mb-2 left-1/2 -translate-x-1/2 hidden group-hover:block z-10">
                            <div class="bg-gray-900 text-white text-[10px] rounded-lg px-3 py-2 shadow-lg whitespace-nowrap">
                                <div class="font-semibold mb-1">{{ formatDate(day.date) }}</div>
                                <div class="flex justify-between gap-3">
                                    <span class="text-gray-300">Actual:</span>
                                    <span>{{ formatCurrency(day.actual_spend) }}</span>
                                </div>
                                <div class="flex justify-between gap-3">
                                    <span class="text-gray-300">Target:</span>
                                    <span>{{ formatCurrency(day.recommended_spend) }}</span>
                                </div>
                                <div class="flex justify-between gap-3 mt-1 pt-1 border-t border-gray-700">
                                    <span class="text-gray-300">Variance:</span>
                                    <span
                                        :class="{
                                            'text-emerald-400': day.status === 'on_track',
                                            'text-amber-400': day.status === 'overspend',
                                            'text-blue-400': day.status === 'underspend',
                                        }"
                                    >
                                        {{ day.variance_percent >= 0 ? '+' : '' }}{{ day.variance_percent.toFixed(1) }}%
                                    </span>
                                </div>
                                <span
                                    class="inline-block mt-1 text-[9px] px-1.5 py-0.5 rounded-full"
                                    :class="statusBadgeClass(day.status)"
                                >
                                    {{ statusText(day.status) }}
                                </span>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            <!-- Legend -->
            <div class="flex items-center gap-4 pt-3 mt-2 border-t border-gray-100 text-[10px] text-gray-400">
                <span class="flex items-center gap-1.5">
                    <span class="w-3 h-2 rounded-sm bg-emerald-400" />
                    On Track
                </span>
                <span class="flex items-center gap-1.5">
                    <span class="w-3 h-2 rounded-sm bg-amber-400" />
                    Overspend
                </span>
                <span class="flex items-center gap-1.5">
                    <span class="w-3 h-2 rounded-sm bg-blue-400" />
                    Underspend
                </span>
                <span class="flex items-center gap-1.5">
                    <span class="w-3 h-2 rounded-sm border border-dashed border-gray-300 bg-gray-50" />
                    Recommended Target
                </span>
            </div>
        </template>
    </div>
</template>