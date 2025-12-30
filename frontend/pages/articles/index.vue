<script setup>
const router = useRouter();
// Fetch articles with SSR support
const { articles: allArticles, pending, error } = await usePublicArticles();

// Filter to only show published articles
const articles = computed(() => {
    if (!allArticles.value) return [];
    return allArticles.value.filter(article => article.article.publish_status === 'published');
});

function formatDate(dateString) {
    const options = { year: 'numeric', month: 'long', day: 'numeric' };
    return new Date(dateString).toLocaleDateString(undefined, options);
}

// SEO Meta Tags
useHead({
    title: 'Articles | Data Research Analysis',
    meta: [
        {
            name: 'description',
            content: 'Read the latest articles and insights from Data Research Analysis on data science, analytics, and research methodologies.'
        },
        {
            property: 'og:title',
            content: 'Articles | Data Research Analysis'
        },
        {
            property: 'og:description',
            content: 'Read the latest articles and insights from Data Research Analysis on data science, analytics, and research methodologies.'
        },
        {
            property: 'og:type',
            content: 'website'
        },
        {
            name: 'twitter:card',
            content: 'summary'
        },
        {
            name: 'twitter:title',
            content: 'Articles | Data Research Analysis'
        }
    ],
    link: [
        {
            rel: 'canonical',
            href: 'https://dataresearchanalysis.test/articles'
        }
    ]
});
</script>
<template>
    <tab-content-panel :corners="['top-left', 'top-right', 'bottom-left', 'bottom-right']" class="mt-15">
        <h1 class="mb-5 ml-2">Articles</h1>
        
        <!-- Loading State -->
        <div v-if="pending" class="flex flex-col h-full mt-20">
            <div class="justify-center text-center text-gray-500 text-2xl font-bold">
                Loading articles...
            </div>
        </div>

        <!-- Error State -->
        <div v-else-if="error" class="flex flex-col h-full mt-20">
            <div class="justify-center text-center text-red-500 text-2xl font-bold">
                Error loading articles. Please try again later.
            </div>
        </div>

        <!-- Articles List -->
        <div v-else-if="articles && articles.length" class="flex flex-wrap">
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
                    <NuxtLink :to="`/articles/${article.article.slug}`" class=" flex flex-col justify-center w-30 h-10 bg-primary-blue-100 text-white text-center font-bold hover:text-gray-300 hover:bg-primary-blue-200">Read more</NuxtLink>
                </div>
            </div>
        </div>

        <!-- No Articles -->
        <div v-else class="flex flex-col h-full mt-20">
            <div class="justify-center text-center text-gray-500 text-2xl font-bold">
                No articles available at the moment.
            </div>
        </div>
    </tab-content-panel>
</template>