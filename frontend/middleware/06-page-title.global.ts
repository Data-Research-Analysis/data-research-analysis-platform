/**
 * Global page titles.
 *
 * Every route gets a browser-tab title that changes on navigation. Well-known
 * surfaces are mapped explicitly (nice, curated titles); anything else falls
 * back to a humanised title derived from the path so no tab ever shows a raw
 * URL. Pages that call their own `useHead` override this value, which is the
 * intended escape hatch for dynamic names (e.g. a data source's display name).
 *
 * Runs after the redirect/normalisation middleware so it titles the final
 * route, not an intermediate one.
 */

const SITE_SUFFIX = 'Data Research Analysis';

/** Curated titles for the main surfaces. Ordered: most specific first. */
const TITLE_PATTERNS: Array<[RegExp, string]> = [
    // ── Project area ────────────────────────────────────────────────────
    [/^\/projects\/\d+\/channels\/connect\/google-ad-manager\/?$/, 'Connect Google Ad Manager'],
    [/^\/projects\/\d+\/channels\/connect\/google-ads\/?$/, 'Connect Google Ads'],
    [/^\/projects\/\d+\/channels\/connect\/google-analytics\/?$/, 'Connect Google Analytics'],
    [/^\/projects\/\d+\/channels\/connect\/meta-ads\/?$/, 'Connect Meta Ads'],
    [/^\/projects\/\d+\/channels\/connect\/linkedin-ads\/?$/, 'Connect LinkedIn Ads'],
    [/^\/projects\/\d+\/channels\/connect\/hubspot\/?$/, 'Connect HubSpot'],
    [/^\/projects\/\d+\/channels\/connect\/klaviyo\/?$/, 'Connect Klaviyo'],
    [/^\/projects\/\d+\/channels\/connect\/postgresql\/?$/, 'Connect PostgreSQL'],
    [/^\/projects\/\d+\/channels\/connect\/mysql\/?$/, 'Connect MySQL'],
    [/^\/projects\/\d+\/channels\/connect\/mariadb\/?$/, 'Connect MariaDB'],
    [/^\/projects\/\d+\/channels\/connect\/mongodb\/?$/, 'Connect MongoDB'],
    [/^\/projects\/\d+\/channels\/connect\/excel\/?$/, 'Connect Excel'],
    [/^\/projects\/\d+\/channels\/connect\/pdf\/?$/, 'Connect PDF'],
    [/^\/projects\/\d+\/channels\/connect\/wizard\/?$/, 'Smart Connection Wizard'],
    [/^\/projects\/\d+\/channels\/connect\/?$/, 'Connect Data Source'],
    [/^\/projects\/\d+\/channels\/\d+\/data-models\/\d+\/edit\/?$/, 'Edit Data Model'],
    [/^\/projects\/\d+\/channels\/\d+\/data-models\/create\/?$/, 'Create Data Model'],
    [/^\/projects\/\d+\/channels\/\d+\/data-models\/?$/, 'Data Models'],
    [/^\/projects\/\d+\/channels\/\d+\/?$/, 'Data Source Details'],
    [/^\/projects\/\d+\/channels\/?$/, 'Channels/Data Sources'],
    [/^\/projects\/\d+\/data-sources\/?/, 'Data Sources'],
    [/^\/projects\/\d+\/data-models\/\d+\/edit\/?$/, 'Edit Data Model'],
    [/^\/projects\/\d+\/data-models\/\d+\/?$/, 'Data Model'],
    [/^\/projects\/\d+\/data-models\/create\/?$/, 'Create Data Model'],
    [/^\/projects\/\d+\/data-models\/?$/, 'Data Models'],
    [/^\/projects\/\d+\/dashboards\/\d+\/?$/, 'Dashboard'],
    [/^\/projects\/\d+\/dashboards\/create\/?$/, 'Create Dashboard'],
    [/^\/projects\/\d+\/dashboards\/?$/, 'Dashboards'],
    [/^\/projects\/\d+\/reports\/\d+\/edit\/?$/, 'Edit Report'],
    [/^\/projects\/\d+\/reports\/?$/, 'Reports'],
    [/^\/projects\/\d+\/ai-insights\/?$/, 'AI Insights'],
    [/^\/projects\/\d+\/intelligence\/campaigns\/\d+\/?$/, 'Campaign'],
    [/^\/projects\/\d+\/intelligence\/campaigns\/?$/, 'Campaigns'],
    [/^\/projects\/\d+\/intelligence\/?$/, 'Intelligence Hub'],
    [/^\/projects\/\d+\/campaigns\/\d+\/?$/, 'Campaign'],
    [/^\/projects\/\d+\/campaigns\/?$/, 'Campaigns'],
    [/^\/projects\/\d+\/insights\/\d+\/?$/, 'Insight'],
    [/^\/projects\/\d+\/plan\/\d+\/artifact\/\d+\/?$/, 'Plan Artifact'],
    [/^\/projects\/\d+\/plan\/\d+\/?$/, 'Plan Studio'],
    [/^\/projects\/\d+\/plan\/?$/, 'Plan Studio'],
    [/^\/projects\/\d+\/settings\/?/, 'Project Settings'],
    [/^\/projects\/\d+\/?$/, 'Project Overview'],
    [/^\/projects\/?$/, 'Projects'],

    // ── Global surfaces ─────────────────────────────────────────────────
    [/^\/login\/?$/, 'Login'],
    [/^\/register\/?$/, 'Register'],
    [/^\/forgot-password\/?$/, 'Forgot Password'],
    [/^\/pricing\/?$/, 'Pricing'],
    [/^\/features\/?$/, 'Features'],
    [/^\/billing\/?$/, 'Billing'],
    [/^\/notifications\/?$/, 'Notifications'],
    [/^\/admin\/?$/, 'Admin'],
    [/^\/invitations\/?/, 'Invitations'],
    [/^\/organization-invitations\/?/, 'Organization Invitations'],
    [/^\/guest\/plan\/?/, 'Shared Plan'],
    [/^\/unsubscribe\/?/, 'Unsubscribe'],
    [/^\/public-dashboard\/[^/]+\/?$/, 'Public Dashboard'],
    [/^\/public-report\/[^/]+\/?$/, 'Public Report'],
];

/** Title-case a path segment ("google-ad-manager" → "Google Ad Manager"). */
function titleCase(segment: string): string {
    return segment
        .split(/[-_]/)
        .filter(Boolean)
        .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
        .join(' ');
}

/**
 * Fallback title derived from the path: uses the last meaningful segment
 * (skipping ids and param placeholders), with special handling for
 * index/create/edit actions.
 */
function humanizeFromPath(path: string): string | null {
    const segments = path.split('/').filter((s) => s && !/^\d+$/.test(s) && !s.startsWith('['));
    if (segments.length === 0) return null;

    const last = segments[segments.length - 1];
    const prev = segments.length > 1 ? segments[segments.length - 2] : null;

    if (last === 'index') return prev ? titleCase(prev) : null;
    if (last === 'create') return prev ? `Create ${titleCase(prev)}` : 'Create';
    if (last === 'edit') return prev ? `Edit ${titleCase(prev)}` : 'Edit';
    return titleCase(last);
}

export default defineNuxtRouteMiddleware((to) => {
    const curated = TITLE_PATTERNS.find(([pattern]) => pattern.test(to.path))?.[1];
    const title = curated ?? humanizeFromPath(to.path);

    useHead({
        title: title ? `${title} — ${SITE_SUFFIX}` : SITE_SUFFIX,
    });
});
