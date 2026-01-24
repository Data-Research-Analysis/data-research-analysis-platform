<script setup>
import { useProjectsStore } from '@/stores/projects';
import { useDataModelsStore } from '@/stores/data_models';
import { useDataSourceStore } from '@/stores/data_sources';
import { useProjectPermissions } from '@/composables/useProjectPermissions';
const dataModelsStore = useDataModelsStore();
const projectsStore = useProjectsStore();
const dataSourceStore = useDataSourceStore();
const route = useRoute();
const state = reactive({
    data_source_tables: null, // null initially to show loading state
    data_model: {},
});
const project = computed(() => {
    return projectsStore.getSelectedProject();
});
const dataSource = computed(() => {
    return dataSourceStore.getSelectedDataSource();
});

// Check permissions
const projectId = computed(() => parseInt(route.params.projectid));
const permissions = useProjectPermissions(projectId.value);

async function getDataSourceTables(dataSourceId) {
    const token = getAuthToken();
    const url = `${baseUrl()}/data-source/tables/${dataSourceId}`;
    const data = await $fetch(url, {
        headers: {
            "Authorization": `Bearer ${token}`,
            "Authorization-Type": "auth",
        },
    });
    // Ensure we always set an array (even if empty) so the component can handle it
    state.data_source_tables = Array.isArray(data) ? data : [];
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
            <!-- Show builder if we have tables data (even if empty) and data model -->
            <data-model-builder 
                v-if="state.data_source_tables !== null && state.data_model && state.data_model.query" 
                :data-source-tables="state.data_source_tables" 
                :data-model="state.data_model" 
                :data-source="dataSource" 
                :is-edit-data-model="true" 
                :read-only="!permissions.canUpdate.value" />
            
            <!-- Loading state -->
            <div v-else-if="state.data_source_tables === null" class="flex flex-col items-center justify-center h-96 ml-10 mr-10">
                <div class="animate-spin rounded-full h-16 w-16 border-b-2 border-indigo-600"></div>
                <p class="text-lg font-semibold text-gray-700 mt-4">Loading tables...</p>
            </div>
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