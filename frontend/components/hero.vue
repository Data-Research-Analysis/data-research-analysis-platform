<script setup lang="ts">
import templateAIImage from '/assets/images/template-ai.webp';
import chatAIImage from '/assets/images/chat-ai.webp';
import intelligenceOverview from '/assets/images/intelligence-overview.webp';
import channelComparison from '/assets/images/channel-comparison.webp';
import aiInsights1 from '/assets/images/ai-insights-1.webp';
import aiInsights2 from '/assets/images/ai-insights-2.webp';
import aiInsights3 from '/assets/images/ai-insights-3.webp';
import budgetAllocation from '/assets/images/budget-allocation.webp';
import campaignPerformance from '/assets/images/campaign-performance.webp';

// Preload the first (LCP) carousel image so it is discoverable from the initial
// HTML instead of being discovered only once the component renders.
useHead({
    link: [
        { rel: 'preload', as: 'image', href: intelligenceOverview, fetchpriority: 'high' },
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
                    Know which marketing channels actually drive revenue.
                </h1>
                <div class="text-xl font-medium text-blue-100 text-center mt-6">
                    Connect your ad spend to revenue and recover the budget you cannot see. No SQL. No data engineer. Answers in minutes, not months.
                </div>
                <div class="flex flex-col w-full m-auto mt-8 gap-4 pb-10">
                    <combo-button label="Book a demo" color="white" class="w-full h-12 shadow-lg cursor-pointer" @click="bookDemo()"/>
                </div>
                <div class="flex flex-row justify-center mt-5 mb-20">
                    <HeroCarousel :images="[intelligenceOverview, channelComparison, campaignPerformance, budgetAllocation, aiInsights1, aiInsights2, aiInsights3, templateAIImage, chatAIImage]" />
                </div>
            </div>            

            <!-- Desktop Layout -->
            <div class="hidden lg:grid grid-cols-12 gap-8 w-full max-w-[90rem] mx-auto px-6 items-center pb-20">
                <!-- Left: Text (5 cols ~ 42%) -->
                <div class="col-span-5 flex flex-col items-start text-left z-10">
                    <p class="font-bold text-white text-5xl leading-tight mb-6 drop-shadow-sm">
                        Know which marketing channels<br/>
                        <span class="text-transparent bg-clip-text bg-gradient-to-r from-blue-200 to-white">actually drive revenue.</span>
                    </p>
                    <div class="text-xl font-medium text-blue-100 mb-10 max-w-lg leading-relaxed">
                        Connect your ad spend to revenue and recover the budget you cannot see. No SQL. No data engineer. Answers in minutes, not months.
                    </div>
                     <div class="w-full flex flex-col sm:flex-row gap-4">
                        <div class="w-full sm:w-1/2">
                            <combo-button label="Book a demo" color="white" class="w-full h-14 text-lg shadow-xl hover:scale-105 transition-transform cursor-pointer" @click="bookDemo()"/>
                        </div>
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