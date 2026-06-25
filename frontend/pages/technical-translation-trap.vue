<script setup lang="ts">
import chatAIImage from '/assets/images/chat-ai.png';
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
    { question: 'Why are CMOs acting as IT support for dashboards?', answer: 'Because most analytics tools are built for engineers, not marketers. When dashboards break, data stops flowing, or reports don\'t render, there is no one else to fix it. The CMO becomes the de facto IT support, spending strategic time on technical troubleshooting.' },
    { question: 'What is the Technical Translation Trap?', answer: 'The Technical Translation Trap is when marketing leaders must translate between business questions and technical tools. Instead of asking "what should our strategy be?", the CMO asks "why is the SQL query failing?" or "which API key do I use?" — pure technical overhead that derails strategic thinking.' },
    { question: 'Is there a no-code alternative to GA4 for marketing analytics?', answer: 'Yes — DRA is built specifically for marketers who need GA4-level insights without GA4-level complexity. Connect sources in one click, build data models with natural language, and create dashboards with drag and drop. No code, no SQL, no data science team required.' },
    { question: 'Do I need a data scientist to use DRA?', answer: 'Absolutely not. DRA is designed for CMOs and marketing teams who want to answer their own data questions without tickets to the data team. Our AI Data Modeler lets you describe what you need in plain English — it handles the technical work.' }
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
    title: 'The Technical Translation Trap: Stop Being IT Support for Dashboards | DRA',
    meta: [
        { name: 'description', content: 'CMOs are playing IT support for broken dashboards. DRA\'s no-code platform frees marketing leaders from SQL, API keys, and data pipeline maintenance.' },
        { name: 'keywords', content: 'technical bottleneck marketing, GA4 alternative for marketing attribution, no-code marketing analytics, CMO marketing ROI reporting, AI-powered marketing dashboard, technical translation trap' },
        { name: 'robots', content: 'index, follow' },
        { property: 'og:title', content: 'The Technical Translation Trap — No-Code Marketing Analytics | DRA' },
        { property: 'og:description', content: 'CMOs are playing IT support for broken dashboards. DRA frees you from SQL, APIs, and data pipeline maintenance.' },
        { property: 'og:url', content: `${siteUrl}/technical-translation-trap` },
        { name: 'twitter:title', content: 'The Technical Translation Trap — No-Code Marketing Analytics | DRA' },
        { name: 'twitter:description', content: 'CMOs are playing IT support for broken dashboards. DRA frees you from SQL, APIs, and data pipeline maintenance.' }
    ],
    link: [{ rel: 'canonical', href: `${siteUrl}/technical-translation-trap` }]
});
</script>
<template>
    <div>
        <section class="bg-primary-blue-100 w-full relative flex flex-col items-center py-24 px-6">
            <div class="max-w-4xl mx-auto text-center">
                <h1 class="font-bold text-white text-5xl leading-tight mb-6">The Technical Translation Trap<br><span class="text-transparent bg-clip-text bg-gradient-to-r from-blue-200 to-white">You're a CMO, Not IT Support</span></h1>
                <p class="text-xl text-blue-100 max-w-2xl mx-auto mb-8 leading-relaxed">Dashboards break. API keys expire. SQL queries fail. And the CMO is the only one who can fix it. You were hired to drive strategy, not debug data pipelines. DRA breaks the cycle.</p>
                <div class="w-64 mx-auto"><combo-button label="Stop Playing IT Support" color="white" class="w-full h-14 text-lg shadow-xl hover:scale-105 transition-transform cursor-pointer" @click="scrollToPricing" /></div>
            </div>
        </section>
        <section class="bg-white w-full py-16 px-6">
            <div class="max-w-7xl mx-auto">
                <h2 class="font-bold text-primary-blue-100 text-center text-4xl mb-4">The Technical Translation Trap</h2>
                <p class="text-gray-500 text-center text-lg mb-12 max-w-2xl mx-auto">Three ways technical overhead steals your strategic time — and how DRA fixes each.</p>
                <div class="grid grid-cols-1 md:grid-cols-3 gap-8">
                    <div class="bg-white p-8 rounded-xl shadow-lg border border-gray-100 hover:-translate-y-2 hover:shadow-xl transition duration-300">
                        <div class="w-14 h-14 bg-teal-50 rounded-full flex items-center justify-center mb-5 text-teal-500 text-2xl"><font-awesome icon="fas fa-headset" /></div>
                        <h3 class="font-bold text-xl text-primary-blue-100 mb-3">Dashboard as Help Desk</h3>
                        <p class="text-gray-600 leading-relaxed">When a dashboard breaks, the team doesn't call IT — they call the CMO. You're troubleshooting SQL queries and data connections instead of planning the next quarter's strategy.</p>
                    </div>
                    <div class="bg-white p-8 rounded-xl shadow-lg border border-gray-100 hover:-translate-y-2 hover:shadow-xl transition duration-300">
                        <div class="w-14 h-14 bg-teal-50 rounded-full flex items-center justify-center mb-5 text-teal-500 text-2xl"><font-awesome icon="fas fa-code" /></div>
                        <h3 class="font-bold text-xl text-primary-blue-100 mb-3">The SQL Tax</h3>
                        <p class="text-gray-600 leading-relaxed">Every new question requires a new SQL query. Every query needs a data engineer. Every ticket takes 3 days. By the time you get the answer, the question has changed. DRA eliminates the SQL bottleneck.</p>
                    </div>
                    <div class="bg-white p-8 rounded-xl shadow-lg border border-gray-100 hover:-translate-y-2 hover:shadow-xl transition duration-300">
                        <div class="w-14 h-14 bg-teal-50 rounded-full flex items-center justify-center mb-5 text-teal-500 text-2xl"><font-awesome icon="fas fa-screwdriver-wrench" /></div>
                        <h3 class="font-bold text-xl text-primary-blue-100 mb-3">Tool Configuration Overhead</h3>
                        <p class="text-gray-600 leading-relaxed">Setting up GA4 properties, configuring API integrations, managing OAuth tokens, maintaining custom dimensions — this is not marketing strategy. Yet CMOs spend hours on it every week.</p>
                    </div>
                </div>
            </div>
        </section>
        <section class="bg-gray-50 w-full py-16 px-6">
            <div class="max-w-7xl mx-auto">
                <h2 class="font-bold text-primary-blue-100 text-center text-4xl mb-4">How DRA Eliminates the Technical Overhead</h2>
                <p class="text-gray-500 text-center text-lg mb-12 max-w-2xl mx-auto">Built for marketers. No code required.</p>
                <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
                    <div class="bg-white p-8 rounded-xl shadow-lg border border-gray-100 hover:shadow-xl transition duration-300 hover:-translate-y-1">
                        <div class="text-3xl text-primary-blue-100 mb-4"><font-awesome icon="fas fa-plug" /></div>
                        <h3 class="text-xl font-bold text-primary-blue-100 mb-2">One-Click Integrations</h3>
                        <p class="text-primary-blue-100/80 leading-relaxed">Connect Google Ads, GA4, LinkedIn, Meta, SQL, CSV, Excel, and PDF with OAuth. No API keys to manage, no tokens to refresh, no documentation to read.</p>
                    </div>
                    <div class="bg-white p-8 rounded-xl shadow-lg border border-gray-100 hover:shadow-xl transition duration-300 hover:-translate-y-1">
                        <div class="text-3xl text-primary-blue-100 mb-4"><font-awesome icon="fas fa-brain" /></div>
                        <h3 class="text-xl font-bold text-primary-blue-100 mb-2">AI Data Modeler</h3>
                        <p class="text-primary-blue-100/80 leading-relaxed">Describe the insight you need in plain English. "Show me ROAS by channel compared to last month" — DRA builds the data model and dashboard automatically.</p>
                    </div>
                    <div class="bg-white p-8 rounded-xl shadow-lg border border-gray-100 hover:shadow-xl transition duration-300 hover:-translate-y-1">
                        <div class="text-3xl text-primary-blue-100 mb-4"><font-awesome icon="fas fa-file-pen" /></div>
                        <h3 class="text-xl font-bold text-primary-blue-100 mb-2">Drag-and-Drop Dashboards</h3>
                        <p class="text-primary-blue-100/80 leading-relaxed">Build interactive dashboards by dragging components onto a canvas. No HTML, no CSS, no JavaScript — just point, click, and publish.</p>
                    </div>
                    <div class="bg-white p-8 rounded-xl shadow-lg border border-gray-100 hover:shadow-xl transition duration-300 hover:-translate-y-1">
                        <div class="text-3xl text-primary-blue-100 mb-4"><font-awesome icon="fas fa-robot" /></div>
                        <h3 class="text-xl font-bold text-primary-blue-100 mb-2">Natural Language AI</h3>
                        <p class="text-primary-blue-100/80 leading-relaxed">Ask questions directly. "Why did LinkedIn CPL spike last week?" Get an instant answer with supporting data. No query, no ticket, no wait.</p>
                    </div>
                    <div class="bg-white p-8 rounded-xl shadow-lg border border-gray-100 hover:shadow-xl transition duration-300 hover:-translate-y-1">
                        <div class="text-3xl text-primary-blue-100 mb-4"><font-awesome icon="fas fa-gauge-high" /></div>
                        <h3 class="text-xl font-bold text-primary-blue-100 mb-2">Self-Healing Connections</h3>
                        <p class="text-primary-blue-100/80 leading-relaxed">If a data source disconnects, DRA alerts you and provides one-click reconnection. No more detective work finding why your dashboard went blank.</p>
                    </div>
                    <div class="bg-white p-8 rounded-xl shadow-lg border border-gray-100 hover:shadow-xl transition duration-300 hover:-translate-y-1">
                        <div class="text-3xl text-primary-blue-100 mb-4"><font-awesome icon="fas fa-shield" /></div>
                        <h3 class="text-xl font-bold text-primary-blue-100 mb-2">Built for Marketers</h3>
                        <p class="text-primary-blue-100/80 leading-relaxed">Every feature in DRA is designed for marketing executives. No engineering background required. Your data team can focus on real problems while you own your analytics.</p>
                    </div>
                </div>
                <div class="flex justify-center mt-12"><div class="w-64"><combo-button label="Escape the Trap" color="primary" class="w-full h-12 shadow-lg cursor-pointer" @click="scrollToPricing" /></div></div>
            </div>
        </section>
        <section class="bg-white w-full py-20 px-6 border-t border-gray-100">
            <div class="max-w-6xl mx-auto">
                <div class="flex flex-col lg:flex-row items-center gap-12">
                    <div class="lg:w-1/2">
                        <HeroCarousel :images="[chatAIImage, aiInsights1, aiInsights2, aiInsights3]" />
                    </div>
                    <div class="lg:w-1/2">
                        <h3 class="text-3xl font-bold text-primary-blue-100 mb-4">Talk to Your Data — No SQL, No Tickets, No Waiting</h3>
                        <p class="text-gray-600 text-lg leading-relaxed mb-6">DRA's AI Data Analyst answers your questions in plain English. Ask "Why did conversions drop last week?" and get an instant answer with supporting data. No data team ticket, no SQL query, no wait.</p>
                        <ul class="space-y-3">
                            <li class="flex items-start gap-3"><div class="w-6 h-6 bg-green-100 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5"><font-awesome icon="fas fa-check" class="text-green-600 text-xs" /></div><span class="text-gray-700">Natural language questions — instant AI-powered answers</span></li>
                            <li class="flex items-start gap-3"><div class="w-6 h-6 bg-green-100 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5"><font-awesome icon="fas fa-check" class="text-green-600 text-xs" /></div><span class="text-gray-700">No-code data model builder for custom reports</span></li>
                            <li class="flex items-start gap-3"><div class="w-6 h-6 bg-green-100 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5"><font-awesome icon="fas fa-check" class="text-green-600 text-xs" /></div><span class="text-gray-700">Self-healing connections — no more broken dashboards</span></li>
                        </ul>
                    </div>
                </div>
            </div>
        </section>
        <section class="bg-primary-blue-100 w-full py-16 px-6">
            <div class="max-w-5xl mx-auto text-center">
                <h2 class="text-3xl font-bold text-white mb-8">The Technical Tax</h2>
                <div class="grid grid-cols-1 md:grid-cols-3 gap-8 mb-8">
                    <div class="bg-white/10 rounded-xl p-6 backdrop-blur-sm">
                        <div class="text-4xl font-bold text-white mb-2">10 Hrs/Wk</div>
                        <p class="text-blue-100">CMOs spend on technical troubleshooting</p>
                    </div>
                    <div class="bg-white/10 rounded-xl p-6 backdrop-blur-sm">
                        <div class="text-4xl font-bold text-white mb-2">3 Days</div>
                        <p class="text-blue-100">Average wait for a data team SQL query</p>
                    </div>
                    <div class="bg-white/10 rounded-xl p-6 backdrop-blur-sm">
                        <div class="text-4xl font-bold text-white mb-2">0 Lines</div>
                        <p class="text-blue-100">Of code needed to use DRA</p>
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
