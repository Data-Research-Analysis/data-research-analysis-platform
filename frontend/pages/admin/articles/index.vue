<script setup>
import { NuxtLink } from '#components';
import { useArticlesStore } from '@/stores/articles';
const { $swal } = useNuxtApp();
const articlesStore = useArticlesStore();
const state = reactive({
});
const articles = computed(() => [...articlesStore.getArticles()].sort((a, b) => a.id - b.id));
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
    const token = getAuthToken();
    const requestOptions = {
        method: "DELETE",
        headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${token}`,
            "Authorization-Type": "auth",
        },
    };
    try {
        const response = await fetch(`${baseUrl()}/admin/article/delete/${articleId}`, requestOptions);
        if (response && response.status === 200) {
            const data = await response.json();
            $swal.fire(`The article has been deleted successfully.`);
        } else {
            $swal.fire(`There was an error deleting the article.`);
        }
    } catch (error) {
        $swal.fire(`A network error occurred while deleting the article.`);
    }
    await articlesStore.retrieveArticles();
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
    const token = getAuthToken();
    const requestOptions = {
        method: "GET",
        headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${token}`,
            "Authorization-Type": "auth",
        },
    };
    try {
        const response = await fetch(`${baseUrl()}/admin/article/publish/${articleId}`, requestOptions);
        if (response && response.status === 200) {
            const data = await response.json();
            $swal.fire(`The article has been published successfully.`);
        } else {
            $swal.fire(`There was an error publishing the article.`);
        }
    } catch (error) {
        $swal.fire(`A network error occurred while publishing the article.`);
    }
    await articlesStore.retrieveArticles();
}
</script>
<template>
    <div class="flex flex-row">
        <sidebar-admin
            class="w-1/6"
        />
        <div class="w-5/6">
            <div class="min-h-100 flex flex-col ml-4 mr-4 mb-10 md:ml-10 md:mr-10 mt-5 border border-primary-blue-100 border-solid p-10 shadow-md">
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
                                        <span v-for="category in article.categories" :key="category.id" class="bg-gray-200 text-gray-700 px-2 py-1 rounded-full mr-2 mb-2">
                                            {{ category.title }}
                                        </span>
                                    </div>
                                    <div v-else class="text-gray-500">No categories assigned</div>
                                </td>
                                <td class="border px-4 py-2">
                                    <div class="flex flex-row justify-center">
                                        <button v-if="article.article.publish_status === 'draft'" @click="publishArticle(article.article.id)" class="w-28 text-center self-center text-sm p-1 ml-2 mb-4 bg-green-600 text-white hover:bg-green-700 cursor-pointer font-bold shadow-md">Publish Article</button>
                                        <NuxtLink :to="`/admin/article/edit/${article.article.id}`" class="w-28 text-center self-center text-sm p-1 ml-2 mb-4 bg-primary-blue-100 text-white hover:bg-primary-blue-300 cursor-pointer font-bold shadow-md">
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