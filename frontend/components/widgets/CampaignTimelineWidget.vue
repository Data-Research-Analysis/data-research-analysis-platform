<script setup lang="ts">
import type { ICampaignTimelineConfig } from '~/types/dashboard-widgets';

interface Props {
    chartId: string | number;
    projectId?: number;
    marketingConfig?: ICampaignTimelineConfig;
    width?: number;
    height?: number;
}

const props = withDefaults(defineProps<Props>(), {
    width: 700,
    height: 400,
});

const config = computed<ICampaignTimelineConfig>(() => ({
    show_budget_pacing: true,
    show_only_active: false,
    time_window: '30_days',
    ...(props.marketingConfig ?? {}),
}));

interface CampaignBar {
    id: string;
    name: string;
    start_date: string;
    end_date: string;
    spend: number;
    total_budget: number;
}

const campaigns = ref<CampaignBar[]>([]);
const isLoading = ref(true);

const windowDays = computed(() => {
    const map: Record<string, number> = {
        '30_days': 30,
        '60_days': 60,
        '90_days': 90,
        quarter: 91,
        custom: 60,
    };
    return map[config.value.time_window] ?? 30;
});

const windowStart = computed(() => {
    const d = new Date();
    d.setDate(d.getDate() - Math.floor(windowDays.value * 0.2));
    return d;
});

const windowEnd = computed(() => {
    const d = new Date(windowStart.value);
    d.setDate(d.getDate() + windowDays.value);
    return d;
});

const today = new Date();

function dateToX(dateStr: string): number {
    const d = new Date(dateStr);
    const totalMs = windowEnd.value.getTime() - windowStart.value.getTime();
    const offsetMs = d.getTime() - windowStart.value.getTime();
    return Math.max(0, Math.min(100, (offsetMs / totalMs) * 100));
}

function barWidth(startStr: string, endStr: string): number {
    const s = Math.max(dateToX(startStr), 0);
    const e = Math.min(dateToX(endStr), 100);
    return Math.max(1, e - s);
}

function todayX(): number {
    const totalMs = windowEnd.value.getTime() - windowStart.value.getTime();
    const offsetMs = today.getTime() - windowStart.value.getTime();
    return Math.max(0, Math.min(100, (offsetMs / totalMs) * 100));
}

function barColour(bar: CampaignBar): string {
    if (!config.value.show_budget_pacing || bar.total_budget === 0) return '#4285f4';
    const pct = (bar.spend / bar.total_budget) * 100;
    if (pct >= 90) return '#ef4444';
    if (pct >= 60) return '#f59e0b';
    return '#22c55e';
}

function formatCurrency(val: number): string {
    if (val >= 1_000_000) return `$${(val / 1_000_000).toFixed(1)}M`;
    if (val >= 1_000) return `$${(val / 1_000).toFixed(0)}k`;
    return `$${val.toLocaleString()}`;
}

function formatDate(dateStr: string): string {
    return new Date(dateStr).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

const { data: widgetData, isLoading: widgetLoading } = useWidgetData<{ campaigns: any[] }>(
    'campaign_timeline',
    computed(() => props.projectId ?? 0),
    config,
);

watch(widgetLoading, (v) => (isLoading.value = v), { immediate: true });
watch(
    widgetData,
    (d) => {
        if (!d?.campaigns) return;
        campaigns.value = d.campaigns.map((c: any) => ({
            id: String(c.id),
            name: c.name,
            start_date: c.start_date,
            end_date: c.end_date,
            spend: c.spent ?? 0,
            total_budget: c.budget_total ?? 0,
        }));
    },
    { immediate: true },
);

const visibleCampaigns = computed(() =>
    config.value.show_only_active
        ? campaigns.value.filter((c) => new Date(c.end_date) >= today && new Date(c.start_date) <= today)
        : campaigns.value,
);
</script>

<template>
    <div class="flex flex-col p-4 bg-white rounded-xl border border-gray-200 w-full h-full overflow-hidden">
        <div class="flex items-center gap-2 mb-3">
            <font-awesome-icon :icon="['fas', 'calendar-days']" class="text-primary-blue-100" />
            <h3 class="text-sm font-bold text-gray-700">Campaign Timeline</h3>
            <span class="ml-auto text-xs text-gray-400">{{ windowDays }}-day window</span>
        </div>

        <!-- Loading -->
        <div v-if="isLoading" class="space-y-3 animate-pulse flex-1">
            <div v-for="i in 4" :key="i" class="flex items-center gap-2">
                <div class="h-4 bg-gray-100 rounded w-24 shrink-0"></div>
                <div class="h-7 bg-gray-200 rounded flex-1"></div>
            </div>
        </div>

        <!-- Empty state -->
        <div v-else-if="visibleCampaigns.length === 0" class="flex flex-col items-center justify-center flex-1 gap-3 text-gray-400">
            <font-awesome-icon :icon="['fas', 'calendar-xmark']" class="text-4xl text-gray-200" />
            <p class="text-sm font-medium">No campaigns in this time window</p>
            <p class="text-xs text-center">Campaigns will appear here once configured in the Projects section</p>
        </div>

        <!-- Timeline -->
        <div v-else class="flex flex-col flex-1 overflow-y-auto gap-1">
            <!-- Date axis labels -->
            <div class="flex justify-between text-xs text-gray-400 mb-2 relative" style="height: 16px;">
                <span>{{ formatDate(windowStart.toISOString()) }}</span>
                <span class="absolute left-1/2 -translate-x-1/2">
                    {{ formatDate(new Date((windowStart.getTime() + windowEnd.getTime()) / 2).toISOString()) }}
                </span>
                <span>{{ formatDate(windowEnd.toISOString()) }}</span>
            </div>

            <!-- Campaign rows -->
            <div
                v-for="campaign in visibleCampaigns"
                :key="campaign.id"
                class="flex items-center gap-2 min-h-[36px]"
            >
                <!-- Campaign label -->
                <div class="text-xs font-medium text-gray-700 w-28 shrink-0 truncate" :title="campaign.name">
                    {{ campaign.name }}
                </div>
                <!-- Bar track -->
                <div class="relative flex-1 h-7 bg-gray-100 rounded overflow-visible">
                    <!-- Campaign bar -->
                    <div
                        class="absolute top-0.5 h-6 rounded flex items-center overflow-hidden"
                        :style="{
                            left: `${dateToX(campaign.start_date)}%`,
                            width: `${barWidth(campaign.start_date, campaign.end_date)}%`,
                            backgroundColor: barColour(campaign),
                            minWidth: '4px',
                        }"
                        :title="`${campaign.name} | ${formatDate(campaign.start_date)} – ${formatDate(campaign.end_date)} | ${formatCurrency(campaign.spend)} / ${formatCurrency(campaign.total_budget)}`"
                    >
                        <span class="px-2 text-xs text-white font-medium whitespace-nowrap truncate">
                            {{ campaign.name }} · {{ formatCurrency(campaign.spend) }}/{{ formatCurrency(campaign.total_budget) }}
                        </span>
                    </div>

                    <!-- Today vertical marker -->
                    <div
                        class="absolute top-0 h-full w-0.5 bg-gray-800 opacity-50"
                        :style="{ left: `${todayX()}%` }"
                        style="border-style: dashed; border-width: 0 1px 0 0; border-color: #1f2937;"
                        title="Today"
                    ></div>
                </div>
            </div>

            <!-- Legend for budget pacing -->
            <div v-if="config.show_budget_pacing" class="flex gap-3 mt-3 pt-2 border-t border-gray-100">
                <div class="flex items-center gap-1 text-xs text-gray-500">
                    <div class="w-3 h-3 rounded bg-green-500"></div><span>&lt; 60% budget</span>
                </div>
                <div class="flex items-center gap-1 text-xs text-gray-500">
                    <div class="w-3 h-3 rounded bg-amber-400"></div><span>60–90%</span>
                </div>
                <div class="flex items-center gap-1 text-xs text-gray-500">
                    <div class="w-3 h-3 rounded bg-red-400"></div><span>&gt; 90%</span>
                </div>
            </div>
        </div>
    </div>
</template>
