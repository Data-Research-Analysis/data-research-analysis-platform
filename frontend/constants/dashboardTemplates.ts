/**
 * Dashboard Templates
 *
 * Pre-configured dashboard templates for common marketing use cases.
 * Selecting a template creates a dashboard with pre-configured widgets
 * that can be bound to a data model.
 */

export interface DashboardTemplateWidget {
    chart_type: string;
    label: string;
    dimensions: { width: string; height: string; widthDraggable: string; heightDraggable: string };
    location: { top: string; left: string };
    marketing_config?: Record<string, any>;
    text_editor?: { content: string };
    /** Column hints — matched against data model columns by name pattern */
    column_hints?: string[];
}

export interface DashboardTemplate {
    id: string;
    name: string;
    description: string;
    best_for: string;
    icon: string;   // font-awesome icon array e.g. ['fas', 'chart-line']
    color: string;  // gradient start color for card header
    widgets: DashboardTemplateWidget[];
}

export const DASHBOARD_TEMPLATES: DashboardTemplate[] = [
    {
        id: 'executive_summary',
        name: 'Executive Summary',
        description: 'CMO weekly review — 6 KPI cards, trend charts, and a channel split for a quick performance snapshot.',
        best_for: 'CMO weekly review',
        icon: 'chart-line',
        color: '#3B82F6',
        widgets: [
            {
                chart_type: 'kpi_scorecard',
                label: 'Total Spend',
                dimensions: { width: '200px', height: '200px', widthDraggable: '200px', heightDraggable: '200px' },
                location: { top: '0px', left: '0px' },
                marketing_config: { metric: 'spend', data_source: 'marketing_hub', show_delta: true, format: 'currency', comparison_period: 'prior_period' },
            },
            {
                chart_type: 'kpi_scorecard',
                label: 'Conversions',
                dimensions: { width: '200px', height: '200px', widthDraggable: '200px', heightDraggable: '200px' },
                location: { top: '0px', left: '220px' },
                marketing_config: { metric: 'conversions', data_source: 'marketing_hub', show_delta: true, format: 'number', comparison_period: 'prior_period' },
            },
            {
                chart_type: 'kpi_scorecard',
                label: 'ROAS',
                dimensions: { width: '200px', height: '200px', widthDraggable: '200px', heightDraggable: '200px' },
                location: { top: '0px', left: '440px' },
                marketing_config: { metric: 'roas', data_source: 'marketing_hub', show_delta: true, format: 'multiplier', comparison_period: 'prior_period' },
            },
            {
                chart_type: 'kpi_scorecard',
                label: 'CPA',
                dimensions: { width: '200px', height: '200px', widthDraggable: '200px', heightDraggable: '200px' },
                location: { top: '0px', left: '660px' },
                marketing_config: { metric: 'spend', data_source: 'marketing_hub', show_delta: true, format: 'currency', comparison_period: 'prior_period' },
            },
            {
                chart_type: 'kpi_scorecard',
                label: 'CTR',
                dimensions: { width: '200px', height: '200px', widthDraggable: '200px', heightDraggable: '200px' },
                location: { top: '220px', left: '0px' },
                marketing_config: { metric: 'spend', data_source: 'marketing_hub', show_delta: true, format: 'percent', comparison_period: 'prior_period' },
            },
            {
                chart_type: 'kpi_scorecard',
                label: 'Impressions',
                dimensions: { width: '200px', height: '200px', widthDraggable: '200px', heightDraggable: '200px' },
                location: { top: '220px', left: '220px' },
                marketing_config: { metric: 'impressions', data_source: 'marketing_hub', show_delta: true, format: 'number', comparison_period: 'prior_period' },
            },
            {
                chart_type: 'multiline',
                label: 'Spend & Conversions Trend',
                dimensions: { width: '400px', height: '300px', widthDraggable: '440px', heightDraggable: '300px' },
                location: { top: '440px', left: '0px' },
                column_hints: ['date', 'spend', 'conversions'],
            },
            {
                chart_type: 'multiline',
                label: 'ROAS Trend',
                dimensions: { width: '400px', height: '300px', widthDraggable: '440px', heightDraggable: '300px' },
                location: { top: '440px', left: '460px' },
                column_hints: ['date', 'roas', 'revenue'],
            },
            {
                chart_type: 'channel_comparison_table',
                label: 'Channel Split',
                dimensions: { width: '350px', height: '300px', widthDraggable: '900px', heightDraggable: '300px' },
                location: { top: '760px', left: '0px' },
                marketing_config: { columns: ['spend', 'impressions', 'clicks', 'ctr', 'conversions', 'cpl', 'roas'], sort_by: 'spend' },
                column_hints: ['channel', 'platform', 'source'],
            },
        ],
    },
    {
        id: 'campaign_manager',
        name: 'Campaign Manager',
        description: 'Day-to-day campaign optimization — campaign performance table, daily trends, and anomaly alerts.',
        best_for: 'Day-to-day optimization',
        icon: 'bullseye',
        color: '#10B981',
        widgets: [
            {
                chart_type: 'kpi_scorecard',
                label: 'Total Spend',
                dimensions: { width: '200px', height: '200px', widthDraggable: '200px', heightDraggable: '200px' },
                location: { top: '0px', left: '0px' },
                marketing_config: { metric: 'spend', data_source: 'marketing_hub', show_delta: true, format: 'currency', comparison_period: 'prior_period' },
            },
            {
                chart_type: 'kpi_scorecard',
                label: 'Avg CPA',
                dimensions: { width: '200px', height: '200px', widthDraggable: '200px', heightDraggable: '200px' },
                location: { top: '0px', left: '220px' },
                marketing_config: { metric: 'spend', data_source: 'marketing_hub', show_delta: true, format: 'currency', comparison_period: 'prior_period' },
            },
            {
                chart_type: 'kpi_scorecard',
                label: 'Total Conversions',
                dimensions: { width: '200px', height: '200px', widthDraggable: '200px', heightDraggable: '200px' },
                location: { top: '0px', left: '440px' },
                marketing_config: { metric: 'conversions', data_source: 'marketing_hub', show_delta: true, format: 'number', comparison_period: 'prior_period' },
            },
            {
                chart_type: 'table',
                label: 'Campaign Performance',
                dimensions: { width: '400px', height: '300px', widthDraggable: '900px', heightDraggable: '400px' },
                location: { top: '220px', left: '0px' },
                column_hints: ['campaign', 'campaign_name', 'spend', 'impressions', 'clicks', 'conversions'],
            },
            {
                chart_type: 'multiline',
                label: 'Daily Spend Trend',
                dimensions: { width: '400px', height: '300px', widthDraggable: '440px', heightDraggable: '300px' },
                location: { top: '640px', left: '0px' },
                column_hints: ['date', 'spend'],
            },
            {
                chart_type: 'multiline',
                label: 'Daily Conversions Trend',
                dimensions: { width: '400px', height: '300px', widthDraggable: '440px', heightDraggable: '300px' },
                location: { top: '640px', left: '460px' },
                column_hints: ['date', 'conversions'],
            },
            {
                chart_type: 'anomaly_alert_card',
                label: 'Anomaly Alerts',
                dimensions: { width: '350px', height: '300px', widthDraggable: '900px', heightDraggable: '250px' },
                location: { top: '960px', left: '0px' },
                marketing_config: { metric: 'spend', threshold_pct: 20, comparison_window: '4_week_avg', alert_direction: 'both' },
            },
        ],
    },
    {
        id: 'channel_comparison',
        name: 'Channel Comparison',
        description: 'Multi-channel side-by-side analysis — compare spend, conversions, and efficiency across all your marketing channels.',
        best_for: 'Multi-channel analysis',
        icon: 'chart-bar',
        color: '#8B5CF6',
        widgets: [
            {
                chart_type: 'kpi_scorecard',
                label: 'Total Spend',
                dimensions: { width: '200px', height: '200px', widthDraggable: '200px', heightDraggable: '200px' },
                location: { top: '0px', left: '0px' },
                marketing_config: { metric: 'spend', data_source: 'marketing_hub', show_delta: true, format: 'currency', comparison_period: 'prior_period' },
            },
            {
                chart_type: 'kpi_scorecard',
                label: 'Blended ROAS',
                dimensions: { width: '200px', height: '200px', widthDraggable: '200px', heightDraggable: '200px' },
                location: { top: '0px', left: '220px' },
                marketing_config: { metric: 'roas', data_source: 'marketing_hub', show_delta: true, format: 'multiplier', comparison_period: 'prior_period' },
            },
            {
                chart_type: 'kpi_scorecard',
                label: 'Blended CPA',
                dimensions: { width: '200px', height: '200px', widthDraggable: '200px', heightDraggable: '200px' },
                location: { top: '0px', left: '440px' },
                marketing_config: { metric: 'spend', data_source: 'marketing_hub', show_delta: true, format: 'currency', comparison_period: 'prior_period' },
            },
            {
                chart_type: 'channel_comparison_table',
                label: 'Channel Comparison',
                dimensions: { width: '350px', height: '300px', widthDraggable: '900px', heightDraggable: '400px' },
                location: { top: '220px', left: '0px' },
                marketing_config: { columns: ['spend', 'impressions', 'clicks', 'ctr', 'conversions', 'cpa', 'roas'], sort_by: 'spend' },
                column_hints: ['channel', 'platform', 'source'],
            },
            {
                chart_type: 'pie',
                label: 'Spend by Channel',
                dimensions: { width: '400px', height: '300px', widthDraggable: '440px', heightDraggable: '350px' },
                location: { top: '640px', left: '0px' },
                column_hints: ['channel', 'platform', 'source', 'spend'],
            },
            {
                chart_type: 'vertical_bar',
                label: 'Conversions by Channel',
                dimensions: { width: '400px', height: '300px', widthDraggable: '440px', heightDraggable: '350px' },
                location: { top: '640px', left: '460px' },
                column_hints: ['channel', 'platform', 'source', 'conversions'],
            },
            {
                chart_type: 'roi_waterfall',
                label: 'ROI by Channel',
                dimensions: { width: '350px', height: '300px', widthDraggable: '900px', heightDraggable: '300px' },
                location: { top: '1010px', left: '0px' },
                marketing_config: { include_offline: false, group_by: 'channel' },
            },
        ],
    },
    {
        id: 'full_funnel',
        name: 'Full Funnel',
        description: 'Lead generation funnel analysis — track the journey from impression to conversion with cost per stage.',
        best_for: 'Lead gen businesses',
        icon: 'filter',
        color: '#F59E0B',
        widgets: [
            {
                chart_type: 'kpi_scorecard',
                label: 'Total Leads',
                dimensions: { width: '200px', height: '200px', widthDraggable: '200px', heightDraggable: '200px' },
                location: { top: '0px', left: '0px' },
                marketing_config: { metric: 'conversions', data_source: 'marketing_hub', show_delta: true, format: 'number', comparison_period: 'prior_period' },
            },
            {
                chart_type: 'kpi_scorecard',
                label: 'Cost per Lead',
                dimensions: { width: '200px', height: '200px', widthDraggable: '200px', heightDraggable: '200px' },
                location: { top: '0px', left: '220px' },
                marketing_config: { metric: 'cpl', data_source: 'marketing_hub', show_delta: true, format: 'currency', comparison_period: 'prior_period' },
            },
            {
                chart_type: 'kpi_scorecard',
                label: 'Conversion Rate',
                dimensions: { width: '200px', height: '200px', widthDraggable: '200px', heightDraggable: '200px' },
                location: { top: '0px', left: '440px' },
                marketing_config: { metric: 'spend', data_source: 'marketing_hub', show_delta: true, format: 'percent', comparison_period: 'prior_period' },
            },
            {
                chart_type: 'funnel_steps',
                label: 'Conversion Funnel',
                dimensions: { width: '400px', height: '300px', widthDraggable: '900px', heightDraggable: '400px' },
                location: { top: '220px', left: '0px' },
                column_hints: ['impressions', 'clicks', 'leads', 'conversions'],
            },
            {
                chart_type: 'multiline',
                label: 'Lead Volume Trend',
                dimensions: { width: '400px', height: '300px', widthDraggable: '440px', heightDraggable: '300px' },
                location: { top: '640px', left: '0px' },
                column_hints: ['date', 'leads', 'conversions'],
            },
            {
                chart_type: 'vertical_bar',
                label: 'Cost per Stage',
                dimensions: { width: '400px', height: '300px', widthDraggable: '440px', heightDraggable: '300px' },
                location: { top: '640px', left: '460px' },
                column_hints: ['channel', 'platform', 'source', 'spend'],
            },
            {
                chart_type: 'journey_sankey',
                label: 'Conversion Paths',
                dimensions: { width: '350px', height: '300px', widthDraggable: '900px', heightDraggable: '350px' },
                location: { top: '960px', left: '0px' },
                marketing_config: { max_paths: 5, min_conversions: 1 },
            },
        ],
    },
    {
        id: 'blank_canvas',
        name: 'Blank Canvas',
        description: 'Start from scratch with an empty dashboard. Add your own charts and widgets as needed.',
        best_for: 'Custom',
        icon: 'paintbrush',
        color: '#6B7280',
        widgets: [],
    },
];

/**
 * Build widget objects for a dashboard from a template definition.
 * Assigns sequential chart_ids and resolves column hints against
 * available data model columns where possible.
 *
 * @param template - The dashboard template to build widgets from
 * @param dataModelColumns - Optional array of available column names from the selected data model
 * @returns Array of widget objects ready to be pushed into dashboard.charts
 */
export function buildWidgetsFromTemplate(
    template: DashboardTemplate,
    dataModelColumns: string[] = [],
): any[] {
    return template.widgets.map((widget, index) => {
        const chart: any = {
            chart_id: index + 1,
            chart_type: widget.chart_type,
            columns: [],
            data: [],
            stack_keys: [],
            line_data: [],
            text_editor: widget.text_editor ?? { content: '' },
            marketing_config: widget.marketing_config ?? undefined,
            config: {
                drag_enabled: false,
                resize_enabled: false,
                add_columns_enabled: false,
            },
            dimensions: { ...widget.dimensions },
            location: { ...widget.location },
        };

        // Resolve column hints: try to match hint patterns against available data model columns
        if (widget.column_hints && widget.column_hints.length > 0 && dataModelColumns.length > 0) {
            const resolvedColumns: any[] = [];
            for (const hint of widget.column_hints) {
                const match = dataModelColumns.find(
                    (col) => col.toLowerCase().includes(hint.toLowerCase()) || hint.toLowerCase().includes(col.toLowerCase()),
                );
                if (match) {
                    resolvedColumns.push({
                        column_name: match,
                        table_name: '',
                        data_type: guessDataType(hint),
                    });
                }
            }
            chart.columns = resolvedColumns;
        }

        return chart;
    });
}

/**
 * Guess a PostgreSQL-like data type from a column name hint.
 */
function guessDataType(hint: string): string {
    const lower = hint.toLowerCase();
    if (['date', 'day', 'week', 'month', 'created_at', 'updated_at'].some((d) => lower.includes(d))) {
        return 'timestamp without time zone';
    }
    if (['spend', 'cost', 'revenue', 'cpc', 'cpa', 'cpl', 'roas', 'ctr', 'impressions', 'clicks', 'conversions', 'leads'].some((m) => lower.includes(m))) {
        return 'numeric';
    }
    return 'character varying';
}
