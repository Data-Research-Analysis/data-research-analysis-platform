<script setup lang="ts">
import intelligenceOverview from '/assets/images/intelligence-overview.png';
import channelComparison from '/assets/images/channel-comparison.png';
import campaignPerformance from '/assets/images/campaign-performance.png';
import budgetAllocation from '/assets/images/budget-allocation.png';
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
    { question: 'How do I prove marketing ROI to my CEO?', answer: 'Start with data that reconciles. Most dashboards show channel-level metrics that don\'t match the P&L. DRA unifies your spend data, conversion data, and revenue data into one truth layer so your CEO sees marketing ROI that matches the bank account — not a dashboard full of green arrows that mislead.' },
    { question: 'What metrics do CFOs actually care about from marketing?', answer: 'CFOs care about CAC (Customer Acquisition Cost), LTV (Lifetime Value), payback period, ROAS, pipeline velocity, and marketing-attributed revenue. DRA surfaces all of these in CEO-ready dashboards that connect directly to your financial reporting.' },
    { question: 'Why does my marketing dashboard not match our bank account?', answer: 'Because your data is siloed. GA4 tracks one set of numbers, Google Ads tracks another, and your CRM tracks a third. Without a unified truth layer, none of them reconcile with actual revenue. DRA eliminates this gap.' },
    { question: 'How do I earn CFO trust for my marketing budget?', answer: 'Show up with numbers that match. DRA gives you a single source of truth that reconciles marketing spend to pipeline and revenue. When the CFO sees the same numbers in your presentation that they see in the P&L, trust follows naturally.' }
];

onMounted(() => {
    if (import.meta.client) {
        injectMultipleSchemas([
            getOrganizationSchema(),
            getSoftwareApplicationSchema(),
            getFAQSchema(faqData),
            getBreadcrumbSchema([{ name: 'Home', url: siteUrl }, { name: 'How to Prove Marketing ROI to CEO/CFO', url: `${siteUrl}/prove-roi-to-ceo` }])
        ]);
    }
});

useHead({
    title: 'How to Prove Marketing ROI to Your CEO & CFO | DRA',
    meta: [
        { name: 'description', content: 'Walk into the boardroom with confidence. DRA helps CMOs prove marketing ROI to CEOs and CFOs with unified data that reconciles spend to revenue.' },
        { name: 'keywords', content: 'how to prove marketing ROI to CEO, how to prove marketing ROI to CFO, CMO CFO trust, executive trust gap, marketing budget justification, CMO marketing ROI reporting' },
        { name: 'robots', content: 'index, follow' },
        { property: 'og:title', content: 'How to Prove Marketing ROI to Your CEO & CFO | DRA' },
        { property: 'og:description', content: 'Walk into the boardroom with confidence. Prove marketing ROI to CEOs and CFOs with data that reconciles.' },
        { property: 'og:url', content: `${siteUrl}/prove-roi-to-ceo` },
        { name: 'twitter:title', content: 'How to Prove Marketing ROI to Your CEO & CFO | DRA' },
        { name: 'twitter:description', content: 'Walk into the boardroom with confidence. Prove marketing ROI to CEOs and CFOs with data that reconciles.' }
    ],
    link: [{ rel: 'canonical', href: `${siteUrl}/prove-roi-to-ceo` }]
});
</script>
<template>
    <div>
        <section class="bg-primary-blue-100 w-full relative flex flex-col items-center py-24 px-6">
            <div class="max-w-4xl mx-auto text-center">
                <h1 class="font-bold text-white text-5xl leading-tight mb-6">How to Prove Marketing ROI<br><span class="text-transparent bg-clip-text bg-gradient-to-r from-blue-200 to-white">to Your CEO &amp; CFO</span></h1>
                <p class="text-xl text-blue-100 max-w-2xl mx-auto mb-8 leading-relaxed">Dashboards show success but the bank account is flat. The Executive Trust Gap erodes your credibility and your budget. DRA gives you the single source of truth that earns boardroom confidence.</p>
                <div class="w-64 mx-auto"><combo-button label="Earn Executive Trust" color="white" class="w-full h-14 text-lg shadow-xl hover:scale-105 transition-transform cursor-pointer" @click="scrollToPricing" /></div>
            </div>
        </section>
        <section class="bg-white w-full py-16 px-6">
            <div class="max-w-7xl mx-auto">
                <h2 class="font-bold text-primary-blue-100 text-center text-4xl mb-4">The Executive Trust Gap</h2>
                <p class="text-gray-500 text-center text-lg mb-12 max-w-2xl mx-auto">Three reasons your CEO and CFO don't trust your marketing numbers — and how DRA fixes each.</p>
                <div class="grid grid-cols-1 md:grid-cols-3 gap-8">
                    <div class="bg-white p-8 rounded-xl shadow-lg border border-gray-100 hover:-translate-y-2 hover:shadow-xl transition duration-300">
                        <div class="w-14 h-14 bg-amber-50 rounded-full flex items-center justify-center mb-5 text-amber-500 text-2xl"><font-awesome icon="fas fa-handshake" /></div>
                        <h3 class="font-bold text-xl text-primary-blue-100 mb-3">Dashboard vs. Bank Account</h3>
                        <p class="text-gray-600 leading-relaxed">Your dashboard shows green arrows and rising ROAS. But the CFO's P&L shows flat revenue. When your numbers don't match the bank account, trust evaporates instantly.</p>
                    </div>
                    <div class="bg-white p-8 rounded-xl shadow-lg border border-gray-100 hover:-translate-y-2 hover:shadow-xl transition duration-300">
                        <div class="w-14 h-14 bg-amber-50 rounded-full flex items-center justify-center mb-5 text-amber-500 text-2xl"><font-awesome icon="fas fa-chart-simple" /></div>
                        <h3 class="font-bold text-xl text-primary-blue-100 mb-3">Vanity Metrics, Not Revenue</h3>
                        <p class="text-gray-600 leading-relaxed">Impressions, clicks, and engagement don't pay the bills. Your CEO wants pipeline and revenue attribution. If you're reporting the wrong metrics, you're eroding your own credibility.</p>
                    </div>
                    <div class="bg-white p-8 rounded-xl shadow-lg border border-gray-100 hover:-translate-y-2 hover:shadow-xl transition duration-300">
                        <div class="w-14 h-14 bg-amber-50 rounded-full flex items-center justify-center mb-5 text-amber-500 text-2xl"><font-awesome icon="fas fa-circle-exclamation" /></div>
                        <h3 class="font-bold text-xl text-primary-blue-100 mb-3">Inconsistent Data Sources</h3>
                        <p class="text-gray-600 leading-relaxed">Your CEO heard one number in the last meeting. Your analytics tool shows another. Your CRM shows a third. Inconsistency breeds doubt — and budget cuts.</p>
                    </div>
                </div>
            </div>
        </section>
        <section class="bg-gray-50 w-full py-16 px-6">
            <div class="max-w-7xl mx-auto">
                <h2 class="font-bold text-primary-blue-100 text-center text-4xl mb-4">How DRA Rebuilds Executive Trust</h2>
                <p class="text-gray-500 text-center text-lg mb-12 max-w-2xl mx-auto">Numbers the boardroom can't argue with.</p>
                <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
                    <div class="bg-white p-8 rounded-xl shadow-lg border border-gray-100 hover:shadow-xl transition duration-300 hover:-translate-y-1">
                        <div class="text-3xl text-primary-blue-100 mb-4"><font-awesome icon="fas fa-scale-balanced" /></div>
                        <h3 class="text-xl font-bold text-primary-blue-100 mb-2">Reconciled Revenue Data</h3>
                        <p class="text-primary-blue-100/80 leading-relaxed">DRA unifies spend, conversion, and revenue data from every source. The numbers in your dashboard match the numbers in the bank account — period.</p>
                    </div>
                    <div class="bg-white p-8 rounded-xl shadow-lg border border-gray-100 hover:shadow-xl transition duration-300 hover:-translate-y-1">
                        <div class="text-3xl text-primary-blue-100 mb-4"><font-awesome icon="fas fa-file-invoice" /></div>
                        <h3 class="text-xl font-bold text-primary-blue-100 mb-2">CEO-Ready Reports</h3>
                        <p class="text-primary-blue-100/80 leading-relaxed">Generate board-level reports that show CAC, LTV, payback period, and marketing-attributed revenue. The metrics your CFO actually cares about.</p>
                    </div>
                    <div class="bg-white p-8 rounded-xl shadow-lg border border-gray-100 hover:shadow-xl transition duration-300 hover:-translate-y-1">
                        <div class="text-3xl text-primary-blue-100 mb-4"><font-awesome icon="fas fa-link" /></div>
                        <h3 class="text-xl font-bold text-primary-blue-100 mb-2">Spend-to-Revenue Pipeline</h3>
                        <p class="text-primary-blue-100/80 leading-relaxed">Trace every dollar from ad spend to closed revenue. Show the CEO exactly how marketing drives the top line — with auditable, reconcilable data.</p>
                    </div>
                    <div class="bg-white p-8 rounded-xl shadow-lg border border-gray-100 hover:shadow-xl transition duration-300 hover:-translate-y-1">
                        <div class="text-3xl text-primary-blue-100 mb-4"><font-awesome icon="fas fa-brain" /></div>
                        <h3 class="text-xl font-bold text-primary-blue-100 mb-2">AI Attribution Models</h3>
                        <p class="text-primary-blue-100/80 leading-relaxed">Beyond last-touch. DRA supports multi-touch attribution models that fairly credit every channel involved in the customer journey.</p>
                    </div>
                    <div class="bg-white p-8 rounded-xl shadow-lg border border-gray-100 hover:shadow-xl transition duration-300 hover:-translate-y-1">
                        <div class="text-3xl text-primary-blue-100 mb-4"><font-awesome icon="fas fa-clock" /></div>
                        <h3 class="text-xl font-bold text-primary-blue-100 mb-2">Real-Time Trust Building</h3>
                        <p class="text-primary-blue-100/80 leading-relaxed">No more waiting days for reports. Walk into any meeting with real-time data the CEO and CFO can verify against their own systems.</p>
                    </div>
                    <div class="bg-white p-8 rounded-xl shadow-lg border border-gray-100 hover:shadow-xl transition duration-300 hover:-translate-y-1">
                        <div class="text-3xl text-primary-blue-100 mb-4"><font-awesome icon="fas fa-shield" /></div>
                        <h3 class="text-xl font-bold text-primary-blue-100 mb-2">Executive Certainty</h3>
                        <p class="text-primary-blue-100/80 leading-relaxed">DRA's Truth Layer gives you complete confidence in every number you present. No more caveats, no more "this number might not include X."</p>
                    </div>
                </div>
                <div class="flex justify-center mt-12"><div class="w-64"><combo-button label="Build Executive Trust" color="primary" class="w-full h-12 shadow-lg cursor-pointer" @click="scrollToPricing" /></div></div>
            </div>
        </section>
        <section class="bg-white w-full py-20 px-6 border-t border-gray-100">
            <div class="max-w-6xl mx-auto">
                <div class="flex flex-col lg:flex-row items-center gap-12">
                    <div class="lg:w-1/2">
                        <HeroCarousel :images="[intelligenceOverview, channelComparison, campaignPerformance, budgetAllocation]" />
                    </div>
                    <div class="lg:w-1/2">
                        <h3 class="text-3xl font-bold text-primary-blue-100 mb-4">Boardroom-Ready Reports That Match the P&L</h3>
                        <p class="text-gray-600 text-lg leading-relaxed mb-6">DRA generates CEO-ready dashboards showing CAC, LTV, ROAS, and marketing-attributed revenue — all reconciled against your actual financial data. Walk into every board meeting with numbers the CFO can't argue with.</p>
                        <ul class="space-y-3">
                            <li class="flex items-start gap-3"><div class="w-6 h-6 bg-green-100 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5"><font-awesome icon="fas fa-check" class="text-green-600 text-xs" /></div><span class="text-gray-700">CAC, LTV, payback period — the metrics CFOs demand</span></li>
                            <li class="flex items-start gap-3"><div class="w-6 h-6 bg-green-100 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5"><font-awesome icon="fas fa-check" class="text-green-600 text-xs" /></div><span class="text-gray-700">Spend-to-revenue traceability for every dollar</span></li>
                            <li class="flex items-start gap-3"><div class="w-6 h-6 bg-green-100 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5"><font-awesome icon="fas fa-check" class="text-green-600 text-xs" /></div><span class="text-gray-700">Export to PDF or share live dashboards instantly</span></li>
                        </ul>
                    </div>
                </div>
            </div>
        </section>
        <section class="bg-primary-blue-100 w-full py-16 px-6">
            <div class="max-w-5xl mx-auto text-center">
                <h2 class="text-3xl font-bold text-white mb-8">The Trust Premium</h2>
                <div class="grid grid-cols-1 md:grid-cols-3 gap-8 mb-8">
                    <div class="bg-white/10 rounded-xl p-6 backdrop-blur-sm">
                        <div class="text-4xl font-bold text-white mb-2">3x</div>
                        <p class="text-blue-100">Higher budget retention with reconcilable data</p>
                    </div>
                    <div class="bg-white/10 rounded-xl p-6 backdrop-blur-sm">
                        <div class="text-4xl font-bold text-white mb-2">68%</div>
                        <p class="text-blue-100">Of CEOs doubt marketing ROI numbers</p>
                    </div>
                    <div class="bg-white/10 rounded-xl p-6 backdrop-blur-sm">
                        <div class="text-4xl font-bold text-white mb-2">1 Source</div>
                        <p class="text-blue-100">Of truth that matches the bank account</p>
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
