<script setup lang="ts">
import { useReCaptcha } from "vue-recaptcha-v3";
import { useLoggedInUserStore } from "@/stores/logged_in_user";
import { useSSO } from '@/composables/useSSO';
const router = useRouter();
const recaptcha = useReCaptcha();
const loggedInUserStore = useLoggedInUserStore();
const sso = useSSO();

// SEO Meta Tags for Login Page
useHead({
    title: 'Login - Data Research Analysis Platform',
    meta: [
        { name: 'description', content: 'Sign in to your Data Research Analysis account to access your data dashboards, analytics, and visualization tools.' },
        { name: 'robots', content: 'noindex, nofollow' }, // Don't index login page
        
        // Open Graph / Facebook
        { property: 'og:type', content: 'website' },
        { property: 'og:title', content: 'Login - Data Research Analysis' },
        { property: 'og:description', content: 'Sign in to your Data Research Analysis account.' },
    ],
    link: [
        { rel: 'canonical', href: 'https://dataresearchanalysis.com/login' }
    ]
});

interface State {
    email: string;
    password: string;
    ssoEmail: string;
    emailError: boolean;
    passwordError: boolean;
    ssoEmailError: boolean;
    errorMessages: string[];
    loginSuccess: boolean;
    showAlert: boolean;
    token: string;
    loading: boolean;
    ssoLoading: boolean;
}
const state = reactive<State>({
    email: "",
    password: "",
    ssoEmail: "",
    emailError: false,
    passwordError: false,
    ssoEmailError: false,
    errorMessages: [],
    loginSuccess: false,
    showAlert: false,
    token: "",
    loading: false,
    ssoLoading: false,
});

async function getToken() {
    state.loading = true;
    const response = await getGeneratedToken();
    state.token = response.token;
    state.loading = false;
}

async function loginUser() {
    state.loading = true;
    state.showAlert = false;
    state.loginSuccess = false;
    state.errorMessages = [];
  
    if (!validate(state.email, "", [validateEmail, validateRequired])) {
        state.emailError = true;
        state.errorMessages.push("Please enter a valid email address.");
    } else {
        state.emailError = false;
    }

    if (!validate(state.password, "", [validateRequired])) {
        state.passwordError = true;
        state.errorMessages.push("Please enter a valid password.");
    } else {
        state.passwordError = false;
    }

    if (state.emailError || state.passwordError) {
        state.loginSuccess = false;
        state.showAlert = true;
    } else {
        const recaptchaToken = await getRecaptchaToken(recaptcha!, 'loginForm');
        if (recaptchaToken) {
            const recaptchaResponse = await verifyRecaptchaToken(state.token, recaptchaToken);
            if (recaptchaResponse.success && recaptchaResponse.action === "loginForm" && recaptchaResponse.score > 0.8) {
                const requestOptions = {
                headers: {
                    "Authorization": `Bearer ${state.token}`,
                    "Authorization-Type": "non-auth",
                },
                body: {
                  email: state.email,
                  password: state.password,
                },
              };
              try {
                const data = await $fetch(`${baseUrl()}/auth/login`, {
                  method: "POST",
                  ...requestOptions
                });
                state.loginSuccess = true;
                state.showAlert = true;
                loggedInUserStore.setLoggedInUser(data as any);
                setAuthToken((data as any).token);
                router.push('/projects');
              } catch (error) {
                state.loginSuccess = false;
                state.showAlert = true;
                state.errorMessages.push((error as any).data?.message || 'Login failed. Please try again.');
                state.loading = false;
              }
            } else {
                state.loginSuccess = false;
                state.showAlert = true;
                state.errorMessages.push("Recaptcha verification failed. Please refresh the page and try again.");
                state.loading = false;
            }         
        } else {
            state.loginSuccess = false;
            state.showAlert = true;
            state.errorMessages.push("Recaptcha verification failed. Please refresh the page and try again.");
            state.loading = false;
        }
    }
}

async function loginWithSSO() {
    state.ssoLoading = true;
    state.showAlert = false;
    state.errorMessages = [];

    if (!validate(state.ssoEmail, "", [validateEmail, validateRequired])) {
        state.ssoEmailError = true;
        state.showAlert = true;
        state.errorMessages.push('Please enter a valid work email address for SSO login.');
        state.ssoLoading = false;
        return;
    }

    state.ssoEmailError = false;

    try {
        const redirected = await sso.initiateLogin(state.ssoEmail);
        if (!redirected) {
            state.showAlert = true;
            state.errorMessages.push('No SSO configuration was found for that email domain.');
        }
    } catch (error: any) {
        state.showAlert = true;
        state.errorMessages.push(error?.data?.error || error?.data?.message || 'Unable to start SSO login.');
    } finally {
        state.ssoLoading = false;
    }
}

onMounted(async () => {
    await getToken();
    // Only add event listeners on client side for SSR compatibility
    if (import.meta.client) {
        window.addEventListener("keydown", (event) => {
            if (event.key === "Enter") {
                loginUser();
            }
        });
    }
})
</script>
<template>
    <div class="mt-10 flex flex-row justify-center w-full">
        <div class="mt-10 flex flex-col justify-center w-1/2 border border-primary-blue-100 border-solid m-10 p-5 shadow-md">
            <div class="self-center font-bold text-2xl mb-5">
                Data Research Analysis Login
            </div>
            <div class="self-center text-md mb-5">
               Please enter your details to login in your account. All of the fields are required to be filled.
            </div>
            <div v-if="state.showAlert"
                class="w-3/4 self-center text-lg p-5 mb-5 font-bold text-black"
                :class="{ 'bg-green-400': state.loginSuccess, 'bg-red-400': !state.loginSuccess }">
                <div v-if="state.loginSuccess" class="text-2xl">Success!</div>
                <div v-else class="text-2xl">Error!</div>
                <template v-for="message in state.errorMessages">
                    <div>{{ message }}</div>
                </template>
            </div>
            <input
                v-model="state.email"
                type="text"
                class="self-center w-3/4 p-5 border border-primary-blue-100 border-solid hover:border-blue-200 mb-5 shadow-md rounded-lg"
                :class="!state.emailError ? '' : 'bg-red-300 text-black'"
                placeholder="Email"
                :disabled="state.loading"
                @keydown.enter="loginUser"
            />
            <input
                v-model="state.password"
                type="password"
                class="self-center w-3/4 p-5 border border-primary-blue-100 border-solid hover:border-blue-200 mb-5 shadow-md rounded-lg"
                :class="!state.passwordError ? '' : 'bg-red-300 text-black'"
                placeholder="Password"
                :disabled="state.loading"
                @keydown.enter="loginUser"
            />
            <span class="self-center mb-3 text-blue-600 underline hover:text-gray-500">
                <NuxtLink to="/forgot-password">Forgot Password?</NuxtLink>
            </span>
            <spinner v-if="state.loading"/>
            <div
                v-else
                class="w-1/4 text-center self-center mb-5 p-2 m-2 bg-primary-blue-100 text-white hover:bg-primary-blue-300 cursor-pointer font-bold shadow-md rounded-lg"
                @click="loginUser"
                @keydown.enter="loginUser"
            >
                Login
            </div>

            <div class="self-center w-3/4 mt-5 pt-5 border-t border-slate-200">
                <div class="text-center text-slate-600 mb-3 font-semibold">Or sign in with your organization</div>
                <input
                    v-model="state.ssoEmail"
                    type="email"
                    class="self-center w-full p-4 border border-primary-blue-100 border-solid hover:border-blue-200 mb-3 shadow-sm rounded-lg"
                    :class="!state.ssoEmailError ? '' : 'bg-red-300 text-black'"
                    placeholder="Work email (you@company.com)"
                    :disabled="state.ssoLoading"
                    @keydown.enter="loginWithSSO"
                />
                <div
                    class="w-full text-center p-2 bg-slate-800 text-white hover:bg-slate-700 cursor-pointer font-bold shadow-md rounded-lg"
                    :class="state.ssoLoading ? 'opacity-60 cursor-not-allowed' : ''"
                    @click="!state.ssoLoading && loginWithSSO()"
                    @keydown.enter="loginWithSSO"
                >
                    <font-awesome-icon :icon="['fas', 'building']" class="mr-2" />
                    {{ state.ssoLoading ? 'Redirecting...' : 'Continue with SSO' }}
                </div>
            </div>
        </div>
    </div>
</template>