<script setup lang="ts">
definePageMeta({ layout: 'default' });
const route = useRoute();
const slug = computed(() => typeof route.query.slug === 'string' ? route.query.slug : null);
const resourceUrl = computed(() => slug.value ? `/resources/${slug.value}` : null);

useHead({
    title: 'Download Link Expired | Data Research Analysis',
    meta: [{ name: 'robots', content: 'noindex' }],
});
</script>

<template>
    <div class="min-h-screen bg-gray-50 flex items-center justify-center px-4">
        <div class="bg-white rounded-2xl shadow-lg p-10 max-w-md w-full text-center">
            <div class="w-16 h-16 bg-amber-100 rounded-full flex items-center justify-center mx-auto mb-5">
                <font-awesome-icon :icon="['fas', 'clock']" class="text-amber-500 text-2xl" />
            </div>
            <h1 class="text-2xl font-bold text-gray-900 mb-3">This download link has expired</h1>
            <p class="text-gray-500 mb-2">
                Download links are single-use and valid for 1 hour. This link has either already been used or has expired.
            </p>
            <p class="text-gray-500 mb-8">
                To get a fresh download link, return to the resource page and submit the form again.
            </p>
            <NuxtLink
                :to="resourceUrl || '/'"
                class="inline-flex items-center gap-2 px-6 py-3 bg-primary-blue-100 text-white rounded-xl font-semibold hover:bg-primary-blue-80 transition-colors"
            >
                <font-awesome-icon :icon="['fas', 'arrow-left']" />
                {{ resourceUrl ? 'Back to Resource' : 'Back to Homepage' }}
            </NuxtLink>
        </div>
    </div>
</template>
