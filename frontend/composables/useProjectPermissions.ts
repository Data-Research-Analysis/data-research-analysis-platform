import { computed, type ComputedRef } from 'vue';
import { useProjectsStore } from '~/stores/projects';

export type ProjectRole = 'owner' | 'admin' | 'editor' | 'viewer';

export interface ProjectPermissions {
    canCreate: ComputedRef<boolean>;
    canRead: ComputedRef<boolean>;
    canUpdate: ComputedRef<boolean>;
    canDelete: ComputedRef<boolean>;
    canManageTeam: ComputedRef<boolean>;
    canShare: ComputedRef<boolean>;
    role: ComputedRef<ProjectRole | null>;
    isOwner: ComputedRef<boolean>;
    isAdmin: ComputedRef<boolean>;
    isEditor: ComputedRef<boolean>;
    isViewer: ComputedRef<boolean>;
}

/**
 * Composable for checking user permissions in a project
 * @param projectId - Project ID to check permissions for
 * @returns Object with permission flags
 */
export function useProjectPermissions(projectId: number | string): ProjectPermissions {
    const projectsStore = useProjectsStore();

    const project = computed(() => {
        const id = typeof projectId === 'string' ? parseInt(projectId) : projectId;
        return projectsStore.projects.find((p) => p.id === id);
    });

    const role = computed<ProjectRole | null>(() => {
        if (!project.value) return null;
        return (project.value.user_role as ProjectRole) || null;
    });

    const isOwner = computed(() => {
        if (!project.value) return false;
        return project.value.is_owner === true;
    });

    const isAdmin = computed(() => {
        return role.value === 'admin';
    });

    const isEditor = computed(() => {
        return role.value === 'editor';
    });

    const isViewer = computed(() => {
        return role.value === 'viewer';
    });

    // Permission matrix based on role
    const canCreate = computed(() => {
        if (!role.value) return false;
        return ['owner', 'admin', 'editor'].includes(role.value);
    });

    const canRead = computed(() => {
        // All roles can read
        return role.value !== null;
    });

    const canUpdate = computed(() => {
        if (!role.value) return false;
        return ['owner', 'admin', 'editor'].includes(role.value);
    });

    const canDelete = computed(() => {
        // Only owners can delete
        return isOwner.value === true;
    });

    const canManageTeam = computed(() => {
        // Only owners and admins can manage team
        if (!role.value) return false;
        return isOwner.value || role.value === 'admin';
    });

    const canShare = computed(() => {
        // Only owners and admins can share
        if (!role.value) return false;
        return isOwner.value || role.value === 'admin';
    });

    return {
        canCreate: canCreate,
        canRead: canRead,
        canUpdate: canUpdate,
        canDelete: canDelete,
        canManageTeam: canManageTeam,
        canShare: canShare,
        role: role,
        isOwner: isOwner,
        isAdmin: isAdmin,
        isEditor: isEditor,
        isViewer: isViewer,
    };
}
