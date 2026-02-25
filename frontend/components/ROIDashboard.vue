<script setup lang="ts">
import type { IROIMetrics } from '@/stores/attribution';

const props = defineProps<{
    metrics: IROIMetrics[];
    loading?: boolean;
}>();

type SortKey = 'roas' | 'roi' | 'totalSpend' | 'totalConversions';
const sortKey = ref<SortKey>('roas');
const sortDir = ref<'asc' | 'desc'>('desc');

function toggleSort(key: SortKey) {
    if (sortKey.value === key) {
        sortDir.value = sortDir.value === 'desc' ? 'asc' : 'desc';
    } else {
        sortKey.value = key;
        sortDir.value = 'desc';
    }
}

const sortedMetrics = computed(() => {
    return [...props.metrics].sort((a, b) => {
        const aVal = (a[sortKey.value] ?? 0) as number;
        const bVal = (b[sortKey.value] ?? 0) as number;
        return sortDir.value === 'desc' ? bVal - aVal : aVal - bVal;
    });
});

const raosChartData = computed(() =>
    [...props.metrics]
        .filter((m) => (m.roas ?? 0) > 0)
        .sort((a, b) => (b.roas ?? 0) - (a.roas ?? 0))
);

const maxRoas = computed(() => Math.max(...raosChartData.value.map((m) => m.roas ?? 0), 1));

// KPI aggregates
const totalSpend = computed(() => props.metrics.reduce((s, m) => s + (m.totalSpend ?? 0), 0));
const totalRevenue = computed(() => props.metrics.reduce((s, m) => s + m.totalRevenue, 0));
const avgRoas = computed(() => {
    const items = props.metrics.filter((m) => m.roas != null);
    if (!items.length) return null;
    return items.reduce((s, m) => s + (m.roas ?? 0), 0) / items.length;
});
const avgRoi = computed(() => {
    const items = props.metrics.filter((m) => m.roi != null);
    if (!items.length) return null;
    return items.reduce((s, m) => s + (m.roi ?? 0), 0) / items.length;
});

function fmtCurrency(val: number | null | undefined): string {
    if (val == null) return '—';
    return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(val);
}

function fmtNum(val: number | null | undefined, decimals = 2): string {
    if (val == null) return '—';
    return val.toFixed(decimals);
}

function fmtPct(val: number | null | undefined): string {
    if (val == null) return '—';
    return `${val.toFixed(1)}%`;
}

function roiColor(roi: number | undefined): string {
    if (roi == null) return 'text-gray-500';
    return roi >= 0 ? 'text-green-600' : 'text-red-600';
}

function sortIcon(key: SortKey): string[] {
    if (sortKey.value !== key) return ['fas', 'sort'];
    return sortDir.value === 'desc' ? ['fas', 'sort-down'] : ['fas', 'sort-up'];
}
</script>

<template>
    <!-- Loading skeleton -->
    <div v-if="loading" class="space-y-6 animate-pulse">
        <div class="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div v-for="i in 4" :key="i" class="h-24 bg-gray-200 rounded-xl"></div>
        </div>
        <div class="h-48 bg-gray-100 rounded-xl"></div>
    </div>

    <!-- Empty state -->
    <div v-else-if="metrics.length === 0" class="py-16 text-center text-gray-400">
        <font-awesome-icon :icon="['fas', 'chart-bar']" class="text-4xl mb-3 text-gray-300" />
        <p class="text-sm font-medium text-gray-500">No ROI data available</p>
        <p class="text-xs mt-1">Add channel spend data or run an ROI analysis to see results.</p>
    </div>

    <div v-else class="space-y-6">
        <!-- KPI Cards -->
        <div class="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div class="bg-white rounded-xl border border-gray-200 p-4">
                <p class="text-xs text-gray-400 uppercase tracking-wide mb-1">Total Spend</p>
                <p class="text-2xl font-bold text-gray-900">{{ fmtCurrency(totalSpend) }}</p>
            </div>
            <div class="bg-white rounded-xl border border-gray-200 p-4">
                <p class="text-xs text-gray-400 uppercase tracking-wide mb-1">Total Revenue</p>
                <p class="text-2xl font-bold text-green-600">{{ fmtCurrency(totalRevenue) }}</p>
            </div>
            <div class="bg-white rounded-xl border border-gray-200 p-4">
                <p class="text-xs text-gray-400 uppercase tracking-wide mb-1">Avg ROAS</p>
                <p class="text-2xl font-bold text-gray-900">
                    {{ avgRoas != null ? `${avgRoas.toFixed(2)}x` : '—' }}
                </p>
            </div>
            <div class="bg-white rounded-xl border border-gray-200 p-4">
                <p class="text-xs text-gray-400 uppercase tracking-wide mb-1">Avg ROI</p>
                <p class="text-2xl font-bold" :class="roiColor(avgRoi ?? undefined)">
                    {{ avgRoi != null ? fmtPct(avgRoi) : '—' }}
                </p>
            </div>
        </div>

        <!-- ROAS Bar Chart -->
        <div v-if="raosChartData.length > 0" class="bg-white rounded-xl border border-gray-200 p-5">
            <h3 class="text-sm font-semibold text-gray-700 mb-4">ROAS by Channel</h3>
            <div class="space-y-2.5">
                <div v-for="m in raosChartData" :key="m.channelId" class="flex items-center gap-3">
                    <span class="text-xs text-gray-600 w-28 flex-shrink-0 truncate font-medium">{{ m.channelName }}</span>
                    <div class="flex-1 h-6 bg-gray-100 rounded-full overflow-hidden">
                        <div
                            class="h-full bg-gradient-to-r from-blue-500 to-blue-400 rounded-full transition-all duration-500 flex items-center justify-end pr-2"
                            :style="{ width: `${Math.max(4, ((m.roas ?? 0) / maxRoas) * 100)}%` }"
                        >
                            <span class="text-xs font-semibold text-white">{{ fmtNum(m.roas) }}x</span>
                        </div>
                    </div>
                </div>
            </div>
        </div>

        <!-- Sortable Table -->
        <div class="bg-white rounded-xl border border-gray-200 overflow-hidden">
            <div class="overflow-x-auto">
                <table class="w-full text-sm">
                    <thead class="bg-gray-50 border-b border-gray-200">
                        <tr>
                            <th class="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Channel</th>
                            <th class="text-right px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">
                                <button type="button" class="flex items-center gap-1 ml-auto hover:text-gray-700 transition-colors cursor-pointer" @click="toggleSort('totalSpend')">
                                    Spend <font-awesome-icon :icon="sortIcon('totalSpend')" class="text-xs" />
                                </button>
                            </th>
                            <th class="text-right px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Revenue</th>
                            <th class="text-right px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">
                                <button type="button" class="flex items-center gap-1 ml-auto hover:text-gray-700 transition-colors cursor-pointer" @click="toggleSort('roas')">
                                    ROAS <font-awesome-icon :icon="sortIcon('roas')" class="text-xs" />
                                </button>
                            </th>
                            <th class="text-right px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">
                                <button type="button" class="flex items-center gap-1 ml-auto hover:text-gray-700 transition-colors cursor-pointer" @click="toggleSort('roi')">
                                    ROI <font-awesome-icon :icon="sortIcon('roi')" class="text-xs" />
                                </button>
                            </th>
                            <th class="text-right px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">
                                <button type="button" class="flex items-center gap-1 ml-auto hover:text-gray-700 transition-colors cursor-pointer" @click="toggleSort('totalConversions')">
                                    Conversions <font-awesome-icon :icon="sortIcon('totalConversions')" class="text-xs" />
                                </button>
                            </th>
                            <th class="text-right px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">CPC</th>
                        </tr>
                    </thead>
                    <tbody class="divide-y divide-gray-100">
                        <tr v-for="m in sortedMetrics" :key="m.channelId" class="hover:bg-gray-50 transition-colors">
                            <td class="px-4 py-3 font-medium text-gray-800">{{ m.channelName }}</td>
                            <td class="px-4 py-3 text-right text-gray-600">{{ fmtCurrency(m.totalSpend) }}</td>
                            <td class="px-4 py-3 text-right font-semibold text-green-600">{{ fmtCurrency(m.totalRevenue) }}</td>
                            <td class="px-4 py-3 text-right font-semibold text-gray-800">
                                {{ m.roas != null ? `${fmtNum(m.roas)}x` : '—' }}
                            </td>
                            <td class="px-4 py-3 text-right font-semibold" :class="roiColor(m.roi)">
                                {{ fmtPct(m.roi) }}
                            </td>
                            <td class="px-4 py-3 text-right text-gray-600">{{ m.totalConversions.toLocaleString() }}</td>
                            <td class="px-4 py-3 text-right text-gray-600">{{ fmtCurrency(m.costPerConversion) }}</td>
                        </tr>
                    </tbody>
                </table>
            </div>
        </div>
    </div>
</template>
