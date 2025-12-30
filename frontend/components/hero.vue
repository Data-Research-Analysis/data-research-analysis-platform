<script setup>
import { useReCaptcha } from "vue-recaptcha-v3";
import dataSourcesImage from '/assets/images/data-sources.png';
import templateAIImage from '/assets/images/template-ai.png';
import chatAIImage from '/assets/images/chat-ai.png';
import dashboardImage from '/assets/images/dashboard.png';
const recaptcha = useReCaptcha();

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
    <div>
        <div class="bg-primary-blue-100 w-full min-h-[90vh] lg:min-h-screen relative flex items-center fancy-bottom">
            <!-- Mobile Layout -->
            <div class="flex flex-col h-full p-5 lg:hidden pt-20">
                <h1 class="font-bold text-white text-center text-4xl leading-tight">
                    Stop Guessing. Start Dominating Your Market with AI-Driven Insights.
                </h1>
                <div class="text-xl font-medium text-blue-100 text-center mt-6">
                    The only data platform built for CMOs who need to prove ROI, unite their team, and get home in time for dinner.
                </div>
                <div class="flex flex-col w-full m-auto mt-8 pb-10">
                    <combo-button label="Start Your Free Beta" color="white" class="w-full h-12 shadow-lg cursor-pointer" @click="gotoJoinPrivateBeta()"/>
                </div>
                <div class="flex flex-row justify-center mt-5 mb-20">
                    <HeroCarousel :images="[dataSourcesImage, templateAIImage, chatAIImage, dashboardImage]" />
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
                        <combo-button label="Join Our Private Beta" color="white" class="w-full h-14 text-lg shadow-xl hover:scale-105 transition-transform cursor-pointer" @click="gotoJoinPrivateBeta()"/>
                    </div>
                </div>

                <!-- Right: Carousel (7 cols ~ 58%) -->
                <div class="col-span-7 relative z-10 w-full pl-0">
                    <!-- Background Glow -->
                    <div class="absolute -inset-4 bg-blue-500/20 blur-3xl rounded-full"></div>
                    <HeroCarousel :images="[dataSourcesImage, templateAIImage, chatAIImage, dashboardImage]" />
                </div>
            </div>
        </div>
    </div>
</template>