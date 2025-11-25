/**
 * Represents a filter applied from one chart to others
 */
export interface IChartFilter {
    /** Unique identifier for this filter instance */
    filter_id: string;
    
    /** ID of the chart that created this filter */
    source_chart_id: number;
    
    /** Type of chart that created this filter (for display purposes) */
    source_chart_type: string;
    
    /** Type of filter operation */
    filter_type: 'category' | 'range' | 'multi-category';
    
    /** Column being filtered on */
    column_name: string;
    
    /** Display label for the filtered column */
    column_label?: string;
    
    /** SQL operator to use */
    operator: '=' | '!=' | 'IN' | 'NOT IN' | 'BETWEEN' | '>' | '<' | '>=' | '<=';
    
    /** Single value for simple filters */
    value?: string | number | boolean;
    
    /** Multiple values for IN/NOT IN operators */
    values?: (string | number | boolean)[];
    
    /** Minimum value for range filters */
    min_value?: string | number;
    
    /** Maximum value for range filters */
    max_value?: string | number;
    
    /** Display label for the filter value(s) */
    display_value?: string;
    
    /** Timestamp when filter was applied */
    applied_at: number;
}

/**
 * Filter state for the entire dashboard
 */
export interface IDashboardFilterState {
    /** Active filters by filter_id */
    active_filters: Map<string, IChartFilter>;
    
    /** Filters grouped by source chart */
    filters_by_source: Map<number, IChartFilter[]>;
    
    /** Filters grouped by target column (for efficient SQL building) */
    filters_by_column: Map<string, IChartFilter[]>;
}
