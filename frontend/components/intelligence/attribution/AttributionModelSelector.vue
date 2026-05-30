<script setup lang="ts">
/**
 * AttributionModelSelector — Toggle between 5 attribution models.
 *
 * Displays model pills in a horizontal scrollable row. Each pill shows
 * an icon and label. The active model is highlighted. A brief visual
 * explanation of the selected model's credit distribution is shown below.
 */
import type { AttributionModel, IAttributionModelOption } from '@/composables/useAttribution';
import { ATTRIBUTION_MODELS } from '@/composables/useAttribution';

interface Props {
    selected: AttributionModel;
    disabled?: boolean;
}

interface Emits {
    (e: 'update:selected', model: AttributionModel): void;
}

const props = withDefaults(defineProps<Props>(), { disabled: false });
const emit = defineEmits<Emits>();

function selectModel(model: AttributionModel) {
    if (props.disabled || model === props.selected) return;
    emit('update:selected', model);
}

const activeModel = computed(() =>
    ATTRIBUTION_MODELS.find(m => m.id === props.selected)!,
);

/**
 * Visual representation of credit distribution for the selected model.
 * Returns an array of segments with their label and percentage.
 */
const creditDistribution = computed(() => {
    switch (props.selected) {
        case 'first_touch':
            return [
                { label: 'First Touch', pct: 100, color: 'bg-blue-500' },
                { label: 'Middle', pct: 0, color: 'bg-gray-200' },
                { label: 'Last Touch', pct: 0, color: 'bg-gray-200' },
            ];
        case 'last_touch':
            return [
                { label: 'First Touch', pct: 0, color: 'bg-gray-200' },
                { label: 'Middle', pct: 0, color: 'bg-gray-200' },
                { label: 'Last Touch', pct: 100, color: 'bg-indigo-500' },
            ];
        case 'linear':
            return [
                { label: 'First Touch', pct: 33, color: 'bg-emerald-500' },
                { label: 'Middle', pct: 34, color: 'bg-emerald-400' },
                { label: 'Last Touch', pct: 33, color: 'bg-emerald-500' },
            ];
        case 'time_decay':
            return [
                { label: 'First Touch', pct: 10, color: 'bg-amber-200' },
                { label: 'Middle', pct: 30, color: 'bg-amber-400' },
                { label: 'Last Touch', pct: 60, color: 'bg-amber-500' },
            ];
        case 'u_shaped':
            return [
                { label: 'First Touch', pct: 40, color: 'bg-purple-500' },
                { label: 'Middle', pct: 20, color: 'bg-purple-300' },
                { label: 'Last Touch', pct: 40, color: 'bg-purple-500' },
            ];
        default:
            return [];
    }
});
</script>

<template>
    <div class="attribution-model-selector">
        <!-- Model pills -->
        <div class="flex flex-wrap gap-2">
            <button
                v-for="model in ATTRIBUTION_MODELS"
                :key="model.id"
                type="button"
                class="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium rounded-lg border transition-all cursor-pointer"
                :class="[
                    model.id === selected
                        ? 'bg-primary-blue-100 text-white border-primary-blue-100 shadow-sm'
                        : 'bg-white text-gray-600 border-gray-200 hover:border-gray-300 hover:bg-gray-50',
                ]"
                :disabled="disabled"
                @click="selectModel(model.id)"
            >
                <font-awesome-icon :icon="model.icon" class="w-3.5 h-3.5" />
                {{ model.label }}
            </button>
        </div>

        <!-- Selected model explanation -->
        <div class="mt-3 p-3 bg-gray-50 rounded-lg border border-gray-100">
            <p class="text-xs text-gray-500 mb-2">
                <font-awesome-icon :icon="activeModel.icon" class="mr-1" />
                {{ activeModel.description }}
            </p>

            <!-- Credit distribution bar -->
            <div class="flex items-center gap-1 h-5">
                <div
                    v-for="(seg, idx) in creditDistribution"
                    :key="idx"
                    class="h-full rounded-sm transition-all duration-300 flex items-center justify-center"
                    :class="seg.pct > 0 ? seg.color : 'bg-gray-100'"
                    :style="{ width: Math.max(seg.pct, 5) + '%', minWidth: seg.pct > 0 ? '2rem' : '0.5rem' }"
                >
                    <span
                        v-if="seg.pct > 0"
                        class="text-[10px] font-semibold text-white leading-none"
                    >
                        {{ seg.pct }}%
                    </span>
                </div>
            </div>
            <div class="flex justify-between mt-1">
                <span
                    v-for="(seg, idx) in creditDistribution"
                    :key="idx"
                    class="text-[10px] text-gray-400"
                    :style="{ width: Math.max(seg.pct, 5) + '%', minWidth: seg.pct > 0 ? '2rem' : '0.5rem', textAlign: 'center' }"
                >
                    {{ seg.label }}
                </span>
            </div>
        </div>
    </div>
</template>