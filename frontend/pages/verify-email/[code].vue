<script setup>
import { useReCaptcha } from "vue-recaptcha-v3";
const router = useRouter();
const route = useRoute();
const recaptcha = useReCaptcha();

const state = reactive({
    errorMessages: [],
    verificationSuccess: false,
    resendSuccess: false,
    showAlert: false,
    token: "",
    code: "",
    codeError: false,
    showResendCodeButton: false,
});

async function getToken() {
    state.loading = true;
    const response = await getGeneratedToken();
    state.token = response.token;
    state.loading = false;
}

async function verifyToken() {
    state.showAlert = false;
    state.loginSuccess = false;
    state.errorMessages = [];
  
    if (!validate(state.code, "", [validateRequired])) {
        state.codeError = true;
        state.errorMessages.push("Verification failed!!! The verification code has not been provided. Please try again.");
    } else {
        state.codeError = false;
    }

    if (state.codeError) {
        state.verificationSuccess = false;
        state.showAlert = true;
    } else {
        const requestOptions = {
            method: "GET",
            headers: {
                "Content-Type": "application/json",
                "Authorization": `Bearer ${state.token}`,
                "Authorization-Type": "non-auth",
            },
        };
        const response = await fetch(`${baseUrl()}/auth/verify-email/${encodeURIComponent(state.code)}`, requestOptions);
        if (response.status === 200) {
            state.verificationSuccess = true;
        } else {
            state.verificationSuccess = false;
            state.showResendCodeButton = true;
        }
    }
}
async function resendCode() {
    state.errorMessages = [];
    const requestOptions = {
        method: "GET",
        headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${state.token}`,
        },
    };
    const response = await fetch(`${baseUrl()}/auth/resend-code/${encodeURIComponent(state.code)}`, requestOptions);
    if (response.status === 200) {
        state.verificationSuccess = false;
        state.resendSuccess = true;
        state.showAlert = true;
        const data = await response.json();
        state.errorMessages.push('The new verification code has been sent to your email.');
    } else {
        state.verificationSuccess = false;
        state.resendSuccess = false;
        state.showAlert = true;
        const data = await response.json();
        state.errorMessages.push(data.message);
    }
    state.showResendCodeButton = false;
}

onMounted(async () => {
    await getToken();
    state.code = route.params.code;
    await verifyToken();
})
</script>
<template>
    <div class="min-h-100 mt-10 flex flex-row justify-center w-full">
        <div class="flex flex-col justify-center w-1/2 border border-primary-blue-100 border-solid p-10 shadow-md">
            <div v-if="state.verificationSuccess" class="self-center font-bold text-2xl mb-5">
               Email Verification Success!
            </div>
            <div v-else class="self-center font-bold text-2xl mb-5">
               Email Verification Failed!
            </div>
            <div v-if="state.verificationSuccess" class="self-center text-md mb-5">
                Your email has been verified successfully. Please <NuxtLink to="/login" class="hover:text-gray-500">login</NuxtLink> to continue.
            </div>
            <div v-else class="flex flex-col self-center text-md mb-5">
                <div class="mt-3 mb-2">
                    Email verification has failed, as the verification code provided is incorrect or has expired. You can send a new code to your email by clicking the button below.
                </div>
                <div v-if="state.showAlert"
                    class="w-full self-center text-md p-5 m-5 font-bold text-black"
                    :class="{ 'bg-green-400': state.resendSuccess, 'bg-red-400': !state.resendSuccess }">
                    <div v-if="state.resendSuccess" class="text-2xl">Success!</div>
                    <div v-else class="text-2xl">Error!</div>
                    <template v-for="message in state.errorMessages">
                        <div>{{ message }}</div>
                    </template>
                </div>
                <combo-button v-if="state.showResendCodeButton" @click="resendCode" label="Send New Code" color="primary" class="w-1/2 h-13 mt-3 mb-2 mr-2 shadow-lg cursor-pointer self-center" />    
            </div>
        </div>
    </div>
</template>