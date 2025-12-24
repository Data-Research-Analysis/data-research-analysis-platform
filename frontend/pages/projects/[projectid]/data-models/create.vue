<template>
    <div class="create-cross-source-model min-h-screen bg-gray-50">
        <!-- Header Section -->
        <div class="container mx-auto px-4 py-6">
            <div class="flex flex-wrap -mx-4">
                <div class="w-full px-4">
                    <div class="flex items-center mb-4">
                        <font-awesome icon="fas fa-link-variant" class="text-gray-600 text-3xl mr-3" />
                        <h1 class="text-3xl font-bold text-gray-900">Create Cross-Source Data Model</h1>
                    </div>
                </div>
            </div>

            <div class="flex flex-wrap -mx-4">
                <div class="w-full px-4">
                    <!-- Info Alert -->
                    <div class="bg-blue-50 border-l-4 border-blue-400 p-4 mb-6">
                        <div class="flex">
                            <div class="flex-shrink-0">
                                <font-awesome icon="fas fa-info-circle" class="text-blue-400 text-xl" />
                            </div>
                            <div class="ml-3">
                                <p class="text-sm text-blue-700">
                                    <strong class="font-semibold">Combine data from multiple sources</strong><br/>
                                    <span class="text-xs mt-1 block">
                                        Select tables and columns from different data sources in your project.
                                        The system will help you join them automatically based on matching columns.
                                    </span>
                                </p>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            <!-- Stats Row -->
            <div v-if="stats" class="flex flex-wrap -mx-4 mb-6">
                <div class="w-auto px-4">
                    <span class="inline-flex items-center px-3 py-1 rounded-md text-sm font-medium bg-blue-50 text-blue-700 border border-blue-200">
                        <font-awesome icon="fas fa-database-multiple" class="mr-2" />
                        {{ stats.sourceCount }} Data Sources
                    </span>
                </div>
                <div class="w-auto px-4">
                    <span class="inline-flex items-center px-3 py-1 rounded-md text-sm font-medium bg-green-50 text-green-700 border border-green-200">
                        <font-awesome icon="fas fa-table" class="mr-2" />
                        {{ stats.tableCount }} Tables Available
                    </span>
                </div>
            </div>
        </div>

        <!-- Data Model Builder Component -->
        <data-model-builder
            v-if="dataSourceTables && dataSourceTables.length > 0"
            :dataSourceTables="dataSourceTables"
            :projectId="projectId"
            :isCrossSource="true"
        ></data-model-builder>

        <!-- Loading State -->
        <div v-else-if="loading" class="flex flex-col items-center justify-center h-96">
            <div class="animate-spin rounded-full h-16 w-16 border-b-2 border-indigo-600"></div>
            <p class="text-lg font-semibold text-gray-700 mt-4">Loading tables from all data sources...</p>
            <p class="text-sm text-gray-500">This may take a moment</p>
        </div>

        <!-- Error State -->
        <div v-else-if="error" class="container mx-auto px-4">
            <div class="flex justify-center">
                <div class="w-full md:w-2/3 lg:w-1/2">
                    <div class="bg-red-50 border-l-4 border-red-400 p-6 rounded-lg shadow-md">
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
                                        class="px-4 py-2 bg-white border border-red-300 rounded-md text-sm font-medium text-red-700 hover:bg-red-50 focus:outline-none focus:ring-2 focus:ring-red-500">
                                        Retry
                                    </button>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>

        <!-- Empty State -->
        <div v-else class="container mx-auto px-4">
            <div class="flex justify-center">
                <div class="w-full md:w-2/3 lg:w-1/2">
                    <div class="bg-white rounded-lg shadow-md p-8 text-center">
                        <font-awesome icon="fas fa-database-off" class="text-gray-400 text-6xl mb-4" />
                        <h3 class="text-xl font-semibold text-gray-900 mt-4">No Data Sources Found</h3>
                        <p class="text-sm text-gray-500 mt-2">
                            Add at least 2 data sources to your project to create cross-source data models.
                        </p>
                        <button 
                            @click="goToDataSources"
                            class="mt-4 px-6 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-indigo-500">
                            Add Data Source
                        </button>
                    </div>
                </div>
            </div>
        </div>
    </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { useDataModelsStore } from '~/stores/data_models';

const route = useRoute();
const router = useRouter();
const dataModelsStore = useDataModelsStore();

const projectId = ref<number>(parseInt(route.params.projectid as string));
const dataSourceTables = ref<any>(null);
const loading = ref(false);
const error = ref<string | null>(null);

const stats = computed(() => {
    if (!dataSourceTables.value) return null;
    
    return {
        sourceCount: dataSourceTables.value.length,
        tableCount: dataSourceTables.value.reduce((sum: number, source: any) => {
            return sum + (source.tables?.length || 0);
        }, 0)
    };
});

const fetchAllTables = async () => {
    loading.value = true;
    error.value = null;
    
    try {
        console.log('[CrossSource] Fetching all tables for project:', projectId.value);
        
        const response = await dataModelsStore.fetchAllProjectTables(projectId.value);
        
        if (response && response.length > 0) {
            dataSourceTables.value = response;
            console.log('[CrossSource] Loaded tables from', response.length, 'data sources');
        } else {
            console.warn('[CrossSource] No data sources found for project');
            dataSourceTables.value = [];
        }
    } catch (err: any) {
        console.error('[CrossSource] Error fetching all tables:', err);
        error.value = err.message || 'Failed to load data sources. Please try again.';
        dataSourceTables.value = null;
    } finally {
        loading.value = false;
    }
};

function goToDataSources() {
    router.push(`/projects/${projectId.value}`);
}

onMounted(() => {
    fetchAllTables();
});
</script>
