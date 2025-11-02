<script setup>
import {useProjectsStore} from '@/stores/projects';
const projectsStore = useProjectsStore();
const { $swal } = useNuxtApp();

// Fetch projects with client-side SSR
const { data: projectsList, pending, error, refresh } = useProjects();

const state = reactive({
    project_name: '',
    projects: computed(() => {
        if (!projectsList.value) return [];
        return projectsList.value.map((project) => ({
            id: project.id,
            user_id: project.user_platform_id,
            name: project.name,
            dataSources: 0,
            sheets: 0,
            visualizations: 0,
            dashboards: 0,
            stories: 0,
        }));
    }),
});

async function addProject() {
    const inputValue = "";
    const { value: projectName } = await $swal.fire({
        title: "Enter Project Name",
        input: "text",
        inputLabel: "Project Name",
        inputValue,
        showCancelButton: true,
        confirmButtonColor: "#3C8DBC",
        cancelButtonColor: "#DD4B39",
        inputValidator: (value) => {
            if (!value) {
                return "Please enter in a name for the project!";
            }
        }
    });
    if (projectName) {
        state.project_name = projectName;
        const { execute } = useAuthenticatedMutation();
        const data = await execute('/project/add', {
            method: 'POST',
            body: { project_name: projectName }
        });
        
        if (data) {
            $swal.fire({
                title: `The project ${projectName} has been created successfully.`,
                confirmButtonColor: "#3C8DBC",
            });
            await refresh(); // Refresh projects list
        } else {
            $swal.fire({
                title: `There was an error creating the project ${projectName}.`,
                confirmButtonColor: "#3C8DBC",
            });
        }
    }
}

async function deleteProject(projectId) {
    const { value: confirmDelete } = await $swal.fire({
        title: "Are you sure you want to delete the project?",
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
    const data = await execute(`/project/delete/${projectId}`, {
        method: 'DELETE'
    });
    
    if (data) {
        $swal.fire(`The project has been deleted successfully.`);
        await refresh(); // Refresh projects list
    } else {
        $swal.fire(`There was an error deleting the project.`);
    }
}

async function setSelectedProject(projectId) {
    const project = state.projects.find((project) => project.id === projectId);
    projectsStore.setSelectedProject(project);
}
</script>
<template>
    <div class="min-h-100 flex flex-col ml-4 mr-4 mb-10 md:ml-10 md:mr-10 mt-5 border border-primary-blue-100 border-solid p-10 shadow-md">
        <div class="font-bold text-2xl mb-5">
            Projects
        </div>
        <div class="text-md">
            All of your data and files will be contained within projects. All projects are isolated from one another and help with organization of your analysis.
        </div>
        <div class="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 md:gap-10 lg:grid-cols-4 xl:grid-cols-5">
            <notched-card class="justify-self-center mt-10">
                <template #body="{ onClick }">
                    <div class="flex flex-col justify-center text-xl font-bold cursor-pointer items-center" @click="addProject">
                        <div class="bg-gray-300 border border-gray-300 border-solid rounded-full w-20 h-20 flex items-center justify-center mb-5">
                            <font-awesome icon="fas fa-plus" class="text-4xl text-gray-500" />
                        </div>
                        Add Project
                    </div>
                </template>
            </notched-card>
            <div v-for="project in state.projects" class="relative">
                <notched-card class="justify-self-center mt-10">
                    <template #body="{ onClick }">
                        <NuxtLink :to="`/projects/${project.id}`" class="hover:text-gray-500 cursor-pointer" @click="setSelectedProject(project.id)">
                            <div class="flex flex-col justify-center">
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
                                </div>
                            </div>
                        </NuxtLink>
                    </template>
                </notched-card>
                <div class="absolute top-5 -right-2 z-10 bg-gray-200 hover:bg-gray-300 border border-gray-200 border-solid rounded-full w-10 h-10 flex items-center justify-center mb-5 cursor-pointer" @click="deleteProject(project.id)">
                    <font-awesome icon="fas fa-xmark" class="text-xl text-red-500 hover:text-red-400" />
                </div>
            </div>
        </div>
    </div>
</template>