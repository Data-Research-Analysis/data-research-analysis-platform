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
  // Skip during SSR
  if (typeof window === 'undefined') {
    return;
  }
  
  const token = getAuthToken();
  
  // OPTIMIZATION: Skip validation entirely for routes that don't need it
  if (!needsValidation(to.path, to.params)) {
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
      } else {
        return navigateTo('/articles');
      }
    }
    return;
  }

  // OPTIMIZATION: Only validate params that exist on this route
  
  // === PROJECT VALIDATION AND SELECTION ===
  if (to.params.projectid) {
    const projectId = parseInt(String(to.params.projectid));
    const allProjects = projectsStore.getProjects();
    
    console.log('[validate-data] Validating project:', {
      projectId,
      projectsCount: allProjects.length,
      projectIds: allProjects.map(p => p.id),
      route: to.path
    });
    
    const project = allProjects.find((p) => p.id === projectId);
    
    if (!project) {
      console.log('[validate-data] Project not found!', {
        projectId,
        hasProjects: allProjects.length > 0,
        willRedirect: allProjects.length > 0
      });
      
      // Project not found - only redirect if we have ANY projects loaded
      // If projects array is empty, it means data hasn't loaded yet, so allow the route
      if (allProjects.length > 0) {
        console.log('[validate-data] REDIRECTING to /projects - project not in list');
        return navigateTo('/projects');
      }
      // Otherwise, let the page load and handle the missing project itself
      console.log('[validate-data] Allowing navigation - no projects loaded yet');
      return;
    }
    
    console.log('[validate-data] Project found, setting as selected:', project.name);
    
    // Set selected project
    projectsStore.setSelectedProject(project);    
    await dataModelsStore.retrieveDataModelTables(projectId);
  }

  // === DATA SOURCE VALIDATION AND SELECTION ===
  if (to.params.datasourceid) {
    const dataSourceId = parseInt(String(to.params.datasourceid));
    const dataSource = dataSourceStore.getDataSources().find((ds) => ds.id === dataSourceId);
    
    if (!dataSource) {
      // Data source not found - only redirect if we have ANY data sources loaded
      const allDataSources = dataSourceStore.getDataSources();
      if (allDataSources.length > 0) {
        const projectId = to.params.projectid;
        return navigateTo(`/projects/${projectId}`);
      }
      // Otherwise, let the page load and handle the missing data source itself
      return;
    }
    
    // Validate data source belongs to the current project
    const projectId = parseInt(String(to.params.projectid));
    const dsProjectId = dataSource.project_id || dataSource.project?.id;
    
    if (dsProjectId !== projectId) {
      return navigateTo(`/projects/${projectId}`);
    }
    
    // Set selected data source
    dataSourceStore.setSelectedDataSource(dataSource);
  }

  // === DASHBOARD VALIDATION AND SELECTION ===
  if (to.params.dashboardid) {
    const dashboardId = parseInt(String(to.params.dashboardid));
    const dashboard = dashboardsStore.getDashboards().find((d) => d.id === dashboardId);
    
    if (!dashboard) {
      // Dashboard not found - only redirect if we have ANY dashboards loaded
      const allDashboards = dashboardsStore.getDashboards();
      if (allDashboards.length > 0) {
        const projectId = to.params.projectid;
        return navigateTo(`/projects/${projectId}/dashboards`);
      }
      // Otherwise, let the page load and handle the missing dashboard itself
      return;
    }
    
    // Validate dashboard belongs to the current project
    const projectId = parseInt(String(to.params.projectid));
    const dashboardProjectId = dashboard.project_id || dashboard.project?.id;
    
    if (dashboardProjectId !== projectId) {
      return navigateTo(`/projects/${projectId}/dashboards`);
    }
    
    // Set selected dashboard
    dashboardsStore.setSelectedDashboard(dashboard);
  }

  // === ARTICLE VALIDATION AND SELECTION (Admin) ===
  if (to.params.articleid) {
    const articleId = parseInt(String(to.params.articleid));
    const article = articlesStore.getArticles().find((a) => a.article.id === articleId);
    
    if (!article) {
      return navigateTo('/admin/articles');
    }
    
    // Set selected article
    articlesStore.setSelectedArticle(article);
  }

  // === USER VALIDATION AND SELECTION (Admin) ===
  if (to.params.userid) {
    const userId = parseInt(String(to.params.userid));
    const user = userManagementStore.getUsers().find((u) => u.id === userId);
    
    if (!user) {
      return navigateTo('/admin/users');
    }
    
    // Set selected user
    userManagementStore.setSelectedUser(user);
  }

  // === SPECIFIC ROUTE VALIDATIONS ===
  
  // Creating dashboard requires data models
  if (to.name === 'projects-projectid-dashboards-create') {
    if (!dataModelsStore.getDataModelTables()?.length) {
      return navigateTo(`/projects/${to.params.projectid}`);
    }
  }
});
