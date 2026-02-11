<script setup lang="ts">
import { useProjectsStore } from '@/stores/projects';
import { useDataModelsStore } from '@/stores/data_models';
import { useDataSourceStore } from '@/stores/data_sources';
import { useProjectPermissions } from '@/composables/useProjectPermissions';
import DataQualityPanel from '~/components/DataQualityPanel.vue';
import AttributionPanel from '~/components/AttributionPanel.vue';

const dataModelsStore = useDataModelsStore();
const projectsStore = useProjectsStore();
const dataSourceStore = useDataSourceStore();
const route = useRoute();
const state = reactive({
    data_source_tables: null, // null initially to show loading state
    data_model: null as any,
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

// Tab management
const activeTab = ref<'builder' | 'data-quality' | 'attribution'>('builder');
let refreshInterval: NodeJS.Timeout | null = null;

// Check if data model has columns suitable for attribution tracking
const isAttributionCompatible = computed(() => {
    if (!state.data_model?.query?.columns || !Array.isArray(state.data_model.query.columns)) {
        return false;
    }

    const columns = state.data_model.query.columns.map((col: any) => 
        (col.alias || col.column_name || '').toLowerCase()
    );

    // Required: User identifier column
    const userIdentifierPatterns = ['user_id', 'userid', 'customer_id', 'customerid', 'email', 
                                     'session_id', 'sessionid', 'visitor_id', 'visitorid', 'account_id'];
    const hasUserIdentifier = columns.some((col: string) => 
        userIdentifierPatterns.some(pattern => col.includes(pattern))
    );

    // Required: Timestamp column
    const timestampPatterns = ['created_at', 'createdat', 'timestamp', 'date', 'event_date', 
                               'event_time', 'occurred_at', 'time', 'datetime'];
    const hasTimestamp = columns.some((col: string) => 
        timestampPatterns.some(pattern => col.includes(pattern))
    );

    // Recommended: Event type column
    const eventPatterns = ['event', 'action', 'activity', 'conversion', 'type'];
    const hasEventType = columns.some((col: string) => 
        eventPatterns.some(pattern => col.includes(pattern))
    );

    // Optional: Channel/source columns
    const channelPatterns = ['utm_source', 'utm_medium', 'utm_campaign', 'channel', 'source', 'referrer', 'medium'];
    const hasChannel = columns.some((col: string) => 
        channelPatterns.some(pattern => col.includes(pattern))
    );

    // Must have user identifier AND timestamp
    // Event type or channel columns are nice to have but not required
    return hasUserIdentifier && hasTimestamp && (hasEventType || hasChannel);
});

// Tooltip message for why attribution is hidden
const attributionTooltipMessage = computed(() => {
    if (isAttributionCompatible.value) return '';
    
    if (!state.data_model?.query?.columns || !Array.isArray(state.data_model.query.columns)) {
        return 'No columns defined in this data model';
    }

    const columns = state.data_model.query.columns.map((col: any) => 
        (col.alias || col.column_name || '').toLowerCase()
    );

    const userIdentifierPatterns = ['user_id', 'userid', 'customer_id', 'customerid', 'email', 
                                     'session_id', 'sessionid', 'visitor_id', 'visitorid', 'account_id'];
    const hasUserIdentifier = columns.some((col: string) => 
        userIdentifierPatterns.some(pattern => col.includes(pattern))
    );

    const timestampPatterns = ['created_at', 'createdat', 'timestamp', 'date', 'event_date', 
                               'event_time', 'occurred_at', 'time', 'datetime'];
    const hasTimestamp = columns.some((col: string) => 
        timestampPatterns.some(pattern => col.includes(pattern))
    );

    const missing: string[] = [];
    if (!hasUserIdentifier) missing.push('user identifier (user_id, customer_id, email, etc.)');
    if (!hasTimestamp) missing.push('timestamp (created_at, date, timestamp, etc.)');

    return `Attribution tracking requires: ${missing.join(' and ')}`;
});

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
function getDataModel(dataModelId) {
    state.data_model = {};
    state.data_model = dataModelsStore.getDataModels().find((dataModel) => dataModel.id === dataModelId);
}

onMounted(async () => {
   const dataSourceId = route.params.datasourceid;
   const dataModelId = route.params.datamodelid;
   await getDataSourceTables(dataSourceId);
    getDataModel(parseInt(dataModelId));
    
    // Set up periodic refresh of data model status (every 10 seconds)
    refreshInterval = setInterval(async () => {
        await dataModelsStore.retrieveDataModels(projectId.value);
        const models = dataModelsStore.getDataModels();
        const updated = models.find((m: any) => m.id === dataModelId.value);
        if (updated) {
          state.data_model = updated;
        }
    }, 10000);
});

// Watch for attribution tab access when model isn't compatible
watch([activeTab, isAttributionCompatible], ([newTab, compatible]) => {
    if (newTab === 'attribution' && !compatible) {
        // Redirect to builder tab if attribution not compatible
        activeTab.value = 'builder';
    }
});

onUnmounted(() => {
  if (refreshInterval) {
    clearInterval(refreshInterval);
  }
});

async function copyDataModel() {
    const { $swal } = useNuxtApp();
    
    // Confirmation dialog
    const { value: confirmCopy } = await $swal.fire({
        title: `Copy Data Model "${state.data_model?.name || 'Unknown'}"?`,
        text: 'This will create a complete copy of this data model with all its configuration. The copy will be named "' + (state.data_model?.name || 'Unknown') + ' Copy".',
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
        <tabs :project-id="project.id"/>
        <tab-content-panel :corners="['top-right', 'bottom-left', 'bottom-right']">
            <div class="container mx-auto px-4 py-6">
                <!-- Header -->
                <div class="mb-6">
                    <div class="flex items-center justify-between">
                        <div>
                            <h1 class="text-3xl font-bold text-gray-900 flex items-center gap-3">
                                {{ state.data_model?.name || 'Data Model' }}
                                <span 
                                    v-if="state.data_model?.is_cross_source"
                                    class="inline-flex items-center px-3 py-1 rounded text-sm font-medium bg-blue-100 text-blue-800">
                                    <font-awesome icon="fas fa-link" class="mr-2 text-xs" />
                                    Cross-Source Model
                                </span>
                            </h1>
                            <p class="text-base text-gray-600 mt-1">
                                Build and manage your data model
                            </p>
                        </div>
                        <div v-if="permissions.canCreate.value">
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
                <div v-if="state.data_model && state.data_model.id" class="bg-white rounded-lg shadow mb-6">
                    <div class="border-b border-gray-200">
                        <nav class="flex space-x-8 px-6" aria-label="Tabs">
                            <button
                                @click="activeTab = 'builder'"
                                :class="[
                                    activeTab === 'builder'
                                        ? 'border-blue-500 text-blue-600'
                                        : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300',
                                    'whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm transition-colors duration-200 flex items-center gap-2 cursor-pointer'
                                ]"
                            >
                                <span>🔧</span>
                                <span>Data Model Builder</span>
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
                            <button
                                v-if="isAttributionCompatible"
                                @click="activeTab = 'attribution'"
                                :class="[
                                    activeTab === 'attribution'
                                        ? 'border-blue-500 text-blue-600'
                                        : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300',
                                    'whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm transition-colors duration-200 flex items-center gap-2 cursor-pointer'
                                ]"
                            >
                                <span>📊</span>
                                <span>Marketing Attribution</span>
                            </button>
                            <div
                                v-else
                                class="whitespace-nowrap py-4 px-1 border-b-2 border-transparent text-gray-400 font-medium text-sm flex items-center gap-2 relative group"
                                :title="attributionTooltipMessage"
                            >
                                <span class="opacity-50">📊</span>
                                <span class="opacity-50">Marketing Attribution</span>
                                <span class="text-xs ml-1">🔒</span>
                                <!-- Tooltip on hover -->
                                <div class="absolute hidden group-hover:block bottom-full left-0 mb-2 max-w-md bg-gray-900 text-white text-xs rounded py-2 px-3 z-10 whitespace-normal">
                                    {{ attributionTooltipMessage }}
                                    <div class="absolute top-full left-4 -mt-1 border-4 border-transparent border-t-gray-900"></div>
                                </div>
                            </div>
                        </nav>
                    </div>
                </div>
    
                <!-- Tab Content -->
                
                <!-- Data Model Builder Tab -->
                <div v-if="activeTab === 'builder'" class="bg-white rounded-lg shadow mb-6 overflow-hidden">
                    <!-- Show builder if we have tables data (even if empty) and data model -->
                    <div v-if="state.data_source_tables !== null && state.data_model && state.data_model.query">
                        <data-model-builder 
                            :data-source-tables="state.data_source_tables" 
                            :data-model="state.data_model" 
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
    
                <!-- Data Quality Tab -->
                <div v-else-if="activeTab === 'data-quality'" class="bg-white rounded-lg shadow p-6 mb-6">
                    <DataQualityPanel :data-model-id="dataModelId" />
                </div>
    
                <!-- Attribution Tab -->
                <div v-else-if="activeTab === 'attribution'" class="bg-white rounded-lg shadow p-6 mb-6">
                    <AttributionPanel :data-model-id="dataModelId" :project-id="projectId" />
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