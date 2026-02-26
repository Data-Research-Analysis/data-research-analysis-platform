<script setup lang="ts">
import type { IAnomalyAlertCardConfig } from '~/types/dashboard-widgets';

interface Props {
    chartId: string | number;
    projectId?: number;
    marketingConfig?: IAnomalyAlertCardConfig;
    width?: number;
    height?: number;
}

const props = withDefaults(defineProps<Props>(), {
    width: 400,
    height: 200,
});

const config = computed<IAnomalyAlertCardConfig>(() => ({
    metric: 'spend',
    threshold_pct: 20,
    comparison_window: '4_week_avg',
    alert_direction: 'both',
    ...(props.marketingConfig ?? {}),
}));

const METRIC_LABELS: Record<string, string> = {
    spend: 'Total Spend',
    impressions: 'Impressions',
    clicks: 'Clicks',
    cpl: 'Cost Per Lead',
    roas: 'ROAS',
    conversions: 'Conversions',
    pipeline_value: 'Pipeline Value',
};

interface AnomalyResult {
    current_value: number;
    comparison_value: number;
    delta_pct: number;
    is_anomaly: boolean;
    direction: 'spike' | 'drop' | 'normal';
}

const result = ref<AnomalyResult | null>(null);
const isLoading = ref(true);

function formatValue(val: number): string {
    if (['spend', 'cpl', 'pipeline_value'].includes(config.value.metric)) {
        if (val >= 1_000_000) return `$${(val / 1_000_000).toFixed(1)}M`;
        if (val >= 1_000) return `$${(val / 1_000).toFixed(0)}k`;
        return `$${val.toLocaleString()}`;
    }
    if (config.value.metric === 'roas') return `${val.toFixed(2)}×`;
    if (val >= 1_000_000) return `${(val / 1_000_000).toFixed(1)}M`;
    if (val >= 1_000) return `${(val / 1_000).toFixed(0)}k`;
    return val.toLocaleString();
}

function shouldAlert(r: AnomalyResult): boolean {
    if (!r.is_anomaly) return false;
    if (config.value.alert_direction === 'spike_only' && r.direction !== 'spike') return false;
    if (config.value.alert_direction === 'drop_only' && r.direction !== 'drop') return false;
    return true;
}

const borderColour = computed(() => {
    if (!result.value || !shouldAlert(result.value)) return '#e5e7eb';
    return result.value.direction === 'spike' ? '#22c55e' : '#ef4444';
});

const alertIcon = computed((): string[] => {
    if (!result.value || !shouldAlert(result.value)) return ['fas', 'circle-check'];
    return result.value.direction === 'spike'
        ? ['fas', 'arrow-trend-up']
        : ['fas', 'triangle-exclamation'];
});

const alertIconColour = computed(() => {
    if (!result.value || !shouldAlert(result.value)) return 'text-gray-400';
    return result.value.direction === 'spike' ? 'text-green-500' : 'text-red-500';
});

const windowLabel = computed(() => {
    return config.value.comparison_window === '4_week_avg' ? '4-week avg' : 'prior week';
});

const { data: widgetData, isLoading: widgetLoading } = useWidgetData<AnomalyResult>(
    'anomaly_alert_card',
    computed(() => props.projectId ?? 0),
    config,
);

watch(widgetLoading, (v) => (isLoading.value = v), { immediate: true });
watch(widgetData, (d) => { if (d) result.value = d; }, { immediate: true });
</script>

<template>
    <div
        class="flex flex-col p-4 bg-white rounded-xl border-l-4 border border-gray-200 w-full h-full overflow-hidden transition-all duration-300"
        :style="{ borderLeftColor: borderColour }"
    >
        <!-- Loading -->
        <div v-if="isLoading" class="flex flex-col gap-3 animate-pulse flex-1">
            <div class="h-4 bg-gray-100 rounded w-1/2"></div>
            <div class="h-8 bg-gray-200 rounded w-1/3"></div>
            <div class="h-4 bg-gray-100 rounded w-2/3"></div>
        </div>

        <template v-else-if="result">
            <!-- Header row -->
            <div class="flex items-center gap-2 mb-3">
                <font-awesome-icon :icon="(alertIcon as any)" :class="alertIconColour" class="text-xl" />
                <h3 class="text-sm font-bold text-gray-700">{{ METRIC_LABELS[config.metric] ?? config.metric }}</h3>
                <span class="ml-auto text-xs text-gray-400">vs {{ windowLabel }}</span>
            </div>

            <!-- No anomaly state -->
            <div v-if="!shouldAlert(result)" class="flex flex-col items-center justify-center flex-1 gap-2 text-gray-400">
                <font-awesome-icon :icon="['fas', 'circle-check']" class="text-3xl text-gray-300" />
                <p class="text-sm font-medium text-gray-500">No anomalies detected</p>
                <p class="text-xs text-gray-400 text-center">
                    Metric is within {{ config.threshold_pct }}% of {{ windowLabel }}
                </p>
            </div>

            <!-- Anomaly detected -->
            <div v-else class="flex flex-col gap-3 flex-1">
                <!-- Current vs comparison values -->
                <div class="flex gap-4">
                    <div class="flex flex-col">
                        <span class="text-xs text-gray-400">Current</span>
                        <span class="text-2xl font-bold text-gray-900">{{ formatValue(result.current_value) }}</span>
                    </div>
                    <div class="flex items-center">
                        <font-awesome-icon :icon="['fas', 'arrow-right']" class="text-gray-300" />
                    </div>
                    <div class="flex flex-col">
                        <span class="text-xs text-gray-400">{{ windowLabel }}</span>
                        <span class="text-xl font-semibold text-gray-500">{{ formatValue(result.comparison_value) }}</span>
                    </div>
                </div>

                <!-- Delta badge -->
                <div
                    class="inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-sm font-semibold w-fit"
                    :class="result.direction === 'spike' ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'"
                >
                    <font-awesome-icon
                        :icon="result.direction === 'spike' ? ['fas', 'arrow-up'] : ['fas', 'arrow-down']"
                    />
                    {{ result.delta_pct >= 0 ? '+' : '' }}{{ result.delta_pct.toFixed(1) }}%
                    {{ result.direction === 'spike' ? 'spike' : 'drop' }} detected
                </div>

                <!-- Threshold info -->
                <p class="text-xs text-gray-400 mt-auto">
                    Threshold: ±{{ config.threshold_pct }}% · Alert: {{ config.alert_direction.replace('_', ' ') }}
                </p>
            </div>
        </template>
    </div>
</template>
