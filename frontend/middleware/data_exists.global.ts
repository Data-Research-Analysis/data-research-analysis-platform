import { useProjectsStore } from '@/stores/projects';
import { useDataSourceStore } from '@/stores/data_sources';
import { useDataModelsStore } from '@/stores/data_models';
import { useDashboardsStore } from '@/stores/dashboards';

export default defineNuxtRouteMiddleware(async (to, from) => {
  // Check if running on server side
  const isServer = typeof window === 'undefined'
  
  const token = getAuthToken();
  const projectsStore = useProjectsStore();
  const dataSourceStore = useDataSourceStore();
  const dataModelsStore = useDataModelsStore();
  const dashboardsStore = useDashboardsStore();
  
  if (!token) {
    if (to.name === 'public-dashboard-dashboardkey') {
        // Data fetching is handled by the page component using usePublicDashboard composable
        // No need to fetch here - just allow navigation
        return;
    }
  }

  if (to.name === 'projects-projectid-dashboards-create') {
    if (!dataModelsStore.getDataModelTables()?.length) {
      return navigateTo('/projects');
    }
  } else if (to.name === 'projects-projectid') {
    if (!projectsStore.getSelectedProject()) {
      return navigateTo('/projects');
    } else {
      const project = projectsStore.getSelectedProject();
      const projectIdParam = Array.isArray(to.params.projectid) ? parseInt(to.params.projectid[0]) : parseInt(to.params.projectid);
      if (project?.id !== projectIdParam) {
        return navigateTo('/projects');
      }
    }
  } else if (to.name === 'public-dashboard-dashboardkey') {
    // Public dashboards are accessible to anyone, even without authentication
    // The page component will handle fetching the dashboard data using the key
    // Don't check the user's dashboard store or redirect
    return;
  } else if (to.name === 'projects-projectid-data-sources-datasourceid-data-models' || to.name === 'projects-projectid-data-sources-datasourceid-data-models-create') {
    if (!projectsStore.getSelectedProject()) {
      return navigateTo('/projects');
    } else {
      const project = projectsStore.getSelectedProject();
      const dataSource = dataSourceStore.getSelectedDataSource();
      const projectIdParam = Array.isArray(to.params.projectid) ? parseInt(to.params.projectid[0]) : parseInt(to.params.projectid);
      const dataSourceIdParam = Array.isArray(to.params.datasourceid) ? parseInt(to.params.datasourceid[0]) : parseInt(to.params.datasourceid);
      if (project?.id === projectIdParam) {
        if (dataSource?.id !== dataSourceIdParam) {
          return navigateTo(`/projects/${project.id}`);
        }
      } else {
        return navigateTo('/projects');
      }
    }
  }
});
