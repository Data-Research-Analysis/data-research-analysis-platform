<script setup lang="ts">
import intelligenceOverview from '/assets/images/intelligence-overview.png';
import channelComparison from '/assets/images/channel-comparison.png';
import campaignPerformance from '/assets/images/campaign-performance.png';
import budgetAllocation from '/assets/images/budget-allocation.png';
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
    { question: 'How do I prove marketing ROI when I can\'t track every touchpoint?', answer: 'Data Research Analysis solves this with multi-source data unification. Connect Google Ads, Google Analytics, SQL databases, CSV, and PDF files into one truth layer. Our AI Data Modeler automatically joins cross-source data so you can see the full customer journey — not just last-touch — without manual spreadsheet work.' },
    { question: 'What metrics do CFOs care about from marketing?', answer: 'CFOs care about CAC, LTV, payback period, ROAS, and pipeline velocity. Data Research Analysis surfaces all of these in CEO-ready dashboards that update in real time, connecting marketing spend directly to revenue outcomes so you walk into board meetings with numbers that match the bank account.' },
    { question: 'Why doesn\'t my marketing dashboard match our bank account?', answer: 'Because your current tools silo data. GA4 shows one number, Google Ads shows another, and your CRM shows a third. Data Research Analysis unifies all sources into a single Federated Query Layer so every number reconciles with your actual bank statement.' },
    { question: 'ROAS vs marketing ROI — what\'s the difference?', answer: 'ROAS (Return on Ad Spend) measures gross revenue per dollar spent on a specific ad channel. Marketing ROI measures net profit across all channels minus total marketing costs. Data Research Analysis calculates both automatically so you never confuse campaign efficiency with total business impact.' }
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
    title: 'Prove Marketing ROI: Connect Your Spend to Revenue | Data Research Analysis',
    meta: [
        { name: 'description', content: 'Stop guessing. Prove marketing ROI with DRA\'s unified analytics platform. Connect Google Ads, GA4, SQL, and CRM data to show exactly how every dollar drives revenue.' },
        { name: 'keywords', content: 'prove marketing ROI, connect marketing spend to revenue, marketing ROI measurement, how to prove marketing ROI to CEO, marketing ROI dashboard, marketing attribution tool' },
        { name: 'robots', content: 'index, follow' },
        { property: 'og:title', content: 'Prove Marketing ROI — Connect Spend to Revenue | DRA' },
        { property: 'og:description', content: 'Stop guessing. Prove marketing ROI with DRA. Unify Google Ads, GA4, SQL, and CRM data. Walk into board meetings with numbers that match the bank account.' },
        { property: 'og:url', content: `${siteUrl}/prove-marketing-roi` },
        { name: 'twitter:title', content: 'Prove Marketing ROI — Connect Spend to Revenue | DRA' },
        { name: 'twitter:description', content: 'Stop guessing. Prove marketing ROI with DRA. Unify Google Ads, GA4, SQL, and CRM data.' }
    ],
    link: [{ rel: 'canonical', href: `${siteUrl}/prove-marketing-roi` }]
});
</script>
<template>
    <div>
        <section class="bg-primary-blue-100 w-full relative flex flex-col items-center py-24 px-6">
            <div class="max-w-4xl mx-auto text-center">
                <h1 class="font-bold text-white text-5xl leading-tight mb-6">Prove Marketing ROI<br><span class="text-transparent bg-clip-text bg-gradient-to-r from-blue-200 to-white">Without a Data Science Team</span></h1>
                <p class="text-xl text-blue-100 max-w-2xl mx-auto mb-8 leading-relaxed">Marketers cannot connect spend to revenue because the infrastructure is missing. DRA is that infrastructure — unifying every data source into one truth layer so you can finally prove what works.</p>
                <div class="w-64 mx-auto"><combo-button label="Start Proving ROI" color="white" class="w-full h-14 text-lg shadow-xl hover:scale-105 transition-transform cursor-pointer" @click="scrollToPricing" /></div>
            </div>
        </section>
        <section class="bg-white w-full py-16 px-6">
            <div class="max-w-7xl mx-auto">
                <h2 class="font-bold text-primary-blue-100 text-center text-4xl mb-4">The ROI Proof Gap</h2>
                <p class="text-gray-500 text-center text-lg mb-12 max-w-2xl mx-auto">Three reasons your current stack can't prove ROI — and how DRA fixes each one.</p>
                <div class="grid grid-cols-1 md:grid-cols-3 gap-8">
                    <div class="bg-white p-8 rounded-xl shadow-lg border border-gray-100 hover:-translate-y-2 hover:shadow-xl transition duration-300">
                        <div class="w-14 h-14 bg-red-50 rounded-full flex items-center justify-center mb-5 text-red-500 text-2xl"><font-awesome icon="fas fa-chart-pie" /></div>
                        <h3 class="font-bold text-xl text-primary-blue-100 mb-3">Siloed Data Sources</h3>
                        <p class="text-gray-600 leading-relaxed">Your spend data lives in Google Ads. Your conversion data lives in GA4. Your revenue data lives in your CRM. Without a unified layer, ROI is a guess wrapped in a spreadsheet.</p>
                    </div>
                    <div class="bg-white p-8 rounded-xl shadow-lg border border-gray-100 hover:-translate-y-2 hover:shadow-xl transition duration-300">
                        <div class="w-14 h-14 bg-red-50 rounded-full flex items-center justify-center mb-5 text-red-500 text-2xl"><font-awesome icon="fas fa-clock" /></div>
                        <h3 class="font-bold text-xl text-primary-blue-100 mb-3">48-Hour Reporting Lag</h3>
                        <p class="text-gray-600 leading-relaxed">By the time your legacy tools produce a report, the data is stale. You're making decisions on yesterday's news while competitors pivot on real-time signals.</p>
                    </div>
                    <div class="bg-white p-8 rounded-xl shadow-lg border border-gray-100 hover:-translate-y-2 hover:shadow-xl transition duration-300">
                        <div class="w-14 h-14 bg-red-50 rounded-full flex items-center justify-center mb-5 text-red-500 text-2xl"><font-awesome icon="fas fa-handshake" /></div>
                        <h3 class="font-bold text-xl text-primary-blue-100 mb-3">Broken Executive Trust</h3>
                        <p class="text-gray-600 leading-relaxed">Your dashboard shows green arrows. Your bank account shows red ink. The CEO notices. Trust erodes fast when the numbers don't reconcile.</p>
                    </div>
                </div>
            </div>
        </section>
        <section class="bg-gray-50 w-full py-16 px-6">
            <div class="max-w-7xl mx-auto">
                <h2 class="font-bold text-primary-blue-100 text-center text-4xl mb-4">How DRA Proves Marketing ROI</h2>
                <p class="text-gray-500 text-center text-lg mb-12 max-w-2xl mx-auto">One platform. Every source. Real-time answers.</p>
                <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
                    <div class="bg-white p-8 rounded-xl shadow-lg border border-gray-100 hover:shadow-xl transition duration-300 hover:-translate-y-1">
                        <div class="text-3xl text-primary-blue-100 mb-4"><font-awesome icon="fas fa-layer-group" /></div>
                        <h3 class="text-xl font-bold text-primary-blue-100 mb-2">Unified Truth Layer</h3>
                        <p class="text-primary-blue-100/80 leading-relaxed">Connect Google Ads, GA4, SQL, CSV, Excel, and PDFs into one federated query layer. Every source, every metric, one place.</p>
                    </div>
                    <div class="bg-white p-8 rounded-xl shadow-lg border border-gray-100 hover:shadow-xl transition duration-300 hover:-translate-y-1">
                        <div class="text-3xl text-primary-blue-100 mb-4"><font-awesome icon="fas fa-brain" /></div>
                        <h3 class="text-xl font-bold text-primary-blue-100 mb-2">AI Data Modeler</h3>
                        <p class="text-primary-blue-100/80 leading-relaxed">Describe the insight you need in plain English. Our AI builds the data model automatically — no SQL, no data science team required.</p>
                    </div>
                    <div class="bg-white p-8 rounded-xl shadow-lg border border-gray-100 hover:shadow-xl transition duration-300 hover:-translate-y-1">
                        <div class="text-3xl text-primary-blue-100 mb-4"><font-awesome icon="fas fa-gauge-high" /></div>
                        <h3 class="text-xl font-bold text-primary-blue-100 mb-2">Real-Time Dashboards</h3>
                        <p class="text-primary-blue-100/80 leading-relaxed">Monitor campaign performance, ROAS, CAC, and LTV in dashboards that update as your data changes. No more 48-hour lag.</p>
                    </div>
                    <div class="bg-white p-8 rounded-xl shadow-lg border border-gray-100 hover:shadow-xl transition duration-300 hover:-translate-y-1">
                        <div class="text-3xl text-primary-blue-100 mb-4"><font-awesome icon="fas fa-file-invoice" /></div>
                        <h3 class="text-xl font-bold text-primary-blue-100 mb-2">CEO-Ready Reports</h3>
                        <p class="text-primary-blue-100/80 leading-relaxed">Export board-ready reports that reconcile spend to revenue. Walk into every meeting with numbers the CFO can't argue with.</p>
                    </div>
                    <div class="bg-white p-8 rounded-xl shadow-lg border border-gray-100 hover:shadow-xl transition duration-300 hover:-translate-y-1">
                        <div class="text-3xl text-primary-blue-100 mb-4"><font-awesome icon="fas fa-robot" /></div>
                        <h3 class="text-xl font-bold text-primary-blue-100 mb-2">AI-Powered Insights</h3>
                        <p class="text-primary-blue-100/80 leading-relaxed">Ask your data questions in natural language. "Why did conversions drop last week?" — get instant answers with supporting data.</p>
                    </div>
                    <div class="bg-white p-8 rounded-xl shadow-lg border border-gray-100 hover:shadow-xl transition duration-300 hover:-translate-y-1">
                        <div class="text-3xl text-primary-blue-100 mb-4"><font-awesome icon="fas fa-plug" /></div>
                        <h3 class="text-xl font-bold text-primary-blue-100 mb-2">No-Code Setup</h3>
                        <p class="text-primary-blue-100/80 leading-relaxed">Connect sources in one click. Build dashboards with drag and drop. Skip the SQL boot camp and expensive certifications.</p>
                    </div>
                </div>
                <div class="flex justify-center mt-12"><div class="w-64"><combo-button label="Prove Your ROI Now" color="primary" class="w-full h-12 shadow-lg cursor-pointer" @click="scrollToPricing" /></div></div>
            </div>
        </section>
        <section class="bg-white w-full py-20 px-6 border-t border-gray-100">
            <div class="max-w-6xl mx-auto">
                <div class="flex flex-col lg:flex-row items-center gap-12">
                    <div class="lg:w-1/2">
                        <HeroCarousel :images="[intelligenceOverview, channelComparison, campaignPerformance, budgetAllocation]" />
                    </div>
                    <div class="lg:w-1/2">
                        <h3 class="text-3xl font-bold text-primary-blue-100 mb-4">See Every Dollar from Spend to Revenue</h3>
                        <p class="text-gray-600 text-lg leading-relaxed mb-6">DRA's unified dashboard shows your Google Ads spend, GA4 conversions, CRM revenue, and ROAS in one view — updated in real time. No more toggling between 5 tools to answer "what worked?"</p>
                        <ul class="space-y-3">
                            <li class="flex items-start gap-3"><div class="w-6 h-6 bg-green-100 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5"><font-awesome icon="fas fa-check" class="text-green-600 text-xs" /></div><span class="text-gray-700">Cross-channel ROAS side by side</span></li>
                            <li class="flex items-start gap-3"><div class="w-6 h-6 bg-green-100 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5"><font-awesome icon="fas fa-check" class="text-green-600 text-xs" /></div><span class="text-gray-700">Spend vs. revenue reconciliation in real time</span></li>
                            <li class="flex items-start gap-3"><div class="w-6 h-6 bg-green-100 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5"><font-awesome icon="fas fa-check" class="text-green-600 text-xs" /></div><span class="text-gray-700">CEO-ready export with numbers that match the bank</span></li>
                        </ul>
                    </div>
                </div>
            </div>
        </section>
        <section class="bg-primary-blue-100 w-full py-16 px-6">
            <div class="max-w-5xl mx-auto text-center">
                <h2 class="text-3xl font-bold text-white mb-8">The Cost of Not Proving ROI</h2>
                <div class="grid grid-cols-1 md:grid-cols-3 gap-8 mb-8">
                    <div class="bg-white/10 rounded-xl p-6 backdrop-blur-sm">
                        <div class="text-4xl font-bold text-white mb-2">$12B+</div>
                        <p class="text-blue-100">Wasted on unmeasurable marketing channels annually</p>
                    </div>
                    <div class="bg-white/10 rounded-xl p-6 backdrop-blur-sm">
                        <div class="text-4xl font-bold text-white mb-2">68%</div>
                        <p class="text-blue-100">Of CMOs can't prove marketing's impact on revenue</p>
                    </div>
                    <div class="bg-white/10 rounded-xl p-6 backdrop-blur-sm">
                        <div class="text-4xl font-bold text-white mb-2">48hr</div>
                        <p class="text-blue-100">Average reporting delay with legacy tools</p>
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
