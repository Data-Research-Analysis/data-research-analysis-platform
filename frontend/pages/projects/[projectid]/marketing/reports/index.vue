<script setup lang="ts">
definePageMeta({ layout: 'project' });

import { useProjectRole } from '@/composables/useProjectRole';
import { useReports, type IReport } from '@/composables/useReports';

const route = useRoute();
const router = useRouter();
const { $swal } = useNuxtApp();
const { isAnalyst, isManager } = useProjectRole();
const reports = useReports();

const projectId = computed(() => parseInt(String(route.params.projectid)));
const activeTab = ref<'my-reports' | 'templates'>('my-reports');

const state = reactive({
    loading: true,
    items: [] as IReport[],
    // Create modal
    showCreateModal: false,
    creating: false,
    newReportName: '',
    newReportDescription: '',
    // Delete
    deletingId: null as number | null,
});

async function loadReports() {
    state.loading = true;
    state.items = await reports.getReports(projectId.value);
    state.loading = false;
}

async function openCreate() {
    state.newReportName = '';
    state.newReportDescription = '';
    state.showCreateModal = true;
}

async function submitCreate() {
    if (!state.newReportName.trim()) return;
    state.creating = true;
    const report = await reports.createReport(
        projectId.value,
        state.newReportName.trim(),
        state.newReportDescription.trim() || undefined,
    );
    state.creating = false;
    if (report) {
        state.showCreateModal = false;
        router.push(`/projects/${projectId.value}/reports/${report.id}/edit`);
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

// Support ?tab=templates deep-link (e.g. from sidebar "Dashboard Templates" link)
onMounted(() => {
    if (route.query.tab === 'templates') {
        activeTab.value = 'templates';
    }
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
                                <!-- Status badge -->
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
                            <!-- Edit — analyst + manager -->
                            <NuxtLink
                                v-if="isManager"
                                :to="`/projects/${projectId}/reports/${report.id}/edit`"
                                class="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-gray-600 bg-white border border-gray-300 rounded-md hover:bg-gray-50 transition-colors cursor-pointer"
                            >
                                <font-awesome-icon :icon="['fas', 'pen']" />
                                Edit
                            </NuxtLink>
                            <!-- View — CMO (read-only) -->
                            <NuxtLink
                                v-else
                                :to="`/projects/${projectId}/reports/${report.id}/edit`"
                                class="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-gray-600 bg-white border border-gray-300 rounded-md hover:bg-gray-50 transition-colors cursor-pointer"
                            >
                                <font-awesome-icon :icon="['fas', 'eye']" />
                                View
                            </NuxtLink>
                            <!-- Delete — analyst only -->
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
            <DashboardTemplateGallery :project-id="projectId" />
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
                        class="inline-flex items-center gap-2 px-4 py-2 bg-primary-blue-300 hover:bg-primary-blue-100 text-white rounded-lg transition-colors text-sm font-medium cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                        :disabled="!state.newReportName.trim() || state.creating"
                        @click="submitCreate"
                    >
                        <font-awesome-icon
                            :icon="['fas', state.creating ? 'spinner' : 'arrow-right']"
                            :class="{ 'animate-spin': state.creating }"
                        />
                        {{ state.creating ? 'Creating…' : 'Create & open editor' }}
                    </button>
                </div>
            </div>
        </div>
    </div>
</template>
