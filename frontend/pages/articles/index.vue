<script setup>
const router = useRouter();
const config = useRuntimeConfig();
const siteUrl = config.public.siteUrl || 'https://www.dataresearchanalysis.com';

// Structured data
const { getItemListSchema, getBreadcrumbSchema, injectMultipleSchemas } = useStructuredData();

// Fetch articles with SSR support
const { articles: allArticles, pending, error } = await usePublicArticles();

// Filter to only show published articles and sort by date (newest first)
const articles = computed(() => {
    if (!allArticles.value) return [];
    return allArticles.value
        .filter(article => article.article.publish_status === 'published')
        .sort((a, b) => {
            const dateA = new Date(a.article.created_at);
            const dateB = new Date(b.article.created_at);
            return dateB - dateA; // Descending order (newest first)
        });
});

function formatDate(dateString) {
    const options = { year: 'numeric', month: 'long', day: 'numeric' };
    return new Date(dateString).toLocaleDateString(undefined, options);
}

// Extract plain text for descriptions
const getTextContent = (html, maxLength = 160) => {
    if (!html) return '';
    return html.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim().substring(0, maxLength);
};

// Inject structured data when articles are loaded
watchEffect(() => {
    if (articles.value && articles.value.length > 0 && !pending.value) {
        const itemListData = articles.value.map(article => ({
            title: article.article.title,
            slug: article.article.slug,
            description: getTextContent(article.article.content, 160),
            date: new Date(article.article.created_at).toISOString()
        }));
        
        const itemListSchema = getItemListSchema(itemListData);
        const breadcrumbSchema = getBreadcrumbSchema([
            { name: 'Home', url: siteUrl },
            { name: 'Articles', url: `${siteUrl}/articles` }
        ]);
        
        injectMultipleSchemas([itemListSchema, breadcrumbSchema]);
    }
});

// SEO Meta Tags
useHead({
    title: 'Marketing Analytics Articles & Insights 2026 | Data Research Analysis',
    meta: [
        {
            name: 'description',
            content: 'Expert insights on marketing analytics, data-driven decision making, CMO dashboards, ROI tracking, and strategic leadership. Stay updated with the latest trends in marketing technology and data analysis.'
        },
        {
            name: 'keywords',
            content: 'marketing analytics articles, CMO insights, data analytics blog, marketing ROI, strategic leadership, marketing technology, data visualization, business intelligence'
        },
        {
            name: 'author',
            content: 'Data Research Analysis'
        },
        {
            name: 'robots',
            content: 'index, follow'
        },
        {
            property: 'og:title',
            content: 'Marketing Analytics Articles & Insights 2026 | Data Research Analysis'
        },
        {
            property: 'og:description',
            content: 'Expert insights on marketing analytics, data-driven decision making, and strategic leadership for CMOs and marketing executives.'
        },
        {
            property: 'og:type',
            content: 'website'
        },
        {
            property: 'og:url',
            content: `${siteUrl}/articles`
        },
        {
            name: 'twitter:card',
            content: 'summary_large_image'
        },
        {
            name: 'twitter:title',
            content: 'Marketing Analytics Articles | Data Research Analysis'
        },
        {
            name: 'twitter:description',
            content: 'Expert insights on marketing analytics, data-driven decision making, and strategic leadership for CMOs.'
        }
    ],
    link: [
        {
            rel: 'canonical',
            href: `${siteUrl}/articles`
        }
    ]
});
</script>
<template>
    <tab-content-panel :corners="['top-left', 'top-right', 'bottom-left', 'bottom-right']" class="mt-15">
        <!-- Breadcrumbs -->
        <breadcrumbs-schema :items="[
            { name: 'Home', path: '/' },
            { name: 'Articles' }
        ]" class="mb-4 ml-2" />
        
        <h1 class="mb-5 ml-2">Marketing Analytics Articles & Insights</h1>
        
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
        <div v-else-if="articles && articles.length" class="grid grid-cols-1 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            <div v-for="article in articles" :key="article.article.id">
                <div class="flex flex-col justify-between bg-white border border-primary-blue-100 border-solid p-4 rounded shadow hover:shadow-lg transition-shadow duration-200 min-h-80 h-full">
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