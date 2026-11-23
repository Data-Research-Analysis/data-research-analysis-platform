/**
 * Redirect Old Routes Middleware (TICKET NAV-003)
 *
 * Intercepts deprecated/orphaned routes and:
 *   - SSR: issues an immediate HTTP 301 redirect (SEO-friendly)
 *   - Client: activates a 2-second deprecation banner via `useDeprecationRedirect`,
 *             then auto-navigates to the new location.
 *   - Permanent entries redirect immediately on the client (no banner) so a
 *     consolidated page never flashes a 404.
 *
 * Named with `00a-` prefix so it runs after `00-route-loader` (loading indicator)
 * but before `01-authorization` (no need to auth-check a redirect).
 *
 * Deprecation schedule: these old pages should be deleted 2 sprints after deployment.
 */

// ─── Redirect Map ──────────────────────────────────────────────────────────
// Each entry: [patternRegex, newPathBuilder]
// The regex captures the project ID as group 1 and optionally a sub-ID as group 2.

interface RedirectEntry {
    /** Regex to test against the route path */
    pattern: RegExp;
    /** Build the new path from the regex match groups */
    buildPath: (projectId: string, subId?: string) => string;
    /** Permanent consolidations redirect immediately on the client */
    permanent?: boolean;
}

const REDIRECT_MAP: RedirectEntry[] = [
    // /projects/:id/insights — now a standalone page, not a redirect
    { pattern: /^\/prove-roi-to-ceo\/?$/i, buildPath: () => '/prove-marketing-roi#ceo-cfo', permanent: true },
    { pattern: /^\/strategic-velocity\/?$/i, buildPath: () => '/connect-marketing-spend-to-revenue#reporting-lag', permanent: true },
    { pattern: /^\/exhaustion-wall\/?$/i, buildPath: () => '/invisible-drain#burnout', permanent: true },
    { pattern: /^\/technical-translation-trap\/?$/i, buildPath: () => '/invisible-drain#no-data-team', permanent: true },
];

/**
 * Try to match a path against the redirect map.
 * Returns the new path + project ID if matched, null otherwise.
 */
function findRedirect(path: string): { newPath: string; projectId: string; permanent?: boolean } | null {
    for (const entry of REDIRECT_MAP) {
        const match = path.match(entry.pattern);
        if (match) {
            const projectId = match[1];
            const subId = match[2]; // may be undefined
            return {
                newPath: entry.buildPath(projectId, subId),
                projectId,
                permanent: entry.permanent,
            };
        }
    }
    return null;
}

// ─── Middleware ─────────────────────────────────────────────────────────────

export default defineNuxtRouteMiddleware((to) => {
    const redirect = findRedirect(to.path);
    if (!redirect) return;

    // ── SSR: immediate 301 redirect for search engines ──────────────────
    if (import.meta.server) {
        return navigateTo(redirect.newPath, { redirectCode: 301 });
    }

    // ── Permanent consolidations: redirect immediately on the client ───
    if (redirect.permanent) {
        return navigateTo(redirect.newPath, { redirectCode: 301, replace: true });
    }

    // ── Client: show deprecation banner, then auto-redirect after 2 s ──
    const { activate } = useDeprecationRedirect();
    activate(to.path, redirect.newPath, to.query as Record<string, string | (string | null)[] | null | undefined>);

    // Return nothing — allow the current (old) page to render briefly
    // while the DeprecationNotice banner overlays it.
});
