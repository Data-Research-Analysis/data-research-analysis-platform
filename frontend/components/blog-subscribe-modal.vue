<script setup lang="ts">
const emit = defineEmits<{ close: [] }>();

const config = useRuntimeConfig();
const { $swal } = useNuxtApp();

const email = ref('');
const name = ref('');
const submitting = ref(false);
const submitted = ref(false);
const error = ref<string | null>(null);

const close = () => emit('close');

const submit = async () => {
    if (!email.value) {
        error.value = 'Email address is required.';
        return;
    }
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email.value)) {
        error.value = 'Please enter a valid email address.';
        return;
    }

    error.value = null;
    submitting.value = true;

    try {
        await $fetch(`${config.public.apiBase}/email-funnels/blog-subscribe`, {
            method: 'POST',
            body: { email: email.value, name: name.value || undefined },
        });
        submitted.value = true;
    } catch (err: any) {
        console.error('[blog-subscribe] error:', err);
        error.value = err?.data?.error || 'Something went wrong. Please try again.';
    } finally {
        submitting.value = false;
    }
};
</script>

<template>
    <overlay-dialog @close="close">
        <template #overlay>
            <div class="text-center">
                <div class="w-14 h-14 bg-primary-blue-100/10 rounded-full flex items-center justify-center mx-auto mb-4">
                    <font-awesome-icon :icon="['fas', 'newspaper']" class="text-primary-blue-100 text-2xl" />
                </div>
                <h3 class="text-xl font-bold text-gray-900 mb-2">Stay Updated</h3>
                <p class="text-sm text-gray-500 mb-6">Get the latest insights on data analysis, AI, and platform updates delivered to your inbox.</p>

                <!-- Success -->
                <div v-if="submitted" class="bg-green-50 border border-green-200 rounded-xl p-6">
                    <div class="w-12 h-12 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-3">
                        <font-awesome-icon :icon="['fas', 'check']" class="text-green-600 text-xl" />
                    </div>
                    <h4 class="text-base font-bold text-green-900 mb-1">You're subscribed!</h4>
                    <p class="text-sm text-green-700">Check your inbox for your first email.</p>
                    <button @click="close" class="mt-4 px-4 py-2 bg-green-600 text-white rounded-lg text-sm font-medium hover:bg-green-700 transition-colors cursor-pointer">Close</button>
                </div>

                <!-- Form -->
                <form v-else @submit.prevent="submit" novalidate class="space-y-3">
                    <div>
                        <input v-model="name" type="text" placeholder="Your name (optional)" class="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-blue-100 text-sm" />
                    </div>
                    <div>
                        <input v-model="email" type="email" placeholder="Your email address *" class="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-blue-100 text-sm" required />
                    </div>
                    <div v-if="error" class="bg-red-50 border border-red-200 rounded-lg px-4 py-2.5 text-sm text-red-700">
                        <font-awesome-icon :icon="['fas', 'triangle-exclamation']" class="mr-1" />
                        {{ error }}
                    </div>
                    <button type="submit" :disabled="submitting" class="w-full py-2.5 bg-primary-blue-100 text-white rounded-xl font-semibold text-sm hover:bg-primary-blue-80 disabled:opacity-50 disabled:cursor-not-allowed transition-colors cursor-pointer">
                        <font-awesome-icon v-if="submitting" :icon="['fas', 'spinner']" class="animate-spin mr-2" />
                        {{ submitting ? 'Subscribing...' : 'Subscribe' }}
                    </button>
                    <p class="text-xs text-gray-400">No spam. Unsubscribe anytime.</p>
                </form>
            </div>
        </template>
    </overlay-dialog>
</template>
