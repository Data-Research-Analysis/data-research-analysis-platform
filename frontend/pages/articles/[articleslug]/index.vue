<script setup>
import { useArticlesStore } from '@/stores/articles';
const router = useRouter();
const articlesStore = useArticlesStore();
const article = computed(() => {
    return articlesStore.getSelectedArticle();
});
const articles = computed(() => {
        const articles = articlesStore.getArticles().filter(article => article.article.publish_status === 'published' && article.article.id !== articlesStore.getSelectedArticle().article.id);
        const randomFewArticles = [];
        //get only 6 random articles
        while (randomFewArticles.length < 6 && articles.length > 0) {
            const randomIndex = Math.floor(Math.random() * articles.length);
            randomFewArticles.push(articles[randomIndex]);
            articles.splice(randomIndex, 1); // Remove the selected article to avoid duplicates
        }
        return randomFewArticles;
    }
);
function formatDate(dateString) {
    const options = { year: 'numeric', month: 'long', day: 'numeric' };
    return new Date(dateString).toLocaleDateString(undefined, options);
}
</script>
<template>
    <div class="flex flex-col">
        <div class="flex flex-row justify-center mt-10">
            <div class="min-h-100 max-w-200 flex flex-col ml-4 mr-4 mb-5 md:ml-10 md:mr-10 mt-5 border border-primary-blue-100 border-solid p-10 shadow-md">
                <h1 class="mb-5">{{ article.article.title }}</h1>
                <div>
                    <div class="flex flex-col">
                        <h5>Published On: {{ formatDate(article.article.created_at) }}</h5>
                        <h5 class="mt-2 mb-2">Categories</h5>
                        <div class="flex flex-wrap">
                            <span v-for="category in article.categories" :key="category.id" class="bg-gray-200 text-gray-700 text-center px-2 py-1 mr-2 mb-2">
                                {{ category.title }}
                            </span>
                        </div>
                    </div>
                    <div class="mt-4" v-html="article.article.content"></div>
                </div>
            </div>
        </div>
        <div class="flex flex-row justify-center">
            <div class="min-h-100 max-w-200 flex flex-col mb-10 ml-4 mr-4 md:ml-10 md:mr-10 border border-primary-blue-100 border-solid p-5 shadow-md">
                <h1 class="mb-5 ml-2">Other Articles By Data Research Analysis</h1>
                <div v-if="articles && articles.length" class="flex flex-wrap">
                    <div v-for="article in articles" :key="article.article.id" class="w-full md:w-1/2 xl:w-1/3">
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
                            <NuxtLink :to="`/articles/${article.article.slug}`" class=" flex flex-col justify-center w-30 h-10 bg-primary-blue-100 text-white text-center font-bold hover:text-gray-300 hover:bg-primary-blue-200">Read more</NuxtLink>
                        </div>
                    </div>
                </div>
                <div class="flex flex-row justify-center mt-5">
                    <NuxtLink :to="`/articles/`" class=" flex flex-col justify-center w-40 h-10 bg-primary-blue-100 text-white text-center font-bold hover:text-gray-300 hover:bg-primary-blue-200">Read Other Articles</NuxtLink>
                </div>
            </div>
        </div>
    </div>
</template>