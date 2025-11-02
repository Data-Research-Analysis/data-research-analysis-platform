<script setup lang="ts">
import type { NuxtError } from '#app'

const props = defineProps({
  error: Object as () => NuxtError
})

// SEO meta tags for error pages
useHead({
  title: () => props.error?.statusCode === 404 ? '404 - Page Not Found' : 'Error',
  meta: [
    {
      name: 'description',
      content: () => props.error?.statusCode === 404 
        ? 'The page you are looking for could not be found.' 
        : 'An error occurred while processing your request.'
    },
    { name: 'robots', content: 'noindex, nofollow' }
  ]
})

const handleError = () => clearError({ redirect: '/' })

// Check if in development mode (SSR-safe)
const isDev = ref(false)
if (import.meta.client) {
  isDev.value = import.meta.dev ?? false
}

// Get appropriate error message
const errorMessage = computed(() => {
  if (props.error?.statusCode === 404) {
    return {
      title: '404 - Page Not Found',
      description: 'The page you are looking for could not be found or has been moved.',
      suggestion: 'Please check the URL or return to the homepage.'
    }
  } else if (props.error?.statusCode === 500) {
    return {
      title: '500 - Server Error',
      description: 'An internal server error occurred while processing your request.',
      suggestion: 'Please try again later or contact support if the problem persists.'
    }
  } else {
    return {
      title: `${props.error?.statusCode || 'Error'}`,
      description: props.error?.message || 'An unexpected error occurred.',
      suggestion: 'Please try again or return to the homepage.'
    }
  }
})
</script>

<template>
  <NuxtLayout>
    <div class="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 to-indigo-100 px-4">
      <div class="max-w-2xl w-full bg-white rounded-2xl shadow-2xl p-8 md:p-12">
        <!-- Error Icon -->
        <div class="flex justify-center mb-6">
          <div class="w-20 h-20 bg-red-100 rounded-full flex items-center justify-center">
            <svg 
              v-if="error?.statusCode === 404" 
              class="w-12 h-12 text-red-600" 
              fill="none" 
              stroke="currentColor" 
              viewBox="0 0 24 24"
            >
              <path 
                stroke-linecap="round" 
                stroke-linejoin="round" 
                stroke-width="2" 
                d="M9.172 16.172a4 4 0 015.656 0M9 10h.01M15 10h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
              />
            </svg>
            <svg 
              v-else 
              class="w-12 h-12 text-red-600" 
              fill="none" 
              stroke="currentColor" 
              viewBox="0 0 24 24"
            >
              <path 
                stroke-linecap="round" 
                stroke-linejoin="round" 
                stroke-width="2" 
                d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
              />
            </svg>
          </div>
        </div>

        <!-- Error Title -->
        <h1 class="text-4xl font-bold text-gray-900 text-center mb-4">
          {{ errorMessage.title }}
        </h1>

        <!-- Error Description -->
        <p class="text-lg text-gray-600 text-center mb-3">
          {{ errorMessage.description }}
        </p>

        <!-- Error Suggestion -->
        <p class="text-sm text-gray-500 text-center mb-8">
          {{ errorMessage.suggestion }}
        </p>

        <!-- Error Details (Development Only) -->
        <div 
          v-if="error?.stack && isDev" 
          class="mb-8 p-4 bg-gray-50 rounded-lg border border-gray-200"
        >
          <details>
            <summary class="cursor-pointer text-sm font-medium text-gray-700 mb-2">
              Technical Details (Development Mode)
            </summary>
            <pre class="text-xs text-gray-600 overflow-auto whitespace-pre-wrap">{{ error.stack }}</pre>
          </details>
        </div>

        <!-- Action Buttons -->
        <div class="flex flex-col sm:flex-row gap-4 justify-center">
          <button
            @click="handleError"
            class="px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-lg shadow-md transition-colors duration-200"
          >
            <svg class="inline-block w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
            </svg>
            Go to Homepage
          </button>
          
          <button
            @click="$router.back()"
            class="px-6 py-3 bg-gray-200 hover:bg-gray-300 text-gray-800 font-semibold rounded-lg shadow-md transition-colors duration-200"
          >
            <svg class="inline-block w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10 19l-7-7m0 0l7-7m-7 7h18" />
            </svg>
            Go Back
          </button>
        </div>

        <!-- Support Link -->
        <div class="mt-8 text-center">
          <p class="text-sm text-gray-500">
            Need help? 
            <a href="mailto:support@dataresearchanalysis.com" class="text-blue-600 hover:text-blue-700 underline">
              Contact Support
            </a>
          </p>
        </div>
      </div>
    </div>
  </NuxtLayout>
</template>

<style scoped>
/* Additional styles if needed */
</style>
