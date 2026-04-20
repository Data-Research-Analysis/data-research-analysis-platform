<script setup lang="ts">
import { useReCaptcha } from "vue-recaptcha-v3";
const recaptcha = useReCaptcha();

// SEO Meta Tags for Register Page
useHead({
    title: 'Register - Create Your Free Account | Data Research Analysis',
    meta: [
        { name: 'description', content: 'Create a free Data Research Analysis account to start building data dashboards, connecting data sources, and visualizing your data insights.' },
        { name: 'robots', content: 'index, follow' },
        
        // Open Graph / Facebook
        { property: 'og:type', content: 'website' },
        { property: 'og:title', content: 'Register - Data Research Analysis' },
        { property: 'og:description', content: 'Create your free account and start analyzing data today.' },
        { property: 'og:url', content: 'https://dataresearchanalysis.com/register' },
        
        // Twitter
        { name: 'twitter:card', content: 'summary' },
        { name: 'twitter:title', content: 'Register - Data Research Analysis' },
        { name: 'twitter:description', content: 'Create your free account and start analyzing data today.' },
    ],
    link: [
        { rel: 'canonical', href: 'https://dataresearchanalysis.com/register' }
    ]
});

interface State {
    firstName: string;
    lastName: string;
    email: string;
    password: string;
    rePassword: string;
    interestedPlan: string;
    interestedBillingCycle: string;
    firstNameError: boolean;
    lastNameError: boolean;
    emailError: boolean;
    passwordError: boolean;
    rePasswordError: boolean;
    errorMessages: any[];
    registrationSuccess: boolean;
    showAlert: boolean;
    token: string;
    loading: boolean;
    showPassword: boolean;
    showRepeatPassword: boolean;
}
const state = reactive<State>({
    firstName: "",
    lastName: "",
    email: "",
    password: "",
    rePassword: "",
    interestedPlan: "", // Track which plan they're interested in
    interestedBillingCycle: "annual" as "monthly" | "annual", // Track billing cycle preference
    firstNameError: false,
    lastNameError: false,
    emailError: false,
    passwordError: false,
    rePasswordError: false,
    errorMessages: [],
    registrationSuccess: false,
    showAlert: false,
    token: "",
    loading: false,
    showPassword: false,
    showRepeatPassword: false,
});

async function getToken() {
    state.loading = true;
    const response = await getGeneratedToken();
    state.token = response.token;
    state.loading = false;
}

async function createAccount() {
    state.loading = true;
    state.showAlert = false;
    state.registrationSuccess = false;
    state.errorMessages = [];
    if (!validate(state.firstName, "", [validateRequired])) {
        state.firstNameError = true;
        state.errorMessages.push("Please enter your first name.");
    } else {
        state.firstNameError = false;
    }

    if (!validate(state.lastName, "", [validateRequired])) {
        state.lastNameError = true;
        state.errorMessages.push("Please enter your last name.");
    } else {
        state.lastNameError = false;
    }

    if (!validate(state.email, "", [validateEmail, validateRequired])) {
        state.emailError = true;
        state.errorMessages.push("Please enter a valid email address.");
    } else {
        state.emailError = false;
    }

    if (!validate(state.password, "", [validatePassword, validateRequired])) {
        state.passwordError = true;
        state.errorMessages.push("Please enter a valid password.");
    } else {
        state.passwordError = false;
    }

    if (!validate(state.password, state.rePassword, [validateSamePassword])) {
        state.passwordError = true;
        state.rePasswordError = true;
        state.errorMessages.push("Both the passwords must be the same.");
    } else {
        state.rePasswordError = false;
    }

    if (state.firstNameError || state.lastNameError || state.emailError || state.passwordError || state.rePasswordError) {
        state.registrationSuccess = false;
        state.showAlert = true;
    } else {
        const recaptchaToken = await getRecaptchaToken(recaptcha!, 'registerForm');
        if (recaptchaToken) {
            const recaptchaResponse = await verifyRecaptchaToken(state.token, recaptchaToken);
            if (recaptchaResponse.success && recaptchaResponse.action === "registerForm" && recaptchaResponse.score > 0.8) {
                const requestOptions = {
                headers: {
                    "Authorization": `Bearer ${state.token}`,
                    "Authorization-Type": "non-auth",
                },
                body: {
                  first_name: state.firstName,
                  last_name: state.lastName,  
                  email: state.email,
                  password: state.password,
                  ...(state.interestedPlan && { interested_plan: state.interestedPlan }),
                  ...(state.interestedBillingCycle && { interested_billing_cycle: state.interestedBillingCycle }),
                },
              };
              try {
                const data = await $fetch<any>(`${baseUrl()}/auth/register`, {
                  method: "POST",
                  ...requestOptions
                });
                state.registrationSuccess = true;
                
                // Check for invitation token in URL
                const route = useRoute();
                const router = useRouter();
                const invitationToken = route.query.token as string | undefined;
                
                if (invitationToken) {
                  try {
                    // Auto-login the user
                    const loginResponse = await $fetch<any>(`${baseUrl()}/auth/login`, {
                      method: "POST",
                      headers: {
                        "Authorization": `Bearer ${state.token}`,
                        "Authorization-Type": "non-auth",
                      },
                      body: {
                        email: state.email,
                        password: state.password,
                      }
                    });
                    
                    if (loginResponse.token) {
                      // Save the auth token to cookie
                      if (import.meta.client) {
                        const authCookie = useCookie('dra_auth_token', {
                          maxAge: 60 * 60 * 24 * 7, // 7 days
                          path: '/',
                          sameSite: 'lax'
                        });
                        authCookie.value = loginResponse.token;
                      }
                      
                      // Auto-accept the organization invitation
                      const config = useRuntimeConfig();
                      await $fetch<any>(`${config.public.apiBase}/organization-invitations/accept`, {
                        method: "POST",
                        headers: {
                          "Authorization": `Bearer ${loginResponse.token}`,
                          "Authorization-Type": "auth",
                          "Content-Type": "application/json",
                        },
                        body: {
                          token: invitationToken
                        }
                      });
                      
                      // Force full page navigation to projects (ensures middleware runs and state is fresh)
                      if (import.meta.client) {
                        window.location.href = '/projects';
                      }
                      return;
                    }
                  } catch (inviteError: any) {
                    console.error('Failed to auto-accept invitation:', inviteError);
                    // Continue with normal registration flow if invitation fails
                  }
                }
                
                // Normal registration flow (no invitation or invitation failed)
                // Auto-login and redirect to pricing if user came from paid plan selection
                if (state.interestedPlan && state.interestedPlan !== 'free') {
                  try {
                    // Auto-login the user
                    const loginResponse = await $fetch<any>(`${baseUrl()}/auth/login`, {
                      method: "POST",
                      headers: {
                        "Authorization": `Bearer ${state.token}`,
                        "Authorization-Type": "non-auth",
                      },
                      body: {
                        email: state.email,
                        password: state.password,
                      }
                    });
                    
                    if (loginResponse.token) {
                      // Save the auth token to cookie
                      if (import.meta.client) {
                        const authCookie = useCookie('dra_auth_token', {
                          maxAge: 60 * 60 * 24 * 7, // 7 days
                          path: '/',
                          sameSite: 'lax'
                        });
                        authCookie.value = loginResponse.token;
                      }
                      
                      // Redirect to projects page - Paddle overlay will auto-show if interested_plan is set
                      if (import.meta.client) {
                        window.location.href = '/projects';
                      }
                      return;
                    }
                  } catch (loginError: any) {
                    console.error('Failed to auto-login after registration:', loginError);
                    // Continue with normal flow to show success message and manual login
                  }
                }
                
                // Show success message for free plan or if auto-login failed
                state.showAlert = true;
                state.errorMessages.push(data.message);
                state.firstName = "";
                state.lastName = "";
                state.email = "";
                state.password = "";
                state.rePassword = "";
              } catch (error: any) {
                state.registrationSuccess = false;
                state.showAlert = true;
                state.errorMessages.push(error.data?.message || 'Registration failed. Please try again.');
              }
            } else {
                state.registrationSuccess = false;
                state.showAlert = true;
                state.errorMessages.push("Recaptcha verification failed. Please refresh the page and try again.");    
            }
        } else {
            state.registrationSuccess = false;
            state.showAlert = true;
            state.errorMessages.push("Recaptcha verification failed. Please refresh the page and try again.");
        }
    }
    state.loading = false;
}

onMounted(async () => {
    await getToken();
    
    // Read plan and billing cycle parameters from URL query
    const route = useRoute();
    if (route.query.plan && typeof route.query.plan === 'string') {
        state.interestedPlan = route.query.plan;
    }
    if (route.query.cycle && typeof route.query.cycle === 'string') {
        const cycle = route.query.cycle.toLowerCase();
        if (cycle === 'monthly' || cycle === 'annual') {
            state.interestedBillingCycle = cycle;
        }
    }
    
    // Only add event listeners on client side for SSR compatibility
    if (import.meta.client) {
        window.addEventListener("keydown", (event) => {
            if (event.key === "Enter") {
                createAccount();
            }
        });
    }
})
</script>
<template>
    <div class="mt-10 flex flex-row justify-center w-full">
        <div class="mt-10 flex flex-col justify-center w-1/2 border border-primary-blue-100 border-solid m-10 p-5 shadow-md">
            <div class="self-center font-bold text-2xl mb-5">
                Data Research Analysis Registration
            </div>
            <div class="self-center text-md mb-5">
               Please enter your details to create an account. All of the fields are required to be filled.
            </div>
            <div v-if="state.showAlert"
                class="w-3/4 self-center text-lg p-5 mb-5 font-bold text-black"
                :class="{ 'bg-green-400': state.registrationSuccess, 'bg-red-400': !state.registrationSuccess }">
                <div v-if="state.registrationSuccess" class="text-2xl">Success!</div>
                <div v-else class="text-2xl">Error!</div>
                <template v-for="message in state.errorMessages">
                    <div>{{ message }}</div>
                </template>
            </div>
            <input
                v-model="state.firstName"
                type="text"
                class="self-center w-3/4 p-5 border border-primary-blue-100 border-solid hover:border-blue-200 mb-5 shadow-md"
                :class="!state.firstNameError ? '' : 'bg-red-300 text-black'"
                placeholder="First Name"
                :disabled="state.loading"
                @keydown.enter="createAccount"
            />
            <input
                v-model="state.lastName"
                type="text"
                class="self-center w-3/4 p-5 border border-primary-blue-100 border-solid hover:border-blue-200 mb-5 shadow-md"
                :class="!state.lastNameError ? '' : 'bg-red-300 text-black'"
                placeholder="Last Name"
                :disabled="state.loading"
                @keydown.enter="createAccount"
            />
            <input
                v-model="state.email"
                type="text"
                class="self-center w-3/4 p-5 border border-primary-blue-100 border-solid hover:border-blue-200 mb-5 shadow-md"
                :class="!state.emailError ? '' : 'bg-red-300 text-black'"
                placeholder="Email"
                :disabled="state.loading"
                @keydown.enter="createAccount"
            />
            <div class="relative self-center w-3/4 mb-5">
                <input
                    v-model="state.password"
                    :type="state.showPassword ? 'text' : 'password'"
                    class="w-full p-5 pr-12 border border-primary-blue-100 border-solid hover:border-blue-200 shadow-md"
                    :class="!state.passwordError ? '' : 'bg-red-300 text-black'"
                    placeholder="Password"
                    v-tippy="{ content: 'Password should be atleast 8 characters in length, have aleast one lowercase character, atleast one upper case character, atleast a number between 0 and 9 and atleast one special character (#?!@$%^&*-).' }"
                    :disabled="state.loading"
                    @keydown.enter="createAccount"
                />
                <button
                    type="button"
                    class="absolute right-4 top-1/2 -translate-y-1/2 text-gray-600 hover:text-gray-800 focus:outline-none"
                    @click="state.showPassword = !state.showPassword"
                    :disabled="state.loading"
                >
                    <font-awesome-icon :icon="['fas', state.showPassword ? 'eye-slash' : 'eye']" class="w-5 h-5 cursor-pointer" />
                </button>
            </div>
            <div class="relative self-center w-3/4 mb-5">
                <input
                    v-model="state.rePassword"
                    :type="state.showRepeatPassword ? 'text' : 'password'"
                    class="w-full p-5 pr-12 border border-primary-blue-100 border-solid hover:border-blue-200 shadow-md"
                    :class="!state.rePasswordError ? '' : 'bg-red-300 text-black'"
                    placeholder="Repeat Password"
                    v-tippy="{ content: 'Repeast Password should be the same as the Password given above.' }"
                    :disabled="state.loading"
                    @keydown.enter="createAccount"
                />
                <button
                    type="button"
                    class="absolute right-4 top-1/2 -translate-y-1/2 text-gray-600 hover:text-gray-800 focus:outline-none"
                    @click="state.showRepeatPassword = !state.showRepeatPassword"
                    :disabled="state.loading"
                >
                    <font-awesome-icon :icon="['fas', state.showRepeatPassword ? 'eye-slash' : 'eye']" class="w-5 h-5 cursor-pointer" />
                </button>
            </div>
            <spinner v-if="state.loading"/>
            <div
                v-else
                class="w-1/4 text-center self-center mb-5 p-2 m-2 bg-primary-blue-100 text-white hover:bg-primary-blue-300 cursor-pointer font-bold shadow-md rounded-lg"
                @click="createAccount"
                @keydown.enter="createAccount"
            >
                Create Account
            </div>
        </div>
    </div>
</template>