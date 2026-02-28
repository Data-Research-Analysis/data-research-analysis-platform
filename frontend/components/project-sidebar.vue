<script setup lang="ts">
defineOptions({ inheritAttrs: false });

import { useProjectsStore } from '@/stores/projects';
import { useCampaignsStore } from '@/stores/campaigns';

const route = useRoute();
const projectsStore = useProjectsStore();
const campaignsStore = useCampaignsStore();

// Mobile drawer state injected from the layout
const mobileNavOpen = inject<Ref<boolean>>('mobileNavOpen', ref(false));

const projectId = computed(() => {
    const id = route.params.projectid;
    return id ? parseInt(String(id)) : null;
});

const projectName = computed(() => {
    if (!projectId.value) return 'Project';
    const project = projectsStore.projects.find((p) => p.id === projectId.value);
    return project?.name || 'Project';
});

// Whether the sidebar rail is collapsed to icon-only (desktop only)
const isCollapsed = ref(false);
// Track viewport to ensure collapsed mode only applies on desktop
const isMobileViewport = ref(false);
const effectivelyCollapsed = computed(() => isCollapsed.value && !isMobileViewport.value);

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

            <!-- Campaigns -->
            <div>
                <!-- Collapsed: single icon link -->
                <NuxtLink
                    v-if="effectivelyCollapsed"
                    :to="baseUrl('/campaigns')"
                    class="hidden md:flex items-center justify-center py-2.5 text-sm font-medium transition-colors"
                    :class="isCampaignsActive ? 'bg-primary-blue-400 text-white' : 'text-blue-100 hover:bg-primary-blue-400 hover:text-white'"
                    v-tippy="{ content: 'Campaigns', placement: 'right' }"
                >
                    <font-awesome-icon :icon="['fas', 'bullhorn']" class="w-4 h-4 shrink-0" />
                </NuxtLink>
                <!-- Expanded: toggle + sub-items -->
                <template v-if="!effectivelyCollapsed">
                    <button
                        class="flex items-center justify-between w-full px-4 py-2.5 text-sm font-medium transition-colors cursor-pointer"
                        :class="isCampaignsActive ? 'text-white bg-primary-blue-400' : 'text-blue-100 hover:bg-primary-blue-400 hover:text-white'"
                        @click="toggleSection('campaigns')"
                        type="button"
                    >
                        <span class="flex items-center gap-3">
                            <font-awesome-icon :icon="['fas', 'bullhorn']" class="w-4 h-4 shrink-0" />
                            Campaigns
                            <span
                                v-if="campaignsCount > 0"
                                class="ml-auto inline-flex items-center justify-center min-w-[1.25rem] h-5 px-1 rounded-full bg-primary-blue-400 text-white text-xs font-semibold"
                            >{{ campaignsCount }}</span>
                        </span>
                        <font-awesome-icon
                            :icon="['fas', 'chevron-down']"
                            class="w-3 h-3 shrink-0 transition-transform"
                            :class="{ 'rotate-180': !expanded.campaigns }"
                        />
                    </button>
                    <div v-show="expanded.campaigns" class="pl-10">
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
                    class="hidden md:flex items-center justify-center py-2.5 text-sm font-medium transition-colors"
                    :class="isMarketingHubActive ? 'bg-primary-blue-400 text-white' : 'text-blue-100 hover:bg-primary-blue-400 hover:text-white'"
                    v-tippy="{ content: 'Marketing Hub', placement: 'right' }"
                >
                    <font-awesome-icon :icon="['fas', 'chart-line']" class="w-4 h-4 shrink-0" />
                </NuxtLink>
                <template v-if="!effectivelyCollapsed">
                    <button
                        class="flex items-center justify-between w-full px-4 py-2.5 text-sm font-medium transition-colors cursor-pointer"
                        :class="isMarketingHubActive ? 'text-white bg-primary-blue-400' : 'text-blue-100 hover:bg-primary-blue-400 hover:text-white'"
                        @click="toggleSection('marketingHub')"
                        type="button"
                    >
                        <span class="flex items-center gap-3">
                            <font-awesome-icon :icon="['fas', 'chart-line']" class="w-4 h-4 shrink-0" />
                            Marketing Hub
                        </span>
                        <font-awesome-icon
                            :icon="['fas', 'chevron-down']"
                            class="w-3 h-3 shrink-0 transition-transform"
                            :class="{ 'rotate-180': !expanded.marketingHub }"
                        />
                    </button>
                    <div v-show="expanded.marketingHub" class="pl-10">
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

            <!-- Data Connectivity -->
            <div>
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

            <!-- Dashboards -->
            <NuxtLink
                :to="baseUrl('/dashboards')"
                class="flex items-center py-2.5 text-sm font-medium transition-colors"
                :class="[
                    effectivelyCollapsed ? 'justify-center px-0' : 'gap-3 px-4',
                    isDashboardsActive ? 'bg-primary-blue-400 text-white' : 'text-blue-100 hover:bg-primary-blue-400 hover:text-white',
                ]"
                v-tippy="tip('Dashboards')"
            >
                <font-awesome-icon :icon="['fas', 'table-columns']" class="w-4 h-4 shrink-0" />
                <span v-if="!effectivelyCollapsed">Dashboards</span>
            </NuxtLink>

            <!-- AI Insights -->
            <NuxtLink
                :to="baseUrl('/insights')"
                class="flex items-center py-2.5 text-sm font-medium transition-colors"
                :class="[
                    effectivelyCollapsed ? 'justify-center px-0' : 'gap-3 px-4',
                    isAIInsightsActive ? 'bg-primary-blue-400 text-white' : 'text-blue-100 hover:bg-primary-blue-400 hover:text-white',
                ]"
                v-tippy="tip('AI Insights')"
            >
                <font-awesome-icon :icon="['fas', 'robot']" class="w-4 h-4 shrink-0" />
                <span v-if="!effectivelyCollapsed">AI Insights</span>
            </NuxtLink>

            <!-- Project Settings -->
            <NuxtLink
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
