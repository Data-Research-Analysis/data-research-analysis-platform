import { useProjectsStore } from '@/stores/projects';
import { useDataSourceStore } from '@/stores/data_sources';
import { useDataModelsStore } from '@/stores/data_models';
export default defineNuxtRouteMiddleware(async (to, from) => {
  const projectsStore = useProjectsStore();
  const dataSourceStore = useDataSourceStore();
  const dataModelsStore = useDataModelsStore();
  if (to.name === 'projects-projectid-visualizations-create') {
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
  } else if (to.name === 'projects-projectid-data-sources-datasourceid-data-models' || to.name === 'projects-projectid-data-sources-datasourceid-data-models-create') {
    if (!projectsStore.getSelectedProject()) {
      return navigateTo('/projects');
    } else {
      console.log('in else')
      const project = projectsStore.getSelectedProject();
      const dataSource = dataSourceStore.getSelectedDataSource();
      const projectIdParam = Array.isArray(to.params.projectid) ? parseInt(to.params.projectid[0]) : parseInt(to.params.projectid);
      const dataSourceIdParam = Array.isArray(to.params.datasourceid) ? parseInt(to.params.datasourceid[0]) : parseInt(to.params.datasourceid);
      console.log('to', to);
      console.log('projectIdParam', projectIdParam);
      console.log('dataSourceIdParam', dataSourceIdParam);
      console.log('project', project?.id);
      console.log('dataSource', dataSource?.id);
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
