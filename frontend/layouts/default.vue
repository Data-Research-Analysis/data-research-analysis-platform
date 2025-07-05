<script setup>
import {useProjectsStore} from '@/stores/projects';
import { useDataSourceStore } from '@/stores/data_sources';
import { useDataModelsStore } from '@/stores/data_models';
import { useDashboardsStore } from '@/stores/dashboards';
import { useArticlesStore } from '@/stores/articles';
import { useLoggedInUserStore } from "@/stores/logged_in_user";

const projectsStore = useProjectsStore();
const dataSourceStore = useDataSourceStore();
const dataModelsStore = useDataModelsStore();
const dashboardsStore = useDashboardsStore();
const articlesStore = useArticlesStore();
const loggedInUserStore = useLoggedInUserStore();
const route = useRoute();
const state = reactive({
    authenticated: false,
})
const loggedInUser = computed(() => {
    return loggedInUserStore.getLoggedInUser();
});
const isUserAdmin = computed(() => {
    return loggedInUser.value?.user_type === 'admin';
});
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
    await articlesStore.retrieveArticles();
    await articlesStore.retrieveCategories();
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
    await articlesStore.retrieveArticles();
    await articlesStore.retrieveCategories();    
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