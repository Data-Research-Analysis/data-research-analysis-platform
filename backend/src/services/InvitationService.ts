import crypto from 'crypto';
import { MoreThan, Repository, DataSource } from 'typeorm';
import { DBDriver } from '../drivers/DBDriver.js';
import { EDataSourceType } from '../types/EDataSourceType.js';
import { DRAProjectInvitation } from '../models/DRAProjectInvitation.js';
import { DRAVerificationCode } from '../models/DRAVerificationCode.js';
import { DRAUsersPlatform } from '../models/DRAUsersPlatform.js';
import { DRAProject } from '../models/DRAProject.js';
import { DRAProjectMember } from '../models/DRAProjectMember.js';
import { DRASubscriptionTier } from '../models/DRASubscriptionTier.js';
import { DRAUserSubscription } from '../models/DRAUserSubscription.js';
import { IInvitationCreate, IInvitationResponse, IInvitationAccept } from '../interfaces/IInvitation.js';
import { EProjectRole } from '../types/EProjectRole.js';
import { EmailService } from './EmailService.js';
import { NotificationHelperService } from './NotificationHelperService.js';

const INVITATION_EXPIRY_DAYS = 7;
const TOKEN_LENGTH = 64;

/**
 * InvitationService - Singleton service for managing project invitations
 * 
 * Key responsibilities:
 * - Create invitations with secure tokens
 * - Validate and accept invitations
 * - Manage invitation lifecycle (pending, accepted, expired, cancelled)
 * - Enforce tier-based member limits
 * - Send notification emails
 */
export class InvitationService {
    private static instance: InvitationService;
    private emailService: EmailService;
    private notificationHelper = NotificationHelperService.getInstance();

    private constructor() {
        this.emailService = EmailService.getInstance();
    }

    public static getInstance(): InvitationService {
        if (!InvitationService.instance) {
            InvitationService.instance = new InvitationService();
        }
        return InvitationService.instance;
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
     * Check if adding a member would exceed project tier limits
     * Uses the project OWNER's tier, not the invitee's tier
     */
    private async checkMemberLimit(projectId: number): Promise<{ allowed: boolean; limit?: number; current: number }> {
        const manager = await this.getManager();
        
        const project = await manager.findOne(DRAProject, {
            where: { id: projectId },
            relations: ['users_platform']
        });

        if (!project) {
            throw new Error('Project not found');
        }

        // Get owner's active subscription
        const userSubscription = await manager.findOne(DRAUserSubscription, {
            where: { 
                users_platform: { id: project.users_platform.id },
                is_active: true
            },
            relations: ['subscription_tier']
        });

        // Count current members + pending invitations
        const currentMemberCount = await manager.count(DRAProjectMember, { where: { project: { id: projectId } } });
        const pendingInvitationCount = await manager.count(DRAProjectInvitation, {
            where: { 
                project: { id: projectId },
                status: 'pending',
                expires_at: MoreThan(new Date())
            }
        });

        const totalCount = currentMemberCount + pendingInvitationCount;

        // Get max members from subscription, default to FREE tier (3 members)
        let maxMembers: number | null = 3;
        if (userSubscription && userSubscription.subscription_tier) {
            maxMembers = userSubscription.subscription_tier.max_members_per_project;
        }

        // null or undefined means unlimited
        if (maxMembers === null || maxMembers === undefined) {
            return { allowed: true, current: totalCount };
        }

        return {
            allowed: totalCount < maxMembers,
            limit: maxMembers,
            current: totalCount
        };
    }

    /**
     * Create a new project invitation
     * - If user exists, add directly to project members
     * - If user doesn't exist, create invitation and send email
     */
    async createInvitation(data: IInvitationCreate): Promise<IInvitationResponse | { addedDirectly: true; userId: number }> {
        const manager = await this.getManager();
        
        // Verify project exists and get owner info
        const project = await manager.findOne(DRAProject, {
            where: { id: data.projectId },
            relations: ['users_platform']
        });

        if (!project) {
            throw new Error('Project not found');
        }

        // Verify inviter is project owner or admin
        const inviter = await manager.findOne(DRAUsersPlatform, { where: { id: data.invitedByUserId } });
        if (!inviter) {
            throw new Error('Inviter not found');
        }

        // Check if inviter has permission (owner or admin member)
        const inviterMember = await manager.findOne(DRAProjectMember, {
            where: { 
                project: { id: data.projectId },
                user: { id: data.invitedByUserId }
            }
        });

        const isOwner = project.users_platform.id === data.invitedByUserId;
        const isAdmin = inviterMember?.role === EProjectRole.ADMIN;

        if (!isOwner && !isAdmin) {
            throw new Error('Only project owner or admins can invite members');
        }

        // Check member limit before proceeding
        const limitCheck = await this.checkMemberLimit(data.projectId);
        if (!limitCheck.allowed) {
            throw new Error(`Member limit reached (${limitCheck.limit}). Upgrade subscription to invite more members.`);
        }

        // Check if user already exists in the platform
        const existingUser = await manager.findOne(DRAUsersPlatform, { where: { email: data.email } });

        if (existingUser) {
            // Check if already a member
            const existingMember = await manager.findOne(DRAProjectMember, {
                where: {
                    project: { id: data.projectId },
                    user: { id: existingUser.id }
                }
            });

            if (existingMember) {
                throw new Error('User is already a member of this project');
            }

            // Add directly to project members
            const newMember = manager.create(DRAProjectMember, {
                project: project,
                user: existingUser,
                role: data.role,
                marketing_role: data.marketing_role ?? 'cmo',
                added_at: new Date()
            });

            await manager.save(newMember);

            // Send notification email
            await this.emailService.sendProjectInvitationToExistingUser({
                email: data.email,
                projectName: project.name,
                inviterName: `${inviter.first_name} ${inviter.last_name}`.trim() || inviter.email,
                role: data.role
            });

            return { addedDirectly: true, userId: existingUser.id };
        }

        // Check for existing pending invitation
        const existingInvitation = await manager.findOne(DRAProjectInvitation, {
            where: {
                project: { id: data.projectId },
                invited_email: data.email,
                status: 'pending',
                expires_at: MoreThan(new Date())
            }
        });

        if (existingInvitation) {
            throw new Error('A pending invitation already exists for this email');
        }

        // Create new invitation with verification code
        const token = this.generateSecureToken();
        const expiresAt = new Date();
        expiresAt.setDate(expiresAt.getDate() + INVITATION_EXPIRY_DAYS);

        // Create verification code first
        const verificationCode = manager.create(DRAVerificationCode, {
            code: token,
            expired_at: expiresAt,
            users_platform: inviter
        });
        await manager.save(verificationCode);

        // Create invitation linked to verification code
        const invitation = manager.create(DRAProjectInvitation, {
            project: project,
            invited_by: inviter,
            invited_email: data.email,
            role: data.role,
            marketing_role: data.marketing_role ?? 'cmo',
            verification_code: verificationCode,
            status: 'pending',
            expires_at: expiresAt
        });

        await manager.save(invitation);

        // Send invitation email to new user
        await this.emailService.sendProjectInvitationToNewUser({
            email: data.email,
            projectName: project.name,
            inviterName: `${inviter.first_name} ${inviter.last_name}`.trim() || inviter.email,
            role: data.role,
            token: token
        });

        return {
            id: invitation.id,
            project_id: project.id,
            project_name: project.name,
            invited_by_name: `${inviter.first_name} ${inviter.last_name}`.trim() || inviter.email,
            invited_email: invitation.invited_email,
            role: invitation.role,
            status: invitation.status,
            invitation_token: verificationCode.code,
            created_at: invitation.created_at,
            expires_at: invitation.expires_at
        };
    }

    /**
     * Accept an invitation using token
     * - Validates token and expiration
     * - Adds user to project members
     * - Marks invitation as accepted
     */
    async acceptInvitation(data: IInvitationAccept): Promise<{ success: boolean; projectId: number; message: string }> {
        const manager = await this.getManager();
        
        // Find verification code first
        const verificationCode = await manager.findOne(DRAVerificationCode, {
            where: { code: data.token }
        });

        if (!verificationCode) {
            throw new Error('Invalid invitation token');
        }

        // Find invitation by verification code
        const invitation = await manager.findOne(DRAProjectInvitation, {
            where: { verification_code: { id: verificationCode.id } },
            relations: ['project', 'invited_by', 'verification_code']
        });

        if (!invitation) {
            throw new Error('Invalid invitation token');
        }

        if (invitation.status !== 'pending') {
            throw new Error(`Invitation is ${invitation.status}`);
        }

        if (invitation.expires_at < new Date()) {
            // Mark as expired
            invitation.status = 'expired';
            await manager.save(invitation);
            throw new Error('Invitation has expired');
        }

        // Verify user exists and email matches
        if (!data.userId) {
            throw new Error('User ID required to accept invitation');
        }

        const user = await manager.findOne(DRAUsersPlatform, { where: { id: data.userId } });
        if (!user) {
            throw new Error('User not found');
        }

        if (user.email !== invitation.invited_email) {
            throw new Error('Email mismatch. This invitation was sent to a different email address.');
        }

        // Check if user is already a member
        const existingMember = await manager.findOne(DRAProjectMember, {
            where: {
                project: { id: invitation.project.id },
                user: { id: user.id }
            }
        });

        if (existingMember) {
            // Mark invitation as accepted anyway
            invitation.status = 'accepted';
            invitation.accepted_at = new Date();
            await manager.save(invitation);
            throw new Error('You are already a member of this project');
        }

        // Add user to project members
        const newMember = manager.create(DRAProjectMember, {
            project: invitation.project,
            user: user,
            role: invitation.role,
            marketing_role: invitation.marketing_role ?? 'cmo',
            added_at: new Date()
        });

        await manager.save(newMember);

        // Mark invitation as accepted
        invitation.status = 'accepted';
        invitation.accepted_at = new Date();
        await manager.save(invitation);

        // Send notification to the inviter
        await this.notificationHelper.notifyInvitationAccepted(
            invitation.invited_by.id,
            invitation.project.id,
            invitation.project.name,
            `${user.first_name} ${user.last_name}`.trim() || user.email
        );

        // Notify the new member they were added
        await this.notificationHelper.notifyProjectMemberAdded(
            user.id,
            invitation.project.id,
            invitation.project.name,
            `${user.first_name} ${user.last_name}`.trim() || user.email,
            invitation.role
        );

        return {
            success: true,
            projectId: invitation.project.id,
            message: `Successfully joined project: ${invitation.project.name}`
        };
    }

    /**
     * Get all invitations for a project (pending, accepted, cancelled)
     */
    async getProjectInvitations(projectId: number, includeExpired: boolean = false): Promise<IInvitationResponse[]> {
        const manager = await this.getManager();
        
        const whereConditions: any = { project: { id: projectId } };
        
        if (!includeExpired) {
            whereConditions.status = 'pending';
            whereConditions.expires_at = MoreThan(new Date());
        }

        const invitations = await manager.find(DRAProjectInvitation, {
            where: whereConditions,
            relations: ['project', 'invited_by', 'verification_code'],
            order: { created_at: 'DESC' }
        });

        return invitations.map(inv => ({
            id: inv.id,
            project_id: inv.project.id,
            project_name: inv.project.name,
            invited_by_name: `${inv.invited_by.first_name} ${inv.invited_by.last_name}`.trim() || inv.invited_by.email,
            invited_email: inv.invited_email,
            role: inv.role,
            status: inv.status,
            invitation_token: inv.verification_code.code,
            created_at: inv.created_at,
            expires_at: inv.expires_at,
            accepted_at: inv.accepted_at
        }));
    }

    /**
     * Get all pending invitations for a user by email
     */
    async getUserPendingInvitations(email: string): Promise<IInvitationResponse[]> {
        const manager = await this.getManager();
        
        const invitations = await manager.find(DRAProjectInvitation, {
            where: {
                invited_email: email,
                status: 'pending',
                expires_at: MoreThan(new Date())
            },
            relations: ['project', 'invited_by', 'verification_code'],
            order: { created_at: 'DESC' }
        });

        return invitations.map(inv => ({
            id: inv.id,
            project_id: inv.project.id,
            project_name: inv.project.name,
            invited_by_name: `${inv.invited_by.first_name} ${inv.invited_by.last_name}`.trim() || inv.invited_by.email,
            invited_email: inv.invited_email,
            role: inv.role,
            status: inv.status,
            invitation_token: inv.verification_code.code,
            created_at: inv.created_at,
            expires_at: inv.expires_at,
            accepted_at: inv.accepted_at
        }));
    }

    /**
     * Cancel an invitation
     * Only project owner or inviter can cancel
     */
    async cancelInvitation(invitationId: number, userId: number): Promise<{ success: boolean; message: string }> {
        const manager = await this.getManager();
        
        const invitation = await manager.findOne(DRAProjectInvitation, {
            where: { id: invitationId },
            relations: ['project', 'project.users_platform', 'invited_by']
        });

        if (!invitation) {
            throw new Error('Invitation not found');
        }

        if (invitation.status !== 'pending') {
            throw new Error(`Cannot cancel invitation with status: ${invitation.status}`);
        }

        // Check if user has permission to cancel
        const isOwner = invitation.project.users_platform.id === userId;
        const isInviter = invitation.invited_by.id === userId;

        if (!isOwner && !isInviter) {
            throw new Error('Only project owner or inviter can cancel this invitation');
        }

        invitation.status = 'cancelled';
        await manager.save(invitation);

        return {
            success: true,
            message: 'Invitation cancelled successfully'
        };
    }

    /**
     * Resend invitation email
     * Generates new token and extends expiration
     */
    async resendInvitation(invitationId: number, userId: number): Promise<{ success: boolean; message: string }> {
        const manager = await this.getManager();
        
        const invitation = await manager.findOne(DRAProjectInvitation, {
            where: { id: invitationId },
            relations: ['project', 'project.users_platform', 'invited_by', 'verification_code']
        });

        if (!invitation) {
            throw new Error('Invitation not found');
        }

        if (invitation.status !== 'pending') {
            throw new Error(`Cannot resend invitation with status: ${invitation.status}`);
        }

        // Check if user has permission
        const isOwner = invitation.project.users_platform.id === userId;
        const isInviter = invitation.invited_by.id === userId;

        if (!isOwner && !isInviter) {
            throw new Error('Only project owner or inviter can resend this invitation');
        }

        // Generate new token and extend expiration
        const newToken = this.generateSecureToken();
        invitation.verification_code.code = newToken;
        invitation.verification_code.expired_at = new Date();
        invitation.verification_code.expired_at.setDate(invitation.verification_code.expired_at.getDate() + INVITATION_EXPIRY_DAYS);
        
        invitation.expires_at = new Date();
        invitation.expires_at.setDate(invitation.expires_at.getDate() + INVITATION_EXPIRY_DAYS);

        await manager.save(invitation.verification_code);
        await manager.save(invitation);

        // Resend email
        await this.emailService.sendProjectInvitationToNewUser({
            email: invitation.invited_email,
            projectName: invitation.project.name,
            inviterName: `${invitation.invited_by.first_name} ${invitation.invited_by.last_name}`.trim() || invitation.invited_by.email,
            role: invitation.role,
            token: newToken
        });

        return {
            success: true,
            message: 'Invitation resent successfully'
        };
    }

    /**
     * Expire old invitations (to be called by cron job)
     * Marks all pending invitations past expiration date as expired
     */
    async expireOldInvitations(): Promise<{ expiredCount: number }> {
        const manager = await this.getManager();
        
        const result = await manager
            .createQueryBuilder(DRAProjectInvitation, 'invitation')
            .update()
            .set({ status: 'expired' })
            .where('status = :status', { status: 'pending' })
            .andWhere('expires_at < :now', { now: new Date() })
            .execute();

        return { expiredCount: result.affected || 0 };
    }

    /**
     * Get invitation by token (for validation before accept)
     */
    async getInvitationByToken(token: string): Promise<IInvitationResponse | null> {
        const manager = await this.getManager();
        
        // Find verification code first
        const verificationCode = await manager.findOne(DRAVerificationCode, {
            where: { code: token }
        });

        if (!verificationCode) {
            return null;
        }

        // Find invitation by verification code
        const invitation = await manager.findOne(DRAProjectInvitation, {
            where: { verification_code: { id: verificationCode.id } },
            relations: ['project', 'invited_by', 'verification_code']
        });

        if (!invitation) {
            return null;
        }

        return {
            id: invitation.id,
            project_id: invitation.project.id,
            project_name: invitation.project.name,
            invited_by_name: `${invitation.invited_by.first_name} ${invitation.invited_by.last_name}`.trim() || invitation.invited_by.email,
            invited_email: invitation.invited_email,
            role: invitation.role,
            status: invitation.status,
            invitation_token: verificationCode.code,
            created_at: invitation.created_at,
            expires_at: invitation.expires_at,
            accepted_at: invitation.accepted_at
        };
    }
}
