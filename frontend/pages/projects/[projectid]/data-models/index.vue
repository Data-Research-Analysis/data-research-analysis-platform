<template>
  <div class="data-models-page min-h-screen bg-gray-50">
    <div class="container mx-auto px-4 py-6">
      <!-- Header -->
      <div class="mb-6">
        <h1 class="text-3xl font-bold text-gray-900 mb-2">Data Models</h1>
        <p class="text-base text-gray-600">
          Create and manage data models from your project's data sources
        </p>
      </div>

      <!-- Action Buttons -->
      <div class="">
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

        <!-- Table -->
        <div class="overflow-x-auto">
          <table v-if="!loading && filteredModels.length > 0" class="min-w-full divide-y divide-gray-200">
            <thead class="bg-gray-50">
              <tr>
                <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Name
                </th>
                <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Data Source(s)
                </th>
                <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Created
                </th>
                <th class="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody class="bg-white divide-y divide-gray-200">
              <tr v-for="item in filteredModels" :key="item.id" class="hover:bg-gray-50">
                <!-- Name with cross-source indicator -->
                <td class="px-6 py-4 whitespace-nowrap">
                  <div class="flex items-center">
                    <span class="text-sm font-medium text-gray-900">{{ item.name }}</span>
                    <span 
                      v-if="item.is_cross_source"
                      class="ml-2 inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-blue-100 text-blue-800">
                      <font-awesome icon="fas fa-link" class="mr-1 text-[10px]" />
                      Multi-Source
                    </span>
                  </div>
                </td>

                <!-- Data source(s) -->
                <td class="px-6 py-4">
                  <div class="flex flex-wrap gap-1">
                    <SourceBadge 
                      v-for="source in getModelSources(item)" 
                      :key="source.id"
                      :source-type="source.data_type"
                      :source-name="source.name"
                      size="small" />
                  </div>
                </td>

                <!-- Created date -->
                <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                  {{ item.created_at ? formatDate(item.created_at) : 'N/A' }}
                </td>

                <!-- Actions -->
                <td class="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                  <button 
                    @click="viewModel(item)"
                    class="text-blue-600 hover:text-blue-900 mr-3 cursor-pointer"
                    v-tippy="{ content: 'View' }">
                    <font-awesome icon="fas fa-eye" />
                  </button>
                  <button 
                    @click="refreshModel(item)"
                    :disabled="refreshingModelId === item.id"
                    class="text-green-600 hover:text-green-900 mr-3 cursor-pointer disabled:text-gray-400 disabled:cursor-not-allowed"
                    v-tippy="{ content: 'Refresh' }">
                    <font-awesome 
                      :icon="refreshingModelId === item.id ? 'fas fa-spinner' : 'fas fa-refresh'" 
                      :class="refreshingModelId === item.id ? 'animate-spin' : ''" />
                  </button>
                  <button 
                    @click="deleteModel(item)"
                    class="text-red-600 hover:text-red-900 cursor-pointer"
                    v-tippy="{ content: 'Delete' }">
                    <font-awesome icon="fas fa-trash" />
                  </button>
                </td>
              </tr>
            </tbody>
          </table>

          <!-- Loading State -->
          <div v-else-if="loading" class="flex items-center justify-center py-12">
            <div class="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600"></div>
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
import { ref, computed, onMounted } from 'vue';
import { useRouter, useRoute } from 'vue-router';
import { useDataModelsStore } from '~/stores/data_models';

const router = useRouter();
const route = useRoute();
const dataModelsStore = useDataModelsStore();
const { $swal }: any = useNuxtApp();

const projectId = computed(() => parseInt(route.params.projectid as string));
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

const dataModels = computed(() => dataModelsStore.dataModels);

const filteredModels = computed(() => {
  if (!search.value) return dataModels.value;
  
  const searchLower = search.value.toLowerCase();
  return dataModels.value.filter(model => 
    model.name.toLowerCase().includes(searchLower)
  );
});

onMounted(async () => {
  loading.value = true;
  try {
    // Fetch data models
    await dataModelsStore.retrieveDataModels();
    
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
  } finally {
    loading.value = false;
  }
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
    title: `Refresh Data Model "${model.name}"?`,
    text: 'This will update the data model with the latest data from the external source.',
    icon: 'question',
    showCancelButton: true,
    confirmButtonText: 'Yes, refresh now!',
  });
  
  if (!confirmRefresh) return;
  
  // Set loading state
  refreshingModelId.value = model.id;
  
  try {
    const token = getAuthToken();
    const response = await fetch(
      `${baseUrl()}/data-model/refresh/${model.id}`, 
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
          'Authorization-Type': 'auth',
        },
      }
    );
    
    if (response.status === 200) {
      await $swal.fire({
        icon: 'success',
        title: 'Refreshed!',
        text: 'The data model has been updated with the latest data.',
      });
      
      // Reload data models to reflect any changes
      await dataModelsStore.retrieveDataModels();
    } else {
      throw new Error('Refresh failed');
    }
  } catch (error) {
    await $swal.fire({
      icon: 'error',
      title: 'Refresh Failed',
      text: 'There was an error refreshing the data model. Please try again.',
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
  
  await dataModelsStore.retrieveDataModels();
}
</script>
