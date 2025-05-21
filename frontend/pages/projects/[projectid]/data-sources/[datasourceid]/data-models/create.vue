<script setup>
import { useProjectsStore } from '@/stores/projects';
const projectsStore = useProjectsStore();
const route = useRoute();
const state = reactive({
    data_source_tables: [],
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
onMounted(async () => {
   const dataSourceId = route.params.datasourceid;
   await getDataSourceTables(dataSourceId);
});
</script>
<template>
    <div class="flex flex-col">
        <tabs :project-id="project.id"/>
        <div class="flex flex-col min-h-100 mb-10">
            <data-model-builder v-if="(state.data_source_tables && state.data_source_tables.length)" :data-source-tables="state.data_source_tables"  />
        </div>
    </div>
</template>