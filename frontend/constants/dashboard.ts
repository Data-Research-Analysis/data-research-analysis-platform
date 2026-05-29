/**
 * Shared dashboard constants used across create, edit, and view pages.
 * Single source of truth for chart type metadata.
 */

/** Map of chart type → placeholder image path */
export const CHART_PLACEHOLDERS: Record<string, string> = {
    table: '/assets/images/chart-placeholders/table.png',
    text_block: '/assets/images/chart-placeholders/text_block.png',
    pie: '/assets/images/chart-placeholders/pie.png',
    donut: '/assets/images/chart-placeholders/donut.png',
    vertical_bar: '/assets/images/chart-placeholders/vertical_bar.png',
    horizontal_bar: '/assets/images/chart-placeholders/horizontal_bar.png',
    vertical_bar_line: '/assets/images/chart-placeholders/vertical_bar_line.png',
    stacked_bar: '/assets/images/chart-placeholders/stacked_bar.png',
    multiline: '/assets/images/chart-placeholders/multiline.png',
    treemap: '/assets/images/chart-placeholders/treemap.png',
    bubble: '/assets/images/chart-placeholders/bubble.png',
    funnel_steps: '/assets/images/chart-placeholders/funnel_steps.jpg',
    kpi_scorecard: '/assets/images/chart-placeholders/table.png',
    budget_gauge: '/assets/images/chart-placeholders/donut.png',
    channel_comparison_table: '/assets/images/chart-placeholders/table.png',
    journey_sankey: '/assets/images/chart-placeholders/multiline.png',
    roi_waterfall: '/assets/images/chart-placeholders/horizontal_bar.png',
    campaign_timeline: '/assets/images/chart-placeholders/stacked_bar.png',
    anomaly_alert_card: '/assets/images/chart-placeholders/multiline.png',
};

/** Map of chart type → human-readable label */
export const CHART_TYPE_LABELS: Record<string, string> = {
    table: 'Table',
    text_block: 'Text Block',
    pie: 'Pie Chart',
    donut: 'Donut Chart',
    vertical_bar: 'Bar Chart',
    horizontal_bar: 'Horizontal Bar Chart',
    vertical_bar_line: 'Combo Chart',
    stacked_bar: 'Stacked Bar Chart',
    multiline: 'Line Chart',
    treemap: 'Treemap',
    bubble: 'Bubble Chart',
    kpi_scorecard: 'KPI Scorecard',
    budget_gauge: 'Budget Gauge',
    channel_comparison_table: 'Channel Comparison',
    funnel_steps: 'Funnel Steps',
    journey_sankey: 'Journey Sankey',
    roi_waterfall: 'ROI Waterfall',
    campaign_timeline: 'Campaign Timeline',
    anomaly_alert_card: 'Anomaly Alert',
};

/** Marketing widget types that don't use the data-model column mechanism */
export const MARKETING_WIDGET_TYPES: string[] = [
    'kpi_scorecard',
    'budget_gauge',
    'channel_comparison_table',
    'journey_sankey',
    'roi_waterfall',
    'campaign_timeline',
    'anomaly_alert_card',
];

/** Default marketing widget configurations keyed by chart type */
export const DEFAULT_MARKETING_CONFIGS: Record<string, Record<string, any>> = {
    kpi_scorecard: { metric: 'spend', data_source: 'marketing_hub', show_delta: true, format: 'currency', comparison_period: 'prior_period' },
    budget_gauge: { campaign_id: '', show_daily_pace: true, thresholds: { warning: 80, danger: 95 } },
    channel_comparison_table: { columns: ['spend', 'impressions', 'clicks', 'ctr', 'conversions', 'cpl', 'roas'], sort_by: 'spend' },
    journey_sankey: { max_paths: 5, min_conversions: 1 },
    roi_waterfall: { include_offline: false, group_by: 'channel' },
    campaign_timeline: { show_budget_pacing: true, show_only_active: false, time_window: '30_days' },
    anomaly_alert_card: { metric: 'spend', threshold_pct: 20, comparison_window: '4_week_avg', alert_direction: 'both' },
};
