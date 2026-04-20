<script setup lang="ts">
import { useReCaptcha } from "vue-recaptcha-v3";
import { baseUrl, getGeneratedToken, getRecaptchaToken, verifyRecaptchaToken } from '~/composables/Utils';

const recaptcha = useReCaptcha();
const emit = defineEmits(['close']);
const { $swal } = useNuxtApp();

const state = reactive({
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

const countries = [
    'United States', 'Canada', 'United Kingdom', 'Germany', 'France', 'Australia', 
    'India', 'Japan', 'Brazil', 'Mexico', 'Spain', 'Italy', 'Netherlands', 
    'Sweden', 'Switzerland', 'Singapore', 'South Africa', 'Other'
];

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
        if (!recaptcha) {
            throw new Error('reCAPTCHA not initialized. Please refresh the page and try again.');
        }
        const recaptchaToken = await getRecaptchaToken(recaptcha, 'enterpriseInquiryModal');
        if (!recaptchaToken) {
            throw new Error('reCAPTCHA verification failed. Please refresh the page and try again.');
        }
        
        const recaptchaResponse = await verifyRecaptchaToken(state.token, recaptchaToken) as any;
        if (!recaptchaResponse.success || recaptchaResponse.action !== 'enterpriseInquiryModal' || recaptchaResponse.score <= 0.8) {
            throw new Error('reCAPTCHA verification failed. Please refresh the page and try again.');
        }
        
        const response = await $fetch<{ success: boolean }>(`${baseUrl()}/enterprise-inquiry`, {
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
        
        // Close modal after 2 seconds
        setTimeout(() => {
            emit('close');
        }, 2000);
        
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

function closeModal() {
    emit('close');
}
</script>

<template>
    <div class="fixed inset-0 z-50 overflow-y-auto" @click.self="closeModal">
        <div class="flex min-h-screen items-center justify-center p-4">
            <!-- Overlay -->
            <div class="fixed inset-0 bg-black bg-opacity-50 transition-opacity"></div>
            
            <!-- Modal -->
            <div class="relative bg-white rounded-2xl shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
                <!-- Header -->
                <div class="bg-primary-blue-100 px-6 py-4 rounded-t-2xl">
                    <div class="flex items-center justify-between">
                        <h2 class="text-2xl font-bold text-white">Contact Sales - Enterprise Plan</h2>
                        <button
                            @click="closeModal"
                            class="text-white hover:text-gray-200 transition-colors"
                        >
                            <font-awesome-icon :icon="['fas', 'xmark']" class="w-6 h-6" />
                        </button>
                    </div>
                    <p class="text-white/90 text-sm mt-2">
                        Get custom pricing tailored to your organization's needs
                    </p>
                </div>
                
                <!-- Form -->
                <form @submit.prevent="submitInquiry" class="p-6 space-y-5">
                    <!-- Name Row -->
                    <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                            <label class="block text-sm font-medium text-gray-700 mb-1">
                                First Name <span class="text-red-500">*</span>
                            </label>
                            <input
                                v-model="state.first_name"
                                type="text"
                                class="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-blue-100 focus:border-transparent"
                                :class="{ 'border-red-500': state.errors.first_name }"
                            />
                            <p v-if="state.errors.first_name" class="text-red-500 text-xs mt-1">{{ state.errors.first_name }}</p>
                        </div>
                        <div>
                            <label class="block text-sm font-medium text-gray-700 mb-1">
                                Last Name <span class="text-red-500">*</span>
                            </label>
                            <input
                                v-model="state.last_name"
                                type="text"
                                class="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-blue-100 focus:border-transparent"
                                :class="{ 'border-red-500': state.errors.last_name }"
                            />
                            <p v-if="state.errors.last_name" class="text-red-500 text-xs mt-1">{{ state.errors.last_name }}</p>
                        </div>
                    </div>
                    
                    <!-- Email -->
                    <div>
                        <label class="block text-sm font-medium text-gray-700 mb-1">
                            Business Email <span class="text-red-500">*</span>
                        </label>
                        <input
                            v-model="state.business_email"
                            type="email"
                            class="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-blue-100 focus:border-transparent"
                            :class="{ 'border-red-500': state.errors.business_email }"
                        />
                        <p v-if="state.errors.business_email" class="text-red-500 text-xs mt-1">{{ state.errors.business_email }}</p>
                    </div>
                    
                    <!-- Phone -->
                    <div>
                        <label class="block text-sm font-medium text-gray-700 mb-1">
                            Phone Number <span class="text-red-500">*</span>
                        </label>
                        <input
                            v-model="state.phone_number"
                            type="tel"
                            class="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-blue-100 focus:border-transparent"
                            :class="{ 'border-red-500': state.errors.phone_number }"
                        />
                        <p v-if="state.errors.phone_number" class="text-red-500 text-xs mt-1">{{ state.errors.phone_number }}</p>
                    </div>
                    
                    <!-- Company -->
                    <div>
                        <label class="block text-sm font-medium text-gray-700 mb-1">
                            Company Name <span class="text-red-500">*</span>
                        </label>
                        <input
                            v-model="state.company_name"
                            type="text"
                            class="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-blue-100 focus:border-transparent"
                            :class="{ 'border-red-500': state.errors.company_name }"
                        />
                        <p v-if="state.errors.company_name" class="text-red-500 text-xs mt-1">{{ state.errors.company_name }}</p>
                    </div>
                    
                    <!-- Country -->
                    <div>
                        <label class="block text-sm font-medium text-gray-700 mb-1">
                            Country <span class="text-red-500">*</span>
                        </label>
                        <select
                            v-model="state.country"
                            class="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-blue-100 focus:border-transparent"
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
                    <div class="flex items-start">
                        <input
                            v-model="state.agree_to_receive_updates"
                            type="checkbox"
                            class="mt-1 h-4 w-4 text-primary-blue-100 focus:ring-primary-blue-100 border-gray-300 rounded"
                        />
                        <label class="ml-2 text-sm text-gray-600">
                            I agree to receive product updates and marketing communications
                        </label>
                    </div>
                    
                    <!-- Submit Button -->
                    <div class="flex gap-3 pt-4">
                        <button
                            type="button"
                            @click="closeModal"
                            class="flex-1 px-6 py-3 border border-gray-300 rounded-lg font-semibold text-gray-700 hover:bg-gray-50 transition-colors"
                            :disabled="state.submitting"
                        >
                            Cancel
                        </button>
                        <button
                            type="submit"
                            class="flex-1 px-6 py-3 bg-primary-blue-100 hover:bg-primary-blue-300 text-white rounded-lg font-semibold transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
                            :disabled="state.submitting"
                        >
                            <span v-if="!state.submitting">Submit Inquiry</span>
                            <span v-else class="flex items-center justify-center">
                                <font-awesome-icon :icon="['fas', 'spinner']" class="animate-spin mr-2" />
                                Submitting...
                            </span>
                        </button>
                    </div>
                </form>
            </div>
        </div>
    </div>
</template>
