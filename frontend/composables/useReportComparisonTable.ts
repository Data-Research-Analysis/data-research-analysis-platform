import { ref, computed, watch } from 'vue'

/**
 * useReportComparisonTable composable
 *
 * Fetches grouped data from the data model explore endpoint (DM-006)
 * for use in the ComparisonTable report item component.
 *
 * Groups rows by a dimension column and aggregates specified metrics.
 */

export interface ComparisonTableConfig {
  dataModelId: number
  dimensionColumn: string
  metrics: string[]
  aggregation?: 'sum' | 'avg' | 'count' | 'min' | 'max'
  limit?: number
}

export interface ComparisonTableRow {
  dimension: string
  metrics: Record<string, number>
  /** Raw metric values before formatting */
  rawMetrics: Record<string, number>
}

export interface ComparisonTableData {
  rows: ComparisonTableRow[]
  dimensionColumn: string
  metricColumns: string[]
  totals: Record<string, number>
  /** Best/worst performer per metric */
  highlights: Record<string, { best: string; worst: string }>
}

const METRIC_DEFAULT_AGG: Record<string, string> = {
  spend: 'sum',
  cost: 'sum',
  cost_micros: 'sum',
  impressions: 'sum',
  clicks: 'sum',
  conversions: 'sum',
  revenue: 'sum',
  conversion_value: 'sum',
  ctr: 'avg',
  cpc: 'avg',
  cpa: 'avg',
  roas: 'avg',
  cpm: 'avg',
}

function getAggForMetric(metric: string): string {
  const lower = metric.toLowerCase()
  return METRIC_DEFAULT_AGG[lower] || 'sum'
}

/**
 * Returns true if the metric's "better" direction is lower (e.g., CPA, CPC)
 */
function isLowerBetter(metric: string): boolean {
  const lower = metric.toLowerCase()
  return ['cpa', 'cpc', 'cpm', 'cost_per_click', 'cost_per_acquisition'].includes(lower)
}

export function useReportComparisonTable(config: ComparisonTableConfig) {
  const loading = ref(false)
  const error = ref<string | null>(null)
  const tableData = ref<ComparisonTableData | null>(null)

  const {
    dataModelId,
    dimensionColumn,
    metrics,
    aggregation,
    limit = 50,
  } = config

  async function fetchData() {
    if (!dataModelId || !dimensionColumn || !metrics.length) {
      tableData.value = null
      return
    }

    loading.value = true
    error.value = null

    try {
      const { useAppFetch } = await import('~/composables/useAppFetch')
      const config = useRuntimeConfig()

      // Build group-by request for each metric
      const metricAggregations: Record<string, string> = {}
      for (const metric of metrics) {
        metricAggregations[metric] = aggregation || getAggForMetric(metric)
      }

      // Use the data model explore endpoint with group-by
      const response = await useAppFetch(
        `${config.public.apiBase}/api/data-model/${dataModelId}/explore`,
        {
          method: 'POST',
          body: {
            group_by: [dimensionColumn],
            aggregations: metricAggregations,
            sort: { column: metrics[0], direction: 'DESC' },
            limit,
          },
        }
      )

      const data = response.data.value as any

      if (!data || !data.data) {
        tableData.value = {
          rows: [],
          dimensionColumn,
          metricColumns: metrics,
          totals: {},
          highlights: {},
        }
        return
      }

      // Process rows
      const rows: ComparisonTableRow[] = (data.data || []).map((row: any) => {
        const dimension = String(row[dimensionColumn] ?? 'Unknown')
        const rawMetrics: Record<string, number> = {}
        for (const metric of metrics) {
          rawMetrics[metric] = Number(row[metric]) || 0
        }
        return {
          dimension,
          metrics: { ...rawMetrics },
          rawMetrics,
        }
      })

      // Compute totals
      const totals: Record<string, number> = {}
      for (const metric of metrics) {
        const agg = metricAggregations[metric]
        if (agg === 'sum' || agg === 'count') {
          totals[metric] = rows.reduce((sum, r) => sum + r.rawMetrics[metric], 0)
        } else if (agg === 'avg') {
          totals[metric] = rows.length
            ? rows.reduce((sum, r) => sum + r.rawMetrics[metric], 0) / rows.length
            : 0
        } else if (agg === 'min') {
          totals[metric] = Math.min(...rows.map(r => r.rawMetrics[metric]))
        } else if (agg === 'max') {
          totals[metric] = Math.max(...rows.map(r => r.rawMetrics[metric]))
        }
      }

      // Compute highlights (best/worst per metric)
      const highlights: Record<string, { best: string; worst: string }> = {}
      for (const metric of metrics) {
        if (rows.length === 0) continue
        const lowerBetter = isLowerBetter(metric)
        let bestRow = rows[0]
        let worstRow = rows[0]
        for (const row of rows) {
          const val = row.rawMetrics[metric]
          const bestVal = bestRow.rawMetrics[metric]
          const worstVal = worstRow.rawMetrics[metric]
          if (lowerBetter) {
            if (val < bestVal) bestRow = row
            if (val > worstVal) worstRow = row
          } else {
            if (val > bestVal) bestRow = row
            if (val < worstVal) worstRow = row
          }
        }
        if (rows.length > 1) {
          highlights[metric] = {
            best: bestRow.dimension,
            worst: worstRow.dimension,
          }
        }
      }

      tableData.value = {
        rows,
        dimensionColumn,
        metricColumns: metrics,
        totals,
        highlights,
      }
    } catch (err: any) {
      error.value = err?.message || 'Failed to fetch comparison data'
      tableData.value = null
    } finally {
      loading.value = false
    }
  }

  function refetch() {
    return fetchData()
  }

  // Auto-fetch on mount
  fetchData()

  return {
    loading,
    error,
    tableData,
    refetch,
  }
}