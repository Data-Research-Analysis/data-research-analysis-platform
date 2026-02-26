<script setup lang="ts">
import type { IFunnelStepsConfig } from '~/types/dashboard-widgets';

interface Props {
    config?: Partial<IFunnelStepsConfig>;
}

const props = withDefaults(defineProps<Props>(), { config: () => ({}) });
const emit = defineEmits<{ (e: 'update:config', config: IFunnelStepsConfig): void }>();

const local = reactive<IFunnelStepsConfig>({
    funnel_config: [],
    date_range_source: 'dashboard',
    campaign_id: undefined,
    ...props.config,
});

function addStep() {
    local.funnel_config.push({ step_name: '', event_name: '' });
}

function removeStep(idx: number) {
    local.funnel_config.splice(idx, 1);
}

watch(local, () => emit('update:config', { ...local }), { deep: true });
</script>

<template>
    <div class="flex flex-col gap-4 p-4">
        <h4 class="text-sm font-bold text-gray-700 flex items-center gap-2">
            <font-awesome-icon :icon="['fas', 'filter']" class="text-primary-blue-100" />
            Funnel Steps Settings
        </h4>

        <!-- Date range source -->
        <div class="flex flex-col gap-1">
            <label class="text-xs font-semibold text-gray-500 uppercase tracking-wide">Date Range Source</label>
            <div class="flex gap-3">
                <label class="flex items-center gap-2 cursor-pointer text-xs text-gray-600">
                    <input type="radio" v-model="local.date_range_source" value="dashboard" class="accent-primary-blue-100" />
                    Inherit from Dashboard
                </label>
                <label class="flex items-center gap-2 cursor-pointer text-xs text-gray-600">
                    <input type="radio" v-model="local.date_range_source" value="custom" class="accent-primary-blue-100" />
                    Custom
                </label>
            </div>
        </div>

        <!-- Funnel steps -->
        <div class="flex flex-col gap-2">
            <div class="flex items-center justify-between">
                <label class="text-xs font-semibold text-gray-500 uppercase tracking-wide">Funnel Steps</label>
                <button
                    class="text-xs text-primary-blue-100 hover:underline flex items-center gap-1"
                    @click="addStep"
                >
                    <font-awesome-icon :icon="['fas', 'plus']" />
                    Add Step
                </button>
            </div>

            <div v-if="local.funnel_config.length === 0" class="text-xs text-gray-400 italic">
                No steps defined. Click "Add Step" to start building your funnel.
            </div>

            <div
                v-for="(step, idx) in local.funnel_config"
                :key="idx"
                class="flex items-center gap-2 bg-gray-50 rounded-lg p-2 border border-gray-100"
            >
                <span class="text-xs font-bold text-gray-400 w-4 shrink-0">{{ idx + 1 }}</span>
                <input
                    v-model="step.step_name"
                    type="text"
                    placeholder="Step name"
                    class="flex-1 text-xs border border-gray-200 rounded px-2 py-1 focus:outline-none focus:ring-1 focus:ring-primary-blue-100"
                />
                <input
                    v-model="step.event_name"
                    type="text"
                    placeholder="Event name"
                    class="flex-1 text-xs border border-gray-200 rounded px-2 py-1 focus:outline-none focus:ring-1 focus:ring-primary-blue-100"
                />
                <button class="text-gray-300 hover:text-red-400 shrink-0" @click="removeStep(idx)">
                    <font-awesome-icon :icon="['fas', 'xmark']" />
                </button>
            </div>
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
