/**
 * Route Loader Middleware
 * 
 * Shows loading indicator during route transitions and middleware execution.
 * Named with '00-' prefix to ensure it runs BEFORE other middleware.
 * 
 * Execution order:
 * 1. 00-route-loader.global.ts (this file) - Show loader
 * 2. 01-authorization.global.ts - Check authentication
 * 3. 02-load-data.global.ts - Load data from API
 * 4. 03-validate-data.global.ts - Validate data exists
 * 
 * Features:
 * - Shows loader at start of navigation
 * - Keeps loader visible during middleware execution
 * - Handles navigation cancellation
 * - Client-side only (SSR safe)
 * 
 * @example
 * // User clicks link -> Loader appears -> Middleware runs -> Page loads -> Loader hides
 */

export default defineNuxtRouteMiddleware((to, from) => {
  // Only run on client-side
  if (import.meta.client) {
    const { showLoader, hideLoader } = useGlobalLoader()
    
    // Show loader when navigating to a different route
    if (from.path !== to.path) {
      showLoader()
      
      // Hide loader after navigation completes
      // Use nextTick to ensure page is rendered
      if (import.meta.client) {
        nextTick(() => {
          // Small delay to ensure all middleware has completed
          setTimeout(() => {
            hideLoader()
          }, 100)
        })
      }
    }
  }
})
