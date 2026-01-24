import { defineStore } from 'pinia';
import { baseUrl } from '~/composables/Utils';
import { getAuthToken } from '~/composables/AuthToken';
import { enableRefreshDataFlag } from '~/composables/Utils';
import type { IUserSubscriptionStats } from '~/types/subscriptions/IUserSubscriptionStats';
import type { IEnhancedUsageStats } from '~/types/subscriptions/IEnhancedUsageStats';

export const useSubscriptionStore = defineStore('subscription', () => {
    const subscriptionStats = ref<IUserSubscriptionStats | null>(null);
    const usageStats = ref<IEnhancedUsageStats | null>(null);
    const loading = ref(false);
    const loadingUsage = ref(false);
    const error = ref<string | null>(null);
    const lastFetched = ref<number>(0);

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

            const data = await $fetch(`${baseUrl()}/subscription/current`, {
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Authorization-Type': 'auth',
                },
            }) as any;
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
    const maxDataModels = computed(() => subscriptionStats.value?.maxDataModels);
    const maxDashboards = computed(() => subscriptionStats.value?.maxDashboards);
    const isUnlimited = computed(() => subscriptionStats.value?.rowLimit === -1);

    // Enhanced tier enforcement computed properties
    const canCreateProject = computed(() => usageStats.value?.canCreateProject ?? true);
    const canCreateDataSource = computed(() => usageStats.value?.canCreateDataSource ?? true);
    const canCreateDataModel = computed(() => usageStats.value?.canCreateDataModel ?? true);
    const canCreateDashboard = computed(() => usageStats.value?.canCreateDashboard ?? true);
    const canUseAIGeneration = computed(() => usageStats.value?.canUseAIGeneration ?? true);
    const aiGenerationsRemaining = computed(() => {
        if (!usageStats.value) return 0;
        if (usageStats.value.aiGenerationsPerMonth === null) return Infinity;
        return Math.max(0, usageStats.value.aiGenerationsPerMonth - usageStats.value.aiGenerationsUsed);
    });

    /**
     * Fetch enhanced usage statistics with tier enforcement flags
     */
    async function fetchUsageStats() {
        loadingUsage.value = true;
        error.value = null;
        try {
            const token = getAuthToken();
            if (!token) {
                throw new Error('No authentication token found');
            }

            const data = await $fetch(`${baseUrl()}/subscription/usage`, {
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Authorization-Type': 'auth',
                },
            }) as any;
            usageStats.value = data.data || data;
            lastFetched.value = Date.now();
            
            if (import.meta.client) {
                localStorage.setItem('usageStats', JSON.stringify(usageStats.value));
                localStorage.setItem('usageStatsTimestamp', String(lastFetched.value));
                enableRefreshDataFlag('fetchUsageStats');
            }
            
            return usageStats.value;
        } catch (err: any) {
            error.value = err.message;
            console.error('Error fetching usage stats:', err);
            throw err;
        } finally {
            loadingUsage.value = false;
        }
    }

    /**
     * Start auto-refresh of usage stats (every 5 minutes)
     */
    let autoRefreshInterval: NodeJS.Timeout | null = null;
    
    function startAutoRefresh() {
        if (import.meta.server) return; // SSR guard
        
        // Clear existing interval
        if (autoRefreshInterval) {
            clearInterval(autoRefreshInterval);
        }
        
        // Fetch immediately if data is stale (> 5 minutes)
        const now = Date.now();
        const fiveMinutes = 5 * 60 * 1000;
        if (now - lastFetched.value > fiveMinutes) {
            fetchUsageStats().catch(console.error);
        }
        
        // Set up auto-refresh every 5 minutes
        autoRefreshInterval = setInterval(() => {
            fetchUsageStats().catch(console.error);
        }, fiveMinutes);
    }

    function stopAutoRefresh() {
        if (autoRefreshInterval) {
            clearInterval(autoRefreshInterval);
            autoRefreshInterval = null;
        }
    }

    // Load usage stats from localStorage on client
    if (import.meta.client) {
        const storedUsageStats = localStorage.getItem('usageStats');
        const storedTimestamp = localStorage.getItem('usageStatsTimestamp');
        
        if (storedUsageStats && storedTimestamp) {
            usageStats.value = JSON.parse(storedUsageStats);
            lastFetched.value = parseInt(storedTimestamp, 10);
        }
    }

    return {
        subscriptionStats,
        usageStats,
        loading,
        loadingUsage,
        error,
        setSubscriptionStats,
        getSubscriptionStats,
        fetchSubscription,
        fetchUsageStats,
        startAutoRefresh,
        stopAutoRefresh,
        clearSubscription,
        // Computed properties
        tierName,
        rowLimit,
        maxProjects,
        maxDataSources,
        maxDataModels,
        maxDashboards,
        isUnlimited,
        canCreateProject,
        canCreateDataSource,
        canCreateDataModel,
        canCreateDashboard,
        canUseAIGeneration,
        aiGenerationsRemaining,
    };
});
