<script setup lang="ts">
definePageMeta({ layout: 'project' })

import { useReports, type IReport } from '@/composables/useReports'
import { useProjectRole } from '@/composables/useProjectRole'
import { useReportBuilder, REPORT_ITEM_TYPES, type ReportItemTypeName } from '@/composables/useReportBuilder'
import { useDashboards } from '@/composables/useDashboards'

const route = useRoute()
const router = useRouter()
const { $swal } = useNuxtApp()
const reportsApi = useReports()
const { isAnalyst, isManager } = useProjectRole()

const projectId = computed(() => parseInt(String(route.params.projectid)))
const reportId = computed(() => parseInt(String(route.params.reportid)))

// Derived permissions: CMO is read-only
const canEdit = computed(() => isManager.value)   // analyst + manager
const canDelete = computed(() => isAnalyst.value)  // analyst only

// ─── Report data ────────────────────────────────────────────────────────────

const report = ref<IReport | null>(null)
const loading = ref(true)

// Draft fields
const draftName = ref('')
const draftDescription = ref('')

// Builder composable
const builder = useReportBuilder({
  projectId: projectId.value,
  reportId: reportId.value,
})

// Dashboard lookup for display
const { data: projectDashboards } = useDashboards(projectId)

function findDashboardName(id: number | string | null | undefined): string {
  if (!id) return ''
  const d = projectDashboards.value?.find((d: any) => d.id === Number(id))
  return d?.name || d?.title || `Dashboard #${id}`
}

// Helper: look up display metadata for a section's item type
function getTypeMeta(type: ReportItemTypeName) {
  return REPORT_ITEM_TYPES.find(t => t.type === type)
}

// Share modal
const showShareModal = ref(false)

// Save / publish state
const saving = ref(false)
const publishing = ref(false)
const deleting = ref(false)

// Guard for unmounted
let _mounted = false

async function loadReport() {
  loading.value = true
  const data = await reportsApi.getReport(reportId.value, projectId.value)
  if (!_mounted) return
  if (!data) {
    $swal.fire('Not found', 'This report could not be found.', 'error')
    router.push(`/projects/${projectId.value}/marketing/reports`)
    return
  }
  report.value = data
  draftName.value = data.name
  draftDescription.value = data.description ?? ''
  loading.value = false

  // Load builder sections from existing report items
  await builder.loadFromReport(reportId.value, projectId.value)
}

// ─── Save ───────────────────────────────────────────────────────────────────

async function save() {
  if (!report.value || !canEdit.value) return
  saving.value = true

  const [metaOk, itemsOk] = await Promise.all([
    reportsApi.updateReport(report.value.id, projectId.value, {
      name: draftName.value.trim() || report.value.name,
      description: draftDescription.value.trim() || null,
    }),
    builder.saveToReport(reportId.value, projectId.value),
  ])

  saving.value = false

  if (metaOk && itemsOk) {
    report.value = {
      ...report.value,
      name: draftName.value.trim() || report.value.name,
      description: draftDescription.value.trim() || null,
    }
    $swal.fire({ toast: true, position: 'top-end', icon: 'success', title: 'Saved', timer: 1800, showConfirmButton: false })
  } else {
    $swal.fire('Error', 'Could not save changes. Please try again.', 'error')
  }
}

async function publish() {
  if (!report.value || !canEdit.value) return
  await save()
  publishing.value = true
  const ok = await reportsApi.publishReport(report.value.id, projectId.value)
  publishing.value = false
  if (ok) {
    report.value = { ...report.value, status: 'published' }
    $swal.fire({ toast: true, position: 'top-end', icon: 'success', title: 'Published!', timer: 2000, showConfirmButton: false })
  } else {
    $swal.fire('Error', 'Could not publish. Please try again.', 'error')
  }
}

async function confirmDelete() {
  if (!report.value || !canDelete.value) return
  const { value: confirmed } = await $swal.fire({
    title: 'Delete report?',
    text: `"${report.value.name}" will be permanently deleted.`,
    icon: 'warning',
    showCancelButton: true,
    confirmButtonColor: '#d33',
    confirmButtonText: 'Yes, delete it!',
  })
  if (!confirmed) return
  deleting.value = true
  const ok = await reportsApi.deleteReport(report.value.id, projectId.value)
  deleting.value = false
  if (ok) {
    router.push(`/projects/${projectId.value}/marketing/reports`)
  } else {
    $swal.fire('Error', 'Could not delete the report.', 'error')
  }
}

function printReport() {
  if (import.meta.client) {
    window.print()
  }
}

function onShareUpdated(updated: IReport) {
  if (report.value) {
    report.value = { ...report.value, share_key: updated.share_key, share_expires_at: updated.share_expires_at }
  }
  showShareModal.value = false
}

// ─── Keyboard shortcut ──────────────────────────────────────────────────────

function handleKeydown(e: KeyboardEvent) {
  if ((e.metaKey || e.ctrlKey) && e.key === 's') {
    e.preventDefault()
    save()
  }
}

onMounted(() => {
  _mounted = true
  loadReport()
  document.addEventListener('keydown', handleKeydown)
})

onUnmounted(() => {
  _mounted = false
  document.removeEventListener('keydown', handleKeydown)
})
</script>

<template>
  <div class="flex flex-col gap-4 mt-4 pb-12">

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

      <!-- ── Drag & Drop Report Builder ──────────────────────────── -->
      <div class="flex gap-4 items-start">
        <!-- Left: Canvas (main builder area) -->
        <div class="flex-1 min-w-0">
          <div class="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
            <!-- Canvas header -->
            <div class="flex items-center justify-between px-5 py-3.5 border-b border-gray-100">
              <div>
                <h2 class="font-bold text-gray-900 text-base flex items-center gap-2">
                  <font-awesome-icon :icon="['fas', 'grip-vertical']" class="text-gray-400" />
                  Report Builder
                </h2>
                <p class="text-xs text-gray-500 mt-0.5">
                  {{ canEdit
                    ? 'Drag & drop sections to reorder. Click "Add Section" to add content blocks.'
                    : 'Report content layout (read-only).' }}
                </p>
              </div>
              <button
                v-if="canEdit"
                class="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium text-white bg-primary-blue-300 hover:bg-primary-blue-100 rounded-lg transition-colors cursor-pointer"
                @click="builder.showTypePicker.value = true"
              >
                <font-awesome-icon :icon="['fas', 'plus']" />
                Add Section
              </button>
            </div>

            <!-- Empty state -->
            <div
              v-if="builder.sections.value.length === 0 && !builder.isDragging.value"
              class="flex flex-col items-center justify-center py-16 text-center"
            >
              <div class="w-16 h-16 rounded-full bg-gray-100 flex items-center justify-center mb-4">
                <font-awesome-icon :icon="['fas', 'puzzle-piece']" class="text-2xl text-gray-300" />
              </div>
              <p class="text-sm font-medium text-gray-600 mb-1">No sections yet</p>
              <p class="text-xs text-gray-400 mb-4 max-w-xs">
                Build your report by adding content sections. Each section can display KPIs, AI insights, data tables, text, or dashboards.
              </p>
              <button
                v-if="canEdit"
                class="inline-flex items-center gap-1.5 px-4 py-2 text-sm font-medium text-primary-blue-300 border border-primary-blue-300 rounded-lg hover:bg-blue-50 transition-colors cursor-pointer"
                @click="builder.showTypePicker.value = true"
              >
                <font-awesome-icon :icon="['fas', 'plus']" />
                Add Your First Section
              </button>
            </div>

            <!-- Sections list with drag & drop -->
            <div
              v-else
              class="p-4 space-y-3 min-h-[200px]"
              @dragover="(e: DragEvent) => {
                e.preventDefault()
                e.dataTransfer!.dropEffect = 'move'
              }"
              @drop="(e: DragEvent) => {
                e.preventDefault()
                if (e.dataTransfer?.getData('section-key')) {
                  builder.handleCanvasDrop(e)
                }
              }"
            >
              <ReportSectionWrapper
                v-for="(section, index) in builder.sections.value"
                :key="section._key"
                :section-key="section._key"
                :index="index"
                :total-sections="builder.sections.value.length"
                :type-label="getTypeMeta(section.item_type)?.label ?? section.item_type"
                :type-icon="getTypeMeta(section.item_type)?.icon ?? 'puzzle-piece'"
                :selected="builder.selectedSectionKey.value === section._key"
                :is-dragging="builder.dragKey.value === section._key"
                :is-drag-over="builder.dropIndicator.value?.targetKey === section._key"
                :visible="section.visible"
                @select="builder.selectSection(section._key)"
                @remove="builder.deleteSection(section._key)"
                @duplicate="builder.duplicateSection(section._key)"
                @toggle-visibility="builder.toggleSectionVisibility(section._key)"
                @move-up="builder.moveSection(section._key, -1)"
                @move-down="builder.moveSection(section._key, 1)"
                @drag-start="(e: DragEvent) => builder.handleDragStart(section._key, e)"
                @drag-over="(e: DragEvent) => builder.handleDragOver(section._key, e)"
                @drag-leave="builder.handleDragLeave(section._key)"
                @drop="builder.handleDrop(section._key)"
                @drag-end="builder.handleDragEnd"
              >
                <!-- Section content preview -->

                <!-- Text Block -->
                <template v-if="section.item_type === 'text_block'">
                  <TextBlock
                    v-if="section.payload?.markdown_content"
                    :model-value="section.payload.markdown_content"
                    :editable="false"
                  />
                  <div v-else class="text-sm text-gray-400 italic">
                    Empty text block
                  </div>
                </template>

                <!-- AI Insights -->
                <template v-else-if="section.item_type === 'ai_insight'">
                  <AiInsightsSection
                    v-if="section.payload?.report_id || section.payload?.data_model_id"
                    :data-model-id="section.payload?.data_model_id"
                    :report-id="section.payload?.report_id"
                    :project-id="projectId"
                    :show-refresh="false"
                    :show-summary="true"
                  />
                  <div v-else class="flex items-center gap-2 text-sm text-gray-600">
                    <font-awesome-icon :icon="['fas', 'wand-magic-sparkles']" class="text-violet-500 w-4 h-4" />
                    <span class="text-gray-400 italic">No data model or report selected</span>
                  </div>
                </template>

                <!-- KPI Cards -->
                <template v-else-if="section.item_type === 'kpi_card'">
                  <KpiCardRow
                    v-if="section.payload?.data_model_id"
                    :data-model-id="section.payload.data_model_id"
                    :cards="section.payload?.cards"
                  />
                  <div v-else class="text-sm text-gray-400 italic">
                    No KPI cards configured
                  </div>
                </template>

                <!-- Data Table -->
                <template v-else-if="section.item_type === 'data_table'">
                  <ReportDataTable
                    :data-model-id="section.payload?.data_model_id ?? null"
                    :columns="section.payload?.columns ?? []"
                    :title="section.payload?.title ?? ''"
                  />
                </template>

                <!-- Dashboard Embed -->
                <template v-else-if="section.item_type === 'dashboard'">
                  <ReportDashboardSection
                    v-if="section.ref_id"
                    :dashboard-id="section.ref_id"
                  />
                  <div v-else class="text-sm text-gray-400 italic">
                    No dashboard selected
                  </div>
                </template>

                <!-- Fallback for unknown types -->
                <div v-else class="text-sm text-gray-400 italic">
                  Configure this section in the right panel
                </div>
              </ReportSectionWrapper>
            </div>
          </div>
        </div>

        <!-- Right: Config sidebar -->
        <div class="w-[320px] shrink-0" :class="{ 'hidden': !builder.selectedSection.value }">
          <div class="sticky top-4">
            <SectionConfigSidebar
              :section="builder.selectedSection.value"
              :project-id="projectId"
              @close="builder.selectedSectionKey.value = null"
              @update-payload="builder.updateSectionPayload"
              @update-ref-id="builder.updateSectionRefId"
            />
          </div>
        </div>
      </div>

    </template>

    <!-- Item type picker modal -->
    <ItemTypePicker
      v-if="builder.showTypePicker.value"
      :item-types="builder.itemTypes.value"
      @select="builder.handleTypeSelected"
      @close="builder.showTypePicker.value = false"
    />

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