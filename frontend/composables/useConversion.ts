/**
 * Conversion tracking composable
 *
 * Emits the two paid-conversion dataLayer events: `demo_request` and `free_signup`.
 * GTM custom-event triggers pick these up and forward them to GA4.
 *
 * Rules (see Part 16 of the tracking plan):
 * - Fire ONLY after the server confirms success (2xx) — never on click or submit.
 * - No PII in the payload: only `form_name` and `form_location`.
 * - Idempotent per browser session, so retries, double-clicks and refreshes
 *   cannot double-count a conversion.
 *
 * The push goes through the existing `useGtm().trackEvent()` helper, which pushes
 * a standard `{ event, ...params }` object onto `window.dataLayer` client-side.
 */

export type ConversionEvent = 'demo_request' | 'free_signup';

export function useConversion() {
    function pushConversion(
        event: ConversionEvent,
        formName: string,
        formLocation: string,
    ) {
        if (!import.meta.client) return;

        // Idempotency guard: one conversion per event per browser session.
        const key = `dra_conversion_${event}`;
        try {
            if (sessionStorage.getItem(key)) return;
            sessionStorage.setItem(key, '1');
        } catch {
            // sessionStorage unavailable (e.g. private mode) — fall through and
            // emit once; the in-page submit flow already guards double submits.
        }

        useGtm().trackEvent(event, {
            form_name: formName,
            form_location: formLocation,
        });
    }

    return { pushConversion };
}
