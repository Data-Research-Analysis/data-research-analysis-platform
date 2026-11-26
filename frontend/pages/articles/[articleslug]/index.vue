<script setup lang="ts">
import { useLoggedInUserStore } from "@/stores/logged_in_user";
const route = useRoute();
const router = useRouter();
const slug = computed(() => String(route.params.articleslug));
const config = useRuntimeConfig();
const siteUrl = config.public.siteUrl || 'https://www.dataresearchanalysis.com';
const loggedInUserStore = useLoggedInUserStore();

const isMounted = ref(false);
onMounted(() => {
    isMounted.value = true;
});

const loggedInUser = computed(() => loggedInUserStore.getLoggedInUser());

const isUserAdmin = computed(() => {
    if (!isMounted.value) return false;
    return loggedInUser.value?.user_type === 'admin';
});

// Published articles (summary only) — used for the related-articles block.
const { articles: allArticles } = await usePublicArticles();

// The current article, with its full body, fetched by slug.
const { article: articleData, pending, error } = await usePublicArticle(slug);

// Structured data composable
const { getArticleSchema, getBreadcrumbSchema } = useStructuredData();

// Find the current article by slug
const article = computed(() => articleData.value);

// Author of the article, if one has been assigned. When no author is assigned
// the article is attributed to the Data Research Analysis Team.
const author = computed(() => article.value?.article?.author ?? null);
const authorName = computed(() => author.value?.name || 'Data Research Analysis Team');

// Article body with guaranteed alt text on every content image.
const articleBody = computed(() => ensureImageAlt(article.value?.article.content || ''));

// Get related articles (other published articles, shuffled)
const relatedArticles = computed(() => {
    if (!allArticles.value || !article.value) return [];
    
    const otherArticles = allArticles.value.filter((a: any) => 
        a.article.publish_status === 'published' && 
        a.article.id !== article.value?.article.id
    );
    
    // Shuffle the articles array and select the first 6 elements
    const shuffledArticles = otherArticles
        .map((value: any) => ({ value, sort: Math.random() }))
        .sort((a: any, b: any) => a.sort - b.sort)
        .map(({ value }) => value);
    return shuffledArticles.slice(0, 6);
});

function formatDate(dateString?: string): string {
    if (!dateString) return 'N/A';
    const options: Intl.DateTimeFormatOptions = { year: 'numeric', month: 'long', day: 'numeric', timeZone: 'UTC' };
    const date = new Date(dateString);
    return isNaN(date.getTime()) ? 'N/A' : date.toLocaleDateString('en-US', options);
}

// Dynamic card height management
const cardRefs = ref<HTMLElement[]>([]);
const maxCardHeight = ref<number>(0);

function setCardRef(el: any, index: number): void {
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
const getTextContent = (html: string, maxLength: number = 140): string => {
    if (!html) return '';
    const text = html.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();
    return text.length > maxLength ? text.substring(0, maxLength) + '...' : text;
};

// Extract first image from article content
const getArticleImage = (html: string): string => {
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
const toSafeISOString = (dateValue: any): string => {
    if (!dateValue) return new Date().toISOString();
    const date = new Date(dateValue);
    return isNaN(date.getTime()) ? new Date().toISOString() : date.toISOString();
};

// Structured data (Article + Breadcrumb) — computed so it is emitted during
// SSR and updates on client navigation. Previously injected from watchEffect,
// which kept it out of the server-rendered HTML.
useHead({
    script: computed(() => {
        const current = article.value;
        if (!current) return [];

        const data = current.article;
        const categories = current.categories.map((cat: any) => cat.title);
        const articleImage = getArticleImage(data.content);

        const articleSchema = getArticleSchema({
            headline: data.title,
            description: getTextContent(data.content),
            datePublished: toSafeISOString(data.created_at),
            dateModified: toSafeISOString(data.updated_at),
            author: {
                name: authorName.value,
                jobTitle: 'Data Analytics Experts'
            },
            categories: categories,
            slug: slug.value,
            content: data.content,
            image: articleImage
        });

        const breadcrumbSchema = getBreadcrumbSchema([
            { name: 'Home', url: siteUrl },
            { name: 'Articles', url: `${siteUrl}/articles` },
            { name: data.title, url: `${siteUrl}/articles/${slug.value}` }
        ]);

        return [articleSchema, breadcrumbSchema].map((schema) => ({
            type: 'application/ld+json',
            innerHTML: JSON.stringify(schema)
        }));
    })
});

// SEO Meta Tags - Dynamic based on article content
useHead({
    title: () => article.value ? `${article.value.article.title} | Data Research Analysis` : 'Article | Data Research Analysis',
    meta: [
        {
            name: 'description',
            content: () => {
                if (!article.value) return 'Read insightful articles about marketing analytics, data analysis, and strategic leadership from Data Research Analysis';
                return getTextContent(article.value.article.content);
            }
        },
        {
            name: 'author',
            content: () => authorName.value
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
                return getTextContent(article.value.article.content);
            }
        },
        {
            property: 'og:url',
            content: () => `${siteUrl}/articles/${slug.value}`
        },
        {
            property: 'og:image',
            content: () => {
                if (!article.value) return 'https://api.dataresearchanalysis.com/uploads/image-1782329307800-54137128.png';
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
                return getTextContent(article.value.article.content);
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
            href: () => `${siteUrl}/articles/${slug.value}`
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
                                By
                                <NuxtLink
                                    v-if="author?.slug"
                                    :to="`/authors/${author.slug}`"
                                    itemprop="name"
                                    class="font-medium hover:underline"
                                >
                                    {{ authorName }}
                                </NuxtLink>
                                <span v-else itemprop="name" class="font-medium">{{ authorName }}</span>
                            </span>
                            <span>•</span>
                            <time :datetime="article.article.updated_at || article.article.created_at" itemprop="dateModified">
                                {{ article.article.updated_at ? 'Updated On: ' : 'Published On: ' }}{{ formatDate(article.article.updated_at || article.article.created_at) }}
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
                        <!-- Edit Article button for admin users -->
                        <div v-if="isUserAdmin" class="mt-4">
                            <a
                                :href="`/admin/articles/${article.article.id}`"
                                target="_blank"
                                rel="noopener noreferrer"
                                class="inline-flex items-center gap-2 px-4 py-2 bg-primary-blue-100 text-white text-sm font-bold rounded-lg hover:bg-primary-blue-200 transition-colors"
                            >
                                <font-awesome icon="fas fa-edit" />
                                Edit Article
                            </a>
                        </div>
                    </div>
                </header>
                <div class="prose prose-lg max-w-none" itemprop="articleBody" v-html="articleBody"></div>

                <!-- Author bio -->
                <section v-if="author" class="mt-10 pt-6 border-t border-gray-200">
                    <h2 class="text-lg font-bold mb-4">About the Author</h2>
                    <div class="flex flex-col sm:flex-row gap-5 items-start">
                        <NuxtLink v-if="author.picture && author.slug" :to="`/authors/${author.slug}`" class="shrink-0">
                            <img
                                :src="author.picture"
                                :alt="author.name"
                                class="w-24 h-24 rounded-full object-cover border border-gray-200"
                            />
                        </NuxtLink>
                        <img
                            v-else-if="author.picture"
                            :src="author.picture"
                            :alt="author.name"
                            class="w-24 h-24 rounded-full object-cover border border-gray-200 shrink-0"
                        />
                        <div v-else class="w-24 h-24 rounded-full bg-gray-100 flex items-center justify-center text-gray-400 shrink-0">
                            <font-awesome icon="fas fa-user" class="text-3xl" />
                        </div>
                        <div>
                            <NuxtLink v-if="author.slug" :to="`/authors/${author.slug}`" class="hover:underline">
                                <h3 class="text-lg font-bold">{{ author.name }}</h3>
                            </NuxtLink>
                            <h3 v-else class="text-lg font-bold">{{ author.name }}</h3>
                            <p v-if="author.bio" class="text-gray-700 mt-2 leading-relaxed">{{ author.bio }}</p>
                            <div class="flex flex-wrap gap-4 mt-3 text-sm">
                                <a
                                    v-if="author.linkedin_url"
                                    :href="author.linkedin_url"
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    class="inline-flex items-center gap-2 text-primary-blue-100 font-medium hover:underline"
                                >
                                    <font-awesome :icon="['fab', 'linkedin']" />
                                    LinkedIn
                                </a>
                                <a
                                    v-if="author.website_url"
                                    :href="author.website_url"
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    class="inline-flex items-center gap-2 text-primary-blue-100 font-medium hover:underline"
                                >
                                    <font-awesome icon="fas fa-globe" />
                                    Website
                                </a>
                            </div>
                        </div>
                    </div>
                </section>
                
                <!-- Publisher information (hidden, for schema) -->
                <div itemprop="publisher" itemscope itemtype="https://schema.org/Organization" class="hidden">
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
                <h2 class="mb-5 ml-2">Other Articles By Data Research Analysis</h2>
                <div v-if="relatedArticles && relatedArticles.length" class="flex flex-wrap">
                    <div v-for="(relatedArticle, index) in relatedArticles" :key="relatedArticle.article.id" class="w-full md:w-1/2 xl:w-1/3">
                        <div :ref="el => setCardRef(el, index)" class="flex flex-col justify-between bg-white border border-primary-blue-100 border-solid p-4 rounded shadow hover:shadow-lg transition-shadow duration-200 m-2">
                            <div class="flex flex-col">
                                <h2 class="text-xl font-bold mb-2 ellipse">{{ relatedArticle.article.title}}</h2>
                                <h5>{{ relatedArticle.article.updated_at ? 'Updated On: ' : 'Published On: ' }}{{ formatDate(relatedArticle.article.updated_at || relatedArticle.article.created_at) }}</h5>
                                <h5 class="mt-1">
                                    By
                                    <NuxtLink
                                        v-if="relatedArticle.article.author?.slug"
                                        :to="`/authors/${relatedArticle.article.author.slug}`"
                                        class="hover:underline"
                                    >
                                        {{ relatedArticle.article.author.name }}
                                    </NuxtLink>
                                    <span v-else>{{ relatedArticle.article.author?.name || 'Data Research Analysis Team' }}</span>
                                </h5>
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
                    <NuxtLink :to="`/articles`" class=" flex flex-col justify-center w-40 h-10 bg-primary-blue-100 text-white text-center font-bold hover:text-gray-300 hover:bg-primary-blue-200">Read Other Articles</NuxtLink>
                </div>
            </div>
        </div>
    </div>
</template>