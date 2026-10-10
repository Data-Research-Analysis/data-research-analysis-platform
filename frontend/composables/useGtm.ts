/**
 * Google Tag Manager composable
 *
 * Safe helpers for pushing GTM events and Consent Mode v2 updates.
 *
 * The GTM loader (injected via app.head in nuxt.config.ts) defines a `gtag()`
 * shim that pushes an Arguments object onto `window.dataLayer`. GTM parses
 * command pushes (`consent`, `event`, `config`) the same way gtag.js does.
 *
 * - `trackEvent(name, params)` → standard GTM dataLayer event object
 *   (`{ event: name, ...params }`). Configure a GTM tag + trigger on that
 *   event name to send it to GA4 or any other destination.
 * - `updateConsent(update)` → Consent Mode v2 `consent/update` command.
 */
export function useGtm() {
    function pushCommand(...args: any[]) {
        if (!import.meta.client) return;
        const dataLayer = (window as any).dataLayer;
        if (Array.isArray(dataLayer)) {
            // Replicate what gtag() does: push an Arguments object, not an array.
            // Spreading individual arguments pushes unrelated items GTM ignores.
            ;(function gtag(...inner: any[]) { (window as any).dataLayer.push(arguments) })
                (...args);
        }
    }

    function trackEvent(name: string, params?: Record<string, unknown>) {
        if (!import.meta.client) return;
        const dataLayer = (window as any).dataLayer;
        if (Array.isArray(dataLayer)) {
            dataLayer.push({ event: name, ...(params || {}) });
        }
    }

    function updateConsent(update: Record<string, string | boolean>) {
        pushCommand('consent', 'update', update);
    }

    return {
        pushCommand,
        trackEvent,
        updateConsent,
    };
}
