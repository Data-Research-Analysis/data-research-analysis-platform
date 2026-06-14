<script setup lang="ts">
import { useProjectRole } from '@/composables/useProjectRole';
import { useReports, type IReport } from '@/composables/useReports';
import { useReportTemplates } from '@/composables/useReportTemplates';
import { useDataModelsStore } from '@/stores/data_models';

const props = defineProps<{
    projectId: number;
}>();

const router = useRouter();
const { $swal } = useNuxtApp();
const { isAnalyst, isManager } = useProjectRole();
const reports = useReports();

const activeTab = ref<'my-reports' | 'templates'>('my-reports');

interface State {
    loading: boolean;
    items: IReport[];
    showCreateModal: boolean;
    creating: boolean;
    newReportName: string;
    newReportDescription: string;
    deletingId: number | null;
}
const state = reactive<State>({
    loading: true,
    items: [],
    showCreateModal: false,
    creating: false,
    newReportName: '',
    newReportDescription: '',
    deletingId: null,
});

// Templates tab state
const templateState = reactive({
    loading: false,
    generating: false,
    dataModelId: null as number | null,
    dataModelName: '',
    showDataModelPicker: false,
    dataModels: [] as any[],
    dataModelsLoading: false,
    templates: [] as any[],
    selectedTemplateId: null as string | null,
    error: null as string | null,
    result: null as any,
    skipAiAnalysis: false,
});

const {
    fetchTemplates,
    generateFromTemplate,
    getTemplateIcon,
    getCategoryColor,
    getSectionTypeLabel,
    reset: resetTemplates,
    loading: templatesLoading,
    generating: templatesGenerating,
    error: templatesError,
    result: templateResult,
} = useReportTemplates();

async function loadDataModels() {
    templateState.dataModelsLoading = true;
    try {
        const store = useDataModelsStore();
        await store.retrieveDataModels(props.projectId);
        templateState.dataModels = store.dataModels.filter((dm: any) => (dm.column_count ?? 0) > 0);
    } catch (err) {
        templateState.dataModels = [];
    } finally {
        templateState.dataModelsLoading = false;
    }
}

async function handleDataModelSelect(model: any) {
    templateState.dataModelId = model.id;
    templateState.dataModelName = model.name;
    templateState.showDataModelPicker = false;
    templateState.error = null;
    templateState.result = null;
    templateState.selectedTemplateId = null;

    templateState.loading = true;
    try {
        const templates = await fetchTemplates(model.id, props.projectId);
        templateState.templates = templates;
    } catch (err: any) {
        templateState.error = err?.message || 'Failed to load templates';
    } finally {
        templateState.loading = false;
    }
}

function handleTemplateSelect(tpl: any) {
    if (!tpl.compatible) return;
    templateState.selectedTemplateId = templateState.selectedTemplateId === tpl.id ? null : tpl.id;
}

async function handleGenerateFromTemplate() {
    if (!templateState.dataModelId || !templateState.selectedTemplateId) return;

    templateState.generating = true;
    templateState.error = null;

    const result = await generateFromTemplate(
        templateState.dataModelId,
        props.projectId,
        templateState.selectedTemplateId,
        { skipAiAnalysis: templateState.skipAiAnalysis },
    );

    if (result) {
        templateState.result = result;
        const reportId = result.report?.id;
        if (reportId) {
            router.push(`/projects/${props.projectId}/reports/${reportId}/edit`);
        }
    } else {
        templateState.error = templatesError.value;
    }
    templateState.generating = false;
}

function resetTemplateSelection() {
    templateState.dataModelId = null;
    templateState.dataModelName = '';
    templateState.templates = [];
    templateState.selectedTemplateId = null;
    templateState.error = null;
    templateState.result = null;
    templateState.skipAiAnalysis = false;
    resetTemplates();
}

async function loadReports() {
    state.loading = true;
    state.items = await reports.getReports(props.projectId);
    state.loading = false;
}

function openCreate() {
    state.newReportName = '';
    state.newReportDescription = '';
    state.showCreateModal = true;
}

async function submitCreate() {
    if (!state.newReportName.trim()) return;
    state.creating = true;
    const report = await reports.createReport(
        props.projectId,
        state.newReportName.trim(),
        state.newReportDescription.trim() || undefined,
    );
    state.creating = false;
    if (report) {
        state.showCreateModal = false;
        router.push(`/projects/${props.projectId}/reports/${report.id}/edit`);
    } else {
        $swal.fire('Error', 'Could not create the report. Please try again.', 'error');
    }
}

async function confirmDelete(report: IReport) {
    const { value: confirmed } = await $swal.fire({
        title: 'Delete report?',
        text: `"${report.name}" will be permanently deleted.`,
        icon: 'warning',
        showCancelButton: true,
        confirmButtonColor: '#3C8DBC',
        cancelButtonColor: '#d33',
        confirmButtonText: 'Yes, delete it!',
    });
    if (!confirmed) return;
    state.deletingId = report.id;
    const ok = await reports.deleteReport(report.id, report.project_id);
    state.deletingId = null;
    if (ok) {
        state.items = state.items.filter(r => r.id !== report.id);
        $swal.fire('Deleted', 'The report has been deleted.', 'success');
    } else {
        $swal.fire('Error', 'Could not delete the report. Please try again.', 'error');
    }
}

onMounted(() => {
    loadReports();
});
</script>

<template>
    <div class="flex flex-col">
        <!-- Tab header -->
        <div class="flex border-b border-gray-200 mb-6">
            <button
                class="px-6 py-3 text-sm font-medium transition-colors cursor-pointer"
                :class="activeTab === 'my-reports'
                    ? 'border-b-2 border-primary-blue-300 text-primary-blue-300'
                    : 'text-gray-500 hover:text-gray-700'"
                @click="activeTab = 'my-reports'"
            >
                <font-awesome-icon :icon="['fas', 'chart-bar']" class="mr-2" />
                My Reports
            </button>
            <button
                class="px-6 py-3 text-sm font-medium transition-colors cursor-pointer"
                :class="activeTab === 'templates'
                    ? 'border-b-2 border-primary-blue-300 text-primary-blue-300'
                    : 'text-gray-500 hover:text-gray-700'"
                @click="activeTab = 'templates'"
            >
                <font-awesome-icon :icon="['fas', 'layer-group']" class="mr-2" />
                Templates
            </button>
        </div>

        <!-- My Reports tab -->
        <div v-if="activeTab === 'my-reports'">
            <tab-content-panel :corners="['top-right', 'bottom-left', 'bottom-right']">
                <!-- Header row -->
                <div class="flex justify-between items-center mb-6">
                    <div>
                        <h2 class="font-bold text-2xl">Reports</h2>
                        <p class="text-sm text-gray-500 mt-1">Curated summaries of dashboards, widgets, and AI insights for sharing with your team.</p>
                    </div>
                    <button
                        v-if="isAnalyst"
                        class="inline-flex items-center gap-2 px-4 py-2 bg-primary-blue-300 hover:bg-primary-blue-100 text-white rounded-lg transition-colors text-sm font-medium cursor-pointer"
                        @click="openCreate"
                    >
                        <font-awesome-icon :icon="['fas', 'plus']" />
                        New Report
                    </button>
                </div>

                <!-- Loading -->
                <div v-if="state.loading" class="flex justify-center items-center py-16">
                    <font-awesome-icon :icon="['fas', 'spinner']" class="animate-spin text-3xl text-gray-400" />
                </div>

                <!-- Empty state — analyst -->
                <div v-else-if="state.items.length === 0 && isAnalyst" class="text-center py-16">
                    <font-awesome-icon :icon="['fas', 'chart-bar']" class="text-5xl text-gray-300 mb-4" />
                    <p class="text-lg font-medium text-gray-600 mb-2">No reports yet</p>
                    <p class="text-sm text-gray-400 mb-6">Create your first report to start curating dashboards and insights for your team.</p>
                    <button
                        class="inline-flex items-center gap-2 px-5 py-2.5 bg-primary-blue-300 hover:bg-primary-blue-100 text-white rounded-lg transition-colors text-sm font-medium cursor-pointer"
                        @click="openCreate"
                    >
                        <font-awesome-icon :icon="['fas', 'plus']" />
                        Create your first report
                    </button>
                </div>

                <!-- Empty state — manager / CMO -->
                <div v-else-if="state.items.length === 0" class="text-center py-16">
                    <font-awesome-icon :icon="['fas', 'chart-bar']" class="text-5xl text-gray-300 mb-4" />
                    <p class="text-lg font-medium text-gray-600 mb-2">No reports yet</p>
                    <p class="text-sm text-gray-400">No reports have been created for this project yet.</p>
                </div>

                <!-- Report list -->
                <div v-else class="flex flex-col gap-3">
                    <div
                        v-for="report in state.items"
                        :key="report.id"
                        class="flex items-center justify-between p-4 border border-gray-200 rounded-lg hover:border-gray-300 hover:bg-gray-50 transition-colors"
                    >
                        <!-- Left: name + meta -->
                        <div class="min-w-0 flex-1 mr-4">
                            <div class="flex items-center gap-2 mb-1">
                                <span class="font-medium text-gray-900 truncate">{{ report.name }}</span>
                                <span
                                    class="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium shrink-0"
                                    :class="report.status === 'published'
                                        ? 'bg-green-100 text-green-700'
                                        : 'bg-yellow-100 text-yellow-700'"
                                >
                                    <font-awesome-icon
                                        :icon="['fas', report.status === 'published' ? 'circle-check' : 'pencil']"
                                        class="mr-1 text-xs"
                                    />
                                    {{ report.status === 'published' ? 'Published' : 'Draft' }}
                                </span>
                            </div>
                            <p v-if="report.description" class="text-xs text-gray-400 truncate mb-1">{{ report.description }}</p>
                            <div class="flex items-center gap-3 text-xs text-gray-400">
                                <span v-if="report.created_by_name">
                                    <font-awesome-icon :icon="['fas', 'user']" class="mr-1" />
                                    {{ report.created_by_name }}
                                </span>
                                <span>
                                    <font-awesome-icon :icon="['fas', 'clock']" class="mr-1" />
                                    Updated {{ reports.formatReportDate(report.updated_at) }}
                                </span>
                                <span v-if="report.items_count !== undefined">
                                    <font-awesome-icon :icon="['fas', 'layer-group']" class="mr-1" />
                                    {{ report.items_count }} item{{ report.items_count === 1 ? '' : 's' }}
                                </span>
                            </div>
                        </div>

                        <!-- Right: actions -->
                        <div class="flex items-center gap-2 shrink-0">
                            <NuxtLink
                                v-if="isManager"
                                :to="`/projects/${props.projectId}/reports/${report.id}/edit`"
                                class="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-gray-600 bg-white border border-gray-300 rounded-md hover:bg-gray-50 transition-colors cursor-pointer"
                            >
                                <font-awesome-icon :icon="['fas', 'pen']" />
                                Edit
                            </NuxtLink>
                            <NuxtLink
                                v-else
                                :to="`/projects/${props.projectId}/reports/${report.id}/edit`"
                                class="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-gray-600 bg-white border border-gray-300 rounded-md hover:bg-gray-50 transition-colors cursor-pointer"
                            >
                                <font-awesome-icon :icon="['fas', 'eye']" />
                                View
                            </NuxtLink>
                            <button
                                v-if="isAnalyst"
                                class="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-red-600 bg-white border border-red-200 rounded-md hover:bg-red-50 transition-colors cursor-pointer"
                                :disabled="state.deletingId === report.id"
                                @click="confirmDelete(report)"
                            >
                                <font-awesome-icon
                                    :icon="['fas', state.deletingId === report.id ? 'spinner' : 'trash']"
                                    :class="{ 'animate-spin': state.deletingId === report.id }"
                                />
                                Delete
                            </button>
                        </div>
                    </div>
                </div>
            </tab-content-panel>
        </div>

        <!-- Templates tab -->
        <div v-if="activeTab === 'templates'">
            <tab-content-panel :corners="['top-right', 'bottom-left', 'bottom-right']">
                <div class="flex justify-between items-center mb-6">
                    <div>
                        <h2 class="font-bold text-2xl">Report Templates</h2>
                        <p class="text-sm text-gray-500 mt-1">Choose a data model and template to quickly generate a structured report.</p>
                    </div>
                </div>

                <!-- No data model selected -->
                <div v-if="!templateState.dataModelId">
                    <div class="flex items-center gap-3 mb-4">
                        <button
                            class="inline-flex items-center gap-2 px-4 py-2 bg-primary-blue-300 hover:bg-primary-blue-100 text-white rounded-lg transition-colors text-sm font-medium cursor-pointer"
                            @click="templateState.showDataModelPicker = true; loadDataModels()"
                        >
                            <font-awesome-icon :icon="['fas', 'database']" />
                            Select Data Model
                        </button>
                    </div>
                    <div class="bg-gray-50 rounded-lg p-8 text-center">
                        <font-awesome-icon :icon="['fas', 'layer-group']" class="text-4xl text-gray-300 mb-3" />
                        <p class="text-sm text-gray-500">Select a data model to see available report templates.</p>
                    </div>
                </div>

                <!-- Data model picked, show templates -->
                <div v-else>
                    <div class="flex items-center gap-2 mb-4 p-3 bg-blue-50 rounded-lg">
                        <font-awesome-icon :icon="['fas', 'database']" class="text-blue-500" />
                        <span class="text-sm font-medium text-blue-700 flex-1">{{ templateState.dataModelName }}</span>
                        <button
                            class="text-xs text-blue-500 hover:text-blue-700 underline cursor-pointer"
                            @click="resetTemplateSelection"
                        >
                            Change
                        </button>
                    </div>

                    <!-- Loading -->
                    <div v-if="templateState.loading" class="flex justify-center py-8">
                        <font-awesome-icon :icon="['fas', 'spinner']" class="animate-spin text-2xl text-gray-400" />
                    </div>

                    <!-- Error -->
                    <div v-else-if="templateState.error" class="p-4 bg-red-50 rounded-lg">
                        <p class="text-sm text-red-700">{{ templateState.error }}</p>
                    </div>

                    <!-- Success / result -->
                    <div v-else-if="templateState.result" class="p-4 bg-green-50 rounded-lg">
                        <div class="flex items-center gap-2 mb-2">
                            <font-awesome-icon :icon="['fas', 'circle-check']" class="text-green-500" />
                            <span class="text-sm font-medium text-green-700">Report created!</span>
                        </div>
                        <p class="text-xs text-green-600">Redirecting to the report editor...</p>
                    </div>

                    <!-- Template list -->
                    <div v-else>
                        <!-- Skip AI option -->
                        <div class="flex items-start gap-3 p-3 bg-gray-50 rounded-lg mb-4">
                            <input
                                id="skip-ai-templates"
                                type="checkbox"
                                v-model="templateState.skipAiAnalysis"
                                class="mt-1 h-4 w-4 text-indigo-600 rounded border-gray-300 focus:ring-indigo-500"
                            />
                            <label for="skip-ai-templates" class="cursor-pointer">
                                <span class="text-sm font-medium text-gray-900">Skip AI Analysis</span>
                                <p class="text-xs text-gray-500 mt-0.5">Generate report structure without AI insights (add later in the builder).</p>
                            </label>
                        </div>

                        <div class="space-y-3">
                            <div
                                v-for="tpl in templateState.templates"
                                :key="tpl.id"
                                class="relative rounded-lg border-2 transition-all p-4"
                                :class="[
                                    templateState.selectedTemplateId === tpl.id
                                        ? 'border-indigo-500 bg-indigo-50 shadow-sm'
                                        : tpl.compatible
                                            ? 'border-gray-200 hover:border-indigo-300 hover:shadow-sm cursor-pointer'
                                            : 'border-gray-100 bg-gray-50 opacity-60',
                                ]"
                                @click="handleTemplateSelect(tpl)"
                            >
                                <div class="flex items-start gap-3">
                                    <div class="w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0 text-lg"
                                        :class="getCategoryColor(tpl.category).bg">
                                        {{ getTemplateIcon(tpl) }}
                                    </div>
                                    <div class="flex-1 min-w-0">
                                        <div class="flex items-center gap-2">
                                            <h4 class="text-sm font-semibold text-gray-900 truncate">{{ tpl.name }}</h4>
                                            <span class="px-2 py-0.5 text-[10px] font-medium rounded-full"
                                                :class="getCategoryColor(tpl.category).badge">
                                                {{ tpl.category.replace(/_/g, ' ').replace(/\b\w/g, (c: string) => c.toUpperCase()) }}
                                            </span>
                                        </div>
                                        <p class="text-xs text-gray-500 mt-1">{{ tpl.description }}</p>
                                        <div v-if="!tpl.compatible" class="flex items-center gap-1.5 mt-2">
                                            <font-awesome-icon :icon="['fas', 'circle-exclamation']" class="text-amber-500 text-xs" />
                                            <span class="text-xs text-amber-700">{{ tpl.compatibilityReason || 'Not compatible' }}</span>
                                        </div>
                                        <div v-if="templateState.selectedTemplateId === tpl.id && tpl.compatible" class="mt-3">
                                            <p class="text-[10px] font-semibold text-gray-500 uppercase tracking-wider mb-2">Report Sections</p>
                                            <div class="space-y-1.5">
                                                <div v-for="(section, idx) in tpl.sections" :key="section.id"
                                                    class="flex items-center gap-2">
                                                    <span class="w-5 h-5 rounded-full bg-indigo-100 text-indigo-600 text-[10px] font-bold flex items-center justify-center flex-shrink-0">
                                                        {{ idx + 1 }}
                                                    </span>
                                                    <span class="text-xs text-gray-700">{{ section.title }}</span>
                                                    <span class="text-[10px] text-gray-400 bg-gray-100 px-1.5 py-0.5 rounded">
                                                        {{ getSectionTypeLabel(section.type) }}
                                                    </span>
                                                    <span v-if="section.condition" class="text-[10px] text-amber-500" title="Conditional section">*</span>
                                                </div>
                                            </div>
                                            <p class="text-[10px] text-gray-400 mt-2">* Conditional — only included if data model meets requirements</p>
                                        </div>
                                    </div>
                                    <div v-if="templateState.selectedTemplateId === tpl.id && tpl.compatible" class="flex-shrink-0">
                                        <div class="w-6 h-6 rounded-full bg-indigo-600 flex items-center justify-center">
                                            <font-awesome-icon :icon="['fas', 'check']" class="text-white text-xs" />
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>

                        <div class="flex justify-end mt-6">
                            <button
                                class="inline-flex items-center gap-2 px-5 py-2 bg-primary-blue-300 hover:bg-primary-blue-100 text-white text-sm font-medium rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
                                :disabled="!templateState.selectedTemplateId || templateState.generating"
                                @click="handleGenerateFromTemplate"
                            >
                                <font-awesome-icon :icon="['fas', templateState.generating ? 'spinner' : 'wand-magic-sparkles']"
                                    :class="{ 'animate-spin': templateState.generating }" />
                                {{ templateState.generating ? 'Generating...' : 'Generate Report' }}
                            </button>
                        </div>
                    </div>
                </div>
            </tab-content-panel>
        </div>

        <!-- Data Model Picker Modal -->
        <div
            v-if="templateState.showDataModelPicker"
            class="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4"
            @click.self="templateState.showDataModelPicker = false"
        >
            <div class="bg-white rounded-xl shadow-xl w-full max-w-lg p-6">
                <div class="flex justify-between items-center mb-4">
                    <h3 class="text-lg font-bold text-gray-900">Select a Data Model</h3>
                    <button
                        class="text-gray-400 hover:text-gray-600 transition-colors cursor-pointer"
                        @click="templateState.showDataModelPicker = false"
                    >
                        <font-awesome-icon :icon="['fas', 'xmark']" class="w-5 h-5" />
                    </button>
                </div>
                <div v-if="templateState.dataModelsLoading" class="flex justify-center py-8">
                    <font-awesome-icon :icon="['fas', 'spinner']" class="animate-spin text-2xl text-gray-400" />
                </div>
                <div v-else-if="templateState.dataModels.length === 0" class="text-center py-8">
                    <font-awesome-icon :icon="['fas', 'database']" class="text-4xl text-gray-300 mb-3" />
                    <p class="text-sm text-gray-500">No analyzed data models available. Analyze a data model first, then generate a report.</p>
                </div>
                <div v-else class="space-y-2 max-h-80 overflow-y-auto">
                    <div
                        v-for="model in templateState.dataModels"
                        :key="model.id"
                        class="flex items-center gap-3 p-3 border border-gray-200 rounded-lg hover:border-indigo-300 hover:bg-indigo-50 transition-colors cursor-pointer"
                        @click="handleDataModelSelect(model)"
                    >
                        <font-awesome-icon :icon="['fas', 'database']" class="text-gray-400" />
                        <div>
                            <p class="text-sm font-medium text-gray-900">{{ model.name }}</p>
                            <p class="text-xs text-gray-500">{{ model.model_type || model.data_layer || 'Unclassified' }}</p>
                        </div>
                    </div>
                </div>
            </div>
        </div>

        <!-- Create Report Modal -->
        <div
            v-if="state.showCreateModal"
            class="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4"
            @click.self="state.showCreateModal = false"
        >
            <div class="bg-white rounded-xl shadow-xl w-full max-w-md p-6">
                <div class="flex justify-between items-center mb-4">
                    <h3 class="text-lg font-bold text-gray-900">New Report</h3>
                    <button
                        class="text-gray-400 hover:text-gray-600 transition-colors cursor-pointer"
                        @click="state.showCreateModal = false"
                    >
                        <font-awesome-icon :icon="['fas', 'xmark']" class="w-5 h-5" />
                    </button>
                </div>
                <div class="flex flex-col gap-4">
                    <div>
                        <label class="block text-sm font-medium text-gray-700 mb-1">Report name <span class="text-red-500">*</span></label>
                        <input
                            v-model="state.newReportName"
                            type="text"
                            placeholder="e.g. Q1 2026 Campaign Summary"
                            class="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-blue-300 focus:border-transparent"
                            @keyup.enter="submitCreate"
                        />
                    </div>
                    <div>
                        <label class="block text-sm font-medium text-gray-700 mb-1">Description <span class="text-gray-400 text-xs font-normal">(optional)</span></label>
                        <textarea
                            v-model="state.newReportDescription"
                            placeholder="Brief description of this report's purpose..."
                            rows="3"
                            class="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-blue-300 focus:border-transparent resize-none"
                        />
                    </div>
                </div>
                <div class="flex justify-end gap-3 mt-6">
                    <button
                        class="px-4 py-2 text-sm text-gray-600 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors cursor-pointer"
                        @click="state.showCreateModal = false"
                    >
                        Cancel
                    </button>
                    <button
                        class="inline-flex items-center gap-2 px-4 py-2 bg-primary-blue-300 hover:bg-primary-blue-100 text-white text-sm font-medium rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                        :disabled="!state.newReportName.trim() || state.creating"
                        @click="submitCreate"
                    >
                        <font-awesome-icon
                            :icon="['fas', state.creating ? 'spinner' : 'arrow-right']"
                            :class="{ 'animate-spin': state.creating }"
                        />
                        {{ state.creating ? 'Creating...' : 'Create & open editor' }}
                    </button>
                </div>
            </div>
        </div>
    </div>
</template>
