<script setup lang="ts">
import type { IModelComparisonResult, AttributionModel } from '@/stores/attribution';

const props = defineProps<{
    data: IModelComparisonResult[];
    activeModel: AttributionModel;
    loading?: boolean;
}>();

const MODEL_LABELS: Record<AttributionModel, string> = {
    first_touch: 'First Touch',
    last_touch: 'Last Touch',
    linear: 'Linear',
    time_decay: 'Time Decay',
    u_shaped: 'U-Shaped (40-20-40)',
};

const ALL_MODELS: AttributionModel[] = ['first_touch', 'last_touch', 'linear', 'time_decay', 'u_shaped'];

// Build: channelName → model → credit
const channelNames = computed(() => props.data.map((d) => d.channelName));

function getCredit(channelName: string, model: AttributionModel): number | null {
    const ch = props.data.find((d) => d.channelName === channelName);
    if (!ch) return null;
    const entry = ch.models.find((m) => m.model === model);
    return entry?.attributionCredit ?? null;
}

function getConversions(channelName: string, model: AttributionModel): number | null {
    const ch = props.data.find((d) => d.channelName === channelName);
    if (!ch) return null;
    const entry = ch.models.find((m) => m.model === model);
    return entry?.conversions ?? null;
}

function creditBar(credit: number | null): number {
    if (credit == null) return 0;
    return Math.min(100, credit);
}

function creditColor(credit: number | null): string {
    if (credit == null) return 'bg-gray-200';
    if (credit >= 30) return 'bg-blue-500';
    if (credit >= 15) return 'bg-blue-300';
    return 'bg-blue-200';
}
</script>

<template>
    <!-- Loading skeleton -->
    <div v-if="loading" class="animate-pulse space-y-3">
        <div class="h-6 bg-gray-200 rounded w-1/4"></div>
        <div v-for="i in 5" :key="i" class="h-12 bg-gray-100 rounded-lg"></div>
    </div>

    <!-- Empty state -->
    <div v-else-if="data.length === 0" class="py-16 text-center text-gray-400">
        <font-awesome-icon :icon="['fas', 'diagram-project']" class="text-4xl mb-3 text-gray-300" />
        <p class="text-sm font-medium text-gray-500">No comparison data available</p>
        <p class="text-xs mt-1">Run a model comparison to see how each attribution model distributes credit.</p>
    </div>

    <div v-else class="space-y-4">
        <p class="text-sm text-gray-500">
            Attribution credit (%) across channels — each row is one model.
            <span class="font-medium text-primary-blue-100">Highlighted row</span> is your active model.
        </p>

        <div class="bg-white rounded-xl border border-gray-200 overflow-hidden">
            <div class="overflow-x-auto">
                <table class="w-full text-sm">
                    <thead class="bg-gray-50 border-b border-gray-200">
                        <tr>
                            <th class="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide min-w-36">Model</th>
                            <th
                                v-for="ch in channelNames"
                                :key="ch"
                                class="text-center px-3 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide whitespace-nowrap"
                            >
                                {{ ch }}
                            </th>
                        </tr>
                    </thead>
                    <tbody class="divide-y divide-gray-100">
                        <tr
                            v-for="model in ALL_MODELS"
                            :key="model"
                            :class="[
                                'transition-colors',
                                model === activeModel
                                    ? 'bg-blue-50 border-l-4 border-primary-blue-100'
                                    : 'hover:bg-gray-50'
                            ]"
                        >
                            <!-- Model label -->
                            <td class="px-4 py-3 font-medium text-gray-800 whitespace-nowrap">
                                <div class="flex items-center gap-2">
                                    <font-awesome-icon
                                        v-if="model === activeModel"
                                        :icon="['fas', 'check-circle']"
                                        class="text-primary-blue-100 text-xs flex-shrink-0"
                                    />
                                    {{ MODEL_LABELS[model] }}
                                </div>
                            </td>

                            <!-- Credit cells -->
                            <td
                                v-for="ch in channelNames"
                                :key="ch"
                                class="px-3 py-3"
                            >
                                <div class="flex flex-col items-center gap-1 min-w-16">
                                    <span class="text-xs font-semibold text-gray-700">
                                        {{ getCredit(ch, model) != null ? `${getCredit(ch, model)!.toFixed(1)}%` : '—' }}
                                    </span>
                                    <div class="w-full h-2 bg-gray-100 rounded-full overflow-hidden">
                                        <div
                                            class="h-full rounded-full transition-all duration-500"
                                            :class="creditColor(getCredit(ch, model))"
                                            :style="{ width: `${creditBar(getCredit(ch, model))}%` }"
                                        ></div>
                                    </div>
                                    <span class="text-xs text-gray-400">
                                        {{ getConversions(ch, model) != null ? `${getConversions(ch, model)} conv.` : '' }}
                                    </span>
                                </div>
                            </td>
                        </tr>
                    </tbody>
                </table>
            </div>
        </div>
    </div>
</template>
