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

function isInsightsRoute(path: string): boolean {
  return /^\/projects\/\d+\/insights/.test(path);
}

function isDataModelsRoute(path: string): boolean {
  return /^\/projects\/\d+\/data-models/.test(path);
}

// Catch-all for projects sub-routes not covered by specific matchers
function isMarketingSubRoute(path: string): boolean {
  return /^\/projects\/\d+\/(campaigns|marketing)/.test(path);
}

function isSettingsRoute(path: string): boolean {
  return /^\/projects\/\d+\/settings/.test(path);
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

function isAdminEnterpriseQueryRoute(path: string): boolean {
  return path.startsWith('/admin/enterprise-queries');
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

// Force a refresh if the cache is stale OR if any project is missing my_role
// (happens on first load after the RBAC migration while localStorage still has
// pre-migration entries where my_role was not stored).
function shouldRefreshProjects(projectsStore: ReturnType<typeof useProjectsStore>): boolean {
  const stale = shouldRefreshData('projects');
  const missingRole = projectsStore.projects.some(p => !p.my_role);
  return stale || missingRole;
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
  const userManagementStore = useUserManagementStore();
  const enterpriseQueryStore = useEnterpriseQueryStore();
  const organizationsStore = useOrganizationsStore();

  try {
    // OPTIMIZATION: Skip data loading for public routes
    if (isPublicRoute(to.path) && !isPublicArticleRoute(to.path)) {
      return;
    }
    
    if (token) {
        // AUTHENTICATED ROUTES - Load data based on specific route
        const loadTasks: Array<Promise<void>> = [];
        
        console.log('[load-data] Starting data load for route:', {
          path: to.path,
          params: to.params,
          currentProjectsCount: projectsStore.projects.length
        });
        
        // === ORGANIZATIONS - Load for all authenticated routes ===
        // Organizations are needed for the organization switcher in header
        if (shouldRefreshData('organizations')) {
          console.log('[load-data] Loading organizations');
          loadTasks.push((async () => {
            await organizationsStore.retrieveOrganizations();
            markDataLoaded('organizations');
            
            // After loading organizations, load workspaces for the selected organization
            const selectedOrg = organizationsStore.getSelectedOrganization();
            if (selectedOrg && shouldRefreshData('workspaces')) {
              console.log('[load-data] Loading workspaces for organization', selectedOrg.id);
              await organizationsStore.retrieveWorkspaces(selectedOrg.id);
              markDataLoaded('workspaces');
            }
          })());
        } else {
          // If organizations are already loaded, still check if we need to refresh workspaces
          const selectedOrg = organizationsStore.getSelectedOrganization();
          if (selectedOrg && shouldRefreshData('workspaces')) {
            console.log('[load-data] Loading workspaces for cached organization', selectedOrg.id);
            loadTasks.push((async () => {
              await organizationsStore.retrieveWorkspaces(selectedOrg.id);
              markDataLoaded('workspaces');
            })());
          }
        }
        
        // === PROJECT ROUTES ===
        if (isProjectListRoute(to.path)) {
          // Only load projects for list page
          if (shouldRefreshProjects(projectsStore)) {
            console.log('[load-data] Loading projects for list page');
            loadTasks.push((async () => {
              await projectsStore.retrieveProjects();
              markDataLoaded('projects');
              
              // Pre-load organization members for the first project's organization
              // This covers the common case where user opens a project dialog
              if (projectsStore.projects.length > 0) {
                const firstProject = projectsStore.projects[0];
                if (firstProject.organization_id) {
                  console.log('[load-data] Pre-loading organization members for first project org', firstProject.organization_id);
                  try {
                    await organizationsStore.retrieveOrganizationMembers(firstProject.organization_id);
                  } catch (error) {
                    console.error('[load-data] Failed to pre-load organization members:', error);
                  }
                }
              }
            })());
          }
        } else if (isProjectDetailRoute(to.path)) {
          // Load projects + data sources for project detail
          // Always load projects if cache expired
          if (shouldRefreshProjects(projectsStore)) {
            console.log('[load-data] Loading projects for project detail');
            loadTasks.push(
              (async () => {
                await projectsStore.retrieveProjects();
                markDataLoaded('projects');
              })()
            );
          } else {
            console.log('[load-data] Skipping projects load - cache is fresh');
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
          console.log('[load-data] Data source route detected');
          // Load projects + data sources + data models for data source routes
          if (shouldRefreshProjects(projectsStore)) {
            console.log('[load-data] Loading projects for data source route');
            loadTasks.push(
              (async () => {
                await projectsStore.retrieveProjects();
                console.log('[load-data] Projects loaded:', projectsStore.projects.length);
                markDataLoaded('projects');
              })()
            );
          } else {
            console.log('[load-data] Skipping projects load - cache is fresh, current count:', projectsStore.projects.length);
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
          if (shouldRefreshProjects(projectsStore)) {
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
          if (shouldRefreshProjects(projectsStore)) {
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
          if (shouldRefreshProjects(projectsStore)) {
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
          // Load projects + data sources + data models for campaigns / marketing hub sub-routes
          if (shouldRefreshProjects(projectsStore)) {
            loadTasks.push(
              (async () => {
                await projectsStore.retrieveProjects();
                markDataLoaded('projects');
              })()
            );
          }
          
          // Extract projectId from route params
          const projectId = to.params.projectid ? parseInt(String(to.params.projectid), 10) : undefined;
          
          // Always load data sources and data models for marketing routes to enable sidebar menus
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
        } else if (isSettingsRoute(to.path)) {
          // Load projects + data sources + data models for settings page (needed for sidebar menu enabling)
          if (shouldRefreshProjects(projectsStore)) {
            loadTasks.push(
              (async () => {
                await projectsStore.retrieveProjects();
                markDataLoaded('projects');
              })()
            );
          }
          
          // Extract projectId from route params
          const projectId = to.params.projectid ? parseInt(String(to.params.projectid), 10) : undefined;
          
          // Always load data sources and data models for settings routes to enable sidebar menus
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
          
          // Load organization members and pending invitations for project settings/members management
          if (projectId && !isNaN(projectId)) {
            loadTasks.push(
              (async () => {
                // First ensure projects are loaded to get organization_id
                if (projectsStore.projects.length === 0) {
                  await projectsStore.retrieveProjects();
                }
                const project = projectsStore.projects.find(p => p.id === projectId);
                if (project?.organization_id) {
                  console.log('[load-data] Loading organization members for project', projectId);
                  await organizationsStore.retrieveOrganizationMembers(project.organization_id);
                }
              })(),
              (async () => {
                console.log('[load-data] Loading pending invitations for project', projectId);
                await projectsStore.retrievePendingInvitations(projectId);
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
        } else if (isAdminEnterpriseQueryRoute(to.path)) {
          // Only load enterprise queries
          if (shouldRefreshData('enterpriseQueries')) {
            loadTasks.push((async () => {
              await enterpriseQueryStore.retrieveEnterpriseQueries();
              markDataLoaded('enterpriseQueries');
            })());
          }
        }
        
        // Execute all load tasks in parallel
        if (loadTasks.length > 0) {
          console.log('[load-data] Waiting for', loadTasks.length, 'load tasks to complete...');
          await Promise.all(loadTasks);
          console.log('[load-data] All load tasks completed. Projects count:', projectsStore.projects.length);
        } else {
          console.log('[load-data] No load tasks needed');
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
