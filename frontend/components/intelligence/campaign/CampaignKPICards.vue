<script setup lang="ts">
/**
 * CampaignKPICards — Row of KPI metric cards for the Campaign Drill-Down page.
 *
 * Displays spend, conversions, CPA, ROAS, CTR, CPC with period comparison deltas.
 * Uses the same card styling as the existing KPICard component.
 */
import type { ICampaignKPIs, ICampaignKPIDelta } from '~/composables/useCampaignDrillDown';

interface Props {
    kpis: ICampaignKPIs | null;
    deltas: ICampaignKPIDelta | null;
    isLoading?: boolean;
    formatCurrency: (v: number) => string;
    formatNumber: (v: number) => string;
    formatPercent: (v: number) => string;
    formatRatio: (v: number) => string;
}

const props = withDefaults(defineProps<Props>(), {
    kpis: null,
    deltas: null,
    isLoading: false,
});

type KPIDeltaKey = keyof ICampaignKPIDelta;

interface IKPICardDef {
    key: KPIDeltaKey;
    label: string;
    icon: string;
    color: string;
    format: 'currency' | 'number' | 'percent' | 'ratio';
    /** Whether a decrease is positive (e.g. CPA ↓ is good) */
    lowerIsBetter?: boolean;
}

const cardDefs: IKPICardDef[] = [
    { key: 'spend', label: 'Spend', icon: 'dollar-sign', color: '#3b82f6', format: 'currency' },
    { key: 'conversions', label: 'Conversions', icon: 'check-circle', color: '#10b981', format: 'number' },
    { key: 'cpa', label: 'CPA', icon: 'tags', color: '#f59e0b', format: 'currency', lowerIsBetter: true },
    { key: 'roas', label: 'ROAS', icon: 'chart-line', color: '#8b5cf6', format: 'ratio' },
    { key: 'ctr', label: 'CTR', icon: 'mouse-pointer', color: '#06b6d4', format: 'percent' },
    { key: 'cpc', label: 'CPC', icon: 'hand-pointer', color: '#ec4899', format: 'currency', lowerIsBetter: true },
];

function formatValue(value: number, fmt: string, helpers: Props): string {
    switch (fmt) {
        case 'currency': return helpers.formatCurrency(value);
        case 'number': return helpers.formatNumber(value);
        case 'percent': return helpers.formatPercent(value);
        case 'ratio': return helpers.formatRatio(value);
        default: return String(value);
    }
}

function getKPIValue(kpis: ICampaignKPIs, key: KPIDeltaKey): number {
    return kpis[key];
}

function deltaClass(delta: number | null, lowerIsBetter: boolean): string {
    if (delta === null) return 'text-gray-400';
    const isPositive = lowerIsBetter ? delta < 0 : delta > 0;
    return isPositive ? 'text-emerald-600' : 'text-red-500';
}

function deltaBgClass(delta: number | null, lowerIsBetter: boolean): string {
    if (delta === null) return 'bg-gray-50 text-gray-400';
    const isPositive = lowerIsBetter ? delta < 0 : delta > 0;
    return isPositive ? 'bg-emerald-50 text-emerald-600' : 'bg-red-50 text-red-500';
}

function deltaIcon(delta: number | null): string {
    if (delta === null) return 'minus';
    return delta >= 0 ? 'arrow-up' : 'arrow-down';
}

function formatDelta(delta: number | null): string {
    if (delta === null) return 'N/A';
    const abs = Math.abs(delta);
    return abs < 0.001 ? '0%' : `${abs >= 0 ? '+' : ''}${(delta * 100).toFixed(1)}%`;
}
</script>

<template>
    <div class="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-3">
        <template v-if="isLoading">
            <div
                v-for="i in 6"
                :key="i"
                class="rounded-xl border border-gray-200 bg-white p-4 space-y-3"
            >
                <div class="h-3 w-16 rounded bg-gray-100 animate-pulse" />
                <div class="h-6 w-24 rounded bg-gray-100 animate-pulse" />
                <div class="h-3 w-12 rounded bg-gray-100 animate-pulse" />
            </div>
        </template>

        <template v-else-if="kpis">
            <div
                v-for="def in cardDefs"
                :key="def.key"
                class="rounded-xl border border-gray-200 bg-white p-4 transition-all duration-200 hover:shadow-md hover:border-gray-300"
            >
                <!-- Header -->
                <div class="flex items-center gap-2 mb-2">
                    <div
                        class="w-6 h-6 rounded-md flex items-center justify-center flex-shrink-0"
                        :style="{ backgroundColor: `${def.color}10` }"
                    >
                        <font-awesome-icon
                            :icon="['fas', def.icon]"
                            class="text-[10px]"
                            :style="{ color: def.color }"
                        />
                    </div>
                    <span class="text-[11px] font-medium text-gray-500 uppercase tracking-wide">
                        {{ def.label }}
                    </span>
                </div>

                <!-- Value -->
                <div class="text-xl font-bold text-gray-900 leading-tight mb-1.5">
                    {{ formatValue(getKPIValue(kpis, def.key), def.format, props) }}
                </div>

                <!-- Delta badge -->
                <div v-if="deltas" class="flex items-center gap-1.5">
                    <span
                        class="inline-flex items-center gap-0.5 text-[10px] font-semibold px-1.5 py-0.5 rounded-full"
                        :class="deltaBgClass(deltas[def.key], !!def.lowerIsBetter)"
                    >
                        <font-awesome-icon
                            :icon="['fas', deltaIcon(deltas[def.key])]"
                            class="w-2.5 h-2.5"
                        />
                        {{ formatDelta(deltas[def.key]) }}
                    </span>
                    <span class="text-[10px] text-gray-400">vs prior</span>
                </div>
                <div v-else class="text-[10px] text-gray-400">No prior period data</div>
            </div>
        </template>
    </div>
</template>
