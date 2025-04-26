<script setup>
const route = useRoute();
const state = reactive({
    dataSourcesStatus: false,
    dataModelsStatus: false,
    dataSourcesOpened: false,
    dataModelsOpened: false,
    dataSources: [],
    dataModels: [],
})
watch(
  route,
  (value, oldValue) => {
    updateStatus();
  },
);
function toggleProjects() {
    state.projectsOpened = !state.projectsOpened;
}
function toggleDataSources() {
    state.dataSourcesOpened = !state.dataSourcesOpened;
}
function toggleSheets() {
    state.sheetsOpened = !state.sheetsOpened;
}
function toggleVisualizations() {
    state.visualizationsOpened = !state.visualizationsOpened;
}
async function getDataSources() {
    state.dataSources = [];
    // const token = getAuthToken();
    // const url = `${baseUrl()}/project/list`;
    // const response = await fetch(url, {
    //     method: "GET",
    //     headers: {
    //         "Content-Type": "application/json",
    //         "Authorization": `Bearer ${token}`,
    //         "Authorization-Type": "auth",
    //     },
    // });
    // const data = await response.json();
    // state.projects = data.map((project) => {
    //     return {
    //         id: project.id,
    //         user_id: project.user_platform_id,
    //         name: project.name,
    //         dataSources: 0,
    //         sheets: 0,
    //         visualizations: 0,
    //         dashboards: 0,
    //         stories: 0,
    //     }
    // });
}
function updateStatus() {
    if (route.name === 'projects-projectname-data-sources') {
        state.dataSourcesStatus = true;
        state.dataModelsStatus = false;
    }
}
onMounted(async () => {
    await getDataSources();
    console.log('route', route);
    updateStatus();
})
</script>
<template>
    <div class="flex flex-col min-h-150 bg-gray-300 shadow-md">
        <div v-if="state.dataSourcesStatus" class="flex flex-row items-center mt-10 ml-2 mr-2 p-2 hover:bg-gray-200 hover:text-gray-500 text-lg font-bold cursor-pointer select-none" @click="toggleDataSources">
            <!-- <font-awesome icon="fas fa-plus" /> -->
            <font-awesome v-if="!state.dataSourcesOpened" icon="fas fa-angle-right"/>
            <font-awesome v-else icon="fas fa-angle-down"/>
            <span class="hover:text-gray-500 ml-2 mr-2">Data Sources</span>
            <menu-dropdown direction="right">
                <template #menuItem="{ onClick }">
                    <font-awesome @click="onClick" icon="fas fa-ellipsis" class="transform translate-y-0.5 hover:text-gray-500" />
                </template>
                <template #dropdownMenu="{ onClick }">
                    <div class="flex flex-col w-40 text-center">
                        <div @click="onClick" class="text-xl font-bold text-black hover:bg-gray-200 cursor-pointer border-b-1 border-primary-blue-100 border-solid pt-1 pb-1">
                            <NuxtLink to="/register">Register</NuxtLink>
                        </div>
                        <div @click="onClick" class="text-xl font-bold text-black hover:bg-gray-200 cursor-pointer pt-1 pb-1">
                            <NuxtLink to="/login">Login</NuxtLink>
                        </div>
                    </div>
                </template>
            </menu-dropdown>
        </div>
        <div v-else class="flex flex-row items-center mt-10 ml-2 mr-2 p-2 text-lg text-gray-400 select-none">
            <!-- <font-awesome icon="fas fa-plus" /> -->
            <font-awesome icon="fas fa-angle-right" />
            <span class="ml-2 mr-2">Data Sources</span>
        </div>
        <div v-if="state.dataSourcesOpened"
            class="flex flex-col ml-5 mr-2 p-2 transition-all duration-500"
            :class="{
                'opacity-0': !state.dataSourcesOpened,
                'opacity-100': state.dataSourcesOpened,
                'h-0': !state.dataSourcesOpened,
                'h-auto': state.dataSourcesOpened
            }"
        >
            <div 
                class="hover:bg-gray-200 text-md cursor-pointer"
                :class="{
                    'opacity-0': !state.dataSourcesOpened,
                    'opacity-100': state.dataSourcesOpened,
                    'h-0': !state.dataSourcesOpened,
                    'h-auto': state.dataSourcesOpened
                }"
            >
                People
            </div>
            <div 
                class="mt-1 hover:bg-gray-200 text-md cursor-pointer"
                :class="{
                    'opacity-0': !state.dataSourcesOpened,
                    'opacity-100': state.dataSourcesOpened,
                    'h-0': !state.dataSourcesOpened,
                    'h-auto': state.dataSourcesOpened
                }"    
            >
                People
            </div>
        </div>

        <div class="flex flex-row items-center ml-2 mr-2 p-2 text-lg text-gray-400 select-none">
            <font-awesome v-if="!state.sheetsOpened" icon="fas fa-angle-right" />
            <font-awesome v-else icon="fas fa-angle-down" />
            <span class="ml-2 mr-2">Data Models</span>
        </div>
        
    </div>
</template>