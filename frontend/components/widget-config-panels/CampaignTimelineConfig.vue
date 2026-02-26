<script setup lang="ts">
import type { ICampaignTimelineConfig, TimeWindow } from '~/types/dashboard-widgets';

interface Props {
    config?: Partial<ICampaignTimelineConfig>;
}

const props = withDefaults(defineProps<Props>(), { config: () => ({}) });
const emit = defineEmits<{ (e: 'update:config', config: ICampaignTimelineConfig): void }>();

const local = reactive<ICampaignTimelineConfig>({
    show_budget_pacing: true,
    show_only_active: false,
    time_window: '30_days',
    ...props.config,
});

const TIME_WINDOWS: { value: TimeWindow; label: string }[] = [
    { value: '30_days', label: '30 Days' },
    { value: '60_days', label: '60 Days' },
    { value: '90_days', label: '90 Days' },
    { value: 'quarter', label: 'Current Quarter' },
    { value: 'custom', label: 'Custom' },
];

watch(local, () => emit('update:config', { ...local }), { deep: true });
</script>

<template>
    <div class="flex flex-col gap-4 p-4">
        <h4 class="text-sm font-bold text-gray-700 flex items-center gap-2">
            <font-awesome-icon :icon="['fas', 'calendar-days']" class="text-primary-blue-100" />
            Campaign Timeline Settings
        </h4>

        <!-- Time window -->
        <div class="flex flex-col gap-1">
            <label class="text-xs font-semibold text-gray-500 uppercase tracking-wide">Time Window</label>
            <select v-model="local.time_window" class="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-primary-blue-100 bg-white">
                <option v-for="tw in TIME_WINDOWS" :key="tw.value" :value="tw.value">{{ tw.label }}</option>
            </select>
        </div>

        <!-- Show budget pacing toggle -->
        <div class="flex items-center gap-3">
            <label class="text-xs font-semibold text-gray-500 uppercase tracking-wide flex-1">Colour by Budget Pacing</label>
            <button
                class="relative inline-flex w-10 h-5 rounded-full transition-colors duration-200 focus:outline-none"
                :class="local.show_budget_pacing ? 'bg-primary-blue-100' : 'bg-gray-200'"
                @click="local.show_budget_pacing = !local.show_budget_pacing"
            >
                <span
                    class="inline-block w-4 h-4 mt-0.5 ml-0.5 bg-white rounded-full shadow transform transition-transform duration-200"
                    :class="local.show_budget_pacing ? 'translate-x-5' : 'translate-x-0'"
                ></span>
            </button>
        </div>

        <!-- Show only active toggle -->
        <div class="flex items-center gap-3">
            <label class="text-xs font-semibold text-gray-500 uppercase tracking-wide flex-1">Show Only Active Campaigns</label>
            <button
                class="relative inline-flex w-10 h-5 rounded-full transition-colors duration-200 focus:outline-none"
                :class="local.show_only_active ? 'bg-primary-blue-100' : 'bg-gray-200'"
                @click="local.show_only_active = !local.show_only_active"
            >
                <span
                    class="inline-block w-4 h-4 mt-0.5 ml-0.5 bg-white rounded-full shadow transform transition-transform duration-200"
                    :class="local.show_only_active ? 'translate-x-5' : 'translate-x-0'"
                ></span>
            </button>
        </div>

        <!-- Pacing legend preview -->
        <div v-if="local.show_budget_pacing" class="bg-gray-50 rounded-lg p-3 border border-gray-100">
            <p class="text-xs font-semibold text-gray-500 mb-2">Bar Colour Key</p>
            <div class="flex flex-col gap-1.5">
                <div class="flex items-center gap-2 text-xs text-gray-600">
                    <div class="w-4 h-4 rounded bg-green-500 shrink-0"></div>
                    <span>&lt; 60% of budget used</span>
                </div>
                <div class="flex items-center gap-2 text-xs text-gray-600">
                    <div class="w-4 h-4 rounded bg-amber-400 shrink-0"></div>
                    <span>60% – 90% of budget used</span>
                </div>
                <div class="flex items-center gap-2 text-xs text-gray-600">
                    <div class="w-4 h-4 rounded bg-red-400 shrink-0"></div>
                    <span>&gt; 90% of budget used</span>
                </div>
            </div>
        </div>
    </div>
</template>
