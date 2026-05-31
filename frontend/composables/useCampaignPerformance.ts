/**
 * useCampaignPerformance — Composable for fetching and managing campaign
 * performance table data from the backend.
 *
 * Calls GET /marketing-metrics/campaigns and provides reactive rows,
 * loading/error state, sorting, filtering, and pagination.
 */
import { useAppFetch } from '@/composables/useAppFetch';
import { baseUrl } from '~/composables/Utils';
import { getAuthToken } from '~/composables/AuthToken';

export interface ICampaignPerformanceRow {
    campaignId: string;
    campaignName: string;
    channel: string;
    spend: number;
    impressions: number;
    clicks: number;
    conversions: number;
    revenue: number;
    ctr: number;
    cpc: number;
    cpa: number;
    roas: number;
    status: 'active' | 'paused' | 'completed';
    dailyTrend: number[];
}

export type CampaignSortKey = 'campaignName' | 'channel' | 'spend' | 'impressions' | 'clicks' | 'conversions' | 'ctr' | 'cpc' | 'cpa' | 'roas';

export interface UseCampaignPerformanceOptions {
    dataModelId?: MaybeRef<number | null>;
    projectId?: MaybeRef<number | null>;
    startDate?: MaybeRef<string | null>;
    endDate?: MaybeRef<string | null>;
    /** Whether to auto-fetch on mount. Defaults to true. */
    immediate?: boolean;
    /** Page size. Defaults to 20. */
    pageSize?: number;
}

export function useCampaignPerformance(options: UseCampaignPerformanceOptions) {
    const {
        dataModelId,
        projectId,
        startDate,
        endDate,
        immediate = true,
        pageSize: defaultPageSize = 20,
    } = options;

    const rows = ref<ICampaignPerformanceRow[]>([]);
    const total = ref(0);
    const isLoading = ref(false);
    const hasFetched = ref(false);
    const error = ref<string | null>(null);

    // Filters
    const search = ref('');
    const channel = ref('');
    const status = ref('');
    const sortBy = ref<CampaignSortKey>('spend');
    const sortDir = ref<'asc' | 'desc'>('desc');
    const page = ref(1);
    const pageSize = ref(defaultPageSize);

    // Debounced search value
    const debouncedSearch = ref('');
    let searchTimer: ReturnType<typeof setTimeout> | null = null;

    watch(search, (val) => {
        if (searchTimer) clearTimeout(searchTimer);
        searchTimer = setTimeout(() => {
            debouncedSearch.value = val;
            page.value = 1; // Reset to first page on search
        }, 300);
    });

    // Reset page when filters change
    watch([channel, status, sortBy, sortDir], () => {
        page.value = 1;
    });

    /**
     * Fetch campaign performance data from the API.
     */
    async function fetch() {
        const dmId = toValue(dataModelId);
        const projId = toValue(projectId);
        const start = toValue(startDate);
        const end = toValue(endDate);

        console.log('[useCampaignPerformance] 🚀 fetch() called:', { projectId: projId, dataModelId: dmId, startDate: start, endDate: end });

        if ((!dmId && !projId) || !start || !end) {
            console.warn('[useCampaignPerformance] ⚠️ Missing required params — clearing rows');
            rows.value = [];
            total.value = 0;
            return;
        }

        isLoading.value = true;
        error.value = null;
        try {
            const token = getAuthToken();
            if (!token) {
                console.warn('[useCampaignPerformance] ⚠️ No auth token available — aborting fetch');
                rows.value = [];
                total.value = 0;
                return;
            }
            const params: Record<string, any> = {};
            if (projId) {
                params.projectId = projId;
            } else {
                params.dataModelId = dmId;
            }
            params.startDate = start;
            params.endDate = end;
            params.search = debouncedSearch.value || undefined;
            params.channel = channel.value || undefined;
            params.status = status.value || undefined;
            params.sortBy = sortBy.value;
            params.sortDir = sortDir.value;
            params.page = page.value;
            params.pageSize = pageSize.value;
            const qs = new URLSearchParams(
                Object.entries(params).filter(([, v]) => v !== undefined).map(([k, v]) => [k, String(v)])
            ).toString();
            const url = `${baseUrl()}/marketing-metrics/campaigns?${qs}`;
            console.log('[useCampaignPerformance] 🌐 Fetching /marketing-metrics/campaigns with:', { url, params });
            const response = await useAppFetch<{
                success: boolean;
                data: ICampaignPerformanceRow[];
                total: number;
            }>(url, {
                headers: {
                    Authorization: `Bearer ${token}`,
                    'Authorization-Type': 'auth',
                },
            });

            console.log('[useCampaignPerformance] ✅ Response received:', {
                success: response?.success,
                dataLength: response?.data?.length,
                total: response?.total,
                firstRow: response?.data?.[0],
            });
            rows.value = response.data || [];
            total.value = response.total || 0;
            hasFetched.value = true;
        } catch (err: any) {
            console.error('[useCampaignPerformance] ❌ Failed to fetch campaigns:', {
                message: err?.message,
                statusCode: err?.statusCode || err?.response?.status,
                data: err?.data || err?.response?._data,
                fullError: err,
            });
            error.value = err?.message || 'Failed to load campaign data';
            rows.value = [];
            total.value = 0;
        } finally {
            isLoading.value = false;
            console.log('[useCampaignPerformance] 🏁 fetch() finished. isLoading:', isLoading.value, '| rows:', rows.value.length, '| total:', total.value, '| hasFetched:', hasFetched.value, '| error:', error.value);
        }
    }

    /**
     * Total pages based on total count and page size.
     */
    const totalPages = computed(() => Math.max(1, Math.ceil(total.value / pageSize.value)));

    /**
     * Whether we have any data to display.
     */
    const hasData = computed(() => rows.value.length > 0);

    /**
     * Reset all filters and pagination.
     */
    function resetFilters() {
        search.value = '';
        debouncedSearch.value = '';
        channel.value = '';
        status.value = '';
        sortBy.value = 'spend';
        sortDir.value = 'desc';
        page.value = 1;
    }

    /**
     * Toggle sort direction or change sort key.
     */
    function toggleSort(key: CampaignSortKey) {
        if (sortBy.value === key) {
            sortDir.value = sortDir.value === 'asc' ? 'desc' : 'asc';
        } else {
            sortBy.value = key;
            sortDir.value = 'desc';
        }
    }

    /**
     * Format a currency value.
     */
    function formatCurrency(value: number): string {
        if (value >= 1_000_000) return `$${(value / 1_000_000).toFixed(1)}M`;
        if (value >= 1_000) return `$${(value / 1_000).toFixed(1)}K`;
        return `$${value.toFixed(2)}`;
    }

    /**
     * Format a compact number.
     */
    function formatNumber(value: number): string {
        if (value >= 1_000_000) return `${(value / 1_000_000).toFixed(1)}M`;
        if (value >= 1_000) return `${(value / 1_000).toFixed(1)}K`;
        return value.toLocaleString();
    }

    /**
     * Format a percentage.
     */
    function formatPercent(value: number): string {
        return `${value.toFixed(2)}%`;
    }

    /**
     * Format a ratio (ROAS).
     */
    function formatRatio(value: number): string {
        return `${value.toFixed(2)}x`;
    }

    // Auto-fetch when dependencies change
    if (immediate) {
        console.log('[useCampaignPerformance] 👀 Setting up auto-fetch watcher (immediate=true)');
        watch(
            [
                () => toValue(projectId) ?? toValue(dataModelId),
                () => toValue(startDate),
                () => toValue(endDate),
                debouncedSearch,
                channel,
                status,
                sortBy,
                sortDir,
                page,
            ],
            (newValues) => {
                console.log('[useCampaignPerformance] 👀 Watcher triggered — deps changed:', newValues);
                fetch();
            },
            { immediate: true },
        );
    }

    return {
        rows,
        total,
        totalPages,
        isLoading,
        hasFetched,
        hasData,
        error,
        search,
        channel,
        status,
        sortBy,
        sortDir,
        page,
        pageSize,
        toggleSort,
        resetFilters,
        fetch,
        formatCurrency,
        formatNumber,
        formatPercent,
        formatRatio,
    };
}