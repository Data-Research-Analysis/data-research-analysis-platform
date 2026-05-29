<script setup lang="ts">
/**
 * DimensionBreakdown — Tabbed dimension breakdowns for the Campaign Drill-Down page.
 *
 * Shows Ad Group, Keyword, Device, and Geographic performance tables
 * with sorting and performance scoring.
 */
import type { IDimensionBreakdown, IDimensionRow } from '~/composables/useCampaignDrillDown';

interface Props {
    breakdowns: IDimensionBreakdown[];
    isLoading?: boolean;
    formatCurrency: (v: number) => string;
    formatNumber: (v: number) => string;
    formatPercent: (v: number) => string;
    formatRatio: (v: number) => string;
}

const props = withDefaults(defineProps<Props>(), {
    isLoading: false,
});

const activeDimension = ref(0);
type SortKey = 'name' | 'spend' | 'impressions' | 'clicks' | 'conversions' | 'ctr' | 'cpc' | 'cpa' | 'roas' | 'score';
const sortBy = ref<SortKey>('spend');
const sortDir = ref<'asc' | 'desc'>('desc');

function toggleSort(key: SortKey) {
    if (sortBy.value === key) {
        sortDir.value = sortDir.value === 'asc' ? 'desc' : 'asc';
    } else {
        sortBy.value = key;
        sortDir.value = 'desc';
    }
}

const sortedRows = computed(() => {
    const breakdown = props.breakdowns[activeDimension.value];
    if (!breakdown) return [];
    const rows = [...breakdown.rows];
    const dir = sortDir.value === 'asc' ? 1 : -1;
    return rows.sort((a, b) => {
        const aVal = a[sortBy.value] ?? 0;
        const bVal = b[sortBy.value] ?? 0;
        if (typeof aVal === 'string' && typeof bVal === 'string') {
            return aVal.localeCompare(bVal) * dir;
        }
        return ((aVal as number) - (bVal as number)) * dir;
    });
});

function scoreColor(score: number): string {
    if (score >= 80) return 'bg-emerald-100 text-emerald-700';
    if (score >= 60) return 'bg-blue-100 text-blue-700';
    if (score >= 40) return 'bg-amber-100 text-amber-700';
    return 'bg-red-100 text-red-700';
}

function scoreLabel(score: number): string {
    if (score >= 80) return 'Top';
    if (score >= 60) return 'Good';
    if (score >= 40) return 'Fair';
    return 'Low';
}

const dimensionIcons: Record<string, string> = {
    'Ad Group': 'layer-group',
    'Keyword': 'key',
    'Device': 'laptop',
    'Geographic': 'globe',
};

// Reset sort when switching tabs
watch(activeDimension, () => {
    sortBy.value = 'spend';
    sortDir.value = 'desc';
});
</script>

<template>
    <div class="space-y-4">
        <!-- Loading skeleton -->
        <template v-if="isLoading">
            <div class="flex gap-2">
                <div v-for="i in 4" :key="i" class="h-9 w-24 rounded-lg bg-gray-100 animate-pulse" />
            </div>
            <div class="h-48 rounded-lg bg-gray-50 animate-pulse" />
        </template>

        <!-- Empty state -->
        <div
            v-else-if="!breakdowns || breakdowns.length === 0"
            class="flex flex-col items-center justify-center py-16 rounded-lg border border-dashed border-gray-200 bg-gray-50"
        >
            <font-awesome-icon :icon="['fas', 'table']" class="text-3xl text-gray-300 mb-2" />
            <p class="text-sm text-gray-400">No dimension breakdowns available</p>
            <p class="text-xs text-gray-300 mt-1">This campaign may not have ad group, keyword, or geo data</p>
        </div>

        <template v-else>
            <!-- Dimension tabs -->
            <div class="flex items-center gap-1 overflow-x-auto pb-1">
                <button
                    v-for="(breakdown, idx) in breakdowns"
                    :key="breakdown.dimension"
                    type="button"
                    class="flex items-center gap-1.5 px-3 py-2 text-sm font-medium rounded-lg border transition-colors cursor-pointer whitespace-nowrap"
                    :class="
                        activeDimension === idx
                            ? 'border-primary-blue-100 bg-blue-50 text-primary-blue-100'
                            : 'border-gray-200 bg-white text-gray-500 hover:bg-gray-50'
                    "
                    @click="activeDimension = idx"
                >
                    <font-awesome-icon
                        :icon="['fas', dimensionIcons[breakdown.label] || 'table']"
                        class="text-xs"
                    />
                    {{ breakdown.label }}
                    <span
                        class="text-[10px] px-1.5 py-0.5 rounded-full bg-gray-100 text-gray-500"
                        :class="activeDimension === idx ? 'bg-blue-100 text-blue-600' : ''"
                    >
                        {{ breakdown.rows.length }}
                    </span>
                </button>
            </div>

            <!-- Table -->
            <div
                v-if="sortedRows.length > 0"
                class="overflow-hidden rounded-xl border border-gray-200 bg-white"
            >
                <div class="overflow-x-auto max-h-[400px]">
                    <table class="w-full text-sm">
                        <thead class="sticky top-0 z-10 border-b border-gray-200 bg-gray-50/95 backdrop-blur">
                            <tr>
                                <th
                                    class="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-gray-500 cursor-pointer select-none hover:text-gray-700"
                                    @click="toggleSort('name')"
                                >
                                    <span class="inline-flex items-center gap-1">
                                        {{ breakdowns[activeDimension]?.label || 'Name' }}
                                        <svg
                                            :class="['h-3 w-3 text-gray-400 transition-transform', sortBy === 'name' ? (sortDir === 'asc' ? 'rotate-180' : '') : 'opacity-0']"
                                            fill="none" viewBox="0 0 24 24" stroke="currentColor"
                                        >
                                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7" />
                                        </svg>
                                    </span>
                                </th>
                                <th class="px-4 py-3 text-xs font-semibold uppercase tracking-wider text-gray-500">Score</th>
                                <th
                                    v-for="col in [
                                        { key: 'spend' as SortKey, label: 'Spend' },
                                        { key: 'impressions' as SortKey, label: 'Impressions' },
                                        { key: 'clicks' as SortKey, label: 'Clicks' },
                                        { key: 'conversions' as SortKey, label: 'Conv' },
                                        { key: 'ctr' as SortKey, label: 'CTR' },
                                        { key: 'cpc' as SortKey, label: 'CPC' },
                                        { key: 'cpa' as SortKey, label: 'CPA' },
                                        { key: 'roas' as SortKey, label: 'ROAS' },
                                    ]"
                                    :key="col.key"
                                    class="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wider text-gray-500 cursor-pointer select-none hover:text-gray-700"
                                    @click="toggleSort(col.key)"
                                >
                                    <span class="inline-flex items-center gap-1 justify-end">
                                        {{ col.label }}
                                        <svg
                                            :class="['h-3 w-3 text-gray-400 transition-transform', sortBy === col.key ? (sortDir === 'asc' ? 'rotate-180' : '') : 'opacity-0']"
                                            fill="none" viewBox="0 0 24 24" stroke="currentColor"
                                        >
                                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7" />
                                        </svg>
                                    </span>
                                </th>
                            </tr>
                        </thead>
                        <tbody class="divide-y divide-gray-100">
                            <tr
                                v-for="row in sortedRows"
                                :key="row.name"
                                class="transition-colors hover:bg-gray-50"
                            >
                                <td class="px-4 py-3 font-medium text-gray-900 max-w-[200px] truncate">
                                    {{ row.name }}
                                </td>
                                <td class="px-4 py-3">
                                    <span
                                        class="inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-full"
                                        :class="scoreColor(row.score)"
                                    >
                                        {{ row.score }} — {{ scoreLabel(row.score) }}
                                    </span>
                                </td>
                                <td class="px-4 py-3 text-right tabular-nums text-gray-900">
                                    {{ formatCurrency(row.spend) }}
                                </td>
                                <td class="px-4 py-3 text-right tabular-nums text-gray-600">
                                    {{ formatNumber(row.impressions) }}
                                </td>
                                <td class="px-4 py-3 text-right tabular-nums text-gray-600">
                                    {{ formatNumber(row.clicks) }}
                                </td>
                                <td class="px-4 py-3 text-right tabular-nums text-gray-600">
                                    {{ formatNumber(row.conversions) }}
                                </td>
                                <td class="px-4 py-3 text-right tabular-nums text-gray-600">
                                    {{ formatPercent(row.ctr) }}
                                </td>
                                <td class="px-4 py-3 text-right tabular-nums text-gray-600">
                                    {{ formatCurrency(row.cpc) }}
                                </td>
                                <td class="px-4 py-3 text-right tabular-nums text-gray-600">
                                    {{ formatCurrency(row.cpa) }}
                                </td>
                                <td
                                    :class="[
                                        'px-4 py-3 text-right tabular-nums font-medium',
                                        row.roas >= 3 ? 'text-emerald-600' : '',
                                        row.roas >= 1 && row.roas < 3 ? 'text-blue-600' : '',
                                        row.roas >= 0.5 && row.roas < 1 ? 'text-amber-600' : '',
                                        row.roas < 0.5 ? 'text-red-600' : '',
                                    ]"
                                >
                                    {{ formatRatio(row.roas) }}
                                </td>
                            </tr>
                        </tbody>
                    </table>
                </div>
            </div>

            <!-- No rows for this dimension -->
            <div
                v-else
                class="flex flex-col items-center justify-center py-12 rounded-lg border border-dashed border-gray-200 bg-gray-50"
            >
                <p class="text-sm text-gray-400">No data for {{ breakdowns[activeDimension]?.label }}</p>
            </div>
        </template>
    </div>
</template>
