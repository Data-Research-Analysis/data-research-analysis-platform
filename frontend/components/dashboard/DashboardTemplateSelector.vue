<script setup lang="ts">
import { ref, computed, onMounted } from 'vue';
import { useRuntimeConfig, useNuxtApp } from '#app';
import { DASHBOARD_TEMPLATES, buildWidgetsFromTemplate } from '~/constants/dashboardTemplates';
import type { DashboardTemplate } from '~/constants/dashboardTemplates';
import { CHART_TYPE_LABELS } from '~/constants/dashboard';
import { getAuthToken } from '~/composables/AuthToken';
import type { IDashboard } from '~/types/IDashboard';

interface DataModelOption {
    data_model_id: number;
    table_name: string;
    logical_name?: string;
    columns: { column_name: string; data_type: string; table_name: string }[];
}

const props = defineProps<{
    dataModels: DataModelOption[];
    projectId: number;
    loading?: boolean;
}>();

const emit = defineEmits<{
    select: [widgets: any[], dataModelId: number | null, templateName: string];
    skip: [];
    close: [];
}>();

const config = useRuntimeConfig();
const { $swal } = useNuxtApp() as any;

// Step management
type Step = 'select-template' | 'select-data-model' | 'preview';
const step = ref<Step>('select-template');

// Local template state
const selectedTemplate = ref<DashboardTemplate | null>(null);
const selectedDataModelId = ref<number | null>(null);
const creating = ref(false);

// Server-side template state
const serverTemplates = ref<IDashboard[]>([]);
const loadingServerTemplates = ref(true);
const serverTemplateError = ref<string | null>(null);
const selectedServerTemplate = ref<IDashboard | null>(null);
const templateSource = ref<'local' | 'server'>('local');

const needsDataModel = computed(() => {
    return selectedTemplate.value && selectedTemplate.value.id !== 'blank_canvas';
});

const selectedDataModel = computed(() => {
    if (!selectedDataModelId.value) return null;
    return props.dataModels.find((dm) => dm.data_model_id === selectedDataModelId.value) ?? null;
});

const canProceed = computed(() => {
    if (!selectedTemplate.value) return false;
    if (needsDataModel.value && !selectedDataModelId.value) return false;
    return true;
});

// Preview widgets list
const previewWidgets = computed(() => {
    if (!selectedTemplate.value) return [];
    const columns = selectedDataModel.value?.columns?.map((c) => c.column_name) ?? [];
    return buildWidgetsFromTemplate(selectedTemplate.value, columns);
});

const serverTemplateMeta = computed(() => {
    if (!selectedServerTemplate.value) return null;
    return (selectedServerTemplate.value.data as any)?.template_meta ?? null;
});

// Fetch server-side templates
async function fetchServerTemplates() {
    loadingServerTemplates.value = true;
    serverTemplateError.value = null;
    try {
        const token = getAuthToken();
        if (!token) return;
        const data = await $fetch<IDashboard[]>(`${config.public.apiBase}/dashboard/templates`, {
            method: 'GET',
            headers: {
                Authorization: `Bearer ${token}`,
                'Authorization-Type': 'auth',
            },
        });
        serverTemplates.value = data ?? [];
    } catch (err: any) {
        serverTemplateError.value = err?.data?.message ?? err?.message ?? 'Failed to load templates';
    } finally {
        loadingServerTemplates.value = false;
    }
}

onMounted(() => {
    fetchServerTemplates();
});

// --- Navigation ---

function selectLocalTemplate(template: DashboardTemplate) {
    templateSource.value = 'local';
    selectedTemplate.value = template;
    selectedServerTemplate.value = null;
    if (template.id === 'blank_canvas') {
        step.value = 'preview';
    } else {
        step.value = 'select-data-model';
        if (props.dataModels.length === 1) {
            selectedDataModelId.value = props.dataModels[0].data_model_id;
        }
    }
}

function selectServerTemplate(template: IDashboard) {
    templateSource.value = 'server';
    selectedServerTemplate.value = template;
    selectedTemplate.value = null;
    step.value = 'preview';
}

function goToPreview() {
    step.value = 'preview';
}

function goBack() {
    if (step.value === 'preview') {
        if (templateSource.value === 'server') {
            step.value = 'select-template';
            selectedServerTemplate.value = null;
        } else if (needsDataModel.value) {
            step.value = 'select-data-model';
        } else {
            step.value = 'select-template';
            selectedTemplate.value = null;
        }
    } else if (step.value === 'select-data-model') {
        step.value = 'select-template';
        selectedTemplate.value = null;
        selectedDataModelId.value = null;
    }
}

function handleCreate() {
    creating.value = true;

    if (templateSource.value === 'server' && selectedServerTemplate.value) {
        // Server template: emit a special signal for clone flow
        emit('select', [], null, `server:${selectedServerTemplate.value.id}`);
    } else if (selectedTemplate.value) {
        const columns = selectedDataModel.value?.columns?.map((c) => c.column_name) ?? [];
        const widgets = buildWidgetsFromTemplate(selectedTemplate.value, columns);
        emit('select', widgets, selectedDataModelId.value, selectedTemplate.value.name);
    }
}

function handleSkip() {
    emit('skip');
}

const localIconMap: Record<string, string[]> = {
    'chart-line': ['fas', 'chart-line'],
    bullseye: ['fas', 'bullseye'],
    'chart-bar': ['fas', 'chart-bar'],
    filter: ['fas', 'filter'],
    paintbrush: ['fas', 'paintbrush'],
};

function getChartTypeLabel(type: string): string {
    return CHART_TYPE_LABELS[type] ?? type;
}
</script>

<template>
    <div class="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50 backdrop-blur-sm">
        <div class="bg-white rounded-2xl shadow-2xl w-full max-w-4xl max-h-[90vh] overflow-y-auto mx-4">
            <!-- Header -->
            <div class="flex items-center justify-between px-8 pt-8 pb-4 border-b border-gray-100">
                <div>
                    <h2 class="text-2xl font-bold text-gray-900">Create Dashboard</h2>
                    <p class="text-sm text-gray-500 mt-1">
                        <template v-if="step === 'select-template'">
                            Choose a template to get started, or start from scratch.
                        </template>
                        <template v-else-if="step === 'select-data-model'">
                            Select a data model to bind to
                            <span class="font-medium text-gray-700">{{ selectedTemplate?.name }}</span>
                            widgets.
                        </template>
                        <template v-else-if="step === 'preview'">
                            Review your dashboard configuration before creating.
                        </template>
                    </p>
                </div>
                <button
                    class="p-2 text-gray-400 hover:text-gray-600 rounded-lg transition-colors"
                    @click="emit('close')"
                >
                    <font-awesome-icon :icon="['fas', 'xmark']" class="text-xl" />
                </button>
            </div>

            <!-- Step 1: Template Selection -->
            <div v-if="step === 'select-template'" class="px-8 py-6">
                <!-- Local templates -->
                <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                    <div
                        v-for="template in DASHBOARD_TEMPLATES"
                        :key="template.id"
                        class="group relative bg-white border border-gray-200 rounded-xl overflow-hidden hover:shadow-lg hover:border-blue-300 transition-all duration-200 cursor-pointer flex flex-col"
                        @click="selectLocalTemplate(template)"
                    >
                        <!-- Card Header -->
                        <div
                            class="p-5 flex items-center gap-3"
                            :style="{ background: `linear-gradient(135deg, ${template.color}22, ${template.color}08)` }"
                        >
                            <div
                                class="w-10 h-10 rounded-lg flex items-center justify-center text-white"
                                :style="{ backgroundColor: template.color }"
                            >
                                <font-awesome-icon :icon="['fas', template.icon]" class="text-lg" />
                            </div>
                            <div>
                                <h3 class="font-semibold text-gray-900 text-sm">{{ template.name }}</h3>
                                <span class="text-xs text-gray-500">{{ template.best_for }}</span>
                            </div>
                        </div>

                        <!-- Card Body -->
                        <div class="px-5 pb-5 flex-1 flex flex-col">
                            <p class="text-xs text-gray-500 leading-relaxed flex-1">
                                {{ template.description }}
                            </p>
                            <div class="mt-3 flex items-center justify-between">
                                <span
                                    v-if="template.widgets.length > 0"
                                    class="text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded-full"
                                >
                                    {{ template.widgets.length }} widget{{ template.widgets.length !== 1 ? 's' : '' }}
                                </span>
                                <span v-else class="text-xs text-gray-400 italic">Empty</span>
                                <font-awesome-icon
                                    :icon="['fas', 'arrow-right']"
                                    class="text-gray-300 group-hover:text-blue-500 transition-colors"
                                />
                            </div>
                        </div>
                    </div>
                </div>

                <!-- Server-side templates section -->
                <div v-if="serverTemplates.length > 0" class="mt-8 pt-6 border-t border-gray-200">
                    <h3 class="text-sm font-semibold text-gray-700 mb-1">Community Templates</h3>
                    <p class="text-xs text-gray-400 mb-4">Pre-built templates from your organisation. Your copy is fully editable.</p>
                    <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                        <div
                            v-for="template in serverTemplates"
                            :key="template.id"
                            class="group relative bg-white border border-gray-200 rounded-xl overflow-hidden hover:shadow-lg hover:border-blue-300 transition-all duration-200 cursor-pointer flex flex-col"
                            @click="selectServerTemplate(template)"
                        >
                            <div class="bg-gradient-to-r from-primary-blue-300 to-blue-500 p-5 flex items-center justify-between">
                                <font-awesome-icon :icon="['fas', 'chart-bar']" class="text-white text-2xl" />
                                <span class="text-white text-xs font-medium bg-white bg-opacity-20 px-2 py-1 rounded-full">
                                    {{ (template.data as any)?.charts?.length ?? 0 }} widget{{ ((template.data as any)?.charts?.length ?? 0) !== 1 ? 's' : '' }}
                                </span>
                            </div>
                            <div class="px-5 pb-5 flex-1 flex flex-col">
                                <h3 class="font-semibold text-gray-900 text-sm mb-1">
                                    {{ template.name ?? `Template #${template.id}` }}
                                </h3>
                                <p class="text-xs text-gray-500 leading-relaxed flex-1">
                                    {{ (template.data as any)?.template_meta?.description ?? 'A pre-built dashboard template.' }}
                                </p>
                                <div class="mt-3 flex items-center justify-end">
                                    <font-awesome-icon
                                        :icon="['fas', 'arrow-right']"
                                        class="text-gray-300 group-hover:text-blue-500 transition-colors"
                                    />
                                </div>
                            </div>
                        </div>
                    </div>
                </div>

                <!-- Server template loading -->
                <div v-else-if="loadingServerTemplates" class="mt-8 pt-6 border-t border-gray-200">
                    <h3 class="text-sm font-semibold text-gray-700 mb-4">Community Templates</h3>
                    <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                        <div v-for="i in 3" :key="i" class="bg-white border border-gray-200 rounded-xl overflow-hidden animate-pulse">
                            <div class="h-20 bg-gray-200"></div>
                            <div class="p-5">
                                <div class="h-4 bg-gray-200 rounded w-3/4 mb-2"></div>
                                <div class="h-3 bg-gray-200 rounded w-full mb-1"></div>
                                <div class="h-3 bg-gray-200 rounded w-5/6"></div>
                            </div>
                        </div>
                    </div>
                </div>

                <!-- Skip link -->
                <div class="mt-6 text-center">
                    <button
                        class="text-sm text-gray-400 hover:text-gray-600 underline underline-offset-2 transition-colors"
                        @click="handleSkip"
                    >
                        Skip templates — start with blank canvas
                    </button>
                </div>
            </div>

            <!-- Step 2: Data Model Selection -->
            <div v-else-if="step === 'select-data-model'" class="px-8 py-6">
                <!-- Back button -->
                <button
                    class="flex items-center gap-2 text-sm text-gray-500 hover:text-gray-700 mb-4 transition-colors"
                    @click="goBack"
                >
                    <font-awesome-icon :icon="['fas', 'arrow-left']" />
                    Back to templates
                </button>

                <!-- Selected template summary -->
                <div class="flex items-center gap-3 mb-6 p-4 bg-gray-50 rounded-lg">
                    <div
                        class="w-10 h-10 rounded-lg flex items-center justify-center text-white shrink-0"
                        :style="{ backgroundColor: selectedTemplate?.color }"
                    >
                        <font-awesome-icon :icon="['fas', selectedTemplate?.icon ?? 'chart-bar']" class="text-lg" />
                    </div>
                    <div>
                        <h3 class="font-semibold text-gray-900">{{ selectedTemplate?.name }}</h3>
                        <p class="text-xs text-gray-500">{{ selectedTemplate?.description }}</p>
                    </div>
                </div>

                <!-- Data model selector -->
                <div>
                    <label class="block text-sm font-medium text-gray-700 mb-2">
                        Select a data model to bind widgets to
                    </label>
                    <div v-if="props.dataModels.length === 0" class="p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
                        <p class="text-sm text-yellow-700">
                            <font-awesome-icon :icon="['fas', 'exclamation-triangle']" class="mr-1" />
                            No data models found. Please create a data model first, then try again.
                        </p>
                    </div>
                    <select
                        v-else
                        v-model="selectedDataModelId"
                        class="w-full px-4 py-3 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-shadow"
                    >
                        <option :value="null" disabled>Choose a data model...</option>
                        <option
                            v-for="dm in props.dataModels"
                            :key="dm.data_model_id"
                            :value="dm.data_model_id"
                        >
                            {{ dm.logical_name || dm.table_name }}
                            <template v-if="dm.columns?.length">
                                ({{ dm.columns.length }} columns)
                            </template>
                        </option>
                    </select>

                    <!-- Data model preview -->
                    <div
                        v-if="selectedDataModel"
                        class="mt-4 p-4 bg-gray-50 rounded-lg border border-gray-200"
                    >
                        <p class="text-xs font-medium text-gray-500 uppercase tracking-wide mb-2">
                            Available Columns
                        </p>
                        <div class="flex flex-wrap gap-1.5">
                            <span
                                v-for="col in selectedDataModel.columns"
                                :key="col.column_name"
                                class="text-xs bg-white border border-gray-200 text-gray-600 px-2 py-1 rounded-md"
                            >
                                {{ col.column_name }}
                                <span class="text-gray-400 ml-0.5">{{ col.data_type }}</span>
                            </span>
                        </div>
                    </div>
                </div>

                <!-- Next button -->
                <div class="mt-6 flex items-center justify-end gap-3">
                    <button
                        class="px-4 py-2 text-sm text-gray-500 hover:text-gray-700 transition-colors"
                        @click="goBack"
                    >
                        Change Template
                    </button>
                    <button
                        :disabled="!canProceed"
                        class="inline-flex items-center px-6 py-2.5 bg-primary-blue-300 hover:bg-primary-blue-100 text-white text-sm font-medium rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                        @click="goToPreview"
                    >
                        Next — Preview
                        <font-awesome-icon :icon="['fas', 'arrow-right']" class="ml-2" />
                    </button>
                </div>
            </div>

            <!-- Step 3: Preview & Confirm -->
            <div v-else-if="step === 'preview'" class="px-8 py-6">
                <!-- Back button -->
                <button
                    class="flex items-center gap-2 text-sm text-gray-500 hover:text-gray-700 mb-4 transition-colors"
                    @click="goBack"
                >
                    <font-awesome-icon :icon="['fas', 'arrow-left']" />
                    Back
                </button>

                <!-- Template summary card -->
                <div class="flex items-center gap-4 mb-6 p-5 bg-gray-50 rounded-lg border border-gray-200">
                    <div
                        v-if="templateSource === 'local' && selectedTemplate"
                        class="w-12 h-12 rounded-lg flex items-center justify-center text-white shrink-0"
                        :style="{ backgroundColor: selectedTemplate.color }"
                    >
                        <font-awesome-icon :icon="['fas', selectedTemplate.icon]" class="text-xl" />
                    </div>
                    <div
                        v-else-if="templateSource === 'server' && selectedServerTemplate"
                        class="w-12 h-12 rounded-lg flex items-center justify-center text-white shrink-0 bg-gradient-to-r from-primary-blue-300 to-blue-500"
                    >
                        <font-awesome-icon :icon="['fas', 'chart-bar']" class="text-xl" />
                    </div>
                    <div class="flex-1">
                        <h3 class="font-semibold text-gray-900">
                            <template v-if="templateSource === 'local' && selectedTemplate">{{ selectedTemplate.name }}</template>
                            <template v-else-if="templateSource === 'server' && selectedServerTemplate">{{ selectedServerTemplate.name ?? `Template #${selectedServerTemplate.id}` }}</template>
                        </h3>
                        <p class="text-xs text-gray-500 mt-0.5">
                            <template v-if="templateSource === 'local' && selectedTemplate">{{ selectedTemplate.best_for }}</template>
                            <template v-else-if="serverTemplateMeta">{{ serverTemplateMeta.description }}</template>
                        </p>
                    </div>
                    <div v-if="selectedDataModel" class="text-right shrink-0">
                        <p class="text-xs text-gray-400 uppercase tracking-wide">Data Model</p>
                        <p class="text-sm font-medium text-gray-700">{{ selectedDataModel.logical_name || selectedDataModel.table_name }}</p>
                    </div>
                    <div v-else-if="templateSource === 'local' && selectedTemplate?.id === 'blank_canvas'" class="text-right shrink-0">
                        <p class="text-xs text-gray-400 uppercase tracking-wide">Mode</p>
                        <p class="text-sm font-medium text-gray-700">Blank Canvas</p>
                    </div>
                </div>

                <!-- Widget preview grid -->
                <div v-if="templateSource === 'local' && previewWidgets.length > 0">
                    <h4 class="text-sm font-semibold text-gray-700 mb-3">
                        Widgets to be created ({{ previewWidgets.length }})
                    </h4>
                    <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 max-h-[40vh] overflow-y-auto pr-1">
                        <div
                            v-for="(widget, idx) in previewWidgets"
                            :key="idx"
                            class="flex items-center gap-3 p-3 bg-white border border-gray-200 rounded-lg"
                        >
                            <div class="w-8 h-8 rounded bg-blue-50 flex items-center justify-center shrink-0">
                                <font-awesome-icon :icon="['fas', 'chart-bar']" class="text-blue-400 text-sm" />
                            </div>
                            <div class="min-w-0 flex-1">
                                <p class="text-sm font-medium text-gray-800 truncate">{{ widget.label ?? getChartTypeLabel(widget.chart_type) }}</p>
                                <p class="text-xs text-gray-400">{{ getChartTypeLabel(widget.chart_type) }}</p>
                            </div>
                        </div>
                    </div>
                </div>

                <!-- Server template widget preview -->
                <div v-else-if="templateSource === 'server' && selectedServerTemplate">
                    <h4 class="text-sm font-semibold text-gray-700 mb-3">
                        Widgets included ({{ (selectedServerTemplate.data as any)?.charts?.length ?? 0 }})
                    </h4>
                    <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 max-h-[40vh] overflow-y-auto pr-1">
                        <div
                            v-for="(chart, idx) in ((selectedServerTemplate.data as any)?.charts ?? [])"
                            :key="idx"
                            class="flex items-center gap-3 p-3 bg-white border border-gray-200 rounded-lg"
                        >
                            <div class="w-8 h-8 rounded bg-blue-50 flex items-center justify-center shrink-0">
                                <font-awesome-icon :icon="['fas', 'chart-bar']" class="text-blue-400 text-sm" />
                            </div>
                            <div class="min-w-0 flex-1">
                                <p class="text-sm font-medium text-gray-800 truncate">{{ chart.label ?? getChartTypeLabel(chart.chart_type) }}</p>
                                <p class="text-xs text-gray-400">{{ getChartTypeLabel(chart.chart_type) }}</p>
                            </div>
                        </div>
                    </div>
                </div>

                <!-- Blank canvas message -->
                <div v-else-if="templateSource === 'local' && selectedTemplate?.id === 'blank_canvas'" class="text-center py-8">
                    <font-awesome-icon :icon="['fas', 'paintbrush']" class="text-gray-300 text-4xl mb-3" />
                    <p class="text-sm text-gray-500">You'll start with an empty dashboard. Add charts and widgets from the sidebar.</p>
                </div>

                <!-- Action buttons -->
                <div class="mt-6 flex items-center justify-between">
                    <button
                        class="px-4 py-2 text-sm text-gray-500 hover:text-gray-700 transition-colors"
                        @click="goBack"
                    >
                        <font-awesome-icon :icon="['fas', 'arrow-left']" class="mr-1" />
                        Back
                    </button>
                    <button
                        :disabled="creating"
                        class="inline-flex items-center px-6 py-2.5 bg-primary-blue-300 hover:bg-primary-blue-100 text-white text-sm font-medium rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                        @click="handleCreate"
                    >
                        <font-awesome-icon
                            v-if="creating"
                            :icon="['fas', 'spinner']"
                            class="mr-2 animate-spin"
                        />
                        <font-awesome-icon v-else :icon="['fas', 'check']" class="mr-2" />
                        Create Dashboard
                    </button>
                </div>
            </div>
        </div>
    </div>
</template>
