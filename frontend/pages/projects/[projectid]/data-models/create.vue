<script setup lang="ts">
import { ref, onMounted, computed } from 'vue';
import { useRoute } from 'vue-router';
import { useDataModelsStore } from '~/stores/data_models';
import { useProjectsStore } from '~/stores/projects';

const route = useRoute();
const dataModelsStore = useDataModelsStore();
const projectsStore = useProjectsStore();

const projectId = ref<number>(parseInt(route.params.projectid as string));
const dataSourceTables = ref<any[]>([]);
const loading = ref(false);
const error = ref<string | null>(null);

const project = computed(() => {
    return projectsStore.getSelectedProject();
});

const fetchAllTables = async () => {
    loading.value = true;
    error.value = null;
    
    try {
        console.log('[CrossSource] Fetching all tables for project:', projectId.value);
        
        const response = await dataModelsStore.fetchAllProjectTables(projectId.value);
        
        if (response && response.length > 0) {
            // Transform the response: flatten the tables array from each data source
            // The API returns: [{dataSourceId, dataSourceName, dataSourceType, tables: [...]}]
            // The data-model-builder expects: [...tables with data_source info]
            const allTables: any[] = [];
            
            response.forEach((dataSource: any) => {
                if (dataSource.tables && Array.isArray(dataSource.tables)) {
                    dataSource.tables.forEach((table: any) => {
                        // Add data source metadata to each table if not already present
                        allTables.push({
                            ...table,
                            data_source_id: table.data_source_id || dataSource.dataSourceId,
                            data_source_name: table.data_source_name || dataSource.dataSourceName,
                            data_source_type: table.data_source_type || dataSource.dataSourceType
                        });
                    });
                }
            });
            
            dataSourceTables.value = allTables;
            console.log('[CrossSource] Loaded', allTables.length, 'tables from', response.length, 'data sources');
        } else {
            console.warn('[CrossSource] No data sources found for project');
            dataSourceTables.value = [];
        }
    } catch (err: any) {
        console.error('[CrossSource] Error fetching all tables:', err);
        error.value = err.message || 'Failed to load data sources. Please try again.';
        dataSourceTables.value = [];
    } finally {
        loading.value = false;
    }
};

onMounted(() => {
    fetchAllTables();
});
</script>

<template>
    <div class="flex flex-col">
        <tabs v-if="project && project.id" :project-id="project.id" />
        
        <div class="flex flex-col min-h-100 mb-10">
            <!-- Data Model Builder with cross-source mode -->
            <data-model-builder 
                v-if="dataSourceTables && dataSourceTables.length > 0"
                :data-source-tables="dataSourceTables"
                :is-cross-source="true"
                :project-id="projectId" />
            
            <!-- Loading State -->
            <div v-else-if="loading" class="flex flex-col items-center justify-center h-96 ml-10 mr-10">
                <div class="animate-spin rounded-full h-16 w-16 border-b-2 border-indigo-600"></div>
                <p class="text-lg font-semibold text-gray-700 mt-4">Loading tables from all data sources...</p>
                <p class="text-sm text-gray-500">This may take a moment</p>
            </div>

            <!-- Error State -->
            <div v-else-if="error" class="ml-10 mr-10 mt-10">
                <div class="bg-red-50 border-l-4 border-red-400 p-6 rounded-lg shadow-md max-w-2xl">
                    <div class="flex">
                        <div class="flex-shrink-0">
                            <font-awesome icon="fas fa-exclamation-circle" class="text-red-400 text-2xl" />
                        </div>
                        <div class="ml-3 flex-1">
                            <h3 class="text-lg font-semibold text-red-800">Unable to Load Data Sources</h3>
                            <p class="mt-2 text-sm text-red-700">{{ error }}</p>
                            <div class="mt-4">
                                <button 
                                    @click="fetchAllTables"
                                    class="px-4 py-2 bg-white border border-red-300 rounded-md text-sm font-medium text-red-700 hover:bg-red-50">
                                    Retry
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            <!-- Empty State -->
            <div v-else class="flex items-center justify-center min-h-96 mt-10">
                <div class="bg-white rounded-lg shadow-md p-8 text-center max-w-2xl mx-auto">
                    <font-awesome icon="fas fa-database" class="text-gray-400 text-6xl mb-4" />
                    <h3 class="text-xl font-semibold text-gray-900 mt-4">No Data Sources Found</h3>
                    <p class="text-sm text-gray-500 mt-2">
                        Add at least 2 data sources to your project to create cross-source data models.
                    </p>
                </div>
            </div>
        </div>
    </div>
</template>
