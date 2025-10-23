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
                <div class="flex flex-row justify-center mt-10">
                    <img src="/assets/images/website.png" />
                </div>
                <div class="flex flex-col w-3/5 m-auto mt-10 pb-20">
                    <combo-button label="Join Our Private Beta" color="white" class="w-full h-10 mr-2 shadow-lg cursor-pointer" @click="gotoJoinPrivateBeta()"/>
                </div>
            </div>            
            <div class="hidden lg:flex lg:flex-row justify-center">
                <div class="w-1/2 flex flex-col mb-10">
                    <h1 class="font-bold text-white mt-10 text-center">
                        Tired of complex data analysis platforms slowing you down?
                    </h1>
                    <div class="text-xl font-bold text-white mt-5 text-center">
                        Data Research Analysis makes the process of getting data insights easy  and simple, so you can make confident, lightning-fast decisions.
                    </div>
                </div>
            </div>
            <div class="m-auto w-3/4 lg:w-1/2 hidden lg:block pb-20">
                <img src="/assets/images/website.png" />
            </div>
        </div>
    </div>
</template>