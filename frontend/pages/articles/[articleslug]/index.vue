<script setup>
const route = useRoute();
const router = useRouter();
const slug = String(route.params.articleslug);
const config = useRuntimeConfig();
const siteUrl = config.public.siteUrl || 'https://www.dataresearchanalysis.com';

// Fetch articles with SSR support
const { articles: allArticles, pending, error } = await usePublicArticles();

// Structured data composable
const { getArticleSchema, getBreadcrumbSchema, injectMultipleSchemas } = useStructuredData();

// Find the current article by slug
const article = computed(() => {
    if (!allArticles.value) return null;
    return allArticles.value.find(a => a.article.slug === slug);
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

// Dynamic card height management
const cardRefs = ref([]);
const maxCardHeight = ref(0);

function setCardRef(el, index) {
    if (el) {
        cardRefs.value[index] = el;
    }
}

function calculateMaxHeight() {
    if (!import.meta.client) return;
    
    // Reset heights first to get natural height
    cardRefs.value.forEach(card => {
        if (card) {
            card.style.height = 'auto';
        }
    });
    
    // Calculate max height after a brief delay to ensure rendering
    setTimeout(() => {
        let max = 0;
        cardRefs.value.forEach(card => {
            if (card) {
                const height = card.offsetHeight;
                if (height > max) {
                    max = height;
                }
            }
        });
        maxCardHeight.value = max;
        
        // Apply max height to all cards
        cardRefs.value.forEach(card => {
            if (card) {
                card.style.height = `${max}px`;
            }
        });
    }, 100);
}

// Watch for changes in related articles and recalculate heights
watch(relatedArticles, () => {
    if (import.meta.client) {
        nextTick(() => {
            calculateMaxHeight();
        });
    }
});

// Calculate on mount
onMounted(() => {
    if (import.meta.client) {
        // Initial calculation
        nextTick(() => {
            calculateMaxHeight();
        });
        
        // Recalculate on window resize
        window.addEventListener('resize', calculateMaxHeight);
    }
});

// Cleanup on unmount
onUnmounted(() => {
    if (import.meta.client) {
        window.removeEventListener('resize', calculateMaxHeight);
    }
});

// Extract plain text for meta description
const getTextContent = (html, maxLength = 160) => {
    if (!html) return '';
    return html.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim().substring(0, maxLength);
};

// Extract first image from article content
const getArticleImage = (html) => {
    if (!html) return `${siteUrl}/logo-words.svg`;
    
    // Try to find img tag with src
    const imgMatch = html.match(/<img[^>]+src=["']([^"']+)["']/i);
    if (imgMatch && imgMatch[1]) {
        return imgMatch[1];
    }
    
    // Default to logo if no image found
    return `${siteUrl}/logo-words.svg`;
};

// Helper to safely convert date to ISO string
const toSafeISOString = (dateValue) => {
    if (!dateValue) return new Date().toISOString();
    const date = new Date(dateValue);
    return isNaN(date.getTime()) ? new Date().toISOString() : date.toISOString();
};

// Inject structured data when article is loaded
watchEffect(() => {
    if (article.value && !pending.value) {
        const articleData = article.value.article;
        const categories = article.value.categories.map(cat => cat.title);
        
        // Extract image from content
        const articleImage = getArticleImage(articleData.content);
        
        // Article schema
        const articleSchema = getArticleSchema({
            headline: articleData.title,
            description: getTextContent(articleData.content, 160),
            datePublished: toSafeISOString(articleData.created_at),
            dateModified: toSafeISOString(articleData.updated_at),
            author: {
                name: 'Data Research Analysis Team',
                jobTitle: 'Data Analytics Experts'
            },
            categories: categories,
            slug: slug,
            content: articleData.content,
            image: articleImage
        });
        
        // Breadcrumb schema
        const breadcrumbSchema = getBreadcrumbSchema([
            { name: 'Home', url: siteUrl },
            { name: 'Articles', url: `${siteUrl}/articles` },
            { name: articleData.title, url: `${siteUrl}/articles/${slug}` }
        ]);
        
        // Inject both schemas
        injectMultipleSchemas([articleSchema, breadcrumbSchema]);
    }
});

// SEO Meta Tags - Dynamic based on article content
useHead({
    title: () => article.value ? `${article.value.article.title} | Data Research Analysis` : 'Article | Data Research Analysis',
    meta: [
        {
            name: 'description',
            content: () => {
                if (!article.value) return 'Read insightful articles about marketing analytics, data analysis, and strategic leadership from Data Research Analysis';
                return getTextContent(article.value.article.content, 160);
            }
        },
        {
            name: 'keywords',
            content: () => {
                if (!article.value) return 'marketing analytics, data analysis';
                const categories = article.value.categories.map(cat => cat.title).join(', ');
                return `${categories}, marketing analytics, data visualization`;
            }
        },
        {
            name: 'author',
            content: 'Data Research Analysis Team'
        },
        {
            name: 'robots',
            content: 'index, follow, max-image-preview:large'
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
                if (!article.value) return 'Read insightful articles about marketing analytics from Data Research Analysis';
                return getTextContent(article.value.article.content, 160);
            }
        },
        {
            property: 'og:url',
            content: () => `${siteUrl}/articles/${slug}`
        },
        {
            property: 'og:image',
            content: () => {
                if (!article.value) return `${siteUrl}/logo-words.svg`;
                return getArticleImage(article.value.article.content);
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
                if (!article.value) return 'Read insightful articles about marketing analytics from Data Research Analysis';
                return getTextContent(article.value.article.content, 160);
            }
        },
        {
            name: 'twitter:image',
            content: () => {
                if (!article.value) return `${siteUrl}/logo-words.svg`;
                return getArticleImage(article.value.article.content);
            }
        }
    ],
    link: [
        {
            rel: 'canonical',
            href: () => `${siteUrl}/articles/${slug}`
        }
    ]
});
</script>
<template>
    <div class="flex flex-col">
        <!-- Breadcrumbs -->
        <div v-if="article && !pending" class="max-w-200 mx-auto w-full px-4 md:px-10 mt-5">
            <breadcrumbs-schema :items="[
                { name: 'Home', path: '/' },
                { name: 'Articles', path: '/articles' },
                { name: article.article.title }
            ]" />
        </div>

        <!-- Loading State -->
        <div v-if="pending" class="flex flex-row justify-center">
            <div class="min-h-100 max-w-200 flex flex-col ml-4 mr-4 mb-5 md:ml-10 md:mr-10 mt-5 border border-primary-blue-100 border-solid p-10 shadow-md">
                <div class="flex justify-center items-center h-40">
                    <p class="text-gray-500">Loading article...</p>
                </div>
            </div>
        </div>

        <!-- Error State -->
        <div v-else-if="error" class="flex flex-row justify-center">
            <div class="min-h-100 max-w-200 flex flex-col ml-4 mr-4 mb-5 md:ml-10 md:mr-10 mt-5 border border-primary-blue-100 border-solid p-10 shadow-md">
                <div class="flex justify-center items-center h-40">
                    <p class="text-red-500">Error loading article. Please try again later.</p>
                </div>
            </div>
        </div>

        <!-- Article Not Found -->
        <div v-else-if="!article" class="flex flex-row justify-center">
            <div class="min-h-100 max-w-200 flex flex-col ml-4 mr-4 mb-5 md:ml-10 md:mr-10 mt-5 border border-primary-blue-100 border-solid p-10 shadow-md">
                <div class="flex justify-center items-center h-40">
                    <p class="text-gray-500">Article not found.</p>
                </div>
            </div>
        </div>

        <!-- Article Content -->
        <div v-else class="flex flex-row justify-center">
            <article class="min-h-100 max-w-200 flex flex-col ml-4 mr-4 mb-5 md:ml-10 md:mr-10 mt-5 border border-primary-blue-100 border-solid p-10 shadow-md rounded-lg" 
                     itemscope 
                     itemtype="https://schema.org/Article">
                <header>
                    <h1 class="mb-5" itemprop="headline">{{ article.article.title }}</h1>
                    <div class="flex flex-col mb-4 pb-4 border-b border-gray-200">
                        <div class="flex items-center text-sm text-gray-600 space-x-4">
                            <span itemprop="author" itemscope itemtype="https://schema.org/Person">
                                By <span itemprop="name" class="font-medium">Data Research Analysis Team</span>
                            </span>
                            <span>•</span>
                            <time :datetime="article.article.created_at" itemprop="datePublished">
                                Published: {{ formatDate(article.article.created_at) }}
                            </time>
                            <meta itemprop="dateModified" :content="article.article.updated_at" />
                        </div>
                        <div class="mt-3">
                            <h5 class="text-sm font-semibold mb-2">Categories</h5>
                            <div class="flex flex-wrap">
                                <span v-for="category in article.categories" 
                                      :key="category.id" 
                                      class="bg-gray-200 text-gray-700 text-center px-3 py-1 mr-2 mb-2 rounded text-sm"
                                      itemprop="articleSection">
                                    {{ category.title }}
                                </span>
                            </div>
                        </div>
                    </div>
                </header>
                <div class="prose prose-lg max-w-none" itemprop="articleBody" v-html="article.article.content"></div>
                
                <!-- Publisher information (hidden, for schema) -->
                <div itemprop="publisher" itemscope itemtype="https://schema.org/Organization" style="display:none;">
                    <span itemprop="name">Data Research Analysis</span>
                    <div itemprop="logo" itemscope itemtype="https://schema.org/ImageObject">
                        <meta itemprop="url" :content="`${siteUrl}/logo.png`" />
                    </div>
                </div>
            </article>
        </div>

        <!-- Related Articles Section -->
        <div v-if="!pending && article" class="flex flex-row justify-center">
            <div class="min-h-100 max-w-200 flex flex-col mb-10 ml-4 mr-4 md:ml-10 md:mr-10 border border-primary-blue-100 border-solid p-5 shadow-md rounded-lg">
                <h1 class="mb-5 ml-2">Other Articles By Data Research Analysis</h1>
                <div v-if="relatedArticles && relatedArticles.length" class="flex flex-wrap">
                    <div v-for="(relatedArticle, index) in relatedArticles" :key="relatedArticle.article.id" class="w-full md:w-1/2 xl:w-1/3">
                        <div :ref="el => setCardRef(el, index)" class="flex flex-col justify-between bg-white border border-primary-blue-100 border-solid p-4 rounded shadow hover:shadow-lg transition-shadow duration-200 m-2">
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