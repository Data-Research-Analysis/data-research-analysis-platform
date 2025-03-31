<script setup>
const { $swal } = useNuxtApp();
const route = useRoute();
const router = useRouter();
const state = reactive({
    project_name: '',
    show_dialog: false,
    data_sources: [],
    available_data_sources: [
        {
            name: 'Excel File',
            url: `${route.fullPath}/excel`,
        },
        {
            name: 'PostgresSQL',
            url: `${route.fullPath}/postgres`,
        },
        {
            name: 'MariaDB',
            url: `${route.fullPath}/mariadb`,
        },
        {
            name: 'MySQL',
            url: `${route.fullPath}/mysql`,
        },
        {
            name: 'MongoDB',
            url: `${route.fullPath}/mongodb`,
        },
    ],
})
function openDialog() {
    state.show_dialog = true;
}
function closeDialog() {
    state.show_dialog = false;
}

async function getDataSources() {
    
}
async function deleteDataSource(dataSourceId) {
    
}

onMounted(async () => {
    await getDataSources();
})
</script>
<template>
    <div class="min-h-100 flex flex-col m-10 mt-5 border border-primary-blue-100 border-solid p-10 shadow-md">
        <div class="font-bold text-2xl mb-5">
            Data Sources
        </div>
        <div class="text-md">
            Data sources are the basic entity that you provide. A data source can range from a simple excel file to a PostgresSQL. This is the data that you provide which you will then work with in order to reach your analysis goals.
        </div>
        <div class="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 md:gap-10 lg:grid-cols-4 xl:grid-cols-5">
            <notched-card class="justify-self-center mt-10">
                <template #body="{ onClick }">
                    <div class="flex flex-col justify-center text-xl font-bold cursor-pointer items-center" @click="openDialog">
                        <div class="bg-gray-300 border border-gray-300 border-solid rounded-full w-20 h-20 flex items-center justify-center mb-5">
                            <font-awesome icon="fas fa-plus" class="text-4xl text-gray-500" />
                        </div>
                        Add Data Source
                    </div>
                </template>
            </notched-card>
            <notched-card v-for="project in state.data_sources" class="justify-self-center mt-10">
                <template #body="{ onClick }">
                    <NuxtLink :to="`/projects/${project.name}/data-sources`">
                        <div class="flex flex-col justify-center cursor-pointer">
                            <div class="text-md font-bold">
                                {{project.name}}
                            </div>
                            <div class="bg-gray-300 p-5">
                                Screenshot here
                            </div>
                            <div class="flex flex-row justify-between mt-1">
                                <ul class="text-xs">
                                    <li>{{ project.dataSources }} Data Sources</li>
                                    <li>{{ project.sheets }} Sheets</li>
                                    <li>{{ project.visualizations }} Visualizations</li>
                                    <li>{{ project.dashboards }} Dashboard</li>
                                    <li>{{ project.stories }} Story</li>
                                </ul>
                                <div>
                                    <font-awesome icon="fas fa-trash" class="text-xl text-red-500 hover:text-red-400" @click="deleteProject(project.id)" />
                                </div>
                            </div>
                        </div>
                    </NuxtLink>
                </template>
            </notched-card>
        </div>
        <overlay-dialog v-if="state.show_dialog" @close="closeDialog">
            <template #overlay>
                <div class="grid grid-cols-4 gap-3">
                    <template v-for="dataSource in state.available_data_sources" :key="dataSource.name">
                        <NuxtLink :to="dataSource.url" class="w-full border border-primary-blue-100 border-solid p-10 font-bold text-center hover:bg-gray-200 shadow-md cursor-pointer select-none" >
                            {{ dataSource.name }}
                        </NuxtLink>
                    </template>
                </div>
            </template>
        </overlay-dialog>
    </div>
</template>
