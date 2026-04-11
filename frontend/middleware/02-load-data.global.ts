import { useProjectsStore } from '@/stores/projects';
import { useDataSourceStore } from '@/stores/data_sources';
import { useDataModelsStore } from '@/stores/data_models';
import { useDashboardsStore } from '@/stores/dashboards';
import { useArticlesStore } from '@/stores/articles';
import { useLoggedInUserStore } from "@/stores/logged_in_user";
import { useUserManagementStore } from '@/stores/user_management';
import { useEnterpriseQueryStore } from '@/stores/enterprise_queries';
import { useOrganizationsStore } from '@/stores/organizations';

/**
 * Global middleware to load necessary data before pages render
 * 
 * PHASE 3 OPTIMIZED: Smart route-based loading with aggressive caching
 * - Route requirements map defines exactly what each route needs
 * - 5-minute cache TTL prevents redundant API calls
 * - Performance monitoring tracks cache hits and navigation times
 * - Prefetching for predicted next routes
 * 
 * Uses batch loading context from 00-route-loader to ensure a single loader
 * remains visible for all parallel API calls.
 * 
 * Order: authorization.global.ts -> load-data.global.ts -> data_exists.global.ts
 */

/**
 * Route Data Requirements Map
 * Defines exactly what data each route pattern needs to load
 */
interface RouteRequirement {
  load: string[];
  priority: 'critical' | 'high' | 'low';
  extractParams?: (route: any) => Record<string, any>;
}

const ROUTE_DATA_REQUIREMENTS: Record<string, RouteRequirement> = {
  // Projects list - only needs projects metadata
  '^/projects$': {
    load: ['projects:metadata', 'organizations:metadata'],
    priority: 'high'
  },
  
  // Project detail - needs projects and data sources
  '^/projects/\\d+$': {
    load: ['projects:metadata', 'organizations:metadata', 'dataSources:metadata'],
    priority: 'high'
  },
  
  // Data sources routes - needs projects, data sources, and data models
  '^/projects/\\d+/data-sources': {
    load: ['projects:metadata', 'organizations:metadata', 'dataSources:metadata', 'dataModels:metadata'],
    priority: 'high'
  },
  
  // Data models routes - same as data sources
  '^/projects/\\d+/data-models': {
    load: ['projects:metadata', 'organizations:metadata', 'dataSources:metadata', 'dataModels:metadata'],
    priority: 'high'
  },
  
  // Dashboards routes - needs everything
  '^/projects/\\d+/dashboards': {
    load: ['projects:metadata', 'organizations:metadata', 'dataSources:metadata', 'dataModels:metadata', 'dashboards:metadata'],
    priority: 'high'
  },
  
  // Insights routes - needs projects and data sources
  '^/projects/\\d+/insights': {
    load: ['projects:metadata', 'organizations:metadata', 'dataSources:metadata'],
    priority: 'high'
  },
  
  // Marketing/campaigns routes - needs data sources and models for sidebar
  '^/projects/\\d+/(campaigns|marketing)': {
    load: ['projects:metadata', 'organizations:metadata', 'dataSources:metadata', 'dataModels:metadata'],
    priority: 'high'
  },
  
  // Settings routes - needs everything for sidebar + organization members
  '^/projects/\\d+/settings': {
    load: ['projects:metadata', 'organizations:metadata', 'dataSources:metadata', 'dataModels:metadata', 'orgMembers:metadata', 'invitations:metadata'],
    priority: 'high'
  },
  
  // Admin routes
  '^/admin/articles': {
    load: ['articles:metadata', 'categories:metadata'],
    priority: 'high'
  },
  
  '^/admin/users': {
    load: ['users:metadata'],
    priority: 'high'
  },
  
  '^/admin/enterprise-queries': {
    load: ['enterpriseQueries:metadata'],
    priority: 'high'
  },
  
  // Public article routes
  '^/articles': {
    load: ['publicArticles:metadata', 'categories:metadata'],
    priority: 'low'
  },
  
  // Pricing page - needs usage stats
  '^/pricing$': {
    load: ['usageStats:metadata'],
    priority: 'high'
  }
};

/**
 * Match route path against requirements map
 */
function matchRouteRequirements(path: string): RouteRequirement | null {
  for (const [pattern, requirements] of Object.entries(ROUTE_DATA_REQUIREMENTS)) {
    const regex = new RegExp(pattern);
    if (regex.test(path)) {
      return requirements;
    }
  }
  return null;
}

/**
 * Extract parameters from route (e.g., projectId)
 */
function extractRouteParams(route: any): Record<string, any> {
  const params: Record<string, any> = {};
  
  if (route.params.projectid) {
    params.projectId = parseInt(String(route.params.projectid), 10);
  }
  
  if (route.params.datamodelid) {
    params.dataModelId = parseInt(String(route.params.datamodelid), 10);
  }
  
  if (route.params.dashboardid) {
    params.dashboardId = parseInt(String(route.params.dashboardid), 10);
  }
  
  return params;
}

/**
 * Check if route is public (no authentication required)
 */
function isPublicRoute(path: string): boolean {
  const publicRoutes = ['/', '/login', '/register', '/privacy-policy', '/terms-conditions'];
  return publicRoutes.includes(path) || 
         path.startsWith('/public-dashboard') || 
         path.startsWith('/verify-email') || 
         path.startsWith('/forgot-password') ||
         path.startsWith('/unsubscribe');
}

/**
 * Check if route is a public article route
 */
function isPublicArticleRoute(path: string): boolean {
  return path.startsWith('/articles');
}

/**
 * Check if projects need refresh (cache stale OR missing RBAC my_role field)
 */
function shouldRefreshProjects(projectsStore: ReturnType<typeof useProjectsStore>, cacheManager: ReturnType<typeof useCacheManager>): boolean {
  const stale = !cacheManager.isCacheFresh('projects_metadata', 'projects');
  const missingRole = projectsStore.projects.some(p => !p.my_role);
  return stale || missingRole;
}


export default defineNuxtRouteMiddleware(async (to, from) => {
  // Skip during SSR to prevent backend connection issues
  if (typeof window === 'undefined') {
    return;
  }
  
  // Initialize performance tracking
  const perfMonitor = usePerformanceMonitor();
  perfMonitor.startNavigationTracking(to.path);
  
  // Initialize cache manager
  const cacheManager = useCacheManager();
  
  // Set batch context if batch ID exists (set by 00-route-loader)
  const batchId = to.meta.loaderBatchId as string | undefined
  if (batchId && import.meta.client) {
    const { setBatchContext } = useGlobalLoader()
    setBatchContext(batchId)
  }

  try {
    const token = getAuthToken();
    const organizationsStore = useOrganizationsStore();
    const projectsStore = useProjectsStore();
    const dataSourceStore = useDataSourceStore();
    const dataModelsStore = useDataModelsStore();
    const dashboardsStore = useDashboardsStore();
    const articlesStore = useArticlesStore();
    const userManagementStore = useUserManagementStore();
    const enterpriseQueryStore = useEnterpriseQueryStore();

    try {
      // OPTIMIZATION: Skip data loading for public routes (except articles)
      if (isPublicRoute(to.path) && !isPublicArticleRoute(to.path)) {
        console.log('[load-data] Public route - skipping data load');
        perfMonitor.endNavigationTracking();
        return;
      }
      
      if (token) {
        // AUTHENTICATED ROUTES - Smart loading based on route requirements
        console.log('[load-data] 🚀 Loading data for route:', to.path);
        
        // === ORGANIZATIONS - Always check and load for authenticated users ===
        const orgCacheKey = 'organizations_metadata';
        if (!cacheManager.isCacheFresh(orgCacheKey, 'organizations')) {
          console.log('[load-data] Loading organizations');
          perfMonitor.trackCacheMiss(orgCacheKey);
          await organizationsStore.retrieveOrganizations();
          cacheManager.markCached(orgCacheKey);
          
          // After loading organizations, load workspaces for selected org
          const selectedOrg = organizationsStore.getSelectedOrganization();
          if (selectedOrg) {
            const workspaceCacheKey = `workspaces_org_${selectedOrg.id}`;
            if (!cacheManager.isCacheFresh(workspaceCacheKey, 'workspaces')) {
              console.log('[load-data] Loading workspaces for organization', selectedOrg.id);
              perfMonitor.trackCacheMiss(workspaceCacheKey);
              await organizationsStore.retrieveWorkspaces(selectedOrg.id);
              cacheManager.markCached(workspaceCacheKey);
            } else {
              perfMonitor.trackCacheHit(workspaceCacheKey);
            }
          }
        } else {
          perfMonitor.trackCacheHit(orgCacheKey);
          
          // Check workspaces cache separately if orgs are cached
          const selectedOrg = organizationsStore.getSelectedOrganization();
          if (selectedOrg) {
            const workspaceCacheKey = `workspaces_org_${selectedOrg.id}`;
            if (!cacheManager.isCacheFresh(workspaceCacheKey, 'workspaces')) {
              console.log('[load-data] Loading workspaces for cached organization', selectedOrg.id);
              perfMonitor.trackCacheMiss(workspaceCacheKey);
              await organizationsStore.retrieveWorkspaces(selectedOrg.id);
              cacheManager.markCached(workspaceCacheKey);
            } else {
              perfMonitor.trackCacheHit(workspaceCacheKey);
            }
          }
        }
        
        // === ROUTE-SPECIFIC DATA LOADING ===
        const requirements = matchRouteRequirements(to.path);
        
        if (!requirements) {
          console.log('[load-data] ⚠️ No data requirements defined for route:', to.path);
          perfMonitor.endNavigationTracking();
          return;
        }
        
        console.log('[load-data] 📋 Route requirements:', requirements.load);
        
        const loadTasks: Promise<void>[] = [];
        const routeParams = extractRouteParams(to);
        
        // Process each requirement
        for (const requirement of requirements.load) {
          const [entity, type] = requirement.split(':');
          const baseCacheKey = `${entity}_${type}`;
          let cacheKey = baseCacheKey;
          
          // Add context to cache key if needed
          if (routeParams.projectId && ['dataModels', 'dashboards', 'orgMembers', 'invitations'].includes(entity)) {
            cacheKey = `${baseCacheKey}_${routeParams.projectId}`;
          }
          
          // Check cache freshness
          let shouldLoad = false;
          
          // Special handling for projects (check for missing RBAC role)
          if (entity === 'projects') {
            shouldLoad = shouldRefreshProjects(projectsStore, cacheManager);
            if (!shouldLoad) {
              perfMonitor.trackCacheHit(cacheKey);
            } else {
              perfMonitor.trackCacheMiss(cacheKey);
            }
          } else {
            if (!cacheManager.isCacheFresh(cacheKey, entity)) {
              perfMonitor.trackCacheMiss(cacheKey);
              shouldLoad = true;
            } else {
              perfMonitor.trackCacheHit(cacheKey);
              shouldLoad = false;
            }
          }
          
          if (!shouldLoad) {
            continue; // Skip this requirement - cache is fresh
          }
          
          // Load data based on requirement
          switch (requirement) {
            case 'projects:metadata':
              loadTasks.push((async () => {
                perfMonitor.trackApiCall('GET /projects');
                await projectsStore.retrieveProjects();
                cacheManager.markCached(cacheKey);
                
                // Pre-load org members for first project's organization
                if (projectsStore.projects.length > 0) {
                  const firstProject = projectsStore.projects[0];
                  if (firstProject.organization_id) {
                    const orgMembersCacheKey = `orgMembers_org_${firstProject.organization_id}`;
                    if (!cacheManager.isCacheFresh(orgMembersCacheKey, 'organizations')) {
                      try {
                        await organizationsStore.retrieveOrganizationMembers(firstProject.organization_id);
                        cacheManager.markCached(orgMembersCacheKey);
                      } catch (error) {
                        console.error('[load-data] Failed to pre-load org members:', error);
                      }
                    }
                  }
                }
              })());
              break;
              
            case 'dataSources:metadata':
              loadTasks.push((async () => {
                perfMonitor.trackApiCall('GET /data-sources');
                await dataSourceStore.retrieveDataSources();
                cacheManager.markCached(cacheKey);
              })());
              break;
              
            case 'dataModels:metadata':
              if (routeParams.projectId) {
                loadTasks.push((async () => {
                  perfMonitor.trackApiCall(`GET /data-models?projectId=${routeParams.projectId}`);
                  await dataModelsStore.retrieveDataModels(routeParams.projectId);
                  cacheManager.markCached(cacheKey);
                })());
                // Issue #361 - Data Model Composition: Load data models as source tables
                loadTasks.push((async () => {
                  perfMonitor.trackApiCall(`GET /data-models-as-tables?projectId=${routeParams.projectId}`);
                  await dataModelsStore.retrieveDataModelsAsSourceTables(routeParams.projectId);
                  cacheManager.markCached('dataModelsAsTables');
                })());
              }
              break;
              
            case 'dashboards:metadata':
              loadTasks.push((async () => {
                perfMonitor.trackApiCall('GET /dashboards');
                await dashboardsStore.retrieveDashboards();
                cacheManager.markCached(cacheKey);
              })());
              break;
              
            case 'articles:metadata':
              loadTasks.push((async () => {
                perfMonitor.trackApiCall('GET /articles (admin)');
                await articlesStore.retrieveArticles();
                cacheManager.markCached(cacheKey);
              })());
              break;
              
            case 'categories:metadata':
              loadTasks.push((async () => {
                perfMonitor.trackApiCall('GET /categories');
                await articlesStore.retrieveCategories();
                cacheManager.markCached(cacheKey);
              })());
              break;
              
            case 'users:metadata':
              loadTasks.push((async () => {
                perfMonitor.trackApiCall('GET /users');
                await userManagementStore.retrieveUsers();
                cacheManager.markCached(cacheKey);
              })());
              break;
              
            case 'enterpriseQueries:metadata':
              loadTasks.push((async () => {
                perfMonitor.trackApiCall('GET /enterprise-queries');
                await enterpriseQueryStore.retrieveEnterpriseQueries();
                cacheManager.markCached(cacheKey);
              })());
              break;
              
            case 'publicArticles:metadata':
              loadTasks.push((async () => {
                perfMonitor.trackApiCall('GET /articles (public)');
                await articlesStore.retrievePublicArticles();
                cacheManager.markCached(cacheKey);
              })());
              break;
              
            case 'orgMembers:metadata':
              if (routeParams.projectId) {
                loadTasks.push((async () => {
                  // Get project to find organization ID
                  if (projectsStore.projects.length === 0) {
                    await projectsStore.retrieveProjects();
                  }
                  const project = projectsStore.projects.find(p => p.id === routeParams.projectId);
                  if (project?.organization_id) {
                    perfMonitor.trackApiCall(`GET /organizations/${project.organization_id}/members`);
                    await organizationsStore.retrieveOrganizationMembers(project.organization_id);
                    cacheManager.markCached(`orgMembers_org_${project.organization_id}`);
                  }
                })());
              }
              break;
              
            case 'invitations:metadata':
              if (routeParams.projectId) {
                loadTasks.push((async () => {
                  perfMonitor.trackApiCall(`GET /projects/${routeParams.projectId}/invitations`);
                  await projectsStore.retrievePendingInvitations(routeParams.projectId);
                  cacheManager.markCached(cacheKey);
                })());
              }
              break;
              
            case 'usageStats:metadata':
              loadTasks.push((async () => {
                const { useSubscriptionStore } = await import('~/stores/subscription');
                const subscriptionStore = useSubscriptionStore();
                perfMonitor.trackApiCall('GET /subscription/usage');
                await subscriptionStore.fetchUsageStats();
                cacheManager.markCached(cacheKey);
              })());
              break;
          }
        }
        
        // Execute all load tasks in parallel
        if (loadTasks.length > 0) {
          console.log(`[load-data] ⚡ Loading ${loadTasks.length} resources...`);
          await Promise.all(loadTasks);
          console.log('[load-data] ✅ All resources loaded');
        } else {
          console.log('[load-data] ⚡ All data cached - no API calls needed');
        }
        
        // Clear force refresh flag
        if (typeof window !== 'undefined') {
          localStorage.removeItem('refreshData');
        }
        
      } else {
        // UNAUTHENTICATED ROUTES - Only load public articles
        if (isPublicArticleRoute(to.path)) {
          const articlesCacheKey = 'publicArticles_metadata';
          const categoriesCacheKey = 'categories_metadata';
          
          const loadTasks: Promise<void>[] = [];
          
          if (!cacheManager.isCacheFresh(articlesCacheKey, 'articles')) {
            perfMonitor.trackCacheMiss(articlesCacheKey);
            loadTasks.push((async () => {
              await articlesStore.retrievePublicArticles();
              cacheManager.markCached(articlesCacheKey);
            })());
          } else {
            perfMonitor.trackCacheHit(articlesCacheKey);
          }
          
          if (!cacheManager.isCacheFresh(categoriesCacheKey, 'categories')) {
            perfMonitor.trackCacheMiss(categoriesCacheKey);
            loadTasks.push((async () => {
              await articlesStore.retrieveCategories();
              cacheManager.markCached(categoriesCacheKey);
            })());
          } else {
            perfMonitor.trackCacheHit(categoriesCacheKey);
          }
          
          if (loadTasks.length > 0) {
            await Promise.all(loadTasks);
          }
        }
      }
      
      // End performance tracking
      perfMonitor.endNavigationTracking();
      
      // Log performance summary for debugging (dev mode only)
      if (import.meta.dev) {
        const summary = perfMonitor.getPerformanceSummary();
        if (summary.cacheHitRate > 0) {
          console.log(`[load-data] 📊 Cache hit rate: ${summary.cacheHitRate.toFixed(1)}%`);
        }
      }
      
    } catch (error) {
      console.error('[load-data] ❌ Failed to load data:', error);
      perfMonitor.endNavigationTracking();
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

