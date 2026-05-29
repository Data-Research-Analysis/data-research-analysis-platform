/**
 * useAnomalyAlerts — Composable for fetching anomaly detection alerts
 * from the backend POST /marketing-metrics/anomalies endpoint.
 *
 * Calls the advanced anomaly detection (MKT-005) and provides reactive
 * alerts, summary, loading/error state, and optional AI enhancement.
 *
 * TICKET MKT-007: Intelligence Hub Overview — Integration
 */
import { useAppFetch } from '@/composables/useAppFetch';
import { baseUrl } from '~/composables/Utils';
import { getAuthToken } from '~/composables/AuthToken';

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

        console.log('[useAnomalyAlerts] 🚀 fetch() called:', { dataModelId: dmId, startDate: start, endDate: end, includeAiEnhancement: toValue(includeAiEnhancement) });

        if (!dmId || !start || !end) {
            console.warn('[useAnomalyAlerts] ⚠️ Missing required params — clearing alerts. Missing:', {
                dataModelId: !dmId ? 'MISSING' : dmId,
                startDate: !start ? 'MISSING' : start,
                endDate: !end ? 'MISSING' : end,
            });
            alerts.value = [];
            return;
        }

        isLoading.value = true;
        error.value = null;
        try {
            const token = getAuthToken();
            if (!token) {
                console.warn('[useAnomalyAlerts] ⚠️ No auth token available — aborting fetch');
                alerts.value = [];
                return;
            }
            const body = {
                data_model_id: dmId,
                date_range: { start, end },
                include_ai_enhancement: toValue(includeAiEnhancement),
            };
            const url = `${baseUrl()}/marketing-metrics/anomalies`;
            console.log('[useAnomalyAlerts] 🌐 POST /marketing-metrics/anomalies with:', { url, body });
            const response = await useAppFetch<{
                success: boolean;
                data: {
                    alerts: IAlert[];
                    summary: IAlertSummary;
                };
            }>(url, {
                method: 'POST',
                body,
                headers: {
                    Authorization: `Bearer ${token}`,
                    'Authorization-Type': 'auth',
                },
            });

            console.log('[useAnomalyAlerts] ✅ Response received:', {
                success: response?.success,
                alertsCount: response?.data?.alerts?.length,
                summary: response?.data?.summary,
                firstAlert: response?.data?.alerts?.[0],
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
            console.error('[useAnomalyAlerts] ❌ Failed to fetch alerts:', {
                message: err?.message,
                statusCode: err?.statusCode || err?.response?.status,
                data: err?.data || err?.response?._data,
                fullError: err,
            });
            error.value = err?.message || 'Failed to load anomaly alerts';
            alerts.value = [];
        } finally {
            isLoading.value = false;
            console.log('[useAnomalyAlerts] 🏁 fetch() finished. isLoading:', isLoading.value, '| alerts:', alerts.value.length, '| hasFetched:', hasFetched.value, '| error:', error.value);
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
        console.log('[useAnomalyAlerts] 👀 Setting up auto-fetch watcher (immediate=true)');
        watch(
            [
                () => toValue(dataModelId),
                () => toValue(startDate),
                () => toValue(endDate),
                () => toValue(refreshCounter),
            ],
            (newValues) => {
                console.log('[useAnomalyAlerts] 👀 Watcher triggered — deps changed:', newValues);
                fetch();
            },
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