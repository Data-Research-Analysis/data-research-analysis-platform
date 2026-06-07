<script setup lang="ts">
/**
 * SectionConfigSidebar — Right-side panel for configuring a selected report section.
 *
 * Shows type-specific configuration fields based on the section's item_type.
 * Updates payload via the composable's updateSectionPayload / updateSectionRefId.
 */

import type { BuilderSection, ReportItemTypeName } from '~/composables/useReportBuilder'

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

onMounted(fetchDataModels)

// Local draft payload for editing
const localPayload = ref<Record<string, any>>({})

// Sync local payload when section changes
watch(
  () => props.section,
  (section) => {
    if (section) {
      localPayload.value = JSON.parse(JSON.stringify(section.payload))
    }
  },
  { immediate: true, deep: true },
)

// Debounced emit for payload updates
let _updateTimer: ReturnType<typeof setTimeout> | null = null
function emitPayloadUpdate() {
  if (!props.section) return
  if (_updateTimer) clearTimeout(_updateTimer)
  _updateTimer = setTimeout(() => {
    emit('update-payload', props.section!._key, localPayload.value)
  }, 300)
}

// Watch local payload changes and emit
watch(localPayload, emitPayloadUpdate, { deep: true })

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
    <div class="px-5 py-4 space-y-4 max-h-[calc(100vh-300px)] overflow-y-auto">

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
            <input
              v-model="card.column_name"
              placeholder="Column name"
              class="w-full border border-gray-200 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary-blue-300"
            />
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
      </template>

      <!-- ── Comparison Table config ───────────────────────────────── -->
      <template v-else-if="section.item_type === 'comparison_table'">
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
          <label class="block text-xs font-semibold text-gray-600 mb-1.5">Dimension Column</label>
          <input
            v-model="localPayload.dimension_column"
            placeholder="e.g. channel, campaign_name"
            class="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-blue-300"
          />
        </div>
        <div>
          <div class="flex items-center justify-between mb-2">
            <label class="text-xs font-semibold text-gray-600">Metrics</label>
            <button
              class="text-xs text-primary-blue-300 hover:text-primary-blue-100 font-medium cursor-pointer"
              @click="addMetric"
            >
              + Add Metric
            </button>
          </div>
          <div
            v-for="(metric, mi) in (localPayload.metrics || [])"
            :key="mi"
            class="border border-gray-200 rounded-lg p-3 mb-2 space-y-2"
          >
            <div class="flex items-center justify-between">
              <span class="text-xs font-semibold text-gray-500">Metric {{ Number(mi) + 1 }}</span>
              <button
                class="text-xs text-red-400 hover:text-red-600 cursor-pointer"
                @click="removeMetric(Number(mi))"
              >
                <font-awesome-icon :icon="['fas', 'trash']" />
              </button>
            </div>
            <input
              v-model="metric.column_name"
              placeholder="Column name"
              class="w-full border border-gray-200 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary-blue-300"
            />
            <div class="grid grid-cols-2 gap-2">
              <select
                v-model="metric.aggregation"
                class="border border-gray-200 rounded-lg px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary-blue-300"
              >
                <option v-for="opt in aggregationOptions" :key="opt.value" :value="opt.value">
                  {{ opt.label }}
                </option>
              </select>
              <input
                v-model="metric.label"
                placeholder="Display label"
                class="border border-gray-200 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary-blue-300"
              />
            </div>
          </div>
          <p v-if="!localPayload.metrics?.length" class="text-xs text-gray-400 italic text-center py-3">
            No metrics configured. Click "Add Metric" to start.
          </p>
        </div>
      </template>

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
          <label class="block text-xs font-semibold text-gray-600 mb-1.5">Dashboard ID</label>
          <input
            v-model="refIdValue"
            type="number"
            placeholder="Dashboard ID"
            class="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-blue-300"
          />
          <p class="text-xs text-gray-400 mt-1">
            Enter the ID of an existing dashboard in this project
          </p>
        </div>
      </template>

      <!-- ── Chart config ──────────────────────────────────────────── -->
      <template v-else-if="section.item_type === 'chart'">
        <div>
          <label class="block text-xs font-semibold text-gray-600 mb-1.5">Dashboard ID</label>
          <input
            v-model.number="localPayload.dashboard_id"
            type="number"
            placeholder="Source dashboard ID"
            class="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-blue-300"
          />
        </div>
        <div>
          <label class="block text-xs font-semibold text-gray-600 mb-1.5">Chart ID</label>
          <input
            v-model.number="localPayload.chart_id"
            type="number"
            placeholder="Chart ID within the dashboard"
            class="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-blue-300"
          />
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
          <label class="block text-xs font-semibold text-gray-600 mb-1.5">Columns (comma-separated)</label>
          <input
            :value="(localPayload.columns || []).join(', ')"
            placeholder="e.g. campaign_name, spend, impressions"
            class="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-blue-300"
            @input="(e: Event) => {
              const val = (e.target as HTMLInputElement).value
              localPayload.columns = val.split(',').map(s => s.trim()).filter(Boolean)
            }"
          />
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