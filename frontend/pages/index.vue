<script setup>
import { onMounted } from "vue";

// SEO Meta Tags for Homepage
useHead({
    title: 'Marketing Data Analytics & AI Dashboard for CMOs | Data Research Analysis',
    meta: [
        { name: 'description', content: 'Unify your marketing data from Google Ads, Analytics, and SQL. The AI-powered analytics platform for marketing executives who need specific ROI answers fast.' },
        { name: 'keywords', content: 'marketing data analytics, CMO dashboard, AI marketing insights, cross-channel ad reporting, ROI tracking, marketing automation, Google Ads analysis' },
        { name: 'author', content: 'Data Research Analysis' },
        { name: 'robots', content: 'index, follow' },
        
        // Open Graph / Facebook
        { property: 'og:type', content: 'website' },
        { property: 'og:url', content: 'https://dataresearchanalysis.com/' },
        { property: 'og:title', content: 'Marketing Data Analytics & AI Dashboard for CMOs | Data Research Analysis' },
        { property: 'og:description', content: 'Unify your marketing data from Google Ads, Analytics, and SQL. The AI-powered analytics platform for marketing executives who need specific ROI answers fast.' },
        { property: 'og:image', content: 'https://dataresearchanalysis.com/images/og-image.png' },
        
        // Twitter
        { name: 'twitter:card', content: 'summary_large_image' },
        { name: 'twitter:url', content: 'https://dataresearchanalysis.com/' },
        { name: 'twitter:title', content: 'Marketing Data Analytics & AI Dashboard for CMOs | Data Research Analysis' },
        { name: 'twitter:description', content: 'Unify your marketing data from Google Ads, Analytics, and SQL. The AI-powered analytics platform for marketing executives who need specific ROI answers fast.' },
        { name: 'twitter:image', content: 'https://dataresearchanalysis.com/images/og-image.png' },
    ],
    link: [
        { rel: 'canonical', href: 'https://dataresearchanalysis.com/' }
    ]
});

onMounted(() => {

})
</script>
<template>
    <div>
        <hero />
        <problems id="about" />
        <why-dra id="why-dra" />
        <ai-showcase id="ai-showcase" />
        <add-external-data-source id="add-external-data-source" />
        <how-do-it-get-started id="how-do-it-get-started" />
        <join-private-beta id="join-private-beta" />
        
        <!-- Cookie Banner -->
        <cookie-disclaimer-banner />
    </div>
</template>