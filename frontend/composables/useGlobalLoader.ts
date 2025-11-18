/**
 * Global Loading State Management Composable
 * 
 * Provides centralized loading state management with SweetAlert2 integration.
 * Uses a batch-aware system to handle concurrent API requests and route transitions.
 * 
 * Features:
 * - Batch loading context for grouped API calls (navigation)
 * - Debounced loader display (only shows if loading > 300ms)
 * - Concurrent request tracking per batch
 * - Single loader for all parallel requests in a batch
 * - Automatic cleanup on completion
 * - Error handling with force hide
 * 
 * @example
 * // Batch mode (navigation):
 * const { startBatch, endBatch } = useGlobalLoader()
 * startBatch('route-123')
 * // ... multiple parallel API calls ...
 * endBatch('route-123') // Loader hides only when batch completes
 * 
 * // Individual mode (manual API calls):
 * const { showLoader, hideLoader } = useGlobalLoader()
 * showLoader()
 * await fetchData()
 * hideLoader()
 */

export const useGlobalLoader = () => {
  // Global state that persists across components
  const loadingCounter = useState<number>('global-loader-counter', () => 0)
  const loaderTimeout = useState<ReturnType<typeof setTimeout> | null>('global-loader-timeout', () => null)
  const isLoaderVisible = useState<boolean>('global-loader-visible', () => false)
  
  // Batch loading state
  const activeBatches = useState<Map<string, { counter: number, started: boolean }>>('global-loader-batches', () => new Map())
  const currentBatchId = useState<string | null>('global-loader-current-batch', () => null)
  
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
   * Show loader - increment counter (batch-aware)
   */
  const showLoader = () => {
    if (currentBatchId.value) {
      // Batch mode: increment batch counter
      const batch = activeBatches.value.get(currentBatchId.value)
      if (batch) {
        batch.counter++
      }
    } else {
      // Individual mode: use global counter
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
  }
  
  /**
   * Hide loader - decrement counter (batch-aware)
   */
  const hideLoader = () => {
    if (currentBatchId.value) {
      // Batch mode: decrement batch counter only
      const batch = activeBatches.value.get(currentBatchId.value)
      if (batch) {
        batch.counter = Math.max(0, batch.counter - 1)
      }
    } else {
      // Individual mode: use global counter
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
   * Start a new batch context
   * All API calls after this will be tracked as part of the batch
   */
  const startBatch = (batchId: string) => {
    // Create new batch
    activeBatches.value.set(batchId, { counter: 0, started: false })
    currentBatchId.value = batchId
    
    // Show loader immediately for batch (no debounce for navigation)
    if (!isLoaderVisible.value) {
      displaySwalLoader()
      isLoaderVisible.value = true
    }
    
    // Mark batch as started
    const batch = activeBatches.value.get(batchId)
    if (batch) {
      batch.started = true
    }
  }
  
  /**
   * End a batch context
   * Hides loader when batch is complete
   */
  const endBatch = (batchId: string) => {
    const batch = activeBatches.value.get(batchId)
    
    if (batch) {
      // Remove batch from active batches
      activeBatches.value.delete(batchId)
      
      // Clear current batch if it's this one
      if (currentBatchId.value === batchId) {
        currentBatchId.value = null
      }
      
      // Hide loader if no more active batches and no individual requests
      if (activeBatches.value.size === 0 && loadingCounter.value === 0) {
        if (isLoaderVisible.value) {
          dismissSwalLoader()
          isLoaderVisible.value = false
        }
      }
    }
  }
  
  /**
   * Set current batch context for subsequent API calls
   */
  const setBatchContext = (batchId: string | null) => {
    currentBatchId.value = batchId
  }
  
  /**
   * Get current batch ID
   */
  const getCurrentBatch = () => {
    return currentBatchId.value
  }
  
  /**
   * Clear batch context
   */
  const clearBatchContext = () => {
    currentBatchId.value = null
  }
  
  /**
   * Get current loading state
   */
  const isLoading = computed(() => loadingCounter.value > 0 || activeBatches.value.size > 0)
  
  return {
    showLoader,
    hideLoader,
    forceHide,
    isLoading,
    loadingCounter: readonly(loadingCounter),
    // Batch methods
    startBatch,
    endBatch,
    setBatchContext,
    getCurrentBatch,
    clearBatchContext,
  }
}
