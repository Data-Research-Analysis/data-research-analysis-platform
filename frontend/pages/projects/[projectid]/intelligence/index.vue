<script setup lang="ts">
/**
 * Intelligence Hub — the unified analytics landing page (TICKET NAV-001).
 *
 * Route: /projects/:projectid/intelligence
 *
 * This page acts as a single-page tab shell. The active tab is driven by
 * the URL hash (#overview, #campaigns, #reports, #insights,
 * #settings).  Each tab renders its corresponding child component inline.
 *
 * The sub-menu tabs have been removed — navigation is driven entirely by
 * the project sidebar links.
 */
import { useIntelligenceHubStore } from '@/stores/intelligenceHub';
import { useCampaignsStore } from '@/stores/campaigns';
import { useDataModelsStore } from '@/stores/data_models';
import { useDataSourceStore } from '@/stores/data_sources';
import { useFunnelStore } from '@/stores/funnel';
import type { IFunnel } from '@/stores/funnel';

definePageMeta({ layout: 'project' });

const route = useRoute();
const router = useRouter();
const intelligenceHubStore = useIntelligenceHubStore();
const campaignsStore = useCampaignsStore();

const dataSourceStore = useDataSourceStore();
const isAutoBuilding = ref(false);

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
const isoStartDate = computed(() => intelligenceHubStore.dateRange.start.toISOString().split('T')[0]);
const isoEndDate = computed(() => intelligenceHubStore.dateRange.end.toISOString().split('T')[0]);

// ---------------------------------------------------------------------------
// Tab state — synchronised with URL hash via route watcher
// ---------------------------------------------------------------------------
type TabId = 'overview' | 'campaigns' | 'attribution';

const VALID_TABS: TabId[] = ['overview', 'campaigns', 'attribution'];

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
const summary = computed(() => intelligenceHubStore.hubSummary);
const isLoading = computed(() => intelligenceHubStore.isLoading || isAutoBuilding.value);
const hasData = computed(() => {
    return summary.value && summary.value.channels.length > 0;
});

async function loadOverviewData() {
    await intelligenceHubStore.retrieveHubSummary(projectId.value);

    // Automatically build unified data model if there are connected data sources but no data models
    const dataModels = dataModelsStore.getDataModels();
    const hasProjectModels = dataModels.some(
        (m: any) => m.data_source?.project_id === projectId.value || m.data_model_sources?.some((dms: any) => dms.data_source?.project_id === projectId.value)
    );
    
    if (!hasProjectModels && !isAutoBuilding.value) {
        await dataSourceStore.retrieveDataSources();
        const dataSources = dataSourceStore.getDataSources().filter(ds => ds.project_id === projectId.value);
        if (dataSources.length > 0) {
            isAutoBuilding.value = true;
            try {
                const batchSources = dataSources.map(ds => ({ data_source_id: ds.id }));
                await dataModelsStore.autoCreateBatch(batchSources, projectId.value, true);
                
                // Refresh data models and hub summary after creation
                await dataModelsStore.retrieveDataModels(projectId.value);
                await intelligenceHubStore.retrieveHubSummary(projectId.value);
            } catch (error) {
                console.error('[IntelligenceOverview] Auto-building data models failed:', error);
            } finally {
                isAutoBuilding.value = false;
            }
        }
    }
}

// ---------------------------------------------------------------------------
// IntelligenceOverview event handlers
// ---------------------------------------------------------------------------
function handleRefresh() {
    loadOverviewData();
}

/** Sent from the AI Alerts empty-target prompt — jump to the campaigns tab
 *  where a campaign can be opened to define its campaign/ad set targets. */
function handleSetTargets() {
    router.push({ hash: '#campaigns' });
}

function handleRangeChange(range: { start: Date; end: Date; preset: string }) {
    intelligenceHubStore.setDateRange(range.start, range.end);
    loadOverviewData();
}

function navigateToCampaignDrillDown(campaign: any) {
    const query: Record<string, string> = {};
    if (campaign.campaignName) query.name = campaign.campaignName;
    if (campaign.channel) query.channel = campaign.channel;
    if (campaign.sourceTable) query.sourceTable = campaign.sourceTable;
    if (campaign.campaignColumn) query.campaignColumn = campaign.campaignColumn;
    // Carry the active date range so a refresh of the drill-down keeps data.
    query.startDate = isoStartDate.value;
    query.endDate = isoEndDate.value;
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

// ---------------------------------------------------------------------------
// ── Attribution tab state ──
const attributionView = ref<'overview' | 'analysis' | 'models'>('overview')
const selectedFunnelId = ref<number | null>(null)
const showFunnelBuilder = ref(false)

function handleCreateFunnel() {
    showFunnelBuilder.value = true
}

function handleViewFunnel(funnelId: number) {
    selectedFunnelId.value = funnelId
    attributionView.value = 'analysis'
}

function handleFunnelSaved(funnelId: number) {
    showFunnelBuilder.value = false
    selectedFunnelId.value = funnelId
    attributionView.value = 'analysis'
}

function handleBackFromAnalysis() {
    attributionView.value = 'overview'
    selectedFunnelId.value = null
}

function handleEditFunnel(funnelId: number) {
    showFunnelBuilder.value = true
}

function handleDeleteFunnel() {
    attributionView.value = 'overview'
    selectedFunnelId.value = null
}

// Load initial data
onMounted(async () => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const thirtyDaysAgo = new Date(today);
    thirtyDaysAgo.setDate(today.getDate() - 30);

    intelligenceHubStore.setDateRange(thirtyDaysAgo, today);

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
                    @set-targets="handleSetTargets"
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
            <div v-else-if="activeTab === 'attribution'" class="flex-1 min-w-0">
                <!-- Attribution Sub-nav -->
                <div class="flex gap-4 mb-4 border-b border-gray-200">
                    <button
                        v-if="attributionView === 'analysis'"
                        class="flex items-center gap-1.5 px-1 py-2 text-sm font-medium text-gray-500 hover:text-gray-700 border-b-2 border-transparent transition-colors cursor-pointer"
                        @click="handleBackFromAnalysis"
                    >
                        <font-awesome-icon :icon="['fas', 'arrow-left']" class="w-3 h-3" />
                        Back
                    </button>
                    <button
                        class="px-1 py-2 text-sm font-medium border-b-2 transition-colors cursor-pointer"
                        :class="attributionView === 'overview' ? 'text-blue-600 border-blue-500' : 'text-gray-500 hover:text-gray-700 border-transparent'"
                        @click="attributionView = 'overview'"
                    >
                        <font-awesome-icon :icon="['fas', 'funnel-dollar']" class="w-3.5 h-3.5 mr-1.5" />
                        Funnels
                    </button>
                    <button
                        class="px-1 py-2 text-sm font-medium border-b-2 transition-colors cursor-pointer"
                        :class="attributionView === 'models' ? 'text-blue-600 border-blue-500' : 'text-gray-500 hover:text-gray-700 border-transparent'"
                        @click="attributionView = 'models'"
                    >
                        <font-awesome-icon :icon="['fas', 'chart-pie']" class="w-3.5 h-3.5 mr-1.5" />
                        Attribution Models
                    </button>
                </div>

                <!-- Attribution Overview (list of funnels) -->
                <AttributionOverview
                    v-if="attributionView === 'overview'"
                    :project-id="Number(projectId)"
                    :start-date="isoStartDate"
                    :end-date="isoEndDate"
                    @create-funnel="handleCreateFunnel"
                    @view-funnel="handleViewFunnel"
                />

                <!-- Attribution Models View -->
                <AttributionModelsView
                    v-else-if="attributionView === 'models'"
                    :project-id="Number(projectId)"
                    :start-date="isoStartDate"
                    :end-date="isoEndDate"
                    @back="attributionView = 'overview'"
                />

                <!-- Funnel Analysis View (single funnel drill-down) -->
                <FunnelAnalysisView
                    v-else-if="attributionView === 'analysis' && selectedFunnelId"
                    :project-id="Number(projectId)"
                    :funnel-id="selectedFunnelId"
                    :start-date="isoStartDate"
                    :end-date="isoEndDate"
                    @back="handleBackFromAnalysis"
                    @edit="handleEditFunnel"
                    @delete="handleDeleteFunnel"
                />

                <!-- Funnel Builder Modal -->
                <FunnelBuilder
                    v-if="showFunnelBuilder"
                    :project-id="Number(projectId)"
                    @close="showFunnelBuilder = false"
                    @saved="handleFunnelSaved"
                />
            </div>

            <!-- ═══════════════════════════════════════════════════════ -->



        </div>
    </IntelligenceHubLayout>
</template>
