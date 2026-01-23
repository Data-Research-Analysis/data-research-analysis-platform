<script setup>
import { NuxtLink } from '#components';
import { useArticlesStore } from '@/stores/articles';
const { $swal } = useNuxtApp();
const articlesStore = useArticlesStore();

// Fetch articles with client-side SSR
const { data: articlesList, pending, error, refresh } = useAdminArticles();

const state = reactive({});

const articles = computed(() => {
    if (!articlesList.value) return [];
    return [...articlesList.value].sort((a, b) => a.id - b.id);
});

async function deleteArticle(articleId) {
    const { value: confirmDelete } = await $swal.fire({
        title: "Are you sure you want to delete the article?",
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
    const data = await execute(`/admin/article/delete/${articleId}`, {
        method: 'DELETE'
    });
    
    if (data) {
        $swal.fire(`The article has been deleted successfully.`);
        await refresh(); // Refresh articles list
    } else {
        $swal.fire(`There was an error deleting the article.`);
    }
}

async function publishArticle(articleId) {
    const { value: confirmPublish } = await $swal.fire({
        title: "Are you sure you want to publish the article?",
        icon: "warning",
        showCancelButton: true,
        confirmButtonColor: "#3C8DBC",
        cancelButtonColor: "#DD4B39",
        confirmButtonText: "Yes, publish it!",
    });
    if (!confirmPublish) {
        return;
    }
    
    const { execute } = useAuthenticatedMutation();
    const data = await execute(`/admin/article/publish/${articleId}`, {
        method: 'GET'
    });
    
    if (data) {
        $swal.fire(`The article has been published successfully.`);
        await refresh(); // Refresh articles list
    } else {
        $swal.fire(`There was an error publishing the article.`);
    }
}

async function unpublishArticle(articleId) {
    const { value: confirmUnpublish } = await $swal.fire({
        title: "Are you sure you want to unpublish the article?",
        text: "This will make the article a draft",
        icon: "warning",
        showCancelButton: true,
        confirmButtonColor: "#3C8DBC",
        cancelButtonColor: "#DD4B39",
        confirmButtonText: "Yes, unpublish it!",
    });
    if (!confirmUnpublish) {
        return;
    }
    
    const { execute } = useAuthenticatedMutation();
    const data = await execute(`/admin/article/unpublish/${articleId}`, {
        method: 'GET'
    });
    
    if (data) {
        $swal.fire(`The article has been unpublished successfully.`);
        await refresh(); // Refresh articles list
    } else {
        $swal.fire(`There was an error unpublishing the article.`);
    }
}
</script>
<template>
    <div class="flex flex-row">
        <sidebar-admin class="w-1/6" />
        <div class="w-5/6">
            <!-- Loading State -->
            <div v-if="pending" class="min-h-100 flex flex-col ml-4 mr-4 mb-10 md:ml-10 md:mr-10 mt-5 border border-primary-blue-100 border-solid p-10 shadow-md rounded-lg">
                <div class="flex items-center justify-center py-20">
                    <div class="text-center">
                        <div class="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-primary-blue-500 mb-4"></div>
                        <p class="text-gray-600">Loading articles...</p>
                    </div>
                </div>
            </div>
            
            <!-- Error State -->
            <div v-else-if="error" class="min-h-100 flex flex-col ml-4 mr-4 mb-10 md:ml-10 md:mr-10 mt-5 border border-red-200 border-solid p-10 shadow-md bg-red-50">
                <div class="flex items-center justify-center py-20">
                    <div class="text-center">
                        <font-awesome icon="fas fa-exclamation-triangle" class="text-5xl text-red-500 mb-4" />
                        <p class="text-red-600 font-semibold mb-2">Error loading articles</p>
                        <p class="text-gray-600 text-sm">{{ error.message }}</p>
                        <button @click="refresh()" class="mt-4 px-4 py-2 bg-primary-blue-500 text-white hover:bg-primary-blue-600 rounded-lg">
                            Try Again
                        </button>
                    </div>
                </div>
            </div>
            
            <!-- Articles Content -->
            <div v-else class="min-h-100 flex flex-col ml-4 mr-4 mb-10 md:ml-10 md:mr-10 mt-5 border border-primary-blue-100 border-solid p-10 shadow-md rounded-lg">
                <div class="flex flex-row">
                    <div class="font-bold text-2xl mb-5">
                        List Articles
                    </div>
                    <NuxtLink
                        class="w-28 text-center self-center text-sm p-1 ml-2 mb-4 bg-primary-blue-100 text-white hover:bg-primary-blue-300 cursor-pointer font-bold shadow-md rounded-lg"
                        to="/admin/articles/create"
                    >
                        Add Article
                    </NuxtLink>
                </div>
                <div class="bg-white shadow-md overflow-hidden rounded-lg ring-1 ring-gray-200 ring-inset">
                    <div class="overflow-x-auto">
                        <table v-if="articles && articles.length" class="min-w-full divide-y divide-gray-200">
                            <thead class="bg-gray-50">
                                <tr>
                                    <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">ID</th>
                                    <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Title</th>
                                    <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
                                    <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Categories</th>
                                    <th class="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
                                </tr>
                            </thead>
                            <tbody class="bg-white divide-y divide-gray-200">
                                <tr v-for="article in articles" :key="article.id" class="hover:bg-gray-50">
                                    <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                                        {{ article.article.id }}
                                    </td>
                                    <td class="px-6 py-4 text-sm text-gray-900">
                                        {{ article.article.title }}
                                    </td>
                                    <td class="px-6 py-4 whitespace-nowrap text-sm">
                                        <span :class="{
                                            'bg-green-100 text-green-800 px-2 py-1 rounded-lg text-xs font-medium': article.article.publish_status === 'published', 
                                            'bg-yellow-100 text-yellow-800 px-2 py-1 rounded-lg text-xs font-medium': article.article.publish_status === 'draft'
                                        }">
                                            {{ article.article.publish_status.toUpperCase() }}
                                        </span>
                                    </td>
                                    <td class="px-6 py-4 text-sm">
                                        <div v-if="article.categories && article.categories.length" class="flex flex-wrap gap-1">
                                            <span v-for="category in article.categories" :key="category.id" class="bg-gray-100 text-gray-700 px-2 py-1 rounded text-xs">
                                                {{ category.title }}
                                            </span>
                                        </div>
                                        <div v-else class="text-gray-400 text-xs">No categories</div>
                                    </td>
                                    <td class="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                                        <div class="flex justify-end gap-2">
                                            <button v-if="article.article.publish_status === 'draft'" @click="publishArticle(article.article.id)" class="flex items-center gap-2 px-3 py-1.5 rounded-md text-sm font-medium transition-colors bg-green-100 hover:bg-green-200 text-green-700 hover:text-green-900 cursor-pointer">
                                                <font-awesome icon="fas fa-paper-plane" class="text-base" />
                                                <span>Publish</span>
                                            </button>
                                            <button v-if="article.article.publish_status === 'published'" @click="unpublishArticle(article.article.id)" class="flex items-center gap-2 px-3 py-1.5 rounded-md text-sm font-medium transition-colors bg-orange-100 hover:bg-orange-200 text-orange-700 hover:text-orange-900 cursor-pointer">
                                                <font-awesome icon="fas fa-file-archive" class="text-base" />
                                                <span>Unpublish</span>
                                            </button>
                                            <NuxtLink :to="`/admin/articles/${article.article.id}`" class="flex items-center gap-2 px-3 py-1.5 rounded-md text-sm font-medium transition-colors bg-blue-100 hover:bg-blue-200 text-blue-700 hover:text-blue-900 cursor-pointer">
                                                <font-awesome icon="fas fa-edit" class="text-base" />
                                                <span>Edit</span>
                                            </NuxtLink>
                                            <button @click="deleteArticle(article.article.id)" class="flex items-center gap-2 px-3 py-1.5 rounded-md text-sm font-medium transition-colors bg-red-100 hover:bg-red-200 text-red-700 hover:text-red-900 cursor-pointer">
                                                <font-awesome icon="fas fa-trash" class="text-base" />
                                                <span>Delete</span>
                                            </button>
                                        </div>
                                    </td>
                                </tr>
                            </tbody>
                        </table>
                        <div v-else class="text-center py-12">
                            <font-awesome icon="fas fa-newspaper" class="text-gray-400 text-6xl mb-4" />
                            <p class="text-xl font-semibold text-gray-900">No articles found</p>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    </div>
</template>