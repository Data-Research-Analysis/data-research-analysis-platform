<script setup lang="ts">
import type { IBudgetGaugeConfig } from '~/types/dashboard-widgets';

interface Props {
    config?: Partial<IBudgetGaugeConfig>;
}

const props = withDefaults(defineProps<Props>(), { config: () => ({}) });
const emit = defineEmits<{ (e: 'update:config', config: IBudgetGaugeConfig): void }>();

const local = reactive<IBudgetGaugeConfig>({
    campaign_id: '',
    show_daily_pace: true,
    thresholds: { warning: 80, danger: 95 },
    ...props.config,
});

watch(local, () => emit('update:config', { ...local }), { deep: true });
</script>

<template>
    <div class="flex flex-col gap-4 p-4">
        <h4 class="text-sm font-bold text-gray-700 flex items-center gap-2">
            <font-awesome-icon :icon="['fas', 'gauge-high']" class="text-primary-blue-100" />
            Budget Gauge Settings
        </h4>

        <!-- Campaign selector -->
        <div class="flex flex-col gap-1">
            <label class="text-xs font-semibold text-gray-500 uppercase tracking-wide">Campaign ID <span class="text-red-400">*</span></label>
            <input
                v-model="local.campaign_id"
                type="text"
                placeholder="Enter campaign ID"
                class="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-primary-blue-100"
            />
            <span class="text-xs text-gray-400">Required — the gauge displays budget pacing for this campaign</span>
        </div>

        <!-- Show daily pace toggle -->
        <div class="flex items-center gap-3">
            <label class="text-xs font-semibold text-gray-500 uppercase tracking-wide flex-1">Show Daily Pace</label>
            <button
                class="relative inline-flex w-10 h-5 rounded-full transition-colors duration-200 focus:outline-none"
                :class="local.show_daily_pace ? 'bg-primary-blue-100' : 'bg-gray-200'"
                @click="local.show_daily_pace = !local.show_daily_pace"
            >
                <span
                    class="inline-block w-4 h-4 mt-0.5 ml-0.5 bg-white rounded-full shadow transform transition-transform duration-200"
                    :class="local.show_daily_pace ? 'translate-x-5' : 'translate-x-0'"
                ></span>
            </button>
        </div>

        <!-- Thresholds -->
        <div class="flex flex-col gap-2">
            <label class="text-xs font-semibold text-gray-500 uppercase tracking-wide">Colour Thresholds</label>
            <div class="flex items-center gap-3">
                <div class="w-3 h-3 rounded-full bg-amber-400 shrink-0"></div>
                <label class="text-xs text-gray-600 flex-1">Warning at</label>
                <input
                    v-model.number="local.thresholds.warning"
                    type="number"
                    min="1"
                    max="99"
                    class="w-16 text-sm border border-gray-200 rounded px-2 py-1 text-right focus:outline-none focus:ring-2 focus:ring-primary-blue-100"
                />
                <span class="text-xs text-gray-400">%</span>
            </div>
            <div class="flex items-center gap-3">
                <div class="w-3 h-3 rounded-full bg-red-400 shrink-0"></div>
                <label class="text-xs text-gray-600 flex-1">Danger at</label>
                <input
                    v-model.number="local.thresholds.danger"
                    type="number"
                    min="1"
                    max="100"
                    class="w-16 text-sm border border-gray-200 rounded px-2 py-1 text-right focus:outline-none focus:ring-2 focus:ring-primary-blue-100"
                />
                <span class="text-xs text-gray-400">%</span>
            </div>
        </div>
    </div>
</template>
