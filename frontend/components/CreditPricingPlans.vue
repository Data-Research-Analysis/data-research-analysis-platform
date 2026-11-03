<template>
    <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div class="text-center max-w-3xl mx-auto mb-8">
            <p class="inline-flex items-center gap-2 rounded-full bg-blue-50 ring-1 ring-blue-200 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-blue-700 mb-4">
                Credit-based pricing
            </p>
            <h2 class="text-3xl sm:text-4xl font-bold text-gray-900 mb-4">
                One product. Every tool on every plan.
            </h2>
            <p class="text-lg text-gray-600">
                Paid media plans, AI analysis, data models, dashboards, reports and AI insights are available to
                everyone. The only difference between plans is how many credits you get each month and how much
                data you can store.
            </p>
        </div>

        <div v-if="showBillingToggle" class="flex items-center justify-center gap-3 mb-12">
            <span :class="billingPeriod === 'monthly' ? 'text-gray-900 font-semibold' : 'text-gray-500'">Monthly</span>
            <button
                type="button"
                @click="billingPeriod = billingPeriod === 'monthly' ? 'annual' : 'monthly'"
                :class="[
                    'relative inline-flex h-6 w-11 items-center rounded-full transition-colors cursor-pointer',
                    billingPeriod === 'monthly' ? 'bg-gray-300' : 'bg-blue-600'
                ]"
                :aria-label="billingPeriod === 'monthly' ? 'Switch to annual billing' : 'Switch to monthly billing'"
            >
                <span
                    :class="[
                        'inline-block h-4 w-4 transform rounded-full bg-white transition-transform',
                        billingPeriod === 'monthly' ? 'translate-x-1' : 'translate-x-6'
                    ]"
                />
            </button>
            <span :class="billingPeriod === 'annual' ? 'text-gray-900 font-semibold' : 'text-gray-500'">Annual</span>
            <span v-if="billingPeriod === 'annual'" class="ml-1 px-3 py-1 bg-green-500 text-white text-xs font-bold rounded-full">
                Save 20%
            </span>
        </div>

        <!-- Free vs Pro vs Enterprise -->
        <div class="grid grid-cols-1 lg:grid-cols-3 gap-8 max-w-6xl mx-auto mb-16">
            <div class="bg-white rounded-2xl shadow-sm border border-gray-200 p-8 flex flex-col">
                <h3 class="text-xl font-bold text-gray-900 mb-1">Free</h3>
                <p class="text-sm text-gray-600 mb-6">Try the whole product, no card required.</p>
                <div class="mb-6">
                    <span class="text-4xl font-bold text-gray-900">$0</span>
                    <span class="text-gray-600">/month</span>
                </div>
                <ul class="space-y-3 mb-8">
                    <li class="flex items-start gap-2">
                        <font-awesome-icon :icon="['fas', 'check']" class="text-green-600 mt-1 flex-shrink-0" />
                        <span class="text-sm text-gray-700"><strong>1,000 credits</strong> in your first month, then <strong>500 credits</strong> every month</span>
                    </li>
                    <li class="flex items-start gap-2">
                        <font-awesome-icon :icon="['fas', 'check']" class="text-green-600 mt-1 flex-shrink-0" />
                        <span class="text-sm text-gray-700">Every feature — plan studio, AI analysis, data models, dashboards, reports, AI insights</span>
                    </li>
                    <li class="flex items-start gap-2">
                        <font-awesome-icon :icon="['fas', 'check']" class="text-green-600 mt-1 flex-shrink-0" />
                        <span class="text-sm text-gray-700">Unlimited team members</span>
                    </li>
                    <li class="flex items-start gap-2">
                        <font-awesome-icon :icon="['fas', 'check']" class="text-green-600 mt-1 flex-shrink-0" />
                        <span class="text-sm text-gray-700">A data-row allowance per data model, with scheduled channel syncs</span>
                    </li>
                </ul>
                <div class="mt-auto">
                    <button
                        v-if="isCurrentFree"
                        disabled
                        class="w-full px-4 py-3 bg-gray-200 text-gray-500 font-medium rounded-lg cursor-not-allowed"
                    >
                        Current Plan
                    </button>
                    <button
                        v-else-if="isOrgMode"
                        @click="handleSelectFree"
                        class="w-full px-4 py-3 bg-gray-100 hover:bg-gray-200 text-gray-800 font-medium rounded-lg transition-colors cursor-pointer"
                    >
                        Downgrade to Free
                    </button>
                    <NuxtLink
                        v-else
                        to="/register?plan=free"
                        class="w-full inline-block text-center px-4 py-3 bg-primary-blue-100 hover:bg-primary-blue-80 text-white font-medium rounded-lg transition-colors cursor-pointer"
                    >
                        Get started free
                    </NuxtLink>
                </div>
            </div>

            <div class="bg-white rounded-2xl shadow-lg border-2 border-blue-400 p-8 flex flex-col relative">
                <div class="absolute -top-4 left-1/2 -translate-x-1/2 bg-blue-600 text-white text-xs font-bold px-4 py-1.5 rounded-full">
                    MOST POPULAR
                </div>
                <h3 class="text-xl font-bold text-gray-900 mb-1">Pro</h3>
                <p class="text-sm text-gray-600 mb-6">Credits for the whole team, scaled to your volume.</p>
                <div class="mb-2">
                    <span class="text-4xl font-bold text-gray-900">${{ proPrice }}</span>
                    <span class="text-gray-600">/month</span>
                </div>
                <p v-if="billingPeriod === 'annual'" class="text-xs text-green-600 font-medium mb-4">
                    Billed annually — save 20%
                </p>
                <p v-else class="text-xs text-gray-500 mb-4">Billed monthly</p>

                <label class="block mb-2">
                    <span class="text-sm font-medium text-gray-700">Monthly credits: {{ formatCredits(proCredits) }}</span>
                    <input
                        v-model.number="proCredits"
                        type="range"
                        min="5000"
                        max="100000"
                        step="5000"
                        class="w-full mt-2"
                    />
                    <span class="flex justify-between text-xs text-gray-500 mt-1">
                        <span>5k</span>
                        <span>25k</span>
                        <span>50k</span>
                        <span>100k</span>
                    </span>
                </label>

                <p v-if="isOrgMode && currentCredits" class="text-xs text-blue-700 mb-4">
                    Current plan: {{ formatCredits(currentCredits) }} credits/month
                </p>

                <ul class="space-y-3 mb-8">
                    <li class="flex items-start gap-2">
                        <font-awesome-icon :icon="['fas', 'check']" class="text-green-600 mt-1 flex-shrink-0" />
                        <span class="text-sm text-gray-700">Everything in Free, with more credits</span>
                    </li>
                    <li class="flex items-start gap-2">
                        <font-awesome-icon :icon="['fas', 'check']" class="text-green-600 mt-1 flex-shrink-0" />
                        <span class="text-sm text-gray-700">A larger data-row allowance per data model, with scheduled channel syncs</span>
                    </li>
                    <li class="flex items-start gap-2">
                        <font-awesome-icon :icon="['fas', 'check']" class="text-green-600 mt-1 flex-shrink-0" />
                        <span class="text-sm text-gray-700">Credits roll over month to month</span>
                    </li>
                    <li class="flex items-start gap-2">
                        <font-awesome-icon :icon="['fas', 'check']" class="text-green-600 mt-1 flex-shrink-0" />
                        <span class="text-sm text-gray-700">Extra packs from $9 — credits never expire</span>
                    </li>
                </ul>
                <div class="mt-auto">
                    <button
                        @click="handleChoosePro"
                        :disabled="isProUnchanged"
                        :class="[
                            'w-full px-4 py-3 font-medium rounded-lg transition-colors',
                            isProUnchanged
                                ? 'bg-gray-200 text-gray-500 cursor-not-allowed'
                                : 'bg-blue-600 hover:bg-blue-700 text-white cursor-pointer'
                        ]"
                    >
                        {{ isProUnchanged ? 'Current Plan' : (isOrgMode && isCurrentPro ? 'Update credits' : 'Choose Pro') }}
                    </button>
                </div>
            </div>

            <!-- Enterprise / custom pricing -->
            <div class="bg-white rounded-2xl shadow-sm border border-gray-200 p-8 flex flex-col">
                <h3 class="text-xl font-bold text-gray-900 mb-1">Enterprise</h3>
                <p class="text-sm text-gray-600 mb-6">Custom deployment, onboarding, and support.</p>
                <div class="mb-6">
                    <span class="text-4xl font-bold text-gray-900">Custom</span>
                </div>
                <ul class="space-y-3 mb-8">
                    <li class="flex items-start gap-2">
                        <font-awesome-icon :icon="['fas', 'check']" class="text-green-600 mt-1 flex-shrink-0" />
                        <span class="text-sm text-gray-700">Everything in Pro, scaled to your volume</span>
                    </li>
                    <li class="flex items-start gap-2">
                        <font-awesome-icon :icon="['fas', 'check']" class="text-green-600 mt-1 flex-shrink-0" />
                        <span class="text-sm text-gray-700">Unlimited rows per data model</span>
                    </li>
                    <li class="flex items-start gap-2">
                        <font-awesome-icon :icon="['fas', 'check']" class="text-green-600 mt-1 flex-shrink-0" />
                        <span class="text-sm text-gray-700">SAML 2.0 SSO (Okta, Azure AD, OneLogin, ADFS)</span>
                    </li>
                    <li class="flex items-start gap-2">
                        <font-awesome-icon :icon="['fas', 'check']" class="text-green-600 mt-1 flex-shrink-0" />
                        <span class="text-sm text-gray-700">SSO domain enforcement + JIT provisioning</span>
                    </li>
                    <li class="flex items-start gap-2">
                        <font-awesome-icon :icon="['fas', 'check']" class="text-green-600 mt-1 flex-shrink-0" />
                        <span class="text-sm text-gray-700">Private deployment options</span>
                    </li>
                    <li class="flex items-start gap-2">
                        <font-awesome-icon :icon="['fas', 'check']" class="text-green-600 mt-1 flex-shrink-0" />
                        <span class="text-sm text-gray-700">White-glove onboarding</span>
                    </li>
                    <li class="flex items-start gap-2">
                        <font-awesome-icon :icon="['fas', 'check']" class="text-green-600 mt-1 flex-shrink-0" />
                        <span class="text-sm text-gray-700">Custom feature development</span>
                    </li>
                    <li class="flex items-start gap-2">
                        <font-awesome-icon :icon="['fas', 'check']" class="text-green-600 mt-1 flex-shrink-0" />
                        <span class="text-sm text-gray-700">Direct engineering support</span>
                    </li>
                    <li class="flex items-start gap-2">
                        <font-awesome-icon :icon="['fas', 'check']" class="text-green-600 mt-1 flex-shrink-0" />
                        <span class="text-sm text-gray-700">99.9% uptime SLA</span>
                    </li>
                    <li class="flex items-start gap-2">
                        <font-awesome-icon :icon="['fas', 'check']" class="text-green-600 mt-1 flex-shrink-0" />
                        <span class="text-sm text-gray-700">Custom SLA agreements</span>
                    </li>
                    <li class="flex items-start gap-2">
                        <font-awesome-icon :icon="['fas', 'check']" class="text-green-600 mt-1 flex-shrink-0" />
                        <span class="text-sm text-gray-700">Volume discounts</span>
                    </li>
                </ul>
                <div class="mt-auto">
                    <NuxtLink
                        to="/enterprise-contact"
                        class="w-full inline-block text-center px-4 py-3 bg-purple-600 hover:bg-purple-700 text-white font-medium rounded-lg transition-colors cursor-pointer"
                    >
                        Contact Sales
                    </NuxtLink>
                </div>
            </div>
        </div>

        <!-- Credit estimator -->
        <div class="max-w-4xl mx-auto bg-white rounded-2xl shadow-sm border border-gray-200 p-8 mb-16">
            <h3 class="text-xl font-bold text-gray-900 mb-2">How many credits do you need?</h3>
            <p class="text-sm text-gray-600 mb-6">
                Estimate your team's monthly AI usage. Credits are only consumed by AI-powered actions — data
                syncs, viewing and manual work are always free.
            </p>
            <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div v-for="row in estimatorRows" :key="row.key" class="flex items-center justify-between gap-4">
                    <div>
                        <p class="text-sm font-medium text-gray-800">{{ row.label }}</p>
                        <p class="text-xs text-gray-500">{{ row.credits }} credits each</p>
                    </div>
                    <input
                        v-model.number="estimator[row.key]"
                        type="number"
                        min="0"
                        class="w-24 border border-gray-300 rounded-lg px-3 py-2 text-right"
                    />
                </div>
                <div class="flex items-center justify-between gap-4 bg-blue-50 rounded-lg p-3">
                    <p class="text-sm font-semibold text-blue-800">Estimated monthly credits</p>
                    <p class="text-xl font-bold text-blue-800">{{ formatCredits(estimatedCredits) }}</p>
                </div>
            </div>
            <div class="mt-6 p-4 bg-gray-50 rounded-lg text-sm text-gray-700">
                <span v-if="suggestedCredits <= 5000">
                    That fits comfortably in <strong>Free</strong> — or the 5,000-credit Pro plan (${{ proPriceFor(5000) }}/mo) if you want rollover and more data.
                </span>
                <span v-else>
                    That suggests the <strong>{{ formatCredits(suggestedCredits) }}</strong> Pro plan at
                    <strong>${{ proPriceFor(suggestedCredits) }}/month</strong> ({{ formatCredits(suggestedCredits) }} credits).
                </span>
            </div>
        </div>

        <!-- Per-action credits -->
        <div class="max-w-4xl mx-auto mb-16">
            <h3 class="text-xl font-bold text-gray-900 mb-2 text-center">What actions cost</h3>
            <p class="text-sm text-gray-600 mb-6 text-center">Credits are about 1 cent each; exact rates vary by plan and pack. You only pay when an action succeeds.</p>
            <div class="bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden">
                <table class="w-full text-sm">
                    <thead class="bg-gray-50">
                        <tr class="text-left text-gray-500">
                            <th class="py-3 px-6 font-medium">Action</th>
                            <th class="py-3 px-6 text-right font-medium">Credits</th>
                        </tr>
                    </thead>
                    <tbody class="divide-y divide-gray-100">
                        <tr v-for="action in actionPrices" :key="action.name">
                            <td class="py-3 px-6 text-gray-800">{{ action.name }}</td>
                            <td class="py-3 px-6 text-right font-semibold text-gray-900">{{ action.credits }}</td>
                        </tr>
                    </tbody>
                </table>
            </div>
            <p class="text-xs text-gray-500 mt-3 text-center">
                Prices are per deliverable. Large analyses scale by data size (×1/×2/×3).
            </p>
        </div>

        <!-- Everything included -->
        <div class="max-w-4xl mx-auto mb-16">
            <h3 class="text-xl font-bold text-gray-900 mb-6 text-center">Every plan includes</h3>
            <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                <div v-for="item in includedFeatures" :key="item" class="bg-white rounded-lg border border-gray-200 p-4 flex items-start gap-2">
                    <font-awesome-icon :icon="['fas', 'check-circle']" class="text-green-600 mt-0.5 flex-shrink-0" />
                    <span class="text-sm text-gray-700">{{ item }}</span>
                </div>
            </div>
        </div>

        <!-- FAQ -->
        <div class="max-w-3xl mx-auto">
            <h3 class="text-2xl font-bold text-gray-900 mb-8 text-center">Frequently asked questions</h3>
            <div class="space-y-4">
                <div v-for="faq in faqs" :key="faq.q" class="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
                    <h4 class="font-semibold text-gray-900 mb-2">{{ faq.q }}</h4>
                    <p class="text-sm text-gray-600">{{ faq.a }}</p>
                </div>
            </div>
        </div>
    </div>
</template>

<script setup lang="ts">
import { computed, ref, watch } from 'vue';
import { getAuthToken } from '~/composables/AuthToken';

const props = withDefaults(defineProps<{
    organizationId?: number | null;
    currentTierName?: string | null;
    currentCredits?: number | null;
    initialBillingCycle?: 'monthly' | 'annual';
    showBillingToggle?: boolean;
}>(), {
    organizationId: null,
    currentTierName: null,
    currentCredits: null,
    initialBillingCycle: 'monthly',
    showBillingToggle: true,
});

const emit = defineEmits<{
    (e: 'select-free'): void;
    (e: 'select-pro', payload: { credits: number; billingCycle: 'monthly' | 'annual' }): void;
}>();

const billingPeriod = ref<'monthly' | 'annual'>(props.initialBillingCycle);
const proCredits = ref<number>(
    props.currentCredits && props.currentCredits >= 5000 ? Number(props.currentCredits) : 10000
);

const isOrgMode = computed(() => props.organizationId !== null && props.organizationId !== undefined);
const normalizedTierName = computed(() =>
    (props.currentTierName || '')
        .replace(/^Data Research Analysis\s*/i, '')
        .replace(/\s*Plan$/i, '')
        .trim()
        .toUpperCase()
);
const isCurrentFree = computed(
    () => isOrgMode.value && normalizedTierName.value === 'FREE'
);
const isCurrentPro = computed(
    () => /PRO/.test(normalizedTierName.value) && !/PLUS|ENTERPRISE/.test(normalizedTierName.value)
);
const isProUnchanged = computed(
    () =>
        isCurrentPro.value &&
        props.currentCredits !== null &&
        props.currentCredits !== undefined &&
        Number(props.currentCredits) === Number(proCredits.value)
);

watch(
    () => props.initialBillingCycle,
    (value) => { billingPeriod.value = value; }
);
watch(
    () => props.currentCredits,
    (value) => {
        if (value !== null && value !== undefined && Number(value) >= 5000) {
            proCredits.value = Number(value);
        }
    }
);

const PRESETS = [5000, 10000, 25000, 50000, 100000];

function formatCredits(value: number): string {
    return new Intl.NumberFormat('en-US').format(value);
}

function proPriceFor(credits: number): number {
    const units = credits / 1000;
    // Monthly: $9.80 per 1,000 credits. Annual: $94.80 per 1,000 credits
    // ($7.90/month equivalent), matching the Paddle recurring prices.
    const monthly = billingPeriod.value === 'annual' ? units * 7.9 : units * 9.8;
    return Math.round(monthly * 100) / 100;
}

const proPrice = computed(() => proPriceFor(proCredits.value));

const estimatorRows = [
    { key: 'planBuilds', label: 'Paid media plan builds', credits: 500 },
    { key: 'deckExports', label: 'Client deck (PPTX) exports', credits: 50 },
    { key: 'aiAnalyses', label: 'AI analyses', credits: 10 },
    { key: 'aiInsights', label: 'AI insights runs', credits: 5 },
    { key: 'attribution', label: 'Attribution model runs', credits: 25 },
    { key: 'chatMessages', label: 'Plan / model chat messages', credits: 2 },
    { key: 'dashboards', label: 'Auto-generated dashboards', credits: 30 },
] as const;

const estimator = ref<Record<string, number>>({
    planBuilds: 5,
    deckExports: 2,
    aiAnalyses: 20,
    aiInsights: 50,
    attribution: 2,
    chatMessages: 50,
    dashboards: 4,
});

const estimatedCredits = computed(() => {
    let total = 0;
    for (const row of estimatorRows) {
        total += (estimator.value[row.key] || 0) * row.credits;
    }
    return total;
});

const suggestedCredits = computed(() => {
    const total = estimatedCredits.value;
    return PRESETS.find((p) => p >= total) ?? 100000;
});

const actionPrices = [
    { name: 'Paid media plan build (full plan, 18 steps)', credits: 500 },
    { name: 'Client presentation deck (PPTX) export', credits: 50 },
    { name: 'AI analysis (from your data models)', credits: 10 },
    { name: 'Attribution model run', credits: 25 },
    { name: 'AI insights run', credits: 5 },
    { name: 'AI report generation', credits: 15 },
    { name: 'Auto-generated dashboard', credits: 30 },
    { name: 'One-click AI data model generation', credits: 20 },
    { name: 'AI model analysis (by size)', credits: '15 / 30 / 60' },
    { name: 'Plan or model chat message', credits: 2 },
    { name: 'Web search grounding', credits: 1 },
];

const includedFeatures = [
    'Unlimited team members',
    'Unlimited projects, channels and dashboards',
    'Paid media plan studio (basic + advanced + AI chat)',
    'Data models, reports and AI insights',
    'Engineering connectors',
    'Deck/PPT and XLSX exports',
    'Data quality checks and AI remediation',
    'Marketing intelligence overview',
];

const faqs = [
    {
        q: 'What are credits?',
        a: 'Credits are the meter for AI-powered actions like building a paid media plan, running an AI analysis or exporting a client deck. Manual work, viewing data, connecting channels and syncs are always free.',
    },
    {
        q: 'What happens when I run out of credits?',
        a: 'Actions pause until you top up. Buy a credit pack ($9 / $40 / $70) — packs never expire — or increase your monthly Pro credits. You are never billed for a failed action.',
    },
    {
        q: 'Do credits roll over?',
        a: 'Yes. Monthly Pro credits roll over to the next month, and purchased packs roll over indefinitely. Free plan credits reset at the end of each month.',
    },
    {
        q: 'Can I change my plan or cancel?',
        a: 'Anytime. Pro is billed monthly or annually and can be changed or cancelled from the billing page. See our refund and cancellation policies for details.',
    },
    {
        q: 'Is there a free trial?',
        a: 'The Free plan is a full trial — every feature is unlocked. You start with 1,000 credits in your first month (500 monthly credits plus a one-time 500-credit onboarding bonus), then 500 credits each month, so you can build your first plan and still export, analyse, and chat about it without a card.',
    },
];

function handleSelectFree() {
    if (isCurrentFree.value) return;
    if (isOrgMode.value) {
        emit('select-free');
        return;
    }
    if (import.meta.client) {
        window.location.href = '/register?plan=free';
    }
}

function handleChoosePro() {
    if (isProUnchanged.value) return;
    if (isOrgMode.value) {
        emit('select-pro', { credits: proCredits.value, billingCycle: billingPeriod.value });
        return;
    }
    if (import.meta.client) {
        const params = new URLSearchParams({
            plan: 'professional',
            cycle: billingPeriod.value,
            credits: String(proCredits.value),
        });
        const token = getAuthToken();
        window.location.href = token ? `/billing?${params.toString()}` : `/register?${params.toString()}`;
    }
}
</script>
