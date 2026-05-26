<script setup lang="ts">
/**
 * Intelligence Hub — the unified analytics landing page (TICKET NAV-001).
 *
 * Route: /projects/:projectid/intelligence
 *
 * This page acts as a single-page tab shell. The active tab is driven by
 * the URL hash (#overview, #campaigns, #attribution, #reports, #insights,
 * #settings).  Each tab renders its corresponding child component inline.
 *
 * Tab content stubs are placeholder components that will be replaced as
 * subsequent tickets (NAV-002 … NAV-010) land.
 */
import { useMarketingHubStore } from '@/stores/marketingHub';
import { useCampaignsStore } from '@/stores/campaigns';
import type { IMarketingTotals } from '~/types/IMarketingHub';

definePageMeta({ layout: 'project' });

const route = useRoute();
const router = useRouter();
const marketingHubStore = useMarketingHubStore();
const campaignsStore = useCampaignsStore();

const projectId = computed(() => parseInt(String(route.params.projectid)));

// ---------------------------------------------------------------------------
// Tab state — synchronised with URL hash
// ---------------------------------------------------------------------------
type TabId = 'overview' | 'campaigns' | 'attribution' | 'reports' | 'insights' | 'settings';

const VALID_TABS: TabId[] = ['overview', 'campaigns', 'attribution', 'reports', 'insights', 'settings'];

const activeTab = ref<TabId>('overview');

/** Read the initial tab from the URL hash (client-safe). */
function readHash(): TabId {
    if (!import.meta.client) return 'overview';
    const hash = window.location.hash.replace('#', '') as TabId;
    return VALID_TABS.includes(hash) ? hash : 'overview';
}

/** Push the tab id into the URL hash without scrolling. */
function writeHash(tabId: TabId) {
    if (!import.meta.client) return;
    const url = new URL(window.location.href);
    url.hash = tabId;
    history.replaceState(history.state, '', url.toString());
}

// Initialise from hash
onMounted(() => {
    activeTab.value = readHash();
});

// Keep in sync when the browser back/forward buttons change the hash
function onHashChange() {
    activeTab.value = readHash();
}
onMounted(() => window.addEventListener('hashchange', onHashChange));
onUnmounted(() => window.removeEventListener('hashchange', onHashChange));

function onTabChange(tabId: string) {
    activeTab.value = tabId as TabId;
    writeHash(tabId as TabId);
}

// ---------------------------------------------------------------------------
// Overview tab data — re-uses Marketing Hub store (same as old /marketing page)
// ---------------------------------------------------------------------------
const startDateInput = ref('');
const endDateInput = ref('');
const campaignFilterId = ref<number | null>(null);

const campaignOptions = computed(() =>
    campaignsStore.campaigns.filter(c => c.project_id === projectId.value),
);

const summary = computed(() => marketingHubStore.hubSummary);
const topCampaigns = computed(() => marketingHubStore.topCampaigns);
const isLoading = computed(() => marketingHubStore.isLoading);
const error = computed(() => marketingHubStore.error);
const hasData = computed(() => summary.value && summary.value.channels.length > 0);

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
    { label: 'Total Spend',        value: totals.value.spend,        format: 'currency' as const, delta: calcDelta(totals.value.spend, priorTotals.value.spend),        icon: ['fas', 'dollar-sign'] },
    { label: 'Total Impressions',  value: totals.value.impressions,  format: 'number'   as const, delta: calcDelta(totals.value.impressions, priorTotals.value.impressions), icon: ['fas', 'eye'] },
    { label: 'Total Clicks',       value: totals.value.clicks,       format: 'number'   as const, delta: calcDelta(totals.value.clicks, priorTotals.value.clicks),       icon: ['fas', 'computer-mouse'] },
    { label: 'Total Leads',        value: totals.value.conversions,  format: 'number'   as const, delta: calcDelta(totals.value.conversions, priorTotals.value.conversions), icon: ['fas', 'user-plus'] },
    {
        label: 'Blended CPL', value: totals.value.cpl, format: 'currency' as const,
        delta: priorTotals.value.cpl > 0 ? -calcDelta(totals.value.cpl, priorTotals.value.cpl)! : null,
        icon: ['fas', 'tags'],
    },
    { label: 'Pipeline Value',     value: totals.value.pipelineValue, format: 'currency' as const, delta: calcDelta(totals.value.pipelineValue, priorTotals.value.pipelineValue), icon: ['fas', 'funnel-dollar'] },
]);

function isoToInput(d: Date): string {
    return d.toISOString().split('T')[0];
}

function applyDateRange() {
    const s = new Date(startDateInput.value);
    const e = new Date(endDateInput.value);
    if (isNaN(s.getTime()) || isNaN(e.getTime())) return;
    marketingHubStore.setDateRange(s, e);
    loadOverviewData();
}

function onCampaignFilterChange() {
    marketingHubStore.setCampaignFilter(campaignFilterId.value);
    loadOverviewData();
}

async function loadOverviewData() {
    await Promise.all([
        marketingHubStore.retrieveHubSummary(projectId.value),
        marketingHubStore.retrieveTopCampaigns(projectId.value),
    ]);
}

// ---------------------------------------------------------------------------
// IntelligenceOverview event handlers
// ---------------------------------------------------------------------------
function handleRefresh() {
    loadOverviewData();
}

function handleRangeChange(range: { start: Date; end: Date; preset: string }) {
    marketingHubStore.setDateRange(range.start, range.end);
    loadOverviewData();
}

// Top campaigns helpers
function platformIcon(platform: string): [string, string] {
    switch (platform) {
        case 'google_ads':   return ['fab', 'google'];
        case 'linkedin_ads': return ['fab', 'linkedin'];
        case 'meta_ads':     return ['fab', 'meta'];
        default:             return ['fas', 'chart-bar'];
    }
}

function platformColour(platform: string): string {
    switch (platform) {
        case 'google_ads':   return 'text-blue-500';
        case 'linkedin_ads': return 'text-blue-700';
        case 'meta_ads':     return 'text-blue-600';
        default:             return 'text-gray-400';
    }
}

function statusBadgeClass(status: string): string {
    const s = status?.toLowerCase();
    if (s === 'enabled' || s === 'active')    return 'bg-green-100 text-green-700';
    if (s === 'paused')                       return 'bg-yellow-100 text-yellow-700';
    if (s === 'draft')                        return 'bg-gray-100 text-gray-500';
    if (s === 'archived' || s === 'removed' || s === 'deleted') return 'bg-red-100 text-red-600';
    return 'bg-gray-100 text-gray-600';
}

function fmtCurrency(v: number): string {
    if (v >= 1_000_000) return `$${(v / 1_000_000).toFixed(1)}M`;
    if (v >= 1_000) return `$${(v / 1_000).toFixed(1)}k`;
    return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(v);
}

// Load initial data
onMounted(async () => {
    const today = new Date();
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(today.getDate() - 30);

    startDateInput.value = isoToInput(thirtyDaysAgo);
    endDateInput.value = isoToInput(today);
    marketingHubStore.setDateRange(thirtyDaysAgo, today);

    await campaignsStore.retrieveCampaigns(projectId.value);
    await loadOverviewData();
});
</script>

<template>
    <IntelligenceHubLayout>
        <!-- Page title -->
        <div class="px-4 pt-4 md:px-6 md:pt-6 pb-0">
            <h1 class="text-xl font-bold text-gray-900">Intelligence Hub</h1>
            <p class="text-sm text-gray-500 mt-0.5">
                Unified view of marketing analytics, attribution, reports, and AI insights
            </p>
        </div>

        <!-- Layout: vertical sidebar tabs on desktop, horizontal strip on mobile -->
        <div class="flex flex-col md:flex-row flex-1 min-h-0">
            <IntelligenceHubTabs
                :active-tab="activeTab"
                @update:active-tab="onTabChange"
            />

            <!-- Tab content area -->
            <div class="flex-1 min-w-0 p-4 md:p-6 overflow-y-auto">

                <!-- ═══════════════════════════════════════════════════════ -->
                <!-- OVERVIEW TAB                                          -->
                <!-- ═══════════════════════════════════════════════════════ -->
                <div v-if="activeTab === 'overview'">
                    <IntelligenceOverview
                        :project-id="Number(projectId)"
                        :has-data="!!hasData"
                        :is-loading="isLoading"
                        @refresh="handleRefresh"
                        @update:range="handleRangeChange"
                    />
                </div>

                <!-- ═══════════════════════════════════════════════════════ -->
                <!-- CAMPAIGNS TAB                                         -->
                <!-- ═══════════════════════════════════════════════════════ -->
                <div v-else-if="activeTab === 'campaigns'" class="flex flex-col items-center justify-center py-20 text-center">
                    <font-awesome-icon :icon="['fas', 'bullhorn']" class="text-4xl text-gray-300 mb-4" />
                    <h2 class="text-lg font-semibold text-gray-600">Campaigns</h2>
                    <p class="text-sm text-gray-400 mt-1 max-w-sm">
                        Campaign management will be consolidated here. For now, use the sidebar Campaigns link.
                    </p>
                    <NuxtLink
                        :to="`/projects/${projectId}/campaigns`"
                        class="mt-4 inline-flex items-center gap-2 text-primary-blue-100 text-sm font-medium hover:underline"
                    >
                        Go to Campaigns
                        <font-awesome-icon :icon="['fas', 'arrow-right']" class="w-3 h-3" />
                    </NuxtLink>
                </div>

                <!-- ═══════════════════════════════════════════════════════ -->
                <!-- ATTRIBUTION TAB                                       -->
                <!-- ═══════════════════════════════════════════════════════ -->
                <div v-else-if="activeTab === 'attribution'" class="flex flex-col items-center justify-center py-20 text-center">
                    <font-awesome-icon :icon="['fas', 'diagram-project']" class="text-4xl text-gray-300 mb-4" />
                    <h2 class="text-lg font-semibold text-gray-600">Attribution</h2>
                    <p class="text-sm text-gray-400 mt-1 max-w-sm">
                        Multi-touch attribution models will be available here. For now, use the sidebar Attribution link.
                    </p>
                    <NuxtLink
                        :to="`/projects/${projectId}/marketing/attribution`"
                        class="mt-4 inline-flex items-center gap-2 text-primary-blue-100 text-sm font-medium hover:underline"
                    >
                        Go to Attribution
                        <font-awesome-icon :icon="['fas', 'arrow-right']" class="w-3 h-3" />
                    </NuxtLink>
                </div>

                <!-- ═══════════════════════════════════════════════════════ -->
                <!-- REPORTS TAB                                           -->
                <!-- ═══════════════════════════════════════════════════════ -->
                <div v-else-if="activeTab === 'reports'" class="flex flex-col items-center justify-center py-20 text-center">
                    <font-awesome-icon :icon="['fas', 'file-chart-column']" class="text-4xl text-gray-300 mb-4" />
                    <h2 class="text-lg font-semibold text-gray-600">Reports</h2>
                    <p class="text-sm text-gray-400 mt-1 max-w-sm">
                        Reporting engine with custom report builder will live here. For now, use the sidebar Reports link.
                    </p>
                    <NuxtLink
                        :to="`/projects/${projectId}/marketing/reports`"
                        class="mt-4 inline-flex items-center gap-2 text-primary-blue-100 text-sm font-medium hover:underline"
                    >
                        Go to Reports
                        <font-awesome-icon :icon="['fas', 'arrow-right']" class="w-3 h-3" />
                    </NuxtLink>
                </div>

                <!-- ═══════════════════════════════════════════════════════ -->
                <!-- AI INSIGHTS TAB                                       -->
                <!-- ═══════════════════════════════════════════════════════ -->
                <div v-else-if="activeTab === 'insights'" class="flex flex-col items-center justify-center py-20 text-center">
                    <font-awesome-icon :icon="['fas', 'robot']" class="text-4xl text-gray-300 mb-4" />
                    <h2 class="text-lg font-semibold text-gray-600">AI Insights</h2>
                    <p class="text-sm text-gray-400 mt-1 max-w-sm">
                        AI-powered analytics and anomaly detection will surface here. For now, use the sidebar AI Insights link.
                    </p>
                    <NuxtLink
                        :to="`/projects/${projectId}/insights`"
                        class="mt-4 inline-flex items-center gap-2 text-primary-blue-100 text-sm font-medium hover:underline"
                    >
                        Go to AI Insights
                        <font-awesome-icon :icon="['fas', 'arrow-right']" class="w-3 h-3" />
                    </NuxtLink>
                </div>

                <!-- ═══════════════════════════════════════════════════════ -->
                <!-- SETTINGS TAB                                          -->
                <!-- ═══════════════════════════════════════════════════════ -->
                <div v-else-if="activeTab === 'settings'" class="flex flex-col items-center justify-center py-20 text-center">
                    <font-awesome-icon :icon="['fas', 'gear']" class="text-4xl text-gray-300 mb-4" />
                    <h2 class="text-lg font-semibold text-gray-600">Intelligence Settings</h2>
                    <p class="text-sm text-gray-400 mt-1 max-w-sm">
                        Configure intelligence module preferences, AI model settings, and reporting defaults.
                    </p>
                </div>

            </div>
        </div>
    </IntelligenceHubLayout>
</template>