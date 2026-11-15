<script setup lang="ts">
const config = useRuntimeConfig();
const siteUrl = config.public.siteUrl || 'https://www.dataresearchanalysis.com';

useHead({
    title: 'AI Paid Media Planning for Agencies | Data Research Analysis',
    meta: [
        { name: 'description', content: 'Build client-ready paid media plans in minutes — then prove they worked. Plan Studio for agencies: per-client projects, client-ready decks, and plan-vs-actuals tracking.' },
        { name: 'robots', content: 'index, follow' },
        { property: 'og:type', content: 'website' },
        { property: 'og:title', content: 'AI Paid Media Planning for Agencies | Data Research Analysis' },
        { property: 'og:description', content: 'Build client-ready paid media plans in minutes — then prove they worked.' },
        { property: 'og:url', content: `${siteUrl}/agencies` },
        { name: 'twitter:card', content: 'summary' },
        { name: 'twitter:title', content: 'AI Paid Media Planning for Agencies | Data Research Analysis' },
        { name: 'twitter:description', content: 'Build client-ready paid media plans in minutes — then prove they worked.' },
    ],
    link: [{ rel: 'canonical', href: `${siteUrl}/agencies` }],
});
</script>
<template>
    <div>
        <hero />
        <agency-problems variant="white" />
        <built-for-agencies />
        <partner-trust-badges />
        <pricing-section id="pricing" hide-faq />
        <faq-section />
    </div>
</template>
