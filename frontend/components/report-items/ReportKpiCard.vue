<script setup lang="ts">
/**
 * ReportItemsKpiCard — KPI card for the report builder.
 *
 * Displays a metric's current aggregated value, period-over-period change
 * (↑↓ with %), and a sparkline mini-chart. Unlike the intelligence KPICard
 * (which is display-only and receives pre-computed props), this component
 * fetches its own data from the data model explore endpoint using the
 * useReportKpi composable.
 *
 * Accepts configuration props: data_model_id, column_name, aggregation,
 * comparison_period, label, format.
 */

import { computed, onMounted, ref, watch } from 'vue'
import { useReportKpi, type ReportKpiConfig } from '~/composables/useReportKpi'

interface Props {
  /** Data model ID to fetch KPI data from */
  dataModelId: number
  /** Column name to aggregate */
  columnName: string
  /** Aggregation function */
  aggregation?: 'sum' | 'avg' | 'count' | 'min' | 'max'
  /** Period to compare against */
  comparisonPeriod?: 'previous_7d' | 'previous_30d' | 'previous_90d'
  /** Override display label (auto-detected from column name if not provided) */
  label?: string
  /** Override display format */
  format?: 'currency' | 'number' | 'percent' | 'ratio'
  /** Accent color for sparkline and icon */
  color?: string
  /** FontAwesome icon name (without prefix) */
  icon?: string
}

const props = withDefaults(defineProps<Props>(), {
  aggregation: 'sum',
  comparisonPeriod: 'previous_30d',
  color: '#3b82f6',
  icon: 'chart-line',
})

const emit = defineEmits<{
  (e: 'click'): void
  (e: 'loaded', data: { label: string; value: string; raw: number | null }): void
  (e: 'error', message: string): void
}>()

// Build a reactive config ref for the composable
const config = computed<ReportKpiConfig>(() => ({
  data_model_id: props.dataModelId,
  column_name: props.columnName,
  aggregation: props.aggregation,
  comparison_period: props.comparisonPeriod,
  label: props.label,
  format: props.format,
}))

const {
  kpiData,
  isLoading,
  error,
  fetchKpiData,
} = useReportKpi(config)

// Notify parent when data loads
watch(kpiData, (data) => {
  if (data) {
    emit('loaded', { label: data.label, value: data.currentValue, raw: data.currentRaw })
  }
})

watch(error, (err) => {
  if (err) emit('error', err)
})

onMounted(() => {
  fetchKpiData()
})

// Trend styling — matches existing KPICard patterns
const trendColor = computed(() => {
  if (!kpiData.value || kpiData.value.trendDirection === 'flat') return 'text-gray-400'
  return kpiData.value.trendIsPositive
    ? (kpiData.value.trendDirection === 'up' ? 'text-emerald-600' : 'text-red-500')
    : (kpiData.value.trendDirection === 'up' ? 'text-red-500' : 'text-emerald-600')
})

const trendBgColor = computed(() => {
  if (!kpiData.value || kpiData.value.trendDirection === 'flat') return 'bg-gray-50 text-gray-400'
  return kpiData.value.trendIsPositive
    ? (kpiData.value.trendDirection === 'up' ? 'bg-emerald-50 text-emerald-600' : 'bg-red-50 text-red-500')
    : (kpiData.value.trendDirection === 'up' ? 'bg-red-50 text-red-500' : 'bg-emerald-50 text-emerald-600')
})

const trendIcon = computed(() => {
  if (!kpiData.value || kpiData.value.trendDirection === 'flat') return 'minus'
  return kpiData.value.trendDirection === 'up' ? 'arrow-up' : 'arrow-down'
})

const formattedTrend = computed(() => {
  if (!kpiData.value || kpiData.value.changePct === null || kpiData.value.trendDirection === 'flat') return '0%'
  const abs = Math.abs(kpiData.value.changePct)
  return abs < 0.1 ? '<0.1%' : `${abs.toFixed(1)}%`
})

const comparisonPeriodLabel = computed(() => {
  switch (props.comparisonPeriod) {
    case 'previous_7d': return 'vs 7d ago'
    case 'previous_90d': return 'vs 90d ago'
    case 'previous_30d':
    default: return 'vs 30d ago'
  }
})

const retryCount = ref(0)
function handleRetry() {
  retryCount.value++
  fetchKpiData()
}
</script>

<template>
  <div
    class="report-kpi-card group relative bg-white rounded-xl border border-gray-200 p-4 transition-all duration-200 hover:shadow-md hover:border-gray-300 cursor-pointer overflow-hidden"
    @click="emit('click')"
  >
    <!-- Loading skeleton -->
    <template v-if="isLoading">
      <div class="space-y-3">
        <div class="flex items-center gap-2">
          <div class="w-6 h-6 rounded-md bg-gray-100 animate-pulse" />
          <div class="h-3 w-16 rounded bg-gray-100 animate-pulse" />
        </div>
        <div class="h-7 w-28 rounded bg-gray-100 animate-pulse" />
        <div class="h-4 w-20 rounded bg-gray-100 animate-pulse" />
        <div class="h-8 w-full rounded bg-gray-50 animate-pulse" />
      </div>
    </template>

    <!-- Error state -->
    <template v-else-if="error && !kpiData">
      <div class="flex flex-col items-center justify-center h-full min-h-[120px] text-center">
        <font-awesome-icon :icon="['fas', 'exclamation-triangle']" class="text-amber-400 text-lg mb-2" />
        <p class="text-xs text-gray-500 mb-2">Failed to load KPI</p>
        <button
          class="text-xs text-blue-500 hover:text-blue-600 font-medium underline"
          @click.stop="handleRetry"
        >
          Retry
        </button>
      </div>
    </template>

    <!-- Loaded content -->
    <template v-else-if="kpiData">
      <!-- Header: icon + label -->
      <div class="flex items-center gap-2 mb-2">
        <div
          class="w-6 h-6 rounded-md flex items-center justify-center flex-shrink-0"
          :style="{ backgroundColor: `${color}10` }"
        >
          <font-awesome-icon
            :icon="['fas', icon]"
            class="text-[10px]"
            :style="{ color }"
          />
        </div>
        <span class="text-[11px] font-medium text-gray-500 uppercase tracking-wide truncate">
          {{ kpiData.label }}
        </span>
      </div>

      <!-- Value -->
      <div class="text-xl font-bold text-gray-900 leading-tight mb-1.5">
        {{ kpiData.currentValue }}
      </div>

      <!-- Trend badge + comparison period -->
      <div class="flex items-center gap-1.5 mb-3">
        <span
          class="inline-flex items-center gap-0.5 text-[10px] font-semibold px-1.5 py-0.5 rounded-full"
          :class="trendBgColor"
        >
          <font-awesome-icon :icon="['fas', trendIcon]" class="w-2.5 h-2.5" />
          {{ formattedTrend }}
        </span>
        <span class="text-[10px] text-gray-400">{{ comparisonPeriodLabel }}</span>
      </div>

      <!-- Sparkline -->
      <div v-if="kpiData.sparklineData.length >= 2" class="mt-auto">
        <TrendSparkline
          :data="kpiData.sparklineData"
          :color="color"
          :height="28"
        />
      </div>
      <!-- No sparkline data -->
      <div
        v-else
        class="h-7 flex items-center justify-center rounded bg-gray-50 border border-dashed border-gray-200"
      >
        <span class="text-[9px] text-gray-300">No trend data</span>
      </div>
    </template>

    <!-- Empty state (no data) -->
    <template v-else>
      <div class="flex flex-col items-center justify-center h-full min-h-[120px] text-center">
        <font-awesome-icon :icon="['fas', 'chart-bar']" class="text-gray-300 text-lg mb-2" />
        <p class="text-xs text-gray-400">No data available</p>
      </div>
    </template>
  </div>
</template>