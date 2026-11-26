<script setup lang="ts">
import { NuxtLink } from '#components';

const { $swal } = useNuxtApp();
const { authors, pending, error, refresh } = useAuthors();

async function deleteAuthor(author: any): Promise<void> {
    const result = await $swal.fire({
        title: `Delete ${author.name}?`,
        text: 'Articles written by this author will fall back to "Data Research Analysis Team". You cannot revert this.',
        icon: 'warning',
        showCancelButton: true,
        confirmButtonColor: '#3C8DBC',
        cancelButtonColor: '#DD4B39',
        confirmButtonText: 'Yes, delete it!',
    });
    if (!result.isConfirmed) {
        return;
    }

    try {
        const token = getAuthToken();
        await $fetch(`${baseUrl()}/admin/author/delete/${author.id}`, {
            method: 'DELETE',
            headers: {
                'Authorization': `Bearer ${token}`,
                'Authorization-Type': 'auth',
            },
        });
        await refresh();
        $swal.fire({ icon: 'success', title: 'Deleted!', text: 'The author has been deleted.' });
    } catch (e) {
        $swal.fire({ icon: 'error', title: 'Error!', text: 'The author could not be deleted.' });
    }
}

useHead({
    title: 'Authors - Admin | Data Research Analysis',
    meta: [{ name: 'robots', content: 'noindex, nofollow' }],
});
</script>

<template>
    <div class="flex flex-row">
        <sidebar-admin class="w-1/6" />
        <div class="w-5/6">
            <div class="min-h-100 flex flex-col ml-4 mr-4 mb-10 md:ml-10 md:mr-10 mt-5 border border-primary-blue-100 border-solid p-10 shadow-md rounded-lg">
                <div class="flex flex-row justify-between items-center mb-5">
                    <div class="font-bold text-2xl">
                        Authors
                    </div>
                    <NuxtLink
                        class="px-6 py-2 text-center text-sm bg-primary-blue-100 text-white hover:bg-primary-blue-300 cursor-pointer font-bold shadow-md rounded-lg"
                        to="/admin/authors/create"
                    >
                        Add Author
                    </NuxtLink>
                </div>

                <div v-if="pending" class="p-10 text-center text-gray-500">
                    Loading authors...
                </div>

                <div v-else-if="error" class="p-10 text-center text-red-500">
                    Error loading authors. Please refresh the page.
                </div>

                <div v-else-if="!authors || authors.length === 0" class="p-10 text-center text-gray-500">
                    <font-awesome icon="fas fa-user-pen" class="text-5xl mb-4 text-gray-300" />
                    <p class="text-lg">No authors yet</p>
                    <NuxtLink
                        class="inline-block mt-4 px-6 py-2 text-sm bg-primary-blue-100 text-white hover:bg-primary-blue-300 cursor-pointer font-bold shadow-md rounded-lg"
                        to="/admin/authors/create"
                    >
                        Create your first author
                    </NuxtLink>
                </div>

                <div v-else class="bg-white shadow-md overflow-hidden rounded-lg ring-1 ring-gray-200 ring-inset">
                    <div class="overflow-x-auto">
                        <table class="min-w-full divide-y divide-gray-200">
                            <thead class="bg-gray-50">
                                <tr>
                                    <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Author</th>
                                    <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Bio</th>
                                    <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Links</th>
                                    <th class="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
                                </tr>
                            </thead>
                            <tbody class="bg-white divide-y divide-gray-200">
                                <tr v-for="author in authors" :key="author.id" class="hover:bg-gray-50">
                                    <td class="px-6 py-4 whitespace-nowrap">
                                        <div class="flex items-center gap-3">
                                            <img
                                                v-if="author.picture"
                                                :src="author.picture"
                                                :alt="author.name"
                                                class="w-10 h-10 rounded-full object-cover border border-gray-200"
                                            />
                                            <div v-else class="w-10 h-10 rounded-full bg-gray-100 flex items-center justify-center text-gray-400">
                                                <font-awesome icon="fas fa-user" />
                                            </div>
                                            <span class="font-medium text-gray-900">{{ author.name }}</span>
                                        </div>
                                    </td>
                                    <td class="px-6 py-4 text-sm text-gray-600 max-w-md">
                                        <span class="line-clamp-2">{{ author.bio || '—' }}</span>
                                    </td>
                                    <td class="px-6 py-4 text-sm">
                                        <div class="flex flex-col gap-1">
                                            <a
                                                v-if="author.linkedin_url"
                                                :href="author.linkedin_url"
                                                target="_blank"
                                                rel="noopener noreferrer"
                                                class="text-primary-blue-100 hover:underline"
                                            >
                                                LinkedIn
                                            </a>
                                            <a
                                                v-if="author.website_url"
                                                :href="author.website_url"
                                                target="_blank"
                                                rel="noopener noreferrer"
                                                class="text-primary-blue-100 hover:underline"
                                            >
                                                Website
                                            </a>
                                            <span v-if="!author.linkedin_url && !author.website_url" class="text-gray-400">—</span>
                                        </div>
                                    </td>
                                    <td class="px-6 py-4 whitespace-nowrap text-right text-sm">
                                        <div class="flex justify-end gap-2">
                                            <NuxtLink
                                                :to="`/admin/authors/${author.id}`"
                                                class="px-3 py-1 rounded bg-gray-100 hover:bg-gray-200 text-gray-700 font-medium transition-colors"
                                            >
                                                Edit
                                            </NuxtLink>
                                            <button
                                                @click="deleteAuthor(author)"
                                                class="px-3 py-1 rounded bg-red-50 hover:bg-red-100 text-red-600 font-medium transition-colors cursor-pointer"
                                            >
                                                Delete
                                            </button>
                                        </div>
                                    </td>
                                </tr>
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>
        </div>
    </div>
</template>
