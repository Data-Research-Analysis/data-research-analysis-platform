<script setup>
import { useReCaptcha } from "vue-recaptcha-v3";
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

async function subscribeMe() {
    state.loading = true;
    const regexPattern = /[A-Za-z0-9\._%+\-]+@[A-Za-z0-9\.\-]+\.[A-Za-z]{2,}/;
    if (!state.email.match(regexPattern)) {
        state.subscriptionError = true;
        state.subscriptionErrorMessage = "*Please enter a valid email address.";
    } else {
        state.subscriptionError = false;
        const token = await getRecaptchaToken(recaptcha, 'subscribeForm');
        if (token) {
            state.subscriptionStep = 2;
            const response = await verifyRecaptchaToken(state.token, token);
            if (response.success && response.action === "subscribeForm" && response.score > 0.8) {
                state.subscriptionStep = 2;
                const url = `${baseUrl()}/subscribe`;
                const subscribeResponse = await fetch(url, {
                    method: "POST",
                    headers: {
                        "Content-Type": "application/json",
                        "Authorization": `Bearer ${state.token}`,
                        "Authorization-Type": "non-auth",
                    },
                    body: JSON.stringify({ email: state.email }),
                });
                if (subscribeResponse.status === 200) {
                    state.subscriptionStep = 2;
                } else {
                    const decodedResponse = await subscribeResponse.json();
                    const message = decodedResponse.message;
                    state.subscriptionError = true;
                    state.subscriptionErrorMessage = message;//"*Oops!! We detected an anomaly. Please wait before you submit again.";
                    state.subscriptionStep = 1;
                }
            } else {
                state.subscriptionError = true;
                state.subscriptionErrorMessage = "*Oops!! We detected an anomaly. Please wait before you submit again.";
                state.subscriptionStep = 1;    
            }
        } else {
            state.subscriptionError = true;
            state.subscriptionErrorMessage = "*Oops!! We detected an anomoly. Please wait before you submit again.";
            state.subscriptionStep = 1;
        }
    }
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
        <div class="bg-primary-blue-100 w-full h-full fancy-bottom">
            <div class="flex flex-col h-full p-5 lg:hidden">
                <h1 class="font-bold text-white text-center mt-20">
                    Tired of complex data analysis platforms slowing you down?
                </h1>
                <div class="text-xl font-bold text-white text-center mt-10">
                    Data Research Analysis makes the process of getting data insights easy  and simple, so you can make confident, lightning-fast decisions.
                </div>
                <div class="flex flex-row justify-center">
                    <img src="/assets/images/data-cloud-analytics.png" class="w-3/4 border-5 border-white shadow-lg shadow-lg mt-5" />
                </div>
                <div class="flex flex-col w-3/5 m-auto mt-10 pb-20">
                    <combo-button label="Join Our Wait List" color="white" class="w-full h-10 mr-2 shadow-lg cursor-pointer" @click="gotoJoinWaitList()"/>
                </div>
            </div>
            
            <div class="hidden lg:flex lg:flex-row justify-between">
                <div class="w-1/2 flex flex-col mt-10">
                    <h1 class="font-bold text-white ml-20 mt-20">
                        Tired of complex data analysis platforms slowing you down?
                    </h1>
                    <div class="text-xl font-bold text-white ml-20 mt-10">
                        Data Research Analysis makes the process of getting data insights easy  and simple, so you can make confident, lightning-fast decisions.
                    </div>
                </div>
                <div class="w-1/2 flex flex-col justify-center items-center pb-10">
                    <div>
                        <img src="/assets/images/data-cloud-analytics.png" class="h-80 border-5 border-white shadow-lg mt-10" />
                    </div>                    
                </div>
            </div>
            <div class="hidden lg:flex lg:flex-col w-1/5 m-auto mt-10 pb-20">
                <combo-button label="Join Our Wait List" color="white" class="w-full h-10 mr-2 shadow-lg cursor-pointer" @click="gotoJoinWaitList()"/>
            </div>
        </div>
    </div>
</template>