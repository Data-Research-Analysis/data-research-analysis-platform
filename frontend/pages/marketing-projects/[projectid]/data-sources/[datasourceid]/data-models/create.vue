<script setup>

definePageMeta({ layout: 'marketing-project' });
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
    data_source_tables: null, // null initially to show loading state
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
            router.push(`/marketing-projects/${projectId.value}/data-models`);
        }
    }, { immediate: true });
}

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
    <div v-if="project" class="flex flex-col">
        <tab-content-panel :corners="['top-right', 'bottom-left', 'bottom-right']">
            <div class="flex flex-col min-h-100 mb-10">
                <!-- Always show data-model-builder if we have the data_source_tables array (even if empty) -->
                <data-model-builder 
                    v-if="state.data_source_tables !== null" 
                    :data-source-tables="state.data_source_tables" 
                    :data-source="dataSource" 
                    :read-only="!permissions.canCreate.value" />
                
                <!-- Loading state -->
                <div v-else class="flex flex-col items-center justify-center h-96 ml-10 mr-10">
                    <div class="animate-spin rounded-full h-16 w-16 border-b-2 border-indigo-600"></div>
                    <p class="text-lg font-semibold text-gray-700 mt-4">Loading tables...</p>
                </div>
            </div>
        </tab-content-panel>
    </div>
</template>