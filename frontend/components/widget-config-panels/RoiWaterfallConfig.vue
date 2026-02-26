<script setup lang="ts">
import type { IRoiWaterfallConfig } from '~/types/dashboard-widgets';

interface Props {
    config?: Partial<IRoiWaterfallConfig>;
}

const props = withDefaults(defineProps<Props>(), { config: () => ({}) });
const emit = defineEmits<{ (e: 'update:config', config: IRoiWaterfallConfig): void }>();

const local = reactive<IRoiWaterfallConfig>({
    include_offline: false,
    group_by: 'channel',
    campaign_id: undefined,
    ...props.config,
});

watch(local, () => emit('update:config', { ...local }), { deep: true });
</script>

<template>
    <div class="flex flex-col gap-4 p-4">
        <h4 class="text-sm font-bold text-gray-700 flex items-center gap-2">
            <font-awesome-icon :icon="['fas', 'chart-bar']" class="text-primary-blue-100" />
            ROI Waterfall Settings
        </h4>

        <!-- Group by -->
        <div class="flex flex-col gap-1">
            <label class="text-xs font-semibold text-gray-500 uppercase tracking-wide">Group By</label>
            <div class="flex gap-3">
                <label class="flex items-center gap-2 cursor-pointer text-xs text-gray-600">
                    <input type="radio" v-model="local.group_by" value="channel" class="accent-primary-blue-100" /> Channel
                </label>
                <label class="flex items-center gap-2 cursor-pointer text-xs text-gray-600">
                    <input type="radio" v-model="local.group_by" value="campaign" class="accent-primary-blue-100" /> Campaign
                </label>
            </div>
        </div>

        <!-- Include offline toggle -->
        <div class="flex items-center gap-3">
            <label class="text-xs font-semibold text-gray-500 uppercase tracking-wide flex-1">Include Offline Data</label>
            <button
                class="relative inline-flex w-10 h-5 rounded-full transition-colors duration-200 focus:outline-none"
                :class="local.include_offline ? 'bg-primary-blue-100' : 'bg-gray-200'"
                @click="local.include_offline = !local.include_offline"
            >
                <span
                    class="inline-block w-4 h-4 mt-0.5 ml-0.5 bg-white rounded-full shadow transform transition-transform duration-200"
                    :class="local.include_offline ? 'translate-x-5' : 'translate-x-0'"
                ></span>
            </button>
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
