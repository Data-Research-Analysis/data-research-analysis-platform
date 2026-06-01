<template>
  <div class="ai-insights-section">
    <!-- Section Header -->
    <div class="flex items-center justify-between mb-3">
      <div class="flex items-center gap-2">
        <div class="w-7 h-7 rounded-lg bg-violet-50 flex items-center justify-center">
          <svg class="h-3.5 w-3.5 text-violet-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
          </svg>
        </div>
        <h3 class="text-sm font-semibold text-gray-800">
          {{ displayTitle }}
        </h3>
        <span
          v-if="insightData?.summary"
          class="px-1.5 py-0.5 text-[10px] font-semibold rounded-full bg-violet-100 text-violet-700"
        >
          {{ insightData.summary.total }}
        </span>
      </div>

      <!-- Refresh button (hidden in published/embedded view) -->
      <button
        v-if="showRefresh"
        @click="handleRefresh"
        :disabled="isLoading"
        class="inline-flex items-center gap-1 px-2 py-1 text-[11px] font-medium text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded transition-colors disabled:opacity-50"
      >
        <svg
          class="h-3 w-3"
          :class="{ 'animate-spin': isLoading }"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
        </svg>
        {{ isLoading ? 'Loading...' : 'Refresh' }}
      </button>
    </div>

    <!-- Cache indicator -->
    <div
      v-if="insightData?.metadata?.cacheHit && !isLoading"
      class="mb-2 text-[10px] text-gray-400 italic"
    >
      Showing cached analysis
      <span v-if="insightData.metadata.analysisTimestamp">
        · {{ formatTimestamp(insightData.metadata.analysisTimestamp) }}
      </span>
    </div>

    <!-- Loading state -->
    <div v-if="isLoading && !insightData" class="space-y-3">
      <div v-for="i in 3" :key="i" class="rounded-lg border border-gray-200 p-3 animate-pulse">
        <div class="flex items-start gap-2.5">
          <div class="w-4 h-4 bg-gray-200 rounded"></div>
          <div class="flex-1 space-y-2">
            <div class="h-3 bg-gray-200 rounded w-3/4"></div>
            <div class="h-2.5 bg-gray-200 rounded w-5/6"></div>
            <div class="h-2.5 bg-gray-200 rounded w-2/3"></div>
          </div>
        </div>
      </div>
    </div>

    <!-- Error state -->
    <div v-else-if="error" class="rounded-lg border border-red-200 bg-red-50 p-3">
      <div class="flex items-start gap-2.5">
        <span class="text-sm">🔴</span>
        <div class="flex-1">
          <p class="text-xs font-medium text-red-800">Unable to load insights</p>
          <p class="text-[11px] text-red-600 mt-0.5">{{ error }}</p>
          <button
            @click="handleRefresh"
            class="mt-1.5 text-[11px] text-red-600 underline hover:text-red-800"
          >
            Retry
          </button>
        </div>
      </div>
    </div>

    <!-- Empty state -->
    <div
      v-else-if="!isLoading && (!insightData || insightData.allInsights.length === 0)"
      class="rounded-lg border border-gray-200 bg-gray-50 p-4 text-center"
    >
      <p class="text-xs text-gray-500">
        No AI insights available for this data model.
      </p>
      <button
        v-if="showRefresh"
        @click="handleRefresh"
        class="mt-2 text-[11px] text-violet-600 underline hover:text-violet-800"
      >
        Run AI Analysis
      </button>
    </div>

    <!-- Insights content -->
    <template v-else-if="insightData">
      <!-- Summary bar -->
      <div
        v-if="showSummary"
        class="grid gap-2 mb-3"
        :class="gridColsClass"
      >
        <div
          v-for="stat in summaryStats"
          :key="stat.label"
          class="text-center p-2 rounded-lg"
          :class="stat.bgColor"
        >
          <p class="text-lg font-bold" :class="stat.textColor">
            {{ stat.count }}
          </p>
          <p class="text-[10px] text-gray-500 mt-0.5">{{ stat.label }}</p>
        </div>
      </div>

      <!-- Category groups -->
      <div class="space-y-3">
        <div
          v-for="group in visibleGroups"
          :key="group.category"
          class="category-group"
        >
          <!-- Group header -->
          <div
            class="flex items-center justify-between cursor-pointer mb-1.5"
            @click="toggleGroup(group.category)"
          >
            <div class="flex items-center gap-1.5">
              <span class="text-xs font-semibold" :class="group.color">
                {{ group.label }}
              </span>
              <span
                class="px-1 py-px text-[10px] font-medium rounded"
                :class="group.badgeColor"
              >
                {{ group.items.length }}
              </span>
            </div>
            <svg
              class="h-3 w-3 text-gray-400 transition-transform"
              :class="{ 'rotate-180': group.collapsed }"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7" />
            </svg>
          </div>

          <!-- Group items -->
          <div v-if="!group.collapsed" class="space-y-1.5">
            <AiInsightCard
              v-for="item in group.items"
              :key="item.id"
              :item="item"
            />
          </div>
        </div>
      </div>
    </template>
  </div>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue'
import {
  useReportAIInsight,
  type ReportAIInsightConfig,
  type InsightCategory,
} from '@/composables/useReportAIInsight'

const props = withDefaults(defineProps<{
  /** Data model ID to fetch insights from */
  dataModelId: number
  /** Override section title */
  title?: string
  /** Filter to a specific insight category */
  filterCategory?: InsightCategory | null
  /** Max insights to display per category */
  maxPerCategory?: number
  /** Show the summary stats bar */
  showSummary?: boolean
  /** Show the refresh button */
  showRefresh?: boolean
  /** Pre-loaded insight data (skip fetching) */
  preloadedData?: any
}>(), {
  title: 'AI Insights',
  filterCategory: null,
  maxPerCategory: 0,
  showSummary: true,
  showRefresh: true,
  preloadedData: null,
})

const config = computed<ReportAIInsightConfig>(() => ({
  data_model_id: props.dataModelId,
  insight_category: props.filterCategory,
  max_per_category: props.maxPerCategory > 0 ? props.maxPerCategory : undefined,
}))

const {
  insightData,
  isLoading,
  error,
  fetchInsights,
  refreshInsights,
} = useReportAIInsight(config)

// Track which groups are collapsed
const collapsedGroups = ref<Set<InsightCategory>>(new Set())

function toggleGroup(category: InsightCategory) {
  if (collapsedGroups.value.has(category)) {
    collapsedGroups.value.delete(category)
  } else {
    collapsedGroups.value.add(category)
  }
}

const displayTitle = computed(() => props.title)

const visibleGroups = computed(() => {
  if (!insightData.value) return []
  return insightData.value.groups.map((g) => ({
    ...g,
    collapsed: collapsedGroups.value.has(g.category),
  }))
})

const gridColsClass = computed(() => {
  if (!insightData.value) return 'grid-cols-4'
  const count = insightData.value.groups.length
  if (count <= 2) return 'grid-cols-2'
  if (count <= 3) return 'grid-cols-3'
  return 'grid-cols-4'
})

const summaryStats = computed(() => {
  if (!insightData.value) return []
  const s = insightData.value.summary
  return [
    { label: 'Trends', count: s.trends, bgColor: 'bg-blue-50', textColor: 'text-blue-600' },
    { label: 'Anomalies', count: s.anomalies, bgColor: s.anomalies > 0 ? 'bg-yellow-50' : 'bg-green-50', textColor: s.anomalies > 0 ? 'text-yellow-600' : 'text-green-600' },
    { label: 'Correlations', count: s.correlations, bgColor: 'bg-emerald-50', textColor: 'text-emerald-600' },
    { label: 'Recommendations', count: s.recommendations, bgColor: 'bg-purple-50', textColor: 'text-purple-600' },
  ].filter((s) => s.count > 0 || !props.filterCategory)
})

function handleRefresh() {
  refreshInsights()
}

function formatTimestamp(ts: string): string {
  try {
    return new Date(ts).toLocaleString('en-US', {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    })
  } catch {
    return ts
  }
}

// Auto-fetch on mount unless preloaded data is provided
if (!props.preloadedData) {
  fetchInsights()
}
</script>