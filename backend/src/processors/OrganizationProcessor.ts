import { ITokenDetails } from '../types/ITokenDetails.js';
import { EUserType } from '../types/EUserType.js';
import { OrganizationService, EOrganizationRole } from '../services/OrganizationService.js';
import { WorkspaceService, EWorkspaceRole } from '../services/WorkspaceService.js';
import { DRAOrganization } from '../models/DRAOrganization.js';
import { DRAWorkspace } from '../models/DRAWorkspace.js';
import { DRAOrganizationMember } from '../models/DRAOrganizationMember.js';
import { DRAWorkspaceMember } from '../models/DRAWorkspaceMember.js';

interface ICreateOrganizationParams {
    name: string;
    domain?: string;
    logoUrl?: string;
    subscriptionTierId?: number; // Optional - defaults to FREE tier
    tokenDetails: ITokenDetails;
}

interface IUpdateOrganizationParams {
    organizationId: number;
    name?: string;
    domain?: string;
    logoUrl?: string;
    settings?: Record<string, any>;
}

interface IAddMemberParams {
    organizationId: number;
    email: string; // User email to invite
    role: EOrganizationRole;
    tokenDetails: ITokenDetails;
}

interface IUpdateMemberRoleParams {
    organizationId: number;
    userId: number;
    newRole: EOrganizationRole;
}

interface ICreateWorkspaceParams {
    organizationId: number;
    name: string;
    slug: string;
    description?: string;
    tokenDetails: ITokenDetails;
}

interface IAddWorkspaceMemberParams {
    workspaceId: number;
    userId: number;
    role: EWorkspaceRole;
    tokenDetails: ITokenDetails;
}

/**
 * OrganizationProcessor - Thin orchestration layer for multi-tenant operations
 * 
 * Acts as the controller layer between routes and services.
 * Validates token details, calls service methods, handles errors.
 * 
 * Pattern:
 * Routes → Processor → Services → Database
 * 
 * @singleton
 */
export class OrganizationProcessor {
    private static instance: OrganizationProcessor;
    private organizationService = OrganizationService.getInstance();
    private workspaceService = WorkspaceService.getInstance();

    private constructor() {
        console.log('🏗️  OrganizationProcessor initialized');
    }

    public static getInstance(): OrganizationProcessor {
        if (!OrganizationProcessor.instance) {
            OrganizationProcessor.instance = new OrganizationProcessor();
        }
        return OrganizationProcessor.instance;
    }

    /**
     * Create a new organization with owner membership
     * Automatically creates default workspace and adds owner as admin
     * 
     * @param params - Organization creation parameters
     * @returns Created organization or null on error
     */
    async createOrganization(params: ICreateOrganizationParams): Promise<DRAOrganization | null> {
        try {
            const userId = params.tokenDetails.user_id;

            return await this.organizationService.createOrganization({
                name: params.name,
                domain: params.domain,
                logoUrl: params.logoUrl,
                ownerId: userId,
                subscriptionTierId: params.subscriptionTierId
            });
        } catch (error: any) {
            console.error('[OrganizationProcessor] createOrganization error:', error);
            throw new Error(`Failed to create organization: ${error.message}`);
        }
    }

    /**
     * Get all organizations for the authenticated user
     * 
     * @param tokenDetails - User authentication details
     * @returns Array of organizations the user is a member of
     */
    async getUserOrganizations(tokenDetails: ITokenDetails): Promise<DRAOrganization[]> {
        try {
            const userId = tokenDetails.user_id;
            return await this.organizationService.getUserOrganizations(userId);
        } catch (error: any) {
            console.error('[OrganizationProcessor] getUserOrganizations error:', error);
            return [];
        }
    }

    /**
     * Get organization by ID with full details
     * Validates user is a member before returning (unless user is admin)
     * 
     * @param organizationId - Organization ID
     * @param tokenDetails - User authentication details
     * @returns Organization details or null
     */
    async getOrganizationById(
        organizationId: number,
        tokenDetails: ITokenDetails
    ): Promise<DRAOrganization | null> {
        try {
            const userId = tokenDetails.user_id;
            const isAdmin = tokenDetails.user_type === EUserType.ADMIN;

            // Admin users can access any organization, skip membership check
            if (!isAdmin) {
                // Verify user is a member
                const isMember = await this.organizationService.isUserMember(userId, organizationId);
                if (!isMember) {
                    throw new Error('User is not a member of this organization');
                }
            }

            const organization = await this.organizationService.getOrganizationById(organizationId);
            
            if (!organization) {
                return null;
            }
            
            // Add user_role field for frontend
            const userRole = await this.organizationService.getUserRole(userId, organizationId);
            (organization as any).user_role = userRole;
            
            return organization;
        } catch (error: any) {
            console.error('[OrganizationProcessor] getOrganizationById error:', error);
            return null;
        }
    }

    /**
     * Add a member to an organization
     * NOTE: This is a placeholder - full implementation requires invitation system
     * 
     * @param params - Member addition parameters
     * @returns Created member or null on error
     */
    async addMember(params: IAddMemberParams): Promise<DRAOrganizationMember | null> {
        try {
            // TODO: Implement invitation flow
            // 1. Check if user exists by email
            // 2. If not, create invitation record
            // 3. Send invitation email
            // 4. On acceptance, create organization member
            
            // For now, this is a direct add (assumes user exists)
            throw new Error('Invitation system not yet implemented. Use direct addMemberById for testing.');
        } catch (error: any) {
            console.error('[OrganizationProcessor] addMember error:', error);
            throw error;
        }
    }

    /**
     * Add a member by user ID (used internally or for testing)
     * Bypasses invitation system
     * 
     * @param organizationId - Organization ID
     * @param userId - User ID to add
     * @param role - Role to assign
     * @param invitedByUserId - User ID of inviter
     * @returns Created member
     */
    async addMemberById(
        organizationId: number,
        userId: number,
        role: EOrganizationRole,
        invitedByUserId: number
    ): Promise<DRAOrganizationMember> {
        try {
            return await this.organizationService.addMember({
                organizationId,
                userId,
                role,
                invitedByUserId
            });
        } catch (error: any) {
            console.error('[OrganizationProcessor] addMemberById error:', error);
            throw new Error(`Failed to add member: ${error.message}`);
        }
    }

    /**
     * Get all members of an organization
     * Validates user is a member before returning (unless user is admin)
     * 
     * @param organizationId - Organization ID
     * @param tokenDetails - User authentication details
     * @returns Array of organization members
     */
    async getOrganizationMembers(
        organizationId: number,
        tokenDetails: ITokenDetails
    ): Promise<DRAOrganizationMember[]> {
        try {
            const userId = tokenDetails.user_id;
            const isAdmin = tokenDetails.user_type === EUserType.ADMIN;

            // Admin users can access any organization, skip membership check
            if (!isAdmin) {
                // Verify user is a member
                const isMember = await this.organizationService.isUserMember(userId, organizationId);
                if (!isMember) {
                    throw new Error('User is not a member of this organization');
                }
            }

            return await this.organizationService.getOrganizationMembers(organizationId);
        } catch (error: any) {
            console.error('[OrganizationProcessor] getOrganizationMembers error:', error);
            throw error;
        }
    }

    /**
     * Remove a member from an organization
     * 
     * @param organizationId - Organization ID
     * @param userId - User ID to remove
     * @param tokenDetails - Requester's authentication details
     */
    async removeMember(
        organizationId: number,
        userId: number,
        tokenDetails: ITokenDetails
    ): Promise<void> {
        try {
            // Verify requester has permission (OWNER or ADMIN)
            const requesterRole = await this.organizationService.getUserRole(
                tokenDetails.user_id,
                organizationId
            );

            if (requesterRole !== EOrganizationRole.OWNER && requesterRole !== EOrganizationRole.ADMIN) {
                throw new Error('Only owners and admins can remove members');
            }

            await this.organizationService.removeMember(organizationId, userId);
        } catch (error: any) {
            console.error('[OrganizationProcessor] removeMember error:', error);
            throw new Error(`Failed to remove member: ${error.message}`);
        }
    }

    /**
     * Update a member's role in an organization
     * 
     * @param params - Role update parameters
     * @param tokenDetails - Requester's authentication details
     */
    async updateMemberRole(
        params: IUpdateMemberRoleParams,
        tokenDetails: ITokenDetails
    ): Promise<DRAOrganizationMember> {
        try {
            // Verify requester has permission (OWNER only for role changes)
            const requesterRole = await this.organizationService.getUserRole(
                tokenDetails.user_id,
                params.organizationId
            );

            if (requesterRole !== EOrganizationRole.OWNER) {
                throw new Error('Only owners can change member roles');
            }

            return await this.organizationService.updateMemberRole(
                params.organizationId,
                params.userId,
                params.newRole
            );
        } catch (error: any) {
            console.error('[OrganizationProcessor] updateMemberRole error:', error);
            throw new Error(`Failed to update member role: ${error.message}`);
        }
    }

    /**
     * Get organization usage statistics
     * 
     * @param organizationId - Organization ID
     * @returns Usage statistics (current/max members, limits)
     */
    async getOrganizationUsage(organizationId: number): Promise<any> {
        try {
            return await this.organizationService.getOrganizationUsage(organizationId);
        } catch (error: any) {
            console.error('[OrganizationProcessor] getOrganizationUsage error:', error);
            throw new Error(`Failed to get organization usage: ${error.message}`);
        }
    }

    /**
     * Update organization details
     * 
     * @param params - Organization update parameters
     * @returns Updated organization
     */
    async updateOrganization(params: IUpdateOrganizationParams): Promise<DRAOrganization> {
        try {
            return await this.organizationService.updateOrganization(params);
        } catch (error: any) {
            console.error('[OrganizationProcessor] updateOrganization error:', error);
            throw new Error(`Failed to update organization: ${error.message}`);
        }
    }

    /**
     * Delete an organization
     * Validates confirmation name matches before deletion
     * 
     * @param organizationId - Organization ID
     * @param confirmName - Confirmation name (must match organization name)
     * @param tokenDetails - Requester's authentication details
     */
    async deleteOrganization(
        organizationId: number,
        confirmName: string,
        tokenDetails: ITokenDetails
    ): Promise<void> {
        try {
            // Verify requester is owner
            const requesterRole = await this.organizationService.getUserRole(
                tokenDetails.user_id,
                organizationId
            );

            if (requesterRole !== EOrganizationRole.OWNER) {
                throw new Error('Only organization owners can delete the organization');
            }

            await this.organizationService.deleteOrganization(organizationId, confirmName);
        } catch (error: any) {
            console.error('[OrganizationProcessor] deleteOrganization error:', error);
            throw new Error(`Failed to delete organization: ${error.message}`);
        }
    }

    // ============================================================
    // WORKSPACE OPERATIONS
    // ============================================================

    /**
     * Create a new workspace within an organization
     * 
     * @param params - Workspace creation parameters
     * @returns Created workspace
     */
    async createWorkspace(params: ICreateWorkspaceParams): Promise<DRAWorkspace> {
        try {
            return await this.workspaceService.createWorkspace({
                organizationId: params.organizationId,
                name: params.name,
                slug: params.slug,
                description: params.description,
                createdByUserId: params.tokenDetails.user_id
            });
        } catch (error: any) {
            console.error('[OrganizationProcessor] createWorkspace error:', error);
            throw new Error(`Failed to create workspace: ${error.message}`);
        }
    }

    /**
     * Get all workspaces for an organization
     * 
     * @param organizationId - Organization ID
     * @param tokenDetails - User authentication details
     * @returns Array of workspaces
     */
    async getOrganizationWorkspaces(
        organizationId: number,
        tokenDetails: ITokenDetails
    ): Promise<DRAWorkspace[]> {
        try {
            const isAdmin = tokenDetails.user_type === EUserType.ADMIN;

            // Admin users can access any organization, skip membership check
            if (!isAdmin) {
                // Verify user is organization member
                const isMember = await this.organizationService.isUserMember(
                    tokenDetails.user_id,
                    organizationId
                );

                if (!isMember) {
                    throw new Error('User is not a member of this organization');
                }
            }

            // Pass userId to get user_role property added to each workspace
            return await this.workspaceService.getOrganizationWorkspaces(
                organizationId,
                tokenDetails.user_id
            );
        } catch (error: any) {
            console.error('[OrganizationProcessor] getOrganizationWorkspaces error:', error);
            return [];
        }
    }

    /**
     * Get workspaces accessible to the authenticated user
     * 
     * @param organizationId - Organization ID
     * @param tokenDetails - User authentication details
     * @returns Array of accessible workspaces
     */
    async getUserWorkspaces(
        organizationId: number,
        tokenDetails: ITokenDetails
    ): Promise<DRAWorkspace[]> {
        try {
            return await this.workspaceService.getUserWorkspaces(
                tokenDetails.user_id,
                organizationId
            );
        } catch (error: any) {
            console.error('[OrganizationProcessor] getUserWorkspaces error:', error);
            return [];
        }
    }

    /**
     * Get workspace by ID with details
     * 
     * @param workspaceId - Workspace ID
     * @param tokenDetails - User authentication details
     * @returns Workspace details or null
     */
    async getWorkspaceById(
        workspaceId: number,
        tokenDetails: ITokenDetails
    ): Promise<DRAWorkspace | null> {
        try {
            const workspace = await this.workspaceService.getWorkspaceById(workspaceId);
            if (!workspace) {
                return null;
            }

            // Verify user has access (org member or workspace member)
            const isWorkspaceMember = await this.workspaceService.isUserMember(
                tokenDetails.user_id,
                workspaceId
            );

            if (!isWorkspaceMember) {
                throw new Error('User does not have access to this workspace');
            }

            return workspace;
        } catch (error: any) {
            console.error('[OrganizationProcessor] getWorkspaceById error:', error);
            return null;
        }
    }

    /**
     * Add a member to a workspace
     * 
     * @param params - Workspace member addition parameters
     * @returns Created workspace member
     */
    async addWorkspaceMember(params: IAddWorkspaceMemberParams): Promise<DRAWorkspaceMember> {
        try {
            return await this.workspaceService.addMember({
                workspaceId: params.workspaceId,
                userId: params.userId,
                role: params.role,
                addedByUserId: params.tokenDetails.user_id
            });
        } catch (error: any) {
            console.error('[OrganizationProcessor] addWorkspaceMember error:', error);
            throw new Error(`Failed to add workspace member: ${error.message}`);
        }
    }

    /**
     * Remove a member from a workspace
     * 
     * @param workspaceId - Workspace ID
     * @param userId - User ID to remove
     * @param tokenDetails - Requester's authentication details
     */
    async removeWorkspaceMember(
        workspaceId: number,
        userId: number,
        tokenDetails: ITokenDetails
    ): Promise<void> {
        try {
            // Verify requester is workspace admin
            const requesterRole = await this.workspaceService.getUserRole(
                tokenDetails.user_id,
                workspaceId
            );

            if (requesterRole !== EWorkspaceRole.ADMIN) {
                throw new Error('Only workspace admins can remove members');
            }

            await this.workspaceService.removeMember(workspaceId, userId);
        } catch (error: any) {
            console.error('[OrganizationProcessor] removeWorkspaceMember error:', error);
            throw new Error(`Failed to remove workspace member: ${error.message}`);
        }
    }

    /**
     * Update a workspace member's role
     * 
     * @param workspaceId - Workspace ID
     * @param userId - User ID
     * @param newRole - New role to assign
     * @param tokenDetails - Requester's authentication details
     */
    async updateWorkspaceMemberRole(
        workspaceId: number,
        userId: number,
        newRole: EWorkspaceRole,
        tokenDetails: ITokenDetails
    ): Promise<DRAWorkspaceMember> {
        try {
            // Verify requester is workspace admin
            const requesterRole = await this.workspaceService.getUserRole(
                tokenDetails.user_id,
                workspaceId
            );

            if (requesterRole !== EWorkspaceRole.ADMIN) {
                throw new Error('Only workspace admins can change member roles');
            }

            return await this.workspaceService.updateMemberRole(workspaceId, userId, newRole);
        } catch (error: any) {
            console.error('[OrganizationProcessor] updateWorkspaceMemberRole error:', error);
            throw new Error(`Failed to update workspace member role: ${error.message}`);
        }
    }

    /**
     * Get all projects in a workspace
     * 
     * @param workspaceId - Workspace ID
     * @param tokenDetails - User authentication details
     * @returns Array of projects
     */
    async getWorkspaceProjects(workspaceId: number, tokenDetails: ITokenDetails): Promise<any[]> {
        try {
            // Verify user has access to workspace
            const isWorkspaceMember = await this.workspaceService.isUserMember(
                tokenDetails.user_id,
                workspaceId
            );

            if (!isWorkspaceMember) {
                throw new Error('User does not have access to this workspace');
            }

            return await this.workspaceService.getWorkspaceProjects(workspaceId);
        } catch (error: any) {
            console.error('[OrganizationProcessor] getWorkspaceProjects error:', error);
            return [];
        }
    }

    /**
     * Update workspace details
     * 
     * @param workspaceId - Workspace ID
     * @param updates - Fields to update
     * @param tokenDetails - Requester's authentication details
     * @returns Updated workspace
     */
    async updateWorkspace(
        workspaceId: number,
        updates: { name?: string; slug?: string; description?: string },
        tokenDetails: ITokenDetails
    ): Promise<DRAWorkspace> {
        try {
            // Verify requester is workspace admin
            const requesterRole = await this.workspaceService.getUserRole(
                tokenDetails.user_id,
                workspaceId
            );

            if (requesterRole !== EWorkspaceRole.ADMIN) {
                throw new Error('Only workspace admins can update workspace details');
            }

            return await this.workspaceService.updateWorkspace(workspaceId, updates);
        } catch (error: any) {
            console.error('[OrganizationProcessor] updateWorkspace error:', error);
            throw new Error(`Failed to update workspace: ${error.message}`);
        }
    }

    /**
     * Delete a workspace
     * Validates confirmation name matches before deletion
     * 
     * @param workspaceId - Workspace ID
     * @param confirmName - Confirmation name (must match workspace name)
     * @param tokenDetails - Requester's authentication details
     */
    async deleteWorkspace(
        workspaceId: number,
        confirmName: string,
        tokenDetails: ITokenDetails
    ): Promise<void> {
        try {
            // Verify requester is workspace admin
            const requesterRole = await this.workspaceService.getUserRole(
                tokenDetails.user_id,
                workspaceId
            );

            if (requesterRole !== EWorkspaceRole.ADMIN) {
                throw new Error('Only workspace admins can delete the workspace');
            }

            await this.workspaceService.deleteWorkspace(workspaceId, confirmName);
        } catch (error: any) {
            console.error('[OrganizationProcessor] deleteWorkspace error:', error);
            throw new Error(`Failed to delete workspace: ${error.message}`);
        }
    }

    /**
     * Get all organizations in the system (admin only)
     * 
     * @param tokenDetails - User authentication details
     * @returns Array of all organizations
     */
    async getAllOrganizations(tokenDetails: ITokenDetails): Promise<DRAOrganization[]> {
        try {
            // Validate admin access
            if (tokenDetails.user_type !== 'admin') {
                throw new Error('Admin access required');
            }

            return await this.organizationService.getAllOrganizations();
        } catch (error: any) {
            console.error('[OrganizationProcessor] getAllOrganizations error:', error);
            throw error;
        }
    }
}
