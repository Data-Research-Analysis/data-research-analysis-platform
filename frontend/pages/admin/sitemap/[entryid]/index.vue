<script setup>
import { useSitemapStore } from '@/stores/sitemap';
const { $swal } = useNuxtApp();
const route = useRoute();
const sitemapStore = useSitemapStore();

const entryId = computed(() => parseInt(route.params.entryid));

const state = reactive({
    url: '',
    priority: 0,
    submitting: false,
    loading: true
});

const urlError = ref('');

onServerPrefetch(async () => {
    await sitemapStore.retrieveSitemapEntries();
    const entry = sitemapStore.getSitemapEntries().find(e => e.id === entryId.value);
    if (entry) {
        sitemapStore.setSelectedEntry(entry);
    }
});

onMounted(async () => {
    if (import.meta.client) {
        await sitemapStore.retrieveSitemapEntries();
        const entry = sitemapStore.getSelectedEntry();
        
        if (!entry || entry.id !== entryId.value) {
            const found = sitemapStore.getSitemapEntries().find(e => e.id === entryId.value);
            if (found) {
                sitemapStore.setSelectedEntry(found);
                state.url = found.url;
                state.priority = found.priority;
            } else {
                $swal.fire({
                    title: 'Error!',
                    text: 'Sitemap entry not found.',
                    icon: 'error'
                });
                navigateTo('/admin/sitemap');
                return;
            }
        } else {
            state.url = entry.url;
            state.priority = entry.priority;
        }
        
        state.loading = false;
    }
});

function validateUrl() {
    if (!state.url) {
        urlError.value = 'URL is required';
        return false;
    }
    
    try {
        new URL(state.url);
        urlError.value = '';
        return true;
    } catch {
        urlError.value = 'Please enter a valid URL (e.g., https://example.com)';
        return false;
    }
}

async function submitForm() {
    if (!validateUrl()) {
        return;
    }
    
    state.submitting = true;
    
    const result = await sitemapStore.editSitemapEntry(
        entryId.value,
        state.url,
        state.priority
    );
    
    state.submitting = false;
    
    if (result) {
        await $swal.fire({
            title: 'Success!',
            text: 'The sitemap entry has been updated successfully.',
            icon: 'success',
            timer: 2000,
            showConfirmButton: false
        });
        navigateTo('/admin/sitemap');
    } else {
        $swal.fire({
            title: 'Error!',
            text: 'There was an error updating the sitemap entry.',
            icon: 'error'
        });
    }
}
</script>

<template>
    <div class="flex flex-row">
        <sidebar-admin class="w-1/6" />
        <div class="w-5/6">
            <!-- Loading State -->
            <div v-if="state.loading" class="min-h-100 flex flex-col ml-4 mr-4 mb-10 md:ml-10 md:mr-10 mt-5 border border-primary-blue-100 border-solid p-10 shadow-md rounded-lg">
                <div class="flex items-center justify-center py-20">
                    <div class="text-center">
                        <div class="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-primary-blue-500 mb-4"></div>
                        <p class="text-gray-600">Loading entry...</p>
                    </div>
                </div>
            </div>
            
            <!-- Edit Form -->
            <div v-else class="min-h-100 flex flex-col ml-4 mr-4 mb-10 md:ml-10 md:mr-10 mt-5 border border-primary-blue-100 border-solid p-10 shadow-md rounded-lg">
                <div class="flex flex-row items-center mb-5">
                    <NuxtLink
                        to="/admin/sitemap"
                        class="mr-4 text-primary-blue-500 hover:text-primary-blue-700"
                    >
                        <font-awesome icon="fas fa-arrow-left" class="text-xl" />
                    </NuxtLink>
                    <div class="font-bold text-2xl">
                        Edit Sitemap Entry
                    </div>
                </div>
                
                <form @submit.prevent="submitForm" class="space-y-6">
                    <!-- URL Field -->
                    <div>
                        <label for="url" class="block text-sm font-medium text-gray-700 mb-2">
                            URL <span class="text-red-500">*</span>
                        </label>
                        <input
                            id="url"
                            v-model="state.url"
                            type="text"
                            placeholder="https://www.example.com/page"
                            @blur="validateUrl"
                            class="w-full px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-blue-500"
                            :class="{ 'border-red-500': urlError }"
                            required
                        />
                        <p v-if="urlError" class="mt-1 text-sm text-red-500">{{ urlError }}</p>
                    </div>
                    
                    <!-- Priority Field -->
                    <div>
                        <label for="priority" class="block text-sm font-medium text-gray-700 mb-2">
                            Priority
                        </label>
                        <input
                            id="priority"
                            v-model.number="state.priority"
                            type="number"
                            min="0"
                            class="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-blue-500"
                        />
                        <p class="mt-1 text-sm text-gray-500">
                            Lower numbers appear first in the sitemap (0 = highest priority)
                        </p>
                    </div>
                    
                    <div class="bg-blue-50 border border-blue-200 rounded-lg p-4">
                        <p class="text-sm text-blue-700">
                            <strong>Note:</strong> To change the publish status, use the Publish/Unpublish buttons on the main list page.
                        </p>
                    </div>
                    
                    <!-- Submit Button -->
                    <div class="flex gap-3">
                        <button
                            type="submit"
                            :disabled="state.submitting"
                            class="px-6 py-2 bg-primary-blue-100 text-white hover:bg-primary-blue-300 font-bold rounded-lg shadow-md disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                            <span v-if="!state.submitting">Update Entry</span>
                            <span v-else class="flex items-center">
                                <svg class="animate-spin -ml-1 mr-3 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                                    <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
                                    <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                                </svg>
                                Updating...
                            </span>
                        </button>
                        <NuxtLink
                            to="/admin/sitemap"
                            class="px-6 py-2 bg-gray-300 text-gray-700 hover:bg-gray-400 font-bold rounded-lg shadow-md text-center"
                        >
                            Cancel
                        </NuxtLink>
                    </div>
                </form>
            </div>
        </div>
    </div>
</template>
