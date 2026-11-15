<script setup lang="ts">
const config = useRuntimeConfig();
const siteUrl = config.public.siteUrl || 'https://www.dataresearchanalysis.com';

useHead({
    title: 'Paid Media Planning for In-House Teams | Data Research Analysis',
    meta: [
        { name: 'description', content: 'Build your paid media plan in minutes — and prove it worked. Plan Studio turns your website and brief into a channel-by-channel plan, then tracks actuals against it.' },
        { name: 'robots', content: 'index, follow' },
        { property: 'og:type', content: 'website' },
        { property: 'og:title', content: 'Paid Media Planning for In-House Teams | Data Research Analysis' },
        { property: 'og:description', content: 'Build your paid media plan in minutes — and prove it worked.' },
        { property: 'og:url', content: `${siteUrl}/for-in-house-teams` },
        { name: 'twitter:card', content: 'summary' },
        { name: 'twitter:title', content: 'Paid Media Planning for In-House Teams | Data Research Analysis' },
        { name: 'twitter:description', content: 'Build your paid media plan in minutes — and prove it worked.' },
    ],
    link: [{ rel: 'canonical', href: `${siteUrl}/for-in-house-teams` }],
});
</script>
<template>
    <div>
        <section class="bg-primary-blue-100 w-full py-20 px-6">
            <div class="max-w-4xl mx-auto text-center">
                <p class="text-sm font-semibold uppercase tracking-widest text-blue-200 mb-4">Plan → Prove</p>
                <h1 class="font-bold text-white text-4xl md:text-5xl mb-4">Build your media plan in minutes — and prove it worked.</h1>
                <p class="text-blue-100 text-lg max-w-2xl mx-auto mb-8">
                    For in-house marketing teams: turn your website and brief into a channel-by-channel plan, then connect your ad accounts and prove what worked.
                </p>
                <NuxtLink to="/" class="inline-block py-4 px-8 rounded-xl bg-white text-primary-blue-100 font-bold text-lg shadow-xl hover:bg-blue-50 transition-colors">
                    Build a free plan
                </NuxtLink>
            </div>
        </section>
        <feature-guide />
        <pricing-section id="pricing" hide-faq />
        <faq-section />
    </div>
</template>
