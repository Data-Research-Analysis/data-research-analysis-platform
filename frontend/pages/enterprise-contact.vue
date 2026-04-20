<script setup lang="ts">
definePageMeta({ layout: 'default' });

import { useReCaptcha } from "vue-recaptcha-v3";
import { baseUrl, getGeneratedToken, getRecaptchaToken, verifyRecaptchaToken } from '~/composables/Utils';
import { COUNTRIES } from '~/constants/countries';

const recaptcha = useReCaptcha();
const router = useRouter();
const { $swal } = useNuxtApp();

interface State {
    first_name: string;
    last_name: string;
    business_email: string;
    phone_number: string;
    company_name: string;
    country: string;
    agree_to_receive_updates: boolean;
    submitting: boolean;
    loading: boolean;
    token: string;
    errors: Record<string, any>;
}
const state = reactive<State>({
    first_name: '',
    last_name: '',
    business_email: '',
    phone_number: '',
    company_name: '',
    country: '',
    agree_to_receive_updates: false,
    submitting: false,
    loading: false,
    token: '',
    errors: {} as Record<string, string>
});

const countries = COUNTRIES;

function validateForm(): boolean {
    state.errors = {};
    
    if (!state.first_name.trim()) {
        state.errors.first_name = 'First name is required';
    }
    if (!state.last_name.trim()) {
        state.errors.last_name = 'Last name is required';
    }
    if (!state.business_email.trim()) {
        state.errors.business_email = 'Business email is required';
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(state.business_email)) {
        state.errors.business_email = 'Please enter a valid email';
    }
    if (!state.phone_number.trim()) {
        state.errors.phone_number = 'Phone number is required';
    }
    if (!state.company_name.trim()) {
        state.errors.company_name = 'Company name is required';
    }
    if (!state.country) {
        state.errors.country = 'Please select a country';
    }
    
    return Object.keys(state.errors).length === 0;
}

async function submitInquiry() {
    if (!validateForm()) return;
    
    state.submitting = true;
    
    try {
        const recaptchaToken = await getRecaptchaToken(recaptcha!, 'enterpriseInquiryForm');
        if (!recaptchaToken) {
            throw new Error('reCAPTCHA verification failed. Please refresh the page and try again.');
        }
        
        const recaptchaResponse = await verifyRecaptchaToken(state.token, recaptchaToken);
        if (!recaptchaResponse.success || recaptchaResponse.action !== 'enterpriseInquiryForm' || recaptchaResponse.score <= 0.8) {
            throw new Error('reCAPTCHA verification failed. Please refresh the page and try again.');
        }
        
        const response = await $fetch(`${baseUrl()}/enterprise-inquiry`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${state.token}`,
                'Authorization-Type': 'non-auth'
            },
            body: {
                first_name: state.first_name,
                last_name: state.last_name,
                business_email: state.business_email,
                phone_number: state.phone_number,
                company_name: state.company_name,
                country: state.country,
                agree_to_receive_updates: state.agree_to_receive_updates
            }
        });
        
        await $swal.fire({
            title: 'Thank You!',
            html: '<p>Your Enterprise inquiry has been submitted successfully.</p><p>Our sales team will contact you within 1-2 business days.</p>',
            icon: 'success',
            confirmButtonColor: '#1e3a5f',
        });
        
        // Navigate back to home after success
        router.push('/');
        
    } catch (error: any) {
        const errorMessage = error?.data?.message || error?.message || 'An error occurred while submitting your inquiry. Please try again.';
        $swal.fire({
            title: 'Error',
            text: errorMessage,
            icon: 'error',
            confirmButtonColor: '#1e3a5f',
        });
    } finally {
        state.submitting = false;
    }
}

async function getToken() {
    state.loading = true;
    const response = await getGeneratedToken();
    state.token = response.token;
    state.loading = false;
}

onMounted(async () => {
    await getToken();
});

useHead({ title: 'Contact Enterprise Sales' });
</script>

<template>
    <div class="min-h-screen bg-gray-50 py-12 px-4">
        <div class="max-w-2xl mx-auto">

            <!-- Back link -->
            <NuxtLink
                to="/"
                class="inline-flex items-center gap-2 text-sm text-gray-500 hover:text-gray-700 mb-8">
                <font-awesome-icon :icon="['fas', 'arrow-left']" />
                Back to Home
            </NuxtLink>

            <!-- Card -->
            <div class="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">

                <!-- Header banner -->
                <div class="bg-primary-blue-100 px-8 py-10 flex flex-col items-center gap-3">
                    <div class="w-16 h-16 bg-white rounded-full flex items-center justify-center shadow-lg">
                        <font-awesome-icon :icon="['fas', 'building']" class="text-primary-blue-100 text-2xl" />
                    </div>
                    <h1 class="text-3xl font-bold text-white text-center">Contact Sales - Enterprise Plan</h1>
                    <p class="text-white/90 text-sm text-center max-w-lg">
                        Get custom pricing tailored to your organization's needs with dedicated support and advanced features
                    </p>
                </div>

                <!-- Form -->
                <form @submit.prevent="submitInquiry" class="p-8 space-y-6">
                    
                    <!-- What you'll get -->
                    <div class="bg-blue-50 border border-blue-200 rounded-lg p-4">
                        <h2 class="text-sm font-semibold text-gray-900 uppercase tracking-wider mb-3">What's Included</h2>
                        <ul class="space-y-2">
                            <li class="flex items-start gap-3 text-sm text-gray-700">
                                <font-awesome-icon :icon="['fas', 'check']" class="text-primary-blue-100 mt-0.5 shrink-0" />
                                <span><strong>Unlimited data sources</strong> and custom integrations</span>
                            </li>
                            <li class="flex items-start gap-3 text-sm text-gray-700">
                                <font-awesome-icon :icon="['fas', 'check']" class="text-primary-blue-100 mt-0.5 shrink-0" />
                                <span><strong>Priority support</strong> with dedicated account manager</span>
                            </li>
                            <li class="flex items-start gap-3 text-sm text-gray-700">
                                <font-awesome-icon :icon="['fas', 'check']" class="text-primary-blue-100 mt-0.5 shrink-0" />
                                <span><strong>Advanced security</strong> and compliance features</span>
                            </li>
                            <li class="flex items-start gap-3 text-sm text-gray-700">
                                <font-awesome-icon :icon="['fas', 'check']" class="text-primary-blue-100 mt-0.5 shrink-0" />
                                <span><strong>Custom SLA</strong> and uptime guarantees</span>
                            </li>
                        </ul>
                    </div>

                    <!-- Name Row -->
                    <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                            <label class="block text-sm font-medium text-gray-700 mb-2">
                                First Name <span class="text-red-500">*</span>
                            </label>
                            <input
                                v-model="state.first_name"
                                type="text"
                                class="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-blue-100 focus:border-transparent transition-all"
                                :class="{ 'border-red-500': state.errors.first_name }"
                            />
                            <p v-if="state.errors.first_name" class="text-red-500 text-xs mt-1">{{ state.errors.first_name }}</p>
                        </div>
                        <div>
                            <label class="block text-sm font-medium text-gray-700 mb-2">
                                Last Name <span class="text-red-500">*</span>
                            </label>
                            <input
                                v-model="state.last_name"
                                type="text"
                                class="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-blue-100 focus:border-transparent transition-all"
                                :class="{ 'border-red-500': state.errors.last_name }"
                            />
                            <p v-if="state.errors.last_name" class="text-red-500 text-xs mt-1">{{ state.errors.last_name }}</p>
                        </div>
                    </div>
                    
                    <!-- Email -->
                    <div>
                        <label class="block text-sm font-medium text-gray-700 mb-2">
                            Business Email <span class="text-red-500">*</span>
                        </label>
                        <input
                            v-model="state.business_email"
                            type="email"
                            class="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-blue-100 focus:border-transparent transition-all"
                            :class="{ 'border-red-500': state.errors.business_email }"
                        />
                        <p v-if="state.errors.business_email" class="text-red-500 text-xs mt-1">{{ state.errors.business_email }}</p>
                    </div>
                    
                    <!-- Phone -->
                    <div>
                        <label class="block text-sm font-medium text-gray-700 mb-2">
                            Phone Number <span class="text-red-500">*</span>
                        </label>
                        <input
                            v-model="state.phone_number"
                            type="tel"
                            class="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-blue-100 focus:border-transparent transition-all"
                            :class="{ 'border-red-500': state.errors.phone_number }"
                        />
                        <p v-if="state.errors.phone_number" class="text-red-500 text-xs mt-1">{{ state.errors.phone_number }}</p>
                    </div>
                    
                    <!-- Company -->
                    <div>
                        <label class="block text-sm font-medium text-gray-700 mb-2">
                            Company Name <span class="text-red-500">*</span>
                        </label>
                        <input
                            v-model="state.company_name"
                            type="text"
                            class="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-blue-100 focus:border-transparent transition-all"
                            :class="{ 'border-red-500': state.errors.company_name }"
                        />
                        <p v-if="state.errors.company_name" class="text-red-500 text-xs mt-1">{{ state.errors.company_name }}</p>
                    </div>
                    
                    <!-- Country -->
                    <div>
                        <label class="block text-sm font-medium text-gray-700 mb-2">
                            Country <span class="text-red-500">*</span>
                        </label>
                        <select
                            v-model="state.country"
                            class="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-blue-100 focus:border-transparent transition-all"
                            :class="{ 'border-red-500': state.errors.country }"
                        >
                            <option value="">Select a country</option>
                            <option v-for="country in countries" :key="country" :value="country">
                                {{ country }}
                            </option>
                        </select>
                        <p v-if="state.errors.country" class="text-red-500 text-xs mt-1">{{ state.errors.country }}</p>
                    </div>
                    
                    <!-- Updates Checkbox -->
                    <div class="flex items-start gap-3 p-4 bg-gray-50 rounded-lg">
                        <input
                            v-model="state.agree_to_receive_updates"
                            type="checkbox"
                            id="updates-checkbox"
                            class="mt-1 h-4 w-4 text-primary-blue-100 focus:ring-primary-blue-100 border-gray-300 rounded"
                        />
                        <label for="updates-checkbox" class="text-sm text-gray-600 cursor-pointer">
                            I agree to receive product updates and marketing communications from Data Research Analysis
                        </label>
                    </div>
                    
                    <!-- Submit Button -->
                    <div class="flex gap-4 pt-4">
                        <NuxtLink
                            to="/"
                            class="flex-1 px-6 py-3 border-2 border-gray-300 rounded-lg font-semibold text-gray-700 hover:bg-gray-50 transition-colors text-center"
                        >
                            Cancel
                        </NuxtLink>
                        <button
                            type="submit"
                            class="flex-1 px-6 py-3 bg-primary-blue-100 hover:bg-primary-blue-300 text-white rounded-lg font-semibold transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed shadow-lg hover:shadow-xl cursor-pointer"
                            :disabled="state.submitting"
                        >
                            <span v-if="!state.submitting">Submit Inquiry</span>
                            <span v-else class="flex items-center justify-center gap-2">
                                <font-awesome-icon :icon="['fas', 'spinner']" class="animate-spin" />
                                Submitting...
                            </span>
                        </button>
                    </div>
                </form>
            </div>
        </div>
    </div>
</template>
