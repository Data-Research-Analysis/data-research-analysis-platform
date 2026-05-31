<script setup lang="ts">
/**
 * DimensionBreakdown — Displays performance data for a campaign dimension
 * (ad_group, keyword, device, geo).
 *
 * Shows a sortable table with performance scores and status badges.
 */
import type { IDimensionBreakdown } from '@/composables/useCampaignAnalysis';

interface Props {
    dimension: IDimensionBreakdown;
    isLoading?: boolean;
}

const props = withDefaults(defineProps<Props>(), {
    isLoading: false,
});

const dimensionLabels: Record<string, string> = {
    ad_group: 'Ad Group',
    keyword: 'Keyword',
    device: 'Device',
    geo: 'Geography',
};

const sortKey = ref<string>('spend');
const sortDir = ref<'asc' | 'desc'>('desc');

const sortedRows = computed(() => {
    if (!props.dimension.available || !props.dimension.rows.length) return [];
    const key = sortKey.value as keyof typeof props.dimension.rows[0];
    return [...props.dimension.rows].sort((a, b) => {
        const av = typeof a[key] === 'number' ? a[key] as number : 0;
        const bv = typeof b[key] === 'number' ? b[key] as number : 0;
        return sortDir.value === 'asc' ? av - bv : bv - av;
    });
});

function toggleSort(key: string) {
    if (sortKey.value === key) {
        sortDir.value = sortDir.value === 'asc' ? 'desc' : 'asc';
    } else {
        sortKey.value = key;
        sortDir.value = 'desc';
    }
}

function sortIcon(key: string): string {
    if (sortKey.value !== key) return 'sort';
    return sortDir.value === 'asc' ? 'sort-up' : 'sort-down';
}

function statusColor(status: string): string {
    switch (status) {
        case 'outperforming': return 'bg-emerald-100 text-emerald-700';
        case 'on-track': return 'bg-blue-100 text-blue-700';
        case 'underperforming': return 'bg-red-100 text-red-700';
        default: return 'bg-gray-100 text-gray-500';
    }
}

function formatCurrency(val: number): string {
    return `$${val.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function formatNumber(val: number): string {
    return val.toLocaleString('en-US');
}

function formatPercent(val: number): string {
    return `${val.toFixed(2)}%`;
}

function formatScore(val: number): string {
    return `${Math.round(val)}/100`;
}

const columns = [
    { key: 'label', label: 'Name', sortable: false },
    { key: 'spend', label: 'Spend', sortable: true },
    { key: 'impressions', label: 'Impressions', sortable: true },
    { key: 'clicks', label: 'Clicks', sortable: true },
    { key: 'conversions', label: 'Conversions', sortable: true },
    { key: 'revenue', label: 'Revenue', sortable: true },
    { key: 'ctr', label: 'CTR', sortable: true },
    { key: 'cpc', label: 'CPC', sortable: true },
    { key: 'cpa', label: 'CPA', sortable: true },
    { key: 'roas', label: 'ROAS', sortable: true },
    { key: 'performanceScore', label: 'Score', sortable: true },
    { key: 'status', label: 'Status', sortable: false },
];

function formatCellValue(key: string, val: any): string {
    if (typeof val !== 'number') return String(val ?? '');
    switch (key) {
        case 'spend': case 'revenue': case 'cpc': case 'cpa': return formatCurrency(val);
        case 'impressions': case 'clicks': case 'conversions': return formatNumber(val);
        case 'ctr': return formatPercent(val);
        case 'roas': return `${val.toFixed(2)}x`;
        case 'performanceScore': return formatScore(val);
        default: return String(val);
    }
}
</script>

<template>
    <div class="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <div class="px-5 py-3 border-b border-gray-100 flex items-center justify-between">
            <h3 class="text-sm font-semibold text-gray-800">
                {{ dimensionLabels[dimension.dimension] || dimension.dimension }}
            </h3>
            <span class="text-[10px] text-gray-400">
                {{ dimension.available ? `${dimension.rows.length} items` : 'No data' }}
            </span>
        </div>

        <!-- Loading -->
        <div v-if="isLoading" class="p-6 flex items-center justify-center">
            <div class="h-6 w-6 border-2 border-gray-200 border-t-indigo-500 rounded-full animate-spin" />
        </div>

        <!-- No data -->
        <div v-else-if="!dimension.available" class="p-6 text-center">
            <p class="text-sm text-gray-400">
                {{ dimensionLabels[dimension.dimension] || dimension.dimension }} data not available
            </p>
        </div>

        <!-- Table -->
        <div v-else class="overflow-x-auto">
            <table class="w-full text-xs">
                <thead>
                    <tr class="bg-gray-50">
                        <th
                            v-for="col in columns"
                            :key="col.key"
                            class="px-3 py-2 text-left font-medium text-gray-500 whitespace-nowrap"
                            :class="col.sortable ? 'cursor-pointer hover:text-gray-700' : ''"
                            @click="col.sortable && toggleSort(col.key)"
                        >
                            <span class="inline-flex items-center gap-1">
                                {{ col.label }}
                                <font-awesome-icon
                                    v-if="col.sortable"
                                    :icon="['fas', sortIcon(col.key)]"
                                    class="w-2.5 h-2.5 text-gray-400"
                                />
                            </span>
                        </th>
                    </tr>
                </thead>
                <tbody>
                    <tr
                        v-for="row in sortedRows"
                        :key="row.label"
                        class="border-t border-gray-100 hover:bg-gray-50 transition-colors"
                    >
                        <td class="px-3 py-2 font-medium text-gray-800 whitespace-nowrap">
                            {{ row.label }}
                        </td>
                        <td class="px-3 py-2 text-gray-600">{{ formatCellValue('spend', row.spend) }}</td>
                        <td class="px-3 py-2 text-gray-600">{{ formatCellValue('impressions', row.impressions) }}</td>
                        <td class="px-3 py-2 text-gray-600">{{ formatCellValue('clicks', row.clicks) }}</td>
                        <td class="px-3 py-2 text-gray-600">{{ formatCellValue('conversions', row.conversions) }}</td>
                        <td class="px-3 py-2 text-gray-600">{{ formatCellValue('revenue', row.revenue) }}</td>
                        <td class="px-3 py-2 text-gray-600">{{ formatCellValue('ctr', row.ctr) }}</td>
                        <td class="px-3 py-2 text-gray-600">{{ formatCellValue('cpc', row.cpc) }}</td>
                        <td class="px-3 py-2 text-gray-600">{{ formatCellValue('cpa', row.cpa) }}</td>
                        <td class="px-3 py-2 text-gray-600">{{ formatCellValue('roas', row.roas) }}</td>
                        <td class="px-3 py-2">
                            <div class="flex items-center gap-1.5">
                                <div class="w-12 h-1.5 bg-gray-200 rounded-full overflow-hidden">
                                    <div
                                        class="h-full rounded-full"
                                        :style="{
                                            width: `${row.performanceScore}%`,
                                            backgroundColor: row.performanceScore >= 70 ? '#10b981' : row.performanceScore >= 40 ? '#f59e0b' : '#ef4444',
                                        }"
                                    />
                                </div>
                                <span class="text-gray-500 font-medium">{{ Math.round(row.performanceScore) }}</span>
                            </div>
                        </td>
                        <td class="px-3 py-2">
                            <span
                                class="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-medium capitalize"
                                :class="statusColor(row.status)"
                            >
                                {{ row.status }}
                            </span>
                        </td>
                    </tr>
                </tbody>
            </table>
        </div>
    </div>
</template>