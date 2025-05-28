<script setup>
import {useProjectsStore} from '@/stores/projects';
import { useDataSourceStore } from '@/stores/data_sources';
import { useDataModelsStore } from '@/stores/data_models';
import { useVisualizationsStore } from '@/stores/visualizations';
const projectsStore = useProjectsStore();
const dataSourceStore = useDataSourceStore();
const dataModelsStore = useDataModelsStore();
const visualizationsStore = useVisualizationsStore();
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

    if (projectsStore?.getSelectedProject()?.id) {
        await dataModelsStore.retrieveDataModelTables(projectsStore?.getSelectedProject()?.id);
    }
    // await visualizationsStore.retrieveVisualizations();
    if (value?.params?.projectid) {
        const projectId = parseInt(value.params.projectid);
        const project = projectsStore.getProjects().find((project) => project.id === projectId);
        projectsStore.setSelectedProject(project);
    }
  },
);
onMounted(async () => {
    state.authenticated = isAuthenticated();
    await projectsStore.retrieveProjects();
    await dataSourceStore.retrieveDataSources();
    await dataModelsStore.retrieveDataModels();
    console.log('mounted projectsStore.getSelectedProject()', projectsStore?.getSelectedProject()?.id || null);
    if (projectsStore?.getSelectedProject()?.id) {
        await dataModelsStore.retrieveDataModelTables(projectsStore?.getSelectedProject()?.id);
    }
    // await visualizationsStore.retrieveVisualizations();
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