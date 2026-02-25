<script setup lang="ts">
import type { IOfflineDataEntry, IOfflineDataEntryPayload } from '~/types/ICampaign';

interface Props {
    channelId: number;
    channelName: string;
    campaignStartDate: string | null;
    campaignEndDate: string | null;
    editEntry?: IOfflineDataEntry | null;
}

const props = withDefaults(defineProps<Props>(), {
    editEntry: null,
});

const emit = defineEmits<{
    (e: 'saved', entry: IOfflineDataEntry): void;
    (e: 'close'): void;
}>();

const campaignsStore = useCampaignsStore();

const saving = ref(false);
const errorMessage = ref('');

// Form fields (all string-bound for SSR safety)
const form = reactive({
    entry_date: '',
    actual_spend: '',
    impressions_estimated: '',
    leads_generated: '',
    pipeline_value: '',
    notes: '',
});

// Populate form when editing
onMounted(() => {
    if (props.editEntry) {
        form.entry_date = props.editEntry.entry_date.slice(0, 10);
        form.actual_spend = String(props.editEntry.actual_spend);
        form.impressions_estimated = props.editEntry.impressions_estimated !== null ? String(props.editEntry.impressions_estimated) : '';
        form.leads_generated = props.editEntry.leads_generated !== null ? String(props.editEntry.leads_generated) : '';
        form.pipeline_value = props.editEntry.pipeline_value !== null ? String(props.editEntry.pipeline_value) : '';
        form.notes = props.editEntry.notes ?? '';
    }
});

function validate(): string | null {
    if (!form.entry_date) return 'Date is required';
    if (!form.actual_spend || isNaN(Number(form.actual_spend))) return 'Actual spend must be a valid number';
    if (Number(form.actual_spend) < 0) return 'Actual spend must be non-negative';
    if (form.impressions_estimated && (isNaN(Number(form.impressions_estimated)) || Number(form.impressions_estimated) < 0)) {
        return 'Impressions must be a non-negative number';
    }
    if (form.leads_generated && (isNaN(Number(form.leads_generated)) || Number(form.leads_generated) < 0)) {
        return 'Leads generated must be a non-negative number';
    }
    if (form.pipeline_value && isNaN(Number(form.pipeline_value))) {
        return 'Pipeline value must be a valid number';
    }
    if (props.campaignStartDate && form.entry_date < props.campaignStartDate) {
        return `Date must be on or after campaign start (${props.campaignStartDate})`;
    }
    if (props.campaignEndDate && form.entry_date > props.campaignEndDate) {
        return `Date must be on or before campaign end (${props.campaignEndDate})`;
    }
    return null;
}

async function save() {
    errorMessage.value = '';
    const err = validate();
    if (err) {
        errorMessage.value = err;
        return;
    }

    saving.value = true;
    try {
        const payload: IOfflineDataEntryPayload = {
            entry_date: form.entry_date,
            actual_spend: Number(form.actual_spend),
            impressions_estimated: form.impressions_estimated ? Number(form.impressions_estimated) : null,
            leads_generated: form.leads_generated ? Number(form.leads_generated) : null,
            pipeline_value: form.pipeline_value ? Number(form.pipeline_value) : null,
            notes: form.notes || null,
        };

        let saved: IOfflineDataEntry;
        if (props.editEntry) {
            saved = await campaignsStore.updateOfflineEntry(props.editEntry.id, payload);
        } else {
            saved = await campaignsStore.addOfflineEntry(props.channelId, payload);
        }

        emit('saved', saved);
    } catch (e: any) {
        const msg = e?.data?.error ?? e?.message ?? 'Failed to save entry';
        errorMessage.value = msg;
    } finally {
        saving.value = false;
    }
}
</script>

<template>
    <div class="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
        <div class="bg-white rounded-xl shadow-xl w-full max-w-md">
            <!-- Header -->
            <div class="flex items-center justify-between px-5 py-4 border-b border-gray-200">
                <div>
                    <h2 class="text-base font-semibold text-gray-900">
                        {{ editEntry ? 'Edit' : 'Add' }} Offline Entry
                    </h2>
                    <p class="text-xs text-gray-400 mt-0.5 truncate max-w-xs">{{ channelName }}</p>
                </div>
                <button type="button" class="text-gray-400 hover:text-gray-600 transition-colors" @click="emit('close')">
                    <font-awesome-icon :icon="['fas', 'xmark']" class="text-lg" />
                </button>
            </div>

            <!-- Form -->
            <form class="px-5 py-4 space-y-4" @submit.prevent="save">
                <!-- Date -->
                <div>
                    <label class="block text-xs font-medium text-gray-700 mb-1">
                        Date <span class="text-red-500">*</span>
                    </label>
                    <input
                        v-model="form.entry_date"
                        type="date"
                        :min="campaignStartDate ?? undefined"
                        :max="campaignEndDate ?? undefined"
                        class="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-blue-100 focus:border-transparent"
                        required
                    />
                </div>

                <!-- Actual Spend -->
                <div>
                    <label class="block text-xs font-medium text-gray-700 mb-1">
                        Actual Spend <span class="text-red-500">*</span>
                    </label>
                    <input
                        v-model="form.actual_spend"
                        type="number"
                        min="0"
                        step="0.01"
                        placeholder="0.00"
                        class="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-blue-100 focus:border-transparent"
                        required
                    />
                </div>

                <!-- Two columns: Impressions + Leads -->
                <div class="grid grid-cols-2 gap-3">
                    <div>
                        <label class="block text-xs font-medium text-gray-700 mb-1">Est. Impressions</label>
                        <input
                            v-model="form.impressions_estimated"
                            type="number"
                            min="0"
                            step="1"
                            placeholder="0"
                            class="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-blue-100 focus:border-transparent"
                        />
                    </div>
                    <div>
                        <label class="block text-xs font-medium text-gray-700 mb-1">Leads Generated</label>
                        <input
                            v-model="form.leads_generated"
                            type="number"
                            min="0"
                            step="1"
                            placeholder="0"
                            class="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-blue-100 focus:border-transparent"
                        />
                    </div>
                </div>

                <!-- Pipeline Value -->
                <div>
                    <label class="block text-xs font-medium text-gray-700 mb-1">Pipeline Value (optional)</label>
                    <input
                        v-model="form.pipeline_value"
                        type="number"
                        min="0"
                        step="0.01"
                        placeholder="0.00"
                        class="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-blue-100 focus:border-transparent"
                    />
                </div>

                <!-- Notes -->
                <div>
                    <label class="block text-xs font-medium text-gray-700 mb-1">Notes (optional)</label>
                    <textarea
                        v-model="form.notes"
                        rows="2"
                        placeholder="Any additional context..."
                        class="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-blue-100 focus:border-transparent resize-none"
                    ></textarea>
                </div>

                <!-- Error message -->
                <p v-if="errorMessage" class="text-xs text-red-600 flex items-center gap-1.5">
                    <font-awesome-icon :icon="['fas', 'triangle-exclamation']" />
                    {{ errorMessage }}
                </p>

                <!-- Actions -->
                <div class="flex justify-end gap-2 pt-1">
                    <button
                        type="button"
                        class="px-4 py-2 text-sm text-gray-600 hover:text-gray-900 transition-colors cursor-pointer"
                        @click="emit('close')"
                    >
                        Cancel
                    </button>
                    <button
                        type="submit"
                        :disabled="saving"
                        class="inline-flex items-center gap-2 px-4 py-2 bg-primary-blue-100 text-white text-sm font-medium rounded-lg hover:bg-primary-blue-200 disabled:opacity-50 disabled:cursor-not-allowed transition-colors cursor-pointer"
                    >
                        <font-awesome-icon v-if="saving" :icon="['fas', 'spinner']" class="animate-spin" />
                        {{ saving ? 'Saving...' : (editEntry ? 'Save Changes' : 'Add Entry') }}
                    </button>
                </div>
            </form>
        </div>
    </div>
</template>
