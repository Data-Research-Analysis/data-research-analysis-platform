import { DBDriver } from '../drivers/DBDriver.js';
import { EDataSourceType } from '../types/EDataSourceType.js';
import { DRAProjectMember } from '../models/DRAProjectMember.js';
import { EProjectRole } from '../types/EProjectRole.js';
import { Permission, ROLE_PERMISSIONS } from '../constants/permissions.js';

/**
 * Role-Based Access Control (RBAC) Service
 * 
 * Singleton service for managing project permissions and member access.
 * Handles permission checking, member management (add/remove/update), and role assignment.
 * 
 * Key features:
 * - Permission-based authorization (granular control)
 * - Project member management
 * - Role hierarchy enforcement (OWNER > ADMIN > EDITOR > VIEWER)
 * - Database-backed permission checks
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
    
    /**
     * Get user's role in project
     * 
     * @param userId - Platform user ID
     * @param projectId - Project ID
     * @returns User's role or null if not a member
     */
    async getUserRole(userId: number, projectId: number): Promise<EProjectRole | null> {
        const driver = await DBDriver.getInstance().getDriver(EDataSourceType.POSTGRESQL);
        if (!driver) return null;
        
        const manager = (await driver.getConcreteDriver()).manager;
        
        const member = await manager.findOne(DRAProjectMember, {
            where: {
                user: { id: userId },
                project: { id: projectId }
            }
        });
        
        return member?.role || null;
    }
    
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
        permission: Permission
    ): Promise<boolean> {
        const role = await this.getUserRole(userId, projectId);
        
        if (!role) return false;
        
        const permissions = ROLE_PERMISSIONS[role];
        return permissions.includes(permission);
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
        permissions: Permission[]
    ): Promise<boolean> {
        const role = await this.getUserRole(userId, projectId);
        
        if (!role) return false;
        
        const rolePermissions = ROLE_PERMISSIONS[role];
        return permissions.some(p => rolePermissions.includes(p));
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
        permissions: Permission[]
    ): Promise<boolean> {
        const role = await this.getUserRole(userId, projectId);
        
        if (!role) return false;
        
        const rolePermissions = ROLE_PERMISSIONS[role];
        return permissions.every(p => rolePermissions.includes(p));
    }
    
    /**
     * Get all projects user has access to
     * 
     * @param userId - Platform user ID
     * @returns Array of project memberships with role info
     */
    async getUserProjects(userId: number): Promise<DRAProjectMember[]> {
        const driver = await DBDriver.getInstance().getDriver(EDataSourceType.POSTGRESQL);
        if (!driver) return [];
        
        const manager = (await driver.getConcreteDriver()).manager;
        
        return manager.find(DRAProjectMember, {
            where: { user: { id: userId } },
            relations: ['project', 'invited_by'],
            order: { added_at: 'DESC' }
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
    async addMember(
        projectId: number,
        userId: number,
        role: EProjectRole,
        invitedByUserId: number
    ): Promise<DRAProjectMember> {
        const driver = await DBDriver.getInstance().getDriver(EDataSourceType.POSTGRESQL);
        if (!driver) {
            throw new Error('Database unavailable');
        }
        
        const manager = (await driver.getConcreteDriver()).manager;
        
        // Check if inviter has permission
        const canManage = await this.hasPermission(
            invitedByUserId,
            projectId,
            Permission.PROJECT_MANAGE_MEMBERS
        );
        
        if (!canManage) {
            throw new Error('Insufficient permissions to add members');
        }
        
        // Check if member already exists
        const existing = await manager.findOne(DRAProjectMember, {
            where: {
                project: { id: projectId },
                user: { id: userId }
            }
        });
        
        if (existing) {
            throw new Error('User is already a member of this project');
        }
        
        // Create member
        const member = new DRAProjectMember();
        member.project = { id: projectId } as any;
        member.user = { id: userId } as any;
        member.role = role;
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
        removedByUserId: number
    ): Promise<boolean> {
        const driver = await DBDriver.getInstance().getDriver(EDataSourceType.POSTGRESQL);
        if (!driver) return false;
        
        const manager = (await driver.getConcreteDriver()).manager;
        
        // Check permissions
        const canManage = await this.hasPermission(
            removedByUserId,
            projectId,
            Permission.PROJECT_MANAGE_MEMBERS
        );
        
        if (!canManage) {
            throw new Error('Insufficient permissions');
        }
        
        // Cannot remove project owner
        const memberRole = await this.getUserRole(memberUserId, projectId);
        if (memberRole === EProjectRole.OWNER) {
            throw new Error('Cannot remove project owner');
        }
        
        const result = await manager.delete(DRAProjectMember, {
            project: { id: projectId },
            user: { id: memberUserId }
        });
        
        return result.affected !== 0;
    }
    
    /**
     * Update member role
     * 
     * Requires PROJECT_MANAGE_MEMBERS permission.
     * Cannot change OWNER role.
     * 
     * @param projectId - Project ID
     * @param memberUserId - User to update
     * @param newRole - New role to assign
     * @param updatedByUserId - User performing the action
     * @returns true if updated successfully
     * @throws Error if insufficient permissions or trying to change owner
     */
    async updateMemberRole(
        projectId: number,
        memberUserId: number,
        newRole: EProjectRole,
        updatedByUserId: number
    ): Promise<boolean> {
        const driver = await DBDriver.getInstance().getDriver(EDataSourceType.POSTGRESQL);
        if (!driver) return false;
        
        const manager = (await driver.getConcreteDriver()).manager;
        
        // Check permissions
        const canManage = await this.hasPermission(
            updatedByUserId,
            projectId,
            Permission.PROJECT_MANAGE_MEMBERS
        );
        
        if (!canManage) {
            throw new Error('Insufficient permissions');
        }
        
        // Cannot change owner role
        const currentRole = await this.getUserRole(memberUserId, projectId);
        if (currentRole === EProjectRole.OWNER) {
            throw new Error('Cannot change owner role');
        }
        
        const result = await manager.update(DRAProjectMember, {
            project: { id: projectId },
            user: { id: memberUserId }
        }, {
            role: newRole
        });
        
        return result.affected !== 0;
    }
    
    /**
     * Get all members of a project
     * 
     * @param projectId - Project ID
     * @returns Array of project members with user and inviter details
     */
    async getProjectMembers(projectId: number): Promise<DRAProjectMember[]> {
        const driver = await DBDriver.getInstance().getDriver(EDataSourceType.POSTGRESQL);
        if (!driver) return [];
        
        const manager = (await driver.getConcreteDriver()).manager;
        
        return manager.find(DRAProjectMember, {
            where: { project: { id: projectId } },
            relations: ['user', 'invited_by'],
            order: { added_at: 'ASC' }
        });
    }
}
