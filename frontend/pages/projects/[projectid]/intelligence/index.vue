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
 * The sub-menu tabs have been removed — navigation is driven entirely by
 * the project sidebar links.
 */
import { useMarketingHubStore } from '@/stores/marketingHub';
import { useCampaignsStore } from '@/stores/campaigns';
import { useDataModelsStore } from '@/stores/data_models';
import type { IMarketingTotals } from '~/types/IMarketingHub';
import CampaignPerformanceTable from '@/components/intelligence/campaign/CampaignPerformanceTable.vue';
import { AttributionView } from '@/components/intelligence/attribution';

definePageMeta({ layout: 'project' });

const route = useRoute();
const router = useRouter();
const marketingHubStore = useMarketingHubStore();
const campaignsStore = useCampaignsStore();

const projectId = computed(() => parseInt(String(route.params.projectid)));
const dataModelsStore = useDataModelsStore();

/** First data model ID for the current project — used by campaign table composable */
const firstDataModelId = computed<number | null>(() => {
    const models = dataModelsStore.getDataModels();
    const projectModels = models.filter(
        (m: any) => m.data_source?.project_id === projectId.value
            || m.data_model_sources?.some((dms: any) => dms.data_source?.project_id === projectId.value),
    );
    return projectModels.length > 0 ? projectModels[0].id : null;
});

/** ISO date strings derived from the store's date range for downstream composable usage */
const isoStartDate = computed(() => marketingHubStore.dateRange.start.toISOString().split('T')[0]);
const isoEndDate = computed(() => marketingHubStore.dateRange.end.toISOString().split('T')[0]);

// ---------------------------------------------------------------------------
// Tab state — synchronised with URL hash via route watcher
// ---------------------------------------------------------------------------
type TabId = 'overview' | 'campaigns' | 'attribution' | 'reports' | 'insights' | 'settings';

const VALID_TABS: TabId[] = ['overview', 'campaigns', 'attribution', 'reports', 'insights', 'settings'];

const activeTab = ref<TabId>('overview');

/** Read the current hash from the route object */
function getTabFromHash(): TabId {
    const hash = route.hash.replace('#', '') as TabId;
    return VALID_TABS.includes(hash) ? hash : 'overview';
}

// Watch route.hash so sidebar navigation (which changes the hash via router.push) triggers UI updates
watch(
    () => route.hash,
    () => {
        activeTab.value = getTabFromHash();
    },
    { immediate: true },
);

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
const hasData = computed(() => {
    return summary.value && summary.value.channels.length > 0;
});

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

function navigateToCampaignDrillDown(campaign: any) {
    const query: Record<string, string> = {};
    if (campaign.campaignName) query.name = campaign.campaignName;
    if (campaign.channel) query.channel = campaign.channel;
    router.push({
        path: `/projects/${projectId.value}/intelligence/campaigns/${campaign.campaignId}`,
        query,
    });
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
    today.setHours(0, 0, 0, 0);
    const thirtyDaysAgo = new Date(today);
    thirtyDaysAgo.setDate(today.getDate() - 30);

    startDateInput.value = isoToInput(thirtyDaysAgo);
    endDateInput.value = isoToInput(today);
    marketingHubStore.setDateRange(thirtyDaysAgo, today);

    await campaignsStore.retrieveCampaigns(projectId.value);
    await dataModelsStore.retrieveDataModels(projectId.value);
    await loadOverviewData();
});
</script>

<template>
    <IntelligenceHubLayout>
        <!-- Tab content area — no sub-menu tabs, navigation driven by sidebar -->
        <div class="flex-1 min-w-0 p-4 md:p-6 overflow-y-auto">

            <!-- ═══════════════════════════════════════════════════════ -->
            <!-- OVERVIEW TAB                                          -->
            <!-- ═══════════════════════════════════════════════════════ -->
            <div v-if="activeTab === 'overview'">
                <IntelligenceOverview
                    :project-id="Number(projectId)"
                    :has-data="!!hasData"
                    :is-loading="isLoading"
                    :summary="summary"
                    :data-model-id="firstDataModelId"
                    :start-date="isoStartDate"
                    :end-date="isoEndDate"
                    @refresh="handleRefresh"
                    @update:range="handleRangeChange"
                    @campaign-click="navigateToCampaignDrillDown"
                />
            </div>

            <!-- ═══════════════════════════════════════════════════════ -->
            <!-- CAMPAIGNS TAB                                         -->
            <!-- ═══════════════════════════════════════════════════════ -->
            <div v-else-if="activeTab === 'campaigns'">
                <div class="mb-4">
                    <h2 class="text-lg font-bold text-gray-900">Campaign Performance</h2>
                    <p class="text-sm text-gray-500 mt-0.5">
                        Detailed campaign-level metrics with filters, sorting, and pagination
                    </p>
                </div>
                <CampaignPerformanceTable
                    :project-id="Number(projectId)"
                    :data-model-id="firstDataModelId"
                    :start-date="isoStartDate"
                    :end-date="isoEndDate"
                    :channels="summary?.channels?.map((ch: any) => ch.channelLabel || ch.channelType || 'Unknown') || []"
                    :max-height="600"
                    :show-filters="true"
                    @campaign-click="navigateToCampaignDrillDown"
                />
            </div>

            <!-- ═══════════════════════════════════════════════════════ -->
            <!-- ATTRIBUTION TAB                                       -->
            <!-- ═══════════════════════════════════════════════════════ -->
            <div v-else-if="activeTab === 'attribution'">
                <div class="mb-4">
                    <h2 class="text-lg font-bold text-gray-900">Attribution</h2>
                    <p class="text-sm text-gray-500 mt-0.5">
                        Multi-touch attribution models with channel-level conversion credit, journey paths, and ROI analysis
                    </p>
                </div>
                <AttributionView
                    :project-id="Number(projectId)"
                    :data-model-id="firstDataModelId"
                    :start-date="isoStartDate"
                    :end-date="isoEndDate"
                />
            </div>

            <!-- ═══════════════════════════════════════════════════════ -->
            <!-- REPORTS TAB                                           -->
            <!-- ═══════════════════════════════════════════════════════ -->
            <div v-else-if="activeTab === 'reports'">
                <IntelligenceReports :project-id="projectId" />
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
    </IntelligenceHubLayout>
</template>