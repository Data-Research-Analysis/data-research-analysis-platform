<script setup>
const state = reactive({
    projectsOpened: false,
    dataSourcesOpened: false,
    sheetsOpened: false,
    visualizationsOpened: false,
    dashboardOpened: false,
    storyOpened: false,
})
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
</script>
<template>
    <div class="flex flex-col min-h-150 bg-gray-300 shadow-md">
        <div class="flex flex-row items-center mt-10 ml-2 mr-2 p-2 hover:bg-gray-200 text-lg font-bold cursor-pointer select-none">
            <!-- <font-awesome icon="fas fa-plus" /> -->
            <font-awesome v-if="!state.projectsOpened" icon="fas fa-angle-right" class="hover:text-gray-500" @click="toggleProjects" />
            <font-awesome v-else icon="fas fa-angle-down" class="hover:text-gray-500" @click="toggleProjects" />
            <span class="hover:text-gray-500 ml-2 mr-2" @click="toggleProjects">Projects</span>
        </div>
        <div v-if="state.projectsOpened"
            class="flex flex-col ml-5 mr-2 p-2 transition-all duration-500"
            :class="{
                'opacity-0': !state.projectsOpened,
                'opacity-100': state.projectsOpened,
                'h-0': !state.projectsOpened,
                'h-auto': state.projectsOpened
            }"
        >
            <div 
                class="hover:bg-gray-200 text-md cursor-pointer"
                :class="{
                    'opacity-0': !state.projectsOpened,
                    'opacity-100': state.projectsOpened,
                    'h-0': !state.projectsOpened,
                    'h-auto': state.projectsOpened
                }"
            >
                People
            </div>
            <div 
                class="mt-1 hover:bg-gray-200 text-md cursor-pointer"
                :class="{
                    'opacity-0': !state.projectsOpened,
                    'opacity-100': state.projectsOpened,
                    'h-0': !state.projectsOpened,
                    'h-auto': state.projectsOpened
                }"    
            >
                People
            </div>
        </div>

        <div class="flex flex-row items-center ml-2 mr-2 p-2 hover:bg-gray-200 text-lg font-bold cursor-pointer select-none">
            <!-- <font-awesome icon="fas fa-plus" /> -->
            <font-awesome v-if="!state.dataSourcesOpened" icon="fas fa-angle-right" class="hover:text-gray-500" @click="toggleDataSources" />
            <font-awesome v-else icon="fas fa-angle-down" class="hover:text-gray-500" @click="toggleDataSources" />
            <span class="hover:text-gray-500 ml-2 mr-2" @click="toggleDataSources">Data Sources</span>
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

        <div class="ml-2 mr-2 p-2 text-lg text-gray-400 cursor-pointer">
            <font-awesome v-if="!state.sheetsOpened" icon="fas fa-angle-right" class="hover:text-gray-500" @click="toggleSheets" />
            <font-awesome v-else icon="fas fa-angle-down" class="hover:text-gray-500" @click="toggleSheets" />
            <span class="hover:text-gray-500 ml-2 mr-2" @click="toggleSheets">Sheets</span>
        </div>
        <div class="ml-2 mr-2 p-2 text-lg text-gray-400">
            <font-awesome v-if="!state.dashboardOpened" icon="fas fa-angle-right" class="hover:text-gray-500" @click="toggleVisualizations" />
            <font-awesome v-else icon="fas fa-angle-down" class="hover:text-gray-500" @click="toggleVisualizations" />
            <span class="hover:text-gray-500 ml-2 mr-2" @click="toggleVisualizations">Dashboards</span>
        </div>
    </div>
    <!-- <img src="/assets/images/gray-background-bottom.svg" class="w-full mt-5 transform -translate-y-5" /> -->
</template>