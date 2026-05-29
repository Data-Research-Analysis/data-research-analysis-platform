/**
 * Chart Auto-Configuration Composable
 * 
 * Implements smart chart auto-configuration that automatically sets chart type,
 * axes, and aggregation based on data model column metadata when a user adds
 * a chart widget.
 * 
 * TICKET DASH-003: Chart Auto-Configuration
 */

import type { IDataModelTableColumn } from '~/types/IDataModelTableColumn'

export interface AutoConfigResult {
    chart_type: string
    columns: IDataModelTableColumn[]
    x_axis_label: string
    y_axis_label: string
    aggregation?: string
    grouping_column?: IDataModelTableColumn
}

export interface ColumnClassification {
    column: IDataModelTableColumn
    category: 'date' | 'categorical' | 'numeric' | 'boolean'
    kpi_type?: 'spend' | 'impressions' | 'clicks' | 'conversions' | 'revenue' | 'ctr' | 'cpc' | 'cpa' | 'roas' | 'other'
    aggregation?: 'SUM' | 'AVG' | 'COUNT'
}

// Date/timestamp data types
const DATE_DATA_TYPES = [
    'date',
    'datetime',
    'timestamp',
    'timestamp without time zone',
    'timestamp with time zone',
    'time',
    'time without time zone',
    'time with time zone',
]

// Numeric data types
const NUMERIC_DATA_TYPES = [
    'smallint',
    'bigint',
    'integer',
    'numeric',
    'decimal',
    'real',
    'double precision',
    'small serial',
    'serial',
    'bigserial',
]

// String/categorical data types
const CATEGORICAL_DATA_TYPES = [
    'character varying',
    'varchar',
    'character',
    'char',
    'bpchar',
    'text',
    'USER-DEFINED',
]

// Marketing KPI column name patterns
const KPI_PATTERNS: Record<string, { patterns: RegExp[], kpi_type: string, aggregation: 'SUM' | 'AVG' }> = {
    spend: {
        patterns: [/spend/i, /cost/i, /cost_micros/i, /amount_spent/i, /budget/i, /ad_spend/i],
        kpi_type: 'spend',
        aggregation: 'SUM',
    },
    impressions: {
        patterns: [/impressions/i, /impr/i, /views/i],
        kpi_type: 'impressions',
        aggregation: 'SUM',
    },
    clicks: {
        patterns: [/clicks/i, /click_count/i, /link_clicks/i],
        kpi_type: 'clicks',
        aggregation: 'SUM',
    },
    conversions: {
        patterns: [/conversions/i, /leads/i, /purchases/i, /signups/i, /actions/i, /total_conversions/i],
        kpi_type: 'conversions',
        aggregation: 'SUM',
    },
    revenue: {
        patterns: [/revenue/i, /conversion_value/i, /purchase_value/i, /sales/i, /income/i],
        kpi_type: 'revenue',
        aggregation: 'SUM',
    },
    ctr: {
        patterns: [/ctr/i, /click_through_rate/i, /click_through/i],
        kpi_type: 'ctr',
        aggregation: 'AVG',
    },
    cpc: {
        patterns: [/cpc/i, /cost_per_click/i],
        kpi_type: 'cpc',
        aggregation: 'AVG',
    },
    cpa: {
        patterns: [/cpa/i, /cost_per_acquisition/i, /cost_per_conversion/i, /cost_per_lead/i, /cpl/i],
        kpi_type: 'cpa',
        aggregation: 'AVG',
    },
    roas: {
        patterns: [/roas/i, /return_on_ad_spend/i, /return_on_spend/i],
        kpi_type: 'roas',
        aggregation: 'AVG',
    },
}

// Dimension column patterns (categorical columns used for grouping)
const DIMENSION_PATTERNS = [
    /campaign/i,
    /ad_group/i,
    /adset/i,
    /ad_set/i,
    /channel/i,
    /platform/i,
    /source/i,
    /medium/i,
    /device/i,
    /geo/i,
    /country/i,
    /region/i,
    /city/i,
    /keyword/i,
    /ad_name/i,
    /creative/i,
    /placement/i,
]

/**
 * Classify a column based on its data type and name
 */
function classifyColumn(column: IDataModelTableColumn): ColumnClassification {
    const dataType = column.data_type.toLowerCase()
    const columnName = column.column_name.toLowerCase()

    // Check if date column
    if (DATE_DATA_TYPES.some(dt => dataType.includes(dt))) {
        return { column, category: 'date' }
    }

    // Check if boolean column
    if (dataType === 'boolean') {
        return { column, category: 'boolean' }
    }

    // Check if numeric column
    if (NUMERIC_DATA_TYPES.some(dt => dataType === dt)) {
        // Try to identify KPI type by column name
        for (const [key, config] of Object.entries(KPI_PATTERNS)) {
            if (config.patterns.some(pattern => pattern.test(columnName))) {
                return {
                    column,
                    category: 'numeric',
                    kpi_type: config.kpi_type as ColumnClassification['kpi_type'],
                    aggregation: config.aggregation,
                }
            }
        }
        return { column, category: 'numeric', kpi_type: 'other', aggregation: 'SUM' }
    }

    // Check if categorical column
    if (CATEGORICAL_DATA_TYPES.some(dt => dataType.includes(dt))) {
        // Check if it's a dimension column
        const isDimension = DIMENSION_PATTERNS.some(pattern => pattern.test(columnName))
        return { column, category: 'categorical' }
    }

    // Default to categorical
    return { column, category: 'categorical' }
}

/**
 * Check if a column is a date column
 */
function isDateColumn(column: IDataModelTableColumn): boolean {
    const dataType = column.data_type.toLowerCase()
    return DATE_DATA_TYPES.some(dt => dataType.includes(dt))
}

/**
 * Check if a column is numeric
 */
function isNumericColumn(column: IDataModelTableColumn): boolean {
    const dataType = column.data_type.toLowerCase()
    return NUMERIC_DATA_TYPES.some(dt => dataType === dt)
}

/**
 * Check if a column is categorical (string/text)
 */
function isCategoricalColumn(column: IDataModelTableColumn): boolean {
    const dataType = column.data_type.toLowerCase()
    return CATEGORICAL_DATA_TYPES.some(dt => dataType.includes(dt)) || dataType === 'boolean'
}

/**
 * Find a column matching a KPI pattern
 */
function findKpiColumn(columns: IDataModelTableColumn[], kpiType: string): IDataModelTableColumn | undefined {
    const config = KPI_PATTERNS[kpiType]
    if (!config) return undefined

    return columns.find(col => {
        const columnName = col.column_name.toLowerCase()
        return config.patterns.some(pattern => pattern.test(columnName))
    })
}

/**
 * Find a dimension column (campaign, channel, etc.)
 */
function findDimensionColumn(columns: IDataModelTableColumn[]): IDataModelTableColumn | undefined {
    return columns.find(col => {
        const columnName = col.column_name.toLowerCase()
        return DIMENSION_PATTERNS.some(pattern => pattern.test(columnName))
    })
}

/**
 * Get aggregation type for a column based on its KPI classification
 */
function getAggregationForColumn(column: IDataModelTableColumn): string {
    const classification = classifyColumn(column)
    if (classification.aggregation) {
        return classification.aggregation
    }
    // Default aggregation for numeric columns
    if (classification.category === 'numeric') {
        return 'SUM'
    }
    return 'COUNT'
}

/**
 * Auto-configure a chart based on available columns
 * 
 * Rules:
 * 1. If data model has a date column → default X-axis = date, chart type = line
 * 2. If data model has spend/cost column → default Y-axis = spend
 * 3. If data model has channel column → default grouping = channel, chart type = bar
 * 4. If data model has only categorical + numeric → chart type = bar (categorical comparison)
 * 5. If data model has multiple numeric columns → suggest multi-line chart
 * 
 * @param columns - Available columns from the data model
 * @param requestedChartType - Optional chart type requested by user (takes precedence)
 * @returns Auto-configuration result
 */
export function useChartAutoConfig() {
    function autoConfigureChart(
        columns: IDataModelTableColumn[],
        requestedChartType?: string
    ): AutoConfigResult | null {
        if (!columns || columns.length === 0) {
            return null
        }

        // Classify all columns
        const classifications = columns.map(classifyColumn)
        
        const dateColumns = classifications.filter(c => c.category === 'date')
        const numericColumns = classifications.filter(c => c.category === 'numeric')
        const categoricalColumns = classifications.filter(c => c.category === 'categorical')
        
        // Find specific KPI columns
        const spendColumn = findKpiColumn(columns, 'spend')
        const channelColumn = findDimensionColumn(columns)
        
        // Determine chart type
        let chartType = requestedChartType || 'vertical_bar'
        let xAxisColumns: IDataModelTableColumn[] = []
        let yAxisColumns: IDataModelTableColumn[] = []
        let groupingColumn: IDataModelTableColumn | undefined

        // Rule 1: If date column exists → line chart with date on X-axis
        if (dateColumns.length > 0 && !requestedChartType) {
            chartType = 'multiline'
            xAxisColumns = [dateColumns[0].column]
            
            // If spend column exists, use it as Y-axis
            if (spendColumn) {
                yAxisColumns = [spendColumn]
            } else if (numericColumns.length > 0) {
                // Use first numeric column as Y-axis
                yAxisColumns = [numericColumns[0].column]
            }
        }
        // Rule 3: If channel/dimension column exists → bar chart grouped by channel
        else if (channelColumn && !requestedChartType) {
            chartType = 'vertical_bar'
            xAxisColumns = [channelColumn]
            groupingColumn = channelColumn
            
            // If spend column exists, use it as Y-axis
            if (spendColumn) {
                yAxisColumns = [spendColumn]
            } else if (numericColumns.length > 0) {
                yAxisColumns = [numericColumns[0].column]
            }
        }
        // Rule 4: Only categorical + numeric → bar chart
        else if (categoricalColumns.length > 0 && numericColumns.length > 0 && !requestedChartType) {
            chartType = 'vertical_bar'
            xAxisColumns = [categoricalColumns[0].column]
            
            if (spendColumn) {
                yAxisColumns = [spendColumn]
            } else {
                yAxisColumns = [numericColumns[0].column]
            }
        }
        // Rule 5: Multiple numeric columns → multi-line chart
        else if (numericColumns.length > 1 && !requestedChartType) {
            chartType = 'multiline'
            
            // Use first categorical or date as X-axis
            if (dateColumns.length > 0) {
                xAxisColumns = [dateColumns[0].column]
            } else if (categoricalColumns.length > 0) {
                xAxisColumns = [categoricalColumns[0].column]
            }
            
            // Use up to 5 numeric columns as Y-axis
            yAxisColumns = numericColumns.slice(0, 5).map(c => c.column)
        }
        // Default: use requested chart type or vertical_bar
        else {
            if (requestedChartType) {
                chartType = requestedChartType
            }
            
            // Set default axes based on available columns
            if (dateColumns.length > 0) {
                xAxisColumns = [dateColumns[0].column]
            } else if (categoricalColumns.length > 0) {
                xAxisColumns = [categoricalColumns[0].column]
            }
            
            if (spendColumn) {
                yAxisColumns = [spendColumn]
            } else if (numericColumns.length > 0) {
                yAxisColumns = [numericColumns[0].column]
            }
        }

        // Build the columns array for the chart
        const chartColumns: IDataModelTableColumn[] = []
        
        // Add X-axis columns first
        xAxisColumns.forEach(col => chartColumns.push(col))
        
        // Add Y-axis columns
        yAxisColumns.forEach(col => {
            // Avoid duplicates
            if (!chartColumns.find(c => c.column_name === col.column_name && c.table_name === col.table_name)) {
                chartColumns.push(col)
            }
        })
        
        // If we still have no columns, add first available
        if (chartColumns.length === 0 && columns.length > 0) {
            chartColumns.push(columns[0])
        }

        // Set axis labels
        const xAxisLabel = xAxisColumns.length > 0 
            ? formatColumnName(xAxisColumns[0].column_name)
            : 'X Axis'
        
        const yAxisLabel = yAxisColumns.length > 0
            ? formatColumnName(yAxisColumns[0].column_name)
            : 'Y Axis'

        // Determine aggregation for Y-axis
        let aggregation: string | undefined
        if (yAxisColumns.length > 0) {
            aggregation = getAggregationForColumn(yAxisColumns[0])
        }

        return {
            chart_type: chartType,
            columns: chartColumns,
            x_axis_label: xAxisLabel,
            y_axis_label: yAxisLabel,
            aggregation,
            grouping_column: groupingColumn,
        }
    }

    /**
     * Format column name for display (replace underscores with spaces, capitalize)
     */
    function formatColumnName(columnName: string): string {
        return columnName
            .replace(/_/g, ' ')
            .replace(/\b\w/g, l => l.toUpperCase())
    }

    /**
     * Get recommended aggregation for a column
     */
    function getRecommendedAggregation(column: IDataModelTableColumn): string {
        return getAggregationForColumn(column)
    }

    /**
     * Check if a column is a marketing KPI
     */
    function isMarketingKpi(column: IDataModelTableColumn): boolean {
        const classification = classifyColumn(column)
        return classification.kpi_type !== undefined && classification.kpi_type !== 'other'
    }

    /**
     * Get KPI type for a column
     */
    function getKpiType(column: IDataModelTableColumn): string | undefined {
        const classification = classifyColumn(column)
        return classification.kpi_type
    }

    return {
        autoConfigureChart,
        getRecommendedAggregation,
        isMarketingKpi,
        getKpiType,
        classifyColumn,
        formatColumnName,
    }
}