<script setup>
import {useProjectsStore} from '@/stores/projects';
const projectsStore = useProjectsStore();
const { $swal } = useNuxtApp();

const state = reactive({
    project_name: '',
});
const projects = computed(() => {
    const projects = projectsStore.getProjects();
    return projects.map((project) => ({
        id: project.id,
        user_id: project.user_platform_id,
        name: project.name,
        description: project.description,
        dataSources: 0,
        sheets: 0,
        visualizations: 0,
        dashboards: 0,
        stories: 0,
    }));
});
async function addProject() {
    const { value: formValues } = await $swal.fire({
        title: "Create New Project",
        html: `
            <div class="text-left">
                <label for="swal-input1" class="block text-sm font-medium text-gray-700 mb-1">
                    Project Name <span class="text-red-500">*</span>
                </label>
                <input id="swal-input1" class="swal2-input w-full" placeholder="Enter project name">
                
                <label for="swal-input2" class="block text-sm font-medium text-gray-700 mb-1 mt-4">
                    Description
                </label>
                <textarea id="swal-input2" class="swal2-textarea w-full" 
                    placeholder="Enter project description (optional)" 
                    rows="3"></textarea>
            </div>
        `,
        showCancelButton: true,
        confirmButtonColor: "#3C8DBC",
        cancelButtonColor: "#DD4B39",
        confirmButtonText: "Create Project",
        focusConfirm: false,
        preConfirm: () => {
            const projectName = document.getElementById('swal-input1').value;
            const description = document.getElementById('swal-input2').value;
            
            if (!projectName) {
                $swal.showValidationMessage('Please enter a project name!');
                return false;
            }
            
            return { projectName, description };
        }
    });
    
    if (formValues) {
        const { projectName, description } = formValues;
        state.project_name = projectName;
        
        const { execute } = useAuthenticatedMutation();
        const data = await execute('/project/add', {
            method: 'POST',
            body: { 
                project_name: projectName,
                description: description
            }
        });
        
        if (data) {
            $swal.fire({
                title: `The project ${projectName} has been created successfully.`,
                confirmButtonColor: "#3C8DBC",
            });
            await projectsStore.retrieveProjects();
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
        await projectsStore.retrieveProjects(); // Refresh projects list
    } else {
        $swal.fire(`There was an error deleting the project.`);
    }
}

async function setSelectedProject(projectId) {
    const project = projects.value.find((project) => project.id === projectId);
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
            <div v-for="project in projects" :key="project.id" class="relative">
                <NuxtLink :to="`/projects/${project.id}`" class="hover:text-gray-500 cursor-pointer" @click="setSelectedProject(project.id)">
                    <notched-card class="justify-self-center mt-10">
                        <template #body="{ onClick }">
                            <div class="flex flex-col justify-center">
                                <div class="text-md font-bold">
                                        {{project.name}}
                                </div>
                                <div v-if="project.description" class="text-sm mt-4 text-gray-600 line-clamp-3">
                                        {{project.description}}
                                </div>
                            </div>
                        </template>
                    </notched-card>
                </NuxtLink>
                <div class="absolute top-5 -right-2 z-10 bg-red-500 hover:bg-red-700 border border-red-500 border-solid rounded-full w-10 h-10 flex items-center justify-center mb-5 cursor-pointer" @click="deleteProject(project.id)">
                    <font-awesome icon="fas fa-xmark" class="text-xl text-white" />
                </div>
            </div>
        </div>
    </div>
</template>