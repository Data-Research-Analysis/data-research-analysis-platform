<script setup lang="ts">
import { useReCaptcha } from "vue-recaptcha-v3";
import { useLoggedInUserStore } from "@/stores/logged_in_user";
const router = useRouter();
const recaptcha = useReCaptcha();
const loggedInUserStore = useLoggedInUserStore();
const state = reactive({
    email: "",
    emailError: false,
    errorMessages: [],
    passwordChangeRequestSuccess: false,
    showAlert: false,
    token: "",
    loading: false,
});

async function getToken() {
    state.loading = true;
    const response = await getGeneratedToken();
    state.token = response.token;
    state.loading = false;
}

async function changePasswordRequest() {
    state.loading = true;
    state.showAlert = false;
    state.passwordChangeRequestSuccess = false;
    state.errorMessages = [];
  
    if (!validate(state.email, "", [validateEmail, validateRequired])) {
        state.emailError = true;
        state.errorMessages.push("Please enter a valid email address.");
        state.loading = false;
    } else {
        state.emailError = false;
    }

    if (state.emailError || state.passwordError) {
        state.passwordChangeRequestSuccess = false;
        state.showAlert = true;
    } else {
        const recaptchaToken = await getRecaptchaToken(recaptcha, 'passwordResetForm');
        if (recaptchaToken) {
            const recaptchaResponse = await verifyRecaptchaToken(state.token, recaptchaToken);
            if (recaptchaResponse.success && recaptchaResponse.action === "passwordResetForm" && recaptchaResponse.score > 0.8) {
                const requestOptions = {
                headers: {
                    "Authorization": `Bearer ${state.token}`,
                    "Authorization-Type": "non-auth",
                },
                body: {
                  email: state.email,
                },
              };
              try {
                const data = await $fetch(`${baseUrl()}/auth/password-change-request`, {
                  method: "POST",
                  ...requestOptions
                });
                state.passwordChangeRequestSuccess = true;
                state.showAlert = true;
                state.errorMessages.push(data.message);
                state.loading = false;
              } catch (error: any) {
                // For security, still show success message to prevent email enumeration
                state.passwordChangeRequestSuccess = true;
                state.showAlert = true;
                state.errorMessages.push("If this email address exists in our system, you will receive a password reset link shortly. Please check your email and spam folder.");
                state.loading = false;
              }
            } else {
                state.passwordChangeRequestSuccess = false;
                state.showAlert = true;
                state.errorMessages.push("Recaptcha verification failed. Please refresh the page and try again.");
                state.loading = false;
            }         
        } else {
            state.passwordChangeRequestSuccess = false;
            state.showAlert = true;
            state.errorMessages.push("Recaptcha verification failed. Please refresh the page and try again.");
            state.loading = false;
        }
    }
}

onMounted(async () => {
    await getToken();
    // Only add event listeners on client side for SSR compatibility
    if (import.meta.client) {
        window.addEventListener("keydown", (event) => {
            if (event.key === "Enter") {
                changePasswordRequest();
            }
        });
    }
})
</script>
<template>
    <div class="mt-10 flex flex-row justify-center w-full">
        <div class="mt-10 flex flex-col justify-center w-1/2 border border-primary-blue-100 border-solid m-10 p-5 shadow-md">
            <div class="self-center font-bold text-2xl mb-5">
                Request Change Password
            </div>
            <div class="self-center text-md mb-5">
               Please enter your email address to request to change your password.
            </div>
            <div v-if="state.showAlert"
                class="w-3/4 self-center text-lg p-5 mb-5 font-bold text-black"
                :class="{ 'bg-green-400': state.passwordChangeRequestSuccess, 'bg-red-400': !state.passwordChangeRequestSuccess }">
                <div v-if="state.passwordChangeRequestSuccess" class="text-lg">Password Reset Request Sent!</div>
                <div v-else class="text-lg">Error!</div>
                <template v-for="message in state.errorMessages">
                    <div class="text-sm mt-2 font-normal">{{ message }}</div>
                </template>
            </div>
            <input
                v-model="state.email"
                type="text"
                class="self-center w-3/4 p-5 border border-primary-blue-100 border-solid hover:border-blue-200 mb-5 shadow-md"
                :class="!state.emailError ? '' : 'bg-red-300 text-black'"
                placeholder="Email"
                :disabled="state.loading"
                @keydown.enter="changePasswordRequest"
            />
            <spinner v-if="state.loading"/>
            <div
                v-else
                class="w-1/4 text-center self-center mb-5 p-2 m-2 bg-primary-blue-100 text-white hover:bg-primary-blue-300 cursor-pointer font-bold shadow-md"
                @click="changePasswordRequest"
                @keydown.enter="changePasswordRequest"
            >
                Request Change Password
            </div>
        </div>
    </div>
</template>