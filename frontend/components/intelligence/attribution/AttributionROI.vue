<script setup lang="ts">
/**
 * AttributionROI — Displays attributed ROI per channel as a sortable
 * table with horizontal bar visualization for ROAS comparison.
 *
 * Each row shows channel spend, attributed conversions, attributed
 * revenue, and attributed ROAS with color-coded badges.
 */
import type { IAttributionROI } from '@/composables/useAttribution';

interface Props {
    channels: IAttributionROI[];
    isLoading?: boolean;
}

const props = withDefaults(defineProps<Props>(), { isLoading: false });

const sortBy = ref<'channel' | 'spend' | 'attributedConversions' | 'attributedRevenue' | 'attributedROAS'>('attributedROAS');
const sortDir = ref<'asc' | 'desc'>('desc');

function toggleSort(key: typeof sortBy.value) {
    if (sortBy.value === key) {
        sortDir.value = sortDir.value === 'asc' ? 'desc' : 'asc';
    } else {
        sortBy.value = key;
        sortDir.value = 'desc';
    }
}

const sorted = computed(() => {
    const data = [...props.channels];
    const dir = sortDir.value === 'asc' ? 1 : -1;
    return data.sort((a, b) => {
        if (sortBy.value === 'channel') {
            return a.channel.localeCompare(b.channel) * dir;
        }
        return ((a[sortBy.value] ?? 0) - (b[sortBy.value] ?? 0)) * dir;
    });
});

const maxROAS = computed(() => {
    if (props.channels.length === 0) return 1;
    return Math.max(...props.channels.map(c => c.attributedROAS));
});

const totals = computed(() => {
    const totalSpend = props.channels.reduce((s, c) => s + c.spend, 0);
    const totalConv = props.channels.reduce((s, c) => s + c.attributedConversions, 0);
    const totalRev = props.channels.reduce((s, c) => s + c.attributedRevenue, 0);
    return {
        channel: 'Total',
        spend: totalSpend,
        attributedConversions: totalConv,
        attributedRevenue: totalRev,
        attributedROAS: totalSpend > 0 ? totalRev / totalSpend : 0,
    };
});

function fmt(v: number, type: 'currency' | 'number' | 'ratio'): string {
    if (type === 'currency') {
        if (v >= 1_000_000) return `$${(v / 1_000_000).toFixed(1)}M`;
        if (v >= 1_000) return `$${(v / 1_000).toFixed(1)}K`;
        return `$${v.toFixed(2)}`;
    }
    if (type === 'number') {
        if (v >= 1_000_000) return `${(v / 1_000_000).toFixed(1)}M`;
        if (v >= 1_000) return `${(v / 1_000).toFixed(1)}K`;
        return v.toLocaleString();
    }
    return `${v.toFixed(2)}x`;
}

function sortIcon(key: typeof sortBy.value) {
    if (sortBy.value !== key) return ['fas', 'sort'];
    return sortDir.value === 'asc' ? ['fas', 'sort-up'] : ['fas', 'sort-down'];
}

function roasBadgeClass(roas: number): string {
    if (roas >= 4) return 'bg-emerald-50 text-emerald-700 border-emerald-200';
    if (roas >= 2) return 'bg-emerald-50 text-emerald-600 border-emerald-200';
    if (roas >= 1) return 'bg-amber-50 text-amber-700 border-amber-200';
    return 'bg-red-50 text-red-600 border-red-200';
}

/** Net profit indicator */
function netProfit(spend: number, revenue: number): { value: string; positive: boolean } {
    const profit = revenue - spend;
    const abs = Math.abs(profit);
    let formatted: string;
    if (abs >= 1_000_000) formatted = `$${(abs / 1_000_000).toFixed(1)}M`;
    else if (abs >= 1_000) formatted = `$${(abs / 1_000).toFixed(1)}K`;
    else formatted = `$${abs.toFixed(2)}`;
    return { value: profit >= 0 ? `+${formatted}` : `-${formatted}`, positive: profit >= 0 };
}
</script>

<template>
    <div class="attribution-roi">
        <!-- Loading skeleton -->
        <div v-if="isLoading" class="space-y-2">
            <div v-for="i in 4" :key="i" class="h-10 bg-gray-100 rounded animate-pulse" />
        </div>

        <!-- Table -->
        <div v-else-if="channels.length > 0" class="overflow-x-auto">
            <table class="w-full text-sm">
                <thead>
                    <tr class="border-b border-gray-200">
                        <th
                            class="text-left py-2 px-3 text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:text-gray-700 select-none"
                            @click="toggleSort('channel')"
                        >
                            <span class="inline-flex items-center gap-1">
                                Channel
                                <font-awesome-icon :icon="sortIcon('channel')" class="w-2.5 h-2.5 text-gray-400" />
                            </span>
                        </th>
                        <th
                            class="text-right py-2 px-3 text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:text-gray-700 select-none"
                            @click="toggleSort('spend')"
                        >
                            <span class="inline-flex items-center gap-1 justify-end">
                                Spend
                                <font-awesome-icon :icon="sortIcon('spend')" class="w-2.5 h-2.5 text-gray-400" />
                            </span>
                        </th>
                        <th
                            class="text-right py-2 px-3 text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:text-gray-700 select-none"
                            @click="toggleSort('attributedConversions')"
                        >
                            <span class="inline-flex items-center gap-1 justify-end">
                                Attr. Conv.
                                <font-awesome-icon :icon="sortIcon('attributedConversions')" class="w-2.5 h-2.5 text-gray-400" />
                            </span>
                        </th>
                        <th
                            class="text-right py-2 px-3 text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:text-gray-700 select-none"
                            @click="toggleSort('attributedRevenue')"
                        >
                            <span class="inline-flex items-center gap-1 justify-end">
                                Attr. Revenue
                                <font-awesome-icon :icon="sortIcon('attributedRevenue')" class="w-2.5 h-2.5 text-gray-400" />
                            </span>
                        </th>
                        <th
                            class="text-right py-2 px-3 text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:text-gray-700 select-none"
                            @click="toggleSort('attributedROAS')"
                        >
                            <span class="inline-flex items-center gap-1 justify-end">
                                Attr. ROAS
                                <font-awesome-icon :icon="sortIcon('attributedROAS')" class="w-2.5 h-2.5 text-gray-400" />
                            </span>
                        </th>
                        <th class="text-right py-2 px-3 text-xs font-medium text-gray-500 uppercase tracking-wider">
                            Net Profit
                        </th>
                        <th class="text-center py-2 px-3 text-xs font-medium text-gray-500 uppercase tracking-wider w-24">
                            ROAS Bar
                        </th>
                    </tr>
                </thead>
                <tbody>
                    <tr
                        v-for="row in sorted"
                        :key="row.channel"
                        class="border-b border-gray-100 hover:bg-gray-50 transition-colors"
                    >
                        <td class="py-2.5 px-3 font-medium text-gray-800">{{ row.channel }}</td>
                        <td class="py-2.5 px-3 text-right text-gray-600">{{ fmt(row.spend, 'currency') }}</td>
                        <td class="py-2.5 px-3 text-right text-gray-800">{{ fmt(row.attributedConversions, 'number') }}</td>
                        <td class="py-2.5 px-3 text-right text-gray-800 font-medium">{{ fmt(row.attributedRevenue, 'currency') }}</td>
                        <td class="py-2.5 px-3 text-right">
                            <span
                                class="inline-block px-2 py-0.5 rounded border text-xs font-semibold"
                                :class="roasBadgeClass(row.attributedROAS)"
                            >
                                {{ fmt(row.attributedROAS, 'ratio') }}
                            </span>
                        </td>
                        <td class="py-2.5 px-3 text-right">
                            <span
                                class="text-xs font-medium"
                                :class="netProfit(row.spend, row.attributedRevenue).positive ? 'text-emerald-600' : 'text-red-600'"
                            >
                                {{ netProfit(row.spend, row.attributedRevenue).value }}
                            </span>
                        </td>
                        <td class="py-2.5 px-3">
                            <div class="w-full h-2.5 bg-gray-100 rounded-full overflow-hidden mx-auto">
                                <div
                                    class="h-full rounded-full transition-all duration-500"
                                    :class="row.attributedROAS >= 2 ? 'bg-emerald-400' : row.attributedROAS >= 1 ? 'bg-amber-400' : 'bg-red-400'"
                                    :style="{ width: Math.min((row.attributedROAS / maxROAS) * 100, 100) + '%' }"
                                />
                            </div>
                        </td>
                    </tr>

                    <!-- Totals row -->
                    <tr class="bg-gray-50 font-semibold border-t-2 border-gray-200">
                        <td class="py-2.5 px-3 text-gray-700">
                            <font-awesome-icon :icon="['fas', 'sigma']" class="mr-1.5 text-gray-400" />
                            {{ totals.channel }}
                        </td>
                        <td class="py-2.5 px-3 text-right text-gray-600">{{ fmt(totals.spend, 'currency') }}</td>
                        <td class="py-2.5 px-3 text-right text-gray-800">{{ fmt(totals.attributedConversions, 'number') }}</td>
                        <td class="py-2.5 px-3 text-right text-gray-800">{{ fmt(totals.attributedRevenue, 'currency') }}</td>
                        <td class="py-2.5 px-3 text-right">
                            <span class="text-xs font-semibold text-gray-600">{{ fmt(totals.attributedROAS, 'ratio') }}</span>
                        </td>
                        <td class="py-2.5 px-3 text-right">
                            <span
                                class="text-xs font-medium"
                                :class="netProfit(totals.spend, totals.attributedRevenue).positive ? 'text-emerald-600' : 'text-red-600'"
                            >
                                {{ netProfit(totals.spend, totals.attributedRevenue).value }}
                            </span>
                        </td>
                        <td />
                    </tr>
                </tbody>
            </table>
        </div>

        <!-- Empty state -->
        <div v-else class="text-center py-10">
            <font-awesome-icon :icon="['fas', 'chart-line']" class="text-3xl text-gray-300 mb-3" />
            <p class="text-sm text-gray-500">No attribution ROI data available</p>
            <p class="text-xs text-gray-400 mt-1">
                ROI data will appear once campaign spend and conversion data is available
            </p>
        </div>
    </div>
</template>