<script setup lang="ts">
import templateAIImage from '/assets/images/template-ai.png';
import chatAIImage from '/assets/images/chat-ai.png';
import aiInsights1 from '/assets/images/ai-insights-1.png';
import aiInsights2 from '/assets/images/ai-insights-2.png';
import aiInsights3 from '/assets/images/ai-insights-3.png';
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
    { question: 'What causes marketing team burnout?', answer: 'Most people assume burnout is caused by workload. In marketing analytics, it\'s caused by data drudgery — the soul-crushing repetition of manual exports, VLOOKUPs, data cleaning, and broken dashboard fixes that consume 80% of your team\'s time instead of strategic work.' },
    { question: 'How does data drudgery lead to talent loss?', answer: 'Your best people did not join marketing to become spreadsheet operators. When their days are filled with manual data work instead of strategic optimization, campaign planning, and creative thinking — they leave. DRA automates the drudgery so your talent can do the work they were hired for.' },
    { question: 'Can marketing automation reduce team burnout?', answer: 'Yes. DRA automates the specific tasks that cause the most frustration: data extraction, joining, cleaning, and reporting. By eliminating these repetitive tasks, your team reclaims hundreds of hours for meaningful strategic work that engages and retains talent.' },
    { question: 'How do I convince my leadership to invest in tools that prevent burnout?', answer: 'Frame it as a retention and productivity investment. 400 hours of manual data work per year, combined with the cost of replacing a burned-out marketing hire (150-200% of annual salary), makes automation a clear ROI. DRA pays for itself by keeping your best people engaged and productive.' }
];

onMounted(() => {
    if (import.meta.client) {
        injectMultipleSchemas([
            getOrganizationSchema(),
            getSoftwareApplicationSchema(),
            getFAQSchema(faqData),
            getBreadcrumbSchema([{ name: 'Home', url: siteUrl }, { name: 'The Exhaustion Wall', url: `${siteUrl}/exhaustion-wall` }])
        ]);
    }
});

useHead({
    title: 'The Exhaustion Wall: Marketing Burnout Caused by Data Drudgery | DRA',
    meta: [
        { name: 'description', content: 'Talent burnout in marketing is caused by data drudgery, not workload. DRA automates manual data work so your best people love their jobs again.' },
        { name: 'keywords', content: 'data drudgery, CMO marketing ROI reporting, invisible drain, marketing team burnout, marketing talent retention, marketing automation, marketing budget justification' },
        { name: 'robots', content: 'index, follow' },
        { property: 'og:title', content: 'The Exhaustion Wall — Marketing Burnout Caused by Data Drudgery | DRA' },
        { property: 'og:description', content: 'Talent burnout is caused by data drudgery, not workload. DRA automates manual data work so your best people stay.' },
        { property: 'og:url', content: `${siteUrl}/exhaustion-wall` },
        { name: 'twitter:title', content: 'The Exhaustion Wall — Marketing Burnout Caused by Data Drudgery | DRA' },
        { name: 'twitter:description', content: 'Talent burnout is caused by data drudgery, not workload. DRA automates manual data work so your best people stay.' }
    ],
    link: [{ rel: 'canonical', href: `${siteUrl}/exhaustion-wall` }]
});
</script>
<template>
    <div>
        <section class="bg-primary-blue-100 w-full relative flex flex-col items-center py-24 px-6">
            <div class="max-w-4xl mx-auto text-center">
                <h1 class="font-bold text-white text-5xl leading-tight mb-6">The Exhaustion Wall<br><span class="text-transparent bg-clip-text bg-gradient-to-r from-blue-200 to-white">Burnout Isn't the Workload — It's the Drudgery</span></h1>
                <p class="text-xl text-blue-100 max-w-2xl mx-auto mb-8 leading-relaxed">Your best people aren't leaving because they have too much work. They're leaving because they spend 80% of their time on manual data tasks instead of the strategic work they were hired to do. DRA stops the drain.</p>
                <div class="w-64 mx-auto"><combo-button label="Protect Your Team" color="white" class="w-full h-14 text-lg shadow-xl hover:scale-105 transition-transform cursor-pointer" @click="scrollToPricing" /></div>
            </div>
        </section>
        <section class="bg-white w-full py-16 px-6">
            <div class="max-w-7xl mx-auto">
                <h2 class="font-bold text-primary-blue-100 text-center text-4xl mb-4">The Exhaustion Wall</h2>
                <p class="text-gray-500 text-center text-lg mb-12 max-w-2xl mx-auto">Three ways data drudgery destroys your team — and how DRA fixes each.</p>
                <div class="grid grid-cols-1 md:grid-cols-3 gap-8">
                    <div class="bg-white p-8 rounded-xl shadow-lg border border-gray-100 hover:-translate-y-2 hover:shadow-xl transition duration-300">
                        <div class="w-14 h-14 bg-rose-50 rounded-full flex items-center justify-center mb-5 text-rose-500 text-2xl"><font-awesome icon="fas fa-bolt" /></div>
                        <h3 class="font-bold text-xl text-primary-blue-100 mb-3">Talent Flight Risk</h3>
                        <p class="text-gray-600 leading-relaxed">Your best marketers didn't learn their craft to become spreadsheet operators. When every day is data entry, VLOOKUPs, and broken dashboards, they leave for companies where they can actually do strategy.</p>
                    </div>
                    <div class="bg-white p-8 rounded-xl shadow-lg border border-gray-100 hover:-translate-y-2 hover:shadow-xl transition duration-300">
                        <div class="w-14 h-14 bg-rose-50 rounded-full flex items-center justify-center mb-5 text-rose-500 text-2xl"><font-awesome icon="fas fa-repeat" /></div>
                        <h3 class="font-bold text-xl text-primary-blue-100 mb-3">Repetitive Task Burnout</h3>
                        <p class="text-gray-600 leading-relaxed">Doing the same manual data tasks every week — exporting, formatting, matching, fixing — wears down even the most motivated team members. The repetition, not the volume, is what breaks them.</p>
                    </div>
                    <div class="bg-white p-8 rounded-xl shadow-lg border border-gray-100 hover:-translate-y-2 hover:shadow-xl transition duration-300">
                        <div class="w-14 h-14 bg-rose-50 rounded-full flex items-center justify-center mb-5 text-rose-500 text-2xl"><font-awesome icon="fas fa-chart-line" /></div>
                        <h3 class="font-bold text-xl text-primary-blue-100 mb-3">Lost Strategic Capacity</h3>
                        <p class="text-gray-600 leading-relaxed">Every hour spent on data drudgery is an hour not spent on campaign optimization, audience analysis, creative testing, and strategic planning. Your team's potential is buried under spreadsheets.</p>
                    </div>
                </div>
            </div>
        </section>
        <section class="bg-gray-50 w-full py-16 px-6">
            <div class="max-w-7xl mx-auto">
                <h2 class="font-bold text-primary-blue-100 text-center text-4xl mb-4">How DRA Turns Drudgery Into Strategy</h2>
                <p class="text-gray-500 text-center text-lg mb-12 max-w-2xl mx-auto">Automate the boring work. Unleash your team's potential.</p>
                <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
                    <div class="bg-white p-8 rounded-xl shadow-lg border border-gray-100 hover:shadow-xl transition duration-300 hover:-translate-y-1">
                        <div class="text-3xl text-primary-blue-100 mb-4"><font-awesome icon="fas fa-robot" /></div>
                        <h3 class="text-xl font-bold text-primary-blue-100 mb-2">Automate Data Collection</h3>
                        <p class="text-primary-blue-100/80 leading-relaxed">DRA connects to every source automatically. No more Monday morning CSV exports. No more manual data pulls. The data is just there.</p>
                    </div>
                    <div class="bg-white p-8 rounded-xl shadow-lg border border-gray-100 hover:shadow-xl transition duration-300 hover:-translate-y-1">
                        <div class="text-3xl text-primary-blue-100 mb-4"><font-awesome icon="fas fa-brain" /></div>
                        <h3 class="text-xl font-bold text-primary-blue-100 mb-2">AI Data Joining</h3>
                        <p class="text-primary-blue-100/80 leading-relaxed">DRA's AI Data Modeler automatically joins data across sources. No VLOOKUPs, no manual matching, no fragile spreadsheets. Your team can focus on insights, not infrastructure.</p>
                    </div>
                    <div class="bg-white p-8 rounded-xl shadow-lg border border-gray-100 hover:shadow-xl transition duration-300 hover:-translate-y-1">
                        <div class="text-3xl text-primary-blue-100 mb-4"><font-awesome icon="fas fa-gauge-high" /></div>
                        <h3 class="text-xl font-bold text-primary-blue-100 mb-2">Auto-Refreshing Reports</h3>
                        <p class="text-primary-blue-100/80 leading-relaxed">Reports update themselves. Your team never has to rebuild a dashboard or re-run a query. Set it once and it stays current forever.</p>
                    </div>
                    <div class="bg-white p-8 rounded-xl shadow-lg border border-gray-100 hover:shadow-xl transition duration-300 hover:-translate-y-1">
                        <div class="text-3xl text-primary-blue-100 mb-4"><font-awesome icon="fas fa-file-pen" /></div>
                        <h3 class="text-xl font-bold text-primary-blue-100 mb-2">Self-Serve Analytics</h3>
                        <p class="text-primary-blue-100/80 leading-relaxed">Team members can answer their own data questions using natural language. No tickets, no waiting, no interrupting the person who "knows the data."</p>
                    </div>
                    <div class="bg-white p-8 rounded-xl shadow-lg border border-gray-100 hover:shadow-xl transition duration-300 hover:-translate-y-1">
                        <div class="text-3xl text-primary-blue-100 mb-4"><font-awesome icon="fas fa-users" /></div>
                        <h3 class="text-xl font-bold text-primary-blue-100 mb-2">Team Collaboration</h3>
                        <p class="text-primary-blue-100/80 leading-relaxed">Share dashboards, reports, and insights across the team. Everyone works from the same truth layer — no more "whose spreadsheet is the right one?"</p>
                    </div>
                    <div class="bg-white p-8 rounded-xl shadow-lg border border-gray-100 hover:shadow-xl transition duration-300 hover:-translate-y-1">
                        <div class="text-3xl text-primary-blue-100 mb-4"><font-awesome icon="fas fa-heart" /></div>
                        <h3 class="text-xl font-bold text-primary-blue-100 mb-2">Work They Love</h3>
                        <p class="text-primary-blue-100/80 leading-relaxed">When your team stops wrestling with data and starts using it, they remember why they joined marketing. Strategy, creativity, impact — not spreadsheets.</p>
                    </div>
                </div>
                <div class="flex justify-center mt-12"><div class="w-64"><combo-button label="Protect Your Talent" color="primary" class="w-full h-12 shadow-lg cursor-pointer" @click="scrollToPricing" /></div></div>
            </div>
        </section>
        <section class="bg-white w-full py-20 px-6 border-t border-gray-100">
            <div class="max-w-6xl mx-auto">
                <div class="flex flex-col lg:flex-row items-center gap-12">
                    <div class="lg:w-1/2">
                        <HeroCarousel :images="[templateAIImage, aiInsights1, aiInsights2, aiInsights3, chatAIImage]" />
                    </div>
                    <div class="lg:w-1/2">
                        <h3 class="text-3xl font-bold text-primary-blue-100 mb-4">Let Your Team Do Marketing, Not Spreadsheets</h3>
                        <p class="text-gray-600 text-lg leading-relaxed mb-6">DRA's drag-and-drop report builder and auto-refreshing dashboards eliminate the manual data work that causes burnout. Your team spends their time on strategy, creative, and optimization — not data entry.</p>
                        <ul class="space-y-3">
                            <li class="flex items-start gap-3"><div class="w-6 h-6 bg-green-100 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5"><font-awesome icon="fas fa-check" class="text-green-600 text-xs" /></div><span class="text-gray-700">Drag-and-drop dashboards — build in minutes, not days</span></li>
                            <li class="flex items-start gap-3"><div class="w-6 h-6 bg-green-100 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5"><font-awesome icon="fas fa-check" class="text-green-600 text-xs" /></div><span class="text-gray-700">AI-powered insights so anyone can ask data questions</span></li>
                            <li class="flex items-start gap-3"><div class="w-6 h-6 bg-green-100 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5"><font-awesome icon="fas fa-check" class="text-green-600 text-xs" /></div><span class="text-gray-700">Auto-refreshing reports — set once, never rebuild</span></li>
                        </ul>
                    </div>
                </div>
            </div>
        </section>
        <section class="bg-primary-blue-100 w-full py-16 px-6">
            <div class="max-w-5xl mx-auto text-center">
                <h2 class="text-3xl font-bold text-white mb-8">The Real Cost of Burnout</h2>
                <div class="grid grid-cols-1 md:grid-cols-3 gap-8 mb-8">
                    <div class="bg-white/10 rounded-xl p-6 backdrop-blur-sm">
                        <div class="text-4xl font-bold text-white mb-2">150%</div>
                        <p class="text-blue-100">Of salary cost to replace a burned-out hire</p>
                    </div>
                    <div class="bg-white/10 rounded-xl p-6 backdrop-blur-sm">
                        <div class="text-4xl font-bold text-white mb-2">400 Hrs</div>
                        <p class="text-blue-100">Lost annually to manual data drudgery</p>
                    </div>
                    <div class="bg-white/10 rounded-xl p-6 backdrop-blur-sm">
                        <div class="text-4xl font-bold text-white mb-2">80%</div>
                        <p class="text-blue-100">Of time spent on data work, not strategy</p>
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
