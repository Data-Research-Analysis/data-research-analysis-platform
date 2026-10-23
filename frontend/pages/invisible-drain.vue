<script setup lang="ts">
import templateAIImage from '/assets/images/template-ai.png';
import aiInsights1 from '/assets/images/ai-insights-1.png';
import aiInsights2 from '/assets/images/ai-insights-2.png';
import aiInsights3 from '/assets/images/ai-insights-3.png';
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
    { question: 'What is data drudgery in marketing?', answer: 'Data drudgery is the manual, repetitive work of extracting, cleaning, joining, and formatting data before you can actually analyze it. It is the VLOOKUP formulas, the CSV exports, and the manual reconciliations that consume hours of every week. DRA removes it by building the plan and tracking the results automatically.' },
    { question: 'How many hours do marketers waste on manual data work?', answer: 'Marketing teams spend an average of 14.5 hours per week collecting and preparing data (Treasure Data global survey). Marketers also spend over 10 hours per week on manual campaign optimization, costing North American agencies about $17,000 per employee per year (DoubleVerify, 2025). DRA replaces that work with an AI-built plan and automatic tracking.' },
    { question: 'What is the Monday Morning VLOOKUP Tax?', answer: 'The Monday Morning VLOOKUP Tax is the hours your team loses every Monday manually exporting data, running VLOOKUPs, and fixing broken spreadsheet formulas before they can do actual marketing work. DRA eliminates this completely: the AI builds the plan, channels connect automatically, and results update themselves.' },
    { question: 'How do I justify a marketing budget increase to my CFO?', answer: 'Show them the waste. The average organization wastes 25% of its marketing budget on efforts that do not drive revenue. DRA builds a channel-by-channel plan with targets and flags underperformance as it happens, so every dollar has a plan and a tracked result — not a spreadsheet.' }
];

// Inject structured data during setup so it is present in SSR HTML.
injectMultipleSchemas([
    getSoftwareApplicationSchema(),
    getFAQSchema(faqData),
]);

useHead({
    title: 'The Invisible Drain: Stop Wasting Hours on Manual Data Work | DRA',
    meta: [
        { name: 'description', content: 'Marketing teams spend 14.5 hours a week collecting and preparing data. DRA builds the plan and tracks the results so your team can focus on strategy, not spreadsheets.' },
        { name: 'robots', content: 'index, follow' },
        { property: 'og:title', content: 'The Invisible Drain — Stop Wasting Hours on Data Work | DRA' },
        { property: 'og:description', content: 'The AI builds the plan and tracks the results. Stop wasting hours on manual data work.' },
        { property: 'og:url', content: `${siteUrl}/invisible-drain` },
        { name: 'twitter:title', content: 'The Invisible Drain — Stop Wasting Hours on Data Work | DRA' },
        { name: 'twitter:description', content: 'The AI builds the plan and tracks the results. Stop wasting hours on manual data work.' }
    ],
    link: [{ rel: 'canonical', href: `${siteUrl}/invisible-drain` }]
});
</script>
<template>
    <div>
        <payoff-block
            eyebrow="The Invisible Drain"
            headline="14.5 hours a week, hidden inside your marketing budget."
            sub="The engine plans and tracks for you. The spreadsheets disappear."
            :stats="[
                { text: 'Marketing teams spend an average of 14.5 hours per week collecting and preparing data.', tag: 'Research' },
                { text: 'Marketers spend over 10 hours per week on manual campaign optimization, costing North American agencies about $17,000 per employee per year.', tag: 'Research' },
                { text: 'The AI builds the channel-by-channel plan and tracks campaign results automatically.', tag: 'Product' }
            ]"
            roi-strip="Reclaim the hours. Redirect them to strategy."
            :bullets="[
                'The AI builds the channel-by-channel plan — no more blank spreadsheets.',
                'Channels connect automatically and report back — no manual exports.',
                'Results update themselves — no rebuilding reports each week.'
            ]"
            cta-label="Stop the drain. Start free."
            :cta-action="startFree"
        />
        <section class="bg-white w-full py-16 px-6">
            <div class="max-w-7xl mx-auto">
                <h2 class="font-bold text-primary-blue-100 text-center text-4xl mb-4">Where the Hours Go</h2>
                <p class="text-gray-500 text-center text-lg mb-12 max-w-2xl mx-auto">The invisible tasks that drain your team's productive hours.</p>
                <div class="grid grid-cols-1 md:grid-cols-3 gap-8">
                    <div class="bg-white p-8 rounded-xl shadow-lg border border-gray-100 hover:-translate-y-2 hover:shadow-xl transition duration-300">
                        <div class="w-14 h-14 bg-orange-50 rounded-full flex items-center justify-center mb-5 text-orange-500 text-2xl"><font-awesome icon="fas fa-file-export" /></div>
                        <h3 class="font-bold text-xl text-primary-blue-100 mb-3">CSV Export Hell</h3>
                        <p class="text-gray-600 leading-relaxed">Exporting data from Google Ads, GA4, Google Ad Manager, and Meta. Formatting columns. Renaming headers. Saving to the right folder. Every Monday morning, same ritual — the Monday Morning VLOOKUP Tax.</p>
                    </div>
                    <div class="bg-white p-8 rounded-xl shadow-lg border border-gray-100 hover:-translate-y-2 hover:shadow-xl transition duration-300">
                        <div class="w-14 h-14 bg-orange-50 rounded-full flex items-center justify-center mb-5 text-orange-500 text-2xl"><font-awesome icon="fas fa-table" /></div>
                        <h3 class="font-bold text-xl text-primary-blue-100 mb-3">VLOOKUP & Spreadsheet Spaghetti</h3>
                        <p class="text-gray-600 leading-relaxed">Joining data from different exports using fragile VLOOKUP formulas. One cell shift breaks everything. Debugging takes hours. The VLOOKUP Tax compounds every week.</p>
                    </div>
                    <div class="bg-white p-8 rounded-xl shadow-lg border border-gray-100 hover:-translate-y-2 hover:shadow-xl transition duration-300">
                        <div class="w-14 h-14 bg-orange-50 rounded-full flex items-center justify-center mb-5 text-orange-500 text-2xl"><font-awesome icon="fas fa-wrench" /></div>
                        <h3 class="font-bold text-xl text-primary-blue-100 mb-3">Dashboard Maintenance</h3>
                        <p class="text-gray-600 leading-relaxed">Reports break. Data sources disconnect. Dashboards need updating. Someone on your team spends hours every week keeping the reporting infrastructure alive instead of doing strategic work.</p>
                    </div>
                </div>
            </div>
        </section>
        <section class="bg-primary-blue-100 w-full py-16 px-6">
            <div class="max-w-7xl mx-auto">
                <h2 class="font-bold text-white text-center text-4xl mb-4">How DRA Eliminates Data Drudgery</h2>
                <p class="text-blue-100 text-center text-lg mb-12 max-w-2xl mx-auto">The engine does the planning and tracking. Your team does strategy.</p>
                <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
                    <div class="bg-white p-8 rounded-xl shadow-lg border border-gray-100 hover:shadow-xl transition duration-300 hover:-translate-y-1">
                        <div class="text-3xl text-primary-blue-100 mb-4"><font-awesome icon="fas fa-wand-magic-sparkles" /></div>
                        <h3 class="text-xl font-bold text-primary-blue-100 mb-2">AI Plan Builder</h3>
                        <p class="text-primary-blue-100/80 leading-relaxed">Point Data Research Analysis at your website and get the channel-by-channel plan. No more starting from a blank spreadsheet.</p>
                    </div>
                    <div class="bg-white p-8 rounded-xl shadow-lg border border-gray-100 hover:shadow-xl transition duration-300 hover:-translate-y-1">
                        <div class="text-3xl text-primary-blue-100 mb-4"><font-awesome icon="fas fa-plug" /></div>
                        <h3 class="text-xl font-bold text-primary-blue-100 mb-2">One-Click Channel Connections</h3>
                        <p class="text-primary-blue-100/80 leading-relaxed">Connect Google Ads, Meta, Analytics, and Ad Manager with OAuth. No exports, no VLOOKUPs, no manual formatting.</p>
                    </div>
                    <div class="bg-white p-8 rounded-xl shadow-lg border border-gray-100 hover:shadow-xl transition duration-300 hover:-translate-y-1">
                        <div class="text-3xl text-primary-blue-100 mb-4"><font-awesome icon="fas fa-gauge-high" /></div>
                        <h3 class="text-xl font-bold text-primary-blue-100 mb-2">Auto-Updating Results</h3>
                        <p class="text-primary-blue-100/80 leading-relaxed">Campaign results update automatically as channels sync. No more Monday morning rebuilds.</p>
                    </div>
                    <div class="bg-white p-8 rounded-xl shadow-lg border border-gray-100 hover:shadow-xl transition duration-300 hover:-translate-y-1">
                        <div class="text-3xl text-primary-blue-100 mb-4"><font-awesome icon="fas fa-triangle-exclamation" /></div>
                        <h3 class="text-xl font-bold text-primary-blue-100 mb-2">Wasted-Spend Alerts</h3>
                        <p class="text-primary-blue-100/80 leading-relaxed">AI flags channels that miss their plan targets — so waste is caught early, not discovered in a spreadsheet weeks later.</p>
                    </div>
                    <div class="bg-white p-8 rounded-xl shadow-lg border border-gray-100 hover:shadow-xl transition duration-300 hover:-translate-y-1">
                        <div class="text-3xl text-primary-blue-100 mb-4"><font-awesome icon="fas fa-layer-group" /></div>
                        <h3 class="text-xl font-bold text-primary-blue-100 mb-2">Plan vs. Actuals</h3>
                        <p class="text-primary-blue-100/80 leading-relaxed">See every channel's performance against its target without joining spreadsheets. The answer is already there.</p>
                    </div>
                    <div class="bg-white p-8 rounded-xl shadow-lg border border-gray-100 hover:shadow-xl transition duration-300 hover:-translate-y-1">
                        <div class="text-3xl text-primary-blue-100 mb-4"><font-awesome icon="fas fa-users" /></div>
                        <h3 class="text-xl font-bold text-primary-blue-100 mb-2">Built for Marketing Teams</h3>
                        <p class="text-primary-blue-100/80 leading-relaxed">Made for CMOs and digital marketing teams. The hours return to strategy, optimization, and growth.</p>
                    </div>
                </div>
                <div class="flex justify-center mt-12"><div class="w-64"><combo-button label="Stop the Data Drudgery" color="white" class="w-full h-12 shadow-lg cursor-pointer" @click="scrollToPricing" /></div></div>
            </div>
        </section>
        <section class="bg-white w-full py-20 px-6 border-t border-gray-100">
            <div class="max-w-6xl mx-auto">
                <div class="flex flex-col lg:flex-row items-center gap-12">
                    <div class="lg:w-1/2">
                        <HeroCarousel :images="[
                            { image: templateAIImage, alt: 'Report template preview in the report builder' },
                            { image: aiInsights1, alt: 'AI insights panel showing a campaign performance summary' },
                            { image: aiInsights2, alt: 'AI insights panel showing recommended budget shifts' },
                            { image: aiInsights3, alt: 'AI insights panel showing channel-level recommendations' }
                        ]" />
                    </div>
                    <div class="lg:w-1/2">
                        <h3 class="text-3xl font-bold text-primary-blue-100 mb-4">The Plan Builds Itself. The Results Track Themselves.</h3>
                        <p class="text-gray-600 text-lg leading-relaxed mb-6">DRA's AI turns your website into a channel-by-channel plan in minutes, connects your channels automatically, and updates results as campaigns run. The manual exports, VLOOKUPs, and rebuilding disappear.</p>
                        <ul class="space-y-3">
                            <li class="flex items-start gap-3"><div class="w-6 h-6 bg-green-100 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5"><font-awesome icon="fas fa-check" class="text-green-600 text-xs" /></div><span class="text-gray-700">Channel-by-channel plan from your website in minutes</span></li>
                            <li class="flex items-start gap-3"><div class="w-6 h-6 bg-green-100 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5"><font-awesome icon="fas fa-check" class="text-green-600 text-xs" /></div><span class="text-gray-700">Channels sync automatically — no manual exports or VLOOKUPs</span></li>
                            <li class="flex items-start gap-3"><div class="w-6 h-6 bg-green-100 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5"><font-awesome icon="fas fa-check" class="text-green-600 text-xs" /></div><span class="text-gray-700">Results update themselves — never rebuild</span></li>
                        </ul>
                    </div>
                </div>
                <div class="max-w-5xl mx-auto text-center mt-16">
                    <h2 class="text-3xl font-bold text-primary-blue-100 mb-8">The Math Is Simple</h2>
                    <div class="grid grid-cols-1 md:grid-cols-3 gap-8">
                        <div class="bg-primary-blue-100 rounded-xl p-6">
                            <div class="text-4xl font-bold text-white mb-2">14.5h</div>
                            <p class="text-blue-100">Per week collecting and preparing data</p>
                        </div>
                        <div class="bg-primary-blue-100 rounded-xl p-6">
                            <div class="text-4xl font-bold text-white mb-2">10h+</div>
                            <p class="text-blue-100">Per week on manual campaign optimization</p>
                        </div>
                        <div class="bg-primary-blue-100 rounded-xl p-6">
                            <div class="text-4xl font-bold text-white mb-2">25%</div>
                            <p class="text-blue-100">Of marketing budget wasted on average</p>
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
