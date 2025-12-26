<template>
  <div class="min-h-screen bg-gray-50">
    <div class="container mx-auto px-4 py-6">
      <!-- Header -->
      <div class="mb-6">
        <div class="flex items-center gap-2 text-sm text-gray-600 mb-2">
          <NuxtLink :to="`/projects/${projectId}`" class="hover:text-blue-600">Project</NuxtLink>
          <span>/</span>
          <NuxtLink :to="`/projects/${projectId}/data-models`" class="hover:text-blue-600">Data Models</NuxtLink>
          <span>/</span>
          <span class="text-gray-900">{{ dataModel?.name || 'Loading...' }}</span>
        </div>
        <div class="flex items-center justify-between">
          <div>
            <h1 class="text-3xl font-bold text-gray-900 flex items-center gap-3">
              {{ dataModel?.name || 'Data Model' }}
              <span 
                v-if="dataModel?.is_cross_source"
                class="inline-flex items-center px-3 py-1 rounded text-sm font-medium bg-blue-100 text-blue-800">
                <font-awesome icon="fas fa-link" class="mr-2 text-xs" />
                Cross-Source Model
              </span>
            </h1>
            <p class="text-base text-gray-600 mt-1">
              View and manage this data model
            </p>
          </div>
        </div>
      </div>

      <!-- Loading State -->
      <div v-if="loading" class="flex items-center justify-center py-12">
        <div class="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600"></div>
      </div>

      <!-- Content -->
      <div v-else-if="dataModel" class="bg-white shadow-md overflow-hidden">
        <div class="px-6 py-4">
          <h2 class="text-lg font-semibold text-gray-900 mb-4">Data Model Details</h2>
          
          <!-- Model Info -->
          <div class="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
            <div>
              <label class="block text-sm font-medium text-gray-700">Name</label>
              <p class="mt-1 text-sm text-gray-900">{{ dataModel.name }}</p>
            </div>
            <div>
              <label class="block text-sm font-medium text-gray-700">Schema</label>
              <p class="mt-1 text-sm text-gray-900">{{ dataModel.schema }}</p>
            </div>
            <div>
              <label class="block text-sm font-medium text-gray-700">Created</label>
              <p class="mt-1 text-sm text-gray-900">{{ formatDate(dataModel.created_at) }}</p>
            </div>
            <div>
              <label class="block text-sm font-medium text-gray-700">Type</label>
              <p class="mt-1 text-sm text-gray-900">
                {{ dataModel.is_cross_source ? 'Cross-Source' : 'Single-Source' }}
              </p>
            </div>
          </div>

          <!-- Data Sources -->
          <div class="mb-6">
            <label class="block text-sm font-medium text-gray-700 mb-2">Data Source(s)</label>
            <div class="flex flex-wrap gap-2">
              <SourceBadge 
                v-for="source in getModelSources()" 
                :key="source.id"
                :source-type="source.data_type"
                :source-name="source.name"
                size="medium" />
            </div>
          </div>

          <!-- SQL Query -->
          <div class="mb-6">
            <label class="block text-sm font-medium text-gray-700 mb-2">SQL Query</label>
            <pre class="bg-gray-50 p-4 rounded text-xs overflow-x-auto">{{ dataModel.sql_query }}</pre>
          </div>

          <!-- Query JSON (collapsed by default) -->
          <div class="mb-6">
            <button
              @click="showQueryJson = !showQueryJson"
              class="flex items-center text-sm font-medium text-gray-700 hover:text-gray-900">
              <font-awesome 
                :icon="showQueryJson ? 'fas fa-chevron-down' : 'fas fa-chevron-right'" 
                class="mr-2 text-xs" />
              Query Definition (JSON)
            </button>
            <pre v-if="showQueryJson" class="mt-2 bg-gray-50 p-4 rounded text-xs overflow-x-auto">{{ JSON.stringify(dataModel.query, null, 2) }}</pre>
          </div>
        </div>
      </div>

      <!-- Error State -->
      <div v-else class="bg-white shadow-md overflow-hidden p-6 text-center">
        <font-awesome icon="fas fa-exclamation-triangle" class="text-red-500 text-4xl mb-3" />
        <p class="text-lg font-semibold text-gray-900">Data Model Not Found</p>
        <p class="text-sm text-gray-500 mt-2">The data model you're looking for doesn't exist or has been deleted.</p>
        <NuxtLink 
          :to="`/projects/${projectId}/data-models`"
          class="inline-block mt-4 px-4 py-2 bg-primary-blue-100 text-white font-medium hover:bg-primary-blue-200 cursor-pointer">
          Back to Data Models
        </NuxtLink>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue';
import { useRoute } from 'vue-router';
import { useDataModelsStore } from '~/stores/data_models';

const route = useRoute();
const dataModelsStore = useDataModelsStore();

const projectId = computed(() => parseInt(route.params.projectid as string));
const dataModelId = computed(() => parseInt(route.params.id as string));
const loading = ref(true);
const dataModel = ref<any>(null);
const showQueryJson = ref(false);

onMounted(async () => {
  loading.value = true;
  try {
    // Fetch all data models
    await dataModelsStore.retrieveDataModels();
    
    // Find the specific data model
    const models = dataModelsStore.dataModels;
    dataModel.value = models.find((m: any) => m.id === dataModelId.value);
    
    if (!dataModel.value) {
      console.error('Data model not found:', dataModelId.value);
    }
  } catch (error) {
    console.error('Error loading data model:', error);
  } finally {
    loading.value = false;
  }
});

function getModelSources() {
  if (!dataModel.value) return [];
  
  if (dataModel.value.is_cross_source && dataModel.value.data_model_sources) {
    return dataModel.value.data_model_sources.map((dms: any) => dms.data_source);
  } else if (dataModel.value.data_source) {
    return [dataModel.value.data_source];
  }
  return [];
}

function formatDate(date: string): string {
  if (!date) return 'N/A';
  return new Date(date).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  });
}
</script>
