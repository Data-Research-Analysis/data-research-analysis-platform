import { useProjectsStore } from '@/stores/projects';
import { useDataSourceStore } from '@/stores/data_sources';
import { useDataModelsStore } from '@/stores/data_models';
import { useDashboardsStore } from '@/stores/dashboards';
import { useArticlesStore } from '@/stores/articles';
import { useLoggedInUserStore } from "@/stores/logged_in_user";
import { usePrivateBetaUserStore } from '@/stores/private_beta_users';
import { useUserManagementStore } from '@/stores/user_management';

/**
 * Global middleware to load necessary data before pages render
 * 
 * OPTIMIZED: Only loads data required for the specific route being accessed.
 * This prevents unnecessary API calls and improves performance.
 * 
 * Uses batch loading context from 00-route-loader to ensure a single loader
 * remains visible for all parallel API calls.
 * 
 * Order: authorization.global.ts -> load-data.global.ts -> data_exists.global.ts
 */

// Route pattern matching functions
function isProjectListRoute(path: string): boolean {
  return path === '/projects';
}

function isProjectDetailRoute(path: string): boolean {
  return /^\/projects\/\d+$/.test(path);
}

function isDataSourceRoute(path: string): boolean {
  return /^\/projects\/\d+\/data-sources/.test(path);
}

function isDashboardRoute(path: string): boolean {
  return /^\/projects\/\d+\/dashboards/.test(path);
}

function isAdminRoute(path: string): boolean {
  return path.startsWith('/admin');
}

function isAdminArticleRoute(path: string): boolean {
  return path.startsWith('/admin/articles');
}

function isAdminUserRoute(path: string): boolean {
  return path.startsWith('/admin/users');
}

function isAdminPrivateBetaRoute(path: string): boolean {
  return path.startsWith('/admin/private-beta-users');
}

function isAdminDatabaseRoute(path: string): boolean {
  return path.startsWith('/admin/database');
}

function isPublicArticleRoute(path: string): boolean {
  return path.startsWith('/articles');
}

function isPublicRoute(path: string): boolean {
  const publicRoutes = ['/', '/login', '/register', '/privacy-policy', '/terms-conditions'];
  return publicRoutes.includes(path) || 
         path.startsWith('/public-dashboard') || 
         path.startsWith('/verify-email') || 
         path.startsWith('/forgot-password') ||
         path.startsWith('/unsubscribe');
}

// Smart caching with timestamp
const DATA_CACHE_DURATION = 5 * 60 * 1000; // 5 minutes

function shouldRefreshData(cacheKey: string): boolean {
  if (typeof window === 'undefined') return false;
  
  const forceRefresh = localStorage.getItem('refreshData') === 'true';
  if (forceRefresh) return true;
  
  const lastLoadTime = localStorage.getItem(`${cacheKey}_loadTime`);
  if (!lastLoadTime) return true;
  
  const age = Date.now() - parseInt(lastLoadTime);
  return age > DATA_CACHE_DURATION;
}

function markDataLoaded(cacheKey: string): void {
  if (typeof window !== 'undefined') {
    localStorage.setItem(`${cacheKey}_loadTime`, Date.now().toString());
  }
}

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

  try {
    const token = getAuthToken();
  const loggedInUserStore = useLoggedInUserStore();
  const projectsStore = useProjectsStore();
  const dataSourceStore = useDataSourceStore();
  const dataModelsStore = useDataModelsStore();
  const dashboardsStore = useDashboardsStore();
  const articlesStore = useArticlesStore();
  const privateBetaUserStore = usePrivateBetaUserStore();
  const userManagementStore = useUserManagementStore();

  try {
    // OPTIMIZATION: Skip data loading for public routes
    if (isPublicRoute(to.path) && !isPublicArticleRoute(to.path)) {
      if (import.meta.client) {
        console.log(`[02-load-data] Public route, skipping data load`)
      }
      return;
    }
    
    if (token) {
        // AUTHENTICATED ROUTES - Load data based on specific route
        if (import.meta.client) {
          console.log(`[02-load-data] Authenticated route: ${to.path}`)
        }
        
        const loadTasks: Array<Promise<void>> = [];
        
        // === PROJECT ROUTES ===
        if (isProjectListRoute(to.path)) {
          // Only load projects for list page
          if (shouldRefreshData('projects')) {
            if (import.meta.client) console.log(`[02-load-data] Loading: projects`)
            loadTasks.push((async () => {
              const start = import.meta.client ? performance.now() : 0
              await projectsStore.retrieveProjects();
              markDataLoaded('projects');
              if (import.meta.client) {
                console.log(`[02-load-data] retrieveProjects: ${(performance.now() - start).toFixed(2)}ms`)
              }
            })());
          }
        } else if (isProjectDetailRoute(to.path)) {
          // Load projects + data sources for project detail
          if (shouldRefreshData('projects')) {
            if (import.meta.client) console.log(`[02-load-data] Loading: projects, data sources`)
            loadTasks.push(
              (async () => {
                const start = import.meta.client ? performance.now() : 0
                await projectsStore.retrieveProjects();
                markDataLoaded('projects');
                if (import.meta.client) {
                  console.log(`[02-load-data] retrieveProjects: ${(performance.now() - start).toFixed(2)}ms`)
                }
              })(),
              (async () => {
                const start = import.meta.client ? performance.now() : 0
                await dataSourceStore.retrieveDataSources();
                markDataLoaded('dataSources');
                if (import.meta.client) {
                  console.log(`[02-load-data] retrieveDataSources: ${(performance.now() - start).toFixed(2)}ms`)
                }
              })()
            );
          }
        } else if (isDataSourceRoute(to.path)) {
          // Load projects + data sources + data models for data source routes
          if (shouldRefreshData('dataSources')) {
            if (import.meta.client) console.log(`[02-load-data] Loading: projects, data sources, data models`)
            loadTasks.push(
              (async () => {
                const start = import.meta.client ? performance.now() : 0
                await projectsStore.retrieveProjects();
                markDataLoaded('projects');
                if (import.meta.client) {
                  console.log(`[02-load-data] retrieveProjects: ${(performance.now() - start).toFixed(2)}ms`)
                }
              })(),
              (async () => {
                const start = import.meta.client ? performance.now() : 0
                await dataSourceStore.retrieveDataSources();
                markDataLoaded('dataSources');
                if (import.meta.client) {
                  console.log(`[02-load-data] retrieveDataSources: ${(performance.now() - start).toFixed(2)}ms`)
                }
              })(),
              (async () => {
                const start = import.meta.client ? performance.now() : 0
                await dataModelsStore.retrieveDataModels();
                markDataLoaded('dataModels');
                if (import.meta.client) {
                  console.log(`[02-load-data] retrieveDataModels: ${(performance.now() - start).toFixed(2)}ms`)
                }
              })()
            );
          }
        } else if (isDashboardRoute(to.path)) {
          // Load all project-related data for dashboard routes
          if (shouldRefreshData('dashboards')) {
            if (import.meta.client) console.log(`[02-load-data] Loading: projects, data sources, data models, dashboards`)
            loadTasks.push(
              (async () => {
                const start = import.meta.client ? performance.now() : 0
                await projectsStore.retrieveProjects();
                markDataLoaded('projects');
                if (import.meta.client) {
                  console.log(`[02-load-data] retrieveProjects: ${(performance.now() - start).toFixed(2)}ms`)
                }
              })(),
              (async () => {
                const start = import.meta.client ? performance.now() : 0
                await dataSourceStore.retrieveDataSources();
                markDataLoaded('dataSources');
                if (import.meta.client) {
                  console.log(`[02-load-data] retrieveDataSources: ${(performance.now() - start).toFixed(2)}ms`)
                }
              })(),
              (async () => {
                const start = import.meta.client ? performance.now() : 0
                await dataModelsStore.retrieveDataModels();
                markDataLoaded('dataModels');
                if (import.meta.client) {
                  console.log(`[02-load-data] retrieveDataModels: ${(performance.now() - start).toFixed(2)}ms`)
                }
              })(),
              (async () => {
                const start = import.meta.client ? performance.now() : 0
                await dashboardsStore.retrieveDashboards();
                markDataLoaded('dashboards');
                if (import.meta.client) {
                  console.log(`[02-load-data] retrieveDashboards: ${(performance.now() - start).toFixed(2)}ms`)
                }
              })()
            );
          }
        }
        
        // === ADMIN ROUTES ===
        else if (isAdminArticleRoute(to.path)) {
          // Only load articles data for article routes
          if (shouldRefreshData('articles')) {
            if (import.meta.client) console.log(`[02-load-data] Loading: categories, articles`)
            loadTasks.push(
              (async () => {
                const start = import.meta.client ? performance.now() : 0
                await articlesStore.retrieveCategories();
                markDataLoaded('categories');
                if (import.meta.client) {
                  console.log(`[02-load-data] retrieveCategories: ${(performance.now() - start).toFixed(2)}ms`)
                }
              })(),
              (async () => {
                const start = import.meta.client ? performance.now() : 0
                await articlesStore.retrieveArticles();
                markDataLoaded('articles');
                if (import.meta.client) {
                  console.log(`[02-load-data] retrieveArticles: ${(performance.now() - start).toFixed(2)}ms`)
                }
              })()
            );
          }
        } else if (isAdminUserRoute(to.path)) {
          // Only load users for user management routes
          if (shouldRefreshData('users')) {
            if (import.meta.client) console.log(`[02-load-data] Loading: users`)
            loadTasks.push((async () => {
              const start = import.meta.client ? performance.now() : 0
              await userManagementStore.retrieveUsers();
              markDataLoaded('users');
              if (import.meta.client) {
                console.log(`[02-load-data] retrieveUsers: ${(performance.now() - start).toFixed(2)}ms`)
              }
            })());
          }
        } else if (isAdminPrivateBetaRoute(to.path)) {
          // Only load private beta users
          if (shouldRefreshData('privateBetaUsers')) {
            if (import.meta.client) console.log(`[02-load-data] Loading: private beta users`)
            loadTasks.push((async () => {
              const start = import.meta.client ? performance.now() : 0
              await privateBetaUserStore.retrievePrivateBetaUsers();
              markDataLoaded('privateBetaUsers');
              if (import.meta.client) {
                console.log(`[02-load-data] retrievePrivateBetaUsers: ${(performance.now() - start).toFixed(2)}ms`)
              }
            })());
          }
        } else if (isAdminDatabaseRoute(to.path)) {
          // Database backup/restore routes don't need any data
          if (import.meta.client) console.log(`[02-load-data] Database route, no data needed`)
        } else if (isAdminRoute(to.path)) {
          // Admin dashboard - no specific data needed
          if (import.meta.client) console.log(`[02-load-data] Admin dashboard, no data needed`)
        }
        
        // Execute all load tasks in parallel
        if (loadTasks.length > 0) {
          const parallelStartTime = import.meta.client ? performance.now() : 0
          await Promise.all(loadTasks);
          if (import.meta.client) {
            const parallelDuration = performance.now() - parallelStartTime
            console.log(`[02-load-data] Parallel data loaded in: ${parallelDuration.toFixed(2)}ms`)
          }
        } else {
          if (import.meta.client) {
            console.log(`[02-load-data] No data loading needed (cached or not required)`)
          }
        }
        
        // Clear force refresh flag
        if (typeof window !== 'undefined') {
          localStorage.removeItem('refreshData');
        }
    } else {
      // UNAUTHENTICATED ROUTES - Only load data for public article routes
      if (isPublicArticleRoute(to.path)) {
        if (shouldRefreshData('publicArticles')) {
          if (import.meta.client) console.log(`[02-load-data] Loading: public articles, categories`)
          
          const publicStartTime = import.meta.client ? performance.now() : 0
          
          await Promise.all([
            (async () => {
              const start = import.meta.client ? performance.now() : 0
              await articlesStore.retrieveCategories();
              markDataLoaded('categories');
              if (import.meta.client) {
                console.log(`[02-load-data] retrieveCategories (public): ${(performance.now() - start).toFixed(2)}ms`)
              }
            })(),
            (async () => {
              const start = import.meta.client ? performance.now() : 0
              await articlesStore.retrievePublicArticles();
              markDataLoaded('publicArticles');
              if (import.meta.client) {
                console.log(`[02-load-data] retrievePublicArticles: ${(performance.now() - start).toFixed(2)}ms`)
              }
            })()
          ]);
          
          if (import.meta.client) {
            const publicDuration = performance.now() - publicStartTime
            console.log(`[02-load-data] Parallel public data loaded in: ${publicDuration.toFixed(2)}ms`)
          }
        } else {
          if (import.meta.client) {
            console.log(`[02-load-data] Public articles cached, skipping load`)
          }
        }
      } else {
        if (import.meta.client) {
          console.log(`[02-load-data] Public route, no data needed`)
        }
      }
    }
  } catch (error) {
    console.error('Failed to load data:', error);
    // Don't block navigation on error - let pages handle missing data gracefully
  }
  
  } finally {
    // Clear batch context after data loading completes (always runs)
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
  }
});
