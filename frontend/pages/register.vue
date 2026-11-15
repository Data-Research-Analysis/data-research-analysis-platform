<script setup lang="ts">
import { useReCaptcha } from "vue-recaptcha-v3";
const recaptcha = useReCaptcha();
const { pushConversion } = useConversion();

// SEO Meta Tags for Register Page
useHead({
    title: 'Register - Create Your Free Account | Data Research Analysis',
    meta: [
        { name: 'description', content: 'Create a free account to keep the paid media plan you just built — channel-by-channel budgets, ad copy, creatives, and tracking — plus 1,000 credits to start.' },
        { name: 'robots', content: 'index, follow' },
        
        // Open Graph / Facebook
        { property: 'og:type', content: 'website' },
        { property: 'og:title', content: 'Register - Data Research Analysis' },
        { property: 'og:description', content: 'Create your free account and keep your AI-built paid media plan.' },
        { property: 'og:url', content: 'https://www.dataresearchanalysis.com/register' },

        // Twitter
        { name: 'twitter:card', content: 'summary' },
        { name: 'twitter:title', content: 'Register - Data Research Analysis' },
        { name: 'twitter:description', content: 'Create your free account and keep your AI-built paid media plan.' },
    ],
    link: [
        { rel: 'canonical', href: 'https://www.dataresearchanalysis.com/register' }
    ]
});

const route = useRoute();

function normalizeBillingCycle(value: unknown): 'monthly' | 'annual' {
    return typeof value === 'string' && value.toLowerCase() === 'monthly' ? 'monthly' : 'annual';
}

function normalizeCredits(value: unknown): number | null {
    if (typeof value !== 'string') return null;
    const credits = Number(value);
    return Number.isInteger(credits) && credits >= 5000 && credits <= 100000 && credits % 5000 === 0
        ? credits
        : null;
}

interface State {
    firstName: string;
    lastName: string;
    email: string;
    password: string;
    rePassword: string;
    interestedPlan: string;
    interestedBillingCycle: string;
    interestedCredits: number | null;
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
    interestedPlan: typeof route.query.plan === 'string' ? route.query.plan : "",
    interestedBillingCycle: normalizeBillingCycle(route.query.cycle),
    interestedCredits: normalizeCredits(route.query.credits),
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
                  ...(state.interestedCredits && { interested_credits: state.interestedCredits }),
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
                
                // Guest lead-in: if this visitor built a plan before registering,
                // claim it into the new account and take them straight back to it.
                const guestPlanToken = import.meta.client ? localStorage.getItem('dra_guest_plan_token') : null;
                const isFreeSignup = !state.interestedPlan || state.interestedPlan === 'free';
                if (guestPlanToken && isFreeSignup) {
                  try {
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
                      if (import.meta.client) {
                        const authCookie = useCookie('dra_auth_token', {
                          maxAge: 60 * 60 * 24 * 7,
                          path: '/',
                          sameSite: 'lax'
                        });
                        authCookie.value = loginResponse.token;
                      }

                      const claimed = await $fetch<any>(`${baseUrl()}/guest/plans/${guestPlanToken}/claim`, {
                        method: "POST",
                        headers: {
                          "Authorization": `Bearer ${loginResponse.token}`,
                          "Authorization-Type": "auth",
                          "Content-Type": "application/json",
                        },
                      });
                      const claimedPlan = claimed?.data ?? claimed;
                      if (import.meta.client) {
                        localStorage.removeItem('dra_guest_plan_token');
                        if (claimed?.credits_balance !== null && claimed?.credits_balance !== undefined) {
                          sessionStorage.setItem(
                            'dra_credit_notice',
                            `Guest plan claimed — ${Number(claimed.credits_balance).toLocaleString()} credits left this month.`
                          );
                        }
                      }

                      if (claimedPlan?.projectId && claimedPlan?.id) {
                        if (import.meta.client) {
                          window.location.href = `/projects/${claimedPlan.projectId}/plan/${claimedPlan.id}`;
                        }
                        return;
                      }
                    }
                  } catch (claimError: any) {
                    console.error('Failed to claim guest plan after registration:', claimError);
                    // Fall through to the normal registration success flow.
                  }
                }

                // Auto-login and take the new user straight into the product.
                // Applies to both Free and paid plan selection. (The guest-claim
                // path above already returned if it succeeded.)
                try {
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
                    if (import.meta.client) {
                      const authCookie = useCookie('dra_auth_token', {
                        maxAge: 60 * 60 * 24 * 7, // 7 days
                        path: '/',
                        sameSite: 'lax'
                      });
                      authCookie.value = loginResponse.token;

                      if (!state.interestedPlan || state.interestedPlan === 'free') {
                        pushConversion('free_signup', 'register_free', 'free_tier');
                      }
                    }

                    // Paid plans land on /projects where the Paddle overlay auto-shows.
                    if (import.meta.client) {
                      window.location.href = '/projects';
                    }
                    return;
                  }
                } catch (loginError: any) {
                  console.error('Failed to auto-login after registration:', loginError);
                  // Fall through to the success message so the user can log in manually.
                }

                // Fallback: auto-login failed — show a success message and manual-login hint.
                if (!state.interestedPlan || state.interestedPlan === 'free') {
                    pushConversion('free_signup', 'register_free', 'free_tier');
                }
                state.showAlert = true;
                state.errorMessages.push(data.message);
                if (!state.interestedPlan || state.interestedPlan === 'free') {
                    state.errorMessages.push('You start with 1,000 credits: 500 monthly credits plus a one-time 500-credit onboarding bonus.');
                }
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
    <div class="min-h-[calc(100vh-80px)] flex items-start justify-center px-4 py-10">
        <div class="w-full max-w-md bg-white rounded-2xl shadow-lg border border-slate-200 p-8">
            <div class="text-center mb-6">
                <h1 class="text-2xl font-bold text-gray-900">Create your free account</h1>
                <p class="text-sm text-gray-600 mt-2">Build a paid media plan in minutes — then track live campaigns against it.</p>
            </div>

            <div class="mb-5 rounded-xl border border-blue-200 bg-blue-50 px-4 py-3 text-sm text-blue-900">
                <template v-if="state.interestedPlan && state.interestedPlan !== 'free'">
                    Selected plan: <strong>Pro</strong> — {{ state.interestedCredits ? state.interestedCredits.toLocaleString() : '5,000' }} credits/month
                </template>
                <template v-else>
                    Selected plan: <strong>Free</strong> — 1,000 credits to start (500/month plus a one-time 500-credit onboarding bonus)
                </template>
            </div>

            <div v-if="state.showAlert"
                class="w-full text-sm p-4 mb-5 rounded-lg font-medium text-black"
                :class="{ 'bg-green-100 text-green-900': state.registrationSuccess, 'bg-red-100 text-red-900': !state.registrationSuccess }">
                <div v-if="state.registrationSuccess" class="text-lg font-bold">Success!</div>
                <div v-else class="text-lg font-bold">Error!</div>
                <template v-for="message in state.errorMessages">
                    <div>{{ message }}</div>
                </template>
            </div>

            <input
                v-model="state.firstName"
                type="text"
                class="w-full p-4 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 mb-4"
                :class="!state.firstNameError ? '' : 'bg-red-100 text-black'"
                placeholder="First Name"
                :disabled="state.loading"
                @keydown.enter="createAccount"
            />
            <input
                v-model="state.lastName"
                type="text"
                class="w-full p-4 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 mb-4"
                :class="!state.lastNameError ? '' : 'bg-red-100 text-black'"
                placeholder="Last Name"
                :disabled="state.loading"
                @keydown.enter="createAccount"
            />
            <input
                v-model="state.email"
                type="text"
                class="w-full p-4 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 mb-4"
                :class="!state.emailError ? '' : 'bg-red-100 text-black'"
                placeholder="Email"
                :disabled="state.loading"
                @keydown.enter="createAccount"
            />
            <div class="relative w-full mb-4">
                <input
                    v-model="state.password"
                    :type="state.showPassword ? 'text' : 'password'"
                    class="w-full p-4 pr-12 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    :class="!state.passwordError ? '' : 'bg-red-100 text-black'"
                    placeholder="Password"
                    v-tippy="{ content: 'Password should be at least 8 characters in length, have at least one lowercase character, at least one upper case character, at least a number between 0 and 9 and at least one special character (#?!@$%^&*-).' }"
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
            <div class="relative w-full mb-5">
                <input
                    v-model="state.rePassword"
                    :type="state.showRepeatPassword ? 'text' : 'password'"
                    class="w-full p-4 pr-12 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    :class="!state.rePasswordError ? '' : 'bg-red-100 text-black'"
                    placeholder="Repeat Password"
                    v-tippy="{ content: 'Repeat Password should be the same as the Password given above.' }"
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
            <button
                v-else
                type="button"
                class="w-full py-3 px-4 bg-primary-blue-100 hover:bg-primary-blue-300 text-white font-bold rounded-lg transition-colors"
                @click="createAccount"
                @keydown.enter="createAccount"
            >
                Create Account
            </button>

            <p class="text-center text-sm text-gray-600 mt-6">
                Already have an account?
                <NuxtLink to="/login" class="text-blue-600 hover:underline">Log in</NuxtLink>
            </p>
        </div>
    </div>
</template>