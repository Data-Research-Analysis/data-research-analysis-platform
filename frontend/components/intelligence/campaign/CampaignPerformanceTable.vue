<script setup lang="ts">
/**
 * CampaignPerformanceTable — Responsive sortable table showing campaign
 * KPIs with sparklines and status badges.
 *
 * MKT-004 deliverable. Uses useCampaignPerformance composable for data,
 * TrendSparkline for inline sparklines, CampaignStatusBadge for status,
 * CampaignFilters for search/filter controls.
 */

import type { ICampaignPerformanceRow, CampaignSortKey } from '~/composables/useCampaignPerformance';

interface Props {
    /** Project ID to query campaigns for (preferred over dataModelId) */
    projectId?: number | null;
    /** Data model ID to query campaigns for (fallback) */
    dataModelId?: number | null;
    /** ISO date string – start of the reporting period */
    startDate: string | null;
    /** ISO date string – end of the reporting period */
    endDate: string | null;
    /** Available channel names for the filter dropdown */
    channels?: string[];
    /** Max height for the table scroll container (px) */
    maxHeight?: number;
    /** Whether to show the filter bar. Defaults to true. */
    showFilters?: boolean;
}

const props = withDefaults(defineProps<Props>(), {
    channels: () => [],
    maxHeight: 480,
    showFilters: true,
});

const emit = defineEmits<{
    /** Emitted when a campaign row is clicked (for drill-down) */
    'campaign-click': [campaign: ICampaignPerformanceRow];
}>();

const {
    rows,
    total,
    totalPages,
    isLoading,
    hasFetched,
    hasData,
    error,
    search,
    channel: channelFilter,
    status: statusFilter,
    sortBy,
    sortDir,
    page,
    pageSize,
    toggleSort,
    resetFilters,
    formatCurrency,
    formatNumber,
    formatPercent,
    formatRatio,
} = useCampaignPerformance({
    projectId: computed(() => props.projectId),
    dataModelId: computed(() => props.dataModelId),
    startDate: computed(() => props.startDate),
    endDate: computed(() => props.endDate),
    pageSize: 15,
});

/**
 * Table column definitions. Each entry maps to a sortable column.
 */
interface IColumnDef {
    key: CampaignSortKey;
    label: string;
    align: 'left' | 'right';
    formatter?: (row: ICampaignPerformanceRow) => string;
    /** Whether to show a sparkline in this column */
    sparkline?: boolean;
}

const columns: IColumnDef[] = [
    { key: 'campaignName', label: 'Campaign', align: 'left' },
    { key: 'channel', label: 'Channel', align: 'left' },
    { key: 'spend', label: 'Spend', align: 'right', formatter: (r) => formatCurrency(r.spend) },
    { key: 'impressions', label: 'Impressions', align: 'right', formatter: (r) => formatNumber(r.impressions) },
    { key: 'clicks', label: 'Clicks', align: 'right', formatter: (r) => formatNumber(r.clicks) },
    { key: 'conversions', label: 'Conversions', align: 'right', formatter: (r) => formatNumber(r.conversions) },
    { key: 'ctr', label: 'CTR', align: 'right', formatter: (r) => formatPercent(r.ctr) },
    { key: 'cpc', label: 'CPC', align: 'right', formatter: (r) => formatCurrency(r.cpc) },
    { key: 'cpa', label: 'CPA', align: 'right', formatter: (r) => formatCurrency(r.cpa) },
    { key: 'roas', label: 'ROAS', align: 'right', formatter: (r) => formatRatio(r.roas) },
];

/**
 * Get the sparkline color based on ROAS performance.
 */
function sparklineColor(row: ICampaignPerformanceRow): string {
    if (row.roas >= 3) return '#10b981'; // emerald-500 — excellent
    if (row.roas >= 1) return '#3b82f6'; // blue-500 — good
    if (row.roas >= 0.5) return '#f59e0b'; // amber-500 — warning
    return '#ef4444'; // red-500 — poor
}

/**
 * Sort indicator icon class.
 */
function sortIcon(key: CampaignSortKey): string {
    if (sortBy.value !== key) return 'opacity-0';
    return sortDir.value === 'asc' ? 'rotate-180' : '';
}

/**
 * Format the pagination range text.
 */
const paginationRange = computed(() => {
    const start = (page.value - 1) * pageSize.value + 1;
    const end = Math.min(page.value * pageSize.value, total.value);
    return `${start}–${end} of ${total.value}`;
});
</script>

<template>
    <div class="space-y-4">
        <!-- Filters -->
        <CampaignFilters
            v-if="showFilters"
            :search="search"
            :channel="channelFilter"
            :status="statusFilter"
            :channels="channels"
            @update:search="search = $event"
            @update:channel="channelFilter = $event"
            @update:status="statusFilter = $event"
            @reset="resetFilters()"
        />

        <!-- Error state -->
        <div
            v-if="error"
            class="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-800"
        >
            {{ error }}
        </div>

        <!-- Loading skeleton -->
        <div
            v-else-if="isLoading && !hasFetched"
            class="animate-pulse space-y-3"
        >
            <div v-for="i in 5" :key="i" class="flex items-center gap-4">
                <div class="h-4 w-1/4 rounded bg-gray-200" />
                <div class="h-4 w-1/6 rounded bg-gray-200" />
                <div class="h-4 w-1/6 rounded bg-gray-200" />
                <div class="h-4 w-1/6 rounded bg-gray-200" />
                <div class="h-4 w-1/6 rounded bg-gray-200" />
            </div>
        </div>

        <!-- Empty state -->
        <div
            v-else-if="hasFetched && !hasData"
            class="flex flex-col items-center justify-center rounded-lg border border-gray-200 bg-gray-50 py-12"
        >
            <svg class="mb-3 h-12 w-12 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
            </svg>
            <p class="text-sm text-gray-500">
                No campaigns found for this period.
            </p>
            <p
                v-if="search || channelFilter || statusFilter"
                class="mt-1 text-xs text-gray-400"
            >
                Try adjusting your filters.
            </p>
        </div>

        <!-- Table -->
        <div
            v-else-if="hasData"
            class="overflow-hidden rounded-xl border border-gray-200 bg-white"
        >
            <div
                class="overflow-x-auto"
                :style="{ maxHeight: `${maxHeight}px` }"
            >
                <table class="w-full text-sm">
                    <!-- Header -->
                    <thead class="sticky top-0 z-10 border-b border-gray-200 bg-gray-50/95 backdrop-blur">
                        <tr>
                            <!-- Status column (not sortable) -->
                            <th class="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-gray-500">
                                Status
                            </th>
                            <th
                                v-for="col in columns"
                                :key="col.key"
                                :class="[
                                    'group cursor-pointer select-none px-4 py-3 text-xs font-semibold uppercase tracking-wider text-gray-500 transition-colors hover:text-gray-700',
                                    col.align === 'right' ? 'text-right' : 'text-left',
                                ]"
                                @click="toggleSort(col.key)"
                            >
                                <span class="inline-flex items-center gap-1">
                                    {{ col.label }}
                                    <svg
                                        :class="['h-3 w-3 text-gray-400 transition-transform', sortIcon(col.key)]"
                                        fill="none"
                                        viewBox="0 0 24 24"
                                        stroke="currentColor"
                                    >
                                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7" />
                                    </svg>
                                </span>
                            </th>
                            <!-- Trend column (not sortable) -->
                            <th class="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-gray-500">
                                7d Trend
                            </th>
                        </tr>
                    </thead>

                    <!-- Body -->
                    <tbody class="divide-y divide-gray-100">
                        <tr
                            v-for="row in rows"
                            :key="row.campaignId"
                            class="group cursor-pointer transition-colors hover:bg-gray-50"
                            @click="emit('campaign-click', row)"
                        >
                            <!-- Status -->
                            <td class="px-4 py-3">
                                <CampaignStatusBadge :status="row.status" />
                            </td>

                            <!-- Campaign name -->
                            <td class="max-w-[200px] truncate px-4 py-3 font-medium text-gray-900">
                                {{ row.campaignName }}
                            </td>

                            <!-- Channel -->
                            <td class="px-4 py-3 text-gray-600">
                                {{ row.channel }}
                            </td>

                            <!-- Spend -->
                            <td class="px-4 py-3 text-right tabular-nums text-gray-900">
                                {{ formatCurrency(row.spend) }}
                            </td>

                            <!-- Impressions -->
                            <td class="px-4 py-3 text-right tabular-nums text-gray-600">
                                {{ formatNumber(row.impressions) }}
                            </td>

                            <!-- Clicks -->
                            <td class="px-4 py-3 text-right tabular-nums text-gray-600">
                                {{ formatNumber(row.clicks) }}
                            </td>

                            <!-- Conversions -->
                            <td class="px-4 py-3 text-right tabular-nums text-gray-600">
                                {{ formatNumber(row.conversions) }}
                            </td>

                            <!-- CTR -->
                            <td class="px-4 py-3 text-right tabular-nums text-gray-600">
                                {{ formatPercent(row.ctr) }}
                            </td>

                            <!-- CPC -->
                            <td class="px-4 py-3 text-right tabular-nums text-gray-600">
                                {{ formatCurrency(row.cpc) }}
                            </td>

                            <!-- CPA -->
                            <td class="px-4 py-3 text-right tabular-nums text-gray-600">
                                {{ formatCurrency(row.cpa) }}
                            </td>

                            <!-- ROAS -->
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

                            <!-- Sparkline trend -->
                            <td class="px-4 py-3">
                                <TrendSparkline
                                    v-if="row.dailyTrend.length >= 2"
                                    :data="row.dailyTrend"
                                    :color="sparklineColor(row)"
                                    :width="72"
                                    :height="28"
                                />
                                <span
                                    v-else
                                    class="text-xs text-gray-400"
                                >
                                    —
                                </span>
                            </td>
                        </tr>
                    </tbody>
                </table>
            </div>

            <!-- Pagination footer -->
            <div
                v-if="total > pageSize"
                class="flex items-center justify-between border-t border-gray-200 bg-gray-50 px-4 py-3"
            >
                <p class="text-xs text-gray-500">
                    {{ paginationRange }}
                </p>
                <div class="flex items-center gap-1">
                    <button
                        :disabled="page <= 1"
                        class="rounded-md border border-gray-300 bg-white px-2.5 py-1.5 text-xs font-medium text-gray-700 transition-colors hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-50"
                        @click="page = Math.max(1, page - 1)"
                    >
                        ← Prev
                    </button>
                    <span class="px-2 text-xs text-gray-500">
                        Page {{ page }} / {{ totalPages }}
                    </span>
                    <button
                        :disabled="page >= totalPages"
                        class="rounded-md border border-gray-300 bg-white px-2.5 py-1.5 text-xs font-medium text-gray-700 transition-colors hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-50"
                        @click="page = Math.min(totalPages, page + 1)"
                    >
                        Next →
                    </button>
                </div>
            </div>
        </div>
    </div>
</template>