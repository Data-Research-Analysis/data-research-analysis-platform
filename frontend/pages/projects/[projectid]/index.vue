<script setup>
import { useDataSourceStore } from '@/stores/data_sources';
import { useProjectsStore } from '@/stores/projects';
import pdfImage from '/assets/images/pdf.png';
import excelImage from '/assets/images/excel.png';
import postgresqlImage from '/assets/images/postgresql.png';
import mysqlImage from '/assets/images/mysql.png';
import mariadbImage from '/assets/images/mariadb.png';

const dataSourceStore = useDataSourceStore();
const projectsStore = useProjectsStore();
const { $swal } = useNuxtApp();
const route = useRoute();
const router = useRouter();
const config = useRuntimeConfig();

// Get project ID from route
const projectId = parseInt(String(route.params.projectid));

const state = reactive({
    show_dialog: false,
    data_sources: computed(() => {
        const allDataSources = dataSourceStore.getDataSources();
        // Filter data sources by project ID
        return allDataSources
            .filter((ds) => {
                const dsProjectId = ds.project_id || ds.project?.id;
                return dsProjectId === projectId;
            })
            .map((dataSource) => ({
                id: dataSource.id,
                name: dataSource.name,
                data_type: dataSource.data_type,
                connection_details: dataSource.connection_details,
                user_id: dataSource.user_platform_id,
                project_id: dataSource.project_id,
            }));
    }),
    available_data_sources: [
        {
            name: 'PDF',
            url: `${route.fullPath}/data-sources/connect/pdf`,
            image_url: pdfImage,
        },
        {
            name: 'Excel File',
            url: `${route.fullPath}/data-sources/connect/excel`,
            image_url: excelImage,
        },
        {
            name: 'PostgreSQL',
            url: `${route.fullPath}/data-sources/connect/postgres`,
            image_url: postgresqlImage,
        },
        {
            name: 'MySQL',
            url: `${route.fullPath}/data-sources/connect/mysql`,
            image_url: mysqlImage,
        },
        {
            name: 'MariaDB',
            url: `${route.fullPath}/data-sources/connect/mariadb`,
            image_url: mariadbImage,
        },
    ],
    selected_tab: 'data_sources',
});

const project = computed(() => {
    return projectsStore.getSelectedProject();
});

function openDialog() {
    state.show_dialog = true;
}

function closeDialog() {
    state.show_dialog = false;
}

async function deleteDataSource(dataSourceId) {
    const { value: confirmDelete } = await $swal.fire({
        title: "Are you sure you want to delete the data source?",
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
    
    const { execute } = useAuthenticatedMutation();
    const data = await execute(`/data-source/delete/${dataSourceId}`, {
        method: 'DELETE'
    });
    
    if (data) {
        $swal.fire(`The data source has been deleted successfully.`);
        await dataSourceStore.retrieveDataSources(); // Refresh data sources list
    } else {
        $swal.fire(`There was an error deleting the data source.`);
    }
}

async function setSelectedDataSource(dataSourceId) {
    const dataSource = state.data_sources.find((dataSource) => dataSource.id === dataSourceId);
    dataSourceStore.setSelectedDataSource(dataSource);
}
</script>
<template>
    <div class="flex flex-col">
        <tabs :project-id="project.id"/>
        
        <!-- Data Sources Content -->
        <div class="min-h-100 flex flex-col ml-4 mr-4 md:ml-10 md:mr-10 mb-10 border border-primary-blue-100 border-solid p-10 shadow-md">
            <div class="font-bold text-2xl mb-5">
                Data Sources
            </div>
            <div class="text-md">
                Data sources are the basic entity that you provide. A data source can range from a simple excel file to a PostgresSQL. This is the data that you provide which you will then work with in order to reach your analysis goals.
            </div>
            <div class="text-lg font3-bold mt-5">
                Project Description
            </div>
            <div class="text-md">
                {{project.description}}
            </div>
            <div class="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 md:gap-10 lg:grid-cols-4 xl:grid-cols-5">
                <notched-card class="justify-self-center mt-10">
                    <template #body="{ onClick }">
                        <div class="flex flex-col justify-center text-md font-bold cursor-pointer items-center" @click="openDialog">
                            <div class="bg-gray-300 border border-gray-300 border-solid rounded-full w-20 h-20 flex items-center justify-center mb-5">
                                <font-awesome icon="fas fa-plus" class="text-4xl text-gray-500" />
                            </div>
                            Connect to External Data Source
                        </div>
                    </template>
                </notched-card>
                <div v-for="dataSource in state.data_sources" class="relative">
                    <notched-card class="justify-self-center mt-10">
                        <template #body="{ onClick }">
                            <NuxtLink :to="`/projects/${project.id}/data-sources/${dataSource.id}/data-models`" class="hover:text-gray-500 cursor-pointer" @click="setSelectedDataSource(dataSource.id)">
                                <div class="flex flex-col justify-start h-full">
                                    <div class="text-md font-bold">
                                        {{dataSource.name}}
                                    </div>
                                    <div class="flex flex-row justify-between mt-4 mb-10">
                                        <ul class="text-xs">
                                            <li>{{ dataSource.dataModels }} Data Sources</li>
                                        </ul>
                                    </div>
                                </div>
                            </NuxtLink>
                        </template>
                    </notched-card>
                    <div class="absolute top-5 -right-2 z-10 bg-gray-200 hover:bg-gray-300 border border-gray-200 border-solid rounded-full w-10 h-10 flex items-center justify-center mb-5 cursor-pointer" @click="deleteDataSource(dataSource.id)">
                        <font-awesome icon="fas fa-xmark" class="text-xl text-red-500 hover:text-red-400" />
                    </div>
                </div>
            </div>
            <overlay-dialog v-if="state.show_dialog" @close="closeDialog" :yOffset="90">
                <template #overlay>
                    <div class="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
                        <template v-for="dataSource in state.available_data_sources" :key="dataSource.name">
                            <NuxtLink :to="dataSource.url" class="w-full border border-primary-blue-100 border-solid p-10 font-bold text-center hover:bg-gray-200 shadow-md cursor-pointer select-none" >
                                <div class="flex flex-col">
                                    <img :src="dataSource.image_url" :alt="dataSource.name" class="mx-auto mb-3 h-[100px]" />
                                    {{ dataSource.name }}
                                </div>
                            </NuxtLink>
                        </template>
                    </div>
                </template>
            </overlay-dialog>
        </div>
    </div>
</template>
