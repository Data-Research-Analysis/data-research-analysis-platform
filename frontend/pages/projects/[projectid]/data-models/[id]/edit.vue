<script setup lang="ts">
import { useProjectsStore } from '@/stores/projects';
import { useDataModelsStore } from '@/stores/data_models';
import type { IDataSourceWithTables, ITableWithSource } from '@/types/ICrossSourceData';
import type { IDataModel } from '@/types/IDataModel';
const dataModelsStore = useDataModelsStore();
const projectsStore = useProjectsStore();
const route = useRoute();
const state = reactive<{
    data_source_tables: ITableWithSource[];
    data_model: IDataModel | null;
    loading: boolean;
}>({
    data_source_tables: [],
    data_model: null,
    loading: true,
});
const project = computed(() => {
    return projectsStore.getSelectedProject();
});
const projectId = computed(() => parseInt(route.params.projectid as string));
const dataModelId = computed(() => parseInt(route.params.id as string));

async function getAllProjectTables() {
    try {
        console.log('[CrossSource] Fetching all tables for project:', projectId.value);
        
        const response = await dataModelsStore.fetchAllProjectTables(projectId.value);
        
        if (response && response.length > 0) {
            // Transform the response: flatten the tables array from each data source
            // The API returns: [{dataSourceId, dataSourceName, dataSourceType, tables: [...]}]
            // The data-model-builder expects: [...tables with data_source info]
            const allTables: ITableWithSource[] = [];
            
            response.forEach((dataSource: IDataSourceWithTables) => {
                if (dataSource.tables && Array.isArray(dataSource.tables)) {
                    dataSource.tables.forEach((table) => {
                        // Add data source metadata to each table
                        allTables.push({
                            ...table,
                            data_source_id: dataSource.dataSourceId,
                            data_source_name: dataSource.dataSourceName,
                            data_source_type: dataSource.dataSourceType
                        });
                    });
                }
            });
            
            state.data_source_tables = allTables;
            console.log('[CrossSource] Loaded', allTables.length, 'tables from', response.length, 'data sources');
        } else {
            console.warn('[CrossSource] No data sources found for project');
            state.data_source_tables = [];
        }
    } catch (error) {
        console.error('Error fetching project tables:', error);
        state.data_source_tables = [];
    }
}

function getDataModel(dataModelId: number) {
    state.data_model = null;
    state.data_model = dataModelsStore.getDataModels().find((dataModel) => dataModel.id === dataModelId) || null;
}

onMounted(async () => {
    state.loading = true;
    try {
        // Fetch data models first
        await dataModelsStore.retrieveDataModels();
        
        // Get the specific data model
        getDataModel(dataModelId.value);
        
        // Fetch all project tables for cross-source model building
        await getAllProjectTables();
    } finally {
        state.loading = false;
    }
});
</script>
<template>
    <div v-if="project" class="flex flex-col">
        <tabs :project-id="project.id"/>
        <div class="flex flex-col min-h-100 mb-10">
            <!-- Cross-source data model builder -->
            <data-model-builder 
                v-if="!state.loading && state.data_source_tables.length > 0 && state.data_model?.sql_query" 
                :data-source-tables="state.data_source_tables"
                :data-model="state.data_model" 
                :is-cross-source="true"
                :is-edit-data-model="true"
                :project-id="projectId"
            />
            
            <!-- Loading state -->
            <div v-else-if="state.loading" class="flex items-center justify-center min-h-[400px]">
                <div class="text-center">
                    <div class="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-primary-blue-500 mb-4"></div>
                    <p class="text-gray-600">Loading cross-source data model...</p>
                </div>
            </div>
            
            <!-- Error state -->
            <div v-else class="flex items-center justify-center min-h-[400px]">
                <div class="text-center">
                    <font-awesome icon="fas fa-exclamation-triangle" class="text-red-500 text-5xl mb-4" />
                    <p class="text-lg font-semibold text-gray-900">Unable to load data model</p>
                    <p class="text-sm text-gray-500 mt-2">The data model or project tables could not be loaded.</p>
                    <NuxtLink 
                        :to="`/projects/${projectId}/data-models`"
                        class="inline-block mt-4 px-4 py-2 bg-primary-blue-100 text-white font-medium hover:bg-primary-blue-200 cursor-pointer">
                        Back to Data Models
                    </NuxtLink>
                </div>
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
