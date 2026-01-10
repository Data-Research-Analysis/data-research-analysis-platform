import { defineStore } from 'pinia';
import { baseUrl } from '~/composables/Utils';
import { getAuthToken } from '~/composables/AuthToken';
import { enableRefreshDataFlag } from '~/composables/Utils';
import type { IUserSubscriptionStats } from '~/types/subscriptions/IUserSubscriptionStats';

export const useSubscriptionStore = defineStore('subscription', () => {
    const subscriptionStats = ref<IUserSubscriptionStats | null>(null);
    const loading = ref(false);
    const error = ref<string | null>(null);

    function setSubscriptionStats(stats: IUserSubscriptionStats) {
        subscriptionStats.value = stats;
        if (import.meta.client) {
            localStorage.setItem('subscriptionStats', JSON.stringify(stats));
            enableRefreshDataFlag('setSubscriptionStats');
        }
    }

    function getSubscriptionStats() {
        if (import.meta.client && localStorage.getItem('subscriptionStats')) {
            subscriptionStats.value = JSON.parse(localStorage.getItem('subscriptionStats') || 'null');
        }
        return subscriptionStats.value;
    }

    async function fetchSubscription() {
        loading.value = true;
        error.value = null;
        try {
            const token = getAuthToken();
            if (!token) {
                throw new Error('No authentication token found');
            }

            const url = `${baseUrl()}/subscription/current`;
            const response = await fetch(url, {
                method: 'GET',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`,
                    'Authorization-Type': 'auth',
                },
            });

            if (!response.ok) {
                throw new Error(`Failed to fetch subscription: ${response.statusText}`);
            }

            const data = await response.json();
            setSubscriptionStats(data.data || data);
            return data.data || data;
        } catch (err: any) {
            error.value = err.message;
            console.error('Error fetching subscription:', err);
            throw err;
        } finally {
            loading.value = false;
        }
    }

    function clearSubscription() {
        subscriptionStats.value = null;
        if (import.meta.client) {
            localStorage.removeItem('subscriptionStats');
            enableRefreshDataFlag('clearSubscription');
        }
    }

    // Computed properties for easy access
    const tierName = computed(() => subscriptionStats.value?.tier.tier_name || 'FREE');
    const rowLimit = computed(() => subscriptionStats.value?.rowLimit || 0);
    const maxProjects = computed(() => subscriptionStats.value?.maxProjects);
    const maxDataSources = computed(() => subscriptionStats.value?.maxDataSources);
    const maxDashboards = computed(() => subscriptionStats.value?.maxDashboards);
    const isUnlimited = computed(() => subscriptionStats.value?.rowLimit === -1);

    return {
        subscriptionStats,
        loading,
        error,
        setSubscriptionStats,
        getSubscriptionStats,
        fetchSubscription,
        clearSubscription,
        // Computed properties
        tierName,
        rowLimit,
        maxProjects,
        maxDataSources,
        maxDashboards,
        isUnlimited,
    };
});
