<template>
    <div class="create-cross-source-model">
        <!-- Header Section -->
        <v-container fluid class="pa-4">
            <v-row>
                <v-col>
                    <div class="d-flex align-center mb-2">
                        <v-icon color="secondary" size="large" class="mr-3">mdi-link-variant</v-icon>
                        <h1 class="text-h4">Create Cross-Source Data Model</h1>
                    </v-col>
            </v-row>

            <v-row>
                <v-col>
                    <v-alert 
                        type="info" 
                        variant="tonal"
                        class="mb-4">
                        <div class="d-flex align-start">
                            <v-icon class="mr-2">mdi-information</v-icon>
                            <div>
                                <strong>Combine data from multiple sources</strong>
                                <p class="text-body-2 mt-1 mb-0">
                                    Select tables and columns from different data sources in your project.
                                    The system will help you join them automatically based on matching columns.
                                </p>
                            </div>
                        </div>
                    </v-alert>
                </v-col>
            </v-row>

            <!-- Stats Row -->
            <v-row v-if="stats" class="mb-4">
                <v-col cols="auto">
                    <v-chip color="primary" variant="outlined">
                        <v-icon start>mdi-database-multiple</v-icon>
                        {{ stats.sourceCount }} Data Sources
                    </v-chip>
                </v-col>
                <v-col cols="auto">
                    <v-chip color="success" variant="outlined">
                        <v-icon start>mdi-table</v-icon>
                        {{ stats.tableCount }} Tables Available
                    </v-chip>
                </v-col>
            </v-row>
        </v-container>

        <!-- Data Model Builder Component -->
        <data-model-builder
            v-if="dataSourceTables && dataSourceTables.length > 0"
            :dataSourceTables="dataSourceTables"
            :projectId="projectId"
            :isCrossSource="true"
        ></data-model-builder>

        <!-- Loading State -->
        <div v-else-if="loading" class="loading-state">
            <v-progress-circular 
                indeterminate 
                color="primary"
                size="64">
            </v-progress-circular>
            <p class="text-h6 mt-4">Loading tables from all data sources...</p>
            <p class="text-body-2 text-medium-emphasis">This may take a moment</p>
        </div>

        <!-- Error State -->
        <v-container v-else-if="error">
            <v-row justify="center">
                <v-col cols="12" md="6">
                    <v-alert 
                        type="error" 
                        variant="tonal"
                        prominent>
                        <v-alert-title>Unable to Load Data Sources</v-alert-title>
                        <div class="mt-2">{{ error }}</div>
                        <template v-slot:append>
                            <v-btn 
                                variant="outlined" 
                                @click="fetchAllTables">
                                Retry
                            </v-btn>
                        </template>
                    </v-alert>
                </v-col>
            </v-row>
        </v-container>

        <!-- Empty State -->
        <v-container v-else>
            <v-row justify="center">
                <v-col cols="12" md="6">
                    <v-card class="text-center pa-8">
                        <v-icon size="64" color="grey-lighten-1">mdi-database-off</v-icon>
                        <h3 class="text-h6 mt-4">No Data Sources Found</h3>
                        <p class="text-body-2 text-medium-emphasis mt-2">
                            Add at least 2 data sources to your project to create cross-source data models.
                        </p>
                        <v-btn 
                            color="primary" 
                            class="mt-4"
                            @click="goToDataSources">
                            Add Data Source
                        </v-btn>
                    </v-card>
                </v-col>
            </v-row>
        </v-container>
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

/**
 * Fetch tables from all data sources in the project
 * for cross-source data model building
 */
const fetchAllTables = async () => {
    loading.value = true;
    error.value = null;
    
    try {
        console.log('[CrossSource] Fetching all tables for project:', projectId.value);
        
        // Call the new cross-source endpoint
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

<style scoped>
.create-cross-source-model {
    width: 100%;
    min-height: 100vh;
    background-color: #f5f5f5;
}

.loading-state {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    height: 400px;
    gap: 8px;
}
</style>
