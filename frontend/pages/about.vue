<script setup lang="ts">
const config = useRuntimeConfig();
const siteUrl = config.public.siteUrl || 'https://www.dataresearchanalysis.com';

useHead({
    title: 'About Data Research Analysis | Plan → Prove',
    meta: [
        { name: 'description', content: 'Data Research Analysis is an AI paid-media operating system built by Data Research Analysis (SMC-Private) Limited in Lahore, Pakistan. Meet the team, verifications, and security practices.' },
        { name: 'robots', content: 'index, follow' },
        { property: 'og:type', content: 'website' },
        { property: 'og:title', content: 'About Data Research Analysis' },
        { property: 'og:description', content: 'The team, verifications, and security practices behind Plan → Prove.' },
        { property: 'og:url', content: `${siteUrl}/about` },
        { name: 'twitter:card', content: 'summary' },
        { name: 'twitter:title', content: 'About Data Research Analysis' },
        { name: 'twitter:description', content: 'The team, verifications, and security practices behind Plan → Prove.' },
    ],
    link: [{ rel: 'canonical', href: `${siteUrl}/about` }],
});

const securityPoints = [
    'Connection credentials, MongoDB connection strings, and OAuth tokens are encrypted at rest with AES-256-GCM.',
    'JWT authentication with role-based access control at the organization, workspace, and project level.',
    'Rate limiting, and SELECT-only AI SQL with table allow-listing, so generated queries cannot write to your data.',
    'DOMPurify XSS sanitization and encrypted Redis OAuth sessions with a 15-minute TTL.',
    'SAML 2.0 SSO with JIT provisioning and replay protection on Enterprise.',
    'Data export, deletion, and configurable retention controls support GDPR-aligned workflows.',
];
</script>
<template>
    <div>
        <section class="bg-primary-blue-100 w-full py-20 px-6">
            <div class="max-w-4xl mx-auto text-center">
                <p class="text-sm font-semibold uppercase tracking-widest text-blue-200 mb-4">About</p>
                <h1 class="font-bold text-white text-4xl md:text-5xl mb-4">We build the plan-and-prove loop for paid media</h1>
                <p class="text-blue-100 text-lg max-w-3xl mx-auto">
                    Data Research Analysis is an AI paid-media operating system built around one loop: Plan → Prove. Plan Studio turns a website and brief into a channel-by-channel plan and client-ready deck; Campaign Intelligence connects live ad accounts and proves what worked.
                </p>
            </div>
        </section>

        <section class="bg-white w-full py-16 px-6">
            <div class="max-w-5xl mx-auto grid grid-cols-1 lg:grid-cols-2 gap-10">
                <div>
                    <h2 class="font-bold text-primary-blue-100 text-3xl mb-4">Why we built it</h2>
                    <p class="text-gray-600 leading-relaxed mb-4">
                        Paid media teams still plan in spreadsheets and slide decks, then wait weeks for measurement in a separate BI tool. The plan and the proof never live in the same place, so every renewal turns into a screenshot hunt.
                    </p>
                    <p class="text-gray-600 leading-relaxed">
                        DRA closes that loop: the plan writes targets into campaign records, and live results are compared against those targets — so you can defend every dollar with the plan and the actuals side by side.
                    </p>
                </div>
                <div class="bg-gray-50 rounded-2xl border border-gray-100 p-8">
                    <h2 class="font-bold text-primary-blue-100 text-2xl mb-4">The company</h2>
                    <dl class="space-y-3 text-sm">
                        <div>
                            <dt class="font-semibold text-gray-800">Legal entity</dt>
                            <dd class="text-gray-600">Data Research Analysis (SMC-Private) Limited</dd>
                        </div>
                        <div>
                            <dt class="font-semibold text-gray-800">Founder</dt>
                            <dd class="text-gray-600">Mustafa Neguib — <a href="https://github.com/mustafaneguib" target="_blank" rel="noopener" class="text-blue-600 hover:underline">@mustafaneguib</a></dd>
                        </div>
                        <div>
                            <dt class="font-semibold text-gray-800">Headquarters</dt>
                            <dd class="text-gray-600">Lahore, Punjab, Pakistan</dd>
                        </div>
                        <div>
                            <dt class="font-semibold text-gray-800">Contact</dt>
                            <dd class="text-gray-600"><a href="mailto:hello@dataresearchanalysis.com" class="text-blue-600 hover:underline">hello@dataresearchanalysis.com</a></dd>
                        </div>
                        <div>
                            <dt class="font-semibold text-gray-800">Source</dt>
                            <dd class="text-gray-600">
                                The platform is open source (MIT) on
                                <a href="https://github.com/Data-Research-Analysis/data-research-analysis-platform" target="_blank" rel="noopener" class="text-blue-600 hover:underline">GitHub</a>.
                            </dd>
                        </div>
                    </dl>
                </div>
            </div>
        </section>

        <partner-trust-badges />

        <section class="bg-primary-blue-100 w-full py-16 px-6">
            <div class="max-w-5xl mx-auto">
                <h2 class="font-bold text-white text-center text-3xl mb-4">Security and data handling</h2>
                <p class="text-blue-100 text-center max-w-2xl mx-auto mb-12">
                    You connect live ad accounts and production databases, so we treat access and data handling as a first-class part of the product.
                </p>
                <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div v-for="point in securityPoints" :key="point" class="bg-white/10 ring-1 ring-white/25 backdrop-blur rounded-lg p-5 flex items-start gap-3">
                        <font-awesome-icon :icon="['fas', 'shield-halved']" class="text-green-300 mt-0.5 flex-shrink-0" />
                        <span class="text-sm text-white">{{ point }}</span>
                    </div>
                </div>
            </div>
        </section>

        <section class="bg-white w-full py-16 px-6">
            <div class="max-w-3xl mx-auto text-center">
                <h2 class="font-bold text-primary-blue-100 text-3xl mb-4">Work with us</h2>
                <p class="text-gray-600 leading-relaxed mb-6">
                    We are looking for a small number of agencies to run DRA on live client accounts as design partners. If you want to be one of the first published case studies, we will onboard you directly and work alongside your team.
                </p>
                <div class="flex flex-col sm:flex-row gap-3 justify-center">
                    <NuxtLink to="/enterprise-contact" class="inline-block py-3 px-6 rounded-xl bg-primary-blue-100 text-white font-bold shadow-lg hover:bg-primary-blue-300 transition-colors">
                        Talk to us
                    </NuxtLink>
                    <NuxtLink to="/register" class="inline-block py-3 px-6 rounded-xl bg-white text-primary-blue-100 font-bold border border-primary-blue-100 shadow-sm hover:bg-blue-50 transition-colors">
                        Start free
                    </NuxtLink>
                </div>
            </div>
        </section>
    </div>
</template>
