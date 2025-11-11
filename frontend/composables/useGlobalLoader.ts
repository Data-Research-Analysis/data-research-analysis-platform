/**
 * Global Loading State Management Composable
 * 
 * Provides centralized loading state management with SweetAlert2 integration.
 * Uses a counter-based approach to handle concurrent API requests and route transitions.
 * 
 * Features:
 * - Debounced loader display (only shows if loading > 300ms)
 * - Concurrent request tracking
 * - Automatic cleanup on completion
 * - Error handling with force hide
 * 
 * @example
 * const { showLoader, hideLoader } = useGlobalLoader()
 * 
 * showLoader() // Start loading
 * await fetchData()
 * hideLoader() // End loading
 */

export const useGlobalLoader = () => {
  // Use a global state that persists across components
  const loadingCounter = useState<number>('global-loader-counter', () => 0)
  const loaderTimeout = useState<ReturnType<typeof setTimeout> | null>('global-loader-timeout', () => null)
  const isLoaderVisible = useState<boolean>('global-loader-visible', () => false)
  
  // Debounce delay in milliseconds - only show loader if request takes longer
  const LOADER_DELAY = 300
  
  /**
   * Display SweetAlert2 loader
   */
  const displaySwalLoader = () => {
    if (import.meta.client) {
      const { $swal } = useNuxtApp() as any
      
      $swal.fire({
        title: '',
        html: `
          <div class="flex flex-col items-center">
            <div class="animate-spin rounded-full h-16 w-16 border-b-4 border-primary-blue-500"></div>
            <p class="mt-4 text-gray-600 font-medium">Loading...</p>
          </div>
        `,
        showConfirmButton: false,
        allowOutsideClick: false,
        allowEscapeKey: false,
        background: 'rgba(255, 255, 255, 0.95)',
        backdrop: 'rgba(0, 0, 0, 0.4)',
        customClass: {
          popup: 'rounded-lg shadow-xl',
        },
        didOpen: () => {
          // Ensure no buttons appear
          const confirmButton = $swal.getConfirmButton()
          if (confirmButton) {
            confirmButton.style.display = 'none'
          }
        }
      })
    }
  }
  
  /**
   * Dismiss SweetAlert2 loader
   */
  const dismissSwalLoader = () => {
    if (import.meta.client) {
      const { $swal } = useNuxtApp() as any
      
      // Only close if it's the loading dialog
      if ($swal.isVisible()) {
        $swal.close()
      }
    }
  }
  
  /**
   * Show loader - increment counter and display if needed
   */
  const showLoader = () => {
    loadingCounter.value++
    
    // Only show loader if this is the first request and loader not already visible
    if (loadingCounter.value === 1 && !isLoaderVisible.value) {
      // Clear any existing timeout
      if (loaderTimeout.value) {
        clearTimeout(loaderTimeout.value)
      }
      
      // Debounce: only show loader if request takes > LOADER_DELAY ms
      loaderTimeout.value = setTimeout(() => {
        if (loadingCounter.value > 0) {
          displaySwalLoader()
          isLoaderVisible.value = true
        }
      }, LOADER_DELAY)
    }
  }
  
  /**
   * Hide loader - decrement counter and dismiss when zero
   */
  const hideLoader = () => {
    // Prevent counter from going negative
    loadingCounter.value = Math.max(0, loadingCounter.value - 1)
    
    // Hide loader when all requests are complete
    if (loadingCounter.value === 0) {
      // Clear timeout if loader hasn't been shown yet
      if (loaderTimeout.value) {
        clearTimeout(loaderTimeout.value)
        loaderTimeout.value = null
      }
      
      // Dismiss loader if visible
      if (isLoaderVisible.value) {
        dismissSwalLoader()
        isLoaderVisible.value = false
      }
    }
  }
  
  /**
   * Force hide loader - emergency stop for errors
   * Resets all state immediately
   */
  const forceHide = () => {
    // Clear timeout
    if (loaderTimeout.value) {
      clearTimeout(loaderTimeout.value)
      loaderTimeout.value = null
    }
    
    // Reset counter
    loadingCounter.value = 0
    
    // Dismiss loader
    if (isLoaderVisible.value) {
      dismissSwalLoader()
      isLoaderVisible.value = false
    }
  }
  
  /**
   * Get current loading state
   */
  const isLoading = computed(() => loadingCounter.value > 0)
  
  return {
    showLoader,
    hideLoader,
    forceHide,
    isLoading,
    loadingCounter: readonly(loadingCounter),
  }
}
