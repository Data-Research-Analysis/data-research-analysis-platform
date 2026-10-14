<script setup lang="ts">
const route = useRoute();
const config = useRuntimeConfig();
const siteUrl = config.public.siteUrl || 'https://www.dataresearchanalysis.com';
const OG_IMAGE = 'https://api.dataresearchanalysis.com/uploads/image-1782329307800-54137128.png';

// Structured data
const { getItemListSchema } = useStructuredData();

// Fetch articles with SSR support (summary only — bodies are not in the payload)
const { articles: allArticles, pending, error } = await usePublicArticles();

const PAGE_SIZE = 12;

// Filter to only show published articles and sort by date (newest first)
const publishedArticles = computed(() => {
    if (!allArticles.value) return [];
    return allArticles.value
        .filter((article: any) => article.article.publish_status === 'published')
        .sort((a: any, b: any) => {
            const dateA = new Date(a.article.updated_at || a.article.created_at);
            const dateB = new Date(b.article.updated_at || b.article.created_at);
            return dateB.getTime() - dateA.getTime(); // Descending order (newest first)
        });
});

const totalPages = computed(() => Math.max(1, Math.ceil(publishedArticles.value.length / PAGE_SIZE)));

const currentPage = computed(() => {
    const raw = parseInt(String(route.query.page ?? '1'), 10);
    const page = Number.isFinite(raw) && raw > 0 ? raw : 1;
    return Math.min(page, totalPages.value);
});

const paginatedArticles = computed(() => {
    const start = (currentPage.value - 1) * PAGE_SIZE;
    return publishedArticles.value.slice(start, start + PAGE_SIZE);
});

const pageUrl = (page: number) => page <= 1 ? `${siteUrl}/articles` : `${siteUrl}/articles?page=${page}`;

function formatDate(dateString?: string) {
    if (!dateString) return 'N/A';
    const options: Intl.DateTimeFormatOptions = { year: 'numeric', month: 'long', day: 'numeric', timeZone: 'UTC' };
    const date = new Date(dateString);
    return isNaN(date.getTime()) ? 'N/A' : date.toLocaleDateString('en-US', options);
}

// SEO Meta Tags
useHead({
    title: 'Marketing Analytics Articles | Data Research Analysis',
    meta: [
        {
            name: 'description',
            content: 'Practical articles on marketing analytics, attribution, GA4, dashboards, and proving ROI — written for CMOs and marketing teams who need clear answers.'
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
            property: 'og:type',
            content: 'website'
        },
        {
            property: 'og:title',
            content: 'Marketing Analytics Articles | Data Research Analysis'
        },
        {
            property: 'og:description',
            content: 'Practical articles on marketing analytics, attribution, GA4, dashboards, and proving ROI for CMOs and marketing teams.'
        },
        {
            property: 'og:url',
            content: () => pageUrl(currentPage.value)
        },
        {
            property: 'og:image',
            content: OG_IMAGE
        },
        {
            property: 'og:image:width',
            content: '1200'
        },
        {
            property: 'og:image:height',
            content: '630'
        },
        {
            property: 'og:image:alt',
            content: 'Data Research Analysis — marketing analytics articles'
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
            content: 'Practical articles on marketing analytics, attribution, GA4, dashboards, and proving ROI.'
        },
        {
            name: 'twitter:image',
            content: OG_IMAGE
        }
    ],
    link: computed(() => {
        const links: Array<Record<string, string>> = [
            { rel: 'canonical', href: pageUrl(currentPage.value) }
        ];
        if (currentPage.value > 1) {
            links.push({ rel: 'prev', href: pageUrl(currentPage.value - 1) });
        }
        if (currentPage.value < totalPages.value) {
            links.push({ rel: 'next', href: pageUrl(currentPage.value + 1) });
        }
        return links;
    })
});

// ItemList structured data for the articles shown on this page (SSR-injected).
useHead({
    script: computed(() => {
        const schema = getItemListSchema(
            paginatedArticles.value.map((item: any) => ({
                title: item.article.title,
                slug: item.article.slug,
                description: '',
                date: item.article.updated_at || item.article.created_at
            }))
        );
        return [
            { type: 'application/ld+json', innerHTML: JSON.stringify(schema) }
        ];
    })
});
</script>
<template>
    <tab-content-panel :corners="['top-left', 'top-right', 'bottom-left', 'bottom-right']" class="mt-15">
        <!-- Breadcrumbs -->
        <breadcrumbs-schema :items="[
            { name: 'Home', path: '/' },
            { name: 'Articles' }
        ]" class="mb-4 ml-2" />
        
        <h1 class="mb-5 ml-2">Marketing Analytics Articles</h1>
        
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
        <div v-else-if="paginatedArticles && paginatedArticles.length">
            <div class="grid grid-cols-1 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                <div v-for="article in paginatedArticles" :key="article.article.id">
                    <div class="flex flex-col justify-between bg-white border border-primary-blue-100 border-solid p-4 rounded shadow hover:shadow-lg transition-shadow duration-200 min-h-80 h-full">
                        <div class="flex flex-col">
                            <NuxtLink :to="`/articles/${article.article.slug}`">
                                <h2 class="text-xl font-bold mb-2 ellipse hover:text-primary-blue-200">{{ article.article.title}}</h2>
                            </NuxtLink>
                            <h5>{{ article.article.updated_at ? 'Updated On: ' : 'Published On: ' }}{{ formatDate(article.article.updated_at || article.article.created_at) }}</h5>
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

            <!-- Pagination -->
            <nav v-if="totalPages > 1" class="flex justify-center items-center gap-3 mt-8" aria-label="Articles pagination">
                <NuxtLink
                    v-if="currentPage > 1"
                    :to="currentPage === 2 ? '/articles' : `/articles?page=${currentPage - 1}`"
                    class="px-4 h-10 flex items-center border border-primary-blue-100 rounded font-semibold hover:bg-primary-blue-100 hover:text-white transition-colors"
                >
                    Previous
                </NuxtLink>
                <span class="px-4 h-10 flex items-center text-gray-600">Page {{ currentPage }} of {{ totalPages }}</span>
                <NuxtLink
                    v-if="currentPage < totalPages"
                    :to="`/articles?page=${currentPage + 1}`"
                    class="px-4 h-10 flex items-center border border-primary-blue-100 rounded font-semibold hover:bg-primary-blue-100 hover:text-white transition-colors"
                >
                    Next
                </NuxtLink>
            </nav>
        </div>

        <!-- No Articles -->
        <div v-else class="flex flex-col h-full mt-20">
            <div class="justify-center text-center text-gray-500 text-2xl font-bold">
                No articles available at the moment.
            </div>
        </div>
    </tab-content-panel>
</template>
