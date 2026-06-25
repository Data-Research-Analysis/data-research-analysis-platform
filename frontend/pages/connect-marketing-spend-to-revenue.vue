<script setup lang="ts">
import intelligenceOverview from '/assets/images/intelligence-overview.png';
import channelComparison from '/assets/images/channel-comparison.png';
import campaignPerformance from '/assets/images/campaign-performance.png';
const config = useRuntimeConfig();
const siteUrl = config.public.siteUrl || 'https://www.dataresearchanalysis.com';
const { getOrganizationSchema, getSoftwareApplicationSchema, getFAQSchema, getBreadcrumbSchema, injectMultipleSchemas } = useStructuredData();

const scrollToPricing = () => {
    if (import.meta.client) {
        const el = document.getElementById('pricing');
        if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
};

const faqData = [
    { question: 'How do I connect marketing spend to revenue?', answer: 'DRA unifies your ad platform data (Google Ads, LinkedIn, Meta), your analytics data (GA4), and your revenue data (CRM, SQL) into one Federated Query Layer. This lets you trace every dollar from ad spend to closed revenue — automatically, without manual spreadsheet work.' },
    { question: 'Why is my MarTech stack a barrier to alignment?', answer: '53% of marketing leaders say their tools prevent alignment. The problem is data silos: each tool tracks different metrics, uses different attribution models, and exports different numbers. DRA replaces the chaos with a single truth layer.' },
    { question: 'What is a GA4 alternative for marketing attribution?', answer: 'DRA is purpose-built for marketing attribution where GA4 falls short. While GA4 offers limited attribution models and no cross-source data joining, DRA connects unlimited data sources, supports multi-touch attribution, and lets you build custom attribution models without engineering help.' },
    { question: 'Is DRA better than using Looker or Tableau for marketing?', answer: 'Looker and Tableau are BI tools — they visualize data but don\'t solve the data integration problem. DRA is a marketing intelligence platform that unifies data first, then visualizes it. You skip the ETL, the SQL, and the data engineering overhead.' }
];

onMounted(() => {
    if (import.meta.client) {
        injectMultipleSchemas([
            getOrganizationSchema(),
            getSoftwareApplicationSchema(),
            getFAQSchema(faqData),
            getBreadcrumbSchema([{ name: 'Home', url: siteUrl }, { name: 'Connect Marketing Spend to Revenue', url: `${siteUrl}/connect-marketing-spend-to-revenue` }])
        ]);
    }
});

useHead({
    title: 'Connect Marketing Spend to Revenue: End the MarTech Stack Mess | DRA',
    meta: [
        { name: 'description', content: '53% of leaders see their tools as a barrier to alignment. DRA unifies your MarTech stack so you can connect marketing spend to revenue in one platform.' },
        { name: 'keywords', content: 'connect marketing spend to revenue, marketing attribution tool, GA4 alternative for marketing attribution, MarTech stack, multi-touch attribution models comparison, marketing ROI measurement' },
        { name: 'robots', content: 'index, follow' },
        { property: 'og:title', content: 'Connect Marketing Spend to Revenue — End the MarTech Mess | DRA' },
        { property: 'og:description', content: '53% of leaders see their tools as a barrier. DRA unifies your stack so you can connect spend to revenue.' },
        { property: 'og:url', content: `${siteUrl}/connect-marketing-spend-to-revenue` },
        { name: 'twitter:title', content: 'Connect Marketing Spend to Revenue — End the MarTech Mess | DRA' },
        { name: 'twitter:description', content: '53% of leaders see their tools as a barrier. DRA unifies your stack so you can connect spend to revenue.' }
    ],
    link: [{ rel: 'canonical', href: `${siteUrl}/connect-marketing-spend-to-revenue` }]
});
</script>
<template>
    <div>
        <section class="bg-primary-blue-100 w-full relative flex flex-col items-center py-24 px-6">
            <div class="max-w-4xl mx-auto text-center">
                <h1 class="font-bold text-white text-5xl leading-tight mb-6">Connect Marketing Spend to Revenue<br><span class="text-transparent bg-clip-text bg-gradient-to-r from-blue-200 to-white">End the MarTech Stack Mess</span></h1>
                <p class="text-xl text-blue-100 max-w-2xl mx-auto mb-8 leading-relaxed">53% of marketing leaders see their own tools as a barrier to alignment. 10 tabs, 5 logins, 3 export formats, and zero connection between spend and revenue. DRA is the single platform that replaces the chaos.</p>
                <div class="w-64 mx-auto"><combo-button label="Unify Your Stack" color="white" class="w-full h-14 text-lg shadow-xl hover:scale-105 transition-transform cursor-pointer" @click="scrollToPricing" /></div>
            </div>
        </section>
        <section class="bg-white w-full py-16 px-6">
            <div class="max-w-7xl mx-auto">
                <h2 class="font-bold text-primary-blue-100 text-center text-4xl mb-4">The MarTech Stack Mess</h2>
                <p class="text-gray-500 text-center text-lg mb-12 max-w-2xl mx-auto">Three ways your tools are working against you — and how DRA unifies them.</p>
                <div class="grid grid-cols-1 md:grid-cols-3 gap-8">
                    <div class="bg-white p-8 rounded-xl shadow-lg border border-gray-100 hover:-translate-y-2 hover:shadow-xl transition duration-300">
                        <div class="w-14 h-14 bg-blue-50 rounded-full flex items-center justify-center mb-5 text-primary-blue-100 text-2xl"><font-awesome icon="fas fa-database" /></div>
                        <h3 class="font-bold text-xl text-primary-blue-100 mb-3">Data Silo Chaos</h3>
                        <p class="text-gray-600 leading-relaxed">Google Ads lives in one dashboard, GA4 in another, LinkedIn in a third, your CRM in a fourth. Assembling the full picture requires exporting, joining, and manually reconciling spreadsheets.</p>
                    </div>
                    <div class="bg-white p-8 rounded-xl shadow-lg border border-gray-100 hover:-translate-y-2 hover:shadow-xl transition duration-300">
                        <div class="w-14 h-14 bg-blue-50 rounded-full flex items-center justify-center mb-5 text-primary-blue-100 text-2xl"><font-awesome icon="fas fa-arrow-right-arrow-left" /></div>
                        <h3 class="font-bold text-xl text-primary-blue-100 mb-3">Incompatible Attribution</h3>
                        <p class="text-gray-600 leading-relaxed">Every platform uses its own attribution model. Google Ads claims last-click credit. LinkedIn claims assisted conversion. GA4 uses data-driven. None of them agree — so none of them are actionable.</p>
                    </div>
                    <div class="bg-white p-8 rounded-xl shadow-lg border border-gray-100 hover:-translate-y-2 hover:shadow-xl transition duration-300">
                        <div class="w-14 h-14 bg-blue-50 rounded-full flex items-center justify-center mb-5 text-primary-blue-100 text-2xl"><font-awesome icon="fas fa-hourglass-half" /></div>
                        <h3 class="font-bold text-xl text-primary-blue-100 mb-3">Tool Overhead Costs</h3>
                        <p class="text-gray-600 leading-relaxed">Paying for 5+ tools that don't talk to each other, plus the engineering hours to maintain them. 53% of leaders say their stack actively prevents alignment — not enables it.</p>
                    </div>
                </div>
            </div>
        </section>
        <section class="bg-gray-50 w-full py-16 px-6">
            <div class="max-w-7xl mx-auto">
                <h2 class="font-bold text-primary-blue-100 text-center text-4xl mb-4">How DRA Replaces the Mess with One Platform</h2>
                <p class="text-gray-500 text-center text-lg mb-12 max-w-2xl mx-auto">All your data. One truth layer. Zero overhead.</p>
                <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
                    <div class="bg-white p-8 rounded-xl shadow-lg border border-gray-100 hover:shadow-xl transition duration-300 hover:-translate-y-1">
                        <div class="text-3xl text-primary-blue-100 mb-4"><font-awesome icon="fas fa-plug" /></div>
                        <h3 class="text-xl font-bold text-primary-blue-100 mb-2">Connect Every Source</h3>
                        <p class="text-primary-blue-100/80 leading-relaxed">Google Ads, GA4, LinkedIn, Meta, SQL databases, CSV, Excel, PDF — connect them all in one click. No API keys, no middleware, no engineering tickets.</p>
                    </div>
                    <div class="bg-white p-8 rounded-xl shadow-lg border border-gray-100 hover:shadow-xl transition duration-300 hover:-translate-y-1">
                        <div class="text-3xl text-primary-blue-100 mb-4"><font-awesome icon="fas fa-layer-group" /></div>
                        <h3 class="text-xl font-bold text-primary-blue-100 mb-2">Federated Query Layer</h3>
                        <p class="text-primary-blue-100/80 leading-relaxed">One query across all your sources. DRA's architecture lets you join Google Ads data with SQL data with CSV data — as if they were one database.</p>
                    </div>
                    <div class="bg-white p-8 rounded-xl shadow-lg border border-gray-100 hover:shadow-xl transition duration-300 hover:-translate-y-1">
                        <div class="text-3xl text-primary-blue-100 mb-4"><font-awesome icon="fas fa-brain" /></div>
                        <h3 class="text-xl font-bold text-primary-blue-100 mb-2">Unified Attribution</h3>
                        <p class="text-primary-blue-100/80 leading-relaxed">Five attribution models built in. Compare last-touch, first-touch, linear, time-decay, and data-driven — all from the same unified data set.</p>
                    </div>
                    <div class="bg-white p-8 rounded-xl shadow-lg border border-gray-100 hover:shadow-xl transition duration-300 hover:-translate-y-1">
                        <div class="text-3xl text-primary-blue-100 mb-4"><font-awesome icon="fas fa-file-pen" /></div>
                        <h3 class="text-xl font-bold text-primary-blue-100 mb-2">Cross-Channel Dashboards</h3>
                        <p class="text-primary-blue-100/80 leading-relaxed">Build dashboards that combine data from every channel on one canvas. Compare Google Ads ROAS next to LinkedIn CPL next to organic conversion rate.</p>
                    </div>
                    <div class="bg-white p-8 rounded-xl shadow-lg border border-gray-100 hover:shadow-xl transition duration-300 hover:-translate-y-1">
                        <div class="text-3xl text-primary-blue-100 mb-4"><font-awesome icon="fas fa-robot" /></div>
                        <h3 class="text-xl font-bold text-primary-blue-100 mb-2">No-Code Everything</h3>
                        <p class="text-primary-blue-100/80 leading-relaxed">DRA is built for marketers, not engineers. Connect sources, build models, and create dashboards — all without writing a single line of code.</p>
                    </div>
                    <div class="bg-white p-8 rounded-xl shadow-lg border border-gray-100 hover:shadow-xl transition duration-300 hover:-translate-y-1">
                        <div class="text-3xl text-primary-blue-100 mb-4"><font-awesome icon="fas fa-coins" /></div>
                        <h3 class="text-xl font-bold text-primary-blue-100 mb-2">Replace 5 Tools with 1</h3>
                        <p class="text-primary-blue-100/80 leading-relaxed">DRA replaces your analytics tool, attribution tool, reporting tool, data connector, and dashboard builder. One platform. One bill. One source of truth.</p>
                    </div>
                </div>
                <div class="flex justify-center mt-12"><div class="w-64"><combo-button label="Unify Your MarTech Stack" color="primary" class="w-full h-12 shadow-lg cursor-pointer" @click="scrollToPricing" /></div></div>
            </div>
        </section>
        <section class="bg-white w-full py-20 px-6 border-t border-gray-100">
            <div class="max-w-6xl mx-auto">
                <div class="flex flex-col lg:flex-row items-center gap-12">
                    <div class="lg:w-1/2">
                        <HeroCarousel :images="[intelligenceOverview, channelComparison, campaignPerformance]" />
                    </div>
                    <div class="lg:w-1/2">
                        <h3 class="text-3xl font-bold text-primary-blue-100 mb-4">Every Source Connected in One Click</h3>
                        <p class="text-gray-600 text-lg leading-relaxed mb-6">DRA connects Google Ads, GA4, LinkedIn, Meta, SQL databases, CSV, Excel, and PDFs instantly. No API keys to manage, no middleware, no engineering tickets. One platform replaces your entire MarTech stack.</p>
                        <ul class="space-y-3">
                            <li class="flex items-start gap-3"><div class="w-6 h-6 bg-green-100 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5"><font-awesome icon="fas fa-check" class="text-green-600 text-xs" /></div><span class="text-gray-700">OAuth one-click connections to all major platforms</span></li>
                            <li class="flex items-start gap-3"><div class="w-6 h-6 bg-green-100 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5"><font-awesome icon="fas fa-check" class="text-green-600 text-xs" /></div><span class="text-gray-700">Cross-source data joining without SQL or VLOOKUPs</span></li>
                            <li class="flex items-start gap-3"><div class="w-6 h-6 bg-green-100 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5"><font-awesome icon="fas fa-check" class="text-green-600 text-xs" /></div><span class="text-gray-700">Replace 5+ tools with one unified platform</span></li>
                        </ul>
                    </div>
                </div>
            </div>
        </section>
        <section class="bg-primary-blue-100 w-full py-16 px-6">
            <div class="max-w-5xl mx-auto text-center">
                <h2 class="text-3xl font-bold text-white mb-8">The True Cost of a Messy Stack</h2>
                <div class="grid grid-cols-1 md:grid-cols-3 gap-8 mb-8">
                    <div class="bg-white/10 rounded-xl p-6 backdrop-blur-sm">
                        <div class="text-4xl font-bold text-white mb-2">53%</div>
                        <p class="text-blue-100">Of leaders say tools block alignment</p>
                    </div>
                    <div class="bg-white/10 rounded-xl p-6 backdrop-blur-sm">
                        <div class="text-4xl font-bold text-white mb-2">5+</div>
                        <p class="text-blue-100">Separate tools in the average stack</p>
                    </div>
                    <div class="bg-white/10 rounded-xl p-6 backdrop-blur-sm">
                        <div class="text-4xl font-bold text-white mb-2">400 Hrs</div>
                        <p class="text-blue-100">Lost to manual data maintenance yearly</p>
                    </div>
                </div>
            </div>
        </section>
        <pricing-section id="pricing" />
        <section id="faq" class="py-16 px-6 bg-white">
            <div class="container mx-auto px-4 max-w-4xl">
                <h2 class="text-3xl font-bold text-primary-blue-100 text-center mb-12">Frequently Asked Questions</h2>
                <div class="space-y-6">
                    <div v-for="(faq, index) in faqData" :key="index" class="bg-white p-6 rounded-lg shadow-md border border-gray-100">
                        <h3 class="text-xl font-semibold mb-3 text-primary-blue-100">{{ faq.question }}</h3>
                        <p class="text-gray-700">{{ faq.answer }}</p>
                    </div>
                </div>
            </div>
        </section>
        <partner-trust-badges />
    </div>
</template>
