import { ref, watch, computed, type Ref } from 'vue'
import { getAuthToken } from '@/composables/AuthToken'

/**
 * Insight categories for the AI Insight Card report component.
 */
export type InsightCategory = 'trend' | 'anomaly' | 'correlation' | 'recommendation'

/**
 * Severity levels for individual insights.
 */
export type InsightSeverity = 'info' | 'success' | 'warning' | 'danger' | 'low' | 'medium' | 'high' | 'critical'

/**
 * A single flattened AI insight used for rendering in report cards.
 */
export interface AIInsightItem {
  /** Unique identifier within the insight set */
  id: string
  /** Category of the insight */
  category: InsightCategory
  /** Display title for the insight */
  title: string
  /** Full description / body text */
  description: string
  /** Severity level for color coding */
  severity: InsightSeverity
  /** Optional metric name associated with the insight */
  metric?: string | null
  /** Optional icon override (emoji) */
  icon?: string
  /** Related columns, metrics, or data points */
  tags?: string[]
  /** Confidence score (0–1) for pattern-based insights */
  confidence?: number | null
  /** Priority for recommendation insights */
  priority?: 'high' | 'medium' | 'low'
  /** Timestamp when this insight was generated */
  generatedAt?: string
}

/**
 * Grouped insights by category for the section component.
 */
export interface InsightGroup {
  category: InsightCategory
  label: string
  icon: string
  color: string
  bgColor: string
  borderColor: string
  badgeColor: string
  items: AIInsightItem[]
  collapsed: boolean
}

/**
 * Configuration for an AI insight report item.
 */
export interface ReportAIInsightConfig {
  /** Data model ID to fetch AI insights from */
  data_model_id: number
  /** Optional: specific category to filter (null = all categories) */
  insight_category?: InsightCategory | null
  /** Optional: max insights to display per category */
  max_per_category?: number
}

/**
 * Full resolved AI insight data for a report item.
 */
export interface ReportAIInsightData {
  /** All flattened insight items */
  allInsights: AIInsightItem[]
  /** Insights grouped by category */
  groups: InsightGroup[]
  /** Summary stats */
  summary: {
    total: number
    trends: number
    anomalies: number
    correlations: number
    recommendations: number
  }
  /** Metadata from the analysis */
  metadata: {
    analysisTimestamp: string | null
    modelUsed: string | null
    cacheHit: boolean
  }
}

/**
 * Category display metadata.
 */
const CATEGORY_META: Record<InsightCategory, {
  label: string
  icon: string
  color: string
  bgColor: string
  borderColor: string
  badgeColor: string
}> = {
  trend: {
    label: 'Trends',
    icon: 'chart-line',
    color: 'text-blue-600',
    bgColor: 'bg-blue-50',
    borderColor: 'border-blue-200',
    badgeColor: 'bg-blue-100 text-blue-700',
  },
  anomaly: {
    label: 'Anomalies',
    icon: 'exclamation-triangle',
    color: 'text-yellow-600',
    bgColor: 'bg-yellow-50',
    borderColor: 'border-yellow-200',
    badgeColor: 'bg-yellow-100 text-yellow-700',
  },
  correlation: {
    label: 'Correlations',
    icon: 'diagram-project',
    color: 'text-emerald-600',
    bgColor: 'bg-emerald-50',
    borderColor: 'border-emerald-200',
    badgeColor: 'bg-emerald-100 text-emerald-700',
  },
  recommendation: {
    label: 'Recommendations',
    icon: 'lightbulb',
    color: 'text-purple-600',
    bgColor: 'bg-purple-50',
    borderColor: 'border-purple-200',
    badgeColor: 'bg-purple-100 text-purple-700',
  },
}

/**
 * Map severity to background/border/text classes for individual insight cards.
 */
export function getInsightSeverityClasses(severity: InsightSeverity): {
  bg: string
  border: string
  text: string
  badge: string
} {
  switch (severity) {
    case 'danger':
    case 'critical':
      return { bg: 'bg-red-50', border: 'border-red-200', text: 'text-red-700', badge: 'bg-red-100 text-red-700' }
    case 'high':
      return { bg: 'bg-orange-50', border: 'border-orange-200', text: 'text-orange-700', badge: 'bg-orange-100 text-orange-700' }
    case 'warning':
    case 'medium':
      return { bg: 'bg-yellow-50', border: 'border-yellow-200', text: 'text-yellow-700', badge: 'bg-yellow-100 text-yellow-700' }
    case 'success':
      return { bg: 'bg-green-50', border: 'border-green-200', text: 'text-green-700', badge: 'bg-green-100 text-green-700' }
    case 'low':
    case 'info':
    default:
      return { bg: 'bg-blue-50', border: 'border-blue-200', text: 'text-blue-700', badge: 'bg-blue-100 text-blue-700' }
  }
}

/**
 * Get severity emoji for display.
 */
export function getInsightSeverityEmoji(severity: InsightSeverity): string {
  switch (severity) {
    case 'critical': return '🔴'
    case 'danger': return '🔴'
    case 'high': return '🟠'
    case 'medium': return '🟡'
    case 'warning': return '⚠️'
    case 'success': return '✅'
    case 'low': return '🔵'
    case 'info':
    default: return '💡'
  }
}

/**
 * Flatten the AI insights response into a list of AIInsightItem objects.
 */
function flattenInsights(
  rawInsights: any,
  metadata: { analysisTimestamp: string | null; modelUsed: string | null }
): AIInsightItem[] {
  const items: AIInsightItem[] = []
  let counter = 0

  // Key insights → trend / info
  if (rawInsights?.key_insights) {
    for (const ki of rawInsights.key_insights) {
      counter++
      items.push({
        id: `insight-${counter}`,
        category: 'trend',
        title: ki.title || 'Key Insight',
        description: ki.description || '',
        severity: ki.severity || 'info',
        metric: ki.metric ?? null,
        icon: ki.icon,
        generatedAt: metadata.analysisTimestamp ?? undefined,
      })
    }
  }

  // Patterns & trends → correlation
  if (rawInsights?.patterns_and_trends) {
    for (const pt of rawInsights.patterns_and_trends) {
      counter++
      items.push({
        id: `pattern-${counter}`,
        category: 'correlation',
        title: pt.pattern || 'Pattern Detected',
        description: pt.marketing_implication || '',
        severity: 'info',
        tags: pt.columns_involved || [],
        confidence: pt.confidence ?? null,
        generatedAt: metadata.analysisTimestamp ?? undefined,
      })
    }
  }

  // Anomalies detected → anomaly
  if (rawInsights?.anomalies_detected) {
    for (const an of rawInsights.anomalies_detected) {
      counter++
      items.push({
        id: `anomaly-${counter}`,
        category: 'anomaly',
        title: an.anomaly || 'Anomaly Detected',
        description: `${an.affected_column ? `Column: ${an.affected_column}. ` : ''}${an.expected_range ? `Expected: ${an.expected_range}. ` : ''}${an.actual_value ? `Actual: ${an.actual_value}` : ''}`.trim(),
        severity: an.severity || 'medium',
        metric: an.affected_column ?? null,
        generatedAt: metadata.analysisTimestamp ?? undefined,
      })
    }
  }

  // Marketing recommendations → recommendation
  if (rawInsights?.marketing_recommendations) {
    for (const mr of rawInsights.marketing_recommendations) {
      counter++
      items.push({
        id: `rec-${counter}`,
        category: 'recommendation',
        title: mr.recommendation || 'Recommendation',
        description: mr.expected_impact ? `Expected Impact: ${mr.expected_impact}` : '',
        severity: mr.priority === 'high' ? 'warning' : mr.priority === 'medium' ? 'info' : 'info',
        priority: mr.priority || 'medium',
        tags: mr.related_metrics || [],
        generatedAt: metadata.analysisTimestamp ?? undefined,
      })
    }
  }

  return items
}

/**
 * Group flat insight items into InsightGroup array.
 */
function groupInsights(
  items: AIInsightItem[],
  filterCategory?: InsightCategory | null,
  maxPerCategory?: number
): InsightGroup[] {
  const categories: InsightCategory[] = filterCategory
    ? [filterCategory]
    : ['trend', 'anomaly', 'correlation', 'recommendation']

  return categories.map((cat) => {
    const meta = CATEGORY_META[cat]
    let catItems = items.filter((i) => i.category === cat)
    if (maxPerCategory && maxPerCategory > 0) {
      catItems = catItems.slice(0, maxPerCategory)
    }
    return {
      category: cat,
      label: meta.label,
      icon: meta.icon,
      color: meta.color,
      bgColor: meta.bgColor,
      borderColor: meta.borderColor,
      badgeColor: meta.badgeColor,
      items: catItems,
      collapsed: false,
    }
  }).filter((g) => g.items.length > 0)
}

/**
 * Composable that fetches and computes AI insight data for a report section.
 *
 * Fetches from the data model AI analysis endpoint (POST /data-model/:id/ai-analyze),
 * flattens the response into individual insight items, and groups them by category.
 */
export function useReportAIInsight(config: Ref<ReportAIInsightConfig> | ReportAIInsightConfig) {
  const insightData = ref<ReportAIInsightData | null>(null)
  const isLoading = ref(false)
  const isRefreshing = ref(false)
  const error = ref<string | null>(null)

  /**
   * Fetch AI insights from the data model analysis endpoint.
   */
  async function fetchInsights(forceRefresh = false) {
    const cfg = typeof config === 'object' && 'value' in config ? config.value : config

    if (!cfg.data_model_id) {
      error.value = 'Missing data_model_id'
      return
    }

    isLoading.value = true
    if (forceRefresh) isRefreshing.value = true
    error.value = null

    try {
      const token = getAuthToken()
      if (!token) {
        throw new Error('Authentication required')
      }

      const baseUrl = useRuntimeConfig().public.apiBase
      const url = `${baseUrl}/data-model/${cfg.data_model_id}/ai-analyze`

      const response = await $fetch<any>(url, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Authorization-Type': 'auth',
          'Content-Type': 'application/json',
        },
      })

      if (!response) {
        throw new Error('Empty response from AI analysis')
      }

      const metadata = {
        analysisTimestamp: response?.metadata?.analysis_timestamp ?? null,
        modelUsed: response?.metadata?.model_used ?? null,
        cacheHit: response?.metadata?.cache_hit ?? false,
      }

      const allInsights = flattenInsights(response, metadata)
      const groups = groupInsights(
        allInsights,
        cfg.insight_category,
        cfg.max_per_category
      )

      const summary = {
        total: allInsights.length,
        trends: allInsights.filter((i) => i.category === 'trend').length,
        anomalies: allInsights.filter((i) => i.category === 'anomaly').length,
        correlations: allInsights.filter((i) => i.category === 'correlation').length,
        recommendations: allInsights.filter((i) => i.category === 'recommendation').length,
      }

      insightData.value = {
        allInsights,
        groups,
        summary,
        metadata,
      }
    } catch (err: any) {
      const message = err?.data?.error || err?.message || 'Failed to fetch AI insights'
      error.value = message
      console.error('[useReportAIInsight] AI analysis failed:', err)
    } finally {
      isLoading.value = false
      isRefreshing.value = false
    }
  }

  /**
   * Refresh insights (re-trigger analysis).
   */
  async function refreshInsights() {
    await fetchInsights(true)
  }

  // Watch for config changes and refetch
  if (typeof config === 'object' && 'value' in config) {
    watch(config, () => fetchInsights(), { deep: true })
  }

  return {
    insightData,
    isLoading,
    isRefreshing,
    error,
    fetchInsights,
    refreshInsights,
    CATEGORY_META,
  }
}