<script setup lang="ts">
/**
 * ChannelComparisonTable — Cross-channel marketing comparison table.
 *
 * Displays per-channel metrics (Spend, CTR, CPA, ROAS) in a sortable,
 * expandable table. Each row expands to show all 9 KPIs with delta badges.
 * Includes:
 *   - Sortable column headers (default: Spend desc)
 *   - Total summary bar above the rows
 *   - Per-channel expandable rows with sparklines & deltas
 *   - Empty state when no data is available
 *   - Loading skeletons
 *   - ARIA roles for accessibility
 *   - Drill-down event forwarding
 */

import type { IChannelRow, IChannelDelta, ChannelSortKey } from '@/composables/useChannelComparison';

interface Props {
    /** Sorted channel rows */
    channels: IChannelRow[];
    /** Total aggregated row */
    totals: IChannelRow;
    /** Whether data is loading */
    isLoading: boolean;
    /** Whether at least one fetch has completed */
    hasFetched: boolean;
    /** Current sort column */
    sortBy: ChannelSortKey;
    /** Current sort direction */
    sortDir: 'asc' | 'desc';
    /** Sort toggle handler */
    toggleSort: (key: ChannelSortKey) => void;
    /** Formatters */
    formatCurrency: (v: number) => string;
    formatNumber: (v: number) => string;
    formatPercent: (v: number) => string;
    formatRatio: (v: number) => string;
    /** Optional deltas map keyed by channel name */
    deltasMap?: Map<string, IChannelDelta> | null;
    /** Format a delta value as signed percentage */
    formatDelta?: (v: number | null) => string;
    /** Get CSS class for delta badge */
    deltaClass?: (v: number | null, metric: ChannelSortKey) => string;
}

const props = withDefaults(defineProps<Props>(), {
    deltasMap: null,
    formatDelta: (v: number | null) => {
        if (v === null) return '—';
        const sign = v >= 0 ? '+' : '';
        return `${sign}${(v * 100).toFixed(1)}%`;
    },
    deltaClass: (v: number | null, metric: ChannelSortKey) => {
        if (v === null) return 'text-gray-400';
        const inverted = metric === 'cpa' || metric === 'cpc';
        const isPositive = inverted ? v < 0 : v > 0;
        return isPositive ? 'text-emerald-600 bg-emerald-50' : v === 0 ? 'text-gray-500 bg-gray-50' : 'text-red-600 bg-red-50';
    },
});

const emit = defineEmits<{
    (e: 'drill-down', channel: string): void;
}>();

/** Brand colors for known channels */
const CHANNEL_COLORS: Record<string, string> = {
    'google ads': '#4285f4',
    'google': '#4285f4',
    'meta ads': '#0668e1',
    'facebook': '#0668e1',
    'meta': '#0668e1',
    'linkedin ads': '#0a66c2',
    'linkedin': '#0a66c2',
    'twitter': '#1da1f2',
    'x': '#1da1f2',
    'tiktok': '#000000',
    'instagram': '#e4405f',
    'email': '#34a853',
    'klaviyo': '#2e2e2e',
    'hubspot': '#ff7a59',
    'organic': '#34a853',
    'direct': '#fbbc05',
    'referral': '#ea4335',
    'other': '#9aa0a6',
};

/** Fallback color palette for unknown channels */
const FALLBACK_COLORS = [
    '#6366f1', '#ec4899', '#f59e0b', '#10b981', '#8b5cf6',
    '#ef4444', '#06b6d4', '#f97316', '#14b8a6', '#a855f7',
];

/** Map channel names to colors */
function getChannelColor(channelName: string, index: number): string {
    const normalized = channelName.toLowerCase().trim();
    return CHANNEL_COLORS[normalized] || FALLBACK_COLORS[index % FALLBACK_COLORS.length];
}

/** Calculate spend share for each channel */
const spendShares = computed(() => {
    const totalSpend = props.totals.spend || 1;
    return props.channels.map(ch => ch.spend / totalSpend);
});

/** Sortable column definitions */
interface ColumnDef {
    key: ChannelSortKey;
    label: string;
    align: 'left' | 'right';
}

const columns: ColumnDef[] = [
    { key: 'spend', label: 'Spend', align: 'right' },
    { key: 'impressions', label: 'Impr.', align: 'right' },
    { key: 'clicks', label: 'Clicks', align: 'right' },
    { key: 'ctr', label: 'CTR', align: 'right' },
    { key: 'cpa', label: 'CPA', align: 'right' },
    { key: 'roas', label: 'ROAS', align: 'right' },
];

function formatMetric(key: ChannelSortKey, value: number): string {
    switch (key) {
        case 'spend':
        case 'cpc':
        case 'cpa':
            return props.formatCurrency(value);
        case 'impressions':
        case 'clicks':
        case 'conversions':
            return props.formatNumber(value);
        case 'ctr':
            return props.formatPercent(value);
        case 'roas':
            return props.formatRatio(value);
        default:
            return String(value);
    }
}

function handleDrillDown(channel: string) {
    emit('drill-down', channel);
}
</script>

<template>
    <div class="channel-comparison-table" role="grid" aria-label="Channel comparison matrix">
        <!-- Loading skeleton -->
        <div v-if="isLoading && !hasFetched" class="space-y-2">
            <div
                v-for="i in 4"
                :key="i"
                class="h-14 rounded-lg bg-gray-50 animate-pulse"
            />
        </div>

        <!-- Empty state -->
        <div
            v-else-if="!isLoading && channels.length === 0 && hasFetched"
            class="flex flex-col items-center justify-center py-10 text-center"
        >
            <div class="w-12 h-12 rounded-full bg-indigo-50 flex items-center justify-center mb-3">
                <font-awesome-icon :icon="['fas', 'chart-bar']" class="text-lg text-indigo-300" />
            </div>
            <p class="text-sm text-gray-500 font-medium">No channel data available</p>
            <p class="text-xs text-gray-400 mt-1 max-w-xs">
                Connect a marketing data source with channel or source grouping to see cross-channel comparisons.
            </p>
        </div>

        <!-- Data table -->
        <template v-else-if="channels.length > 0">
            <!-- Column header row (sortable) -->
            <div class="flex items-center gap-3 px-4 py-2 mb-1" role="row">
                <div class="min-w-[140px] sticky left-0 bg-white z-10">
                    <span class="text-[10px] font-medium text-gray-400 uppercase tracking-wide">
                        Channel
                    </span>
                </div>
                <div class="flex-1 max-w-[120px] hidden sm:block" />
                <div class="flex items-center gap-6 flex-1 justify-end">
                    <button
                        v-for="col in columns"
                        :key="col.key"
                        type="button"
                        class="min-w-[70px] text-right group/sort cursor-pointer"
                        role="columnheader"
                        :aria-sort="sortBy === col.key ? (sortDir === 'asc' ? 'ascending' : 'descending') : 'none'"
                        @click="toggleSort(col.key)"
                    >
                        <span
                            class="text-[10px] font-medium uppercase tracking-wide transition-colors"
                            :class="sortBy === col.key ? 'text-indigo-600' : 'text-gray-400 group-hover/sort:text-gray-500'"
                        >
                            {{ col.label }}
                            <font-awesome-icon
                                v-if="sortBy === col.key"
                                :icon="['fas', sortDir === 'asc' ? 'caret-up' : 'caret-down']"
                                class="ml-0.5 text-[9px]"
                            />
                        </span>
                    </button>
                </div>
                <div class="w-3 flex-shrink-0" />
            </div>

            <!-- Totals summary bar -->
            <div class="flex items-center gap-3 px-4 py-2.5 bg-gray-50 rounded-lg mb-2 border border-gray-100" role="row">
                <div class="flex items-center gap-2 min-w-[140px] sticky left-0 z-10 bg-gray-50">
                    <div class="w-2.5 h-2.5 rounded-full bg-gray-400 flex-shrink-0" />
                    <span class="text-sm font-bold text-gray-700">Total</span>
                </div>
                <div class="flex-1 max-w-[120px] hidden sm:block" />
                <div class="flex items-center gap-6 flex-1 justify-end">
                    <div
                        v-for="col in columns"
                        :key="col.key"
                        class="text-right min-w-[70px]"
                    >
                        <span class="text-sm font-bold text-gray-700">
                            {{ formatMetric(col.key, totals[col.key]) }}
                        </span>
                    </div>
                </div>
                <div class="w-3 flex-shrink-0" />
            </div>

            <!-- Channel rows -->
            <ChannelRowExpandable
                v-for="(row, idx) in channels"
                :key="row.channel"
                :row="row"
                :color="getChannelColor(row.channel, idx)"
                :spend-share="spendShares[idx]"
                :format-currency="formatCurrency"
                :format-number="formatNumber"
                :format-percent="formatPercent"
                :format-ratio="formatRatio"
                :deltas="deltasMap?.get(row.channel) ?? null"
                :format-delta="formatDelta"
                :delta-class="deltaClass"
                @drill-down="handleDrillDown"
            />

            <!-- Sort info line -->
            <p class="text-[10px] text-gray-300 mt-3 text-right">
                Sorted by {{ sortBy.toUpperCase() }} · {{ sortDir === 'desc' ? 'highest first' : 'lowest first' }}
                · {{ channels.length }} {{ channels.length === 1 ? 'channel' : 'channels' }}
            </p>
        </template>
    </div>
</template>