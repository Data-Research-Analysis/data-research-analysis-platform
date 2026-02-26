<script setup lang="ts">
import { useMarketingHubStore } from '@/stores/marketingHub';
import { useCampaignsStore } from '@/stores/campaigns';
import type { IMarketingTotals } from '~/types/IMarketingHub';

definePageMeta({ layout: 'marketing-project' });

const route = useRoute();
const marketingHubStore = useMarketingHubStore();
const campaignsStore = useCampaignsStore();

const projectId = computed(() => parseInt(String(route.params.projectid)));

// ---------------------------------------------------------------------------
// Date range controls (set in onMounted to avoid SSR with new Date())
// ---------------------------------------------------------------------------
const startDateInput = ref('');
const endDateInput = ref('');

function isoToInput(d: Date): string {
    return d.toISOString().split('T')[0];
}

function applyDateRange() {
    const s = new Date(startDateInput.value);
    const e = new Date(endDateInput.value);
    if (isNaN(s.getTime()) || isNaN(e.getTime())) return;
    marketingHubStore.setDateRange(s, e);
    loadData();
}

// ---------------------------------------------------------------------------
// Campaign filter
// ---------------------------------------------------------------------------
const campaignFilterId = ref<number | null>(null);

const campaignOptions = computed(() => {
    return campaignsStore.campaigns.filter(c => c.project_id === projectId.value);
});

function onCampaignFilterChange() {
    marketingHubStore.setCampaignFilter(campaignFilterId.value);
    loadData();
}

// ---------------------------------------------------------------------------
// Derived state
// ---------------------------------------------------------------------------
const summary = computed(() => marketingHubStore.hubSummary);
const topCampaigns = computed(() => marketingHubStore.topCampaigns);
const isLoading = computed(() => marketingHubStore.isLoading);
const error = computed(() => marketingHubStore.error);
const hasData = computed(() => summary.value && summary.value.channels.length > 0);

// KPI deltas
function calcDelta(current: number, prior: number): number | null {
    if (prior === 0) return null;
    return (current - prior) / prior;
}

const totals = computed<IMarketingTotals>(() =>
    summary.value?.totals ?? { spend: 0, impressions: 0, clicks: 0, conversions: 0, cpl: 0, pipelineValue: 0 },
);

const priorTotals = computed<IMarketingTotals>(() =>
    summary.value?.priorPeriodTotals ?? { spend: 0, impressions: 0, clicks: 0, conversions: 0, cpl: 0, pipelineValue: 0 },
);

const kpiCards = computed(() => [
    {
        label: 'Total Spend',
        value: totals.value.spend,
        format: 'currency' as const,
        delta: calcDelta(totals.value.spend, priorTotals.value.spend),
        icon: ['fas', 'dollar-sign'],
    },
    {
        label: 'Total Impressions',
        value: totals.value.impressions,
        format: 'number' as const,
        delta: calcDelta(totals.value.impressions, priorTotals.value.impressions),
        icon: ['fas', 'eye'],
    },
    {
        label: 'Total Clicks',
        value: totals.value.clicks,
        format: 'number' as const,
        delta: calcDelta(totals.value.clicks, priorTotals.value.clicks),
        icon: ['fas', 'computer-mouse'],
    },
    {
        label: 'Total Leads',
        value: totals.value.conversions,
        format: 'number' as const,
        delta: calcDelta(totals.value.conversions, priorTotals.value.conversions),
        icon: ['fas', 'user-plus'],
    },
    {
        label: 'Blended CPL',
        value: totals.value.cpl,
        format: 'currency' as const,
        // CPL: lower is better — invert delta
        delta:
            priorTotals.value.cpl > 0
                ? -calcDelta(totals.value.cpl, priorTotals.value.cpl)!
                : null,
        icon: ['fas', 'tags'],
    },
    {
        label: 'Pipeline Value',
        value: totals.value.pipelineValue,
        format: 'currency' as const,
        delta: calcDelta(totals.value.pipelineValue, priorTotals.value.pipelineValue),
        icon: ['fas', 'funnel-dollar'],
    },
]);

// ---------------------------------------------------------------------------
// Top campaigns helpers
// ---------------------------------------------------------------------------
function statusBadgeClass(status: string): string {
    const map: Record<string, string> = {
        active: 'bg-green-100 text-green-700',
        paused: 'bg-yellow-100 text-yellow-700',
        enabled: 'bg-green-100 text-green-700',
        removed: 'bg-red-100 text-red-500',
    };
    return map[status?.toLowerCase()] ?? 'bg-gray-100 text-gray-600';
}

function fmtCurrency(v: number): string {
    if (v >= 1_000_000) return `$${(v / 1_000_000).toFixed(1)}M`;
    if (v >= 1_000) return `$${(v / 1_000).toFixed(1)}k`;
    return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(v);
}

// ---------------------------------------------------------------------------
// Load data
// ---------------------------------------------------------------------------
async function loadData() {
    await Promise.all([
        marketingHubStore.retrieveHubSummary(projectId.value),
        marketingHubStore.retrieveTopCampaigns(projectId.value),
    ]);
}

onMounted(async () => {
    // Set defaults for date range (client-only to avoid SSR issues)
    const today = new Date();
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(today.getDate() - 30);

    startDateInput.value = isoToInput(thirtyDaysAgo);
    endDateInput.value = isoToInput(today);
    marketingHubStore.setDateRange(thirtyDaysAgo, today);

    await campaignsStore.retrieveCampaigns(projectId.value);
    await loadData();
});
</script>

<template>
    <div class="p-6 space-y-6">
        <!-- Page header -->
        <div class="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div>
                <h1 class="text-xl font-bold text-gray-900">Marketing Hub</h1>
                <p class="text-sm text-gray-500 mt-0.5">Cross-channel performance across all connected ad sources</p>
            </div>

            <!-- Filters row -->
            <div class="flex flex-wrap items-center gap-3">
                <!-- Date range -->
                <div class="flex items-center gap-1.5">
                    <input
                        v-model="startDateInput"
                        type="date"
                        class="text-sm border border-gray-200 rounded-lg px-3 py-1.5 focus:outline-none focus:ring-2 focus:ring-primary-blue-100 text-gray-700"
                        @change="applyDateRange"
                    />
                    <span class="text-gray-400 text-sm">to</span>
                    <input
                        v-model="endDateInput"
                        type="date"
                        class="text-sm border border-gray-200 rounded-lg px-3 py-1.5 focus:outline-none focus:ring-2 focus:ring-primary-blue-100 text-gray-700"
                        @change="applyDateRange"
                    />
                </div>

                <!-- Campaign filter -->
                <select
                    v-model.number="campaignFilterId"
                    class="text-sm border border-gray-200 rounded-lg px-3 py-1.5 focus:outline-none focus:ring-2 focus:ring-primary-blue-100 text-gray-700 bg-white"
                    @change="onCampaignFilterChange"
                >
                    <option :value="null">All Campaigns</option>
                    <option
                        v-for="c in campaignOptions"
                        :key="c.id"
                        :value="c.id"
                    >
                        {{ c.name }}
                    </option>
                </select>
            </div>
        </div>

        <!-- Error banner -->
        <div v-if="error" class="rounded-lg bg-red-50 border border-red-200 px-4 py-3 flex items-center gap-3 text-sm text-red-600">
            <font-awesome-icon :icon="['fas', 'triangle-exclamation']" />
            {{ error }}
        </div>

        <!-- Empty state: no data sources connected -->
        <div v-if="!isLoading && !hasData && !error" class="rounded-xl border border-dashed border-gray-300 bg-gray-50 flex flex-col items-center justify-center py-16 text-center px-6">
            <font-awesome-icon :icon="['fas', 'plug']" class="text-4xl text-gray-300 mb-4" />
            <h2 class="text-base font-semibold text-gray-600">No ad data sources connected</h2>
            <p class="text-sm text-gray-400 mt-1 max-w-sm">
                Connect Google Ads, Meta Ads, or LinkedIn Ads to see your cross-channel performance here.
            </p>
            <NuxtLink
                :to="`/marketing-projects/${projectId}/data-sources`"
                class="mt-5 inline-flex items-center gap-2 bg-primary-blue-100 text-white text-sm font-medium px-4 py-2 rounded-lg hover:opacity-90 transition-opacity"
            >
                <font-awesome-icon :icon="['fas', 'plus']" />
                Connect a Data Source
            </NuxtLink>
        </div>

        <template v-else>
            <!-- ── KPI Cards ─────────────────────────────────────────────── -->
            <div class="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4">
                <MarketingKpiCard
                    v-for="card in kpiCards"
                    :key="card.label"
                    :label="card.label"
                    :value="card.value"
                    :format="card.format"
                    :delta="card.delta"
                    :icon="card.icon"
                    :is-loading="isLoading"
                />
            </div>

            <!-- ── Channel Mix + Weekly Trend ────────────────────────────── -->
            <div class="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <ChannelMixChart
                    :channels="summary?.channels ?? []"
                    :is-loading="isLoading"
                />
                <WeeklySpendChart
                    :trend="summary?.weeklyTrend ?? []"
                    :is-loading="isLoading"
                />
            </div>

            <!-- ── Channel Comparison Table ──────────────────────────────── -->
            <ChannelComparisonTable
                :channels="summary?.channels ?? []"
                :is-loading="isLoading"
            />

            <!-- ── Top 5 Campaigns ───────────────────────────────────────── -->
            <div class="bg-white rounded-xl border border-gray-200 overflow-hidden">
                <div class="px-5 py-4 border-b border-gray-100 flex items-center gap-2">
                    <font-awesome-icon :icon="['fas', 'trophy']" class="text-primary-blue-100" />
                    <h3 class="text-sm font-semibold text-gray-700">Top Campaigns by Spend</h3>
                </div>

                <!-- Loading -->
                <div v-if="isLoading" class="p-5 space-y-3">
                    <div v-for="i in 5" :key="i" class="h-8 rounded bg-gray-100 animate-pulse"></div>
                </div>

                <!-- Empty -->
                <div v-else-if="topCampaigns.length === 0" class="flex flex-col items-center py-10 text-center px-6">
                    <font-awesome-icon :icon="['fas', 'circle-info']" class="text-2xl text-gray-300 mb-2" />
                    <p class="text-sm text-gray-400">No campaign data found for this period</p>
                </div>

                <!-- List -->
                <ul v-else class="divide-y divide-gray-100">
                    <li
                        v-for="(campaign, idx) in topCampaigns"
                        :key="campaign.campaignId"
                        class="flex items-center gap-4 px-5 py-3 hover:bg-gray-50 transition-colors"
                    >
                        <span class="text-sm font-bold text-gray-400 w-4 flex-shrink-0">{{ idx + 1 }}</span>
                        <div class="flex-1 min-w-0">
                            <p class="text-sm font-medium text-gray-800 truncate">{{ campaign.campaignName }}</p>
                        </div>
                        <span
                            class="text-xs font-medium px-2 py-0.5 rounded-full flex-shrink-0"
                            :class="statusBadgeClass(campaign.status)"
                        >
                            {{ campaign.status }}
                        </span>
                        <div class="text-right flex-shrink-0">
                            <p class="text-sm font-semibold text-gray-800">{{ fmtCurrency(campaign.spend) }}</p>
                            <p class="text-xs text-gray-400">
                                CPL {{ campaign.cpl > 0 ? fmtCurrency(campaign.cpl) : '—' }}
                            </p>
                        </div>
                    </li>
                </ul>
            </div>
        </template>
    </div>
</template>
