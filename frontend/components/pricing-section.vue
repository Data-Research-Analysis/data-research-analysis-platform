<script setup lang="ts">
import { getAuthToken } from '~/composables/AuthToken';
import { usePaddle } from '~/composables/usePaddle';
import { useOrganizationsStore } from '~/stores/organizations';

const props = defineProps<{ hideFaq?: boolean }>();

const config = useRuntimeConfig();
const paddle = usePaddle();
const organizationsStore = useOrganizationsStore();

const billingPeriod = ref<'monthly' | 'annual'>('annual');
const proCredits = ref(10000);

const PRESETS = [5000, 10000, 25000, 50000, 100000];

const formatCredits = (value: number): string => {
    return new Intl.NumberFormat('en-US').format(value);
};

const proPriceFor = (credits: number): number => {
    const monthly = Math.round((credits / 1000) * 9.8);
    return billingPeriod.value === 'annual' ? Math.round(monthly * 0.8) : monthly;
};

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
];

const handleCTAClick = async (plan: 'free' | 'pro') => {
    if (plan === 'free') {
        window.location.href = '/register?plan=free';
        return;
    }

    const params = new URLSearchParams({
        plan: 'professional',
        cycle: billingPeriod.value,
        credits: String(proCredits.value),
    });

    const token = getAuthToken();
    if (!token) {
        window.location.href = `/register?${params.toString()}`;
        return;
    }

    // Signed in: open Paddle directly with the selected credit volume.
    try {
        if (!organizationsStore.currentOrganization) {
            await organizationsStore.retrieveOrganizations();
        }
        const organizationId = organizationsStore.currentOrganization?.id;
        if (!organizationId) {
            window.location.href = `/billing?${params.toString()}`;
            return;
        }

        const response = await $fetch<{ success: boolean; data: Array<{ id: number; tier_name: string }> }>(
            `${config.public.apiBase}/subscription/tiers`
        );
        const tier = (response.data || []).find(t => t.tier_name.toLowerCase() === 'professional');
        if (!tier) {
            window.location.href = `/billing?${params.toString()}`;
            return;
        }

        await paddle.openCheckout(
            tier.id,
            billingPeriod.value,
            organizationId,
            undefined,
            undefined,
            proCredits.value
        );
    } catch (error) {
        console.error('Pro checkout failed:', error);
        window.location.href = `/billing?${params.toString()}`;
    }
};
</script>

<template>
    <section class="py-10 bg-primary-blue-100">
        <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <!-- Header -->
            <div class="text-center mb-12">
                <h2 class="text-4xl font-bold text-white mb-4">
                    Simple, Transparent Pricing
                </h2>
                <p class="text-xl text-white/90 max-w-3xl mx-auto mb-8">
                    One product, every tool on every plan. Pay only for what your team actually runs.
                </p>

                <!-- Billing Toggle -->
                <div class="flex items-center justify-center gap-4 mb-2">
                    <span
                        :class="billingPeriod === 'monthly' ? 'text-white font-semibold' : 'text-white/70'"
                        class="text-lg"
                    >
                        Monthly
                    </span>
                    <button
                        @click="billingPeriod = billingPeriod === 'monthly' ? 'annual' : 'monthly'"
                        class="relative inline-flex h-8 w-16 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-white focus:ring-offset-2 focus:ring-offset-primary-blue-100"
                        :class="billingPeriod === 'annual' ? 'bg-white' : 'bg-white/30'"
                        role="switch"
                        :aria-checked="billingPeriod === 'annual'"
                    >
                        <span
                            class="pointer-events-none inline-block h-7 w-7 transform rounded-full shadow ring-0 transition duration-200 ease-in-out"
                            :class="billingPeriod === 'annual' ? 'translate-x-8 bg-primary-blue-100' : 'translate-x-0 bg-white'"
                        ></span>
                    </button>
                    <span
                        :class="billingPeriod === 'annual' ? 'text-white font-semibold' : 'text-white/70'"
                        class="text-lg"
                    >
                        Annual
                    </span>
                </div>
                <p v-if="billingPeriod === 'annual'" class="text-sm text-white font-medium">
                    Save 20% with annual billing
                </p>
            </div>

            <!-- Plan cards -->
            <div class="grid grid-cols-1 lg:grid-cols-3 gap-8 max-w-6xl mx-auto mb-14">
                <div class="relative flex flex-col bg-white rounded-2xl shadow-lg border-2 border-gray-200 p-8">
                    <h3 class="text-2xl font-bold text-gray-900 mb-1">Free</h3>
                    <p class="text-sm text-gray-600 mb-6">Try the whole product, no card required.</p>
                    <div class="mb-6">
                        <span class="text-5xl font-extrabold text-gray-900">$0</span>
                        <span class="text-gray-600">/month</span>
                    </div>
                    <ul class="space-y-3 mb-8">
                        <li class="flex items-start gap-2">
                            <font-awesome-icon :icon="['fas', 'check']" class="w-5 h-5 text-green-600 flex-shrink-0 mt-0.5" />
                            <span class="text-sm text-gray-700"><strong>500 credits</strong> every month</span>
                        </li>
                        <li class="flex items-start gap-2">
                            <font-awesome-icon :icon="['fas', 'check']" class="w-5 h-5 text-green-600 flex-shrink-0 mt-0.5" />
                            <span class="text-sm text-gray-700">Every feature — plan studio, AI analysis, data models, dashboards, reports, AI insights</span>
                        </li>
                        <li class="flex items-start gap-2">
                            <font-awesome-icon :icon="['fas', 'check']" class="w-5 h-5 text-green-600 flex-shrink-0 mt-0.5" />
                            <span class="text-sm text-gray-700">Unlimited team members</span>
                        </li>
                        <li class="flex items-start gap-2">
                            <font-awesome-icon :icon="['fas', 'check']" class="w-5 h-5 text-green-600 flex-shrink-0 mt-0.5" />
                            <span class="text-sm text-gray-700">~100k rows of data, daily channel syncs</span>
                        </li>
                    </ul>
                    <div class="mt-auto">
                        <button
                            @click="handleCTAClick('free')"
                            class="w-full py-3 px-6 rounded-lg font-semibold text-center transition-all duration-200 transform hover:scale-105 cursor-pointer bg-gradient-to-r from-green-500 to-green-600 hover:from-green-600 hover:to-green-700 text-white shadow-lg"
                        >
                            Get started free
                        </button>
                    </div>
                </div>

                <div class="relative flex flex-col bg-white rounded-2xl shadow-lg border-2 border-blue-500 ring-2 ring-blue-500 p-8">
                    <div class="absolute -top-4 left-1/2 transform -translate-x-1/2 bg-gradient-to-r from-blue-600 to-blue-700 text-white px-4 py-1 rounded-full text-sm font-bold shadow-lg">
                        Most Popular
                    </div>
                    <h3 class="text-2xl font-bold text-gray-900 mb-1">Pro</h3>
                    <p class="text-sm text-gray-600 mb-6">Credits for the whole team, scaled to your volume.</p>
                    <div class="mb-1">
                        <span class="text-5xl font-extrabold text-gray-900">${{ proPrice }}</span>
                        <span class="text-gray-600">/month</span>
                    </div>
                    <p v-if="billingPeriod === 'annual'" class="text-xs text-green-600 font-medium mb-4">
                        Billed annually — save 20%
                    </p>
                    <p v-else class="text-xs text-gray-500 mb-4">Billed monthly</p>

                    <label class="block mb-8">
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

                    <ul class="space-y-3 mb-8">
                        <li class="flex items-start gap-2">
                            <font-awesome-icon :icon="['fas', 'check']" class="w-5 h-5 text-green-600 flex-shrink-0 mt-0.5" />
                            <span class="text-sm text-gray-700">Everything in Free, with more credits</span>
                        </li>
                        <li class="flex items-start gap-2">
                            <font-awesome-icon :icon="['fas', 'check']" class="w-5 h-5 text-green-600 flex-shrink-0 mt-0.5" />
                            <span class="text-sm text-gray-700">1M–100M rows, hourly channel syncs at 25k+ credits</span>
                        </li>
                        <li class="flex items-start gap-2">
                            <font-awesome-icon :icon="['fas', 'check']" class="w-5 h-5 text-green-600 flex-shrink-0 mt-0.5" />
                            <span class="text-sm text-gray-700">Credits roll over month to month</span>
                        </li>
                        <li class="flex items-start gap-2">
                            <font-awesome-icon :icon="['fas', 'check']" class="w-5 h-5 text-green-600 flex-shrink-0 mt-0.5" />
                            <span class="text-sm text-gray-700">Extra packs from $9 — credits never expire</span>
                        </li>
                    </ul>
                    <div class="mt-auto">
                        <button
                            @click="handleCTAClick('pro')"
                            class="w-full py-3 px-6 rounded-lg font-semibold text-center transition-all duration-200 transform hover:scale-105 cursor-pointer bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800 text-white shadow-lg"
                        >
                            Choose Pro
                        </button>
                    </div>
                </div>

                <div class="relative flex flex-col bg-white rounded-2xl shadow-lg border-2 border-gray-200 p-8">
                    <h3 class="text-2xl font-bold text-gray-900 mb-1">Enterprise</h3>
                    <p class="text-sm text-gray-600 mb-6">Custom deployment, onboarding, and support.</p>
                    <div class="mb-6">
                        <span class="text-4xl font-extrabold text-gray-900">Custom</span>
                    </div>
                    <ul class="space-y-3 mb-8">
                        <li class="flex items-start gap-2">
                            <font-awesome-icon :icon="['fas', 'check']" class="w-5 h-5 text-green-600 flex-shrink-0 mt-0.5" />
                            <span class="text-sm text-gray-700">Everything in Pro, scaled to your volume</span>
                        </li>
                        <li class="flex items-start gap-2">
                            <font-awesome-icon :icon="['fas', 'check']" class="w-5 h-5 text-green-600 flex-shrink-0 mt-0.5" />
                            <span class="text-sm text-gray-700">SAML 2.0 SSO and private deployment options</span>
                        </li>
                        <li class="flex items-start gap-2">
                            <font-awesome-icon :icon="['fas', 'check']" class="w-5 h-5 text-green-600 flex-shrink-0 mt-0.5" />
                            <span class="text-sm text-gray-700">White-glove onboarding and SLAs</span>
                        </li>
                    </ul>
                    <div class="mt-auto">
                        <NuxtLink
                            to="/enterprise-contact"
                            class="w-full inline-block text-center py-3 px-6 rounded-lg font-semibold transition-all duration-200 transform hover:scale-105 cursor-pointer bg-gradient-to-r from-purple-600 to-purple-700 hover:from-purple-700 hover:to-purple-800 text-white shadow-lg"
                        >
                            Contact Sales
                        </NuxtLink>
                    </div>
                </div>
            </div>

            <!-- Credit estimator -->
            <div class="max-w-4xl mx-auto bg-white rounded-2xl shadow-lg border border-gray-200 p-8 mb-14">
                <h3 class="text-xl font-bold text-gray-900 mb-2">How many credits do you need?</h3>
                <p class="text-sm text-gray-600 mb-6">
                    Estimate your team's monthly AI usage. Credits are only consumed by AI-powered actions — data syncs, viewing and manual work are always free.
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

            <!-- What actions cost -->
            <div class="max-w-4xl mx-auto mb-14">
                <h3 class="text-2xl font-bold text-white mb-2 text-center">What actions cost</h3>
                <p class="text-sm text-blue-100 mb-6 text-center">1 credit = $0.01. You only pay when an action succeeds.</p>
                <div class="bg-white rounded-2xl shadow-lg border border-gray-200 overflow-hidden">
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
                <p class="text-xs text-blue-100/80 mt-3 text-center">
                    Prices are per deliverable. Large analyses scale by data size (×1/×2/×3).
                </p>
            </div>

            <!-- Everything included -->
            <div class="max-w-4xl mx-auto mb-14">
                <h3 class="text-2xl font-bold text-white mb-6 text-center">Every plan includes</h3>
                <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                    <div v-for="item in includedFeatures" :key="item" class="bg-white/10 ring-1 ring-white/25 backdrop-blur rounded-lg p-4 flex items-start gap-2">
                        <font-awesome-icon :icon="['fas', 'check-circle']" class="text-green-300 mt-0.5 flex-shrink-0" />
                        <span class="text-sm text-white">{{ item }}</span>
                    </div>
                </div>
            </div>

            <!-- FAQ -->
            <div v-if="!props.hideFaq" class="max-w-3xl mx-auto">
                <h3 class="text-2xl font-bold text-white mb-8 text-center">Frequently asked questions</h3>
                <div class="space-y-4">
                    <div v-for="faq in faqs" :key="faq.q" class="bg-white rounded-lg shadow-lg border border-gray-200 p-6">
                        <h4 class="font-semibold text-gray-900 mb-2">{{ faq.q }}</h4>
                        <p class="text-sm text-gray-600">{{ faq.a }}</p>
                    </div>
                </div>
            </div>
        </div>
    </section>
</template>
