<script setup lang="ts">
import { onMounted } from "vue";

// Get site URL from config
const config = useRuntimeConfig();
const siteUrl = config.public.siteUrl || 'https://www.dataresearchanalysis.com';

// Structured data composable
const { 
    getOrganizationSchema, 
    getSoftwareApplicationSchema, 
    getFAQSchema, 
    getSearchActionSchema,
    injectMultipleSchemas 
} = useStructuredData();

// Get reference to FAQ component to access faqData
const faqSectionRef = ref<HTMLElement | null>(null);

// Pricing schema for SEO
const getPricingSchema = () => {
    return {
        "@context": "https://schema.org",
        "@type": "Product",
        "name": "Data Research Analysis Platform",
        "description": "AI-powered marketing analytics platform for CMOs and marketing teams",
        "brand": {
            "@type": "Brand",
            "name": "Data Research Analysis"
        },
        "offers": [
            {
                "@type": "Offer",
                "name": "FREE Plan",
                "price": "0",
                "priceCurrency": "USD",
                "priceValidUntil": "2027-12-31",
                "availability": "https://schema.org/InStock",
                "url": `${siteUrl}/#pricing`
            },
            {
                "@type": "Offer",
                "name": "PROFESSIONAL Plan",
                "price": "399",
                "priceCurrency": "USD",
                "priceValidUntil": "2027-12-31",
                "availability": "https://schema.org/InStock",
                "billingIncrement": "month",
                "url": `${siteUrl}/#pricing`
            },
            {
                "@type": "Offer",
                "name": "ENTERPRISE Plan",
                "description": "Custom pricing tailored to your needs. Contact our sales team for a quote.",
                "priceCurrency": "USD",
                "priceValidUntil": "2027-12-31",
                "availability": "https://schema.org/InStock",
                "url": `${siteUrl}/#pricing`
            }
        ]
    };
};

// Inject all structured data
onMounted(() => {
    if (import.meta.client) {
        // Access faqData from component ref
        const faqData = faqSectionRef.value?.faqData || [];
        
        const schemas = [
            getOrganizationSchema(),
            getSoftwareApplicationSchema(),
            getFAQSchema(faqData),
            getSearchActionSchema(),
            getPricingSchema()
        ];
        injectMultipleSchemas(schemas);
    }
});

// SEO Meta Tags for Homepage
useHead({
    title: 'Best Marketing Analytics Platform 2026 - AI-Powered Dashboard for CMOs | Data Research Analysis',
    meta: [
        { name: 'description', content: 'AI-powered marketing analytics platform for CMOs. Unify Google Ads, Analytics, SQL, CSV, Excel data in custom dashboards. Plans from FREE to $2,499/month. Start free today.' },
        { name: 'keywords', content: 'marketing analytics platform 2026, CMO dashboard, AI marketing insights, Google Ads analytics, cross-channel reporting, marketing ROI tracking, data visualization, business intelligence for marketing' },
        { name: 'author', content: 'Data Research Analysis' },
        { name: 'robots', content: 'index, follow, max-image-preview:large, max-snippet:-1' },
        
        // Open Graph / Facebook
        { property: 'og:type', content: 'website' },
        { property: 'og:url', content: siteUrl },
        { property: 'og:title', content: 'Best Marketing Analytics Platform 2026 - AI Dashboard for CMOs' },
        { property: 'og:description', content: 'AI-powered marketing analytics platform. Unify Google Ads, Analytics, SQL data. Custom dashboards for marketing executives. Free trial.' },
        { property: 'og:image', content: `${siteUrl}/images/og-image.png` },
        { property: 'og:image:width', content: '1200' },
        { property: 'og:image:height', content: '630' },
        { property: 'og:locale', content: 'en_US' },
        
        // Twitter
        { name: 'twitter:card', content: 'summary_large_image' },
        { name: 'twitter:url', content: siteUrl },
        { name: 'twitter:title', content: 'Best Marketing Analytics Platform 2026 - AI Dashboard for CMOs' },
        { name: 'twitter:description', content: 'AI-powered marketing analytics. Unify Google Ads, Analytics, SQL data in custom dashboards.' },
        { name: 'twitter:image', content: `${siteUrl}/images/og-image.png` },
    ],
    link: [
        { rel: 'canonical', href: siteUrl }
    ]
});

</script>
<template>
    <div>
        <hero />
        <problems id="about" />
        <why-dra id="why-dra" />
        <ai-showcase id="ai-showcase" />
        <add-external-data-source id="add-external-data-source" />
        <how-do-it-get-started id="how-do-it-get-started" />
        <pricing-section id="pricing" />
        <faq-section ref="faqSectionRef" />
        <partner-trust-badges />
    </div>
</template>