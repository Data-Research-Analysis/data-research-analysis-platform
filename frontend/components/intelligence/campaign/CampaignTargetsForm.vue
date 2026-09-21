<script setup lang="ts">
/**
 * CampaignTargetsForm — Modal form for a CMO/manager to define (or edit) the
 * north-star metrics and targets for one campaign or ad set / ad group.
 *
 * Owns only local form state; persistence is delegated to the parent via the
 * `submit` event.
 */
import type {
    ICampaignTarget,
    ICampaignTargetEntity,
    ICampaignTargetScope,
} from '@/composables/useCampaignAnalysis';

interface Props {
    modelValue: boolean;
    entity: ICampaignTargetEntity;
    scope: ICampaignTargetScope;
    target?: ICampaignTarget | null;
    isSaving?: boolean;
    error?: string | null;
}

const props = withDefaults(defineProps<Props>(), {
    target: null,
    isSaving: false,
    error: null,
});

const emit = defineEmits<{
    (e: 'update:modelValue', value: boolean): void;
    (e: 'submit', payload: Record<string, any>): void;
    (e: 'delete', id: number): void;
}>();

interface IFormState {
    buyingModel: string;
    audienceSize: number | null;
    targetCtr: number | null;
    targetClicks: number | null;
    targetImpressions: number | null;
    targetRoas: number | null;
    targetLeads: number | null;
    targetConversions: number | null;
    targetRevenue: number | null;
    targetCpc: number | null;
    targetCpm: number | null;
    targetCpa: number | null;
    targetCpl: number | null;
    targetFrequency: number | null;
    initialInvestment: number | null;
    dailyBudget: number | null;
    lifetimeBudget: number | null;
    currency: string;
    flightStartDate: string;
    flightEndDate: string;
    notes: string;
}

function emptyForm(): IFormState {
    return {
        buyingModel: '',
        audienceSize: null,
        targetCtr: null,
        targetClicks: null,
        targetImpressions: null,
        targetRoas: null,
        targetLeads: null,
        targetConversions: null,
        targetRevenue: null,
        targetCpc: null,
        targetCpm: null,
        targetCpa: null,
        targetCpl: null,
        targetFrequency: null,
        initialInvestment: null,
        dailyBudget: null,
        lifetimeBudget: null,
        currency: '',
        flightStartDate: '',
        flightEndDate: '',
        notes: '',
    };
}

function fromTarget(target: ICampaignTarget | null | undefined): IFormState {
    if (!target) return emptyForm();
    return {
        buyingModel: target.buyingModel ?? '',
        audienceSize: target.audienceSize,
        targetCtr: target.targetCtr,
        targetClicks: target.targetClicks,
        targetImpressions: target.targetImpressions,
        targetRoas: target.targetRoas,
        targetLeads: target.targetLeads,
        targetConversions: target.targetConversions,
        targetRevenue: target.targetRevenue,
        targetCpc: target.targetCpc,
        targetCpm: target.targetCpm,
        targetCpa: target.targetCpa,
        targetCpl: target.targetCpl,
        targetFrequency: target.targetFrequency,
        initialInvestment: target.initialInvestment,
        dailyBudget: target.dailyBudget,
        lifetimeBudget: target.lifetimeBudget,
        currency: target.currency ?? '',
        flightStartDate: target.flightStartDate ?? '',
        flightEndDate: target.flightEndDate ?? '',
        notes: target.notes ?? '',
    };
}

const form = reactive<IFormState>(emptyForm());

watch(
    () => [props.modelValue, props.target?.id] as const,
    ([open]) => {
        if (open) Object.assign(form, fromTarget(props.target));
    },
    { immediate: true },
);

function close() {
    emit('update:modelValue', false);
}

function handleSubmit() {
    const payload: Record<string, any> = {
        projectId: props.scope.projectId,
        dataSourceId: props.scope.dataSourceId,
        channel: props.scope.channel,
        entityLevel: props.entity.level,
        campaignId: props.entity.campaignId,
        entityId: props.entity.id,
        entityName: props.entity.name,
        buyingModel: form.buyingModel || null,
        audienceSize: form.audienceSize,
        targetCtr: form.targetCtr,
        targetClicks: form.targetClicks,
        targetImpressions: form.targetImpressions,
        targetRoas: form.targetRoas,
        targetLeads: form.targetLeads,
        targetConversions: form.targetConversions,
        targetRevenue: form.targetRevenue,
        targetCpc: form.targetCpc,
        targetCpm: form.targetCpm,
        targetCpa: form.targetCpa,
        targetCpl: form.targetCpl,
        targetFrequency: form.targetFrequency,
        initialInvestment: form.initialInvestment,
        dailyBudget: form.dailyBudget,
        lifetimeBudget: form.lifetimeBudget,
        currency: form.currency || null,
        flightStartDate: form.flightStartDate || null,
        flightEndDate: form.flightEndDate || null,
        notes: form.notes || null,
    };
    emit('submit', payload);
}

function handleDelete() {
    if (props.target) emit('delete', props.target.id);
}

interface IFieldDef {
    key: keyof IFormState;
    label: string;
    type?: 'number' | 'select';
    options?: string[];
    step?: string;
    prefix?: string;
    suffix?: string;
    placeholder?: string;
}

interface IFieldGroup {
    title: string;
    fields: IFieldDef[];
}

/** Categorical media-buying models selectable for a target. */
const BUYING_MODELS = [
    'Auction',
    'Reservation',
    'Reach & Frequency',
    'Programmatic Guaranteed',
    'Preferred Deal',
    'Private Marketplace',
    'Open Exchange',
    'Fixed CPM',
    'CPC',
    'CPA / CPL',
    'Hybrid',
    'Other',
];

const fieldGroups: IFieldGroup[] = [
    {
        title: 'Strategy & Audience',
        fields: [
            { key: 'buyingModel', label: 'Buying Model', type: 'select', options: BUYING_MODELS },
            { key: 'audienceSize', label: 'Audience Size', placeholder: 'e.g. 1500000' },
        ],
    },
    {
        title: 'Delivery Targets',
        fields: [
            { key: 'targetImpressions', label: 'Target Impressions', placeholder: '0' },
            { key: 'targetClicks', label: 'Target Clicks', placeholder: '0' },
            { key: 'targetCtr', label: 'Target CTR', suffix: '%', step: '0.01' },
            { key: 'targetFrequency', label: 'Target Frequency', step: '0.01' },
        ],
    },
    {
        title: 'Efficiency Targets',
        fields: [
            { key: 'targetCpc', label: 'Target CPC', prefix: '$', step: '0.01' },
            { key: 'targetCpm', label: 'Target CPM', prefix: '$', step: '0.01' },
            { key: 'targetCpa', label: 'Target CPA', prefix: '$', step: '0.01' },
            { key: 'targetCpl', label: 'Target CPL', prefix: '$', step: '0.01' },
        ],
    },
    {
        title: 'Outcome Targets',
        fields: [
            { key: 'targetRoas', label: 'Target ROAS', suffix: 'x', step: '0.01' },
            { key: 'targetLeads', label: 'Target Leads', placeholder: '0' },
            { key: 'targetConversions', label: 'Target Conversions', placeholder: '0' },
            { key: 'targetRevenue', label: 'Target Revenue', prefix: '$', step: '0.01' },
        ],
    },
    {
        title: 'Budget & Flight',
        fields: [
            { key: 'initialInvestment', label: 'Initial Investment', prefix: '$', step: '0.01' },
            { key: 'dailyBudget', label: 'Daily Budget', prefix: '$', step: '0.01' },
            { key: 'lifetimeBudget', label: 'Lifetime Budget', prefix: '$', step: '0.01' },
        ],
    },
];

/**
 * Options for a select field, including the currently-saved value when it is
 * not part of the predefined list (so older/custom values are preserved).
 */
function selectOptions(field: IFieldDef): string[] {
    const options = [...(field.options || [])];
    const current = String((form as any)[field.key] ?? '').trim();
    if (current && !options.includes(current)) options.push(current);
    return options;
}

const scopeLabel = 'Ad set / Ad group';
</script>

<template>
    <Teleport to="body">
        <div
            v-if="modelValue"
            class="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/40 p-4 sm:p-8"
            @click.self="close"
        >
            <div class="w-full max-w-3xl rounded-xl bg-white shadow-xl">
                <!-- Header -->
                <div class="flex items-start justify-between gap-3 border-b border-gray-100 p-5">
                    <div>
                        <h3 class="text-base font-semibold text-gray-900">
                            {{ target ? 'Edit' : 'Set' }} {{ scopeLabel }} Targets
                        </h3>
                        <p class="mt-0.5 text-xs text-gray-500">
                            {{ entity.name || entity.id }}
                            <span class="text-gray-400">·</span>
                            {{ scope.channel || 'unknown channel' }}
                        </p>
                    </div>
                    <button
                        class="rounded-lg p-1.5 text-gray-400 hover:bg-gray-100 hover:text-gray-600 cursor-pointer"
                        @click="close"
                    >
                        <font-awesome-icon :icon="['fas', 'times']" />
                    </button>
                </div>

                <!-- Body -->
                <div class="max-h-[70vh] space-y-5 overflow-y-auto p-5">
                    <div v-if="error" class="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{{ error }}</div>

                    <div v-for="group in fieldGroups" :key="group.title">
                        <h4 class="mb-2 text-[11px] font-semibold uppercase tracking-wide text-gray-500">{{ group.title }}</h4>
                        <div class="grid grid-cols-2 gap-3 sm:grid-cols-4">
                            <div v-for="field in group.fields" :key="field.key">
                                <label class="mb-1 block text-[11px] font-medium text-gray-600">{{ field.label }}</label>
                                <select
                                    v-if="field.type === 'select'"
                                    v-model="(form as any)[field.key]"
                                    class="w-full rounded-lg border border-gray-200 bg-white px-2.5 py-2 text-sm text-gray-900 focus:border-indigo-400 focus:outline-none"
                                >
                                    <option value="">Select…</option>
                                    <option v-for="opt in selectOptions(field)" :key="opt" :value="opt">{{ opt }}</option>
                                </select>
                                <div
                                    v-else
                                    class="flex items-center rounded-lg border border-gray-200 focus-within:border-indigo-400 focus-within:ring-1 focus-within:ring-indigo-200"
                                >
                                    <span v-if="field.prefix" class="pl-2.5 text-xs text-gray-400">{{ field.prefix }}</span>
                                    <input
                                        v-model.number="(form as any)[field.key]"
                                        type="number"
                                        :step="field.step || '1'"
                                        :placeholder="field.placeholder"
                                        class="w-full bg-transparent px-2.5 py-2 text-sm text-gray-900 focus:outline-none"
                                    >
                                    <span v-if="field.suffix" class="pr-2.5 text-xs text-gray-400">{{ field.suffix }}</span>
                                </div>
                            </div>
                        </div>
                    </div>

                    <!-- Flight dates + currency -->
                    <div>
                        <h4 class="mb-2 text-[11px] font-semibold uppercase tracking-wide text-gray-500">Timeline & Currency</h4>
                        <div class="grid grid-cols-2 gap-3 sm:grid-cols-3">
                            <div>
                                <label class="mb-1 block text-[11px] font-medium text-gray-600">Flight Start</label>
                                <input v-model="form.flightStartDate" type="date" class="w-full rounded-lg border border-gray-200 px-2.5 py-2 text-sm focus:border-indigo-400 focus:outline-none">
                            </div>
                            <div>
                                <label class="mb-1 block text-[11px] font-medium text-gray-600">Flight End</label>
                                <input v-model="form.flightEndDate" type="date" class="w-full rounded-lg border border-gray-200 px-2.5 py-2 text-sm focus:border-indigo-400 focus:outline-none">
                            </div>
                            <div>
                                <label class="mb-1 block text-[11px] font-medium text-gray-600">Currency</label>
                                <input v-model="form.currency" type="text" placeholder="USD" maxlength="10" class="w-full rounded-lg border border-gray-200 px-2.5 py-2 text-sm focus:border-indigo-400 focus:outline-none">
                            </div>
                        </div>
                    </div>

                    <!-- Notes -->
                    <div>
                        <label class="mb-1 block text-[11px] font-medium text-gray-600">Notes</label>
                        <textarea
                            v-model="form.notes"
                            rows="3"
                            placeholder="Assumptions, benchmarks, context for these targets…"
                            class="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:border-indigo-400 focus:outline-none"
                        />
                    </div>
                </div>

                <!-- Footer -->
                <div class="flex items-center justify-between gap-3 border-t border-gray-100 p-4">
                    <button
                        v-if="target"
                        class="rounded-lg px-3 py-2 text-sm font-medium text-red-600 hover:bg-red-50 disabled:opacity-50 cursor-pointer"
                        :disabled="isSaving"
                        @click="handleDelete"
                    >
                        Delete targets
                    </button>
                    <span v-else />

                    <div class="flex items-center gap-2">
                        <button
                            class="rounded-lg bg-gray-100 px-4 py-2 text-sm font-medium text-gray-600 hover:bg-gray-200 cursor-pointer"
                            :disabled="isSaving"
                            @click="close"
                        >
                            Cancel
                        </button>
                        <button
                            class="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-700 disabled:opacity-50 cursor-pointer"
                            :disabled="isSaving || !scope.projectId"
                            @click="handleSubmit"
                        >
                            {{ isSaving ? 'Saving…' : 'Save targets' }}
                        </button>
                    </div>
                </div>
            </div>
        </div>
    </Teleport>
</template>
