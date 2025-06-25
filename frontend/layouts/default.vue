<script setup>
import {useProjectsStore} from '@/stores/projects';
import { useDataSourceStore } from '@/stores/data_sources';
import { useDataModelsStore } from '@/stores/data_models';
import { useDashboardsStore } from '@/stores/dashboards';
const projectsStore = useProjectsStore();
const dataSourceStore = useDataSourceStore();
const dataModelsStore = useDataModelsStore();
const dashboardsStore = useDashboardsStore();
const route = useRoute();
const state = reactive({
    authenticated: false,
})
watch(
  route,
  async (value, oldValue) => {
    state.authenticated = isAuthenticated();
    await projectsStore.retrieveProjects();
    await dataSourceStore.retrieveDataSources();
    await dataModelsStore.retrieveDataModels();
    await dashboardsStore.retrieveDashboards();

    if (projectsStore?.getSelectedProject()?.id) {
        await dataModelsStore.retrieveDataModelTables(projectsStore?.getSelectedProject()?.id);
    }
    if (value?.params?.projectid) {
        const projectId = parseInt(value.params.projectid);
        const project = projectsStore.getProjects().find((project) => project.id === projectId);
        projectsStore.setSelectedProject(project);
        if (value?.params?.dashboardid) {
            const dashboardId = parseInt(value.params.dashboardid);
            const dashboard = dashboardsStore.getDashboards().find((dashboard) => dashboard.id === dashboardId);
            dashboardsStore.clearSelectedDashboard();
            dashboardsStore.setSelectedDashboard(dashboard);
        }
    }
  },
);
onMounted(async () => {
    state.authenticated = isAuthenticated();
    await projectsStore.retrieveProjects();
    await dataSourceStore.retrieveDataSources();
    await dataModelsStore.retrieveDataModels();
    await dashboardsStore.retrieveDashboards();
    if (projectsStore?.getSelectedProject()?.id) {
        await dataModelsStore.retrieveDataModelTables(projectsStore?.getSelectedProject()?.id);
    }
    if (route?.params?.projectid) {
        const projectId = parseInt(route.params.projectid);
        const project = projectsStore.getProjects().find((project) => project.id === projectId);
        projectsStore.setSelectedProject(project);
        if (route?.params?.dashboardid) {
            const dashboardId = parseInt(route.params.dashboardid);
            const dashboard = dashboardsStore.getDashboards().find((dashboard) => dashboard.id === dashboardId);
            dashboardsStore.clearSelectedDashboard();
            dashboardsStore.setSelectedDashboard(dashboard);
        }
    }
})
</script>
<template>
    <div class="relative">
        <header-nav />
        <breadcrumbs v-if="state.authenticated" />
        <div class="flex "
        :class="{
            'flex-row': state.authenticated,
            'flex-col': !state.authenticated,
        }"
        >
        <div class="w-full">
                <slot></slot>
            </div>
        </div>
        <footer-nav />
    </div>
</template>