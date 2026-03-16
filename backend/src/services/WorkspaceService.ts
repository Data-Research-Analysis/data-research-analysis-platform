import { EntityManager } from 'typeorm';
import { DBDriver } from '../drivers/DBDriver.js';
import { EDataSourceType } from '../types/EDataSourceType.js';
import { DRAWorkspace } from '../models/DRAWorkspace.js';
import { DRAWorkspaceMember } from '../models/DRAWorkspaceMember.js';
import { DRAOrganization } from '../models/DRAOrganization.js';
import { DRAOrganizationMember } from '../models/DRAOrganizationMember.js';
import { DRAUsersPlatform } from '../models/DRAUsersPlatform.js';
import { DRAProject } from '../models/DRAProject.js';

export enum EWorkspaceRole {
    ADMIN = 'admin',
    EDITOR = 'editor',
    VIEWER = 'viewer'
}

interface ICreateWorkspaceParams {
    organizationId: number;
    name: string;
    slug: string;
    description?: string;
    createdByUserId: number;
}

interface IAddWorkspaceMemberParams {
    workspaceId: number;
    userId: number;
    role: EWorkspaceRole;
    addedByUserId: number;
}

/**
 * WorkspaceService - Manages workspaces and workspace memberships
 * 
 * Workspaces group projects by department/team within an organization.
 * All workspace members must first be organization members.
 * 
 * Hierarchy:
 * - Organization (top level)
 *   └── Workspace (grouping layer)
 *       └── Projects (data containers)
 * 
 * Role Hierarchy:
 * - ADMIN: Full workspace control (add/remove members, manage projects)
 * - EDITOR: Create/edit projects, cannot manage members
 * - VIEWER: Read-only access to workspace projects
 * 
 * @singleton
 */
export class WorkspaceService {
    private static instance: WorkspaceService;

    private constructor() {
        console.log('🗂️  WorkspaceService initialized');
    }

    public static getInstance(): WorkspaceService {
        if (!WorkspaceService.instance) {
            WorkspaceService.instance = new WorkspaceService();
        }
        return WorkspaceService.instance;
    }

    /**
     * Get TypeORM EntityManager for application database
     */
    private async getEntityManager(): Promise<EntityManager> {
        const driver = await DBDriver.getInstance().getDriver(EDataSourceType.POSTGRESQL);
        if (!driver) {
            throw new Error('PostgreSQL driver unavailable');
        }
        const dataSource = await driver.getConcreteDriver();
        return dataSource.manager;
    }

    /**
     * Create a new workspace within an organization
     * Creator must be an organization member
     * 
     * @param params - Workspace creation parameters
     * @returns Created workspace with relations
     * @throws Error if slug exists, user not org member, or org not found
     */
    async createWorkspace(params: ICreateWorkspaceParams): Promise<DRAWorkspace> {
        const manager = await this.getEntityManager();

        return await manager.transaction(async (transactionalManager) => {
            // Validate organization exists
            const organization = await transactionalManager.findOne(DRAOrganization, {
                where: { id: params.organizationId }
            });
            if (!organization) {
                throw new Error(`Organization ID ${params.organizationId} not found`);
            }

            // Validate user is organization member
            const orgMembership = await transactionalManager.findOne(DRAOrganizationMember, {
                where: {
                    organization: { id: params.organizationId },
                    user: { id: params.createdByUserId },
                    is_active: true
                }
            });
            if (!orgMembership) {
                throw new Error(
                    `User ID ${params.createdByUserId} is not a member of organization ID ${params.organizationId}`
                );
            }

            // Validate slug uniqueness within organization
            const existingWorkspace = await transactionalManager.findOne(DRAWorkspace, {
                where: {
                    organization: { id: params.organizationId },
                    slug: params.slug
                }
            });
            if (existingWorkspace) {
                throw new Error(
                    `Workspace slug "${params.slug}" already exists in organization ID ${params.organizationId}`
                );
            }

            // Create workspace
            const workspace = transactionalManager.create(DRAWorkspace, {
                organization: organization,
                name: params.name,
                slug: params.slug,
                description: params.description,
                is_active: true
            });
            const savedWorkspace = await transactionalManager.save(workspace);

            // Add creator as workspace admin
            const user = await transactionalManager.findOneOrFail(DRAUsersPlatform, {
                where: { id: params.createdByUserId }
            });

            const workspaceMember = transactionalManager.create(DRAWorkspaceMember, {
                workspace: savedWorkspace,
                user: user,
                role: EWorkspaceRole.ADMIN,
                is_active: true,
                joined_at: new Date(),
                added_by_user: null // Creator is self-added
            });
            await transactionalManager.save(workspaceMember);

            // Return workspace with relations
            return await transactionalManager.findOneOrFail(DRAWorkspace, {
                where: { id: savedWorkspace.id },
                relations: ['organization', 'members', 'members.user']
            });
        });
    }

    /**
     * Get all workspaces for an organization
     * 
     * @param organizationId - Organization ID
     * @returns Array of workspaces in the organization
     */
    async getOrganizationWorkspaces(organizationId: number): Promise<DRAWorkspace[]> {
        const manager = await this.getEntityManager();

        return await manager.find(DRAWorkspace, {
            where: {
                organization: { id: organizationId },
                is_active: true
            },
            relations: ['members', 'projects']
        });
    }

    /**
     * Get workspaces accessible to a user within an organization
     * Returns workspaces where user is either org member or workspace member
     * 
     * @param userId - User ID
     * @param organizationId - Organization ID
     * @returns Array of accessible workspaces
     */
    async getUserWorkspaces(userId: number, organizationId: number): Promise<DRAWorkspace[]> {
        const manager = await this.getEntityManager();

        // Check if user is organization member
        const isOrgMember = await manager.findOne(DRAOrganizationMember, {
            where: {
                organization: { id: organizationId },
                user: { id: userId },
                is_active: true
            }
        });

        if (!isOrgMember) {
            return []; // User not in organization, no workspaces accessible
        }

        // Get workspaces where user is a workspace member
        const workspaceMemberships = await manager.find(DRAWorkspaceMember, {
            where: {
                user: { id: userId },
                is_active: true
            },
            relations: ['workspace', 'workspace.organization']
        });

        // Filter to workspaces in the specified organization
        return workspaceMemberships
            .filter(m => m.workspace.organization.id === organizationId)
            .map(m => m.workspace);
    }

    /**
     * Get workspace by ID with full relations
     * 
     * @param workspaceId - Workspace ID
     * @returns Workspace with members and projects
     */
    async getWorkspaceById(workspaceId: number): Promise<DRAWorkspace | null> {
        const manager = await this.getEntityManager();

        return await manager.findOne(DRAWorkspace, {
            where: { id: workspaceId },
            relations: [
                'organization',
                'members',
                'members.user',
                'projects'
            ]
        });
    }

    /**
     * Add a member to a workspace
     * User must already be an organization member
     * 
     * @param params - Member addition parameters
     * @returns Created workspace member
     * @throws Error if user not org member or already workspace member
     */
    async addMember(params: IAddWorkspaceMemberParams): Promise<DRAWorkspaceMember> {
        const manager = await this.getEntityManager();

        return await manager.transaction(async (transactionalManager) => {
            // Get workspace with organization
            const workspace = await transactionalManager.findOne(DRAWorkspace, {
                where: { id: params.workspaceId },
                relations: ['organization']
            });
            if (!workspace) {
                throw new Error(`Workspace ID ${params.workspaceId} not found`);
            }

            // Validate user is organization member
            const orgMembership = await transactionalManager.findOne(DRAOrganizationMember, {
                where: {
                    organization: { id: workspace.organization.id },
                    user: { id: params.userId },
                    is_active: true
                }
            });
            if (!orgMembership) {
                throw new Error(
                    `User ID ${params.userId} is not a member of organization ID ${workspace.organization.id}. ` +
                    `Add user to organization first.`
                );
            }

            // Check if already workspace member
            const existingMember = await transactionalManager.findOne(DRAWorkspaceMember, {
                where: {
                    workspace: { id: params.workspaceId },
                    user: { id: params.userId }
                }
            });
            if (existingMember) {
                throw new Error(`User ID ${params.userId} is already a member of workspace ID ${params.workspaceId}`);
            }

            // Validate user and adder exist
            const user = await transactionalManager.findOne(DRAUsersPlatform, {
                where: { id: params.userId }
            });
            if (!user) {
                throw new Error(`User ID ${params.userId} not found`);
            }

            const adder = await transactionalManager.findOne(DRAUsersPlatform, {
                where: { id: params.addedByUserId }
            });
            if (!adder) {
                throw new Error(`Adder user ID ${params.addedByUserId} not found`);
            }

            // Create workspace member
            const member = transactionalManager.create(DRAWorkspaceMember, {
                workspace: workspace,
                user: user,
                role: params.role,
                is_active: true,
                joined_at: new Date(),
                added_by_user: adder
            });

            return await transactionalManager.save(member);
        });
    }

    /**
     * Remove a member from a workspace
     * Cannot remove the last admin
     * 
     * @param workspaceId - Workspace ID
     * @param userId - User ID to remove
     * @throws Error if trying to remove last admin
     */
    async removeMember(workspaceId: number, userId: number): Promise<void> {
        const manager = await this.getEntityManager();

        await manager.transaction(async (transactionalManager) => {
            const member = await transactionalManager.findOne(DRAWorkspaceMember, {
                where: {
                    workspace: { id: workspaceId },
                    user: { id: userId }
                }
            });

            if (!member) {
                throw new Error(`User ID ${userId} is not a member of workspace ID ${workspaceId}`);
            }

            // Prevent removing last admin
            if (member.role === EWorkspaceRole.ADMIN) {
                const adminCount = await transactionalManager.count(DRAWorkspaceMember, {
                    where: {
                        workspace: { id: workspaceId },
                        role: EWorkspaceRole.ADMIN,
                        is_active: true
                    }
                });

                if (adminCount <= 1) {
                    throw new Error('Cannot remove the last admin from the workspace');
                }
            }

            // Soft delete by marking inactive
            member.is_active = false;
            await transactionalManager.save(member);
        });
    }

    /**
     * Update member role in workspace
     * Cannot demote last admin
     * 
     * @param workspaceId - Workspace ID
     * @param userId - User ID
     * @param newRole - New role to assign
     */
    async updateMemberRole(
        workspaceId: number,
        userId: number,
        newRole: EWorkspaceRole
    ): Promise<DRAWorkspaceMember> {
        const manager = await this.getEntityManager();

        return await manager.transaction(async (transactionalManager) => {
            const member = await transactionalManager.findOne(DRAWorkspaceMember, {
                where: {
                    workspace: { id: workspaceId },
                    user: { id: userId },
                    is_active: true
                }
            });

            if (!member) {
                throw new Error(`Active member not found for user ID ${userId} in workspace ID ${workspaceId}`);
            }

            // Prevent demoting last admin
            if (member.role === EWorkspaceRole.ADMIN && newRole !== EWorkspaceRole.ADMIN) {
                const adminCount = await transactionalManager.count(DRAWorkspaceMember, {
                    where: {
                        workspace: { id: workspaceId },
                        role: EWorkspaceRole.ADMIN,
                        is_active: true
                    }
                });

                if (adminCount <= 1) {
                    throw new Error('Cannot change role of the last admin in the workspace');
                }
            }

            member.role = newRole;
            return await transactionalManager.save(member);
        });
    }

    /**
     * Check if user is a member of a workspace
     * 
     * @param userId - User ID
     * @param workspaceId - Workspace ID
     * @returns Boolean indicating membership status
     */
    async isUserMember(userId: number, workspaceId: number): Promise<boolean> {
        const manager = await this.getEntityManager();

        const member = await manager.findOne(DRAWorkspaceMember, {
            where: {
                workspace: { id: workspaceId },
                user: { id: userId },
                is_active: true
            }
        });

        return !!member;
    }

    /**
     * Get user's role in a workspace
     * 
     * @param userId - User ID
     * @param workspaceId - Workspace ID
     * @returns User's role or null if not a member
     */
    async getUserRole(userId: number, workspaceId: number): Promise<EWorkspaceRole | null> {
        const manager = await this.getEntityManager();

        const member = await manager.findOne(DRAWorkspaceMember, {
            where: {
                workspace: { id: workspaceId },
                user: { id: userId },
                is_active: true
            }
        });

        return member ? (member.role as EWorkspaceRole) : null;
    }

    /**
     * Get all projects in a workspace
     * 
     * @param workspaceId - Workspace ID
     * @returns Array of projects in the workspace
     */
    async getWorkspaceProjects(workspaceId: number): Promise<DRAProject[]> {
        const manager = await this.getEntityManager();

        return await manager.find(DRAProject, {
            where: { workspace: { id: workspaceId } },
            relations: ['user', 'data_sources', 'data_models', 'dashboards']
        });
    }

    /**
     * Update workspace details (name, description, slug)
     * Slug must remain unique within organization
     * 
     * @param workspaceId - Workspace ID
     * @param updates - Partial workspace updates
     * @returns Updated workspace
     */
    async updateWorkspace(
        workspaceId: number,
        updates: Partial<{ name: string; description: string; slug: string }>
    ): Promise<DRAWorkspace> {
        const manager = await this.getEntityManager();

        return await manager.transaction(async (transactionalManager) => {
            const workspace = await transactionalManager.findOne(DRAWorkspace, {
                where: { id: workspaceId },
                relations: ['organization']
            });

            if (!workspace) {
                throw new Error(`Workspace ID ${workspaceId} not found`);
            }

            // If slug is being updated, check uniqueness within organization
            if (updates.slug && updates.slug !== workspace.slug) {
                const existingWorkspace = await transactionalManager.findOne(DRAWorkspace, {
                    where: {
                        organization: { id: workspace.organization.id },
                        slug: updates.slug
                    }
                });

                if (existingWorkspace) {
                    throw new Error(
                        `Workspace slug "${updates.slug}" already exists in organization ID ${workspace.organization.id}`
                    );
                }
            }

            // Apply updates
            if (updates.name) workspace.name = updates.name;
            if (updates.description !== undefined) workspace.description = updates.description;
            if (updates.slug) workspace.slug = updates.slug;

            return await transactionalManager.save(workspace);
        });
    }

    /**
     * Delete workspace (soft delete by marking inactive)
     * All projects in workspace remain but become orphaned (workspace_id = null)
     * 
     * @param workspaceId - Workspace ID
     */
    async deleteWorkspace(workspaceId: number): Promise<void> {
        const manager = await this.getEntityManager();

        await manager.transaction(async (transactionalManager) => {
            const workspace = await transactionalManager.findOne(DRAWorkspace, {
                where: { id: workspaceId }
            });

            if (!workspace) {
                throw new Error(`Workspace ID ${workspaceId} not found`);
            }

            // Check if it's the default workspace
            if (workspace.slug === 'default' || workspace.name === 'Default Workspace') {
                throw new Error('Cannot delete the default workspace');
            }

            // Orphan all projects (set workspace_id to null)
            await transactionalManager.update(
                DRAProject,
                { workspace: { id: workspaceId } },
                { workspace: null }
            );

            // Soft delete workspace
            workspace.is_active = false;
            await transactionalManager.save(workspace);

            // Deactivate all workspace members
            await transactionalManager.update(
                DRAWorkspaceMember,
                { workspace: { id: workspaceId } },
                { is_active: false }
            );
        });
    }
}
