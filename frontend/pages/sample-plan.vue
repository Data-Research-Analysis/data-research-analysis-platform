<script setup lang="ts">
const config = useRuntimeConfig();
const siteUrl = config.public.siteUrl || 'https://www.dataresearchanalysis.com';

useHead({
    title: 'Sample Client Media Plan | Data Research Analysis',
    meta: [
        { name: 'description', content: 'See everything a client plan includes: research, channel budgets and targets, creative brief, ad and landing-page copy, tracking setup, campaign build guide, QA checklist, and a client-ready deck. Illustrative example — not a customer result.' },
        { name: 'robots', content: 'index, follow' },
        { property: 'og:type', content: 'article' },
        { property: 'og:title', content: 'Sample Client Media Plan | Data Research Analysis' },
        { property: 'og:description', content: 'Not just targets — a full client plan: research, budgets, creative, copy, tracking, build guide, QA, and a deck.' },
        { property: 'og:url', content: `${siteUrl}/sample-plan` },
        { name: 'twitter:card', content: 'summary' },
        { name: 'twitter:title', content: 'Sample Client Media Plan | Data Research Analysis' },
        { name: 'twitter:description', content: 'Not just targets — a full client plan: research, budgets, creative, copy, tracking, build guide, QA, and a deck.' },
    ],
    link: [{ rel: 'canonical', href: `${siteUrl}/sample-plan` }],
});
</script>
<template>
    <div>
        <!-- Hero -->
        <section class="bg-primary-blue-100 w-full py-20 px-6">
            <div class="max-w-4xl mx-auto text-center">
                <p class="text-sm font-semibold uppercase tracking-widest text-blue-200 mb-4">Sample plan</p>
                <h1 class="font-bold text-white text-4xl md:text-5xl mb-4">See what a client plan actually includes</h1>
                <p class="text-blue-100 text-lg max-w-3xl mx-auto mb-8">
                    Not just targets — the full plan: market and competitor research, channel budgets and pacing, a creative brief, ad and landing-page copy, tracking setup, a campaign build guide, a QA checklist, and a client-ready deck.
                </p>
                <NuxtLink to="/" class="inline-block py-4 px-8 rounded-xl bg-white text-primary-blue-100 font-bold text-lg shadow-xl hover:bg-blue-50 transition-colors">
                    Build a free client plan
                </NuxtLink>
                <p class="text-xs text-blue-200/80 mt-4">Illustrative plan built from public data — not a customer result.</p>
            </div>
        </section>

        <!-- At a glance -->
        <section class="bg-white w-full py-16 px-6">
            <div class="max-w-5xl mx-auto">
                <h2 class="font-bold text-primary-blue-100 text-center text-3xl mb-10">Plan at a glance</h2>
                <div class="grid grid-cols-2 md:grid-cols-4 gap-6">
                    <div class="bg-gray-50 rounded-xl border border-gray-100 p-6 text-center">
                        <div class="text-3xl font-extrabold text-primary-blue-100">$18,000</div>
                        <p class="text-sm text-gray-500 mt-1">Monthly budget</p>
                    </div>
                    <div class="bg-gray-50 rounded-xl border border-gray-100 p-6 text-center">
                        <div class="text-3xl font-extrabold text-primary-blue-100">4</div>
                        <p class="text-sm text-gray-500 mt-1">Channels</p>
                    </div>
                    <div class="bg-gray-50 rounded-xl border border-gray-100 p-6 text-center">
                        <div class="text-3xl font-extrabold text-primary-blue-100">4.0x</div>
                        <p class="text-sm text-gray-500 mt-1">Blended ROAS target</p>
                    </div>
                    <div class="bg-gray-50 rounded-xl border border-gray-100 p-6 text-center">
                        <div class="text-3xl font-extrabold text-primary-blue-100">90</div>
                        <p class="text-sm text-gray-500 mt-1">Day flight</p>
                    </div>
                </div>
            </div>
        </section>

        <!-- Channel plan -->
        <section class="bg-primary-blue-100 w-full py-16 px-6">
            <div class="max-w-5xl mx-auto">
                <h2 class="font-bold text-white text-center text-3xl mb-3">Channel-by-channel media plan</h2>
                <p class="text-blue-100 text-center mb-10 max-w-2xl mx-auto">Where the money goes, what each channel is expected to return, who it targets, and what creative it needs.</p>
                <div class="overflow-hidden rounded-2xl bg-white shadow-lg">
                    <table class="w-full text-sm">
                        <thead class="bg-gray-50 text-left text-gray-500">
                            <tr>
                                <th class="py-3 px-5 font-medium">Channel</th>
                                <th class="py-3 px-5 font-medium">Monthly budget</th>
                                <th class="py-3 px-5 font-medium">Target</th>
                                <th class="py-3 px-5 font-medium">Audience</th>
                                <th class="py-3 px-5 font-medium">Creative</th>
                            </tr>
                        </thead>
                        <tbody class="divide-y divide-gray-100 text-gray-700">
                            <tr>
                                <td class="py-3 px-5 font-medium">Google Search</td>
                                <td class="py-3 px-5">$8,000</td>
                                <td class="py-3 px-5 text-green-600 font-semibold">4.0x ROAS</td>
                                <td class="py-3 px-5">Brand + non-brand search</td>
                                <td class="py-3 px-5">Responsive search ads + sitelinks</td>
                            </tr>
                            <tr>
                                <td class="py-3 px-5 font-medium">Google Performance Max</td>
                                <td class="py-3 px-5">$4,000</td>
                                <td class="py-3 px-5 text-green-600 font-semibold">3.8x ROAS</td>
                                <td class="py-3 px-5">Shopping + audience signals</td>
                                <td class="py-3 px-5">Product feed + asset group</td>
                            </tr>
                            <tr>
                                <td class="py-3 px-5 font-medium">Meta Prospecting</td>
                                <td class="py-3 px-5">$5,000</td>
                                <td class="py-3 px-5 text-green-600 font-semibold">3.5x ROAS</td>
                                <td class="py-3 px-5">Lookalike + broad</td>
                                <td class="py-3 px-5">UGC video + static</td>
                            </tr>
                            <tr>
                                <td class="py-3 px-5 font-medium">Meta Retargeting</td>
                                <td class="py-3 px-5">$1,000</td>
                                <td class="py-3 px-5 text-green-600 font-semibold">6.0x ROAS</td>
                                <td class="py-3 px-5">Site visitors + cart abandoners</td>
                                <td class="py-3 px-5">Dynamic product ads</td>
                            </tr>
                        </tbody>
                    </table>
                </div>
                <p class="text-xs text-blue-200/80 mt-4 text-center">Illustrative plan built from public data — not a customer result.</p>
            </div>
        </section>

        <!-- Deliverables -->
        <section class="bg-white w-full py-16 px-6">
            <div class="max-w-6xl mx-auto">
                <h2 class="font-bold text-primary-blue-100 text-center text-3xl mb-3">Everything in the plan</h2>
                <p class="text-primary-blue-100/70 text-center mb-12 max-w-2xl mx-auto">Eight deliverables, versioned in one place — so the plan is ready to pitch, launch, and prove.</p>
                <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
                    <div class="bg-gray-50 rounded-xl border border-gray-100 p-6">
                        <div class="text-2xl text-primary-blue-100 mb-3"><font-awesome icon="fas fa-file-lines" /></div>
                        <h3 class="font-bold text-primary-blue-100 mb-1">Media plan</h3>
                        <p class="text-sm text-gray-600">Channel budgets, targets, pacing, and flighting.</p>
                    </div>
                    <div class="bg-gray-50 rounded-xl border border-gray-100 p-6">
                        <div class="text-2xl text-primary-blue-100 mb-3"><font-awesome icon="fas fa-clipboard-list" /></div>
                        <h3 class="font-bold text-primary-blue-100 mb-1">Creative brief</h3>
                        <p class="text-sm text-gray-600">Objective, audience, offer, message, and formats.</p>
                    </div>
                    <div class="bg-gray-50 rounded-xl border border-gray-100 p-6">
                        <div class="text-2xl text-primary-blue-100 mb-3"><font-awesome icon="fas fa-comment" /></div>
                        <h3 class="font-bold text-primary-blue-100 mb-1">Ad copy</h3>
                        <p class="text-sm text-gray-600">Search headlines, descriptions, and social hooks.</p>
                    </div>
                    <div class="bg-gray-50 rounded-xl border border-gray-100 p-6">
                        <div class="text-2xl text-primary-blue-100 mb-3"><font-awesome icon="fas fa-image" /></div>
                        <h3 class="font-bold text-primary-blue-100 mb-1">Landing page copy</h3>
                        <p class="text-sm text-gray-600">Headline, subhead, proof, and CTA for the page.</p>
                    </div>
                    <div class="bg-gray-50 rounded-xl border border-gray-100 p-6">
                        <div class="text-2xl text-primary-blue-100 mb-3"><font-awesome icon="fas fa-plug" /></div>
                        <h3 class="font-bold text-primary-blue-100 mb-1">Tracking setup</h3>
                        <p class="text-sm text-gray-600">Conversion events, UTMs, GA4, and server-side.</p>
                    </div>
                    <div class="bg-gray-50 rounded-xl border border-gray-100 p-6">
                        <div class="text-2xl text-primary-blue-100 mb-3"><font-awesome icon="fas fa-diagram-project" /></div>
                        <h3 class="font-bold text-primary-blue-100 mb-1">Campaign build guide</h3>
                        <p class="text-sm text-gray-600">Campaign, ad set, and ad structure with naming.</p>
                    </div>
                    <div class="bg-gray-50 rounded-xl border border-gray-100 p-6">
                        <div class="text-2xl text-primary-blue-100 mb-3"><font-awesome icon="fas fa-check-circle" /></div>
                        <h3 class="font-bold text-primary-blue-100 mb-1">QA checklist</h3>
                        <p class="text-sm text-gray-600">Pre-launch checks so nothing ships broken.</p>
                    </div>
                    <div class="bg-gray-50 rounded-xl border border-gray-100 p-6">
                        <div class="text-2xl text-primary-blue-100 mb-3"><font-awesome icon="fas fa-file-powerpoint" /></div>
                        <h3 class="font-bold text-primary-blue-100 mb-1">Client strategy deck</h3>
                        <p class="text-sm text-gray-600">A 12-slide PPTX ready for the client meeting.</p>
                    </div>
                </div>
            </div>
        </section>

        <!-- Creative brief + ad copy -->
        <section class="bg-primary-blue-100 w-full py-16 px-6">
            <div class="max-w-6xl mx-auto">
                <h2 class="font-bold text-white text-center text-3xl mb-10">Creative brief &amp; ad copy</h2>
                <div class="grid grid-cols-1 lg:grid-cols-2 gap-8">
                    <div class="bg-white rounded-2xl p-8 shadow-lg">
                        <h3 class="font-bold text-primary-blue-100 text-xl mb-4">Creative brief</h3>
                        <dl class="space-y-3 text-sm">
                            <div><dt class="font-semibold text-gray-800">Objective</dt><dd class="text-gray-600">Grow online sales at a 4.0x blended ROAS.</dd></div>
                            <div><dt class="font-semibold text-gray-800">Primary audience</dt><dd class="text-gray-600">Women 25–44, US, value-conscious outdoor shoppers.</dd></div>
                            <div><dt class="font-semibold text-gray-800">Offer</dt><dd class="text-gray-600">15% off first order + free shipping over $75.</dd></div>
                            <div><dt class="font-semibold text-gray-800">Core message</dt><dd class="text-gray-600">"Gear that keeps up — without the markup."</dd></div>
                            <div><dt class="font-semibold text-gray-800">Formats</dt><dd class="text-gray-600">9:16 UGC video, 4:5 static, search RSA, shopping feed.</dd></div>
                        </dl>
                    </div>
                    <div class="bg-white rounded-2xl p-8 shadow-lg">
                        <h3 class="font-bold text-primary-blue-100 text-xl mb-4">Ad copy samples</h3>
                        <div class="space-y-5 text-sm">
                            <div>
                                <p class="text-xs font-semibold uppercase tracking-wide text-gray-400 mb-1">Google Search — headline</p>
                                <p class="text-gray-800 font-medium">Outdoor Gear That Lasts | 15% Off Your First Order</p>
                            </div>
                            <div>
                                <p class="text-xs font-semibold uppercase tracking-wide text-gray-400 mb-1">Google Search — description</p>
                                <p class="text-gray-700">Built for the trail, priced for real life. Free shipping over $75.</p>
                            </div>
                            <div>
                                <p class="text-xs font-semibold uppercase tracking-wide text-gray-400 mb-1">Meta — primary text</p>
                                <p class="text-gray-700">Your weekend deserves better gear. Get 15% off your first order — built to last, priced to move.</p>
                            </div>
                            <div>
                                <p class="text-xs font-semibold uppercase tracking-wide text-gray-400 mb-1">Meta — headline</p>
                                <p class="text-gray-800 font-medium">15% Off Outdoor Gear</p>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </section>

        <!-- Tracking + build -->
        <section class="bg-white w-full py-16 px-6">
            <div class="max-w-6xl mx-auto">
                <h2 class="font-bold text-primary-blue-100 text-center text-3xl mb-10">Tracking &amp; campaign build</h2>
                <div class="grid grid-cols-1 lg:grid-cols-2 gap-8">
                    <div class="bg-gray-50 rounded-2xl p-8 border border-gray-100">
                        <h3 class="font-bold text-primary-blue-100 text-xl mb-4">Tracking setup</h3>
                        <ul class="space-y-3 text-sm text-gray-700">
                            <li class="flex items-start gap-3"><font-awesome icon="fas fa-check" class="text-green-600 mt-1" /><span><strong>Conversion events:</strong> purchase, add_to_cart, begin_checkout, lead.</span></li>
                            <li class="flex items-start gap-3"><font-awesome icon="fas fa-check" class="text-green-600 mt-1" /><span><strong>Destinations:</strong> GA4, Google Ads, Meta CAPI.</span></li>
                            <li class="flex items-start gap-3"><font-awesome icon="fas fa-check" class="text-green-600 mt-1" /><span><strong>UTMs:</strong> source, medium, campaign, content on every ad.</span></li>
                            <li class="flex items-start gap-3"><font-awesome icon="fas fa-check" class="text-green-600 mt-1" /><span><strong>Server-side:</strong> events sent for iOS and cookie-limited traffic.</span></li>
                        </ul>
                    </div>
                    <div class="bg-gray-50 rounded-2xl p-8 border border-gray-100">
                        <h3 class="font-bold text-primary-blue-100 text-xl mb-4">Campaign build guide</h3>
                        <ul class="space-y-3 text-sm text-gray-700">
                            <li class="flex items-start gap-3"><font-awesome icon="fas fa-check" class="text-green-600 mt-1" /><span><strong>Google Search:</strong> 1 campaign, 4 ad groups (brand, non-brand, competitor, category).</span></li>
                            <li class="flex items-start gap-3"><font-awesome icon="fas fa-check" class="text-green-600 mt-1" /><span><strong>Performance Max:</strong> 1 campaign, 2 asset groups.</span></li>
                            <li class="flex items-start gap-3"><font-awesome icon="fas fa-check" class="text-green-600 mt-1" /><span><strong>Meta:</strong> 2 campaigns (prospecting, retargeting), 3 ad sets each.</span></li>
                            <li class="flex items-start gap-3"><font-awesome icon="fas fa-check" class="text-green-600 mt-1" /><span><strong>Naming:</strong> <code class="text-xs bg-white px-1.5 py-0.5 rounded border">channel_objective_audience_date</code>.</span></li>
                        </ul>
                    </div>
                </div>
            </div>
        </section>

        <!-- QA + deck + CTA -->
        <section class="bg-primary-blue-100 w-full py-16 px-6">
            <div class="max-w-6xl mx-auto">
                <h2 class="font-bold text-white text-center text-3xl mb-10">QA checklist &amp; client deck</h2>
                <div class="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-12">
                    <div class="bg-white rounded-2xl p-8 shadow-lg">
                        <h3 class="font-bold text-primary-blue-100 text-xl mb-4">Pre-launch QA</h3>
                        <ul class="space-y-2 text-sm text-gray-700">
                            <li class="flex items-start gap-2"><font-awesome icon="fas fa-check-circle" class="text-green-600 mt-0.5" /><span>Conversion tracking fires on test purchases.</span></li>
                            <li class="flex items-start gap-2"><font-awesome icon="fas fa-check-circle" class="text-green-600 mt-0.5" /><span>UTMs present on every ad and landing link.</span></li>
                            <li class="flex items-start gap-2"><font-awesome icon="fas fa-check-circle" class="text-green-600 mt-0.5" /><span>Landing page matches the ad's promise and offer.</span></li>
                            <li class="flex items-start gap-2"><font-awesome icon="fas fa-check-circle" class="text-green-600 mt-0.5" /><span>Budget caps, pacing, and flight dates set.</span></li>
                            <li class="flex items-start gap-2"><font-awesome icon="fas fa-check-circle" class="text-green-600 mt-0.5" /><span>Negative keywords and brand exclusions applied.</span></li>
                            <li class="flex items-start gap-2"><font-awesome icon="fas fa-check-circle" class="text-green-600 mt-0.5" /><span>Creative specs and aspect ratios correct.</span></li>
                        </ul>
                    </div>
                    <div class="bg-white rounded-2xl p-8 shadow-lg">
                        <h3 class="font-bold text-primary-blue-100 text-xl mb-4">Client strategy deck</h3>
                        <div class="rounded-xl border border-gray-200 bg-gray-50 p-5">
                            <div class="aspect-[16/9] rounded-lg bg-white border border-gray-200 p-4 flex flex-col justify-between">
                                <div>
                                    <p class="text-[10px] font-semibold uppercase tracking-widest text-gray-400">Q1 Paid Media Plan</p>
                                    <p class="text-lg font-bold text-primary-blue-100 mt-1">Northwind Outfitters</p>
                                </div>
                                <div class="flex items-end gap-2 h-16">
                                    <div class="w-1/5 bg-primary-blue-100/80 rounded-t" style="height: 55%"></div>
                                    <div class="w-1/5 bg-primary-blue-100/80 rounded-t" style="height: 70%"></div>
                                    <div class="w-1/5 bg-primary-blue-100/80 rounded-t" style="height: 45%"></div>
                                    <div class="w-1/5 bg-primary-blue-100/80 rounded-t" style="height: 85%"></div>
                                    <div class="w-1/5 bg-primary-blue-100/80 rounded-t" style="height: 62%"></div>
                                </div>
                                <p class="text-[10px] text-gray-400">12 slides · executive summary, channels, budgets, creative, tracking, timeline</p>
                            </div>
                        </div>
                        <p class="text-sm text-gray-600 mt-4">Export the full deck as PPTX on every plan.</p>
                    </div>
                </div>
                <div class="text-center">
                    <NuxtLink to="/" class="inline-block py-4 px-8 rounded-xl bg-white text-primary-blue-100 font-bold text-lg shadow-xl hover:bg-blue-50 transition-colors">
                        Build your own client plan
                    </NuxtLink>
                    <p class="text-xs text-blue-200/80 mt-4">Illustrative plan built from public data — not a customer result.</p>
                </div>
            </div>
        </section>

        <faq-section />
    </div>
</template>
