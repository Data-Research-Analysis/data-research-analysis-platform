<script setup lang="ts">
/**
 * SectionConfigSidebar — Right-side panel for configuring a selected report section.
 *
 * Shows type-specific configuration fields based on the section's item_type.
 * Updates payload via the composable's updateSectionPayload / updateSectionRefId.
 */

import type { BuilderSection, ReportItemTypeName } from '~/composables/useReportBuilder'
import { useInsightsStore } from '@/stores/insights'
import { useDashboards } from '@/composables/useDashboards'

interface Props {
  /** The currently selected section */
  section: BuilderSection | null
  /** Project ID for fetching data models */
  projectId: number
}

const props = defineProps<Props>()

const emit = defineEmits<{
  (e: 'close'): void
  (e: 'update-payload', sectionKey: string, payload: Record<string, any>): void
  (e: 'update-ref-id', sectionKey: string, refId: string | number | null): void
}>()

// Using a type-safe cast helper for section ref_id
const refIdValue = computed({
  get: () => props.section?.ref_id ?? null,
  set: (val: string | number | null) => {
    if (props.section) {
      emit('update-ref-id', props.section._key, val)
    }
  },
})

// Fetch data models for selection dropdowns
const dataModels = ref<any[]>([])
const loadingModels = ref(true)

// Fetch saved AI insight reports
const insightsStore = useInsightsStore()
const savedInsightReports = ref<any[]>([])
const loadingReports = ref(false)

async function fetchSavedInsightReports() {
  loadingReports.value = true
  await insightsStore.loadReports(props.projectId)
  savedInsightReports.value = insightsStore.reports || []
  loadingReports.value = false
}

// Dashboard selector
const { data: projectDashboards, pending: loadingDashboards } = useDashboards(props.projectId)


async function fetchDataModels() {
  try {
    const token = getAuthToken()
    if (!token) {
      dataModels.value = []
      return
    }

    const config = useRuntimeConfig()
    const { getOrgHeaders } = useOrganizationContext()
    const orgHeaders = getOrgHeaders()

    const response = await useAppFetch<any[]>(
      `${config.public.apiBase}/data-model/list/${props.projectId}`,
      {
        headers: {
          Authorization: `Bearer ${token}`,
          'Authorization-Type': 'auth',
          ...orgHeaders,
        },
      },
    )
    dataModels.value = Array.isArray(response) ? response : []
  } catch {
    dataModels.value = []
  } finally {
    loadingModels.value = false
  }
}

onMounted(() => {
  fetchDataModels()
  fetchSavedInsightReports()
})

// Local draft payload for editing
const localPayload = ref<Record<string, any>>({})

// Sync local payload when section changes
watch(
  () => props.section,
  (section) => {
    if (section) {
      localPayload.value = JSON.parse(JSON.stringify(section.payload))
      if (localPayload.value._aiMode === undefined) {
        localPayload.value._aiMode = section.payload?.report_id ? 'saved' : 'live'
      }
    }
  },
  { immediate: true, deep: true },
)

// Debounced emit for payload updates
let _updateTimer: ReturnType<typeof setTimeout> | null = null
function emitPayloadUpdate() {
  if (!props.section) return
  if (_updateTimer) clearTimeout(_updateTimer)
  const key = props.section._key
  _updateTimer = setTimeout(() => {
    emit('update-payload', key, localPayload.value)
  }, 300)
}

// Watch local payload changes and emit
watch(localPayload, emitPayloadUpdate, { deep: true })

function switchAiMode(mode: 'live' | 'saved') {
  localPayload.value._aiMode = mode
  if (mode === 'live') {
    localPayload.value.report_id = null
  } else {
    localPayload.value.data_model_id = null
  }
}

// Fetch columns for the selected data model
const kpiColumns = ref<string[]>([])
const loadingColumns = ref(false)

watch(() => localPayload.value?.data_model_id, (modelId) => {
  kpiColumns.value = []
  if (!modelId) return

  // Try extracting columns from the data model's query metadata first
  const dm = dataModels.value.find((d: any) => d.id === modelId)
  if (dm?.query) {
    const query = typeof dm.query === 'string' ? JSON.parse(dm.query) : dm.query
    const cols: string[] = []
    if (query.select && Array.isArray(query.select)) {
      for (const sel of query.select) {
        if (sel.type === 'wildcard') { kpiColumns.value = []; break }
        const name = sel.alias || sel.value || sel.column
        if (name) cols.push(name)
      }
    } else if (query.columns && Array.isArray(query.columns)) {
      for (const col of query.columns) {
        const name = col.alias || col.column || col.value
        if (name) cols.push(name)
      }
    }
    if (cols.length > 0) {
      kpiColumns.value = cols
      return
    }
  }

  // Fallback: explore endpoint
  loadingColumns.value = true
  const token = getAuthToken()
  if (!token) { loadingColumns.value = false; return }
  const config = useRuntimeConfig()
  useAppFetch<any>(`${config.public.apiBase}/data-model/${modelId}/explore`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Authorization-Type': 'auth',
      'Content-Type': 'application/json',
    },
    body: { page: 0, pageSize: 1 },
  }).then((response: any) => {
    const data = response?.data || response
    kpiColumns.value = data?.columns || []
  }).catch(() => {
    kpiColumns.value = []
  }).finally(() => {
    loadingColumns.value = false
  })
})

function updateField(field: string, value: any) {
  localPayload.value[field] = value
}

// Type-specific field helpers
const aggregationOptions = [
  { value: 'sum', label: 'Sum' },
  { value: 'avg', label: 'Average' },
  { value: 'count', label: 'Count' },
  { value: 'min', label: 'Min' },
  { value: 'max', label: 'Max' },
]

const comparisonOptions = [
  { value: 'previous_7d', label: 'vs Previous 7 days' },
  { value: 'previous_30d', label: 'vs Previous 30 days' },
  { value: 'previous_90d', label: 'vs Previous 90 days' },
]

const insightCategoryOptions = [
  { value: 'trend', label: 'Trends' },
  { value: 'anomaly', label: 'Anomalies' },
  { value: 'correlation', label: 'Correlations' },
  { value: 'recommendation', label: 'Recommendations' },
]

function addKpiCard() {
  if (!localPayload.value.cards) localPayload.value.cards = []
  localPayload.value.cards.push({
    data_model_id: localPayload.value.data_model_id,
    column_name: '',
    aggregation: 'sum',
    label: '',
    format: 'number',
    comparison_period: 'previous_30d',
  })
}

function removeKpiCard(index: number) {
  localPayload.value.cards.splice(index, 1)
}

function addMetric() {
  if (!localPayload.value.metrics) localPayload.value.metrics = []
  localPayload.value.metrics.push({
    column_name: '',
    aggregation: 'sum',
    label: '',
    format: 'number',
  })
}

function removeMetric(index: number) {
  localPayload.value.metrics.splice(index, 1)
}
</script>

<template>
  <div
    v-if="section"
    class="w-full bg-white rounded-2xl border-2 border-primary-blue-300/30 shadow-lg overflow-hidden"
  >
    <!-- Header -->
    <div class="flex items-center justify-between px-5 py-3.5 border-b border-gray-100 bg-blue-50/30">
      <div>
        <h3 class="text-sm font-bold text-gray-900">Configure Section</h3>
        <p class="text-xs text-gray-500 mt-0.5 capitalize">{{ section.item_type.replace(/_/g, ' ') }}</p>
      </div>
      <button
        class="w-7 h-7 flex items-center justify-center rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-colors cursor-pointer"
        @click="emit('close')"
      >
        <font-awesome-icon :icon="['fas', 'times']" class="text-sm" />
      </button>
    </div>

    <!-- Body -->
    <div class="px-5 py-4 space-y-4 max-h-[300px] overflow-y-auto">

      <!-- ── KPI Cards config ──────────────────────────────────────── -->
      <template v-if="section.item_type === 'kpi_card'">
        <!-- Data model selector -->
        <div>
          <label class="block text-xs font-semibold text-gray-600 mb-1.5">Data Model</label>
          <select
            v-model="localPayload.data_model_id"
            class="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-primary-blue-300 bg-white"
          >
            <option :value="null" disabled>Select data model…</option>
            <option v-for="dm in dataModels" :key="dm.id" :value="dm.id">
              {{ dm.name }}
            </option>
          </select>
        </div>

        <!-- KPI cards list -->
        <div>
          <div class="flex items-center justify-between mb-2">
            <label class="text-xs font-semibold text-gray-600">KPI Cards</label>
            <button
              class="text-xs text-primary-blue-300 hover:text-primary-blue-100 font-medium cursor-pointer"
              @click="addKpiCard"
            >
              + Add Card
            </button>
          </div>
          <div
            v-for="(card, ci) in (localPayload.cards || [])"
            :key="ci"
            class="border border-gray-200 rounded-lg p-3 mb-2 space-y-2"
          >
            <div class="flex items-center justify-between">
              <span class="text-xs font-semibold text-gray-500">Card {{ Number(ci) + 1 }}</span>
              <button
                class="text-xs text-red-400 hover:text-red-600 cursor-pointer"
                @click="removeKpiCard(Number(ci))"
              >
                <font-awesome-icon :icon="['fas', 'trash']" />
              </button>
            </div>
            <select
              v-model="card.column_name"
              class="w-full border border-gray-200 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary-blue-300 bg-white"
            >
              <option value="" disabled>Select column…</option>
              <option v-for="col in kpiColumns" :key="col" :value="col">
                {{ col }}
              </option>
            </select>
            <div class="grid grid-cols-2 gap-2">
              <select
                v-model="card.aggregation"
                class="border border-gray-200 rounded-lg px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary-blue-300"
              >
                <option v-for="opt in aggregationOptions" :key="opt.value" :value="opt.value">
                  {{ opt.label }}
                </option>
              </select>
              <input
                v-model="card.label"
                placeholder="Display label"
                class="border border-gray-200 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary-blue-300"
              />
            </div>
            <select
              v-model="card.comparison_period"
              class="w-full border border-gray-200 rounded-lg px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary-blue-300"
            >
              <option v-for="opt in comparisonOptions" :key="opt.value" :value="opt.value">
                {{ opt.label }}
              </option>
            </select>
          </div>
          <p v-if="!localPayload.cards?.length" class="text-xs text-gray-400 italic text-center py-3">
            No KPI cards configured. Click "Add Card" to start.
          </p>
        </div>
      </template>

      <!-- ── AI Insights config ────────────────────────────────────── -->
      <template v-else-if="section.item_type === 'ai_insight'">
        <!-- Source type toggle -->
        <div class="flex gap-2 mb-4">
          <button
            class="flex-1 px-3 py-1.5 text-xs font-medium rounded-lg transition-colors cursor-pointer"
            :class="localPayload._aiMode === 'saved' ? 'bg-gray-100 text-gray-600 hover:bg-gray-200' : 'bg-primary-blue-300 text-white'"
            @click="switchAiMode('live')"
          >
            Live Analysis
          </button>
          <button
            class="flex-1 px-3 py-1.5 text-xs font-medium rounded-lg transition-colors cursor-pointer"
            :class="localPayload._aiMode === 'saved' ? 'bg-primary-blue-300 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'"
            @click="switchAiMode('saved')"
          >
            Saved Report
          </button>
        </div>

        <!-- Saved Report mode -->
        <div v-if="localPayload._aiMode === 'saved'">
          <div>
            <label class="block text-xs font-semibold text-gray-600 mb-1.5">Saved AI Insight Report</label>
            <select
              v-model="localPayload.report_id"
              class="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-primary-blue-300 bg-white"
            >
              <option :value="null" disabled>Select a saved report…</option>
              <option v-for="rpt in savedInsightReports" :key="rpt.id" :value="rpt.id">
                {{ rpt.title }}
              </option>
            </select>
            <p v-if="savedInsightReports.length === 0 && !loadingReports" class="text-xs text-gray-400 mt-1">
              No saved AI insight reports available. Create one from AI Insights first.
            </p>
          </div>
        </div>

        <!-- Live Analysis mode -->
        <div v-else>
          <div>
            <label class="block text-xs font-semibold text-gray-600 mb-1.5">Data Model</label>
            <select
              v-model="localPayload.data_model_id"
              class="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-primary-blue-300 bg-white"
            >
              <option :value="null" disabled>Select data model…</option>
              <option v-for="dm in dataModels" :key="dm.id" :value="dm.id">
                {{ dm.name }}
              </option>
            </select>
          </div>
          <div>
            <label class="block text-xs font-semibold text-gray-600 mb-1.5">Insight Categories</label>
            <div class="space-y-1.5">
              <label
                v-for="cat in insightCategoryOptions"
                :key="cat.value"
                class="flex items-center gap-2 cursor-pointer"
              >
                <input
                  type="checkbox"
                  :value="cat.value"
                  :checked="(localPayload.insight_categories || []).includes(cat.value)"
                  class="w-4 h-4 rounded accent-primary-blue-300"
                  @change="
                    (e: Event) => {
                      const checked = (e.target as HTMLInputElement).checked
                      const cats = localPayload.insight_categories || []
                      if (checked) cats.push(cat.value)
                      else cats.splice(cats.indexOf(cat.value), 1)
                      localPayload.insight_categories = [...cats]
                    }
                  "
                />
                <span class="text-sm text-gray-700">{{ cat.label }}</span>
              </label>
            </div>
          </div>
        </div>
      </template>

      <!-- ── Comparison Table config ───────────────────────────────── -->
      <!-- ── Text Block config ─────────────────────────────────────── -->
      <template v-else-if="section.item_type === 'text_block'">
        <div>
          <label class="block text-xs font-semibold text-gray-600 mb-1.5">Content (Markdown)</label>
          <textarea
            v-model="localPayload.markdown_content"
            placeholder="Write your report text here. Supports **bold**, *italic*, and [links](url)…"
            rows="8"
            class="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-primary-blue-300 resize-vertical font-mono"
          />
          <p class="text-xs text-gray-400 mt-1">Supports Markdown formatting</p>
        </div>
      </template>

      <!-- ── Dashboard config ──────────────────────────────────────── -->
      <template v-else-if="section.item_type === 'dashboard'">
        <div>
          <label class="block text-xs font-semibold text-gray-600 mb-1.5">Dashboard</label>
          <select
            v-model="refIdValue"
            class="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-primary-blue-300 bg-white"
          >
            <option :value="null" disabled>Select dashboard…</option>
            <option v-for="d in projectDashboards" :key="d.id" :value="d.id">
              {{ d.name || d.title || `Dashboard #${d.id}` }}
            </option>
          </select>
          <p v-if="loadingDashboards" class="text-xs text-gray-400 mt-1">Loading dashboards…</p>
        </div>
      </template>

      <!-- ── Data Table config ─────────────────────────────────────── -->
      <template v-else-if="section.item_type === 'data_table'">
        <div>
          <label class="block text-xs font-semibold text-gray-600 mb-1.5">Data Model</label>
          <select
            v-model="localPayload.data_model_id"
            class="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-primary-blue-300 bg-white"
          >
            <option :value="null" disabled>Select data model…</option>
            <option v-for="dm in dataModels" :key="dm.id" :value="dm.id">
              {{ dm.name }}
            </option>
          </select>
        </div>
        <div>
          <label class="block text-xs font-semibold text-gray-600 mb-1.5">Columns</label>
          <menu-dropdown direction="left" offset-y="10">
            <template #menuItem="{ onClick }">
              <div
                class="flex items-center justify-between w-full border border-gray-200 rounded-lg px-3 py-2 text-sm text-gray-700 cursor-pointer bg-white"
                @click="onClick"
              >
                <span v-if="(localPayload.columns || []).length === 0" class="text-gray-400">Select columns…</span>
                <div v-else class="flex flex-wrap gap-1">
                  <span
                    v-for="col in localPayload.columns"
                    :key="col"
                    class="inline-flex items-center gap-1 bg-primary-blue-50 text-primary-blue-700 text-xs font-medium px-2 py-0.5 rounded-full"
                  >
                    {{ col }}
                    <button
                      type="button"
                      class="hover:text-primary-blue-900 leading-none"
                      @click.stop="localPayload.columns = (localPayload.columns || []).filter((c: string) => c !== col)"
                    >&times;</button>
                  </span>
                </div>
                <svg class="w-4 h-4 shrink-0 text-gray-400 ml-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7" />
                </svg>
              </div>
            </template>
            <template #dropdownMenu="{ onClick: closeDropdown }">
              <div class="p-2 w-64 max-h-60 overflow-y-auto">
                <div v-if="loadingColumns" class="text-xs text-gray-400 text-center py-2">Loading columns…</div>
                <div v-else-if="kpiColumns.length === 0" class="text-xs text-gray-400 text-center py-2">
                  Select a data model first
                </div>
                <label
                  v-for="col in kpiColumns"
                  :key="col"
                  class="flex items-center gap-2 px-2 py-1.5 rounded hover:bg-gray-50 cursor-pointer text-sm"
                >
                  <input
                    type="checkbox"
                    :checked="(localPayload.columns || []).includes(col)"
                    class="rounded border-gray-300 text-primary-blue-600 focus:ring-primary-blue-300"
                    @change="(e: Event) => {
                      const checked = (e.target as HTMLInputElement).checked
                      const current = localPayload.columns || []
                      if (checked) {
                        localPayload.columns = [...current, col]
                      } else {
                        localPayload.columns = current.filter((c: string) => c !== col)
                      }
                    }"
                  />
                  <span>{{ col }}</span>
                </label>
                <div v-if="(localPayload.columns || []).length > 0" class="border-t border-gray-100 pt-1 mt-1">
                  <button
                    type="button"
                    class="w-full text-xs text-red-500 hover:text-red-700 text-center py-1"
                    @click="localPayload.columns = []; (closeDropdown as Function)()"
                  >
                    Clear all
                  </button>
                </div>
              </div>
            </template>
          </menu-dropdown>
        </div>
      </template>

      <!-- ── Fallback for unknown types ────────────────────────────── -->
      <template v-else>
        <p class="text-sm text-gray-500 italic">
          Configuration for "{{ section.item_type }}" is not yet available.
        </p>
      </template>
    </div>
  </div>
</template>