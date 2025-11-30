<script setup>
import { useProjectsStore } from '@/stores/projects';
import { useDataModelsStore } from '@/stores/data_models';
import { useDataSourceStore } from '@/stores/data_sources';
const dataModelsStore = useDataModelsStore();
const projectsStore = useProjectsStore();
const dataSourceStore = useDataSourceStore();
const route = useRoute();
const state = reactive({
    data_source_tables: [],
    data_model: {},
});
const project = computed(() => {
    return projectsStore.getSelectedProject();
});
const dataSource = computed(() => {
    return dataSourceStore.getSelectedDataSource();
});
async function getDataSourceTables(dataSourceId) {
    const token = getAuthToken();
    const url = `${baseUrl()}/data-source/tables/${dataSourceId}`;
    const response = await fetch(url, {
        method: "GET",
        headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${token}`,
            "Authorization-Type": "auth",
        },
    });
    const data = await response.json();
    state.data_source_tables = data
}
function getDataModel(dataModelId) {
    state.data_model = {};
    state.data_model = dataModelsStore.getDataModels().find((dataModel) => dataModel.id === dataModelId);
}
onMounted(async () => {
   const dataSourceId = route.params.datasourceid;
   const dataModelId = route.params.datamodelid;
   await getDataSourceTables(dataSourceId);
    getDataModel(parseInt(dataModelId));
});
</script>
<template>
    <div v-if="project" class="flex flex-col">
        <tabs :project-id="project.id"/>
        <div class="flex flex-col min-h-100 mb-10">
            <data-model-builder v-if="(state.data_source_tables && state.data_source_tables.length) && (state.data_model && state.data_model.query)" :data-source-tables="state.data_source_tables" :data-model="state.data_model" :data-source="dataSource" :is-edit-data-model="true" />
        </div>
    </div>
    
    <!-- Loading state when project not loaded -->
    <div v-else class="flex items-center justify-center min-h-screen">
        <div class="text-center">
            <div class="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-primary-blue-500 mb-4"></div>
            <p class="text-gray-600">Loading data model...</p>
        </div>
    </div>
</template>