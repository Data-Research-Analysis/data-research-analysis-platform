<script setup lang="ts">
import { useOrganizationsStore } from '@/stores/organizations';
import { useOrganizationManagement } from '@/composables/useOrganizationManagement';
import { useSSO } from '@/composables/useSSO';

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
const sso = useSSO();

interface ISSOFormState {
    idp_name: string;
    idp_entity_id: string;
    idp_sso_url: string;
    idp_certificate: string;
    sp_entity_id: string;
    is_enabled: boolean;
    allow_jit_provisioning: boolean;
    enforce_sso: boolean;
}

const state = reactive({
    activeTab: 'general' as 'general' | 'sso' | 'danger',
    name: props.organization.name,
    submitting: false,
    ssoLoading: false,
    ssoInitialized: false,
    errors: {} as Record<string, string>,
    // Delete confirmation
    deleteConfirmName: '',
    deleting: false
});

const ssoForm = reactive<ISSOFormState>({
    idp_name: 'custom',
    idp_entity_id: '',
    idp_sso_url: '',
    idp_certificate: '',
    sp_entity_id: '',
    is_enabled: false,
    allow_jit_provisioning: true,
    enforce_sso: false
});

const domainVerificationDomain = ref('');
const domainVerificationToken = ref('');

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

async function loadSSOConfig() {
    try {
        state.ssoLoading = true;
        const configData = await sso.getConfiguration(props.organization.id);
        state.ssoInitialized = true;

        if (!configData) {
            return;
        }

        ssoForm.idp_name = configData.idp_name || 'custom';
        ssoForm.idp_entity_id = configData.idp_entity_id || '';
        ssoForm.idp_sso_url = configData.idp_sso_url || '';
        ssoForm.sp_entity_id = configData.sp_entity_id || '';
        if (configData.idp_certificate && !String(configData.idp_certificate).includes('...')) {
            ssoForm.idp_certificate = configData.idp_certificate;
        }
        ssoForm.is_enabled = !!configData.is_enabled;
        ssoForm.allow_jit_provisioning = configData.allow_jit_provisioning !== false;
        ssoForm.enforce_sso = !!configData.enforce_sso;
    } catch (error: any) {
        await $swal.fire({
            title: 'Error',
            text: error?.data?.error || error?.message || 'Failed to load SSO configuration',
            icon: 'error',
            confirmButtonColor: '#1e3a5f'
        });
    } finally {
        state.ssoLoading = false;
    }
}

async function saveSSOConfig() {
    try {
        state.ssoLoading = true;
        await sso.saveConfiguration(props.organization.id, {
            idp_name: ssoForm.idp_name,
            idp_entity_id: ssoForm.idp_entity_id,
            idp_sso_url: ssoForm.idp_sso_url,
            idp_certificate: ssoForm.idp_certificate,
            sp_entity_id: ssoForm.sp_entity_id,
            is_enabled: ssoForm.is_enabled,
            allow_jit_provisioning: ssoForm.allow_jit_provisioning,
            enforce_sso: ssoForm.enforce_sso
        });

        await $swal.fire({
            title: 'Success',
            text: 'SSO configuration saved successfully',
            icon: 'success',
            confirmButtonColor: '#1e3a5f'
        });
    } catch (error: any) {
        await $swal.fire({
            title: 'Error',
            text: error?.data?.error || error?.message || 'Failed to save SSO configuration',
            icon: 'error',
            confirmButtonColor: '#1e3a5f'
        });
    } finally {
        state.ssoLoading = false;
    }
}

async function removeSSOConfig() {
    const result = await $swal.fire({
        title: 'Remove SSO Configuration?',
        text: 'This will disable SSO for this organization.',
        icon: 'warning',
        showCancelButton: true,
        confirmButtonColor: '#dc2626',
        cancelButtonColor: '#6c757d',
        confirmButtonText: 'Yes, remove it'
    });

    if (!result.isConfirmed) {
        return;
    }

    try {
        state.ssoLoading = true;
        await sso.removeConfiguration(props.organization.id);

        ssoForm.idp_name = 'custom';
        ssoForm.idp_entity_id = '';
        ssoForm.idp_sso_url = '';
        ssoForm.idp_certificate = '';
        ssoForm.sp_entity_id = '';
        ssoForm.is_enabled = false;
        ssoForm.allow_jit_provisioning = true;
        ssoForm.enforce_sso = false;
        domainVerificationToken.value = '';

        await $swal.fire({
            title: 'Removed',
            text: 'SSO configuration removed.',
            icon: 'success',
            confirmButtonColor: '#1e3a5f'
        });
    } catch (error: any) {
        await $swal.fire({
            title: 'Error',
            text: error?.data?.error || error?.message || 'Failed to remove SSO configuration',
            icon: 'error',
            confirmButtonColor: '#1e3a5f'
        });
    } finally {
        state.ssoLoading = false;
    }
}

async function generateDomainVerification() {
    if (!domainVerificationDomain.value.trim()) {
        return;
    }

    try {
        state.ssoLoading = true;
        const result = await sso.initiateDomainVerification(props.organization.id, domainVerificationDomain.value.trim());
        domainVerificationToken.value = result?.token || '';
    } catch (error: any) {
        await $swal.fire({
            title: 'Error',
            text: error?.data?.error || error?.message || 'Failed to generate verification token',
            icon: 'error',
            confirmButtonColor: '#1e3a5f'
        });
    } finally {
        state.ssoLoading = false;
    }
}

async function verifyDomainNow() {
    if (!domainVerificationDomain.value.trim()) {
        return;
    }

    try {
        state.ssoLoading = true;
        const verified = await sso.checkDomainVerification(props.organization.id, domainVerificationDomain.value.trim());

        if (verified) {
            await $swal.fire({
                title: 'Domain Verified',
                text: 'Domain verification succeeded.',
                icon: 'success',
                confirmButtonColor: '#1e3a5f'
            });
        } else {
            await $swal.fire({
                title: 'Not Verified',
                text: 'Domain TXT record was not found yet. Please wait for DNS propagation and try again.',
                icon: 'info',
                confirmButtonColor: '#1e3a5f'
            });
        }
    } catch (error: any) {
        await $swal.fire({
            title: 'Error',
            text: error?.data?.error || error?.message || 'Domain verification failed',
            icon: 'error',
            confirmButtonColor: '#1e3a5f'
        });
    } finally {
        state.ssoLoading = false;
    }
}

watch(
    () => state.activeTab,
    async (tab) => {
        if (tab === 'sso' && isAdmin.value && !state.ssoInitialized) {
            await loadSSOConfig();
        }
    }
);

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
    } catch (swalError: any) {
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
                            <button
                                v-if="isAdmin"
                                @click="state.activeTab = 'sso'"
                                class="px-4 py-3 text-sm font-medium border-b-2 transition-colors cursor-pointer"
                                :class="state.activeTab === 'sso'
                                    ? 'border-blue-600 text-blue-600'
                                    : 'border-transparent text-gray-600 hover:text-gray-900'"
                            >
                                <font-awesome-icon :icon="['fas', 'shield']" class="mr-2" />
                                SSO
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

                        <!-- SSO Tab -->
                        <div v-if="state.activeTab === 'sso' && isAdmin" class="space-y-5">
                            <div class="bg-amber-50 border border-amber-200 rounded-lg p-4 text-sm text-amber-900">
                                Configure enterprise SAML SSO for your organization. Users can sign in via your IdP once enabled.
                            </div>

                            <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div>
                                    <label class="block text-sm font-medium text-gray-700 mb-1">IdP Name</label>
                                    <input
                                        v-model="ssoForm.idp_name"
                                        type="text"
                                        class="w-full px-3 py-2 border rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                                        placeholder="Okta"
                                    />
                                </div>
                                <div>
                                    <label class="block text-sm font-medium text-gray-700 mb-1">SP Entity ID</label>
                                    <input
                                        v-model="ssoForm.sp_entity_id"
                                        type="text"
                                        class="w-full px-3 py-2 border rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                                        placeholder="https://backend.dataresearchanalysis.test:3002/sso/metadata/ORG_ID"
                                    />
                                </div>
                            </div>

                            <div>
                                <label class="block text-sm font-medium text-gray-700 mb-1">IdP Entity ID</label>
                                <input
                                    v-model="ssoForm.idp_entity_id"
                                    type="text"
                                    class="w-full px-3 py-2 border rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                                    placeholder="https://idp.example.com/metadata"
                                />
                            </div>

                            <div>
                                <label class="block text-sm font-medium text-gray-700 mb-1">IdP SSO URL</label>
                                <input
                                    v-model="ssoForm.idp_sso_url"
                                    type="url"
                                    class="w-full px-3 py-2 border rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                                    placeholder="https://idp.example.com/sso"
                                />
                            </div>

                            <div>
                                <label class="block text-sm font-medium text-gray-700 mb-1">IdP Certificate</label>
                                <textarea
                                    v-model="ssoForm.idp_certificate"
                                    rows="6"
                                    class="w-full px-3 py-2 border rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                                    placeholder="-----BEGIN CERTIFICATE-----"
                                />
                            </div>

                            <div class="grid grid-cols-1 md:grid-cols-3 gap-4">
                                <label class="flex items-center gap-2 text-sm text-gray-700">
                                    <input v-model="ssoForm.is_enabled" type="checkbox" class="rounded border-gray-300 text-blue-600 focus:ring-blue-500" />
                                    Enable SSO
                                </label>
                                <label class="flex items-center gap-2 text-sm text-gray-700">
                                    <input v-model="ssoForm.allow_jit_provisioning" type="checkbox" class="rounded border-gray-300 text-blue-600 focus:ring-blue-500" />
                                    Allow JIT Provisioning
                                </label>
                                <label class="flex items-center gap-2 text-sm text-gray-700">
                                    <input v-model="ssoForm.enforce_sso" type="checkbox" class="rounded border-gray-300 text-blue-600 focus:ring-blue-500" />
                                    Enforce SSO Login
                                </label>
                            </div>

                            <div class="bg-gray-50 border border-gray-200 rounded-lg p-4 space-y-3">
                                <div class="text-sm font-medium text-gray-800">Domain Verification</div>
                                <div class="flex flex-col md:flex-row gap-2">
                                    <input
                                        v-model="domainVerificationDomain"
                                        type="text"
                                        class="flex-1 px-3 py-2 border rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                                        placeholder="example.com"
                                    />
                                    <button
                                        type="button"
                                        @click="generateDomainVerification"
                                        class="px-3 py-2 text-sm rounded-lg bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-50"
                                        :disabled="state.ssoLoading || !domainVerificationDomain.trim()"
                                    >
                                        Generate Token
                                    </button>
                                    <button
                                        type="button"
                                        @click="verifyDomainNow"
                                        class="px-3 py-2 text-sm rounded-lg bg-gray-700 text-white hover:bg-gray-800 disabled:opacity-50"
                                        :disabled="state.ssoLoading || !domainVerificationDomain.trim()"
                                    >
                                        Verify Now
                                    </button>
                                </div>
                                <div v-if="domainVerificationToken" class="text-xs break-all text-gray-700 bg-white border border-gray-200 rounded p-2">
                                    TXT token: {{ domainVerificationToken }}
                                </div>
                            </div>

                            <div class="flex flex-col md:flex-row gap-3 pt-2">
                                <button
                                    type="button"
                                    @click="removeSSOConfig"
                                    class="px-4 py-2.5 border border-red-300 text-red-700 rounded-lg hover:bg-red-50 disabled:opacity-50"
                                    :disabled="state.ssoLoading"
                                >
                                    Remove SSO Config
                                </button>
                                <button
                                    type="button"
                                    @click="saveSSOConfig"
                                    class="px-4 py-2.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
                                    :disabled="state.ssoLoading"
                                >
                                    <font-awesome-icon v-if="state.ssoLoading" :icon="['fas', 'spinner']" class="mr-2 animate-spin" />
                                    Save SSO Settings
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    </Teleport>
</template>
