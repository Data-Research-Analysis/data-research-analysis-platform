<script setup lang="ts">
import type { IBudgetGaugeConfig } from '~/types/dashboard-widgets';

interface Props {
    chartId: string | number;
    projectId?: number;
    marketingConfig?: IBudgetGaugeConfig;
    width?: number;
    height?: number;
}

const props = withDefaults(defineProps<Props>(), {
    width: 300,
    height: 300,
});

const config = computed<IBudgetGaugeConfig>(() => ({
    campaign_id: '',
    show_daily_pace: true,
    thresholds: { warning: 80, danger: 95 },
    ...(props.marketingConfig ?? {}),
}));

interface CampaignBudget {
    campaign_name: string;
    total_budget: number;
    spent: number;
    days_total: number;
    days_remaining: number;
}

const data = ref<CampaignBudget | null>(null);
const isLoading = ref(true);

// SVG gauge constants
const RADIUS = 80;
const CIRCUMFERENCE = Math.PI * RADIUS; // half-circle arc
const CX = 110;
const CY = 110;

const spentPct = computed(() => {
    if (!data.value || data.value.total_budget === 0) return 0;
    return Math.min(100, (data.value.spent / data.value.total_budget) * 100);
});

const dashOffset = computed(() => {
    // stroke-dasharray on a half-circle: circumference * (1 - pct/100)
    return CIRCUMFERENCE * (1 - spentPct.value / 100);
});

const gaugeColour = computed(() => {
    const { warning, danger } = config.value.thresholds;
    if (spentPct.value >= danger) return '#ef4444'; // red-500
    if (spentPct.value >= warning) return '#f59e0b'; // amber-400
    return '#22c55e'; // green-500
});

function formatCurrency(val: number): string {
    if (val >= 1_000_000) return `$${(val / 1_000_000).toFixed(1)}M`;
    if (val >= 1_000) return `$${(val / 1_000).toFixed(0)}k`;
    return `$${val.toLocaleString()}`;
}

const dailyPaceNeeded = computed(() => {
    if (!data.value || data.value.days_remaining <= 0 || !config.value.show_daily_pace) return null;
    const remaining = data.value.total_budget - data.value.spent;
    return remaining / data.value.days_remaining;
});

const { data: widgetData, isLoading: widgetLoading } = useWidgetData<CampaignBudget>(
    'budget_gauge',
    computed(() => props.projectId ?? 0),
    config,
);

watch(widgetLoading, (v) => (isLoading.value = v), { immediate: true });
watch(widgetData, (d) => { if (d) data.value = d; }, { immediate: true });
</script>

<template>
    <div class="flex flex-col items-center justify-center p-4 bg-white rounded-xl border border-gray-200 w-full h-full">
        <!-- Loading -->
        <div v-if="isLoading" class="flex flex-col items-center gap-3 animate-pulse">
            <div class="w-40 h-20 bg-gray-200 rounded-full"></div>
            <div class="h-4 w-24 bg-gray-100 rounded"></div>
        </div>

        <!-- No campaign configured -->
        <div v-else-if="!config.campaign_id" class="flex flex-col items-center gap-2 text-gray-400">
            <font-awesome-icon :icon="['fas', 'gauge-high']" class="text-4xl text-gray-300" />
            <p class="text-sm font-medium">Configure a campaign to display the gauge</p>
        </div>

        <!-- Gauge -->
        <template v-else>
            <div v-if="data" class="flex flex-col items-center gap-2 w-full">
                <p class="text-sm font-semibold text-gray-600 truncate max-w-full text-center">{{ data.campaign_name }}</p>

                <!-- SVG half-circle gauge -->
                <svg :width="CX * 2" :height="CY + 20" viewBox="0 0 220 120" class="overflow-visible">
                    <!-- Track arc -->
                    <path
                        :d="`M ${CX - RADIUS} ${CY} A ${RADIUS} ${RADIUS} 0 0 1 ${CX + RADIUS} ${CY}`"
                        fill="none"
                        stroke="#e5e7eb"
                        stroke-width="18"
                        stroke-linecap="round"
                    />
                    <!-- Progress arc using stroke-dasharray trick -->
                    <path
                        :d="`M ${CX - RADIUS} ${CY} A ${RADIUS} ${RADIUS} 0 0 1 ${CX + RADIUS} ${CY}`"
                        fill="none"
                        :stroke="gaugeColour"
                        stroke-width="18"
                        stroke-linecap="round"
                        :stroke-dasharray="CIRCUMFERENCE"
                        :stroke-dashoffset="dashOffset"
                        style="transition: stroke-dashoffset 0.6s ease, stroke 0.4s ease;"
                    />
                    <!-- Center text -->
                    <text x="110" y="98" text-anchor="middle" class="font-bold" font-size="14" fill="#111827">
                        {{ formatCurrency(data.spent) }}
                    </text>
                    <text x="110" y="114" text-anchor="middle" font-size="10" fill="#6b7280">
                        of {{ formatCurrency(data.total_budget) }}
                    </text>
                </svg>

                <!-- Pct label -->
                <div class="text-2xl font-bold" :style="{ color: gaugeColour }">{{ spentPct.toFixed(1) }}%</div>
                <div class="text-xs text-gray-500">of budget used</div>

                <!-- Days remaining -->
                <div class="flex items-center gap-1 text-xs text-gray-500 mt-1">
                    <font-awesome-icon :icon="['fas', 'calendar-days']" />
                    <span>{{ data.days_remaining }} days remaining</span>
                </div>

                <!-- Daily pace -->
                <div v-if="dailyPaceNeeded !== null" class="text-xs text-gray-500 mt-1">
                    <font-awesome-icon :icon="['fas', 'bolt']" class="text-amber-400" />
                    Recommended daily spend: <span class="font-semibold text-gray-700">{{ formatCurrency(dailyPaceNeeded) }}/day</span>
                </div>
            </div>

            <!-- Campaign not found -->
            <div v-else class="flex flex-col items-center gap-2 text-gray-400">
                <font-awesome-icon :icon="['fas', 'circle-exclamation']" class="text-3xl text-amber-400" />
                <p class="text-sm">Campaign data unavailable</p>
            </div>
        </template>
    </div>
</template>
