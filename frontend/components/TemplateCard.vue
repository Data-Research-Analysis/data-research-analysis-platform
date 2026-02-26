<script setup lang="ts">
import { computed } from 'vue';
import type { IDashboard } from '~/types/IDashboard';

interface Props {
    template: IDashboard;
    loading?: boolean;
}

const props = withDefaults(defineProps<Props>(), { loading: false });
const emit = defineEmits<{ use: [templateId: number] }>();

// Map template icon names (stored in template_meta) to Font Awesome icons
const iconMap: Record<string, string[]> = {
    'chart-pie': ['fas', 'chart-pie'],
    'magnifying-glass-chart': ['fas', 'magnifying-glass-chart'],
    linkedin: ['fab', 'linkedin'],
    filter: ['fas', 'filter'],
    gauge: ['fas', 'gauge'],
};

const templateMeta = computed(() => (props.template.data as any)?.template_meta ?? {});

const icon = computed((): string[] => {
    const name = templateMeta.value.icon as string | undefined;
    return (name && iconMap[name]) ? iconMap[name] : ['fas', 'chart-bar'];
});

const widgetCount = computed((): number =>
    templateMeta.value.widget_count ?? props.template.data?.charts?.length ?? 0,
);

const description = computed((): string =>
    templateMeta.value.description ?? 'A pre-built marketing dashboard template.',
);

const chartTypes = computed((): string[] => {
    const charts = props.template.data?.charts ?? [];
    const types = new Set(charts.map((c: any) => c.chart_type as string));
    return Array.from(types).slice(0, 4) as string[];
});

const chartTypeLabel: Record<string, string> = {
    kpi_scorecard: 'KPI',
    table: 'Table',
    pie: 'Pie',
    donut: 'Donut',
    vertical_bar: 'Bar',
    horizontal_bar: 'H-Bar',
    vertical_bar_line: 'Combo',
    stacked_bar: 'Stacked',
    multiline: 'Line',
    treemap: 'Treemap',
    bubble: 'Bubble',
    budget_gauge: 'Gauge',
    channel_comparison_table: 'Channel',
    funnel_steps: 'Funnel',
};
</script>

<template>
    <div class="bg-white border border-gray-200 rounded-xl shadow-sm hover:shadow-md hover:border-primary-blue-300 transition-all duration-200 flex flex-col overflow-hidden">
        <!-- Card header with icon -->
        <div class="bg-gradient-to-r from-primary-blue-300 to-blue-500 p-6 flex items-center justify-between">
            <font-awesome-icon :icon="icon" class="text-white text-3xl" />
            <span class="text-white text-xs font-medium bg-white bg-opacity-20 px-2 py-1 rounded-full">
                {{ widgetCount }} widget{{ widgetCount !== 1 ? 's' : '' }}
            </span>
        </div>

        <!-- Card body -->
        <div class="p-5 flex flex-col flex-1">
            <h3 class="text-lg font-semibold text-gray-900 mb-2">
                {{ template.name ?? `Template #${template.id}` }}
            </h3>
            <p class="text-sm text-gray-500 leading-relaxed flex-1">
                {{ description }}
            </p>

            <!-- Widget type chips -->
            <div class="flex flex-wrap gap-1 mt-4">
                <span
                    v-for="type in chartTypes"
                    :key="type"
                    class="text-xs bg-blue-50 text-primary-blue-300 px-2 py-0.5 rounded-full border border-blue-100"
                >
                    {{ chartTypeLabel[type] ?? type }}
                </span>
                <span
                    v-if="(template.data?.charts?.length ?? 0) > chartTypes.length"
                    class="text-xs bg-gray-50 text-gray-500 px-2 py-0.5 rounded-full border border-gray-200"
                >
                    +{{ (template.data?.charts?.length ?? 0) - chartTypes.length }} more
                </span>
            </div>

            <!-- Action button -->
            <button
                class="mt-5 w-full flex items-center justify-center px-4 py-2.5 bg-primary-blue-300 hover:bg-primary-blue-100 text-white text-sm font-medium rounded-lg transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
                :disabled="loading"
                @click="emit('use', template.id)"
            >
                <font-awesome-icon
                    v-if="loading"
                    :icon="['fas', 'spinner']"
                    class="mr-2 animate-spin"
                />
                <font-awesome-icon v-else :icon="['fas', 'plus']" class="mr-2" />
                Use This Template
            </button>
        </div>
    </div>
</template>
