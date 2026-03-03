import { DBDriver } from '../drivers/DBDriver.js';
import { EDataSourceType } from '../types/EDataSourceType.js';
import { DRAProject } from '../models/DRAProject.js';
import { DRAProjectMember } from '../models/DRAProjectMember.js';
import { Permission, MarketingRole, MARKETING_ROLE_PERMISSIONS } from '../constants/permissions.js';

/**
 * Role-Based Access Control (RBAC) Service
 * 
 * Singleton service for managing project permissions and member access.
 * Handles permission checking, member management (add/remove), and role assignment.
 *
 * All permission decisions are derived from dra_project_members.marketing_role:
 *   analyst  → full access (create, edit, delete, manage members)
 *   manager  → create/edit + manage members (no delete)
 *   cmo      → read-only
 *
 * Project ownership is detected via dra_projects.users_platform_id — owners
 * always receive analyst-level (full) permissions.
 */
export class RBACService {
    private static instance: RBACService;
    
    private constructor() {}
    
    public static getInstance(): RBACService {
        if (!RBACService.instance) {
            RBACService.instance = new RBACService();
        }
        return RBACService.instance;
    }

    // ─────────────────────────────────────────────────────────────────────────
    // Internal helpers
    // ─────────────────────────────────────────────────────────────────────────

    private async getManager() {
        const driver = await DBDriver.getInstance().getDriver(EDataSourceType.POSTGRESQL);
        if (!driver) throw new Error('Database unavailable');
        return (await driver.getConcreteDriver()).manager;
    }

    /**
     * Returns the effective MarketingRole for a user in a project.
     * Project owner (dra_projects.users_platform_id) is always treated as 'analyst'.
     */
    async getMarketingRole(userId: number, projectId: number): Promise<MarketingRole | null> {
        const manager = await this.getManager();
        const project = await manager.findOne(DRAProject, {
            where: { id: projectId },
            relations: ['users_platform'],
        });
        if (project?.users_platform.id === userId) return 'analyst';
        const member = await manager.findOne(DRAProjectMember, {
            where: { user: { id: userId }, project: { id: projectId } },
        });
        return (member?.marketing_role as MarketingRole) ?? null;
    }

    // ─────────────────────────────────────────────────────────────────────────
    // Permission checks
    // ─────────────────────────────────────────────────────────────────────────

    /**
     * Check if user has permission in project
     * 
     * @param userId - Platform user ID
     * @param projectId - Project ID
     * @param permission - Required permission
     * @returns true if user has permission, false otherwise
     */
    async hasPermission(
        userId: number,
        projectId: number,
        permission: Permission,
    ): Promise<boolean> {
        const role = await this.getMarketingRole(userId, projectId);
        if (!role) return false;
        return MARKETING_ROLE_PERMISSIONS[role].includes(permission);
    }
    
    /**
     * Check multiple permissions (any)
     * 
     * @param userId - Platform user ID
     * @param projectId - Project ID
     * @param permissions - Array of permissions (user needs at least one)
     * @returns true if user has any of the permissions
     */
    async hasAnyPermission(
        userId: number,
        projectId: number,
        permissions: Permission[],
    ): Promise<boolean> {
        const role = await this.getMarketingRole(userId, projectId);
        if (!role) return false;
        const granted = MARKETING_ROLE_PERMISSIONS[role];
        return permissions.some(p => granted.includes(p));
    }
    
    /**
     * Check multiple permissions (all)
     * 
     * @param userId - Platform user ID
     * @param projectId - Project ID
     * @param permissions - Array of permissions (user needs all)
     * @returns true if user has all permissions
     */
    async hasAllPermissions(
        userId: number,
        projectId: number,
        permissions: Permission[],
    ): Promise<boolean> {
        const role = await this.getMarketingRole(userId, projectId);
        if (!role) return false;
        const granted = MARKETING_ROLE_PERMISSIONS[role];
        return permissions.every(p => granted.includes(p));
    }
    
    /**
     * Get all projects user has access to
     * 
     * @param userId - Platform user ID
     * @returns Array of project memberships with role info
     */
    async getUserProjects(userId: number): Promise<DRAProjectMember[]> {
        const manager = await this.getManager();
        return manager.find(DRAProjectMember, {
            where: { user: { id: userId } },
            relations: ['project', 'invited_by'],
            order: { added_at: 'DESC' },
        });
    }
    
    /**
     * Add member to project
     * 
     * Requires PROJECT_MANAGE_MEMBERS permission.
     * Cannot add duplicate members.
     * 
     * @param projectId - Project ID
     * @param userId - User to add
     * @param role - Role to assign
     * @param invitedByUserId - User performing the action
     * @returns Created project member record
     * @throws Error if insufficient permissions or member already exists
     */
    // ─────────────────────────────────────────────────────────────────────────
    // Member queries
    // ─────────────────────────────────────────────────────────────────────────

    /**
     * Returns all members of a project enriched with is_owner flag.
     * is_owner is true when member.user.id === dra_projects.users_platform_id.
     */
    async getProjectMembers(projectId: number): Promise<Array<DRAProjectMember & { is_owner: boolean }>> {
        const manager = await this.getManager();
        const project = await manager.findOne(DRAProject, {
            where: { id: projectId },
            relations: ['users_platform'],
        });
        const members = await manager.find(DRAProjectMember, {
            where: { project: { id: projectId } },
            relations: ['user', 'invited_by'],
            order: { added_at: 'ASC' },
        });
        const ownerId = project?.users_platform.id;
        return members.map(m => Object.assign(m, { is_owner: m.user.id === ownerId }));
    }

    // ─────────────────────────────────────────────────────────────────────────
    // Member mutations
    // ─────────────────────────────────────────────────────────────────────────

    /**
     * Add a member to a project.
     * Requires PROJECT_MANAGE_MEMBERS permission from the requesting user.
     */
    async addMember(
        projectId: number,
        userId: number,
        invitedByUserId: number,
    ): Promise<DRAProjectMember> {
        const manager = await this.getManager();
        const canManage = await this.hasPermission(
            invitedByUserId,
            projectId,
            Permission.PROJECT_MANAGE_MEMBERS,
        );
        if (!canManage) throw new Error('Insufficient permissions to add members');

        const existing = await manager.findOne(DRAProjectMember, {
            where: { project: { id: projectId }, user: { id: userId } },
        });
        if (existing) throw new Error('User is already a member of this project');

        const member = new DRAProjectMember();
        member.project = { id: projectId } as any;
        member.user = { id: userId } as any;
        member.invited_by = { id: invitedByUserId } as any;
        return manager.save(member);
    }
    
    /**
     * Remove member from project
     * 
     * Requires PROJECT_MANAGE_MEMBERS permission.
     * Cannot remove project OWNER.
     * 
     * @param projectId - Project ID
     * @param memberUserId - User to remove
     * @param removedByUserId - User performing the action
     * @returns true if removed successfully
     * @throws Error if insufficient permissions or trying to remove owner
     */
    async removeMember(
        projectId: number,
        memberUserId: number,
        removedByUserId: number,
    ): Promise<boolean> {
        const manager = await this.getManager();
        const canManage = await this.hasPermission(
            removedByUserId,
            projectId,
            Permission.PROJECT_MANAGE_MEMBERS,
        );
        if (!canManage) throw new Error('Insufficient permissions');

        // Cannot remove the project creator
        const project = await manager.findOne(DRAProject, {
            where: { id: projectId },
            relations: ['users_platform'],
        });
        if (project?.users_platform.id === memberUserId) {
            throw new Error('Cannot remove project owner');
        }

        const result = await manager.delete(DRAProjectMember, {
            project: { id: projectId },
            user: { id: memberUserId },
        });
        return result.affected !== 0;
    }
    
}

