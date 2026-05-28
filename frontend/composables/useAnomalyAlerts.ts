/**
 * useAnomalyAlerts — Composable for fetching anomaly detection alerts
 * from the backend POST /marketing-metrics/anomalies endpoint.
 *
 * Calls the advanced anomaly detection (MKT-005) and provides reactive
 * alerts, summary, loading/error state, and optional AI enhancement.
 *
 * TICKET MKT-007: Intelligence Hub Overview — Integration
 */

export type AlertSeverity = 'critical' | 'warning' | 'info';
export type AlertType = 'anomaly' | 'performance' | 'budget';

export interface IAlert {
    id: string;
    severity: AlertSeverity;
    type: AlertType;
    metric: string;
    message: string;
    suggestedAction: string;
    currentValue: number;
    expectedValue: number;
    deviationPercent: number;
    campaignContext?: string;
    channelContext?: string;
    date?: string;
    createdAt?: string;
}

export interface IAlertSummary {
    total: number;
    critical: number;
    warning: number;
    info: number;
    byType: {
        anomaly: number;
        performance: number;
        budget: number;
    };
}

export interface UseAnomalyAlertsOptions {
    dataModelId?: MaybeRef<number | null>;
    startDate?: MaybeRef<string | null>;
    endDate?: MaybeRef<string | null>;
    /** Whether to auto-fetch on mount. Defaults to true. */
    immediate?: boolean;
    /** Whether to include AI enhancement from Gemini. Defaults to false. */
    includeAiEnhancement?: MaybeRef<boolean>;
    /** Refresh counter — incrementing triggers a re-fetch. */
    refreshCounter?: MaybeRef<number>;
}

export function useAnomalyAlerts(options: UseAnomalyAlertsOptions) {
    const {
        dataModelId,
        startDate,
        endDate,
        immediate = true,
        includeAiEnhancement = ref(false),
        refreshCounter = ref(0),
    } = options;

    const alerts = ref<IAlert[]>([]);
    const summary = ref<IAlertSummary>({
        total: 0,
        critical: 0,
        warning: 0,
        info: 0,
        byType: { anomaly: 0, performance: 0, budget: 0 },
    });
    const isLoading = ref(false);
    const hasFetched = ref(false);
    const error = ref<string | null>(null);

    /**
     * Fetch anomaly alerts from the API.
     */
    async function fetch() {
        const dmId = toValue(dataModelId);
        const start = toValue(startDate);
        const end = toValue(endDate);

        if (!dmId || !start || !end) {
            alerts.value = [];
            return;
        }

        isLoading.value = true;
        error.value = null;
        try {
            const { $api } = useNuxtApp();
            const response = await $api<{
                success: boolean;
                data: {
                    alerts: IAlert[];
                    summary: IAlertSummary;
                };
            }>('/marketing-metrics/anomalies', {
                method: 'POST',
                body: {
                    data_model_id: dmId,
                    date_range: { start, end },
                    include_ai_enhancement: toValue(includeAiEnhancement),
                },
            });

            alerts.value = response.data?.alerts || [];
            summary.value = response.data?.summary || {
                total: 0,
                critical: 0,
                warning: 0,
                info: 0,
                byType: { anomaly: 0, performance: 0, budget: 0 },
            };
            hasFetched.value = true;
        } catch (err: any) {
            console.error('[useAnomalyAlerts] Failed to fetch alerts:', err);
            error.value = err?.message || 'Failed to load anomaly alerts';
            alerts.value = [];
        } finally {
            isLoading.value = false;
        }
    }

    /** Whether we have any alerts to display. */
    const hasAlerts = computed(() => alerts.value.length > 0);

    /** Alerts sorted by severity (critical first). */
    const sortedAlerts = computed(() => {
        const severityOrder: Record<AlertSeverity, number> = {
            critical: 0,
            warning: 1,
            info: 2,
        };
        return [...alerts.value].sort(
            (a, b) => severityOrder[a.severity] - severityOrder[b.severity],
        );
    });

    /**
     * Format a currency value.
     */
    function formatCurrency(value: number): string {
        if (value >= 1_000_000) return `$${(value / 1_000_000).toFixed(1)}M`;
        if (value >= 1_000) return `$${(value / 1_000).toFixed(1)}K`;
        return `$${value.toFixed(2)}`;
    }

    /**
     * Format a percentage.
     */
    function formatPercent(value: number): string {
        return `${value.toFixed(1)}%`;
    }

    // Auto-fetch when dependencies change
    if (immediate) {
        watch(
            [
                () => toValue(dataModelId),
                () => toValue(startDate),
                () => toValue(endDate),
                () => toValue(refreshCounter),
            ],
            () => { fetch(); },
            { immediate: true },
        );
    }

    return {
        alerts,
        sortedAlerts,
        summary,
        isLoading,
        hasFetched,
        hasAlerts,
        error,
        fetch,
        formatCurrency,
        formatPercent,
    };
}