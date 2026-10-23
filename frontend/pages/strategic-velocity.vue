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
    { question: 'What is strategic velocity in marketing?', answer: 'Strategic velocity is the speed at which a marketing organization can plan, launch, and reallocate budget. Most teams plan in spreadsheets and react to reports that lag by days. DRA builds a channel-by-channel plan first, then tracks how those campaigns perform so you can pivot budget the moment a channel underperforms.' },
    { question: 'How does report lag hurt marketing performance?', answer: 'When reports take 2-3 days to generate, you are optimizing yesterday\'s campaigns. In a competitive market, that delay means competitors with faster feedback outmaneuver you. DRA tracks plan campaigns live across your connected channels so decisions follow current results.' },
    { question: 'Can I get faster feedback on my ad spend without a multi-million dollar setup?', answer: 'Yes. DRA builds your channel-by-channel plan in minutes, then connects Google Ads, Meta, Analytics, and Ad Manager so campaign results update automatically. Strategic velocity without the infrastructure cost.' },
    { question: 'How fast can I pivot budget with DRA?', answer: 'Fast. Every channel starts with a target in the plan, and live tracking shows which channels are over- or under-performing. Reallocate budget on the fly and see the impact against the plan — not days later.' }
];

// Inject structured data during setup so it is present in SSR HTML.
injectMultipleSchemas([
    getSoftwareApplicationSchema(),
    getFAQSchema(faqData),
]);

useHead({
    title: 'Strategic Velocity: Real-Time Marketing Analytics at the Speed of Now | DRA',
    meta: [
        { name: 'description', content: 'Break free from 48-hour report lag. Plan every channel with targets and track campaign performance live so you can pivot budget instantly.' },
        { name: 'robots', content: 'index, follow' },
        { property: 'og:title', content: 'Strategic Velocity — Plan and Pivot Fast | DRA' },
        { property: 'og:description', content: 'Plan every channel with targets, track campaigns live, and pivot budget instantly.' },
        { property: 'og:url', content: `${siteUrl}/strategic-velocity` },
        { name: 'twitter:title', content: 'Strategic Velocity — Plan and Pivot Fast | DRA' },
        { name: 'twitter:description', content: 'Plan every channel with targets, track campaigns live, and pivot budget instantly.' }
    ],
    link: [{ rel: 'canonical', href: `${siteUrl}/strategic-velocity` }]
});
</script>
<template>
    <div>
        <payoff-block
            eyebrow="The Strategic Velocity Gap"
            headline="Your dashboard is 48 hours old. Your competitor's decision is not."
            sub="Plan first, then track live. Move budget while the opportunity is still there."
            :stats="[
                { text: 'GA4 takes 24 to 48 hours to process data.', tag: 'Research' },
                { text: 'Attribution credit can change for up to 12 days after an event is recorded.', tag: 'Research' },
                { text: 'More than two-thirds of marketers estimate at least 11% of media budgets are lost to optimization lag.', tag: 'Research' }
            ]"
            roi-strip="Every day of lag is a day of lost revenue."
            :bullets="[
                'A channel-by-channel plan so budget shifts follow targets, not guesses.',
                'Live campaign tracking as your channels sync — no waiting on reports.',
                'AI alerts when a channel misses its plan target, so you pivot in minutes.'
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
                <p class="text-blue-100 text-center text-lg mb-12 max-w-2xl mx-auto">Plan first. Track live. Pivot in minutes.</p>
                <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
                    <div class="bg-white p-8 rounded-xl shadow-lg border border-gray-100 hover:shadow-xl transition duration-300 hover:-translate-y-1">
                        <div class="text-3xl text-primary-blue-100 mb-4"><font-awesome icon="fas fa-wand-magic-sparkles" /></div>
                        <h3 class="text-xl font-bold text-primary-blue-100 mb-2">Plan Before You Spend</h3>
                        <p class="text-primary-blue-100/80 leading-relaxed">A channel-by-channel plan with budgets and targets from your website — the plan is ready before the money moves.</p>
                    </div>
                    <div class="bg-white p-8 rounded-xl shadow-lg border border-gray-100 hover:shadow-xl transition duration-300 hover:-translate-y-1">
                        <div class="text-3xl text-primary-blue-100 mb-4"><font-awesome icon="fas fa-bolt" /></div>
                        <h3 class="text-xl font-bold text-primary-blue-100 mb-2">Live Campaign Tracking</h3>
                        <p class="text-primary-blue-100/80 leading-relaxed">Connected channels update automatically. Watch spend, conversions, and ROAS as they happen — no manual refreshes.</p>
                    </div>
                    <div class="bg-white p-8 rounded-xl shadow-lg border border-gray-100 hover:shadow-xl transition duration-300 hover:-translate-y-1">
                        <div class="text-3xl text-primary-blue-100 mb-4"><font-awesome icon="fas fa-bell" /></div>
                        <h3 class="text-xl font-bold text-primary-blue-100 mb-2">AI Alerts on Missed Targets</h3>
                        <p class="text-primary-blue-100/80 leading-relaxed">Get notified the instant a channel drops below its plan target. React in minutes instead of days.</p>
                    </div>
                    <div class="bg-white p-8 rounded-xl shadow-lg border border-gray-100 hover:shadow-xl transition duration-300 hover:-translate-y-1">
                        <div class="text-3xl text-primary-blue-100 mb-4"><font-awesome icon="fas fa-layer-group" /></div>
                        <h3 class="text-xl font-bold text-primary-blue-100 mb-2">Plan vs. Actuals</h3>
                        <p class="text-primary-blue-100/80 leading-relaxed">See every channel's performance against what you planned. Pivot budget with a clear view of the gap.</p>
                    </div>
                    <div class="bg-white p-8 rounded-xl shadow-lg border border-gray-100 hover:shadow-xl transition duration-300 hover:-translate-y-1">
                        <div class="text-3xl text-primary-blue-100 mb-4"><font-awesome icon="fas fa-chart-line" /></div>
                        <h3 class="text-xl font-bold text-primary-blue-100 mb-2">Unified Channel View</h3>
                        <p class="text-primary-blue-100/80 leading-relaxed">Google Ads, Meta, Analytics, and Ad Manager in one view. No more toggling between 10 tabs.</p>
                    </div>
                    <div class="bg-white p-8 rounded-xl shadow-lg border border-gray-100 hover:shadow-xl transition duration-300 hover:-translate-y-1">
                        <div class="text-3xl text-primary-blue-100 mb-4"><font-awesome icon="fas fa-users" /></div>
                        <h3 class="text-xl font-bold text-primary-blue-100 mb-2">Built for Marketing Teams</h3>
                        <p class="text-primary-blue-100/80 leading-relaxed">Made for CMOs and digital marketing teams. Decisions in minutes — no waiting on analysts or reports.</p>
                    </div>
                </div>
                <div class="flex justify-center mt-12"><div class="w-64"><combo-button label="Gain Strategic Velocity" color="white" class="w-full h-12 shadow-lg cursor-pointer" @click="scrollToPricing" /></div></div>
            </div>
        </section>
        <section class="bg-white w-full py-20 px-6 border-t border-gray-100">
            <div class="max-w-6xl mx-auto">
                <div class="flex flex-col lg:flex-row items-center gap-12">
                    <div class="lg:w-1/2">
                        <HeroCarousel :images="[
                            { image: intelligenceOverview, alt: 'Campaign Intelligence overview showing cross-channel spend, revenue, and ROAS' },
                            { image: channelComparison, alt: 'Channel comparison view showing performance by marketing channel' },
                            { image: campaignPerformance, alt: 'Campaign performance dashboard with spend, conversions, and ROAS by campaign' },
                            { image: budgetAllocation, alt: 'Budget allocation view showing planned spend across channels' }
                        ]" />
                    </div>
                    <div class="lg:w-1/2">
                        <h3 class="text-3xl font-bold text-primary-blue-100 mb-4">Pivot Budget the Moment the Plan Meets Reality</h3>
                        <p class="text-gray-600 text-lg leading-relaxed mb-6">DRA tracks your plan's campaigns live across connected channels and flags the moment a channel misses its target. Shift budget with current numbers, not last week's snapshot.</p>
                        <ul class="space-y-3">
                            <li class="flex items-start gap-3"><div class="w-6 h-6 bg-green-100 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5"><font-awesome icon="fas fa-check" class="text-green-600 text-xs" /></div><span class="text-gray-700">Plan campaigns tracked live across every connected channel</span></li>
                            <li class="flex items-start gap-3"><div class="w-6 h-6 bg-green-100 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5"><font-awesome icon="fas fa-check" class="text-green-600 text-xs" /></div><span class="text-gray-700">AI alerts the moment a channel misses its target</span></li>
                            <li class="flex items-start gap-3"><div class="w-6 h-6 bg-green-100 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5"><font-awesome icon="fas fa-check" class="text-green-600 text-xs" /></div><span class="text-gray-700">Shift budget and see the impact against the plan</span></li>
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
