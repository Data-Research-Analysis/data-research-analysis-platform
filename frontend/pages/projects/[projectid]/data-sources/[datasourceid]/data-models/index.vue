<script setup>
import { useProjectsStore } from '@/stores/projects';
import { useDataSourceStore } from '@/stores/data_sources';
import { useDataModelsStore } from '@/stores/data_models';
const projectsStore = useProjectsStore();
const dataSourceStore = useDataSourceStore();
const dataModelsStore = useDataModelsStore();
const { $swal } = useNuxtApp();
const route = useRoute();
const router = useRouter();
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

// Hide loading once data is available
onMounted(() => {
    nextTick(() => {
        state.loading = false;
    });
});

async function getDataModels() {
    state.data_models = [];
    state.data_models = dataModelsStore.getDataModels().filter((dataModel) => dataModel.data_source.id === dataSource.value.id).map((dataModel) => {
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
        method: "DELETE",
        headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${token}`,
            "Authorization-Type": "auth",
        },
    };
    const response = await fetch(`${baseUrl()}/data-model/delete/${dataModelId}`, requestOptions);
    if (response && response.status === 200) {
        const data = await response.json();
        $swal.fire(`The data model has been deleted successfully.`);
    } else {
        $swal.fire(`There was an error deleting the data model.`);
    }
    await dataModelsStore.retrieveDataModels();
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
        const response = await fetch(
            `${baseUrl()}/data-model/refresh/${dataModelId}`, 
            {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    "Authorization": `Bearer ${token}`,
                    "Authorization-Type": "auth",
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
            getDataModels();
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
        state.refreshing_model_id = null;
    }
}

function cleanDataModelName(name) {
    return name.replace(/_dra_[a-zA-Z0-9_]+/g, "");
}

onMounted(async () => {
    getDataModels();
})
</script>
<template>
    <div class="flex flex-col">
        <tabs :project-id="project.id"/>
        <div class="min-h-100 flex flex-col ml-4 mr-4 md:ml-10 md:mr-10 mb-10 border border-primary-blue-100 border-solid p-10 shadow-md">
            <div class="font-bold text-2xl mb-5">
                Data Models
            </div>
            <div class="text-md">
                Data Models are part of the semantic data layer and will be the basis of the analysis that you will perform.
            </div>
            
            <!-- Skeleton loader for loading state -->
            <div v-if="state.loading" class="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 md:gap-10 lg:grid-cols-4 xl:grid-cols-5">
                <div v-for="i in 6" :key="i" class="mt-10">
                    <div class="border border-primary-blue-100 border-solid p-6 shadow-md bg-white min-h-[180px]">
                        <div class="animate-pulse">
                            <div class="h-6 bg-gray-300 rounded w-3/4 mb-4"></div>
                            <div class="space-y-2 mt-4">
                                <div class="h-4 bg-gray-200 rounded w-1/2"></div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
            
            <!-- Actual content -->
            <div v-else class="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 md:gap-10 lg:grid-cols-4 xl:grid-cols-5">
                <notched-card class="justify-self-center mt-10">
                    <template #body="{ onClick }">
                        <NuxtLink :to="`/projects/${project.id}/data-sources/${dataSource.id}/data-models/create`">
                            <div class="flex flex-col justify-center text-lg font-bold cursor-pointer items-center">
                                <div class="bg-gray-300 border border-gray-300 border-solid rounded-full w-20 h-20 flex items-center justify-center mb-5">
                                    <font-awesome icon="fas fa-plus" class="text-4xl text-gray-500" />
                                </div>
                                Create New Data Model
                            </div>
                        </NuxtLink>
                    </template>
                </notched-card>
                <div v-for="dataModel in state.data_models" class="relative">
                    <notched-card class="justify-self-center mt-10">
                        <template #body="{ onClick }">
                            <NuxtLink :to="`/projects/${project.id}/data-sources/${dataSource.id}/data-models/${dataModel.id}/edit`" class="hover:text-gray-500 cursor-pointer">
                                <div class="flex flex-col justify-start h-full">
                                    <div class="text-md font-bold">
                                        {{cleanDataModelName(dataModel.name)}}
                                    </div>
                                    <div class="flex flex-row justify-between mt-4 mb-10">
                                        <ul class="text-xs">
                                            <li>Data Models</li>
                                        </ul>
                                    </div>
                                </div>
                            </NuxtLink>
                        </template>
                    </notched-card>
                    <div 
                        v-tippy="{ content: 'Delete Data Model' }"
                        class="absolute top-5 -right-2 z-10 bg-red-500 hover:bg-red-700 border border-red-500 border-solid rounded-full w-10 h-10 flex items-center justify-center mb-5 cursor-pointer" 
                        @click="deleteDataModel(dataModel.id)"
                    >
                        <font-awesome icon="fas fa-xmark" class="text-xl text-white select-none" />
                    </div>
                    <button
                        v-tippy="{ content: 'Refresh Data Model' }"
                        :disabled="state.refreshing_model_id === dataModel.id"
                        @click="refreshDataModel(dataModel.id, dataModel.name)"
                        class="absolute top-16 -right-2 z-10 bg-green-500 hover:bg-green-600 disabled:bg-gray-400 border border-green-500 border-solid rounded-full w-10 h-10 flex items-center justify-center cursor-pointer transition-colors"
                    >
                        <font-awesome 
                            :icon="state.refreshing_model_id === dataModel.id ? 'fas fa-spinner' : 'fas fa-sync'" 
                            :class="{'animate-spin': state.refreshing_model_id === dataModel.id}"
                            class="text-xl text-white select-none" 
                        />
                    </button>
                </div>
            </div>
        </div>
    </div>
</template>
