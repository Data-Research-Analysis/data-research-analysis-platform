/**
 * useBudgetOptimization — Composable for the AI-powered Budget Allocation
 * Optimizer (CMP-005).
 *
 * Calls the backend POST /marketing-metrics/budget-optimize endpoint and
 * provides reactive state for current vs recommended allocation, estimated
 * impact, daily pacing, and AI explanation.
 */
import { useAppFetch } from '@/composables/useAppFetch';
import { baseUrl } from '~/composables/Utils';
import { getAuthToken } from '~/composables/AuthToken';

// ---------------------------------------------------------------------------
// Types (mirrors backend BudgetOptimizationService response)
// ---------------------------------------------------------------------------

export type OptimizationGoal = 'maximize_conversions' | 'minimize_cpa' | 'maximize_roas';

export interface IChannelAllocation {
    channel: string;
    current_spend: number;
    current_roas: number;
    current_cpa: number;
    current_conversions: number;
    current_revenue: number;
    efficiency_score: number;
}

export interface IRecommendedChannel {
    channel: string;
    recommended_spend: number;
    recommended_conversions: number;
    recommended_cpa: number;
    recommended_roas: number;
    change_from_current: number;
    change_percent: number;
}

export interface IEstimatedImpact {
    additional_conversions: number;
    cpa_change: number;
    roas_change: number;
    shift_summary: string;
}

export interface IDailyPacing {
    date: string;
    actual_spend: number;
    recommended_spend: number;
    variance: number;
    variance_percent: number;
    status: 'on_track' | 'overspend' | 'underspend';
}

export interface IBudgetOptimizeResponse {
    optimization_goal: OptimizationGoal;
    total_budget: number;
    current_allocation: IChannelAllocation[];
    recommended_allocation: IRecommendedChannel[];
    estimated_impact: IEstimatedImpact;
    reasoning: string;
    ai_explanation?: string;
    daily_pacing: IDailyPacing[];
    constraints_applied: string[];
}

export interface UseBudgetOptimizationOptions {
    dataModelId?: MaybeRef<number | null>;
    startDate?: MaybeRef<string | null>;
    endDate?: MaybeRef<string | null>;
}

// ---------------------------------------------------------------------------
// Composable
// ---------------------------------------------------------------------------

export function useBudgetOptimization(options: UseBudgetOptimizationOptions) {
    const { dataModelId, startDate, endDate } = options;

    // Reactive state --------------------------------------------------------
    const result = ref<IBudgetOptimizeResponse | null>(null);
    const isLoading = ref(false);
    const hasFetched = ref(false);
    const error = ref<string | null>(null);

    // User-adjustable parameters -------------------------------------------
    const totalBudget = ref<number>(50_000);
    const optimizationGoal = ref<OptimizationGoal>('maximize_roas');
    const includeAI = ref(false);

    // Computed helpers ------------------------------------------------------

    /** Merged allocation rows — current and recommended side by side */
    const allocationRows = computed(() => {
        const res = result.value;
        if (!res) return [];

        return res.current_allocation.map((cur) => {
            const rec = res.recommended_allocation.find(r => r.channel === cur.channel);
            return {
                channel: cur.channel,
                current_spend: cur.current_spend,
                current_roas: cur.current_roas,
                current_cpa: cur.current_cpa,
                current_conversions: cur.current_conversions,
                efficiency_score: cur.efficiency_score,
                recommended_spend: rec?.recommended_spend ?? cur.current_spend,
                recommended_conversions: rec?.recommended_conversions ?? cur.current_conversions,
                recommended_cpa: rec?.recommended_cpa ?? cur.current_cpa,
                recommended_roas: rec?.recommended_roas ?? cur.current_roas,
                change_from_current: rec?.change_from_current ?? 0,
                change_percent: rec?.change_percent ?? 0,
            };
        });
    });

    const estimatedImpact = computed(() => result.value?.estimated_impact ?? null);
    const aiExplanation = computed(() => result.value?.ai_explanation ?? null);
    const reasoning = computed(() => result.value?.reasoning ?? '');
    const dailyPacing = computed(() => result.value?.daily_pacing ?? []);
    const constraintsApplied = computed(() => result.value?.constraints_applied ?? []);
    const hasData = computed(() => allocationRows.value.length > 0);

    /** Aggregate current totals */
    const currentTotals = computed(() => {
        const alloc = result.value?.current_allocation ?? [];
        const totalSpend = alloc.reduce((s, c) => s + c.current_spend, 0);
        const totalConv = alloc.reduce((s, c) => s + c.current_conversions, 0);
        const totalRev = alloc.reduce((s, c) => s + c.current_revenue, 0);
        return {
            spend: totalSpend,
            conversions: totalConv,
            revenue: totalRev,
            cpa: totalConv > 0 ? totalSpend / totalConv : 0,
            roas: totalSpend > 0 ? totalRev / totalSpend : 0,
        };
    });

    /** Aggregate recommended totals */
    const recommendedTotals = computed(() => {
        const alloc = result.value?.recommended_allocation ?? [];
        const totalSpend = alloc.reduce((s, r) => s + r.recommended_spend, 0);
        const totalConv = alloc.reduce((s, r) => s + r.recommended_conversions, 0);
        return {
            spend: totalSpend,
            conversions: totalConv,
            cpa: totalConv > 0 ? totalSpend / totalConv : 0,
            roas: totalSpend > 0
                ? alloc.reduce((s, r) => s + r.recommended_roas * r.recommended_spend, 0) / (totalSpend || 1)
                : 0,
        };
    });

    // Fetch -----------------------------------------------------------------

    async function fetch() {
        const dmId = toValue(dataModelId);
        const start = toValue(startDate);
        const end = toValue(endDate);

        if (!dmId || !start || !end) {
            error.value = 'Missing required parameters (dataModelId, startDate, endDate).';
            return;
        }

        isLoading.value = true;
        error.value = null;

        try {
            const token = getAuthToken();
            if (!token) {
                error.value = 'No auth token available.';
                return;
            }

            const url = `${baseUrl()}/marketing-metrics/budget-optimize`;
            const response = await useAppFetch<{ success: boolean; data: IBudgetOptimizeResponse }>(url, {
                method: 'POST',
                headers: {
                    Authorization: `Bearer ${token}`,
                    'Authorization-Type': 'auth',
                },
                body: {
                    data_model_id: dmId,
                    total_budget: totalBudget.value,
                    date_range: {
                        start: new Date(start).toISOString(),
                        end: new Date(end).toISOString(),
                    },
                    optimization_goal: optimizationGoal.value,
                    include_ai_enhancement: includeAI.value,
                },
            });

            result.value = response.data ?? null;
            hasFetched.value = true;
        } catch (err: any) {
            console.error('[useBudgetOptimization] ❌ Failed to fetch optimization:', err);
            error.value = err?.message || 'Failed to fetch budget optimization.';
            result.value = null;
        } finally {
            isLoading.value = false;
        }
    }

    /** Re-fetch when user changes budget or goal (debounced) */
    let debounceTimer: ReturnType<typeof setTimeout> | null = null;
    function debouncedFetch() {
        if (debounceTimer) clearTimeout(debounceTimer);
        debounceTimer = setTimeout(() => fetch(), 400);
    }

    watch([totalBudget, optimizationGoal], () => {
        if (hasFetched.value) {
            debouncedFetch();
        }
    });

    // Formatting helpers ---------------------------------------------------

    function formatCurrency(value: number): string {
        if (Math.abs(value) >= 1_000_000) return `$${(value / 1_000_000).toFixed(1)}M`;
        if (Math.abs(value) >= 1_000) return `$${(value / 1_000).toFixed(1)}K`;
        return `$${value.toFixed(2)}`;
    }

    function formatNumber(value: number): string {
        if (Math.abs(value) >= 1_000_000) return `${(value / 1_000_000).toFixed(1)}M`;
        if (Math.abs(value) >= 1_000) return `${(value / 1_000).toFixed(1)}K`;
        return value.toLocaleString();
    }

    function formatRatio(value: number): string {
        return `${value.toFixed(2)}x`;
    }

    function formatSignedPercent(value: number): string {
        const sign = value >= 0 ? '+' : '';
        return `${sign}${value.toFixed(1)}%`;
    }

    return {
        // State
        result,
        isLoading,
        hasFetched,
        hasData,
        error,
        // User controls
        totalBudget,
        optimizationGoal,
        includeAI,
        // Derived data
        allocationRows,
        estimatedImpact,
        aiExplanation,
        reasoning,
        dailyPacing,
        constraintsApplied,
        currentTotals,
        recommendedTotals,
        // Actions
        fetch,
        // Formatters
        formatCurrency,
        formatNumber,
        formatRatio,
        formatSignedPercent,
    };
}