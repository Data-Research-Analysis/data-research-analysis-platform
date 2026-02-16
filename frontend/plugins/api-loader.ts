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
      '/admin/image/upload',  // Image uploads in article editor (silent background operation)
      '/image/upload',        // Public image uploads (if exists)
    ]

    // Third-party domains that should be completely ignored by the interceptor
    // (no loader, no error logging)
    const ignoredDomains = [
      'google-analytics.com',
      'googletagmanager.com',
      'googleapis.com/analytics',
      'google.com/recaptcha',
      'gstatic.com/recaptcha',
    ]
    
    /**
     * Extract URL string from various fetch input types
     */
    const getUrlString = (input: string | URL | Request): string => {
      if (typeof input === 'string') return input
      if (input instanceof URL) return input.href
      if (input instanceof Request) return input.url
      return String(input)
    }

    /**
     * Check if URL belongs to a third-party service that should be fully ignored
     */
    const isThirdPartyUrl = (url: string | URL | Request): boolean => {
      const urlString = getUrlString(url)
      return ignoredDomains.some(domain => urlString.includes(domain))
    }

    /**
     * Check if URL should skip loader
     */
    const shouldSkipLoader = (url: string | URL | Request): boolean => {
      const urlString = getUrlString(url)
      return excludedUrls.some(excluded => urlString.includes(excluded))
    }
    
    // Store reference to original fetch
    const originalFetch = window.fetch
    
    // Override global fetch
    window.fetch = async (...args: Parameters<typeof fetch>): Promise<Response> => {
      const [input] = args
      const urlString = getUrlString(input)

      // Completely bypass interceptor for third-party services (GA, GTM, reCAPTCHA, etc.)
      if (isThirdPartyUrl(input)) {
        return originalFetch(...args)
      }

      const skipLoader = shouldSkipLoader(input)
      
      // Show loader unless URL is excluded
      if (!skipLoader) {
        showLoader()
      }
      
      try {
        // Execute original fetch
        const response = await originalFetch(...args)
        
        // Check for HTTP errors
        if (!response.ok && !skipLoader) {
          console.warn(`API Error: ${response.status} ${response.statusText}`, urlString)
        }
        
        return response
      } catch (error) {
        // Handle network errors
        console.error('Fetch error:', error, urlString)
        
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
