/**
 * Specification for an AI-generated dashboard widget.
 * Produced by GeminiService.generateWidgetSpec() from a natural-language insight.
 */
export interface IWidgetSpec {
    /** Concise widget title shown in the dashboard header */
    title: string;
    /** Chart type to render */
    chart_type: 'bar' | 'line' | 'pie' | 'donut' | 'kpi' | 'table' | 'area';
    /**
     * Parameterised SELECT statement.
     * $1 = startDate (DATE), $2 = endDate (DATE)
     */
    sql: string;
    /** Column name for the x-axis (null for KPI widgets) */
    x_axis: string | null;
    /** Column name for the y-axis / metric (null for table charts) */
    y_axis: string | null;
    /** One-sentence summary shown as widget subtitle and used for regeneration */
    description: string;
}
