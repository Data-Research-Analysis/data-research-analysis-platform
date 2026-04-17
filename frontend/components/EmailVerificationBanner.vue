<template>
    <div v-if="showBanner" class="bg-amber-50 border-b border-amber-200">
        <div class="max-w-7xl mx-auto px-4 py-3">
            <div class="flex items-center justify-between flex-wrap gap-3">
                <div class="flex items-center gap-3 flex-1">
                    <div class="flex-shrink-0">
                        <font-awesome-icon :icon="['fas', 'triangle-exclamation']" class="text-amber-600 text-xl" />
                    </div>
                    <div class="flex-1 min-w-0">
                        <p class="text-sm font-medium text-amber-900">
                            Please verify your email address
                        </p>
                        <p class="text-sm text-amber-700">
                            We sent a verification link to <span class="font-semibold">{{ userEmail }}</span>. 
                            Check your inbox to verify your account.
                        </p>
                    </div>
                </div>
                
                <div class="flex items-center gap-3">
                    <button
                        v-if="!isResending"
                        @click="resendVerificationEmail"
                        class="px-4 py-2 text-sm font-medium text-amber-900 bg-amber-100 rounded-md hover:bg-amber-200 transition-colors cursor-pointer"
                    >
                        Resend Email
                    </button>
                    <button
                        v-else
                        disabled
                        class="px-4 py-2 text-sm font-medium text-amber-900 bg-amber-100 rounded-md opacity-50 cursor-not-allowed"
                    >
                        <font-awesome-icon :icon="['fas', 'spinner']" class="animate-spin mr-2" />
                        Sending...
                    </button>
                    
                    <button
                        @click="dismissBanner"
                        class="p-2 text-amber-700 hover:text-amber-900 transition-colors cursor-pointer"
                        title="Dismiss"
                    >
                        <font-awesome-icon :icon="['fas', 'xmark']" class="text-lg" />
                    </button>
                </div>
            </div>
        </div>
    </div>
</template>

<script setup lang="ts">
import { useLoggedInUserStore } from '~/stores/logged_in_user';

const loggedInUserStore = useLoggedInUserStore();
const config = useRuntimeConfig();
const { $swal } = useNuxtApp() as any;

const showBanner = ref(false);
const isResending = ref(false);
const dismissed = ref(false);

const user = computed(() => loggedInUserStore.getLoggedInUser());
const userEmail = computed(() => user.value?.email || '');

const isEmailVerified = computed(() => {
    return !!user.value?.email_verified_at;
});

// Show banner if email is not verified and not dismissed
watch([user, dismissed], () => {
    // Only show if user exists, has an active auth token, email is not verified, and banner hasn't been dismissed
    const hasToken = !!getAuthToken();
    showBanner.value = !!user.value && hasToken && !isEmailVerified.value && !dismissed.value;
}, { immediate: true });

function dismissBanner() {
    dismissed.value = true;
    showBanner.value = false;
}

async function resendVerificationEmail() {
    const token = getAuthToken();
    if (!token) return;
    
    try {
        isResending.value = true;
        
        const response = await $fetch<{ success: boolean; message: string }>(
            `${config.public.apiBase}/auth/resend-verification`,
            {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Authorization-Type': 'auth',
                    'Content-Type': 'application/json'
                }
            }
        );
        
        if (response.success) {
            $swal.fire({
                title: 'Email Sent!',
                text: 'Verification email has been sent. Please check your inbox.',
                icon: 'success',
                confirmButtonColor: '#3C8DBC'
            });
        } else {
            throw new Error(response.message || 'Failed to send verification email');
        }
    } catch (e: any) {
        console.error('Failed to resend verification email:', e);
        $swal.fire({
            title: 'Error',
            text: e.data?.message || e.message || 'Failed to send verification email',
            icon: 'error',
            confirmButtonColor: '#3C8DBC'
        });
    } finally {
        isResending.value = false;
    }
}
</script>
