<script setup lang="ts">
import { usePaidMediaPlansStore } from '@/stores/paid_media_plans';
import { COUNTRIES } from '~/constants/countries';
import { PLAN_PLATFORM_OPTIONS } from '~/constants/planPlatforms';
import { CURRENCIES } from '~/constants/planCurrencies';

const props = withDefaults(defineProps<{
    projectId?: number;
    showTrigger?: boolean;
}>(), {
    projectId: undefined,
    showTrigger: true,
});

const emit = defineEmits<{
    created: [planId: number];
}>();

const store = usePaidMediaPlansStore();
const router = useRouter();
const isGuestMode = computed(() => !props.projectId);
const subscriptionStore = useSubscriptionStore();
const advancedAllowed = computed(() => isGuestMode.value ? false : subscriptionStore.planAdvancedModeAllowed);
const createError = ref('');

// Re-build input: include campaigns already running on connected channels so
// the new plan improves on them instead of planning from a blank slate.
const includeExistingCampaigns = ref(false);
const existingCampaignNames = ref<string[]>([]);
const loadingExistingCampaigns = ref(false);

async function loadExistingCampaigns() {
    if (!props.projectId || existingCampaignNames.value.length > 0 || loadingExistingCampaigns.value) return;
    loadingExistingCampaigns.value = true;
    try {
        const { getAuthToken } = await import('~/composables/AuthToken');
        const { useAppFetch } = await import('~/composables/useAppFetch');
        const { baseUrl } = await import('~/composables/Utils');
        const token = getAuthToken();
        if (!token) return;
        const qs = new URLSearchParams({
            projectId: String(props.projectId),
            pageSize: '200',
            sortBy: 'spend',
            sortDir: 'desc',
        }).toString();
        const response = await useAppFetch<any>(`${baseUrl()}/marketing-metrics/campaigns?${qs}`, {
            headers: {
                Authorization: `Bearer ${token}`,
                'Authorization-Type': 'auth',
            },
        });
        existingCampaignNames.value = (response?.data ?? [])
            .map((r: any) => r.campaignName)
            .filter((n: unknown): n is string => typeof n === 'string' && n.trim().length > 0);
    } catch (error) {
        console.error('[PlanStartModal] Failed to load existing campaigns:', error);
    } finally {
        loadingExistingCampaigns.value = false;
    }
}

const isOpen = ref(false);
const form = reactive({
    name: '',
    website: '',
    mode: 'basic' as 'basic' | 'advanced',
    funnelCoverage: 'bofu_mofu',
    buildMode: 'test_only',
    platforms: [] as string[],
    markets: [] as string[],
    budgetTotal: null as number | null,
    currency: 'USD',
    startDate: '',
    endDate: '',
    autonomy: 'assisted',
    industry: '',
    product: '',
    teamSize: null as number | null,
    channels: [] as string[],
    competitors: [] as Array<{ name: string; website: string }>,
    notes: '',
});

const COUNTRY_OPTIONS = COUNTRIES.map((name) => ({ key: name, label: name }));

function resetForm() {
    form.name = '';
    form.website = '';
    form.mode = 'basic';
    form.funnelCoverage = 'bofu_mofu';
    form.buildMode = 'test_only';
    form.platforms = [];
    form.markets = [];
    form.budgetTotal = null;
    form.currency = 'USD';
    form.startDate = '';
    form.endDate = '';
    form.autonomy = 'auto';
    form.industry = '';
    form.product = '';
    form.teamSize = null;
    form.channels = [];
    form.competitors = [];
    form.notes = '';
}

function openModal() {
    resetForm();
    if (!isGuestMode.value && !subscriptionStore.canCreatePlanBuild) {
        router.push('/pricing');
        return;
    }
    createError.value = '';
    isOpen.value = true;
}

function openGuestModal(website?: string) {
    resetForm();
    form.mode = 'basic';
    form.autonomy = 'auto';
    if (website) form.website = website;
    createError.value = '';
    isOpen.value = true;
}

defineExpose({ openGuestModal });

function closeModal() {
    isOpen.value = false;
    resetForm();
}

function onMarketsChange(selected: any[]) {
    form.markets = selected.map((option) => option.label);
}

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

const hasDefaults = computed(() =>
    (form.mode !== 'basic' || !!form.website.trim()) &&
    form.platforms.length > 0 &&
    form.markets.length > 0 &&
    !!form.startDate &&
    !!form.endDate
);

async function create() {
    if ((form.mode === 'basic' && !form.website.trim()) || !form.platforms.length || !form.markets.length || !form.startDate || !form.endDate) return;
    createError.value = '';
    const payload = {
        name: form.name || 'Paid Media Plan',
        website: form.website.trim() || null,
        mode: form.mode,
        funnelCoverage: form.funnelCoverage,
        buildMode: form.buildMode,
        platforms: form.platforms,
        markets: form.markets,
        budgetTotal: form.budgetTotal,
        currency: form.currency,
        startDate: form.startDate || null,
        endDate: form.endDate || null,
        autonomy: form.autonomy,
        industry: form.industry.trim() || null,
        product: form.product.trim() || null,
        teamSize: form.teamSize,
        channels: form.channels.filter((c) => c.trim()),
        competitors: form.competitors.filter((c) => c.name.trim()),
        notes: form.notes.trim() || null,
        ...(includeExistingCampaigns.value && existingCampaignNames.value.length
            ? { existingCampaigns: existingCampaignNames.value }
            : {}),
    };
    try {
        if (isGuestMode.value) {
            const plan = await store.createGuestPlan(payload);
            isOpen.value = false;
            resetForm();
            router.push(`/guest/plan/${plan.guestToken}`);
            return;
        }
        const plan = await store.createPlan(props.projectId!, payload);
        isOpen.value = false;
        resetForm();
        emit('created', plan.id);
    } catch (error: any) {
        const message = error?.data?.message ?? error?.data?.error ?? error?.message ?? 'Could not start the plan.';
        createError.value = message;
        if (error?.statusCode === 402 || error?.status === 402) {
            // Refresh usage flags so the button/limit reflect the new state.
            subscriptionStore.fetchUsageStats().catch(() => {});
        }
    }
}
</script>

<template>
    <div>
        <button
            v-if="showTrigger"
            type="button"
            class="px-4 py-2 rounded-lg bg-primary-blue-100 text-white text-sm font-medium hover:bg-primary-blue-200 cursor-pointer"
            @click="openModal"
        >
            <font-awesome-icon :icon="['fas', 'plus']" class="mr-1" /> Start your plan
        </button>
        <overlay-dialog v-if="isOpen" @close="closeModal">
            <template #overlay>
                <h2 class="text-lg font-semibold text-gray-800 mb-4">{{ isGuestMode ? 'Start your free paid media plan' : 'Start a paid media plan' }}</h2>
                <div v-if="isGuestMode" class="mb-4 rounded-xl bg-amber-50 border border-amber-200 px-3 py-2.5 text-xs text-amber-800 leading-5">
                    Your plan is stored for <span class="font-semibold">24 hours</span> as a preview. Register a free account to keep it forever — otherwise it expires.
                </div>
                <form class="space-y-4" @submit.prevent="create">
                    <div>
                        <label class="block text-sm font-medium text-gray-700 mb-1">Plan name</label>
                        <input v-model="form.name" type="text" class="w-full px-3 py-2 rounded-lg border border-gray-300 focus:outline-none focus:ring-2 focus:ring-primary-blue-100" placeholder="Paid Media Strategy 2026" />
                    </div>
                    <div v-if="form.mode === 'basic'">
                        <label class="block text-sm font-medium text-gray-700 mb-1">Website</label>
                        <input v-model="form.website" type="url" class="w-full px-3 py-2 rounded-lg border border-gray-300 focus:outline-none focus:ring-2 focus:ring-primary-blue-100" placeholder="https://example.com" />
                        <p class="text-xs text-gray-500 mt-1">Basic mode — the AI researches the rest from your website and asks no follow-up questions.</p>
                    </div>
                    <div class="grid grid-cols-2 gap-4">
                        <div :class="form.mode === 'basic' ? 'col-span-2' : ''">
                            <label class="block text-sm font-medium text-gray-700 mb-1">Mode</label>
                            <select v-model="form.mode" class="w-full px-3 py-2 rounded-lg border border-gray-300 bg-white cursor-pointer">
                                <option value="basic">Basic (from website)</option>
                                <option v-if="!isGuestMode" value="advanced" :disabled="!advancedAllowed">Advanced (questionnaire)</option>
                            </select>
                            <p v-if="!isGuestMode && !advancedAllowed" class="text-xs text-gray-500 mt-1">
                                Advanced mode is available on Starter and above.
                                <NuxtLink to="/pricing" class="text-primary-blue-100 font-medium">Upgrade</NuxtLink>
                            </p>
                        </div>
                        <div v-if="form.mode === 'advanced'">
                            <label class="block text-sm font-medium text-gray-700 mb-1">Autonomy</label>
                            <select v-model="form.autonomy" class="w-full px-3 py-2 rounded-lg border border-gray-300 bg-white cursor-pointer">
                                <option value="assisted">Assisted (pause at gates)</option>
                                <option value="auto">Auto (run to next gate)</option>
                            </select>
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
                        <label class="block text-sm font-medium text-gray-700 mb-1">Markets</label>
                        <multi-select
                            :options="COUNTRY_OPTIONS"
                            :default-options="[]"
                            searchable
                            placeholder="Search countries..."
                            :close-on-select="false"
                            class=""
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
                            <label class="block text-sm font-medium text-gray-700 mb-1">Funnel</label>
                            <select v-model="form.funnelCoverage" class="w-full px-3 py-2 rounded-lg border border-gray-300 bg-white cursor-pointer">
                                <option value="bofu">BOFU</option>
                                <option value="bofu_mofu">BOFU + MOFU</option>
                                <option value="full_funnel">Full funnel</option>
                            </select>
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
                    <div v-if="!isGuestMode" class="rounded-lg border border-gray-200 bg-gray-50 p-3">
                        <label class="flex items-start gap-3 cursor-pointer">
                            <input
                                v-model="includeExistingCampaigns"
                                type="checkbox"
                                class="mt-0.5 w-4 h-4 rounded border-gray-300 text-primary-blue-100 focus:ring-primary-blue-100 cursor-pointer"
                                @change="loadExistingCampaigns"
                            />
                            <span>
                                <span class="block text-sm font-medium text-gray-800">Include campaigns already running on my channels</span>
                                <span class="block text-xs text-gray-500 mt-0.5">
                                    {{ loadingExistingCampaigns ? 'Looking up connected campaigns…' : existingCampaignNames.length ? `${existingCampaignNames.length} live campaign${existingCampaignNames.length !== 1 ? 's' : ''} found — the new plan will analyze and improve on them.` : 'The new plan will be built from your website and brief.' }}
                                </span>
                            </span>
                        </label>
                    </div>
                    <div v-if="form.mode === 'advanced'" class="border-t border-gray-200 pt-4">
                        <h3 class="text-sm font-semibold text-gray-800 mb-1">Client briefing</h3>
                        <p class="text-xs text-gray-500 mb-3">
                            Advanced questionnaire mode — provide the full briefing here so every step has what it needs.
                        </p>
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
                        <div class="mt-4">
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
                        <div class="mt-4">
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
                        <div class="grid grid-cols-2 gap-4 mt-4">
                            <div>
                                <label class="block text-sm font-medium text-gray-700 mb-1">Team size</label>
                                <input v-model.number="form.teamSize" type="number" min="0" class="w-full px-3 py-2 rounded-lg border border-gray-300" placeholder="2" />
                            </div>
                            <div>
                                <label class="block text-sm font-medium text-gray-700 mb-1">Build mode</label>
                                <select v-model="form.buildMode" class="w-full px-3 py-2 rounded-lg border border-gray-300 bg-white cursor-pointer">
                                    <option value="test_only">Test-only (minimum assets for the smoke test)</option>
                                    <option value="build_to_scale">Build-to-scale (full scale-ready structure)</option>
                                </select>
                                <p class="text-xs text-gray-500 mt-1">Test-only validates first; build-to-scale pre-builds the held assets for the scale run.</p>
                            </div>
                        </div>
                        <div class="mt-4">
                            <label class="block text-sm font-medium text-gray-700 mb-1">Additional notes</label>
                            <textarea v-model="form.notes" rows="3" class="w-full px-3 py-2 rounded-lg border border-gray-300 focus:outline-none focus:ring-2 focus:ring-primary-blue-100" placeholder="Anything the plan should know — positioning, target customers, prior campaigns, constraints..." />
                        </div>
                    </div>
                    <p v-if="createError" class="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
                        {{ createError }}
                        <NuxtLink to="/pricing" class="font-medium underline ml-1">View plans</NuxtLink>
                    </p>
                    <button
                        type="submit"
                        class="w-full px-4 py-2.5 rounded-lg bg-primary-blue-100 text-white font-medium hover:bg-primary-blue-200 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                        :disabled="!hasDefaults || store.isCreating"
                    >
                        {{ store.isCreating ? 'Creating...' : 'Create plan' }}
                    </button>
                </form>
            </template>
        </overlay-dialog>
    </div>
</template>
