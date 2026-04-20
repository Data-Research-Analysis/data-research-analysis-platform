/**
 * Composable for tier limit enforcement and upgrade prompts
 * 
 * Provides utilities to check subscription limits before actions
 * and display upgrade modals when limits are exceeded.
 */

import { useSubscriptionStore } from '~/stores/subscription';
import { ref, computed } from 'vue';

export interface ITierLimitModalState {
    show: boolean;
    resource: 'project' | 'data_source' | 'dashboard' | 'ai_generation' | 'member' | 'data_model';
    currentUsage: number;
    tierLimit: number | null;
    tierName: string;
    upgradeTiers: Array<{
        tierName: string;
        limit: number | null;
        pricePerMonth: number;
    }>;
}

export const useTierLimits = () => {
    const subscriptionStore = useSubscriptionStore();
    
    const modalState = ref<ITierLimitModalState>({
        show: false,
        resource: 'project',
        currentUsage: 0,
        tierLimit: 0,
        tierName: 'FREE',
        upgradeTiers: [],
    });

    /**
     * Check if user can create a project
     * @returns true if allowed, false if limit exceeded (modal shown)
     */
    const checkProjectLimit = (): boolean => {
        if (subscriptionStore.canCreateProject) {
            return true;
        }

        showLimitModal({
            resource: 'project',
            currentUsage: subscriptionStore.usageStats?.projectCount || 0,
            tierLimit: subscriptionStore.usageStats?.maxProjects || 0,
            tierName: subscriptionStore.usageStats?.tier || 'FREE',
            upgradeTiers: getUpgradeTiers('project'),
        });
        
        return false;
    };

    /**
     * Check if user can create a data source
     * @returns true if allowed, false if limit exceeded (modal shown)
     */
    const checkDataSourceLimit = (): boolean => {
        if (subscriptionStore.canCreateDataSource) {
            return true;
        }

        showLimitModal({
            resource: 'data_source',
            currentUsage: subscriptionStore.usageStats?.dataSourceCount || 0,
            tierLimit: subscriptionStore.usageStats?.maxDataSources || 0,
            tierName: subscriptionStore.usageStats?.tier || 'FREE',
            upgradeTiers: getUpgradeTiers('data_source'),
        });
        
        return false;
    };

    /**
     * Check if user can create a dashboard
     * @returns true if allowed, false if limit exceeded (modal shown)
     */
    const checkDashboardLimit = (): boolean => {
        if (subscriptionStore.canCreateDashboard) {
            return true;
        }

        showLimitModal({
            resource: 'dashboard',
            currentUsage: subscriptionStore.usageStats?.dashboardCount || 0,
            tierLimit: subscriptionStore.usageStats?.maxDashboards || 0,
            tierName: subscriptionStore.usageStats?.tier || 'FREE',
            upgradeTiers: getUpgradeTiers('dashboard'),
        });
        
        return false;
    };

    /**
     * Check if user can create a data model
     * Note: Backend enforces per-data-source limit, frontend shows general message
     * @returns true if allowed, false if limit exceeded (modal shown)
     */
    const checkDataModelLimit = (): boolean => {
        if (subscriptionStore.canCreateDataModel) {
            return true;
        }

        showLimitModal({
            resource: 'data_model',
            currentUsage: subscriptionStore.usageStats?.dataModelCount || 0,
            tierLimit: subscriptionStore.usageStats?.maxDataModels || 0,
            tierName: subscriptionStore.usageStats?.tier || 'FREE',
            upgradeTiers: getUpgradeTiers('data_model'),
        });
        
        return false;
    };

    /**
     * Check if user can use AI generation
     * @returns true if allowed, false if limit exceeded (modal shown)
     */
    const checkAIGenerationLimit = (): boolean => {
        if (subscriptionStore.canUseAIGeneration) {
            return true;
        }

        showLimitModal({
            resource: 'ai_generation',
            currentUsage: subscriptionStore.usageStats?.aiGenerationsUsed || 0,
            tierLimit: subscriptionStore.usageStats?.aiGenerationsPerMonth || 0,
            tierName: subscriptionStore.usageStats?.tier || 'FREE',
            upgradeTiers: getUpgradeTiers('ai_generation'),
        });
        
        return false;
    };

    /**
     * Check if user can add a team member
     * Uses live canAddMember flag from usage stats (populated from backend getUsageStats).
     * @returns true if allowed, false if limit exceeded (modal shown)
     */
    const checkMemberLimit = (): boolean => {
        if (subscriptionStore.canAddMember) {
            return true;
        }

        const stats = subscriptionStore.usageStats;
        showLimitModal({
            resource: 'member',
            currentUsage: stats?.memberCount ?? 0,
            tierLimit: stats?.maxMembersPerProject ?? 0,
            tierName: stats?.tier || 'FREE',
            upgradeTiers: getUpgradeTiers('member'),
        });

        return false;
    };

    /**
     * Show tier limit modal with given state
     */
    const showLimitModal = (state: Omit<ITierLimitModalState, 'show'>) => {
        modalState.value = {
            ...state,
            show: true,
        };
    };

    /**
     * Hide tier limit modal
     */
    const hideLimitModal = () => {
        modalState.value.show = false;
    };

    /**
     * Get available upgrade tiers for a resource type
     * Returns hardcoded tier structure based on current 3-tier system
     */
    const getUpgradeTiers = (resource: ITierLimitModalState['resource']) => {
        const currentTier = subscriptionStore.usageStats?.tier || 'FREE';
        
        // If already on highest tier, no upgrades available
        if (currentTier === 'enterprise' || currentTier === 'ENTERPRISE') {
            return [];
        }

        // Professional upgrade option
        if (currentTier === 'free' || currentTier === 'FREE') {
            return [
                {
                    tierName: 'PROFESSIONAL',
                    limit: null, // Unlimited
                    pricePerMonth: 399,
                },
                {
                    tierName: 'ENTERPRISE',
                    limit: null, // Unlimited
                    pricePerMonth: 2499,
                }
            ];
        }

        // Already professional, only enterprise upgrade
        if (currentTier === 'professional' || currentTier === 'PROFESSIONAL') {
            return [
                {
                    tierName: 'ENTERPRISE',
                    limit: null, // Unlimited
                    pricePerMonth: 2499,
                }
            ];
        }

        return [];
    };

    /**
     * Navigate to pricing page  
     */
    const goToPricing = () => {
        if (import.meta.client) {
            window.location.href = '/pricing';
        }
    };

    /**
     * Computed properties for easy access
     */
    const currentTier = computed(() => subscriptionStore.usageStats?.tier || 'FREE');
    const isFree = computed(() => currentTier.value.toLowerCase() === 'free');
    const isProfessional = computed(() => currentTier.value.toLowerCase() === 'professional');
    const isEnterprise = computed(() => currentTier.value.toLowerCase() === 'enterprise');

    return {
        modalState,
        checkProjectLimit,
        checkDataSourceLimit,
        checkDashboardLimit,
        checkDataModelLimit,
        checkAIGenerationLimit,
        checkMemberLimit,
        showLimitModal,
        hideLimitModal,
        goToPricing,
        currentTier,
        isFree,
        isProfessional,
        isEnterprise,
        // Direct access to store computed properties
        canCreateProject: computed(() => subscriptionStore.canCreateProject),
        canCreateDataSource: computed(() => subscriptionStore.canCreateDataSource),
        canCreateDashboard: computed(() => subscriptionStore.canCreateDashboard),
        canUseAIGeneration: computed(() => subscriptionStore.canUseAIGeneration),
        canAddMember: computed(() => subscriptionStore.canAddMember),
        usageStats: computed(() => subscriptionStore.usageStats),
    };
};
