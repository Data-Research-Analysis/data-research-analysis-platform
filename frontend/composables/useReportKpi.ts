import { ref, watch, computed, type Ref } from 'vue'
import { useAppFetch } from './useAppFetch'
import { getAuthToken } from './AuthToken'
import { useOrganizationContext } from '@/composables/useOrganizationContext'

/**
 * KPI data returned for a single metric card in a report.
 */
export interface ReportKpiData {
  /** The display label for the KPI (e.g. "Total Spend") */
  label: string
  /** The formatted current value (e.g. "$12,345.67") */
  currentValue: string
  /** The raw numeric current value */
  currentRaw: number | null
  /** The formatted previous-period value */
  previousValue: string | null
  /** The raw numeric previous-period value */
  previousRaw: number | null
  /** Percentage change vs comparison period */
  changePct: number | null
  /** Direction of the change */
  trendDirection: 'up' | 'down' | 'flat'
  /** Whether the trend is considered positive (context-dependent) */
  trendIsPositive: boolean
  /** Daily data points for sparkline */
  sparklineData: number[]
}

/**
 * Configuration for a single KPI card.
 */
export interface ReportKpiConfig {
  data_model_id: number
  column_name: string
  aggregation: 'sum' | 'avg' | 'count' | 'min' | 'max'
  comparison_period?: 'previous_7d' | 'previous_30d' | 'previous_90d'
  label?: string
  format?: 'currency' | 'number' | 'percent' | 'ratio'
}

/**
 * A KPI column classified by DM-002.
 */
export interface ClassifiedKpiColumn {
  column_name: string
  classification: 'metric' | 'dimension' | 'time'
  kpi_type?: string
  display_name?: string
  suggested_aggregation?: string
  suggested_format?: string
}

/**
 * KPI metrics where a lower value is considered positive (e.g. CPA, CPC, CPL).
 */
const LOWER_IS_BETTER = new Set([
  'cpa', 'cpc', 'cpl', 'cost_per_click', 'cost_per_acquisition',
  'cost_per_lead', 'cost_per_conversion', 'bounce_rate'
])

/**
 * Human-readable labels for common KPI column names.
 */
const KPI_LABEL_MAP: Record<string, string> = {
  spend: 'Total Spend',
  cost: 'Total Cost',
  cost_micros: 'Total Cost',
  amount_spent: 'Amount Spent',
  impressions: 'Impressions',
  clicks: 'Clicks',
  conversions: 'Conversions',
  leads: 'Leads',
  purchases: 'Purchases',
  signups: 'Signups',
  revenue: 'Revenue',
  conversion_value: 'Conversion Value',
  purchase_value: 'Purchase Value',
  ctr: 'CTR',
  cpc: 'CPC',
  cpa: 'CPA',
  cpl: 'CPL',
  roas: 'ROAS',
  return_on_ad_spend: 'ROAS',
  reach: 'Reach',
  frequency: 'Frequency',
  views: 'Views',
  video_views: 'Video Views',
  engagement: 'Engagement',
  link_clicks: 'Link Clicks',
}

/**
 * Format map from column KPI type to display format.
 */
const KPI_FORMAT_MAP: Record<string, 'currency' | 'number' | 'percent' | 'ratio'> = {
  spend: 'currency',
  cost: 'currency',
  cost_micros: 'currency',
  amount_spent: 'currency',
  impressions: 'number',
  clicks: 'number',
  conversions: 'number',
  leads: 'number',
  purchases: 'number',
  signups: 'number',
  revenue: 'currency',
  conversion_value: 'currency',
  purchase_value: 'currency',
  ctr: 'percent',
  cpc: 'currency',
  cpa: 'currency',
  cpl: 'currency',
  roas: 'ratio',
  return_on_ad_spend: 'ratio',
  reach: 'number',
  frequency: 'ratio',
  views: 'number',
  video_views: 'number',
  engagement: 'number',
  link_clicks: 'number',
}

/**
 * Format a numeric value for display.
 */
function formatValue(value: number | null | undefined, format: 'currency' | 'number' | 'percent' | 'ratio'): string {
  if (value === null || value === undefined || isNaN(value)) return '—'

  switch (format) {
    case 'currency':
      return new Intl.NumberFormat('en-US', {
        style: 'currency',
        currency: 'USD',
        minimumFractionDigits: 0,
        maximumFractionDigits: 2,
      }).format(value)
    case 'percent':
      return `${value.toFixed(2)}%`
    case 'ratio':
      return `${value.toFixed(2)}x`
    case 'number':
    default:
      if (value >= 1_000_000) {
        return `${(value / 1_000_000).toFixed(1)}M`
      }
      if (value >= 1_000) {
        return `${(value / 1_000).toFixed(1)}K`
      }
      return new Intl.NumberFormat('en-US').format(value)
  }
}

/**
 * Determine if a trend is positive based on the KPI type.
 */
function isTrendPositive(columnName: string, changePct: number): boolean {
  const lowerName = columnName.toLowerCase()
  const isLowerBetter = LOWER_IS_BETTER.has(lowerName)
  if (isLowerBetter) {
    return changePct < 0
  }
  return changePct > 0
}

/**
 * Composable that fetches and computes KPI data for a report card.
 *
 * Fetches the current aggregated value and previous-period comparison from
 * the data model explore endpoint, and computes trend + sparkline data.
 */
export function useReportKpi(config: Ref<ReportKpiConfig> | ReportKpiConfig) {
  const apiBase = useRuntimeConfig().public.apiBase
  const kpiData = ref<ReportKpiData | null>(null)
  const isLoading = ref(false)
  const error = ref<string | null>(null)

  /**
   * Resolve the display label for a column.
   */
  function resolveLabel(columnName: string, override?: string): string {
    if (override) return override
    return KPI_LABEL_MAP[columnName.toLowerCase()] || columnName
  }

  /**
   * Resolve the display format for a column.
   */
  function resolveFormat(columnName: string, override?: string): 'currency' | 'number' | 'percent' | 'ratio' {
    if (override && ['currency', 'number', 'percent', 'ratio'].includes(override)) {
      return override as 'currency' | 'number' | 'percent' | 'ratio'
    }
    return KPI_FORMAT_MAP[columnName.toLowerCase()] || 'number'
  }

  /**
   * Fetch KPI data from the data model explore endpoint.
   */
  async function fetchKpiData() {
    const cfg = typeof config === 'object' && 'value' in config ? config.value : config

    if (!cfg.data_model_id || !cfg.column_name) {
      error.value = 'Missing data_model_id or column_name'
      return
    }

    isLoading.value = true
    error.value = null

    try {
      const token = getAuthToken()
      const { getOrgHeaders } = useOrganizationContext()
      const orgHeaders = getOrgHeaders()
      const headers = {
        'Authorization': `Bearer ${token}`,
        'Authorization-Type': 'auth',
        'Content-Type': 'application/json',
        ...orgHeaders,
      }

      const format = resolveFormat(cfg.column_name, cfg.format)
      const label = resolveLabel(cfg.column_name, cfg.label)
      const aggregation = cfg.aggregation || 'sum'

      // Fetch current period aggregated value
      const currentResponse = await useAppFetch<any>(`${apiBase}/data-model/${cfg.data_model_id}/explore`, {
        method: 'POST',
        headers,
        body: {
          aggregations: {
            [cfg.column_name]: aggregation.toUpperCase(),
          },
          pageSize: 1,
        },
      })

      let currentRaw: number | null = null
      if (currentResponse?.data && currentResponse.data.length > 0) {
        const val = currentResponse.data[0][`${aggregation}_${cfg.column_name}`]
          ?? currentResponse.data[0][cfg.column_name]
          ?? currentResponse.data[0][aggregation]
        currentRaw = val !== null && val !== undefined ? Number(val) : null
      }

      // Fetch sparkline data (daily aggregation over last 30 days)
      let sparklineData: number[] = []
      const dateCandidates = ['date', 'day', 'date_start', 'date_stop', 'start_date', 'end_date', 'created_at', 'updated_at', 'timestamp', 'transaction_date', 'period', 'month', 'year']
      try {
        const colResponse = await useAppFetch<any>(`${apiBase}/data-model/${cfg.data_model_id}/explore`, {
          method: 'POST',
          headers,
          body: { pageSize: 1 },
        })
        const availableCols: string[] = colResponse?.columns || []
        console.log('[KPI Sparkline] Available columns:', availableCols)
        const dateColumn = availableCols.find((c: string) => dateCandidates.includes(c.toLowerCase())) || null
        console.log('[KPI Sparkline] Detected date column:', dateColumn)
        if (dateColumn) {
          console.log('[KPI Sparkline] Sending groupBy request with column:', cfg.column_name, 'dateCol:', dateColumn, 'agg:', aggregation.toUpperCase())
          const sparklineResponse = await useAppFetch<any>(`${apiBase}/data-model/${cfg.data_model_id}/explore`, {
            method: 'POST',
            headers,
            body: {
              groupBy: {
                columns: [dateColumn],
                aggregations: [{ column: cfg.column_name, function: aggregation.toUpperCase() }],
              },
              sort: [{ column: dateColumn, direction: 'ASC' }],
              pageSize: 30,
            },
          })
          console.log('[KPI Sparkline] groupBy response:', sparklineResponse)
          if (sparklineResponse?.data) {
            const aliasKey = `${aggregation}_${cfg.column_name}`
            console.log('[KPI Sparkline] aliasKey:', aliasKey, 'first row keys:', Object.keys(sparklineResponse.data[0] || {}))
            console.log('[KPI Sparkline] raw rows:', sparklineResponse.data)
            sparklineData = sparklineResponse.data
              .filter((row: any) => {
                const exists = aliasKey in row
                const notNull = row[aliasKey] !== null
                if (!exists) console.log('[KPI Sparkline] Filtering row — key missing:', aliasKey, 'row keys:', Object.keys(row))
                if (exists && !notNull) console.log('[KPI Sparkline] Filtering row — null value for:', aliasKey)
                return exists && notNull
              })
              .map((row: any) => Number(row[aliasKey]))
            console.log('[KPI Sparkline] Final sparklineData:', sparklineData)
          } else {
            console.log('[KPI Sparkline] No data in response')
          }
        } else {
          console.log('[KPI Sparkline] No date column found among:', availableCols)
        }
      } catch (e) {
        console.log('[KPI Sparkline] Error:', e)
      }

      // Fetch previous period comparison
      let previousRaw: number | null = null
      let changePct: number | null = null

      const comparisonPeriod = cfg.comparison_period || 'previous_30d'
      try {
        const comparisonResponse = await useAppFetch<any>(`${apiBase}/data-model/${cfg.data_model_id}/explore`, {
          method: 'POST',
          headers,
          body: {
            aggregations: {
              [cfg.column_name]: aggregation.toUpperCase(),
            },
            pageSize: 1,
          },
        })

        if (comparisonResponse?.data && comparisonResponse.data.length > 0) {
          const val = comparisonResponse.data[0][`${aggregation}_${cfg.column_name}`]
            ?? comparisonResponse.data[0][cfg.column_name]
            ?? comparisonResponse.data[0][aggregation]
          previousRaw = val !== null && val !== undefined ? Number(val) : null
        }
      } catch {
        // Comparison is optional
      }

      // Compute change percentage
      if (currentRaw !== null && previousRaw !== null && previousRaw !== 0) {
        changePct = ((currentRaw - previousRaw) / Math.abs(previousRaw)) * 100
      }

      const trendDirection: 'up' | 'down' | 'flat' =
        changePct === null || Math.abs(changePct) < 0.01
          ? 'flat'
          : changePct > 0
            ? 'up'
            : 'down'

      kpiData.value = {
        label,
        currentValue: formatValue(currentRaw, format),
        currentRaw,
        previousValue: previousRaw !== null ? formatValue(previousRaw, format) : null,
        previousRaw,
        changePct,
        trendDirection,
        trendIsPositive: changePct !== null ? isTrendPositive(cfg.column_name, changePct) : true,
        sparklineData,
      }
    } catch (err: any) {
      error.value = err?.message || 'Failed to fetch KPI data'
      kpiData.value = null
    } finally {
      isLoading.value = false
    }
  }

  // Watch for config changes and refetch
  if (typeof config === 'object' && 'value' in config) {
    watch(config, () => fetchKpiData(), { deep: true })
  }

  return {
    kpiData,
    isLoading,
    error,
    fetchKpiData,
    formatValue,
    resolveLabel,
    resolveFormat,
    KPI_LABEL_MAP,
    KPI_FORMAT_MAP,
  }
}

/**
 * Fetch KPI classification for a data model (DM-002 endpoint).
 * Returns classified columns that can be used to auto-populate KPI cards.
 */
export function useKpiClassification(dataModelId: Ref<number> | number) {
  const apiBase = useRuntimeConfig().public.apiBase
  const classifiedColumns = ref<ClassifiedKpiColumn[]>([])
  const hasMarketingData = ref(false)
  const isLoading = ref(false)
  const error = ref<string | null>(null)

  async function fetchClassification() {
    const id = typeof dataModelId === 'object' && 'value' in dataModelId
      ? dataModelId.value
      : dataModelId

    if (!id) return

    isLoading.value = true
    error.value = null

    try {
      const token = getAuthToken()
      const { getOrgHeaders } = useOrganizationContext()
      const orgHeaders = getOrgHeaders()
      const headers = {
        'Authorization': `Bearer ${token}`,
        'Authorization-Type': 'auth',
        ...orgHeaders,
      }

      const response = await useAppFetch<any>(`${apiBase}/data-model/${id}/kpi-classification`, { headers })

      if (response) {
        classifiedColumns.value = response.columns || []
        hasMarketingData.value = response.has_marketing_data || false
      }
    } catch (err: any) {
      error.value = err?.message || 'Failed to fetch KPI classification'
    } finally {
      isLoading.value = false
    }
  }

  /**
   * Get top N metric KPI columns sorted by relevance (common KPIs first).
   */
  function getTopMetricColumns(count: number = 6): ClassifiedKpiColumn[] {
    const priorityOrder = [
      'spend', 'cost', 'revenue', 'conversions', 'clicks', 'impressions',
      'roas', 'ctr', 'cpa', 'cpc', 'cpl', 'leads', 'purchases', 'signups',
      'conversion_value', 'purchase_value', 'reach', 'frequency',
      'amount_spent', 'cost_micros', 'views', 'video_views', 'engagement',
    ]

    const metrics = classifiedColumns.value.filter(c => c.classification === 'metric')

    metrics.sort((a, b) => {
      const aIdx = priorityOrder.indexOf(a.kpi_type || a.column_name.toLowerCase())
      const bIdx = priorityOrder.indexOf(b.kpi_type || b.column_name.toLowerCase())
      // Lower index = higher priority; items not in list get Infinity
      return (aIdx === -1 ? 999 : aIdx) - (bIdx === -1 ? 999 : bIdx)
    })

    return metrics.slice(0, count)
  }

  /**
   * Convert a classified column into a ReportKpiConfig.
   */
  function columnToConfig(col: ClassifiedKpiColumn, dataModelId: number): ReportKpiConfig {
    const kpiType = col.kpi_type || col.column_name.toLowerCase()
    const format = KPI_FORMAT_MAP[kpiType]

    return {
      data_model_id: dataModelId,
      column_name: col.column_name,
      aggregation: (col.suggested_aggregation as ReportKpiConfig['aggregation']) || 'sum',
      comparison_period: 'previous_30d',
      label: col.display_name || KPI_LABEL_MAP[kpiType] || col.column_name,
      format: format || 'number',
    }
  }

  if (typeof dataModelId === 'object' && 'value' in dataModelId) {
    watch(dataModelId, () => fetchClassification())
  }

  return {
    classifiedColumns,
    hasMarketingData,
    isLoading,
    error,
    fetchClassification,
    getTopMetricColumns,
    columnToConfig,
  }
}