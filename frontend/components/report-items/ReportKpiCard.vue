<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import { formatValue, KPI_LABEL_MAP, KPI_FORMAT_MAP } from '~/composables/useReportKpi'

interface Props {
  dataModelId: number
  columnName: string
  aggregation?: 'sum' | 'avg' | 'count' | 'min' | 'max'
  comparisonPeriod?: 'previous_7d' | 'previous_30d' | 'previous_90d'
  label?: string
  format?: 'currency' | 'number' | 'percent' | 'ratio'
  color?: string
  icon?: string
  batchValue?: number | null
  batchLoading?: boolean
}

const props = withDefaults(defineProps<Props>(), {
  aggregation: 'sum',
  comparisonPeriod: 'previous_30d',
  color: '#3b82f6',
  icon: 'chart-line',
  batchValue: null,
  batchLoading: false,
})

const emit = defineEmits<{
  (e: 'click'): void
  (e: 'loaded', data: { label: string; value: string; raw: number | null }): void
  (e: 'error', message: string): void
}>()

const resolvedLabel = computed(() => {
  return props.label || KPI_LABEL_MAP[props.columnName.toLowerCase()] || props.columnName
})

const resolvedFormat = computed(() => {
  if (props.format && ['currency', 'number', 'percent', 'ratio'].includes(props.format)) return props.format
  return KPI_FORMAT_MAP[props.columnName.toLowerCase()] || 'number'
})

const currentValue = computed(() => {
  if (props.batchValue === null || props.batchValue === undefined) return null
  return formatValue(props.batchValue, resolvedFormat.value)
})

const isLoaded = ref(false)

watch(() => props.batchValue, (val) => {
  if (!isLoaded.value && (val !== null && val !== undefined)) {
    isLoaded.value = true
    emit('loaded', { label: resolvedLabel.value, value: currentValue.value || '', raw: props.batchValue })
  }
})

onMounted(() => {
  if (props.batchValue !== null && props.batchValue !== undefined) {
    isLoaded.value = true
    emit('loaded', { label: resolvedLabel.value, value: currentValue.value || '', raw: props.batchValue })
  }
})

// Trend coloring
const trendColor = 'text-gray-400'
const trendBgColor = 'bg-gray-50 text-gray-400'
const trendIcon = 'minus'
const formattedTrend = '—'
const comparisonPeriodLabel = computed(() => {
  switch (props.comparisonPeriod) {
    case 'previous_7d': return 'vs 7d ago'
    case 'previous_90d': return 'vs 90d ago'
    case 'previous_30d':
    default: return 'vs 30d ago'
  }
})
</script>

<template>
  <div
    class="report-kpi-card group relative bg-white rounded-xl border border-gray-200 p-4 transition-all duration-200 hover:shadow-md hover:border-gray-300 cursor-pointer overflow-hidden"
    @click="emit('click')"
  >
    <!-- Loading skeleton -->
    <template v-if="batchLoading && batchValue === null">
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
    <template v-else-if="batchValue === null && !batchLoading">
      <div class="flex flex-col items-center justify-center h-full min-h-[120px] text-center">
        <font-awesome-icon :icon="['fas', 'exclamation-triangle']" class="text-amber-400 text-lg mb-2" />
        <p class="text-xs text-gray-500 mb-2">Failed to load KPI</p>
      </div>
    </template>

    <!-- Loaded content -->
    <template v-else-if="batchValue !== null">
      <div class="flex items-center gap-2 mb-2">
        <div
          class="w-6 h-6 rounded-md flex items-center justify-center flex-shrink-0"
          :style="{ backgroundColor: `${color}10` }"
        >
          <font-awesome-icon :icon="['fas', icon]" class="text-[10px]" :style="{ color }" />
        </div>
        <span class="text-[11px] font-medium text-gray-500 uppercase tracking-wide truncate">
          {{ resolvedLabel }}
        </span>
      </div>

      <div class="text-xl font-bold text-gray-900 leading-tight mb-1.5">
        {{ currentValue || '—' }}
      </div>

      <div class="flex items-center gap-1.5 mb-3">
        <span class="inline-flex items-center gap-0.5 text-[10px] font-semibold px-1.5 py-0.5 rounded-full bg-gray-50 text-gray-400">
          <font-awesome-icon :icon="['fas', 'minus']" class="w-2.5 h-2.5" />
          —
        </span>
        <span class="text-[10px] text-gray-400">{{ comparisonPeriodLabel }}</span>
      </div>

      <div class="h-7 flex items-center justify-center rounded bg-gray-50 border border-dashed border-gray-200">
        <span class="text-[9px] text-gray-300">Sparkline unavailable</span>
      </div>
    </template>

    <!-- Empty state -->
    <template v-else>
      <div class="flex flex-col items-center justify-center h-full min-h-[120px] text-center">
        <font-awesome-icon :icon="['fas', 'chart-bar']" class="text-gray-300 text-lg mb-2" />
        <p class="text-xs text-gray-400">No data available</p>
      </div>
    </template>
  </div>
</template>