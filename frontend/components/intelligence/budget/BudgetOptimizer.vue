<script setup lang="ts">
/**
 * BudgetOptimizer — Main container for the AI-powered Budget Allocation
 * Optimizer (CMP-005).
 *
 * Provides the user controls (budget input, optimization goal, AI toggle),
 * and composes BudgetAllocationChart and BudgetPacingChart with estimated
 * impact summary and AI explanation sections.
 */

import { useBudgetOptimization } from '@/composables/useBudgetOptimization';

interface Props {
    projectId?: number | null;
    dataModelId?: number | null;
    startDate: string | null;
    endDate: string | null;
}

const props = defineProps<Props>();

const {
    isLoading,
    hasFetched,
    hasData,
    error,
    totalBudget,
    optimizationGoal,
    includeAI,
    allocationRows,
    estimatedImpact,
    aiExplanation,
    reasoning,
    dailyPacing,
    constraintsApplied,
    currentTotals,
    recommendedTotals,
    fetch,
    formatCurrency,
    formatNumber,
    formatRatio,
    formatSignedPercent,
} = useBudgetOptimization({
    projectId: toRef(props, 'projectId'),
    dataModelId: toRef(props, 'dataModelId'),
    startDate: toRef(props, 'startDate'),
    endDate: toRef(props, 'endDate'),
});

/** Active sub-tab */
const activeTab = ref<'allocation' | 'pacing'>('allocation');

/** Goal options for select */
const goalOptions = [
    { value: 'maximize_roas', label: 'Maximize ROAS', icon: 'arrow-trend-up' },
    { value: 'maximize_conversions', label: 'Maximize Conversions', icon: 'bullseye' },
    { value: 'minimize_cpa', label: 'Minimize CPA', icon: 'arrow-down' },
] as const;

/** Format budget input with commas as user types */
function formatBudgetInput(e: Event) {
    const raw = (e.target as HTMLInputElement).value.replace(/[^0-9]/g, '');
    const num = parseInt(raw, 10);
    if (!isNaN(num) && num >= 0) {
        totalBudget.value = num;
    }
}

function handleOptimize() {
    fetch();
}
</script>

<template>
    <div class="space-y-6">
        <!-- Header & Controls Panel -->
        <div class="bg-white rounded-xl border border-gray-200 p-5">
            <div class="flex flex-col lg:flex-row lg:items-end gap-4">
                <!-- Budget input -->
                <div class="flex-1 min-w-0">
                    <label class="block text-[11px] font-medium text-gray-500 uppercase tracking-wider mb-1.5">
                        Total Budget
                    </label>
                    <div class="relative">
                        <span class="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm font-medium">$</span>
                        <input
                            type="text"
                            :value="totalBudget.toLocaleString()"
                            class="w-full pl-7 pr-3 py-2.5 border border-gray-200 rounded-lg text-sm font-semibold text-gray-900 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-shadow"
                            @input="formatBudgetInput"
                        />
                    </div>
                </div>

                <!-- Optimization goal -->
                <div class="flex-1 min-w-0">
                    <label class="block text-[11px] font-medium text-gray-500 uppercase tracking-wider mb-1.5">
                        Optimization Goal
                    </label>
                    <select
                        v-model="optimizationGoal"
                        class="w-full py-2.5 px-3 border border-gray-200 rounded-lg text-sm font-medium text-gray-700 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-shadow bg-white"
                    >
                        <option
                            v-for="opt in goalOptions"
                            :key="opt.value"
                            :value="opt.value"
                        >
                            {{ opt.label }}
                        </option>
                    </select>
                </div>

                <!-- AI toggle -->
                <div class="flex items-center gap-2 pb-0.5">
                    <label class="relative inline-flex items-center cursor-pointer">
                        <input
                            v-model="includeAI"
                            type="checkbox"
                            class="sr-only peer"
                        />
                        <div class="w-9 h-5 bg-gray-200 peer-focus:outline-none peer-focus:ring-2 peer-focus:ring-blue-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-blue-600" />
                    </label>
                    <span class="text-xs text-gray-600">
                        <font-awesome-icon :icon="['fas', 'wand-magic-sparkles']" class="text-purple-500 mr-0.5" />
                        AI Explanation
                    </span>
                </div>

                <!-- Optimize button -->
                <button
                    class="inline-flex items-center justify-center gap-2 px-5 py-2.5 bg-blue-600 hover:bg-blue-700 active:bg-blue-800 text-white text-sm font-semibold rounded-lg transition-colors shadow-sm disabled:opacity-50 disabled:cursor-not-allowed hover:cursor-pointer"
                    :disabled="isLoading || (!props.projectId && !props.dataModelId)"
                    @click="handleOptimize"
                >
                    <font-awesome-icon
                        v-if="isLoading"
                        :icon="['fas', 'spinner']"
                        class="animate-spin"
                    />
                    <font-awesome-icon
                        v-else
                        :icon="['fas', 'wand-magic-sparkles']"
                    />
                    {{ isLoading ? 'Optimizing...' : 'Optimize' }}
                </button>
            </div>

            <!-- Error banner -->
            <div
                v-if="error"
                class="mt-3 flex items-center gap-2 px-3 py-2 bg-red-50 border border-red-200 rounded-lg text-xs text-red-700"
            >
                <font-awesome-icon :icon="['fas', 'triangle-exclamation']" />
                {{ error }}
            </div>
        </div>

        <!-- Results (only shown after first fetch) -->
        <template v-if="hasFetched && !isLoading">
            <!-- No data state -->
            <div
                v-if="!hasData"
                class="bg-white rounded-xl border border-gray-200 p-12 text-center"
            >
                <font-awesome-icon :icon="['fas', 'chart-pie']" class="text-4xl text-gray-200 mb-3" />
                <p class="text-sm text-gray-500">No optimization data available for the selected period.</p>
                <p class="text-xs text-gray-400 mt-1">Try adjusting the date range or budget amount.</p>
            </div>

            <!-- Has data -->
            <template v-else>
                <!-- Estimated Impact Summary Cards -->
                <div v-if="estimatedImpact" class="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <!-- Additional Conversions -->
                    <div class="bg-white rounded-xl border border-gray-200 p-4">
                        <div class="flex items-center gap-2 mb-2">
                            <div class="w-7 h-7 rounded-lg bg-emerald-50 flex items-center justify-center">
                                <font-awesome-icon :icon="['fas', 'arrow-up']" class="text-emerald-600 text-xs" />
                            </div>
                            <span class="text-[11px] font-medium text-gray-500 uppercase tracking-wide">Est. Additional Conversions</span>
                        </div>
                        <div class="text-2xl font-bold text-gray-900">
                            +{{ formatNumber(estimatedImpact.additional_conversions) }}
                        </div>
                    </div>

                    <!-- CPA Change -->
                    <div class="bg-white rounded-xl border border-gray-200 p-4">
                        <div class="flex items-center gap-2 mb-2">
                            <div class="w-7 h-7 rounded-lg bg-blue-50 flex items-center justify-center">
                                <font-awesome-icon :icon="['fas', 'arrow-down']" class="text-blue-600 text-xs" />
                            </div>
                            <span class="text-[11px] font-medium text-gray-500 uppercase tracking-wide">CPA Change</span>
                        </div>
                        <div
                            class="text-2xl font-bold"
                            :class="estimatedImpact.cpa_change <= 0 ? 'text-emerald-600' : 'text-red-600'"
                        >
                            {{ formatSignedPercent(estimatedImpact.cpa_change) }}
                        </div>
                    </div>

                    <!-- ROAS Change -->
                    <div class="bg-white rounded-xl border border-gray-200 p-4">
                        <div class="flex items-center gap-2 mb-2">
                            <div class="w-7 h-7 rounded-lg bg-purple-50 flex items-center justify-center">
                                <font-awesome-icon :icon="['fas', 'arrow-trend-up']" class="text-purple-600 text-xs" />
                            </div>
                            <span class="text-[11px] font-medium text-gray-500 uppercase tracking-wide">ROAS Change</span>
                        </div>
                        <div
                            class="text-2xl font-bold"
                            :class="estimatedImpact.roas_change >= 0 ? 'text-emerald-600' : 'text-red-600'"
                        >
                            {{ formatSignedPercent(estimatedImpact.roas_change) }}
                        </div>
                    </div>
                </div>

                <!-- Current vs Recommended Totals -->
                <div class="bg-white rounded-xl border border-gray-200 p-5">
                    <h3 class="text-sm font-semibold text-gray-800 mb-4">
                        <font-awesome-icon :icon="['fas', 'scale-balanced']" class="text-gray-400 mr-1.5" />
                        Current vs Recommended Summary
                    </h3>
                    <div class="grid grid-cols-2 md:grid-cols-4 gap-4">
                        <div>
                            <span class="text-[10px] text-gray-400 uppercase tracking-wider">Total Spend</span>
                            <div class="flex items-baseline gap-2 mt-0.5">
                                <span class="text-sm font-semibold text-gray-700">{{ formatCurrency(currentTotals.spend) }}</span>
                                <font-awesome-icon :icon="['fas', 'arrow-right']" class="text-[9px] text-gray-300" />
                                <span class="text-sm font-semibold text-emerald-600">{{ formatCurrency(recommendedTotals.spend) }}</span>
                            </div>
                        </div>
                        <div>
                            <span class="text-[10px] text-gray-400 uppercase tracking-wider">Conversions</span>
                            <div class="flex items-baseline gap-2 mt-0.5">
                                <span class="text-sm font-semibold text-gray-700">{{ formatNumber(currentTotals.conversions) }}</span>
                                <font-awesome-icon :icon="['fas', 'arrow-right']" class="text-[9px] text-gray-300" />
                                <span class="text-sm font-semibold text-emerald-600">{{ formatNumber(recommendedTotals.conversions) }}</span>
                            </div>
                        </div>
                        <div>
                            <span class="text-[10px] text-gray-400 uppercase tracking-wider">Avg CPA</span>
                            <div class="flex items-baseline gap-2 mt-0.5">
                                <span class="text-sm font-semibold text-gray-700">{{ formatCurrency(currentTotals.cpa) }}</span>
                                <font-awesome-icon :icon="['fas', 'arrow-right']" class="text-[9px] text-gray-300" />
                                <span
                                    class="text-sm font-semibold"
                                    :class="recommendedTotals.cpa <= currentTotals.cpa ? 'text-emerald-600' : 'text-red-600'"
                                >
                                    {{ formatCurrency(recommendedTotals.cpa) }}
                                </span>
                            </div>
                        </div>
                        <div>
                            <span class="text-[10px] text-gray-400 uppercase tracking-wider">Avg ROAS</span>
                            <div class="flex items-baseline gap-2 mt-0.5">
                                <span class="text-sm font-semibold text-gray-700">{{ formatRatio(currentTotals.roas) }}</span>
                                <font-awesome-icon :icon="['fas', 'arrow-right']" class="text-[9px] text-gray-300" />
                                <span
                                    class="text-sm font-semibold"
                                    :class="recommendedTotals.roas >= currentTotals.roas ? 'text-emerald-600' : 'text-red-600'"
                                >
                                    {{ formatRatio(recommendedTotals.roas) }}
                                </span>
                            </div>
                        </div>
                    </div>
                </div>

                <!-- Shift Summary / Reasoning -->
                <div
                    v-if="estimatedImpact?.shift_summary || reasoning"
                    class="bg-white rounded-xl border border-gray-200 p-5"
                >
                    <h3 class="text-sm font-semibold text-gray-800 mb-2">
                        <font-awesome-icon :icon="['fas', 'lightbulb']" class="text-amber-400 mr-1.5" />
                        Optimization Insight
                    </h3>
                    <p class="text-sm text-gray-600 leading-relaxed">
                        {{ estimatedImpact?.shift_summary || reasoning }}
                    </p>

                    <!-- Constraints applied -->
                    <div
                        v-if="constraintsApplied.length > 0"
                        class="mt-3 pt-3 border-t border-gray-100"
                    >
                        <span class="text-[10px] text-gray-400 uppercase tracking-wider block mb-1.5">Constraints Applied</span>
                        <div class="flex flex-wrap gap-1.5">
                            <span
                                v-for="(constraint, i) in constraintsApplied"
                                :key="i"
                                class="inline-flex items-center text-[10px] text-gray-500 bg-gray-50 border border-gray-100 px-2 py-0.5 rounded-full"
                            >
                                {{ constraint }}
                            </span>
                        </div>
                    </div>
                </div>

                <!-- Tab switcher for Allocation / Pacing -->
                <div class="bg-white rounded-xl border border-gray-200 overflow-hidden">
                    <!-- Tab headers -->
                    <div class="flex border-b border-gray-100">
                        <button
                            class="flex-1 px-4 py-3 text-xs font-semibold transition-colors border-b-2"
                            :class="activeTab === 'allocation'
                                ? 'text-blue-600 border-blue-600 bg-blue-50/30'
                                : 'text-gray-500 border-transparent hover:text-gray-700 hover:bg-gray-50'"
                            @click="activeTab = 'allocation'"
                        >
                            <font-awesome-icon :icon="['fas', 'chart-bar']" class="mr-1.5" />
                            Budget Allocation
                        </button>
                        <button
                            class="flex-1 px-4 py-3 text-xs font-semibold transition-colors border-b-2"
                            :class="activeTab === 'pacing'
                                ? 'text-blue-600 border-blue-600 bg-blue-50/30'
                                : 'text-gray-500 border-transparent hover:text-gray-700 hover:bg-gray-50'"
                            @click="activeTab = 'pacing'"
                        >
                            <font-awesome-icon :icon="['fas', 'calendar-days']" class="mr-1.5" />
                            Daily Pacing
                            <span
                                v-if="dailyPacing.length > 0"
                                class="ml-1.5 inline-flex items-center justify-center w-4 h-4 text-[9px] bg-gray-200 text-gray-600 rounded-full"
                            >
                                {{ dailyPacing.length }}
                            </span>
                        </button>
                    </div>

                    <!-- Tab content -->
                    <div class="p-5">
                        <BudgetAllocationChart
                            v-if="activeTab === 'allocation'"
                            :rows="allocationRows"
                            :is-loading="isLoading"
                        />
                        <BudgetPacingChart
                            v-else
                            :pacing-data="dailyPacing"
                            :is-loading="isLoading"
                        />
                    </div>
                </div>

                <!-- AI Explanation (collapsible) -->
                <div
                    v-if="aiExplanation"
                    class="bg-gradient-to-br from-purple-50 to-indigo-50 rounded-xl border border-purple-100 p-5"
                >
                    <h3 class="text-sm font-semibold text-purple-800 mb-2">
                        <font-awesome-icon :icon="['fas', 'wand-magic-sparkles']" class="mr-1.5" />
                        AI-Enhanced Explanation
                    </h3>
                    <p class="text-sm text-purple-900/80 leading-relaxed whitespace-pre-line">
                        {{ aiExplanation }}
                    </p>
                </div>
            </template>
        </template>

        <!-- Initial loading state (before first fetch completes) -->
        <template v-if="isLoading && !hasFetched">
            <div class="bg-white rounded-xl border border-gray-200 p-12 text-center">
                <font-awesome-icon :icon="['fas', 'spinner']" class="text-3xl text-blue-400 animate-spin mb-3" />
                <p class="text-sm text-gray-500">Running budget optimization...</p>
            </div>
        </template>

        <!-- Pre-fetch prompt -->
        <div
            v-if="!hasFetched && !isLoading"
            class="bg-white rounded-xl border border-gray-200 p-12 text-center"
        >
            <div class="w-14 h-14 rounded-full bg-blue-50 flex items-center justify-center mx-auto mb-4">
                <font-awesome-icon :icon="['fas', 'wand-magic-sparkles']" class="text-2xl text-blue-400" />
            </div>
            <p class="text-sm text-gray-600 font-medium">Configure your budget and optimization goal above</p>
            <p class="text-xs text-gray-400 mt-1">Then click <strong>Optimize</strong> to generate AI-powered allocation recommendations.</p>
        </div>
    </div>
</template>