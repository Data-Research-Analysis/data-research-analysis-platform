<template>
  <div class="data-models-page min-h-screen bg-gray-50">
    <div class="container mx-auto px-4 py-6">
      <!-- Header -->
      <div class="flex justify-between items-center mb-6">
        <div>
          <h1 class="text-3xl font-bold text-gray-900 mb-2">Data Models</h1>
          <p class="text-base text-gray-600">
            Create and manage data models from your project's data sources
          </p>
        </div>
        
        <!-- Usage Indicator -->
        <div v-if="subscriptionStore.usageStats" class="text-sm text-gray-600 flex items-center gap-2">
          <div>
            <span class="font-medium">{{ subscriptionStore.usageStats.dataModelCount }}</span>
            <span v-if="getTotalDataModelCapacity() === -1">
              / Unlimited
            </span>
            <span v-else>
              / {{ getTotalDataModelCapacity() }}
            </span>
            <span class="ml-1">data models</span>
            <span class="ml-2 text-xs bg-blue-100 text-blue-800 px-2 py-1 rounded">
              {{ subscriptionStore.usageStats.tier }}
            </span>
          </div>
          <span 
            v-tippy="{ content: `Total data models across all ${subscriptionStore.usageStats.dataSourceCount} data sources in this project. Total capacity: ${subscriptionStore.usageStats.dataSourceCount} sources × ${subscriptionStore.usageStats.maxDataModels === -1 ? 'Unlimited' : subscriptionStore.usageStats.maxDataModels} models per source.`, placement: 'bottom' }"
            class="inline-flex items-center cursor-help">
            <font-awesome icon="fas fa-info-circle" class="text-blue-500 text-sm" />
          </span>
        </div>
      </div>

      <!-- Action Buttons -->
      <div v-if="canCreate" class="">
        <div class="inline-flex shadow-sm" role="group">
          <!-- Single-source dropdown -->
          <div class="relative inline-block text-left">
            <button 
              @click="dropdownOpen = !dropdownOpen"
              type="button"
              class="inline-flex items-center px-4 py-2 bg-primary-blue-100 text-white text-sm font-medium focus:outline-none focus:ring-2 focus:ring-primary-blue-100 cursor-pointer rounded-tl-lg">
              <font-awesome icon="fas fa-plus" class="mr-2" />
              Create Data Model
              <font-awesome icon="fas fa-chevron-down" class="ml-2 text-xs" />
            </button>

            <!-- Dropdown menu -->
            <div 
              v-if="dropdownOpen"
              @click="dropdownOpen = false"
              class="origin-top-right absolute left-0 w-64 shadow-lg bg-white ring-1 ring-gray-300 ring-opacity-5 z-10 rounded-lg rounded-tl-none rounded-tr-none">
              <div class="py-1">
                <a 
                  v-for="source in dataSources" 
                  :key="source.id"
                  @click="createSingleSource(source.id)"
                  class="group flex items-center px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 cursor-pointer">
                  <font-awesome 
                    :icon="getSourceIcon(source.data_type)" 
                    :class="'text-' + getSourceColor(source.data_type).split('-')[0] + '-600 mr-3'" />
                  <div class="flex-1">
                    <div class="font-medium">From {{ source.name }}</div>
                    <div class="text-xs text-gray-500">{{ source.data_type }}</div>
                  </div>
                </a>
                <div v-if="dataSources.length === 0" class="px-4 py-2 text-sm text-gray-500">
                  No data sources available
                </div>
              </div>
            </div>
          </div>

          <!-- Cross-source button -->
          <button 
            @click="createCrossSource"
            :disabled="dataSources.length < 2"
            :class="[
              'inline-flex items-center px-4 py-2 text-sm font-medium border-l border-primary-blue-100 ml-[1px] rounded-tr-lg',
              dataSources.length >= 2 
                ? 'bg-primary-blue-100 text-white hover:bg-primary-blue-200 cursor-pointer'
                : 'bg-gray-100 text-gray-400 cursor-not-allowed'
            ]">
            <font-awesome icon="fas fa-link" class="mr-2" />
            Create Cross-Source Model
          </button>
        </div>

        <!-- Helper tooltip for cross-source -->
        <span v-if="dataSources.length < 2" class="ml-2 inline-flex items-center" v-tippy="{ content: 'Add at least 2 data sources to create cross-source models', placement: 'bottom' }">
          <font-awesome icon="fas fa-info-circle" class="text-blue-500 text-sm" />
        </span>
      </div>

      <!-- Data Models Table -->
      <div class="bg-white shadow-md overflow-hidden rounded-lg rounded-tl-none ring-1 ring-gray-200 ring-inset">
        <!-- Table Header with Search -->
        <div class="px-6 py-4 border-b border-gray-200">
          <div class="flex items-center justify-between">
            <h2 class="text-lg font-semibold text-gray-900">Your Data Models</h2>
            <div class="relative">
              <div class="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                <font-awesome icon="fas fa-search" class="text-gray-400 text-sm" />
              </div>
              <input
                v-model="search"
                type="text"
                placeholder="Search models..."
                class="pl-10 pr-4 py-2 border border-gray-300 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent rounded-lg" />
            </div>
          </div>
        </div>

        <!-- Card Grid -->
        <div>
          <!-- Loading State -->
          <div v-if="loading" class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            <div v-for="i in 6" :key="i" class="bg-white border border-gray-200 rounded-lg p-6 animate-pulse">
              <div class="h-6 bg-gray-200 rounded w-3/4 mb-4"></div>
              <div class="h-4 bg-gray-200 rounded w-1/2 mb-6"></div>
              <div class="h-4 bg-gray-200 rounded w-full mb-2"></div>
              <div class="h-4 bg-gray-200 rounded w-5/6"></div>
            </div>
          </div>

          <!-- Cards Grid -->
          <div v-else-if="filteredModels.length > 0" class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 p-6">
            <div 
              v-for="item in filteredModels" 
              :key="item.id"
              class="relative bg-white border border-gray-200 rounded-lg p-6 hover:shadow-lg hover:border-primary-blue-100 transition-all duration-200 flex flex-col"
            >
              <!-- Action Buttons (Top Right) -->
              <div class="absolute top-4 right-4 flex gap-1">
                <!-- Refresh Button -->
                <button
                  v-if="canUpdate"
                  @click.stop="refreshModel(item)"
                  :disabled="refreshingModelId === item.id"
                  class="p-2 text-green-600 hover:bg-green-50 rounded-lg disabled:text-gray-400 disabled:cursor-not-allowed transition-colors cursor-pointer"
                  v-tippy="{ content: refreshingModelId === item.id ? 'Refreshing...' : 'Refresh Model' }"
                >
                  <font-awesome 
                    :icon="refreshingModelId === item.id ? 'fas fa-spinner' : 'fas fa-refresh'" 
                    :class="refreshingModelId === item.id ? 'animate-spin' : ''" 
                  />
                </button>

                <!-- Delete Button -->
                <button
                  v-if="canDelete"
                  @click.stop="deleteModel(item)"
                  class="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors cursor-pointer"
                  v-tippy="{ content: 'Delete Model' }"
                >
                  <font-awesome icon="fas fa-trash" />
                </button>
              </div>

              <!-- Model Info -->
              <div class="flex-1 space-y-4">
                <!-- Model Name & Multi-Source Badge -->
                <div class="pr-16">
                  <h3 
                    :ref="`modelTitle-${item.id}`"
                    :data-model-title="item.id"
                    class="text-base font-semibold text-gray-900 mb-2 truncate"
                    v-tippy="isTitleTruncated(item.id, 'data-model-title') ? { content: cleanDataModelName(item.name) } : undefined"
                  >
                    {{ cleanDataModelName(item.name) }}
                  </h3>
                  <span 
                    v-if="item.is_cross_source"
                    class="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-purple-100 text-purple-800"
                  >
                    <font-awesome icon="fas fa-link" class="mr-1 text-[10px]" />
                    Multi-Source
                  </span>
                </div>

                <!-- Data Sources -->
                <div>
                  <p class="text-xs font-medium text-gray-500 mb-2">Data Source(s)</p>
                  <div class="flex flex-wrap gap-2">
                    <SourceBadge 
                      v-for="source in getModelSources(item)" 
                      :key="source.id"
                      :source-type="source.data_type"
                      :source-name="source.name"
                      size="small" 
                    />
                  </div>
                </div>

                <!-- Created Date -->
                <div class="text-xs text-gray-500">
                  <font-awesome icon="far fa-calendar" class="mr-1" />
                  Created {{ item.created_at ? formatDate(item.created_at) : 'N/A' }}
                </div>
              </div>

              <!-- View Details Button -->
              <button
                @click="viewModel(item)"
                class="mt-6 w-full bg-primary-blue-300 hover:bg-primary-blue-100 text-white py-2 px-4 rounded-lg transition-colors font-medium cursor-pointer"
              >
                View Details
              </button>
            </div>
          </div>

          <!-- Empty State -->
          <div v-else class="text-center py-12">
            <font-awesome icon="fas fa-table" class="text-gray-400 text-6xl mb-4" />
            <p class="text-xl font-semibold text-gray-900">No data models yet</p>
            <p class="text-sm text-gray-500 mt-2">
              Create your first data model to get started
            </p>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted } from 'vue';
import { useRouter, useRoute } from 'vue-router';
import { useDataModelsStore } from '~/stores/data_models';
import { useSubscriptionStore } from '@/stores/subscription';
import { useProjectPermissions } from '@/composables/useProjectPermissions';
import { useTruncation } from '@/composables/useTruncation';

const router = useRouter();
const route = useRoute();
const dataModelsStore = useDataModelsStore();
const subscriptionStore = useSubscriptionStore();
const { $swal }: any = useNuxtApp();
const { isTitleTruncated } = useTruncation();

const projectId = computed(() => parseInt(route.params.projectid as string));

// Get project permissions - now returns reactive computed refs
const permissions = useProjectPermissions(projectId.value);
const canCreate = permissions.canCreate;
const canUpdate = permissions.canUpdate;
const canDelete = permissions.canDelete;

// Debug logging
if (import.meta.client) {
    watch([canCreate, canUpdate, canDelete, permissions.role], () => {
        console.log('🔐 Data Models Permissions Check:', {
            projectId: projectId.value,
            canCreate: canCreate.value,
            canUpdate: canUpdate.value,
            canDelete: canDelete.value,
            role: permissions.role.value,
            isViewer: permissions.isViewer.value
        });
    }, { immediate: true });
}

const search = ref('');
const loading = ref(false);
const dataSources = ref<any[]>([]);
const dropdownOpen = ref(false);
const refreshingModelId = ref<number | null>(null);

const headers = [
  { title: 'Name', key: 'name', sortable: true },
  { title: 'Data Source(s)', key: 'sources', sortable: false },
  { title: 'Created', key: 'created_at', sortable: true },
  { title: 'Actions', key: 'actions', sortable: false, align: 'end' }
];

const dataModels = computed(() => {
  const allModels = dataModelsStore.dataModels;
  // Filter by project - check data_source.project.id or data_model_sources
  return allModels.filter(model => {
    // Check if model's data source belongs to this project
    if (model.data_source?.project?.id === projectId.value) {
      return true;
    }
    // For federated models, check if any source belongs to this project
    if (model.data_model_sources?.some((dms: any) => dms.data_source?.project?.id === projectId.value)) {
      return true;
    }
    return false;
  });
});

const filteredModels = computed(() => {
  if (!search.value) return dataModels.value;
  
  const searchLower = search.value.toLowerCase();
  return dataModels.value.filter(model => 
    model.name.toLowerCase().includes(searchLower)
  );
});

/**
 * Calculate total data model capacity across all data sources
 * Total = number of data sources × models per data source limit
 */
function getTotalDataModelCapacity() {
  const stats = subscriptionStore.usageStats;
  if (!stats) return 0;
  
  if (stats.maxDataModels === -1) {
    return -1; // Return -1 for unlimited to be handled by template
  }
  
  // Total capacity = data sources × models per data source
  return stats.dataSourceCount * stats.maxDataModels;
}

onMounted(async () => {
  loading.value = true;
  try {
    // Fetch data models
    await dataModelsStore.retrieveDataModels(projectId.value);
    
    // Fetch data sources
    try {
      const response = await dataModelsStore.fetchAllProjectTables(projectId.value);
      if (response && Array.isArray(response)) {
        dataSources.value = response.map((source: any) => ({
          id: source.dataSourceId,
          name: source.dataSourceName,
          data_type: source.dataSourceType
        }));
      }
    } catch (error) {
      console.error('Error fetching data sources:', error);
      dataSources.value = [];
    }
    
    // Fetch usage stats and start auto-refresh
    try {
      await subscriptionStore.fetchUsageStats();
      subscriptionStore.startAutoRefresh();
    } catch (error) {
      console.error('Error fetching usage stats:', error);
    }
  } finally {
    loading.value = false;
  }
});

onUnmounted(() => {
  subscriptionStore.stopAutoRefresh();
});

function createSingleSource(dataSourceId: number) {
  router.push(`/projects/${projectId.value}/data-sources/${dataSourceId}/data-models/create`);
}

function createCrossSource() {
  router.push(`/projects/${projectId.value}/data-models/create`);
}

function getModelSources(model: any) {
  if (model.is_cross_source && model.data_model_sources) {
    return model.data_model_sources.map((dms: any) => dms.data_source);
  } else if (model.data_source) {
    return [model.data_source];
  }
  return [];
}

function getSourceColor(sourceType: string): string {
  const colors: Record<string, string> = {
    'postgresql': 'blue-600',
    'mysql': 'orange-600',
    'mariadb': 'orange-700',
    'excel': 'green-600',
    'csv': 'green-500',
    'google_analytics': 'purple-600',
    'google_ad_manager': 'red-600',
    'google_ads': 'blue-700',
    'pdf': 'red-500'
  };
  return colors[sourceType?.toLowerCase()] || 'gray-600';
}

function getSourceIcon(sourceType: string): string {
  const icons: Record<string, string> = {
    'postgresql': 'fas fa-database',
    'mysql': 'fas fa-database',
    'mariadb': 'fas fa-database',
    'excel': 'fas fa-file-excel',
    'csv': 'fas fa-file-csv',
    'google_analytics': 'fab fa-google',
    'google_ad_manager': 'fab fa-google',
    'google_ads': 'fab fa-google',
    'pdf': 'fas fa-file-pdf'
  };
  return icons[sourceType?.toLowerCase()] || 'fas fa-database';
}

function formatDate(date: string): string {
  return new Date(date).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric'
  });
}

function cleanDataModelName(name: string): string {
  return name.replace(/_dra_[a-zA-Z0-9_]+/g, "");
}

function viewModel(model: any) {
  // Navigate to index page (view/details page)
  if (model.is_cross_source) {
    // Cross-source model - navigate to cross-source details page
    router.push(`/projects/${projectId.value}/data-models/${model.id}/edit`);
  } else {
    // Single-source model - navigate to data source specific details page
    const dataSourceId = model.data_source?.id;
    if (dataSourceId) {
      router.push(`/projects/${projectId.value}/data-sources/${dataSourceId}/data-models/${model.id}/edit`);
    } else {
      $swal.fire({
        icon: 'error',
        title: 'Error',
        text: 'Unable to determine data source for this model.',
      });
    }
  }
}

async function refreshModel(model: any) {
  // Confirmation dialog
  const { value: confirmRefresh } = await $swal.fire({
    title: `Refresh Data Model "${cleanDataModelName(model.name)}"?`,
    text: 'This will queue the data model for refresh with the latest data.',
    icon: 'question',
    showCancelButton: true,
    confirmButtonText: 'Yes, refresh now!',
    confirmButtonColor: '#4F46E5'
  });
  
  if (!confirmRefresh) return;
  
  // Set loading state
  refreshingModelId.value = model.id;
  
  try {
    // Use the new queue-based refresh API
    await dataModelsStore.refreshDataModel(model.id);
    
    await $swal.fire({
      icon: 'success',
      title: 'Refresh Queued!',
      text: 'The data model refresh has been queued. You will receive a notification when complete.',
      timer: 3000,
      showConfirmButton: false
    });
    
    // Reload data models to reflect any changes
    await dataModelsStore.retrieveDataModels(projectId.value);
  } catch (error: any) {
    await $swal.fire({
      icon: 'error',
      title: 'Refresh Failed',
      text: error.message || 'There was an error refreshing the data model. Please try again.',
      confirmButtonColor: '#4F46E5'
    });
  } finally {
    refreshingModelId.value = null;
  }
}

async function deleteModel(model: any) {
  const { value: confirmDelete } = await $swal.fire({
    title: 'Are you sure you want to delete this data model?',
    text: "You won't be able to revert this!",
    icon: 'warning',
    showCancelButton: true,
    confirmButtonText: 'Yes, delete it!',
  });
  
  if (!confirmDelete) {
    return;
  }
  
  const token = getAuthToken();
  const requestOptions = {
    method: 'DELETE',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`,
      'Authorization-Type': 'auth',
    },
  };
  
  const response = await fetch(`${baseUrl()}/data-model/delete/${model.id}`, requestOptions);
  
  if (response && response.status === 200) {
    await $swal.fire({
      icon: 'success',
      title: 'Deleted!',
      text: 'The data model has been deleted successfully.',
    });
  } else {
    await $swal.fire({
      icon: 'error',
      title: 'Error',
      text: 'There was an error deleting the data model.',
    });
  }
  
  await dataModelsStore.retrieveDataModels(projectId.value);
}
</script>
