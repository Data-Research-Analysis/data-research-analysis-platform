<script setup lang="ts">
/**
 * KPISummarySection — Container for the 6-card KPI summary row.
 *
 * Computes derived KPIs (ROAS, CPA, CPL, CTR, CPC, Conv Rate) from the
 * marketing hub summary and renders them as KPI cards with sparklines.
 */

import type { IMarketingHubSummary } from '@/types/marketing-hub';
import KpiCard from '@/components/intelligence/kpi/KPICard.vue';

interface Props {
    summary: IMarketingHubSummary | null;
    isLoading?: boolean;
}

const props = withDefaults(defineProps<Props>(), {
    isLoading: false,
});

// ── Debug: Log props and KPI data availability ──────────────────────────────
onMounted(() => {
    console.log('[KPISummarySection] 🚀 onMounted — props:', {
        isLoading: props.isLoading,
        hasSummary: !!props.summary,
        hasTotals: !!props.summary?.totals,
        hasPriorPeriod: !!props.summary?.priorPeriodTotals,
        channelsCount: props.summary?.channels?.length ?? 0,
        weeklyTrendCount: props.summary?.weeklyTrend?.length ?? 0,
    });
});

watch(() => props.summary, (newSummary) => {
    console.log('[KPISummarySection] 👀 summary prop changed:', {
        hasSummary: !!newSummary,
        hasTotals: !!newSummary?.totals,
        totals: newSummary?.totals,
        priorPeriodTotals: newSummary?.priorPeriodTotals,
        channelsCount: newSummary?.channels?.length ?? 0,
    });
}, { immediate: true });

watch(() => props.isLoading, (val) => {
    console.log('[KPISummarySection] ⏳ isLoading changed:', val);
}, { immediate: true });

/** Helper: compute % change between current and prior period */
function pctChange(current: number, prior: number): number {
    if (prior === 0) return current > 0 ? 100 : 0;
    return ((current - prior) / prior) * 100;
}

/** Helper: determine trend direction */
function trendDir(val: number): 'up' | 'down' | 'flat' {
    if (Math.abs(val) < 0.1) return 'flat';
    return val > 0 ? 'up' : 'down';
}

/** Extract sparkline data from weekly trend aggregated across all channels */
function extractSparkline(key: string): number[] {
    if (!props.summary?.weeklyTrend?.length) return [];

    const weeks = props.summary.weeklyTrend;
    // Group by weekStart and sum across channels
    const weekMap = new Map<string, number>();

    for (const point of weeks) {
        const weekKey = point.weekStart;
        const current = weekMap.get(weekKey) || 0;

        switch (key) {
            case 'roas':
                // ROAS is a ratio — compute per week: sum(pipeline) / sum(spend)
                weekMap.set(weekKey, current + (point.pipelineValue || 0));
                break;
            case 'cpa':
            case 'spend':
                weekMap.set(weekKey, current + (point.spend || 0));
                break;
            case 'ctr':
                weekMap.set(weekKey, current + (point.clicks || 0));
                break;
            case 'cpc':
                weekMap.set(weekKey, current + (point.clicks || 0));
                break;
            case 'convRate':
                weekMap.set(weekKey, current + (point.conversions || 0));
                break;
            default:
                weekMap.set(weekKey, current);
        }
    }

    const sortedWeeks = Array.from(weekMap.entries()).sort(([a], [b]) => a.localeCompare(b));

    if (key === 'roas') {
        // For ROAS sparkline, need spend per week too
        const spendMap = new Map<string, number>();
        for (const point of weeks) {
            const current = spendMap.get(point.weekStart) || 0;
            spendMap.set(point.weekStart, current + (point.spend || 0));
        }
        return sortedWeeks.map(([wk, pipeline]) => {
            const spend = spendMap.get(wk) || 1;
            return spend > 0 ? pipeline / spend : 0;
        });
    }

    if (key === 'ctr') {
        const imprMap = new Map<string, number>();
        for (const point of weeks) {
            const current = imprMap.get(point.weekStart) || 0;
            imprMap.set(point.weekStart, current + (point.impressions || 0));
        }
        return sortedWeeks.map(([wk, clicks]) => {
            const impr = imprMap.get(wk) || 1;
            return impr > 0 ? (clicks / impr) * 100 : 0;
        });
    }

    if (key === 'cpc') {
        const spendMap = new Map<string, number>();
        for (const point of weeks) {
            const current = spendMap.get(point.weekStart) || 0;
            spendMap.set(point.weekStart, current + (point.spend || 0));
        }
        return sortedWeeks.map(([wk, clicks]) => {
            const spend = spendMap.get(wk) || 0;
            return clicks > 0 ? spend / clicks : 0;
        });
    }

    if (key === 'convRate') {
        const clicksMap = new Map<string, number>();
        for (const point of weeks) {
            const current = clicksMap.get(point.weekStart) || 0;
            clicksMap.set(point.weekStart, current + (point.clicks || 0));
        }
        return sortedWeeks.map(([wk, convs]) => {
            const clicks = clicksMap.get(wk) || 1;
            return clicks > 0 ? (convs / clicks) * 100 : 0;
        });
    }

    return sortedWeeks.map(([, val]) => val);
}

/** Build the 6 KPI definitions from summary data */
const kpis = computed(() => {
    if (!props.summary?.totals) {
        console.log('[KPISummarySection] 📊 kpis computed: no summary.totals — returning empty array');
        return [];
    }

    console.log('[KPISummarySection] 📊 kpis computed: building from summary.totals:', props.summary.totals);

    const t = props.summary.totals;
    const p = props.summary.priorPeriodTotals;

    // Current period values
    const roas = t.spend > 0 ? t.pipelineValue / t.spend : 0;
    const cpa = t.conversions > 0 ? t.spend / t.conversions : 0;
    const cpl = t.cpl || 0;
    const ctr = t.impressions > 0 ? (t.clicks / t.impressions) * 100 : 0;
    const cpc = t.clicks > 0 ? t.spend / t.clicks : 0;
    const convRate = t.clicks > 0 ? (t.conversions / t.clicks) * 100 : 0;

    // Prior period values (default to 0 if priorPeriodTotals is not available)
    let roasPrior = 0;
    let cpaPrior = 0;
    let cplPrior = 0;
    let ctrPrior = 0;
    let cpcPrior = 0;
    let convRatePrior = 0;

    if (p) {
        roasPrior = p.spend > 0 ? p.pipelineValue / p.spend : 0;
        cpaPrior = p.conversions > 0 ? p.spend / p.conversions : 0;
        cplPrior = p.cpl || 0;
        ctrPrior = p.impressions > 0 ? (p.clicks / p.impressions) * 100 : 0;
        cpcPrior = p.clicks > 0 ? p.spend / p.clicks : 0;
        convRatePrior = p.clicks > 0 ? (p.conversions / p.clicks) * 100 : 0;
    }

    return [
        {
            label: 'ROAS',
            value: `${roas.toFixed(1)}x`,
            trend: pctChange(roas, roasPrior),
            trendDirection: trendDir(roas - roasPrior),
            trendIsPositive: true, // ↑ ROAS is good
            sparklineData: extractSparkline('roas'),
            color: '#8b5cf6',
            icon: 'chart-line',
        },
        {
            label: 'CPA',
            value: `$${cpa.toFixed(2)}`,
            trend: pctChange(cpa, cpaPrior),
            trendDirection: trendDir(cpa - cpaPrior),
            trendIsPositive: false, // ↓ CPA is good
            sparklineData: extractSparkline('cpa'),
            color: '#f59e0b',
            icon: 'dollar-sign',
        },
        {
            label: 'CPL',
            value: `$${cpl.toFixed(2)}`,
            trend: pctChange(cpl, cplPrior),
            trendDirection: trendDir(cpl - cplPrior),
            trendIsPositive: false, // ↓ CPL is good
            sparklineData: extractSparkline('cpa'), // CPL uses spend per-week as proxy
            color: '#ec4899',
            icon: 'user-plus',
        },
        {
            label: 'CTR',
            value: `${ctr.toFixed(2)}%`,
            trend: pctChange(ctr, ctrPrior),
            trendDirection: trendDir(ctr - ctrPrior),
            trendIsPositive: true, // ↑ CTR is good
            sparklineData: extractSparkline('ctr'),
            color: '#06b6d4',
            icon: 'mouse-pointer',
        },
        {
            label: 'CPC',
            value: `$${cpc.toFixed(2)}`,
            trend: pctChange(cpc, cpcPrior),
            trendDirection: trendDir(cpc - cpcPrior),
            trendIsPositive: false, // ↓ CPC is good
            sparklineData: extractSparkline('cpc'),
            color: '#f97316',
            icon: 'hand-pointer',
        },
        {
            label: 'Conv Rate',
            value: `${convRate.toFixed(2)}%`,
            trend: pctChange(convRate, convRatePrior),
            trendDirection: trendDir(convRate - convRatePrior),
            trendIsPositive: true, // ↑ Conv Rate is good
            sparklineData: extractSparkline('convRate'),
            color: '#10b981',
            icon: 'bullseye',
        },
    ];
});

/** Placeholder KPIs for loading state */
const loadingKpis = Array.from({ length: 6 }, (_, i) => ({
    label: '',
    value: '',
    trend: 0,
    trendDirection: 'flat' as const,
    trendIsPositive: true,
    sparklineData: [],
    color: '#d1d5db',
    icon: 'chart-line',
    key: `loading-${i}`,
}));
</script>

<template>
    <div>
        <div class="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
            <!-- Loading skeletons -->
            <template v-if="isLoading || !summary">
                <KpiCard
                    v-for="item in loadingKpis"
                    :key="item.key"
                    :label="item.label"
                    :value="item.value"
                    :trend="0"
                    trend-direction="flat"
                    :trend-is-positive="true"
                    :sparkline-data="[]"
                    :color="item.color"
                    :icon="item.icon"
                    :is-loading="true"
                />
            </template>

            <!-- Loaded KPI cards -->
            <template v-else>
                <KpiCard
                    v-for="(kpi, index) in kpis"
                    :key="kpi.label"
                    :label="kpi.label"
                    :value="kpi.value"
                    :trend="kpi.trend"
                    :trend-direction="kpi.trendDirection"
                    :trend-is-positive="kpi.trendIsPositive"
                    :sparkline-data="kpi.sparklineData"
                    :color="kpi.color"
                    :icon="kpi.icon"
                />
            </template>
        </div>
    </div>
</template>