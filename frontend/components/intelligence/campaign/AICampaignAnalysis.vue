<script setup lang="ts">
/**
 * AICampaignAnalysis — Ready-made AI marketing analysis for a single campaign.
 *
 * New section at the bottom of the campaign drill-down page. The AI engine
 * acts as an experienced performance marketer and senior data analyst and
 * produces a CMO-ready analysis of THIS campaign: executive summary, charts,
 * ad set / ad group spend recommendations, target-vs-actual comparison,
 * risks, and next steps. No chat interface.
 */
import { useAIMarketingAnalysis } from '@/composables/useAIMarketingAnalysis';
import { useApiErrorHandler } from '@/composables/useApiErrorHandler';
import { useMarkdown } from '@/composables/useMarkdown';
import type { IAIMarketingAnalysisResponse } from '~/types/IAIMarketingAnalysis';

interface Props {
    projectId?: number | null;
    campaignId: string;
    campaignName?: string;
    channel?: string;
    startDate: string;
    endDate: string;
    sourceTable?: string;
    campaignColumn?: string;
}

const props = withDefaults(defineProps<Props>(), {
    projectId: null,
    campaignName: '',
    channel: '',
    sourceTable: '',
    campaignColumn: '',
});

const { renderMarkdown, renderInlineMarkdown } = useMarkdown();
const { handle402Error } = useApiErrorHandler();
const { generateAnalysis } = useAIMarketingAnalysis();

const CAMPAIGN_SCOPE_KEY = '__campaign__';
const reports = reactive<Record<string, IAIMarketingAnalysisResponse | null>>({});
const selectedScope = ref<string | null>(null); // null = entire campaign
const scopeKey = computed(() => selectedScope.value ?? CAMPAIGN_SCOPE_KEY);
const analysis = computed(() => reports[scopeKey.value] ?? null);
const isLoading = ref(false);
const error = ref<string | null>(null);

const adSetScopes = computed(() => reports[CAMPAIGN_SCOPE_KEY]?.adSetScopes ?? []);
const isAdSetScope = computed(() => analysis.value?.scope?.type === 'ad_set');
const selectedScopeLoaded = computed(() => (selectedScope.value ? !!reports[selectedScope.value] : false));

// ---------------------------------------------------------------------------
// Actions
// ---------------------------------------------------------------------------

const REQUEST_TIMEOUT_MS = 120000;
let inFlight = false;

async function load(force: boolean = false): Promise<void> {
    if (!props.projectId) return;
    if (inFlight) return;
    inFlight = true;
    isLoading.value = true;
    error.value = null;
    const key = scopeKey.value;
    let timeoutId: ReturnType<typeof setTimeout> | null = null;
    try {
        const timeout = new Promise<never>((_, reject) => {
            timeoutId = setTimeout(() => reject(new Error('AI_TIMEOUT')), REQUEST_TIMEOUT_MS);
        });
        reports[key] = await Promise.race([
            generateAnalysis(
                props.projectId,
                new Date(props.startDate),
                new Date(props.endDate),
                force,
                props.campaignId,
                props.sourceTable,
                props.campaignColumn,
                props.channel,
                selectedScope.value ?? undefined,
            ),
            timeout,
        ]);
    } catch (err: any) {
        const data = err?.data ?? err;
        if (err?.statusCode === 402 || err?.status === 402 || data?.error === 'TIER_LIMIT_EXCEEDED') {
            await handle402Error(data);
        } else if (err?.message === 'AI_TIMEOUT') {
            error.value = 'The analysis is taking longer than expected. Please try again.';
        } else if (err?.message?.startsWith('AD_SET_NOT_FOUND')) {
            error.value = 'The ad group / ad set could not be found in the synced data. Please regenerate the campaign report.';
        } else {
            error.value = data?.message || 'Failed to generate the AI analysis. Please try again.';
        }
    } finally {
        if (timeoutId) clearTimeout(timeoutId);
        isLoading.value = false;
        inFlight = false;
    }
}

function selectScope(name: string | null): void {
    if (name === selectedScope.value) return;
    selectedScope.value = name;
    if (!reports[scopeKey.value]) {
        load(false);
    }
}

function handlePrint(): void {
    if (import.meta.client) {
        window.print();
    }
}

// Load on mount, then reload whenever the campaign or date range changes.
onMounted(() => {
    load(false);
});

watch(
    () => [props.campaignId, props.startDate, props.endDate, props.sourceTable, props.campaignColumn],
    () => {
        Object.keys(reports).forEach(k => delete reports[k]);
        selectedScope.value = null;
        load(false);
    },
);

// ---------------------------------------------------------------------------
// Formatting helpers
// ---------------------------------------------------------------------------

function formatMoney(n: number | null | undefined): string {
    if (n == null) return '—';
    return `$${Number(n).toLocaleString('en-US', { maximumFractionDigits: 2 })}`;
}

function formatNumber(n: number | null | undefined, decimals = 0): string {
    if (n == null) return '—';
    return Number(n).toLocaleString('en-US', {
        maximumFractionDigits: Number(n) < 10 ? Math.max(decimals, 2) : decimals,
    });
}

function formatDate(iso: string): string {
    if (!iso) return '—';
    const d = new Date(iso);
    if (isNaN(d.getTime())) return iso;
    return d.toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
}

function scopeChipClass(active: boolean): string {
    return active
        ? 'inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg bg-primary-blue-100 text-white cursor-pointer'
        : 'inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg bg-gray-100 text-gray-700 hover:bg-gray-200 transition-colors cursor-pointer';
}

// ---------------------------------------------------------------------------
// Chart data computeds (empty-safe)
// ---------------------------------------------------------------------------

// Safe accessor: older cached responses may not contain every chart key.
const charts = computed<any>(() => analysis.value?.charts ?? {});

const channelSpendData = computed(() => charts.value.channelSpend?.data ?? []);
const channelRoasData = computed(() => charts.value.channelRoas?.data ?? []);
const spendAllocationData = computed(() => charts.value.spendAllocation?.data ?? []);
const weeklyTrendData = computed(() => charts.value.weeklyTrend?.data ?? { categories: [], series: [] });
const dailySpendData = computed(() => charts.value.dailySpend?.data ?? { categories: [], series: [] });

/** Normalize any date value (ISO, Date, or Date.toString()) to YYYY-MM-DD. */
function toDateLabel(value: any): string {
    if (value == null) return '';
    const s = String(value).trim();
    const iso = s.match(/^(\d{4})-(\d{2})-(\d{2})/);
    if (iso) return `${iso[1]}-${iso[2]}-${iso[3]}`;
    // JS Date.toString(): "Tue Sep 01 2026 00:00:00 GMT+0000 (...)"
    const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    const dt = s.match(/^[A-Za-z]{3} ([A-Za-z]{3}) (\d{1,2}) (\d{4})/);
    if (dt) {
        const mi = MONTHS.indexOf(dt[1]);
        if (mi >= 0) return `${dt[3]}-${String(mi + 1).padStart(2, '0')}-${String(dt[2]).padStart(2, '0')}`;
    }
    const d = new Date(value);
    if (!isNaN(d.getTime())) {
        return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}-${String(d.getUTCDate()).padStart(2, '0')}`;
    }
    const any = s.match(/\d{4}-\d{2}-\d{2}/);
    return any ? any[0] : s;
}

/** Daily chart data with date-only x-axis labels. */
const dailySpendChartData = computed(() => {
    const data = dailySpendData.value;
    return {
        categories: (data?.categories ?? []).map(toDateLabel),
        series: data?.series ?? [],
    };
});
const topCampaignsData = computed(() => charts.value.topCampaigns?.data ?? []);
const adSetPerformanceData = computed(() => charts.value.adSetPerformance?.data ?? []);
const spendByAgeData = computed(() => charts.value.spendByAge?.data ?? []);
const spendByGenderData = computed(() => charts.value.spendByGender?.data ?? []);
const spendByDeviceData = computed(() => charts.value.spendByDevice?.data ?? []);
const spendByPlatformData = computed(() => charts.value.spendByPlatform?.data ?? []);

// d3.schemeCategory10 — matches the donut-chart slice colours (by data order).
const DONUT_COLORS = ['#1f77b4', '#ff7f0e', '#2ca02c', '#d62728', '#9467bd', '#8c564b', '#e377c2', '#7f7f7f', '#bcbd22', '#17becf'];
const spendAllocationLegend = computed(() => {
    const rows = (spendAllocationData.value ?? []) as Array<{ label: string; value: number }>;
    const total = rows.reduce((sum, r) => sum + (Number(r.value) || 0), 0) || 1;
    return rows.map((r, i) => ({
        label: r.label,
        value: Number(r.value) || 0,
        percent: Math.round(((Number(r.value) || 0) / total) * 100),
        color: DONUT_COLORS[i % DONUT_COLORS.length],
    }));
});

const statusBadgeClass: Record<string, string> = {
    'above-target': 'bg-green-100 text-green-700 ring-green-200',
    'on-target': 'bg-blue-100 text-blue-700 ring-blue-200',
    'below-target': 'bg-red-100 text-red-700 ring-red-200',
    'no-target': 'bg-gray-100 text-gray-600 ring-gray-200',
};

const statusLabel: Record<string, string> = {
    'above-target': 'Above target',
    'on-target': 'On target',
    'below-target': 'Below target',
    'no-target': 'No target',
};

const actionBadgeClass: Record<string, string> = {
    increase_budget: 'bg-green-100 text-green-700 ring-green-200',
    decrease_budget: 'bg-red-100 text-red-700 ring-red-200',
    maintain: 'bg-blue-100 text-blue-700 ring-blue-200',
    pause: 'bg-gray-800 text-white ring-gray-700',
};

const actionLabel: Record<string, string> = {
    increase_budget: 'Increase budget',
    decrease_budget: 'Decrease budget',
    maintain: 'Maintain',
    pause: 'Pause',
};
</script>

<template>
    <section class="space-y-4">
        <!-- Tooltip host for the D3 chart components (they append their
             tooltips into .dashboard-tooltip-container). -->
        <div class="dashboard-tooltip-container fixed inset-0 pointer-events-none z-[9999]"></div>
        <!-- Section header (interactive chrome — hidden when printing) -->
        <div class="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between print:hidden">
            <div class="min-w-0">
                <h3 class="text-base font-bold text-gray-900">AI Campaign Analysis{{ props.campaignName ? ` — ${props.campaignName}` : '' }}</h3>
                <p class="text-xs text-gray-500 mt-0.5">
                    Ready-made performance marketing analysis for this campaign, covering each ad group / ad set individually.
                    {{ analysis ? `Generated ${formatDate(analysis.generatedAt)}` : '' }}
                </p>
            </div>
            <div class="flex items-center gap-2 shrink-0">
                <button
                    type="button"
                    class="inline-flex items-center gap-2 whitespace-nowrap px-3 py-1.5 text-xs font-semibold text-white bg-primary-blue-100 rounded-lg hover:opacity-90 transition-opacity cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                    :disabled="isLoading"
                    @click="load(analysis !== null)"
                >
                    <font-awesome-icon :icon="['fas', 'wand-magic-sparkles']" class="w-3 h-3" />
                    {{ analysis === null ? 'Generate' : 'Regenerate' }}
                </button>
                <button
                    v-if="analysis"
                    type="button"
                    class="inline-flex items-center gap-2 whitespace-nowrap px-3 py-1.5 text-xs font-semibold text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors cursor-pointer"
                    @click="handlePrint"
                >
                    <font-awesome-icon :icon="['fas', 'print']" class="w-3 h-3" />
                    Print
                </button>
            </div>
        </div>

        <!-- Scope selector: entire campaign vs each ad group / ad set -->
        <div v-if="adSetScopes.length" class="bg-white border border-gray-200 rounded-xl p-4 print:hidden">
            <div class="flex flex-wrap items-center gap-2">
                <span class="text-xs font-semibold text-gray-500 mr-1">Analysis scope:</span>
                <button type="button" :class="scopeChipClass(selectedScope === null)" @click="selectScope(null)">
                    Entire Campaign
                </button>
                <button
                    v-for="as in adSetScopes"
                    :key="as.name"
                    type="button"
                    :class="scopeChipClass(selectedScope === as.name)"
                    @click="selectScope(as.name)"
                >
                    {{ as.name }}
                    <span class="font-normal opacity-80">{{ formatMoney(as.spend) }}</span>
                </button>
            </div>
            <p v-if="selectedScope !== null" class="text-xs text-gray-500 mt-2">
                Each ad group / ad set typically tests a different ad plan, so it gets its own dedicated report.
                <span v-if="!selectedScopeLoaded">Generating it now… (it is cached separately from the campaign report).</span>
            </p>
        </div>

        <!-- Loading -->
        <div v-if="isLoading" class="bg-white border border-gray-200 rounded-xl p-6 flex flex-col items-center justify-center text-center print:hidden">
            <div
                class="animate-spin rounded-full mb-3 w-10 h-10 border-4 border-blue-100 border-t-transparent"
            ></div>
            <p class="text-sm font-semibold text-gray-800">{{ selectedScope ? `Analyzing ${selectedScope}…` : 'Analyzing this campaign…' }}</p>
            <p class="text-xs text-gray-500 mt-1">
                The AI engine is reviewing ad sets, targets, spend efficiency and anomalies.
            </p>
            <p class="text-xs text-gray-400 mt-2">This can take up to 30–60 seconds. Results are cached for 1 hour.</p>
        </div>

        <!-- Error -->
        <div v-else-if="error" class="bg-red-50 border border-red-200 rounded-xl p-4 text-red-700 print:hidden">
            <p class="text-sm font-semibold mb-1">Something went wrong</p>
            <p class="text-xs">{{ error }}</p>
            <button
                type="button"
                class="mt-3 inline-flex items-center gap-2 px-3 py-1.5 text-xs font-semibold text-white bg-red-600 rounded-lg hover:bg-red-700 cursor-pointer"
                @click="load(true)"
            >
                Try again
            </button>
        </div>

        <!-- No data -->
        <div v-else-if="analysis && !analysis.sourceSummary.hasMarketingData" class="bg-white border border-gray-200 rounded-xl p-6 text-center print:hidden">
            <font-awesome-icon :icon="['fas', 'chart-line']" class="w-8 h-8 text-gray-300 mb-2" />
            <p class="text-sm font-semibold text-gray-800">{{ isAdSetScope ? 'No data for this ad group / ad set in the selected period' : 'No data for this campaign in the selected period' }}</p>
            <p class="text-xs text-gray-500 mt-1">
                Adjust the date range or check that this campaign has synced insights.
            </p>
        </div>

        <!-- Report -->
        <div v-else-if="analysis" class="space-y-4">
            <div class="bg-white border border-gray-200 rounded-xl p-5">
                <div class="flex flex-wrap items-start justify-between gap-3">
                    <div>
                        <h4 class="text-lg font-bold text-gray-900">{{ analysis.report.title }}</h4>
                        <p class="text-xs text-gray-500 mt-0.5">
                            {{ analysis.dateRange.start }} → {{ analysis.dateRange.end }}
                            · {{ formatDate(analysis.generatedAt) }}
                        </p>
                    </div>
                    <span
                        v-if="isAdSetScope && analysis.scope?.adSetName"
                        class="inline-flex items-center gap-1.5 px-3 py-1 text-xs font-semibold rounded-full bg-primary-blue-100/10 text-primary-blue-800 ring-1 ring-primary-blue-100"
                    >
                        <font-awesome-icon :icon="['fas', 'bullseye']" class="w-3 h-3" />
                        Ad Set: {{ analysis.scope.adSetName }}
                    </span>
                    <span
                        class="inline-flex items-center gap-1.5 px-3 py-1 text-xs font-semibold rounded-full ring-1"
                        :class="analysis.aiStatus === 'success' ? 'bg-green-100 text-green-700 ring-green-200' : 'bg-amber-100 text-amber-700 ring-amber-200'"
                    >
                        <font-awesome-icon :icon="['fas', analysis.aiStatus === 'success' ? 'robot' : 'circle-info']" class="w-3 h-3" />
                        {{ analysis.aiStatus === 'success' ? 'AI-generated analysis' : 'Data summary (AI unavailable)' }}
                    </span>
                </div>

                <div class="mt-4 bg-primary-blue-100/10 border border-primary-blue-100 rounded-lg p-4">
                    <h5 class="text-xs font-semibold text-primary-blue-800 mb-1.5">Executive Summary</h5>
                    <p class="text-sm leading-relaxed text-gray-700 whitespace-pre-line" v-html="renderInlineMarkdown(analysis.report.executiveSummary)"></p>
                </div>

                <div class="mt-4 grid grid-cols-2 sm:grid-cols-4 gap-3">
                    <div class="bg-gray-50 rounded-lg p-3 text-center">
                        <p class="text-lg font-bold text-gray-900">{{ formatMoney(analysis.sourceSummary.totalSpend) }}</p>
                        <p class="text-xs text-gray-500">Total spend</p>
                    </div>
                    <div class="bg-gray-50 rounded-lg p-3 text-center">
                        <p class="text-lg font-bold text-gray-900">{{ formatNumber(analysis.sourceSummary.totalConversions) }}</p>
                        <p class="text-xs text-gray-500">Conversions</p>
                    </div>
                    <div class="bg-gray-50 rounded-lg p-3 text-center">
                        <p class="text-lg font-bold text-gray-900">{{ analysis.sourceSummary.overallRoas != null ? `${formatNumber(analysis.sourceSummary.overallRoas, 2)}x` : '—' }}</p>
                        <p class="text-xs text-gray-500">Overall ROAS</p>
                    </div>
                    <div class="bg-gray-50 rounded-lg p-3 text-center">
                        <p class="text-lg font-bold text-gray-900">{{ formatNumber(analysis.sourceSummary.alertCount) }}</p>
                        <p class="text-xs text-gray-500">Alerts</p>
                    </div>
                </div>
            </div>

            <!-- Charts -->
            <div v-if="!isAdSetScope" class="bg-white border border-gray-200 rounded-xl p-5">
                <h5 class="text-sm font-bold text-gray-900 mb-3">Performance Charts</h5>
                <div class="grid grid-cols-1 xl:grid-cols-2 gap-5">
                    <div>
                        <h6 class="text-xs font-semibold text-gray-700 mb-1.5">{{ charts.channelSpend?.title }}</h6>
                        <ClientOnly>
                            <vertical-bar-chart
                                v-if="channelSpendData.length"
                                chart-id="ai-campaign-channel-spend"
                                :data="channelSpendData"
                                x-axis-label="Channel"
                                y-axis-label="Spend ($)"
                                :height="260"
                                :editable-axis-labels="false"
                            />
                            <p v-else class="text-xs text-gray-400 py-6 text-center">No channel spend data.</p>
                        </ClientOnly>
                    </div>
                    <div>
                        <h6 class="text-xs font-semibold text-gray-700 mb-1.5">{{ charts.spendAllocation?.title }}</h6>
                        <ClientOnly>
                            <div v-if="spendAllocationData.length">
                                <div class="mx-auto max-w-[220px]">
                                    <donut-chart
                                        chart-id="ai-campaign-spend-allocation"
                                        :data="spendAllocationData"
                                        :width="360"
                                        :height="280"
                                        :inner-radius="38"
                                        :show-labels="true"
                                        :label-font-size="12"
                                    />
                                </div>
                                <ul class="mt-3 space-y-1.5">
                                    <li
                                        v-for="item in spendAllocationLegend"
                                        :key="item.label"
                                        class="flex items-center justify-between gap-2 text-xs"
                                    >
                                        <span class="flex items-center gap-2 min-w-0">
                                            <span class="w-2.5 h-2.5 rounded-full shrink-0" :style="{ backgroundColor: item.color }"></span>
                                            <span class="truncate text-gray-700">{{ item.label }}</span>
                                        </span>
                                        <span class="shrink-0 text-gray-500">{{ item.percent }}% · {{ formatMoney(item.value) }}</span>
                                    </li>
                                </ul>
                            </div>
                            <p v-else class="text-xs text-gray-400 py-6 text-center">No spend allocation data.</p>
                        </ClientOnly>
                    </div>
                    <div>
                        <h6 class="text-xs font-semibold text-gray-700 mb-1.5">{{ charts.weeklyTrend?.title }}</h6>
                        <ClientOnly>
                            <multi-line-chart
                                v-if="weeklyTrendData.categories?.length"
                                chart-id="ai-campaign-weekly-trend"
                                :data="weeklyTrendData"
                                x-axis-label="Week"
                                y-axis-label="Spend ($)"
                                :height="260"
                                :show-data-points="true"
                                :enable-tooltips="true"
                                :editable-axis-labels="false"
                                :x-axis-rotation="-45"
                            />
                            <p v-else class="text-xs text-gray-400 py-6 text-center">No weekly trend data.</p>
                        </ClientOnly>
                    </div>
                    <div>
                        <h6 class="text-xs font-semibold text-gray-700 mb-1.5">{{ charts.dailySpend?.title }}</h6>
                        <ClientOnly>
                            <multi-line-chart
                                v-if="dailySpendChartData.categories?.length"
                                chart-id="ai-campaign-daily-spend"
                                :data="dailySpendChartData"
                                x-axis-label="Date"
                                y-axis-label="Spend ($)"
                                :height="260"
                                :show-data-points="true"
                                :enable-tooltips="true"
                                :editable-axis-labels="false"
                                :x-axis-rotation="-45"
                            />
                            <p v-else class="text-xs text-gray-400 py-6 text-center">No daily trend data.</p>
                        </ClientOnly>
                    </div>
                    <div>
                        <h6 class="text-xs font-semibold text-gray-700 mb-1.5">{{ charts.adSetPerformance?.title }}</h6>
                        <ClientOnly>
                            <bubble-chart
                                v-if="adSetPerformanceData.length"
                                chart-id="ai-campaign-adset-performance"
                                :data="adSetPerformanceData"
                                x-column-name="Spend"
                                y-column-name="ROAS"
                                size-column-name="Conversions"
                                label-column-name="Ad Set"
                                :width="560"
                                :height="260"
                            />
                            <p v-else class="text-xs text-gray-400 py-6 text-center">No ad set / ad group breakdown data.</p>
                        </ClientOnly>
                    </div>
                </div>
            </div>

            <!-- Demographics & devices charts -->
            <div v-if="!isAdSetScope" class="bg-white border border-gray-200 rounded-xl p-5">
                <h5 class="text-sm font-bold text-gray-900 mb-1">Demographics &amp; Devices</h5>
                <p class="text-xs text-gray-500 mb-3">Spend distribution by audience and delivery.</p>
                <div class="grid grid-cols-1 xl:grid-cols-2 gap-5">
                    <div>
                        <h6 class="text-xs font-semibold text-gray-700 mb-1.5">{{ charts.spendByAge?.title }}</h6>
                        <ClientOnly>
                            <vertical-bar-chart
                                v-if="spendByAgeData.length"
                                chart-id="ai-campaign-spend-age"
                                :data="spendByAgeData"
                                x-axis-label="Age"
                                y-axis-label="Spend ($)"
                                :height="260"
                                :editable-axis-labels="false"
                            />
                            <p v-else class="text-xs text-gray-400 py-6 text-center">No age breakdown data.</p>
                        </ClientOnly>
                    </div>
                    <div>
                        <h6 class="text-xs font-semibold text-gray-700 mb-1.5">{{ charts.spendByGender?.title }}</h6>
                        <ClientOnly>
                            <vertical-bar-chart
                                v-if="spendByGenderData.length"
                                chart-id="ai-campaign-spend-gender"
                                :data="spendByGenderData"
                                x-axis-label="Gender"
                                y-axis-label="Spend ($)"
                                :height="260"
                                :editable-axis-labels="false"
                            />
                            <p v-else class="text-xs text-gray-400 py-6 text-center">No gender breakdown data.</p>
                        </ClientOnly>
                    </div>
                    <div>
                        <h6 class="text-xs font-semibold text-gray-700 mb-1.5">{{ charts.spendByDevice?.title }}</h6>
                        <ClientOnly>
                            <vertical-bar-chart
                                v-if="spendByDeviceData.length"
                                chart-id="ai-campaign-spend-device"
                                :data="spendByDeviceData"
                                x-axis-label="Device"
                                y-axis-label="Spend ($)"
                                :height="260"
                                :editable-axis-labels="false"
                            />
                            <p v-else class="text-xs text-gray-400 py-6 text-center">No device breakdown data.</p>
                        </ClientOnly>
                    </div>
                    <div>
                        <h6 class="text-xs font-semibold text-gray-700 mb-1.5">{{ charts.spendByPlatform?.title }}</h6>
                        <ClientOnly>
                            <vertical-bar-chart
                                v-if="spendByPlatformData.length"
                                chart-id="ai-campaign-spend-platform"
                                :data="spendByPlatformData"
                                x-axis-label="Platform"
                                y-axis-label="Spend ($)"
                                :height="260"
                                :editable-axis-labels="false"
                            />
                            <p v-else class="text-xs text-gray-400 py-6 text-center">No platform / placement breakdown data.</p>
                        </ClientOnly>
                    </div>
                </div>
            </div>

            <!-- Target vs actual -->
            <div v-if="analysis.targetComparison.length" class="bg-white border border-gray-200 rounded-xl p-5">
                <h5 class="text-sm font-bold text-gray-900 mb-1">Performance vs Targets</h5>
                <p class="text-xs text-gray-500 mb-3">Actuals compared against the campaign and ad set targets you defined.</p>
                <div class="overflow-x-auto">
                    <table class="min-w-full text-sm">
                        <thead>
                            <tr class="text-left text-xs uppercase tracking-wide text-gray-500 border-b border-gray-200">
                                <th class="px-3 py-2 font-semibold">Entity</th>
                                <th class="px-3 py-2 font-semibold">Level</th>
                                <th class="px-3 py-2 font-semibold text-right">Spend</th>
                                <th class="px-3 py-2 font-semibold text-right">Conv. (T/A)</th>
                                <th class="px-3 py-2 font-semibold text-right">ROAS (T/A)</th>
                                <th class="px-3 py-2 font-semibold text-right">CPA (T/A)</th>
                                <th class="px-3 py-2 font-semibold">Status</th>
                            </tr>
                        </thead>
                        <tbody>
                            <tr v-for="row in analysis.targetComparison" :key="`${row.level}-${row.entity}`" class="border-b border-gray-100">
                                <td class="px-3 py-2 font-medium text-gray-800">{{ row.entity }}</td>
                                <td class="px-3 py-2 text-gray-500 capitalize">{{ row.level }}</td>
                                <td class="px-3 py-2 text-right text-gray-700">{{ formatMoney(row.spend) }}</td>
                                <td class="px-3 py-2 text-right text-gray-700">
                                    {{ row.conversionsTarget != null ? formatNumber(row.conversionsTarget) : '—' }}
                                    /
                                    {{ formatNumber(row.conversions) }}
                                </td>
                                <td class="px-3 py-2 text-right text-gray-700">
                                    {{ row.roasTarget != null ? `${formatNumber(row.roasTarget, 2)}x` : '—' }}
                                    /
                                    {{ row.roas != null ? `${formatNumber(row.roas, 2)}x` : '—' }}
                                </td>
                                <td class="px-3 py-2 text-right text-gray-700">
                                    {{ row.cpaTarget != null ? formatMoney(row.cpaTarget) : '—' }}
                                    /
                                    {{ row.cpa != null ? formatMoney(row.cpa) : '—' }}
                                </td>
                                <td class="px-3 py-2">
                                    <span
                                        class="inline-flex items-center px-2 py-0.5 text-xs font-semibold rounded-full ring-1"
                                        :class="statusBadgeClass[row.status]"
                                    >
                                        {{ statusLabel[row.status] }}
                                    </span>
                                </td>
                            </tr>
                        </tbody>
                    </table>
                </div>
            </div>

            <!-- AI narrative sections -->
            <div v-if="analysis.report.sections.length" class="bg-white border border-gray-200 rounded-xl p-5">
                <h5 class="text-sm font-bold text-gray-900 mb-3">Analysis by Ad Group / Ad Set</h5>
                <div class="space-y-5">
                    <div v-for="section in analysis.report.sections" :key="section.heading">
                        <h6 class="text-xs font-bold text-gray-800 mb-1.5">{{ section.heading }}</h6>
                        <div class="prose prose-sm max-w-none text-gray-700 leading-relaxed" v-html="renderMarkdown(section.content)" />
                        <ul v-if="section.recommendations?.length" class="mt-2.5 space-y-1.5">
                            <li
                                v-for="(rec, i) in section.recommendations"
                                :key="i"
                                class="flex items-start gap-2 text-sm text-gray-700"
                            >
                                <font-awesome-icon :icon="['fas', 'lightbulb']" class="w-3.5 h-3.5 text-amber-500 mt-0.5 shrink-0" />
                                <span class="leading-relaxed" v-html="renderInlineMarkdown(rec)"></span>
                            </li>
                        </ul>
                    </div>
                </div>
            </div>

            <!-- Spend recommendations -->
            <div v-if="analysis.report.spendRecommendations.length" class="bg-white border border-gray-200 rounded-xl p-5">
                <h5 class="text-sm font-bold text-gray-900 mb-1">Spend Recommendations</h5>
                <p class="text-xs text-gray-500 mb-3">Where to allocate budget — which ad sets / ad groups to scale, maintain, cut, or pause.</p>
                <div class="grid grid-cols-1 md:grid-cols-2 gap-3">
                    <div
                        v-for="rec in analysis.report.spendRecommendations"
                        :key="`${rec.entityType}-${rec.entity}`"
                        class="border border-gray-200 rounded-lg p-4 flex flex-col gap-2"
                    >
                        <div class="flex items-start justify-between gap-2">
                            <div class="min-w-0">
                                <p class="text-sm font-semibold text-gray-900 truncate">{{ rec.entity }}</p>
                                <p class="text-xs text-gray-500 capitalize">{{ rec.entityType }} · Current spend: {{ formatMoney(rec.currentSpend) }}</p>
                            </div>
                            <span
                                class="shrink-0 inline-flex items-center px-2.5 py-1 text-xs font-semibold rounded-full ring-1"
                                :class="actionBadgeClass[rec.action]"
                            >
                                {{ actionLabel[rec.action] }}
                            </span>
                        </div>
                        <p v-if="rec.suggestedAllocation" class="text-sm font-medium text-gray-800">
                            Suggested allocation: {{ rec.suggestedAllocation }}
                        </p>
                        <p class="text-sm text-gray-600 leading-relaxed" v-html="renderInlineMarkdown(rec.rationale)"></p>
                    </div>
                </div>
            </div>

            <!-- Risks & next steps -->
            <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div v-if="analysis.report.risksAndAlerts.length" class="bg-white border border-gray-200 rounded-xl p-5">
                    <h5 class="text-sm font-bold text-gray-900 mb-1">Risks &amp; Alerts</h5>
                    <p class="text-xs text-gray-500 mb-2.5">Watch-outs the team should act on.</p>
                    <ul class="space-y-2">
                        <li
                            v-for="(risk, i) in analysis.report.risksAndAlerts"
                            :key="i"
                            class="flex items-start gap-2 text-sm text-gray-700"
                        >
                            <font-awesome-icon :icon="['fas', 'triangle-exclamation']" class="w-3.5 h-3.5 text-red-500 mt-0.5 shrink-0" />
                            <span class="leading-relaxed" v-html="renderInlineMarkdown(risk)"></span>
                        </li>
                    </ul>
                </div>
                <div v-if="analysis.report.nextSteps.length" class="bg-white border border-gray-200 rounded-xl p-5">
                    <h5 class="text-sm font-bold text-gray-900 mb-1">Recommended Next Steps</h5>
                    <p class="text-xs text-gray-500 mb-2.5">A short action plan for the marketing team.</p>
                    <ol class="space-y-2">
                        <li
                            v-for="(step, i) in analysis.report.nextSteps"
                            :key="i"
                            class="flex items-start gap-2 text-sm text-gray-700"
                        >
                            <span class="shrink-0 inline-flex items-center justify-center w-5 h-5 rounded-full bg-primary-blue-100 text-white text-xs font-bold mt-0.5">
                                {{ i + 1 }}
                            </span>
                            <span class="leading-relaxed" v-html="renderInlineMarkdown(step)"></span>
                        </li>
                    </ol>
                </div>
            </div>
        </div>
    </section>
</template>
