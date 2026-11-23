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
        "description": "AI paid-media operating system for CMOs and marketing teams: Plan Studio builds a channel-by-channel plan, then Campaign Intelligence tracks actuals, attributes revenue, and proves ROI.",
        "image": "https://api.dataresearchanalysis.com/uploads/image-1782329307800-54137128.png",
        "brand": {
            "@type": "Brand",
            "name": "Data Research Analysis"
        },
        "offers": [
            {
                "@type": "Offer",
                "name": "FREE Plan",
                "description": "600 credits every month plus a one-time 500-credit onboarding bonus. No card required.",
                "price": "0",
                "priceCurrency": "USD",
                "priceValidUntil": "2027-12-31",
                "availability": "https://schema.org/InStock",
                "url": `${siteUrl}/#pricing`
            },
            {
                "@type": "Offer",
                "name": "PRO Plan",
                "description": "5,000 credits per month. $49/month billed monthly or $39.50/month billed annually. Scales to 100,000 credits.",
                "price": "49",
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
    title: 'AI Paid Media Plan Builder for Agencies | Data Research Analysis',
    meta: [
        { name: 'description', content: 'Plan → Prove: build a client-ready channel-by-channel paid media plan in minutes, then connect their ad accounts and data sources to track actuals, attribute revenue, and prove what worked. Free preview, no account needed.' },
        { name: 'author', content: 'Data Research Analysis' },
        { name: 'robots', content: 'index, follow, max-image-preview:large, max-snippet:-1' },
        
        // Open Graph / Facebook
        { property: 'og:type', content: 'website' },
        { property: 'og:url', content: siteUrl },
        { property: 'og:title', content: 'AI Paid Media Plan Builder for Agencies | Data Research Analysis' },
        { property: 'og:description', content: 'Plan → Prove: build a client-ready paid media plan in minutes, then track actuals, attribute revenue, and prove what worked. Free preview.' },
        { property: 'og:image', content: 'https://api.dataresearchanalysis.com/uploads/image-1782329307800-54137128.png' },
        { property: 'og:image:width', content: '1200' },
        { property: 'og:image:height', content: '630' },
        { property: 'og:locale', content: 'en_US' },
        
        // Twitter
        { name: 'twitter:card', content: 'summary_large_image' },
        { name: 'twitter:url', content: siteUrl },
        { name: 'twitter:title', content: 'AI Paid Media Plan Builder for Agencies | Data Research Analysis' },
        { name: 'twitter:description', content: 'Plan → Prove: build a client-ready plan in minutes, then track actuals, attribute revenue, and prove what worked. Free preview.' },
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
            roi-strip="Build the client plan. Prove it worked."
        />
        <agency-problems />
        <feature-guide id="feature-guide" />
        <built-for-agencies />
        <plan-deck
            :pdfs="[
                { label: 'Strategy deck', src: '/plan-decks/00-digital-marketing-strategy-deck.pdf' },
                { label: 'Plan index', src: '/plan-decks/00-plan-index.pdf' },
                { label: 'Creative brief', src: '/plan-decks/01-creative-brief.pdf' },
                { label: 'Market research', src: '/plan-decks/02-market-research.pdf' },
                { label: 'Competitor research', src: '/plan-decks/03-competitor-paid-media-research.pdf' },
                { label: 'Paid media audit', src: '/plan-decks/03a-company-paid-media-audit.pdf' },
                { label: 'Audience analysis', src: '/plan-decks/04-audience-analysis-avatars.pdf' },
                { label: 'Keywords & URLs', src: '/plan-decks/05-keyword-destination-url-plan.pdf' },
                { label: 'Ad copy', src: '/plan-decks/06-ad-copy.pdf' },
                { label: 'Creatives', src: '/plan-decks/07-creatives.pdf' },
                { label: 'Landing page copy', src: '/plan-decks/08-landing-page-copy.pdf' },
                { label: 'Landing implementation', src: '/plan-decks/09-landing-page-implementation.pdf' },
                { label: 'Media plan', src: '/plan-decks/10-media-plan.pdf' },
                { label: 'Tracking setup', src: '/plan-decks/11-tracking-setup.pdf' },
                { label: 'Campaign build', src: '/plan-decks/12-campaign-build-guide.pdf' },
                { label: 'Setup checklist', src: '/plan-decks/13-setup-checklist.pdf' },
                { label: 'Results review', src: '/plan-decks/14-results-review.pdf' }
            ]"
            :downloads="[
                { label: 'Strategy deck (PPTX)', src: '/plan-decks/00-digital-marketing-strategy-deck.pptx' },
                { label: 'Media plan (XLSX)', src: '/plan-decks/10-media-plan.xlsx' },
                { label: 'Setup checklist (XLSX)', src: '/plan-decks/13-setup-checklist.xlsx' }
            ]"
        />
        <partner-trust-badges variant="muted" />
        <pricing-section id="pricing" hide-faq />
        <faq-section />
    </div>
</template>