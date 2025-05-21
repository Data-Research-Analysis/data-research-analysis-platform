<script setup>
import { useProjectsStore } from '@/stores/projects';
import { useDataModelsStore } from '@/stores/data_models';
const dataModelsStore = useDataModelsStore();
const projectsStore = useProjectsStore();
const route = useRoute();
const state = reactive({
    data_source_tables: [],
    data_model: {},
});
const project = computed(() => {
    return projectsStore.getSelectedProject();
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
    <div class="flex flex-col">
        <tabs :project-id="project.id"/>
        <div class="flex flex-col min-h-100 mb-10">
            <data-model-builder v-if="(state.data_source_tables && state.data_source_tables.length) && (state.data_model && state.data_model.query)" :data-source-tables="state.data_source_tables" :data-model="state.data_model" :is-edit-data-model="true" />
        </div>
    </div>
</template>