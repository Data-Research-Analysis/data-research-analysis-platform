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

onMounted(async () => {
    await getToken();
});
</script>
<template>
    <div>
        <div class="bg-primary-blue-100 w-full h-full">
            <div class="flex flex-col h-full p-5 lg:hidden">
                <div class="text-3xl font-bold text-white text-center mt-20">
                    The one stop solution to your data analysis needs
                </div>
                <div class="text-xl font-bold text-white text-center mt-10">
                    Subscribe with us today so that you can get the front seat to the development of Data Research Analysis.
                </div>
                <spinner v-if="state.loading" :show="true" class="mt-10"/>
                <div v-else class="flex flex-col">
                    <div v-if="state.subscriptionStep && state.subscriptionStep === 1" class="flex flex-col mt-5">
                        <div class="h-[60px] text-white mt-10 bg-white items-center flex flex-row shadow-lg">
                            <input type="text" v-model="state.email" class="w-3/4 h-10 bg-white focus:border-white focus:outline-none border-white text-black font-bold ml-4" placeholder="Enter your email address" />
                            <combo-button @click="subscribeMe" label="Subscribe Me" color="primary" class="w-1/4 h-13 mr-2 shadow-lg cursor-pointer" />
                        </div>
                        <div v-if="state.subscriptionError" class="text-red-500 text-md font-bold bg-red-100 p-2">
                            {{ state.subscriptionErrorMessage }}
                        </div>
                        <div class="text-md font-bold text-white mt-5">
                            * We promise that we will not spam you.
                        </div>
                    </div>
                    <div v-else-if="state.subscriptionStep && state.subscriptionStep === 2">
                        <div class="text-3xl font-bold text-white text-center mt-10">
                            Thank you for subscribing with us.
                        </div>
                        <div class="text-xl font-bold text-white text-center mt-5">
                            We will keep you updated with the latest news and updates.
                        </div>
                    </div>
                </div>
                <div class="flex flex-row justify-center">
                    <img src="/assets/images/sheets.png" class="w-3/4 border-2 border-white shadow-lg mt-5" />
                </div>
                <div class="text-md text-white mt-1">
                    * High fidelity wireframe, actual screen may be different.
                </div>
            </div>
            <div class="hidden lg:flex lg:flex-row justify-between">
                <div class="w-1/2 flex flex-col">
                    <div class="text-4xl font-bold text-white ml-20 mt-40">
                        The one stop solution to your data analysis needs
                    </div>
                    <div class="text-xl font-bold text-white ml-20 mt-10">
                        Subscribe with us today so that you can get the front seat to the development of Data Research Analysis.
                    </div>
                    <spinner v-if="state.loading" :show="true" class="mt-10"/>
                    <div v-else class="flex flex-row justify-center">
                        <div v-if="state.subscriptionStep && state.subscriptionStep === 1" class="w-3/4 flex flex-col mt-10">
                            <div class="h-[60px] text-white bg-white items-center flex flex-row shadow-lg">
                                <input type="text" v-model="state.email" class="w-3/4 h-10 bg-white focus:border-white focus:outline-none border-white text-black font-bold ml-4" placeholder="Enter your email address" />
                                <combo-button @click="subscribeMe" label="Subscribe Me" color="primary" class="w-1/4 h-13 mr-2 shadow-lg cursor-pointer" />
                            </div>
                            <div v-if="state.subscriptionError" class="text-red-500 text-md font-bold bg-red-100 p-2">
                                {{ state.subscriptionErrorMessage }}
                            </div>
                            <div class="text-md font-bold text-white mt-5">
                                *We promise that we will not spam you.
                            </div>
                        </div>
                        <div v-else-if="state.subscriptionStep && state.subscriptionStep === 2">
                            <div class="text-3xl font-bold text-white text-center mt-10">
                                Thank you for subscribing with us.
                            </div>
                            <div class="text-xl font-bold text-white text-center mt-5">
                                We will keep you updated with the latest news and updates.
                            </div>
                        </div>
                    </div>
                </div>
                <div class="w-1/2 flex flex-col">
                    <div class="">
                        <img src="/assets/images/sheets.png" class="w-3/4 border-2 border-white shadow-lg mt-5" />
                    </div>
                    <div class="text-md text-white mt-1">
                        * High fidelity wireframe, actual screen may be different.
                    </div>
                </div>
            </div>
        </div>
        <img src="/blue-background-bottom.svg" class="w-full" />
    </div>
</template>