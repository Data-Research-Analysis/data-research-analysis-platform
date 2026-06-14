<script setup lang="ts">
/**
 * CampaignKPICards — Displays KPI summary cards for a single campaign.
 *
 * Shows the KPIs returned from the campaign analysis endpoint (spend,
 * impressions, clicks, conversions, revenue, CTR, CPC, CPA, ROAS).
 */
import type { ICampaignKPI } from '@/composables/useCampaignAnalysis';

interface Props {
    kpis: ICampaignKPI[];
    isLoading?: boolean;
}

const props = withDefaults(defineProps<Props>(), {
    isLoading: false,
});

/** Map KPI keys to icons and colors */
const kpiMeta: Record<string, { icon: string; color: string }> = {
    spend: { icon: 'dollar-sign', color: '#6366f1' },
    impressions: { icon: 'eye', color: '#8b5cf6' },
    clicks: { icon: 'mouse-pointer', color: '#3b82f6' },
    conversions: { icon: 'check-circle', color: '#10b981' },
    revenue: { icon: 'money-bill-wave', color: '#f59e0b' },
    ctr: { icon: 'percentage', color: '#06b6d4' },
    cpc: { icon: 'hand-pointer', color: '#ec4899' },
    cpa: { icon: 'tag', color: '#f97316' },
    roas: { icon: 'chart-line', color: '#22c55e' },
};

function getMeta(kpiKey: string) {
    return kpiMeta[kpiKey] || { icon: 'chart-bar', color: '#6b7280' };
}
</script>

<template>
    <div class="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
        <!-- Loading skeletons -->
        <template v-if="isLoading">
            <div
                v-for="n in 5"
                :key="`skel-${n}`"
                class="bg-white rounded-xl border border-gray-200 p-4 space-y-3"
            >
                <div class="h-3 w-16 rounded bg-gray-100 animate-pulse" />
                <div class="h-6 w-24 rounded bg-gray-100 animate-pulse" />
            </div>
        </template>

        <!-- KPI cards -->
        <template v-else>
            <div
                v-for="kpi in kpis"
                :key="kpi.kpi"
                class="bg-white rounded-xl border border-gray-200 p-4 transition-all duration-200 hover:shadow-md hover:border-gray-300"
            >
                <div class="flex items-center gap-2 mb-2">
                    <div
                        class="w-6 h-6 rounded-md flex items-center justify-center flex-shrink-0"
                        :style="{ backgroundColor: `${getMeta(kpi.kpi).color}10` }"
                    >
                        <font-awesome-icon
                            :icon="['fas', getMeta(kpi.kpi).icon]"
                            class="text-[10px]"
                            :style="{ color: getMeta(kpi.kpi).color }"
                        />
                    </div>
                    <span class="text-[11px] font-medium text-gray-500 uppercase tracking-wide">
                        {{ kpi.label }}
                    </span>
                </div>
                <div class="text-xl font-bold text-gray-900 leading-tight">
                    {{ kpi.value }}
                </div>
            </div>
        </template>
    </div>
</template>