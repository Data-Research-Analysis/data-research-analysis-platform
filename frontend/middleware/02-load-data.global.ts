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
 * Uses batch loading context from 00-route-loader to ensure a single loader
 * remains visible for all parallel API calls.
 * 
 * Order: authorization.global.ts -> load-data.global.ts -> data_exists.global.ts
 */
export default defineNuxtRouteMiddleware(async (to, from) => {
  const dataLoadStartTime = import.meta.client ? performance.now() : 0
  
  // Skip during SSR to prevent backend connection issues
  if (typeof window === 'undefined') {
    return;
  }
  
  // Set batch context if batch ID exists (set by 00-route-loader)
  const batchId = to.meta.loaderBatchId as string | undefined
  if (batchId && import.meta.client) {
    const { setBatchContext } = useGlobalLoader()
    setBatchContext(batchId)
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
        if (!needsDataRefresh) {
            if (import.meta.client) {
              const skipTime = performance.now()
              console.log(`[02-load-data] Skipped (no refresh needed) at ${skipTime.toFixed(2)}ms`)
            }
            return;
        }
        
        // OPTIMIZATION: Load all core data in parallel instead of sequentially
        if (import.meta.client) {
          console.log(`[02-load-data] Starting parallel data loading...`)
        }
        
        const parallelStartTime = import.meta.client ? performance.now() : 0
        
        // Run all core API calls in parallel
        await Promise.all([
          (async () => {
            const start = import.meta.client ? performance.now() : 0
            await projectsStore.retrieveProjects();
            if (import.meta.client) {
              console.log(`[02-load-data] retrieveProjects: ${(performance.now() - start).toFixed(2)}ms`)
            }
          })(),
          (async () => {
            const start = import.meta.client ? performance.now() : 0
            await dataSourceStore.retrieveDataSources();
            if (import.meta.client) {
              console.log(`[02-load-data] retrieveDataSources: ${(performance.now() - start).toFixed(2)}ms`)
            }
          })(),
          (async () => {
            const start = import.meta.client ? performance.now() : 0
            await dataModelsStore.retrieveDataModels();
            if (import.meta.client) {
              console.log(`[02-load-data] retrieveDataModels: ${(performance.now() - start).toFixed(2)}ms`)
            }
          })(),
          (async () => {
            const start = import.meta.client ? performance.now() : 0
            await dashboardsStore.retrieveDashboards();
            if (import.meta.client) {
              console.log(`[02-load-data] retrieveDashboards: ${(performance.now() - start).toFixed(2)}ms`)
            }
          })()
        ]);
        
        if (import.meta.client) {
          const parallelDuration = performance.now() - parallelStartTime
          console.log(`[02-load-data] Parallel core data loaded in: ${parallelDuration.toFixed(2)}ms`)
        }
        
        // Check if user is admin and load admin-specific data in parallel
        const currentUser = loggedInUserStore.getLoggedInUser();
        if (currentUser?.user_type === 'admin') {
          const adminStartTime = import.meta.client ? performance.now() : 0
          
          await Promise.all([
            (async () => {
              const start = import.meta.client ? performance.now() : 0
              await articlesStore.retrieveCategories();
              if (import.meta.client) {
                console.log(`[02-load-data] retrieveCategories: ${(performance.now() - start).toFixed(2)}ms`)
              }
            })(),
            (async () => {
              const start = import.meta.client ? performance.now() : 0
              await articlesStore.retrieveArticles();
              if (import.meta.client) {
                console.log(`[02-load-data] retrieveArticles: ${(performance.now() - start).toFixed(2)}ms`)
              }
            })(),
            (async () => {
              const start = import.meta.client ? performance.now() : 0
              await privateBetaUserStore.retrievePrivateBetaUsers();
              if (import.meta.client) {
                console.log(`[02-load-data] retrievePrivateBetaUsers: ${(performance.now() - start).toFixed(2)}ms`)
              }
            })(),
            (async () => {
              const start = import.meta.client ? performance.now() : 0
              await userManagementStore.retrieveUsers();
              if (import.meta.client) {
                console.log(`[02-load-data] retrieveUsers: ${(performance.now() - start).toFixed(2)}ms`)
              }
            })()
          ]);
          
          if (import.meta.client) {
            const adminDuration = performance.now() - adminStartTime
            console.log(`[02-load-data] Parallel admin data loaded in: ${adminDuration.toFixed(2)}ms`)
          }
        }
        if (typeof window !== 'undefined') {
          localStorage.removeItem('refreshData');
        }
    } else {
      // Unauthenticated user - load public data in parallel
      const publicStartTime = import.meta.client ? performance.now() : 0
      
      await Promise.all([
        (async () => {
          const start = import.meta.client ? performance.now() : 0
          await articlesStore.retrieveCategories();
          if (import.meta.client) {
            console.log(`[02-load-data] retrieveCategories (public): ${(performance.now() - start).toFixed(2)}ms`)
          }
        })(),
        (async () => {
          const start = import.meta.client ? performance.now() : 0
          await articlesStore.retrievePublicArticles();
          if (import.meta.client) {
            console.log(`[02-load-data] retrievePublicArticles: ${(performance.now() - start).toFixed(2)}ms`)
          }
        })()
      ]);
      
      if (import.meta.client) {
        const publicDuration = performance.now() - publicStartTime
        console.log(`[02-load-data] Parallel public data loaded in: ${publicDuration.toFixed(2)}ms`)
      }
    }
  } catch (error) {
    console.error('Failed to load data:', error);
    // Don't block navigation on error - let pages handle missing data gracefully
  }
  
  // Clear batch context after data loading completes
  if (batchId && import.meta.client) {
    const { clearBatchContext } = useGlobalLoader()
    clearBatchContext()
  }
  
  // INSTRUMENTATION: Track data loading middleware completion
  if (import.meta.client) {
    const dataLoadEndTime = performance.now()
    const duration = dataLoadEndTime - dataLoadStartTime
    console.log(`[02-load-data] Completed at ${dataLoadEndTime.toFixed(2)}ms (duration: ${duration.toFixed(2)}ms)`)
  }
});
