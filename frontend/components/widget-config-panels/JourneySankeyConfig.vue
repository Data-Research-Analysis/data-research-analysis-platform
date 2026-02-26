<script setup lang="ts">
import type { IJourneySankeyConfig } from '~/types/dashboard-widgets';

interface Props {
    config?: Partial<IJourneySankeyConfig>;
}

const props = withDefaults(defineProps<Props>(), { config: () => ({}) });
const emit = defineEmits<{ (e: 'update:config', config: IJourneySankeyConfig): void }>();

const local = reactive<IJourneySankeyConfig>({
    max_paths: 5,
    min_conversions: 1,
    campaign_id: undefined,
    ...props.config,
});

watch(local, () => emit('update:config', { ...local }), { deep: true });
</script>

<template>
    <div class="flex flex-col gap-4 p-4">
        <h4 class="text-sm font-bold text-gray-700 flex items-center gap-2">
            <font-awesome-icon :icon="['fas', 'diagram-project']" class="text-primary-blue-100" />
            Conversion Journey Settings
        </h4>

        <!-- Max paths -->
        <div class="flex flex-col gap-1">
            <label class="text-xs font-semibold text-gray-500 uppercase tracking-wide">Max Paths Shown</label>
            <div class="flex gap-3">
                <label class="flex items-center gap-2 cursor-pointer text-xs text-gray-600">
                    <input type="radio" v-model.number="local.max_paths" :value="5" class="accent-primary-blue-100" /> Top 5
                </label>
                <label class="flex items-center gap-2 cursor-pointer text-xs text-gray-600">
                    <input type="radio" v-model.number="local.max_paths" :value="10" class="accent-primary-blue-100" /> Top 10
                </label>
            </div>
        </div>

        <!-- Minimum conversions threshold -->
        <div class="flex flex-col gap-1">
            <label class="text-xs font-semibold text-gray-500 uppercase tracking-wide">Min Conversions per Path</label>
            <input
                v-model.number="local.min_conversions"
                type="number"
                min="1"
                class="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-primary-blue-100"
            />
            <span class="text-xs text-gray-400">Paths with fewer conversions than this threshold are hidden</span>
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
