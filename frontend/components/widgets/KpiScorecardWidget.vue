<script setup lang="ts">
import type { IKpiScorecardConfig } from '~/types/dashboard-widgets';

interface Props {
    chartId: string | number;
    projectId?: number;
    marketingConfig?: IKpiScorecardConfig;
    width?: number;
    height?: number;
}

const props = withDefaults(defineProps<Props>(), {
    width: 400,
    height: 200,
});

const config = computed<IKpiScorecardConfig>(() => ({
    metric: 'spend',
    data_source: 'marketing_hub',
    show_delta: true,
    format: 'currency',
    comparison_period: 'prior_period',
    ...(props.marketingConfig ?? {}),
}));

const metricValue = ref<number | null>(null);
const deltaValue = ref<number | null>(null);
const targetValue = ref<number | null>(null);
const isLoading = ref(true);

const METRIC_LABELS: Record<string, string> = {
    spend: 'Total Spend',
    impressions: 'Impressions',
    clicks: 'Clicks',
    cpl: 'Cost Per Lead',
    roas: 'ROAS',
    conversions: 'Conversions',
    pipeline_value: 'Pipeline Value',
};

const METRIC_ICONS: Record<string, string[]> = {
    spend: ['fas', 'dollar-sign'],
    impressions: ['fas', 'eye'],
    clicks: ['fas', 'arrow-pointer'],
    cpl: ['fas', 'user-plus'],
    roas: ['fas', 'chart-line'],
    conversions: ['fas', 'check-circle'],
    pipeline_value: ['fas', 'funnel-dollar'],
};

const { data: widgetData, isLoading: widgetLoading } = useWidgetData<{ current_value: number; prior_value: number; delta_pct: number }>(
    'kpi_scorecard',
    computed(() => props.projectId ?? 0),
    config,
);

watch(widgetLoading, (v) => (isLoading.value = v), { immediate: true });
watch(
    widgetData,
    (d) => {
        if (!d) return;
        metricValue.value = d.current_value ?? null;
        deltaValue.value = d.delta_pct ?? null;
        targetValue.value = config.value.target_value ?? null;
    },
    { immediate: true },
);

const progressToTarget = computed(() => {
    if (targetValue.value == null || targetValue.value === 0 || metricValue.value == null) return null;
    return Math.min(100, Math.round((metricValue.value / targetValue.value) * 100));
});
</script>

<template>
    <div class="flex flex-col gap-3 p-4 bg-white rounded-xl border border-gray-200 w-full h-full overflow-hidden">
        <marketing-kpi-card
            :label="METRIC_LABELS[config.metric] ?? config.metric"
            :value="metricValue ?? 0"
            :format="config.format"
            :delta="config.show_delta ? deltaValue : null"
            :delta-label="`vs ${config.comparison_period.replace('_', ' ')}`"
            :icon="(METRIC_ICONS[config.metric] as any) ?? ['fas', 'chart-bar']"
            :is-loading="isLoading"
        />

        <!-- Target progress bar -->
        <div v-if="!isLoading && progressToTarget !== null" class="mt-1">
            <div class="flex justify-between text-xs text-gray-500 mb-1">
                <span>Target progress</span>
                <span>{{ progressToTarget }}%</span>
            </div>
            <div class="w-full h-2 bg-gray-100 rounded-full overflow-hidden">
                <div
                    class="h-2 rounded-full transition-all duration-500"
                    :class="{
                        'bg-green-500': progressToTarget >= 80,
                        'bg-amber-400': progressToTarget >= 50 && progressToTarget < 80,
                        'bg-red-400': progressToTarget < 50,
                    }"
                    :style="{ width: `${progressToTarget}%` }"
                ></div>
            </div>
        </div>

        <!-- data_source badge -->
        <div class="text-xs text-gray-400 flex items-center gap-1 mt-auto">
            <font-awesome-icon :icon="['fas', 'database']" class="text-gray-300" />
            <span class="truncate">{{ config.data_source }}</span>
        </div>
    </div>
</template>
