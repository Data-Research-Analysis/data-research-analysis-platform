<script setup lang="ts">
/**
 * ChannelAttributionTable — Displays attributed conversions, revenue,
 * and ROAS per channel for the selected attribution model.
 *
 * Values update reactively when the attribution model changes.
 * Includes a totals row and supports sorting by any column.
 */
import type { IChannelAttribution } from '@/composables/useAttribution';

interface Props {
    channels: IChannelAttribution[];
    isLoading?: boolean;
}

const props = withDefaults(defineProps<Props>(), { isLoading: false });

const sortBy = ref<'channel' | 'attributedConversions' | 'attributedRevenue' | 'attributedROAS' | 'conversionShare'>('attributedConversions');
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

const totals = computed(() => ({
    channel: 'Total',
    attributedConversions: props.channels.reduce((s, c) => s + c.attributedConversions, 0),
    attributedRevenue: props.channels.reduce((s, c) => s + c.attributedRevenue, 0),
    attributedROAS: 0, // computed below
    conversionShare: 100,
}));

// Recalculate total ROAS after summing spend implied by revenue / roas
const totalROAS = computed(() => {
    const totalRev = props.channels.reduce((s, c) => s + c.attributedRevenue, 0);
    const totalSpend = props.channels.reduce((s, c) => {
        return s + (c.attributedROAS > 0 ? c.attributedRevenue / c.attributedROAS : 0);
    }, 0);
    return totalSpend > 0 ? totalRev / totalSpend : 0;
});

function fmt(v: number, type: 'currency' | 'number' | 'ratio' | 'pct'): string {
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
    if (type === 'ratio') return `${v.toFixed(2)}x`;
    if (type === 'pct') return `${v.toFixed(1)}%`;
    return String(v);
}

function sortIcon(key: typeof sortBy.value) {
    if (sortBy.value !== key) return ['fas', 'sort'];
    return sortDir.value === 'asc' ? ['fas', 'sort-up'] : ['fas', 'sort-down'];
}

/** Get a channel icon based on name */
function channelIcon(channel: string): [string, string] {
    const lower = channel.toLowerCase();
    if (lower.includes('google')) return ['fab', 'google'];
    if (lower.includes('meta') || lower.includes('facebook')) return ['fab', 'meta'];
    if (lower.includes('linkedin')) return ['fab', 'linkedin'];
    if (lower.includes('email')) return ['fas', 'envelope'];
    if (lower.includes('organic')) return ['fas', 'leaf'];
    return ['fas', 'chart-bar'];
}
</script>

<template>
    <div class="channel-attribution-table">
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
                            @click="toggleSort('attributedConversions')"
                        >
                            <span class="inline-flex items-center gap-1 justify-end">
                                Attributed Conv.
                                <font-awesome-icon :icon="sortIcon('attributedConversions')" class="w-2.5 h-2.5 text-gray-400" />
                            </span>
                        </th>
                        <th
                            class="text-right py-2 px-3 text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:text-gray-700 select-none"
                            @click="toggleSort('attributedRevenue')"
                        >
                            <span class="inline-flex items-center gap-1 justify-end">
                                Attributed Revenue
                                <font-awesome-icon :icon="sortIcon('attributedRevenue')" class="w-2.5 h-2.5 text-gray-400" />
                            </span>
                        </th>
                        <th
                            class="text-right py-2 px-3 text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:text-gray-700 select-none"
                            @click="toggleSort('attributedROAS')"
                        >
                            <span class="inline-flex items-center gap-1 justify-end">
                                Attributed ROAS
                                <font-awesome-icon :icon="sortIcon('attributedROAS')" class="w-2.5 h-2.5 text-gray-400" />
                            </span>
                        </th>
                        <th
                            class="text-right py-2 px-3 text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:text-gray-700 select-none"
                            @click="toggleSort('conversionShare')"
                        >
                            <span class="inline-flex items-center gap-1 justify-end">
                                Conv. Share
                                <font-awesome-icon :icon="sortIcon('conversionShare')" class="w-2.5 h-2.5 text-gray-400" />
                            </span>
                        </th>
                    </tr>
                </thead>
                <tbody>
                    <tr
                        v-for="row in sorted"
                        :key="row.channel"
                        class="border-b border-gray-100 hover:bg-gray-50 transition-colors"
                    >
                        <td class="py-2.5 px-3">
                            <span class="inline-flex items-center gap-2">
                                <font-awesome-icon :icon="channelIcon(row.channel)" class="w-4 h-4 text-gray-400" />
                                <span class="font-medium text-gray-800">{{ row.channel }}</span>
                            </span>
                        </td>
                        <td class="py-2.5 px-3 text-right text-gray-800 font-medium">
                            {{ fmt(row.attributedConversions, 'number') }}
                        </td>
                        <td class="py-2.5 px-3 text-right text-gray-800">
                            {{ fmt(row.attributedRevenue, 'currency') }}
                        </td>
                        <td class="py-2.5 px-3 text-right">
                            <span
                                class="inline-block px-2 py-0.5 rounded text-xs font-medium"
                                :class="row.attributedROAS >= 3 ? 'bg-emerald-50 text-emerald-700' : row.attributedROAS >= 1.5 ? 'bg-amber-50 text-amber-700' : 'bg-red-50 text-red-600'"
                            >
                                {{ fmt(row.attributedROAS, 'ratio') }}
                            </span>
                        </td>
                        <td class="py-2.5 px-3 text-right">
                            <!-- Conversion share bar -->
                            <div class="flex items-center gap-2 justify-end">
                                <div class="w-16 h-1.5 bg-gray-100 rounded-full overflow-hidden">
                                    <div
                                        class="h-full bg-blue-500 rounded-full transition-all duration-300"
                                        :style="{ width: row.conversionShare + '%' }"
                                    />
                                </div>
                                <span class="text-xs text-gray-500 w-10 text-right">
                                    {{ fmt(row.conversionShare, 'pct') }}
                                </span>
                            </div>
                        </td>
                    </tr>

                    <!-- Totals row -->
                    <tr class="bg-gray-50 font-semibold border-t-2 border-gray-200">
                        <td class="py-2.5 px-3 text-gray-700">
                            <span class="inline-flex items-center gap-2">
                                <font-awesome-icon :icon="['fas', 'sigma']" class="w-4 h-4 text-gray-400" />
                                {{ totals.channel }}
                            </span>
                        </td>
                        <td class="py-2.5 px-3 text-right text-gray-800">
                            {{ fmt(totals.attributedConversions, 'number') }}
                        </td>
                        <td class="py-2.5 px-3 text-right text-gray-800">
                            {{ fmt(totals.attributedRevenue, 'currency') }}
                        </td>
                        <td class="py-2.5 px-3 text-right">
                            <span class="text-xs text-gray-600">{{ fmt(totalROAS, 'ratio') }}</span>
                        </td>
                        <td class="py-2.5 px-3 text-right">
                            <span class="text-xs text-gray-600">100%</span>
                        </td>
                    </tr>
                </tbody>
            </table>
        </div>

        <!-- Empty state -->
        <div v-else class="text-center py-10">
            <font-awesome-icon :icon="['fas', 'table']" class="text-3xl text-gray-300 mb-3" />
            <p class="text-sm text-gray-500">No attribution data available</p>
            <p class="text-xs text-gray-400 mt-1">
                Attribution data will appear once campaign touchpoint data is available
            </p>
        </div>
    </div>
</template>