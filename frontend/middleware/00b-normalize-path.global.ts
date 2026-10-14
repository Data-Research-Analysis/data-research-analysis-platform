/**
 * Canonical path normalization.
 *
 * Vue Router matches routes case-insensitively and ignores trailing slashes, so
 * variants like `/PRIVACY-POLICY` or `/privacy-policy/` match a real route but
 * their raw path then fails the public-route allow-list in the authorization
 * middleware and gets redirected to /login (a soft-404). Redirect these
 * non-canonical forms to the canonical path with a 301.
 *
 * Trailing-slash stripping is applied to every route (it never changes a
 * dynamic segment). Case-folding is limited to known static routes because
 * dynamic segments (article slugs, verification codes, invitation tokens) are
 * case-sensitive.
 *
 * Named `00b-` so it runs after the route loader and old-route redirects but
 * before `01-authorization`.
 */
const STATIC_ROUTES = new Set([
    '/login',
    '/register',
    '/privacy-policy',
    '/terms-conditions',
    '/return-refund-policy',
    '/cancellation-policy',
    '/enterprise-contact',
    '/pricing',
    '/join-private-beta',
    '/prove-marketing-roi',
    '/strategic-velocity',
    '/prove-roi-to-ceo',
    '/connect-marketing-spend-to-revenue',
    '/invisible-drain',
    '/technical-translation-trap',
    '/exhaustion-wall',
    '/articles',
]);

export default defineNuxtRouteMiddleware((to) => {
    const original = to.path;
    if (!original || original === '/') return;

    let normalized = original;

    // Strip trailing slashes (safe for all routes).
    if (normalized.length > 1 && normalized.endsWith('/')) {
        normalized = normalized.replace(/\/+$/, '') || '/';
    }

    // Lowercase only known static routes.
    const lower = normalized.toLowerCase();
    if (STATIC_ROUTES.has(lower)) {
        normalized = lower;
    }

    if (normalized !== original) {
        return navigateTo(
            { path: normalized, query: to.query, hash: to.hash },
            { redirectCode: 301 }
        );
    }
});
