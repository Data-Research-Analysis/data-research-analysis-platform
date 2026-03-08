import { useProjectsStore } from '~/stores/projects';
import { useLoggedInUserStore } from '~/stores/logged_in_user';

/**
 * Project-level RBAC route guard.
 *
 * Runs after auth (01-authorization) so we can assume the user is logged in.
 *
 * Role hierarchy:
 *   analyst  — full access within the project
 *   manager  — read + publish; no data management or invitations
 *   cmo      — read-only dashboards only
 *
 * Routes under /projects/[projectid] are gated according to the
 * current project's `my_role` value stored in the projects Pinia store.
 */

// Requires manager or analyst (entire section blocked for CMO)
const MANAGER_PLUS_PATTERNS: RegExp[] = [
    /\/campaigns(\/|$)/,
    /\/insights(\/|$)/,
];

// Requires analyst only (blocked for both CMO and manager)
const ANALYST_ONLY_PATTERNS: RegExp[] = [
    /\/data-sources(\/|$)/,
    /\/data-models(\/|$)/,
    /\/invitations/,
    /\/settings\/members/,
];

// Requires owner only (blocked for all non-owners including analysts)
const OWNER_ONLY_PATTERNS: RegExp[] = [
    /\/settings(\/|$)/,
];

function matchesAny(path: string, patterns: RegExp[]): boolean {
    return patterns.some(p => p.test(path));
}

function isProjectScopedPath(path: string): boolean {
    return /\/projects\/\d+/.test(path);
}

export default defineNuxtRouteMiddleware((to) => {
    // Only applies to project-scoped routes
    if (!isProjectScopedPath(to.path)) return;

    // System admins bypass all role checks
    const loggedInUserStore = useLoggedInUserStore();
    const user = loggedInUserStore.getLoggedInUser();
    if (user?.user_type === 'admin') return;

    const projectsStore = useProjectsStore();

    // Hydrate projects from localStorage if store is empty (hard refresh)
    if (import.meta.client && projectsStore.projects.length === 0) {
        const stored = localStorage.getItem('projects');
        if (stored) {
            try { projectsStore.setProjects(JSON.parse(stored)); } catch {}
        }
    }

    // Derive role directly from projects array using the projectid in the URL
    const pidMatch = to.path.match(/\/projects\/(\d+)/);
    const pid = pidMatch ? parseInt(pidMatch[1]) : null;
    const project = pid ? projectsStore.projects.find(p => p.id === pid) : null;

    // Use my_role from the store; default to most restrictive while store hydrates
    const role = ((project?.my_role) ?? 'cmo') as 'analyst' | 'manager' | 'cmo';
    const isOwner = project?.is_owner ?? false;

    // Owner-only routes — all non-owners are blocked
    // Skip check if project data not available yet (let page load and handle it)
    if (matchesAny(to.path, OWNER_ONLY_PATTERNS) && project && !isOwner) {
        const projectId = pidMatch ? pidMatch[1] : null;
        return projectId
            ? navigateTo(`/projects/${projectId}`)
            : navigateTo('/projects');
    }

    // Manager+ routes — CMO is blocked
    if (matchesAny(to.path, MANAGER_PLUS_PATTERNS) && role === 'cmo') {
        const projectId = pidMatch ? pidMatch[1] : null;
        return projectId
            ? navigateTo(`/projects/${projectId}/marketing`)
            : navigateTo('/projects');
    }

    // Analyst-only routes — CMO and manager are blocked
    if (matchesAny(to.path, ANALYST_ONLY_PATTERNS) && role !== 'analyst') {
        const projectId = pidMatch ? pidMatch[1] : null;
        return projectId
            ? navigateTo(`/projects/${projectId}/marketing`)
            : navigateTo('/projects');
    }
});
