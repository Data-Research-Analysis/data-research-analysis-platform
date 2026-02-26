import { IColumn } from "./IColumn.js";
import { IDashboardData } from "./IDashboardData.js";
import { IDimension } from "./IDimension.js";
import { ILocation } from "./ILocation.js";

/**
 * All supported chart/widget type keys.
 * General-purpose BI types + 8 marketing-native widget types.
 */
export type ChartType =
    // General-purpose BI chart types
    | 'table'
    | 'text_block'
    | 'pie'
    | 'donut'
    | 'vertical_bar'
    | 'horizontal_bar'
    | 'vertical_bar_line'
    | 'stacked_bar'
    | 'multiline'
    | 'treemap'
    | 'bubble'
    // Marketing-native widget types (Phase 2: Marketing KPI Widget Library)
    | 'kpi_scorecard'
    | 'budget_gauge'
    | 'channel_comparison_table'
    | 'funnel_steps'
    | 'journey_sankey'
    | 'roi_waterfall'
    | 'campaign_timeline'
    | 'anomaly_alert_card';

/**
 * Widget config for marketing widget types.
 * Stored in the chart's `marketing_config` field (JSONB).
 */
export interface IKpiScorecardConfig {
    metric: 'spend' | 'impressions' | 'clicks' | 'cpl' | 'roas' | 'conversions' | 'pipeline_value';
    data_source: string;
    show_delta: boolean;
    target_value?: number;
    format: 'currency' | 'number' | 'percent' | 'multiplier';
    comparison_period: 'prior_period' | 'prior_year' | 'prior_month';
    campaign_id?: string;
}

export interface IBudgetGaugeConfig {
    campaign_id: string;
    show_daily_pace: boolean;
    thresholds: { warning: number; danger: number };
}

export interface IChannelComparisonTableConfig {
    project_id?: string;
    campaign_id?: string;
    columns: string[];
    sort_by: string;
}

export interface IFunnelStepsConfig {
    funnel_config: { step_name: string; event_name: string }[];
    date_range_source: 'dashboard' | 'custom';
    campaign_id?: string;
}

export interface IJourneySankeyConfig {
    max_paths: 5 | 10;
    min_conversions: number;
    campaign_id?: string;
}

export interface IRoiWaterfallConfig {
    campaign_id?: string;
    include_offline: boolean;
    group_by: 'channel' | 'campaign';
}

export interface ICampaignTimelineConfig {
    show_budget_pacing: boolean;
    show_only_active: boolean;
    time_window: '30_days' | '60_days' | '90_days' | 'quarter' | 'custom';
}

export interface IAnomalyAlertCardConfig {
    metric: 'spend' | 'impressions' | 'clicks' | 'cpl' | 'roas' | 'conversions' | 'pipeline_value';
    threshold_pct: number;
    comparison_window: '4_week_avg' | 'prior_week';
    alert_direction: 'both' | 'spike_only' | 'drop_only';
    campaign_id?: string;
}

export type MarketingWidgetConfig =
    | IKpiScorecardConfig
    | IBudgetGaugeConfig
    | IChannelComparisonTableConfig
    | IFunnelStepsConfig
    | IJourneySankeyConfig
    | IRoiWaterfallConfig
    | ICampaignTimelineConfig
    | IAnomalyAlertCardConfig;

/**
 * Represents a single chart within a dashboard
 */
export interface IDashboardChart {
    chart_id: number;
    chart_type: ChartType | string;
    columns: IColumn[];
    data: IDashboardData[] | any[]; // Can be various data formats depending on chart type
    dimensions: IDimension;
    location: ILocation;
    x_axis_label?: string;
    y_axis_label?: string;
    stack_keys?: string[];
    line_data?: any;
    /** Config block for marketing-native widget types */
    marketing_config?: MarketingWidgetConfig;
    text_editor?: { content: string };
}

/**
 * Represents the data structure stored in the dashboard's data JSONB field
 * Contains an array of charts and their configurations
 */
export interface IDashboardDataStructure {
    charts: IDashboardChart[];
}

// For backward compatibility during transition
export type IDashboard = IDashboardDataStructure;