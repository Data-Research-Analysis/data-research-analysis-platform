<script setup lang="ts">
import { ref, computed, watch } from 'vue'
import { useReportComparisonTable, type ComparisonTableConfig } from '~/composables/useReportComparisonTable'

/**
 * ComparisonTable — Report Item Component (RPT-004)
 *
 * Auto-generated comparison table that takes a data model, dimension column,
 * and metrics to render a sortable, color-coded comparison table.
 *
 * - Groups data by dimension column (e.g., "channel", "campaign")
 * - Metrics become sortable column headers
 * - Best performer highlighted green, worst highlighted red
 * - Numeric formatting: currency ($), percentages (%), comma separators
 */

interface Props {
  /** Data model ID to fetch data from */
  dataModelId: number
  /** Column to use as row dimension (e.g., "channel", "campaign_name") */
  dimensionColumn: string
  /** Metric columns to display (e.g., ["spend", "conversions", "ctr"]) */
  metrics: string[]
  /** Optional aggregation override for all metrics */
  aggregation?: 'sum' | 'avg' | 'count' | 'min' | 'max'
  /** Maximum rows to display */
  limit?: number
  /** Table title */
  title?: string
  /** Show totals row */
  showTotals?: boolean
}

const props = withDefaults(defineProps<Props>(), {
  aggregation: undefined,
  limit: 50,
  title: '',
  showTotals: true,
})

// ── Data Fetching ──────────────────────────────────────
const {
  loading,
  error,
  tableData,
  refetch,
} = useReportComparisonTable({
  dataModelId: props.dataModelId,
  dimensionColumn: props.dimensionColumn,
  metrics: props.metrics,
  aggregation: props.aggregation,
  limit: props.limit,
})

// Re-fetch if props change
watch(() => [props.dataModelId, props.dimensionColumn, props.metrics], () => {
  refetch()
}, { deep: true })

// ── Sorting ────────────────────────────────────────────
const sortColumn = ref<string | null>(null)
const sortDirection = ref<'ASC' | 'DESC'>('DESC')

function toggleSort(column: string) {
  if (sortColumn.value === column) {
    sortDirection.value = sortDirection.value === 'DESC' ? 'ASC' : 'DESC'
  } else {
    sortColumn.value = column
    sortDirection.value = 'DESC'
  }
}

const sortedRows = computed(() => {
  if (!tableData.value) return []
  const rows = [...tableData.value.rows]

  if (sortColumn.value) {
    rows.sort((a, b) => {
      const aVal = a.rawMetrics[sortColumn.value!] ?? 0
      const bVal = b.rawMetrics[sortColumn.value!] ?? 0
      return sortDirection.value === 'ASC' ? aVal - bVal : bVal - aVal
    })
  }

  return rows
})

// ── Formatting ─────────────────────────────────────────
/** Known metric formatting patterns */
const METRIC_FORMATS: Record<string, 'currency' | 'percent' | 'number' | 'decimal'> = {
  spend: 'currency',
  cost: 'currency',
  revenue: 'currency',
  conversion_value: 'currency',
  cpc: 'currency',
  cpa: 'currency',
  cpm: 'currency',
  ctr: 'percent',
  conversion_rate: 'percent',
  click_through_rate: 'percent',
  impressions: 'number',
  clicks: 'number',
  conversions: 'number',
  roas: 'decimal',
}

function getFormat(metric: string): 'currency' | 'percent' | 'number' | 'decimal' {
  return METRIC_FORMATS[metric.toLowerCase()] || 'number'
}

function formatValue(value: number, metric: string): string {
  const format = getFormat(metric)

  switch (format) {
    case 'currency':
      return `$${value.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
    case 'percent':
      return `${value.toFixed(2)}%`
    case 'decimal':
      return `${value.toFixed(2)}x`
    case 'number':
    default:
      return value.toLocaleString('en-US', { maximumFractionDigits: 0 })
  }
}

// ── Highlight Logic ────────────────────────────────────
/** Returns true if a dimension cell is the best performer for a metric */
function isBest(metric: string, dimension: string): boolean {
  if (!tableData.value) return false
  return tableData.value.highlights[metric]?.best === dimension
}

/** Returns true if a dimension cell is the worst performer for a metric */
function isWorst(metric: string, dimension: string): boolean {
  if (!tableData.value) return false
  return tableData.value.highlights[metric]?.worst === dimension
}

function cellClasses(metric: string, dimension: string): string {
  const best = isBest(metric, dimension)
  const worst = isWorst(metric, dimension)
  if (best) return 'bg-emerald-50 text-emerald-800 font-semibold'
  if (worst) return 'bg-red-50 text-red-700 font-medium'
  return ''
}

// ── Column Header Labels ───────────────────────────────
function formatColumnName(column: string): string {
  return column
    .replace(/_/g, ' ')
    .replace(/\b\w/g, c => c.toUpperCase())
}

// ── Computed ───────────────────────────────────────────
const hasData = computed(() => sortedRows.value.length > 0)
const dimensionLabel = computed(() => formatColumnName(props.dimensionColumn))
</script>

<template>
  <div class="report-comparison-table rounded-lg border border-gray-200 bg-white">
    <!-- Header -->
    <div
      v-if="title"
      class="flex items-center justify-between px-4 py-3 border-b border-gray-100"
    >
      <h3 class="text-sm font-semibold text-gray-800">{{ title }}</h3>
      <button
        class="text-xs text-gray-400 hover:text-gray-600 transition-colors"
        title="Refresh data"
        @click="refetch"
      >
        <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
        </svg>
      </button>
    </div>

    <!-- Loading State -->
    <div v-if="loading" class="p-8 flex flex-col items-center justify-center">
      <div class="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mb-3" />
      <p class="text-sm text-gray-500">Loading comparison data...</p>
    </div>

    <!-- Error State -->
    <div v-else-if="error" class="p-8 flex flex-col items-center justify-center">
      <div class="w-10 h-10 rounded-full bg-red-100 flex items-center justify-center mb-3">
        <svg class="w-5 h-5 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L4.072 16.5c-.77.833.192 2.5 1.732 2.5z" />
        </svg>
      </div>
      <p class="text-sm text-red-600 font-medium mb-1">Failed to load data</p>
      <p class="text-xs text-gray-500 mb-3">{{ error }}</p>
      <button
        class="px-3 py-1.5 text-xs font-medium text-white bg-blue-600 hover:bg-blue-700 rounded transition-colors"
        @click="refetch"
      >
        Retry
      </button>
    </div>

    <!-- Empty State -->
    <div v-else-if="!hasData" class="p-8 flex flex-col items-center justify-center">
      <div class="w-10 h-10 rounded-full bg-gray-100 flex items-center justify-center mb-3">
        <svg class="w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 10h18M3 14h18m-9-4v8m-7 0h14a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
        </svg>
      </div>
      <p class="text-sm text-gray-500">No comparison data available</p>
      <p class="text-xs text-gray-400 mt-1">Check that "{{ dimensionColumn }}" has data</p>
    </div>

    <!-- Data Table -->
    <div v-else class="overflow-x-auto">
      <table class="w-full text-sm">
        <!-- Column Headers -->
        <thead>
          <tr class="border-b border-gray-100 bg-gray-50/50">
            <th class="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">
              {{ dimensionLabel }}
            </th>
            <th
              v-for="metric in metrics"
              :key="metric"
              class="px-4 py-3 text-right text-xs font-semibold text-gray-500 uppercase tracking-wider cursor-pointer hover:text-gray-700 select-none transition-colors"
              @click="toggleSort(metric)"
            >
              <span class="inline-flex items-center gap-1">
                {{ formatColumnName(metric) }}
                <span v-if="sortColumn === metric" class="text-blue-500">
                  {{ sortDirection === 'DESC' ? '↓' : '↑' }}
                </span>
                <span v-else class="text-gray-300">↕</span>
              </span>
            </th>
          </tr>
        </thead>

        <!-- Data Rows -->
        <tbody>
          <tr
            v-for="(row, idx) in sortedRows"
            :key="row.dimension"
            class="border-b border-gray-50 hover:bg-gray-50/50 transition-colors"
          >
            <td class="px-4 py-3 font-medium text-gray-800">
              <div class="flex items-center gap-2">
                <span
                  v-if="sortedRows.length > 1 && isBest(metrics[0], row.dimension)"
                  class="w-1.5 h-1.5 rounded-full bg-emerald-400 flex-shrink-0"
                  title="Top performer"
                />
                {{ row.dimension }}
              </div>
            </td>
            <td
              v-for="metric in metrics"
              :key="metric"
              class="px-4 py-3 text-right tabular-nums transition-colors"
              :class="cellClasses(metric, row.dimension)"
            >
              {{ formatValue(row.metrics[metric] ?? 0, metric) }}
            </td>
          </tr>

          <!-- Totals Row -->
          <tr
            v-if="showTotals && tableData && sortedRows.length > 1"
            class="bg-gray-50 border-t-2 border-gray-200 font-semibold"
          >
            <td class="px-4 py-3 text-gray-700 uppercase text-xs tracking-wide">
              Total / Avg
            </td>
            <td
              v-for="metric in metrics"
              :key="metric"
              class="px-4 py-3 text-right tabular-nums text-gray-700"
            >
              {{ formatValue(tableData.totals[metric] ?? 0, metric) }}
            </td>
          </tr>
        </tbody>
      </table>
    </div>

    <!-- Legend (only when there are highlights) -->
    <div
      v-if="hasData && tableData && Object.keys(tableData.highlights).length > 0"
      class="px-4 py-2 border-t border-gray-100 flex items-center gap-4 text-xs text-gray-500"
    >
      <span class="inline-flex items-center gap-1">
        <span class="w-2.5 h-2.5 rounded bg-emerald-100 border border-emerald-300" />
        Best performer
      </span>
      <span class="inline-flex items-center gap-1">
        <span class="w-2.5 h-2.5 rounded bg-red-100 border border-red-300" />
        Worst performer
      </span>
      <span class="ml-auto">
        {{ sortedRows.length }} {{ sortedRows.length === 1 ? 'row' : 'rows' }}
      </span>
    </div>
  </div>
</template>