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
        const dashboardKey = to.params.dashboardkey as string;
        console.log('dashboardKey', dashboardKey);
        
        // Handle fetch errors gracefully (e.g., during SSR when backend is not accessible)
        try {
          const dashboard = await dashboardsStore.retrievePublicDashboard(dashboardKey);
          dashboardsStore.setSelectedDashboard(dashboard.dashboard);
          console.log('dashboard', dashboard);
          if (dashboard) {
              return;
          } else {
            return navigateTo('/login');
          }
        } catch (error) {
          console.error('Failed to retrieve public dashboard:', error);
          // During SSR, allow the route to continue (will retry on client)
          if (isServer) {
            return;
          } else {
            return navigateTo('/login');
          }
        }
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
    const dashboardKey = to.params.dashboardkey as string;
    const dashboards = dashboardsStore.getDashboards();
    const dashboard = dashboards.find((dashboard) => dashboard.export_meta_data.filter((meta) => decodeURIComponent(meta.key) === decodeURIComponent(dashboardKey)).length > 0);
    if (dashboard) {
        dashboardsStore.clearSelectedDashboard();
        dashboardsStore.setSelectedDashboard(dashboard);
    } else {
      return navigateTo('/projects');
    }
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
