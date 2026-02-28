<template>
  <div class="min-h-screen bg-gray-50">
    <div class="container mx-auto px-4 py-6">
      <!-- Header -->
      <div class="mb-6">
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

      <!-- Tab Navigation -->
      <div v-if="dataModel" class="bg-white rounded-lg shadow mb-6">
        <div class="border-b border-gray-200">
          <nav class="flex space-x-8 px-6" aria-label="Tabs">
            <button
              @click="activeTab = 'overview'"
              :class="[
                activeTab === 'overview'
                  ? 'border-blue-500 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300',
                'whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm transition-colors duration-200 flex items-center gap-2 cursor-pointer'
              ]"
            >
              <span>📋</span>
              <span>Overview</span>
            </button>
            <button
              @click="activeTab = 'data-quality'"
              :class="[
                activeTab === 'data-quality'
                  ? 'border-blue-500 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300',
                'whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm transition-colors duration-200 flex items-center gap-2 cursor-pointer'
              ]"
            >
              <span>✅</span>
              <span>Data Quality</span>
            </button>
          </nav>
        </div>
      </div>

      <!-- Tab Content -->
      <div v-if="dataModel && activeTab === 'overview'" class="space-y-6">
        <!-- Refresh Status Card -->
        <RefreshStatusCard
          :data-model-id="dataModelId"
          :last-refreshed-at="dataModel.last_refreshed_at"
          :row-count="dataModel.row_count"
          :last-duration="dataModel.last_refresh_duration_ms"
          :refresh-status="dataModel.refresh_status"
          :refresh-error="dataModel.refresh_error"
          :auto-refresh-enabled="dataModel.auto_refresh_enabled"
          @refresh="handleRefresh"
          @toggle-auto-refresh="handleToggleAutoRefresh" />
        
        <!-- Refresh History -->
        <RefreshHistoryTable
          :history="refreshHistory"
          :loading="historyLoading" />
        
        <!-- Data Model Details -->
        <div class="bg-white shadow-md overflow-hidden">
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
                size="default" />
            </div>
          </div>

          <!-- SQL Query -->
          <div class="mb-6">
            <label class="block text-sm font-medium text-gray-700 mb-2">SQL Query</label>
            <pre class="bg-gray-50 p-4 rounded-lg text-xs overflow-x-auto">{{ dataModel.sql_query }}</pre>
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
            <pre v-if="showQueryJson" class="mt-2 bg-gray-50 p-4 rounded-lg text-xs overflow-x-auto">{{ JSON.stringify(dataModel.query, null, 2) }}</pre>
          </div>
          </div>
        </div>
      </div>

      <!-- Data Quality Tab -->
      <div v-else-if="dataModel && activeTab === 'data-quality'">
        <DataQualityPanel :data-model-id="dataModelId" />
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
import { ref, computed, onMounted, onUnmounted } from 'vue';
import { useRoute } from 'vue-router';
import { useDataModelsStore } from '~/stores/data_models';
import { getAuthToken } from '~/composables/AuthToken';
import { baseUrl } from '~/composables/Utils';
import DataQualityPanel from '~/components/DataQualityPanel.vue';

const route = useRoute();
const dataModelsStore = useDataModelsStore();

const projectId = computed(() => parseInt(route.params.projectid as string));
const dataModelId = computed(() => parseInt(route.params.id as string));
const loading = ref(true);
const dataModel = ref<any>(null);
const showQueryJson = ref(false);
const refreshHistory = ref<any[]>([]);
const historyLoading = ref(false);
const activeTab = ref<'overview' | 'data-quality'>('overview');
let refreshInterval: NodeJS.Timeout | null = null;

// Check for tab parameter in URL
if (import.meta.client) {
  const urlParams = new URLSearchParams(window.location.search);
  const tabParam = urlParams.get('tab');
  if (tabParam && ['overview', 'data-quality'].includes(tabParam)) {
    activeTab.value = tabParam as 'overview' | 'data-quality';
  }
}

onMounted(async () => {
  loading.value = true;
  try {
    // Fetch all data models
    await dataModelsStore.retrieveDataModels(projectId.value);
    
    // Find the specific data model
    const models = dataModelsStore.dataModels;
    dataModel.value = models.find((m: any) => m.id === dataModelId.value);
    
    if (!dataModel.value) {
      console.error('Data model not found:', dataModelId.value);
    } else {
      // Load refresh history
      await loadRefreshHistory();
      
      // Set up periodic refresh of data model status (every 10 seconds)
      refreshInterval = setInterval(async () => {
        await dataModelsStore.retrieveDataModels(projectId.value);
        const models = dataModelsStore.dataModels;
        const updated = models.find((m: any) => m.id === dataModelId.value);
        if (updated) {
          dataModel.value = updated;
        }
      }, 10000);
    }
  } catch (error) {
    console.error('Error loading data model:', error);
  } finally {
    loading.value = false;
  }
});

onUnmounted(() => {
  if (refreshInterval) {
    clearInterval(refreshInterval);
  }
});

async function loadRefreshHistory() {
  historyLoading.value = true;
  try {
    const result = await dataModelsStore.getRefreshHistory(dataModelId.value);
    refreshHistory.value = result.history || [];
  } catch (error) {
    console.error('Error loading refresh history:', error);
  } finally {
    historyLoading.value = false;
  }
}

async function handleRefresh() {
  // Reload data model to get updated status
  await dataModelsStore.retrieveDataModels(projectId.value);
  const models = dataModelsStore.dataModels;
  const updated = models.find((m: any) => m.id === dataModelId.value);
  if (updated) {
    dataModel.value = updated;
  }
  
  // Reload history
  await loadRefreshHistory();
}

async function handleToggleAutoRefresh(enabled: boolean) {
  try {
    const token = getAuthToken();
    if (!token) return;
    
    const url = `${baseUrl()}/data-model/${dataModelId.value}`;
    try {
      await $fetch(url, {
        method: 'PATCH',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Authorization-Type': 'auth',
        },
        body: {
          auto_refresh_enabled: enabled
        }
      });
      
      dataModel.value.auto_refresh_enabled = enabled;
      
      if (import.meta.client) {
        const Swal = (await import('sweetalert2')).default;
        Swal.fire({
          icon: 'success',
          title: 'Settings Updated',
          text: `Auto-refresh ${enabled ? 'enabled' : 'disabled'}`,
          toast: true,
          position: 'top-end',
          showConfirmButton: false,
          timer: 3000,
          timerProgressBar: true
        });
      }
    } catch (error) {
      console.error('Error toggling auto-refresh:', error);
    }
  } catch (error) {
    console.error('Error in handleToggleAutoRefresh:', error);
  }
}

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

definePageMeta({ layout: 'project' });
</script>
