<script setup lang="ts">

definePageMeta({ layout: 'project' });
import { useProjectsStore } from '@/stores/projects';
import { useDataModelsStore } from '@/stores/data_models';
import { useDataSourceStore } from '@/stores/data_sources';
import { useProjectPermissions } from '@/composables/useProjectPermissions';
import DataQualityPanel from '~/components/DataQualityPanel.vue';

const dataModelsStore = useDataModelsStore();
const projectsStore = useProjectsStore();
const dataSourceStore = useDataSourceStore();
const route = useRoute();
const state = reactive({
    data_source_tables: null, // null initially to show loading state
    ai_suggestion: null as { description: string; sql: string } | null,
});
const project = computed(() => {
    return projectsStore.getSelectedProject();
});
const dataSource = computed(() => {
    return dataSourceStore.getSelectedDataSource();
});

// Check permissions
const projectId = computed(() => parseInt(route.params.projectid));
const dataModelId = computed(() => parseInt(route.params.datamodelid));
const permissions = useProjectPermissions(projectId.value);

// Reactive data model - will update when store loads data
const dataModel = computed(() => {
    return dataModelsStore.getDataModels().find((dm) => dm.id === dataModelId.value);
});

// Tab management
const activeTab = ref<'builder' | 'data-quality'>('builder');
let refreshInterval: NodeJS.Timeout | null = null;

function switchTab(tab: 'builder' | 'data-quality') {
    activeTab.value = tab;
}

async function getDataSourceTables(dataSourceId) {
    const token = getAuthToken();
    const url = `${baseUrl()}/data-source/tables/${dataSourceId}`;
    const data = await $fetch(url, {
        headers: {
            "Authorization": `Bearer ${token}`,
            "Authorization-Type": "auth",
        },
    });
    // Ensure we always set an array (even if empty) so the component can handle it
    state.data_source_tables = Array.isArray(data) ? data : [];
}

onMounted(async () => {
   const dataSourceId = route.params.datasourceid;
   const dataModelId = route.params.datamodelid;
   await getDataSourceTables(dataSourceId);

    // Issue #11: Check for a pending AI suggestion from the oversized model modal
    const pending = dataModelsStore.pendingSQLSuggestion;
    if (pending && pending.dataModelId === parseInt(dataModelId as string)) {
        state.ai_suggestion = { description: pending.description, sql: pending.sql };
        dataModelsStore.clearPendingSQLSuggestion();
    }
    
    // Set up periodic refresh of data model status (every 10 seconds)
    refreshInterval = setInterval(async () => {
        await dataModelsStore.retrieveDataModels(projectId.value);
    }, 10000);
});


onUnmounted(() => {
  if (refreshInterval) {
    clearInterval(refreshInterval);
  }
});

async function copyDataModel() {
    const { $swal } = useNuxtApp() as any;
    
    // Confirmation dialog
    const { value: confirmCopy } = await $swal.fire({
        title: `Copy Data Model "${dataModel.value?.name || 'Unknown'}"?`,
        text: 'This will create a complete copy of this data model with all its configuration. The copy will be named "' + (dataModel.value?.name || 'Unknown') + ' Copy".',
        icon: 'question',
        showCancelButton: true,
        confirmButtonColor: '#4F46E5',
        cancelButtonColor: '#DD4B39',
        confirmButtonText: 'Yes, copy it!',
    });
    
    if (!confirmCopy) return;
    
    // Show loading
    $swal.fire({
        title: 'Copying...',
        text: 'Creating a copy of your data model',
        allowOutsideClick: false,
        didOpen: () => {
            $swal.showLoading();
        }
    });
    
    try {
        const newModel = await dataModelsStore.copyDataModel(dataModelId.value);
        
        await $swal.fire({
            icon: 'success',
            title: 'Model Copied!',
            text: `${newModel.name.replace(/_dra_[a-zA-Z0-9_]+/g, '')} has been created successfully.`,
            timer: 3000,
            showConfirmButton: false
        });
        
        // Reload data models
        await dataModelsStore.retrieveDataModels(projectId.value);
        
        // Navigate to the new model's edit page
        navigateTo(`/projects/${projectId.value}/data-sources/${route.params.datasourceid}/data-models/${newModel.id}/edit`);
        
    } catch (error: any) {
        await $swal.fire({
            icon: 'error',
            title: 'Copy Failed',
            text: error.message || 'There was an error copying the data model. Please try again.',
            confirmButtonColor: '#4F46E5'
        });
    }
}
</script>
<template>
    <div v-if="project" class="min-h-screen bg-gray-50">
        <tab-content-panel :corners="['top-right', 'bottom-left', 'bottom-right']">
            <div class="container mx-auto px-4 py-6">
                <!-- Header -->
                <div class="mb-6">
                    <div class="flex items-center justify-between gap-4">
                        <div class="min-w-0 flex-1">
                            <h1 class="text-xl md:text-3xl font-bold text-gray-900 flex items-center gap-3 truncate">
                                <span class="truncate">{{ dataModel?.name?.replace(/_dra_.*/, '') || 'Data Model' }}</span>
                                <span 
                                    v-if="dataModel?.is_cross_source"
                                    class="inline-flex flex-shrink-0 items-center px-3 py-1 rounded text-sm font-medium bg-blue-100 text-blue-800">
                                    <font-awesome icon="fas fa-link" class="mr-2 text-xs" />
                                    Cross-Source Model
                                </span>
                            </h1>
                            <p class="text-base text-gray-600 mt-1">
                                Build and manage your data model
                            </p>
                        </div>
                        <div v-if="permissions.canCreate.value" class="flex-shrink-0">
                            <button
                                @click="copyDataModel"
                                class="inline-flex items-center px-4 py-2 bg-primary-blue-100 hover:bg-primary-blue-300 text-white rounded-lg transition-colors font-medium gap-2 cursor-pointer"
                                v-tippy="{ content: 'Create a copy of this data model' }"
                            >
                                <font-awesome icon="fas fa-copy" />
                                <span>Copy Model</span>
                            </button>
                        </div>
                    </div>
                </div>
    
                <!-- Loading State -->
                <div v-if="state.data_source_tables === null" class="flex items-center justify-center py-12">
                    <div class="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600"></div>
                </div>
    
                <!-- Tab Navigation -->
                <div v-if="dataModel && dataModel.id" class="bg-white rounded-lg shadow mb-6 sticky top-0" style="z-index: 1000;">
                    <div class="border-b border-gray-200 bg-white">
                        <nav class="flex space-x-4 md:space-x-8 px-4 md:px-6 overflow-x-auto bg-white" aria-label="Tabs">
                            <button
                                type="button"
                                @click="switchTab('builder')"
                                :class="[
                                    activeTab === 'builder'
                                        ? 'border-blue-500 text-blue-600'
                                        : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300',
                                    'whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm transition-colors duration-200 flex items-center gap-2 cursor-pointer'
                                ]">
                                <span>🔧</span>
                                <span>Data Model Builder</span>
                            </button>
                            <button
                                type="button"
                                @click="switchTab('data-quality')"
                                :class="[
                                    activeTab === 'data-quality'
                                        ? 'border-blue-500 text-blue-600'
                                        : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300',
                                    'whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm transition-colors duration-200 flex items-center gap-2 cursor-pointer'
                                ]">
                                <span>✅</span>
                                <span>Data Quality & Preview</span>
                            </button>
                        </nav>
                    </div>
                </div>
    
                <!-- Tab Content -->
                
                <!-- Issue #11: AI Suggestion Banner -->
                <div v-if="state.ai_suggestion" class="mb-4 flex flex-col gap-3 p-4 bg-purple-50 border border-purple-300 rounded-lg">
                    <div class="flex flex-row items-start justify-between gap-2">
                        <div class="flex flex-row items-center gap-2">
                            <font-awesome-icon :icon="['fas', 'robot']" class="text-purple-600 flex-shrink-0" />
                            <span class="text-sm font-semibold text-purple-800">AI Suggestion Applied</span>
                        </div>
                        <button
                            class="text-purple-400 hover:text-purple-600 transition-colors flex-shrink-0 cursor-pointer"
                            @click="state.ai_suggestion = null"
                        >
                            <font-awesome-icon :icon="['fas', 'xmark']" />
                        </button>
                    </div>
                    <p class="text-sm text-purple-700">{{ state.ai_suggestion.description }}</p>
                    <p class="text-xs text-purple-600">Copy the SQL below and paste it into the SQL editor in the builder, then rebuild your model.</p>
                    <pre class="text-xs text-gray-800 bg-white border border-purple-200 rounded p-3 overflow-x-auto whitespace-pre-wrap break-words font-mono">{{ state.ai_suggestion.sql }}</pre>
                </div>

                <!-- Data Model Builder Tab -->
                <div v-show="activeTab === 'builder'" class="bg-white rounded-lg shadow mb-6 p-4 overflow-hidden">
                    <!-- Show builder if we have tables data (even if empty) and data model -->
                    <div v-if="state.data_source_tables !== null && dataModel && dataModel.query">
                        <data-model-builder 
                            :data-source-tables="state.data_source_tables" 
                            :data-model="dataModel" 
                            :data-source="dataSource" 
                            :is-edit-data-model="true" 
                            :read-only="!permissions.canUpdate.value" />
                    </div>
                    
                    <!-- Loading state -->
                    <div v-else-if="state.data_source_tables === null" class="flex flex-col items-center justify-center h-96">
                        <div class="animate-spin rounded-full h-16 w-16 border-b-2 border-indigo-600"></div>
                        <p class="text-lg font-semibold text-gray-700 mt-4">Loading tables...</p>
                    </div>
                </div>
    
                <!-- Data Quality & Preview Tab -->
                <div v-show="activeTab === 'data-quality'" class="space-y-6 mb-6">
                    <!-- Data Quality Metrics -->
                    <div class="bg-white rounded-lg shadow p-6">
                        <DataQualityPanel v-if="activeTab === 'data-quality'" :data-model-id="dataModelId" />
                    </div>
                    
                    <!-- Data Preview -->
                    <div class="bg-white rounded-lg shadow p-6">
                        <div class="mb-4">
                            <h2 class="text-xl font-semibold text-gray-900">Data Preview</h2>
                            <p class="text-sm text-gray-600 mt-1">View and explore the data in this model</p>
                        </div>
                        <PaginatedTable v-if="activeTab === 'data-quality' && dataModelId" :data-model-id="dataModelId" />
                    </div>
                </div>
            </div>
        </tab-content-panel>

    </div>
    
    <!-- Loading state when project not loaded -->
    <div v-else class="flex items-center justify-center min-h-screen">
        <div class="text-center">
            <div class="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-primary-blue-500 mb-4"></div>
            <p class="text-gray-600">Loading data model...</p>
        </div>
    </div>
</template>