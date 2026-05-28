<script setup lang="ts">
/**
 * ChannelRowExpandable — Single expandable row in the Channel Comparison Table.
 *
 * Displays channel name + top-level KPIs in a collapsed row.
 * On click, expands to show all 10 KPIs in a detail grid.
 * Also shows a revenue-spend ratio mini-bar visualizing spend share.
 */

import type { IChannelRow } from '@/composables/useChannelComparison';

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
}

const props = defineProps<Props>();

const isExpanded = ref(false);

function toggle() {
    isExpanded.value = !isExpanded.value;
}

/** Top-level KPIs shown in collapsed row */
const topMetrics = computed(() => [
    { label: 'Spend', value: props.formatCurrency(props.row.spend) },
    { label: 'Clicks', value: props.formatNumber(props.row.clicks) },
    { label: 'CPA', value: props.formatCurrency(props.row.cpa) },
    { label: 'ROAS', value: props.formatRatio(props.row.roas) },
]);

/** All KPIs shown in expanded detail */
const allMetrics = computed(() => [
    { label: 'Spend', value: props.formatCurrency(props.row.spend) },
    { label: 'Impressions', value: props.formatNumber(props.row.impressions) },
    { label: 'Clicks', value: props.formatNumber(props.row.clicks) },
    { label: 'Conversions', value: props.formatNumber(props.row.conversions) },
    { label: 'Revenue', value: props.formatCurrency(props.row.revenue) },
    { label: 'CTR', value: props.formatPercent(props.row.ctr) },
    { label: 'CPC', value: props.formatCurrency(props.row.cpc) },
    { label: 'CPA', value: props.formatCurrency(props.row.cpa) },
    { label: 'ROAS', value: props.formatRatio(props.row.roas) },
]);
</script>

<template>
    <div
        class="channel-row group border border-gray-100 rounded-lg mb-1.5 transition-all duration-200 hover:border-gray-200 hover:shadow-sm cursor-pointer"
        :class="{ 'border-indigo-200 bg-indigo-50/30 shadow-sm': isExpanded }"
        @click="toggle"
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

            <!-- Spend ratio bar -->
            <div class="flex-1 max-w-[120px] hidden sm:block">
                <div class="h-1.5 bg-gray-100 rounded-full overflow-hidden">
                    <div
                        class="h-full rounded-full transition-all duration-300"
                        :style="{
                            width: `${Math.max(spendShare * 100, 2)}%`,
                            backgroundColor: color,
                        }"
                    />
                </div>
            </div>

            <!-- Top-level metrics -->
            <div class="flex items-center gap-6 flex-1 justify-end">
                <div
                    v-for="metric in topMetrics"
                    :key="metric.label"
                    class="text-right min-w-[70px]"
                >
                    <div class="text-[10px] font-medium text-gray-400 uppercase tracking-wide">
                        {{ metric.label }}
                    </div>
                    <div class="text-sm font-semibold text-gray-800">
                        {{ metric.value }}
                    </div>
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
                <div class="grid grid-cols-3 sm:grid-cols-5 lg:grid-cols-9 gap-3">
                    <div
                        v-for="metric in allMetrics"
                        :key="metric.label"
                        class="bg-gray-50 rounded-lg px-3 py-2"
                    >
                        <div class="text-[10px] font-medium text-gray-400 uppercase tracking-wide mb-0.5">
                            {{ metric.label }}
                        </div>
                        <div class="text-sm font-bold text-gray-800">
                            {{ metric.value }}
                        </div>
                    </div>
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
    max-height: 200px;
}
</style>