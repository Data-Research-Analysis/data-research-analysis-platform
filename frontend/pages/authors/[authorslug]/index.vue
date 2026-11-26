<script setup lang="ts">
const route = useRoute();
const slug = computed(() => String(route.params.authorslug));
const config = useRuntimeConfig();
const siteUrl = config.public.siteUrl || 'https://www.dataresearchanalysis.com';

const { author, articles, pending, error } = usePublicAuthor(slug);
const { getBreadcrumbSchema } = useStructuredData();

function formatDate(dateString?: string): string {
    if (!dateString) return 'N/A';
    const options: Intl.DateTimeFormatOptions = { year: 'numeric', month: 'long', day: 'numeric', timeZone: 'UTC' };
    const date = new Date(dateString);
    return isNaN(date.getTime()) ? 'N/A' : date.toLocaleDateString('en-US', options);
}

useHead({
    script: computed(() => {
        if (!author.value) return [];
        const person: any = {
            '@context': 'https://schema.org',
            '@type': 'Person',
            name: author.value.name,
            url: `${siteUrl}/authors/${slug.value}`,
        };
        if (author.value.bio) person.description = author.value.bio;
        if (author.value.picture) person.image = author.value.picture;
        const sameAs = [author.value.linkedin_url, author.value.website_url].filter(Boolean);
        if (sameAs.length) person.sameAs = sameAs;

        const breadcrumbSchema = getBreadcrumbSchema([
            { name: 'Home', url: siteUrl },
            { name: 'Articles', url: `${siteUrl}/articles` },
            { name: author.value.name, url: `${siteUrl}/authors/${slug.value}` },
        ]);

        return [person, breadcrumbSchema].map((schema) => ({
            type: 'application/ld+json',
            innerHTML: JSON.stringify(schema),
        }));
    })
});

useHead({
    title: () => author.value ? `${author.value.name} | Data Research Analysis` : 'Author | Data Research Analysis',
    meta: [
        {
            name: 'description',
            content: () => author.value?.bio || `Articles written by ${author.value?.name || 'Data Research Analysis Team'} at Data Research Analysis`,
        },
        {
            name: 'robots',
            content: 'index, follow, max-image-preview:large',
        },
        {
            property: 'og:type',
            content: 'profile',
        },
        {
            property: 'og:title',
            content: () => author.value?.name || 'Author',
        },
        {
            property: 'og:description',
            content: () => author.value?.bio || '',
        },
        {
            property: 'og:url',
            content: () => `${siteUrl}/authors/${slug.value}`,
        },
        {
            property: 'og:image',
            content: () => author.value?.picture || `${siteUrl}/logo-words.svg`,
        },
    ],
    link: [
        {
            rel: 'canonical',
            href: () => `${siteUrl}/authors/${slug.value}`,
        },
    ],
});
</script>

<template>
    <div class="flex flex-col">
        <!-- Breadcrumbs -->
        <div v-if="author && !pending" class="max-w-200 mx-auto w-full px-4 md:px-10 mt-5">
            <breadcrumbs-schema :items="[
                { name: 'Home', path: '/' },
                { name: 'Articles', path: '/articles' },
                { name: author.name }
            ]" />
        </div>

        <!-- Loading State -->
        <div v-if="pending" class="flex flex-row justify-center">
            <div class="min-h-100 max-w-200 flex flex-col ml-4 mr-4 mb-5 md:ml-10 md:mr-10 mt-5 border border-primary-blue-100 border-solid p-10 shadow-md">
                <div class="flex justify-center items-center h-40">
                    <p class="text-gray-500">Loading author...</p>
                </div>
            </div>
        </div>

        <!-- Error State -->
        <div v-else-if="error" class="flex flex-row justify-center">
            <div class="min-h-100 max-w-200 flex flex-col ml-4 mr-4 mb-5 md:ml-10 md:mr-10 mt-5 border border-primary-blue-100 border-solid p-10 shadow-md">
                <div class="flex justify-center items-center h-40">
                    <p class="text-red-500">Error loading author. Please try again later.</p>
                </div>
            </div>
        </div>

        <!-- Author Not Found -->
        <div v-else-if="!author" class="flex flex-row justify-center">
            <div class="min-h-100 max-w-200 flex flex-col ml-4 mr-4 mb-5 md:ml-10 md:mr-10 mt-5 border border-primary-blue-100 border-solid p-10 shadow-md">
                <div class="flex justify-center items-center h-40">
                    <p class="text-gray-500">Author not found.</p>
                </div>
            </div>
        </div>

        <!-- Author Profile -->
        <div v-else class="flex flex-row justify-center">
            <div class="min-h-100 max-w-200 flex flex-col ml-4 mr-4 mb-5 md:ml-10 md:mr-10 mt-5 border border-primary-blue-100 border-solid p-10 shadow-md rounded-lg">
                <div class="flex flex-col sm:flex-row gap-6 items-start">
                    <img
                        v-if="author.picture"
                        :src="author.picture"
                        :alt="author.name"
                        class="w-28 h-28 rounded-full object-cover border border-gray-200 shrink-0"
                    />
                    <div v-else class="w-28 h-28 rounded-full bg-gray-100 flex items-center justify-center text-gray-400 shrink-0">
                        <font-awesome icon="fas fa-user" class="text-4xl" />
                    </div>
                    <div class="flex flex-col">
                        <h1 class="text-3xl font-bold">{{ author.name }}</h1>
                        <p v-if="author.bio" class="text-gray-700 mt-3 leading-relaxed">{{ author.bio }}</p>
                        <div class="flex flex-wrap gap-4 mt-4 text-sm">
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
            </div>
        </div>

        <!-- Articles by this author -->
        <div v-if="author" class="flex flex-row justify-center">
            <div class="min-h-100 max-w-200 flex flex-col mb-10 ml-4 mr-4 md:ml-10 md:mr-10 border border-primary-blue-100 border-solid p-5 shadow-md rounded-lg">
                <h2 class="mb-5 ml-2">Articles by {{ author.name }}</h2>
                <div v-if="articles && articles.length" class="flex flex-wrap">
                    <div v-for="article in articles" :key="article.article.id" class="w-full md:w-1/2 xl:w-1/3">
                        <div class="flex flex-col justify-between bg-white border border-primary-blue-100 border-solid p-4 rounded shadow hover:shadow-lg transition-shadow duration-200 m-2">
                            <div class="flex flex-col">
                                <NuxtLink :to="`/articles/${article.article.slug}`">
                                    <h2 class="text-xl font-bold mb-2 ellipse hover:text-primary-blue-200">{{ article.article.title }}</h2>
                                </NuxtLink>
                                <h5>{{ article.article.updated_at ? 'Updated On: ' : 'Published On: ' }}{{ formatDate(article.article.updated_at || article.article.created_at) }}</h5>
                                <div class="flex flex-wrap mt-2 mb-2">
                                    <span v-for="category in article.categories" :key="category.id" class="bg-gray-200 text-gray-700 text-center px-2 py-1 mr-2 mb-2">
                                        {{ category.title }}
                                    </span>
                                </div>
                            </div>
                            <NuxtLink :to="`/articles/${article.article.slug}`" class="flex flex-col justify-center w-30 h-10 bg-primary-blue-100 text-white text-center font-bold hover:text-gray-300 hover:bg-primary-blue-200">Read more</NuxtLink>
                        </div>
                    </div>
                </div>
                <div v-else class="text-gray-500 p-6 text-center">
                    No published articles by this author yet.
                </div>
                <div class="flex flex-row justify-center mt-5">
                    <NuxtLink :to="`/articles`" class="flex flex-col justify-center w-40 h-10 bg-primary-blue-100 text-white text-center font-bold hover:text-gray-300 hover:bg-primary-blue-200">Read Other Articles</NuxtLink>
                </div>
            </div>
        </div>
    </div>
</template>
