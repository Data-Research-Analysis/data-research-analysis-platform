<script setup>
import {useProjectsStore} from '@/stores/projects';
const projectsStore = useProjectsStore();
const { $swal } = useNuxtApp();

const state = reactive({
    project_name: '',
    loading: true,
});

const projects = computed(() => {
    const projectsList = projectsStore.getProjects();
    
    return projectsList.map((project) => ({
        id: project.id,
        user_id: project.user_platform_id,
        name: project.name,
        description: project.description || '',
        // Use counts from API response
        dataSourcesCount: project.data_sources_count || 0,
        dataModelsCount: project.data_models_count || 0,
        dashboardsCount: project.dashboards_count || 0,
    }));
});

// Hide loading once data is available
onMounted(() => {
    // Wait for next tick to ensure store is populated
    nextTick(() => {
        state.loading = false;
    });
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
    <tab-content-panel :corners="['top-left', 'top-right', 'bottom-left', 'bottom-right']" class="mt-10">
        <div class="font-bold text-2xl mb-5">
            Projects
        </div>
        <div class="text-md">
            All of your data and files will be contained within projects. All projects are isolated from one another and help with organization of your analysis.
        </div>
        
        <!-- Skeleton loader for loading state -->
        <div v-if="state.loading" class="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 md:gap-10 lg:grid-cols-4 xl:grid-cols-5">
            <div v-for="i in 6" :key="i" class="mt-10">
                <div class="border border-primary-blue-100 border-solid p-6 shadow-md bg-white min-h-[180px]">
                    <div class="animate-pulse">
                        <div class="h-6 bg-gray-300 rounded w-3/4 mb-4"></div>
                        <div class="space-y-2">
                            <div class="h-4 bg-gray-200 rounded w-full"></div>
                            <div class="h-4 bg-gray-200 rounded w-5/6"></div>
                            <div class="h-4 bg-gray-200 rounded w-4/5"></div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
        
        <!-- Actual content -->
        <div v-else class="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 md:gap-10 lg:grid-cols-4 xl:grid-cols-5">
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
                                <!-- Project Name -->
                                <div class="text-md font-bold mb-3">
                                    {{project.name}}
                                </div>
                                
                                <!-- Description -->
                                <div v-if="project.description" class="text-xs text-gray-500 line-clamp-2 mb-3">
                                    {{project.description}}
                                </div>
                                
                                <!-- Statistics Badges -->
                                <div class="flex flex-wrap gap-2">
                                    <span class="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                                        {{project.dataSourcesCount}} Sources
                                    </span>
                                    <span class="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium bg-green-100 text-green-800">
                                        {{project.dataModelsCount}} Models
                                    </span>
                                    <span class="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium bg-purple-100 text-purple-800">
                                        {{project.dashboardsCount}} Dashboards
                                    </span>
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
    </tab-content-panel>
</template>