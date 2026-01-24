<script setup lang="ts">
import { useReCaptcha } from "vue-recaptcha-v3";
const router = useRouter();
const route = useRoute();
const recaptcha = useReCaptcha();

const state = reactive({
    newPassword: "",
    reNewPassword: "",
    newPasswordError: false,
    reNewPasswordError: false,
    errorMessages: [],
    passwordChangeSuccess: false,
    showAlert: false,
    token: "",
    code: "",
    codeError: false,
    tokenValid: false,
    loading: false,
});

async function getToken() {
    state.loading = true;
    const response = await getGeneratedToken();
    state.token = response.token;
    state.loading = false;
}

async function verifyToken() {
    state.showAlert = false;
    state.passwordChangeSuccess = false;
    state.errorMessages = [];
  
    if (!validate(state.code, "", [validateRequired])) {
        state.codeError = true;
        state.errorMessages.push("Verification failed!!! The verification code has not been provided. Please try again.");
    } else {
        state.codeError = false;
    }

    if (state.codeError) {
        state.tokenValid = false;
        state.showAlert = true;
    } else {
        const requestOptions = {
            headers: {
                "Authorization": `Bearer ${state.token}`,
                "Authorization-Type": "non-auth",
            },
        };
        try {
            await $fetch(`${baseUrl()}/auth/verify-change-password-token/${encodeURIComponent(state.code)}`, requestOptions);
            state.tokenValid = true;
        } catch (error: any) {
            state.tokenValid = false;
            state.showAlert = true;
            state.errorMessages.push(error.data?.message || 'Token verification failed.');
        }
    }
}

async function changePassword() {
    state.loading = true;
    state.showAlert = false;
    state.passwordChangeSuccess = false;
    state.errorMessages = [];
  
    if (!validate(state.newPassword, "", [validatePassword, validateRequired])) {
        state.newPasswordError = true;
        state.errorMessages.push("Password should be at least 8 characters in length, have at least one lowercase character, at least one upper case character, at least a number between 0 and 9 and at least one special character (#?!@$%^&*-).");
    } else {
        state.newPasswordError = false;
    }

    if (!validate(state.reNewPassword, "", [validateRequired])) {
        state.reNewPasswordError = true;
        state.errorMessages.push("Please repeat your password.");
    } else if (state.newPassword !== state.reNewPassword) {
        state.reNewPasswordError = true;
        state.errorMessages.push("Passwords do not match.");
    } else {
        state.reNewPasswordError = false;
    }

    if (state.newPasswordError || state.reNewPasswordError) {
        state.passwordChangeSuccess = false;
        state.showAlert = true;
        state.loading = false;
    } else {
        const recaptchaToken = await getRecaptchaToken(recaptcha, 'changePasswordForm');
        if (recaptchaToken) {
            const recaptchaResponse = await verifyRecaptchaToken(state.token, recaptchaToken);
            if (recaptchaResponse.success && recaptchaResponse.action === "changePasswordForm" && recaptchaResponse.score > 0.8) {
                const requestOptions = {
                    headers: {
                        "Authorization": `Bearer ${state.token}`,
                        "Authorization-Type": "non-auth",
                    },
                    body: {
                        code: state.code,
                        password: state.newPassword,
                    },
                };
                try {
                    const data = await $fetch(`${baseUrl()}/auth/update-password`, {
                        method: "POST",
                        ...requestOptions
                    });
                    state.passwordChangeSuccess = true;
                    state.showAlert = true;
                    state.errorMessages.push(data.message);
                    state.loading = false;
                    
                    // Redirect to login after 3 seconds
                    setTimeout(() => {
                        router.push('/login');
                    }, 3000);
                } catch (error: any) {
                    state.passwordChangeSuccess = false;
                    state.showAlert = true;
                    state.errorMessages.push(error.data?.message || 'Password change failed.');
                    state.loading = false;
                }
            } else {
                state.passwordChangeSuccess = false;
                state.showAlert = true;
                state.errorMessages.push("Recaptcha verification failed. Please refresh the page and try again.");
                state.loading = false;
            }         
        } else {
            state.passwordChangeSuccess = false;
            state.showAlert = true;
            state.errorMessages.push("Recaptcha verification failed. Please refresh the page and try again.");
            state.loading = false;
        }
    }
}

onMounted(async () => {
    await getToken();
    state.code = route.params.code;
    await verifyToken();
    
    // Only add event listeners on client side for SSR compatibility
    if (import.meta.client) {
        window.addEventListener("keydown", (event) => {
            if (event.key === "Enter" && state.tokenValid) {
                changePassword();
            }
        });
    }
})
</script>
<template>
    <div class="min-h-100 mt-10 mb-10 flex flex-row justify-center w-full">
        <div class="mt-10 flex flex-col justify-center w-1/2 border border-primary-blue-100 border-solid m-10 p-5 shadow-md">
            <div class="self-center font-bold text-2xl mb-5">
                Change Your Password
            </div>
            
            <div v-if="!state.tokenValid" class="self-center text-md mb-5">
                Verifying your password change request...
            </div>
            
            <div v-else-if="state.tokenValid && !state.passwordChangeSuccess" class="self-center text-md mb-5">
                Please enter your new password below.
            </div>
            
            <div v-if="state.showAlert"
                class="w-3/4 self-center text-lg p-5 mb-5 font-bold text-black"
                :class="{ 'bg-green-400': state.passwordChangeSuccess, 'bg-red-400': !state.passwordChangeSuccess }">
                <div v-if="state.passwordChangeSuccess" class="text-lg">Success!</div>
                <div v-else class="text-lg">Error!</div>
                <template v-for="message in state.errorMessages">
                    <div>{{ message }}</div>
                </template>
                <div v-if="state.passwordChangeSuccess" class="mt-2 text-sm">
                    Redirecting to login page in a few seconds...
                </div>
            </div>
            
            <template v-if="state.tokenValid && !state.passwordChangeSuccess">
                <input
                    v-model="state.newPassword"
                    type="password"
                    class="self-center w-3/4 p-5 border border-primary-blue-100 border-solid hover:border-blue-200 mb-5 shadow-md"
                    :class="!state.newPasswordError ? '' : 'bg-red-300 text-black'"
                    placeholder="New Password"
                    :disabled="state.loading"
                    @keydown.enter="changePassword"
                />
                <input
                    v-model="state.reNewPassword"
                    type="password"
                    class="self-center w-3/4 p-5 border border-primary-blue-100 border-solid hover:border-blue-200 mb-5 shadow-md"
                    :class="!state.reNewPasswordError ? '' : 'bg-red-300 text-black'"
                    placeholder="Repeat New Password"
                    :disabled="state.loading"
                    @keydown.enter="changePassword"
                />
                <div class="self-center text-sm text-gray-600 mb-5 w-3/4">
                    Password must be at least 8 characters long and contain at least one lowercase letter, one uppercase letter, one number, and one special character (#?!@$%^&*-).
                </div>
                <spinner v-if="state.loading"/>
                <div
                    v-else
                    class="w-1/4 text-center self-center mb-5 p-2 m-2 bg-primary-blue-100 text-white hover:bg-primary-blue-300 cursor-pointer font-bold shadow-md"
                    @click="changePassword"
                    @keydown.enter="changePassword"
                >
                    Change Password
                </div>
            </template>
            
            <div v-if="!state.tokenValid && state.showAlert" class="self-center text-md mb-5">
                <div class="mt-3 mb-2">
                    The password change token is invalid or has expired. Please request a new password change from the <NuxtLink to="/forgot-password" class="text-blue-600 underline hover:text-gray-500">forgot password page</NuxtLink>.
                </div>
            </div>
        </div>
    </div>
</template>