<template>
    <div class="bg-white border border-gray-200 rounded-lg p-6 shadow-sm">
        <div class="flex items-center justify-between mb-6">
            <div>
                <h3 class="text-lg font-semibold text-gray-900">Subscription & Usage</h3>
                <p class="text-sm text-gray-500 mt-1">Current plan and resource limits</p>
            </div>
            <div class="flex items-center gap-2">
                <span 
                    :class="[
                        'px-3 py-1.5 rounded-full text-sm font-medium',
                        tierColor
                    ]"
                >
                    {{ tierName }}
                </span>
                <button 
                    v-if="isFree || isProfessional"
                    @click="handleUpgrade"
                    class="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm font-medium transition-colors cursor-pointer"
                >
                    {{ isFree ? (PADDLE_CHECKOUT_ENABLED ? 'Upgrade Now' : 'View Plans') : 'View Plans' }}
                </button>
            </div>
        </div>

        <!-- Usage Stats Grid -->
        <div class="space-y-4">
            <!-- Projects -->
            <UsageMeter
                label="Projects"
                :current="usageStats?.projectCount || 0"
                :limit="usageStats?.maxProjects"
                icon="fas fa-folder"
            />

            <!-- Data Sources -->
            <UsageMeter
                label="Data Sources"
                :current="usageStats?.dataSourceCount || 0"
                :limit="usageStats?.maxDataSources"
                icon="fas fa-database"
                helpText="per project"
            />

            <!-- Dashboards -->
            <UsageMeter
                label="Dashboards"
                :current="usageStats?.dashboardCount || 0"
                :limit="usageStats?.maxDashboards"
                icon="fas fa-chart-line"
            />

            <!-- AI Generations -->
            <UsageMeter
                label="AI Generations"
                :current="usageStats?.aiGenerationsUsed || 0"
                :limit="usageStats?.aiGenerationsPerMonth"
                icon="fas fa-robot"
                helpText="this month"
            />

            <!-- Row Limit -->
            <div class="pt-4 border-t border-gray-200">
                <div class="flex items-center gap-2 mb-2">
                    <font-awesome-icon :icon="['fas', 'table']" class="text-purple-600" />
                    <span class="text-sm font-medium text-gray-700">Rows per Data Model</span>
                </div>
                <div class="text-2xl font-bold text-gray-900">
                    {{ formatNumber(usageStats?.rowLimit) }}
                </div>
            </div>
        </div>

        <!-- Grace Period Warning -->
        <div v-if="subscription?.grace_period_ends_at && !subscription?.cancelled_at" class="mt-6 bg-red-50 border border-red-200 rounded-lg p-4">
            <div class="flex items-start gap-3">
                <font-awesome-icon :icon="['fas', 'triangle-exclamation']" class="text-red-500 text-xl mt-0.5 flex-shrink-0" />
                <div class="flex-1">
                    <h4 class="font-semibold text-red-900 mb-1">Payment Failed</h4>
                    <p class="text-sm text-red-700 mb-2">
                        {{ daysRemainingInGracePeriod }} days remaining to update payment
                    </p>
                    <button 
                        @click="navigateTo('/billing')"
                        class="px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg text-sm font-medium transition-colors cursor-pointer"
                    >
                        Update Payment Method
                    </button>
                </div>
            </div>
        </div>
        
        <!-- Billing Actions -->
        <div class="mt-6 pt-6 border-t border-gray-200">
            <div class="flex flex-col gap-3">
                <!-- Upgrade Button (for FREE and STARTER tiers) -->
                <button
                    v-if="showUpgradeButton"
                    @click="handleUpgrade"
                    class="w-full px-4 py-2.5 bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800 text-white rounded-lg text-sm font-medium transition-all transform hover:scale-[1.02] cursor-pointer"
                >
                    <font-awesome-icon :icon="['fas', 'arrow-up']" class="mr-2" />
                    Upgrade Plan
                </button>
                
                <!-- Manage Subscription Button (for paid tiers) -->
                <button
                    v-if="subscription?.paddle_subscription_id"
                    @click="navigateTo('/billing')"
                    class="w-full px-4 py-2.5 bg-gray-100 hover:bg-gray-200 text-gray-800 rounded-lg text-sm font-medium transition-colors cursor-pointer"
                >
                    <font-awesome-icon :icon="['fas', 'gear']" class="mr-2" />
                    Manage Subscription
                </button>
                
                <!-- View All Plans Link -->
                <NuxtLink
                    :to="orgStore.currentOrganization?.id ? `/pricing?orgId=${orgStore.currentOrganization.id}` : '/pricing'"
                    class="text-center text-sm text-primary-blue-100 hover:underline mt-1 cursor-pointer"
                >
                    View All Plans
                </NuxtLink>
            </div>
        </div>
        
        <!-- Upgrade Banner for FREE users -->
        <div v-if="isFree && !subscription?.paddle_subscription_id" class="mt-6 bg-gradient-to-r from-blue-50 to-purple-50 border border-blue-200 rounded-lg p-4">
            <div class="flex items-start gap-3">
                <font-awesome-icon :icon="['fas', 'star']" class="text-blue-600 text-xl mt-0.5" />
                <div class="flex-1">
                    <h4 class="font-semibold text-gray-900 mb-1">Upgrade to {{ suggestedUpgradeTier }}</h4>
                    <p class="text-sm text-gray-600 mb-3">
                        Get more projects, data sources, dashboards, AI generations, and increased row limits.
                    </p>
                    <button 
                        @click="handleUpgrade"
                        class="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm font-medium transition-colors cursor-pointer"
                    >
                        {{ PADDLE_CHECKOUT_ENABLED ? 'Upgrade Now' : 'View Pricing' }}
                    </button>
                </div>
            </div>
        </div>
    </div>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import { useSubscriptionStore } from '~/stores/subscription';
import { useTierLimits } from '~/composables/useTierLimits';
import { usePaddle } from '~/composables/usePaddle';
import { useOrganizationsStore } from '~/stores/organizations';

const subscriptionStore = useSubscriptionStore();
const { currentTier, isFree, isProfessional, isEnterprise, usageStats } = useTierLimits();
const paddle = usePaddle();
const orgStore = useOrganizationsStore();
const config = useRuntimeConfig();

const PADDLE_CHECKOUT_ENABLED = config.public.paddleCheckoutEnabled;

// Tier ID mapping (matches actual database IDs in dra_subscription_tiers)
const tierIdMap: Record<string, number> = {
    'FREE': 11,
    'STARTER': 14,
    'PROFESSIONAL': 12,
    'PROFESSIONAL PLUS': 15,
    'ENTERPRISE': 13
};

// Get subscription data to check for grace period and Paddle subscription ID
const subscription = computed(() => subscriptionStore.subscriptionDetails);

// Show upgrade button for FREE and STARTER tiers
const showUpgradeButton = computed(() => {
    const tier = currentTier.value;
    return tier === 'FREE' || tier === 'STARTER';
});

// Calculate days remaining in grace period
const daysRemainingInGracePeriod = computed(() => {
    if (!subscription.value?.grace_period_ends_at) return 0;
    
    const now = new Date();
    const gracePeriodEnd = new Date(subscription.value.grace_period_ends_at);
    const diffTime = gracePeriodEnd.getTime() - now.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    
    return Math.max(0, diffDays);
});

// Determine which tier to suggest for upgrade based on current tier
const suggestedUpgradeTier = computed(() => {
    const tier = currentTier.value.toUpperCase();
    if (tier === 'FREE') return 'STARTER';
    if (tier === 'STARTER') return 'PROFESSIONAL';
    if (tier === 'PROFESSIONAL') return 'PROFESSIONAL PLUS';
    return 'PROFESSIONAL'; // fallback
});

async function handleUpgrade() {
    const { $swal } = useNuxtApp() as any;
    
    // Check if Paddle checkout is enabled
    if (!PADDLE_CHECKOUT_ENABLED) {
        $swal.fire({
            title: 'Coming Soon!',
            text: 'Paid plans are coming soon. We will notify you when they are available.',
            icon: 'info',
            confirmButtonText: 'Got it',
            confirmButtonColor: '#3b82f6',
        });
        return;
    }
    
    // Check if user has an organization
    if (!orgStore.currentOrganization) {
        $swal.fire({
            title: 'Organization Required',
            text: 'You need an organization to subscribe to a paid plan.',
            icon: 'info',
            confirmButtonText: 'Got it',
            confirmButtonColor: '#3b82f6',
        });
        return;
    }
    
    // FIXED: Redirect to pricing page with orgId to use upgrade flow
    // This prevents creating duplicate subscriptions for users with existing Paddle subscriptions
    const orgId = orgStore.currentOrganization.id;
    navigateTo(`/pricing?orgId=${orgId}`);
}

// Legacy function name kept for compatibility
const handleComingSoon = handleUpgrade;

const tierName = computed(() => {
    const name = currentTier.value;
    return name.charAt(0).toUpperCase() + name.slice(1).toLowerCase();
});

const tierColor = computed(() => {
    if (isFree.value) return 'bg-gray-100 text-gray-800';
    if (isProfessional.value) return 'bg-blue-100 text-blue-800';
    if (isEnterprise.value) return 'bg-purple-100 text-purple-800';
    return 'bg-gray-100 text-gray-800';
});

function formatNumber(num: number | null | undefined): string {
    if (num === null || num === undefined) return 'Unlimited';
    if (num === -1) return 'Unlimited';
    if (num >= 1000000) return `${(num / 1000000).toFixed(0)}M`;
    if (num >= 1000) return `${(num / 1000).toFixed(0)}K`;
    return num.toString();
}
</script>
