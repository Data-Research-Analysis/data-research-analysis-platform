/**
 * Redirect Old Routes Middleware (TICKET NAV-003)
 *
 * Intercepts deprecated/orphaned routes and:
 *   - SSR: issues an immediate HTTP 301 redirect (SEO-friendly)
 *   - Client: activates a 2-second deprecation banner via `useDeprecationRedirect`,
 *             then auto-navigates to the new Intelligence Hub location.
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
}

const REDIRECT_MAP: RedirectEntry[] = [
    // /projects/:id/marketing/attribution → Intelligence Hub #attribution
    {
        pattern: /^\/projects\/([^/]+)\/marketing\/attribution\/?$/,
        buildPath: (pid) => `/projects/${pid}/intelligence#attribution`,
    },
    // /projects/:id/marketing/reports → Intelligence Hub #reports
    {
        pattern: /^\/projects\/([^/]+)\/marketing\/reports\/?$/,
        buildPath: (pid) => `/projects/${pid}/intelligence#reports`,
    },
    // /projects/:id/marketing/campaigns → Intelligence Hub #campaigns
    {
        pattern: /^\/projects\/([^/]+)\/marketing\/campaigns\/?$/,
        buildPath: (pid) => `/projects/${pid}/intelligence#campaigns`,
    },
    // /projects/:id/marketing (exact, no sub-path) → Intelligence Hub #overview
    {
        pattern: /^\/projects\/([^/]+)\/marketing\/?$/,
        buildPath: (pid) => `/projects/${pid}/intelligence`,
    },
    // /projects/:id/insights/:insightId → Intelligence Hub #insights
    {
        pattern: /^\/projects\/([^/]+)\/insights\/([^/]+)\/?$/,
        buildPath: (pid, subId) => `/projects/${pid}/intelligence#insights`,
    },
    // /projects/:id/insights (exact) → Intelligence Hub #insights
    {
        pattern: /^\/projects\/([^/]+)\/insights\/?$/,
        buildPath: (pid) => `/projects/${pid}/intelligence#insights`,
    },
];

/**
 * Try to match a path against the redirect map.
 * Returns the new path + project ID if matched, null otherwise.
 */
function findRedirect(path: string): { newPath: string; projectId: string } | null {
    for (const entry of REDIRECT_MAP) {
        const match = path.match(entry.pattern);
        if (match) {
            const projectId = match[1];
            const subId = match[2]; // may be undefined
            return {
                newPath: entry.buildPath(projectId, subId),
                projectId,
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

    // ── Client: show deprecation banner, then auto-redirect after 2 s ──
    const { activate } = useDeprecationRedirect();
    activate(to.path, redirect.newPath, to.query as Record<string, string | (string | null)[] | null | undefined>);

    // Return nothing — allow the current (old) page to render briefly
    // while the DeprecationNotice banner overlays it.
});