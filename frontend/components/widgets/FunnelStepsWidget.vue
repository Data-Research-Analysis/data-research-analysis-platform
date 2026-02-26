<script setup lang="ts">
import type { IFunnelStepsConfig } from '~/types/dashboard-widgets';
import type { IConversionFunnel } from '@/stores/attribution';

interface Props {
    chartId: string | number;
    marketingConfig?: IFunnelStepsConfig;
    width?: number;
    height?: number;
}

const props = withDefaults(defineProps<Props>(), {
    width: 500,
    height: 350,
});

const config = computed<IFunnelStepsConfig>(() => ({
    funnel_config: [],
    date_range_source: 'dashboard',
    ...(props.marketingConfig ?? {}),
}));

const funnel = ref<IConversionFunnel | null>(null);
const isLoading = ref(true);

onMounted(async () => {
    isLoading.value = true;
    // Placeholder — replace with real attribution API call once integrated
    await new Promise((resolve) => setTimeout(resolve, 500));
    funnel.value = null;
    isLoading.value = false;
});
</script>

<template>
    <div class="flex flex-col gap-3 p-4 bg-white rounded-xl border border-gray-200 w-full h-full overflow-hidden">
        <div class="flex items-center gap-2 mb-1">
            <font-awesome-icon :icon="['fas', 'filter']" class="text-primary-blue-100" />
            <h3 class="text-sm font-bold text-gray-700">Funnel Steps</h3>
            <span v-if="config.campaign_id" class="ml-auto text-xs text-gray-400">Campaign filter active</span>
        </div>

        <!-- Empty config state -->
        <div v-if="config.funnel_config.length === 0 && !isLoading" class="flex flex-col items-center justify-center flex-1 gap-3 text-gray-400">
            <font-awesome-icon :icon="['fas', 'filter']" class="text-4xl text-gray-200" />
            <p class="text-sm font-medium">Configure funnel steps in the widget settings panel</p>
            <p class="text-xs">Add event names to track conversion through each stage</p>
        </div>

        <!-- Funnel chart -->
        <div v-else class="flex-1 overflow-hidden">
            <funnel-chart
                :funnel="funnel"
                :loading="isLoading"
            />
        </div>
    </div>
</template>
