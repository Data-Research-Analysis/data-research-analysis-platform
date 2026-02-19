/**
 * GA Consent Restore Plugin
 * 
 * Restores Google Analytics consent state from localStorage EARLY in the app lifecycle,
 * before components mount. This ensures the consent update reaches GA within its
 * `wait_for_update` window (500ms), so the first page_view event respects the user's
 * previously saved cookie preferences.
 * 
 * Without this, the cookie-disclaimer-banner component only updates consent in onMounted()
 * (~2000ms+ after page load), which is too late — GA has already sent the first hit
 * with consent denied.
 * 
 * Flow:
 * 1. nuxt-gtag initializes with analytics_storage: 'denied', wait_for_update: 500ms
 * 2. THIS PLUGIN runs immediately and grants consent if user previously accepted
 * 3. GA receives consent update within 500ms window
 * 4. First page_view fires with correct consent state
 */
export default defineNuxtPlugin(() => {
  if (import.meta.client) {
    try {
      const consent = localStorage.getItem('cookie_consent')
      if (consent) {
        const preferences = JSON.parse(consent)
        const timestamp = localStorage.getItem('cookie_consent_timestamp')

        // Verify consent hasn't expired (180 days GDPR recommendation)
        if (timestamp) {
          const daysSince = (Date.now() - parseInt(timestamp)) / (1000 * 60 * 60 * 24)
          if (daysSince > 180) {
            // Consent expired — leave as denied, banner will re-show
            return
          }
        }

        if (preferences.analytics) {
          // Use gtag function if available, otherwise push directly to dataLayer.
          // IMPORTANT: dataLayer commands must be pushed as an Arguments object (not an
          // array) — this is what gtag() does internally. Calling dataLayer.push() with
          // individual spread arguments pushes 3 separate unrelated items that GA ignores.
          if (typeof (window as any).gtag === 'function') {
            (window as any).gtag('consent', 'update', {
              analytics_storage: 'granted'
            })
          } else if (Array.isArray((window as any).dataLayer)) {
            // Replicate what gtag() does: push an Arguments object onto dataLayer
            ;(function gtag(...args: any[]) { (window as any).dataLayer.push(arguments) })
              ('consent', 'update', { analytics_storage: 'granted' })
          }
        }
      }
    } catch {
      // Silently fail — consent stays denied (safe default)
    }
  }
})
