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

const bookDemo = () => {
    if (import.meta.client) {
        window.location.href = '/enterprise-contact';
    }
};

const faqData = [
    { question: 'How do I prove marketing ROI to my CEO?', answer: 'Start with a plan. DRA turns your website into a channel-by-channel paid media plan with a revenue target for every channel, then tracks how those campaigns perform. The numbers come from tracked results that match the business — not a dashboard full of green arrows that mislead.' },
    { question: 'What metrics do CFOs actually care about from marketing?', answer: 'CFOs care about CAC (Customer Acquisition Cost), LTV (Lifetime Value), payback period, ROAS, pipeline velocity, and marketing-attributed revenue. DRA builds a plan with revenue targets per channel and tracks spend against results so those numbers hold up in front of the CFO.' },
    { question: 'Why does my marketing dashboard not match our bank account?', answer: 'Because your data is siloed. GA4 tracks one set of numbers, Google Ads tracks another, and your CRM tracks a third. DRA replaces the guessing with a plan: every channel gets a target and campaign performance is tracked against it from one view.' },
    { question: 'How do I earn CFO trust for my marketing budget?', answer: 'Show up with numbers that are planned and tracked. DRA gives every channel a budget and a revenue target up front, then tracks actual performance against the plan. When the CFO sees the same numbers you present in the business results, trust follows naturally.' }
];

// Inject structured data during setup so it is present in SSR HTML.
injectMultipleSchemas([
    getSoftwareApplicationSchema(),
    getFAQSchema(faqData),
]);

useHead({
    title: 'How to Prove Marketing ROI to Your CEO & CFO | DRA',
    meta: [
        { name: 'description', content: 'Walk into the boardroom with confidence. DRA helps CMOs prove marketing ROI with a channel-by-channel plan and live campaign tracking.' },
        { name: 'robots', content: 'index, follow' },
        { property: 'og:title', content: 'How to Prove Marketing ROI to Your CEO & CFO | DRA' },
        { property: 'og:description', content: 'Walk into the boardroom with confidence. Plan every channel with targets and prove ROI with tracked results.' },
        { property: 'og:url', content: `${siteUrl}/prove-roi-to-ceo` },
        { name: 'twitter:title', content: 'How to Prove Marketing ROI to Your CEO & CFO | DRA' },
        { name: 'twitter:description', content: 'Walk into the boardroom with confidence. Plan every channel with targets and prove ROI with tracked results.' }
    ],
    link: [{ rel: 'canonical', href: `${siteUrl}/prove-roi-to-ceo` }]
});
</script>
<template>
    <div>
        <payoff-block
            eyebrow="The ROI Proof Gap"
            headline="Prove marketing ROI to your CEO in 90 seconds, not three days."
            sub="Your plan sets the targets. Live tracking proves them. The CFO sees numbers that reconcile."
            :stats="[
                { text: '78% of marketing decision-makers believe at least 10% of spend is wasted due to insufficient measurement.', tag: 'Research' },
                { text: 'Organizations waste an average of 25% of their marketing budget on efforts that look productive but do not drive revenue.', tag: 'Research' },
                { text: 'Only 49% of marketing and finance leaders can clearly explain their measurement approach to the board.', tag: 'Research' }
            ]"
            roi-strip="Stop wasting spend. Give your CFO a number that holds up."
            :bullets="[
                'Every channel starts with a budget and a revenue target.',
                'Live spend-to-results tracking — the numbers are current, not last week.',
                'Plan vs. actuals that match what the business sees.'
            ]"
            cta-label="Show your CEO the numbers. Book a demo."
            :cta-action="bookDemo"
        />
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
                        <p class="text-gray-600 leading-relaxed">Impressions, clicks, and engagement don't pay the bills. Your CEO wants revenue targets and actual results. If you're reporting the wrong metrics, you're eroding your own credibility.</p>
                    </div>
                    <div class="bg-white p-8 rounded-xl shadow-lg border border-gray-100 hover:-translate-y-2 hover:shadow-xl transition duration-300">
                        <div class="w-14 h-14 bg-amber-50 rounded-full flex items-center justify-center mb-5 text-amber-500 text-2xl"><font-awesome icon="fas fa-circle-exclamation" /></div>
                        <h3 class="font-bold text-xl text-primary-blue-100 mb-3">Inconsistent Data Sources</h3>
                        <p class="text-gray-600 leading-relaxed">Your CEO heard one number in the last meeting. Your analytics tool shows another. Your CRM shows a third. Inconsistency breeds doubt — and budget cuts.</p>
                    </div>
                </div>
            </div>
        </section>
        <section class="bg-primary-blue-100 w-full py-16 px-6">
            <div class="max-w-7xl mx-auto">
                <h2 class="font-bold text-white text-center text-4xl mb-4">How DRA Rebuilds Executive Trust</h2>
                <p class="text-blue-100 text-center text-lg mb-12 max-w-2xl mx-auto">Numbers the boardroom can't argue with.</p>
                <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
                    <div class="bg-white p-8 rounded-xl shadow-lg border border-gray-100 hover:shadow-xl transition duration-300 hover:-translate-y-1">
                        <div class="text-3xl text-primary-blue-100 mb-4"><font-awesome icon="fas fa-scale-balanced" /></div>
                        <h3 class="text-xl font-bold text-primary-blue-100 mb-2">A Plan With Targets</h3>
                        <p class="text-primary-blue-100/80 leading-relaxed">Every channel starts with a budget and a revenue target. Success is defined before a dollar is spent.</p>
                    </div>
                    <div class="bg-white p-8 rounded-xl shadow-lg border border-gray-100 hover:shadow-xl transition duration-300 hover:-translate-y-1">
                        <div class="text-3xl text-primary-blue-100 mb-4"><font-awesome icon="fas fa-chart-line" /></div>
                        <h3 class="text-xl font-bold text-primary-blue-100 mb-2">Live Spend-to-Results</h3>
                        <p class="text-primary-blue-100/80 leading-relaxed">Track spend and revenue per campaign and channel as it happens. The numbers are current, not last week's snapshot.</p>
                    </div>
                    <div class="bg-white p-8 rounded-xl shadow-lg border border-gray-100 hover:shadow-xl transition duration-300 hover:-translate-y-1">
                        <div class="text-3xl text-primary-blue-100 mb-4"><font-awesome icon="fas fa-layer-group" /></div>
                        <h3 class="text-xl font-bold text-primary-blue-100 mb-2">Plan vs. Actuals</h3>
                        <p class="text-primary-blue-100/80 leading-relaxed">Compare every channel against its target. Show the CEO exactly how marketing performs against the plan — with auditable numbers.</p>
                    </div>
                    <div class="bg-white p-8 rounded-xl shadow-lg border border-gray-100 hover:shadow-xl transition duration-300 hover:-translate-y-1">
                        <div class="text-3xl text-primary-blue-100 mb-4"><font-awesome icon="fas fa-triangle-exclamation" /></div>
                        <h3 class="text-xl font-bold text-primary-blue-100 mb-2">Wasted-Spend Signals</h3>
                        <p class="text-primary-blue-100/80 leading-relaxed">AI flags campaigns that miss their targets, so waste is caught early and budget shifts to what works.</p>
                    </div>
                    <div class="bg-white p-8 rounded-xl shadow-lg border border-gray-100 hover:shadow-xl transition duration-300 hover:-translate-y-1">
                        <div class="text-3xl text-primary-blue-100 mb-4"><font-awesome icon="fas fa-lightbulb" /></div>
                        <h3 class="text-xl font-bold text-primary-blue-100 mb-2">Explanations, Not Reports</h3>
                        <p class="text-primary-blue-100/80 leading-relaxed">AI explains what drove each result, so you can answer "why?" before it's asked — with data to back it up.</p>
                    </div>
                    <div class="bg-white p-8 rounded-xl shadow-lg border border-gray-100 hover:shadow-xl transition duration-300 hover:-translate-y-1">
                        <div class="text-3xl text-primary-blue-100 mb-4"><font-awesome icon="fas fa-shield" /></div>
                        <h3 class="text-xl font-bold text-primary-blue-100 mb-2">Executive Certainty</h3>
                        <p class="text-primary-blue-100/80 leading-relaxed">Plans and tracked results give you complete confidence in every number you present. No more "this number might not include X."</p>
                    </div>
                </div>
                <div class="flex justify-center mt-12"><div class="w-64"><combo-button label="Build Executive Trust" color="white" class="w-full h-12 shadow-lg cursor-pointer" @click="scrollToPricing" /></div></div>
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
                        <h3 class="text-3xl font-bold text-primary-blue-100 mb-4">Numbers That Hold Up Because They're Planned and Tracked</h3>
                        <p class="text-gray-600 text-lg leading-relaxed mb-6">DRA sets a budget and a revenue target for every channel up front, then tracks actual performance against the plan. Walk into every board meeting with numbers that reconcile with the business.</p>
                        <ul class="space-y-3">
                            <li class="flex items-start gap-3"><div class="w-6 h-6 bg-green-100 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5"><font-awesome icon="fas fa-check" class="text-green-600 text-xs" /></div><span class="text-gray-700">Channel-by-channel targets set before spend</span></li>
                            <li class="flex items-start gap-3"><div class="w-6 h-6 bg-green-100 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5"><font-awesome icon="fas fa-check" class="text-green-600 text-xs" /></div><span class="text-gray-700">Live tracking of spend vs. revenue per channel</span></li>
                            <li class="flex items-start gap-3"><div class="w-6 h-6 bg-green-100 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5"><font-awesome icon="fas fa-check" class="text-green-600 text-xs" /></div><span class="text-gray-700">One set of numbers for the CMO, CFO, and sales</span></li>
                        </ul>
                    </div>
                </div>
                <div class="max-w-5xl mx-auto text-center mt-16">
                    <h2 class="text-3xl font-bold text-primary-blue-100 mb-8">The Trust Premium</h2>
                    <div class="grid grid-cols-1 md:grid-cols-3 gap-8">
                        <div class="bg-primary-blue-100 rounded-xl p-6">
                            <div class="text-4xl font-bold text-white mb-2">90%</div>
                            <p class="text-blue-100">Of leaders believe marketing drives growth</p>
                        </div>
                        <div class="bg-primary-blue-100 rounded-xl p-6">
                            <div class="text-4xl font-bold text-white mb-2">38.3%</div>
                            <p class="text-blue-100">Of marketers always include ROI in effectiveness analysis</p>
                        </div>
                        <div class="bg-primary-blue-100 rounded-xl p-6">
                            <div class="text-4xl font-bold text-white mb-2">Minutes</div>
                            <p class="text-blue-100">A defensible channel-by-channel plan, built from your website</p>
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
