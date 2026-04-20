<script setup lang="ts">
import { useSitemapStore } from '@/stores/sitemap';
const { $swal } = useNuxtApp();
const sitemapStore = useSitemapStore();

interface State {
    url: string;
    publish_status: string;
    priority: number;
    submitting: boolean;
}
const state = reactive<State>({
    url: '',
    publish_status: 'draft',
    priority: 0,
    submitting: false
});

const urlError = ref<string>('');

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
    
    const result = await sitemapStore.addSitemapEntry(
        state.url,
        state.publish_status,
        state.priority
    );
    
    state.submitting = false;
    
    if (result) {
        await $swal.fire({
            title: 'Success!',
            text: 'The sitemap entry has been added successfully.',
            icon: 'success',
            timer: 2000,
            showConfirmButton: false
        });
        navigateTo('/admin/sitemap');
    } else {
        $swal.fire({
            title: 'Error!',
            text: 'There was an error adding the sitemap entry.',
            icon: 'error'
        });
    }
}
</script>

<template>
    <div class="flex flex-row">
        <sidebar-admin class="w-1/6" />
        <div class="w-5/6">
            <div class="min-h-100 flex flex-col ml-4 mr-4 mb-10 md:ml-10 md:mr-10 mt-5 border border-primary-blue-100 border-solid p-10 shadow-md rounded-lg">
                <div class="flex flex-row items-center mb-5">
                    <NuxtLink
                        to="/admin/sitemap"
                        class="mr-4 text-primary-blue-500 hover:text-primary-blue-700"
                    >
                        <font-awesome icon="fas fa-arrow-left" class="text-xl" />
                    </NuxtLink>
                    <div class="font-bold text-2xl">
                        Add New Sitemap Entry
                    </div>
                </div>
                
                <form @submit.prevent="submitForm" class="space-y-6">
                    <!-- URL Field -->
                    <BaseFormField label="URL" required>
                        <BaseInput
                            id="url"
                            v-model="state.url"
                            type="url"
                            placeholder="https://www.example.com/page"
                            @blur="validateUrl"
                            :error="urlError"
                            required
                        />
                    </BaseFormField>
                    
                    <!-- Status Field -->
                    <BaseFormField
                        label="Status"
                        required
                        hint="Draft entries will not appear in the public sitemap"
                    >
                        <BaseSelect
                            id="publish_status"
                            v-model="state.publish_status"
                            :options="[
                                { value: 'draft', label: 'Draft' },
                                { value: 'published', label: 'Published' }
                            ]"
                            required
                        />
                    </BaseFormField>
                    
                    <!-- Priority Field -->
                    <BaseFormField
                        label="Priority"
                        hint="Lower numbers appear first in the sitemap (0 = highest priority)"
                    >
                        <BaseNumberInput
                            id="priority"
                            v-model="state.priority"
                            :min="0"
                        />
                    </BaseFormField>
                    
                    <!-- Submit Button -->
                    <div class="flex gap-3">
                        <button
                            type="submit"
                            :disabled="state.submitting"
                            class="px-6 py-2 bg-primary-blue-100 text-white hover:bg-primary-blue-300 font-bold rounded-lg shadow-md disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer flex items-center justify-center"
                        >
                            <span v-if="!state.submitting">Add Entry</span>
                            <span v-else class="flex items-center">
                                <font-awesome-icon :icon="['fas', 'spinner']" class="animate-spin -ml-1 mr-3 h-5 w-5 text-white" />
                                Adding...
                            </span>
                        </button>
                        <NuxtLink
                            to="/admin/sitemap"
                            class="px-6 py-2 bg-gray-300 text-gray-700 hover:bg-gray-400 font-bold rounded-lg shadow-md text-center cursor-pointer"
                        >
                            Cancel
                        </NuxtLink>
                    </div>
                </form>
            </div>
        </div>
    </div>
</template>
