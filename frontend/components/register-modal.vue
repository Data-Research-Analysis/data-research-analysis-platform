<script setup lang="ts">
// Props and emits
const props = defineProps<{
    isOpen: boolean;
}>();

const emit = defineEmits<{
    close: [];
}>();

// useReCaptcha must be deferred to client-side to avoid SSR hydration mismatch
let recaptcha: any = null;
if (import.meta.client) {
    const { useReCaptcha } = await import('vue-recaptcha-v3');
    recaptcha = useReCaptcha();
}

const state = reactive({
    firstName: "",
    lastName: "",
    email: "",
    password: "",
    rePassword: "",
    firstNameError: false,
    lastNameError: false,
    emailError: false,
    passwordError: false,
    rePasswordError: false,
    errorMessages: [] as string[],
    registrationSuccess: false,
    showAlert: false,
    token: "",
    loading: false,
});

async function getToken() {
    state.loading = true;
    const response = await getGeneratedToken() as any;
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
        state.loading = false;
        return;
    }

    const recaptchaToken = await getRecaptchaToken(recaptcha, 'registerForm');
    if (recaptchaToken) {
        const recaptchaResponse = await verifyRecaptchaToken(state.token, recaptchaToken) as any;
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
                },
            };
            try {
                const data = await $fetch(`${baseUrl()}/auth/register`, {
                    method: "POST",
                    ...requestOptions
                }) as any;
                state.registrationSuccess = true;
                state.showAlert = true;
                state.errorMessages.push(data.message);
                
                // Wait 2 seconds, then close modal and redirect to login
                if (import.meta.client) {
                    setTimeout(() => {
                        emit('close');
                        navigateTo('/login');
                    }, 2000);
                }
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
    state.loading = false;
}

function closeModal() {
    emit('close');
}

function handleBackdropClick(event: MouseEvent) {
    // Only close if clicking the backdrop itself, not its children
    if (event.target === event.currentTarget) {
        closeModal();
    }
}

// Initialize token when modal opens
watch(() => props.isOpen, async (isOpen) => {
    if (isOpen && !state.token) {
        await getToken();
    }
});

// Handle escape key to close modal
onMounted(() => {
    if (import.meta.client) {
        const handleEscape = (event: KeyboardEvent) => {
            if (event.key === 'Escape' && props.isOpen) {
                closeModal();
            }
        };
        window.addEventListener('keydown', handleEscape);
        
        // Cleanup on unmount
        onUnmounted(() => {
            window.removeEventListener('keydown', handleEscape);
        });
    }
});
</script>

<template>
    <!-- Modal Overlay -->
    <Transition name="modal-fade">
        <div
            v-if="isOpen"
            class="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50 p-4"
            @click="handleBackdropClick"
        >
            <!-- Modal Content -->
            <div class="bg-white rounded-2xl shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto relative">
                <!-- Close Button -->
                <button
                    @click="closeModal"
                    class="absolute top-4 right-4 text-gray-400 hover:text-gray-600 transition-colors"
                    aria-label="Close modal"
                >
                    <font-awesome-icon :icon="['fas', 'xmark']" class="w-6 h-6" />
                </button>

                <!-- Modal Header -->
                <div class="px-8 pt-8 pb-4 border-b border-gray-200">
                    <h2 class="text-3xl font-bold text-gray-900 mb-2">
                        Register for Free Account
                    </h2>
                    <p class="text-gray-600">
                        Our paid plans are coming soon! In the meantime, create a free account to get started with Data Research Analysis.
                    </p>
                </div>

                <!-- Modal Body -->
                <div class="px-8 py-6">
                    <!-- Alert Banner -->
                    <div
                        v-if="state.showAlert"
                        class="p-4 mb-6 rounded-lg"
                        :class="state.registrationSuccess ? 'bg-green-100 border border-green-400' : 'bg-red-100 border border-red-400'"
                    >
                        <div class="font-bold text-lg mb-1" :class="state.registrationSuccess ? 'text-green-800' : 'text-red-800'">
                            {{ state.registrationSuccess ? 'Success!' : 'Error!' }}
                        </div>
                        <div
                            v-for="(message, idx) in state.errorMessages"
                            :key="idx"
                            :class="state.registrationSuccess ? 'text-green-700' : 'text-red-700'"
                        >
                            {{ message }}
                        </div>
                        <div v-if="state.registrationSuccess" class="text-green-700 text-sm mt-2">
                            Redirecting to login...
                        </div>
                    </div>

                    <!-- Registration Form -->
                    <form @submit.prevent="createAccount" class="space-y-4">
                        <!-- First Name -->
                        <div>
                            <label for="firstName" class="block text-sm font-medium text-gray-700 mb-1">
                                First Name <span class="text-red-500">*</span>
                            </label>
                            <input
                                id="firstName"
                                v-model="state.firstName"
                                type="text"
                                class="w-full px-4 py-3 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
                                :class="state.firstNameError ? 'border-red-500 bg-red-50' : 'border-gray-300'"
                                placeholder="Enter your first name"
                                :disabled="state.loading"
                            />
                        </div>

                        <!-- Last Name -->
                        <div>
                            <label for="lastName" class="block text-sm font-medium text-gray-700 mb-1">
                                Last Name <span class="text-red-500">*</span>
                            </label>
                            <input
                                id="lastName"
                                v-model="state.lastName"
                                type="text"
                                class="w-full px-4 py-3 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
                                :class="state.lastNameError ? 'border-red-500 bg-red-50' : 'border-gray-300'"
                                placeholder="Enter your last name"
                                :disabled="state.loading"
                            />
                        </div>

                        <!-- Email -->
                        <div>
                            <label for="email" class="block text-sm font-medium text-gray-700 mb-1">
                                Email <span class="text-red-500">*</span>
                            </label>
                            <input
                                id="email"
                                v-model="state.email"
                                type="email"
                                class="w-full px-4 py-3 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
                                :class="state.emailError ? 'border-red-500 bg-red-50' : 'border-gray-300'"
                                placeholder="your.email@example.com"
                                :disabled="state.loading"
                            />
                        </div>

                        <!-- Password -->
                        <div>
                            <label for="password" class="block text-sm font-medium text-gray-700 mb-1">
                                Password <span class="text-red-500">*</span>
                            </label>
                            <input
                                id="password"
                                v-model="state.password"
                                type="password"
                                class="w-full px-4 py-3 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
                                :class="state.passwordError ? 'border-red-500 bg-red-50' : 'border-gray-300'"
                                placeholder="Minimum 8 characters"
                                :disabled="state.loading"
                                v-tippy="{ content: 'Password should be atleast 8 characters in length, have aleast one lowercase character, atleast one upper case character, atleast a number between 0 and 9 and atleast one special character (#?!@$%^&*-).' }"
                            />
                        </div>

                        <!-- Confirm Password -->
                        <div>
                            <label for="rePassword" class="block text-sm font-medium text-gray-700 mb-1">
                                Confirm Password <span class="text-red-500">*</span>
                            </label>
                            <input
                                id="rePassword"
                                v-model="state.rePassword"
                                type="password"
                                class="w-full px-4 py-3 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
                                :class="state.rePasswordError ? 'border-red-500 bg-red-50' : 'border-gray-300'"
                                placeholder="Re-enter your password"
                                :disabled="state.loading"
                                v-tippy="{ content: 'Repeat Password should be the same as the Password given above.' }"
                            />
                        </div>

                        <!-- Submit Button -->
                        <div class="pt-4">
                            <button
                                type="submit"
                                :disabled="state.loading"
                                class="w-full py-3 px-6 bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800 text-white font-semibold rounded-lg shadow-lg transition-all duration-200 transform hover:scale-105 disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none flex items-center justify-center gap-2"
                            >
                                <spinner v-if="state.loading" class="w-5 h-5" />
                                <span v-else>Create Free Account</span>
                            </button>
                        </div>

                        <!-- Already have account link -->
                        <div class="text-center text-sm text-gray-600 pt-2">
                            Already have an account?
                            <NuxtLink to="/login" class="text-blue-600 hover:text-blue-700 font-medium" @click="closeModal">
                                Sign in
                            </NuxtLink>
                        </div>
                    </form>
                </div>
            </div>
        </div>
    </Transition>
</template>
