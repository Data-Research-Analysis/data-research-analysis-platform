<script setup>
import { useProjectsStore } from '@/stores/projects';
import { useDataSourceStore } from '@/stores/data_sources';
import { useAIDataModelerStore } from '@/stores/ai-data-modeler';

const projectsStore = useProjectsStore();
const dataSourceStore = useDataSourceStore();
const aiDataModelerStore = useAIDataModelerStore();
const route = useRoute();
const state = reactive({
    data_source_tables: [],
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
onMounted(async () => {
   const dataSourceId = route.params.datasourceid;
   await getDataSourceTables(dataSourceId);
});

onBeforeUnmount(() => {
    // Clean up Redis session when leaving create page without saving
    // Only cleanup if session exists and was not saved (source is not 'database')
    if (aiDataModelerStore.currentDataSourceId && 
        aiDataModelerStore.sessionSource !== 'database' &&
        aiDataModelerStore.messages.length > 0) {
        console.log('[Create Data Model] Cleaning up unsaved AI session');
        aiDataModelerStore.cancelSession();
    }
});
</script>
<template>
    <div class="flex flex-col">
        <tabs :project-id="project.id"/>
        <div class="flex flex-col min-h-100 mb-10">
            <data-model-builder v-if="(state.data_source_tables && state.data_source_tables.length)" :data-source-tables="state.data_source_tables" :data-source="dataSource"  />
        </div>
    </div>
</template>