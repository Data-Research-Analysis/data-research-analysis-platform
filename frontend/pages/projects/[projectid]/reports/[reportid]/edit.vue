<script setup lang="ts">
definePageMeta({ layout: 'project' });

import { useReports, type IReport, type IReportItem } from '@/composables/useReports';
import { useProjectRole } from '@/composables/useProjectRole';
import { useDashboards } from '@/composables/useDashboards';

const route = useRoute();
const router = useRouter();
const { $swal } = useNuxtApp();
const reportsApi = useReports();
const { isAnalyst, isManager } = useProjectRole();

const projectId = computed(() => parseInt(String(route.params.projectid)));
const reportId = computed(() => parseInt(String(route.params.reportid)));

// Derived permissions: CMO is read-only
const canEdit = computed(() => isManager.value);   // analyst + manager
const canDelete = computed(() => isAnalyst.value); // analyst only

// ─── Data ─────────────────────────────────────────────────────────────────

const report = ref<IReport | null>(null);
const loading = ref(true);

// Draft fields (mirrored from report for editing)
const draftName = ref('');
const draftDescription = ref('');
const selectedDashboardIds = ref<Set<number>>(new Set());

// Project dashboards for selection
const { data: dashboards } = useDashboards(projectId.value);

// Share modal
const showShareModal = ref(false);

// Save / publish state
const saving = ref(false);
const publishing = ref(false);
const deleting = ref(false);

// Guard: prevent in-flight async results from updating state after navigation away
let _mounted = false;

async function loadReport() {
    loading.value = true;
    const data = await reportsApi.getReport(reportId.value, projectId.value);
    if (!_mounted) return;  // component already unmounted — discard result
    if (!data) {
        $swal.fire('Not found', 'This report could not be found.', 'error');
        router.push(`/projects/${projectId.value}/marketing/reports`);
        return;
    }
    report.value = data;
    draftName.value = data.name;
    draftDescription.value = data.description ?? '';
    // Hydrate selected dashboard set from items
    selectedDashboardIds.value = new Set(
        (data.items ?? [])
            .filter(i => i.item_type === 'dashboard' && i.ref_id != null)
            .map(i => i.ref_id as number),
    );
    loading.value = false;
}

function toggleDashboard(id: number) {
    if (!canEdit.value) return;
    // Reassign to a new Set so Vue detects the change (in-place mutation is invisible to reactivity)
    const next = new Set(selectedDashboardIds.value);
    if (next.has(id)) {
        next.delete(id);
    } else {
        next.add(id);
    }
    selectedDashboardIds.value = next;
}

async function save() {
    if (!report.value || !canEdit.value) return;
    saving.value = true;

    const itemsPayload: IReportItem[] = [...selectedDashboardIds.value].map((id, idx) => ({
        item_type: 'dashboard',
        ref_id: id,
        display_order: idx,
    }));

    const [metaOk, itemsOk] = await Promise.all([
        reportsApi.updateReport(report.value.id, projectId.value, {
            name: draftName.value.trim() || report.value.name,
            description: draftDescription.value.trim() || null,
        }),
        reportsApi.updateItems(report.value.id, projectId.value, itemsPayload),
    ]);

    saving.value = false;

    if (metaOk && itemsOk) {
        report.value = {
            ...report.value,
            name: draftName.value.trim() || report.value.name,
            description: draftDescription.value.trim() || null,
        };
        $swal.fire({ toast: true, position: 'top-end', icon: 'success', title: 'Saved', timer: 1800, showConfirmButton: false });
    } else {
        $swal.fire('Error', 'Could not save changes. Please try again.', 'error');
    }
}

async function publish() {
    if (!report.value || !canEdit.value) return;
    // Auto-save first
    await save();
    publishing.value = true;
    const ok = await reportsApi.publishReport(report.value.id, projectId.value);
    publishing.value = false;
    if (ok) {
        report.value = { ...report.value, status: 'published' };
        $swal.fire({ toast: true, position: 'top-end', icon: 'success', title: 'Published!', timer: 2000, showConfirmButton: false });
    } else {
        $swal.fire('Error', 'Could not publish. Please try again.', 'error');
    }
}

async function confirmDelete() {
    if (!report.value || !canDelete.value) return;
    const { value: confirmed } = await $swal.fire({
        title: 'Delete report?',
        text: `"${report.value.name}" will be permanently deleted.`,
        icon: 'warning',
        showCancelButton: true,
        confirmButtonColor: '#d33',
        confirmButtonText: 'Yes, delete it!',
    });
    if (!confirmed) return;
    deleting.value = true;
    const ok = await reportsApi.deleteReport(report.value.id, projectId.value);
    deleting.value = false;
    if (ok) {
        router.push(`/projects/${projectId.value}/marketing/reports`);
    } else {
        $swal.fire('Error', 'Could not delete the report.', 'error');
    }
}

function printReport() {
    if (import.meta.client) {
        window.print();
    }
}

function onShareUpdated(updated: IReport) {
    if (report.value) {
        report.value = { ...report.value, share_key: updated.share_key, share_expires_at: updated.share_expires_at };
    }
    showShareModal.value = false;
}

onMounted(() => {
    _mounted = true;
    loadReport();
});

onUnmounted(() => {
    _mounted = false;
});
</script>

<template>
    <div class="flex flex-col gap-4 mt-4">

        <!-- Loading -->
        <div v-if="loading" class="flex justify-center items-center py-24">
            <font-awesome-icon :icon="['fas', 'spinner']" class="animate-spin text-4xl text-gray-400" />
        </div>

        <template v-else-if="report">

            <!-- ── Header card ─────────────────────────────────────────── -->
            <tab-content-panel :corners="['top-left', 'top-right', 'bottom-left', 'bottom-right']">
                <!-- Back link -->
                <NuxtLink
                    :to="`/projects/${projectId}/marketing/reports`"
                    class="inline-flex items-center gap-1.5 text-sm text-gray-400 hover:text-gray-600 mb-4 transition-colors cursor-pointer"
                >
                    <font-awesome-icon :icon="['fas', 'arrow-left']" />
                    Back to Reports
                </NuxtLink>

                <!-- Title row -->
                <div class="flex items-start justify-between gap-4">
                    <!-- Left: name + status -->
                    <div class="flex-1 min-w-0">
                        <input
                            v-if="canEdit"
                            v-model="draftName"
                            type="text"
                            placeholder="Report name"
                            class="w-full text-2xl font-bold text-gray-900 border-0 border-b-2 border-transparent hover:border-gray-200 focus:border-primary-blue-300 focus:outline-none bg-transparent transition-colors px-0 py-0.5 mb-2"
                        />
                        <h1 v-else class="text-2xl font-bold text-gray-900 mb-2">{{ report.name }}</h1>
                        <span
                            class="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold"
                            :class="report.status === 'published'
                                ? 'bg-green-100 text-green-700'
                                : 'bg-amber-100 text-amber-700'"
                        >
                            <font-awesome-icon :icon="['fas', report.status === 'published' ? 'circle-check' : 'pencil']" />
                            {{ report.status === 'published' ? 'Published' : 'Draft' }}
                        </span>
                    </div>

                    <!-- Right: actions -->
                    <div class="flex items-center gap-2 shrink-0 flex-wrap justify-end">
                        <button
                            class="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium text-gray-600 bg-white border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors cursor-pointer"
                            @click="printReport"
                        >
                            <font-awesome-icon :icon="['fas', 'print']" />
                            Print / PDF
                        </button>
                        <button
                            v-if="canEdit"
                            class="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium text-gray-600 bg-white border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors cursor-pointer"
                            :class="report.share_key ? 'border-green-300 text-green-700' : ''"
                            @click="showShareModal = true"
                        >
                            <font-awesome-icon :icon="['fas', report.share_key ? 'circle-check' : 'share-nodes']" />
                            {{ report.share_key ? 'Shared' : 'Share' }}
                        </button>
                        <button
                            v-if="canEdit"
                            class="inline-flex items-center gap-1.5 px-4 py-1.5 text-sm font-medium text-white bg-gray-700 hover:bg-gray-800 rounded-lg transition-colors cursor-pointer disabled:opacity-50"
                            :disabled="saving || publishing"
                            @click="save"
                        >
                            <font-awesome-icon
                                :icon="['fas', saving ? 'spinner' : 'floppy-disk']"
                                :class="{ 'animate-spin': saving }"
                            />
                            {{ saving ? 'Saving…' : 'Save' }}
                        </button>
                        <button
                            v-if="canEdit && report.status !== 'published'"
                            class="inline-flex items-center gap-1.5 px-4 py-1.5 text-sm font-medium text-white bg-primary-blue-300 hover:bg-primary-blue-100 rounded-lg transition-colors cursor-pointer disabled:opacity-50"
                            :disabled="saving || publishing"
                            @click="publish"
                        >
                            <font-awesome-icon
                                :icon="['fas', publishing ? 'spinner' : 'circle-check']"
                                :class="{ 'animate-spin': publishing }"
                            />
                            {{ publishing ? 'Publishing…' : 'Publish' }}
                        </button>
                        <button
                            v-if="canDelete"
                            class="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium text-red-500 bg-white border border-red-200 rounded-lg hover:bg-red-50 transition-colors cursor-pointer disabled:opacity-50"
                            :disabled="deleting"
                            @click="confirmDelete"
                        >
                            <font-awesome-icon
                                :icon="['fas', deleting ? 'spinner' : 'trash']"
                                :class="{ 'animate-spin': deleting }"
                            />
                            Delete
                        </button>
                    </div>
                </div>

                <!-- Description -->
                <div class="mt-5 pt-5 border-t border-gray-100">
                    <label class="block text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">Description</label>
                    <textarea
                        v-if="canEdit"
                        v-model="draftDescription"
                        placeholder="Add a brief description of this report (optional)…"
                        rows="2"
                        class="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-primary-blue-300 focus:border-transparent resize-none bg-gray-50 hover:bg-white transition-colors"
                    />
                    <p v-else-if="report.description" class="text-sm text-gray-600">{{ report.description }}</p>
                    <p v-else class="text-sm text-gray-400 italic">No description provided.</p>
                </div>

                <!-- Shared link notice (CMO only) -->
                <div
                    v-if="!canEdit && report.share_key"
                    class="mt-4 flex items-center gap-2 px-3 py-2 bg-blue-50 border border-blue-200 rounded-lg"
                >
                    <font-awesome-icon :icon="['fas', 'link']" class="text-blue-400 text-xs shrink-0" />
                    <p class="text-xs text-blue-700">
                        This report has an active public share link{{
                            report.share_expires_at
                                ? ` (expires ${new Date(report.share_expires_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })})`
                                : ''
                        }}.
                    </p>
                </div>
            </tab-content-panel>

            <!-- ── Dashboard selection card ────────────────────────────── -->
            <tab-content-panel :corners="['top-right', 'bottom-left', 'bottom-right']">
                <!-- Section header -->
                <div class="flex items-center justify-between mb-4">
                    <div>
                        <h2 class="font-bold text-gray-900 text-base flex items-center gap-2">
                            <font-awesome-icon :icon="['fas', 'layer-group']" class="text-gray-400" />
                            Report Content
                        </h2>
                        <p class="text-xs text-gray-500 mt-0.5">
                            {{ canEdit ? 'Select the dashboards to include in this report.' : 'Dashboards included in this report.' }}
                        </p>
                    </div>
                    <button
                        v-if="canEdit && selectedDashboardIds.size > 0"
                        class="text-xs text-gray-400 hover:text-gray-600 transition-colors cursor-pointer"
                        @click="selectedDashboardIds = new Set()"
                    >
                        Clear all
                    </button>
                </div>

                <!-- No dashboards in project -->
                <div v-if="dashboards.length === 0" class="flex flex-col items-center justify-center py-12 text-center">
                    <div class="w-14 h-14 rounded-full bg-gray-100 flex items-center justify-center mb-3">
                        <font-awesome-icon :icon="['fas', 'table-columns']" class="text-2xl text-gray-300" />
                    </div>
                    <p class="text-sm font-medium text-gray-500 mb-1">No dashboards yet</p>
                    <p class="text-xs text-gray-400">
                        {{ canEdit
                            ? 'Create dashboards in this project to add them to reports.'
                            : 'No dashboards are available in this project.' }}
                    </p>
                    <NuxtLink
                        v-if="canEdit"
                        :to="`/projects/${projectId}/dashboards`"
                        class="mt-4 inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-primary-blue-300 border border-primary-blue-300 rounded-lg hover:bg-blue-50 transition-colors cursor-pointer"
                    >
                        <font-awesome-icon :icon="['fas', 'plus']" />
                        Go to Dashboards
                    </NuxtLink>
                </div>

                <!-- Dashboard checklist -->
                <div v-else class="flex flex-col gap-2">
                    <label
                        v-for="dashboard in dashboards"
                        :key="dashboard.id"
                        class="flex items-center gap-3 p-3 rounded-lg border transition-all"
                        :class="[
                            canEdit ? 'cursor-pointer' : 'cursor-default',
                            selectedDashboardIds.has(dashboard.id)
                                ? 'border-primary-blue-300 bg-blue-50'
                                : 'border-gray-200 bg-white hover:border-gray-300 hover:bg-gray-50'
                        ]"
                    >
                        <input
                            v-if="canEdit"
                            type="checkbox"
                            :checked="selectedDashboardIds.has(dashboard.id)"
                            class="w-4 h-4 rounded accent-primary-blue-300 shrink-0"
                            @change="toggleDashboard(dashboard.id)"
                        />
                        <font-awesome-icon
                            v-else
                            :icon="['fas', selectedDashboardIds.has(dashboard.id) ? 'square-check' : 'square']"
                            class="shrink-0"
                            :class="selectedDashboardIds.has(dashboard.id) ? 'text-primary-blue-300' : 'text-gray-300'"
                        />
                        <div class="w-8 h-8 rounded-lg bg-gray-100 flex items-center justify-center shrink-0">
                            <font-awesome-icon :icon="['fas', 'table-columns']" class="text-gray-400 text-sm" />
                        </div>
                        <p class="flex-1 min-w-0 text-sm font-medium text-gray-800 truncate">
                            {{ (dashboard as any).name || `Dashboard #${dashboard.id}` }}
                        </p>
                        <span
                            v-if="selectedDashboardIds.has(dashboard.id)"
                            class="shrink-0 inline-flex items-center gap-1 text-xs font-semibold text-primary-blue-300"
                        >
                            <font-awesome-icon :icon="['fas', 'check']" class="text-xs" />
                            Included
                        </span>
                    </label>
                </div>

                <!-- Footer count -->
                <div v-if="dashboards.length > 0" class="mt-4 pt-3 border-t border-gray-100">
                    <p class="text-xs text-gray-400">
                        <span class="font-semibold text-gray-600">{{ selectedDashboardIds.size }}</span>
                        of {{ dashboards.length }} dashboard{{ dashboards.length === 1 ? '' : 's' }} selected
                    </p>
                </div>
            </tab-content-panel>

        </template>

        <!-- Share modal -->
        <ReportShareModal
            v-if="showShareModal && report"
            :report="report"
            :project-id="projectId"
            @close="showShareModal = false"
            @updated="onShareUpdated"
        />
    </div>
</template>
