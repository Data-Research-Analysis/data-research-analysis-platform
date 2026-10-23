<script setup lang="ts">
import templateAIImage from '/assets/images/template-ai.png';
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

const bookDemo = () => {
    if (import.meta.client) {
        window.location.href = '/enterprise-contact';
    }
};

const faqData = [
    { question: 'What causes marketing team burnout?', answer: 'Most people assume burnout is caused by workload. In marketing analytics, it\'s caused by drudgery — the repetitive planning, exporting, matching, and report-fixing that consumes hours every week instead of strategic work. DRA removes that work by building the plan and tracking the results automatically.' },
    { question: 'How does drudgery lead to talent loss?', answer: 'Your best people did not join marketing to become spreadsheet operators. When their days are filled with manual data work instead of campaign planning, optimization, and creative thinking — they leave. DRA automates the drudgery so your talent can do the work they were hired for.' },
    { question: 'Can marketing automation reduce team burnout?', answer: 'Yes. DRA automates the tasks that cause the most frustration: building the plan, connecting channels, and tracking results. By removing that repetitive work, your team reclaims hours every week for meaningful strategic work that engages and retains talent.' },
    { question: 'How do I convince my leadership to invest in tools that prevent burnout?', answer: 'Frame it as a retention and productivity investment. The average cost of turnover is $45,236 per employee, and replacing a senior leader costs about 200% of their annual salary (Gallup). A plan-and-track engine keeps your best people doing strategy instead of spreadsheets — and pays for itself.' }
];

// Inject structured data during setup so it is present in SSR HTML.
injectMultipleSchemas([
    getSoftwareApplicationSchema(),
    getFAQSchema(faqData),
]);

useHead({
    title: 'The Exhaustion Wall: Marketing Burnout Caused by Data Drudgery | DRA',
    meta: [
        { name: 'description', content: 'Talent burnout in marketing is caused by data drudgery, not workload. DRA builds the plan and tracks the results so your best people do strategy again.' },
        { name: 'robots', content: 'index, follow' },
        { property: 'og:title', content: 'The Exhaustion Wall — Marketing Burnout Caused by Data Drudgery | DRA' },
        { property: 'og:description', content: 'Talent burnout is caused by drudgery, not workload. DRA builds the plan and tracks the results so your team does strategy.' },
        { property: 'og:url', content: `${siteUrl}/exhaustion-wall` },
        { name: 'twitter:title', content: 'The Exhaustion Wall — Marketing Burnout Caused by Data Drudgery | DRA' },
        { name: 'twitter:description', content: 'Talent burnout is caused by drudgery, not workload. DRA builds the plan and tracks the results.' }
    ],
    link: [{ rel: 'canonical', href: `${siteUrl}/exhaustion-wall` }]
});
</script>
<template>
    <div>
        <payoff-block
            eyebrow="The Exhaustion Wall"
            headline="Your best people are quitting spreadsheets, not your company."
            sub="The engine plans and tracks for them. Your team gets its strategy time back."
            :stats="[
                { text: 'The average cost of turnover is $45,236 per employee.', tag: 'Research' },
                { text: 'Replacing a senior leader costs about 200% of their annual salary.', tag: 'Research' },
                { text: 'Marketing teams spend an average of 14.5 hours per week on data collection and preparation.', tag: 'Research' }
            ]"
            roi-strip="Retain talent. Protect the margin."
            :bullets="[
                'The AI builds the plan — no one owns a blank spreadsheet anymore.',
                'Channels connect and report automatically — no weekly data chores.',
                'Results update themselves — no one rebuilds reports.'
            ]"
            cta-label="End the exhaustion. Book a demo."
            :cta-action="bookDemo"
        />
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
        <section class="bg-primary-blue-100 w-full py-16 px-6">
            <div class="max-w-7xl mx-auto">
                <h2 class="font-bold text-white text-center text-4xl mb-4">How DRA Turns Drudgery Into Strategy</h2>
                <p class="text-blue-100 text-center text-lg mb-12 max-w-2xl mx-auto">Automate the boring work. Unleash your team's potential.</p>
                <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
                    <div class="bg-white p-8 rounded-xl shadow-lg border border-gray-100 hover:shadow-xl transition duration-300 hover:-translate-y-1">
                        <div class="text-3xl text-primary-blue-100 mb-4"><font-awesome icon="fas fa-wand-magic-sparkles" /></div>
                        <h3 class="text-xl font-bold text-primary-blue-100 mb-2">AI Plan Builder</h3>
                        <p class="text-primary-blue-100/80 leading-relaxed">Point Data Research Analysis at your website and get the channel-by-channel plan. No more blank spreadsheets on Monday morning.</p>
                    </div>
                    <div class="bg-white p-8 rounded-xl shadow-lg border border-gray-100 hover:shadow-xl transition duration-300 hover:-translate-y-1">
                        <div class="text-3xl text-primary-blue-100 mb-4"><font-awesome icon="fas fa-plug" /></div>
                        <h3 class="text-xl font-bold text-primary-blue-100 mb-2">One-Click Channel Tracking</h3>
                        <p class="text-primary-blue-100/80 leading-relaxed">Channels connect automatically and report back. No manual exports, no data pulls, no fragile spreadsheets.</p>
                    </div>
                    <div class="bg-white p-8 rounded-xl shadow-lg border border-gray-100 hover:shadow-xl transition duration-300 hover:-translate-y-1">
                        <div class="text-3xl text-primary-blue-100 mb-4"><font-awesome icon="fas fa-gauge-high" /></div>
                        <h3 class="text-xl font-bold text-primary-blue-100 mb-2">Auto-Updating Results</h3>
                        <p class="text-primary-blue-100/80 leading-relaxed">Campaign results update themselves. Your team never rebuilds a dashboard or re-runs a manual report.</p>
                    </div>
                    <div class="bg-white p-8 rounded-xl shadow-lg border border-gray-100 hover:shadow-xl transition duration-300 hover:-translate-y-1">
                        <div class="text-3xl text-primary-blue-100 mb-4"><font-awesome icon="fas fa-triangle-exclamation" /></div>
                        <h3 class="text-xl font-bold text-primary-blue-100 mb-2">Wasted-Spend Alerts</h3>
                        <p class="text-primary-blue-100/80 leading-relaxed">AI flags channels that miss their plan targets. Waste is caught automatically — nobody hunts for it.</p>
                    </div>
                    <div class="bg-white p-8 rounded-xl shadow-lg border border-gray-100 hover:shadow-xl transition duration-300 hover:-translate-y-1">
                        <div class="text-3xl text-primary-blue-100 mb-4"><font-awesome icon="fas fa-users" /></div>
                        <h3 class="text-xl font-bold text-primary-blue-100 mb-2">Team-Wide Visibility</h3>
                        <p class="text-primary-blue-100/80 leading-relaxed">Everyone works from the same plan and the same results — no more "whose spreadsheet is the right one?"</p>
                    </div>
                    <div class="bg-white p-8 rounded-xl shadow-lg border border-gray-100 hover:shadow-xl transition duration-300 hover:-translate-y-1">
                        <div class="text-3xl text-primary-blue-100 mb-4"><font-awesome icon="fas fa-heart" /></div>
                        <h3 class="text-xl font-bold text-primary-blue-100 mb-2">Work They Love</h3>
                        <p class="text-primary-blue-100/80 leading-relaxed">When your team stops wrestling with data and starts planning and optimizing, they remember why they joined marketing.</p>
                    </div>
                </div>
                <div class="flex justify-center mt-12"><div class="w-64"><combo-button label="Protect Your Talent" color="white" class="w-full h-12 shadow-lg cursor-pointer" @click="scrollToPricing" /></div></div>
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
                            { image: templateAIImage, alt: 'Report template preview in the report builder' },
                            { image: aiInsights1, alt: 'AI insights panel showing a campaign performance summary' },
                            { image: aiInsights2, alt: 'AI insights panel showing recommended budget shifts' },
                            { image: aiInsights3, alt: 'AI insights panel showing channel-level recommendations' },
                        ]" />
                    </div>
                    <div class="lg:w-1/2">
                        <h3 class="text-3xl font-bold text-primary-blue-100 mb-4">Let Your Team Plan and Optimize — Not Build Spreadsheets</h3>
                        <p class="text-gray-600 text-lg leading-relaxed mb-6">DRA's AI builds the channel-by-channel plan in minutes and tracks campaign results automatically. Your team spends their time on strategy, creative, and optimization — not data entry.</p>
                        <ul class="space-y-3">
                            <li class="flex items-start gap-3"><div class="w-6 h-6 bg-green-100 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5"><font-awesome icon="fas fa-check" class="text-green-600 text-xs" /></div><span class="text-gray-700">Plans built in minutes — no spreadsheet templates</span></li>
                            <li class="flex items-start gap-3"><div class="w-6 h-6 bg-green-100 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5"><font-awesome icon="fas fa-check" class="text-green-600 text-xs" /></div><span class="text-gray-700">Campaign results tracked automatically — no weekly data pulls</span></li>
                            <li class="flex items-start gap-3"><div class="w-6 h-6 bg-green-100 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5"><font-awesome icon="fas fa-check" class="text-green-600 text-xs" /></div><span class="text-gray-700">Budget shifts follow the plan — no manual re-allocation</span></li>
                        </ul>
                    </div>
                </div>
                <div class="max-w-5xl mx-auto text-center mt-16">
                    <h2 class="text-3xl font-bold text-primary-blue-100 mb-8">The Real Cost of Burnout</h2>
                    <div class="grid grid-cols-1 md:grid-cols-3 gap-8">
                        <div class="bg-primary-blue-100 rounded-xl p-6">
                            <div class="text-4xl font-bold text-white mb-2">$45,236</div>
                            <p class="text-blue-100">Average cost of turnover per employee</p>
                        </div>
                        <div class="bg-primary-blue-100 rounded-xl p-6">
                            <div class="text-4xl font-bold text-white mb-2">200%</div>
                            <p class="text-blue-100">Of salary to replace a senior leader</p>
                        </div>
                        <div class="bg-primary-blue-100 rounded-xl p-6">
                            <div class="text-4xl font-bold text-white mb-2">14.5h</div>
                            <p class="text-blue-100">Per week spent on data collection and preparation</p>
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
