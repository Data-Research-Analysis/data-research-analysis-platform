<template>
    <div v-if="shouldShowBanner" class="relative bg-gradient-to-r from-purple-600 to-indigo-600 shadow-lg">
        <div class="max-w-7xl mx-auto py-3 px-3 sm:px-6 lg:px-8">
            <div class="flex items-center justify-between flex-wrap">
                <div class="w-0 flex-1 flex items-center">
                    <span class="flex p-2 rounded-lg bg-purple-800">
                        <font-awesome-icon :icon="['fas', 'rocket']" class="h-6 w-6 text-white" />
                    </span>
                    <p class="ml-3 font-medium text-white truncate">
                        <span class="md:hidden">
                            Paid plans now available!
                        </span>
                        <span class="hidden md:inline">
                            🎉 <strong>{{ interestedTier }}</strong> plan is now available! 
                            Upgrade to unlock unlimited projects, dashboards, and {{ tierMaxRows}} rows per model.
                        </span>
                    </p>
                </div>
                <div class="order-3 mt-2 flex-shrink-0 w-full sm:order-2 sm:mt-0 sm:w-auto">
                    <NuxtLink 
                        :to="`/pricing?plan=${interestedTier.toLowerCase()}`"
                        class="flex items-center justify-center px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-purple-600 bg-white hover:bg-purple-50 cursor-pointer"
                    >
                        Upgrade Now
                    </NuxtLink>
                </div>
                <div class="order-2 flex-shrink-0 sm:order-3 sm:ml-3">
                    <button
                        @click="dismissBanner"
                        type="button"
                        class="-mr-1 flex p-2 rounded-md hover:bg-purple-500 focus:outline-none focus:ring-2 focus:ring-white sm:-mr-2 cursor-pointer"
                    >
                        <span class="sr-only">Dismiss</span>
                        <font-awesome-icon :icon="['fas', 'xmark']" class="h-6 w-6 text-white" />
                    </button>
                </div>
            </div>
        </div>
    </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue';
import { useLoggedInUserStore } from '~/stores/logged_in_user';
import { useSubscriptionStore } from '~/stores/subscription';
import { baseUrl } from '~/composables/Utils';
import { getAuthToken } from '~/composables/AuthToken';

const loggedInUserStore = useLoggedInUserStore();
const subscriptionStore = useSubscriptionStore();

const dismissed = ref(false);

interface InterestedUser {
    interestedTier: string;
    tierPrice: number;
    tierMaxRows: string;
    dismissedUntil: Date | null;
}

const userData = computed<InterestedUser | null>(() => {
    const user = loggedInUserStore.getLoggedInUser();
    if (!user) return null;
    
    // Check if user expressed interest (interested_subscription_tier_id exists)
    // This would need to be added to the user model and returned by the API
    // For now, check if they're on FREE tier
    const currentTier = subscriptionStore.usageStats?.tier || 'FREE';
    
    if (currentTier === 'FREE' || currentTier === 'free') {
        return {
            interestedTier: 'PROFESSIONAL',
            tierPrice: 399,
            tierMaxRows: '100M',
            dismissedUntil: user.dismissed_paid_plan_banner_until || null
        };
    }
    
    return null;
});

const interestedTier = computed(() => userData.value?.interestedTier || 'PROFESSIONAL');
const tierMaxRows = computed(() => userData.value?.tierMaxRows || '100M');

const shouldShowBanner = computed(() => {
    if (dismissed.value) return false;
    if (!userData.value) return false;
    
    // Check if banner was previously dismissed
    if (userData.value.dismissedUntil) {
        const dismissedUntil = new Date(userData.value.dismissedUntil);
        const now = new Date();
        
        // If dismissed date is in the future, don't show
        if (dismissedUntil > now) {
            return false;
        }
    }
    
    return true;
});

async function dismissBanner() {
    dismissed.value = true;
    
    // Dismiss for 7 days
    const dismissedUntil = new Date();
    dismissedUntil.setDate(dismissedUntil.getDate() + 7);
    
    try {
        const token = getAuthToken();
        if (!token) return;
        
        await $fetch(`${baseUrl()}/user/dismiss-paid-plan-banner`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${token}`,
                'Authorization-Type': 'auth',
                'Content-Type': 'application/json',
            },
            body: {
                dismissUntil: dismissedUntil.toISOString()
            }
        });
        
        console.log('[PaidPlansBanner] Banner dismissed for 7 days');
    } catch (error) {
        console.error('[PaidPlansBanner] Failed to dismiss banner:', error);
    }
}

onMounted(() => {
    // Fetch user data to get dismissal status
    loggedInUserStore.retrieveLoggedInUser();
});
</script>
