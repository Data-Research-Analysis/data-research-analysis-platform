<script setup lang="ts">
import type { IChannelComparisonTableConfig } from '~/types/dashboard-widgets';

interface Props {
    chartId: string | number;
    projectId?: number;
    marketingConfig?: IChannelComparisonTableConfig;
    width?: number;
    height?: number;
}

const props = withDefaults(defineProps<Props>(), {
    width: 600,
    height: 400,
});

const config = computed<IChannelComparisonTableConfig>(() => ({
    columns: ['spend', 'impressions', 'clicks', 'ctr', 'conversions', 'cpl', 'roas'],
    sort_by: 'spend',
    ...(props.marketingConfig ?? {}),
}));

const COLUMN_LABELS: Record<string, string> = {
    spend: 'Spend',
    impressions: 'Impressions',
    clicks: 'Clicks',
    ctr: 'CTR',
    conversions: 'Conversions',
    cpl: 'CPL',
    roas: 'ROAS',
    pipeline_value: 'Pipeline',
};

interface ChannelRow {
    channel: string;
    spend: number;
    impressions: number;
    clicks: number;
    ctr: number;
    conversions: number;
    cpl: number;
    roas: number;
    pipeline_value: number;
}

const rows = ref<ChannelRow[]>([]);
const isLoading = ref(true);
const sortColumn = ref(config.value.sort_by ?? 'spend');
const sortAsc = ref(false);

function formatCell(col: string, val: number): string {
    if (col === 'spend' || col === 'cpl' || col === 'pipeline_value') {
        if (val >= 1_000_000) return `$${(val / 1_000_000).toFixed(1)}M`;
        if (val >= 1_000) return `$${(val / 1_000).toFixed(0)}k`;
        return `$${val.toLocaleString()}`;
    }
    if (col === 'ctr') return `${(val * 100).toFixed(2)}%`;
    if (col === 'roas') return `${val.toFixed(2)}×`;
    if (val >= 1_000_000) return `${(val / 1_000_000).toFixed(1)}M`;
    if (val >= 1_000) return `${(val / 1_000).toFixed(0)}k`;
    return val.toLocaleString();
}

const sortedRows = computed(() => {
    const col = sortColumn.value as keyof ChannelRow;
    return [...rows.value].sort((a, b) => {
        const av = a[col] as number;
        const bv = b[col] as number;
        return sortAsc.value ? av - bv : bv - av;
    });
});

function setSort(col: string) {
    if (sortColumn.value === col) {
        sortAsc.value = !sortAsc.value;
    } else {
        sortColumn.value = col;
        sortAsc.value = false;
    }
}

const { data: widgetData, isLoading: widgetLoading } = useWidgetData<{ channels: any[]; totals: any }>(
    'channel_comparison_table',
    computed(() => props.projectId ?? 0),
    config,
);

watch(widgetLoading, (v) => (isLoading.value = v), { immediate: true });
watch(
    widgetData,
    (d) => {
        if (!d?.channels) return;
        rows.value = d.channels.map((c: any) => ({
            channel: c.channel ?? c.channel_name ?? c.platform ?? 'Unknown',
            spend: c.spend ?? c.total_spend ?? 0,
            impressions: c.impressions ?? c.total_impressions ?? 0,
            clicks: c.clicks ?? c.total_clicks ?? 0,
            ctr: c.ctr ?? (c.clicks && c.impressions ? c.clicks / c.impressions : 0),
            conversions: c.conversions ?? c.total_conversions ?? 0,
            cpl: c.cpl ?? (c.spend && c.conversions ? c.spend / c.conversions : 0),
            roas: c.roas ?? 0,
            pipeline_value: c.pipeline_value ?? 0,
        }));
    },
    { immediate: true },
);
</script>

<template>
    <div class="flex flex-col p-4 bg-white rounded-xl border border-gray-200 w-full h-full overflow-hidden">
        <div class="flex items-center gap-2 mb-3">
            <font-awesome-icon :icon="['fas', 'table-columns']" class="text-primary-blue-100" />
            <h3 class="text-sm font-bold text-gray-700">Channel Comparison</h3>
            <span v-if="config.campaign_id" class="ml-auto text-xs text-gray-400 truncate">
                Campaign filter active
            </span>
        </div>

        <!-- Loading skeleton -->
        <div v-if="isLoading" class="space-y-2 animate-pulse">
            <div v-for="i in 5" :key="i" class="h-8 bg-gray-100 rounded"></div>
        </div>

        <!-- Table -->
        <div v-else class="overflow-x-auto overflow-y-auto flex-1">
            <table class="w-full text-sm border-collapse">
                <thead class="bg-gray-50 sticky top-0 z-10">
                    <tr>
                        <th class="px-3 py-2 text-left font-semibold text-gray-600 whitespace-nowrap border-b border-gray-200">
                            Channel
                        </th>
                        <th
                            v-for="col in config.columns"
                            :key="col"
                            class="px-3 py-2 text-right font-semibold text-gray-600 whitespace-nowrap border-b border-gray-200 cursor-pointer hover:bg-gray-100 select-none"
                            @click="setSort(col)"
                        >
                            {{ COLUMN_LABELS[col] ?? col }}
                            <font-awesome-icon
                                v-if="sortColumn === col"
                                :icon="['fas', sortAsc ? 'sort-up' : 'sort-down']"
                                class="ml-1 text-primary-blue-100"
                            />
                            <font-awesome-icon
                                v-else
                                :icon="['fas', 'sort']"
                                class="ml-1 text-gray-300"
                            />
                        </th>
                    </tr>
                </thead>
                <tbody>
                    <tr v-if="sortedRows.length === 0">
                        <td :colspan="config.columns.length + 1" class="px-3 py-8 text-center text-gray-400 text-sm">
                            <font-awesome-icon :icon="['fas', 'circle-info']" class="mr-2" />
                            No channel data available. Connect a data source to populate this widget.
                        </td>
                    </tr>
                    <tr
                        v-for="(row, idx) in sortedRows"
                        :key="row.channel"
                        class="hover:bg-blue-50 transition-colors"
                        :class="{ 'bg-white': idx % 2 === 0, 'bg-gray-25': idx % 2 !== 0 }"
                    >
                        <td class="px-3 py-2 font-medium text-gray-800 whitespace-nowrap border-b border-gray-100">
                            {{ row.channel }}
                        </td>
                        <td
                            v-for="col in config.columns"
                            :key="col"
                            class="px-3 py-2 text-right tabular-nums text-gray-700 border-b border-gray-100"
                            :class="{ 'font-semibold text-primary-blue-100': sortColumn === col }"
                        >
                            {{ formatCell(col, (row as any)[col] ?? 0) }}
                        </td>
                    </tr>
                </tbody>
            </table>
        </div>
    </div>
</template>
