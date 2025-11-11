/**
 * API Loader Plugin
 * 
 * Automatically intercepts all fetch requests and displays a loading indicator.
 * Uses the global loader composable to manage loading state across the application.
 * 
 * Features:
 * - Intercepts native fetch API
 * - Automatically shows/hides loader
 * - Handles errors gracefully
 * - Supports URL exclusion list for specific endpoints
 * - Preserves original fetch behavior
 * 
 * @example
 * // Automatically works for all fetch calls:
 * await fetch('/api/projects') // Loader shows automatically
 */

export default defineNuxtPlugin(() => {
  // Only run on client-side
  if (import.meta.client) {
    const { showLoader, hideLoader, forceHide } = useGlobalLoader()
    
    // URLs that should not trigger the loader
    const excludedUrls = [
      '/generate-token',      // Fast token generation
      '/validate-token',      // Quick token validation
    ]
    
    /**
     * Check if URL should skip loader
     */
    const shouldSkipLoader = (url: string | URL | Request): boolean => {
      const urlString = typeof url === 'string' ? url : url.toString()
      return excludedUrls.some(excluded => urlString.includes(excluded))
    }
    
    // Store reference to original fetch
    const originalFetch = window.fetch
    
    // Override global fetch
    window.fetch = async (...args: Parameters<typeof fetch>): Promise<Response> => {
      const [url] = args
      const skipLoader = shouldSkipLoader(url)
      
      // Show loader unless URL is excluded
      if (!skipLoader) {
        showLoader()
      }
      
      try {
        // Execute original fetch
        const response = await originalFetch(...args)
        
        // Check for HTTP errors
        if (!response.ok && !skipLoader) {
          console.warn(`API Error: ${response.status} ${response.statusText}`, url)
        }
        
        return response
      } catch (error) {
        // Handle network errors
        console.error('Fetch error:', error, url)
        
        // Force hide loader on error to prevent stuck loader
        if (!skipLoader) {
          forceHide()
        }
        
        throw error
      } finally {
        // Always hide loader when request completes
        if (!skipLoader) {
          hideLoader()
        }
      }
    }
    
    // Handle navigation errors
    const router = useRouter()
    router.onError((error) => {
      console.error('Router error:', error)
      forceHide()
    })
    
    // Cleanup on app unmount
    if (typeof window !== 'undefined') {
      window.addEventListener('beforeunload', () => {
        forceHide()
      })
    }
  }
})
