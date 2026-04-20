/**
 * GA Consent Restore Plugin
 * 
 * Restores Google Analytics consent state from localStorage EARLY in the app lifecycle,
 * before components mount. This ensures the consent update reaches GA within its
 * `wait_for_update` window (3000ms), so the first page_view event respects the user's
 * previously saved cookie preferences.
 * 
 * Additionally, implements regional consent logic:
 * - EU/EEA/UK: Requires explicit opt-in (GDPR)
 * - California: Auto-accepts with opt-out option (CCPA)
 * - Rest of World: Auto-accepts with implied consent
 * 
 * Flow:
 * 1. nuxt-gtag initializes with analytics_storage: 'denied', wait_for_update: 3000ms
 * 2. THIS PLUGIN detects region and grants consent for non-EU regions or saved preferences
 * 3. GA receives consent update within 3000ms window
 * 4. First page_view fires with correct consent state
 */
export default defineNuxtPlugin(async () => {
  if (import.meta.client) {
    try {
      // Detect user region first
      const config = useRuntimeConfig();
      let userRegion: string = 'eu_eea_uk'; // Default to strictest
      
      try {
        const regionResponse = await $fetch<{ success: boolean; region: string }>(
          `${config.public.apiBase}/geolocation/consent-region`,
          { credentials: 'include' }
        );
        if (regionResponse?.success) {
          userRegion = regionResponse.region;
        }
      } catch {
        // Fallback to EU (strictest privacy) on error
        userRegion = 'eu_eea_uk';
      }

      const consent = localStorage.getItem('cookie_consent');
      const timestamp = localStorage.getItem('cookie_consent_timestamp');

      // Check for saved consent first
      if (consent && timestamp) {
        const preferences = JSON.parse(consent);
        
        // Verify consent hasn't expired (180 days GDPR recommendation)
        const daysSince = (Date.now() - parseInt(timestamp)) / (1000 * 60 * 60 * 24);
        if (daysSince > 180) {
          // Consent expired — leave as denied, banner will re-show
          return;
        }

        // Apply saved consent preferences
        if (preferences.analytics) {
          grantConsent();
        }
      } else if (userRegion !== 'eu_eea_uk') {
        // No saved consent and non-EU region → auto-accept
        grantConsent();
        
        // Save auto-consent to localStorage
        localStorage.setItem('cookie_consent', JSON.stringify({
          essential: true,
          analytics: true,
          region: userRegion,
          ccpaOptOut: false
        }));
        localStorage.setItem('cookie_consent_timestamp', Date.now().toString());
      }
      // Else: EU region, no saved consent → stay denied, banner will show
      
    } catch {
      // Silently fail — consent stays denied (safe default)
    }
  }
});

function grantConsent() {
  // Use gtag function if available, otherwise push directly to dataLayer.
  // IMPORTANT: dataLayer commands must be pushed as an Arguments object (not an
  // array) — this is what gtag() does internally. Calling dataLayer.push() with
  // individual spread arguments pushes 3 separate unrelated items that GA ignores.
  const consentUpdate = {
    analytics_storage: 'granted',
    ad_storage: 'denied',           // Keep denied for privacy
    ad_user_data: 'denied',         // Consent Mode v2
    ad_personalization: 'denied'    // Consent Mode v2
  };
  
  if (typeof (window as any).gtag === 'function') {
    (window as any).gtag('consent', 'update', consentUpdate);
  } else if (Array.isArray((window as any).dataLayer)) {
    // Replicate what gtag() does: push an Arguments object onto dataLayer
    ;(function gtag(...args: any[]) { (window as any).dataLayer.push(arguments) })
      ('consent', 'update', consentUpdate);
  }
}
