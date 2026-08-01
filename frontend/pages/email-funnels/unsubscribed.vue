<script setup lang="ts">
definePageMeta({ layout: 'default' });
const route = useRoute();
const success = route.query.success === 'true';
</script>

<template>
    <div class="min-h-screen flex items-center justify-center bg-gray-50 px-4">
        <div class="max-w-md w-full bg-white shadow rounded-lg p-8 text-center">
            <div v-if="success" class="space-y-4">
                <div class="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto">
                    <font-awesome-icon :icon="['fas', 'check']" class="text-3xl text-green-600" />
                </div>
                <h1 class="text-2xl font-bold text-gray-900">Unsubscribed</h1>
                <p class="text-gray-500">You have been successfully unsubscribed from this email series. You will no longer receive these emails.</p>
            </div>
            <div v-else class="space-y-4">
                <div class="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto">
                    <font-awesome-icon :icon="['fas', 'xmark']" class="text-3xl text-red-600" />
                </div>
                <h1 class="text-2xl font-bold text-gray-900">Invalid Link</h1>
                <p class="text-gray-500">This unsubscribe link is invalid or expired. If you continue receiving emails, please contact support.</p>
            </div>
            <NuxtLink to="/" class="mt-6 inline-block px-6 py-2 bg-primary-blue-100 text-white rounded-lg hover:bg-primary-blue-80 transition-colors text-sm font-medium">
                Go to Home
            </NuxtLink>
        </div>
    </div>
</template>