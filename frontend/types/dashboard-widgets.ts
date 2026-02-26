/**
 * Shared TypeScript interfaces for Marketing KPI Widget Library (Phase 2)
 * Mirrors the backend types in IDashboard.ts so they are also available on the frontend.
 */

export type MarketingMetric =
    | 'spend'
    | 'impressions'
    | 'clicks'
    | 'cpl'
    | 'roas'
    | 'conversions'
    | 'pipeline_value';

export type ComparisonPeriod = 'prior_period' | 'prior_year' | 'prior_month';
export type ValueFormat = 'currency' | 'number' | 'percent' | 'multiplier';
export type GroupBy = 'channel' | 'campaign';
export type AlertDirection = 'both' | 'spike_only' | 'drop_only';
export type ComparisonWindow = '4_week_avg' | 'prior_week';
export type TimeWindow = '30_days' | '60_days' | '90_days' | 'quarter' | 'custom';
export type DateRangeSource = 'dashboard' | 'custom';

export interface IKpiScorecardConfig {
    metric: MarketingMetric;
    data_source: string;
    show_delta: boolean;
    target_value?: number;
    format: ValueFormat;
    comparison_period: ComparisonPeriod;
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
    date_range_source: DateRangeSource;
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
    group_by: GroupBy;
}

export interface ICampaignTimelineConfig {
    show_budget_pacing: boolean;
    show_only_active: boolean;
    time_window: TimeWindow;
}

export interface IAnomalyAlertCardConfig {
    metric: MarketingMetric;
    threshold_pct: number;
    comparison_window: ComparisonWindow;
    alert_direction: AlertDirection;
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
