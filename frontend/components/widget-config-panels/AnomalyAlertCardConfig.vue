<script setup lang="ts">
import type { IAnomalyAlertCardConfig, MarketingMetric, ComparisonWindow, AlertDirection } from '~/types/dashboard-widgets';

interface Props {
    config?: Partial<IAnomalyAlertCardConfig>;
}

const props = withDefaults(defineProps<Props>(), { config: () => ({}) });
const emit = defineEmits<{ (e: 'update:config', config: IAnomalyAlertCardConfig): void }>();

const local = reactive<IAnomalyAlertCardConfig>({
    metric: 'spend',
    threshold_pct: 20,
    comparison_window: '4_week_avg',
    alert_direction: 'both',
    campaign_id: undefined,
    ...props.config,
});

const METRICS: { value: MarketingMetric; label: string }[] = [
    { value: 'spend', label: 'Total Spend' },
    { value: 'impressions', label: 'Impressions' },
    { value: 'clicks', label: 'Clicks' },
    { value: 'cpl', label: 'Cost Per Lead' },
    { value: 'roas', label: 'ROAS' },
    { value: 'conversions', label: 'Conversions' },
    { value: 'pipeline_value', label: 'Pipeline Value' },
];

const WINDOWS: { value: ComparisonWindow; label: string }[] = [
    { value: '4_week_avg', label: '4-Week Average' },
    { value: 'prior_week', label: 'Prior Week' },
];

const DIRECTIONS: { value: AlertDirection; label: string }[] = [
    { value: 'both', label: 'Both Spikes & Drops' },
    { value: 'spike_only', label: 'Spikes Only (↑)' },
    { value: 'drop_only', label: 'Drops Only (↓)' },
];

watch(local, () => emit('update:config', { ...local }), { deep: true });
</script>

<template>
    <div class="flex flex-col gap-4 p-4">
        <h4 class="text-sm font-bold text-gray-700 flex items-center gap-2">
            <font-awesome-icon :icon="['fas', 'triangle-exclamation']" class="text-amber-400" />
            Anomaly Alert Settings
        </h4>

        <!-- Metric -->
        <div class="flex flex-col gap-1">
            <label class="text-xs font-semibold text-gray-500 uppercase tracking-wide">Metric to Watch</label>
            <select v-model="local.metric" class="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-primary-blue-100 bg-white">
                <option v-for="m in METRICS" :key="m.value" :value="m.value">{{ m.label }}</option>
            </select>
        </div>

        <!-- Comparison window -->
        <div class="flex flex-col gap-1">
            <label class="text-xs font-semibold text-gray-500 uppercase tracking-wide">Comparison Window</label>
            <select v-model="local.comparison_window" class="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-primary-blue-100 bg-white">
                <option v-for="w in WINDOWS" :key="w.value" :value="w.value">{{ w.label }}</option>
            </select>
        </div>

        <!-- Alert direction -->
        <div class="flex flex-col gap-1">
            <label class="text-xs font-semibold text-gray-500 uppercase tracking-wide">Alert On</label>
            <select v-model="local.alert_direction" class="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-primary-blue-100 bg-white">
                <option v-for="d in DIRECTIONS" :key="d.value" :value="d.value">{{ d.label }}</option>
            </select>
        </div>

        <!-- Threshold percentage -->
        <div class="flex flex-col gap-1">
            <label class="text-xs font-semibold text-gray-500 uppercase tracking-wide">
                Alert Threshold
                <span class="font-normal text-gray-400 normal-case ml-1">(deviation %)</span>
            </label>
            <div class="flex items-center gap-2">
                <input
                    v-model.number="local.threshold_pct"
                    type="range"
                    min="5"
                    max="100"
                    step="5"
                    class="flex-1 accent-primary-blue-100"
                />
                <span class="text-sm font-bold text-gray-700 w-10 text-right">{{ local.threshold_pct }}%</span>
            </div>
            <span class="text-xs text-gray-400">An alert fires when the metric deviates by more than this from the comparison window</span>
        </div>

        <!-- Campaign filter -->
        <div class="flex flex-col gap-1">
            <label class="text-xs font-semibold text-gray-500 uppercase tracking-wide">Campaign Filter <span class="font-normal text-gray-400">(optional)</span></label>
            <input
                v-model="local.campaign_id"
                type="text"
                placeholder="Campaign ID"
                class="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-primary-blue-100"
            />
        </div>
    </div>
</template>
