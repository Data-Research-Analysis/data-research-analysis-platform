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

})
watch(
    dataModelsStore,
    (value, oldValue) => {
        getDataModels();
    },
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
            <div class="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 md:gap-10 lg:grid-cols-4 xl:grid-cols-5">
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
                    <div class="absolute top-5 -right-2 z-10 bg-gray-200 hover:bg-gray-300 border border-gray-200 border-solid rounded-full w-10 h-10 flex items-center justify-center mb-5 cursor-pointer" @click="deleteDataModel(dataModel.id)">
                        <font-awesome icon="fas fa-xmark" class="text-xl text-red-500 hover:text-red-400 select-none" />
                    </div>
                </div>
            </div>
        </div>
    </div>
</template>
