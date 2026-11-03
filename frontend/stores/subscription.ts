import { defineStore } from 'pinia';
import { ref, computed } from 'vue';
import { useAppFetch } from '@/composables/useAppFetch';
import { useOrganizationsStore } from '~/stores/organizations';
import { baseUrl } from '~/composables/Utils';
import { getAuthToken } from '~/composables/AuthToken';
import type { IUserSubscriptionStats } from '~/types/subscriptions/IUserSubscriptionStats';
import type { IEnhancedUsageStats } from '~/types/subscriptions/IEnhancedUsageStats';

export interface ISubscriptionDetails {
    id?: number;
    tier_name?: string;
    billing_cycle?: string;
    is_active?: boolean;
    started_at?: string | null;
    ends_at?: string | null;
    cancelled_at?: string | null;
    grace_period_ends_at?: string | null;
    last_payment_failed_at?: string | null;
    paddle_subscription_id?: string | null;
    paddle_customer_id?: string | null;
    paddle_update_url?: string | null;
    scheduled_cancellation?: any;
}

export const useSubscriptionStore = defineStore('subscription', () => {
    const subscriptionStats = ref<IUserSubscriptionStats | null>(null);
    const subscriptionDetails = ref<ISubscriptionDetails | null>(null);
    const usageStats = ref<IEnhancedUsageStats | null>(null);
    const loading = ref(false);
    const loadingUsage = ref(false);
    const error = ref<string | null>(null);
    const lastFetched = ref<number>(0);

    // ---- Credits wallet (plan §4.2) ----
    const creditsWallet = ref<{
        org_id: number;
        can_buy_packs?: boolean;
        wallet: {
            balance_credits: number;
            rollover_balance: number;
            monthly_grant_amount: number;
            monthly_credits_granted_at: string | null;
            monthly_spent_credits?: number;
            spend_cap_credits?: number | null;
            auto_recharge_threshold: number | null;
            auto_recharge_pack_id: number | null;
            auto_recharge_consent_at?: string | null;
            currency: string;
        };
        transactions: Array<{
            id: number;
            type: string;
            amount: number;
            source: string;
            action_key: string | null;
            action_ref_id: string | null;
            status: string;
            description: string | null;
            created_at: string;
        }>;
    } | null>(null);
    const creditPacks = ref<Array<{
        id: number;
        name: string;
        credits: number;
        price_usd: number;
        sort_order: number;
    }>>([]);
    const loadingCredits = ref(false);
    const creditCheckoutUrl = ref<string | null>(null);

    function setSubscriptionStats(stats: IUserSubscriptionStats) {
        subscriptionStats.value = stats;
        if (import.meta.client) {
            try {
                localStorage.setItem('subscriptionStats', JSON.stringify(stats));
            } catch (error: any) {
                if (error.name === 'QuotaExceededError') {
                    console.warn('[SubscriptionStore] localStorage quota exceeded for stats.');
                    } else {
                    console.error('[SubscriptionStore] Error saving stats to localStorage:', error);
                }
            }
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

            const data = await useAppFetch(`${baseUrl()}/subscription/current`, {
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Authorization-Type': 'auth',
                },
            }) as any;
            const responseData = data.data || data;
            setSubscriptionStats(responseData);
            subscriptionDetails.value = responseData as ISubscriptionDetails;
            return responseData;
        } catch (err: any) {
            error.value = err.message;
            console.error('Error fetching subscription:', err);
            throw err;
        } finally {
            loading.value = false;
        }
    }

    function clearSubscription() {
        // Stop any background polling so it can't rehydrate another user's data
        stopAutoRefresh();
        subscriptionStats.value = null;
        subscriptionDetails.value = null;
        usageStats.value = null;
        lastFetched.value = 0;
        loading.value = false;
        loadingUsage.value = false;
        error.value = null;
        if (import.meta.client) {
            localStorage.removeItem('subscriptionStats');
            localStorage.removeItem('usageStats');
            localStorage.removeItem('usageStatsTimestamp');
        }
    }

    /**
     * Drop cached subscription/usage state when the active organization
     * changes. The next refresh loads the new organization's plan; without
     * this the sidebar and usage card keep the previous org's tier.
     */
    function resetForOrganizationChange() {
        usageStats.value = null;
        subscriptionStats.value = null;
        subscriptionDetails.value = null;
        lastFetched.value = 0;
        if (import.meta.client) {
            localStorage.removeItem('usageStats');
            localStorage.removeItem('usageStatsTimestamp');
            localStorage.removeItem('subscriptionStats');
        }
    }

    /**
     * Refresh the subscription summary and the tier/usage entitlement state.
     * Used when entering a project and after switching organizations so the
     * visible plan, limits and advanced-tools gating match the current org.
     */
    async function refreshSubscriptionState() {
        const orgStore = useOrganizationsStore();
        await Promise.allSettled([
            // The organization payload carries the subscription details
            // (tier, Paddle id, grace period) shown on the usage card.
            orgStore.refreshSelectedOrganization(),
            fetchSubscription(),
            fetchUsageStats(),
        ]);
    }

    // Computed properties for easy access
    const tierName = computed(() => subscriptionStats.value?.tier.tier_name || 'FREE');
    const rowLimit = computed(() => subscriptionStats.value?.rowLimit || 0);
    const isUnlimited = computed(() => subscriptionStats.value?.rowLimit === -1);

    /**
     * Whether the product runs in credit-pricing mode for this org.
     * Consumption is metered by the credit balance.
     */
    const creditsEnabled = computed(() => usageStats.value?.creditsEnabled === true);
    const creditBalance = computed(() => usageStats.value?.creditBalance ?? null);

    /**
     * Credit packs and auto-recharge are a Pro top-up. Free orgs only receive
     * the monthly allowance, so the buy UI stays hidden for them.
     */
    const canBuyPacks = computed(() => creditsWallet.value?.can_buy_packs === true);

    /**
     * Fetch the workspace credit wallet + recent ledger (plan §4.2).
     */
    async function fetchCreditsWallet() {
        loadingCredits.value = true;
        try {
            const token = getAuthToken();
            if (!token) throw new Error('No authentication token found');
            const data = await useAppFetch(`${baseUrl()}/credits/balance`, {
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Authorization-Type': 'auth',
                },
            }) as any;
            creditsWallet.value = data.data || data;
            return creditsWallet.value;
        } catch (err: any) {
            console.error('Error fetching credits wallet:', err);
            throw err;
        } finally {
            loadingCredits.value = false;
        }
    }

    /**
     * Fetch active credit packs.
     */
    async function fetchCreditPacks() {
        try {
            const token = getAuthToken();
            if (!token) throw new Error('No authentication token found');
            const data = await useAppFetch(`${baseUrl()}/credits/packs`, {
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Authorization-Type': 'auth',
                },
            }) as any;
            creditPacks.value = (data.data || data) ?? [];
            return creditPacks.value;
        } catch (err: any) {
            console.error('Error fetching credit packs:', err);
            throw err;
        }
    }

    /**
     * Start a one-time Paddle checkout for a credit pack.
     * Returns the checkout URL; the caller opens it in a new tab.
     */
    /**
     * Start a one-time Paddle checkout for a credit pack.
     * Returns the transaction id (for the Paddle overlay) and, when Paddle
     * provides one, a hosted checkout URL as a fallback.
     */
    async function purchaseCreditPack(packId: number): Promise<{ sessionId: string; checkoutUrl: string | null } | null> {
        try {
            const token = getAuthToken();
            if (!token) throw new Error('No authentication token found');
            const data = await useAppFetch(`${baseUrl()}/credits/purchase`, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Authorization-Type': 'auth',
                    'Content-Type': 'application/json',
                },
                body: { packId },
            }) as any;
            const result = data.data || data;
            creditCheckoutUrl.value = result.checkoutUrl ?? null;
            return { sessionId: result.sessionId, checkoutUrl: creditCheckoutUrl.value };
        } catch (err: any) {
            console.error('Error purchasing credit pack:', err);
            throw err;
        }
    }

    /**
     * Set/clear auto-recharge (threshold + pack). packId null disables.
     */
    async function saveAutoRecharge(threshold: number, packId: number | null, consent = false) {
        try {
            const token = getAuthToken();
            if (!token) throw new Error('No authentication token found');
            const data = await useAppFetch(`${baseUrl()}/credits/auto-recharge`, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Authorization-Type': 'auth',
                    'Content-Type': 'application/json',
                },
                body: { threshold, packId, consent },
            }) as any;
            if (creditsWallet.value) {
                const result = data.data || data;
                creditsWallet.value.wallet.auto_recharge_threshold = result.threshold;
                creditsWallet.value.wallet.auto_recharge_pack_id = result.pack_id;
                creditsWallet.value.wallet.auto_recharge_consent_at = result.consent_at ?? null;
            }
            return data.data || data;
        } catch (err: any) {
            console.error('Error saving auto-recharge:', err);
            throw err;
        }
    }

    /**
     * Fetch the enhanced usage statistics with tier enforcement flags
     */
    async function fetchUsageStats() {
        loadingUsage.value = true;
        error.value = null;
        try {
            const token = getAuthToken();
            if (!token) {
                throw new Error('No authentication token found');
            }

            const data = await useAppFetch(`${baseUrl()}/subscription/usage`, {
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
        subscriptionDetails,
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
        resetForOrganizationChange,
        refreshSubscriptionState,
        // Computed properties
        tierName,
        rowLimit,
        isUnlimited,
        creditsEnabled,
        creditBalance,
        canBuyPacks,
        creditsWallet,
        creditPacks,
        loadingCredits,
        creditCheckoutUrl,
        fetchCreditsWallet,
        fetchCreditPacks,
        purchaseCreditPack,
        saveAutoRecharge,
    };
});
