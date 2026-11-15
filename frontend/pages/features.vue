<script setup lang="ts">
const config = useRuntimeConfig();
const siteUrl = config.public.siteUrl || 'https://www.dataresearchanalysis.com';

useHead({
    title: 'Features & Integrations | Data Research Analysis',
    meta: [
        { name: 'description', content: 'Connect Google Ads, Meta, GA4, GAM, SQL, CSV, Excel, and PDF; build a channel-by-channel plan; and prove plan vs actuals with revenue attribution and dashboards.' },
        { name: 'robots', content: 'index, follow' },
        { property: 'og:type', content: 'website' },
        { property: 'og:title', content: 'Features & Integrations | Data Research Analysis' },
        { property: 'og:description', content: 'Connect your ads, analytics, and data sources — and turn them into a plan you can prove.' },
        { property: 'og:url', content: `${siteUrl}/features` },
        { name: 'twitter:card', content: 'summary' },
        { name: 'twitter:title', content: 'Features & Integrations | Data Research Analysis' },
        { name: 'twitter:description', content: 'Connect your ads, analytics, and data sources — and turn them into a plan you can prove.' },
    ],
    link: [{ rel: 'canonical', href: `${siteUrl}/features` }],
});
</script>
<template>
    <div>
        <section class="bg-primary-blue-100 w-full py-20 px-6">
            <div class="max-w-4xl mx-auto text-center">
                <p class="text-sm font-semibold uppercase tracking-widest text-blue-200 mb-4">Platform</p>
                <h1 class="font-bold text-white text-4xl md:text-5xl mb-4">Features &amp; integrations</h1>
                <p class="text-blue-100 text-lg max-w-2xl mx-auto">Connect your ads, analytics, and data sources — and turn them into a plan you can prove.</p>
            </div>
        </section>
        <feature-guide />
        <add-external-data-source />
        <ai-showcase />
        <pricing-section id="pricing" hide-faq />
        <faq-section />
    </div>
</template>
