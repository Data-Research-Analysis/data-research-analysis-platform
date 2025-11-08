import { useProjectsStore } from '@/stores/projects';
import { useDataSourceStore } from '@/stores/data_sources';
import { useDataModelsStore } from '@/stores/data_models';
import { useDashboardsStore } from '@/stores/dashboards';
import { useArticlesStore } from '@/stores/articles';
import { useLoggedInUserStore } from "@/stores/logged_in_user";
import { usePrivateBetaUserStore } from '@/stores/private_beta_users';
import { useUserManagementStore } from '@/stores/user_management';

/**
 * Global middleware to load all necessary data before pages render
 * 
 * This middleware runs after authentication and ensures all required data
 * is loaded into stores before the page components mount. This prevents
 * race conditions on page refresh and allows other middleware to validate
 * with confidence that data exists.
 * 
 * Order: authorization.global.ts -> load-data.global.ts -> data_exists.global.ts
 */
export default defineNuxtRouteMiddleware(async (to, from) => {
  // Skip during SSR to prevent backend connection issues
  if (typeof window === 'undefined') {
    return;
  }

  const token = getAuthToken();
  const loggedInUserStore = useLoggedInUserStore();
  const projectsStore = useProjectsStore();
  const dataSourceStore = useDataSourceStore();
  const dataModelsStore = useDataModelsStore();
  const dashboardsStore = useDashboardsStore();
  const articlesStore = useArticlesStore();
  const privateBetaUserStore = usePrivateBetaUserStore();
  const userManagementStore = useUserManagementStore();

  // Skip data loading for public dashboard pages - they handle their own data

  try {
    if (token) {
        // Authenticated user - load all user-specific data
        const needsDataRefresh = typeof window !== 'undefined' && localStorage.getItem('refreshData') === 'true';
        console.log("localStorage.getItem('refreshData')", localStorage.getItem('refreshData'));
        console.log('Needs data refresh:', needsDataRefresh);
        if (!needsDataRefresh) {
            return;
        }
        // Load core project-related data
        await projectsStore.retrieveProjects();
        await dataSourceStore.retrieveDataSources();
        await dataModelsStore.retrieveDataModels();
        await dashboardsStore.retrieveDashboards();
        
        // Check if user is admin and load admin-specific data
        const currentUser = loggedInUserStore.getLoggedInUser();
        if (currentUser?.user_type === 'admin') {
          await articlesStore.retrieveCategories();
          await articlesStore.retrieveArticles();
          await privateBetaUserStore.retrievePrivateBetaUsers();
          await userManagementStore.retrieveUsers();
        }
        if (typeof window !== 'undefined') {
          console.log('Clearing refreshData flag from localStorage');
          localStorage.removeItem('refreshData');
          console.log('localStorage', localStorage);
        }
    } else {
      // Unauthenticated user - load public data only
      await articlesStore.retrieveCategories();
      await articlesStore.retrievePublicArticles();
    }
  } catch (error) {
    console.error('[load-data] Failed to load data:', error);
    // Don't block navigation on error - let pages handle missing data gracefully
  }
});
