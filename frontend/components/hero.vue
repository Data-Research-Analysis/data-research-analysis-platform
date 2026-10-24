<script setup lang="ts">
import intelligenceOverview from '/assets/images/intelligence-overview.webp';
import channelComparison from '/assets/images/channel-comparison.webp';
import budgetAllocation from '/assets/images/budget-allocation.webp';
import campaignPerformance from '/assets/images/campaign-performance.webp';
import paidMediaBuilder1 from '/assets/images/plan-media-builder-1.webp';
import paidMediaBuilder2 from '/assets/images/plan-media-builder-2.webp';
import paidMediaBuilder3 from '/assets/images/plan-media-builder-3.webp';
import paidMediaBuilder4 from '/assets/images/plan-media-builder-4.webp';
import type PlanStartModal from './plan/PlanStartModal.vue';

// Preload the first (LCP) carousel image so it is discoverable from the initial
// HTML instead of being discovered only once the component renders.
useHead({
    link: [
        { rel: 'preload', as: 'image', href: paidMediaBuilder1, fetchpriority: 'high' },
    ],
});

const state = reactive({
    email: "",
    subscriptionStep: 1,
    subscriptionError: false,
    subscriptionErrorMessage: "*Please enter a valid email address.",
    token: "",
    loading: true,
});

async function getToken() {
    state.loading = true;
    const response = await getGeneratedToken();
    state.token = response.token;
    state.loading = false;
}

const bookDemo = () => {
    if (import.meta.client) {
        window.location.href = '/enterprise-contact';
    }
};

const planStartModal = ref<InstanceType<typeof PlanStartModal> | null>(null);
const website = ref('');
const websiteError = ref('');

// /build-my-free-plan redirects here with ?builder=1; land the visitor on the
// website address field, which is where the free plan builder starts.
const route = useRoute();

onMounted(async () => {
    await getToken();
    if (route.query.builder === '1') {
        const inputs = document.querySelectorAll<HTMLInputElement>('.plan-builder-website-card input');
        const visible = Array.from(inputs).find((input) => (input as HTMLElement).offsetParent !== null);
        if (visible) {
            visible.scrollIntoView({ behavior: 'smooth', block: 'center' });
            visible.focus({ preventScroll: true });
        }
    }
});

function isValidWebsite(value: string): boolean {
    const trimmed = value.trim();
    if (!trimmed) return false;
    try {
        const url = new URL(trimmed.startsWith('http') ? trimmed : `https://${trimmed}`);
        return Boolean(url.hostname) && url.hostname.includes('.');
    } catch {
        return false;
    }
}

function startGuestPlan() {
    websiteError.value = '';
    if (!isValidWebsite(website.value)) {
        websiteError.value = 'Enter a valid website address (e.g. example.com)';
        return;
    }
    planStartModal.value?.openGuestModal(website.value.trim());
}

defineExpose({
    state,
});
</script>
<template>
    <div class="relative z-0">
        <div class="bg-primary-blue-100 w-full relative flex flex-col">
            <!-- Mobile Layout -->
            <div class="flex flex-col w-full p-5 pt-12 pb-20 lg:hidden">
                <p class="inline-flex self-center items-center gap-2 rounded-full bg-white/10 ring-1 ring-white/25 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-blue-100 mb-4">
                    Free paid media plan builder
                </p>
                <h1 class="font-bold text-white text-center text-3xl sm:text-4xl leading-tight">
                    Build a paid media plan that actually drives revenue.
                </h1>
                <div class="text-base font-medium text-blue-100 text-center mt-4">
                    Point Data Research Analysis at your website and it builds a channel-by-channel paid media plan — where to spend, how much, and what to create — so you can cut wasted ad spend and put budget behind what works. Built for CMOs and digital marketing teams, with no spreadsheets and no guesswork — a defensible plan in minutes.
                </div>

                <div class="w-full bg-white rounded-2xl p-5 shadow-2xl mt-6 plan-builder-website-card">
                    <p class="text-primary-blue-100 font-semibold text-lg">Get your free paid media plan</p>
                    <p class="text-sm text-gray-600 mt-1">Enter your website and we'll build a plan to improve your ad and marketing spend.</p>
                    <form class="flex flex-col gap-2 mt-4" @submit.prevent="startGuestPlan">
                        <input
                            v-model="website"
                            type="url"
                            inputmode="url"
                            placeholder="https://your-website.com"
                            class="w-full h-12 px-4 rounded-xl border border-gray-200 bg-gray-50 text-gray-900 text-base focus:outline-none focus:ring-2 focus:ring-primary-blue-100 focus:bg-white"
                        />
                        <button
                            type="submit"
                            class="w-full h-12 rounded-xl bg-primary-blue-100 text-white text-base font-bold shadow-lg hover:bg-primary-blue-300 cursor-pointer"
                        >
                            Build my free plan
                        </button>
                    </form>
                    <p v-if="websiteError" class="text-xs text-red-600 mt-2">{{ websiteError }}</p>
                    <p class="text-xs text-gray-500 mt-2">Free preview · no signup required · keep it when you register</p>
                </div>

                <div class="flex justify-center mt-5">
                    <button type="button" class="inline-flex items-center gap-2 text-blue-100 hover:text-white font-medium underline underline-offset-4 cursor-pointer" @click="bookDemo()">
                        Prefer a walkthrough? Book a demo
                    </button>
                </div>

                <div class="flex flex-row justify-center mt-8 mb-20">
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
            </div>            

            <!-- Desktop Layout -->
            <div class="hidden lg:grid grid-cols-12 gap-8 w-full max-w-[90rem] mx-auto px-6 items-center pt-8 pb-16">
                <!-- Left: Text (5 cols ~ 42%) -->
                <div class="col-span-5 flex flex-col items-start text-left z-10">
                    <p class="inline-flex items-center gap-2 rounded-full bg-white/10 ring-1 ring-white/25 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-blue-100 mb-4">
                        Free paid media plan builder
                    </p>
                    <p class="font-bold text-white text-4xl leading-tight mb-4 drop-shadow-sm">
                        Build a paid media plan that<br/>
                        <span class="text-transparent bg-clip-text bg-gradient-to-r from-blue-200 to-white">actually drives revenue.</span>
                    </p>
                    <div class="text-base font-medium text-blue-100 mb-5 max-w-lg leading-snug">
                        Point Data Research Analysis at your website and it builds a channel-by-channel paid media plan — where to spend, how much, and what to create — so you can cut wasted ad spend and put budget behind what works. Built for CMOs and digital marketing teams, with no spreadsheets and no guesswork — a defensible plan in minutes.
                    </div>

                    <div class="w-full rounded-2xl bg-white/10 ring-1 ring-white/30 backdrop-blur p-4 shadow-2xl plan-builder-website-card">
                        <p class="text-white font-semibold text-lg">Get your free paid media plan</p>
                        <p class="text-sm text-blue-100 mt-1">Enter your website and we'll build a plan to improve your ad and marketing spend.</p>
                        <form class="flex flex-col sm:flex-row gap-3 mt-3" @submit.prevent="startGuestPlan">
                            <input
                                v-model="website"
                                type="url"
                                inputmode="url"
                                placeholder="https://your-website.com"
                                class="flex-1 h-12 px-4 rounded-xl border border-white/40 bg-white text-gray-900 text-base focus:outline-none focus:ring-2 focus:ring-blue-300"
                            />
                            <button
                                type="submit"
                                class="h-12 px-7 rounded-xl bg-white text-primary-blue-100 text-base font-bold shadow-lg hover:bg-blue-50 hover:scale-[1.02] transition-transform cursor-pointer shrink-0"
                            >
                                Build my free plan
                            </button>
                        </form>
                        <p v-if="websiteError" class="text-sm text-amber-200 mt-2">{{ websiteError }}</p>
                        <p class="text-xs text-blue-100/80 mt-2">Free preview · no signup required · keep it when you register</p>
                    </div>

                    <div class="mt-3">
                        <button type="button" class="inline-flex items-center gap-2 text-blue-100 hover:text-white font-medium underline underline-offset-4 cursor-pointer" @click="bookDemo()">
                            Prefer a walkthrough? Book a demo
                        </button>
                    </div>
                </div>

                <!-- Right: Carousel (7 cols ~ 58%) -->
                <div class="col-span-7 relative z-10 w-full pl-0">
                    <!-- Background Glow -->
                    <div class="absolute -inset-4 bg-blue-500/20 blur-3xl rounded-full"></div>
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
            </div>
        </div>
    </div>
    <ClientOnly>
        <PlanStartModal ref="planStartModal" :show-trigger="false" />
    </ClientOnly>
</template>