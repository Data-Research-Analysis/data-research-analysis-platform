<script setup lang="ts">
import type { IChannelComparisonTableConfig } from '~/types/dashboard-widgets';

interface Props {
    config?: Partial<IChannelComparisonTableConfig>;
}

const props = withDefaults(defineProps<Props>(), { config: () => ({}) });
const emit = defineEmits<{ (e: 'update:config', config: IChannelComparisonTableConfig): void }>();

const ALL_COLUMNS = [
    { value: 'spend', label: 'Spend' },
    { value: 'impressions', label: 'Impressions' },
    { value: 'clicks', label: 'Clicks' },
    { value: 'ctr', label: 'CTR' },
    { value: 'conversions', label: 'Conversions' },
    { value: 'cpl', label: 'CPL' },
    { value: 'roas', label: 'ROAS' },
    { value: 'pipeline_value', label: 'Pipeline Value' },
];

const local = reactive<IChannelComparisonTableConfig>({
    columns: ['spend', 'impressions', 'clicks', 'ctr', 'conversions', 'cpl', 'roas'],
    sort_by: 'spend',
    campaign_id: undefined,
    ...props.config,
});

function toggleColumn(col: string) {
    const idx = local.columns.indexOf(col);
    if (idx >= 0) {
        local.columns.splice(idx, 1);
    } else {
        local.columns.push(col);
    }
}

watch(local, () => emit('update:config', { ...local }), { deep: true });
</script>

<template>
    <div class="flex flex-col gap-4 p-4">
        <h4 class="text-sm font-bold text-gray-700 flex items-center gap-2">
            <font-awesome-icon :icon="['fas', 'table-columns']" class="text-primary-blue-100" />
            Channel Comparison Settings
        </h4>

        <!-- Column toggles -->
        <div class="flex flex-col gap-1">
            <label class="text-xs font-semibold text-gray-500 uppercase tracking-wide">Columns to Display</label>
            <div class="flex flex-wrap gap-2 mt-1">
                <button
                    v-for="col in ALL_COLUMNS"
                    :key="col.value"
                    class="px-2.5 py-1 text-xs rounded-full border font-medium transition-colors"
                    :class="local.columns.includes(col.value)
                        ? 'bg-primary-blue-100 text-white border-primary-blue-100'
                        : 'bg-white text-gray-500 border-gray-200 hover:border-primary-blue-100'"
                    @click="toggleColumn(col.value)"
                >
                    {{ col.label }}
                </button>
            </div>
        </div>

        <!-- Sort by -->
        <div class="flex flex-col gap-1">
            <label class="text-xs font-semibold text-gray-500 uppercase tracking-wide">Default Sort By</label>
            <select v-model="local.sort_by" class="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-primary-blue-100 bg-white">
                <option v-for="col in ALL_COLUMNS" :key="col.value" :value="col.value">{{ col.label }}</option>
            </select>
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
