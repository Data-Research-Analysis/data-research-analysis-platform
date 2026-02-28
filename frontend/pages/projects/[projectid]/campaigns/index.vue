<script setup lang="ts">
import { useCampaignsStore } from '@/stores/campaigns';
import { CAMPAIGN_OBJECTIVES, CAMPAIGN_STATUSES } from '~/types/ICampaign';

definePageMeta({ layout: 'project' });

const route = useRoute();
const campaignStore = useCampaignsStore();

const projectId = computed(() => parseInt(String(route.params.projectid)));

const loading = ref(false);
const showCreateModal = ref(false);
const search = ref('');
const deleteConfirmId = ref<number | null>(null);
const deleting = ref<number | null>(null);

const filteredCampaigns = computed(() => {
    const q = search.value.toLowerCase();
    return campaignStore.campaigns
        .filter((c) => c.project_id === projectId.value)
        .filter((c) => !q || c.name.toLowerCase().includes(q) || c.objective.toLowerCase().includes(q));
});

function getObjectiveLabel(value: string): string {
    return CAMPAIGN_OBJECTIVES.find((o) => o.value === value)?.label ?? value;
}

function getStatusConfig(value: string) {
    return CAMPAIGN_STATUSES.find((s) => s.value === value) ?? { value, label: value, color: 'gray' };
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

function formatCurrency(val: number | null): string {
    if (val === null || val === undefined) return '—';
    return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(Number(val));
}

onMounted(async () => {
    if (projectId.value) {
        loading.value = true;
        try {
            await campaignStore.retrieveCampaigns(projectId.value);
        } finally {
            loading.value = false;
        }
    }
});

async function onCampaignCreated() {
    showCreateModal.value = false;
    loading.value = true;
    try {
        await campaignStore.retrieveCampaigns(projectId.value);
    } finally {
        loading.value = false;
    }
}

async function confirmDelete(campaignId: number) {
    deleteConfirmId.value = null;
    deleting.value = campaignId;
    try {
        await campaignStore.deleteCampaign(campaignId);
    } finally {
        deleting.value = null;
    }
}
</script>

<template>
    <div class="p-6 min-h-screen bg-gray-50" @click="deleteConfirmId = null">
        <!-- Page header -->
        <div class="flex items-center justify-between mb-6">
            <div>
                <h1 class="text-2xl font-bold text-gray-900">Campaigns</h1>
                <p class="text-sm text-gray-500 mt-1">Manage your marketing campaigns and track performance</p>
            </div>
            <button
                type="button"
                class="inline-flex items-center gap-2 px-4 py-2 bg-primary-blue-100 text-white text-sm font-medium rounded-lg hover:bg-primary-blue-200 transition-colors cursor-pointer"
                @click="showCreateModal = true"
            >
                <font-awesome-icon :icon="['fas', 'plus']" />
                New Campaign
            </button>
        </div>

        <!-- Search bar -->
        <div class="mb-6">
            <div class="relative max-w-sm">
                <font-awesome-icon
                    :icon="['fas', 'magnifying-glass']"
                    class="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm"
                />
                <input
                    v-model="search"
                    type="text"
                    placeholder="Search campaigns..."
                    class="w-full pl-9 pr-4 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-blue-100 focus:border-transparent bg-white"
                />
            </div>
        </div>

        <!-- Loading state -->
        <div v-if="loading" class="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
            <div v-for="i in 3" :key="i" class="bg-white rounded-xl border border-gray-200 p-5 animate-pulse">
                <div class="h-5 bg-gray-200 rounded w-3/4 mb-3"></div>
                <div class="h-4 bg-gray-100 rounded w-1/2 mb-2"></div>
                <div class="h-4 bg-gray-100 rounded w-1/3 mb-4"></div>
                <div class="h-2 bg-gray-100 rounded w-full"></div>
            </div>
        </div>

        <!-- Empty state -->
        <div
            v-else-if="filteredCampaigns.length === 0 && !search"
            class="flex flex-col items-center justify-center py-20 text-center"
        >
            <font-awesome-icon :icon="['fas', 'bullhorn']" class="text-5xl text-gray-300 mb-4" />
            <h2 class="text-xl font-semibold text-gray-700 mb-2">No campaigns yet</h2>
            <p class="text-sm text-gray-400 mb-6">Create your first campaign to start tracking your marketing performance.</p>
            <button
                type="button"
                class="inline-flex items-center gap-2 px-5 py-2.5 bg-primary-blue-100 text-white text-sm font-medium rounded-lg hover:bg-primary-blue-200 transition-colors cursor-pointer"
                @click="showCreateModal = true"
            >
                <font-awesome-icon :icon="['fas', 'plus']" />
                Create your first campaign
            </button>
        </div>

        <!-- No search results -->
        <div
            v-else-if="filteredCampaigns.length === 0 && search"
            class="flex flex-col items-center justify-center py-20 text-center"
        >
            <font-awesome-icon :icon="['fas', 'magnifying-glass']" class="text-4xl text-gray-300 mb-4" />
            <p class="text-gray-500">No campaigns match "<strong>{{ search }}</strong>"</p>
        </div>

        <!-- Campaign cards grid -->
        <div v-else class="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
            <NuxtLink
                v-for="campaign in filteredCampaigns"
                :key="campaign.id"
                :to="`/projects/${projectId}/campaigns/${campaign.id}`"
                class="bg-white rounded-xl border border-gray-200 p-5 hover:shadow-md hover:border-primary-blue-100 transition-all cursor-pointer block"
            >
                <!-- Card header -->
                <div class="flex items-start justify-between mb-3">
                    <h3 class="text-base font-semibold text-gray-900 leading-snug line-clamp-2 flex-1 mr-2">
                        {{ campaign.name }}
                    </h3>
                    <div class="flex items-center gap-2 shrink-0">
                        <span
                            class="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium"
                            :class="statusClasses(campaign.status)"
                        >
                            {{ getStatusConfig(campaign.status).label }}
                        </span>
                        <!-- Delete controls -->
                        <template v-if="deleteConfirmId === campaign.id">
                            <button
                                type="button"
                                class="text-xs text-red-600 font-medium hover:text-red-800 transition-colors whitespace-nowrap cursor-pointer"
                                @click.prevent.stop="confirmDelete(campaign.id)"
                            >
                                <font-awesome-icon v-if="deleting === campaign.id" :icon="['fas', 'spinner']" class="animate-spin" />
                                <template v-else>Confirm</template>
                            </button>
                            <button
                                type="button"
                                class="text-xs text-gray-400 hover:text-gray-600 transition-colors cursor-pointer"
                                @click.prevent.stop="deleteConfirmId = null"
                            >
                                Cancel
                            </button>
                        </template>
                        <button
                            v-else
                            type="button"
                            class="text-gray-300 hover:text-red-500 transition-colors cursor-pointer"
                            title="Delete campaign"
                            @click.prevent.stop="deleteConfirmId = campaign.id"
                        >
                            <font-awesome-icon :icon="['fas', 'trash']" class="text-xs" />
                        </button>
                    </div>
                </div>

                <!-- Objective badge -->
                <div class="mb-3">
                    <span class="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-indigo-50 text-indigo-700 text-xs font-medium">
                        <font-awesome-icon :icon="['fas', 'bullseye']" class="text-indigo-400" />
                        {{ getObjectiveLabel(campaign.objective) }}
                    </span>
                </div>

                <!-- Date range -->
                <div class="flex items-center gap-1.5 text-xs text-gray-500 mb-3">
                    <font-awesome-icon :icon="['fas', 'calendar']" class="text-gray-400" />
                    <span>{{ formatDate(campaign.start_date) }}</span>
                    <span>→</span>
                    <span>{{ formatDate(campaign.end_date) }}</span>
                </div>

                <!-- Budget -->
                <div class="flex items-center justify-between mb-3">
                    <div class="text-xs text-gray-500">
                        Budget: <span class="font-medium text-gray-700">{{ formatCurrency(campaign.budget_total) }}</span>
                    </div>
                    <div v-if="campaign.channels?.length" class="text-xs text-gray-400">
                        {{ campaign.channels.length }} channel{{ campaign.channels.length !== 1 ? 's' : '' }}
                    </div>
                </div>

                <!-- Progress bar (placeholder until Issue 06 wires real spend) -->
                <div>
                    <div class="flex items-center justify-between text-xs text-gray-400 mb-1">
                        <span>Spend</span>
                        <span>0%</span>
                    </div>
                    <div class="w-full bg-gray-100 rounded-full h-1.5">
                        <div class="bg-primary-blue-100 h-1.5 rounded-full" style="width: 0%"></div>
                    </div>
                </div>
            </NuxtLink>
        </div>

        <!-- Create campaign modal -->
        <CreateCampaignModal
            v-if="showCreateModal"
            :project-id="projectId"
            @close="showCreateModal = false"
            @created="onCampaignCreated"
        />
    </div>
</template>
