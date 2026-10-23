<script setup lang="ts">
import intelligenceOverview from '/assets/images/intelligence-overview.png';
import channelComparison from '/assets/images/channel-comparison.png';
import campaignPerformance from '/assets/images/campaign-performance.png';
import budgetAllocation from '/assets/images/budget-allocation.png';
import paidMediaBuilder1 from '/assets/images/plan-media-builder-1.webp';
import paidMediaBuilder2 from '/assets/images/plan-media-builder-2.webp';
import paidMediaBuilder3 from '/assets/images/plan-media-builder-3.webp';
import paidMediaBuilder4 from '/assets/images/plan-media-builder-4.webp';
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
    { question: 'How do I prove marketing ROI when I can\'t track every touchpoint?', answer: 'Start with a plan. DRA turns your website into a channel-by-channel paid media plan — where to spend, how much, and what to create. Then connect Google Ads, Meta, Analytics, and Ad Manager and track how those campaigns actually perform against the plan. The numbers come from results, not from spreadsheet stitching.' },
    { question: 'What metrics do CFOs care about from marketing?', answer: 'CFOs care about CAC, LTV, payback period, ROAS, and pipeline velocity. DRA builds a plan with revenue targets per channel and tracks spend against results in real time, so you walk into board meetings with numbers that hold up.' },
    { question: 'Why doesn\'t my marketing dashboard match our bank account?', answer: 'Because your current tools each report their own version of the truth. GA4 shows one number, Google Ads shows another, and your CRM shows a third. DRA replaces the guessing with a plan: every channel gets a target, and campaign performance is tracked against it from one view.' },
    { question: 'ROAS vs marketing ROI — what\'s the difference?', answer: 'ROAS (Return on Ad Spend) measures gross revenue per dollar spent on a specific ad channel. Marketing ROI measures net profit across all channels minus total marketing costs. DRA sets ROAS targets per channel in the plan and tracks actual results, so you never confuse campaign efficiency with total business impact.' }
];

// Inject structured data during setup so it is present in SSR HTML.
injectMultipleSchemas([
    getSoftwareApplicationSchema(),
    getFAQSchema(faqData),
]);

useHead({
    title: 'Prove Marketing ROI: Connect Your Spend to Revenue | Data Research Analysis',
    meta: [
        { name: 'description', content: 'Stop guessing. Prove marketing ROI with a channel-by-channel paid media plan and live campaign tracking. Show exactly how every dollar drives revenue.' },
        { name: 'robots', content: 'index, follow' },
        { property: 'og:title', content: 'Prove Marketing ROI — Plan Spend to Revenue | DRA' },
        { property: 'og:description', content: 'Stop guessing. Plan every channel with targets, track how campaigns perform, and walk into board meetings with numbers that hold up.' },
        { property: 'og:url', content: `${siteUrl}/prove-marketing-roi` },
        { name: 'twitter:title', content: 'Prove Marketing ROI — Plan Spend to Revenue | DRA' },
        { name: 'twitter:description', content: 'Plan every channel with targets, track how campaigns perform, and prove ROI with numbers that hold up.' }
    ],
    link: [{ rel: 'canonical', href: `${siteUrl}/prove-marketing-roi` }]
});
</script>
<template>
    <div>
        <payoff-block
            eyebrow="The ROI Proof Gap"
            headline="When your number matches the bank account, the argument ends."
            sub="Plan every channel with targets. Track results against the plan. Walk in with numbers that hold up."
            :stats="[
                { text: '90% of leaders believe marketing drives growth, but only 49% can clearly explain how it is measured to the board.', tag: 'Research' },
                { text: 'Only 38.3% of marketers always include ROI in their effectiveness analysis.', tag: 'Research' },
                { text: 'ROI is the top metric the CEO, CFO, and board use to judge marketing.', tag: 'Research' }
            ]"
            roi-strip="Plan the spend. Track the results. Keep the revenue."
            :bullets="[
                'A channel-by-channel plan with revenue targets before a dollar is spent.',
                'Live tracking that shows spend vs. results per campaign and channel.',
                'Plan vs. actuals so the CMO, CFO, and sales share one set of numbers.'
            ]"
            cta-label="Build your revenue plan. Book a demo."
            :cta-action="bookDemo"
        />
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
        <section class="bg-primary-blue-100 w-full py-16 px-6">
            <div class="max-w-7xl mx-auto">
                <h2 class="font-bold text-white text-center text-4xl mb-4">How DRA Proves Marketing ROI</h2>
                <p class="text-blue-100 text-center text-lg mb-12 max-w-2xl mx-auto">A plan with targets. Results tracked against it. Numbers that hold up.</p>
                <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
                    <div class="bg-white p-8 rounded-xl shadow-lg border border-gray-100 hover:shadow-xl transition duration-300 hover:-translate-y-1">
                        <div class="text-3xl text-primary-blue-100 mb-4"><font-awesome icon="fas fa-wand-magic-sparkles" /></div>
                        <h3 class="text-xl font-bold text-primary-blue-100 mb-2">AI Paid Media Plan Builder</h3>
                        <p class="text-primary-blue-100/80 leading-relaxed">Point Data Research Analysis at your website and get a channel-by-channel plan with budgets and targets — no spreadsheet planning.</p>
                    </div>
                    <div class="bg-white p-8 rounded-xl shadow-lg border border-gray-100 hover:shadow-xl transition duration-300 hover:-translate-y-1">
                        <div class="text-3xl text-primary-blue-100 mb-4"><font-awesome icon="fas fa-bullseye" /></div>
                        <h3 class="text-xl font-bold text-primary-blue-100 mb-2">Targets Built In</h3>
                        <p class="text-primary-blue-100/80 leading-relaxed">Every channel starts with a revenue target, so success is defined before a dollar is spent.</p>
                    </div>
                    <div class="bg-white p-8 rounded-xl shadow-lg border border-gray-100 hover:shadow-xl transition duration-300 hover:-translate-y-1">
                        <div class="text-3xl text-primary-blue-100 mb-4"><font-awesome icon="fas fa-chart-line" /></div>
                        <h3 class="text-xl font-bold text-primary-blue-100 mb-2">Live Campaign Tracking</h3>
                        <p class="text-primary-blue-100/80 leading-relaxed">Connect your channels and watch spend, conversions, and ROAS update as your campaigns run.</p>
                    </div>
                    <div class="bg-white p-8 rounded-xl shadow-lg border border-gray-100 hover:shadow-xl transition duration-300 hover:-translate-y-1">
                        <div class="text-3xl text-primary-blue-100 mb-4"><font-awesome icon="fas fa-layer-group" /></div>
                        <h3 class="text-xl font-bold text-primary-blue-100 mb-2">Plan vs. Actuals</h3>
                        <p class="text-primary-blue-100/80 leading-relaxed">Compare what you planned with what each channel delivered. The argument ends with numbers.</p>
                    </div>
                    <div class="bg-white p-8 rounded-xl shadow-lg border border-gray-100 hover:shadow-xl transition duration-300 hover:-translate-y-1">
                        <div class="text-3xl text-primary-blue-100 mb-4"><font-awesome icon="fas fa-triangle-exclamation" /></div>
                        <h3 class="text-xl font-bold text-primary-blue-100 mb-2">Wasted-Spend Signals</h3>
                        <p class="text-primary-blue-100/80 leading-relaxed">AI flags campaigns and channels that miss their targets so you shift budget to what works.</p>
                    </div>
                    <div class="bg-white p-8 rounded-xl shadow-lg border border-gray-100 hover:shadow-xl transition duration-300 hover:-translate-y-1">
                        <div class="text-3xl text-primary-blue-100 mb-4"><font-awesome icon="fas fa-users" /></div>
                        <h3 class="text-xl font-bold text-primary-blue-100 mb-2">Built for Marketing Teams</h3>
                        <p class="text-primary-blue-100/80 leading-relaxed">Made for CMOs, performance marketers, and digital teams. No engineering tickets, no waiting on analysts.</p>
                    </div>
                </div>
                <div class="flex justify-center mt-12"><div class="w-64"><combo-button label="Build Your Revenue Plan" color="white" class="w-full h-12 shadow-lg cursor-pointer" @click="scrollToPricing" /></div></div>
            </div>
        </section>
        <section class="bg-white w-full py-20 px-6 border-t border-gray-100">
            <div class="max-w-6xl mx-auto">
                <div class="flex flex-col lg:flex-row items-center gap-12">
                    <div class="lg:w-1/2">
                        <HeroCarousel :images="[
                            { image: paidMediaBuilder1, alt: 'Paid media plan builder showing a channel-by-channel plan with recommended budgets and targets' },
                            { image: paidMediaBuilder2, alt: 'Paid media plan builder generating campaign recommendations from a website' },
                            { image: paidMediaBuilder3, alt: 'Paid media plan builder campaign playbook with channels, budgets, and creative guidance' },
                            { image: paidMediaBuilder4, alt: 'Paid media plan summary comparing planned spend against projected results' },
                            { image: intelligenceOverview, alt: 'Campaign Intelligence overview showing cross-channel spend, revenue, and ROAS' },
                            { image: channelComparison, alt: 'Channel comparison view showing performance by marketing channel' },
                            { image: campaignPerformance, alt: 'Campaign performance dashboard with spend, conversions, and ROAS by campaign' },
                            { image: budgetAllocation, alt: 'Budget allocation view showing planned spend across channels' }
                        ]" />
                    </div>
                    <div class="lg:w-1/2">
                        <h3 class="text-3xl font-bold text-primary-blue-100 mb-4">A Plan with Targets. Results You Can Defend.</h3>
                        <p class="text-gray-600 text-lg leading-relaxed mb-6">DRA builds the channel-by-channel plan from your website, sets a revenue target for every channel, and tracks spend vs. results live. No more toggling between tools to answer "what worked?"</p>
                        <ul class="space-y-3">
                            <li class="flex items-start gap-3"><div class="w-6 h-6 bg-green-100 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5"><font-awesome icon="fas fa-check" class="text-green-600 text-xs" /></div><span class="text-gray-700">Every channel gets a budget and a revenue target up front</span></li>
                            <li class="flex items-start gap-3"><div class="w-6 h-6 bg-green-100 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5"><font-awesome icon="fas fa-check" class="text-green-600 text-xs" /></div><span class="text-gray-700">Live spend vs. results per campaign, updated automatically</span></li>
                            <li class="flex items-start gap-3"><div class="w-6 h-6 bg-green-100 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5"><font-awesome icon="fas fa-check" class="text-green-600 text-xs" /></div><span class="text-gray-700">Plan vs. actuals in one view — the argument ends with numbers</span></li>
                        </ul>
                    </div>
                </div>
                <div class="max-w-5xl mx-auto text-center mt-16">
                    <h2 class="text-3xl font-bold text-primary-blue-100 mb-8">The Cost of Not Proving ROI</h2>
                    <div class="grid grid-cols-1 md:grid-cols-3 gap-8">
                        <div class="bg-primary-blue-100 rounded-xl p-6">
                            <div class="text-4xl font-bold text-white mb-2">25%</div>
                            <p class="text-blue-100">Of marketing budget wasted on average</p>
                        </div>
                        <div class="bg-primary-blue-100 rounded-xl p-6">
                            <div class="text-4xl font-bold text-white mb-2">49%</div>
                            <p class="text-blue-100">Of marketing and finance leaders can't explain their measurement approach to the board</p>
                        </div>
                        <div class="bg-primary-blue-100 rounded-xl p-6">
                            <div class="text-4xl font-bold text-white mb-2">#1</div>
                            <p class="text-blue-100">ROI is the metric the CEO, CFO, and board use to judge marketing</p>
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
