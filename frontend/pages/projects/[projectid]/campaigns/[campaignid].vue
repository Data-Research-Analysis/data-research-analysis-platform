<script setup lang="ts">
/**
 * Campaign Detail Page — manages a single campaign record created in the app
 * (including campaigns created from a paid media plan).
 *
 * Route: /projects/:projectid/campaigns/:campaignid
 */
import { useCampaignsStore } from '@/stores/campaigns';
import { CAMPAIGN_OBJECTIVES, CAMPAIGN_STATUSES, type ICampaign } from '~/types/ICampaign';
import { useProjectRole } from '@/composables/useProjectRole';

definePageMeta({ layout: 'project' });

const route = useRoute();
const router = useRouter();
const campaignStore = useCampaignsStore();
const { isAnalyst } = useProjectRole();

const projectId = computed(() => parseInt(String(route.params.projectid)));
const campaignId = computed(() => parseInt(String(route.params.campaignid)));

const campaign = ref<ICampaign | null>(null);
const loading = ref(true);
const notFound = ref(false);
const deleteConfirm = ref(false);
const deleting = ref(false);

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

function humanizeChannel(value: string | null | undefined): string {
    if (!value) return '—';
    return value.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
}

async function changeStatus(event: Event) {
    const status = (event.target as HTMLSelectElement).value;
    if (!campaign.value) return;
    const previous = campaign.value.status;
    campaign.value.status = status;
    try {
        await campaignStore.updateCampaignStatus(campaign.value.id, status);
    } catch {
        campaign.value.status = previous;
    }
}

async function deleteCampaign() {
    if (!campaign.value) return;
    deleting.value = true;
    try {
        await campaignStore.deleteCampaign(campaign.value.id);
        router.push(`/projects/${projectId.value}/campaigns`);
    } finally {
        deleting.value = false;
    }
}

onMounted(async () => {
    loading.value = true;
    try {
        const data = await campaignStore.retrieveCampaignById(campaignId.value);
        if (data) {
            campaign.value = data;
        } else {
            notFound.value = true;
        }
    } catch {
        notFound.value = true;
    } finally {
        loading.value = false;
    }
});
</script>

<template>
    <div class="p-6 min-h-screen bg-gray-50">
        <button
            type="button"
            class="inline-flex items-center gap-2 text-sm text-gray-500 hover:text-gray-700 mb-4 cursor-pointer"
            @click="router.push(`/projects/${projectId}/campaigns`)"
        >
            <font-awesome-icon :icon="['fas', 'arrow-left']" class="text-xs" />
            Back to Campaigns
        </button>

        <div v-if="loading" class="animate-pulse space-y-4">
            <div class="h-8 w-1/3 rounded bg-gray-200"></div>
            <div class="h-48 rounded-2xl bg-gray-200"></div>
        </div>

        <div v-else-if="notFound || !campaign" class="flex flex-col items-center justify-center py-20 text-center">
            <font-awesome-icon :icon="['fas', 'bullhorn']" class="text-5xl text-gray-300 mb-4" />
            <h2 class="text-xl font-semibold text-gray-700 mb-2">Campaign not found</h2>
            <p class="text-sm text-gray-400">The campaign no longer exists or you do not have access to it.</p>
        </div>

        <div v-else>
            <div class="flex flex-wrap items-start justify-between gap-4 mb-6">
                <div>
                    <div class="flex items-center gap-3 flex-wrap">
                        <h1 class="text-2xl font-bold text-gray-900">{{ campaign.name }}</h1>
                        <span class="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium" :class="statusClasses(campaign.status)">
                            {{ getStatusConfig(campaign.status).label }}
                        </span>
                    </div>
                    <div class="flex items-center gap-2 mt-2">
                        <span class="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-indigo-50 text-indigo-700 text-xs font-medium">
                            <font-awesome-icon :icon="['fas', 'bullseye']" class="text-indigo-400" />
                            {{ getObjectiveLabel(campaign.objective) }}
                        </span>
                    </div>
                </div>
                <div class="flex items-center gap-2">
                    <label class="text-xs text-gray-500 font-medium mr-1">Status</label>
                    <select
                        class="px-3 py-1.5 rounded-lg border border-gray-300 bg-white text-sm cursor-pointer"
                        :value="campaign.status"
                        @change="changeStatus"
                    >
                        <option v-for="s in CAMPAIGN_STATUSES" :key="s.value" :value="s.value">{{ s.label }}</option>
                    </select>
                    <button
                        v-if="isAnalyst"
                        type="button"
                        class="px-3 py-1.5 rounded-lg border border-red-200 text-red-600 text-sm hover:bg-red-50 cursor-pointer"
                        @click="deleteConfirm = true"
                    >
                        <font-awesome-icon :icon="['fas', 'trash']" class="mr-1" />
                        Delete
                    </button>
                </div>
            </div>

            <div class="grid grid-cols-1 lg:grid-cols-3 gap-6">
                <div class="bg-white rounded-xl border border-gray-200 p-5">
                    <h2 class="text-sm font-semibold text-gray-800 mb-4">Campaign details</h2>
                    <dl class="space-y-3 text-sm">
                        <div class="flex justify-between">
                            <dt class="text-gray-500">Start date</dt>
                            <dd class="text-gray-800 font-medium">{{ formatDate(campaign.start_date) }}</dd>
                        </div>
                        <div class="flex justify-between">
                            <dt class="text-gray-500">End date</dt>
                            <dd class="text-gray-800 font-medium">{{ formatDate(campaign.end_date) }}</dd>
                        </div>
                        <div class="flex justify-between">
                            <dt class="text-gray-500">Budget</dt>
                            <dd class="text-gray-800 font-medium">{{ formatCurrency(campaign.budget_total) }}</dd>
                        </div>
                        <div class="flex justify-between">
                            <dt class="text-gray-500">Created</dt>
                            <dd class="text-gray-800 font-medium">{{ formatDate(campaign.created_at) }}</dd>
                        </div>
                    </dl>
                    <div v-if="campaign.description" class="mt-4 pt-4 border-t border-gray-100">
                        <p class="text-xs text-gray-500 font-medium mb-1">Description</p>
                        <p class="text-sm text-gray-700">{{ campaign.description }}</p>
                    </div>
                </div>

                <div class="bg-white rounded-xl border border-gray-200 p-5 lg:col-span-2">
                    <h2 class="text-sm font-semibold text-gray-800 mb-4">Channels</h2>
                    <div v-if="campaign.channels?.length" class="space-y-3">
                        <div
                            v-for="channel in campaign.channels"
                            :key="channel.id"
                            class="flex items-center justify-between rounded-lg border border-gray-100 bg-gray-50 px-4 py-3"
                        >
                            <div>
                                <p class="text-sm font-medium text-gray-800">{{ humanizeChannel(channel.channel_type) }}</p>
                                <p v-if="channel.channel_name || channel.platform_campaign_name" class="text-xs text-gray-500 mt-0.5">
                                    {{ channel.channel_name || channel.platform_campaign_name }}
                                </p>
                            </div>
                            <span
                                class="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium"
                                :class="channel.is_offline ? 'bg-amber-100 text-amber-700' : 'bg-green-100 text-green-700'"
                            >
                                {{ channel.is_offline ? 'Offline' : 'Digital' }}
                            </span>
                        </div>
                    </div>
                    <div v-else class="rounded-lg border border-dashed border-gray-200 py-8 text-center">
                        <p class="text-sm text-gray-400">No channels have been added to this campaign.</p>
                    </div>
                </div>
            </div>
        </div>

        <div v-if="deleteConfirm" class="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" @click.self="deleteConfirm = false">
            <div class="bg-white rounded-2xl w-full max-w-sm p-6">
                <h2 class="text-lg font-semibold text-gray-800 mb-2">Delete campaign?</h2>
                <p class="text-sm text-gray-500 mb-4">This action cannot be undone.</p>
                <div class="flex gap-2 justify-end">
                    <button type="button" class="px-4 py-2 rounded-lg border border-gray-300 text-gray-700 text-sm cursor-pointer" @click="deleteConfirm = false">Cancel</button>
                    <button type="button" class="px-4 py-2 rounded-lg bg-red-600 text-white text-sm font-medium cursor-pointer disabled:opacity-50" :disabled="deleting" @click="deleteCampaign">
                        {{ deleting ? 'Deleting...' : 'Delete' }}
                    </button>
                </div>
            </div>
        </div>
    </div>
</template>
