<script setup lang="ts">
/**
 * BudgetAllocationChart — Horizontal stacked bars comparing current vs
 * recommended budget allocation per channel.
 *
 * Displays each channel as a row with two horizontal bars (current blue,
 * recommended emerald) and the delta badge between them.
 */

interface AllocationRow {
    channel: string;
    current_spend: number;
    recommended_spend: number;
    efficiency_score: number;
    change_from_current: number;
    change_percent: number;
}

interface Props {
    rows: AllocationRow[];
    isLoading?: boolean;
}

const props = withDefaults(defineProps<Props>(), {
    isLoading: false,
});

const maxSpend = computed(() => {
    if (props.rows.length === 0) return 1;
    return Math.max(
        ...props.rows.map(r => Math.max(r.current_spend, r.recommended_spend)),
        1,
    );
});

function barWidth(value: number): string {
    return `${(value / maxSpend.value) * 100}%`;
}

function formatCurrency(value: number): string {
    if (Math.abs(value) >= 1_000_000) return `$${(value / 1_000_000).toFixed(1)}M`;
    if (Math.abs(value) >= 1_000) return `$${(value / 1_000).toFixed(1)}K`;
    return `$${value.toFixed(0)}`;
}

function formatSignedPercent(value: number): string {
    const sign = value >= 0 ? '+' : '';
    return `${sign}${value.toFixed(1)}%`;
}

function efficiencyColor(score: number): string {
    if (score >= 80) return 'bg-emerald-500';
    if (score >= 50) return 'bg-amber-500';
    return 'bg-red-500';
}

function changeClass(value: number): string {
    if (value > 0) return 'text-emerald-700 bg-emerald-50';
    if (value < 0) return 'text-red-700 bg-red-50';
    return 'text-gray-500 bg-gray-50';
}
</script>

<template>
    <div class="space-y-1">
        <!-- Loading skeleton -->
        <template v-if="isLoading">
            <div v-for="i in 4" :key="i" class="flex items-center gap-3 py-2.5">
                <div class="w-24 h-3 rounded bg-gray-100 animate-pulse" />
                <div class="flex-1 h-6 rounded bg-gray-50 animate-pulse" />
                <div class="w-16 h-5 rounded-full bg-gray-100 animate-pulse" />
            </div>
        </template>

        <!-- Empty state -->
        <div
            v-else-if="rows.length === 0"
            class="py-8 text-center text-sm text-gray-400"
        >
            No allocation data available.
        </div>

        <!-- Column headers -->
        <div v-else class="flex items-center gap-3 pb-2 border-b border-gray-100 text-[10px] font-medium text-gray-400 uppercase tracking-wider">
            <div class="w-28 flex-shrink-0">Channel</div>
            <div class="flex-1">Allocation</div>
            <div class="w-20 text-right flex-shrink-0">Efficiency</div>
            <div class="w-20 text-right flex-shrink-0">Change</div>
        </div>

        <!-- Rows -->
        <div
            v-for="row in rows"
            :key="row.channel"
            class="flex items-center gap-3 py-2.5 border-b border-gray-50 hover:bg-gray-50/50 transition-colors"
        >
            <!-- Channel name -->
            <div class="w-28 flex-shrink-0">
                <span class="text-sm font-medium text-gray-800 truncate block">
                    {{ row.channel }}
                </span>
            </div>

            <!-- Dual bar -->
            <div class="flex-1 space-y-1">
                <!-- Current -->
                <div class="flex items-center gap-2">
                    <span class="text-[9px] text-gray-400 w-8 flex-shrink-0">Now</span>
                    <div class="flex-1 h-3 bg-gray-100 rounded-full overflow-hidden">
                        <div
                            class="h-full rounded-full bg-blue-400 transition-all duration-500"
                            :style="{ width: barWidth(row.current_spend) }"
                        />
                    </div>
                    <span class="text-[10px] text-gray-500 w-14 text-right flex-shrink-0">
                        {{ formatCurrency(row.current_spend) }}
                    </span>
                </div>
                <!-- Recommended -->
                <div class="flex items-center gap-2">
                    <span class="text-[9px] text-gray-400 w-8 flex-shrink-0">Rec</span>
                    <div class="flex-1 h-3 bg-gray-100 rounded-full overflow-hidden">
                        <div
                            class="h-full rounded-full bg-emerald-400 transition-all duration-500"
                            :style="{ width: barWidth(row.recommended_spend) }"
                        />
                    </div>
                    <span class="text-[10px] text-gray-500 w-14 text-right flex-shrink-0">
                        {{ formatCurrency(row.recommended_spend) }}
                    </span>
                </div>
            </div>

            <!-- Efficiency badge -->
            <div class="w-20 flex-shrink-0 flex justify-end">
                <div class="flex items-center gap-1.5">
                    <div class="w-12 h-1.5 bg-gray-200 rounded-full overflow-hidden">
                        <div
                            class="h-full rounded-full transition-all duration-500"
                            :class="efficiencyColor(row.efficiency_score)"
                            :style="{ width: `${row.efficiency_score}%` }"
                        />
                    </div>
                    <span class="text-[10px] font-medium text-gray-600">
                        {{ row.efficiency_score.toFixed(0) }}
                    </span>
                </div>
            </div>

            <!-- Change badge -->
            <div class="w-20 flex-shrink-0 flex justify-end">
                <span
                    class="inline-flex items-center text-[10px] font-semibold px-2 py-0.5 rounded-full"
                    :class="changeClass(row.change_from_current)"
                >
                    {{ formatSignedPercent(row.change_percent) }}
                </span>
            </div>
        </div>

        <!-- Legend -->
        <div class="flex items-center gap-4 pt-2 text-[10px] text-gray-400">
            <span class="flex items-center gap-1.5">
                <span class="w-2.5 h-2.5 rounded-full bg-blue-400" />
                Current Spend
            </span>
            <span class="flex items-center gap-1.5">
                <span class="w-2.5 h-2.5 rounded-full bg-emerald-400" />
                Recommended Spend
            </span>
        </div>
    </div>
</template>