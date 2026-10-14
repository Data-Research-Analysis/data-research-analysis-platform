<script setup lang="ts">
import intelligenceOverview from '/assets/images/intelligence-overview.png';
import channelComparison from '/assets/images/channel-comparison.png';
import campaignPerformance from '/assets/images/campaign-performance.png';
import budgetAllocation from '/assets/images/budget-allocation.png';
const config = useRuntimeConfig();
const siteUrl = config.public.siteUrl || 'https://www.dataresearchanalysis.com';
const { getSoftwareApplicationSchema, getFAQSchema, injectMultipleSchemas } = useStructuredData();

const scrollToPricing = () => {
    if (import.meta.client) {
        const el = document.getElementById('pricing');
        if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
};

const startFree = () => {
    if (import.meta.client) {
        window.location.href = '/register?plan=free&cycle=monthly';
    }
};

const faqData = [
    { question: 'What is strategic velocity in marketing?', answer: 'Strategic velocity is the speed at which a marketing organization can access data, derive insights, make decisions, and reallocate budget. Most teams operate on a 48-hour lag. DRA delivers real-time data so you can pivot budget the moment a channel underperforms.' },
    { question: 'How does report lag hurt marketing performance?', answer: 'When reports take 2-3 days to generate, you are optimizing yesterday\'s campaigns. In a competitive market, that delay means competitors with real-time data outmaneuver you. DRA eliminates report lag with live-connected dashboards.' },
    { question: 'Can I get real-time marketing data without a multi-million dollar setup?', answer: 'Yes. DRA connects your existing data sources in minutes — no engineering team required. Real-time dashboards update as your data changes, giving you strategic velocity without the infrastructure cost.' },
    { question: 'How fast can I pivot budget with DRA?', answer: 'Instantly. See which channels are over- or under-performing in real time. Reallocate budget on the fly and see the impact reflected in your dashboards immediately — not 48 hours later.' }
];

// Inject structured data during setup so it is present in SSR HTML.
injectMultipleSchemas([
    getSoftwareApplicationSchema(),
    getFAQSchema(faqData),
]);

useHead({
    title: 'Strategic Velocity: Real-Time Marketing Analytics at the Speed of Now | DRA',
    meta: [
        { name: 'description', content: 'Break free from 48-hour report lag. DRA delivers real-time marketing analytics so you can pivot budget, optimize campaigns, and outmaneuver competitors instantly.' },
        { name: 'robots', content: 'index, follow' },
        { property: 'og:title', content: 'Strategic Velocity — Real-Time Marketing Analytics | DRA' },
        { property: 'og:description', content: 'Break free from 48-hour report lag. Real-time marketing analytics that let you pivot budget instantly.' },
        { property: 'og:url', content: `${siteUrl}/strategic-velocity` },
        { name: 'twitter:title', content: 'Strategic Velocity — Real-Time Marketing Analytics | DRA' },
        { name: 'twitter:description', content: 'Break free from 48-hour report lag. Real-time marketing analytics that let you pivot budget instantly.' }
    ],
    link: [{ rel: 'canonical', href: `${siteUrl}/strategic-velocity` }]
});
</script>
<template>
    <div>
        <payoff-block
            eyebrow="The Strategic Velocity Gap"
            headline="Your dashboard is 48 hours old. Your competitor's decision is not."
            sub="Decisions in minutes, not days. Capture revenue while competitors are still waiting on a report."
            :stats="[
                { text: 'GA4 takes 24 to 48 hours to process data.', tag: 'Research' },
                { text: 'Attribution credit can change for up to 12 days after an event is recorded.', tag: 'Research' },
                { text: 'More than two-thirds of marketers estimate at least 11% of media budgets are lost to optimization lag.', tag: 'Research' }
            ]"
            roi-strip="Every day of lag is a day of lost revenue."
            :bullets="[
                'Near-real-time sync across every connected source.',
                'Scheduled refreshes so the number is current when you need it.'
            ]"
            cta-label="Move at the speed of your strategy. Start free."
            :cta-action="startFree"
        />
        <section class="bg-white w-full py-16 px-6">
            <div class="max-w-7xl mx-auto">
                <h2 class="font-bold text-primary-blue-100 text-center text-4xl mb-4">The Strategic Velocity Gap</h2>
                <p class="text-gray-500 text-center text-lg mb-12 max-w-2xl mx-auto">Three ways report lag kills your competitive edge — and how DRA eliminates each one.</p>
                <div class="grid grid-cols-1 md:grid-cols-3 gap-8">
                    <div class="bg-white p-8 rounded-xl shadow-lg border border-gray-100 hover:-translate-y-2 hover:shadow-xl transition duration-300">
                        <div class="w-14 h-14 bg-purple-50 rounded-full flex items-center justify-center mb-5 text-purple-500 text-2xl"><font-awesome icon="fas fa-gauge-high" /></div>
                        <h3 class="font-bold text-xl text-primary-blue-100 mb-3">48-Hour Blind Spot</h3>
                        <p class="text-gray-600 leading-relaxed">Every report you run shows data from two days ago. In those 48 hours, your competitors spotted the trend, reallocated budget, and captured the market. You're always late.</p>
                    </div>
                    <div class="bg-white p-8 rounded-xl shadow-lg border border-gray-100 hover:-translate-y-2 hover:shadow-xl transition duration-300">
                        <div class="w-14 h-14 bg-purple-50 rounded-full flex items-center justify-center mb-5 text-purple-500 text-2xl"><font-awesome icon="fas fa-arrows-spin" /></div>
                        <h3 class="font-bold text-xl text-primary-blue-100 mb-3">Manual Budget Pivots</h3>
                        <p class="text-gray-600 leading-relaxed">Adjusting budget across channels requires exporting, manipulating, and re-uploading spreadsheets. By the time you execute, the opportunity is gone.</p>
                    </div>
                    <div class="bg-white p-8 rounded-xl shadow-lg border border-gray-100 hover:-translate-y-2 hover:shadow-xl transition duration-300">
                        <div class="w-14 h-14 bg-purple-50 rounded-full flex items-center justify-center mb-5 text-purple-500 text-2xl"><font-awesome icon="fas fa-cloud-arrow-down" /></div>
                        <h3 class="font-bold text-xl text-primary-blue-100 mb-3">Data Staleness Cascade</h3>
                        <p class="text-gray-600 leading-relaxed">One stale report leads to another. Decisions compound on bad data. Soon your entire strategy is built on assumptions that were wrong two days ago.</p>
                    </div>
                </div>
            </div>
        </section>
        <section class="bg-primary-blue-100 w-full py-16 px-6">
            <div class="max-w-7xl mx-auto">
                <h2 class="font-bold text-white text-center text-4xl mb-4">How DRA Delivers Strategic Velocity</h2>
                <p class="text-blue-100 text-center text-lg mb-12 max-w-2xl mx-auto">Real-time data. Instant pivots. No lag.</p>
                <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
                    <div class="bg-white p-8 rounded-xl shadow-lg border border-gray-100 hover:shadow-xl transition duration-300 hover:-translate-y-1">
                        <div class="text-3xl text-primary-blue-100 mb-4"><font-awesome icon="fas fa-bolt" /></div>
                        <h3 class="text-xl font-bold text-primary-blue-100 mb-2">Real-Time Data Refresh</h3>
                        <p class="text-primary-blue-100/80 leading-relaxed">Connected data sources update automatically. No manual refreshes, no CSV exports, no 48-hour wait. Your dashboards are always current.</p>
                    </div>
                    <div class="bg-white p-8 rounded-xl shadow-lg border border-gray-100 hover:shadow-xl transition duration-300 hover:-translate-y-1">
                        <div class="text-3xl text-primary-blue-100 mb-4"><font-awesome icon="fas fa-chart-line" /></div>
                        <h3 class="text-xl font-bold text-primary-blue-100 mb-2">Live KPI Monitoring</h3>
                        <p class="text-primary-blue-100/80 leading-relaxed">Watch spend, conversions, ROAS, and CPL update in real time. Spot anomalies the moment they happen — not two days later.</p>
                    </div>
                    <div class="bg-white p-8 rounded-xl shadow-lg border border-gray-100 hover:shadow-xl transition duration-300 hover:-translate-y-1">
                        <div class="text-3xl text-primary-blue-100 mb-4"><font-awesome icon="fas fa-bell" /></div>
                        <h3 class="text-xl font-bold text-primary-blue-100 mb-2">AI-Powered Alerts</h3>
                        <p class="text-primary-blue-100/80 leading-relaxed">Get notified the instant a metric crosses your threshold. React in minutes instead of days.</p>
                    </div>
                    <div class="bg-white p-8 rounded-xl shadow-lg border border-gray-100 hover:shadow-xl transition duration-300 hover:-translate-y-1">
                        <div class="text-3xl text-primary-blue-100 mb-4"><font-awesome icon="fas fa-robot" /></div>
                        <h3 class="text-xl font-bold text-primary-blue-100 mb-2">AI-Driven Recommendations</h3>
                        <p class="text-primary-blue-100/80 leading-relaxed">Ask "where should I shift budget?" and get real-time answers with data to back them up. No waiting for an analyst.</p>
                    </div>
                    <div class="bg-white p-8 rounded-xl shadow-lg border border-gray-100 hover:shadow-xl transition duration-300 hover:-translate-y-1">
                        <div class="text-3xl text-primary-blue-100 mb-4"><font-awesome icon="fas fa-layer-group" /></div>
                        <h3 class="text-xl font-bold text-primary-blue-100 mb-2">Unified Cross-Channel View</h3>
                        <p class="text-primary-blue-100/80 leading-relaxed">See Google Ads, Meta, Google Ad Manager, and organic performance in one dashboard. No more toggling between 10 tabs.</p>
                    </div>
                    <div class="bg-white p-8 rounded-xl shadow-lg border border-gray-100 hover:shadow-xl transition duration-300 hover:-translate-y-1">
                        <div class="text-3xl text-primary-blue-100 mb-4"><font-awesome icon="fas fa-file-pen" /></div>
                        <h3 class="text-xl font-bold text-primary-blue-100 mb-2">Instant Report Sharing</h3>
                        <p class="text-primary-blue-100/80 leading-relaxed">Generate and share CEO-ready reports with a single click. Your stakeholders get current data, not last week's snapshot.</p>
                    </div>
                </div>
                <div class="flex justify-center mt-12"><div class="w-64"><combo-button label="Gain Strategic Velocity" color="white" class="w-full h-12 shadow-lg cursor-pointer" @click="scrollToPricing" /></div></div>
            </div>
        </section>
        <section class="bg-white w-full py-20 px-6 border-t border-gray-100">
            <div class="max-w-6xl mx-auto">
                <div class="flex flex-col lg:flex-row items-center gap-12">
                    <div class="lg:w-1/2">
                        <HeroCarousel :images="[intelligenceOverview, channelComparison, campaignPerformance, budgetAllocation]" />
                    </div>
                    <div class="lg:w-1/2">
                        <h3 class="text-3xl font-bold text-primary-blue-100 mb-4">Real-Time Data, Not 48-Hour-Old Reports</h3>
                        <p class="text-gray-600 text-lg leading-relaxed mb-6">DRA connects directly to your data sources and refreshes automatically. Watch spend, conversions, and ROAS update as they happen — and pivot budget the moment a channel underperforms.</p>
                        <ul class="space-y-3">
                            <li class="flex items-start gap-3"><div class="w-6 h-6 bg-green-100 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5"><font-awesome icon="fas fa-check" class="text-green-600 text-xs" /></div><span class="text-gray-700">Live KPI cards updated in real time</span></li>
                            <li class="flex items-start gap-3"><div class="w-6 h-6 bg-green-100 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5"><font-awesome icon="fas fa-check" class="text-green-600 text-xs" /></div><span class="text-gray-700">AI alerts when metrics cross your thresholds</span></li>
                            <li class="flex items-start gap-3"><div class="w-6 h-6 bg-green-100 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5"><font-awesome icon="fas fa-check" class="text-green-600 text-xs" /></div><span class="text-gray-700">No manual refresh — data is always current</span></li>
                        </ul>
                    </div>
                </div>
                <div class="max-w-5xl mx-auto text-center mt-16">
                    <h2 class="text-3xl font-bold text-primary-blue-100 mb-8">Fast Teams Win Markets</h2>
                    <div class="grid grid-cols-1 md:grid-cols-3 gap-8">
                        <div class="bg-primary-blue-100 rounded-xl p-6">
                            <div class="text-4xl font-bold text-white mb-2">24-48h</div>
                            <p class="text-blue-100">GA4 data processing delay you no longer wait on</p>
                        </div>
                        <div class="bg-primary-blue-100 rounded-xl p-6">
                            <div class="text-4xl font-bold text-white mb-2">12 Days</div>
                            <p class="text-blue-100">Attribution credit can keep changing after an event</p>
                        </div>
                        <div class="bg-primary-blue-100 rounded-xl p-6">
                            <div class="text-4xl font-bold text-white mb-2">11%+</div>
                            <p class="text-blue-100">Of media budgets lost to optimization lag, say two-thirds of marketers</p>
                        </div>
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
