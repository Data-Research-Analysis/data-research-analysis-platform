<script setup lang="ts">
import { useReCaptcha } from "vue-recaptcha-v3";
import { useLoggedInUserStore } from "@/stores/logged_in_user";
import { useSSO } from '@/composables/useSSO';
const router = useRouter();
const recaptcha = useReCaptcha();
const loggedInUserStore = useLoggedInUserStore();
const sso = useSSO();
const nuxtApp = useNuxtApp();
const { clearAllStores, clearAllLocalStorage } = useLogout();

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
        { rel: 'canonical', href: 'https://www.dataresearchanalysis.com/login' }
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
    showPassword: boolean;
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
    showPassword: false,
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
                // Drop any state left over from a previous session before
                // applying the newly authenticated user, so no prior-user data
                // can leak without a full page refresh.
                clearAllStores();
                clearAllLocalStorage();
                if (import.meta.client) {
                    sessionStorage.clear();
                }
                loggedInUserStore.setLoggedInUser(data as any);
                setAuthToken((data as any).token);
                if (import.meta.client) {
                    const socket = (nuxtApp as any).$socketio;
                    if (socket) {
                        socket.auth = { token: (data as any).token };
                        socket.disconnect();
                        socket.connect();
                    }
                }
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
    <div class="min-h-[calc(100vh-80px)] flex items-start justify-center px-4 py-10">
        <div class="w-full max-w-md bg-white rounded-2xl shadow-lg border border-slate-200 p-8">
            <div class="text-center mb-6">
                <h1 class="text-2xl font-bold text-gray-900">Sign in</h1>
                <p class="text-sm text-gray-600 mt-2">Welcome back — pick up where you left off.</p>
            </div>

            <div v-if="state.showAlert"
                class="w-full text-sm p-4 mb-5 rounded-lg font-medium text-black"
                :class="{ 'bg-green-100 text-green-900': state.loginSuccess, 'bg-red-100 text-red-900': !state.loginSuccess }">
                <div v-if="state.loginSuccess" class="text-lg font-bold">Success!</div>
                <div v-else class="text-lg font-bold">Error!</div>
                <template v-for="message in state.errorMessages">
                    <div>{{ message }}</div>
                </template>
            </div>

            <input
                v-model="state.email"
                type="text"
                class="w-full p-4 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 mb-4"
                :class="!state.emailError ? '' : 'bg-red-100 text-black'"
                placeholder="Email"
                :disabled="state.loading"
                @keydown.enter="loginUser"
            />
            <div class="relative w-full mb-3">
                <input
                    v-model="state.password"
                    :type="state.showPassword ? 'text' : 'password'"
                    class="w-full p-4 pr-12 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    :class="!state.passwordError ? '' : 'bg-red-100 text-black'"
                    placeholder="Password"
                    :disabled="state.loading"
                    @keydown.enter="loginUser"
                />
                <button
                    type="button"
                    class="absolute right-4 top-1/2 -translate-y-1/2 text-gray-600 hover:text-gray-800 focus:outline-none"
                    :disabled="state.loading"
                    @click="state.showPassword = !state.showPassword"
                    :aria-label="state.showPassword ? 'Hide password' : 'Show password'"
                >
                    <font-awesome :icon="state.showPassword ? 'fas fa-eye-slash' : 'fas fa-eye'" />
                </button>
            </div>
            <div class="flex justify-end mb-5">
                <NuxtLink to="/forgot-password" class="text-sm text-blue-600 hover:underline">Forgot password?</NuxtLink>
            </div>
            <spinner v-if="state.loading"/>
            <button
                v-else
                type="button"
                class="w-full py-3 px-4 bg-primary-blue-100 hover:bg-primary-blue-300 text-white font-bold rounded-lg transition-colors"
                @click="loginUser"
                @keydown.enter="loginUser"
            >
                Login
            </button>

            <div class="mt-6 pt-6 border-t border-slate-200">
                <div class="text-center text-slate-600 mb-3 font-semibold text-sm">Or sign in with your organization</div>
                <input
                    v-model="state.ssoEmail"
                    type="email"
                    class="w-full p-4 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 mb-3"
                    :class="!state.ssoEmailError ? '' : 'bg-red-100 text-black'"
                    placeholder="Work email (you@company.com)"
                    :disabled="state.ssoLoading"
                    @keydown.enter="loginWithSSO"
                />
                <button
                    type="button"
                    class="w-full text-center p-3 bg-slate-800 text-white hover:bg-slate-700 cursor-pointer font-bold rounded-lg"
                    :class="state.ssoLoading ? 'opacity-60 cursor-not-allowed' : ''"
                    :disabled="state.ssoLoading"
                    @click="loginWithSSO"
                >
                    <font-awesome-icon :icon="['fas', 'building']" class="mr-2" />
                    {{ state.ssoLoading ? 'Redirecting...' : 'Continue with SSO' }}
                </button>
            </div>

            <p class="text-center text-sm text-gray-600 mt-6">
                New here?
                <NuxtLink to="/register" class="text-blue-600 hover:underline font-semibold">Create a free account</NuxtLink>
                <span class="mx-1 text-gray-400">·</span>
                <NuxtLink to="/#pricing" class="text-blue-600 hover:underline">See plans</NuxtLink>
            </p>
        </div>
    </div>
</template>