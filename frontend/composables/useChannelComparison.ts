/**
 * useChannelComparison — Composable for fetching and managing cross-channel
 * marketing comparison data.
 *
 * Calls the backend GET /marketing-metrics/channels endpoint and returns
 * a sorted, reactive list of IChannelRow items with loading/error state.
 */
import { useAppFetch } from '@/composables/useAppFetch';
import { baseUrl } from '~/composables/Utils';
import { getAuthToken } from '~/composables/AuthToken';

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
    /** Optional daily trend data for sparkline (spend per day) */
    dailyTrend?: number[];
    /** Optional list of top campaigns within this channel */
    topCampaigns?: IChannelTopCampaign[];
}

export interface IChannelTopCampaign {
    campaignId: string;
    campaignName: string;
    spend: number;
    conversions: number;
}

export interface IChannelDelta {
    /** Percentage change as a decimal (e.g. 0.12 = +12%) */
    spend: number | null;
    impressions: number | null;
    clicks: number | null;
    conversions: number | null;
    revenue: number | null;
    ctr: number | null;
    cpc: number | null;
    cpa: number | null;
    roas: number | null;
}

export type ChannelSortKey = 'spend' | 'impressions' | 'clicks' | 'conversions' | 'ctr' | 'cpc' | 'cpa' | 'roas';

export interface UseChannelComparisonOptions {
    dataModelId?: MaybeRef<number | null>;
    startDate?: MaybeRef<string | null>;
    endDate?: MaybeRef<string | null>;
    /** Pre-loaded channel row data. When provided, the composable uses this
     *  instead of fetching from the API. Useful for components that already
     *  have channel data (e.g. from a parent summary response). */
    channelData?: MaybeRef<IChannelRow[]>;
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
        channelData,
        defaultSortBy = 'spend',
        defaultSortDir = 'desc',
        immediate = true,
    } = options;

    const rawChannels = ref<IChannelRow[]>([]);
    const isLoading = ref(false);
    const hasFetched = ref(false);

    // When channelData is provided (pre-loaded), sync it reactively
    if (channelData) {
        console.log('[useChannelComparison] 📦 channelData provided — will use pre-loaded data instead of API');
        watch(
            () => toValue(channelData),
            (newData) => {
                console.log('[useChannelComparison] 📦 channelData updated:', { length: newData?.length, data: newData });
                rawChannels.value = newData ?? [];
                hasFetched.value = true;
            },
            { immediate: true },
        );
    }

    const sortBy = ref<ChannelSortKey>(defaultSortBy);
    const sortDir = ref<'asc' | 'desc'>(defaultSortDir);

    /**
     * Fetch channel comparison data from the API.
     */
    async function fetch() {
        const dmId = toValue(dataModelId);
        const start = toValue(startDate);
        const end = toValue(endDate);

        console.log('[useChannelComparison] 🚀 fetch() called:', { dataModelId: dmId, startDate: start, endDate: end });

        if (!dmId || !start || !end) {
            console.warn('[useChannelComparison] ⚠️ Missing required params — clearing channels. Missing:', {
                dataModelId: !dmId ? 'MISSING' : dmId,
                startDate: !start ? 'MISSING' : start,
                endDate: !end ? 'MISSING' : end,
            });
            rawChannels.value = [];
            return;
        }

        isLoading.value = true;
        try {
            const token = getAuthToken();
            if (!token) {
                console.warn('[useChannelComparison] ⚠️ No auth token available — aborting fetch');
                rawChannels.value = [];
                return;
            }
            const qs = new URLSearchParams({
                dataModelId: String(dmId),
                startDate: start,
                endDate: end,
            }).toString();
            const url = `${baseUrl()}/marketing-metrics/channels?${qs}`;
            console.log('[useChannelComparison] 🌐 Fetching /marketing-metrics/channels with:', { url, dataModelId: dmId, startDate: start, endDate: end });
            const response = await useAppFetch<{
                success: boolean;
                data: IChannelRow[];
            }>(url, {
                headers: {
                    Authorization: `Bearer ${token}`,
                    'Authorization-Type': 'auth',
                },
            });

            console.log('[useChannelComparison] ✅ Response received:', {
                success: response?.success,
                dataLength: response?.data?.length,
                data: response?.data,
            });
            rawChannels.value = response.data || [];
            hasFetched.value = true;
        } catch (err: any) {
            console.error('[useChannelComparison] ❌ Failed to fetch channels:', {
                message: err?.message,
                statusCode: err?.statusCode || err?.response?.status,
                data: err?.data || err?.response?._data,
                fullError: err,
            });
            rawChannels.value = [];
        } finally {
            isLoading.value = false;
            console.log('[UseChannelComparison] 🏁 fetch() finished. isLoading:', isLoading.value, '| channels count:', rawChannels.value.length, '| hasFetched:', hasFetched.value);
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

    /**
     * Calculate percentage delta between current and prior values.
     * Returns null if prior is 0 (division by zero).
     */
    function calcDelta(current: number, prior: number): number | null {
        if (prior === 0) return null;
        return (current - prior) / prior;
    }

    /**
     * Compute deltas between current and prior period channel data.
     * Returns a Map keyed by channel name.
     */
    function computeDeltas(
        current: IChannelRow[],
        prior: IChannelRow[],
    ): Map<string, IChannelDelta> {
        const priorMap = new Map(prior.map(ch => [ch.channel, ch]));
        const deltas = new Map<string, IChannelDelta>();

        for (const cur of current) {
            const prev = priorMap.get(cur.channel);
            if (!prev) {
                deltas.set(cur.channel, {
                    spend: null, impressions: null, clicks: null,
                    conversions: null, revenue: null, ctr: null,
                    cpc: null, cpa: null, roas: null,
                });
                continue;
            }
            deltas.set(cur.channel, {
                spend: calcDelta(cur.spend, prev.spend),
                impressions: calcDelta(cur.impressions, prev.impressions),
                clicks: calcDelta(cur.clicks, prev.clicks),
                conversions: calcDelta(cur.conversions, prev.conversions),
                revenue: calcDelta(cur.revenue, prev.revenue),
                ctr: calcDelta(cur.ctr, prev.ctr),
                cpc: calcDelta(cur.cpc, prev.cpc),
                cpa: calcDelta(cur.cpa, prev.cpa),
                roas: calcDelta(cur.roas, prev.roas),
            });
        }

        return deltas;
    }

    /**
     * Format a delta as a signed percentage string (e.g. "+12.3%" or "-4.5%").
     */
    function formatDelta(value: number | null): string {
        if (value === null) return '—';
        const sign = value >= 0 ? '+' : '';
        return `${sign}${(value * 100).toFixed(1)}%`;
    }

    /**
     * Get the CSS class for a delta badge (green for positive, red for negative).
     * For metrics where lower is better (CPA, CPC), the polarity is inverted.
     */
    function deltaClass(value: number | null, metric: ChannelSortKey): string {
        if (value === null) return 'text-gray-400';
        const inverted = metric === 'cpa' || metric === 'cpc';
        const isPositive = inverted ? value < 0 : value > 0;
        return isPositive ? 'text-emerald-600 bg-emerald-50' : value === 0 ? 'text-gray-500 bg-gray-50' : 'text-red-600 bg-red-50';
    }

    // Auto-fetch when dependencies change
    if (immediate) {
        console.log('[useChannelComparison] 👀 Setting up auto-fetch watcher (immediate=true)');
        watch(
            [() => toValue(dataModelId), () => toValue(startDate), () => toValue(endDate)],
            (newValues) => {
                console.log('[useChannelComparison] 👀 Watcher triggered — deps changed:', newValues);
                fetch();
            },
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
        computeDeltas,
        formatDelta,
        deltaClass,
        calcDelta,
    };
}