<script setup lang="ts">
const billingPeriod = ref<'monthly' | 'annual'>('annual');

interface TierFeatures {
    rows: string;
    projects: number | string;
    dataSources: number | string;
    dashboards: number | string;
    dataModelsPerSource: number | string;
    aiGenerations: number | string;
    teamMembers: number | string;
}

interface PricingTier {
    name: string;
    monthlyPrice: number;
    annualPrice: number;
    popular: boolean;
    features: TierFeatures;
    additionalFeatures: string[];
}

const tiers: PricingTier[] = [
    {
        name: 'FREE',
        monthlyPrice: 0,
        annualPrice: 0,
        popular: false,
        features: {
            rows: '50K',
            projects: 3,
            dataSources: 5,
            dashboards: 5,
            dataModelsPerSource: 3,
            aiGenerations: 10,
            teamMembers: 'Solo Only'
        },
        additionalFeatures: [
            'AI Data Modeler',
            'AI Insights',
            'Marketing Attribution',
            'Marketing Hub Dashboard',
            'Campaign Management',
            'Scheduled Data Refreshes',
            '3 Public Dashboard Links',
            'PNG Export'
        ]
    },
    {
        name: 'PROFESSIONAL',
        monthlyPrice: 399,
        annualPrice: 3829,
        popular: true,
        features: {
            rows: '100M',
            projects: 'Unlimited',
            dataSources: 'Unlimited',
            dashboards: 'Unlimited',
            dataModelsPerSource: 'Unlimited',
            aiGenerations: 'Unlimited',
            teamMembers: 100
        },
        additionalFeatures: [
            'All FREE features',
            'Team Collaboration + RBAC',
            'Advanced Attribution (5 models)',
            'CSV/Excel Export',
            'Custom Dashboard Themes',
            'Slack/Teams Integration',
            'Dashboard Embedding',
            'SSO/SAML',
            'Custom Branding',
            'Audit Logs',
            'IP Whitelisting',
            'Priority Support (24/7)',
            'Dedicated Account Manager',
            'Unlimited Public Links'
        ]
    },
    {
        name: 'ENTERPRISE',
        monthlyPrice: 2499,
        annualPrice: 23990,
        popular: false,
        features: {
            rows: 'Unlimited',
            projects: 'Unlimited',
            dataSources: 'Unlimited',
            dashboards: 'Unlimited',
            dataModelsPerSource: 'Unlimited',
            aiGenerations: 'Unlimited',
            teamMembers: '100+'
        },
        additionalFeatures: [
            'All PROFESSIONAL features',
            'Multi-Tenancy',
            'Dedicated Instance',
            '99.9% Uptime SLA',
            'On-Premise Deployment',
            'White-Glove Onboarding',
            'Custom Feature Development',
            'Quarterly Business Reviews',
            'Direct Engineering Support',
            'Volume Discounts'
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

const handleCTAClick = async (tierName: string) => {
    if (tierName === 'ENTERPRISE') {
        // Navigate to enterprise contact page
        navigateTo('/enterprise-contact');
        return;
    }
    
    if (tierName === 'PROFESSIONAL') {
        const result = await ($swal as any).fire({
            title: 'Paid Plans Coming Soon!',
            html: `<p>Paid plans are not yet available, but we'll register you a <strong>free account</strong> and notify you as soon as <strong>Pro</strong> plans launch.</p>`,
            icon: 'info',
            showCancelButton: true,
            confirmButtonText: 'Register Free Account',
            cancelButtonText: 'Stay Here',
            confirmButtonColor: '#1e3a5f',
        });
        if (!result.isConfirmed) return;
    }
    const planMap: Record<string, string> = {
        'FREE': 'free',
        'PROFESSIONAL': 'professional',
        'ENTERPRISE': 'enterprise'
    };
    navigateTo(`/register?plan=${planMap[tierName]}`);
};

const formatValue = (value: number | string): string => {
    if (typeof value === 'string') return value;
    if (value === -1 || value === null) return 'Unlimited';
    return value.toLocaleString();
};
</script>

<template>
    <section class="py-20 bg-primary-blue-100">
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

            <!-- Pricing Cards Grid -->
            <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-12">
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
                                <font-awesome-icon :icon="['fas', 'database']" class="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" />
                                <span class="text-sm text-gray-700">
                                    <strong>{{ formatValue(tier.features.rows) }}</strong> rows per data model
                                </span>
                            </li>
                            <li class="flex items-start gap-2">
                                <font-awesome-icon :icon="['fas', 'folder']" class="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" />
                                <span class="text-sm text-gray-700">
                                    <strong>{{ formatValue(tier.features.projects) }}</strong> projects
                                </span>
                            </li>
                            <li class="flex items-start gap-2">
                                <font-awesome-icon :icon="['fas', 'plug']" class="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" />
                                <span class="text-sm text-gray-700">
                                    <strong>{{ formatValue(tier.features.dataSources) }}</strong> data sources
                                </span>
                            </li>
                            <li class="flex items-start gap-2">
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
                            class="w-full py-3 px-6 rounded-lg font-semibold text-center transition-all duration-200 transform hover:scale-105 cursor-pointer"
                            :class="tier.name === 'FREE' 
                                ? 'bg-gradient-to-r from-green-500 to-green-600 hover:from-green-600 hover:to-green-700 text-white shadow-lg' 
                                : tier.popular 
                                    ? 'bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800 text-white shadow-lg'
                                    : 'bg-gradient-to-r from-gray-700 to-gray-800 hover:from-gray-800 hover:to-gray-900 text-white shadow-lg'
                            "
                        >
                            {{ tier.name === 'FREE' ? 'Get Free' : tier.name === 'PROFESSIONAL' ? 'Get Pro' : 'Contact Sales' }}
                        </button>
                    </div>
                </div>
            </div>
        </div>
        

    </section>
</template>
