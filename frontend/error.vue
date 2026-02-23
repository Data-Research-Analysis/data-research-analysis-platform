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
            <font-awesome-icon v-if="error?.statusCode === 404" :icon="['fas', 'face-frown']" class="w-12 h-12 text-red-600" />
            <font-awesome-icon v-else :icon="['fas', 'triangle-exclamation']" class="w-12 h-12 text-red-600" />
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
            class="px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-lg shadow-md transition-colors duration-200 cursor-pointer"
          >
            <font-awesome-icon :icon="['fas', 'house']" class="inline-block w-5 h-5 mr-2" />
            Go to Homepage
          </button>
          
          <button
            @click="$router.back()"
            class="px-6 py-3 bg-gray-200 hover:bg-gray-300 text-gray-800 font-semibold rounded-lg shadow-md transition-colors duration-200 cursor-pointer"
          >
            <font-awesome-icon :icon="['fas', 'arrow-left']" class="inline-block w-5 h-5 mr-2" />
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
