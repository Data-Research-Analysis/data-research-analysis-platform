/**
 * Deprecation Redirect Composable
 *
 * Shared reactive state for the orphaned-page redirect system (TICKET NAV-003).
 *
 * Usage:
 *   1. Middleware calls `activate(oldPath, newPath)` when it detects a deprecated route.
 *   2. The `DeprecationNotice` component reads the reactive state and shows a banner.
 *   3. After 2 seconds the composable auto-navigates to the new path.
 *   4. An analytics event is fired on every activation so we can track how many
 *      users still hit old URLs (informing the decision to delete old pages).
 */

import { navigateTo } from '#app';

interface DeprecationState {
    /** Whether a deprecation redirect is currently active */
    isActive: boolean;
    /** The old (deprecated) path the user landed on */
    oldPath: string;
    /** The new destination path (may include hash fragment) */
    newPath: string;
    /** Timestamp when the deprecation was activated */
    timestamp: string;
    /** Original query parameters to preserve during redirect */
    query: Record<string, string | (string | null)[] | null | undefined> | undefined;
}

const state = reactive<DeprecationState>({
    isActive: false,
    oldPath: '',
    newPath: '',
    timestamp: '',
    query: undefined,
});

let redirectTimer: ReturnType<typeof setTimeout> | null = null;

const REDIRECT_DELAY_MS = 2000;

export function useDeprecationRedirect() {
    /**
     * Activate the deprecation notice for a given old → new route pair.
     *
     * - Fires a gtag analytics event immediately.
     * - Starts a 2-second timer that auto-navigates to the new path.
     * - Preserves the original query parameters.
     */
    function activate(
        oldPath: string,
        newPath: string,
        query?: Record<string, string | (string | null)[] | null | undefined>,
    ) {
        // Avoid double-activation if middleware re-runs
        if (state.isActive && state.oldPath === oldPath) return;

        state.isActive = true;
        state.oldPath = oldPath;
        state.newPath = newPath;
        state.timestamp = new Date().toISOString();
        state.query = query;

        // ── Analytics ───────────────────────────────────────────────────
        if (import.meta.client) {
            const gtag = (window as any).gtag;
            if (typeof gtag === 'function') {
                gtag('event', 'redirect_deprecated_route', {
                    old_url: oldPath,
                    new_url: newPath,
                    timestamp: state.timestamp,
                });
            }
        }

        // ── Auto-redirect after delay ───────────────────────────────────
        clearTimer();
        redirectTimer = setTimeout(() => {
            navigateWithQuery(newPath, query);
        }, REDIRECT_DELAY_MS);
    }

    /**
     * Immediately navigate to the new path (e.g. user clicks "Go now").
     * Falls back to the stored query from `activate()` if none is provided.
     */
    function goNow(query?: Record<string, string | (string | null)[] | null | undefined>) {
        clearTimer();
        navigateWithQuery(state.newPath, query ?? state.query);
    }

    /**
     * Dismiss the deprecation banner without redirecting.
     */
    function dismiss() {
        clearTimer();
        resetState();
    }

    // ── Internal helpers ────────────────────────────────────────────────

    function clearTimer() {
        if (redirectTimer !== null) {
            clearTimeout(redirectTimer);
            redirectTimer = null;
        }
    }

    function resetState() {
        state.isActive = false;
        state.oldPath = '';
        state.newPath = '';
        state.timestamp = '';
        state.query = undefined;
    }

    function navigateWithQuery(
        target: string,
        query?: Record<string, string | (string | null)[] | null | undefined>,
    ) {
        resetState();

        // Separate hash from path (navigateTo handles hash via the path string)
        const [pathOnly] = target.split('#');

        // Build final URL — append query params to the path, keep hash in the target
        if (query && Object.keys(query).length > 0) {
            const qs = new URLSearchParams();
            for (const [key, value] of Object.entries(query)) {
                if (value === null || value === undefined) continue;
                if (Array.isArray(value)) {
                    value.forEach((v) => { if (v !== null) qs.append(key, v); });
                } else {
                    qs.append(key, value);
                }
            }
            const queryString = qs.toString();
            if (queryString) {
                // Reconstruct: path + query + hash
                const hash = target.includes('#') ? '#' + target.split('#')[1] : '';
                navigateTo(`${pathOnly}?${queryString}${hash}`);
                return;
            }
        }

        navigateTo(target);
    }

    return {
        /** Reactive deprecation state (read by DeprecationNotice component) */
        state: readonly(state),
        /** Activate the deprecation redirect flow */
        activate,
        /** Navigate immediately without waiting for the timer */
        goNow,
        /** Dismiss the banner and cancel the redirect */
        dismiss,
    };
}