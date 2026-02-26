<script setup lang="ts">
import type { IRoiWaterfallConfig } from '~/types/dashboard-widgets';

interface Props {
    chartId: string | number;
    projectId?: number;
    marketingConfig?: IRoiWaterfallConfig;
    width?: number;
    height?: number;
}

const props = withDefaults(defineProps<Props>(), {
    width: 600,
    height: 400,
});

const config = computed<IRoiWaterfallConfig>(() => ({
    include_offline: false,
    group_by: 'channel',
    ...(props.marketingConfig ?? {}),
}));

interface WaterfallBar {
    label: string;
    spend: number;
    revenue: number;
    colour: string;
}

const bars = ref<WaterfallBar[]>([]);
const isLoading = ref(true);

const CHANNEL_COLOURS: string[] = [
    '#4285f4', '#ea4335', '#fbbc04', '#34a853', '#9c27b0', '#0a66c2', '#ff6d00',
];

const maxValue = computed(() => {
    if (bars.value.length === 0) return 1;
    return Math.max(...bars.value.map((b) => Math.max(b.spend, b.revenue)));
});

function barWidthPct(val: number): string {
    return `${Math.max(2, (val / maxValue.value) * 100)}%`;
}

function formatCurrency(val: number): string {
    if (val >= 1_000_000) return `$${(val / 1_000_000).toFixed(1)}M`;
    if (val >= 1_000) return `$${(val / 1_000).toFixed(0)}k`;
    return `$${val.toLocaleString()}`;
}

const totalSpend = computed(() => bars.value.reduce((s, b) => s + b.spend, 0));
const totalRevenue = computed(() => bars.value.reduce((s, b) => s + b.revenue, 0));
const overallRoi = computed(() => (totalSpend.value > 0 ? totalRevenue.value / totalSpend.value : 0));

const { data: widgetData, isLoading: widgetLoading } = useWidgetData<{ channels: WaterfallBar[]; total_spend: number; total_revenue: number; overall_roas: number }>(
    'roi_waterfall',
    computed(() => props.projectId ?? 0),
    config,
);

watch(widgetLoading, (v) => (isLoading.value = v), { immediate: true });
watch(
    widgetData,
    (d) => {
        if (!d?.channels) return;
        bars.value = d.channels.map((c, idx) => ({
            label: c.label,
            spend: c.spend,
            revenue: c.revenue,
            colour: c.colour ?? CHANNEL_COLOURS[idx % CHANNEL_COLOURS.length],
        }));
    },
    { immediate: true },
);
</script>

<template>
    <div class="flex flex-col p-4 bg-white rounded-xl border border-gray-200 w-full h-full overflow-hidden">
        <div class="flex items-center gap-2 mb-3">
            <font-awesome-icon :icon="['fas', 'chart-waterfall']" class="text-primary-blue-100" />
            <h3 class="text-sm font-bold text-gray-700">ROI Waterfall</h3>
            <span class="ml-auto text-xs font-semibold text-gray-600">
                Overall ROAS: <span class="text-primary-blue-100">{{ overallRoi.toFixed(2) }}×</span>
            </span>
        </div>

        <!-- Loading -->
        <div v-if="isLoading" class="space-y-3 animate-pulse flex-1">
            <div v-for="i in 4" :key="i" class="space-y-1">
                <div class="h-3 bg-gray-100 rounded w-24"></div>
                <div class="h-5 bg-gray-200 rounded" :style="{ width: `${30 + i * 12}%` }"></div>
                <div class="h-5 bg-green-100 rounded" :style="{ width: `${40 + i * 10}%` }"></div>
            </div>
        </div>

        <!-- Empty state -->
        <div v-else-if="bars.length === 0" class="flex flex-col items-center justify-center flex-1 gap-3 text-gray-400">
            <font-awesome-icon :icon="['fas', 'chart-bar']" class="text-4xl text-gray-200" />
            <p class="text-sm font-medium">No ROI data available</p>
            <p class="text-xs text-center">Connect a marketing data source and configure campaigns to see ROI breakdown</p>
        </div>

        <!-- Waterfall bars -->
        <div v-else class="flex flex-col gap-4 flex-1 overflow-y-auto">
            <!-- Legend -->
            <div class="flex gap-4 text-xs text-gray-500 mb-1">
                <div class="flex items-center gap-1">
                    <div class="w-3 h-3 rounded bg-red-400"></div>
                    <span>Spend</span>
                </div>
                <div class="flex items-center gap-1">
                    <div class="w-3 h-3 rounded bg-green-500"></div>
                    <span>Revenue / Pipeline</span>
                </div>
            </div>

            <div
                v-for="(bar, idx) in bars"
                :key="bar.label"
                class="flex flex-col gap-1"
            >
                <div class="flex justify-between text-xs font-semibold text-gray-700">
                    <span>{{ bar.label }}</span>
                    <span class="text-green-600">{{ (bar.revenue / Math.max(bar.spend, 1)).toFixed(2) }}×</span>
                </div>
                <!-- Spend bar -->
                <div class="flex items-center gap-2">
                    <span class="text-xs text-gray-400 w-10 text-right shrink-0">Spend</span>
                    <div
                        class="h-5 rounded-r bg-red-400 transition-all duration-500 flex items-center pl-2"
                        :style="{ width: barWidthPct(bar.spend) }"
                    >
                        <span class="text-xs text-white font-medium whitespace-nowrap">{{ formatCurrency(bar.spend) }}</span>
                    </div>
                </div>
                <!-- Revenue bar -->
                <div class="flex items-center gap-2">
                    <span class="text-xs text-gray-400 w-10 text-right shrink-0">Rev.</span>
                    <div
                        class="h-5 rounded-r transition-all duration-500 flex items-center pl-2"
                        :class="bar.revenue >= bar.spend ? 'bg-green-500' : 'bg-amber-400'"
                        :style="{ width: barWidthPct(bar.revenue) }"
                    >
                        <span class="text-xs text-white font-medium whitespace-nowrap">{{ formatCurrency(bar.revenue) }}</span>
                    </div>
                </div>
            </div>

            <!-- Totals row -->
            <div class="border-t border-gray-200 pt-3 mt-2">
                <div class="flex justify-between text-sm font-bold text-gray-800">
                    <span>Total</span>
                    <span class="text-green-600">{{ formatCurrency(totalRevenue) }} on {{ formatCurrency(totalSpend) }} spend</span>
                </div>
            </div>
        </div>
    </div>
</template>
