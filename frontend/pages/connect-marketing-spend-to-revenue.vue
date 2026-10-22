<script setup lang="ts">
import intelligenceOverview from '/assets/images/intelligence-overview.png';
import channelComparison from '/assets/images/channel-comparison.png';
import campaignPerformance from '/assets/images/campaign-performance.png';
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

const startFree = () => {
    if (import.meta.client) {
        window.location.href = '/register?plan=free&cycle=monthly';
    }
};

const faqData = [
    { question: 'How do I connect marketing spend to revenue?', answer: 'Start with a plan. DRA builds a channel-by-channel paid media plan — where to spend, how much, and what to create — straight from your website. Then connect Google Ads, Meta, Google Analytics, and Google Ad Manager, and DRA tracks how those campaigns perform so every dollar is accounted for.' },
    { question: 'Why is my MarTech stack a barrier to alignment?', answer: '54% of CMOs say connecting data from different sources is a major barrier. Each tool reports its own numbers, so nobody can see which channels actually pay back. DRA solves this with one plan and one view of performance — no more juggling disconnected tools.' },
    { question: 'What is a GA4 alternative for marketing attribution?', answer: 'DRA is purpose-built for paid media planning where GA4 falls short. It turns your website into a channel-by-channel plan with targets, then tracks campaign performance against that plan across Google Ads, Meta, Analytics, and Ad Manager — so you can see what drives revenue.' },
    { question: 'Why do BI tools fall short for marketing analytics?', answer: 'BI tools visualize data but do not tell you where to spend. DRA is a paid media plan builder: it plans every channel, sets targets, and then tracks how those campaigns perform — so you improve spend instead of just looking at reports.' }
];

// Inject structured data during setup so it is present in SSR HTML.
injectMultipleSchemas([
    getSoftwareApplicationSchema(),
    getFAQSchema(faqData),
]);

useHead({
    title: 'Connect Marketing Spend to Revenue: End the MarTech Stack Mess | DRA',
    meta: [
        { name: 'description', content: '54% of CMOs say connecting data from different sources is a major barrier. DRA turns your disconnected stack into one channel-by-channel paid media plan and tracks how it performs.' },
        { name: 'robots', content: 'index, follow' },
        { property: 'og:title', content: 'Connect Marketing Spend to Revenue — End the MarTech Mess | DRA' },
        { property: 'og:description', content: 'Turn disconnected marketing tools into one paid media plan — and track how it performs.' },
        { property: 'og:url', content: `${siteUrl}/connect-marketing-spend-to-revenue` },
        { name: 'twitter:title', content: 'Connect Marketing Spend to Revenue — End the MarTech Mess | DRA' },
        { name: 'twitter:description', content: 'Turn disconnected marketing tools into one paid media plan — and track how it performs.' }
    ],
    link: [{ rel: 'canonical', href: `${siteUrl}/connect-marketing-spend-to-revenue` }]
});
</script>
<template>
    <div>
        <payoff-block
            eyebrow="The MarTech Stack Mess"
            headline="Five tools. Five truths. One plan that ends the argument."
            sub="Turn disconnected tools into a channel-by-channel plan — then track how it performs."
            :stats="[
                { text: '54% of CMOs say connecting data from different sources is a major barrier.', tag: 'Research' },
                { text: 'One-third of CMOs rely on 5 to 15 tools to measure ROI.', tag: 'Research' },
                { text: '78% of marketing decision-makers believe at least 10% of spend is wasted.', tag: 'Research' }
            ]"
            roi-strip="One plan. Every channel. Results you can see."
            :bullets="[
                'Point the AI at your website for a channel-by-channel plan — where to spend, how much, and what to create.',
                'Connect Google Ads, Meta, Analytics, and Ad Manager to track plan campaigns live.',
                'See spend-to-results per channel and cut what doesn\'t pay back.'
            ]"
            cta-label="Turn your stack into a plan. Start free."
            :cta-action="startFree"
        />
        <section class="bg-white w-full py-16 px-6">
            <div class="max-w-7xl mx-auto">
                <h2 class="font-bold text-primary-blue-100 text-center text-4xl mb-4">The MarTech Stack Mess</h2>
                <p class="text-gray-500 text-center text-lg mb-12 max-w-2xl mx-auto">Three ways your tools are working against you — and how DRA unifies them behind one plan.</p>
                <div class="grid grid-cols-1 md:grid-cols-3 gap-8">
                    <div class="bg-white p-8 rounded-xl shadow-lg border border-gray-100 hover:-translate-y-2 hover:shadow-xl transition duration-300">
                        <div class="w-14 h-14 bg-blue-50 rounded-full flex items-center justify-center mb-5 text-primary-blue-100 text-2xl"><font-awesome icon="fas fa-database" /></div>
                        <h3 class="font-bold text-xl text-primary-blue-100 mb-3">Data Silo Chaos</h3>
                        <p class="text-gray-600 leading-relaxed">Google Ads lives in one dashboard, GA4 in another, Google Ad Manager in a third, your CRM in a fourth. Assembling the full picture requires exporting, joining, and manually reconciling spreadsheets.</p>
                    </div>
                    <div class="bg-white p-8 rounded-xl shadow-lg border border-gray-100 hover:-translate-y-2 hover:shadow-xl transition duration-300">
                        <div class="w-14 h-14 bg-blue-50 rounded-full flex items-center justify-center mb-5 text-primary-blue-100 text-2xl"><font-awesome icon="fas fa-arrow-right-arrow-left" /></div>
                        <h3 class="font-bold text-xl text-primary-blue-100 mb-3">Incompatible Attribution</h3>
                        <p class="text-gray-600 leading-relaxed">Every platform uses its own attribution model. Google Ads claims last-click credit. Meta Ads claims assisted conversion. GA4 uses data-driven. None of them agree — so none of them are actionable.</p>
                    </div>
                    <div class="bg-white p-8 rounded-xl shadow-lg border border-gray-100 hover:-translate-y-2 hover:shadow-xl transition duration-300">
                        <div class="w-14 h-14 bg-blue-50 rounded-full flex items-center justify-center mb-5 text-primary-blue-100 text-2xl"><font-awesome icon="fas fa-hourglass-half" /></div>
                        <h3 class="font-bold text-xl text-primary-blue-100 mb-3">Tool Overhead Costs</h3>
                        <p class="text-gray-600 leading-relaxed">Paying for 5+ tools that don't talk to each other, plus the hours to maintain them. 54% of CMOs say connecting data from different sources is a major barrier — not an enabler.</p>
                    </div>
                </div>
            </div>
        </section>
        <section class="bg-primary-blue-100 w-full py-16 px-6">
            <div class="max-w-7xl mx-auto">
                <h2 class="font-bold text-white text-center text-4xl mb-4">How DRA Turns the Mess into One Plan</h2>
                <p class="text-blue-100 text-center text-lg mb-12 max-w-2xl mx-auto">Plan every channel. Track every result. End the guessing.</p>
                <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
                    <div class="bg-white p-8 rounded-xl shadow-lg border border-gray-100 hover:shadow-xl transition duration-300 hover:-translate-y-1">
                        <div class="text-3xl text-primary-blue-100 mb-4"><font-awesome icon="fas fa-wand-magic-sparkles" /></div>
                        <h3 class="text-xl font-bold text-primary-blue-100 mb-2">AI Paid Media Plan Builder</h3>
                        <p class="text-primary-blue-100/80 leading-relaxed">Point the AI at your website. It builds the channel-by-channel plan — no more deciding in the dark.</p>
                    </div>
                    <div class="bg-white p-8 rounded-xl shadow-lg border border-gray-100 hover:shadow-xl transition duration-300 hover:-translate-y-1">
                        <div class="text-3xl text-primary-blue-100 mb-4"><font-awesome icon="fas fa-scale-balanced" /></div>
                        <h3 class="text-xl font-bold text-primary-blue-100 mb-2">Channel-by-Channel Budgets</h3>
                        <p class="text-primary-blue-100/80 leading-relaxed">See recommended spend per channel with targets, so the plan decides where the money goes.</p>
                    </div>
                    <div class="bg-white p-8 rounded-xl shadow-lg border border-gray-100 hover:shadow-xl transition duration-300 hover:-translate-y-1">
                        <div class="text-3xl text-primary-blue-100 mb-4"><font-awesome icon="fas fa-plug" /></div>
                        <h3 class="text-xl font-bold text-primary-blue-100 mb-2">One-Click Channel Tracking</h3>
                        <p class="text-primary-blue-100/80 leading-relaxed">Connect Google Ads, Meta, Analytics, and Ad Manager via OAuth and track your plan's campaigns in one view.</p>
                    </div>
                    <div class="bg-white p-8 rounded-xl shadow-lg border border-gray-100 hover:shadow-xl transition duration-300 hover:-translate-y-1">
                        <div class="text-3xl text-primary-blue-100 mb-4"><font-awesome icon="fas fa-layer-group" /></div>
                        <h3 class="text-xl font-bold text-primary-blue-100 mb-2">Plan vs. Actuals</h3>
                        <p class="text-primary-blue-100/80 leading-relaxed">Compare what you planned with what each channel delivered. The argument ends with numbers.</p>
                    </div>
                    <div class="bg-white p-8 rounded-xl shadow-lg border border-gray-100 hover:shadow-xl transition duration-300 hover:-translate-y-1">
                        <div class="text-3xl text-primary-blue-100 mb-4"><font-awesome icon="fas fa-triangle-exclamation" /></div>
                        <h3 class="text-xl font-bold text-primary-blue-100 mb-2">Wasted-Spend Signals</h3>
                        <p class="text-primary-blue-100/80 leading-relaxed">AI flags channels and campaigns that underperform their targets so you can reallocate fast.</p>
                    </div>
                    <div class="bg-white p-8 rounded-xl shadow-lg border border-gray-100 hover:shadow-xl transition duration-300 hover:-translate-y-1">
                        <div class="text-3xl text-primary-blue-100 mb-4"><font-awesome icon="fas fa-users" /></div>
                        <h3 class="text-xl font-bold text-primary-blue-100 mb-2">Built for Marketing Teams</h3>
                        <p class="text-primary-blue-100/80 leading-relaxed">Made for CMOs and digital marketing teams. Plans and answers in minutes — no engineering tickets.</p>
                    </div>
                </div>
                <div class="flex justify-center mt-12"><div class="w-64"><combo-button label="Turn Your Stack Into a Plan" color="white" class="w-full h-12 shadow-lg cursor-pointer" @click="scrollToPricing" /></div></div>
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
                            { image: campaignPerformance, alt: 'Campaign performance dashboard with spend, conversions, and ROAS by campaign' }
                        ]" />
                    </div>
                    <div class="lg:w-1/2">
                        <h3 class="text-3xl font-bold text-primary-blue-100 mb-4">One Plan. Every Channel. One View.</h3>
                        <p class="text-gray-600 text-lg leading-relaxed mb-6">DRA builds the channel-by-channel plan from your website, then tracks every plan campaign across Google Ads, Meta, Analytics, and Ad Manager. You stop opening ten tabs to answer "what worked?"</p>
                        <ul class="space-y-3">
                            <li class="flex items-start gap-3"><div class="w-6 h-6 bg-green-100 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5"><font-awesome icon="fas fa-check" class="text-green-600 text-xs" /></div><span class="text-gray-700">Channel-by-channel plan from your website in minutes</span></li>
                            <li class="flex items-start gap-3"><div class="w-6 h-6 bg-green-100 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5"><font-awesome icon="fas fa-check" class="text-green-600 text-xs" /></div><span class="text-gray-700">Live tracking of every plan campaign across channels</span></li>
                            <li class="flex items-start gap-3"><div class="w-6 h-6 bg-green-100 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5"><font-awesome icon="fas fa-check" class="text-green-600 text-xs" /></div><span class="text-gray-700">Spend-to-results visibility per channel — no more 10 tabs</span></li>
                        </ul>
                    </div>
                </div>
                <div class="max-w-5xl mx-auto text-center mt-16">
                    <h2 class="text-3xl font-bold text-primary-blue-100 mb-4">The Cost of Guessing</h2>
                    <p class="text-gray-500 text-lg mb-12 max-w-2xl mx-auto">When tools don't talk to each other, budget follows gut feel instead of results.</p>
                    <div class="grid grid-cols-1 md:grid-cols-3 gap-8">
                        <div class="bg-primary-blue-100 rounded-xl p-6">
                            <div class="text-4xl font-bold text-white mb-2">25%</div>
                            <p class="text-blue-100">Of marketing budget wasted on average</p>
                        </div>
                        <div class="bg-primary-blue-100 rounded-xl p-6">
                            <div class="text-4xl font-bold text-white mb-2">54%</div>
                            <p class="text-blue-100">Of CMOs say connecting data is a major barrier</p>
                        </div>
                        <div class="bg-primary-blue-100 rounded-xl p-6">
                            <div class="text-4xl font-bold text-white mb-2">5-15</div>
                            <p class="text-blue-100">Tools one-third of CMOs rely on to measure ROI</p>
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
