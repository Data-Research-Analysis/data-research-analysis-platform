<script setup lang="ts">
/**
 * IntelligenceOverview — shell for the Intelligence Hub "Overview" tab.
 *
 * Sections:
 *   - Header: "Marketing Intelligence" title, date range selector, refresh button
 *   - KPI Summary section      (Marketing KPI Intelligence Dashboard — live)
 *   - Channel Comparison section (placeholder — populated in Channel Comparison Table)
 *   - AI Alerts section         (placeholder — populated in AI-Powered Anomaly Alerts)
 *   - Campaign Summary section  (placeholder — populated in Phase 5)
 *
 * When no data sources are connected, an empty state with CTA is shown instead.
 */

import type { DateRangeValue } from '@/components/intelligence/DateRangeSelector.vue';
import type { IIntelligenceHubSummary } from '@/types/IMarketingHub';
import type { IChannelRow, IChannelDelta, ChannelSortKey } from '@/composables/useChannelComparison';
import { useChannelComparison } from '@/composables/useChannelComparison';
import { useAnomalyAlerts } from '@/composables/useAnomalyAlerts';
import { usePaidMediaPlansStore, type IPlanSummary } from '@/stores/paid_media_plans';
import { useSubscriptionStore } from '@/stores/subscription';

interface Props {
    /** The project id — primary identifier for API-based data sources */
    projectId: number
    /** Whether there are connected data sources with data */
    hasData: boolean
    /** Whether data is currently loading */
    isLoading: boolean
    /** Intelligence hub summary data (null if not yet loaded) */
    summary: IIntelligenceHubSummary | null
    /**
     * @deprecated Use projectId instead. Kept for backward compatibility
     * with file-based data sources that don't belong to a project.
     */
    dataModelId?: number | null
    /** ISO date string — start of reporting period */
    startDate?: string | null
    /** ISO date string — end of reporting period */
    endDate?: string | null
}

const props = withDefaults(defineProps<Props>(), {
    hasData: false,
    isLoading: false,
    summary: null,
    dataModelId: null,
    startDate: null,
    endDate: null,
});

// ── Paid Media Plan summary ────────────────────────────────────────────────
const router = useRouter();
const paidMediaPlansStore = usePaidMediaPlansStore();
const subscriptionStore = useSubscriptionStore();
const projectsStore = useProjectsStore();

/** The plan shown in the overview: the CMO-aligned plan if one is set,
 *  otherwise the most recently updated plan. */
const latestPlan = computed<IPlanSummary | null>(() => {
    if (!paidMediaPlansStore.plans.length) return null;
    const project = projectsStore.projects.find(p => p.id === props.projectId);
    const currentPlanId = project?.current_plan_id ?? null;
    if (currentPlanId) {
        const aligned = paidMediaPlansStore.plans.find(p => p.id === currentPlanId);
        if (aligned) return aligned;
    }
    return [...paidMediaPlansStore.plans].sort(
        (a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime(),
    )[0];
});

/** True when the shown plan is the explicitly CMO-aligned one (not a fallback). */
const isAlignedExplicit = computed(() => {
    const project = projectsStore.projects.find(p => p.id === props.projectId);
    const currentPlanId = project?.current_plan_id ?? null;
    return !!currentPlanId && latestPlan.value?.id === currentPlanId;
});

const planProgress = computed(() => {
    const plan = latestPlan.value;
    if (!plan) return 0;
    const total = plan.stepCount || 1;
    return Math.round((plan.completedStepCount / total) * 100);
});

const buildsLabel = computed(() => {
    const s = subscriptionStore.usageStats;
    if (!s || s.maxPlansPerMonth == null) return null;
    if (s.maxPlansPerMonth === -1) return `${s.plansUsed ?? 0} builds used this month`;
    return `${s.plansUsed ?? 0} of ${s.maxPlansPerMonth} builds used this month`;
});

function openPlan() {
    router.push(`/projects/${props.projectId}/plan`);
}

function planStatusClasses(status: string): string {
    switch (status) {
        case 'completed':
            return 'bg-green-100 text-green-800';
        case 'running':
            return 'bg-blue-100 text-blue-800';
        case 'failed':
            return 'bg-red-100 text-red-800';
        case 'archived':
        case 'paused':
            return 'bg-gray-100 text-gray-700';
        default:
            return 'bg-amber-100 text-amber-800';
    }
}

function formatBudget(total: number | null, currency: string): string {
    if (total == null) return 'Budget not set';
    try {
        return new Intl.NumberFormat('en-US', {
            style: 'currency',
            currency: currency || 'USD',
            maximumFractionDigits: 0,
        }).format(total);
    } catch {
        return `$${total.toLocaleString('en-US')}`;
    }
}

onMounted(async () => {
    if (import.meta.client && projectsStore.projects.length === 0) {
        await projectsStore.retrieveProjects();
    }
    await paidMediaPlansStore.fetchPlans(props.projectId);
});

// ── Debug: Log props on mount and when they change ────────────────────────────
onMounted(() => {
    console.log('[IntelligenceOverview] 🚀 onMounted — props:', {
        projectId: props.projectId,
        hasData: props.hasData,
        isLoading: props.isLoading,
        summary: props.summary,
        startDate: props.startDate,
        endDate: props.endDate,
    });
});

watch(() => props, (newProps) => {
    console.log('[IntelligenceOverview] 👀 Props changed:', {
        hasData: newProps.hasData,
        isLoading: newProps.isLoading,
        summary: newProps.summary,
        startDate: newProps.startDate,
        endDate: newProps.endDate,
        channelsCount: newProps.summary?.channels?.length ?? 0,
    });
}, { deep: true });

// ── Refresh state ─────────────────────────────────────────────────────────────
const isRefreshing = ref(false);

interface Emits {
    (e: 'refresh'): void
    (e: 'update:range', range: DateRangeValue): void
    (e: 'campaign-click', campaign: any): void
    (e: 'channel-drill-down', channel: string): void
    (e: 'set-targets'): void
}

const emit = defineEmits<Emits>();

async function handleRefresh() {
    isRefreshing.value = true;
    emit('refresh');
    // Minimum spinner duration for UX feedback
    await new Promise(resolve => setTimeout(resolve, 800));
    isRefreshing.value = false;
}

function onRangeChange(range: DateRangeValue) {
    emit('update:range', range);
}

// ── Channel Comparison logic (delegated to composable) ──────────────────────

/** Map summary channels to IChannelRow[] */
const channelRows = computed<IChannelRow[]>(() => {
    if (!props.summary?.channels?.length) {
        console.log('[IntelligenceOverview] 📊 channelRows computed: no summary channels available');
        return [];
    }
    console.log('[IntelligenceOverview] 📊 channelRows computed:', {
        channelsCount: props.summary.channels.length,
        firstChannel: props.summary.channels[0],
    });
    return props.summary.channels.map(ch => ({
        channel: ch.channelLabel || ch.channelType || 'Unknown',
        spend: ch.spend,
        impressions: ch.impressions,
        clicks: ch.clicks,
        conversions: ch.conversions,
        revenue: ch.pipelineValue,
        ctr: ch.ctr,
        cpc: ch.clicks > 0 ? ch.spend / ch.clicks : 0,
        cpa: ch.cpl,
        roas: ch.roas,
    }));
});

const {
    sortedChannels,
    totals: channelTotals,
    sortBy: channelSortBy,
    sortDir: channelSortDir,
    toggleSort: toggleChannelSort,
    hasFetched: channelHasFetched,
    formatCurrency: fmtCurrency,
    formatNumber: fmtNumber,
    formatPercent: fmtPercent,
    formatRatio: fmtRatio,
    computeDeltas,
    formatDelta,
    deltaClass,
} = useChannelComparison({
    channelData: channelRows,
    immediate: false,
});

// ── Channel Comparison Deltas (prior-period) ─────────────────────────────
/** Prior period channel data for delta computation, provided by the hub
 *  summary response (priorChannels). */
const priorChannelRows = computed<IChannelRow[]>(() => {
    if (!props.summary?.priorChannels?.length) return [];
    return props.summary.priorChannels.map(ch => ({
        channel: ch.channelLabel || ch.channelType || 'Unknown',
        spend: ch.spend,
        impressions: ch.impressions,
        clicks: ch.clicks,
        conversions: ch.conversions,
        revenue: ch.pipelineValue,
        ctr: ch.ctr,
        cpc: ch.clicks > 0 ? ch.spend / ch.clicks : 0,
        cpa: ch.cpl,
        roas: ch.roas,
    }));
});

/** Deltas map keyed by channel name */
const channelDeltasMap = computed<Map<string, IChannelDelta>>(() => {
    return computeDeltas(channelRows.value, priorChannelRows.value);
});

/** Handle drill-down from channel rows — scrolls to campaign section or emits */
function handleChannelDrillDown(channel: string) {
    emit('channel-drill-down', channel);
    // Scroll to campaign section for quick navigation
    const campaignSection = document.querySelector('[data-section="campaign-performance"]');
    if (campaignSection) {
        campaignSection.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
}

// ── AI Anomaly Alerts (MKT-005 + MKT-007 integration) ────────────────────
const includeAiEnhancement = ref(false);

console.log('[IntelligenceOverview] 🤖 Initializing useAnomalyAlerts with:', {
    projectId: props.projectId,
    startDate: props.startDate,
    endDate: props.endDate,
});

const {
    alerts: anomalyAlerts,
    sortedAlerts: sortedAnomalyAlerts,
    summary: alertSummary,
    isLoading: alertsLoading,
    hasTargets: alertsHasTargets,
    error: alertError,
    fetch: fetchAlerts,
} = useAnomalyAlerts({
    projectId: computed(() => props.projectId),
    startDate: computed(() => props.startDate),
    endDate: computed(() => props.endDate),
    includeAiEnhancement,
});

watch([anomalyAlerts, alertSummary], ([newAlerts, newSummary]) => {
    console.log('[IntelligenceOverview] 🚨 Alerts updated:', { count: newAlerts?.length, summary: newSummary });
}, { immediate: true });

function handleToggleAi() {
    includeAiEnhancement.value = !includeAiEnhancement.value;
    fetchAlerts();
}
</script>

<template>
    <!-- ── Empty state (no data sources) ────────────────────────────── -->
    <IntelligenceEmptyState
        v-if="!hasData && !isLoading"
        :project-id="projectId"
    />

    <!-- ── Overview content (placeholder skeleton) ──────────────────── -->
    <div v-else class="intelligence-overview space-y-6 animate-fade-in">

        <!-- Header row -->
        <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
                <h2 class="text-lg font-bold text-gray-900">Marketing Intelligence</h2>
                <p class="text-sm text-gray-400 mt-0.5">
                    Cross-channel performance at a glance
                </p>
            </div>
            <div class="flex items-center gap-2">
                <!-- Date range selector -->
                <DateRangeSelector @update:range="onRangeChange" />

                <!-- Refresh button -->
                <button
                    type="button"
                    class="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium text-gray-600 bg-white border border-gray-200 rounded-lg hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-primary-blue-100 transition-colors cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                    :disabled="isRefreshing"
                    @click="handleRefresh"
                >
                    <font-awesome-icon
                        :icon="['fas', 'arrow-rotate-right']"
                        class="w-3.5 h-3.5"
                        :class="{ 'animate-spin': isRefreshing }"
                    />
                    {{ isRefreshing ? 'Refreshing…' : 'Refresh' }}
                </button>
            </div>
        </div>

        <!-- ── Paid Media Plan Summary ────────────────────────────────── -->
        <section class="bg-white rounded-xl border border-gray-200 p-5">
            <div class="flex items-center gap-2 mb-4">
                <div class="w-8 h-8 rounded-lg bg-sky-50 flex items-center justify-center">
                    <font-awesome-icon :icon="['fas', 'bullseye']" class="text-sm text-sky-500" />
                </div>
                <h3 class="text-sm font-semibold text-gray-700">Your Paid Media Plan</h3>
                <span
                    v-if="isAlignedExplicit"
                    class="ml-auto inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-green-100 text-green-700"
                >
                    <font-awesome-icon :icon="['fas', 'bullseye']" class="mr-1 text-[8px]" />
                    Aligned plan
                </span>
                <span
                    v-else-if="latestPlan"
                    class="ml-auto inline-flex items-center px-2 py-1 rounded-full text-xs font-medium capitalize"
                    :class="planStatusClasses(latestPlan.status)"
                >
                    <font-awesome-icon :icon="['fas', 'circle']" class="mr-1 text-[8px]" />
                    {{ latestPlan.status }}
                </span>
            </div>

            <template v-if="latestPlan">
                <div class="flex flex-col md:flex-row md:items-center gap-4">
                    <div class="flex-1 min-w-0">
                        <p class="font-semibold text-gray-900 truncate">{{ latestPlan.name }}</p>
                        <div class="flex flex-wrap gap-2 mt-2">
                            <span
                                v-for="p in latestPlan.platforms"
                                :key="p"
                                class="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-blue-50 text-blue-700 border border-blue-100"
                            >
                                {{ p }}
                            </span>
                        </div>
                        <p class="text-sm text-gray-500 mt-2">
                            {{ latestPlan.markets.join(', ') || 'No markets' }}
                            · {{ formatBudget(latestPlan.budgetTotal, latestPlan.currency) }}
                            · {{ latestPlan.mode }} mode
                        </p>
                    </div>
                    <div class="shrink-0 flex flex-col items-end gap-2">
                        <span v-if="buildsLabel" class="text-xs text-gray-500">{{ buildsLabel }}</span>
                        <button
                            type="button"
                            class="px-4 py-2 bg-primary-blue-100 text-white rounded-lg text-sm font-medium hover:bg-primary-blue-300 transition-colors cursor-pointer"
                            @click="openPlan"
                        >
                            Open plan
                        </button>
                    </div>
                </div>
                <div class="mt-3 flex items-center gap-3">
                    <div class="flex-1 h-2 bg-gray-100 rounded-full overflow-hidden">
                        <div class="h-full bg-blue-500 rounded-full transition-all duration-300" :style="{ width: planProgress + '%' }"></div>
                    </div>
                    <span class="text-xs text-gray-500 shrink-0">
                        {{ latestPlan.completedStepCount }}/{{ latestPlan.stepCount }} steps · {{ latestPlan.artifactCount }} artifacts
                    </span>
                </div>
            </template>

            <div v-else class="text-center py-8">
                <font-awesome-icon :icon="['fas', 'bullseye']" class="text-3xl text-gray-300 mb-3" />
                <p class="text-gray-600 mb-4">No paid media plan for this project yet.</p>
                <button
                    type="button"
                    class="px-4 py-2 bg-primary-blue-100 text-white rounded-lg text-sm font-medium hover:bg-primary-blue-300 transition-colors cursor-pointer"
                    @click="openPlan"
                >
                    Build your paid media plan
                </button>
            </div>
        </section>

        <!-- ── KPI Summary Section (Marketing KPI Intelligence Dashboard) ── -->
        <section class="bg-white rounded-xl border border-gray-200 p-5">
            <div class="flex items-center gap-2 mb-4">
                <div class="w-8 h-8 rounded-lg bg-blue-50 flex items-center justify-center">
                    <font-awesome-icon :icon="['fas', 'chart-pie']" class="text-sm text-blue-400" />
                </div>
                <h3 class="text-sm font-semibold text-gray-700">KPI Summary</h3>
            </div>
            <KPISummarySection
                :summary="summary"
                :is-loading="isLoading"
            />
        </section>

        <!-- ── Channel Comparison Section (MKT-003) ──────────────────── -->
        <section class="bg-white rounded-xl border border-gray-200 p-5">
            <div class="flex items-center gap-2 mb-4">
                <div class="w-8 h-8 rounded-lg bg-indigo-50 flex items-center justify-center">
                    <font-awesome-icon :icon="['fas', 'chart-bar']" class="text-sm text-indigo-400" />
                </div>
                <h3 class="text-sm font-semibold text-gray-700">Channel Comparison</h3>
            </div>
            <ChannelComparisonTable
                :channels="sortedChannels"
                :totals="channelTotals"
                :is-loading="isLoading"
                :has-fetched="channelHasFetched"
                :sort-by="channelSortBy"
                :sort-dir="channelSortDir"
                :toggle-sort="toggleChannelSort"
                :format-currency="fmtCurrency"
                :format-number="fmtNumber"
                :format-percent="fmtPercent"
                :format-ratio="fmtRatio"
                :deltas-map="channelDeltasMap"
                :format-delta="formatDelta"
                :delta-class="deltaClass"
                @drill-down="handleChannelDrillDown"
            />
        </section>

        <!-- ── AI Alerts Section (MKT-005 + MKT-007) ────────────────── -->
        <section class="bg-white rounded-xl border border-gray-200 p-5">
            <div class="flex items-center gap-2 mb-4">
                <div class="w-8 h-8 rounded-lg bg-emerald-50 flex items-center justify-center">
                    <font-awesome-icon :icon="['fas', 'robot']" class="text-sm text-emerald-400" />
                </div>
                <h3 class="text-sm font-semibold text-gray-700">AI Alerts</h3>
                <span v-if="alertSummary.total > 0"
                      class="ml-2 inline-flex items-center justify-center w-5 h-5 text-[10px] font-bold text-white bg-red-500 rounded-full">
                    {{ alertSummary.total }}
                </span>
                <span v-if="alertsHasTargets" class="ml-auto text-[10px] text-gray-400">
                    Evaluated per ad set / ad group against its targets
                </span>
            </div>
            <AIAlertsList
                :alerts="sortedAnomalyAlerts"
                :summary="alertSummary"
                :is-loading="alertsLoading || isLoading"
                :error="alertError"
                :has-targets="alertsHasTargets"
                :format-currency="fmtCurrency"
                :format-percent="fmtPercent"
                @toggle-ai="handleToggleAi"
                @set-targets="emit('set-targets')"
            />
        </section>

        <!-- ── Campaign Summary Section (MKT-004) ──────────────────────── -->
        <section class="bg-white rounded-xl border border-gray-200 p-5" data-section="campaign-performance">
            <div class="flex items-center gap-2 mb-4">
                <div class="w-8 h-8 rounded-lg bg-rose-50 flex items-center justify-center">
                    <font-awesome-icon :icon="['fas', 'bullhorn']" class="text-sm text-rose-400" />
                </div>
                <h3 class="text-sm font-semibold text-gray-700">Campaign Performance</h3>
            </div>
            <CampaignPerformanceTable
                :project-id="projectId"
                :start-date="startDate"
                :end-date="endDate"
                :channels="summary?.channels?.map(ch => ch.channelLabel || ch.channelType || 'Unknown') || []"
                :max-height="400"
                :show-filters="true"
                @campaign-click="emit('campaign-click', $event)"
            />
        </section>

        <!-- ── Budget Optimizer Section (CMP-005) ──────────────────────── -->
        <section data-section="budget-optimizer">
            <div class="flex items-center gap-2 mb-4">
                <div class="w-8 h-8 rounded-lg bg-amber-50 flex items-center justify-center">
                    <font-awesome-icon :icon="['fas', 'wand-magic-sparkles']" class="text-sm text-amber-400" />
                </div>
                <h3 class="text-sm font-semibold text-gray-700">Budget Optimizer</h3>
                <span class="ml-1 inline-flex items-center text-[9px] font-medium text-purple-600 bg-purple-50 px-1.5 py-0.5 rounded-full">
                    AI-Powered
                </span>
            </div>
            <BudgetOptimizer
                :project-id="projectId"
                :start-date="startDate"
                :end-date="endDate"
            />
        </section>
    </div>
</template>