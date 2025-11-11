/**
 * Route Loader Middleware
 * 
 * Shows loading indicator during route transitions and middleware execution.
 * Named with '00-' prefix to ensure it runs BEFORE other middleware.
 * 
 * Uses batch loading context to ensure a SINGLE loader remains visible
 * for all parallel API calls during navigation.
 * 
 * Execution order:
 * 1. 00-route-loader.global.ts (this file) - Start batch, show loader
 * 2. 01-authorization.global.ts - Check authentication (uses batch context)
 * 3. 02-load-data.global.ts - Load data from API (uses batch context)
 * 4. 03-validate-data.global.ts - Validate data exists
 * 5. router.afterEach - End batch, hide loader
 * 
 * Features:
 * - Batch loading context for grouped API calls
 * - Single loader for all parallel requests
 * - Loader hides only when ALL requests complete
 * - Handles navigation cancellation
 * - Client-side only (SSR safe)
 * 
 * @example
 * // User clicks link -> Batch starts -> ONE loader appears -> 
 * // Multiple parallel APIs run -> ALL complete -> Batch ends -> Loader hides
 */

export default defineNuxtRouteMiddleware((to, from) => {
  // Only run on client-side
  if (import.meta.client) {
    const { startBatch, endBatch } = useGlobalLoader()
    
    // Start batch when navigating to a different route
    if (from.path !== to.path) {
      // Create unique batch ID for this navigation
      const batchId = `route-${Date.now()}-${to.path.replace(/\//g, '-')}`
      
      // Store batch ID in route meta for other middleware to access
      to.meta.loaderBatchId = batchId
      
      // Start batch - shows loader immediately
      startBatch(batchId)
      
      // End batch after navigation completes
      const router = useRouter()
      const cleanup = router.afterEach(() => {
        nextTick(() => {
          // Small delay to ensure all middleware has completed
          setTimeout(() => {
            endBatch(batchId)
            // Remove this specific hook after it fires once
            cleanup()
          }, 100)
        })
      })
    }
  }
})
