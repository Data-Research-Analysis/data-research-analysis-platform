/**
 * useCampaignPerformance — Composable for fetching and managing campaign
 * performance table data from the backend.
 *
 * Calls GET /marketing-metrics/campaigns and provides reactive rows,
 * loading/error state, sorting, filtering, and pagination.
 */

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
        const start = toValue(startDate);
        const end = toValue(endDate);

        if (!dmId || !start || !end) {
            rows.value = [];
            total.value = 0;
            return;
        }

        isLoading.value = true;
        error.value = null;
        try {
            const { $api } = useNuxtApp();
            const response = await $api<{
                success: boolean;
                data: ICampaignPerformanceRow[];
                total: number;
            }>('/marketing-metrics/campaigns', {
                params: {
                    dataModelId: dmId,
                    startDate: start,
                    endDate: end,
                    search: debouncedSearch.value || undefined,
                    channel: channel.value || undefined,
                    status: status.value || undefined,
                    sortBy: sortBy.value,
                    sortDir: sortDir.value,
                    page: page.value,
                    pageSize: pageSize.value,
                },
            });

            rows.value = response.data || [];
            total.value = response.total || 0;
            hasFetched.value = true;
        } catch (err: any) {
            console.error('[useCampaignPerformance] Failed to fetch campaigns:', err);
            error.value = err?.message || 'Failed to load campaign data';
            rows.value = [];
            total.value = 0;
        } finally {
            isLoading.value = false;
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
        watch(
            [
                () => toValue(dataModelId),
                () => toValue(startDate),
                () => toValue(endDate),
                debouncedSearch,
                channel,
                status,
                sortBy,
                sortDir,
                page,
            ],
            () => { fetch(); },
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