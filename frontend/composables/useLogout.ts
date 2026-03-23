import { deleteAuthToken } from '@/composables/AuthToken';
import { useProjectsStore } from '@/stores/projects';
import { useDataSourceStore } from '@/stores/data_sources';
import { useDataModelsStore } from '@/stores/data_models';
import { useDashboardsStore } from '@/stores/dashboards';
import { useLoggedInUserStore } from '@/stores/logged_in_user';
import { useOrganizationsStore } from '@/stores/organizations';
import { useCampaignsStore } from '@/stores/campaigns';
import { useArticlesStore } from '@/stores/articles';
import { useInsightsStore } from '@/stores/insights';
import { useMarketingHubStore } from '@/stores/marketingHub';
import { useNotificationStore } from '@/stores/notifications';
import { useSubscriptionStore } from '@/stores/subscription';
import { useUserManagementStore } from '@/stores/user_management';
import { useSitemapStore } from '@/stores/sitemap';
import { useEnterpriseQueryStore } from '@/stores/enterprise_queries';
import { useAIDataModelerStore } from '@/stores/ai-data-modeler';
import { useAttributionStore } from '@/stores/attribution';

/**
 * Composable for handling user logout
 * Clears all stores, localStorage, and auth tokens
 */
export const useLogout = () => {
    const clearAllStores = () => {
        if (!import.meta.client) return;

        // Get all stores
        const projectsStore = useProjectsStore();
        const dataSourceStore = useDataSourceStore();
        const dataModelsStore = useDataModelsStore();
        const dashboardsStore = useDashboardsStore();
        const loggedInUserStore = useLoggedInUserStore();
        const organizationsStore = useOrganizationsStore();
        const campaignsStore = useCampaignsStore();
        const articlesStore = useArticlesStore();
        const insightsStore = useInsightsStore();
        const marketingHubStore = useMarketingHubStore();
        const notificationStore = useNotificationStore();
        const subscriptionStore = useSubscriptionStore();
        const userManagementStore = useUserManagementStore();
        const sitemapStore = useSitemapStore();
        const enterpriseQueryStore = useEnterpriseQueryStore();
        const aiDataModelerStore = useAIDataModelerStore();
        const attributionStore = useAttributionStore();

        // Clear all stores
        projectsStore.clearProjects();
        projectsStore.clearSelectedProject();
        
        dataSourceStore.clearDataSources();
        dataSourceStore.clearSelectedDataSource();
        
        dataModelsStore.clearDataModels();
        dataModelsStore.clearSelectedDataModel();
        dataModelsStore.clearDataModelDataCache();
        
        dashboardsStore.clearDashboards();
        dashboardsStore.clearSelectedDashboard();
        
        loggedInUserStore.clearUserPlatform();
        
        organizationsStore.clearOrganizations();
        
        campaignsStore.clearCampaigns();
        campaignsStore.clearSelectedCampaign();
        campaignsStore.clearOfflineSummaryCache();
        
        articlesStore.clearArticles();
        articlesStore.clearCategories();
        articlesStore.clearSelectedArticle();
        articlesStore.clearArticleVersions();
        
        insightsStore.clearSession();
        
        marketingHubStore.clearStore();
        
        notificationStore.clearNotifications();
        
        subscriptionStore.clearSubscription();
        
        userManagementStore.clearUsers();
        
        sitemapStore.clearSitemapEntries();
        sitemapStore.clearSelectedEntry();
        
        enterpriseQueryStore.clearEnterpriseQueries();
        
        aiDataModelerStore.resetState();
        aiDataModelerStore.clearSuggestions();
        
        attributionStore.clearAll();
    };

    const clearAllLocalStorage = () => {
        if (!import.meta.client) return;

        // List of known localStorage keys used by the application
        const localStorageKeys = [
            'projects',
            'selectedProject',
            'dataSources',
            'selectedDataSource',
            'dataModels',
            'selectedDataModel',
            'dashboards',
            'selectedDashboard',
            'loggedInUser',
            'organizations',
            'selectedOrganization',
            'currentWorkspaces',
            'selectedWorkspace',
            'organizationMembers',
            'campaigns',
            'selectedCampaign',
            'articles',
            'categories',
            'selectedArticle',
            'articleVersions',
            'notifications',
            'unreadNotifications',
            'subscription',
            'users',
            'invitations',
            'sitemapEntries',
            'selectedSitemapEntry',
            'enterpriseQueries',
            'meta_ads_pending_oauth',
            'linkedin_ads_pending_oauth',
            'google_pending_oauth_state',
            'userManagement',
            'ai_data_modeler_conversations',
            'ai_data_modeler_active_conversation',
            'attribution_data',
            'attribution_settings',
        ];

        // Remove all known keys
        localStorageKeys.forEach(key => {
            localStorage.removeItem(key);
        });

        // Also clear any refresh/cache flags and dynamic keys
        const allKeys = Object.keys(localStorage);
        allKeys.forEach(key => {
            // Clear refresh and cache flags
            if (key.startsWith('refresh_') || key.startsWith('cache_')) {
                localStorage.removeItem(key);
            }
            // Clear AI data modeler dynamic keys
            if (key.startsWith('join-suggestions:') || 
                key.startsWith('suggested-joins-') ||
                key === 'applied-suggestions' ||
                key === 'dismissed-suggestions') {
                localStorage.removeItem(key);
            }
            // Clear any other user-specific data sources localStorage keys
            if (key.startsWith('ds_') || key.startsWith('dm_')) {
                localStorage.removeItem(key);
            }
        });
    };

    const logout = () => {
        // Delete auth token
        deleteAuthToken();
        
        // Clear all Pinia stores
        clearAllStores();
        
        // Clear all localStorage
        clearAllLocalStorage();
        
        // Clear sessionStorage as well
        if (import.meta.client) {
            sessionStorage.clear();
        }
    };

    return {
        logout,
        clearAllStores,
        clearAllLocalStorage,
    };
};
