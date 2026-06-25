<script setup lang="ts">
import templateAIImage from '/assets/images/template-ai.png';
import aiInsights1 from '/assets/images/ai-insights-1.png';
import aiInsights2 from '/assets/images/ai-insights-2.png';
import aiInsights3 from '/assets/images/ai-insights-3.png';
const config = useRuntimeConfig();
const siteUrl = config.public.siteUrl || 'https://www.dataresearchanalysis.com';
const { getOrganizationSchema, getSoftwareApplicationSchema, getFAQSchema, injectMultipleSchemas } = useStructuredData();

const scrollToPricing = () => {
    if (import.meta.client) {
        const el = document.getElementById('pricing');
        if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
};

const faqData = [
    { question: 'What is data drudgery in marketing?', answer: 'Data drudgery is the manual, repetitive work of extracting, cleaning, joining, and formatting data before you can actually analyze it. DRA-coined term. It\'s the VLOOKUP formulas, the CSV exports, the manual reconciliations that consume 400 hours a year per team.' },
    { question: 'How many hours do marketers waste on manual data work?', answer: 'On average, marketing teams waste 400 hours per year on manual data maintenance. That\'s 10 full work weeks of VLOOKUPs, CSV exports, data cleaning, and dashboard maintenance instead of optimizing campaigns.' },
    { question: 'What is the Monday Morning VLOOKUP Tax?', answer: 'The Monday Morning VLOOKUP Tax is the hours your team loses every Monday morning manually exporting data, running VLOOKUPs, and fixing broken spreadsheet formulas before they can do actual marketing work. DRA eliminates this completely with automated data connections.' },
    { question: 'How do I justify a marketing budget increase to my CFO?', answer: 'Show them the math. 400 hours of manual data work at an average loaded cost of $75/hour equals $30,000 in lost productivity per year. DRA automates that work for a fraction of the cost — and frees your team to focus on revenue-generating optimization.' }
];

onMounted(() => {
    if (import.meta.client) {
        injectMultipleSchemas([
            getOrganizationSchema(),
            getSoftwareApplicationSchema(),
            getFAQSchema(faqData),

        ]);
    }
});

useHead({
    title: 'The Invisible Drain: Stop Wasting 400 Hours on Manual Data Work | DRA',
    meta: [
        { name: 'description', content: 'Marketing teams waste 400 hours a year on manual data maintenance. DRA automates the drudgery so your team can focus on strategy, not spreadsheets.' },
        { name: 'keywords', content: 'data drudgery, VLOOKUP tax, invisible drain, marketing budget justification, manual reporting, Monday Morning VLOOKUP Tax, marketing automation' },
        { name: 'robots', content: 'index, follow' },
        { property: 'og:title', content: 'The Invisible Drain — Stop Wasting 400 Hours on Data Work | DRA' },
        { property: 'og:description', content: 'Marketing teams waste 400 hours a year on manual data work. DRA automates the drudgery.' },
        { property: 'og:url', content: `${siteUrl}/invisible-drain` },
        { name: 'twitter:title', content: 'The Invisible Drain — Stop Wasting 400 Hours on Data Work | DRA' },
        { name: 'twitter:description', content: 'Marketing teams waste 400 hours a year on manual data work. DRA automates the drudgery.' }
    ],
    link: [{ rel: 'canonical', href: `${siteUrl}/invisible-drain` }]
});
</script>
<template>
    <div>
        <section class="bg-primary-blue-100 w-full relative flex flex-col items-center py-24 px-6">
            <div class="max-w-4xl mx-auto text-center">
                <h1 class="font-bold text-white text-5xl leading-tight mb-6">The Invisible Drain<br><span class="text-transparent bg-clip-text bg-gradient-to-r from-blue-200 to-white">Reclaim 400 Hours Lost to Data Drudgery</span></h1>
                <p class="text-xl text-blue-100 max-w-2xl mx-auto mb-8 leading-relaxed">Your team spends 80% of their time finding data instead of using it. Manual exports, VLOOKUP formulas, data cleaning, and broken dashboards consume 400 hours per year. DRA automates it all.</p>
                <div class="w-64 mx-auto"><combo-button label="Stop the Drain" color="white" class="w-full h-14 text-lg shadow-xl hover:scale-105 transition-transform cursor-pointer" @click="scrollToPricing" /></div>
            </div>
        </section>
        <section class="bg-white w-full py-16 px-6">
            <div class="max-w-7xl mx-auto">
                <h2 class="font-bold text-primary-blue-100 text-center text-4xl mb-4">Where the 400 Hours Go</h2>
                <p class="text-gray-500 text-center text-lg mb-12 max-w-2xl mx-auto">The invisible tasks that drain your team's productive hours.</p>
                <div class="grid grid-cols-1 md:grid-cols-3 gap-8">
                    <div class="bg-white p-8 rounded-xl shadow-lg border border-gray-100 hover:-translate-y-2 hover:shadow-xl transition duration-300">
                        <div class="w-14 h-14 bg-orange-50 rounded-full flex items-center justify-center mb-5 text-orange-500 text-2xl"><font-awesome icon="fas fa-file-export" /></div>
                        <h3 class="font-bold text-xl text-primary-blue-100 mb-3">CSV Export Hell</h3>
                        <p class="text-gray-600 leading-relaxed">Exporting data from Google Ads, GA4, LinkedIn, and Meta. Formatting columns. Renaming headers. Saving to the right folder. Every Monday morning, same ritual — the Monday Morning VLOOKUP Tax.</p>
                    </div>
                    <div class="bg-white p-8 rounded-xl shadow-lg border border-gray-100 hover:-translate-y-2 hover:shadow-xl transition duration-300">
                        <div class="w-14 h-14 bg-orange-50 rounded-full flex items-center justify-center mb-5 text-orange-500 text-2xl"><font-awesome icon="fas fa-table" /></div>
                        <h3 class="font-bold text-xl text-primary-blue-100 mb-3">VLOOKUP & Spreadsheet Spaghetti</h3>
                        <p class="text-gray-600 leading-relaxed">Joining data from different exports using fragile VLOOKUP formulas. One cell shift breaks everything. Debugging takes hours. The VLOOKUP Tax compounds every week.</p>
                    </div>
                    <div class="bg-white p-8 rounded-xl shadow-lg border border-gray-100 hover:-translate-y-2 hover:shadow-xl transition duration-300">
                        <div class="w-14 h-14 bg-orange-50 rounded-full flex items-center justify-center mb-5 text-orange-500 text-2xl"><font-awesome icon="fas fa-wrench" /></div>
                        <h3 class="font-bold text-xl text-primary-blue-100 mb-3">Dashboard Maintenance</h3>
                        <p class="text-gray-600 leading-relaxed">Reports break. Data sources disconnect. Dashboards need updating. Someone on your team spends hours every week keeping the reporting infrastructure alive instead of doing strategic work.</p>
                    </div>
                </div>
            </div>
        </section>
        <section class="bg-gray-50 w-full py-16 px-6">
            <div class="max-w-7xl mx-auto">
                <h2 class="font-bold text-primary-blue-100 text-center text-4xl mb-4">How DRA Eliminates Data Drudgery</h2>
                <p class="text-gray-500 text-center text-lg mb-12 max-w-2xl mx-auto">Automate the boring stuff. Focus on what matters.</p>
                <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
                    <div class="bg-white p-8 rounded-xl shadow-lg border border-gray-100 hover:shadow-xl transition duration-300 hover:-translate-y-1">
                        <div class="text-3xl text-primary-blue-100 mb-4"><font-awesome icon="fas fa-bolt" /></div>
                        <h3 class="text-xl font-bold text-primary-blue-100 mb-2">One-Click Data Connections</h3>
                        <p class="text-primary-blue-100/80 leading-relaxed">Connect Google Ads, GA4, LinkedIn, SQL, CSV, Excel, and PDF with one click. No exports, no VLOOKUPs, no manual formatting.</p>
                    </div>
                    <div class="bg-white p-8 rounded-xl shadow-lg border border-gray-100 hover:shadow-xl transition duration-300 hover:-translate-y-1">
                        <div class="text-3xl text-primary-blue-100 mb-4"><font-awesome icon="fas fa-robot" /></div>
                        <h3 class="text-xl font-bold text-primary-blue-100 mb-2">AI-Powered Data Joining</h3>
                        <p class="text-primary-blue-100/80 leading-relaxed">DRA's AI Data Modeler automatically detects relationships between data sources and joins them. No manual matching, no fragile formulas.</p>
                    </div>
                    <div class="bg-white p-8 rounded-xl shadow-lg border border-gray-100 hover:shadow-xl transition duration-300 hover:-translate-y-1">
                        <div class="text-3xl text-primary-blue-100 mb-4"><font-awesome icon="fas fa-gauge-high" /></div>
                        <h3 class="text-xl font-bold text-primary-blue-100 mb-2">Auto-Refreshing Dashboards</h3>
                        <p class="text-primary-blue-100/80 leading-relaxed">Set it and forget it. Dashboards update automatically as source data changes. No more Monday morning rebuilds.</p>
                    </div>
                    <div class="bg-white p-8 rounded-xl shadow-lg border border-gray-100 hover:shadow-xl transition duration-300 hover:-translate-y-1">
                        <div class="text-3xl text-primary-blue-100 mb-4"><font-awesome icon="fas fa-brain" /></div>
                        <h3 class="text-xl font-bold text-primary-blue-100 mb-2">Natural Language Queries</h3>
                        <p class="text-primary-blue-100/80 leading-relaxed">Ask questions in plain English. "Show me ROAS by channel for last month" — instant answer, no SQL, no data team request.</p>
                    </div>
                    <div class="bg-white p-8 rounded-xl shadow-lg border border-gray-100 hover:shadow-xl transition duration-300 hover:-translate-y-1">
                        <div class="text-3xl text-primary-blue-100 mb-4"><font-awesome icon="fas fa-cloud-arrow-up" /></div>
                        <h3 class="text-xl font-bold text-primary-blue-100 mb-2">Automatic Data Freshness</h3>
                        <p class="text-primary-blue-100/80 leading-relaxed">Scheduled refreshes mean your data is always current. No manual refresh, no stale reports, no "oh, that was last week's data" moments.</p>
                    </div>
                    <div class="bg-white p-8 rounded-xl shadow-lg border border-gray-100 hover:shadow-xl transition duration-300 hover:-translate-y-1">
                        <div class="text-3xl text-primary-blue-100 mb-4"><font-awesome icon="fas fa-file-pen" /></div>
                        <h3 class="text-xl font-bold text-primary-blue-100 mb-2">Drag-and-Drop Reports</h3>
                        <p class="text-primary-blue-100/80 leading-relaxed">Build custom reports in minutes with drag and drop. No more wrestling with pivot tables or chart configurations.</p>
                    </div>
                </div>
                <div class="flex justify-center mt-12"><div class="w-64"><combo-button label="Stop the Data Drudgery" color="primary" class="w-full h-12 shadow-lg cursor-pointer" @click="scrollToPricing" /></div></div>
            </div>
        </section>
        <section class="bg-white w-full py-20 px-6 border-t border-gray-100">
            <div class="max-w-6xl mx-auto">
                <div class="flex flex-col lg:flex-row items-center gap-12">
                    <div class="lg:w-1/2">
                        <HeroCarousel :images="[templateAIImage, aiInsights1, aiInsights2, aiInsights3]" />
                    </div>
                    <div class="lg:w-1/2">
                        <h3 class="text-3xl font-bold text-primary-blue-100 mb-4">Automate the Work That's Burning Your Team Out</h3>
                        <p class="text-gray-600 text-lg leading-relaxed mb-6">DRA's AI Data Modeler automatically detects relationships between your data sources and joins them — eliminating the manual VLOOKUPs, CSV exports, and data cleaning that consume 400 hours a year.</p>
                        <ul class="space-y-3">
                            <li class="flex items-start gap-3"><div class="w-6 h-6 bg-green-100 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5"><font-awesome icon="fas fa-check" class="text-green-600 text-xs" /></div><span class="text-gray-700">Auto-detect and join related data across sources</span></li>
                            <li class="flex items-start gap-3"><div class="w-6 h-6 bg-green-100 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5"><font-awesome icon="fas fa-check" class="text-green-600 text-xs" /></div><span class="text-gray-700">Describe what you need in plain English — no SQL</span></li>
                            <li class="flex items-start gap-3"><div class="w-6 h-6 bg-green-100 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5"><font-awesome icon="fas fa-check" class="text-green-600 text-xs" /></div><span class="text-gray-700">Dashboards that refresh automatically — never rebuild</span></li>
                        </ul>
                    </div>
                </div>
            </div>
        </section>
        <section class="bg-primary-blue-100 w-full py-16 px-6">
            <div class="max-w-5xl mx-auto text-center">
                <h2 class="text-3xl font-bold text-white mb-8">The Math Is Simple</h2>
                <div class="grid grid-cols-1 md:grid-cols-3 gap-8 mb-8">
                    <div class="bg-white/10 rounded-xl p-6 backdrop-blur-sm">
                        <div class="text-4xl font-bold text-white mb-2">400 Hrs</div>
                        <p class="text-blue-100">Lost to manual data work per team per year</p>
                    </div>
                    <div class="bg-white/10 rounded-xl p-6 backdrop-blur-sm">
                        <div class="text-4xl font-bold text-white mb-2">$30K</div>
                        <p class="text-blue-100">Wasted salary cost on data drudgery</p>
                    </div>
                    <div class="bg-white/10 rounded-xl p-6 backdrop-blur-sm">
                        <div class="text-4xl font-bold text-white mb-2">10x</div>
                        <p class="text-blue-100">More time for strategy after automation</p>
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
