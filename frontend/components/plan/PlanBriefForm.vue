<script setup lang="ts">
import { usePaidMediaPlansStore } from '@/stores/paid_media_plans';
import { COUNTRIES } from '~/constants/countries';
import { PLAN_PLATFORM_OPTIONS } from '~/constants/planPlatforms';
import { CURRENCIES } from '~/constants/planCurrencies';

const props = defineProps<{
    planId: number;
}>();

const emit = defineEmits<{
    close: [];
    saved: [];
}>();

const store = usePaidMediaPlansStore();

const COUNTRY_OPTIONS = COUNTRIES.map((name) => ({ key: name, label: name }));

const form = reactive({
    name: '',
    website: '',
    industry: '',
    product: '',
    platforms: [] as string[],
    markets: [] as string[],
    budgetTotal: null as number | null,
    currency: 'USD',
    teamSize: null as number | null,
    channels: [] as string[],
    competitors: [] as Array<{ name: string; website: string }>,
    notes: '',
    startDate: '',
    endDate: '',
});

function extractNotesFromBrief(brief: unknown): string {
    if (typeof brief !== 'string') return '';
    const match = brief.match(/^Notes:\s*([\s\S]*)$/m);
    return match ? match[1].trim() : '';
}

function initForm() {
    const plan = store.currentPlan;
    const coreFacts = plan?.state?.core_facts ?? {};
    const budget = coreFacts.budget ?? {};
    const company = coreFacts.company ?? {};
    form.name = plan?.name ?? '';
    form.website = coreFacts.website ?? '';
    form.industry = coreFacts.industry ?? '';
    form.product = company.product_service ?? '';
    form.platforms = Array.isArray(coreFacts.platforms) ? [...coreFacts.platforms] : [];
    form.markets = Array.isArray(coreFacts.markets) ? [...coreFacts.markets] : [];
    form.budgetTotal = budget.total ?? null;
    form.currency = budget.currency ?? 'USD';
    form.teamSize = company.team_size ?? null;
    form.channels = Array.isArray(company.channels) ? [...company.channels] : [];
    form.competitors = Array.isArray(coreFacts.competitors)
        ? coreFacts.competitors.map((c: any) => ({ name: c?.name ?? '', website: c?.website ?? '' }))
        : [];
    form.notes = typeof coreFacts.notes === 'string'
        ? coreFacts.notes
        : extractNotesFromBrief(plan?.state?.client_brief);
    const dates = coreFacts.dates ?? {};
    form.startDate = dates.start ?? '';
    form.endDate = dates.end ?? '';
}

initForm();

const isSaving = ref(false);
const saved = ref(false);

function addCompetitor() {
    form.competitors.push({ name: '', website: '' });
}

function removeCompetitor(index: number) {
    form.competitors.splice(index, 1);
}

function addChannel() {
    form.channels.push('');
}

function removeChannel(index: number) {
    form.channels.splice(index, 1);
}

function onMarketsChange(selected: Array<{ key: string; label: string }>) {
    form.markets = selected.map((option) => option.label);
}

const briefComplete = computed(() => {
    const hasName = Boolean(form.name.trim());
    const hasWebsite = Boolean(form.website.trim());
    const hasIndustry = Boolean(form.industry.trim());
    return hasName && hasWebsite && hasIndustry && form.platforms.length > 0 && form.markets.length > 0;
});

async function save() {
    if (isSaving.value) return;
    isSaving.value = true;
    saved.value = false;
    try {
        await store.updateBrief(props.planId, {
            name: form.name,
            website: form.website,
            industry: form.industry,
            product: form.product,
            platforms: form.platforms,
            markets: form.markets,
            budgetTotal: form.budgetTotal,
            currency: form.currency,
            teamSize: form.teamSize,
            channels: form.channels.filter((c) => c.trim()),
            competitors: form.competitors.filter((c) => c.name.trim()),
            notes: form.notes,
            startDate: form.startDate,
            endDate: form.endDate,
        });
        saved.value = true;
        emit('saved');
        setTimeout(() => {
            saved.value = false;
        }, 2500);
    } finally {
        isSaving.value = false;
    }
}
</script>

<template>
    <div>
        <h2 class="text-lg font-semibold text-gray-800 mb-1">Client brief</h2>
        <p class="text-sm text-gray-500 mb-4">
            Everything here is fed to every step of the plan, so you provide it once. Save it before the loop runs.
        </p>
        <form class="space-y-4" @submit.prevent="save">
            <div class="grid grid-cols-2 gap-4">
                <div>
                    <label class="block text-sm font-medium text-gray-700 mb-1">Company name</label>
                    <input v-model="form.name" type="text" class="w-full px-3 py-2 rounded-lg border border-gray-300 focus:outline-none focus:ring-2 focus:ring-primary-blue-100" placeholder="Acme Ltd" />
                </div>
                <div>
                    <label class="block text-sm font-medium text-gray-700 mb-1">Website</label>
                    <input v-model="form.website" type="url" class="w-full px-3 py-2 rounded-lg border border-gray-300 focus:outline-none focus:ring-2 focus:ring-primary-blue-100" placeholder="https://example.com" />
                </div>
            </div>

            <div class="grid grid-cols-2 gap-4">
                <div>
                    <label class="block text-sm font-medium text-gray-700 mb-1">Industry / category</label>
                    <input v-model="form.industry" type="text" class="w-full px-3 py-2 rounded-lg border border-gray-300 focus:outline-none focus:ring-2 focus:ring-primary-blue-100" placeholder="B2B SaaS — HR software" />
                </div>
                <div>
                    <label class="block text-sm font-medium text-gray-700 mb-1">Product / service</label>
                    <input v-model="form.product" type="text" class="w-full px-3 py-2 rounded-lg border border-gray-300 focus:outline-none focus:ring-2 focus:ring-primary-blue-100" placeholder="Recruitment platform" />
                </div>
            </div>

            <div>
                <label class="block text-sm font-medium text-gray-700 mb-1">Platforms</label>
                <div class="flex flex-wrap gap-2">
                    <button
                        v-for="option in PLAN_PLATFORM_OPTIONS"
                        :key="option"
                        type="button"
                        class="px-3 py-1.5 rounded-lg text-sm border cursor-pointer"
                        :class="form.platforms.includes(option) ? 'bg-primary-blue-100 text-white border-primary-blue-100' : 'bg-white text-gray-600 border-gray-300'"
                        @click="form.platforms.includes(option) ? form.platforms.splice(form.platforms.indexOf(option), 1) : form.platforms.push(option)"
                    >
                        {{ option.replace('_', ' ') }}
                    </button>
                </div>
            </div>

            <div>
                <label class="block text-sm font-medium text-gray-700 mb-1">Target markets</label>
                <multi-select
                    :options="COUNTRY_OPTIONS"
                    :default-options="form.markets.map((m) => ({ key: m, label: m }))"
                    searchable
                    placeholder="Search countries..."
                    :close-on-select="false"
                    @multi-select-filtered-data="onMarketsChange"
                />
            </div>

            <div class="grid grid-cols-3 gap-4">
                <div>
                    <label class="block text-sm font-medium text-gray-700 mb-1">Total budget</label>
                    <input v-model.number="form.budgetTotal" type="number" min="0" class="w-full px-3 py-2 rounded-lg border border-gray-300" placeholder="1000" />
                </div>
                <div>
                    <label class="block text-sm font-medium text-gray-700 mb-1">Currency</label>
                    <select v-model="form.currency" class="w-full px-3 py-2 rounded-lg border border-gray-300 bg-white cursor-pointer">
                        <option v-for="currency in CURRENCIES" :key="currency.code" :value="currency.code">
                            {{ currency.code }} — {{ currency.name }}
                        </option>
                    </select>
                </div>
                <div>
                    <label class="block text-sm font-medium text-gray-700 mb-1">Team size</label>
                    <input v-model.number="form.teamSize" type="number" min="0" class="w-full px-3 py-2 rounded-lg border border-gray-300" placeholder="2" />
                </div>
            </div>

            <div class="grid grid-cols-2 gap-4">
                <div>
                    <label class="block text-sm font-medium text-gray-700 mb-1">Start</label>
                    <input v-model="form.startDate" type="date" class="w-full px-3 py-2 rounded-lg border border-gray-300 cursor-pointer" />
                </div>
                <div>
                    <label class="block text-sm font-medium text-gray-700 mb-1">End</label>
                    <input v-model="form.endDate" type="date" class="w-full px-3 py-2 rounded-lg border border-gray-300 cursor-pointer" />
                </div>
            </div>

            <div>
                <label class="block text-sm font-medium text-gray-700 mb-1">Competitors</label>
                <div v-for="(competitor, index) in form.competitors" :key="index" class="flex gap-2 mb-2">
                    <input v-model="competitor.name" type="text" class="flex-1 px-3 py-2 rounded-lg border border-gray-300 focus:outline-none focus:ring-2 focus:ring-primary-blue-100" placeholder="Competitor name" />
                    <input v-model="competitor.website" type="url" class="flex-1 px-3 py-2 rounded-lg border border-gray-300 focus:outline-none focus:ring-2 focus:ring-primary-blue-100" placeholder="https://competitor.com" />
                    <button type="button" class="px-2.5 py-2 rounded-lg text-sm text-red-600 hover:bg-red-50 cursor-pointer" @click="removeCompetitor(index)">
                        <font-awesome-icon :icon="['fas', 'trash']" />
                    </button>
                </div>
                <button type="button" class="px-3 py-1.5 rounded-lg text-sm border border-gray-300 text-gray-600 hover:bg-gray-50 cursor-pointer" @click="addCompetitor">
                    <font-awesome-icon :icon="['fas', 'plus']" class="mr-1" /> Add competitor
                </button>
            </div>

            <div>
                <label class="block text-sm font-medium text-gray-700 mb-1">Existing social / paid channels</label>
                <div v-for="(channel, index) in form.channels" :key="index" class="flex gap-2 mb-2">
                    <input v-model="form.channels[index]" type="url" class="flex-1 px-3 py-2 rounded-lg border border-gray-300 focus:outline-none focus:ring-2 focus:ring-primary-blue-100" placeholder="https://linkedin.com/company/acme" />
                    <button type="button" class="px-2.5 py-2 rounded-lg text-sm text-red-600 hover:bg-red-50 cursor-pointer" @click="removeChannel(index)">
                        <font-awesome-icon :icon="['fas', 'trash']" />
                    </button>
                </div>
                <button type="button" class="px-3 py-1.5 rounded-lg text-sm border border-gray-300 text-gray-600 hover:bg-gray-50 cursor-pointer" @click="addChannel">
                    <font-awesome-icon :icon="['fas', 'plus']" class="mr-1" /> Add channel
                </button>
            </div>

            <div>
                <label class="block text-sm font-medium text-gray-700 mb-1">Additional notes</label>
                <textarea v-model="form.notes" rows="3" class="w-full px-3 py-2 rounded-lg border border-gray-300 focus:outline-none focus:ring-2 focus:ring-primary-blue-100" placeholder="Anything the plan should know — positioning, target customers, prior campaigns, constraints..." />
            </div>

            <div class="flex items-center gap-3 pt-1">
                <button
                    type="submit"
                    class="px-4 py-2 rounded-lg bg-primary-blue-100 text-white text-sm font-medium hover:bg-primary-blue-200 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                    :disabled="isSaving"
                >
                    {{ isSaving ? 'Saving...' : 'Save brief' }}
                </button>
                <span v-if="saved" class="text-sm text-green-600 font-medium">
                    <font-awesome-icon :icon="['fas', 'check']" class="mr-1" /> Saved — the loop will use this brief
                </span>
                <span v-if="!briefComplete" class="text-sm text-gray-400">Company, website, industry, platforms and markets are required.</span>
            </div>
        </form>
    </div>
</template>
