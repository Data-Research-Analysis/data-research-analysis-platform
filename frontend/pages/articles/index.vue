<script setup>
import { useArticlesStore } from '@/stores/articles';
const router = useRouter();
const articlesStore = useArticlesStore();
const articles = computed(() => articlesStore.getArticles().filter(article => article.article.publish_status === 'published'));
function formatDate(dateString) {
    const options = { year: 'numeric', month: 'long', day: 'numeric' };
    return new Date(dateString).toLocaleDateString(undefined, options);
}
</script>
<template>
    <div class="min-h-100 flex flex-col ml-4 mr-4 mb-10 md:ml-10 md:mr-10 mt-5 border border-primary-blue-100 border-solid p-10 shadow-md">
        <h1 class="mb-5 ml-2">Articles</h1>
        <div v-if="articles && articles.length" class="flex flex-wrap">
            <div v-for="article in articles" :key="article.article.id" class="w-full lg:w-1/3 xl:w-1/4">
                <div class="flex flex-col justify-between bg-white border border-primary-blue-100 border-solid p-4 rounded shadow hover:shadow-lg transition-shadow duration-200 min-h-80 m-2">
                    <div class="flex flex-col">
                        <h2 class="text-xl font-bold mb-2 ellipse">{{ article.article.title}}</h2>
                        <h5>Published On: {{ formatDate(article.article.created_at) }}</h5>
                        <h5 class="mt-2 mb-2">Categories</h5>
                        <div class="flex flex-wrap">
                            <span v-for="category in article.categories" :key="category.id" class="bg-gray-200 text-gray-700 text-center px-2 py-1 mr-2 mb-2">
                                {{ category.title }}
                            </span>
                        </div>
                    </div>
                    <router-link :to="`/articles/${article.article.slug}`" class=" flex flex-col justify-center w-30 h-10 bg-primary-blue-100 text-white text-center font-bold hover:text-gray-300 hover:bg-primary-blue-200">Read more</router-link>
                </div>
            </div>
        </div>
        <div v-else class="flex flex-col h-full mt-20">
            <div class="justify-center text-center text-gray-500 text-2xl font-bold">
                No articles available at the moment.
            </div>
        </div>
    </div>
</template>