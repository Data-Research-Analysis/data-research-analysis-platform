<script setup lang="ts">
defineOptions({ inheritAttrs: false });

import { useProjectsStore } from '@/stores/projects';
import { useCampaignsStore } from '@/stores/campaigns';
import { useDataSourceStore } from '@/stores/data_sources';
import { useDataModelsStore } from '@/stores/data_models';
import { useDashboardsStore } from '@/stores/dashboards';
import { useProjectRole } from '@/composables/useProjectRole';

const route = useRoute();
const projectsStore = useProjectsStore();
const campaignsStore = useCampaignsStore();
const dataSourceStore = useDataSourceStore();
const dataModelsStore = useDataModelsStore();
const dashboardsStore = useDashboardsStore();
const { isAnalyst, isManager } = useProjectRole();

// Mobile drawer state injected from the layout
const mobileNavOpen = inject<Ref<boolean>>('mobileNavOpen', ref(false));

const projectId = computed(() => {
    const id = route.params.projectid;
    return id ? parseInt(String(id)) : null;
});

const projectName = computed(() => {
    if (!projectId.value) return 'Project';
    // During SSR or before data loads, return placeholder
    if (!import.meta.client) return 'Project';
    const project = projectsStore.projects.find((p) => p.id === projectId.value);
    return project?.name || 'Project';
});

const currentProject = computed(() => {
    if (!projectId.value) return null;
    return projectsStore.projects.find((p) => p.id === projectId.value) || null;
});

const isOwner = computed(() => {
    // Guard to prevent hydration mismatch - always return false during SSR
    if (!isMounted.value) return false;
    return currentProject.value?.is_owner || false;
});

// SSR-safe role checks - guard with isMounted to prevent hydration mismatches
const isAnalystSafe = computed(() => isMounted.value && isAnalyst.value);
const isManagerSafe = computed(() => isMounted.value && isManager.value);

// Whether the sidebar rail is collapsed to icon-only (desktop only)
const isCollapsed = ref(false);
// Track viewport to ensure collapsed mode only applies on desktop
const isMobileViewport = ref(false);
const effectivelyCollapsed = computed(() => isCollapsed.value && !isMobileViewport.value);

// Track if component is mounted to prevent hydration mismatches
const isMounted = ref(false);

// Expandable section state
const expanded = reactive({
    campaigns: true,
    marketingHub: true,
    dataConnectivity: true,
});

const STORAGE_KEY = computed(() =>
    projectId.value ? `sidebar_state_${projectId.value}` : 'sidebar_state_default',
);
const COLLAPSED_KEY = computed(() =>
    projectId.value ? `sidebar_collapsed_${projectId.value}` : 'sidebar_collapsed_default',
);

onMounted(() => {
    isMounted.value = true;
    
    const checkMobile = () => { isMobileViewport.value = window.innerWidth < 768; };
    checkMobile();
    window.addEventListener('resize', checkMobile);

    const saved = localStorage.getItem(STORAGE_KEY.value);
    if (saved) {
        try {
            const parsed = JSON.parse(saved);
            expanded.campaigns = parsed.campaigns ?? true;
            expanded.marketingHub = parsed.marketingHub ?? true;
            expanded.dataConnectivity = parsed.dataConnectivity ?? true;
        } catch {
            // ignore parse errors
        }
    }
    const collapsedVal = localStorage.getItem(COLLAPSED_KEY.value);
    if (collapsedVal !== null) {
        isCollapsed.value = collapsedVal === 'true';
    }
});

// Watch for project changes and refresh data
watch(projectId, async (newId) => {
    if (newId) {
        await Promise.all([
            dataSourceStore.retrieveDataSources(),
            dataModelsStore.retrieveDataModels(newId),
            dashboardsStore.retrieveDashboards()
        ]);
    }
}, { immediate: false });

function toggleCollapsed() {
    isCollapsed.value = !isCollapsed.value;
    if (import.meta.client) {
        localStorage.setItem(COLLAPSED_KEY.value, String(isCollapsed.value));
    }
}

function persistState() {
    if (import.meta.client) {
        localStorage.setItem(
            STORAGE_KEY.value,
            JSON.stringify({
                campaigns: expanded.campaigns,
                marketingHub: expanded.marketingHub,
                dataConnectivity: expanded.dataConnectivity,
            }),
        );
    }
}

function toggleSection(section: 'campaigns' | 'marketingHub' | 'dataConnectivity') {
    expanded[section] = !expanded[section];
    persistState();
}

// Progressive menu enabling based on data availability
const projectDataSources = computed(() => {
    if (!projectId.value) return [];
    const filtered = dataSourceStore.dataSources.filter(ds => ds.project_id === projectId.value);
    return filtered;
});

const projectDataModels = computed(() => {
    if (!projectId.value) return [];
    return dataModelsStore.dataModels.filter(dm => {
        const dmProjectId = dm.project_id || dm.data_source?.project?.id;
        return dmProjectId === projectId.value;
    });
});

const projectDashboards = computed(() => {
    if (!projectId.value) return [];
    return dashboardsStore.dashboards.filter(d => d.project?.id === projectId.value);
});

// Check if any dashboard has AI Insights charts
const projectAIDashboards = computed(() => {
    return projectDashboards.value.filter(dashboard => {
        return dashboard.data?.charts?.some(chart => chart.source_type === 'ai_insights');
    });
});

// Boolean flags for enabling logic
const hasDataSources = computed(() => isMounted.value && projectDataSources.value.length > 0);
const hasDataModels = computed(() => isMounted.value && projectDataModels.value.length > 0);
const hasAIDashboards = computed(() => isMounted.value && projectAIDashboards.value.length > 0);

// Feature enabling conditions
const isCampaignsEnabled = computed(() => hasDataSources.value);
const isMarketingHubEnabled = computed(() => hasDataSources.value);
const isAIInsightsEnabled = computed(() => hasDataSources.value);
const isDashboardsEnabled = computed(() => 
    hasDataSources.value && (hasDataModels.value || hasAIDashboards.value)
);

// Tooltip messages for disabled features
const campaignsTooltip = computed(() => 
    !hasDataSources.value 
        ? 'Connect at least one data source to enable campaigns' 
        : ''
);

const marketingHubTooltip = computed(() => 
    !hasDataSources.value 
        ? 'Connect at least one data source to enable marketing analytics' 
        : ''
);

const aiInsightsTooltip = computed(() => 
    !hasDataSources.value 
        ? 'Connect at least one data source to enable AI insights' 
        : ''
);

const dashboardsTooltip = computed(() => {
    if (!hasDataSources.value) {
        return 'Connect a data source and create a data model or AI dashboard to enable dashboards';
    }
    if (!hasDataModels.value && !hasAIDashboards.value) {
        return 'Create a data model or generate an AI Insights dashboard to enable dashboards';
    }
    return '';
});

// Active state helpers
const currentPath = computed(() => route.path);

function isExactActive(path: string) {
    return currentPath.value === path;
}

function isPrefixActive(prefix: string) {
    return currentPath.value.startsWith(prefix);
}

function baseUrl(suffix = '') {
    return `/projects/${projectId.value}${suffix}`;
}

const isOverviewActive = computed(() => isExactActive(baseUrl()));
const isCampaignsActive = computed(() => isPrefixActive(baseUrl('/campaigns')));

const campaignsCount = computed(() =>
    projectId.value ? campaignsStore.projectCampaignsCount(projectId.value) : 0,
);
const isMarketingHubActive = computed(() => isPrefixActive(baseUrl('/marketing')));
const isPerformanceActive = computed(() => isExactActive(baseUrl('/marketing')));
const isAttributionActive = computed(() => isPrefixActive(baseUrl('/marketing/attribution')));
const isReportsActive = computed(() => isPrefixActive(baseUrl('/marketing/reports')));
const isDataConnectivityActive = computed(
    () =>
        isPrefixActive(baseUrl('/data-sources')) ||
        isPrefixActive(baseUrl('/data-models')),
);
const isDataSourcesActive = computed(() => isPrefixActive(baseUrl('/data-sources')));
const isDataModelsActive = computed(() => isPrefixActive(baseUrl('/data-models')));
const isAIInsightsActive = computed(() => isPrefixActive(baseUrl('/insights')));
const isDashboardsActive = computed(() => isPrefixActive(baseUrl('/dashboards')));

// Tooltip helper — only show when collapsed, placement always right
function tip(label: string) {
    return effectivelyCollapsed.value ? { content: label, placement: 'right' } : { content: '' };
}
</script>

<template>
    <!-- Mobile backdrop -->
    <div
        v-show="mobileNavOpen"
        class="fixed inset-0 bg-black/50 z-30 md:hidden transition-opacity duration-300"
        :class="mobileNavOpen ? 'opacity-100' : 'opacity-0 pointer-events-none'"
        @click="mobileNavOpen = false"
    />

    <aside
        v-bind="$attrs"
        class="flex flex-col bg-primary-blue-300 text-white shrink-0 transition-all duration-300 overflow-hidden
               fixed inset-y-0 left-0 z-40 w-72
               md:static md:z-auto md:translate-x-0 md:min-h-full"
        :class="[
            mobileNavOpen ? 'translate-x-0' : '-translate-x-full',
            effectivelyCollapsed ? 'md:w-16' : 'md:w-64',
        ]"
        aria-label="Marketing project navigation"
    >
        <!-- Header: project name + collapse toggle -->
        <div
            class="border-b border-primary-blue-400 flex items-center"
            :class="effectivelyCollapsed ? 'justify-center py-4 px-2' : 'px-4 py-5 justify-between'"
        >
            <div v-if="!effectivelyCollapsed" class="min-w-0 flex-1 mr-2">
                <p class="text-xs uppercase tracking-widest text-blue-200 mb-1">Project</p>
                <h2
                    class="text-sm font-semibold text-white truncate"
                    v-tippy="{ content: projectName, maxWidth: 300 }"
                >
                    {{ projectName }}
                </h2>
            </div>
            <!-- Desktop collapse toggle -->
            <button
                @click="toggleCollapsed"
                type="button"
                class="hidden md:flex items-center justify-center w-7 h-7 rounded hover:bg-primary-blue-400 transition-colors shrink-0 cursor-pointer"
                v-tippy="{ content: effectivelyCollapsed ? 'Expand sidebar' : 'Collapse sidebar', placement: 'right' }"
            >
                <font-awesome-icon
                    :icon="['fas', effectivelyCollapsed ? 'chevron-right' : 'chevron-left']"
                    class="w-3 h-3"
                />
            </button>
            <!-- Mobile close button -->
            <button
                @click="mobileNavOpen = false"
                type="button"
                class="md:hidden flex items-center justify-center w-7 h-7 rounded hover:bg-primary-blue-400 transition-colors shrink-0 cursor-pointer"
                aria-label="Close navigation"
            >
                <font-awesome-icon :icon="['fas', 'xmark']" class="w-4 h-4" />
            </button>
        </div>

        <nav class="flex-1 overflow-y-auto py-3">
            <!-- Overview -->
            <NuxtLink
                :to="baseUrl()"
                class="flex items-center py-2.5 text-sm font-medium transition-colors"
                :class="[
                    effectivelyCollapsed ? 'justify-center px-0' : 'gap-3 px-4',
                    isOverviewActive ? 'bg-primary-blue-400 text-white' : 'text-blue-100 hover:bg-primary-blue-400 hover:text-white',
                ]"
                v-tippy="tip('Overview')"
            >
                <font-awesome-icon :icon="['fas', 'chart-pie']" class="w-4 h-4 shrink-0" />
                <span v-if="!effectivelyCollapsed">Overview</span>
            </NuxtLink>

            <!-- Data Connectivity — analyst-only -->
            <div v-if="isAnalystSafe">
                <NuxtLink
                    v-if="effectivelyCollapsed"
                    :to="baseUrl('/data-sources')"
                    class="hidden md:flex items-center justify-center py-2.5 text-sm font-medium transition-colors"
                    :class="isDataConnectivityActive ? 'bg-primary-blue-400 text-white' : 'text-blue-100 hover:bg-primary-blue-400 hover:text-white'"
                    v-tippy="{ content: 'Data Connectivity', placement: 'right' }"
                >
                    <font-awesome-icon :icon="['fas', 'database']" class="w-4 h-4 shrink-0" />
                </NuxtLink>
                <template v-if="!effectivelyCollapsed">
                    <button
                        class="flex items-center justify-between w-full px-4 py-2.5 text-sm font-medium transition-colors cursor-pointer"
                        :class="isDataConnectivityActive ? 'text-white bg-primary-blue-400' : 'text-blue-100 hover:bg-primary-blue-400 hover:text-white'"
                        @click="toggleSection('dataConnectivity')"
                        type="button"
                    >
                        <span class="flex items-center gap-3">
                            <font-awesome-icon :icon="['fas', 'database']" class="w-4 h-4 shrink-0" />
                            Data Connectivity
                        </span>
                        <font-awesome-icon
                            :icon="['fas', 'chevron-down']"
                            class="w-3 h-3 shrink-0 transition-transform"
                            :class="{ 'rotate-180': !expanded.dataConnectivity }"
                        />
                    </button>
                    <div v-show="expanded.dataConnectivity" class="pl-10">
                        <NuxtLink
                            :to="baseUrl('/data-sources')"
                            class="flex items-center gap-2 px-4 py-2 text-sm transition-colors"
                            :class="isDataSourcesActive ? 'text-white' : 'text-blue-200 hover:text-white'"
                        >
                            Data Sources
                        </NuxtLink>
                        <NuxtLink
                            :to="baseUrl('/data-models')"
                            class="flex items-center gap-2 px-4 py-2 text-sm transition-colors"
                            :class="isDataModelsActive ? 'text-white' : 'text-blue-200 hover:text-white'"
                        >
                            Data Models
                        </NuxtLink>
                    </div>
                </template>
            </div>

            <!-- Campaigns — manager and analyst only -->
            <div v-if="isManagerSafe">
                <!-- Collapsed: single icon link -->
                <NuxtLink
                    v-if="effectivelyCollapsed"
                    :to="baseUrl('/campaigns')"
                    @click="!isCampaignsEnabled ? $event.preventDefault() : null"
                    class="hidden md:flex items-center justify-center py-2.5 text-sm font-medium transition-colors"
                    :class="[
                        isCampaignsEnabled 
                            ? (isCampaignsActive ? 'bg-primary-blue-400 text-white' : 'text-blue-100 hover:bg-primary-blue-400 hover:text-white')
                            : 'text-blue-300 opacity-50 cursor-not-allowed'
                    ]"
                    v-tippy="isCampaignsEnabled ? { content: 'Campaigns', placement: 'right' } : { content: campaignsTooltip, placement: 'right' }"
                >
                    <font-awesome-icon :icon="['fas', 'bullhorn']" class="w-4 h-4 shrink-0" />
                </NuxtLink>
                <!-- Expanded: toggle + sub-items -->
                <template v-if="!effectivelyCollapsed">
                    <button
                        :disabled="!isCampaignsEnabled"
                        class="flex items-center justify-between w-full px-4 py-2.5 text-sm font-medium transition-colors"
                        :class="[
                            isCampaignsEnabled 
                                ? (isCampaignsActive ? 'text-white bg-primary-blue-400' : 'text-blue-100 hover:bg-primary-blue-400 hover:text-white cursor-pointer')
                                : 'text-blue-300 opacity-50 cursor-not-allowed'
                        ]"
                        @click="isCampaignsEnabled ? toggleSection('campaigns') : null"
                        type="button"
                    >
                        <span class="flex items-center gap-3">
                            <font-awesome-icon :icon="['fas', 'bullhorn']" class="w-4 h-4 shrink-0" />
                            <span class="flex items-center gap-2">
                                Campaigns
                                <font-awesome-icon 
                                    v-if="!isCampaignsEnabled"
                                    :icon="['fas', 'circle-info']"
                                    class="w-3 h-3"
                                    v-tippy="{ content: campaignsTooltip, placement: 'right', theme: 'light' }"
                                />
                            </span>
                            <span
                                v-if="isCampaignsEnabled && campaignsCount > 0"
                                class="ml-auto inline-flex items-center justify-center min-w-[1.25rem] h-5 px-1 rounded-full bg-primary-blue-400 text-white text-xs font-semibold"
                            >{{ campaignsCount }}</span>
                        </span>
                        <font-awesome-icon
                            v-if="isCampaignsEnabled"
                            :icon="['fas', 'chevron-down']"
                            class="w-3 h-3 shrink-0 transition-transform"
                            :class="{ 'rotate-180': !expanded.campaigns }"
                        />
                    </button>
                    <div v-show="isCampaignsEnabled && expanded.campaigns" class="pl-10">
                        <NuxtLink
                            :to="baseUrl('/campaigns')"
                            class="flex items-center gap-2 px-4 py-2 text-sm transition-colors"
                            :class="isCampaignsActive ? 'text-white' : 'text-blue-200 hover:text-white'"
                        >
                            Campaign List
                        </NuxtLink>
                    </div>
                </template>
            </div>

            <!-- Marketing Hub -->
            <div>
                <NuxtLink
                    v-if="effectivelyCollapsed"
                    :to="baseUrl('/marketing')"
                    @click="!isMarketingHubEnabled ? $event.preventDefault() : null"
                    class="hidden md:flex items-center justify-center py-2.5 text-sm font-medium transition-colors"
                    :class="[
                        isMarketingHubEnabled
                            ? (isMarketingHubActive ? 'bg-primary-blue-400 text-white' : 'text-blue-100 hover:bg-primary-blue-400 hover:text-white')
                            : 'text-blue-300 opacity-50 cursor-not-allowed'
                    ]"
                    v-tippy="isMarketingHubEnabled ? { content: 'Marketing Hub', placement: 'right' } : { content: marketingHubTooltip, placement: 'right' }"
                >
                    <font-awesome-icon :icon="['fas', 'chart-line']" class="w-4 h-4 shrink-0" />
                </NuxtLink>
                <template v-if="!effectivelyCollapsed">
                    <button
                        :disabled="!isMarketingHubEnabled"
                        class="flex items-center justify-between w-full px-4 py-2.5 text-sm font-medium transition-colors"
                        :class="[
                            isMarketingHubEnabled
                                ? (isMarketingHubActive ? 'text-white bg-primary-blue-400' : 'text-blue-100 hover:bg-primary-blue-400 hover:text-white cursor-pointer')
                                : 'text-blue-300 opacity-50 cursor-not-allowed'
                        ]"
                        @click="isMarketingHubEnabled ? toggleSection('marketingHub') : null"
                        type="button"
                    >
                        <span class="flex items-center gap-3">
                            <font-awesome-icon :icon="['fas', 'chart-line']" class="w-4 h-4 shrink-0" />
                            <span class="flex items-center gap-2">
                                Marketing Hub
                                <font-awesome-icon 
                                    v-if="!isMarketingHubEnabled"
                                    :icon="['fas', 'circle-info']"
                                    class="w-3 h-3"
                                    v-tippy="{ content: marketingHubTooltip, placement: 'right', theme: 'light' }"
                                />
                            </span>
                        </span>
                        <font-awesome-icon
                            v-if="isMarketingHubEnabled"
                            :icon="['fas', 'chevron-down']"
                            class="w-3 h-3 shrink-0 transition-transform"
                            :class="{ 'rotate-180': !expanded.marketingHub }"
                        />
                    </button>
                    <div v-show="isMarketingHubEnabled && expanded.marketingHub" class="pl-10">
                        <NuxtLink
                            :to="baseUrl('/marketing')"
                            class="flex items-center gap-2 px-4 py-2 text-sm transition-colors"
                            :class="isPerformanceActive ? 'text-white' : 'text-blue-200 hover:text-white'"
                        >
                            Performance
                        </NuxtLink>
                        <NuxtLink
                            :to="baseUrl('/marketing/attribution')"
                            class="flex items-center gap-2 px-4 py-2 text-sm transition-colors"
                            :class="isAttributionActive ? 'text-white' : 'text-blue-200 hover:text-white'"
                        >
                            Attribution
                        </NuxtLink>
                        <NuxtLink
                            :to="baseUrl('/marketing/reports')"
                            class="flex items-center gap-2 px-4 py-2 text-sm transition-colors"
                            :class="isReportsActive ? 'text-white' : 'text-blue-200 hover:text-white'"
                        >
                            Reports
                        </NuxtLink>
                        <NuxtLink
                            v-if="isAnalystSafe"
                            :to="baseUrl('/marketing/reports?tab=templates')"
                            class="flex items-center gap-2 pl-4 pr-4 py-1.5 text-xs transition-colors"
                            :class="isReportsActive ? 'text-blue-200' : 'text-blue-300 hover:text-white'"
                        >
                            <font-awesome-icon :icon="['fas', 'layer-group']" class="w-3 h-3" />
                            Dashboard Templates
                        </NuxtLink>
                    </div>
                </template>
            </div>

            <!-- AI Insights — manager and analyst only -->
            <NuxtLink
                v-if="isManagerSafe"
                :to="baseUrl('/insights')"
                @click="!isAIInsightsEnabled ? $event.preventDefault() : null"
                class="flex items-center py-2.5 text-sm font-medium transition-colors"
                :class="[
                    effectivelyCollapsed ? 'justify-center px-0' : 'gap-3 px-4',
                    isAIInsightsEnabled
                        ? (isAIInsightsActive ? 'bg-primary-blue-400 text-white' : 'text-blue-100 hover:bg-primary-blue-400 hover:text-white')
                        : 'text-blue-300 opacity-50 cursor-not-allowed'
                ]"
                v-tippy="effectivelyCollapsed ? (isAIInsightsEnabled ? tip('AI Insights') : { content: aiInsightsTooltip, placement: 'right' }) : {}"
            >
                <font-awesome-icon :icon="['fas', 'robot']" class="w-4 h-4 shrink-0" />
                <span v-if="!effectivelyCollapsed" class="flex items-center gap-2">
                    AI Insights
                    <font-awesome-icon 
                        v-if="!isAIInsightsEnabled"
                        :icon="['fas', 'circle-info']"
                        class="w-3 h-3"
                        v-tippy="{ content: aiInsightsTooltip, placement: 'right', theme: 'light' }"
                    />
                </span>
            </NuxtLink>

            <!-- Dashboards — all roles can view -->
            <NuxtLink
                :to="baseUrl('/dashboards')"
                @click="!isDashboardsEnabled ? $event.preventDefault() : null"
                class="flex items-center py-2.5 text-sm font-medium transition-colors"
                :class="[
                    effectivelyCollapsed ? 'justify-center px-0' : 'gap-3 px-4',
                    isDashboardsEnabled
                        ? (isDashboardsActive ? 'bg-primary-blue-400 text-white' : 'text-blue-100 hover:bg-primary-blue-400 hover:text-white')
                        : 'text-blue-300 opacity-50 cursor-not-allowed'
                ]"
                v-tippy="effectivelyCollapsed ? (isDashboardsEnabled ? tip('Dashboards') : { content: dashboardsTooltip, placement: 'right' }) : {}"
            >
                <font-awesome-icon :icon="['fas', 'table-columns']" class="w-4 h-4 shrink-0" />
                <span v-if="!effectivelyCollapsed" class="flex items-center gap-2">
                    Dashboards
                    <font-awesome-icon 
                        v-if="!isDashboardsEnabled"
                        :icon="['fas', 'circle-info']"
                        class="w-3 h-3"
                        v-tippy="{ content: dashboardsTooltip, placement: 'right', theme: 'light' }"
                    />
                </span>
            </NuxtLink>

            <!-- Project Settings (Owner Only) -->
            <NuxtLink
                v-if="isOwner"
                :to="baseUrl('/settings')"
                class="flex items-center py-2.5 text-sm font-medium transition-colors"
                :class="[
                    effectivelyCollapsed ? 'justify-center px-0' : 'gap-3 px-4',
                    isPrefixActive(baseUrl('/settings')) ? 'bg-primary-blue-400 text-white' : 'text-blue-100 hover:bg-primary-blue-400 hover:text-white',
                ]"
                v-tippy="tip('Project Settings')"
            >
                <font-awesome-icon :icon="['fas', 'gear']" class="w-4 h-4 shrink-0" />
                <span v-if="!effectivelyCollapsed">Project Settings</span>
            </NuxtLink>
        </nav>
    </aside>
</template>
