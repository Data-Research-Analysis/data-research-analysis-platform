<script setup lang="ts">
import type { IChannelMetrics } from '~/types/IMarketingHub';

interface Props {
    channels: IChannelMetrics[];
    isLoading?: boolean;
}

const props = withDefaults(defineProps<Props>(), {
    isLoading: false,
});

type SortKey = keyof IChannelMetrics;

const sortKey = ref<SortKey>('spend');
const sortAsc = ref(false);

const columns: Array<{ key: SortKey; label: string; hint?: string }> = [
    { key: 'channelLabel', label: 'Channel' },
    { key: 'spend', label: 'Spend' },
    { key: 'impressions', label: 'Impressions', hint: 'GA4: Sessions' },
    { key: 'clicks', label: 'Clicks', hint: 'GA4: Users' },
    { key: 'ctr', label: 'CTR' },
    { key: 'conversions', label: 'Conversions' },
    { key: 'cpl', label: 'CPL' },
    { key: 'roas', label: 'ROAS' },
];

const sorted = computed(() => {
    return [...props.channels].sort((a, b) => {
        const av = a[sortKey.value];
        const bv = b[sortKey.value];
        const la = typeof av === 'string' ? av.toLowerCase() : Number(av);
        const lb = typeof bv === 'string' ? bv.toLowerCase() : Number(bv);
        if (la < lb) return sortAsc.value ? -1 : 1;
        if (la > lb) return sortAsc.value ? 1 : -1;
        return 0;
    });
});

function toggleSort(key: SortKey) {
    if (sortKey.value === key) {
        sortAsc.value = !sortAsc.value;
    } else {
        sortKey.value = key;
        sortAsc.value = false;
    }
}

const isGA4 = (ch: IChannelMetrics) => ch.channelType === 'google_analytics';

function fmtCurrency(v: number): string {
    if (v === 0) return '—';
    if (v >= 1_000_000) return `$${(v / 1_000_000).toFixed(1)}M`;
    if (v >= 1_000) return `$${(v / 1_000).toFixed(1)}k`;
    return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(v);
}

function fmtLarge(v: number): string {
    if (v === 0) return '0';
    if (v >= 1_000_000) return `${(v / 1_000_000).toFixed(1)}M`;
    if (v >= 1_000) return `${(v / 1_000).toFixed(1)}k`;
    return new Intl.NumberFormat('en-US').format(Math.round(v));
}

function fmtPct(v: number): string {
    return `${(v * 100).toFixed(2)}%`;
}

function fmtMultiplier(v: number): string {
    return v > 0 ? `${v.toFixed(2)}×` : '—';
}

const CHANNEL_ICON: Record<string, string[]> = {
    google_ads: ['fab', 'google'],
    meta_ads: ['fab', 'facebook'],
    linkedin_ads: ['fab', 'linkedin'],
    google_analytics: ['fab', 'google'],
};

function channelIcon(type: string): string[] {
    if (type.startsWith('offline_')) return ['fas', 'building'];
    return CHANNEL_ICON[type] ?? ['fas', 'chart-bar'];
}
</script>

<template>
    <div class="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <div class="px-5 py-4 border-b border-gray-100 flex items-center gap-2">
            <font-awesome-icon :icon="['fas', 'table-columns']" class="text-primary-blue-100" />
            <h3 class="text-sm font-semibold text-gray-700">Channel Comparison</h3>
        </div>

        <!-- Loading skeleton -->
        <div v-if="isLoading" class="p-5 space-y-3">
            <div v-for="i in 3" :key="i" class="h-8 rounded bg-gray-100 animate-pulse"></div>
        </div>

        <!-- Empty state -->
        <div v-else-if="channels.length === 0" class="flex flex-col items-center justify-center py-12 text-center px-6">
            <font-awesome-icon :icon="['fas', 'plug-circle-xmark']" class="text-3xl text-gray-300 mb-3" />
            <p class="text-sm font-medium text-gray-500">No channel data for this period</p>
            <p class="text-xs text-gray-400 mt-1">Connect an ad data source to see cross-channel metrics here</p>
        </div>

        <!-- Table -->
        <div v-else class="overflow-x-auto">
            <table class="w-full text-sm">
                <thead class="bg-gray-50">
                    <tr>
                        <th
                            v-for="col in columns"
                            :key="col.key"
                            class="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide cursor-pointer select-none whitespace-nowrap hover:text-gray-700 transition-colors"
                            @click="toggleSort(col.key)"
                        >
                            <span class="flex items-center gap-1">
                                {{ col.label }}
                                <font-awesome-icon
                                    v-if="sortKey === col.key"
                                    :icon="['fas', sortAsc ? 'arrow-up' : 'arrow-down']"
                                    class="text-primary-blue-100 text-xs"
                                />
                                <font-awesome-icon
                                    v-else
                                    :icon="['fas', 'arrows-up-down']"
                                    class="text-gray-300 text-xs"
                                />
                            </span>
                        </th>
                    </tr>
                </thead>
                <tbody class="divide-y divide-gray-100">
                    <tr
                        v-for="ch in sorted"
                        :key="ch.channelType"
                        class="hover:bg-gray-50 transition-colors"
                    >
                        <!-- Channel name -->
                        <td class="px-4 py-3 font-medium text-gray-800 whitespace-nowrap">
                            <span class="flex items-center gap-2">
                                <font-awesome-icon :icon="(channelIcon(ch.channelType) as any)" class="text-gray-400 w-4" />
                                {{ ch.channelLabel }}
                                <span v-if="isGA4(ch)" class="text-xs text-primary-blue-100 font-semibold bg-blue-50 px-1.5 py-0.5 rounded">GA4</span>
                            </span>
                        </td>
                        <!-- Spend -->
                        <td class="px-4 py-3 text-gray-700 whitespace-nowrap">
                            <span v-if="isGA4(ch)" class="text-gray-300">—</span>
                            <span v-else>{{ fmtCurrency(ch.spend) }}</span>
                        </td>
                        <!-- Impressions / Sessions -->
                        <td class="px-4 py-3 text-gray-700 whitespace-nowrap">
                            <span v-if="ch.impressions === 0 && ch.channelType.startsWith('offline_')" class="text-gray-300">—</span>
                            <span v-else>{{ fmtLarge(ch.impressions) }}</span>
                        </td>
                        <!-- Clicks / Users -->
                        <td class="px-4 py-3 text-gray-700 whitespace-nowrap">
                            <span v-if="ch.clicks === 0 && (ch.channelType.startsWith('offline_') || isGA4(ch))" class="text-gray-300">—</span>
                            <span v-else>{{ fmtLarge(ch.clicks) }}</span>
                        </td>
                        <!-- CTR -->
                        <td class="px-4 py-3 text-gray-700 whitespace-nowrap">
                            <span v-if="isGA4(ch) || ch.channelType.startsWith('offline_')" class="text-gray-300">—</span>
                            <span v-else>{{ fmtPct(ch.ctr) }}</span>
                        </td>
                        <!-- Conversions -->
                        <td class="px-4 py-3 text-gray-700 whitespace-nowrap">
                            {{ ch.conversions > 0 ? fmtLarge(ch.conversions) : '—' }}
                        </td>
                        <!-- CPL -->
                        <td class="px-4 py-3 text-gray-700 whitespace-nowrap">
                            <span v-if="isGA4(ch)" class="text-gray-300">—</span>
                            <span v-else>{{ ch.cpl > 0 ? fmtCurrency(ch.cpl) : '—' }}</span>
                        </td>
                        <!-- ROAS -->
                        <td class="px-4 py-3 text-gray-700 whitespace-nowrap">
                            <span v-if="isGA4(ch) || ch.channelType.startsWith('offline_')" class="text-gray-300">—</span>
                            <span v-else>{{ fmtMultiplier(ch.roas) }}</span>
                        </td>
                    </tr>
                </tbody>
            </table>
        </div>
    </div>
</template>
