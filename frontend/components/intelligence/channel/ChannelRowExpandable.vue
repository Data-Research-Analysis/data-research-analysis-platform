<script setup lang="ts">
/**
 * ChannelRowExpandable — Single expandable row in the Channel Comparison Table.
 *
 * Displays channel name + top-level KPIs in a collapsed row.
 * On click, expands to show all 9 KPIs with delta badges, a mini sparkline,
 * top campaigns list, and quick-action buttons.
 *
 * Features:
 *   - Mini sparkline showing spend trend
 *   - Delta badges showing period-over-period change
 *   - Top 5 campaigns table in expanded view
 *   - Quick actions: "View Campaigns" drill-down
 *   - ARIA attributes for keyboard accessibility
 */

import type { IChannelRow, IChannelDelta, ChannelSortKey } from '@/composables/useChannelComparison';
import TrendSparkline from '@/components/intelligence/kpi/TrendSparkline.vue';

interface Props {
    /** The channel data row */
    row: IChannelRow;
    /** Channel brand color */
    color: string;
    /** Spend share (0–1) for the ratio bar */
    spendShare: number;
    /** Formatters */
    formatCurrency: (v: number) => string;
    formatNumber: (v: number) => string;
    formatPercent: (v: number) => string;
    formatRatio: (v: number) => string;
    /** Optional deltas for period comparison */
    deltas?: IChannelDelta | null;
    /** Format a delta value as signed percentage */
    formatDelta?: (v: number | null) => string;
    /** Get CSS class for delta badge */
    deltaClass?: (v: number | null, metric: ChannelSortKey) => string;
}

const props = withDefaults(defineProps<Props>(), {
    deltas: null,
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

const isExpanded = ref(false);

function toggle() {
    isExpanded.value = !isExpanded.value;
}

function onKeydown(event: KeyboardEvent) {
    if (event.key === 'Enter' || event.key === ' ') {
        event.preventDefault();
        toggle();
    }
}

/** Top-level KPIs shown in collapsed row */
const topMetrics = computed(() => [
    { key: 'spend' as ChannelSortKey, label: 'Spend', value: props.formatCurrency(props.row.spend) },
    { key: 'clicks' as ChannelSortKey, label: 'Clicks', value: props.formatNumber(props.row.clicks) },
    { key: 'cpa' as ChannelSortKey, label: 'CPA', value: props.formatCurrency(props.row.cpa) },
    { key: 'roas' as ChannelSortKey, label: 'ROAS', value: props.formatRatio(props.row.roas) },
]);

/** All KPIs shown in expanded detail */
const allMetrics = computed(() => [
    { key: 'spend' as ChannelSortKey, label: 'Spend', value: props.formatCurrency(props.row.spend) },
    { key: 'impressions' as ChannelSortKey, label: 'Impressions', value: props.formatNumber(props.row.impressions) },
    { key: 'clicks' as ChannelSortKey, label: 'Clicks', value: props.formatNumber(props.row.clicks) },
    { key: 'conversions' as ChannelSortKey, label: 'Conversions', value: props.formatNumber(props.row.conversions) },
    { key: 'revenue' as ChannelSortKey, label: 'Revenue', value: props.formatCurrency(props.row.revenue) },
    { key: 'ctr' as ChannelSortKey, label: 'CTR', value: props.formatPercent(props.row.ctr) },
    { key: 'cpc' as ChannelSortKey, label: 'CPC', value: props.formatCurrency(props.row.cpc) },
    { key: 'cpa' as ChannelSortKey, label: 'CPA', value: props.formatCurrency(props.row.cpa) },
    { key: 'roas' as ChannelSortKey, label: 'ROAS', value: props.formatRatio(props.row.roas) },
]);

/** Whether we have delta data to show */
const hasDeltas = computed(() => props.deltas !== null && props.deltas !== undefined);

/** Whether we have daily trend data */
const hasTrendData = computed(() => (props.row.dailyTrend?.length ?? 0) >= 2);

/** Whether we have top campaigns data */
const hasTopCampaigns = computed(() => (props.row.topCampaigns?.length ?? 0) > 0);

/** Top campaigns sorted by spend (limited to 5) */
const topCampaignsList = computed(() => {
    if (!props.row.topCampaigns) return [];
    return [...props.row.topCampaigns]
        .sort((a, b) => b.spend - a.spend)
        .slice(0, 5);
});

function handleDrillDown() {
    emit('drill-down', props.row.channel);
}
</script>

<template>
    <div
        class="channel-row group border border-gray-100 rounded-lg mb-1.5 transition-all duration-200 hover:border-gray-200 hover:shadow-sm cursor-pointer"
        :class="{ 'border-indigo-200 bg-indigo-50/30 shadow-sm': isExpanded }"
        role="row"
        :aria-expanded="isExpanded"
        tabindex="0"
        @click="toggle"
        @keydown="onKeydown"
    >
        <!-- Collapsed row -->
        <div class="flex items-center gap-3 px-4 py-3">
            <!-- Color dot + channel name -->
            <div class="flex items-center gap-2 min-w-[140px]">
                <div
                    class="w-2.5 h-2.5 rounded-full flex-shrink-0"
                    :style="{ backgroundColor: color }"
                />
                <span class="text-sm font-medium text-gray-800 truncate">
                    {{ row.channel }}
                </span>
            </div>

            <!-- Spend ratio bar + sparkline -->
            <div class="flex-1 max-w-[120px] hidden sm:flex flex-col gap-1">
                <div class="h-1.5 bg-gray-100 rounded-full overflow-hidden">
                    <div
                        class="h-full rounded-full transition-all duration-300"
                        :style="{
                            width: `${Math.max(spendShare * 100, 2)}%`,
                            backgroundColor: color,
                        }"
                    />
                </div>
                <!-- Mini sparkline -->
                <TrendSparkline
                    v-if="hasTrendData"
                    :data="row.dailyTrend!"
                    :color="color"
                    :height="20"
                />
            </div>

            <!-- Top-level metrics with delta badges -->
            <div class="flex items-center gap-6 flex-1 justify-end">
                <div
                    v-for="metric in topMetrics"
                    :key="metric.key"
                    class="text-right min-w-[70px]"
                >
                    <div class="text-[10px] font-medium text-gray-400 uppercase tracking-wide">
                        {{ metric.label }}
                    </div>
                    <div class="text-sm font-semibold text-gray-800">
                        {{ metric.value }}
                    </div>
                    <!-- Delta badge -->
                    <span
                        v-if="hasDeltas && deltas"
                        class="inline-block mt-0.5 text-[10px] font-medium px-1.5 py-0.5 rounded-full leading-tight"
                        :class="deltaClass(deltas[metric.key], metric.key)"
                    >
                        {{ formatDelta(deltas[metric.key]) }}
                    </span>
                </div>
            </div>

            <!-- Expand chevron -->
            <font-awesome-icon
                :icon="['fas', 'chevron-down']"
                class="w-3 h-3 text-gray-300 transition-transform duration-200 flex-shrink-0"
                :class="{ 'rotate-180 text-indigo-400': isExpanded }"
            />
        </div>

        <!-- Expanded detail grid -->
        <Transition name="expand">
            <div
                v-if="isExpanded"
                class="px-4 pb-4 pt-1 border-t border-gray-100"
                @click.stop
            >
                <!-- Full KPI grid with deltas -->
                <div class="grid grid-cols-3 sm:grid-cols-5 lg:grid-cols-9 gap-3">
                    <div
                        v-for="metric in allMetrics"
                        :key="metric.key"
                        class="bg-gray-50 rounded-lg px-3 py-2"
                    >
                        <div class="text-[10px] font-medium text-gray-400 uppercase tracking-wide mb-0.5">
                            {{ metric.label }}
                        </div>
                        <div class="text-sm font-bold text-gray-800">
                            {{ metric.value }}
                        </div>
                        <!-- Delta badge in expanded view -->
                        <span
                            v-if="hasDeltas && deltas"
                            class="inline-block mt-0.5 text-[10px] font-medium px-1.5 py-0.5 rounded-full leading-tight"
                            :class="deltaClass(deltas[metric.key], metric.key)"
                        >
                            {{ formatDelta(deltas[metric.key]) }}
                        </span>
                    </div>
                </div>

                <!-- Top campaigns section -->
                <div v-if="hasTopCampaigns" class="mt-4">
                    <h4 class="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">
                        Top Campaigns
                    </h4>
                    <div class="space-y-1.5">
                        <div
                            v-for="campaign in topCampaignsList"
                            :key="campaign.campaignId"
                            class="flex items-center justify-between px-3 py-2 bg-gray-50 rounded-lg text-sm"
                        >
                            <span class="text-gray-700 font-medium truncate flex-1 mr-4">
                                {{ campaign.campaignName }}
                            </span>
                            <div class="flex items-center gap-4 flex-shrink-0">
                                <span class="text-gray-500">
                                    {{ formatCurrency(campaign.spend) }}
                                </span>
                                <span class="text-gray-400 text-xs">
                                    {{ formatNumber(campaign.conversions) }} conv.
                                </span>
                            </div>
                        </div>
                    </div>
                </div>

                <!-- Quick action buttons -->
                <div class="flex items-center gap-3 mt-4 pt-3 border-t border-gray-100">
                    <button
                        type="button"
                        class="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-indigo-600 bg-indigo-50 rounded-lg hover:bg-indigo-100 transition-colors focus:outline-none focus:ring-2 focus:ring-indigo-300 cursor-pointer"
                        @click.stop="handleDrillDown"
                    >
                        <font-awesome-icon :icon="['fas', 'arrow-right']" class="text-[10px]" />
                        View Campaigns
                    </button>
                </div>
            </div>
        </Transition>
    </div>
</template>

<style scoped>
.expand-enter-active,
.expand-leave-active {
    transition: all 0.2s ease;
    overflow: hidden;
}

.expand-enter-from,
.expand-leave-to {
    opacity: 0;
    max-height: 0;
    padding-top: 0;
    padding-bottom: 0;
}

.expand-enter-to,
.expand-leave-from {
    opacity: 1;
    max-height: 500px;
}
</style>