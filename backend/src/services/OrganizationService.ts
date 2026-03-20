import { EntityManager } from 'typeorm';
import { DBDriver } from '../drivers/DBDriver.js';
import { EDataSourceType } from '../types/EDataSourceType.js';
import { DRAOrganization } from '../models/DRAOrganization.js';
import { DRAWorkspace } from '../models/DRAWorkspace.js';
import { DRAOrganizationMember } from '../models/DRAOrganizationMember.js';
import { DRAOrganizationSubscription } from '../models/DRAOrganizationSubscription.js';
import { DRASubscriptionTier, ESubscriptionTier } from '../models/DRASubscriptionTier.js';
import { DRAUsersPlatform } from '../models/DRAUsersPlatform.js';

export enum EOrganizationRole {
    OWNER = 'owner',
    ADMIN = 'admin',
    MEMBER = 'member'
}

interface ICreateOrganizationParams {
    name: string;
    slug?: string;
    domain?: string;
    logoUrl?: string;
    ownerId: number;
    subscriptionTierId?: number; // Optional - defaults to FREE tier
}

export interface IUpdateOrganizationParams {
    organizationId: number;
    name?: string;
    slug?: string;
    domain?: string;
    logoUrl?: string;
    settings?: Record<string, any>;
}

interface IAddMemberParams {
    organizationId: number;
    userId: number;
    role: EOrganizationRole;
    invitedByUserId: number;
}

interface IOrganizationUsage {
    currentMembers: number;
    maxMembers: number | null;
    canAddMembers: boolean;
    membersRemaining: number | null;
}

/**
 * OrganizationService - Manages multi-tenant organization operations
 * 
 * Handles:
 * - Organization CRUD (create, read, update, delete)
 * - Member management (add, remove, role assignment)
 * - Subscription enforcement (max_members limits)
 * - Personal organization creation for FREE/STARTER users
 * - Organization switching and context management
 * 
 * Personal Organizations Strategy:
 * - FREE tier: max_members=1 (solo only)
 * - STARTER tier: max_members=1 (solo only)
 * - PROFESSIONAL: max_members=5
 * - PROFESSIONAL_PLUS: max_members=100
 * - ENTERPRISE: max_members=null (unlimited)
 * 
 * @singleton
 */
export class OrganizationService {
    private static instance: OrganizationService;

    private constructor() {
        console.log('🏢 OrganizationService initialized');
    }

    public static getInstance(): OrganizationService {
        if (!OrganizationService.instance) {
            OrganizationService.instance = new OrganizationService();
        }
        return OrganizationService.instance;
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
     * Create a new organization with owner membership and default workspace
     * 
     * @param params - Organization creation parameters
     * @returns Created organization with relations
     * @throws Error if slug already exists or subscription tier not found
     */
    async createOrganization(params: ICreateOrganizationParams): Promise<DRAOrganization> {
        const manager = await this.getEntityManager();

        return await manager.transaction(async (transactionalManager) => {
            // Validate or default subscription tier
            let subscriptionTier: DRASubscriptionTier | null;
            if (params.subscriptionTierId) {
                // Use provided tier ID
                subscriptionTier = await transactionalManager.findOne(DRASubscriptionTier, {
                    where: { id: params.subscriptionTierId }
                });
                if (!subscriptionTier) {
                    throw new Error(`Subscription tier ID ${params.subscriptionTierId} not found`);
                }
            } else {
                // Default to FREE tier
                subscriptionTier = await transactionalManager.findOne(DRASubscriptionTier, {
                    where: { tier_name: ESubscriptionTier.FREE }
                });
                if (!subscriptionTier) {
                    throw new Error('FREE tier not found in database — run seeders: npm run seed:run');
                }
            }

            // Validate user exists
            const user = await transactionalManager.findOne(DRAUsersPlatform, {
                where: { id: params.ownerId }
            });
            if (!user) {
                throw new Error(`User ID ${params.ownerId} not found`);
            }

            // Create organization
            const organization = transactionalManager.create(DRAOrganization, {
                name: params.name,
                domain: params.domain,
                logo_url: params.logoUrl,
                is_active: true,
                settings: {}
            });
            const savedOrg = await transactionalManager.save(organization);

            // Determine max_members from tier
            const maxMembers = this.getMaxMembersForTier(subscriptionTier.tier_name);

            // Create organization subscription
            const orgSubscription = transactionalManager.create(DRAOrganizationSubscription, {
                organization: savedOrg,
                subscription_tier: subscriptionTier,
                max_members: maxMembers,
                current_members: 1, // Owner counts as first member
                is_active: true,
                started_at: new Date()
            });
            await transactionalManager.save(orgSubscription);

            // Create owner membership
            const ownerMembership = transactionalManager.create(DRAOrganizationMember, {
                organization: savedOrg,
                user: user,
                role: EOrganizationRole.OWNER,
                is_active: true,
                joined_at: new Date(),
                invited_by_user: null // Owner is self-created
            });
            await transactionalManager.save(ownerMembership);

            // Create default workspace
            const defaultWorkspace = transactionalManager.create(DRAWorkspace, {
                organization: savedOrg,
                name: 'Default Workspace',
                slug: 'default',
                description: 'Automatically created default workspace',
                is_active: true
            });
            await transactionalManager.save(defaultWorkspace);

            // Return organization with relations
            return await transactionalManager.findOneOrFail(DRAOrganization, {
                where: { id: savedOrg.id },
                relations: ['members', 'workspaces', 'subscription']
            });
        });
    }

    /**
     * Get all organizations for a user
     * Includes user's role in each organization
     * 
     * @param userId - User's platform ID
     * @returns Array of organizations with user_role field
     */
    async getUserOrganizations(userId: number): Promise<DRAOrganization[]> {
        const manager = await this.getEntityManager();

        const memberships = await manager.find(DRAOrganizationMember, {
            where: {
                user: { id: userId },
                is_active: true
            },
            relations: [
                'organization',
                'organization.subscription',
                'organization.subscription.subscription_tier',
                'organization.members',
                'organization.members.user'
            ]
        });

        // Map organizations and attach user's role for each
        return memberships.map(m => {
            const org = m.organization;
            // Add user_role as a non-persistent property for API response
            (org as any).user_role = m.role;
            (org as any).is_owner = m.role === EOrganizationRole.OWNER;
            return org;
        });
    }

    /**
     * Get organization by ID with full relations
     * 
     * @param organizationId - Organization ID
     * @returns Organization with members, workspaces, and subscription
     */
    async getOrganizationById(organizationId: number): Promise<DRAOrganization | null> {
        const manager = await this.getEntityManager();

        return await manager.findOne(DRAOrganization, {
            where: { id: organizationId },
            relations: [
                'members',
                'members.user',
                'workspaces',
                'subscription',
                'subscription.subscription_tier'
            ]
        });
    }

    /**
     * Add a member to an organization
     * Enforces max_members limit from subscription tier
     * 
     * @param params - Member addition parameters
     * @returns Created organization member
     * @throws Error if member limit reached or user already exists
     */
    async addMember(params: IAddMemberParams): Promise<DRAOrganizationMember> {
        const manager = await this.getEntityManager();

        return await manager.transaction(async (transactionalManager) => {
            // Check if organization exists and get subscription
            const organization = await transactionalManager.findOne(DRAOrganization, {
                where: { id: params.organizationId },
                relations: ['subscription']
            });
            if (!organization) {
                throw new Error(`Organization ID ${params.organizationId} not found`);
            }

            // Check max_members limit
            const subscription = organization.subscription;
            if (subscription && subscription.max_members !== null) {
                if (subscription.current_members >= subscription.max_members) {
                    throw new Error(
                        `Organization has reached maximum member limit (${subscription.max_members}). ` +
                        `Upgrade subscription to add more members.`
                    );
                }
            }

            // Check if user already exists
            const existingMember = await transactionalManager.findOne(DRAOrganizationMember, {
                where: {
                    organization: { id: params.organizationId },
                    user: { id: params.userId }
                }
            });
            if (existingMember) {
                throw new Error(`User ID ${params.userId} is already a member of this organization`);
            }

            // Validate user exists
            const user = await transactionalManager.findOne(DRAUsersPlatform, {
                where: { id: params.userId }
            });
            if (!user) {
                throw new Error(`User ID ${params.userId} not found`);
            }

            // Validate inviter exists
            const inviter = await transactionalManager.findOne(DRAUsersPlatform, {
                where: { id: params.invitedByUserId }
            });
            if (!inviter) {
                throw new Error(`Inviter user ID ${params.invitedByUserId} not found`);
            }

            // Create member
            const member = transactionalManager.create(DRAOrganizationMember, {
                organization: organization,
                user: user,
                role: params.role,
                is_active: true,
                joined_at: new Date(),
                invited_by_user: inviter
            });
            const savedMember = await transactionalManager.save(member);

            // Increment current_members count
            if (subscription) {
                subscription.current_members += 1;
                await transactionalManager.save(subscription);
            }

            return savedMember;
        });
    }

    /**
     * Remove a member from an organization
     * Cannot remove the last owner
     * 
     * @param organizationId - Organization ID
     * @param userId - User ID to remove
     * @throws Error if trying to remove last owner
     */
    async removeMember(organizationId: number, userId: number): Promise<void> {
        const manager = await this.getEntityManager();

        await manager.transaction(async (transactionalManager) => {
            const member = await transactionalManager.findOne(DRAOrganizationMember, {
                where: {
                    organization: { id: organizationId },
                    user: { id: userId }
                },
                relations: ['organization', 'organization.subscription']
            });

            if (!member) {
                throw new Error(`User ID ${userId} is not a member of organization ID ${organizationId}`);
            }

            // Prevent removing last owner
            if (member.role === EOrganizationRole.OWNER) {
                const ownerCount = await transactionalManager.count(DRAOrganizationMember, {
                    where: {
                        organization: { id: organizationId },
                        role: EOrganizationRole.OWNER,
                        is_active: true
                    }
                });

                if (ownerCount <= 1) {
                    throw new Error('Cannot remove the last owner from the organization');
                }
            }

            // Soft delete by marking inactive
            member.is_active = false;
            await transactionalManager.save(member);

            // Decrement current_members count
            const subscription = member.organization.subscription;
            if (subscription && subscription.current_members > 0) {
                subscription.current_members -= 1;
                await transactionalManager.save(subscription);
            }
        });
    }

    /**
     * Update member role
     * Cannot change role of last owner
     * 
     * @param organizationId - Organization ID
     * @param userId - User ID
     * @param newRole - New role to assign
     */
    async updateMemberRole(
        organizationId: number,
        userId: number,
        newRole: EOrganizationRole
    ): Promise<DRAOrganizationMember> {
        const manager = await this.getEntityManager();

        return await manager.transaction(async (transactionalManager) => {
            const member = await transactionalManager.findOne(DRAOrganizationMember, {
                where: {
                    organization: { id: organizationId },
                    user: { id: userId },
                    is_active: true
                }
            });

            if (!member) {
                throw new Error(`Active member not found for user ID ${userId} in organization ID ${organizationId}`);
            }

            // Prevent demoting last owner
            if (member.role === EOrganizationRole.OWNER && newRole !== EOrganizationRole.OWNER) {
                const ownerCount = await transactionalManager.count(DRAOrganizationMember, {
                    where: {
                        organization: { id: organizationId },
                        role: EOrganizationRole.OWNER,
                        is_active: true
                    }
                });

                if (ownerCount <= 1) {
                    throw new Error('Cannot change role of the last owner in the organization');
                }
            }

            member.role = newRole;
            return await transactionalManager.save(member);
        });
    }

    /**
     * Get organization usage statistics
     * Returns current member count and limits
     * 
     * @param organizationId - Organization ID
     * @returns Usage statistics
     */
    async getOrganizationUsage(organizationId: number): Promise<IOrganizationUsage> {
        const manager = await this.getEntityManager();

        const organization = await manager.findOne(DRAOrganization, {
            where: { id: organizationId },
            relations: ['subscription']
        });

        if (!organization) {
            throw new Error(`Organization ID ${organizationId} not found`);
        }

        const subscription = organization.subscription;
        const currentMembers = subscription?.current_members || 0;
        const maxMembers = subscription?.max_members || null;

        const canAddMembers = maxMembers === null || currentMembers < maxMembers;
        const membersRemaining = maxMembers !== null ? maxMembers - currentMembers : null;

        return {
            currentMembers,
            maxMembers,
            canAddMembers,
            membersRemaining
        };
    }

    /**
     * Check if user is a member of an organization
     * 
     * @param userId - User ID
     * @param organizationId - Organization ID
     * @returns Boolean indicating membership status
     */
    async isUserMember(userId: number, organizationId: number): Promise<boolean> {
        const manager = await this.getEntityManager();

        const member = await manager.findOne(DRAOrganizationMember, {
            where: {
                organization: { id: organizationId },
                user: { id: userId },
                is_active: true
            }
        });

        return !!member;
    }

    /**
     * Get all members of an organization
     * Returns list of active members with user details
     * 
     * @param organizationId - Organization ID
     * @returns Array of organization members with user info
     */
    async getOrganizationMembers(organizationId: number): Promise<DRAOrganizationMember[]> {
        const manager = await this.getEntityManager();

        const members = await manager.find(DRAOrganizationMember, {
            where: {
                organization: { id: organizationId },
                is_active: true
            },
            relations: ['user'],
            order: {
                joined_at: 'ASC'
            }
        });

        return members;
    }

    /**
     * Get user's role in an organization
     * 
     * @param userId - User ID
     * @param organizationId - Organization ID
     * @returns User's role or null if not a member
     */
    async getUserRole(userId: number, organizationId: number): Promise<EOrganizationRole | null> {
        const manager = await this.getEntityManager();

        const member = await manager.findOne(DRAOrganizationMember, {
            where: {
                organization: { id: organizationId },
                user: { id: userId },
                is_active: true
            }
        });

        return member ? (member.role as EOrganizationRole) : null;
    }

    /**
     * Determine max_members value based on subscription tier name
     * Implements personal organizations strategy for FREE/STARTER
     * 
     * @param tierName - Subscription tier name
     * @returns max_members value (null = unlimited)
     */
    /**
     * Resolve the subscription tier for a user via their personal (owner) organization.
     *
     * Lookup path: userId → DRAOrganizationMember (role='owner') → DRAOrganization
     *              → DRAOrganizationSubscription → DRASubscriptionTier
     *
     * Falls back to the FREE tier when the user has no owner-role membership or
     * their organization has no subscription yet.
     *
     * @param userId  - The platform user ID
     * @param manager - Active TypeORM EntityManager (may be from a transaction)
     */
    async getOrgSubscriptionTierForUser(
        userId: number,
        manager: EntityManager
    ): Promise<{ tier: DRASubscriptionTier; orgSubscription: DRAOrganizationSubscription | null }> {
        // Find the organization the user owns (personal org)
        const ownerMembership = await manager.findOne(DRAOrganizationMember, {
            where: {
                users_platform_id: userId,
                role: 'owner',
                is_active: true
            },
            relations: ['organization', 'organization.subscription', 'organization.subscription.subscription_tier']
        });

        const orgSubscription = ownerMembership?.organization?.subscription ?? null;
        const tier = orgSubscription?.subscription_tier ?? null;

        if (tier) {
            return { tier, orgSubscription };
        }

        // Fallback: return FREE tier
        const freeTier = await manager.findOne(DRASubscriptionTier, {
            where: { tier_name: ESubscriptionTier.FREE }
        });

        if (!freeTier) {
            throw new Error('FREE tier not found in database — run seeders');
        }

        return { tier: freeTier, orgSubscription: null };
    }

    private getMaxMembersForTier(tierName: string): number | null {
        const normalizedTier = tierName.toUpperCase();

        switch (normalizedTier) {
            case 'FREE':
                return 1; // Personal org only
            case 'STARTER':
                return 1; // Personal org only
            case 'PROFESSIONAL':
                return 5;
            case 'PROFESSIONAL_PLUS':
            case 'PRO_PLUS':
                return 100;
            case 'ENTERPRISE':
                return null; // Unlimited
            default:
                console.warn(`Unknown subscription tier: ${tierName}, defaulting to max_members=1`);
                return 1; // Default to personal org for safety
        }
    }

    /**
     * Update organization details
     * 
     * @param params - Update parameters
     * @returns Updated organization
     * @throws Error if organization not found
     */
    async updateOrganization(params: IUpdateOrganizationParams): Promise<DRAOrganization> {
        const manager = await this.getEntityManager();

        return await manager.transaction(async (transactionalManager) => {
            // Fetch existing organization
            const organization = await transactionalManager.findOne(DRAOrganization, {
                where: { id: params.organizationId }
            });

            if (!organization) {
                throw new Error(`Organization ID ${params.organizationId} not found`);
            }

            // Update fields if provided
            if (params.name) organization.name = params.name;
            if (params.domain !== undefined) organization.domain = params.domain;
            if (params.logoUrl !== undefined) organization.logo_url = params.logoUrl;
            if (params.settings !== undefined) organization.settings = params.settings;

            return await transactionalManager.save(organization);
        });
    }

    /**
     * Delete an organization
     * Validates confirmation name and cascades to all related entities
     * 
     * @param organizationId - Organization ID
     * @param confirmName - Must match organization name exactly
     * @throws Error if confirmation doesn't match or organization not found
     */
    async deleteOrganization(organizationId: number, confirmName: string): Promise<void> {
        const manager = await this.getEntityManager();

        await manager.transaction(async (transactionalManager) => {
            // Fetch organization
            const organization = await transactionalManager.findOne(DRAOrganization, {
                where: { id: organizationId }
            });

            if (!organization) {
                throw new Error(`Organization ID ${organizationId} not found`);
            }

            // Validate confirmation
            if (organization.name !== confirmName) {
                throw new Error('Organization name confirmation does not match');
            }

            // TypeORM will cascade delete via relationships:
            // - organization_members (CASCADE)
            // - workspaces (CASCADE)
            // - workspace_members (CASCADE via workspace)
            // - organization_subscription (CASCADE)
            await transactionalManager.remove(organization);
        });
    }

    /**
     * Get all organizations in the system (admin only)
     * Returns all organizations with member counts and subscription details
     * 
     * @returns All organizations with enriched data
     */
    async getAllOrganizations(): Promise<DRAOrganization[]> {
        const manager = await this.getEntityManager();

        const organizations = await manager.find(DRAOrganization, {
            relations: [
                'subscription',
                'subscription.subscription_tier',
                'members',
                'members.user',
                'workspaces'
            ],
            order: { id: 'ASC' }
        });

        return organizations;
    }
}
