<script setup lang="ts">
import { useOrganizationsStore } from '@/stores/organizations';
import { useWorkspaceManagement } from '@/composables/useWorkspaceManagement';

interface Workspace {
    id: number;
    name: string;
    slug: string;
    description?: string;
    user_role?: string; // User's role in the workspace
}

const props = defineProps<{
    workspace: Workspace;
    organizationId: number;
}>();

const emit = defineEmits(['close', 'updated', 'deleted']);
const { $swal } = useNuxtApp();
const organizationsStore = useOrganizationsStore();
const workspaceManagement = useWorkspaceManagement();

const state = reactive({
    activeTab: 'general' as 'general' | 'danger',
    name: props.workspace.name,
    slug: props.workspace.slug,
    description: props.workspace.description || '',
    submitting: false,
    errors: {} as Record<string, string>,
    slugManuallyEdited: false,
    // Delete confirmation
    deleteConfirmName: '',
    deleting: false
});

// Auto-generate slug from name if not manually edited
watch(() => state.name, (newName) => {
    if (!state.slugManuallyEdited) {
        state.slug = newName
            .toLowerCase()
            .replace(/[^a-z0-9]+/g, '-')
            .replace(/^-+|-+$/g, '');
    }
});

const isAdmin = computed(() => {
    return props.workspace.user_role === 'admin';
});

const isDefaultWorkspace = computed(() => {
    return props.workspace.slug === 'default' || props.workspace.name === 'Default Workspace';
});

const hasChanges = computed(() => {
    return state.name !== props.workspace.name || 
           state.slug !== props.workspace.slug ||
           state.description !== (props.workspace.description || '');
});

// Debug logging
onMounted(() => {
    console.log('[WorkspaceSettingsModal] Mounted with workspace:', props.workspace);
    console.log('[WorkspaceSettingsModal] user_role:', props.workspace.user_role);
    console.log('[WorkspaceSettingsModal] isAdmin:', isAdmin.value);
    console.log('[WorkspaceSettingsModal] isDefaultWorkspace:', isDefaultWorkspace.value);
});

function validateForm(): boolean {
    state.errors = {};
    
    if (!state.name.trim()) {
        state.errors.name = 'Workspace name is required';
    } else if (state.name.trim().length < 3) {
        state.errors.name = 'Workspace name must be at least 3 characters';
    }
    
    if (!state.slug.trim()) {
        state.errors.slug = 'Slug is required';
    } else if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(state.slug)) {
        state.errors.slug = 'Slug must be lowercase alphanumeric with hyphens only';
    } else if (state.slug.length < 3) {
        state.errors.slug = 'Slug must be at least 3 characters';
    }
    
    return Object.keys(state.errors).length === 0;
}

async function saveChanges() {
    if (!validateForm()) return;
    
    state.submitting = true;
    
    try {
        const result = await workspaceManagement.updateWorkspace(props.workspace.id, {
            name: state.name.trim(),
            slug: state.slug.trim(),
            description: state.description.trim() || undefined
        });
        
        if (result.success) {
            await $swal.fire({
                title: 'Success!',
                text: 'Workspace updated successfully',
                icon: 'success',
                confirmButtonColor: '#1e3a5f',
                timer: 2000,
                didOpen: () => {
                    const swalContainer = document.querySelector('.swal2-container');
                    if (swalContainer) {
                        (swalContainer as HTMLElement).style.zIndex = '10001';
                    }
                }
            });
            
            // Refresh workspaces list
            await organizationsStore.retrieveWorkspaces(props.organizationId);
            
            emit('updated', result.data);
            emit('close');
        } else {
            throw new Error(result.error || 'Failed to update workspace');
        }
        
    } catch (error: any) {
        $swal.fire({
            title: 'Error',
            text: error?.message || 'An error occurred while updating the workspace',
            icon: 'error',
            confirmButtonColor: '#1e3a5f',
            didOpen: () => {
                const swalContainer = document.querySelector('.swal2-container');
                if (swalContainer) {
                    (swalContainer as HTMLElement).style.zIndex = '10001';
                }
            }
        });
    } finally {
        state.submitting = false;
    }
}

async function deleteWorkspace() {
    console.log('[WorkspaceSettingsModal] deleteWorkspace called');
    console.log('[WorkspaceSettingsModal] workspace.name:', props.workspace.name);
    console.log('[WorkspaceSettingsModal] confirmName:', state.deleteConfirmName);
    console.log('[WorkspaceSettingsModal] user_role:', props.workspace.user_role);
    console.log('[WorkspaceSettingsModal] isDefaultWorkspace:', isDefaultWorkspace.value);
    
    if (state.deleteConfirmName !== props.workspace.name) {
        state.errors.deleteConfirmName = 'Workspace name does not match';
        return;
    }
    
    console.log('[WorkspaceSettingsModal] Name matches, showing confirmation dialog');
    
    let confirmResult;
    try {
        const { value: confirmDelete, isConfirmed, isDismissed } = await $swal.fire({
            title: 'Are you absolutely sure?',
            html: `
                <p class="text-gray-700 mb-2">This action <strong class="text-red-600">cannot be undone</strong>.</p>
                <p class="text-gray-700">This will permanently delete:</p>
                <ul class="text-left list-disc list-inside text-gray-600 mt-2 space-y-1">
                    <li>The workspace "${props.workspace.name}"</li>
                    <li>All projects in this workspace will be orphaned</li>
                    <li>All member access to this workspace</li>
                </ul>
            `,
            icon: 'warning',
            showCancelButton: true,
            confirmButtonColor: '#dc2626',
            confirmButtonText: 'Yes, delete permanently',
            cancelButtonText: 'Cancel',
            didOpen: () => {
                // Force SweetAlert to appear above the modal
                const swalContainer = document.querySelector('.swal2-container');
                if (swalContainer) {
                    (swalContainer as HTMLElement).style.zIndex = '10001';
                }
            }
        });
        
        console.log('[WorkspaceSettingsModal] Confirmation completed');
        console.log('[WorkspaceSettingsModal] confirmDelete value:', confirmDelete);
        console.log('[WorkspaceSettingsModal] isConfirmed:', isConfirmed);
        console.log('[WorkspaceSettingsModal] isDismissed:', isDismissed);
        
        if (!confirmDelete) {
            console.log('[WorkspaceSettingsModal] User cancelled - confirmDelete is falsy');
            return;
        }
    } catch (swalError) {
        console.error('[WorkspaceSettingsModal] SweetAlert error:', swalError);
        return;
    }
    
    console.log('[WorkspaceSettingsModal] Confirmation approved, starting delete...');
    state.deleting = true;
    
    try {
        console.log('[WorkspaceSettingsModal] Calling workspaceManagement.deleteWorkspace');
        const result = await workspaceManagement.deleteWorkspace(
            props.workspace.id,
            state.deleteConfirmName
        );
        
        console.log('[WorkspaceSettingsModal] API response:', result);
        
        if (result.success) {
            await $swal.fire({
                title: 'Deleted!',
                text: 'Workspace has been deleted',
                icon: 'success',
                confirmButtonColor: '#1e3a5f',
                timer: 2000,
                didOpen: () => {
                    const swalContainer = document.querySelector('.swal2-container');
                    if (swalContainer) {
                        (swalContainer as HTMLElement).style.zIndex = '10001';
                    }
                }
            });
            
            // Refresh workspaces list
            await organizationsStore.retrieveWorkspaces(props.organizationId);
            
            emit('deleted');
            emit('close');
        } else {
            throw new Error(result.error || 'Failed to delete workspace');
        }
        
    } catch (error: any) {
        console.error('[WorkspaceSettingsModal] Error in deleteWorkspace:', error);
        console.error('[WorkspaceSettingsModal] Error stack:', error?.stack);
        console.error('[WorkspaceSettingsModal] Error data:', error?.data);
        
        $swal.fire({
            title: 'Error',
            text: error?.message || 'An error occurred while deleting the workspace',
            icon: 'error',
            confirmButtonColor: '#1e3a5f',
            didOpen: () => {
                const swalContainer = document.querySelector('.swal2-container');
                if (swalContainer) {
                    (swalContainer as HTMLElement).style.zIndex = '10001';
                }
            }
        });
    } finally {
        console.log('[WorkspaceSettingsModal] Finally block - setting deleting to false');
        state.deleting = false;
    }
}

function closeModal() {
    emit('close');
}
</script>

<template>
    <Teleport to="body">
        <div class="fixed inset-0 z-[9999] overflow-y-auto" @click.self="closeModal">
            <div class="flex min-h-screen items-center justify-center p-4">
                <!-- Overlay -->
                <div class="fixed inset-0 bg-black bg-opacity-50 transition-opacity z-[9999]"></div>
                
                <!-- Modal -->
                <div class="relative bg-white rounded-2xl shadow-2xl max-w-2xl w-full z-[10000]">
                    <!-- Header -->
                    <div class="bg-primary-blue-100 px-6 py-4 rounded-t-2xl">
                        <div class="flex items-center justify-between">
                            <h2 class="text-2xl font-bold text-white">Workspace Settings</h2>
                            <button
                                @click="closeModal"
                                type="button"
                                class="text-white hover:text-gray-200 transition-colors cursor-pointer"
                            >
                                <font-awesome-icon :icon="['fas', 'xmark']" class="w-6 h-6" />
                            </button>
                        </div>
                        <p class="text-white/90 text-sm mt-2">
                            Manage {{ workspace.name }}
                        </p>
                    </div>
                    
                    <!-- Tabs -->
                    <div class="border-b border-gray-200">
                        <div class="flex px-6">
                            <button
                                @click="state.activeTab = 'general'"
                                class="px-4 py-3 text-sm font-medium border-b-2 transition-colors cursor-pointer"
                                :class="state.activeTab === 'general' 
                                    ? 'border-blue-600 text-blue-600' 
                                    : 'border-transparent text-gray-600 hover:text-gray-900'"
                            >
                                <font-awesome-icon :icon="['fas', 'briefcase']" class="mr-2" />
                                General
                            </button>
                            <button
                                v-if="isAdmin && !isDefaultWorkspace"
                                @click="state.activeTab = 'danger'"
                                class="px-4 py-3 text-sm font-medium border-b-2 transition-colors cursor-pointer"
                                :class="state.activeTab === 'danger' 
                                    ? 'border-red-600 text-red-600' 
                                    : 'border-transparent text-gray-600 hover:text-gray-900'"
                            >
                                <font-awesome-icon :icon="['fas', 'triangle-exclamation']" class="mr-2" />
                                Danger Zone
                            </button>
                        </div>
                    </div>
                    
                    <!-- Body -->
                    <div class="px-6 py-6">
                        <!-- General Tab -->
                        <div v-if="state.activeTab === 'general'" class="space-y-5">
                            <form @submit.prevent="saveChanges" class="space-y-5">
                                <!-- Workspace Name -->
                                <div>
                                    <label for="workspace-name" class="block text-sm font-medium text-gray-700 mb-2">
                                        Workspace Name <span class="text-red-500">*</span>
                                    </label>
                                    <input
                                        id="workspace-name"
                                        v-model="state.name"
                                        type="text"
                                        :disabled="!isAdmin"
                                        placeholder="e.g., Marketing Team"
                                        class="w-full px-4 py-2.5 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors text-gray-900 disabled:bg-gray-100 disabled:cursor-not-allowed"
                                        :class="{ 'border-red-500': state.errors.name }"
                                        maxlength="100"
                                    />
                                    <p v-if="state.errors.name" class="mt-1 text-sm text-red-600">
                                        {{ state.errors.name }}
                                    </p>
                                </div>
                                
                                <!-- Slug -->
                                <div>
                                    <label for="workspace-slug" class="block text-sm font-medium text-gray-700 mb-2">
                                        Slug (URL-safe identifier) <span class="text-red-500">*</span>
                                    </label>
                                    <input
                                        id="workspace-slug"
                                        v-model="state.slug"
                                        @input="state.slugManuallyEdited = true"
                                        type="text"
                                        :disabled="!isAdmin"
                                        placeholder="e.g., marketing-team"
                                        class="w-full px-4 py-2.5 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors font-mono text-sm text-gray-900 disabled:bg-gray-100 disabled:cursor-not-allowed"
                                        :class="{ 'border-red-500': state.errors.slug }"
                                        maxlength="50"
                                    />
                                    <p v-if="state.errors.slug" class="mt-1 text-sm text-red-600">
                                        {{ state.errors.slug }}
                                    </p>
                                    <p v-else class="mt-1 text-xs text-gray-500">
                                        Lowercase letters, numbers, and hyphens only
                                    </p>
                                </div>
                                
                                <!-- Description -->
                                <div>
                                    <label for="workspace-description" class="block text-sm font-medium text-gray-700 mb-2">
                                        Description <span class="text-gray-400 text-xs">(Optional)</span>
                                    </label>
                                    <textarea
                                        id="workspace-description"
                                        v-model="state.description"
                                        rows="3"
                                        :disabled="!isAdmin"
                                        placeholder="Briefly describe the purpose of this workspace..."
                                        class="w-full px-4 py-2.5 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors resize-none text-gray-900 disabled:bg-gray-100 disabled:cursor-not-allowed"
                                        maxlength="500"
                                    />
                                    <p class="mt-1 text-xs text-gray-500">
                                        {{ state.description.length }}/500 characters
                                    </p>
                                </div>
                                
                                <!-- Role Badge -->
                                <div class="bg-blue-50 border border-blue-200 rounded-lg p-4">
                                    <div class="flex items-center gap-2 text-sm">
                                        <font-awesome-icon 
                                            :icon="['fas', isAdmin ? 'user-shield' : 'user']" 
                                            class="text-blue-600"
                                        />
                                        <span class="text-blue-800 font-medium">
                                            Your role: {{ isAdmin ? 'Admin' : workspace.user_role || 'Member' }}
                                        </span>
                                    </div>
                                    <p v-if="!isAdmin" class="text-xs text-blue-700 mt-1">
                                        Only workspace admins can modify settings
                                    </p>
                                    <p v-if="isDefaultWorkspace" class="text-xs text-blue-700 mt-1">
                                        This is the default workspace created with your organization
                                    </p>
                                </div>
                                
                                <!-- Actions -->
                                <div class="flex gap-3 pt-2">
                                    <button
                                        type="button"
                                        @click="closeModal"
                                        class="flex-1 px-4 py-2.5 border border-gray-300 rounded-lg text-gray-700 font-medium hover:bg-gray-50 transition-colors cursor-pointer"
                                        :disabled="state.submitting"
                                    >
                                        Cancel
                                    </button>
                                    <button
                                        v-if="isAdmin"
                                        type="submit"
                                        class="flex-1 px-4 py-2.5 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 cursor-pointer"
                                        :disabled="state.submitting || !hasChanges"
                                    >
                                        <font-awesome-icon
                                            v-if="state.submitting"
                                            :icon="['fas', 'spinner']"
                                            class="w-4 h-4 animate-spin"
                                        />
                                        <span>{{ state.submitting ? 'Saving...' : 'Save Changes' }}</span>
                                    </button>
                                </div>
                            </form>
                        </div>
                        
                        <!-- Danger Zone Tab -->
                        <div v-if="state.activeTab === 'danger' && isAdmin && !isDefaultWorkspace" class="space-y-5">
                            <div class="bg-red-50 border-2 border-red-200 rounded-lg p-6">
                                <div class="flex items-start gap-3 mb-4">
                                    <font-awesome-icon 
                                        :icon="['fas', 'triangle-exclamation']" 
                                        class="w-6 h-6 text-red-600 shrink-0 mt-1"
                                    />
                                    <div>
                                        <h3 class="text-lg font-semibold text-red-900 mb-2">
                                            Delete Workspace
                                        </h3>
                                        <p class="text-sm text-red-800 mb-3">
                                            Once you delete a workspace, there is no going back. This will:
                                        </p>
                                        <ul class="list-disc list-inside text-sm text-red-700 space-y-1 mb-4">
                                            <li>Soft-delete the workspace (mark as inactive)</li>
                                            <li>Orphan all projects (they'll remain but lose workspace association)</li>
                                            <li>Remove all member access to this workspace</li>
                                        </ul>
                                        
                                        <div class="mt-4">
                                            <label for="delete-confirm" class="block text-sm font-medium text-red-900 mb-2">
                                                Type <span class="font-mono bg-red-100 px-2 py-1 rounded">{{ workspace.name }}</span> to confirm:
                                            </label>
                                            <input
                                                id="delete-confirm"
                                                v-model="state.deleteConfirmName"
                                                type="text"
                                                placeholder="Workspace name"
                                                class="w-full px-4 py-2.5 border-2 border-red-300 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-red-500 transition-colors text-gray-900"
                                                :class="{ 'border-red-500': state.errors.deleteConfirmName }"
                                            />
                                            <p v-if="state.errors.deleteConfirmName" class="mt-1 text-sm text-red-600">
                                                {{ state.errors.deleteConfirmName }}
                                            </p>
                                        </div>
                                        
                                        <button                                            type="button"                                            @click="deleteWorkspace"
                                            :disabled="state.deleting || state.deleteConfirmName !== workspace.name"
                                            class="mt-4 w-full px-4 py-2.5 bg-red-600 text-white rounded-lg font-medium hover:bg-red-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 cursor-pointer"
                                        >
                                            <font-awesome-icon
                                                v-if="state.deleting"
                                                :icon="['fas', 'spinner']"
                                                class="w-4 h-4 animate-spin"
                                            />
                                            <font-awesome-icon
                                                v-else
                                                :icon="['fas', 'trash']"
                                                class="w-4 h-4"
                                            />
                                            <span>{{ state.deleting ? 'Deleting...' : 'Delete Workspace Permanently' }}</span>
                                        </button>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    </Teleport>
</template>
