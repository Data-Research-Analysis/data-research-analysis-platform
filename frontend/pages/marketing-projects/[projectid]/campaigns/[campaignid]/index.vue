<script setup lang="ts">
import { useCampaignsStore } from '@/stores/campaigns';
import { CAMPAIGN_OBJECTIVES, CAMPAIGN_STATUSES } from '~/types/ICampaign';
import type { ICampaign } from '~/types/ICampaign';

definePageMeta({ layout: 'marketing-project' });

const route = useRoute();
const router = useRouter();
const campaignStore = useCampaignsStore();

const projectId = computed(() => parseInt(String(route.params.projectid)));
const campaignId = computed(() => parseInt(String(route.params.campaignid)));

type TabId = 'summary' | 'digital' | 'offline' | 'attribution' | 'ai_analysis';

const tabs: { id: TabId; label: string; icon: string[] }[] = [
    { id: 'summary', label: 'Summary', icon: ['fas', 'chart-pie'] },
    { id: 'digital', label: 'Digital', icon: ['fas', 'globe'] },
    { id: 'offline', label: 'Offline', icon: ['fas', 'store'] },
    { id: 'attribution', label: 'Attribution', icon: ['fas', 'diagram-project'] },
    { id: 'ai_analysis', label: 'AI Analysis', icon: ['fas', 'robot'] },
];

const activeTab = ref<TabId>('summary');
const loading = ref(false);
const statusUpdating = ref(false);
const statusDropdownOpen = ref(false);
const campaign = ref<ICampaign | null>(null);

function getObjectiveLabel(value: string): string {
    return CAMPAIGN_OBJECTIVES.find((o) => o.value === value)?.label ?? value;
}

function statusClasses(status: string): string {
    const map: Record<string, string> = {
        draft: 'bg-gray-100 text-gray-700',
        active: 'bg-green-100 text-green-700',
        paused: 'bg-yellow-100 text-yellow-700',
        completed: 'bg-blue-100 text-blue-700',
        archived: 'bg-red-100 text-red-700',
    };
    return map[status] ?? 'bg-gray-100 text-gray-700';
}

function formatDate(dateStr: string | null): string {
    if (!dateStr) return '—';
    return new Date(dateStr).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
}

function formatCurrency(val: number | null | undefined): string {
    if (val === null || val === undefined) return '—';
    return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(Number(val));
}

onMounted(async () => {
    loading.value = true;
    try {
        const c = await campaignStore.retrieveCampaignById(campaignId.value);
        campaign.value = c;
    } finally {
        loading.value = false;
    }
});

watch(campaignStore.campaigns, () => {
    const c = campaignStore.campaigns.find((x) => x.id === campaignId.value) ?? null;
    if (c) campaign.value = c;
});

async function setStatus(status: string) {
    statusDropdownOpen.value = false;
    if (!campaign.value || campaign.value.status === status) return;
    statusUpdating.value = true;
    try {
        await campaignStore.updateCampaignStatus(campaignId.value, status);
        if (campaign.value) campaign.value.status = status;
    } finally {
        statusUpdating.value = false;
    }
}
</script>

<template>
    <div class="min-h-screen bg-gray-50">
        <!-- Loading state -->
        <div v-if="loading" class="p-6">
            <div class="animate-pulse space-y-4">
                <div class="h-8 bg-gray-200 rounded w-1/3"></div>
                <div class="h-4 bg-gray-100 rounded w-1/4"></div>
                <div class="h-10 bg-gray-200 rounded w-full mt-4"></div>
            </div>
        </div>

        <!-- Campaign not found -->
        <div v-else-if="!campaign" class="flex flex-col items-center justify-center py-24 text-center">
            <font-awesome-icon :icon="['fas', 'triangle-exclamation']" class="text-4xl text-yellow-400 mb-3" />
            <h2 class="text-lg font-semibold text-gray-700 mb-2">Campaign not found</h2>
            <NuxtLink :to="`/marketing-projects/${projectId}/campaigns`" class="text-sm text-primary-blue-100 hover:underline">
                Back to Campaigns
            </NuxtLink>
        </div>

        <template v-else>
            <!-- Campaign header -->
            <div class="bg-white border-b border-gray-200 px-6 py-5">
                <div class="flex items-start justify-between gap-4">
                    <div class="flex-1 min-w-0">
                        <!-- Breadcrumb -->
                        <div class="flex items-center gap-1.5 text-xs text-gray-400 mb-1">
                            <NuxtLink :to="`/marketing-projects/${projectId}/campaigns`" class="hover:text-primary-blue-100">
                                Campaigns
                            </NuxtLink>
                            <font-awesome-icon :icon="['fas', 'chevron-right']" class="text-xs" />
                            <span class="text-gray-600 truncate">{{ campaign.name }}</span>
                        </div>
                        <h1 class="text-xl font-bold text-gray-900 truncate">{{ campaign.name }}</h1>
                        <p v-if="campaign.description" class="text-sm text-gray-500 mt-0.5">{{ campaign.description }}</p>
                    </div>
                    <!-- Status toggle dropdown -->
                    <div class="relative">
                        <button
                            type="button"
                            class="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm font-medium border transition-colors"
                            :class="statusClasses(campaign.status)"
                            @click="statusDropdownOpen = !statusDropdownOpen"
                        >
                            <font-awesome-icon v-if="statusUpdating" :icon="['fas', 'spinner']" class="animate-spin" />
                            {{ CAMPAIGN_STATUSES.find((s) => s.value === campaign!.status)?.label ?? campaign.status }}
                            <font-awesome-icon :icon="['fas', 'chevron-down']" class="text-xs" />
                        </button>
                        <div
                            v-if="statusDropdownOpen"
                            class="absolute right-0 mt-1 w-40 bg-white rounded-lg shadow-lg border border-gray-200 z-10 py-1"
                        >
                            <button
                                v-for="s in CAMPAIGN_STATUSES"
                                :key="s.value"
                                type="button"
                                class="w-full text-left px-4 py-2 text-sm hover:bg-gray-50 transition-colors"
                                :class="campaign.status === s.value ? 'font-medium text-primary-blue-100' : 'text-gray-700'"
                                @click="setStatus(s.value)"
                            >
                                {{ s.label }}
                            </button>
                        </div>
                    </div>
                </div>
            </div>

            <!-- Sub-tab navigation -->
            <div class="bg-white border-b border-gray-200 px-6">
                <nav class="flex gap-1" aria-label="Campaign tabs">
                    <button
                        v-for="tab in tabs"
                        :key="tab.id"
                        type="button"
                        class="flex items-center gap-2 px-4 py-3 text-sm font-medium border-b-2 transition-colors"
                        :class="
                            activeTab === tab.id
                                ? 'border-primary-blue-100 text-primary-blue-100'
                                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                        "
                        @click="activeTab = tab.id"
                    >
                        <font-awesome-icon :icon="tab.icon" class="text-xs" />
                        {{ tab.label }}
                    </button>
                </nav>
            </div>

            <!-- Tab content -->
            <div class="p-6">

                <!-- ======================== SUMMARY TAB ===================== -->
                <div v-if="activeTab === 'summary'" class="space-y-6">
                    <!-- Metadata cards -->
                    <div class="grid grid-cols-2 md:grid-cols-4 gap-4">
                        <!-- Budget -->
                        <div class="bg-white rounded-xl border border-gray-200 p-4">
                            <p class="text-xs text-gray-400 uppercase tracking-wide mb-1">Total Budget</p>
                            <p class="text-xl font-bold text-gray-900">{{ formatCurrency(campaign.budget_total) }}</p>
                        </div>
                        <!-- Dates -->
                        <div class="bg-white rounded-xl border border-gray-200 p-4">
                            <p class="text-xs text-gray-400 uppercase tracking-wide mb-1">Start Date</p>
                            <p class="text-base font-semibold text-gray-900">{{ formatDate(campaign.start_date) }}</p>
                        </div>
                        <div class="bg-white rounded-xl border border-gray-200 p-4">
                            <p class="text-xs text-gray-400 uppercase tracking-wide mb-1">End Date</p>
                            <p class="text-base font-semibold text-gray-900">{{ formatDate(campaign.end_date) }}</p>
                        </div>
                        <!-- Objective -->
                        <div class="bg-white rounded-xl border border-gray-200 p-4">
                            <p class="text-xs text-gray-400 uppercase tracking-wide mb-1">Objective</p>
                            <p class="text-base font-semibold text-gray-900">{{ getObjectiveLabel(campaign.objective) }}</p>
                        </div>
                    </div>

                    <!-- Targets row -->
                    <div class="grid grid-cols-2 md:grid-cols-3 gap-4">
                        <div class="bg-white rounded-xl border border-gray-200 p-4">
                            <p class="text-xs text-gray-400 uppercase tracking-wide mb-1">Target Leads</p>
                            <p class="text-lg font-bold text-gray-900">{{ campaign.target_leads ?? '—' }}</p>
                        </div>
                        <div class="bg-white rounded-xl border border-gray-200 p-4">
                            <p class="text-xs text-gray-400 uppercase tracking-wide mb-1">Target CPL</p>
                            <p class="text-lg font-bold text-gray-900">{{ formatCurrency(campaign.target_cpl) }}</p>
                        </div>
                        <div class="bg-white rounded-xl border border-gray-200 p-4">
                            <p class="text-xs text-gray-400 uppercase tracking-wide mb-1">Target ROAS</p>
                            <p class="text-lg font-bold text-gray-900">
                                {{ campaign.target_roas !== null && campaign.target_roas !== undefined ? `${campaign.target_roas}x` : '—' }}
                            </p>
                        </div>
                    </div>

                    <!-- KPI placeholder cards -->
                    <div>
                        <h2 class="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-3">Performance KPIs</h2>
                        <div class="grid grid-cols-2 md:grid-cols-4 gap-4">
                            <div class="bg-white rounded-xl border border-dashed border-gray-200 p-4 text-center">
                                <p class="text-xs text-gray-400 uppercase tracking-wide mb-1">Spend</p>
                                <p class="text-xl font-bold text-gray-300">—</p>
                                <p class="text-xs text-gray-300 mt-1">Available in Issue 06</p>
                            </div>
                            <div class="bg-white rounded-xl border border-dashed border-gray-200 p-4 text-center">
                                <p class="text-xs text-gray-400 uppercase tracking-wide mb-1">Leads</p>
                                <p class="text-xl font-bold text-gray-300">—</p>
                                <p class="text-xs text-gray-300 mt-1">Available in Issue 06</p>
                            </div>
                            <div class="bg-white rounded-xl border border-dashed border-gray-200 p-4 text-center">
                                <p class="text-xs text-gray-400 uppercase tracking-wide mb-1">CPL</p>
                                <p class="text-xl font-bold text-gray-300">—</p>
                                <p class="text-xs text-gray-300 mt-1">Available in Issue 06</p>
                            </div>
                            <div class="bg-white rounded-xl border border-dashed border-gray-200 p-4 text-center">
                                <p class="text-xs text-gray-400 uppercase tracking-wide mb-1">ROAS</p>
                                <p class="text-xl font-bold text-gray-300">—</p>
                                <p class="text-xs text-gray-300 mt-1">Available in Issue 06</p>
                            </div>
                        </div>
                    </div>
                </div>

                <!-- ======================== DIGITAL TAB ==================== -->
                <div v-else-if="activeTab === 'digital'" class="flex flex-col items-center justify-center py-20 text-center">
                    <font-awesome-icon :icon="['fas', 'globe']" class="text-5xl text-gray-300 mb-4" />
                    <h2 class="text-xl font-semibold text-gray-700 mb-2">Digital Channels</h2>
                    <p class="text-sm text-gray-400 max-w-sm">Connect digital data sources. Coming in a future update.</p>
                </div>

                <!-- ======================== OFFLINE TAB ==================== -->
                <div v-else-if="activeTab === 'offline'" class="flex flex-col items-center justify-center py-20 text-center">
                    <font-awesome-icon :icon="['fas', 'store']" class="text-5xl text-gray-300 mb-4" />
                    <h2 class="text-xl font-semibold text-gray-700 mb-2">Offline Channels</h2>
                    <p class="text-sm text-gray-400 max-w-sm">Track offline channels. Coming in a future update. (Issue 03)</p>
                </div>

                <!-- ======================== ATTRIBUTION TAB ================ -->
                <div v-else-if="activeTab === 'attribution'" class="flex flex-col items-center justify-center py-20 text-center">
                    <font-awesome-icon :icon="['fas', 'diagram-project']" class="text-5xl text-gray-300 mb-4" />
                    <h2 class="text-xl font-semibold text-gray-700 mb-2">Attribution</h2>
                    <p class="text-sm text-gray-400 max-w-sm">Attribution analysis. Coming in a future update. (Issue 05)</p>
                </div>

                <!-- ======================== AI ANALYSIS TAB ================ -->
                <div v-else-if="activeTab === 'ai_analysis'" class="flex flex-col items-center justify-center py-20 text-center">
                    <font-awesome-icon :icon="['fas', 'robot']" class="text-5xl text-gray-300 mb-4" />
                    <h2 class="text-xl font-semibold text-gray-700 mb-2">AI Analysis</h2>
                    <p class="text-sm text-gray-400 max-w-sm">AI-powered insights. Coming in a future update. (Issue 12)</p>
                </div>

            </div>
        </template>

        <!-- Close dropdown on outside click -->
        <div
            v-if="statusDropdownOpen"
            class="fixed inset-0 z-0"
            @click="statusDropdownOpen = false"
        ></div>
    </div>
</template>
