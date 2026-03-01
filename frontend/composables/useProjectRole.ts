import { computed } from 'vue';
import { useProjectsStore } from '~/stores/projects';
import { useLoggedInUserStore } from '~/stores/logged_in_user';

export type MarketingRole = 'analyst' | 'manager' | 'cmo';

/**
 * Composable that exposes the current user's role within the selected project.
 *
 * Role hierarchy (most privileged → least):
 *   analyst  — full read/write + invite team members
 *   manager  — read + publish to dashboard; cannot invite or manage data
 *   cmo      — read-only; can view dashboards only
 *
 * Role is derived at render time from projectsStore.projects using the current
 * route's `projectid` param — no explicit `setSelectedProject` call needed.
 * System admins always get analyst-level access.
 */
export const useProjectRole = () => {
    const projectsStore = useProjectsStore();
    const loggedInUserStore = useLoggedInUserStore();
    const route = useRoute();

    const isSystemAdmin = computed(() => {
        const user = loggedInUserStore.getLoggedInUser();
        return user?.user_type === 'admin';
    });

    /** The effective marketing role for the current user in the selected project. */
    const projectRole = computed<MarketingRole>(() => {
        if (isSystemAdmin.value) {
            console.log('[useProjectRole] system admin → forcing analyst');
            return 'analyst';
        }
        const pid = parseInt(String(route.params.projectid));
        if (!pid) {
            console.log('[useProjectRole] no projectid param → cmo');
            return 'cmo';
        }
        const project = projectsStore.projects.find(p => p.id === pid);
        console.log('[useProjectRole] pid:', pid,
            '| projects in store:', projectsStore.projects.length,
            '| matched project:', project ? { id: project.id, name: project.name, my_role: project.my_role, is_owner: project.is_owner } : null
        );
        if (!project) return 'cmo'; // project not yet loaded

        const resolved = (project.my_role as MarketingRole) ?? 'cmo';
        console.log('[useProjectRole] resolved role:', resolved);
        return resolved;
    });

    /** Analyst: can manage data sources, data models, campaigns, invite members */
    const isAnalyst = computed(() => projectRole.value === 'analyst');

    /**
     * Manager: can publish AI Insights to dashboards, edit dashboard widgets.
     * Analysts are also considered managers (hierarchy is cumulative).
     */
    const isManager = computed(() => projectRole.value === 'analyst' || projectRole.value === 'manager');

    /** CMO: read-only; can view dashboards but not edit anything */
    const isCmo = computed(() => projectRole.value === 'cmo');

    /** Shorthand: can create/edit/delete data and configuration */
    const canWrite = computed(() => isAnalyst.value);

    /** Shorthand: can publish insights and edit dashboard layout */
    const canPublish = computed(() => isManager.value);

    /** Everyone can read — here for completeness (always true) */
    const canRead = computed(() => true);

    /**
     * Returns true if the user has at least the given role.
     * Usage: hasRole('manager') → true for both analyst and manager.
     */
    function hasRole(role: MarketingRole): boolean {
        if (role === 'cmo') return true;
        if (role === 'manager') return isManager.value;
        if (role === 'analyst') return isAnalyst.value;
        return false;
    }

    /**
     * Readable label for display in the UI.
     */
    const roleLabel = computed(() => {
        switch (projectRole.value) {
            case 'analyst': return 'Analyst';
            case 'manager': return 'Manager';
            case 'cmo': return 'CMO';
            default: return 'Unknown';
        }
    });

    return {
        projectRole,
        isAnalyst,
        isManager,
        isCmo,
        canWrite,
        canPublish,
        canRead,
        isSystemAdmin,
        hasRole,
        roleLabel,
    };
};
