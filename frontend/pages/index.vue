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
const faqSectionRef = ref<any>(null);

// Pricing schema for SEO
const getPricingSchema = () => {
    return {
        "@context": "https://schema.org",
        "@type": "Product",
        "name": "Data Research Analysis Platform",
        "description": "AI-powered marketing analytics platform for CMOs and marketing teams",
        "image": "https://api.dataresearchanalysis.com/uploads/image-1782329307800-54137128.png",
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
                "name": "STARTER Plan",
                "price": "29",
                "priceCurrency": "USD",
                "priceValidUntil": "2027-12-31",
                "availability": "https://schema.org/InStock",
                "billingIncrement": "month",
                "url": `${siteUrl}/#pricing`
            },
            {
                "@type": "Offer",
                "name": "PROFESSIONAL Plan",
                "price": "129",
                "priceCurrency": "USD",
                "priceValidUntil": "2027-12-31",
                "availability": "https://schema.org/InStock",
                "billingIncrement": "month",
                "url": `${siteUrl}/#pricing`
            },
            {
                "@type": "Offer",
                "name": "PROFESSIONAL PLUS Plan",
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
        { name: 'description', content: 'AI-powered marketing analytics platform for CMOs. Unify Google Ads, Analytics, SQL, CSV, Excel data in custom dashboards. Plans from Free to Enterprise. Enterprise pricing is custom. Start free today.' },
        { name: 'keywords', content: 'marketing analytics platform 2026, CMO dashboard, AI marketing insights, Google Ads analytics, cross-channel reporting, marketing ROI tracking, data visualization, business intelligence for marketing' },
        { name: 'author', content: 'Data Research Analysis' },
        { name: 'robots', content: 'index, follow, max-image-preview:large, max-snippet:-1' },
        
        // Open Graph / Facebook
        { property: 'og:type', content: 'website' },
        { property: 'og:url', content: siteUrl },
        { property: 'og:title', content: 'Best Marketing Analytics Platform 2026 - AI Dashboard for CMOs' },
        { property: 'og:description', content: 'AI-powered marketing analytics platform. Unify Google Ads, Analytics, SQL data. Custom dashboards for marketing executives. Free trial.' },
        { property: 'og:image', content: 'https://api.dataresearchanalysis.com/uploads/image-1782329307800-54137128.png' },
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
        <payoff-block
            variant="light"
            :stats="[
                { text: '78% of marketing decision-makers believe at least 10% of spend is wasted. The average organization wastes 25% of its budget on efforts that do not drive revenue.', tag: 'Research' },
                { text: 'The status quo already costs well over $8,000 per month (pipeline, BI, attribution tool, and an analyst). That is money you spend today, not a comparison to another product.', tag: 'Derived' },
                { text: 'Marketing teams spend an average of 14.5 hours per week collecting and preparing data.', tag: 'Research' }
            ]"
            roi-strip="Stop paying for the stack and the hours. Keep the revenue you stop wasting."
        />
        <section class="bg-primary-blue-100 w-full py-20 px-6">
            <div class="max-w-7xl mx-auto text-center">
                <h2 class="font-bold text-white text-center text-4xl mb-4">What the status quo already costs you.</h2>
                <p class="text-blue-100 text-center text-lg mb-12 max-w-2xl mx-auto">The alternative is not another product. It is the tools, pipeline, and people you already pay for.</p>
                <stack-replacement-table />
            </div>
            <div class="max-w-7xl mx-auto mt-20">
                <roi-calculator />
            </div>
        </section>
        <problems id="about" />
        <why-dra id="why-dra" />
        <feature-guide id="feature-guide" />
        <add-external-data-source id="add-external-data-source" />
        <ai-showcase id="ai-showcase" />
        <pricing-section id="pricing" />
        <faq-section ref="faqSectionRef" />
        <partner-trust-badges />
    </div>
</template>