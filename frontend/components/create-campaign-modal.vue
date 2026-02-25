<script setup lang="ts">
import { useCampaignsStore } from '@/stores/campaigns';
import { CAMPAIGN_OBJECTIVES } from '~/types/ICampaign';

const props = defineProps<{
    projectId: number;
}>();

const emit = defineEmits<{
    (e: 'close'): void;
    (e: 'created'): void;
}>();

const campaignStore = useCampaignsStore();

const saving = ref(false);
const errorMsg = ref('');

const form = reactive({
    name: '',
    description: '',
    objective: '',
    status: 'draft',
    budget_total: '' as string | number,
    target_leads: '' as string | number,
    target_cpl: '' as string | number,
    target_roas: '' as string | number,
    start_date: '',
    end_date: '',
});

async function submit() {
    errorMsg.value = '';
    if (!form.name.trim()) {
        errorMsg.value = 'Campaign name is required.';
        return;
    }
    if (!form.objective) {
        errorMsg.value = 'Please select a campaign objective.';
        return;
    }
    saving.value = true;
    try {
        await campaignStore.createCampaign({
            project_id: props.projectId,
            name: form.name.trim(),
            description: form.description || null,
            objective: form.objective,
            status: form.status,
            budget_total: form.budget_total !== '' ? Number(form.budget_total) : null,
            target_leads: form.target_leads !== '' ? Number(form.target_leads) : null,
            target_cpl: form.target_cpl !== '' ? Number(form.target_cpl) : null,
            target_roas: form.target_roas !== '' ? Number(form.target_roas) : null,
            start_date: form.start_date || null,
            end_date: form.end_date || null,
        });
        emit('created');
    } catch (err: any) {
        errorMsg.value = err?.data?.error ?? err?.message ?? 'Failed to create campaign.';
    } finally {
        saving.value = false;
    }
}
</script>

<template>
    <!-- Backdrop -->
    <div class="fixed inset-0 bg-black opacity-50 z-40" @click="emit('close')"></div>

    <!-- Dialog -->
    <div class="fixed inset-0 z-50 flex items-center justify-center p-4">
        <div class="bg-white rounded-xl shadow-xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
            <!-- Header -->
            <div class="flex items-center justify-between px-6 py-4 border-b border-gray-200">
                <h2 class="text-lg font-semibold text-gray-900">New Campaign</h2>
                <button
                    type="button"
                    class="text-gray-400 hover:text-gray-600 transition-colors cursor-pointer"
                    @click="emit('close')"
                >
                    <font-awesome-icon :icon="['fas', 'xmark']" class="text-xl" />
                </button>
            </div>

            <!-- Form body -->
            <form class="px-6 py-5 space-y-4" @submit.prevent="submit">
                <!-- Error message -->
                <div v-if="errorMsg" class="flex items-center gap-2 bg-red-50 border border-red-200 rounded-lg p-3 text-sm text-red-700">
                    <font-awesome-icon :icon="['fas', 'triangle-exclamation']" />
                    {{ errorMsg }}
                </div>

                <!-- Campaign Name -->
                <div>
                    <label class="block text-sm font-medium text-gray-700 mb-1">
                        Campaign Name <span class="text-red-500">*</span>
                    </label>
                    <input
                        v-model="form.name"
                        type="text"
                        placeholder="e.g. Q1 2026 Lead Generation"
                        class="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-blue-100 focus:border-transparent"
                    />
                </div>

                <!-- Description -->
                <div>
                    <label class="block text-sm font-medium text-gray-700 mb-1">Description</label>
                    <textarea
                        v-model="form.description"
                        rows="2"
                        placeholder="Optional campaign description"
                        class="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-blue-100 focus:border-transparent resize-none"
                    ></textarea>
                </div>

                <!-- Objective -->
                <div>
                    <label class="block text-sm font-medium text-gray-700 mb-1">
                        Objective <span class="text-red-500">*</span>
                    </label>
                    <select
                        v-model="form.objective"
                        class="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-blue-100 focus:border-transparent bg-white"
                    >
                        <option value="" disabled>Select an objective</option>
                        <option v-for="obj in CAMPAIGN_OBJECTIVES" :key="obj.value" :value="obj.value">
                            {{ obj.label }}
                        </option>
                    </select>
                </div>

                <!-- Budget Total -->
                <div>
                    <label class="block text-sm font-medium text-gray-700 mb-1">Budget Total (USD)</label>
                    <input
                        v-model="form.budget_total"
                        type="number"
                        min="0"
                        step="0.01"
                        placeholder="e.g. 50000"
                        class="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-blue-100 focus:border-transparent"
                    />
                </div>

                <!-- Target Leads & CPL row -->
                <div class="grid grid-cols-2 gap-3">
                    <div>
                        <label class="block text-sm font-medium text-gray-700 mb-1">Target Leads</label>
                        <input
                            v-model="form.target_leads"
                            type="number"
                            min="0"
                            placeholder="e.g. 500"
                            class="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-blue-100 focus:border-transparent"
                        />
                    </div>
                    <div>
                        <label class="block text-sm font-medium text-gray-700 mb-1">Target Cost Per Lead (CPL) (USD)</label>
                        <input
                            v-model="form.target_cpl"
                            type="number"
                            min="0"
                            step="0.01"
                            placeholder="e.g. 25"
                            class="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-blue-100 focus:border-transparent"
                        />
                    </div>
                </div>

                <!-- Target ROAS -->
                <div>
                    <label class="block text-sm font-medium text-gray-700 mb-1">Target Return on Ad Spend (ROAS)</label>
                    <input
                        v-model="form.target_roas"
                        type="number"
                        min="0"
                        step="0.01"
                        placeholder="e.g. 3.5"
                        class="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-blue-100 focus:border-transparent"
                    />
                </div>

                <!-- Date range row -->
                <div class="grid grid-cols-2 gap-3">
                    <div>
                        <label class="block text-sm font-medium text-gray-700 mb-1">Start Date</label>
                        <input
                            v-model="form.start_date"
                            type="date"
                            class="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-blue-100 focus:border-transparent bg-white"
                        />
                    </div>
                    <div>
                        <label class="block text-sm font-medium text-gray-700 mb-1">End Date</label>
                        <input
                            v-model="form.end_date"
                            type="date"
                            class="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-blue-100 focus:border-transparent bg-white"
                        />
                    </div>
                </div>

                <!-- Footer actions -->
                <div class="flex justify-end gap-3 pt-2 border-t border-gray-100">
                    <button
                        type="button"
                        class="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors cursor-pointer"
                        @click="emit('close')"
                    >
                        Cancel
                    </button>
                    <button
                        type="submit"
                        :disabled="saving"
                        class="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-primary-blue-100 rounded-lg hover:bg-primary-blue-200 transition-colors disabled:opacity-60 disabled:cursor-not-allowed cursor-pointer"
                    >
                        <font-awesome-icon v-if="saving" :icon="['fas', 'spinner']" class="animate-spin" />
                        {{ saving ? 'Creating…' : 'Create Campaign' }}
                    </button>
                </div>
            </form>
        </div>
    </div>
</template>
