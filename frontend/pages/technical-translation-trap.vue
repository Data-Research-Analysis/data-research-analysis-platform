<script setup lang="ts">
import chatAIImage from '/assets/images/chat-ai.png';
import aiInsights1 from '/assets/images/ai-insights-1.png';
import aiInsights2 from '/assets/images/ai-insights-2.png';
import aiInsights3 from '/assets/images/ai-insights-3.png';
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
    { question: 'Why are CMOs acting as IT support for dashboards?', answer: 'Because most analytics tools are built for engineers, not marketers. When dashboards break, data stops flowing, or reports don\'t render, there is no one else to fix it. DRA avoids this by building the plan and tracking the results automatically — there is no pipeline for the CMO to maintain.' },
    { question: 'What is the Technical Translation Trap?', answer: 'The Technical Translation Trap is when marketing leaders must translate between business questions and technical tools. Instead of asking "what should our strategy be?", the CMO asks "why is the query failing?" or "which API key do I use?". DRA removes the technical layer: plan every channel, connect it in one click, and let tracking update itself.' },
    { question: 'Is there a simpler alternative to GA4 for marketing analytics?', answer: 'Yes — DRA is built specifically for marketers who want to plan and improve paid media without platform complexity. Enter your website to get a channel-by-channel plan, connect Google Ads, Meta, Analytics, and Ad Manager, and track how campaigns perform. No technical setup on your side.' },
    { question: 'Do I need a data scientist to use DRA?', answer: 'No. DRA is designed for CMOs and marketing teams who want to plan spend and track results without tickets to the data team. The AI builds the plan and surfaces what needs attention — the technical work is handled.' }
];

// Inject structured data during setup so it is present in SSR HTML.
injectMultipleSchemas([
    getSoftwareApplicationSchema(),
    getFAQSchema(faqData),
]);

useHead({
    title: 'The Technical Translation Trap: Stop Being IT Support for Dashboards | DRA',
    meta: [
        { name: 'description', content: 'CMOs are playing IT support for broken dashboards. DRA removes the technical layer — the AI builds the plan and tracks the results.' },
        { name: 'robots', content: 'index, follow' },
        { property: 'og:title', content: 'The Technical Translation Trap — Built for Marketers | DRA' },
        { property: 'og:description', content: 'CMOs are playing IT support for broken dashboards. DRA builds the plan and tracks the results.' },
        { property: 'og:url', content: `${siteUrl}/technical-translation-trap` },
        { name: 'twitter:title', content: 'The Technical Translation Trap — Built for Marketers | DRA' },
        { name: 'twitter:description', content: 'CMOs are playing IT support for broken dashboards. DRA builds the plan and tracks the results.' }
    ],
    link: [{ rel: 'canonical', href: `${siteUrl}/technical-translation-trap` }]
});
</script>
<template>
    <div>
        <payoff-block
            eyebrow="The Technical Translation Trap"
            headline="You were hired for strategy, not SQL."
            sub="No pipeline to maintain. No tickets. The engine plans and tracks for you."
            :stats="[
                { text: 'Marketers spend over 10 hours per week on manual tasks that AI and automation can remove.', tag: 'Research' },
                { text: '54% of CMOs say connecting data from different sources is a major barrier.', tag: 'Research' },
                { text: 'The AI turns your website into a channel-by-channel plan in minutes.', tag: 'Product' }
            ]"
            roi-strip="Delete the translation tax."
            :bullets="[
                'The plan builder does the work — no technical setup behind the scenes.',
                'Channels connect in one click and stay connected.',
                'Answers when you need them — not after a 3-day ticket.'
            ]"
            cta-label="Build it yourself. Start free."
            :cta-action="startFree"
        />
        <section class="bg-white w-full py-16 px-6">
            <div class="max-w-7xl mx-auto">
                <h2 class="font-bold text-primary-blue-100 text-center text-4xl mb-4">The Technical Translation Trap</h2>
                <p class="text-gray-500 text-center text-lg mb-12 max-w-2xl mx-auto">Three ways technical overhead steals your strategic time — and how DRA fixes each.</p>
                <div class="grid grid-cols-1 md:grid-cols-3 gap-8">
                    <div class="bg-white p-8 rounded-xl shadow-lg border border-gray-100 hover:-translate-y-2 hover:shadow-xl transition duration-300">
                        <div class="w-14 h-14 bg-teal-50 rounded-full flex items-center justify-center mb-5 text-teal-500 text-2xl"><font-awesome icon="fas fa-headset" /></div>
                        <h3 class="font-bold text-xl text-primary-blue-100 mb-3">Dashboard as Help Desk</h3>
                        <p class="text-gray-600 leading-relaxed">When a dashboard breaks, the team doesn't call IT — they call the CMO. You're troubleshooting data connections instead of planning the next quarter's strategy.</p>
                    </div>
                    <div class="bg-white p-8 rounded-xl shadow-lg border border-gray-100 hover:-translate-y-2 hover:shadow-xl transition duration-300">
                        <div class="w-14 h-14 bg-teal-50 rounded-full flex items-center justify-center mb-5 text-teal-500 text-2xl"><font-awesome icon="fas fa-code" /></div>
                        <h3 class="font-bold text-xl text-primary-blue-100 mb-3">The SQL Tax</h3>
                        <p class="text-gray-600 leading-relaxed">Every new question requires a new query. Every query needs a data engineer. Every ticket takes 3 days. By the time you get the answer, the question has changed. DRA eliminates the bottleneck.</p>
                    </div>
                    <div class="bg-white p-8 rounded-xl shadow-lg border border-gray-100 hover:-translate-y-2 hover:shadow-xl transition duration-300">
                        <div class="w-14 h-14 bg-teal-50 rounded-full flex items-center justify-center mb-5 text-teal-500 text-2xl"><font-awesome icon="fas fa-screwdriver-wrench" /></div>
                        <h3 class="font-bold text-xl text-primary-blue-100 mb-3">Tool Configuration Overhead</h3>
                        <p class="text-gray-600 leading-relaxed">Setting up GA4 properties, configuring API integrations, managing OAuth tokens, maintaining custom dimensions — this is not marketing strategy. Yet CMOs spend hours on it every week.</p>
                    </div>
                </div>
            </div>
        </section>
        <section class="bg-primary-blue-100 w-full py-16 px-6">
            <div class="max-w-7xl mx-auto">
                <h2 class="font-bold text-white text-center text-4xl mb-4">How DRA Removes the Technical Layer</h2>
                <p class="text-blue-100 text-center text-lg mb-12 max-w-2xl mx-auto">Built for marketers. The technical work is handled.</p>
                <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
                    <div class="bg-white p-8 rounded-xl shadow-lg border border-gray-100 hover:shadow-xl transition duration-300 hover:-translate-y-1">
                        <div class="text-3xl text-primary-blue-100 mb-4"><font-awesome icon="fas fa-wand-magic-sparkles" /></div>
                        <h3 class="text-xl font-bold text-primary-blue-100 mb-2">AI Paid Media Plan Builder</h3>
                        <p class="text-primary-blue-100/80 leading-relaxed">Point the AI at your website and get the channel-by-channel plan. The technical work is done for you.</p>
                    </div>
                    <div class="bg-white p-8 rounded-xl shadow-lg border border-gray-100 hover:shadow-xl transition duration-300 hover:-translate-y-1">
                        <div class="text-3xl text-primary-blue-100 mb-4"><font-awesome icon="fas fa-plug" /></div>
                        <h3 class="text-xl font-bold text-primary-blue-100 mb-2">One-Click Channel Tracking</h3>
                        <p class="text-primary-blue-100/80 leading-relaxed">Connect Google Ads, Meta, Analytics, and Ad Manager via OAuth. No API keys to manage, no tokens to refresh.</p>
                    </div>
                    <div class="bg-white p-8 rounded-xl shadow-lg border border-gray-100 hover:shadow-xl transition duration-300 hover:-translate-y-1">
                        <div class="text-3xl text-primary-blue-100 mb-4"><font-awesome icon="fas fa-gauge-high" /></div>
                        <h3 class="text-xl font-bold text-primary-blue-100 mb-2">Auto-Updating Results</h3>
                        <p class="text-primary-blue-100/80 leading-relaxed">Campaign results update themselves. No rebuilding dashboards, no detective work finding why a report went blank.</p>
                    </div>
                    <div class="bg-white p-8 rounded-xl shadow-lg border border-gray-100 hover:shadow-xl transition duration-300 hover:-translate-y-1">
                        <div class="text-3xl text-primary-blue-100 mb-4"><font-awesome icon="fas fa-triangle-exclamation" /></div>
                        <h3 class="text-xl font-bold text-primary-blue-100 mb-2">Wasted-Spend Alerts</h3>
                        <p class="text-primary-blue-100/80 leading-relaxed">AI flags channels that miss their plan targets, so issues surface on their own — you don't hunt for them.</p>
                    </div>
                    <div class="bg-white p-8 rounded-xl shadow-lg border border-gray-100 hover:shadow-xl transition duration-300 hover:-translate-y-1">
                        <div class="text-3xl text-primary-blue-100 mb-4"><font-awesome icon="fas fa-lightbulb" /></div>
                        <h3 class="text-xl font-bold text-primary-blue-100 mb-2">Answers, Not Queries</h3>
                        <p class="text-primary-blue-100/80 leading-relaxed">Ask why a channel underperformed and get the answer with supporting data. No query, no ticket, no wait.</p>
                    </div>
                    <div class="bg-white p-8 rounded-xl shadow-lg border border-gray-100 hover:shadow-xl transition duration-300 hover:-translate-y-1">
                        <div class="text-3xl text-primary-blue-100 mb-4"><font-awesome icon="fas fa-shield" /></div>
                        <h3 class="text-xl font-bold text-primary-blue-100 mb-2">Built for Marketers</h3>
                        <p class="text-primary-blue-100/80 leading-relaxed">Every feature is designed for marketing executives. No engineering background required — your team owns its own marketing spend.</p>
                    </div>
                </div>
                <div class="flex justify-center mt-12"><div class="w-64"><combo-button label="Escape the Trap" color="white" class="w-full h-12 shadow-lg cursor-pointer" @click="scrollToPricing" /></div></div>
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
                            { image: chatAIImage, alt: 'AI chat interface answering a marketing performance question' },
                            { image: aiInsights1, alt: 'AI insights panel showing a campaign performance summary' },
                            { image: aiInsights2, alt: 'AI insights panel showing recommended budget shifts' },
                            { image: aiInsights3, alt: 'AI insights panel showing channel-level recommendations' }
                        ]" />
                    </div>
                    <div class="lg:w-1/2">
                        <h3 class="text-3xl font-bold text-primary-blue-100 mb-4">The Plan Builds Itself. The Results Track Themselves.</h3>
                        <p class="text-gray-600 text-lg leading-relaxed mb-6">DRA turns your website into a channel-by-channel plan in minutes and tracks how those campaigns perform — so you focus on strategy, not systems.</p>
                        <ul class="space-y-3">
                            <li class="flex items-start gap-3"><div class="w-6 h-6 bg-green-100 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5"><font-awesome icon="fas fa-check" class="text-green-600 text-xs" /></div><span class="text-gray-700">Channel-by-channel plan from your website in minutes</span></li>
                            <li class="flex items-start gap-3"><div class="w-6 h-6 bg-green-100 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5"><font-awesome icon="fas fa-check" class="text-green-600 text-xs" /></div><span class="text-gray-700">One-click channel connections — nothing to maintain</span></li>
                            <li class="flex items-start gap-3"><div class="w-6 h-6 bg-green-100 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5"><font-awesome icon="fas fa-check" class="text-green-600 text-xs" /></div><span class="text-gray-700">AI flags when campaigns miss their targets</span></li>
                        </ul>
                    </div>
                </div>
                <div class="max-w-5xl mx-auto text-center mt-16">
                    <h2 class="text-3xl font-bold text-primary-blue-100 mb-8">The Technical Tax</h2>
                    <div class="grid grid-cols-1 md:grid-cols-3 gap-8">
                        <div class="bg-primary-blue-100 rounded-xl p-6">
                            <div class="text-4xl font-bold text-white mb-2">10h+</div>
                            <p class="text-blue-100">Per week on manual tasks AI can remove</p>
                        </div>
                        <div class="bg-primary-blue-100 rounded-xl p-6">
                            <div class="text-4xl font-bold text-white mb-2">Minutes</div>
                            <p class="text-blue-100">A channel-by-channel plan built from your website</p>
                        </div>
                        <div class="bg-primary-blue-100 rounded-xl p-6">
                            <div class="text-4xl font-bold text-white mb-2">Zero</div>
                            <p class="text-blue-100">Pipeline, queries, or engineering tickets to manage</p>
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
