<script setup lang="ts">
import type { IKpiScorecardConfig, MarketingMetric, ValueFormat, ComparisonPeriod } from '~/types/dashboard-widgets';

interface Props {
    config?: Partial<IKpiScorecardConfig>;
}

const props = withDefaults(defineProps<Props>(), { config: () => ({}) });
const emit = defineEmits<{ (e: 'update:config', config: IKpiScorecardConfig): void }>();

const local = reactive<IKpiScorecardConfig>({
    metric: 'spend',
    data_source: 'marketing_hub',
    show_delta: true,
    target_value: undefined,
    format: 'currency',
    comparison_period: 'prior_period',
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

const FORMATS: { value: ValueFormat; label: string }[] = [
    { value: 'currency', label: 'Currency ($)' },
    { value: 'number', label: 'Number' },
    { value: 'percent', label: 'Percent (%)' },
    { value: 'multiplier', label: 'Multiplier (×)' },
];

const PERIODS: { value: ComparisonPeriod; label: string }[] = [
    { value: 'prior_period', label: 'Prior Period' },
    { value: 'prior_year', label: 'Prior Year' },
    { value: 'prior_month', label: 'Prior Month' },
];

const DATA_SOURCES = [
    { value: 'marketing_hub', label: 'Marketing Hub (all)' },
    { value: 'google_ads', label: 'Google Ads' },
    { value: 'meta_ads', label: 'Meta Ads' },
    { value: 'linkedin_ads', label: 'LinkedIn Ads' },
    { value: 'offline', label: 'Offline' },
];

function save() {
    emit('update:config', { ...local });
}

watch(local, save, { deep: true });
</script>

<template>
    <div class="flex flex-col gap-4 p-4">
        <h4 class="text-sm font-bold text-gray-700 flex items-center gap-2">
            <font-awesome-icon :icon="['fas', 'sliders']" class="text-primary-blue-100" />
            KPI Scorecard Settings
        </h4>

        <!-- Metric selector -->
        <div class="flex flex-col gap-1">
            <label class="text-xs font-semibold text-gray-500 uppercase tracking-wide">Metric</label>
            <select v-model="local.metric" class="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-primary-blue-100 bg-white">
                <option v-for="m in METRICS" :key="m.value" :value="m.value">{{ m.label }}</option>
            </select>
        </div>

        <!-- Data source -->
        <div class="flex flex-col gap-1">
            <label class="text-xs font-semibold text-gray-500 uppercase tracking-wide">Data Source</label>
            <select v-model="local.data_source" class="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-primary-blue-100 bg-white">
                <option v-for="ds in DATA_SOURCES" :key="ds.value" :value="ds.value">{{ ds.label }}</option>
            </select>
        </div>

        <!-- Format -->
        <div class="flex flex-col gap-1">
            <label class="text-xs font-semibold text-gray-500 uppercase tracking-wide">Format</label>
            <select v-model="local.format" class="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-primary-blue-100 bg-white">
                <option v-for="f in FORMATS" :key="f.value" :value="f.value">{{ f.label }}</option>
            </select>
        </div>

        <!-- Comparison period -->
        <div class="flex flex-col gap-1">
            <label class="text-xs font-semibold text-gray-500 uppercase tracking-wide">Comparison Period</label>
            <select v-model="local.comparison_period" class="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-primary-blue-100 bg-white">
                <option v-for="p in PERIODS" :key="p.value" :value="p.value">{{ p.label }}</option>
            </select>
        </div>

        <!-- Show delta toggle -->
        <div class="flex items-center gap-3">
            <label class="text-xs font-semibold text-gray-500 uppercase tracking-wide flex-1">Show Delta</label>
            <button
                class="relative inline-flex w-10 h-5 rounded-full transition-colors duration-200 focus:outline-none"
                :class="local.show_delta ? 'bg-primary-blue-100' : 'bg-gray-200'"
                @click="local.show_delta = !local.show_delta"
            >
                <span
                    class="inline-block w-4 h-4 mt-0.5 ml-0.5 bg-white rounded-full shadow transform transition-transform duration-200"
                    :class="local.show_delta ? 'translate-x-5' : 'translate-x-0'"
                ></span>
            </button>
        </div>

        <!-- Target value -->
        <div class="flex flex-col gap-1">
            <label class="text-xs font-semibold text-gray-500 uppercase tracking-wide">Target Value <span class="font-normal text-gray-400">(optional)</span></label>
            <input
                v-model.number="local.target_value"
                type="number"
                min="0"
                placeholder="e.g. 50000"
                class="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-primary-blue-100"
            />
            <span class="text-xs text-gray-400">Shows a progress bar toward target value</span>
        </div>

        <!-- Campaign filter -->
        <div class="flex flex-col gap-1">
            <label class="text-xs font-semibold text-gray-500 uppercase tracking-wide">Campaign ID Filter <span class="font-normal text-gray-400">(optional)</span></label>
            <input
                v-model="local.campaign_id"
                type="text"
                placeholder="Campaign ID"
                class="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-primary-blue-100"
            />
        </div>
    </div>
</template>
