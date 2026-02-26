/**
 * useWidgetData — fetches live data for Phase 2 Marketing KPI widgets.
 * Each widget type maps to a dedicated /marketing/widget/:type/:projectId endpoint.
 */

import { ref, watch, type Ref, type ComputedRef } from 'vue';

type MaybeRef<T> = Ref<T> | ComputedRef<T>;

const WIDGET_ENDPOINTS: Record<string, string> = {
    kpi_scorecard: 'kpi-scorecard',
    budget_gauge: 'budget-gauge',
    channel_comparison_table: 'channel-comparison',
    journey_sankey: 'journey-sankey',
    roi_waterfall: 'roi-waterfall',
    campaign_timeline: 'campaign-timeline',
    anomaly_alert_card: 'anomaly-alert',
};

function buildQueryParams(chartType: string, config: Record<string, any>, dateRange: { startDate?: string; endDate?: string }): Record<string, any> {
    const params: Record<string, any> = {};

    if (dateRange.startDate) params.startDate = dateRange.startDate;
    if (dateRange.endDate) params.endDate = dateRange.endDate;

    switch (chartType) {
        case 'kpi_scorecard':
            if (config.metric) params.metric = config.metric;
            if (config.comparison_period) params.comparisonPeriod = config.comparison_period;
            break;
        case 'budget_gauge':
            if (config.campaign_id) params.campaignId = config.campaign_id;
            break;
        case 'channel_comparison_table':
            if (config.campaign_id) params.campaignId = config.campaign_id;
            break;
        case 'journey_sankey':
            if (config.max_paths) params.maxPaths = config.max_paths;
            if (config.campaign_id) params.campaignId = config.campaign_id;
            break;
        case 'roi_waterfall':
            if (config.group_by) params.groupBy = config.group_by;
            if (config.include_offline !== undefined) params.includeOffline = config.include_offline;
            if (config.campaign_id) params.campaignId = config.campaign_id;
            break;
        case 'campaign_timeline':
            if (config.show_only_active !== undefined) params.showOnlyActive = config.show_only_active;
            if (config.time_window) params.timeWindow = config.time_window;
            break;
        case 'anomaly_alert_card':
            if (config.metric) params.metric = config.metric;
            if (config.threshold_pct !== undefined) params.thresholdPct = config.threshold_pct;
            if (config.comparison_window) params.comparisonWindow = config.comparison_window;
            if (config.alert_direction) params.alertDirection = config.alert_direction;
            if (config.campaign_id) params.campaignId = config.campaign_id;
            break;
    }

    return params;
}

function defaultDateRange(): { startDate: string; endDate: string } {
    const end = new Date();
    const start = new Date(end.getTime() - 30 * 86_400_000);
    return {
        startDate: start.toISOString().split('T')[0],
        endDate: end.toISOString().split('T')[0],
    };
}

export function useWidgetData<T = any>(
    chartType: string,
    projectId: MaybeRef<number>,
    config: MaybeRef<Record<string, any>>,
    dateRange?: MaybeRef<{ startDate?: string; endDate?: string }>,
) {
    const data = ref<T | null>(null);
    const isLoading = ref(true);
    const error = ref<string | null>(null);

    const runtimeConfig = useRuntimeConfig();

    async function fetchData() {
        const endpoint = WIDGET_ENDPOINTS[chartType];
        if (!endpoint) return;

        const pid = typeof projectId === 'object' && 'value' in projectId ? projectId.value : projectId;
        if (!pid) return;

        const cfg = typeof config === 'object' && 'value' in config ? config.value : config;
        const dr = dateRange
            ? (typeof dateRange === 'object' && 'value' in dateRange ? dateRange.value : dateRange)
            : defaultDateRange();

        const queryParams = buildQueryParams(chartType, cfg ?? {}, { ...defaultDateRange(), ...dr });
        const queryString = new URLSearchParams(
            Object.entries(queryParams)
                .filter(([, v]) => v !== undefined && v !== null)
                .map(([k, v]) => [k, String(v)])
        ).toString();

        const url = `${runtimeConfig.public.apiBase}/marketing/widget/${endpoint}/${pid}${queryString ? `?${queryString}` : ''}`;

        isLoading.value = true;
        error.value = null;

        try {
            const response = await $fetch<{ success: boolean; data: T; error?: string }>(url, {
                credentials: 'include',
            });
            if (response.success) {
                data.value = response.data;
            } else {
                error.value = response.error ?? 'Unknown error';
            }
        } catch (err: any) {
            error.value = err?.message ?? 'Failed to fetch widget data';
        } finally {
            isLoading.value = false;
        }
    }

    if (import.meta.client) {
        onMounted(fetchData);
        watch(
            [
                typeof projectId === 'object' && 'value' in projectId ? projectId : ref(projectId),
                typeof config === 'object' && 'value' in config ? config : ref(config),
            ],
            fetchData,
            { deep: true },
        );
    }

    return { data, isLoading, error, refresh: fetchData };
}
