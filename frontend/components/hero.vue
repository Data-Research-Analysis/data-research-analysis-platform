<script setup lang="ts">
import templateAIImage from '/assets/images/template-ai.png';
import chatAIImage from '/assets/images/chat-ai.png';
import intelligenceOverview from '/assets/images/intelligence-overview.png';
import channelComparison from '/assets/images/channel-comparison.png';
import aiInsights1 from '/assets/images/ai-insights-1.png';
import aiInsights2 from '/assets/images/ai-insights-2.png';
import aiInsights3 from '/assets/images/ai-insights-3.png';
import budgetAllocation from '/assets/images/budget-allocation.png';
import campaignPerformance from '/assets/images/campaign-performance.png';

// useReCaptcha must be deferred to client-side to avoid SSR hydration mismatch
let recaptcha = null;
if (import.meta.client) {
    const { useReCaptcha } = await import('vue-recaptcha-v3');
    recaptcha = useReCaptcha();
}

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
defineExpose({
    state,
});

onMounted(async () => {
    await getToken();
});
</script>
<template>
    <div class="relative z-0">
        <div class="bg-primary-blue-100 w-full lg:min-h-screen relative flex flex-col lg:flex-row lg:items-center">
            <!-- Mobile Layout -->
            <div class="flex flex-col w-full p-5 pt-32 pb-20 lg:hidden">
                <h1 class="font-bold text-white text-center text-4xl leading-tight">
                    Stop Guessing. Start Dominating Your Market with AI-Driven Insights.
                </h1>
                <div class="text-xl font-medium text-blue-100 text-center mt-6">
                    The only data platform built for CMOs who need to prove ROI, unite their team, and get home in time for dinner.
                </div>
                <div class="flex flex-col w-full m-auto mt-8 pb-10">
                    <combo-button label="Start Your Plan" color="white" class="w-full h-12 shadow-lg cursor-pointer" @click="gotoJoinPricing()"/>
                </div>
                <div class="flex flex-row justify-center mt-5 mb-20">
                    <HeroCarousel :images="[intelligenceOverview, channelComparison, campaignPerformance, budgetAllocation, aiInsights1, aiInsights2, aiInsights3, templateAIImage, chatAIImage]" />
                </div>
            </div>            

            <!-- Desktop Layout -->
            <div class="hidden lg:grid grid-cols-12 gap-8 w-full max-w-[90rem] mx-auto px-6 items-center pb-20">
                <!-- Left: Text (5 cols ~ 42%) -->
                <div class="col-span-5 flex flex-col items-start text-left z-10">
                    <h1 class="font-bold text-white text-5xl leading-tight mb-6 drop-shadow-sm">
                        Stop Guessing. <br/>
                        <span class="text-transparent bg-clip-text bg-gradient-to-r from-blue-200 to-white">Start Dominating</span> <br/>
                        Your Market.
                    </h1>
                    <div class="text-xl font-medium text-blue-100 mb-10 max-w-lg leading-relaxed">
                        The only data platform built for CMOs who need to prove ROI, unite their team, and get home in time for dinner.
                    </div>
                     <div class="w-2/3">
                        <combo-button label="Start Your Plan" color="white" class="w-full h-14 text-lg shadow-xl hover:scale-105 transition-transform cursor-pointer" @click="gotoJoinPricing()"/>
                    </div>
                </div>

                <!-- Right: Carousel (7 cols ~ 58%) -->
                <div class="col-span-7 relative z-10 w-full pl-0">
                    <!-- Background Glow -->
                    <div class="absolute -inset-4 bg-blue-500/20 blur-3xl rounded-full"></div>
                    <HeroCarousel :images="[intelligenceOverview, channelComparison, campaignPerformance, budgetAllocation, aiInsights1, aiInsights2, aiInsights3, templateAIImage, chatAIImage]" />
                </div>
            </div>
        </div>
    </div>
</template>