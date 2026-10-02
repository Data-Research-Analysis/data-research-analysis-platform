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
 * - US: Auto-accepts with opt-out option (CCPA)
 * - Rest of World: Auto-accepts with implied consent
 * 
 * Flow:
 * 1. The GTM head script (nuxt.config.ts) initializes dataLayer with a gtag() shim
 *    and consent 'default' denied, wait_for_update: 3000ms
 * 2. THIS PLUGIN reads the 24h localStorage region cache synchronously — NO network wait
 * 3. Consent update is pushed to the dataLayer within the 3000ms window (no network delay)
 * 4. First page_view fires with correct consent state
 * 5. In the background, the region cache is refreshed for the next visit if it has expired
 */
export default defineNuxtPlugin(() => {
  if (!import.meta.client) return;

  try {
    // ── Step 1: resolve region from localStorage cache (synchronous, no network) ──
    // The 24h cache is written by useGeolocation.detectRegion() and by this plugin.
    // Default to EU (strictest privacy) when the cache is missing or expired.
    const cachedRegion = localStorage.getItem('consent_region');
    const cacheTime    = localStorage.getItem('consent_region_timestamp');
    const cacheValid   = cachedRegion && cacheTime &&
                         (Date.now() - parseInt(cacheTime)) < 24 * 60 * 60 * 1000;

    const userRegion: string = cacheValid ? cachedRegion! : 'eu_eea_uk';

    // ── Step 2: apply consent immediately, within GA's wait_for_update window ──
    const consent   = localStorage.getItem('cookie_consent');
    const timestamp = localStorage.getItem('cookie_consent_timestamp');

    if (consent && timestamp) {
      const preferences = JSON.parse(consent);
      const daysSince   = (Date.now() - parseInt(timestamp)) / (1000 * 60 * 60 * 24);

      if (daysSince <= 180 && preferences.analytics) {
        // Saved, non-expired analytics consent → grant immediately
        grantConsent();
      }
      // Expired consent: leave denied; banner will re-show
    } else if (userRegion !== 'eu_eea_uk') {
      // Non-EU, no saved consent → auto-accept for GA only.
      // Do NOT persist cookie_consent here; the banner uses that key to decide
      // whether to show the minimal transparency notice / CCPA opt-out UI.
      grantConsent();
    }
    // EU region, no saved consent → stay denied; banner will show

    // ── Step 3: refresh the region cache in the background (non-blocking) ──
    // Only fetch when cache is missing or expired, so the next page load gets
    // the correct region without blocking startup.
    if (!cacheValid) {
      const config = useRuntimeConfig();
      $fetch<{ success: boolean; region: string }>(
        `${config.public.apiBase}/geolocation/consent-region`,
        { credentials: 'include' }
      ).then((res) => {
        if (res?.success && res.region) {
          localStorage.setItem('consent_region', res.region);
          localStorage.setItem('consent_region_timestamp', Date.now().toString());
        }
      }).catch(() => {
        // Silently ignore — next visit will retry; EU default remains in effect
      });
    }

  } catch {
    // Silently fail — consent stays denied (safe default)
  }
});

function grantConsent() {
  // Push to the dataLayer so GTM (or any dataLayer listener) picks up the
  // consent update. The gtag() shim in the head script pushes an Arguments
  // object, which is exactly what GTM/gtag.js parse — this is equivalent to
  // calling gtag('consent', 'update', ...) directly.
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

