<template>
  <Transition
    enter-active-class="transition-all duration-300 ease"
    enter-from-class="opacity-0 -translate-y-5"
    leave-active-class="transition-all duration-300 ease"
    leave-to-class="opacity-0 -translate-y-2.5"
  >
    <div 
      v-if="error" 
      class="sql-error-alert mb-6"
      role="alert"
      aria-live="assertive"
    >
      <div class="bg-red-50 border-l-4 border-red-500 rounded-lg shadow-lg p-5">
        <div class="flex items-start">
          <!-- Icon -->
          <div class="flex-shrink-0">
            <font-awesome 
              icon="fas fa-exclamation-circle" 
              class="text-red-500 text-2xl"
            />
          </div>
          
          <!-- Content -->
          <div class="ml-4 flex-1">
            <!-- Title -->
            <h3 class="text-lg font-semibold text-red-900 mb-2">
              {{ error.title }}
            </h3>
            
            <!-- User-friendly message -->
            <p class="text-red-800 mb-3 leading-relaxed">
              {{ error.message }}
            </p>
            
            <!-- Suggestions -->
            <div v-if="error.suggestions && error.suggestions.length > 0" class="mb-3">
              <p class="text-sm font-medium text-red-900 mb-2">
                💡 How to fix:
              </p>
              <ul class="list-disc list-inside space-y-1 text-sm text-red-800">
                <li v-for="(suggestion, index) in error.suggestions" :key="index">
                  {{ suggestion }}
                </li>
              </ul>
            </div>
            
            <!-- Technical details (collapsible) -->
            <details class="mt-3">
              <summary class="text-sm font-medium text-red-700 cursor-pointer hover:text-red-900 select-none">
                🔍 Technical Details
              </summary>
              <div class="mt-2 bg-red-100 rounded p-3">
                <code class="text-xs text-red-900 font-mono break-words whitespace-pre-wrap">{{ error.technicalMessage }}</code>
              </div>
            </details>
          </div>
          
          <!-- Close button -->
          <div class="flex-shrink-0 ml-4">
            <button
              @click="$emit('dismiss')"
              class="inline-flex text-red-500 hover:text-red-700 focus:outline-none focus:ring-2 focus:ring-red-500 rounded-lg p-1.5 transition-colors cursor-pointer"
              aria-label="Dismiss error"
            >
              <font-awesome icon="fas fa-times" class="text-xl" />
            </button>
          </div>
        </div>
      </div>
    </div>
  </Transition>
</template>

<script setup>
defineProps({
  error: {
    type: Object,
    default: null
  }
});

defineEmits(['dismiss']);
</script>
