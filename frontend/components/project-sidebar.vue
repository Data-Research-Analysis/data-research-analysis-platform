<script setup lang="ts">
defineOptions({ inheritAttrs: false });

import { useProjectsStore } from '@/stores/projects';
import { useCampaignsStore } from '@/stores/campaigns';
import { useDataSourceStore } from '@/stores/data_sources';
import { useDataModelsStore } from '@/stores/data_models';
import { useDashboardsStore } from '@/stores/dashboards';
import { useProjectRole } from '@/composables/useProjectRole';

const route = useRoute();
const router = useRouter();
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
    if (!isMounted.value) return 'Project';
    const project = projectsStore.projects.find((p) => p.id === projectId.value);
    return project?.name || 'Project';
});

const currentProject = computed(() => {
    if (!projectId.value) return null;
    return projectsStore.projects.find((p) => p.id === projectId.value) || null;
});

const isOwner = computed(() => {
    if (!isMounted.value) return false;
    return currentProject.value?.is_owner || false;
});

// SSR-safe role checks
const isAnalystSafe = computed(() => isMounted.value && isAnalyst.value);
const isManagerSafe = computed(() => isMounted.value && isManager.value);
const isOwnerSafe = computed(() => isMounted.value && isOwner.value);

// Whether the sidebar rail is collapsed to icon-only (desktop only)
const isCollapsed = ref(false);
const isMobileViewport = ref(false);
const effectivelyCollapsed = computed(() => isCollapsed.value && !isMobileViewport.value);

const isMounted = ref(false);

// ─── Expandable section state ──────────────────────────────────────────
// Intelligence Hub expanded by default; Data collapsed by default
const expanded = reactive({
    intelligenceHub: true,
    data: false,
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
            expanded.intelligenceHub = parsed.intelligenceHub ?? true;
            expanded.data = parsed.data ?? false;
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
                intelligenceHub: expanded.intelligenceHub,
                data: expanded.data,
            }),
        );
    }
}

function toggleSection(section: 'intelligenceHub' | 'data') {
    expanded[section] = !expanded[section];
    persistState();
}

// ─── Progressive menu enabling ─────────────────────────────────────────

const projectDataSources = computed(() => {
    if (!projectId.value) return [];
    return dataSourceStore.dataSources.filter(ds => ds.project_id === projectId.value);
});

const projectDataModels = computed(() => {
    if (!projectId.value) return [];
    return dataModelsStore.dataModels.filter(dm => {
        const dmProjectId = (dm as any).project_id || dm.data_source?.project?.id;
        return dmProjectId === projectId.value;
    });
});

const projectDashboards = computed(() => {
    if (!projectId.value) return [];
    return dashboardsStore.dashboards.filter(d => d.project?.id === projectId.value);
});

const projectAIDashboards = computed(() => {
    return projectDashboards.value.filter(dashboard => {
        return dashboard.data?.charts?.some(chart => chart.source_type === 'ai_insights');
    });
});

const hasDataSources = computed(() => isMounted.value && projectDataSources.value.length > 0);
const hasDataModels = computed(() => isMounted.value && projectDataModels.value.length > 0);
const hasAIDashboards = computed(() => isMounted.value && projectAIDashboards.value.length > 0);

// Feature enabling conditions
const isDashboardsEnabled = computed(() =>
    hasDataSources.value && (hasDataModels.value || hasAIDashboards.value)
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

const campaignsCount = computed(() =>
    projectId.value ? campaignsStore.projectCampaignsCount(projectId.value) : 0,
);

// ─── Active state helpers ──────────────────────────────────────────────

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

// Intelligence Hub active states
const isIntelligenceHubActive = computed(() => isPrefixActive(baseUrl('/intelligence')));
const isIHOverviewActive = computed(() => isExactActive(baseUrl('/intelligence')));
const isIHCampaignsActive = computed(() => isIntelligenceHubActive.value && route.hash === '#campaigns');
const isIHAttributionActive = computed(() => isIntelligenceHubActive.value && route.hash === '#attribution');
const isIHInsightsActive = computed(() => isIntelligenceHubActive.value && route.hash === '#insights');

// Top-level active states
const isReportsActive = computed(() => isPrefixActive(baseUrl('/marketing/reports')));
const isDashboardsActive = computed(() => isPrefixActive(baseUrl('/dashboards')));

// Data section active states
const isDataActive = computed(() =>
    isPrefixActive(baseUrl('/data-sources')) ||
    isPrefixActive(baseUrl('/data-models'))
);
const isDataSourcesActive = computed(() => isPrefixActive(baseUrl('/data-sources')));
const isDataModelsActive = computed(() => isPrefixActive(baseUrl('/data-models')));

// Settings active state
const isSettingsActive = computed(() => isPrefixActive(baseUrl('/settings')));

// Tooltip helper
function tip(label: string) {
    return effectivelyCollapsed.value ? { content: label, placement: 'right' } : { content: '' };
}

// ─── Keyboard navigation ───────────────────────────────────────────────

const navRef = ref<HTMLElement | null>(null);

/** Collect all focusable nav links/buttons within the sidebar nav */
function getFocusableItems(): HTMLElement[] {
    if (!navRef.value) return [];
    return Array.from(
        navRef.value.querySelectorAll<HTMLElement>(
            'a[href], button:not([disabled])'
        )
    ).filter(el => {
        // Skip hidden items (v-show sets display:none)
        const parent = el.closest('[style*="display: none"]') as HTMLElement | null;
        return !parent;
    });
}

function handleNavKeydown(e: KeyboardEvent) {
    if (!['ArrowDown', 'ArrowUp', 'Home', 'End', 'Enter', ' '].includes(e.key)) return;

    const items = getFocusableItems();
    if (!items.length) return;

    const currentIndex = items.indexOf(document.activeElement as HTMLElement);

    if (e.key === 'ArrowDown') {
        e.preventDefault();
        const next = currentIndex < items.length - 1 ? currentIndex + 1 : 0;
        items[next].focus();
    } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        const prev = currentIndex > 0 ? currentIndex - 1 : items.length - 1;
        items[prev].focus();
    } else if (e.key === 'Home') {
        e.preventDefault();
        items[0].focus();
    } else if (e.key === 'End') {
        e.preventDefault();
        items[items.length - 1].focus();
    } else if (e.key === 'Enter' || e.key === ' ') {
        // For section toggle buttons, activate the click
        if (document.activeElement instanceof HTMLButtonElement) {
            e.preventDefault();
            document.activeElement.click();
        }
    }
}

/** Navigate to a route and close mobile nav */
function navigateTo(path: string) {
    router.push(path);
    mobileNavOpen.value = false;
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
        aria-label="Project navigation"
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

        <nav
            ref="navRef"
            class="flex-1 overflow-y-auto py-3"
            role="navigation"
            aria-label="Project sections"
            @keydown="handleNavKeydown"
        >
            <!-- ════════════════════════════════════════════════════════ -->
            <!-- 1. Intelligence Hub — primary, expanded by default       -->
            <!-- ════════════════════════════════════════════════════════ -->
            <div v-if="isManagerSafe">
                <!-- Collapsed rail: single icon -->
                <NuxtLink
                    v-if="effectivelyCollapsed"
                    :to="baseUrl('/intelligence')"
                    class="hidden md:flex items-center justify-center py-2.5 text-sm font-medium transition-colors"
                    :class="isIntelligenceHubActive ? 'bg-primary-blue-400 text-white' : 'text-blue-100 hover:bg-primary-blue-400 hover:text-white'"
                    v-tippy="{ content: 'Intelligence Hub', placement: 'right' }"
                    @click="navigateTo(baseUrl('/intelligence'))"
                >
                    <font-awesome-icon :icon="['fas', 'brain']" class="w-4 h-4 shrink-0" />
                </NuxtLink>

                <!-- Expanded: section header + children -->
                <template v-if="!effectivelyCollapsed">
                    <button
                        class="flex items-center justify-between w-full px-4 py-2.5 text-sm font-medium transition-colors cursor-pointer"
                        :class="isIntelligenceHubActive ? 'text-white bg-primary-blue-400' : 'text-blue-100 hover:bg-primary-blue-400 hover:text-white'"
                        @click="toggleSection('intelligenceHub')"
                        type="button"
                        :aria-expanded="expanded.intelligenceHub"
                        aria-controls="ih-children"
                    >
                        <span class="flex items-center gap-3">
                            <font-awesome-icon :icon="['fas', 'brain']" class="w-4 h-4 shrink-0" />
                            Intelligence Hub
                        </span>
                        <font-awesome-icon
                            :icon="['fas', 'chevron-down']"
                            class="w-3 h-3 shrink-0 transition-transform duration-200"
                            :class="{ 'rotate-180': !expanded.intelligenceHub }"
                        />
                    </button>
                    <div
                        id="ih-children"
                        v-show="expanded.intelligenceHub"
                        class="pl-10 transition-all duration-200"
                    >
                        <NuxtLink
                            :to="baseUrl('/intelligence')"
                            class="flex items-center gap-2 px-4 py-2 text-sm transition-colors"
                            :class="isIHOverviewActive && !route.hash ? 'text-white' : 'text-blue-200 hover:text-white'"
                            @click="navigateTo(baseUrl('/intelligence'))"
                        >
                            <font-awesome-icon :icon="['fas', 'chart-pie']" class="w-3 h-3 shrink-0" />
                            Overview
                        </NuxtLink>
                        <NuxtLink
                            :to="baseUrl('/intelligence#campaigns')"
                            class="flex items-center gap-2 px-4 py-2 text-sm transition-colors"
                            :class="isIHCampaignsActive ? 'text-white' : 'text-blue-200 hover:text-white'"
                            @click="navigateTo(baseUrl('/intelligence#campaigns'))"
                        >
                            <font-awesome-icon :icon="['fas', 'bullhorn']" class="w-3 h-3 shrink-0" />
                            Campaigns
                            <span
                                v-if="campaignsCount > 0"
                                class="ml-auto inline-flex items-center justify-center min-w-[1.25rem] h-5 px-1 rounded-full bg-primary-blue-400 text-white text-xs font-semibold"
                            >{{ campaignsCount }}</span>
                        </NuxtLink>
                        <NuxtLink
                            :to="baseUrl('/intelligence#attribution')"
                            class="flex items-center gap-2 px-4 py-2 text-sm transition-colors"
                            :class="isIHAttributionActive ? 'text-white' : 'text-blue-200 hover:text-white'"
                            @click="navigateTo(baseUrl('/intelligence#attribution'))"
                        >
                            <font-awesome-icon :icon="['fas', 'route']" class="w-3 h-3 shrink-0" />
                            Attribution
                        </NuxtLink>
                        <NuxtLink
                            :to="baseUrl('/intelligence#insights')"
                            class="flex items-center gap-2 px-4 py-2 text-sm transition-colors"
                            :class="isIHInsightsActive ? 'text-white' : 'text-blue-200 hover:text-white'"
                            @click="navigateTo(baseUrl('/intelligence#insights'))"
                        >
                            <font-awesome-icon :icon="['fas', 'robot']" class="w-3 h-3 shrink-0" />
                            AI Insights
                        </NuxtLink>
                    </div>
                </template>
            </div>

            <!-- ════════════════════════════════════════════════════════ -->
            <!-- 2. Reports — top-level link                             -->
            <!-- ════════════════════════════════════════════════════════ -->
            <NuxtLink
                :to="baseUrl('/marketing/reports')"
                class="flex items-center py-2.5 text-sm font-medium transition-colors"
                :class="[
                    effectivelyCollapsed ? 'justify-center px-0' : 'gap-3 px-4',
                    isReportsActive ? 'bg-primary-blue-400 text-white' : 'text-blue-100 hover:bg-primary-blue-400 hover:text-white',
                ]"
                v-tippy="tip('Reports')"
                @click="navigateTo(baseUrl('/marketing/reports'))"
            >
                <font-awesome-icon :icon="['fas', 'file-lines']" class="w-4 h-4 shrink-0" />
                <span v-if="!effectivelyCollapsed">Reports</span>
            </NuxtLink>

            <!-- ════════════════════════════════════════════════════════ -->
            <!-- 3. Dashboards — top-level link (role-gated)             -->
            <!-- ════════════════════════════════════════════════════════ -->
            <NuxtLink
                :to="baseUrl('/dashboards')"
                @click="!isDashboardsEnabled ? $event.preventDefault() : navigateTo(baseUrl('/dashboards'))"
                class="flex items-center py-2.5 text-sm font-medium transition-colors"
                :class="[
                    effectivelyCollapsed ? 'justify-center px-0' : 'gap-3 px-4',
                    isDashboardsEnabled
                        ? (isDashboardsActive ? 'bg-primary-blue-400 text-white' : 'text-blue-100 hover:bg-primary-blue-400 hover:text-white')
                        : 'text-blue-300 opacity-50 cursor-not-allowed',
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

            <!-- ════════════════════════════════════════════════════════ -->
            <!-- 4. Data — collapsed by default, analyst-only            -->
            <!-- ════════════════════════════════════════════════════════ -->
            <div v-if="isAnalystSafe">
                <!-- Collapsed rail: single icon -->
                <NuxtLink
                    v-if="effectivelyCollapsed"
                    :to="baseUrl('/data-sources')"
                    class="hidden md:flex items-center justify-center py-2.5 text-sm font-medium transition-colors"
                    :class="isDataActive ? 'bg-primary-blue-400 text-white' : 'text-blue-100 hover:bg-primary-blue-400 hover:text-white'"
                    v-tippy="{ content: 'Data', placement: 'right' }"
                    @click="navigateTo(baseUrl('/data-sources'))"
                >
                    <font-awesome-icon :icon="['fas', 'database']" class="w-4 h-4 shrink-0" />
                </NuxtLink>

                <!-- Expanded: section header + children -->
                <template v-if="!effectivelyCollapsed">
                    <button
                        class="flex items-center justify-between w-full px-4 py-2.5 text-sm font-medium transition-colors cursor-pointer"
                        :class="isDataActive ? 'text-white bg-primary-blue-400' : 'text-blue-100 hover:bg-primary-blue-400 hover:text-white'"
                        @click="toggleSection('data')"
                        type="button"
                        :aria-expanded="expanded.data"
                        aria-controls="data-children"
                    >
                        <span class="flex items-center gap-3">
                            <font-awesome-icon :icon="['fas', 'database']" class="w-4 h-4 shrink-0" />
                            Data
                        </span>
                        <font-awesome-icon
                            :icon="['fas', 'chevron-down']"
                            class="w-3 h-3 shrink-0 transition-transform duration-200"
                            :class="{ 'rotate-180': !expanded.data }"
                        />
                    </button>
                    <div
                        id="data-children"
                        v-show="expanded.data"
                        class="pl-10 transition-all duration-200"
                    >
                        <NuxtLink
                            :to="baseUrl('/data-sources')"
                            class="flex items-center gap-2 px-4 py-2 text-sm transition-colors"
                            :class="isDataSourcesActive ? 'text-white' : 'text-blue-200 hover:text-white'"
                            @click="navigateTo(baseUrl('/data-sources'))"
                        >
                            <font-awesome-icon :icon="['fas', 'plug']" class="w-3 h-3 shrink-0" />
                            Connections
                        </NuxtLink>
                        <NuxtLink
                            :to="baseUrl('/data-models')"
                            class="flex items-center gap-2 px-4 py-2 text-sm transition-colors"
                            :class="isDataModelsActive ? 'text-white' : 'text-blue-200 hover:text-white'"
                            @click="navigateTo(baseUrl('/data-models'))"
                        >
                            <font-awesome-icon :icon="['fas', 'diagram-project']" class="w-3 h-3 shrink-0" />
                            Models
                        </NuxtLink>
                        <NuxtLink
                            :to="baseUrl('/data-models')"
                            class="flex items-center gap-2 px-4 py-2 text-sm transition-colors"
                            :class="isDataModelsActive ? 'text-white' : 'text-blue-200 hover:text-white'"
                            @click="navigateTo(baseUrl('/data-models'))"
                        >
                            <font-awesome-icon :icon="['fas', 'shield-check']" class="w-3 h-3 shrink-0" />
                            Quality
                        </NuxtLink>
                    </div>
                </template>
            </div>

            <!-- ════════════════════════════════════════════════════════ -->
            <!-- 5. Project Settings — bottom, owner-only                -->
            <!-- ════════════════════════════════════════════════════════ -->
            <NuxtLink
                v-if="isOwnerSafe"
                :to="baseUrl('/settings')"
                class="flex items-center py-2.5 text-sm font-medium transition-colors"
                :class="[
                    effectivelyCollapsed ? 'justify-center px-0' : 'gap-3 px-4',
                    isSettingsActive ? 'bg-primary-blue-400 text-white' : 'text-blue-100 hover:bg-primary-blue-400 hover:text-white',
                ]"
                v-tippy="tip('Project Settings')"
                @click="navigateTo(baseUrl('/settings'))"
            >
                <font-awesome-icon :icon="['fas', 'gear']" class="w-4 h-4 shrink-0" />
                <span v-if="!effectivelyCollapsed">Project Settings</span>
            </NuxtLink>
        </nav>
    </aside>
</template>