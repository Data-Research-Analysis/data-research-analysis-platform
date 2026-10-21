<script setup lang="ts">
import { usePaddle } from '~/composables/usePaddle';
import { useOrganizationsStore } from '~/stores/organizations';
import { useLoggedInUserStore } from '~/stores/logged_in_user';

const billingPeriod = ref<'monthly' | 'annual'>('annual');

// Get Paddle checkout enabled flag from runtime config (.env)
const config = useRuntimeConfig();
const PADDLE_CHECKOUT_ENABLED = config.public.paddleCheckoutEnabled;

interface TierFeatures {
    projects: number | string;
    dataSources: number | string;
    dashboards: number | string;
    dataModelsPerSource: number | string;
    aiGenerations: number | string;
    planBuilds: number | string;
    teamMembers: number | string;
    advancedTools: boolean;
}

interface PricingTier {
    name: string;
    valueLine: string;
    monthlyPrice: number;
    annualPrice: number;
    popular: boolean;
    features: TierFeatures;
    additionalFeatures: string[];
}

const tiers: PricingTier[] = [
    {
        name: 'FREE',
        valueLine: 'Build your first paid media plan.',
        monthlyPrice: 0,
        annualPrice: 0,
        popular: false,
        features: {
            projects: 3,
            dataSources: 5,
            dashboards: 5,
            dataModelsPerSource: 3,
            aiGenerations: 10,
            planBuilds: 1,
            teamMembers: 'Solo Only',
            advancedTools: false
        },
        additionalFeatures: [
            'Paid media plan builder — Basic mode',
            'Website-to-plan channel recommendations',
            'Campaign tracking against the plan',
            'Attribution reporting',
            'Campaign performance analysis',
            'PNG export'
        ]
    },
    {
        name: 'STARTER',
        valueLine: 'Plan every channel and start tracking results.',
        monthlyPrice: 29,
        annualPrice: 276,
        popular: true,
        features: {
            projects: 10,
            dataSources: 15,
            dashboards: 15,
            dataModelsPerSource: 'Unlimited',
            aiGenerations: 100,
            planBuilds: 3,
            teamMembers: 'Solo Only',
            advancedTools: false
        },
        additionalFeatures: [
            'Everything in Free',
            'Paid media plan builder — Advanced mode',
            'Channel-by-channel budgets and targets',
            'CSV/Excel export',
            'In-app notifications',
            'Email support (48hr)'
        ]
    },
    {
        name: 'PROFESSIONAL',
        valueLine: 'Track campaigns against the plan and prove ROI to the CFO.',
        monthlyPrice: 129,
        annualPrice: 1236,
        popular: false,
        features: {
            projects: 'Unlimited',
            dataSources: 'Unlimited',
            dashboards: 'Unlimited',
            dataModelsPerSource: 'Unlimited',
            aiGenerations: 500,
            planBuilds: 10,
            teamMembers: '2-5',
            advancedTools: true
        },
        additionalFeatures: [
            'Everything in Starter',
            'AI chat plan refinement + strategy deck export',
            'Team collaboration (2-5 users)',
            'Advanced tools: data models, custom dashboards, reports, AI insights',
            'Engineering data connectors',
            'Light branding (logo + colors)',
            'Email support (24hr)'
        ]
    },
    {
        name: 'PROFESSIONAL PLUS',
        valueLine: 'Plan, track, and scale across your whole team.',
        monthlyPrice: 399,
        annualPrice: 3828,
        popular: false,
        features: {
            projects: 'Unlimited',
            dataSources: 'Unlimited',
            dashboards: 'Unlimited',
            dataModelsPerSource: 'Unlimited',
            aiGenerations: 'Unlimited',
            planBuilds: 'Unlimited',
            teamMembers: '6-100',
            advancedTools: true
        },
        additionalFeatures: [
            'Everything in Professional',
            'AI chat plan refinement + strategy deck export',
            'Full team collaboration (6-100 users)',
            'Basic branding (logo + colors)',
            'Priority support (24/7, 4hr SLA)',
            'Dedicated account manager',
            'Quarterly business reviews',
            '99.5% uptime SLA'
        ]
    },
    {
        name: 'ENTERPRISE',
        valueLine: 'Custom deployment, onboarding, and support.',
        monthlyPrice: 0,
        annualPrice: 0,
        popular: false,
        features: {
            projects: 'Unlimited',
            dataSources: 'Unlimited',
            dashboards: 'Unlimited',
            dataModelsPerSource: 'Unlimited',
            aiGenerations: 'Unlimited',
            planBuilds: 'Unlimited',
            teamMembers: '100+',
            advancedTools: true
        },
        additionalFeatures: [
            'Everything in Professional Plus',
            'AI chat plan refinement + strategy deck export',
            'SAML 2.0 SSO (Okta, Azure AD, OneLogin, ADFS)',
            'SSO domain enforcement + JIT provisioning',
            'White-glove onboarding',
            'Custom feature development',
            'Direct engineering support',
            '99.9% uptime SLA',
            'Custom SLA agreements',
            'Volume discounts'
        ]
    }
];

const displayPrice = (tier: PricingTier) => {
    if (tier.monthlyPrice === 0) return 0;
    return billingPeriod.value === 'monthly' ? tier.monthlyPrice : Math.round(tier.annualPrice / 12);
};

const displaySavings = (tier: PricingTier) => {
    if (tier.monthlyPrice === 0) return '';
    const monthlyCost = tier.monthlyPrice * 12;
    const savings = monthlyCost - tier.annualPrice;
    return `Save $${savings}/year`;
};

const { $swal } = useNuxtApp();
const paddle = usePaddle();
const orgStore = useOrganizationsStore();
const userStore = useLoggedInUserStore();

// State management
const state = reactive({
    loading: false,
    processingTier: null as string | null
});

// Tier ID mapping (matches actual database IDs in dra_subscription_tiers)
const tierIdMap: Record<string, number> = {
    'FREE': 11,
    'STARTER': 14,
    'PROFESSIONAL': 12,
    'PROFESSIONAL PLUS': 15,
    'ENTERPRISE': 13
};

const handleCTAClick = async (tierName: string) => {
    if (tierName === 'ENTERPRISE') {
        // Navigate to enterprise contact page
        navigateTo('/enterprise-contact');
        return;
    }
    
    // FREE tier - just go to registration
    if (tierName === 'FREE') {
        navigateTo('/register?plan=free&cycle=monthly');
        return;
    }
    
    // Paid plans - check if Paddle checkout is enabled
    if (!PADDLE_CHECKOUT_ENABLED) {
        // Show "coming soon" dialog for paid plans
        const result = await ($swal as any).fire({
            title: 'Paid Plans Coming Soon!',
            html: `<p>Paid plans are not yet available, but we'll register you a <strong>free account</strong> and notify you as soon as paid plans launch.</p>`,
            icon: 'info',
            showCancelButton: true,
            confirmButtonText: 'Register Free Account',
            cancelButtonText: 'Stay Here',
            confirmButtonColor: '#1e3a5f',
        });
        if (result.isConfirmed) {
            const planMap: Record<string, string> = {
                'STARTER': 'starter',
                'PROFESSIONAL': 'professional',
                'PROFESSIONAL PLUS': 'professional_plus',
            };
            navigateTo(`/register?plan=${planMap[tierName]}&cycle=${billingPeriod.value}`);
        }
        return;
    }
    
    // Paid plans - Paddle checkout flow (when enabled)
    // First check if user is logged in
    if (!userStore.loggedInUser) {
        // Not authenticated - redirect to registration with plan selected
        const planMap: Record<string, string> = {
            'STARTER': 'starter',
            'PROFESSIONAL': 'professional',
            'PROFESSIONAL PLUS': 'professional_plus',
        };
        navigateTo(`/register?plan=${planMap[tierName]}&cycle=${billingPeriod.value}`);
        return;
    }
    
    // User is logged in but no organization - show error and suggest creating one
    if (!orgStore.currentOrganization) {
        const result = await ($swal as any).fire({
            icon: 'info',
            title: 'Organization Required',
            html: `<p>You need an organization to subscribe to a paid plan.</p>
                   <p class="mt-2 text-sm text-gray-600">Organizations are created automatically during registration. Please log out and register with a new account, or contact support if you believe this is an error.</p>`,
            confirmButtonText: 'OK',
            confirmButtonColor: '#1e3a5f'
        });
        return;
    }
    
    state.loading = true;
    state.processingTier = tierName;
    
    try {
        const tierId = tierIdMap[tierName];
        
        await paddle.openCheckout(
            tierId,
            billingPeriod.value,
            orgStore.currentOrganization.id
        );
    } catch (error: any) {
        console.error('Subscription error:', error);
        ($swal as any).fire({
            icon: 'error',
            title: 'Subscription Error',
            text: error.message || 'Failed to start subscription process. Please try again.',
            confirmButtonColor: '#1e3a5f'
        });
    } finally {
        state.loading = false;
        state.processingTier = null;
    }
};

const formatValue = (value: number | string): string => {
    if (typeof value === 'string') return value;
    if (value === -1 || value === null) return 'Unlimited';
    return value.toLocaleString();
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
                    Start free. Scale as you grow. No hidden fees. Cancel anytime.
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
                    💰 Save 20% with annual billing
                </p>
            </div>

            <!-- Paid media plan builder callout -->
            <div class="max-w-3xl mx-auto mb-10 rounded-2xl bg-white/10 ring-1 ring-white/25 backdrop-blur p-5 text-left sm:text-center">
                <p class="text-white font-semibold text-lg">Includes the AI paid media plan builder</p>
                <p class="text-sm text-blue-100 mt-1">
                    Enter your website and the AI builds a channel-by-channel paid media plan — where to spend, how much, and what to create — then track how those campaigns perform. Try it free for 24 hours, no account needed.
                </p>
                <p class="text-xs text-blue-100/80 mt-2">
                    Advanced data tools — data models, custom dashboards, reports and AI insights — are included on Professional and above.
                </p>
            </div>

            <!-- Pricing Cards Grid -->
            <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-6 mb-12">
                <div
                    v-for="tier in tiers"
                    :key="tier.name"
                    class="relative flex flex-col bg-white rounded-2xl shadow-lg border-2 transition-all duration-300 hover:shadow-2xl hover:scale-105"
                    :class="tier.popular ? 'border-blue-500 ring-2 ring-blue-500' : 'border-gray-200'"
                >
                    <!-- Popular Badge -->
                    <div
                        v-if="tier.popular"
                        class="absolute -top-4 left-1/2 transform -translate-x-1/2 bg-gradient-to-r from-blue-600 to-blue-700 text-white px-4 py-1 rounded-full text-sm font-bold shadow-lg"
                    >
                        Most Popular
                    </div>

                    <div class="p-6 flex-1 flex flex-col">
                        <!-- Tier Name -->
                        <h3 class="text-2xl font-bold text-gray-900 mb-2">
                            {{ tier.name }}
                        </h3>
                        <p class="text-sm text-gray-500 mb-4">
                            {{ tier.valueLine }}
                        </p>

                        <!-- Price -->
                        <div class="mb-6">
                            <div v-if="tier.name === 'ENTERPRISE'" class="flex flex-col">
                                <span class="text-3xl font-extrabold text-gray-900">
                                    Custom Pricing
                                </span>
                                <span class="text-sm text-gray-600 mt-2">Tailored to your needs</span>
                            </div>
                            <div v-else class="flex items-baseline gap-2">
                                <span class="text-5xl font-extrabold text-gray-900">
                                    ${{ displayPrice(tier) }}
                                </span>
                                <span class="text-gray-600">/month</span>
                            </div>
                            <p v-if="tier.name !== 'ENTERPRISE' && billingPeriod === 'annual' && tier.monthlyPrice > 0" class="text-sm text-gray-500 mt-1">
                                <span class="line-through">${{ tier.monthlyPrice }}/month</span>
                            </p>
                            <p v-if="tier.name !== 'ENTERPRISE' && billingPeriod === 'annual' && tier.monthlyPrice > 0" class="text-sm text-green-600 font-medium mt-1">
                                {{ displaySavings(tier) }}
                            </p>
                            <p v-if="tier.name !== 'ENTERPRISE' && billingPeriod === 'annual' && tier.monthlyPrice > 0" class="text-xs text-gray-500 mt-1">
                                Billed annually at ${{ tier.annualPrice }}
                            </p>
                        </div>

                        <!-- Core Features List -->
                        <ul class="space-y-3 mb-6 flex-1">
                            <li class="flex items-start gap-2">
                                <font-awesome-icon :icon="['fas', 'bullseye']" class="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" />
                                <span class="text-sm text-gray-700">
                                    <strong>{{ formatValue(tier.features.planBuilds) }}</strong> paid media plan builds/month
                                </span>
                            </li>
                            <li class="flex items-start gap-2">
                                <font-awesome-icon :icon="['fas', 'plug']" class="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" />
                                <span class="text-sm text-gray-700">
                                    <strong>{{ formatValue(tier.features.dataSources) }}</strong> channels
                                </span>
                            </li>
                            <li class="flex items-start gap-2">
                                <font-awesome-icon :icon="['fas', 'folder']" class="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" />
                                <span class="text-sm text-gray-700">
                                    <strong>{{ formatValue(tier.features.projects) }}</strong> projects
                                </span>
                            </li>
                            <li v-if="tier.features.advancedTools" class="flex items-start gap-2">
                                <font-awesome-icon :icon="['fas', 'chart-line']" class="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" />
                                <span class="text-sm text-gray-700">
                                    <strong>{{ formatValue(tier.features.dashboards) }}</strong> dashboards
                                </span>
                            </li>
                            <li class="flex items-start gap-2">
                                <font-awesome-icon :icon="['fas', 'brain']" class="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" />
                                <span class="text-sm text-gray-700">
                                    <strong>{{ formatValue(tier.features.aiGenerations) }}</strong> AI generations/month
                                </span>
                            </li>
                            <li class="flex items-start gap-2">
                                <font-awesome-icon :icon="['fas', 'users']" class="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" />
                                <span class="text-sm text-gray-700">
                                    <strong>{{ formatValue(tier.features.teamMembers) }}</strong> sub-users
                                </span>
                            </li>
                        </ul>

                        <!-- Additional Features -->
                        <div class="border-t border-gray-200 pt-4 mb-6">
                            <p class="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">
                                Key Features
                            </p>
                            <ul class="space-y-2">
                                <li
                                    v-for="(feature, idx) in tier.additionalFeatures"
                                    :key="idx"
                                    class="flex items-start gap-2"
                                >
                                    <font-awesome-icon :icon="['fas', 'check']" class="w-4 h-4 text-green-500 flex-shrink-0 mt-0.5" />
                                    <span class="text-xs text-gray-600">{{ feature }}</span>
                                </li>
                            </ul>
                        </div>

                        <!-- CTA Button -->
                        <button
                            @click="handleCTAClick(tier.name)"
                            :disabled="state.loading && state.processingTier === tier.name"
                            class="w-full py-3 px-6 rounded-lg font-semibold text-center transition-all duration-200 transform hover:scale-105 cursor-pointer disabled:opacity-70 disabled:cursor-not-allowed disabled:transform-none"
                            :class="tier.name === 'FREE' 
                                ? 'bg-gradient-to-r from-green-500 to-green-600 hover:from-green-600 hover:to-green-700 text-white shadow-lg' 
                                : tier.popular 
                                    ? 'bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800 text-white shadow-lg'
                                    : 'bg-gradient-to-r from-gray-700 to-gray-800 hover:from-gray-800 hover:to-gray-900 text-white shadow-lg'
                            "
                        >
                            <span v-if="state.loading && state.processingTier === tier.name" class="flex items-center justify-center gap-2">
                                <font-awesome-icon :icon="['fas', 'spinner']" class="animate-spin" />
                                Processing...
                            </span>
                            <span v-else>
                                {{ tier.name === 'FREE' ? 'Get Free' : tier.name === 'STARTER' ? 'Get Starter' : tier.name === 'PROFESSIONAL' ? 'Get Pro' : tier.name === 'PROFESSIONAL PLUS' ? 'Get Pro Plus' : 'Contact Sales' }}
                            </span>
                        </button>
                    </div>
                </div>
            </div>
        </div>
        

    </section>
</template>
