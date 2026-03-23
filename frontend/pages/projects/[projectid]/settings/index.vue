<script setup lang="ts">
definePageMeta({ layout: 'project' });

import { useProjectsStore } from '@/stores/projects';
import { useProjectRole } from '@/composables/useProjectRole';
import type { IProject, IProjectMember } from '@/types/IProject';
import { useOrganizationContext } from '@/composables/useOrganizationContext';

const route = useRoute();
const router = useRouter();
const projectsStore = useProjectsStore();
const { isAnalyst } = useProjectRole();
const { getOrgHeaders } = useOrganizationContext();

const projectId = computed(() => parseInt(String(route.params.projectid)));

const project = computed(() => {
    return projectsStore.projects.find(p => p.id === projectId.value);
});

const isOwner = computed(() => project.value?.is_owner || false);

// Ensure projects are loaded on mount (handles hard refresh)
onMounted(async () => {
    if (projectsStore.projects.length === 0) {
        await projectsStore.retrieveProjects();
    }
});

// Client-side protection: redirect non-owners if they got through middleware (e.g., hard refresh)
watch(project, (newProject) => {
    if (newProject && !newProject.is_owner) {
        router.push(`/projects/${projectId.value}`);
    }
}, { immediate: true });

// Editing state for name
const isEditingName = ref(false);
const editedName = ref('');
const savingName = ref(false);

// Editing state for description
const isEditingDescription = ref(false);
const editedDescription = ref('');
const savingDescription = ref(false);

// Team management
const showMembersDialog = ref(false);

// Transfer ownership
const showTransferDialog = ref(false);
const selectedNewOwner = ref<number | null>(null);
const transferring = ref(false);
const transferError = ref('');

// Delete project
const showDeleteDialog = ref(false);
const deleteConfirmation = ref('');
const deleting = ref(false);
const deleteError = ref('');

const formattedCreatedDate = computed(() => {
    if (!project.value?.created_at) return 'Unknown';
    return new Date(project.value.created_at).toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'long',
        day: 'numeric'
    });
});

const eligibleNewOwners = computed(() => {
    if (!project.value?.members) return [];
    return project.value.members.filter(m => !m.is_owner);
});

function startEditName() {
    editedName.value = project.value?.name || '';
    isEditingName.value = true;
}

function cancelEditName() {
    isEditingName.value = false;
    editedName.value = '';
}

async function saveName() {
    if (!editedName.value.trim() || !project.value) return;
    
    try {
        savingName.value = true;
        const response = await $fetch(`${baseUrl()}/project/update/${projectId.value}`, {
            method: 'PUT',
            headers: {
                'Authorization': `Bearer ${getAuthToken()}`,
                'Authorization-Type': 'auth',
                'Content-Type': 'application/json',
                ...getOrgHeaders()
            },
            body: { name: editedName.value.trim() }
        });

        // Update local store
        await projectsStore.retrieveProjects();
        isEditingName.value = false;
    } catch (error: any) {
        console.error('Error updating project name:', error);
        alert('Failed to update project name');
    } finally {
        savingName.value = false;
    }
}

function startEditDescription() {
    editedDescription.value = project.value?.description || '';
    isEditingDescription.value = true;
}

function cancelEditDescription() {
    isEditingDescription.value = false;
    editedDescription.value = '';
}

async function saveDescription() {
    if (!project.value) return;
    
    try {
        savingDescription.value = true;
        const response = await $fetch(`${baseUrl()}/project/update/${projectId.value}`, {
            method: 'PUT',
            headers: {
                'Authorization': `Bearer ${getAuthToken()}`,
                'Authorization-Type': 'auth',
                'Content-Type': 'application/json',
                ...getOrgHeaders()
            },
            body: { description: editedDescription.value.trim() }
        });

        // Update local store
        await projectsStore.retrieveProjects();
        isEditingDescription.value = false;
    } catch (error: any) {
        console.error('Error updating project description:', error);
        alert('Failed to update project description');
    } finally {
        savingDescription.value = false;
    }
}

function openTransferDialog() {
    selectedNewOwner.value = null;
    transferError.value = '';
    showTransferDialog.value = true;
}

async function confirmTransferOwnership() {
    if (!selectedNewOwner.value || !project.value) return;
    
    try {
        transferring.value = true;
        transferError.value = '';

        const response = await $fetch(`${baseUrl()}/project/transfer-ownership/${projectId.value}`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${getAuthToken()}`,
                'Authorization-Type': 'auth',
                'Content-Type': 'application/json',
                ...getOrgHeaders()
            },
            body: { new_owner_id: selectedNewOwner.value }
        });

        // Update local store and redirect to projects list
        await projectsStore.retrieveProjects();
        showTransferDialog.value = false;
        router.push('/projects');
    } catch (error: any) {
        console.error('Error transferring ownership:', error);
        transferError.value = error.data?.message || 'Failed to transfer ownership';
    } finally {
        transferring.value = false;
    }
}

function openDeleteDialog() {
    deleteConfirmation.value = '';
    deleteError.value = '';
    showDeleteDialog.value = true;
}

async function confirmDeleteProject() {
    if (deleteConfirmation.value !== project.value?.name || !project.value) return;
    
    try {
        deleting.value = true;
        deleteError.value = '';

        const response = await $fetch(`${baseUrl()}/project/delete/${projectId.value}`, {
            method: 'DELETE',
            headers: {
                'Authorization': `Bearer ${getAuthToken()}`,
                'Authorization-Type': 'auth',
                ...getOrgHeaders()
            }
        });

        // Update local store and redirect to projects list
        await projectsStore.retrieveProjects();
        showDeleteDialog.value = false;
        router.push('/projects');
    } catch (error: any) {
        console.error('Error deleting project:', error);
        deleteError.value = error.data?.message || 'Failed to delete project';
    } finally {
        deleting.value = false;
    }
}

function handleMemberUpdated() {
    // Refresh project data when members are updated
    projectsStore.retrieveProjects();
}
</script>

<template>
    <div v-if="!project" class="p-8 text-center text-gray-500">
        <font-awesome-icon :icon="['fas', 'spinner']" class="text-4xl mb-4 text-gray-400 animate-spin" />
        <p>Loading project...</p>
    </div>

    <div v-else class="p-8 max-w-5xl mx-auto">
        <!-- Header -->
        <div class="mb-8">
            <div class="flex items-center justify-between">
                <h1 class="text-3xl font-bold text-gray-900">Project Settings</h1>
                <div class="flex items-center gap-2">
                    <span class="text-sm text-gray-500">Your Role:</span>
                    <span 
                        class="px-3 py-1 rounded-full text-sm font-medium"
                        :class="{
                            'bg-red-100 text-red-800': isOwner,
                            'bg-blue-100 text-blue-800': !isOwner && isAnalyst,
                            'bg-indigo-100 text-indigo-800': !isOwner && project.my_role === 'manager',
                            'bg-purple-100 text-purple-800': !isOwner && project.my_role === 'cmo'
                        }"
                    >
                        {{ isOwner ? 'Owner' : (isAnalyst ? 'Analyst' : (project.my_role || 'Member')) }}
                    </span>
                </div>
            </div>
        </div>

        <!-- General Information Section -->
        <div class="bg-white rounded-lg shadow-sm border border-gray-200 p-6 mb-6">
            <h2 class="text-xl font-semibold text-gray-900 mb-6 flex items-center gap-2">
                <font-awesome-icon :icon="['fas', 'info-circle']" class="text-blue-500" />
                General Information
            </h2>

            <!-- Project Name -->
            <div class="mb-6 pb-6 border-b border-gray-200">
                <div class="flex flex-row">
                    <div class="flex flex-col justify-center">
                        <label class="block text-sm font-semibold text-gray-900">Project Name</label>
                    </div>
                    <div v-if="!isEditingName" class="flex flex-row gap-3 ml-3">
                        <input 
                            v-model="project.name"
                            type="text"
                            disabled
                            class="w-full p-1 border bg-gray-100 text-gray-400 border-gray-300 rounded-md"
                        />
                        <button 
                            v-if="isAnalyst"
                            @click="startEditName"
                            class="text-blue-600 hover:text-blue-700 text-sm font-medium cursor-pointer flex items-center gap-1"
                        >
                            <font-awesome-icon :icon="['fas', 'pencil']" class="text-xs" />
                            Edit
                        </button>
                    </div>
                    <div v-else class="flex flex-row w-[600px] gap-3 ml-3">
                        <input 
                            v-model="editedName"
                            type="text"
                            class="w-1/3 p-1 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                            placeholder="Enter project name"
                            @keyup.enter="saveName"
                            @keyup.escape="cancelEditName"
                        />
                        <div class="flex flex-row w-2/3 gap-2">
                            <button 
                                @click="saveName"
                                :disabled="!editedName.trim() || savingName"
                                class="px-2 py-1 w-full bg-blue-600 text-white text-sm font-medium rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
                            >
                                {{ savingName ? 'Saving...' : 'Save Changes' }}
                            </button>
                            <button 
                                @click="cancelEditName"
                                :disabled="savingName"
                                class="px-2 py-1 w-full border border-gray-300 text-gray-700 text-sm font-medium rounded-md hover:bg-gray-50 cursor-pointer"
                            >
                                Cancel
                            </button>
                        </diV>
                    </div>
                </div>
            </div>

            <!-- Project Description -->
            <div class="mb-6 pb-6 border-b border-gray-200">
                <div class="flex flex-row">
                    <div class="flex flex-col justify-center">
                        <label class="block text-sm font-semibold text-gray-900">Description</label>
                    </div>
                    <div v-if="!isEditingDescription" class="flex flex-row gap-3 ml-3">
                        <textarea 
                            v-model="project.description"
                            rows="4"
                            disabled
                            class="w-full p-1 border bg-gray-100 text-gray-400 border-gray-300 rounded-md"
                            placeholder="No description provided"
                        ></textarea>
                        <button 
                            v-if="isAnalyst"
                            @click="startEditDescription"
                            class="text-blue-600 hover:text-blue-700 text-sm font-medium cursor-pointer flex items-center gap-1"
                        >
                            <font-awesome-icon :icon="['fas', 'pencil']" class="text-xs" />
                            Edit
                        </button>
                    </div>
                    <div v-else class="flex flex-row w-[600px] gap-3 ml-3">
                        <textarea 
                            v-model="editedDescription"
                            rows="4"
                            class="w-1/3 p-1 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                            placeholder="Enter project description"
                            @keyup.escape="cancelEditDescription"
                        ></textarea>
                        <div class="flex flex-row w-2/3 gap-2">
                            <button 
                                @click="saveDescription"
                                :disabled="savingDescription"
                                class="px-2 py-1 w-full bg-blue-600 text-white text-sm font-medium rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
                            >
                                {{ savingDescription ? 'Saving...' : 'Save Changes' }}
                            </button>
                            <button 
                                @click="cancelEditDescription"
                                :disabled="savingDescription"
                                class="px-2 py-1 w-full border border-gray-300 text-gray-700 text-sm font-medium rounded-md hover:bg-gray-50 cursor-pointer"
                            >
                                Cancel
                            </button>
                        </div>
                    </div>
                </div>
            </div>

            <!-- Project Stats (Read-only) -->
            <div class="grid grid-cols-2 md:grid-cols-3 gap-6">
                <div>
                    <p class="text-xs text-gray-500 uppercase tracking-wider mb-1.5">Project ID</p>
                    <p class="text-base font-mono text-gray-900">#{{ project.id }}</p>
                </div>
                <div>
                    <p class="text-xs text-gray-500 uppercase tracking-wider mb-1.5">Created</p>
                    <p class="text-base text-gray-900">{{ formattedCreatedDate }}</p>
                </div>
                <div>
                    <p class="text-xs text-gray-500 uppercase tracking-wider mb-1.5">Data Sources</p>
                    <p class="text-base font-semibold text-gray-900">{{ project.data_sources_count || 0 }}</p>
                </div>
                <div>
                    <p class="text-xs text-gray-500 uppercase tracking-wider mb-1.5">Data Models</p>
                    <p class="text-base font-semibold text-gray-900">{{ project.data_models_count || 0 }}</p>
                </div>
                <div>
                    <p class="text-xs text-gray-500 uppercase tracking-wider mb-1.5">Dashboards</p>
                    <p class="text-base font-semibold text-gray-900">{{ project.dashboards_count || 0 }}</p>
                </div>
                <div>
                    <p class="text-xs text-gray-500 uppercase tracking-wider mb-1.5">Team Members</p>
                    <p class="text-base font-semibold text-gray-900">{{ project.members?.length || 0 }}</p>
                </div>
            </div>
        </div>

        <!-- Team & Access Control Section -->
        <div class="bg-white rounded-lg shadow-sm border border-gray-200 p-6 mb-6">
            <div class="flex items-center justify-between mb-6">
                <h2 class="text-xl font-semibold text-gray-900 flex items-center gap-2">
                    <font-awesome-icon :icon="['fas', 'users']" class="text-blue-500" />
                    Team & Access Control
                </h2>
                <button 
                    v-if="isAnalyst"
                    @click="showMembersDialog = true"
                    class="px-4 py-2 bg-blue-500 text-white rounded-md hover:bg-blue-600 flex items-center gap-2 cursor-pointer"
                >
                    <font-awesome-icon :icon="['fas', 'user-plus']" />
                    Manage Team
                </button>
            </div>

            <!-- Members List -->
            <div v-if="project.members && project.members.length > 0" class="space-y-3">
                <div 
                    v-for="member in project.members"
                    :key="member.id"
                    class="flex items-center justify-between p-4 bg-gray-50 rounded-lg"
                >
                    <div class="flex-1">
                        <p class="font-semibold text-gray-900">
                            {{ member.user.first_name }} {{ member.user.last_name }}
                            <span v-if="member.user.id === project.user_platform_id" class="text-sm text-gray-500">(You)</span>
                        </p>
                        <p class="text-sm text-gray-600">{{ member.user.email }}</p>
                    </div>
                    <div class="flex items-center gap-2">
                        <span 
                            v-if="member.is_owner"
                            class="px-3 py-1 rounded-full text-sm font-medium bg-red-100 text-red-800"
                        >
                            Owner
                        </span>
                        <span 
                            class="px-3 py-1 rounded-full text-sm font-medium capitalize"
                            :class="{
                                'bg-cyan-100 text-cyan-800': member.marketing_role === 'analyst',
                                'bg-indigo-100 text-indigo-800': member.marketing_role === 'manager',
                                'bg-purple-100 text-purple-800': member.marketing_role === 'cmo'
                            }"
                        >
                            {{ member.marketing_role }}
                        </span>
                    </div>
                </div>
            </div>
            <div v-else class="p-8 text-center text-gray-500">
                <font-awesome-icon :icon="['fas', 'users']" class="text-4xl mb-2 text-gray-300" />
                <p>No team members yet</p>
            </div>
        </div>

        <!-- Danger Zone (Owner Only) -->
        <div v-if="isOwner" class="bg-red-50 border-2 border-red-200 rounded-lg p-6">
            <h2 class="text-xl font-semibold text-red-900 mb-4 flex items-center gap-2">
                <font-awesome-icon :icon="['fas', 'triangle-exclamation']" />
                Danger Zone
            </h2>
            <p class="text-sm text-red-700 mb-6">
                These actions are irreversible. Please proceed with caution.
            </p>

            <!-- Transfer Ownership -->
            <div class="bg-white rounded-lg p-4 mb-4">
                <div class="flex items-start justify-between">
                    <div class="flex-1">
                        <h3 class="font-semibold text-gray-900 mb-1">Transfer Ownership</h3>
                        <p class="text-sm text-gray-600">
                            Transfer this project to another team member. You will lose owner privileges.
                        </p>
                    </div>
                    <button 
                        @click="openTransferDialog"
                        :disabled="eligibleNewOwners.length === 0"
                        class="ml-4 px-4 py-2 bg-orange-500 text-white rounded-md hover:bg-orange-600 disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
                        v-tippy="eligibleNewOwners.length === 0 ? { content: 'Add team members before transferring ownership' } : {}"
                    >
                        Transfer Ownership
                    </button>
                </div>
            </div>

            <!-- Delete Project -->
            <div class="bg-white rounded-lg p-4">
                <div class="flex items-start justify-between">
                    <div class="flex-1">
                        <h3 class="font-semibold text-gray-900 mb-1">Delete Project</h3>
                        <p class="text-sm text-gray-600">
                            Permanently delete this project and all associated data. This cannot be undone.
                        </p>
                    </div>
                    <button 
                        @click="openDeleteDialog"
                        class="ml-4 px-4 py-2 bg-red-600 text-white rounded-md hover:bg-red-700 cursor-pointer"
                    >
                        Delete Project
                    </button>
                </div>
            </div>
        </div>

        <!-- Project Members Dialog -->
        <ProjectMembersDialog
            v-if="showMembersDialog"
            :is-open="showMembersDialog"
            :project-id="projectId"
            :user-role="isOwner ? 'owner' : 'admin'"
            :members="project.members || []"
            :show-marketing-role="true"
            @close="showMembersDialog = false"
            @member-updated="handleMemberUpdated"
        />

        <!-- Transfer Ownership Modal -->
        <overlay-dialog v-if="showTransferDialog" @close="showTransferDialog = false">
            <template v-slot:overlay>
                <div class="max-w-md w-full">
                    <h2 class="text-2xl font-bold mb-4 text-gray-900">Transfer Ownership</h2>
                    <p class="text-gray-600 mb-6">
                        Select a team member to transfer ownership to. You will lose owner privileges and become a regular team member.
                    </p>

                    <div class="mb-6">
                        <label class="block text-sm font-medium text-gray-700 mb-2">
                            New Owner
                        </label>
                        <select 
                            v-model="selectedNewOwner"
                            class="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:border-blue-500"
                        >
                            <option :value="null">Select a member...</option>
                            <option 
                                v-for="member in eligibleNewOwners"
                                :key="member.id"
                                :value="member.user.id"
                            >
                                {{ member.user.first_name }} {{ member.user.last_name }} ({{ member.user.email }})
                            </option>
                        </select>
                    </div>

                    <div v-if="transferError" class="mb-4 p-3 bg-red-100 border border-red-300 text-red-800 rounded-md text-sm">
                        {{ transferError }}
                    </div>

                    <div class="flex gap-3 justify-end">
                        <button 
                            @click="showTransferDialog = false"
                            :disabled="transferring"
                            class="px-4 py-2 border border-gray-300 text-gray-700 rounded-md hover:bg-gray-50 cursor-pointer"
                        >
                            Cancel
                        </button>
                        <button 
                            @click="confirmTransferOwnership"
                            :disabled="!selectedNewOwner || transferring"
                            class="px-4 py-2 bg-orange-500 text-white rounded-md hover:bg-orange-600 disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
                        >
                            {{ transferring ? 'Transferring...' : 'Confirm Transfer' }}
                        </button>
                    </div>
                </div>
            </template>
        </overlay-dialog>

        <!-- Delete Project Modal -->
        <overlay-dialog v-if="showDeleteDialog" @close="showDeleteDialog = false">
            <template v-slot:overlay>
                <div class="max-w-md w-full">
                    <h2 class="text-2xl font-bold mb-4 text-red-900">Delete Project</h2>
                    <div class="bg-red-50 border border-red-200 rounded-lg p-4 mb-6">
                        <p class="text-red-800 font-semibold mb-2">⚠️ Warning: This action cannot be undone!</p>
                        <p class="text-red-700 text-sm">
                            This will permanently delete:
                        </p>
                        <ul class="list-disc list-inside text-red-700 text-sm mt-2 space-y-1">
                            <li>{{ project.data_sources_count || 0 }} data sources</li>
                            <li>{{ project.data_models_count || 0 }} data models</li>
                            <li>{{ project.dashboards_count || 0 }} dashboards</li>
                            <li>All project data and configurations</li>
                        </ul>
                    </div>

                    <div class="mb-6">
                        <label class="block text-sm font-medium text-gray-700 mb-2">
                            Type <span class="font-mono bg-gray-100 px-2 py-1 rounded">{{ project.name }}</span> to confirm:
                        </label>
                        <input 
                            v-model="deleteConfirmation"
                            type="text"
                            class="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:border-red-500"
                            placeholder="Project name"
                        />
                    </div>

                    <div v-if="deleteError" class="mb-4 p-3 bg-red-100 border border-red-300 text-red-800 rounded-md text-sm">
                        {{ deleteError }}
                    </div>

                    <div class="flex gap-3 justify-end">
                        <button 
                            @click="showDeleteDialog = false"
                            :disabled="deleting"
                            class="px-4 py-2 border border-gray-300 text-gray-700 rounded-md hover:bg-gray-50 cursor-pointer"
                        >
                            Cancel
                        </button>
                        <button 
                            @click="confirmDeleteProject"
                            :disabled="deleteConfirmation !== project.name || deleting"
                            class="px-4 py-2 bg-red-600 text-white rounded-md hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
                        >
                            {{ deleting ? 'Deleting...' : 'Delete Project' }}
                        </button>
                    </div>
                </div>
            </template>
        </overlay-dialog>
    </div>
</template>
