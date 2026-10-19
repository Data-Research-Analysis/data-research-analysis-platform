<script setup lang="ts">
import { usePaidMediaPlansStore } from '@/stores/paid_media_plans';
import { useCampaignsStore } from '@/stores/campaigns';

const props = defineProps<{
    planId: number;
}>();

const store = usePaidMediaPlansStore();
const campaignsStore = useCampaignsStore();

const isOpen = ref(false);
const createCampaigns = ref(false);
const publishing = ref(false);
const published = ref(false);
const errorMessage = ref('');
const createdCampaigns = ref<Array<{ campaignId: number; name: string; platform: string }>>([]);
const createdTargets = ref(0);

function open() {
    isOpen.value = true;
    published.value = false;
    errorMessage.value = '';
    createdCampaigns.value = [];
    createdTargets.value = 0;
}

function close() {
    isOpen.value = false;
}

async function publish() {
    publishing.value = true;
    errorMessage.value = '';
    try {
        const result = await store.publishPlan(props.planId, createCampaigns.value);
        createdCampaigns.value = result?.campaigns ?? [];
        createdTargets.value = result?.targets ?? 0;
        published.value = true;
        await store.fetchPlan(props.planId);
        if (store.currentPlan?.projectId) {
            await campaignsStore.retrieveCampaigns(store.currentPlan.projectId);
        }
    } catch (error: any) {
        errorMessage.value = error?.data?.error || error?.message || 'Failed to publish the plan.';
    } finally {
        publishing.value = false;
    }
}
</script>

<template>
    <div>
        <button
            type="button"
            class="px-4 py-2 rounded-lg bg-green-600 text-white text-sm font-medium hover:bg-green-700 cursor-pointer"
            @click="open"
        >
            <font-awesome-icon :icon="['fas', 'rocket']" class="mr-1" /> Publish
        </button>
        <div v-if="isOpen" class="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" @click.self="close">
            <div class="bg-white rounded-2xl w-full max-w-md p-6">
                <template v-if="!published">
                    <h2 class="text-lg font-semibold text-gray-800 mb-2">Publish this plan</h2>
                    <p class="text-sm text-gray-500 mb-4">Freeze the plan and move to launch. Optionally create draft campaigns for each selected platform.</p>
                    <label class="flex items-center gap-2 text-sm text-gray-700 mb-4">
                        <input v-model="createCampaigns" type="checkbox" class="rounded" />
                        Create campaigns from this plan
                    </label>
                    <p v-if="errorMessage" class="text-sm text-red-600 mb-3">{{ errorMessage }}</p>
                    <div class="flex gap-2">
                        <button type="button" class="px-4 py-2 rounded-lg border border-gray-300 text-gray-700 text-sm cursor-pointer" @click="close">Cancel</button>
                        <button type="button" class="px-4 py-2 rounded-lg bg-green-600 text-white text-sm font-medium cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed" :disabled="publishing" @click="publish">
                            {{ publishing ? 'Publishing...' : 'Publish plan' }}
                        </button>
                    </div>
                </template>

                <template v-else>
                    <div class="flex items-start gap-3">
                        <font-awesome-icon :icon="['fas', 'circle-check']" class="text-2xl text-green-600 mt-0.5" />
                        <div>
                            <h2 class="text-lg font-semibold text-gray-800">Plan published</h2>
                            <p class="text-sm text-gray-500">The plan has been frozen and moved to launch.</p>
                        </div>
                    </div>

                    <div v-if="createdCampaigns.length" class="mt-4 rounded-lg border border-green-200 bg-green-50 p-3 text-sm text-green-800">
                        <p class="font-medium">
                            Created {{ createdCampaigns.length }} campaign{{ createdCampaigns.length === 1 ? '' : 's' }}
                        </p>
                        <ul class="list-disc ml-5 mt-1">
                            <li v-for="campaign in createdCampaigns" :key="campaign.campaignId">
                                {{ campaign.name }} ({{ campaign.platform.replace('_', ' ') }})
                            </li>
                        </ul>
                        <p v-if="createdTargets > 0" class="mt-1 text-xs text-green-700">
                            {{ createdTargets }} campaign target{{ createdTargets === 1 ? '' : 's' }} created.
                        </p>
                    </div>
                    <div v-else-if="createCampaigns" class="mt-4 rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">
                        No campaigns were created. Add at least one platform to the plan before publishing.
                    </div>
                    <div v-else class="mt-4 rounded-lg border border-gray-200 bg-gray-50 p-3 text-sm text-gray-600">
                        No campaigns were created because the option was not selected.
                    </div>

                    <div class="mt-5 flex justify-end">
                        <button type="button" class="px-4 py-2 rounded-lg bg-gray-800 text-white text-sm font-medium cursor-pointer" @click="close">Done</button>
                    </div>
                </template>
            </div>
        </div>
    </div>
</template>
