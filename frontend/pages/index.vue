<script setup lang="ts">
import { HOME_FAQ_DATA } from "@/constants/homeFaq";

// Get site URL from config
const config = useRuntimeConfig();
const siteUrl = config.public.siteUrl || 'https://www.dataresearchanalysis.com';

// Structured data composable
const { 
    getSoftwareApplicationSchema, 
    getFAQSchema, 
    getSearchActionSchema,
    injectMultipleSchemas 
} = useStructuredData();

// Pricing schema for SEO
const getPricingSchema = () => {
    return {
        "@context": "https://schema.org",
        "@type": "Product",
        "name": "Data Research Analysis Platform",
        "description": "AI-powered paid media plan builder for CMOs and digital marketing teams",
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

// Inject all structured data during setup so it is present in the
// server-rendered HTML (previously it ran in onMounted, client-only).
injectMultipleSchemas([
    getSoftwareApplicationSchema(),
    getFAQSchema(HOME_FAQ_DATA),
    getSearchActionSchema(),
    getPricingSchema()
]);

// SEO Meta Tags for Homepage
useHead({
    title: 'Paid Media Plan Builder for CMOs | Data Research Analysis',
    meta: [
        { name: 'description', content: 'Build a channel-by-channel paid media plan that drives revenue. Point the AI at your website and get where to spend, how much, and what to create — then track how your campaigns perform. Free preview, no account needed.' },
        { name: 'author', content: 'Data Research Analysis' },
        { name: 'robots', content: 'index, follow, max-image-preview:large, max-snippet:-1' },
        
        // Open Graph / Facebook
        { property: 'og:type', content: 'website' },
        { property: 'og:url', content: siteUrl },
        { property: 'og:title', content: 'Paid Media Plan Builder for CMOs | Data Research Analysis' },
        { property: 'og:description', content: 'Point the AI at your website and get a channel-by-channel paid media plan — where to spend, how much, and what to create. Track how those campaigns perform. Free preview.' },
        { property: 'og:image', content: 'https://api.dataresearchanalysis.com/uploads/image-1782329307800-54137128.png' },
        { property: 'og:image:width', content: '1200' },
        { property: 'og:image:height', content: '630' },
        { property: 'og:locale', content: 'en_US' },
        
        // Twitter
        { name: 'twitter:card', content: 'summary_large_image' },
        { name: 'twitter:url', content: siteUrl },
        { name: 'twitter:title', content: 'Paid Media Plan Builder for CMOs | Data Research Analysis' },
        { name: 'twitter:description', content: 'Build a channel-by-channel paid media plan that drives revenue — then track how it performs. Free preview.' },
        { name: 'twitter:image', content: 'https://api.dataresearchanalysis.com/uploads/image-1782329307800-54137128.png' },
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
                { text: 'More than two-thirds of marketers estimate at least 11% of media budgets are lost to optimization lag.', tag: 'Research' },
                { text: 'ROI is the top metric the CEO, CFO, and board use to judge marketing.', tag: 'Research' }
            ]"
            roi-strip="Stop guessing where to spend. Plan every channel. Track every result."
        />
        <section class="bg-primary-blue-100 w-full py-20 px-6">
            <div class="max-w-7xl mx-auto text-center">
                <h2 class="font-bold text-white text-center text-4xl mb-4">What wasted ad spend is already costing you.</h2>
                <p class="text-blue-100 text-center text-lg mb-12 max-w-2xl mx-auto">The average organization wastes 25% of its budget on efforts that do not drive revenue. A channel-by-channel plan puts every dollar behind what works.</p>
                <roi-calculator />
            </div>
        </section>
        <problems id="about" />
        <why-dra id="why-dra" />
        <feature-guide id="feature-guide" />
        <add-external-data-source id="add-external-data-source" />
        <ai-showcase id="ai-showcase" />
        <pricing-section id="pricing" />
        <faq-section />
        <partner-trust-badges />
    </div>
</template>