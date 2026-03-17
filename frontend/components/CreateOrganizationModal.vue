<script setup lang="ts">
import { useOrganizationsStore } from '@/stores/organizations';

const emit = defineEmits(['close', 'created']);
const { $swal } = useNuxtApp();
const organizationsStore = useOrganizationsStore();

const state = reactive({
    name: '',
    slug: '',
    submitting: false,
    errors: {} as Record<string, string>
});

// Auto-generate slug from name
watch(() => state.name, (newName) => {
    if (newName && !state.slug) {
        state.slug = newName
            .toLowerCase()
            .replace(/[^a-z0-9]+/g, '-')
            .replace(/^-+|-+$/g, '');
    }
});

function validateForm(): boolean {
    state.errors = {};
    
    if (!state.name.trim()) {
        state.errors.name = 'Organization name is required';
    } else if (state.name.trim().length < 3) {
        state.errors.name = 'Organization name must be at least 3 characters';
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

async function createOrganization() {
    if (!validateForm()) return;
    
    state.submitting = true;
    
    try {
        const config = useRuntimeConfig();
        const token = getAuthToken();
        
        if (!token) {
            throw new Error('Authentication required. Please log in.');
        }
        
        const response = await $fetch<{ success: boolean; data: any; message?: string }>(
            `${config.public.apiBase}/organizations`,
            {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Authorization-Type': 'auth',
                    'Content-Type': 'application/json'
                },
                body: {
                    name: state.name.trim(),
                    slug: state.slug.trim(),
                    subscriptionTierId: 1 // Default to free tier
                }
            }
        );
        
        if (response.success) {
            await $swal.fire({
                title: 'Success!',
                text: 'Organization created successfully',
                icon: 'success',
                confirmButtonColor: '#1e3a5f',
                timer: 2000
            });
            
            // Refresh organizations list
            await organizationsStore.retrieveOrganizations();
            
            // Select the newly created organization
            if (response.data) {
                organizationsStore.setSelectedOrganization(response.data);
            }
            
            emit('created', response.data);
            emit('close');
        } else {
            throw new Error(response.message || 'Failed to create organization');
        }
        
    } catch (error: any) {
        const errorMessage = error?.data?.message || error?.message || 'An error occurred while creating the organization. Please try again.';
        
        $swal.fire({
            title: 'Error',
            text: errorMessage,
            icon: 'error',
            confirmButtonColor: '#1e3a5f',
        });
    } finally {
        state.submitting = false;
    }
}

function closeModal() {
    emit('close');
}
</script>

<template>
    <div class="fixed inset-0 z-50 overflow-y-auto" @click.self="closeModal">
        <div class="flex min-h-screen items-center justify-center p-4">
            <!-- Overlay -->
            <div class="fixed inset-0 bg-black bg-opacity-50 transition-opacity"></div>
            
            <!-- Modal -->
            <div class="relative bg-white rounded-2xl shadow-2xl max-w-lg w-full">
                <!-- Header -->
                <div class="bg-primary-blue-100 px-6 py-4 rounded-t-2xl">
                    <div class="flex items-center justify-between">
                        <h2 class="text-2xl font-bold text-white">Create Organization</h2>
                        <button
                            @click="closeModal"
                            type="button"
                            class="text-white hover:text-gray-200 transition-colors"
                        >
                            <font-awesome-icon :icon="['fas', 'xmark']" class="w-6 h-6" />
                        </button>
                    </div>
                    <p class="text-white/90 text-sm mt-2">
                        Create a new organization to manage projects and team members
                    </p>
                </div>
                
                <!-- Body -->
                <div class="px-6 py-6">
                    <form @submit.prevent="createOrganization" class="space-y-5">
                        <!-- Organization Name -->
                        <div>
                            <label for="org-name" class="block text-sm font-medium text-gray-700 mb-2">
                                Organization Name <span class="text-red-500">*</span>
                            </label>
                            <input
                                id="org-name"
                                v-model="state.name"
                                type="text"
                                placeholder="e.g., Acme Corporation"
                                class="w-full px-4 py-2.5 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors"
                                :class="{ 'border-red-500': state.errors.name }"
                                maxlength="100"
                            />
                            <p v-if="state.errors.name" class="mt-1 text-sm text-red-600">
                                {{ state.errors.name }}
                            </p>
                        </div>
                        
                        <!-- Slug -->
                        <div>
                            <label for="org-slug" class="block text-sm font-medium text-gray-700 mb-2">
                                Slug (URL-safe identifier) <span class="text-red-500">*</span>
                            </label>
                            <input
                                id="org-slug"
                                v-model="state.slug"
                                type="text"
                                placeholder="e.g., acme-corp"
                                class="w-full px-4 py-2.5 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors font-mono text-sm"
                                :class="{ 'border-red-500': state.errors.slug }"
                                maxlength="50"
                            />
                            <p v-if="state.errors.slug" class="mt-1 text-sm text-red-600">
                                {{ state.errors.slug }}
                            </p>
                            <p v-else class="mt-1 text-xs text-gray-500">
                                Lowercase letters, numbers, and hyphens only (e.g., my-organization)
                            </p>
                        </div>
                        
                        <!-- Info Box -->
                        <div class="bg-blue-50 border border-blue-200 rounded-lg p-4">
                            <div class="flex gap-3">
                                <font-awesome-icon :icon="['fas', 'circle-info']" class="w-5 h-5 text-blue-600 shrink-0 mt-0.5" />
                                <div class="text-sm text-blue-800">
                                    <p class="font-medium mb-1">What happens next?</p>
                                    <ul class="list-disc list-inside space-y-1 text-blue-700">
                                        <li>You'll be added as the organization owner</li>
                                        <li>A default workspace will be created</li>
                                        <li>You can invite team members later</li>
                                    </ul>
                                </div>
                            </div>
                        </div>
                        
                        <!-- Actions -->
                        <div class="flex gap-3 pt-2">
                            <button
                                type="button"
                                @click="closeModal"
                                class="flex-1 px-4 py-2.5 border border-gray-300 rounded-lg text-gray-700 font-medium hover:bg-gray-50 transition-colors"
                                :disabled="state.submitting"
                            >
                                Cancel
                            </button>
                            <button
                                type="submit"
                                class="flex-1 px-4 py-2.5 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                                :disabled="state.submitting"
                            >
                                <font-awesome-icon
                                    v-if="state.submitting"
                                    :icon="['fas', 'spinner']"
                                    class="w-4 h-4 animate-spin"
                                />
                                <span>{{ state.submitting ? 'Creating...' : 'Create Organization' }}</span>
                            </button>
                        </div>
                    </form>
                </div>
            </div>
        </div>
    </div>
</template>
