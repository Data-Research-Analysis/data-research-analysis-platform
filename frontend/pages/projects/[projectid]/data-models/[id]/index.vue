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
            <!-- 1. Overview — default active tab (DM-PAGE-001) -->
            <button
              @click="setActiveTab('overview')"
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
            <!-- 2. Insights (DM-005) -->
            <button
              @click="setActiveTab('insights')"
              :class="[
                activeTab === 'insights'
                  ? 'border-blue-500 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300',
                'whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm transition-colors duration-200 flex items-center gap-2 cursor-pointer'
              ]"
            >
              <span>✨</span>
              <span>Insights</span>
              <span class="inline-flex items-center px-1.5 py-0.5 rounded text-xs font-medium bg-indigo-100 text-indigo-700">
                AI
              </span>
            </button>
            <!-- 3. Explore (DM-007) -->
            <button
              @click="setActiveTab('explore')"
              :class="[
                activeTab === 'explore'
                  ? 'border-blue-500 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300',
                'whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm transition-colors duration-200 flex items-center gap-2 cursor-pointer'
              ]"
            >
              <span>🔍</span>
              <span>Explore</span>
            </button>
            <!-- 4. Data Quality -->
            <button
              @click="setActiveTab('data-quality')"
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
            <!-- 5. Ask AI (AI-004) -->
            <button
              @click="setActiveTab('ask-ai')"
              :class="[
                activeTab === 'ask-ai'
                  ? 'border-blue-500 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300',
                'whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm transition-colors duration-200 flex items-center gap-2 cursor-pointer'
              ]"
            >
              <span>💬</span>
              <span>Ask AI</span>
              <span class="inline-flex items-center px-1.5 py-0.5 rounded text-xs font-medium bg-green-100 text-green-700">
                New
              </span>
            </button>
            <!-- 6. Lineage -->
            <button
              @click="setActiveTab('lineage')"
              :class="[
                activeTab === 'lineage'
                  ? 'border-blue-500 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300',
                'whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm transition-colors duration-200 flex items-center gap-2 cursor-pointer'
              ]"
            >
              <span>🔗</span>
              <span>Lineage</span>
            </button>
    </nav>
      </div>
    </div>
  </div>
</div>
</template>

<script setup lang="ts">
const route = useRoute();
const baseUrl = () => useRuntimeConfig().public.apiBase;

const projectId = computed(() => parseInt(route.params.projectid as string));
const dataModelId = computed(() => parseInt(route.params.id as string));

const dataModelsStore = useDataModelsStore();

// Get permissions
const permissions = useProjectPermissions(projectId.value);
const canUpdate = permissions.canUpdate;

const loading = ref(true);
const dataModel = ref<any>(null);
const showQueryJson = ref(false);
const VALID_TABS = ['overview', 'insights', 'explore', 'data-quality', 'ask-ai', 'lineage'] as const;
type TabName = typeof VALID_TABS[number];
const activeTab = ref<TabName>('overview');

/**
 * DM-PAGE-002: Set the active tab and update the URL hash for deep-linking.
 * Supports URL hash routing (e.g., /data-models/123#builder, #insights, etc.)
 */
function setActiveTab(tab: TabName) {
  activeTab.value = tab;
  if (import.meta.client) {
    const newHash = `#${tab}`;
    if (window.location.hash !== newHash) {
      history.replaceState(null, '', `${window.location.pathname}${window.location.search}${newHash}`);
    }
  }
}

/**
 * Resolve a tab name from the URL hash.
 * Supports both hash routing (#insights) and legacy query param routing (?tab=insights).
 */
function getTabFromUrl(): TabName | null {
  if (!import.meta.client) return null;

  // Priority 1: URL hash (e.g., #builder, #insights)
  const hash = window.location.hash.replace('#', '');
  if (hash && VALID_TABS.includes(hash as TabName)) {
    return hash as TabName;
  }

  // Priority 2: Legacy query param ?tab=xxx (backward compatibility)
  const urlParams = new URLSearchParams(window.location.search);
  const tabParam = urlParams.get('tab');
  if (tabParam && VALID_TABS.includes(tabParam as TabName)) {
    return tabParam as TabName;
  }

  return null;
}

// DM-005: AI Analysis composable
const analysis = useDataModelAnalysis(dataModelId);

async function handleRunAnalysis() {
  await analysis.runAnalysis();
}
// RPT-006: Generate Report modal state
const showGenerateReportModal = ref(false);
function handleReportGenerated(result: { reportId: number; reportName: string }) {
  // Navigate to the newly created report
  navigateTo(`/projects/${projectId.value}/reports/${result.reportId}/edit`);
}

const refreshHistory = ref<any[]>([]);
const historyLoading = ref(false);

let refreshInterval: NodeJS.Timeout | null = null;

// Issue #361: Layer management
const selectedLayer = ref<string | null>(null);

// Initialize layer from data model
watch(() => dataModel.value, (newModel) => {
  if (newModel && newModel.data_layer) {
    selectedLayer.value = newModel.data_layer;
  }
}, { immediate: true });

async function handleLayerChange(layer: string | null) {
  if (!canUpdate.value) {
    console.warn('[DataModel] User does not have permission to update layer');
    return;
  }

  const Swal = (await import('sweetalert2')).default;
  
  try {
    const success = await dataModelsStore.updateDataModelLayer(
      dataModelId.value, 
      layer || '', 
      undefined
    );
    
    if (success) {
      if (dataModel.value) {
        dataModel.value.data_layer = layer;
      }
      
      Swal.fire({
        icon: 'success',
        title: 'Layer Updated',
        text: layer ? `Data layer set to ${layer}` : 'Data layer removed',
        toast: true,
        position: 'top-end',
        showConfirmButton: false,
        timer: 3000,
        timerProgressBar: true
      });
    } else {
      throw new Error('Failed to update layer');
    }
  } catch (error: any) {
    console.error('[DataModel] Error updating layer:', error);
    
    // Revert selection
    selectedLayer.value = dataModel.value?.data_layer || null;
    
    Swal.fire({
      icon: 'error',
      title: 'Update Failed',
      text: error.message || 'Could not update data layer',
      confirmButtonText: 'OK'
    });
  }
}

// DM-PAGE-002: Initialize tab from URL hash (with legacy query param fallback)
const initialTab = getTabFromUrl();
if (initialTab) {
  activeTab.value = initialTab;
}

// DM-PAGE-002: Listen for browser back/forward navigation on hash changes
function handleHashChange() {
  const tab = getTabFromUrl();
  if (tab && tab !== activeTab.value) {
    activeTab.value = tab;
  }
}

onMounted(async () => {
  // DM-PAGE-002: Listen for browser back/forward hash changes
  if (import.meta.client) {
    window.addEventListener('hashchange', handleHashChange);
  }

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
  // DM-PAGE-002: Clean up hashchange listener
  if (import.meta.client) {
    window.removeEventListener('hashchange', handleHashChange);
  }
});

async function loadRefreshHistory() {
  historyLoading.value = true;
  try {
    const result = await dataModelsStore.getRefreshHistory(dataModelId.value) as any;
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
