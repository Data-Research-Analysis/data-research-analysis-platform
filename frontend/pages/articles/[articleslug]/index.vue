<script setup>
import { useArticlesStore } from '@/stores/articles';

const route = useRoute();
const router = useRouter();
const articlesStore = useArticlesStore();
const slug = String(route.params.articleslug);

// Fetch articles with SSR support
const { articles: allArticles, pending, error } = await usePublicArticles();

// Find the current article by slug
const article = computed(() => {
    if (!allArticles.value) return null;
    return allArticles.value.find(a => a.article.slug === slug);
});

// Set selected article in store for potential client-side navigation
watchEffect(() => {
    if (article.value && import.meta.client) {
        articlesStore.setSelectedArticle(article.value);
    }
});

// Get related articles (other published articles, shuffled)
const relatedArticles = computed(() => {
    if (!allArticles.value || !article.value) return [];
    
    const otherArticles = allArticles.value.filter(a => 
        a.article.publish_status === 'published' && 
        a.article.id !== article.value.article.id
    );
    
    // Shuffle the articles array and select the first 6 elements
    const shuffledArticles = otherArticles
        .map(value => ({ value, sort: Math.random() }))
        .sort((a, b) => a.sort - b.sort)
        .map(({ value }) => value);
    return shuffledArticles.slice(0, 6);
});

function formatDate(dateString) {
    const options = { year: 'numeric', month: 'long', day: 'numeric' };
    return new Date(dateString).toLocaleDateString(undefined, options);
}

// SEO Meta Tags - Dynamic based on article content
useHead({
    title: () => article.value?.article.title || 'Article | Data Research Analysis',
    meta: [
        {
            name: 'description',
            content: () => {
                if (!article.value) return 'Read articles from Data Research Analysis';
                // Extract text from HTML content for description (first 160 chars)
                const content = article.value.article.content || '';
                const textContent = content.replace(/<[^>]*>/g, '').substring(0, 160);
                return textContent || 'Read this article from Data Research Analysis';
            }
        },
        // Open Graph tags for social sharing
        {
            property: 'og:type',
            content: 'article'
        },
        {
            property: 'og:title',
            content: () => article.value?.article.title || 'Article'
        },
        {
            property: 'og:description',
            content: () => {
                if (!article.value) return 'Read articles from Data Research Analysis';
                const content = article.value.article.content || '';
                const textContent = content.replace(/<[^>]*>/g, '').substring(0, 160);
                return textContent || 'Read this article from Data Research Analysis';
            }
        },
        {
            property: 'article:published_time',
            content: () => article.value?.article.created_at || ''
        },
        {
            property: 'article:modified_time',
            content: () => article.value?.article.updated_at || ''
        },
        // Twitter Card
        {
            name: 'twitter:card',
            content: 'summary_large_image'
        },
        {
            name: 'twitter:title',
            content: () => article.value?.article.title || 'Article'
        },
        {
            name: 'twitter:description',
            content: () => {
                if (!article.value) return 'Read articles from Data Research Analysis';
                const content = article.value.article.content || '';
                const textContent = content.replace(/<[^>]*>/g, '').substring(0, 160);
                return textContent || 'Read this article from Data Research Analysis';
            }
        }
    ],
    link: [
        {
            rel: 'canonical',
            href: () => `https://dataresearchanalysis.test/articles/${slug}`
        }
    ]
});
</script>
<template>
    <div class="flex flex-col">
        <!-- Loading State -->
        <div v-if="pending" class="flex flex-row justify-center mt-10">
            <div class="min-h-100 max-w-200 flex flex-col ml-4 mr-4 mb-5 md:ml-10 md:mr-10 mt-5 border border-primary-blue-100 border-solid p-10 shadow-md">
                <div class="flex justify-center items-center h-40">
                    <p class="text-gray-500">Loading article...</p>
                </div>
            </div>
        </div>

        <!-- Error State -->
        <div v-else-if="error" class="flex flex-row justify-center mt-10">
            <div class="min-h-100 max-w-200 flex flex-col ml-4 mr-4 mb-5 md:ml-10 md:mr-10 mt-5 border border-primary-blue-100 border-solid p-10 shadow-md">
                <div class="flex justify-center items-center h-40">
                    <p class="text-red-500">Error loading article. Please try again later.</p>
                </div>
            </div>
        </div>

        <!-- Article Not Found -->
        <div v-else-if="!article" class="flex flex-row justify-center mt-10">
            <div class="min-h-100 max-w-200 flex flex-col ml-4 mr-4 mb-5 md:ml-10 md:mr-10 mt-5 border border-primary-blue-100 border-solid p-10 shadow-md">
                <div class="flex justify-center items-center h-40">
                    <p class="text-gray-500">Article not found.</p>
                </div>
            </div>
        </div>

        <!-- Article Content -->
        <div v-else class="flex flex-row justify-center mt-10">
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

        <!-- Related Articles Section -->
        <div v-if="!pending && article" class="flex flex-row justify-center">
            <div class="min-h-100 max-w-200 flex flex-col mb-10 ml-4 mr-4 md:ml-10 md:mr-10 border border-primary-blue-100 border-solid p-5 shadow-md">
                <h1 class="mb-5 ml-2">Other Articles By Data Research Analysis</h1>
                <div v-if="relatedArticles && relatedArticles.length" class="flex flex-wrap">
                    <div v-for="relatedArticle in relatedArticles" :key="relatedArticle.article.id" class="w-full md:w-1/2 xl:w-1/3">
                        <div class="flex flex-col justify-between bg-white border border-primary-blue-100 border-solid p-4 rounded shadow hover:shadow-lg transition-shadow duration-200 min-h-80 m-2">
                            <div class="flex flex-col">
                                <h2 class="text-xl font-bold mb-2 ellipse">{{ relatedArticle.article.title}}</h2>
                                <h5>Published On: {{ formatDate(relatedArticle.article.created_at) }}</h5>
                                <h5 class="mt-2 mb-2">Categories</h5>
                                <div class="flex flex-wrap">
                                    <span v-for="category in relatedArticle.categories" :key="category.id" class="bg-gray-200 text-gray-700 text-center px-2 py-1 mr-2 mb-2">
                                        {{ category.title }}
                                    </span>
                                </div>
                            </div>
                            <NuxtLink :to="`/articles/${relatedArticle.article.slug}`" class=" flex flex-col justify-center w-30 h-10 bg-primary-blue-100 text-white text-center font-bold hover:text-gray-300 hover:bg-primary-blue-200">Read more</NuxtLink>
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