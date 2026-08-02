<script setup lang="ts">
definePageMeta({ layout: 'default' });
const config = useRuntimeConfig();

const { data: resources, error } = await useAsyncData(
    'resources-index',
    async () => {
        try {
            const response = await $fetch<any>(`${config.public.apiBase}/lead-generators`);
            if (response.success && response.data) return response.data;
            return [];
        } catch {
            return [];
        }
    }
);

useHead({
    title: 'Free Marketing Analytics Resources | Data Research Analysis',
    meta: [
        { name: 'description', content: 'Download free PDF guides, templates, and frameworks for marketing analytics, reporting, and data-driven decision making.' },
        { property: 'og:title', content: 'Free Marketing Analytics Resources | Data Research Analysis' },
        { property: 'og:description', content: 'Download free PDF guides, templates, and frameworks for marketing analytics, reporting, and data-driven decision making.' },
    ],
});
</script>

<template>
    <div class="max-w-5xl mx-auto px-4 py-12">

        <!-- Breadcrumb -->
        <nav class="flex items-center gap-2 text-sm text-gray-500 mb-6">
            <NuxtLink to="/" class="hover:text-gray-700 transition-colors">Home</NuxtLink>
            <font-awesome-icon :icon="['fas', 'chevron-right']" class="text-xs" />
            <span class="text-gray-700">Resources</span>
        </nav>

        <!-- Header -->
        <div class="mb-10">
            <h1 class="text-3xl md:text-4xl font-bold text-gray-900 mb-3">Free Marketing Analytics Resources</h1>
            <p class="text-lg text-gray-600 max-w-2xl">Practical guides, templates, and frameworks to help you build better reports, understand your data, and make smarter marketing decisions.</p>
        </div>

        <!-- Loading -->
        <div v-if="!resources" class="flex justify-center py-12">
            <font-awesome-icon :icon="['fas', 'spinner']" class="animate-spin text-3xl text-primary-blue-100" />
        </div>

        <!-- Empty state -->
        <div v-else-if="!resources.length" class="text-center py-16">
            <div class="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <font-awesome-icon :icon="['fas', 'file-pdf']" class="text-gray-400 text-2xl" />
            </div>
            <h2 class="text-xl font-semibold text-gray-700 mb-2">No resources available yet</h2>
            <p class="text-gray-500">Check back soon for new guides and templates.</p>
        </div>

        <!-- Resource cards -->
        <div v-else class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            <NuxtLink
                v-for="r in resources"
                :key="r.id"
                :to="`/resources/${r.slug}`"
                class="group bg-white rounded-2xl shadow-sm border border-gray-100 hover:shadow-md hover:border-primary-blue-20 transition-all duration-200 overflow-hidden flex flex-col no-underline"
            >
                <div class="p-6 flex flex-col flex-1">
                    <div class="flex items-start gap-3 mb-3">
                        <div class="flex-shrink-0 w-10 h-10 bg-red-50 rounded-lg flex items-center justify-center">
                            <font-awesome-icon :icon="['fas', 'file-pdf']" class="text-red-500" />
                        </div>
                        <div class="flex-1 min-w-0">
                            <h3 class="text-base font-semibold text-gray-900 group-hover:text-primary-blue-100 transition-colors leading-snug line-clamp-2">{{ r.title }}</h3>
                        </div>
                    </div>
                    <p v-if="r.description" class="text-sm text-gray-500 line-clamp-3 mb-4 flex-1">{{ r.description }}</p>
                    <div class="flex items-center justify-between text-xs text-gray-400 mt-auto pt-3 border-t border-gray-50">
                        <span :class="r.is_gated ? 'text-amber-600' : 'text-green-600'" class="font-medium">
                            {{ r.is_gated ? 'Free — Registration Required' : 'Free Download' }}
                        </span>
                        <div class="flex items-center gap-3">
                            <span class="flex items-center gap-1">
                                <font-awesome-icon :icon="['fas', 'eye']" class="text-[10px]" />
                                {{ r.view_count }}
                            </span>
                            <span class="flex items-center gap-1">
                                <font-awesome-icon :icon="['fas', 'download']" class="text-[10px]" />
                                {{ r.download_count }}
                            </span>
                        </div>
                    </div>
                </div>
            </NuxtLink>
        </div>
    </div>
</template>
