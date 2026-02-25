<script setup>

definePageMeta({ layout: 'marketing-project' });
import { useProjectsStore } from '@/stores/projects';
import { useDataSourceStore } from '@/stores/data_sources';
import { useDataModelsStore } from '@/stores/data_models';
import { useSubscriptionStore } from '@/stores/subscription';
import { useProjectPermissions } from '@/composables/useProjectPermissions';
import { useTruncation } from '@/composables/useTruncation';
const projectsStore = useProjectsStore();
const dataSourceStore = useDataSourceStore();
const dataModelsStore = useDataModelsStore();
const subscriptionStore = useSubscriptionStore();
const { $swal } = useNuxtApp();
const route = useRoute();
const router = useRouter();
const { isTitleTruncated } = useTruncation();
const state = reactive({
    data_models: [],
    refreshing_model_id: null, // Track which model is being refreshed
    loading: true,
})
watch(
    dataModelsStore.dataModels,
    (value, oldValue) => {
        getDataModels();
    },
    { deep: true }
)
const project = computed(() => {
    return projectsStore.getSelectedProject();
});
const dataSource = computed(() => {
    return dataSourceStore.getSelectedDataSource();
});
const dataModel = computed(() => {
    return dataModelsStore.getSelectedDataModel();
});

// Get project permissions
const projectId = computed(() => parseInt(route.params.projectid));
const permissions = useProjectPermissions(projectId.value);
const canCreate = permissions.canCreate;
const canUpdate = permissions.canUpdate;
const canDelete = permissions.canDelete;

// Debug logging
if (import.meta.client) {
    watch([canCreate, canUpdate, canDelete, permissions.role], () => {
        console.log('🔐 Data Source Data Models Permissions Check:', {
            projectId: projectId.value,
            canCreate: canCreate.value,
            canUpdate: canUpdate.value,
            canDelete: canDelete.value,
            role: permissions.role.value,
            isViewer: permissions.isViewer.value
        });
    }, { immediate: true });
}

// Hide loading once data is available
onMounted(() => {
    nextTick(() => {
        state.loading = false;
    });
});

async function getDataModels() {
    state.data_models = [];
    state.data_models = dataModelsStore.getDataModels().filter((dataModel) => {
        // Only include single-source models that match this data source
        // Skip cross-source models (where data_source is null)
        return dataModel.data_source && dataModel.data_source.id === dataSource.value.id;
    }).map((dataModel) => {
        return {
            id: dataModel.id,
            schema: dataModel.schema,
            name: dataModel.name,
            sql_query: dataModel.sql_query,
            data_source_id: dataModel.data_source.id,
            user_id: dataModel.users_platform.id,
        }
    });
}
async function deleteDataModel(dataModelId) {
    const { value: confirmDelete } = await $swal.fire({
        title: "Are you sure you want to delete the data model?",
        text: "You won't be able to revert this!",
        icon: "warning",
        showCancelButton: true,
        confirmButtonColor: "#3C8DBC",
        cancelButtonColor: "#DD4B39",
        confirmButtonText: "Yes, delete it!",
    });
    if (!confirmDelete) {
        return;
    }
    const token = getAuthToken();
    const requestOptions = {
        headers: {
            "Authorization": `Bearer ${token}`,
            "Authorization-Type": "auth",
        },
    };
    try {
        await $fetch(`${baseUrl()}/data-model/delete/${dataModelId}`, {
            method: "DELETE",
            ...requestOptions
        });
        $swal.fire(`The data model has been deleted successfully.`);
    } catch (error) {
        $swal.fire(`There was an error deleting the data model.`);
    }
    await dataModelsStore.retrieveDataModels(project.value.id);
    getDataModels();
}

async function refreshDataModel(dataModelId, dataModelName) {
    // Confirmation dialog
    const { value: confirmRefresh } = await $swal.fire({
        title: `Refresh Data Model "${cleanDataModelName(dataModelName)}"?`,
        text: "This will update the data model with the latest data from the external source.",
        icon: "question",
        showCancelButton: true,
        confirmButtonColor: "#3C8DBC",
        cancelButtonColor: "#DD4B39",
        confirmButtonText: "Yes, refresh now!",
    });
    
    if (!confirmRefresh) return;
    
    // Set loading state
    state.refreshing_model_id = dataModelId;
    
    try {
        const token = getAuthToken();
        await $fetch(
            `${baseUrl()}/data-model/refresh/${dataModelId}`, 
            {
                method: "POST",
                headers: {
                    "Authorization": `Bearer ${token}`,
                    "Authorization-Type": "auth",
                },
            }
        );
        
        await $swal.fire({
            icon: 'success',
            title: 'Refreshed!',
            text: 'The data model has been updated with the latest data.',
        });
        
        // Reload data models to reflect any changes
        await dataModelsStore.retrieveDataModels(project.value.id);
        getDataModels();
    } catch (error) {
        await $swal.fire({
            icon: 'error',
            title: 'Refresh Failed',
            text: 'There was an error refreshing the data model. Please try again.',
        });
    } finally {
        state.refreshing_model_id = null;
    }
}

async function copyDataModel(dataModelId, dataModelName) {
    // Confirmation dialog
    const { value: confirmCopy } = await $swal.fire({
        title: `Copy Data Model "${cleanDataModelName(dataModelName)}"?`,
        text: 'This will create a complete copy of this data model with all its configuration. The copy will be named "' + cleanDataModelName(dataModelName) + ' Copy".',
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
        const newModel = await dataModelsStore.copyDataModel(dataModelId);
        
        await $swal.fire({
            icon: 'success',
            title: 'Model Copied!',
            text: `${cleanDataModelName(newModel.name)} has been created successfully.`,
            timer: 3000,
            showConfirmButton: false
        });
        
        // Reload data models to show the new copy
        await dataModelsStore.retrieveDataModels(project.value.id);
        getDataModels();
        
    } catch (error) {
        await $swal.fire({
            icon: 'error',
            title: 'Copy Failed',
            text: error.message || 'There was an error copying the data model. Please try again.',
            confirmButtonColor: '#4F46E5'
        });
    }
}

function cleanDataModelName(name) {
    return name.replace(/_dra_[a-zA-Z0-9_]+/g, "");
}

/**
 * Get count of data models for this specific data source
 */
function getDataSourceModelCount() {
    return state.data_models.length;
}

onMounted(async () => {
    getDataModels();
    
    try {
        await subscriptionStore.fetchUsageStats();
        subscriptionStore.startAutoRefresh();
    } catch (error) {
        console.error('Error fetching usage stats:', error);
    }
});

onUnmounted(() => {
    subscriptionStore.stopAutoRefresh();
});
</script>
<template>
    <div class="flex flex-col">
        <tab-content-panel :corners="['top-right', 'bottom-left', 'bottom-right']">
            <div class="flex justify-between items-center mb-5">
                <div>
                    <div class="font-bold text-2xl">
                        Data Models
                    </div>
                    <div class="text-md mt-2">
                        Data Models are part of the semantic data layer and will be the basis of the analysis that you will perform.
                    </div>
                </div>
                
                <!-- Usage Indicator for THIS data source only -->
                <div v-if="subscriptionStore.usageStats" class="text-sm text-gray-600 flex items-center gap-2">
                    <div>
                        <span class="font-medium">{{ getDataSourceModelCount() }}</span>
                        <span v-if="subscriptionStore.usageStats.maxDataModels === -1">
                            / Unlimited
                        </span>
                        <span v-else>
                            / {{ subscriptionStore.usageStats.maxDataModels }}
                        </span>
                        <span class="ml-1">data models</span>
                        <span class="ml-2 text-xs bg-blue-100 text-blue-800 px-2 py-1 rounded">
                            {{ subscriptionStore.usageStats.tier }}
                        </span>
                    </div>
                    <span 
                        v-tippy="{ content: 'Data models for this data source only. Each data source can have up to ' + (subscriptionStore.usageStats.maxDataModels === -1 ? 'unlimited' : subscriptionStore.usageStats.maxDataModels) + ' data models.', placement: 'bottom' }"
                        class="inline-flex items-center cursor-help">
                        <font-awesome icon="fas fa-info-circle" class="text-blue-500 text-sm" />
                    </span>
                </div>
            </div>
            
            <!-- Create Button -->
            <div v-if="canCreate" class="mb-6">
                <NuxtLink 
                    :to="`/marketing-projects/${project.id}/data-sources/${dataSource.id}/data-models/create`"
                    class="inline-flex items-center px-4 py-2 bg-primary-blue-300 hover:bg-primary-blue-100 text-white rounded-lg transition-colors"
                >
                    <font-awesome icon="fas fa-plus" class="mr-2" />
                    Create New Data Model
                </NuxtLink>
            </div>

            <!-- Skeleton loader for loading state -->
            <div v-if="state.loading" class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                <div v-for="i in 6" :key="i" class="bg-white border border-gray-200 rounded-lg p-6 animate-pulse">
                    <div class="h-6 bg-gray-200 rounded w-3/4 mb-4"></div>
                    <div class="h-4 bg-gray-200 rounded w-1/2 mb-2"></div>
                    <div class="h-4 bg-gray-200 rounded w-full mt-6"></div>
                </div>
            </div>
            
            <!-- Cards Grid -->
            <div v-else-if="state.data_models.length > 0" class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                <div 
                    v-for="dataModel in state.data_models" 
                    :key="dataModel.id"
                    class="relative bg-white border border-gray-200 rounded-lg p-6 hover:shadow-lg hover:border-primary-blue-100 transition-all duration-200 flex flex-col"
                >
                    <!-- Action Buttons (Top Right) -->
                    <div class="absolute top-4 right-4 flex gap-1">
                        <!-- Refresh Button -->
                        <button
                            v-if="canUpdate"
                            @click.stop="refreshDataModel(dataModel.id, dataModel.name)"
                            :disabled="state.refreshing_model_id === dataModel.id"
                            class="p-2 text-green-600 hover:bg-green-50 rounded-lg disabled:text-gray-400 disabled:cursor-not-allowed transition-colors"
                            v-tippy="{ content: state.refreshing_model_id === dataModel.id ? 'Refreshing...' : 'Refresh Model' }"
                        >
                            <font-awesome 
                                :icon="state.refreshing_model_id === dataModel.id ? 'fas fa-spinner' : 'fas fa-sync'" 
                                :class="{'animate-spin': state.refreshing_model_id === dataModel.id}"
                            />
                        </button>

                        <!-- Copy Button -->
                        <button
                            v-if="canCreate"
                            @click.stop="copyDataModel(dataModel.id, dataModel.name)"
                            class="p-2 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                            v-tippy="{ content: 'Copy Model' }"
                        >
                            <font-awesome icon="fas fa-copy" />
                        </button>

                        <!-- Delete Button -->
                        <button
                            v-if="canDelete"
                            @click.stop="deleteDataModel(dataModel.id)"
                            class="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                            v-tippy="{ content: 'Delete Model' }"
                        >
                            <font-awesome icon="fas fa-trash" />
                        </button>
                    </div>

                    <!-- Model Info -->
                    <div class="flex-1 space-y-4">
                        <!-- Model Name -->
                        <div class="pr-16">
                            <h3 
                                :ref="`modelTitle-${dataModel.id}`"
                                :data-model-title="dataModel.id"
                                class="text-base font-semibold text-gray-900 mb-2 truncate"
                                v-tippy="isTitleTruncated(dataModel.id, 'data-model-title') ? { content: cleanDataModelName(dataModel.name) } : undefined"
                            >
                                {{ cleanDataModelName(dataModel.name) }}
                            </h3>
                        </div>

                        <!-- Data Source Badge -->
                        <div>
                            <p class="text-xs font-medium text-gray-500 mb-2">Data Source</p>
                            <span class="inline-flex items-center px-3 py-1 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                                <font-awesome icon="fas fa-database" class="mr-1" />
                                {{ dataSource.name }}
                            </span>
                        </div>
                    </div>

                    <!-- View Details Button -->
                    <NuxtLink 
                        :to="`/marketing-projects/${project.id}/data-sources/${dataSource.id}/data-models/${dataModel.id}/edit`"
                        class="mt-6 w-full block text-center bg-primary-blue-300 hover:bg-primary-blue-100 text-white py-2 px-4 rounded-lg transition-colors font-medium"
                    >
                        View Details
                    </NuxtLink>
                </div>
            </div>

            <!-- Empty State -->
            <div v-else class="text-center py-12">
                <font-awesome icon="fas fa-table" class="text-gray-400 text-6xl mb-4" />
                <p class="text-xl font-semibold text-gray-900">No data models yet</p>
                <p class="text-sm text-gray-500 mt-2 mb-4">
                    Create your first data model for this data source
                </p>
                <NuxtLink 
                    v-if="canCreate"
                    :to="`/marketing-projects/${project.id}/data-sources/${dataSource.id}/data-models/create`"
                    class="inline-flex items-center px-4 py-2 bg-primary-blue-300 hover:bg-primary-blue-100 text-white rounded-lg transition-colors"
                >
                    <font-awesome icon="fas fa-plus" class="mr-2" />
                    Create Data Model
                </NuxtLink>
            </div>
        </tab-content-panel>
    </div>
</template>
