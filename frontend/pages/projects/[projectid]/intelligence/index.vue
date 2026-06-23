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
import { useInsightsStore } from '@/stores/insights';
import { useProjectPermissions } from '@/composables/useProjectPermissions';
import { useProjectRole } from '@/composables/useProjectRole';
import { useFunnelStore } from '@/stores/funnel';
import type { IFunnel } from '@/stores/funnel';
import type { IIntelligenceTotals } from '~/types/IMarketingHub';

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

const summary = computed(() => intelligenceHubStore.hubSummary);
const topCampaigns = computed(() => intelligenceHubStore.topCampaigns);
const isLoading = computed(() => intelligenceHubStore.isLoading || isAutoBuilding.value);
const error = computed(() => intelligenceHubStore.error);
const hasData = computed(() => {
    return summary.value && summary.value.channels.length > 0;
});

function calcDelta(current: number, prior: number): number | null {
    if (prior === 0) return null;
    return (current - prior) / prior;
}

const totals = computed<IIntelligenceTotals>(() =>
    summary.value?.totals ?? { spend: 0, impressions: 0, clicks: 0, conversions: 0, cpl: 0, pipelineValue: 0 },
);

const priorTotals = computed<IIntelligenceTotals>(() =>
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
    intelligenceHubStore.setDateRange(s, e);
    loadOverviewData();
}

function onCampaignFilterChange() {
    intelligenceHubStore.setCampaignFilter(campaignFilterId.value);
    loadOverviewData();
}

async function loadOverviewData() {
    await Promise.all([
        intelligenceHubStore.retrieveHubSummary(projectId.value),
        intelligenceHubStore.retrieveTopCampaigns(projectId.value),
    ]);

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
                await Promise.all([
                    intelligenceHubStore.retrieveHubSummary(projectId.value),
                    intelligenceHubStore.retrieveTopCampaigns(projectId.value),
                ]);
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
// Insights tab state
// ---------------------------------------------------------------------------
const insightsStore = useInsightsStore();
const { isManager } = useProjectRole();
const permissions = useProjectPermissions(projectId.value);
const canCreate = computed(() => permissions.canCreate.value);
const canDelete = computed(() => permissions.canDelete.value);
const { $swal } = useNuxtApp();

interface InsightsState {
    showAnalysisView: boolean;
    loadingReports: boolean;
    selectedDataSourceIds: any[];
    followUpMessage: string;
    savedCurrentReport: boolean;
    showAddToDashboardModal: boolean;
    selectedMessageText: string;
}
const insightsState = reactive<InsightsState>({
  showAnalysisView: false,
  loadingReports: false,
  selectedDataSourceIds: [],
  followUpMessage: '',
  savedCurrentReport: false,
  showAddToDashboardModal: false,
  selectedMessageText: ''
});

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

const availableDataSources = computed(() => {
  const allDataSources = dataSourceStore.getDataSources();
  return allDataSources.filter((ds) => {
    const dsProjectId = ds.project_id || ds.project?.id;
    return dsProjectId === projectId.value;
  });
});

function toggleDataSource(id: number) {
  const index = insightsState.selectedDataSourceIds.indexOf(id);
  if (index === -1) {
    insightsState.selectedDataSourceIds.push(id);
  } else {
    insightsState.selectedDataSourceIds.splice(index, 1);
  }
  insightsStore.setSelectedDataSources(insightsState.selectedDataSourceIds);
}

async function generateInsights() {
  if (insightsState.selectedDataSourceIds.length === 0) {
    if (import.meta.client) {
      $swal.fire({
        icon: 'warning',
        title: 'No Data Sources Selected',
        text: 'Please select at least one data source to analyze'
      });
    }
    return;
  }

  const initResult = await insightsStore.initializeSession(projectId.value, insightsState.selectedDataSourceIds);
  if (!initResult.success) {
    if (import.meta.client) {
      $swal.fire({
        icon: 'error',
        title: 'Initialization Failed',
        text: initResult.error || 'Failed to initialize analysis session'
      });
    }
    return;
  }

  const generateResult = await insightsStore.generateInsights(projectId.value);
  if (!generateResult.success) {
    if (import.meta.client) {
      $swal.fire({
        icon: 'error',
        title: 'Generation Failed',
        text: generateResult.error || 'Failed to generate insights'
      });
    }
  }
}

async function sendFollowUp() {
  if (!insightsState.followUpMessage.trim()) return;

  const message = insightsState.followUpMessage;
  insightsState.followUpMessage = '';

  const result = await insightsStore.askFollowUp(projectId.value, message);
  if (!result.success && import.meta.client) {
    $swal.fire({
      icon: 'error',
      title: 'Unable to Process Question',
      text: result.error || 'Could not send your message. Please try again.'
    });
  }
}

function handleAddToDashboard(msg: any) {
  insightsState.selectedMessageText = typeof msg.content === 'string'
    ? msg.content
    : JSON.stringify(msg.content, null, 2);
  insightsState.showAddToDashboardModal = true;
}

async function saveCurrentReport() {
  if (import.meta.client) {
    const { value: title } = await $swal.fire({
      title: 'Save Report',
      input: 'text',
      inputLabel: 'Report Title',
      inputPlaceholder: 'Enter a descriptive title',
      showCancelButton: true,
      inputValidator: (value) => {
        if (!value) {
          return 'Title is required';
        }
      }
    });

    if (title) {
      const result = await insightsStore.saveReport(projectId.value, title);
      if (result.success) {
        insightsState.savedCurrentReport = true;
        $swal.fire({
          icon: 'success',
          title: 'Report Saved',
          text: 'Your insights report has been saved successfully'
        });
      } else {
        $swal.fire({
          icon: 'error',
          title: 'Save Failed',
          text: result.error || 'Failed to save report'
        });
      }
    }
  }
}

function startNewAnalysis() {
  insightsStore.clearSession();
  insightsState.showAnalysisView = true;
  insightsState.savedCurrentReport = false;
  insightsState.selectedDataSourceIds = [];
}

function backToReports() {
  insightsState.showAnalysisView = false;
  loadInsightsReports();
}

async function loadInsightsReports() {
  insightsState.loadingReports = true;
  await insightsStore.loadReports(projectId.value);
  insightsState.loadingReports = false;
}

function viewReport(reportId: number) {
  router.push(`/projects/${projectId.value}/insights/${reportId}`);
}

async function confirmDeleteReport(reportId: number) {
  if (import.meta.client) {
    const result = await $swal.fire({
      title: 'Delete Report?',
      text: 'This action cannot be undone',
      icon: 'warning',
      showCancelButton: true,
      confirmButtonColor: '#d33',
      confirmButtonText: 'Delete',
      cancelButtonText: 'Cancel'
    });

    if (result.isConfirmed) {
      const deleteResult = await insightsStore.deleteReport(reportId);
      if (deleteResult.success) {
        $swal.fire({
          icon: 'success',
          title: 'Report Deleted',
          timer: 2000,
          showConfirmButton: false
        });
      } else {
        $swal.fire({
          icon: 'error',
          title: 'Delete Failed',
          text: deleteResult.error || 'Failed to delete report'
        });
      }
    }
  }
}

function cancelAnalysis() {
  insightsStore.cancelSession(projectId.value);
}

function formatDate(dateString: string) {
  if (!import.meta.client) return '';
  const date = new Date(dateString);
  return date.toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric'
  });
}

function countInsights(summary: any) {
  if (!summary) return 0;
  let count = 0;
  if (summary.trends) count += summary.trends.length;
  if (summary.anomalies) count += summary.anomalies.length;
  if (summary.correlations) count += summary.correlations.length;
  if (summary.distributions) count += summary.distributions.length;
  if (summary.recommendations) count += summary.recommendations.length;
  return count;
}

// Load initial data
onMounted(async () => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const thirtyDaysAgo = new Date(today);
    thirtyDaysAgo.setDate(today.getDate() - 30);

    startDateInput.value = isoToInput(thirtyDaysAgo);
    endDateInput.value = isoToInput(today);
    intelligenceHubStore.setDateRange(thirtyDaysAgo, today);

    await campaignsStore.retrieveCampaigns(projectId.value);
    await dataModelsStore.retrieveDataModels(projectId.value);
    await loadOverviewData();
    
    // Initialize insights
    if (import.meta.client) {
        insightsStore.initializeSocketListeners();
        insightsStore.loadReports(projectId.value);
    }
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
            <!-- REPORTS TAB                                           -->
            <!-- ═══════════════════════════════════════════════════════ -->
            <div v-else-if="activeTab === 'reports'">
                <IntelligenceReports :project-id="projectId" />
            </div>

            <!-- ═══════════════════════════════════════════════════════ -->
            <!-- AI INSIGHTS TAB                                       -->
            <!-- ═══════════════════════════════════════════════════════ -->
            <div v-else-if="activeTab === 'insights'">
                <div class="mb-8">
                    <h1 class="text-3xl font-bold text-gray-900 mb-2">AI Insights</h1>
                    <p class="text-lg text-gray-600">Instantly discover insights from your data without building models</p>
                </div>

                <!-- Saved Reports List -->
                <div v-if="!insightsState.showAnalysisView">
                    <div class="flex justify-between items-center mb-6">
                        <h2 class="text-2xl font-semibold text-gray-800">Saved Reports</h2>
                        <ClientOnly>
                            <button
                                class="inline-flex items-center gap-2 px-6 py-3 bg-blue-500 text-white rounded-lg font-medium transition-all hover:bg-blue-600 disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
                                @click="startNewAnalysis"
                                :disabled="!canCreate"
                            >
                                <font-awesome-icon :icon="['fas', 'plus']" class="w-5 h-5" />
                                New Analysis
                            </button>
                            <template #fallback>
                                <button
                                    class="inline-flex items-center gap-2 px-6 py-3 bg-blue-500 text-white rounded-lg font-medium transition-all hover:bg-blue-600 disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
                                    disabled
                                >
                                    <font-awesome-icon :icon="['fas', 'plus']" class="w-5 h-5" />
                                    New Analysis
                                </button>
                            </template>
                        </ClientOnly>
                    </div>

                    <div v-if="insightsState.loadingReports" class="flex flex-col items-center justify-center py-16 text-center">
                        <div class="w-10 h-10 border-3 border-gray-200 border-t-blue-500 rounded-full animate-spin"></div>
                        <p class="mt-4">Loading reports...</p>
                    </div>

                    <div v-else-if="insightsStore.reports.length === 0" class="flex flex-col items-center justify-center py-16 px-8 text-center">
                        <font-awesome-icon :icon="['fas', 'box']" class="w-16 h-16 text-gray-300 mb-4" />
                        <h3 class="text-xl font-semibold text-gray-800 mb-2">No insights yet</h3>
                        <p class="text-gray-600 mb-6">Create your first analysis to discover insights from your data</p>
                        <ClientOnly>
                            <button
                                class="inline-flex items-center gap-2 px-6 py-3 bg-blue-500 text-white rounded-lg font-medium transition-all hover:bg-blue-600 disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
                                @click="startNewAnalysis"
                                :disabled="!canCreate"
                            >
                                Create First Analysis
                            </button>
                            <template #fallback>
                                <button
                                    class="inline-flex items-center gap-2 px-6 py-3 bg-blue-500 text-white rounded-lg font-medium transition-all hover:bg-blue-600 disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
                                    disabled
                                >
                                    Create First Analysis
                                </button>
                            </template>
                        </ClientOnly>
                    </div>

                    <div v-else class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                        <div
                            v-for="report in insightsStore.reports"
                            :key="report.id"
                            class="bg-white border border-gray-200 rounded-xl p-6 cursor-pointer transition-all hover:shadow-lg hover:-translate-y-0.5 relative"
                            @click="viewReport(report.id)"
                        >
                            <div class="mb-4">
                                <h3 class="text-lg font-semibold text-gray-800 mb-1">{{ report.title }}</h3>
                                <span class="text-sm text-gray-400">{{ formatDate(report.created_at) }}</span>
                            </div>
                            <div class="flex gap-4 text-sm text-gray-600">
                                <span>
                                    {{ report.data_source_ids.length }} data source{{ report.data_source_ids.length !== 1 ? 's' : '' }}
                                </span>
                                <span>
                                    {{ countInsights(report.insights_summary) }} insights
                                </span>
                            </div>
                            <button
                                class="absolute top-4 right-4 p-2 bg-transparent border-none text-red-600 cursor-pointer rounded-md transition-all hover:bg-red-50 disabled:opacity-40 disabled:cursor-not-allowed"
                                @click.stop="confirmDeleteReport(report.id)"
                                :disabled="!canDelete"
                            >
                                <font-awesome-icon :icon="['fas', 'trash']" class="w-4 h-4" />
                            </button>
                        </div>
                    </div>
                </div>

                <!-- Analysis View -->
                <div v-else>
                    <div class="flex justify-between items-center mb-8">
                        <button class="inline-flex items-center gap-2 px-4 py-2 bg-transparent text-gray-700 rounded-lg transition-all hover:bg-gray-50 cursor-pointer" @click="backToReports">
                            <font-awesome-icon :icon="['fas', 'arrow-left']" class="w-5 h-5" />
                            Back to Reports
                        </button>

                        <div class="flex gap-4">
                            <button
                                v-if="insightsStore.currentInsights"
                                class="inline-flex items-center gap-2 px-6 py-3 bg-gray-200 text-gray-800 rounded-lg font-medium transition-all hover:bg-gray-300 disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
                                @click="startNewAnalysis"
                                :disabled="insightsStore.isGenerating"
                            >
                                New Analysis
                            </button>
                            <button
                                v-if="insightsStore.currentInsights && !insightsState.savedCurrentReport"
                                class="inline-flex items-center gap-2 px-6 py-3 bg-blue-500 text-white rounded-lg font-medium transition-all hover:bg-blue-600 disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
                                @click="saveCurrentReport"
                                :disabled="insightsStore.isGenerating || !canCreate"
                            >
                                Save Report
                            </button>
                        </div>
                    </div>

                    <!-- Data Source Selector -->
                    <div class="bg-white rounded-xl p-8 mb-8" v-if="!insightsStore.currentInsights && !insightsStore.isGenerating">
                        <h3 class="text-xl font-semibold text-gray-800 mb-2">Select Data Sources</h3>
                        <p class="text-gray-600 mb-6">Choose one or more data sources to analyze</p>

                        <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mb-8">
                            <div
                                v-for="ds in availableDataSources"
                                :key="ds.id"
                                class="flex items-center gap-4 p-4 border-2 border-gray-200 rounded-lg cursor-pointer transition-all hover:border-gray-300 hover:bg-gray-50"
                                :class="{ 'border-blue-500 bg-blue-50': insightsState.selectedDataSourceIds.includes(ds.id) }"
                                @click="toggleDataSource(ds.id)"
                            >
                                <div class="checkbox-wrapper">
                                    <input
                                        type="checkbox"
                                        :checked="insightsState.selectedDataSourceIds.includes(ds.id)"
                                        @click.stop
                                    />
                                </div>
                                <div class="flex flex-col gap-1">
                                    <span class="font-medium text-gray-800">{{ ds.name }}</span>
                                    <span class="text-sm text-gray-600 capitalize">{{ ds.data_type }}</span>
                                </div>
                            </div>
                        </div>

                        <div class="flex justify-center">
                            <button
                                class="inline-flex items-center gap-2 px-8 py-4 text-lg bg-blue-500 text-white rounded-lg font-medium transition-all hover:bg-blue-600 disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
                                @click="generateInsights"
                                :disabled="insightsState.selectedDataSourceIds.length === 0 || insightsStore.isGenerating"
                            >
                                <font-awesome-icon :icon="['fas', 'circle-down']" class="w-5 h-5" />
                                Generate Insights
                            </button>
                        </div>
                    </div>

                    <!-- Progress Overlay -->
                    <overlay-dialog v-if="insightsStore.isGenerating && insightsStore.generationProgress" @close="cancelAnalysis">
                        <template #overlay>
                            <div class="text-center">
                                <div class="w-16 h-16 border-4 border-gray-200 border-t-blue-500 rounded-full animate-spin mx-auto mb-6"></div>
                                <h3 class="text-2xl font-semibold text-gray-800 mb-4">{{ insightsStore.generationProgress.message }}</h3>
                                <div class="w-full bg-gray-100 rounded-full overflow-hidden mb-4">
                                    <div
                                        class="h-3 bg-gradient-to-r from-blue-500 to-blue-700 transition-all duration-300 rounded-full"
                                        :style="{ width: (insightsStore.generationProgress.progress || 0) + '%' }"
                                    ></div>
                                </div>
                                <p class="text-gray-600 mb-2">
                                    {{ insightsStore.generationProgress.phase }}
                                    <span v-if="insightsStore.generationProgress.currentSource">
                                        - {{ insightsStore.generationProgress.currentSource }}
                                    </span>
                                </p>
                                <p class="text-sm text-gray-500 mb-6">Progress: {{ insightsStore.generationProgress.progress || 0 }}%</p>
                                <button 
                                    class="inline-flex items-center gap-2 px-6 py-3 bg-gray-200 text-gray-800 rounded-lg font-medium transition-all hover:bg-gray-300 cursor-pointer" 
                                    @click="cancelAnalysis"
                                >
                                    Cancel
                                </button>
                            </div>
                        </template>
                    </overlay-dialog>

                    <!-- Insights Display -->
                    <div v-if="insightsStore.currentInsights" class="bg-white rounded-xl p-8">
                        <h2 class="text-3xl font-semibold text-gray-800 mb-8">Analysis Results</h2>

                        <!-- Sampling Disclaimer -->
                        <div v-if="insightsStore.samplingInfo" class="mb-6 p-4 bg-blue-50 border border-blue-200 rounded-lg">
                            <div class="flex items-start gap-3">
                                <font-awesome-icon :icon="['fas', 'circle-info']" class="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" />
                                <div class="flex-1">
                                    <p class="text-sm text-blue-900">
                                        <strong>Data Sample Analysis:</strong> This analysis is based on a sample of 
                                        <strong>{{ insightsStore.samplingInfo.total_rows_sampled.toLocaleString() }}</strong> rows 
                                        from <strong>{{ insightsStore.samplingInfo.tables_sampled }}</strong> table{{ insightsStore.samplingInfo.tables_sampled !== 1 ? 's' : '' }}
                                        (max {{ insightsStore.samplingInfo.max_rows_per_table }} rows per table).
                                    </p>
                                </div>
                            </div>
                        </div>

                        <!-- Trends -->
                        <div v-if="insightsStore.currentInsights.trends?.length > 0" class="mb-10">
                            <div class="flex items-center gap-3 mb-4">
                                <font-awesome-icon :icon="['fas', 'arrow-trend-up']" class="w-6 h-6 text-blue-500" />
                                <h3 class="text-xl font-semibold text-gray-800">Trends</h3>
                            </div>
                            <div class="flex flex-col gap-4">
                                <div
                                    v-for="(insight, idx) in insightsStore.currentInsights.trends"
                                    :key="idx"
                                    class="bg-gray-50 border-l-4 border-blue-500 rounded-lg p-4"
                                >
                                    <div class="flex justify-between items-start gap-4">
                                        <p class="flex-1 text-gray-800 leading-relaxed">{{ insight.insight }}</p>
                                        <span class="flex-shrink-0 px-3 py-1 rounded-full text-xs font-semibold uppercase" :class="{
                                            'bg-green-200 text-green-900': insight.confidence === 'high',
                                            'bg-orange-200 text-orange-900': insight.confidence === 'medium',
                                            'bg-gray-200 text-gray-800': insight.confidence === 'low'
                                        }">
                                            {{ insight.confidence }} confidence
                                        </span>
                                    </div>
                                </div>
                            </div>
                        </div>

                        <!-- Anomalies -->
                        <div v-if="insightsStore.currentInsights.anomalies?.length > 0" class="mb-10">
                            <div class="flex items-center gap-3 mb-4">
                                <font-awesome-icon :icon="['fas', 'triangle-exclamation']" class="w-6 h-6 text-blue-500" />
                                <h3 class="text-xl font-semibold text-gray-800">Anomalies</h3>
                            </div>
                            <div class="flex flex-col gap-4">
                                <div
                                    v-for="(insight, idx) in insightsStore.currentInsights.anomalies"
                                    :key="idx"
                                    class="bg-red-50 border-l-4 border-red-500 rounded-lg p-4"
                                >
                                    <div class="flex justify-between items-start gap-4">
                                        <p class="flex-1 text-gray-800 leading-relaxed">{{ insight.insight }}</p>
                                        <span class="flex-shrink-0 px-3 py-1 rounded-full text-xs font-semibold uppercase" :class="{
                                            'bg-green-200 text-green-900': insight.confidence === 'high',
                                            'bg-orange-200 text-orange-900': insight.confidence === 'medium',
                                            'bg-gray-200 text-gray-800': insight.confidence === 'low'
                                        }">
                                            {{ insight.confidence }} confidence
                                        </span>
                                    </div>
                                </div>
                            </div>
                        </div>

                        <!-- Correlations -->
                        <div v-if="insightsStore.currentInsights.correlations?.length > 0" class="mb-10">
                            <div class="flex items-center gap-3 mb-4">
                                <font-awesome-icon :icon="['fas', 'share-nodes']" class="w-6 h-6 text-blue-500" />
                                <h3 class="text-xl font-semibold text-gray-800">Correlations</h3>
                            </div>
                            <div class="flex flex-col gap-4">
                                <div
                                    v-for="(insight, idx) in insightsStore.currentInsights.correlations"
                                    :key="idx"
                                    class="bg-gray-50 border-l-4 border-blue-500 rounded-lg p-4"
                                >
                                    <div class="flex justify-between items-start gap-4">
                                        <p class="flex-1 text-gray-800 leading-relaxed">{{ insight.insight }}</p>
                                        <span class="flex-shrink-0 px-3 py-1 rounded-full text-xs font-semibold uppercase" :class="{
                                            'bg-green-200 text-green-900': insight.confidence === 'high',
                                            'bg-orange-200 text-orange-900': insight.confidence === 'medium',
                                            'bg-gray-200 text-gray-800': insight.confidence === 'low'
                                        }">
                                            {{ insight.confidence }} confidence
                                        </span>
                                    </div>
                                </div>
                            </div>
                        </div>

                        <!-- Distributions -->
                        <div v-if="insightsStore.currentInsights.distributions?.length > 0" class="mb-10">
                            <div class="flex items-center gap-3 mb-4">
                                <font-awesome-icon :icon="['fas', 'chart-bar']" class="w-6 h-6 text-blue-500" />
                                <h3 class="text-xl font-semibold text-gray-800">Distributions</h3>
                            </div>
                            <div class="flex flex-col gap-4">
                                <div
                                    v-for="(insight, idx) in insightsStore.currentInsights.distributions"
                                    :key="idx"
                                    class="bg-gray-50 border-l-4 border-blue-500 rounded-lg p-4"
                                >
                                    <div class="flex justify-between items-start gap-4">
                                        <p class="flex-1 text-gray-800 leading-relaxed">{{ insight.insight }}</p>
                                        <span class="flex-shrink-0 px-3 py-1 rounded-full text-xs font-semibold uppercase" :class="{
                                            'bg-green-200 text-green-900': insight.confidence === 'high',
                                            'bg-orange-200 text-orange-900': insight.confidence === 'medium',
                                            'bg-gray-200 text-gray-800': insight.confidence === 'low'
                                        }">
                                            {{ insight.confidence }} confidence
                                        </span>
                                    </div>
                                </div>
                            </div>
                        </div>

                        <!-- Recommendations -->
                        <div v-if="insightsStore.currentInsights.recommendations?.length > 0" class="mb-10">
                            <div class="flex items-center gap-3 mb-4">
                                <font-awesome-icon :icon="['fas', 'layer-group']" class="w-6 h-6 text-blue-500" />
                                <h3 class="text-xl font-semibold text-gray-800">Recommendations</h3>
                            </div>
                            <div class="flex flex-col gap-4">
                                <div
                                    v-for="(insight, idx) in insightsStore.currentInsights.recommendations"
                                    :key="idx"
                                    class="bg-green-50 border-l-4 border-green-500 rounded-lg p-4"
                                >
                                    <div class="flex justify-between items-start gap-4">
                                        <p class="flex-1 text-gray-800 leading-relaxed">{{ insight.insight }}</p>
                                        <span class="flex-shrink-0 px-3 py-1 rounded-full text-xs font-semibold uppercase" :class="{
                                            'bg-green-200 text-green-900': insight.confidence === 'high',
                                            'bg-orange-200 text-orange-900': insight.confidence === 'medium',
                                            'bg-gray-200 text-gray-800': insight.confidence === 'low'
                                        }">
                                            {{ insight.confidence }} confidence
                                        </span>
                                    </div>
                                </div>
                            </div>
                        </div>

                        <!-- Follow-up Chat -->
                        <div class="mt-12 pt-8 border-t-2 border-gray-200">
                            <h3 class="text-xl font-semibold text-gray-800 mb-4">Ask Follow-up Questions</h3>
                            <div class="max-h-96 overflow-y-auto mb-4 flex flex-col gap-3">
                                <AIInsightsMessage
                                    v-for="(msg, idx) in insightsStore.messages.filter(m => m.role !== 'system')"
                                    :key="idx"
                                    :msg="msg"
                                    :can-add-to-dashboard="isManager"
                                    @add-to-dashboard="handleAddToDashboard"
                                />
                                
                                <!-- Typing Indicator -->
                                <div v-if="insightsStore.isGenerating" class="flex flex-col gap-1 max-w-4/5 self-start">
                                    <div class="px-4 py-3 rounded-xl bg-gray-50 border border-gray-200 flex items-center gap-2">
                                        <div class="flex gap-1">
                                            <div class="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style="animation-delay: 0ms"></div>
                                            <div class="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style="animation-delay: 150ms"></div>
                                            <div class="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style="animation-delay: 300ms"></div>
                                        </div>
                                        <span class="text-sm text-gray-500">AI is thinking...</span>
                                    </div>
                                </div>
                            </div>
                            <div class="flex gap-4">
                                <input
                                    v-model="insightsState.followUpMessage"
                                    type="text"
                                    placeholder="Ask a question about these insights..."
                                    @keyup.enter="sendFollowUp"
                                    :disabled="insightsStore.isGenerating"
                                    class="flex-1 px-4 py-3 border border-gray-200 rounded-lg text-base focus:outline-none focus:border-blue-500"
                                />
                                <button
                                    class="inline-flex items-center gap-2 px-6 py-3 bg-blue-500 text-white rounded-lg font-medium transition-all hover:bg-blue-600 disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
                                    @click="sendFollowUp"
                                    :disabled="!insightsState.followUpMessage.trim() || insightsStore.isGenerating"
                                >
                                    Send
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
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

    <!-- Add-to-Dashboard modal -->
    <AddToDashboardModal
        v-if="insightsState.showAddToDashboardModal"
        :project-id="projectId"
        :insight-text="insightsState.selectedMessageText"
        @close="insightsState.showAddToDashboardModal = false"
    />
</template>