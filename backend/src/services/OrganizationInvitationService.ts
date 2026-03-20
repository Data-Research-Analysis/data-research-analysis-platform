import crypto from 'crypto';
import { MoreThan } from 'typeorm';
import { DBDriver } from '../drivers/DBDriver.js';
import { EDataSourceType } from '../types/EDataSourceType.js';
import { DRAOrganizationInvitation } from '../models/DRAOrganizationInvitation.js';
import { DRAOrganization } from '../models/DRAOrganization.js';
import { DRAOrganizationMember } from '../models/DRAOrganizationMember.js';
import { DRAUsersPlatform } from '../models/DRAUsersPlatform.js';
import { EmailService } from './EmailService.js';
import { NotificationHelperService } from './NotificationHelperService.js';

const INVITATION_EXPIRY_DAYS = 7;
const TOKEN_LENGTH = 64;

interface ICreateOrgInvitation {
    organizationId: number;
    email: string;
    role: 'owner' | 'admin' | 'member';
    invitedByUserId: number;
}

interface IAcceptOrgInvitation {
    token: string;
    userId: number;
}

/**
 * OrganizationInvitationService - Singleton service for managing organization invitations
 * 
 * Key responsibilities:
 * - Create invitations with secure tokens
 * - Validate and accept invitations
 * - Manage invitation lifecycle (pending, accepted, expired, cancelled)
 * - Send notification emails
 * - Handle both existing and new users
 * 
 * @see organization-first-invitation-implementation-plan.md
 */
export class OrganizationInvitationService {
    private static instance: OrganizationInvitationService;
    private emailService: EmailService;
    private notificationHelper = NotificationHelperService.getInstance();

    private constructor() {
        this.emailService = EmailService.getInstance();
    }

    public static getInstance(): OrganizationInvitationService {
        if (!OrganizationInvitationService.instance) {
            OrganizationInvitationService.instance = new OrganizationInvitationService();
        }
        return OrganizationInvitationService.instance;
    }

    /**
     * Get the database manager
     */
    private async getManager() {
        const driver = await DBDriver.getInstance().getDriver(EDataSourceType.POSTGRESQL);
        const concreteDriver = await driver.getConcreteDriver();
        if (!concreteDriver) {
            throw new Error('Database driver not initialized');
        }
        return concreteDriver.manager;
    }

    /**
     * Generate a secure random token for invitation
     */
    private generateSecureToken(): string {
        return crypto.randomBytes(TOKEN_LENGTH).toString('hex');
    }

    /**
     * Create a new organization invitation
     * - If user exists, add directly to organization members
     * - If user doesn't exist, create invitation and send email
     */
    async createInvitation(data: ICreateOrgInvitation): Promise<any> {
        const manager = await this.getManager();
        
        // Verify organization exists
        const organization = await manager.findOne(DRAOrganization, {
            where: { id: data.organizationId }
        });

        if (!organization) {
            throw new Error('Organization not found');
        }

        // Verify inviter exists and has permission
        const inviter = await manager.findOne(DRAUsersPlatform, {
            where: { id: data.invitedByUserId }
        });

        if (!inviter) {
            throw new Error('Inviter not found');
        }

        // Check if inviter is admin or owner of the organization
        const inviterMember = await manager.findOne(DRAOrganizationMember, {
            where: {
                organization_id: data.organizationId,
                users_platform_id: data.invitedByUserId,
                is_active: true
            }
        });

        if (!inviterMember || (inviterMember.role !== 'admin' && inviterMember.role !== 'owner')) {
            throw new Error('Only organization admins and owners can invite members');
        }

        // Check if user already exists in the platform
        const existingUser = await manager.findOne(DRAUsersPlatform, {
            where: { email: data.email.toLowerCase().trim() }
        });

        if (existingUser) {
            // Check if already a member
            const existingMember = await manager.findOne(DRAOrganizationMember, {
                where: {
                    organization_id: data.organizationId,
                    users_platform_id: existingUser.id
                }
            });

            if (existingMember) {
                throw new Error('User is already a member of this organization');
            }

            // Add directly to organization members
            const newMember = manager.create(DRAOrganizationMember, {
                organization_id: data.organizationId,
                users_platform_id: existingUser.id,
                role: data.role,
                is_active: true,
                joined_at: new Date(),
                invited_by_user_id: data.invitedByUserId
            });

            await manager.save(newMember);

            // Send notification email
            await this.emailService.sendOrganizationMemberAdded({
                email: data.email,
                organizationName: organization.name,
                inviterName: `${inviter.first_name} ${inviter.last_name}`.trim() || inviter.email,
                role: data.role
            });

            return { addedDirectly: true, userId: existingUser.id };
        }

        // Check for existing pending invitation
        const existingInvitation = await manager.findOne(DRAOrganizationInvitation, {
            where: {
                organization_id: data.organizationId,
                invited_email: data.email.toLowerCase().trim(),
                status: 'pending',
                expires_at: MoreThan(new Date())
            }
        });

        if (existingInvitation) {
            throw new Error('An invitation has already been sent to this email address');
        }

        // Create new invitation
        const token = this.generateSecureToken();
        const expiresAt = new Date();
        expiresAt.setDate(expiresAt.getDate() + INVITATION_EXPIRY_DAYS);

        const invitation = manager.create(DRAOrganizationInvitation, {
            organization_id: data.organizationId,
            invited_email: data.email.toLowerCase().trim(),
            role: data.role,
            invited_by_user_id: data.invitedByUserId,
            invitation_token: token,
            status: 'pending',
            expires_at: expiresAt
        });

        await manager.save(invitation);

        // Send invitation email
        const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:3000';
        await this.emailService.sendOrganizationInvitation({
            email: data.email,
            organizationName: organization.name,
            inviterName: `${inviter.first_name} ${inviter.last_name}`.trim() || inviter.email,
            role: data.role,
            token: token,
            frontendUrl: frontendUrl
        });

        return {
            id: invitation.id,
            invited_email: invitation.invited_email,
            role: invitation.role,
            status: invitation.status,
            expires_at: invitation.expires_at
        };
    }

    /**
     * Get all invitations for an organization
     */
    async getOrganizationInvitations(organizationId: number, includeExpired: boolean = false): Promise<any[]> {
        const manager = await this.getManager();
        
        const whereCondition: any = {
            organization_id: organizationId
        };

        if (!includeExpired) {
            whereCondition.status = 'pending';
            whereCondition.expires_at = MoreThan(new Date());
        }

        const invitations = await manager.find(DRAOrganizationInvitation, {
            where: whereCondition,
            relations: ['invited_by'],
            order: { created_at: 'DESC' }
        });

        return invitations.map(inv => ({
            id: inv.id,
            invited_email: inv.invited_email,
            role: inv.role,
            status: inv.status,
            created_at: inv.created_at,
            expires_at: inv.expires_at,
            invited_by_name: `${inv.invited_by.first_name} ${inv.invited_by.last_name}`.trim() || inv.invited_by.email
        }));
    }

    /**
     * Get all pending invitations for a user's email
     */
    async getUserPendingOrgInvitations(userEmail: string): Promise<any[]> {
        const manager = await this.getManager();
        
        const invitations = await manager.find(DRAOrganizationInvitation, {
            where: {
                invited_email: userEmail.toLowerCase().trim(),
                status: 'pending',
                expires_at: MoreThan(new Date())
            },
            relations: ['organization', 'invited_by'],
            order: { created_at: 'DESC' }
        });

        return invitations.map(inv => ({
            id: inv.id,
            organization_name: inv.organization.name,
            role: inv.role,
            invitation_token: inv.invitation_token,
            created_at: inv.created_at,
            expires_at: inv.expires_at,
            invited_by_name: `${inv.invited_by.first_name} ${inv.invited_by.last_name}`.trim() || inv.invited_by.email
        }));
    }

    /**
     * Get invitation by token
     */
    async getInvitationByToken(token: string): Promise<any | null> {
        const manager = await this.getManager();
        
        const invitation = await manager.findOne(DRAOrganizationInvitation, {
            where: { invitation_token: token },
            relations: ['organization', 'invited_by']
        });

        if (!invitation) {
            return null;
        }

        return {
            id: invitation.id,
            organization_name: invitation.organization.name,
            invited_email: invitation.invited_email,
            role: invitation.role,
            status: invitation.status,
            expires_at: invitation.expires_at,
            invited_by_name: `${invitation.invited_by.first_name} ${invitation.invited_by.last_name}`.trim() || invitation.invited_by.email
        };
    }

    /**
     * Accept an organization invitation
     */
    async acceptInvitation(data: IAcceptOrgInvitation): Promise<{ message: string; organizationId: number }> {
        const manager = await this.getManager();
        
        const invitation = await manager.findOne(DRAOrganizationInvitation, {
            where: { invitation_token: data.token },
            relations: ['organization']
        });

        if (!invitation) {
            throw new Error('Invitation not found');
        }

        if (invitation.status !== 'pending') {
            throw new Error(`Invitation already ${invitation.status}`);
        }

        if (invitation.expires_at < new Date()) {
            invitation.status = 'expired';
            await manager.save(invitation);
            throw new Error('Invitation has expired');
        }

        // Get user
        const user = await manager.findOne(DRAUsersPlatform, {
            where: { id: data.userId }
        });

        if (!user) {
            throw new Error('User not found');
        }

        // Verify email matches
        if (user.email.toLowerCase() !== invitation.invited_email.toLowerCase()) {
            throw new Error('Email does not match invitation');
        }

        // Check if already a member
        const existingMember = await manager.findOne(DRAOrganizationMember, {
            where: {
                organization_id: invitation.organization_id,
                users_platform_id: user.id
            }
        });

        if (existingMember) {
            invitation.status = 'accepted';
            invitation.accepted_at = new Date();
            await manager.save(invitation);
            throw new Error('You are already a member of this organization');
        }

        // Create organization member
        const member = manager.create(DRAOrganizationMember, {
            organization_id: invitation.organization_id,
            users_platform_id: user.id,
            role: invitation.role,
            is_active: true,
            joined_at: new Date(),
            invited_by_user_id: invitation.invited_by_user_id
        });

        await manager.save(member);

        // Update invitation status
        invitation.status = 'accepted';
        invitation.accepted_at = new Date();
        await manager.save(invitation);

        // Create notification
        await this.notificationHelper.createNotification({
            user_id: user.id,
            type: 'organization_invitation_accepted',
            title: 'Welcome to the team!',
            message: `You've joined ${invitation.organization.name}`,
            related_entity_type: 'organization',
            related_entity_id: invitation.organization_id
        });

        return {
            message: 'Successfully joined organization',
            organizationId: invitation.organization_id
        };
    }

    /**
     * Cancel an invitation
     */
    async cancelInvitation(invitationId: number, cancelledByUserId: number): Promise<void> {
        const manager = await this.getManager();
        
        const invitation = await manager.findOne(DRAOrganizationInvitation, {
            where: { id: invitationId }
        });

        if (!invitation) {
            throw new Error('Invitation not found');
        }

        // Verify user has permission
        const member = await manager.findOne(DRAOrganizationMember, {
            where: {
                organization_id: invitation.organization_id,
                users_platform_id: cancelledByUserId,
                is_active: true
            }
        });

        if (!member || (member.role !== 'admin' && member.role !== 'owner')) {
            throw new Error('Only organization admins and owners can cancel invitations');
        }

        invitation.status = 'cancelled';
        await manager.save(invitation);
    }

    /**
     * Resend an invitation email
     */
    async resendInvitation(invitationId: number): Promise<void> {
        const manager = await this.getManager();
        
        const invitation = await manager.findOne(DRAOrganizationInvitation, {
            where: { id: invitationId },
            relations: ['organization', 'invited_by']
        });

        if (!invitation) {
            throw new Error('Invitation not found');
        }

        if (invitation.status !== 'pending') {
            throw new Error('Can only resend pending invitations');
        }

        if (invitation.expires_at < new Date()) {
            throw new Error('Invitation has expired');
        }

        const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:3000';
        await this.emailService.sendOrganizationInvitation({
            email: invitation.invited_email,
            organizationName: invitation.organization.name,
            inviterName: `${invitation.invited_by.first_name} ${invitation.invited_by.last_name}`.trim() || invitation.invited_by.email,
            role: invitation.role,
            token: invitation.invitation_token,
            frontendUrl: frontendUrl
        });
    }
}
