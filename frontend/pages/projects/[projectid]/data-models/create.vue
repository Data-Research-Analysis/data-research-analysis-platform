<template>
    <div class="create-data-model-container">
        <data-model-builder
            v-if="dataSourceTables"
            :dataSourceTables="dataSourceTables"
            :projectId="projectId"
            :isCrossSource="true"
        ></data-model-builder>
        <div v-else class="loading-state">
            <v-progress-circular indeterminate color="primary"></v-progress-circular>
            <p>Loading tables from all data sources...</p>
        </div>
    </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue';
import { useRoute } from 'vue-router';
import { useDataModelsStore } from '~/store/data_models';

const route = useRoute();
const dataModelsStore = useDataModelsStore();

const projectId = ref<number>(parseInt(route.params.projectid as string));
const dataSourceTables = ref<any>(null);

/**
 * Fetch tables from all data sources in the project
 * for cross-source data model building
 */
const fetchAllTables = async () => {
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
    } catch (error) {
        console.error('[CrossSource] Error fetching all tables:', error);
        dataSourceTables.value = [];
    }
};

onMounted(() => {
    fetchAllTables();
});
</script>

<style scoped>
.create-data-model-container {
    width: 100%;
    height: 100%;
}

.loading-state {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    height: 400px;
    gap: 16px;
}

.loading-state p {
    font-size: 14px;
    color: #666;
}
</style>
