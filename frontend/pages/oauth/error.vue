<script setup lang="ts">
const route = useRoute();
const router = useRouter();

const errorMessage = computed(() => {
    const error = route.query.error as string;
    
    switch (error) {
        case 'access_denied':
            return 'You denied access to your Google account. Please try again if you want to connect.';
        case 'callback_failed':
            return 'Authentication callback failed. Please try again.';
        default:
            return `Authentication error: ${error || 'Unknown error'}`;
    }
});

const goHome = () => {
    router.push('/projects');
};
</script>

<template>
    <div class="flex items-center justify-center min-h-screen bg-gray-50">
        <div class="max-w-md w-full bg-white rounded-xl p-8 shadow-sm text-center">
            <div class="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <svg class="w-8 h-8 text-red-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
                </svg>
            </div>
            
            <h1 class="text-2xl font-bold text-gray-900 mb-4">Authentication Failed</h1>
            <p class="text-gray-600 mb-6">{{ errorMessage }}</p>
            
            <button 
                @click="goHome"
                class="px-6 py-3 bg-indigo-600 text-white rounded-lg font-medium hover:bg-indigo-700 transition-colors"
            >
                Return to Projects
            </button>
        </div>
    </div>
</template>
