/**
 * useChannelComparison — Composable for fetching and managing cross-channel
 * marketing comparison data.
 *
 * Calls the backend GET /marketing-metrics/channels endpoint and returns
 * a sorted, reactive list of IChannelRow items with loading/error state.
 */

export interface IChannelRow {
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
}

export type ChannelSortKey = 'spend' | 'impressions' | 'clicks' | 'conversions' | 'ctr' | 'cpc' | 'cpa' | 'roas';

export interface UseChannelComparisonOptions {
    dataModelId: MaybeRef<number | null>;
    startDate: MaybeRef<string | null>;
    endDate: MaybeRef<string | null>;
    /** Default sort column. Defaults to 'spend'. */
    defaultSortBy?: ChannelSortKey;
    /** Default sort direction. Defaults to 'desc'. */
    defaultSortDir?: 'asc' | 'desc';
    /** Whether to auto-fetch on mount. Defaults to true. */
    immediate?: boolean;
}

export function useChannelComparison(options: UseChannelComparisonOptions) {
    const {
        dataModelId,
        startDate,
        endDate,
        defaultSortBy = 'spend',
        defaultSortDir = 'desc',
        immediate = true,
    } = options;

    const rawChannels = ref<IChannelRow[]>([]);
    const isLoading = ref(false);
    const hasFetched = ref(false);

    const sortBy = ref<ChannelSortKey>(defaultSortBy);
    const sortDir = ref<'asc' | 'desc'>(defaultSortDir);

    /**
     * Fetch channel comparison data from the API.
     */
    async function fetch() {
        const dmId = toValue(dataModelId);
        const start = toValue(startDate);
        const end = toValue(endDate);

        if (!dmId || !start || !end) {
            rawChannels.value = [];
            return;
        }

        isLoading.value = true;
        try {
            const { $api } = useNuxtApp();
            const response = await $api<{
                success: boolean;
                data: IChannelRow[];
            }>('/marketing-metrics/channels', {
                params: {
                    dataModelId: dmId,
                    startDate: start,
                    endDate: end,
                },
            });

            rawChannels.value = response.data || [];
            hasFetched.value = true;
        } catch (err) {
            console.error('[useChannelComparison] Failed to fetch channels:', err);
            rawChannels.value = [];
        } finally {
            isLoading.value = false;
        }
    }

    /**
     * Sorted channels based on current sort key and direction.
     */
    const sortedChannels = computed(() => {
        const channels = [...rawChannels.value];
        const key = sortBy.value;
        const dir = sortDir.value === 'asc' ? 1 : -1;

        return channels.sort((a, b) => {
            const aVal = a[key] ?? 0;
            const bVal = b[key] ?? 0;
            return (aVal - bVal) * dir;
        });
    });

    /**
     * Totals row (computed aggregation across all channels).
     */
    const totals = computed((): IChannelRow => {
        const all = rawChannels.value;
        if (all.length === 0) {
            return {
                channel: 'Total',
                spend: 0,
                impressions: 0,
                clicks: 0,
                conversions: 0,
                revenue: 0,
                ctr: 0,
                cpc: 0,
                cpa: 0,
                roas: 0,
            };
        }

        const totalSpend = all.reduce((sum, ch) => sum + ch.spend, 0);
        const totalImpressions = all.reduce((sum, ch) => sum + ch.impressions, 0);
        const totalClicks = all.reduce((sum, ch) => sum + ch.clicks, 0);
        const totalConversions = all.reduce((sum, ch) => sum + ch.conversions, 0);
        const totalRevenue = all.reduce((sum, ch) => sum + ch.revenue, 0);

        return {
            channel: 'Total',
            spend: totalSpend,
            impressions: totalImpressions,
            clicks: totalClicks,
            conversions: totalConversions,
            revenue: totalRevenue,
            ctr: totalImpressions > 0 ? (totalClicks / totalImpressions) * 100 : 0,
            cpc: totalClicks > 0 ? totalSpend / totalClicks : 0,
            cpa: totalConversions > 0 ? totalSpend / totalConversions : 0,
            roas: totalSpend > 0 ? totalRevenue / totalSpend : 0,
        };
    });

    /**
     * Whether we have any data to display.
     */
    const hasData = computed(() => rawChannels.value.length > 0);

    /**
     * Toggle sort direction or change sort key.
     */
    function toggleSort(key: ChannelSortKey) {
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
            [() => toValue(dataModelId), () => toValue(startDate), () => toValue(endDate)],
            () => { fetch(); },
            { immediate: true },
        );
    }

    return {
        sortedChannels,
        totals,
        isLoading,
        hasFetched,
        hasData,
        sortBy,
        sortDir,
        toggleSort,
        fetch,
        formatCurrency,
        formatNumber,
        formatPercent,
        formatRatio,
    };
}