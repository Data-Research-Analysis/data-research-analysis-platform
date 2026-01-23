<script setup>
import { NuxtLink } from '#components';
import { useSitemapStore } from '@/stores/sitemap';
const { $swal } = useNuxtApp();
const sitemapStore = useSitemapStore();

onMounted(async () => {
    await sitemapStore.retrieveSitemapEntries();
});

const filterStatus = ref('all');

const entries = computed(() => {
    return sitemapStore.sitemapEntries;
});

const filteredEntries = computed(() => {
    if (filterStatus.value === 'all') {
        return entries.value;
    } else {
        return entries.value.filter(entry => entry.publish_status === filterStatus.value);
    }
});

async function deleteEntry(entryId) {
    const { value: confirmDelete } = await $swal.fire({
        title: "Are you sure you want to delete this sitemap entry?",
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
    
    const result = await sitemapStore.deleteEntry(entryId);
    
    if (result) {
        $swal.fire(`The sitemap entry has been deleted successfully.`);
    } else {
        $swal.fire(`There was an error deleting the sitemap entry.`);
    }
}

async function publishEntry(entryId) {
    const result = await sitemapStore.publishEntry(entryId);
    
    if (result) {
        $swal.fire({
            title: 'Published!',
            text: 'The sitemap entry has been published successfully.',
            icon: 'success',
            timer: 2000,
            showConfirmButton: false
        });
    } else {
        $swal.fire(`There was an error publishing the sitemap entry.`);
    }
}

async function unpublishEntry(entryId) {
    const result = await sitemapStore.unpublishEntry(entryId);
    
    if (result) {
        $swal.fire({
            title: 'Unpublished!',
            text: 'The sitemap entry has been unpublished successfully.',
            icon: 'success',
            timer: 2000,
            showConfirmButton: false
        });
    } else {
        $swal.fire(`There was an error unpublishing the sitemap entry.`);
    }
}

function editEntry(entry) {
    sitemapStore.setSelectedEntry(entry);
    navigateTo(`/admin/sitemap/${entry.id}`);
}
</script>
<template>
    <div class="flex flex-row">
        <sidebar-admin class="w-1/6" />
        <div class="w-5/6">
            <div class="min-h-100 flex flex-col ml-4 mr-4 mb-10 md:ml-10 md:mr-10 mt-5 border border-primary-blue-100 border-solid p-10 shadow-md rounded-lg">
                <div class="flex flex-row justify-between items-center mb-5">
                    <div class="font-bold text-2xl">
                        Sitemap Manager
                    </div>
                    <div class="flex gap-3">
                        <select 
                            v-model="filterStatus" 
                            class="px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-blue-500"
                        >
                            <option value="all">All Entries</option>
                            <option value="published">Published</option>
                            <option value="draft">Draft</option>
                        </select>
                        <NuxtLink
                            class="px-6 py-2 text-center text-sm bg-primary-blue-100 text-white hover:bg-primary-blue-300 cursor-pointer font-bold shadow-md rounded-lg"
                            to="/admin/sitemap/create"
                        >
                            Add New URL
                        </NuxtLink>
                    </div>
                </div>
                
                <div class="bg-white shadow-md overflow-hidden rounded-lg ring-1 ring-gray-200 ring-inset">
                    <div v-if="!filteredEntries || filteredEntries.length === 0" class="p-10 text-center text-gray-500">
                        <font-awesome icon="fas fa-inbox" class="text-5xl mb-4 text-gray-300" />
                        <p class="text-lg">No sitemap entries found</p>
                        <NuxtLink
                            class="inline-block mt-4 px-6 py-2 text-sm bg-primary-blue-100 text-white hover:bg-primary-blue-300 cursor-pointer font-bold shadow-md rounded-lg"
                            to="/admin/sitemap/create"
                        >
                            Create your first entry
                        </NuxtLink>
                    </div>
                    <div v-else class="overflow-x-auto">
                        <table class="min-w-full divide-y divide-gray-200">
                            <thead class="bg-gray-50">
                                <tr>
                                    <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Priority</th>
                                    <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">URL</th>
                                    <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
                                    <th class="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
                                </tr>
                            </thead>
                            <tbody class="bg-white divide-y divide-gray-200">
                                <tr v-for="entry in filteredEntries" :key="entry.id" class="hover:bg-gray-50">
                                    <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                                        {{ entry.priority }}
                                    </td>
                                    <td class="px-6 py-4 text-sm text-gray-900">
                                        <a :href="entry.url" target="_blank" class="text-primary-blue-500 hover:underline break-all">
                                            {{ entry.url }}
                                        </a>
                                    </td>
                                    <td class="px-6 py-4 whitespace-nowrap">
                                        <span 
                                            v-if="entry.publish_status === 'published'" 
                                            class="px-2 py-1 inline-flex text-xs leading-5 font-semibold rounded-full bg-green-100 text-green-800"
                                        >
                                            Published
                                        </span>
                                        <span 
                                            v-else 
                                            class="px-2 py-1 inline-flex text-xs leading-5 font-semibold rounded-full bg-gray-100 text-gray-800"
                                        >
                                            Draft
                                        </span>
                                    </td>
                                    <td class="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                                        <div class="flex justify-end gap-2">
                                            <button
                                                @click="editEntry(entry)"
                                                class="flex items-center gap-2 px-3 py-1.5 rounded-md text-sm font-medium transition-colors bg-blue-100 hover:bg-blue-200 text-blue-700 hover:text-blue-900 cursor-pointer"
                                            >
                                                <font-awesome icon="fas fa-edit" class="text-base" />
                                                <span>Edit</span>
                                            </button>
                                            <button
                                                v-if="entry.publish_status === 'draft'"
                                                @click="publishEntry(entry.id)"
                                                class="flex items-center gap-2 px-3 py-1.5 rounded-md text-sm font-medium transition-colors bg-green-100 hover:bg-green-200 text-green-700 hover:text-green-900 cursor-pointer"
                                            >
                                                <font-awesome icon="fas fa-paper-plane" class="text-base" />
                                                <span>Publish</span>
                                            </button>
                                            <button
                                                v-else
                                                @click="unpublishEntry(entry.id)"
                                                class="flex items-center gap-2 px-3 py-1.5 rounded-md text-sm font-medium transition-colors bg-orange-100 hover:bg-orange-200 text-orange-700 hover:text-orange-900 cursor-pointer"
                                            >
                                                <font-awesome icon="fas fa-file-archive" class="text-base" />
                                                <span>Unpublish</span>
                                            </button>
                                            <button
                                                @click="deleteEntry(entry.id)"
                                                class="flex items-center gap-2 px-3 py-1.5 rounded-md text-sm font-medium transition-colors bg-red-100 hover:bg-red-200 text-red-700 hover:text-red-900 cursor-pointer"
                                            >
                                                <font-awesome icon="fas fa-trash" class="text-base" />
                                                <span>Delete</span>
                                            </button>
                                        </div>
                                    </td>
                                </tr>
                            </tbody>
                        </table>
                    </div>
                </div>
                
                <div class="mt-4 text-sm text-gray-500">
                    <p>
                        <strong>Total entries:</strong> {{ entries.length }} | 
                        <strong>Published:</strong> {{ entries.filter(e => e.publish_status === 'published').length }} | 
                        <strong>Draft:</strong> {{ entries.filter(e => e.publish_status === 'draft').length }}
                    </p>
                    <p class="mt-2">
                        Public sitemap available at: <a :href="`${baseUrl()}/sitemap.txt`" target="_blank" class="text-primary-blue-500 hover:underline">{{ baseUrl() }}/sitemap.txt</a>
                    </p>
                </div>
            </div>
        </div>
    </div>
</template>
