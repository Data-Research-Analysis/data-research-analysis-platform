<script setup>
import {useProjectsStore} from '@/stores/projects';
import {useSubscriptionStore} from '@/stores/subscription';
import {useLoggedInUserStore} from '@/stores/logged_in_user';
import {useApiErrorHandler} from '@/composables/useApiErrorHandler';
import {useAuthenticatedFetch, useAuthenticatedMutation} from '@/composables/useAuthenticatedFetch';
import ProjectMembersDialog from '~/components/ProjectMembersDialog.vue';

const projectsStore = useProjectsStore();
const subscriptionStore = useSubscriptionStore();
const loggedInUserStore = useLoggedInUserStore();
const { $swal } = useNuxtApp();
const { handleApiError } = useApiErrorHandler();
const { isTitleTruncated } = useTruncation();

const state = reactive({
    project_name: '',
    loading: true,
    showTierLimitModal: false,
    tierLimitError: null,
    showMembersDialog: false,
    selectedProjectId: null,
    selectedProjectRole: 'viewer',
});

const projects = computed(() => {
    // Use the reactive projects ref directly instead of getProjects()
    // to ensure we get the latest data from API calls in middleware
    const projectsList = projectsStore.projects;
    
    return projectsList.map((project) => ({
        id: project.id,
        user_id: project.user_platform_id,
        name: project.name,
        description: project.description || '',
        // Owner/role information - only true if explicitly true
        is_owner: project.is_owner === true,
        user_role: project.user_role || 'viewer', // Default to least privilege
        // Use counts from API response
        dataSourcesCount: project.data_sources_count || 0,
        dataModelsCount: project.data_models_count || 0,
        dashboardsCount: project.dashboards_count || 0,
        members: project.members || [],
    }));
});

const selectedProjectMembers = computed(() => {
    if (!state.selectedProjectId) return [];
    const project = projects.value.find(p => p.id === state.selectedProjectId);
    return project?.members || [];
});

// Hide loading once data is available
onMounted(async () => {
    // Wait for next tick to ensure store is populated
    nextTick(() => {
        state.loading = false;
    });
    
    // Fetch usage stats and start auto-refresh
    try {
        await subscriptionStore.fetchUsageStats();
        subscriptionStore.startAutoRefresh();
    } catch (error) {
        console.error('Error fetching usage stats:', error);
    }
});

onUnmounted(() => {
    subscriptionStore.stopAutoRefresh();
});
async function addProject() {
    // Check tier limits before allowing project creation
    if (!subscriptionStore.canCreateProject) {
        state.showTierLimitModal = true;
        state.tierLimitError = {
            resource: 'project',
            currentUsage: subscriptionStore.usageStats?.projectCount || 0,
            tierLimit: subscriptionStore.usageStats?.maxProjects || 0,
            tierName: subscriptionStore.usageStats?.tier || 'FREE',
            upgradeTiers: [],
        };
        return;
    }
    
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
            const projectNameEl = document.getElementById('swal-input1');
            const descriptionEl = document.getElementById('swal-input2');
            const projectName = projectNameEl ? projectNameEl.value : '';
            const description = descriptionEl ? descriptionEl.value : '';
            
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
        try {
            const data = await execute('/project/add', {
                method: 'POST',
                body: { 
                    project_name: projectName,
                    description: description
                }
            });
            
            if (data) {
                $swal.fire({
                    title: `The marketing project ${projectName} has been created successfully.`,
                    confirmButtonColor: "#3C8DBC",
                });
                await projectsStore.retrieveProjects();
                await subscriptionStore.fetchUsageStats(); // Refresh usage stats
            } else {
                $swal.fire({
                    title: `There was an error creating the marketing project ${projectName}.`,
                    confirmButtonColor: "#3C8DBC",
                });
            }
        } catch (error) {
            // Handle 402 tier limit errors
            if (error.status === 402 || error.error === 'TIER_LIMIT_EXCEEDED') {
                await handleApiError(error);
            } else {
                $swal.fire({
                    title: `There was an error creating the marketing project ${projectName}.`,
                    confirmButtonColor: "#3C8DBC",
                });
            }
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

async function openMembersDialog(projectId) {
    state.selectedProjectId = projectId;
    
    // Determine user's role from members array
    const currentUser = loggedInUserStore.getLoggedInUser();
    if (currentUser && currentUser.id) {
        const project = projects.value.find(p => p.id === projectId);
        const memberEntry = project?.members?.find(m => m.user.id === currentUser.id);
        state.selectedProjectRole = memberEntry?.role || 'viewer';
    } else {
        state.selectedProjectRole = 'viewer';
    }
    
    state.showMembersDialog = true;
}

function closeMembersDialog() {
    state.showMembersDialog = false;
    state.selectedProjectId = null;
}
</script>
<template>
    <!-- Tier Limit Modal -->
    <TierLimitModal
        v-if="state.tierLimitError"
        :show="state.showTierLimitModal"
        :resource="state.tierLimitError.resource"
        :current-usage="state.tierLimitError.currentUsage"
        :tier-limit="state.tierLimitError.tierLimit"
        :tier-name="state.tierLimitError.tierName"
        :upgrade-tiers="state.tierLimitError.upgradeTiers"
        @close="state.showTierLimitModal = false"
    />
    
    <tab-content-panel :corners="['top-left', 'top-right', 'bottom-left', 'bottom-right']" class="mt-10">
        <div class="flex justify-between items-center mb-5">
            <div class="font-bold text-2xl">
                Projects
            </div>
            <!-- Usage Indicator -->
            <div v-if="subscriptionStore.usageStats" class="text-sm text-gray-600">
                <span class="font-medium">{{ subscriptionStore.usageStats.projectCount }}</span>
                <span v-if="subscriptionStore.usageStats.maxProjects === -1">
                    / Unlimited
                </span>
                <span v-else>
                    / {{ subscriptionStore.usageStats.maxProjects }}
                </span>
                <span class="ml-1">projects</span>
                <span class="ml-2 text-xs bg-blue-100 text-blue-800 px-2 py-1 rounded">
                    {{ subscriptionStore.usageStats.tier }}
                </span>
            </div>
        </div>
        <div class="text-md mb-6">
            All of your data and files will be contained within projects. All projects are isolated from one another and help with organization of your analysis.
        </div>
        <!-- Header Section -->
        <div class="flex flex-row items-center justify-start mb-5">
            <button
                @click="addProject"
                class="px-6 py-3 bg-primary-blue-100 text-white rounded-lg hover:bg-primary-blue-300 transition-colors duration-200 inline-flex items-center gap-2 cursor-pointer">
                <font-awesome icon="fas fa-plus" />
                Create Project
            </button>
        </div>

        <!-- Skeleton loader for loading state -->
        <div v-if="state.loading" class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            <div v-for="i in 6" :key="i">
                <div class="border border-gray-200 rounded-lg p-6 bg-white shadow-sm">
                    <div class="animate-pulse">
                        <div class="h-6 bg-gray-300 rounded w-3/4 mb-4"></div>
                        <div class="space-y-2 mb-4">
                            <div class="h-4 bg-gray-200 rounded w-full"></div>
                            <div class="h-4 bg-gray-200 rounded w-5/6"></div>
                        </div>
                        <div class="flex gap-2">
                            <div class="h-6 bg-gray-200 rounded w-20"></div>
                            <div class="h-6 bg-gray-200 rounded w-20"></div>
                            <div class="h-6 bg-gray-200 rounded w-24"></div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
        
        <!-- Empty State -->
        <div v-else-if="projects.length === 0"
            class="text-center py-16 bg-white border border-gray-200 rounded-lg">
            <font-awesome icon="fas fa-folder-open" class="text-6xl text-gray-300 mb-4" />
            <h3 class="text-xl font-semibold text-gray-900 mb-2">No Projects Yet</h3>
            <p class="text-gray-600 mb-6">
                Create your first project to start organizing your data analysis
            </p>
            <button
                @click="addProject"
                class="px-6 py-3 bg-primary-blue-100 text-white rounded-lg hover:bg-primary-blue-300 transition-colors duration-200 inline-flex items-center gap-2 cursor-pointer">
                <font-awesome icon="fas fa-plus" />
                Create Project
            </button>
        </div>
        
        <!-- Projects Grid -->
        <div v-else class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            <div
                v-for="project in projects"
                :key="project.id"
                class="relative border border-gray-200 rounded-lg p-6 bg-white shadow-sm hover:shadow-lg hover:border-primary-blue-100 transition-all duration-200 group">
                
                <!-- Clickable area -->
                <NuxtLink :to="`/projects/${project.id}`" @click="setSelectedProject(project.id)" class="cursor-pointer block">
                    <!-- Header with badges -->
                    <div class="flex items-start justify-between mb-3">
                        <!-- Add truncate class -->
                        <h3 
                            :ref="`projectTitle-${project.id}`"
                            :data-project-title="project.id"
                            class="w-2/3 text-lg font-semibold text-gray-900 truncate flex-1 mr-2"
                            v-tippy="isTitleTruncated(project.id, 'data-project-title') ? { content: project.name } : undefined"
                        >
                            {{ project.name }}
                        </h3>
                        <!-- Role Badge -->
                        <span 
                            v-if="project.is_owner"
                            class="inline-flex items-center px-2 py-1 mr-10 rounded text-xs font-medium bg-indigo-100 text-indigo-800 shrink-0"
                            title="You own this project">
                            <font-awesome icon="fas fa-crown" class="mr-1" />
                            Owner
                        </span>
                        <span 
                            v-else-if="project.user_role === 'admin'"
                            class="inline-flex items-center px-2 py-1 mr-10 rounded text-xs font-medium bg-blue-100 text-blue-800 shrink-0"
                            title="You are an admin in this project">
                            <font-awesome icon="fas fa-user-shield" class="mr-1" />
                            Admin
                        </span>
                        <span 
                            v-else-if="project.user_role === 'editor'"
                            class="inline-flex items-center px-2 py-1 mr-10 rounded text-xs font-medium bg-green-100 text-green-800 shrink-0"
                            title="You are an editor in this project">
                            <font-awesome icon="fas fa-pencil" class="mr-1" />
                            Editor
                        </span>
                        <span 
                            v-else-if="project.user_role === 'viewer'"
                            class="inline-flex items-center px-2 py-1 mr-10 rounded text-xs font-medium bg-gray-100 text-gray-800 shrink-0"
                            title="You are a viewer in this project">
                            <font-awesome icon="fas fa-eye" class="mr-1" />
                            Viewer
                        </span>
                    </div>
                    
                    <!-- Description -->
                    <p v-if="project.description" class="text-sm text-gray-600 mb-4 line-clamp-2">
                        {{ project.description }}
                    </p>
                    <p v-else class="text-sm text-gray-400 italic mb-4">
                        No description
                    </p>
                    
                    <!-- Statistics -->
                    <div class="flex flex-wrap gap-2 mb-4">
                        <span class="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                            <font-awesome icon="fas fa-database" class="mr-1 text-[10px]" />
                            {{ project.dataSourcesCount }} Source{{ project.dataSourcesCount !== 1 ? 's' : '' }}
                        </span>
                        <span class="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium bg-green-100 text-green-800">
                            <font-awesome icon="fas fa-chart-bar" class="mr-1 text-[10px]" />
                            {{ project.dataModelsCount }} Model{{ project.dataModelsCount !== 1 ? 's' : '' }}
                        </span>
                        <span class="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium bg-purple-100 text-purple-800">
                            <font-awesome icon="fas fa-chart-line" class="mr-1 text-[10px]" />
                            {{ project.dashboardsCount }} Dashboard{{ project.dashboardsCount !== 1 ? 's' : '' }}
                        </span>
                    </div>

                    <!-- Action Button -->
                    <button
                        @click.prevent="setSelectedProject(project.id); $router.push(`/projects/${project.id}`)"
                        class="w-full px-4 py-2 bg-primary-blue-100 text-white rounded-lg hover:bg-primary-blue-300 hover:text-white transition-all duration-200 flex items-center justify-center gap-2 group-hover:bg-primary-blue-300 group-hover:text-white cursor-pointer">
                        <font-awesome icon="fas fa-arrow-right" />
                        Open Project
                    </button>
                </NuxtLink>

                <!-- Action Buttons (positioned absolutely) -->
                <div class="absolute top-4 right-4 flex flex-col gap-2">
                    <!-- Team Management Button -->
                    <button 
                        v-if="project.is_owner || project.user_role === 'admin'"
                        @click.stop="openMembersDialog(project.id)"
                        class="bg-blue-500 hover:bg-blue-600 border border-blue-500 rounded-full w-10 h-10 flex items-center justify-center cursor-pointer transition-colors z-10"
                        v-tippy="{ content: 'Manage Team' }">
                        <font-awesome icon="fas fa-users" class="text-sm text-white" />
                    </button>

                    <!-- Delete Button -->
                    <button 
                        v-if="project.is_owner"
                        @click.stop="deleteProject(project.id)"
                        class="bg-red-500 hover:bg-red-700 border border-red-500 rounded-full w-10 h-10 flex items-center justify-center cursor-pointer transition-colors z-10"
                        v-tippy="{ content: 'Delete Project' }">
                        <font-awesome icon="fas fa-xmark" class="text-sm text-white" />
                    </button>
                </div>
            </div>
        </div>
    </tab-content-panel>
    
    <!-- Project Members Dialog -->
    <ProjectMembersDialog
        v-if="state.selectedProjectId"
        :project-id="state.selectedProjectId"
        :is-open="state.showMembersDialog"
        :user-role="state.selectedProjectRole"
        :members="selectedProjectMembers"
        :show-marketing-role="true"
        @close="closeMembersDialog"
        @member-updated="projectsStore.retrieveProjects()"
    />
</template>