<script setup>
import { useDataSourceStore } from '@/stores/data_sources';
import { useProjectsStore } from '@/stores/projects';
const dataSourceStore = useDataSourceStore();
const projectsStore = useProjectsStore();
const { $swal } = useNuxtApp();
const route = useRoute();
const router = useRouter();
const state = reactive({
    data_models: [],

})
const project = computed(() => {
    return projectsStore.getSelectedProject();
});
const dataSource = computed(() => {
    return dataSourceStore.getSelectedDataSource();
});
async function getDataModels() {
    state.data_models = [];
    const token = getAuthToken();
    const url = `${baseUrl()}/data-source/list`;
    const response = await fetch(url, {
        method: "GET",
        headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${token}`,
            "Authorization_Type": "auth",
        },
    });
    const data = await response.json();
    console.log(data);
    state.data_models = data.map((dataSource) => {
        return {
            id: dataSource.id,
            user_id: dataSource.user_platform_id,
            name: dataSource.name,
            dataModels: 0,
        }
    });
}
async function deleteDataModel(dataModelId) {
    
}

onMounted(async () => {
    await getDataModels();
})
</script>
<template>
    <div class="min-h-100 flex flex-col ml-4 mr-4 md:ml-10 md:mr-10 mt-5 border border-primary-blue-100 border-solid p-10 shadow-md">
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
                        <NuxtLink :to="`/projects/${project.id}/data-sources/${dataSource.id}/data-models/${dataModel.id}`" class="hover:text-gray-500 cursor-pointer">
                            <div class="flex flex-col justify-between h-full">
                                <div class="text-md font-bold">
                                    {{dataModel.name}}
                                </div>
                                <div class="flex flex-row justify-between mb-10">
                                    <ul class="text-xs">
                                        <li>{{ dataModel.dataModels }} Data Models</li>
                                    </ul>
                                </div>
                            </div>
                        </NuxtLink>
                    </template>
                </notched-card>
                <div class="absolute top-5 -right-2 z-10 bg-gray-200 hover:bg-gray-300 border border-gray-200 border-solid rounded-full w-10 h-10 flex items-center justify-center mb-5 cursor-pointer" @click="deleteDataModel(dataModel.id)">
                    <font-awesome icon="fas fa-xmark" class="text-xl text-red-500 hover:text-red-400" />
                </div>
            </div>
        </div>
    </div>
</template>
