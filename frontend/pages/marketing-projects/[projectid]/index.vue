<script setup lang="ts">
import { useLoggedInUserStore } from '@/stores/logged_in_user';
import { useProjectsStore } from '@/stores/projects';
import { useMarketingHubStore } from '@/stores/marketingHub';
import { useCampaignsStore } from '@/stores/campaigns';
import { getAuthToken } from '~/composables/AuthToken';
import type { IMarketingTotals } from '~/types/IMarketingHub';

definePageMeta({ layout: 'marketing-project' });

const route = useRoute();
const router = useRouter();
const loggedInUserStore = useLoggedInUserStore();
const projectsStore = useProjectsStore();
const marketingHubStore = useMarketingHubStore();
const campaignsStore = useCampaignsStore();
const config = useRuntimeConfig();

const projectId = parseInt(String(route.params.projectid));

const summary = computed(() => marketingHubStore.hubSummary);
const isLoading = computed(() => marketingHubStore.isLoading);

const totals = computed<IMarketingTotals>(() =>
    summary.value?.totals ?? { spend: 0, impressions: 0, clicks: 0, conversions: 0, cpl: 0, pipelineValue: 0 },
);

const priorTotals = computed<IMarketingTotals>(() =>
    summary.value?.priorPeriodTotals ?? { spend: 0, impressions: 0, clicks: 0, conversions: 0, cpl: 0, pipelineValue: 0 },
);

function calcDelta(current: number, prior: number): number | null {
    if (prior === 0) return null;
    return (current - prior) / prior;
}

const kpiCards = computed(() => [
    {
        label: 'Total Spend',
        value: totals.value.spend,
        format: 'currency' as const,
        delta: calcDelta(totals.value.spend, priorTotals.value.spend),
        icon: ['fas', 'dollar-sign'],
    },
    {
        label: 'Impressions',
        value: totals.value.impressions,
        format: 'number' as const,
        delta: calcDelta(totals.value.impressions, priorTotals.value.impressions),
        icon: ['fas', 'eye'],
    },
    {
        label: 'Clicks',
        value: totals.value.clicks,
        format: 'number' as const,
        delta: calcDelta(totals.value.clicks, priorTotals.value.clicks),
        icon: ['fas', 'computer-mouse'],
    },
    {
        label: 'Leads',
        value: totals.value.conversions,
        format: 'number' as const,
        delta: calcDelta(totals.value.conversions, priorTotals.value.conversions),
        icon: ['fas', 'user-plus'],
    },
    {
        label: 'Blended CPL',
        value: totals.value.cpl,
        format: 'currency' as const,
        delta: priorTotals.value.cpl > 0
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

// Upcoming campaigns — active campaigns with an end_date within the next 14 days
const upcomingCampaigns = computed(() => {
    const now = new Date();
    const cutoff = new Date();
    cutoff.setDate(now.getDate() + 14);
    return campaignsStore.campaigns
        .filter(c => {
            if (c.project_id !== projectId) return false;
            if (c.status !== 'active') return false;
            if (!c.end_date) return false;
            const end = new Date(c.end_date);
            return end >= now && end <= cutoff;
        })
        .sort((a, b) => new Date(a.end_date!).getTime() - new Date(b.end_date!).getTime())
        .slice(0, 5);
});

function daysUntil(dateStr: string): number {
    const now = new Date();
    now.setHours(0, 0, 0, 0);
    const end = new Date(dateStr);
    end.setHours(0, 0, 0, 0);
    return Math.round((end.getTime() - now.getTime()) / 86_400_000);
}

function urgencyClass(dateStr: string): string {
    const days = daysUntil(dateStr);
    if (days <= 3) return 'text-red-600 bg-red-50';
    if (days <= 7) return 'text-yellow-700 bg-yellow-50';
    return 'text-green-700 bg-green-50';
}

const hasData = computed(() => summary.value && summary.value.channels.length > 0);

// Role-based routing — runs client-side only so SSR serves the Overview to crawlers
onMounted(async () => {
    try {
        const loggedInUser = loggedInUserStore.getLoggedInUser();
        if (!loggedInUser?.id) return;

        // Fetch the current user's project-member record to check marketing_role
        const response = await $fetch<{ success: boolean; data: { role: string; marketing_role: string | null } }>(
            `${config.public.apiBase}/project/${projectId}/members/me`,
            {
                headers: {
                    'Authorization': `Bearer ${getAuthToken()}`,
                    'Authorization-Type': 'auth',
                },
            },
        ).catch(() => null);

        const member = response?.data ?? null;

        if (member?.marketing_role === 'manager') {
            return navigateTo(`/marketing-projects/${projectId}/campaigns`);
        } else if (member?.marketing_role === 'analyst' || !member?.marketing_role) {
            // analyst or no role — route to data sources
            return navigateTo(`/marketing-projects/${projectId}/data-sources`);
        }
        // 'cmo' stays on the Overview page — load marketing hub data
    } catch {
        // Silently fall through to Overview on any error
    }

    // Load last-30-days summary for CMO overview
    const today = new Date();
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(today.getDate() - 30);
    marketingHubStore.setDateRange(thirtyDaysAgo, today);
    await Promise.all([
        marketingHubStore.retrieveHubSummary(projectId),
        campaignsStore.retrieveCampaigns(projectId),
    ]);
});
</script>

<template>
    <div class="p-6 space-y-6">
        <!-- Header -->
        <div class="flex items-center justify-between">
            <div>
                <h1 class="text-xl font-bold text-gray-900">Marketing Overview</h1>
                <p class="text-sm text-gray-500 mt-0.5">Last 30 days · all channels</p>
            </div>
            <NuxtLink
                :to="`/marketing-projects/${projectId}/marketing`"
                class="inline-flex items-center gap-2 text-sm font-medium text-primary-blue-100 hover:underline"
            >
                View Full Report
                <font-awesome-icon :icon="['fas', 'arrow-right']" class="text-xs" />
            </NuxtLink>
        </div>

        <!-- KPI summary cards -->
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

        <!-- Channel Mix mini-chart + Upcoming Campaigns side by side -->
        <div class="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <ChannelMixChart
                :channels="summary?.channels ?? []"
                :is-loading="isLoading"
            />

            <!-- Upcoming campaigns widget -->
            <div class="bg-white rounded-xl border border-gray-200 overflow-hidden">
                <div class="px-5 py-4 border-b border-gray-100 flex items-center gap-2">
                    <font-awesome-icon :icon="['fas', 'calendar-check']" class="text-primary-blue-100" />
                    <h3 class="text-sm font-semibold text-gray-700">Ending Soon</h3>
                    <span class="ml-auto text-xs text-gray-400">Active · next 14 days</span>
                </div>

                <div v-if="isLoading" class="p-5 space-y-3">
                    <div v-for="i in 3" :key="i" class="h-8 rounded bg-gray-100 animate-pulse"></div>
                </div>

                <div v-else-if="upcomingCampaigns.length === 0" class="flex flex-col items-center py-10 text-center px-6">
                    <font-awesome-icon :icon="['fas', 'circle-check']" class="text-2xl text-gray-300 mb-2" />
                    <p class="text-sm text-gray-400">No active campaigns ending in the next 14 days</p>
                </div>

                <ul v-else class="divide-y divide-gray-100">
                    <li
                        v-for="c in upcomingCampaigns"
                        :key="c.id"
                        class="flex items-center gap-3 px-5 py-3 hover:bg-gray-50 transition-colors"
                    >
                        <div class="flex-1 min-w-0">
                            <p class="text-sm font-medium text-gray-800 truncate">{{ c.name }}</p>
                        </div>
                        <span
                            class="text-xs font-semibold px-2 py-0.5 rounded-full flex-shrink-0"
                            :class="urgencyClass(c.end_date!)"
                        >
                            {{ daysUntil(c.end_date!) === 0 ? 'Today' : `${daysUntil(c.end_date!)}d left` }}
                        </span>
                        <NuxtLink
                            :to="`/marketing-projects/${projectId}/campaigns/${c.id}`"
                            class="text-xs text-primary-blue-100 hover:underline flex-shrink-0"
                        >
                            View
                        </NuxtLink>
                    </li>
                </ul>
            </div>
        </div>

        <!-- Empty state CTA when no ad sources are connected -->
        <div
            v-if="!isLoading && !hasData"
            class="rounded-xl border border-dashed border-gray-300 bg-gray-50 flex flex-col items-center justify-center py-12 text-center px-6"
        >
            <font-awesome-icon :icon="['fas', 'plug']" class="text-3xl text-gray-300 mb-3" />
            <p class="text-sm font-medium text-gray-500">No ad data sources connected yet</p>
            <p class="text-xs text-gray-400 mt-1 max-w-xs">
                Connect Google Ads, Meta Ads, or LinkedIn Ads to populate this overview.
            </p>
            <NuxtLink
                :to="`/marketing-projects/${projectId}/data-sources`"
                class="mt-4 inline-flex items-center gap-2 bg-primary-blue-100 text-white text-sm font-medium px-4 py-2 rounded-lg hover:opacity-90 transition-opacity"
            >
                <font-awesome-icon :icon="['fas', 'plus']" />
                Connect a Data Source
            </NuxtLink>
        </div>
    </div>
</template>
