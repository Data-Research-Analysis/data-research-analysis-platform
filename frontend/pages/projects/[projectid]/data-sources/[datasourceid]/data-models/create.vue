<script setup>
import { useProjectsStore } from '@/stores/projects';
import { useDataSourceStore } from '@/stores/data_sources';
import { useAIDataModelerStore } from '@/stores/ai-data-modeler';
import { useProjectPermissions } from '@/composables/useProjectPermissions';

const projectsStore = useProjectsStore();
const dataSourceStore = useDataSourceStore();
const aiDataModelerStore = useAIDataModelerStore();
const route = useRoute();
const router = useRouter();
const state = reactive({
    data_source_tables: [],
 });
 const project = computed(() => {
    return projectsStore.getSelectedProject();
});
const dataSource = computed(() => {
    return dataSourceStore.getSelectedDataSource();
});

// Check permissions - viewers cannot create data models
const projectId = computed(() => parseInt(route.params.projectid));
const permissions = useProjectPermissions(projectId.value);

// Guard: redirect if user doesn't have create permission
if (import.meta.client) {
    watch(() => permissions.canCreate.value, (canCreate) => {
        if (canCreate === false) {
            console.warn('[Data Model Create] User does not have create permission, redirecting...');
            router.push(`/projects/${projectId.value}/data-models`);
        }
    }, { immediate: true });
}

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
            <data-model-builder v-if="(state.data_source_tables && state.data_source_tables.length)" :data-source-tables="state.data_source_tables" :data-source="dataSource" :read-only="!permissions.canCreate.value"  />
        </div>
    </div>
</template>