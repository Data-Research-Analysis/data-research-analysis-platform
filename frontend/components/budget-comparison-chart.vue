<script setup lang="ts">
interface Props {
    budgetTotal: number | null;
    digitalSpend?: number;
    offlineSpend: number;
}

const props = withDefaults(defineProps<Props>(), {
    digitalSpend: 0,
});

const budget = computed(() => Number(props.budgetTotal) || 0);
const digital = computed(() => Number(props.digitalSpend) || 0);
const offline = computed(() => Number(props.offlineSpend) || 0);
const totalSpend = computed(() => digital.value + offline.value);
const remaining = computed(() => Math.max(budget.value - totalSpend.value, 0));

// Percentages for bar segments (guard against zero budget)
const digitalPct = computed(() => budget.value > 0 ? Math.min((digital.value / budget.value) * 100, 100) : 0);
const offlinePct = computed(() => budget.value > 0 ? Math.min((offline.value / budget.value) * 100, 100 - digitalPct.value) : 0);
const remainingPct = computed(() => Math.max(100 - digitalPct.value - offlinePct.value, 0));

const spentPct = computed(() => budget.value > 0 ? Math.min((totalSpend.value / budget.value) * 100, 100) : 0);

function formatCurrency(val: number): string {
    if (val >= 1_000_000) return `$${(val / 1_000_000).toFixed(1)}M`;
    if (val >= 1_000) return `$${(val / 1_000).toFixed(0)}k`;
    return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(val);
}
</script>

<template>
    <div class="bg-white rounded-xl border border-gray-200 p-5">
        <h3 class="text-sm font-semibold text-gray-700 mb-4 flex items-center gap-2">
            <font-awesome-icon :icon="['fas', 'chart-bar']" class="text-primary-blue-100" />
            Budget vs Spend
        </h3>

        <!-- No budget set -->
        <div v-if="!budgetTotal" class="flex flex-col items-center justify-center py-8 text-center">
            <font-awesome-icon :icon="['fas', 'circle-info']" class="text-2xl text-gray-300 mb-2" />
            <p class="text-xs text-gray-400">No budget set for this campaign</p>
        </div>

        <template v-else>
            <!-- Budget headline -->
            <div class="flex items-baseline gap-2 mb-3">
                <span class="text-2xl font-bold text-gray-900">{{ formatCurrency(totalSpend) }}</span>
                <span class="text-sm text-gray-400">of {{ formatCurrency(budget) }} budget</span>
                <span class="ml-auto text-xs font-medium px-2 py-0.5 rounded-full"
                    :class="spentPct >= 100 ? 'bg-red-100 text-red-700' : 'bg-blue-50 text-blue-600'">
                    {{ spentPct.toFixed(0) }}% spent
                </span>
            </div>

            <!-- Stacked bar -->
            <div class="w-full h-5 rounded-full overflow-hidden flex bg-gray-100 mb-4">
                <!-- Digital segment -->
                <div
                    v-if="digitalPct > 0"
                    class="h-full bg-blue-500 transition-all"
                    :style="{ width: digitalPct + '%' }"
                    :title="`Digital: ${formatCurrency(digital)}`"
                ></div>
                <!-- Offline segment -->
                <div
                    v-if="offlinePct > 0"
                    class="h-full bg-orange-400 transition-all"
                    :style="{ width: offlinePct + '%' }"
                    :title="`Offline: ${formatCurrency(offline)}`"
                ></div>
                <!-- Remaining segment -->
                <div
                    v-if="remainingPct > 0"
                    class="h-full bg-gray-100 transition-all"
                    :style="{ width: remainingPct + '%' }"
                ></div>
            </div>

            <!-- Legend -->
            <div class="flex flex-wrap gap-x-4 gap-y-1.5">
                <div class="flex items-center gap-1.5 text-xs text-gray-600">
                    <span class="w-3 h-3 rounded-sm bg-blue-500 inline-block"></span>
                    Digital <span class="font-medium text-gray-400">({{ formatCurrency(digital) }})</span>
                </div>
                <div class="flex items-center gap-1.5 text-xs text-gray-600">
                    <span class="w-3 h-3 rounded-sm bg-orange-400 inline-block"></span>
                    Offline <span class="font-medium text-gray-400">({{ formatCurrency(offline) }})</span>
                </div>
                <div class="flex items-center gap-1.5 text-xs text-gray-600">
                    <span class="w-3 h-3 rounded-sm bg-gray-200 inline-block border border-gray-300"></span>
                    Remaining <span class="font-medium text-gray-400">({{ formatCurrency(remaining) }})</span>
                </div>
            </div>
        </template>
    </div>
</template>
