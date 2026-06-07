<script setup lang="ts">
/**
 * ReportItemsKpiCardRow — Renders a row of 4-6 KPI cards for reports.
 *
 * Supports two modes:
 * 1. **Manual mode:** Accepts an array of KpiCard configs via the `cards` prop
 * 2. **Auto-populate mode:** Given a dataModelId and no cards, fetches KPI
 *    classification from DM-002 and auto-selects the top 6 metric columns
 *
 * Responsive: wraps on mobile, displays in a horizontal grid on desktop.
 */

import { ref, computed, onMounted, watch } from 'vue'
import {
  useKpiClassification,
  type ReportKpiConfig,
  type ClassifiedKpiColumn,
} from '~/composables/useReportKpi'

/** Accent color palette for auto-populated cards */
const AUTO_COLORS = [
  '#3b82f6', // blue
  '#10b981', // emerald
  '#f59e0b', // amber
  '#8b5cf6', // violet
  '#ef4444', // red
  '#06b6d4', // cyan
]

/** Icon palette for auto-populated cards */
const AUTO_ICONS: Record<string, string> = {
  spend: 'dollar-sign',
  cost: 'dollar-sign',
  cost_micros: 'dollar-sign',
  amount_spent: 'dollar-sign',
  revenue: 'money-bill-trend-up',
  conversion_value: 'money-bill-trend-up',
  purchase_value: 'money-bill-trend-up',
  impressions: 'eye',
  clicks: 'mouse-pointer',
  conversions: 'bullseye',
  leads: 'user-plus',
  purchases: 'shopping-cart',
  signups: 'user-plus',
  ctr: 'percent',
  cpc: 'money-bill',
  cpa: 'money-bill',
  cpl: 'money-bill',
  roas: 'chart-line',
  return_on_ad_spend: 'chart-line',
  reach: 'users',
  frequency: 'rotate',
  views: 'eye',
  video_views: 'video',
  engagement: 'hand-pointer',
  link_clicks: 'link',
}

interface Props {
  /** Data model ID to fetch KPI data from */
  dataModelId: number
  /** Manual card configurations. If omitted, auto-populates from KPI classification. */
  cards?: ReportKpiConfig[]
  /** Maximum number of cards to show in auto-populate mode (default: 6) */
  maxCards?: number
  /** Override comparison period for all cards */
  comparisonPeriod?: 'previous_7d' | 'previous_30d' | 'previous_90d'
}

const props = withDefaults(defineProps<Props>(), {
  maxCards: 6,
  comparisonPeriod: 'previous_30d',
})

const emit = defineEmits<{
  (e: 'cardClick', config: ReportKpiConfig): void
  (e: 'loaded', count: number): void
  (e: 'error', message: string): void
}>()

// Auto-populate support
const {
  classifiedColumns,
  isLoading: isClassifying,
  error: classificationError,
  fetchClassification,
  getTopMetricColumns,
  columnToConfig,
} = useKpiClassification(computed(() => props.dataModelId))

/**
 * Resolved card configs — either from the manual `cards` prop or auto-populated
 * from KPI classification.
 */
const resolvedCards = computed<ReportKpiConfig[]>(() => {
  // Manual mode: use provided cards
  if (props.cards && props.cards.length > 0) {
    return props.cards.map(card => ({
      ...card,
      comparison_period: card.comparison_period || props.comparisonPeriod,
    }))
  }

  // Auto-populate mode: derive from classification
  if (!props.dataModelId || classifiedColumns.value.length === 0) {
    return []
  }

  const topColumns = getTopMetricColumns(props.maxCards)
  return topColumns.map((col, idx) => {
    const config = columnToConfig(col, props.dataModelId)
    config.comparison_period = props.comparisonPeriod
    return config
  })
})

/** Number of loaded cards (for the loaded event) */
const loadedCount = ref(0)

function handleCardLoaded(config: ReportKpiConfig) {
  loadedCount.value++
  if (loadedCount.value >= resolvedCards.value.length) {
    emit('loaded', loadedCount.value)
  }
}

function handleCardError(message: string) {
  emit('error', message)
}

function handleCardClick(config: ReportKpiConfig) {
  emit('cardClick', config)
}

/**
 * Assign a unique accent color to each card based on its position.
 */
function getCardColor(index: number): string {
  return AUTO_COLORS[index % AUTO_COLORS.length]
}

/**
 * Resolve the FontAwesome icon for a card based on its column name.
 */
function getCardIcon(config: ReportKpiConfig): string {
  const kpiType = config.column_name.toLowerCase()
  return AUTO_ICONS[kpiType] || 'chart-line'
}

// Reset loaded count when cards change
watch(resolvedCards, () => {
  loadedCount.value = 0
}, { deep: true })

// Auto-fetch classification if no manual cards provided
onMounted(() => {
  if (!props.cards || props.cards.length === 0) {
    fetchClassification()
  }
})
</script>

<template>
  <div class="report-kpi-card-row">
    <!-- Row header (optional, shown in auto-populate mode) -->
    <div
      v-if="!props.cards || props.cards.length === 0"
      class="flex items-center justify-between mb-3"
    >
      <h3 class="text-sm font-semibold text-gray-700">Key Metrics</h3>
      <span v-if="isClassifying" class="text-xs text-gray-400">
        Loading KPIs...
      </span>
      <span
        v-else-if="resolvedCards.length > 0"
        class="text-xs text-gray-400"
      >
        {{ resolvedCards.length }} metrics
      </span>
    </div>

    <!-- Classification loading state -->
    <div
      v-if="isClassifying && (!props.cards || props.cards.length === 0)"
      class="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6 gap-3"
    >
      <div
        v-for="n in maxCards"
        :key="`skeleton-${n}`"
        class="bg-white rounded-xl border border-gray-200 p-4"
      >
        <div class="space-y-3">
          <div class="flex items-center gap-2">
            <div class="w-6 h-6 rounded-md bg-gray-100 animate-pulse" />
            <div class="h-3 w-16 rounded bg-gray-100 animate-pulse" />
          </div>
          <div class="h-7 w-28 rounded bg-gray-100 animate-pulse" />
          <div class="h-4 w-20 rounded bg-gray-100 animate-pulse" />
          <div class="h-8 w-full rounded bg-gray-50 animate-pulse" />
        </div>
      </div>
    </div>

    <!-- Classification error state -->
    <div
      v-else-if="classificationError && (!props.cards || props.cards.length === 0)"
      class="flex items-center justify-center py-8 text-center"
    >
      <div>
        <font-awesome-icon :icon="['fas', 'exclamation-triangle']" class="text-amber-400 text-lg mb-2" />
        <p class="text-sm text-gray-500 mb-2">Failed to load KPI classification</p>
        <button
          class="text-sm text-blue-500 hover:text-blue-600 font-medium underline"
          @click="fetchClassification"
        >
          Retry
        </button>
      </div>
    </div>

    <!-- KPI Cards Grid -->
    <div
      v-else-if="resolvedCards.length > 0"
      class="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6 gap-3"
    >
      <ReportKpiCard
        v-for="(cardConfig, index) in resolvedCards"
        :key="`${cardConfig.data_model_id}-${cardConfig.column_name}-${cardConfig.aggregation}-${index}`"
        :data-model-id="cardConfig.data_model_id"
        :column-name="cardConfig.column_name"
        :aggregation="cardConfig.aggregation"
        :comparison-period="cardConfig.comparison_period"
        :label="cardConfig.label"
        :format="cardConfig.format"
        :color="getCardColor(index)"
        :icon="getCardIcon(cardConfig)"
        @click="handleCardClick(cardConfig)"
        @loaded="handleCardLoaded(cardConfig)"
        @error="handleCardError"
      />
    </div>

    <!-- Empty state: no KPIs found -->
    <div
      v-else
      class="flex flex-col items-center justify-center py-8 text-center bg-gray-50 rounded-xl border border-dashed border-gray-200"
    >
      <font-awesome-icon :icon="['fas', 'chart-bar']" class="text-gray-300 text-2xl mb-3" />
      <p class="text-sm text-gray-500 mb-1">No KPI metrics available</p>
      <p class="text-xs text-gray-400">
        Add KPI cards manually or connect a data model with numeric columns
      </p>
    </div>
  </div>
</template>