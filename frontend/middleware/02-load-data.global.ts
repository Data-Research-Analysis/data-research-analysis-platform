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
  return path === '/projects' || path === '/marketing-projects';
}

function isProjectDetailRoute(path: string): boolean {
  return /^\/projects\/\d+$/.test(path) || /^\/marketing-projects\/\d+$/.test(path);
}

function isDataSourceRoute(path: string): boolean {
  return /^\/projects\/\d+\/data-sources/.test(path) || /^\/marketing-projects\/\d+\/data-sources/.test(path);
}

function isDashboardRoute(path: string): boolean {
  return /^\/projects\/\d+\/dashboards/.test(path) || /^\/marketing-projects\/\d+\/dashboards/.test(path);
}

function isInsightsRoute(path: string): boolean {
  return /^\/projects\/\d+\/insights/.test(path) || /^\/marketing-projects\/\d+\/insights/.test(path);
}

function isDataModelsRoute(path: string): boolean {
  return /^\/projects\/\d+\/data-models/.test(path) || /^\/marketing-projects\/\d+\/data-models/.test(path);
}

// Catch-all for marketing-projects sub-routes not covered by specific matchers
function isMarketingSubRoute(path: string): boolean {
  return /^\/marketing-projects\/\d+\/(campaigns|marketing)/.test(path);
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
      return;
    }
    
    if (token) {
        // AUTHENTICATED ROUTES - Load data based on specific route
        const loadTasks: Array<Promise<void>> = [];
        
        // === PROJECT ROUTES ===
        if (isProjectListRoute(to.path)) {
          // Only load projects for list page
          if (shouldRefreshData('projects')) {
            loadTasks.push((async () => {
              await projectsStore.retrieveProjects();
              markDataLoaded('projects');
            })());
          }
        } else if (isProjectDetailRoute(to.path)) {
          // Load projects + data sources for project detail
          // Always load projects if cache expired
          if (shouldRefreshData('projects')) {
            loadTasks.push(
              (async () => {
                await projectsStore.retrieveProjects();
                markDataLoaded('projects');
              })()
            );
          }
          
          // Always load data sources when navigating to project (even if cached)
          // This ensures data sources show after login or project switch
          loadTasks.push(
            (async () => {
              await dataSourceStore.retrieveDataSources();
              markDataLoaded('dataSources');
            })()
          );
        } else if (isDataSourceRoute(to.path)) {
          // Load projects + data sources + data models for data source routes
          if (shouldRefreshData('projects')) {
            loadTasks.push(
              (async () => {
                await projectsStore.retrieveProjects();
                markDataLoaded('projects');
              })()
            );
          }
          
          // Extract projectId from route params
          const projectId = to.params.projectid ? parseInt(String(to.params.projectid), 10) : undefined;
          
          // Always load data sources and models for data source routes
          loadTasks.push(
            (async () => {
              await dataSourceStore.retrieveDataSources();
              markDataLoaded('dataSources');
            })(),
            (async () => {
              if (projectId && !isNaN(projectId)) {
                await dataModelsStore.retrieveDataModels(projectId);
                markDataLoaded('dataModels');
              }
            })()
          );
        } else if (isDashboardRoute(to.path)) {
          // Load all project-related data for dashboard routes
          if (shouldRefreshData('projects')) {
            loadTasks.push(
              (async () => {
                await projectsStore.retrieveProjects();
                markDataLoaded('projects');
              })()
            );
          }
          
          // Extract projectId from route params
          const projectId = to.params.projectid ? parseInt(String(to.params.projectid), 10) : undefined;
          
          // Always load data sources, models, and dashboards for dashboard routes
          loadTasks.push(
            (async () => {
              await dataSourceStore.retrieveDataSources();
              markDataLoaded('dataSources');
            })(),
            (async () => {
              if (projectId && !isNaN(projectId)) {
                await dataModelsStore.retrieveDataModels(projectId);
                markDataLoaded('dataModels');
              }
            })(),
            (async () => {
              await dashboardsStore.retrieveDashboards();
              markDataLoaded('dashboards');
            })()
          );
        } else if (isInsightsRoute(to.path)) {
          // Load projects and insights data for insights routes
          if (shouldRefreshData('projects')) {
            loadTasks.push(
              (async () => {
                await projectsStore.retrieveProjects();
                markDataLoaded('projects');
              })()
            );
          }
          
          // Load data sources for insights context
          loadTasks.push(
            (async () => {
              await dataSourceStore.retrieveDataSources();
              markDataLoaded('dataSources');
            })()
          );
        } else if (isDataModelsRoute(to.path)) {
          // Load projects + data sources + data models for data-model routes
          if (shouldRefreshData('projects')) {
            loadTasks.push(
              (async () => {
                await projectsStore.retrieveProjects();
                markDataLoaded('projects');
              })()
            );
          }
          const projectId = to.params.projectid ? parseInt(String(to.params.projectid), 10) : undefined;
          loadTasks.push(
            (async () => {
              await dataSourceStore.retrieveDataSources();
              markDataLoaded('dataSources');
            })(),
            (async () => {
              if (projectId && !isNaN(projectId)) {
                await dataModelsStore.retrieveDataModels(projectId);
                markDataLoaded('dataModels');
              }
            })()
          );
        } else if (isMarketingSubRoute(to.path)) {
          // Load projects for campaigns / marketing hub sub-routes
          if (shouldRefreshData('projects')) {
            loadTasks.push(
              (async () => {
                await projectsStore.retrieveProjects();
                markDataLoaded('projects');
              })()
            );
          }
        }
        
        // === ADMIN ROUTES ===
        else if (isAdminArticleRoute(to.path)) {
          // Only load articles data for article routes
          if (shouldRefreshData('articles')) {
            loadTasks.push(
              (async () => {
                await articlesStore.retrieveCategories();
                markDataLoaded('categories');
              })(),
              (async () => {
                await articlesStore.retrieveArticles();
                markDataLoaded('articles');
              })()
            );
          }
        } else if (isAdminUserRoute(to.path)) {
          // Only load users for user management routes
          if (shouldRefreshData('users')) {
            loadTasks.push((async () => {
              await userManagementStore.retrieveUsers();
              markDataLoaded('users');
            })());
          }
        } else if (isAdminPrivateBetaRoute(to.path)) {
          // Only load private beta users
          if (shouldRefreshData('privateBetaUsers')) {
            loadTasks.push((async () => {
              await privateBetaUserStore.retrievePrivateBetaUsers();
              markDataLoaded('privateBetaUsers');
            })());
          }
        }
        
        // Execute all load tasks in parallel
        if (loadTasks.length > 0) {
          await Promise.all(loadTasks);
        }
        
        // Clear force refresh flag
        if (typeof window !== 'undefined') {
          localStorage.removeItem('refreshData');
        }
    } else {
      // UNAUTHENTICATED ROUTES - Only load data for public article routes
      if (isPublicArticleRoute(to.path)) {
        if (shouldRefreshData('publicArticles')) {
          await Promise.all([
            (async () => {
              await articlesStore.retrieveCategories();
              markDataLoaded('categories');
            })(),
            (async () => {
              await articlesStore.retrievePublicArticles();
              markDataLoaded('publicArticles');
            })()
          ]);
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
  }
});
