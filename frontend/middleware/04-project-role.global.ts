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
        console.log('[04-project-role] hydrated projects from localStorage, count:', projectsStore.projects.length);
    }

    // Derive role directly from projects array using the projectid in the URL
    const pidMatch = to.path.match(/\/projects\/(\d+)/);
    const pid = pidMatch ? parseInt(pidMatch[1]) : null;
    const project = pid ? projectsStore.projects.find(p => p.id === pid) : null;

    console.log('[04-project-role] path:', to.path,
        '| pid:', pid,
        '| projects in store:', projectsStore.projects.length,
        '| matched project:', project ? { id: project.id, name: project.name, my_role: project.my_role, is_owner: project.is_owner } : null
    );

    // Use my_role from the store; default to most restrictive while store hydrates
    const role = ((project?.my_role) ?? 'cmo') as 'analyst' | 'manager' | 'cmo';
    console.log('[04-project-role] resolved role:', role);

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
