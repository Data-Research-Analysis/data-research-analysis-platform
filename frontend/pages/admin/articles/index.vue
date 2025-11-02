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
</script>
<template>
    <div class="flex flex-row">
        <sidebar-admin class="w-1/6" />
        <div class="w-5/6">
            <!-- Loading State -->
            <div v-if="pending" class="min-h-100 flex flex-col ml-4 mr-4 mb-10 md:ml-10 md:mr-10 mt-5 border border-primary-blue-100 border-solid p-10 shadow-md">
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
                        <button @click="refresh()" class="mt-4 px-4 py-2 bg-primary-blue-500 text-white rounded hover:bg-primary-blue-600">
                            Try Again
                        </button>
                    </div>
                </div>
            </div>
            
            <!-- Articles Content -->
            <div v-else class="min-h-100 flex flex-col ml-4 mr-4 mb-10 md:ml-10 md:mr-10 mt-5 border border-primary-blue-100 border-solid p-10 shadow-md">
                <div class="flex flex-row">
                    <div class="font-bold text-2xl mb-5">
                        List Articles
                    </div>
                    <NuxtLink
                        class="w-28 text-center self-center text-sm p-1 ml-2 mb-4 bg-primary-blue-100 text-white hover:bg-primary-blue-300 cursor-pointer font-bold shadow-md"
                        to="/admin/articles/create"
                    >
                        Add Article
                    </NuxtLink>
                </div>
                <div class="mt-3">
                    <table v-if="articles && articles.length" class="w-full table-auto table-striped">
                        <thead>
                            <tr class="h-10 bg-primary-blue-100 border border-solid">
                                <th class="px-4 py-2 border border-solid border-black text-white">ID</th>
                                <th class="px-4 py-2 border border-solid border-black text-white">Title</th>
                                <th class="px-4 py-2 border border-solid border-black text-white">Publish Status</th>
                                <th class="px-4 py-2 border border-solid border-black text-white">Categories</th>
                                <th class="px-4 py-2 border border-solid border-black text-white">Actions</th>
                            </tr>
                        </thead>
                        <tbody>
                            <tr v-for="article in articles" :key="article.id">
                                <td class="border px-4 py-2 text-center">
                                    {{ article.article.id }}
                                </td>
                                <td class="border px-4 py-2">
                                    {{ article.article.title }}
                                </td>
                                <td class="border px-4 py-2 text-center font-bold">
                                    <span :class="{'bg-green-300 p-2': article.article.publish_status === 'published', 'bg-yellow-300 p-2': article.article.publish_status === 'draft'}">{{ article.article.publish_status.toUpperCase() }}</span>
                                </td>
                                <td class="border px-4 py-2">
                                    <div v-if="article.categories && article.categories.length" class="flex flex-wrap">
                                        <span v-for="category in article.categories" :key="category.id" class="bg-gray-200 text-gray-700 text-center px-2 py-1 mr-2 mb-2">
                                            {{ category.title }}
                                        </span>
                                    </div>
                                    <div v-else class="text-gray-500">No categories assigned</div>
                                </td>
                                <td class="border px-4 py-2">
                                    <div class="flex flex-row justify-center">
                                        <button v-if="article.article.publish_status === 'draft'" @click="publishArticle(article.article.id)" class="w-28 text-center self-center text-sm p-1 ml-2 mb-4 bg-green-600 text-white hover:bg-green-700 cursor-pointer font-bold shadow-md">Publish Article</button>
                                        <NuxtLink :to="`/admin/articles/${article.article.id}`" class="w-28 text-center self-center text-sm p-1 ml-2 mb-4 bg-primary-blue-100 text-white hover:bg-primary-blue-300 cursor-pointer font-bold shadow-md">
                                            Edit
                                        </NuxtLink>
                                        <button @click="deleteArticle(article.article.id)" class="w-28 text-center self-center text-sm p-1 ml-2 mb-4 bg-red-600 text-white hover:bg-red-700 cursor-pointer font-bold shadow-md">Delete</button>
                                    </div>
                                </td>
                            </tr>
                        </tbody>
                    </table>
                    <div v-else class="text-center text-gray-500 text-4xl mt-20">
                        No articles found
                    </div>
                </div>
            </div>
        </div>
    </div>
</template>