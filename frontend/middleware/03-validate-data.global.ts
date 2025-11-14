import { useProjectsStore } from '@/stores/projects';
import { useDataSourceStore } from '@/stores/data_sources';
import { useDataModelsStore } from '@/stores/data_models';
import { useDashboardsStore } from '@/stores/dashboards';
import { useArticlesStore } from '@/stores/articles';
import { useUserManagementStore } from '@/stores/user_management';

/**
 * Global middleware to validate data exists and set selected items based on route params
 * 
 * OPTIMIZED: Only validates data for routes with parameters.
 * Skips validation for routes without params to improve performance.
 * 
 * Order: authorization.global.ts -> load-data.global.ts -> validate-data.global.ts
 */

// Check if route has any relevant parameters
function hasRelevantParams(params: Record<string, any>): boolean {
  return !!(params.projectid || params.datasourceid || params.dashboardid || 
            params.articleid || params.userid || params.articleslug);
}

// Check if route needs validation
function needsValidation(path: string, params: Record<string, any>): boolean {
  // Skip public routes without params
  if (path === '/' || path === '/login' || path === '/register' || 
      path === '/privacy-policy' || path === '/terms-conditions' ||
      path.startsWith('/verify-email') || path.startsWith('/forgot-password') ||
      path.startsWith('/unsubscribe')) {
    return false;
  }
  
  // Skip list pages without params
  if (path === '/projects' || path === '/admin/articles' || 
      path === '/admin/users' || path === '/admin/private-beta-users' ||
      path === '/admin/database' || path === '/articles') {
    return false;
  }
  
  // Only validate if route has relevant params
  return hasRelevantParams(params);
}

export default defineNuxtRouteMiddleware(async (to, from) => {
  // INSTRUMENTATION: Track validation middleware timing
  const validateStartTime = import.meta.client ? performance.now() : 0
  if (import.meta.client) {
    console.log(`[03-validate-data] Started at ${validateStartTime.toFixed(2)}ms`)
  }
  
  // Skip during SSR
  if (typeof window === 'undefined') {
    return;
  }
  
  const token = getAuthToken();
  
  // OPTIMIZATION: Skip validation entirely for routes that don't need it
  if (!needsValidation(to.path, to.params)) {
    if (import.meta.client) {
      console.log(`[03-validate-data] Skipped - route has no params or doesn't need validation`)
    }
    return;
  }
  
  const projectsStore = useProjectsStore();
  const dataSourceStore = useDataSourceStore();
  const dataModelsStore = useDataModelsStore();
  const dashboardsStore = useDashboardsStore();
  const articlesStore = useArticlesStore();
  const userManagementStore = useUserManagementStore();
  
  // Skip validation for public dashboard - they handle their own data
  if (to.name === 'public-dashboard-dashboardkey') {
    if (import.meta.client) {
      console.log(`[03-validate-data] Skipped - public dashboard`)
    }
    return;
  }

  // Handle unauthenticated routes with params
  if (!token) {
    // Handle public article selection
    if (to.params.articleslug) {
      const articleSlug = String(to.params.articleslug);
      const article = articlesStore.getArticles().find((article) => article.article.slug === articleSlug);
      if (article) {
        articlesStore.setSelectedArticle(article);
        if (import.meta.client) {
          console.log(`[03-validate-data] Public article selected: ${articleSlug}`)
        }
      } else {
        return navigateTo('/articles');
      }
    }
    return;
  }

  // OPTIMIZATION: Only validate params that exist on this route
  
  // === PROJECT VALIDATION AND SELECTION ===
  if (to.params.projectid) {
    if (import.meta.client) console.log(`[03-validate-data] Validating projectid`)
    
    const projectId = parseInt(String(to.params.projectid));
    const project = projectsStore.getProjects().find((p) => p.id === projectId);
    
    if (!project) {
      if (import.meta.client) console.log(`[03-validate-data] Project not found, redirecting`)
      return navigateTo('/projects');
    }
    
    // Set selected project
    projectsStore.setSelectedProject(project);    
    await dataModelsStore.retrieveDataModelTables(projectId);
    
    if (import.meta.client) console.log(`[03-validate-data] Project validated: ${projectId}`)
  }

  // === DATA SOURCE VALIDATION AND SELECTION ===
  if (to.params.datasourceid) {
    if (import.meta.client) console.log(`[03-validate-data] Validating datasourceid`)
    
    const dataSourceId = parseInt(String(to.params.datasourceid));
    const dataSource = dataSourceStore.getDataSources().find((ds) => ds.id === dataSourceId);
    
    if (!dataSource) {
      const projectId = to.params.projectid;
      if (import.meta.client) console.log(`[03-validate-data] Data source not found, redirecting`)
      return navigateTo(`/projects/${projectId}`);
    }
    
    // Validate data source belongs to the current project
    const projectId = parseInt(String(to.params.projectid));
    const dsProjectId = dataSource.project_id || dataSource.project?.id;
    
    if (dsProjectId !== projectId) {
      if (import.meta.client) console.log(`[03-validate-data] Data source belongs to different project, redirecting`)
      return navigateTo(`/projects/${projectId}`);
    }
    
    // Set selected data source
    dataSourceStore.setSelectedDataSource(dataSource);
    
    if (import.meta.client) console.log(`[03-validate-data] Data source validated: ${dataSourceId}`)
  }

  // === DASHBOARD VALIDATION AND SELECTION ===
  if (to.params.dashboardid) {
    if (import.meta.client) console.log(`[03-validate-data] Validating dashboardid`)
    
    const dashboardId = parseInt(String(to.params.dashboardid));
    const dashboard = dashboardsStore.getDashboards().find((d) => d.id === dashboardId);
    
    if (!dashboard) {
      const projectId = to.params.projectid;
      if (import.meta.client) console.log(`[03-validate-data] Dashboard not found, redirecting`)
      return navigateTo(`/projects/${projectId}/dashboards`);
    }
    
    // Validate dashboard belongs to the current project
    const projectId = parseInt(String(to.params.projectid));
    const dashboardProjectId = dashboard.project_id || dashboard.project?.id;
    
    if (dashboardProjectId !== projectId) {
      if (import.meta.client) console.log(`[03-validate-data] Dashboard belongs to different project, redirecting`)
      return navigateTo(`/projects/${projectId}/dashboards`);
    }
    
    // Set selected dashboard
    dashboardsStore.setSelectedDashboard(dashboard);
    
    if (import.meta.client) console.log(`[03-validate-data] Dashboard validated: ${dashboardId}`)
  }

  // === ARTICLE VALIDATION AND SELECTION (Admin) ===
  if (to.params.articleid) {
    if (import.meta.client) console.log(`[03-validate-data] Validating articleid`)
    
    const articleId = parseInt(String(to.params.articleid));
    const article = articlesStore.getArticles().find((a) => a.article.id === articleId);
    
    if (!article) {
      if (import.meta.client) console.log(`[03-validate-data] Article not found, redirecting`)
      return navigateTo('/admin/articles');
    }
    
    // Set selected article
    articlesStore.setSelectedArticle(article);
    
    if (import.meta.client) console.log(`[03-validate-data] Article validated: ${articleId}`)
  }

  // === USER VALIDATION AND SELECTION (Admin) ===
  if (to.params.userid) {
    if (import.meta.client) console.log(`[03-validate-data] Validating userid`)
    
    const userId = parseInt(String(to.params.userid));
    const user = userManagementStore.getUsers().find((u) => u.id === userId);
    
    if (!user) {
      if (import.meta.client) console.log(`[03-validate-data] User not found, redirecting`)
      return navigateTo('/admin/users');
    }
    
    // Set selected user
    userManagementStore.setSelectedUser(user);
    
    if (import.meta.client) console.log(`[03-validate-data] User validated: ${userId}`)
  }

  // === SPECIFIC ROUTE VALIDATIONS ===
  
  // Creating dashboard requires data models
  if (to.name === 'projects-projectid-dashboards-create') {
    if (!dataModelsStore.getDataModelTables()?.length) {
      if (import.meta.client) console.log(`[03-validate-data] No data models for dashboard creation, redirecting`)
      return navigateTo(`/projects/${to.params.projectid}`);
    }
  }
  
  // INSTRUMENTATION: Track validation middleware completion
  if (import.meta.client) {
    const validateEndTime = performance.now()
    const duration = validateEndTime - validateStartTime
    console.log(`[03-validate-data] Completed at ${validateEndTime.toFixed(2)}ms (duration: ${duration.toFixed(2)}ms)`)
  }
});
