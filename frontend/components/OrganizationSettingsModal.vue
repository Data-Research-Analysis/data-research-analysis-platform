<script setup lang="ts">
import { useOrganizationsStore } from '@/stores/organizations';
import { useOrganizationManagement } from '@/composables/useOrganizationManagement';

interface Organization {
    id: number;
    name: string;
    domain?: string;
    logo_url?: string;
    user_role?: string; // User's role in the organization
}

const props = defineProps<{
    organization: Organization;
}>();

const emit = defineEmits(['close', 'updated', 'deleted']);
const { $swal } = useNuxtApp();
const organizationsStore = useOrganizationsStore();
const organizationManagement = useOrganizationManagement();

const state = reactive({
    activeTab: 'general' as 'general' | 'danger',
    name: props.organization.name,
    submitting: false,
    errors: {} as Record<string, string>,
    // Delete confirmation
    deleteConfirmName: '',
    deleting: false
});

const isOwner = computed(() => {
    return props.organization.user_role === 'owner';
});

const isAdmin = computed(() => {
    return props.organization.user_role === 'admin' || isOwner.value;
});

const hasChanges = computed(() => {
    return state.name !== props.organization.name;
});

// Debug logging
onMounted(() => {
    console.log('[OrganizationSettingsModal] Mounted with organization:', props.organization);
    console.log('[OrganizationSettingsModal] user_role:', props.organization.user_role);
    console.log('[OrganizationSettingsModal] isOwner:', isOwner.value);
    console.log('[OrganizationSettingsModal] isAdmin:', isAdmin.value);
});

function validateForm(): boolean {
    state.errors = {};
    
    if (!state.name.trim()) {
        state.errors.name = 'Organization name is required';
    } else if (state.name.trim().length < 3) {
        state.errors.name = 'Organization name must be at least 3 characters';
    }
    
    return Object.keys(state.errors).length === 0;
}

async function saveChanges() {
    if (!validateForm()) return;
    
    state.submitting = true;
    
    try {
        const result = await organizationManagement.updateOrganization(props.organization.id, {
            name: state.name.trim()
        });
        
        if (result.success) {
            await $swal.fire({
                title: 'Success!',
                text: 'Organization updated successfully',
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
            
            // Refresh organizations list
            await organizationsStore.retrieveOrganizations();
            
            emit('updated', result.data);
            emit('close');
        } else {
            throw new Error(result.error || 'Failed to update organization');
        }
        
    } catch (error: any) {
        $swal.fire({
            title: 'Error',
            text: error?.message || 'An error occurred while updating the organization',
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

async function deleteOrganization() {
    console.log('[OrganizationSettingsModal] deleteOrganization called');
    console.log('[OrganizationSettingsModal] org.name:', props.organization.name);
    console.log('[OrganizationSettingsModal] confirmName:', state.deleteConfirmName);
    console.log('[OrganizationSettingsModal] user_role:', props.organization.user_role);
    
    if (state.deleteConfirmName !== props.organization.name) {
        state.errors.deleteConfirmName = 'Organization name does not match';
        return;
    }
    
    console.log('[OrganizationSettingsModal] Name matches, showing confirmation dialog');
    console.log('[OrganizationSettingsModal] $swal available?', !!$swal);
    console.log('[OrganizationSettingsModal] $swal.fire available?', typeof $swal?.fire);
    
    let confirmResult;
    try {
        console.log('[OrganizationSettingsModal] About to call $swal.fire...');
        const { value: confirmDelete, isConfirmed, isDismissed } = await $swal.fire({
            title: 'Are you absolutely sure?',
            html: `
                <p class="text-gray-700 mb-2">This action <strong class="text-red-600">cannot be undone</strong>.</p>
                <p class="text-gray-700">This will permanently delete:</p>
                <ul class="text-left list-disc list-inside text-gray-600 mt-2 space-y-1">
                    <li>The organization "${props.organization.name}"</li>
                    <li>All workspaces in this organization</li>
                    <li>All projects and data in these workspaces</li>
                    <li>All member access</li>
                </ul>
            `,
            icon: 'warning',
            showCancelButton: true,
            confirmButtonColor: '#dc2626',
            confirmButtonText: 'Yes, delete permanently',
            cancelButtonText: 'Cancel',
            customClass: {
                container: 'swal-high-z-index'
            },
            didOpen: () => {
                // Force SweetAlert to appear above the modal
                const swalContainer = document.querySelector('.swal2-container');
                if (swalContainer) {
                    (swalContainer as HTMLElement).style.zIndex = '10001';
                }
            }
        });
        console.log('[OrganizationSettingsModal] $swal.fire completed');
        console.log('[OrganizationSettingsModal] confirmDelete value:', confirmDelete);
        console.log('[OrganizationSettingsModal] isConfirmed:', isConfirmed);
        console.log('[OrganizationSettingsModal] isDismissed:', isDismissed);
        
        if (!confirmDelete) {
            console.log('[OrganizationSettingsModal] User cancelled - confirmDelete is falsy');
            return;
        }
    } catch (swalError) {
        console.error('[OrganizationSettingsModal] SweetAlert error:', swalError);
        console.error('[OrganizationSettingsModal] SweetAlert error stack:', swalError?.stack);
        return;
    }
    
    console.log('[OrganizationSettingsModal] Confirmation approved, starting delete...');
    state.deleting = true;
    
    try {
        console.log('[OrganizationSettingsModal] Calling organizationManagement.deleteOrganization');
        const result = await organizationManagement.deleteOrganization(
            props.organization.id,
            state.deleteConfirmName
        );
        
        console.log('[OrganizationSettingsModal] API response:', result);
        
        if (result.success) {
            await $swal.fire({
                title: 'Deleted!',
                text: 'Organization has been deleted',
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
            
            // Refresh organizations list
            await organizationsStore.retrieveOrganizations();
            
            emit('deleted');
            emit('close');
        } else {
            throw new Error(result.error || 'Failed to delete organization');
        }
        
    } catch (error: any) {
        console.error('[OrganizationSettingsModal] Error in deleteOrganization:', error);
        console.error('[OrganizationSettingsModal] Error stack:', error?.stack);
        console.error('[OrganizationSettingsModal] Error data:', error?.data);
        
        $swal.fire({
            title: 'Error',
            text: error?.message || 'An error occurred while deleting the organization',
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
        console.log('[OrganizationSettingsModal] Finally block - setting deleting to false');
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
                            <h2 class="text-2xl font-bold text-white">Organization Settings</h2>
                            <button
                                @click="closeModal"
                                type="button"
                                class="text-white hover:text-gray-200 transition-colors cursor-pointer"
                            >
                                <font-awesome-icon :icon="['fas', 'xmark']" class="w-6 h-6" />
                            </button>
                        </div>
                        <p class="text-white/90 text-sm mt-2">
                            Manage {{ organization.name }}
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
                                <font-awesome-icon :icon="['fas', 'building']" class="mr-2" />
                                General
                            </button>
                            <button
                                v-if="isOwner"
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
                                <!-- Organization Name -->
                                <div>
                                    <label for="org-name" class="block text-sm font-medium text-gray-700 mb-2">
                                        Organization Name <span class="text-red-500">*</span>
                                    </label>
                                    <input
                                        id="org-name"
                                        v-model="state.name"
                                        type="text"
                                        :disabled="!isAdmin"
                                        placeholder="e.g., Acme Corporation"
                                        class="w-full px-4 py-2.5 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors text-gray-900 disabled:bg-gray-100 disabled:cursor-not-allowed"
                                        :class="{ 'border-red-500': state.errors.name }"
                                        maxlength="100"
                                    />
                                    <p v-if="state.errors.name" class="mt-1 text-sm text-red-600">
                                        {{ state.errors.name }}
                                    </p>
                                </div>
                                
                                <!-- Role Badge -->
                                <div class="bg-blue-50 border border-blue-200 rounded-lg p-4">
                                    <div class="flex items-center gap-2text-sm">
                                        <font-awesome-icon 
                                            :icon="['fas', isOwner ? 'crown' : 'user-shield']" 
                                            class="text-blue-600"
                                        />
                                        <span class="text-blue-800 font-medium">
                                            Your role: {{ isOwner ? 'Owner' : isAdmin ? 'Admin' : 'Member' }}
                                        </span>
                                    </div>
                                    <p v-if="!isAdmin" class="text-xs text-blue-700 mt-1">
                                        Only admins and owners can modify organization settings
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
                        <div v-if="state.activeTab === 'danger' && isOwner" class="space-y-5">
                            <div class="bg-red-50 border-2 border-red-200 rounded-lg p-6">
                                <div class="flex items-start gap-3 mb-4">
                                    <font-awesome-icon 
                                        :icon="['fas', 'triangle-exclamation']" 
                                        class="w-6 h-6 text-red-600 shrink-0 mt-1"
                                    />
                                    <div>
                                        <h3 class="text-lg font-semibold text-red-900 mb-2">
                                            Delete Organization
                                        </h3>
                                        <p class="text-sm text-red-800 mb-3">
                                            Once you delete an organization, there is no going back. This will permanently delete:
                                        </p>
                                        <ul class="list-disc list-inside text-sm text-red-700 space-y-1 mb-4">
                                            <li>All workspaces in this organization</li>
                                            <li>All projects and their data</li>
                                            <li>All dashboards and data models</li>
                                            <li>All member access and permissions</li>
                                        </ul>
                                        
                                        <div class="mt-4">
                                            <label for="delete-confirm" class="block text-sm font-medium text-red-900 mb-2">
                                                Type <span class="font-mono bg-red-100 px-2 py-1 rounded">{{ organization.name }}</span> to confirm:
                                            </label>
                                            <input
                                                id="delete-confirm"
                                                v-model="state.deleteConfirmName"
                                                type="text"
                                                placeholder="Organization name"
                                                class="w-full px-4 py-2.5 border-2 border-red-300 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-red-500 transition-colors text-gray-900"
                                                :class="{ 'border-red-500': state.errors.deleteConfirmName }"
                                            />
                                            <p v-if="state.errors.deleteConfirmName" class="mt-1 text-sm text-red-600">
                                                {{ state.errors.deleteConfirmName }}
                                            </p>
                                        </div>
                                        
                                        <button
                                            type="button"
                                            @click="deleteOrganization"
                                            :disabled="state.deleting || state.deleteConfirmName !== organization.name"
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
                                            <span>{{ state.deleting ? 'Deleting...' : 'Delete Organization Permanently' }}</span>
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
