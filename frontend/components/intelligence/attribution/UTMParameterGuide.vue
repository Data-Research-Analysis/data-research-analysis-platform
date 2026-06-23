<script setup lang="ts">
interface Props {
    show: boolean
}

interface Emits {
    (e: 'close'): void
}

defineProps<Props>()
defineEmits<Emits>()

const activePlatform = ref<'google' | 'meta'>('google')
const testUrl = ref('')
const parsedUtm = ref<Record<string, string> | null>(null)
const parseError = ref('')

const funnelStages = [
    { name: 'Awareness', description: 'Impressions, Reach, Views', color: 'bg-blue-50 border-blue-200' },
    { name: 'Interest', description: 'Clicks, Visits, Sessions', color: 'bg-indigo-50 border-indigo-200' },
    { name: 'Consideration', description: 'Leads, Signups, Add to Cart', color: 'bg-purple-50 border-purple-200' },
    { name: 'Intent', description: 'Demo Requests, Qualified Leads, Checkout', color: 'bg-amber-50 border-amber-200' },
    { name: 'Conversion', description: 'Purchases, Orders, Sales', color: 'bg-emerald-50 border-emerald-200' },
]

const utmTemplates = {
    google: `{lpurl}?utm_source=google&utm_medium={network}&utm_campaign={campaignid}&utm_term={keyword}&utm_content={creative}`,
    google_suffix: `utm_source=google&utm_medium={network}&utm_campaign={campaignid}&utm_term={keyword}&utm_content={creative}`,
    meta: `utm_source=meta&utm_medium={{ad.medium}}&utm_campaign={{campaign.name}}&utm_content={{ad.name}}&utm_term={{ad.keyword}}`,
}

const googleSteps = [
    { label: 'Navigate to Google Ads', detail: 'Go to Campaigns > Settings > Campaign-level Tracking template' },
    { label: 'Find Tracking Template', detail: 'In the "Tracking" section, locate the "Tracking template" field (or "Final URL suffix" for simpler setup)' },
    { label: 'Paste the Template', detail: 'Copy the template below and paste it into the Tracking template field' },
    { label: 'Apply to All Campaigns', detail: 'For consistency, set the template at Account level or use a shared tracking template' },
]

const metaSteps = [
    { label: 'Open Ad Settings', detail: 'In Meta Ads Manager, go to your Ad level > "Tracking" section' },
    { label: 'Find URL Parameters', detail: 'Locate the "URL Parameters" field (you can also set at Campaign or Ad Set level)' },
    { label: 'Paste Parameters', detail: 'Copy the template below and paste it into the URL Parameters field' },
    { label: 'Verify with Preview', detail: 'Use the URL preview button to verify parameters are being appended correctly' },
]

const recommendedMapping = [
    { stage: 'Awareness', google: 'utm_medium=display OR utm_campaign=brand_awareness', meta: 'utm_medium=social OR utm_campaign=tof_' },
    { stage: 'Interest', google: 'utm_medium=cpc&utm_content=blog', meta: 'utm_medium=paid_social&utm_content=video' },
    { stage: 'Consideration', google: 'utm_campaign=lead_gen&utm_content=whitepaper', meta: 'utm_campaign=mof_&utm_content=lead_form' },
    { stage: 'Intent', google: 'utm_campaign=demo_request&utm_content=cta', meta: 'utm_campaign=bof_&utm_content=checkout' },
    { stage: 'Conversion', google: 'utm_campaign=purchase&utm_content=checkout', meta: 'utm_campaign=purchase&utm_content=checkout' },
]

function parseTestUrl() {
    parsedUtm.value = null
    parseError.value = ''
    if (!testUrl.value.trim()) return
    try {
        const url = new URL(testUrl.value)
        const params = url.searchParams
        const utm: Record<string, string> = {}
        const utmFields = ['utm_source', 'utm_medium', 'utm_campaign', 'utm_term', 'utm_content']
        for (const field of utmFields) {
            const val = params.get(field)
            if (val) utm[field] = val
        }
        if (Object.keys(utm).length === 0) {
            parseError.value = 'No UTM parameters found in this URL'
            return
        }
        parsedUtm.value = utm
    } catch {
        parseError.value = 'Invalid URL format. Please enter a complete URL (e.g., https://example.com/page?utm_source=google)'
    }
}

function copyTemplate(text: string) {
    const { $swal } = useNuxtApp() as any
    navigator.clipboard.writeText(text).then(() => {
        $swal.fire({
            icon: 'success',
            title: 'Copied!',
            text: 'UTM template copied to clipboard',
            timer: 1500,
            showConfirmButton: false,
        })
    }).catch(() => {
        $swal.fire({
            icon: 'error',
            title: 'Copy Failed',
            text: 'Unable to copy to clipboard. Please select and copy manually.',
        })
    })
}
</script>

<template>
    <overlay-dialog v-if="show" @close="$emit('close')" :enable-scrolling="true" :y-offset="40">
        <template #overlay>
            <div class="w-full max-w-4xl mx-auto">
                <!-- Header -->
                <div class="flex items-center justify-between mb-6">
                    <div>
                        <h2 class="text-2xl font-bold text-gray-900">UTM Parameter Setup Guide</h2>
                        <p class="text-sm text-gray-500 mt-1">
                            Configure your Google Ads and Meta Ads campaigns to send funnel data to this system
                        </p>
                    </div>
                    <button
                        class="p-2 bg-transparent text-gray-400 hover:text-gray-600 rounded-lg cursor-pointer transition-colors"
                        @click="$emit('close')"
                    >
                        <font-awesome-icon :icon="['fas', 'xmark']" class="w-5 h-5" />
                    </button>
                </div>

                <!-- Platform Tabs -->
                <div class="flex gap-2 mb-6">
                    <button
                        class="flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium transition-colors cursor-pointer"
                        :class="activePlatform === 'google' ? 'bg-blue-500 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'"
                        @click="activePlatform = 'google'"
                    >
                        <font-awesome-icon :icon="['fab', 'google']" class="w-4 h-4" />
                        Google Ads
                    </button>
                    <button
                        class="flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium transition-colors cursor-pointer"
                        :class="activePlatform === 'meta' ? 'bg-blue-500 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'"
                        @click="activePlatform = 'meta'"
                    >
                        <font-awesome-icon :icon="['fab', 'meta']" class="w-4 h-4" />
                        Meta Ads
                    </button>
                </div>

                <!-- Google Ads Guide -->
                <div v-if="activePlatform === 'google'" class="space-y-6">
                    <!-- Setup Steps -->
                    <div class="bg-white border border-gray-200 rounded-xl p-5">
                        <h3 class="text-base font-semibold text-gray-800 mb-4">Setup Steps</h3>
                        <div class="flex flex-col gap-3">
                            <div
                                v-for="(step, idx) in googleSteps"
                                :key="idx"
                                class="flex items-start gap-3 p-3 bg-gray-50 rounded-lg"
                            >
                                <div class="w-7 h-7 rounded-full bg-blue-500 text-white flex items-center justify-center text-xs font-bold shrink-0 mt-0.5">
                                    {{ idx + 1 }}
                                </div>
                                <div>
                                    <p class="text-sm font-medium text-gray-800">{{ step.label }}</p>
                                    <p class="text-xs text-gray-500 mt-0.5">{{ step.detail }}</p>
                                </div>
                            </div>
                        </div>
                    </div>

                    <!-- Tracking Template -->
                    <div class="bg-white border border-gray-200 rounded-xl p-5">
                        <div class="flex items-center justify-between mb-3">
                            <h3 class="text-base font-semibold text-gray-800">Tracking Template</h3>
                            <button
                                class="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-blue-600 bg-blue-50 rounded-lg hover:bg-blue-100 transition-colors cursor-pointer"
                                @click="copyTemplate(utmTemplates.google)"
                            >
                                <font-awesome-icon :icon="['fas', 'copy']" class="w-3 h-3" />
                                Copy
                            </button>
                        </div>
                        <div class="bg-gray-900 text-green-400 rounded-lg p-4 text-xs font-mono leading-relaxed break-all select-all">
                            {{ utmTemplates.google }}
                        </div>
                        <p class="text-xs text-gray-500 mt-2">
                            Paste this into <strong>Tracking template</strong> at Account → Settings → Tracking URL
                        </p>
                    </div>

                    <!-- Final URL Suffix (Alternative) -->
                    <div class="bg-white border border-gray-200 rounded-xl p-5">
                        <div class="flex items-center justify-between mb-3">
                            <h3 class="text-base font-semibold text-gray-800">Final URL Suffix (Simpler Alternative)</h3>
                            <button
                                class="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-blue-600 bg-blue-50 rounded-lg hover:bg-blue-100 transition-colors cursor-pointer"
                                @click="copyTemplate(utmTemplates.google_suffix)"
                            >
                                <font-awesome-icon :icon="['fas', 'copy']" class="w-3 h-3" />
                                Copy
                            </button>
                        </div>
                        <div class="bg-gray-900 text-green-400 rounded-lg p-4 text-xs font-mono leading-relaxed break-all select-all">
                            {{ utmTemplates.google_suffix }}
                        </div>
                        <p class="text-xs text-gray-500 mt-2">
                            Paste this into <strong>Final URL suffix</strong> at Campaign or Ad Group level
                        </p>
                    </div>

                    <!-- Important Notes -->
                    <div class="bg-amber-50 border border-amber-200 rounded-xl p-4">
                        <div class="flex items-start gap-3">
                            <font-awesome-icon :icon="['fas', 'lightbulb']" class="w-5 h-5 text-amber-500 mt-0.5 shrink-0" />
                            <div class="text-sm text-amber-800">
                                <p class="font-medium mb-1">Important</p>
                                <ul class="list-disc list-inside space-y-1 text-xs">
                                    <li>Keep <strong>Auto-tagging</strong> enabled (default) — it adds the <code>gclid</code> parameter</li>
                                    <li>The <code>{lpurl}</code> value preserves your original landing page URL</li>
                                    <li>You can set this at Account, Campaign, or Ad Group level — higher levels inherit to lower</li>
                                    <li>Use <strong>Custom Parameters</strong> if you need more control over UTM values per ad group</li>
                                </ul>
                            </div>
                        </div>
                    </div>
                </div>

                <!-- Meta Ads Guide -->
                <div v-if="activePlatform === 'meta'" class="space-y-6">
                    <!-- Setup Steps -->
                    <div class="bg-white border border-gray-200 rounded-xl p-5">
                        <h3 class="text-base font-semibold text-gray-800 mb-4">Setup Steps</h3>
                        <div class="flex flex-col gap-3">
                            <div
                                v-for="(step, idx) in metaSteps"
                                :key="idx"
                                class="flex items-start gap-3 p-3 bg-gray-50 rounded-lg"
                            >
                                <div class="w-7 h-7 rounded-full bg-blue-500 text-white flex items-center justify-center text-xs font-bold shrink-0 mt-0.5">
                                    {{ idx + 1 }}
                                </div>
                                <div>
                                    <p class="text-sm font-medium text-gray-800">{{ step.label }}</p>
                                    <p class="text-xs text-gray-500 mt-0.5">{{ step.detail }}</p>
                                </div>
                            </div>
                        </div>
                    </div>

                    <!-- URL Parameters -->
                    <div class="bg-white border border-gray-200 rounded-xl p-5">
                        <div class="flex items-center justify-between mb-3">
                            <h3 class="text-base font-semibold text-gray-800">URL Parameters</h3>
                            <button
                                class="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-blue-600 bg-blue-50 rounded-lg hover:bg-blue-100 transition-colors cursor-pointer"
                                @click="copyTemplate(utmTemplates.meta)"
                            >
                                <font-awesome-icon :icon="['fas', 'copy']" class="w-3 h-3" />
                                Copy
                            </button>
                        </div>
                        <div class="bg-gray-900 text-green-400 rounded-lg p-4 text-xs font-mono leading-relaxed break-all select-all">
                            {{ utmTemplates.meta }}
                        </div>
                        <p class="text-xs text-gray-500 mt-2">
                            Paste this into <strong>URL Parameters</strong> at Ad level → Tracking section
                        </p>
                    </div>

                    <!-- Meta Dynamic Parameters Reference -->
                    <div class="bg-white border border-gray-200 rounded-xl p-5">
                        <h3 class="text-base font-semibold text-gray-800 mb-3">Meta Dynamic Parameters Reference</h3>
                        <div class="overflow-x-auto">
                            <table class="w-full text-sm">
                                <thead>
                                    <tr class="border-b border-gray-200">
                                        <th class="text-left py-2 px-2 font-medium text-gray-600">Parameter</th>
                                        <th class="text-left py-2 px-2 font-medium text-gray-600">Resolves To</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    <tr class="border-b border-gray-100">
                                        <td class="py-2 px-2 font-mono text-xs text-gray-800"><span v-text="'{{campaign.name}}'"></span></td>
                                        <td class="py-2 px-2 text-gray-600">Campaign name</td>
                                    </tr>
                                    <tr class="border-b border-gray-100">
                                        <td class="py-2 px-2 font-mono text-xs text-gray-800"><span v-text="'{{adset.name}}'"></span></td>
                                        <td class="py-2 px-2 text-gray-600">Ad Set name</td>
                                    </tr>
                                    <tr class="border-b border-gray-100">
                                        <td class="py-2 px-2 font-mono text-xs text-gray-800"><span v-text="'{{ad.name}}'"></span></td>
                                        <td class="py-2 px-2 text-gray-600">Ad name</td>
                                    </tr>
                                    <tr class="border-b border-gray-100">
                                        <td class="py-2 px-2 font-mono text-xs text-gray-800"><span v-text="'{{placement}}'"></span></td>
                                        <td class="py-2 px-2 text-gray-600">Placement (feed, story, reels, etc.)</td>
                                    </tr>
                                    <tr>
                                        <td class="py-2 px-2 font-mono text-xs text-gray-800"><span v-text="'{{creative}}'"></span></td>
                                        <td class="py-2 px-2 text-gray-600">Creative ID</td>
                                    </tr>
                                </tbody>
                            </table>
                        </div>
                    </div>

                    <!-- Important Notes -->
                    <div class="bg-amber-50 border border-amber-200 rounded-xl p-4">
                        <div class="flex items-start gap-3">
                            <font-awesome-icon :icon="['fas', 'lightbulb']" class="w-5 h-5 text-amber-500 mt-0.5 shrink-0" />
                            <div class="text-sm text-amber-800">
                                <p class="font-medium mb-1">Important</p>
                                <ul class="list-disc list-inside space-y-1 text-xs">
                                    <li>Set URL Parameters at the <strong>Ad level</strong> for the most granular tracking</li>
                                    <li>You can also set them at <strong>Campaign</strong> or <strong>Ad Set</strong> level — lower levels override higher</li>
                                    <li>Install the <strong>Meta Pixel</strong> on your website for page_view and conversion events</li>
                                    <li>For server-side events, use <strong>Conversions API (CAPI)</strong> alongside the Pixel</li>
                                </ul>
                            </div>
                        </div>
                    </div>
                </div>

                <!-- Recommended UTM to Funnel Stage Mapping -->
                <div class="bg-white border border-gray-200 rounded-xl p-5 mt-6">
                    <h3 class="text-base font-semibold text-gray-800 mb-4">Recommended UTM → Funnel Stage Mapping</h3>
                    <p class="text-xs text-gray-500 mb-4">
                        When building your funnel in the Attribution tab, use these conventions to match UTM parameters to funnel stages
                    </p>

                    <div class="flex flex-col gap-3">
                        <div
                            v-for="stage in funnelStages"
                            :key="stage.name"
                            class="flex flex-col sm:flex-row rounded-lg overflow-hidden border border-gray-200"
                        >
                            <div class="flex items-center gap-3 px-4 py-3 sm:w-48 shrink-0 bg-gray-50 border-b sm:border-b-0 sm:border-r border-gray-200">
                                <div class="w-2 h-2 rounded-full" :class="{
                                    'bg-blue-500': stage.name === 'Awareness',
                                    'bg-indigo-500': stage.name === 'Interest',
                                    'bg-purple-500': stage.name === 'Consideration',
                                    'bg-amber-500': stage.name === 'Intent',
                                    'bg-emerald-500': stage.name === 'Conversion',
                                }"></div>
                                <div>
                                    <p class="text-sm font-semibold text-gray-800">{{ stage.name }}</p>
                                    <p class="text-xs text-gray-500">{{ stage.description }}</p>
                                </div>
                            </div>
                            <div class="flex-1 grid grid-cols-1 sm:grid-cols-2 divide-y sm:divide-y-0 sm:divide-x divide-gray-200">
                                <div class="px-4 py-3">
                                    <p class="text-xs font-medium text-gray-500 mb-1">Google Ads</p>
                                    <p class="text-xs font-mono text-gray-700 break-all">{{ recommendedMapping.find(m => m.stage === stage.name)?.google }}</p>
                                </div>
                                <div class="px-4 py-3">
                                    <p class="text-xs font-medium text-gray-500 mb-1">Meta Ads</p>
                                    <p class="text-xs font-mono text-gray-700 break-all">{{ recommendedMapping.find(m => m.stage === stage.name)?.meta }}</p>
                                </div>
                            </div>
                        </div>
                    </div>

                    <div class="mt-4 p-3 bg-blue-50 border border-blue-200 rounded-lg">
                        <div class="flex items-start gap-2">
                            <font-awesome-icon :icon="['fas', 'info-circle']" class="w-4 h-4 text-blue-500 mt-0.5 shrink-0" />
                            <p class="text-xs text-blue-800">
                                <strong>Tip:</strong> Name your campaigns consistently using prefixes like <code class="bg-blue-100 px-1 rounded">tof_</code> (top of funnel), <code class="bg-blue-100 px-1 rounded">mof_</code> (middle of funnel), and <code class="bg-blue-100 px-1 rounded">bof_</code> (bottom of funnel). The system can auto-detect funnel stages from these naming patterns.
                            </p>
                        </div>
                    </div>
                </div>

                <!-- URL Tester -->
                <div class="bg-white border border-gray-200 rounded-xl p-5 mt-6">
                    <h3 class="text-base font-semibold text-gray-800 mb-3">Test Your URL</h3>
                    <p class="text-xs text-gray-500 mb-4">
                        Paste a URL with UTM parameters to see which funnel stages it would match
                    </p>

                    <div class="flex gap-2">
                        <input
                            v-model="testUrl"
                            type="text"
                            placeholder="https://example.com/page?utm_source=google&utm_medium=cpc&utm_campaign=brand_awareness"
                            class="flex-1 px-3.5 py-2.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:border-blue-500"
                            @keyup.enter="parseTestUrl"
                        />
                        <button
                            class="px-4 py-2.5 bg-blue-500 text-white rounded-lg text-sm font-medium hover:bg-blue-600 transition-colors cursor-pointer"
                            @click="parseTestUrl"
                        >
                            Test
                        </button>
                    </div>

                    <div v-if="parseError" class="mt-3 p-3 bg-red-50 border border-red-200 rounded-lg">
                        <p class="text-sm text-red-700">{{ parseError }}</p>
                    </div>

                    <div v-if="parsedUtm" class="mt-3 space-y-2">
                        <div class="flex flex-wrap gap-2">
                            <div
                                v-for="(value, key) in parsedUtm"
                                :key="key"
                                class="inline-flex items-center gap-1.5 px-2.5 py-1.5 bg-gray-100 rounded-md text-xs font-mono"
                            >
                                <span class="text-gray-500">{{ key }}:</span>
                                <span class="text-gray-800 font-medium">{{ value }}</span>
                            </div>
                        </div>
                        <div class="p-3 bg-emerald-50 border border-emerald-200 rounded-lg">
                            <p class="text-sm text-emerald-800">
                                <font-awesome-icon :icon="['fas', 'check-circle']" class="mr-1" />
                                Parsed successfully. Use these UTM values when setting up funnel step matching rules.
                            </p>
                        </div>
                    </div>
                </div>
            </div>
        </template>
    </overlay-dialog>
</template>
