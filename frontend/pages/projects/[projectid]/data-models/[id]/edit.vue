<script setup lang="ts">
definePageMeta({ layout: 'project' });

import { useOrganizationContext } from '@/composables/useOrganizationContext';
import { useProjectsStore } from '@/stores/projects';
import { useDataModelsStore } from '@/stores/data_models';
import { useProjectPermissions } from '@/composables/useProjectPermissions';
import DataQualityPanel from '~/components/DataQualityPanel.vue';
import type { IDataSourceWithTables, ITableWithSource } from '@/types/ICrossSourceData';
import type { IDataModel } from '@/types/IDataModel';
const dataModelsStore = useDataModelsStore();
const projectsStore = useProjectsStore();
const route = useRoute();

// Tab management
const activeTab = ref<'builder' | 'data-quality'>('builder');

function switchTab(tab: 'builder' | 'data-quality') {
    activeTab.value = tab;
}

const state = reactive<{
    data_source_tables: ITableWithSource[];
    data_model: IDataModel | null;
    loading: boolean;
    ai_suggestion: { description: string; sql: string } | null;
}>({
    data_source_tables: [],
    data_model: null,
    loading: true,
    ai_suggestion: null,
});
const project = computed(() => {
    return projectsStore.getSelectedProject();
});
const projectId = computed(() => parseInt(route.params.projectid as string));
const dataModelId = computed(() => parseInt(route.params.id as string));

// Check permissions
const permissions = useProjectPermissions(projectId.value);

async function getAllProjectTables() {
    try {
        
        const response = await dataModelsStore.fetchAllProjectTables(projectId.value);
        
        if (response && response.length > 0) {
            // Transform the response: flatten the tables array from each data source
            // The API returns: [{dataSourceId, dataSourceName, dataSourceType, tables: [...]}]
            // The data-model-builder expects: [...tables with data_source info]
            const allTables: ITableWithSource[] = [];
            
            response.forEach((dataSource: IDataSourceWithTables) => {
                if (dataSource.tables && Array.isArray(dataSource.tables)) {
                    dataSource.tables.forEach((table) => {
                        // Add data source metadata to each table
                        allTables.push({
                            ...table,
                            data_source_id: dataSource.dataSourceId,
                            data_source_name: dataSource.dataSourceName,
                            data_source_type: dataSource.dataSourceType
                        });
                    });
                }
            });
            
            state.data_source_tables = allTables;
        } else {
            console.warn('[CrossSource] No data sources found for project');
            state.data_source_tables = [];
        }
    } catch (error) {
        console.error('Error fetching project tables:', error);
        state.data_source_tables = [];
    }
}

function getDataModel(dataModelId: number) {
    state.data_model = null;
    state.data_model = dataModelsStore.getDataModels().find((dataModel) => dataModel.id === dataModelId) || null;
}

onMounted(async () => {
    state.loading = true;
    try {
        // Fetch data models first
        await dataModelsStore.retrieveDataModels(projectId.value);
        
        // Get the specific data model
        getDataModel(dataModelId.value);

        // Issue #11: Check for a pending AI suggestion from the oversized model modal
        const pending = dataModelsStore.pendingSQLSuggestion;
        if (pending && pending.dataModelId === dataModelId.value) {
            state.ai_suggestion = { description: pending.description, sql: pending.sql };
            dataModelsStore.clearPendingSQLSuggestion();
        }
        
        // Fetch all project tables for cross-source model building
        await getAllProjectTables();
    } finally {
        state.loading = false;
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
    
    // PHASE 2 REQUIREMENT: Validate workspace selection before allowing data model copy
    const { requireWorkspace } = useOrganizationContext();
    const validation = requireWorkspace();
    if (!validation.valid) {
        await $swal.fire({
            title: 'Workspace Required',
            text: validation.error || 'Please select a workspace before copying a data model.',
            icon: 'warning',
            confirmButtonColor: '#3C8DBC',
        });
        return;
    }
    
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
        navigateTo(`/projects/${projectId.value}/data-models/${newModel.id}/edit`);
        
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
    <div v-if="project" class="flex flex-col">
        <div class="flex flex-col min-h-100 mb-10">
            <!-- Header -->
            <div v-if="state.data_model" class="bg-white border-b border-gray-200 px-6 py-4 mb-6">
                <div class="flex items-center justify-between">
                    <div>
                        <h1 class="text-2xl font-bold text-gray-900 flex items-center gap-3">
                            {{ state.data_model?.name?.replace(/_dra_[a-zA-Z0-9_]+/g, '') || 'Data Model' }}
                            <span 
                                v-if="state.data_model?.is_cross_source"
                                class="inline-flex items-center px-3 py-1 rounded text-sm font-medium bg-purple-100 text-purple-800">
                                <font-awesome icon="fas fa-link" class="mr-2 text-xs" />
                                Cross-Source Model
                            </span>
                        </h1>
                        <p class="text-sm text-gray-600 mt-1">
                            Build and manage your cross-source data model
                        </p>
                    </div>
                    <div v-if="permissions.canCreate.value">
                        <button
                            @click="copyDataModel"
                            class="inline-flex items-center px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors font-medium gap-2"
                            v-tippy="{ content: 'Create a copy of this data model' }"
                        >
                            <font-awesome icon="fas fa-copy" />
                            <span>Copy Model</span>
                        </button>
                    </div>
                </div>
            </div>
            
            <!-- Tab Navigation -->
            <div v-if="state.data_model" class="bg-white border-b border-gray-200 mb-6 sticky top-0" style="z-index: 1000;">
                <nav class="flex space-x-4 md:space-x-8 px-6 bg-white" aria-label="Tabs">
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
            
            <!-- Tab Content -->
            
            <!-- Issue #11: AI Suggestion Banner -->
            <div v-if="state.ai_suggestion" class="mb-4 mx-6 flex flex-col gap-3 p-4 bg-purple-50 border border-purple-300 rounded-lg">
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
            <div v-show="activeTab === 'builder'">
                <!-- Cross-source data model builder -->
                <data-model-builder 
                    v-if="!state.loading && state.data_source_tables.length > 0 && state.data_model?.sql_query" 
                    :data-source-tables="state.data_source_tables"
                    :data-model="state.data_model" 
                    :is-cross-source="true"
                    :is-edit-data-model="true"
                    :project-id="projectId"
                    :read-only="!permissions.canUpdate.value"
                />
                
                <!-- Loading state -->
                <div v-if="state.loading" class="flex items-center justify-center min-h-[400px]">
                    <div class="text-center">
                        <div class="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-primary-blue-500 mb-4"></div>
                        <p class="text-gray-600">Loading cross-source data model...</p>
                    </div>
                </div>
                
                <!-- Error state -->
                <div v-else-if="!state.loading && (!state.data_source_tables.length || !state.data_model?.sql_query)" class="flex items-center justify-center min-h-[400px]">
                    <div class="text-center">
                        <font-awesome icon="fas fa-exclamation-triangle" class="text-red-500 text-5xl mb-4" />
                        <p class="text-lg font-semibold text-gray-900">Unable to load data model</p>
                        <p class="text-sm text-gray-500 mt-2">The data model or project tables could not be loaded.</p>
                        <NuxtLink 
                            :to="`/projects/${projectId}/data-models`"
                            class="inline-block mt-4 px-4 py-2 bg-primary-blue-100 text-white font-medium hover:bg-primary-blue-200 cursor-pointer">
                            Back to Data Models
                        </NuxtLink>
                    </div>
                </div>
            </div>
            
            <!-- Data Quality & Preview Tab -->
            <div v-show="activeTab === 'data-quality'" class="space-y-6 mx-6 mb-6">
                <!-- Data Quality Metrics -->
                <div class="bg-white rounded-lg shadow p-6">
                    <DataQualityPanel v-if="activeTab === 'data-quality'" :data-model-id="dataModelId" />
                </div>
                
                <!-- Data Preview -->
                <div class="bg-white rounded-lg shadow p-6">
                    <div class="mb-4">
                        <h2 class="text-xl font-semibold text-gray-900">Data Preview</h2>
                        <p class="text-sm text-gray-600 mt-1">View and explore the data in this cross-source model</p>
                    </div>
                    <PaginatedTable v-if="activeTab === 'data-quality' && state.data_model && state.data_model.id" :data-model-id="state.data_model.id" />
                </div>
            </div>
        </div>
    </div>
    
    <!-- Loading state when project not loaded -->
    <div v-else class="flex items-center justify-center min-h-screen">
        <div class="text-center">
            <div class="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-primary-blue-500 mb-4"></div>
            <p class="text-gray-600">Loading data model...</p>
        </div>
    </div>
</template>
