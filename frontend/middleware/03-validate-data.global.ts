import { useProjectsStore } from '@/stores/projects';
import { useDataSourceStore } from '@/stores/data_sources';
import { useDataModelsStore } from '@/stores/data_models';
import { useDashboardsStore } from '@/stores/dashboards';
import { useArticlesStore } from '@/stores/articles';
import { useUserManagementStore } from '@/stores/user_management';

/**
 * Global middleware to validate data exists and set selected items based on route params
 * 
 * This middleware runs after load-data.global.ts has loaded all data into stores.
 * It validates that required data exists and sets selected project, dashboard, 
 * article, etc. based on route parameters.
 * 
 * Order: authorization.global.ts -> load-data.global.ts -> data_exists.global.ts
 */
export default defineNuxtRouteMiddleware(async (to, from) => {
  // Skip during SSR
  if (typeof window === 'undefined') {
    return;
  }
  
  const token = getAuthToken();
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

  // Skip validation for unauthenticated routes
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

  // === PROJECT VALIDATION AND SELECTION ===
  if (to.params.projectid) {
    const projectId = parseInt(String(to.params.projectid));
    const project = projectsStore.getProjects().find((p) => p.id === projectId);
    
    if (!project) {
      console.warn(`Project ${projectId} not found, redirecting to /projects`);
      return navigateTo('/projects');
    }
    
    // Set selected project
    projectsStore.setSelectedProject(project);
    
    // Load data model tables for this project if not already loaded
    if (!dataModelsStore.getDataModelTables()?.length) {
      await dataModelsStore.retrieveDataModelTables(projectId);
    }
  }

  // === DATA SOURCE VALIDATION AND SELECTION ===
  if (to.params.datasourceid) {
    const dataSourceId = parseInt(String(to.params.datasourceid));
    const dataSource = dataSourceStore.getDataSources().find((ds) => ds.id === dataSourceId);
    
    if (!dataSource) {
      console.warn(`Data source ${dataSourceId} not found, redirecting to project`);
      const projectId = to.params.projectid;
      return navigateTo(`/projects/${projectId}`);
    }
    
    // Validate data source belongs to the current project
    const projectId = parseInt(String(to.params.projectid));
    const dsProjectId = dataSource.project_id || dataSource.project?.id;
    
    if (dsProjectId !== projectId) {
      console.warn(`Data source ${dataSourceId} doesn't belong to project ${projectId}`);
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
      console.warn(`Dashboard ${dashboardId} not found, redirecting to dashboards list`);
      const projectId = to.params.projectid;
      return navigateTo(`/projects/${projectId}/dashboards`);
    }
    
    // Validate dashboard belongs to the current project
    const projectId = parseInt(String(to.params.projectid));
    const dashboardProjectId = dashboard.project_id || dashboard.project?.id;
    
    if (dashboardProjectId !== projectId) {
      console.warn(`Dashboard ${dashboardId} doesn't belong to project ${projectId}`);
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
      console.warn(`Article ${articleId} not found, redirecting to articles list`);
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
      console.warn(`User ${userId} not found, redirecting to users list`);
      return navigateTo('/admin/users');
    }
    
    // Set selected user
    userManagementStore.setSelectedUser(user);
  }

  // === SPECIFIC ROUTE VALIDATIONS ===
  
  // Creating dashboard requires data models
  if (to.name === 'projects-projectid-dashboards-create') {
    if (!dataModelsStore.getDataModelTables()?.length) {
      console.warn('No data models available, cannot create dashboard');
      return navigateTo(`/projects/${to.params.projectid}`);
    }
  }
});
