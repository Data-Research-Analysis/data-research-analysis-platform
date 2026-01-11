import { MailDriver } from '../drivers/MailDriver.js';
import { UtilityService } from './UtilityService.js';
import { TemplateEngineService } from './TemplateEngineService.js';

interface SendMailResult {
    messageId: string;
    accepted: string[];
    rejected: string[];
    response: string;
}

/**
 * Email Service - Business Logic Layer for Application Emails
 * 
 * Singleton service that handles all application-specific email sending.
 * Provides high-level methods for user authentication flows, invitations,
 * and notifications with pre-defined templates.
 * 
 * Architecture:
 * - EmailService (this) → MailDriver → NodeMailerDriver → Nodemailer
 * - Separates business logic from transport layer
 * - Centralizes email template management
 * - Easy to extend with new email types
 * 
 * Usage:
 *   await EmailService.getInstance().sendVerificationEmail(email, token);
 *   await EmailService.getInstance().sendProjectInvitation(email, projectName, role, token);
 */
export class EmailService {
    private static instance: EmailService;
    private mailDriver: MailDriver;

    private constructor() {
        this.mailDriver = MailDriver.getInstance();
    }

    public static getInstance(): EmailService {
        if (!EmailService.instance) {
            EmailService.instance = new EmailService();
        }
        return EmailService.instance;
    }

    /**
     * Send email verification email
     * 
     * Sent when new users register to verify their email address.
     * Link expires in 24 hours.
     * 
     * @param email - Recipient email address
     * @param token - Verification token for URL
     * @returns Send result with message ID
     */
    public async sendVerificationEmail(email: string, token: string): Promise<SendMailResult> {
        const verificationUrl = `${UtilityService.getInstance().getConstants('FRONTEND_URL')}/verify-email?token=${token}`;
        
        const html = await TemplateEngineService.getInstance().render('email-verification-simple.html', [
            { key: 'verification_url', value: verificationUrl }
        ]);

        const text = `Thank you for registering with Data Research Analysis Platform.

Please verify your email address by clicking the following link:
${verificationUrl}

This link will expire in 24 hours.

If you did not create an account, please ignore this email.`;

        return this.mailDriver.sendMail({
            to: email,
            subject: 'Verify Your Email Address',
            text,
            html
        });
    }

    /**
     * Send password reset email
     * 
     * Sent when user requests password reset.
     * Link expires in 1 hour.
     * 
     * @param email - Recipient email address
     * @param token - Password reset token for URL
     * @returns Send result with message ID
     */
    public async sendPasswordResetEmail(email: string, token: string): Promise<SendMailResult> {
        const resetUrl = `${UtilityService.getInstance().getConstants('FRONTEND_URL')}/reset-password?token=${token}`;
        
        const html = await TemplateEngineService.getInstance().render('password-reset-simple.html', [
            { key: 'reset_url', value: resetUrl }
        ]);

        const text = `We received a request to reset your password for your Data Research Analysis Platform account.

Click the following link to reset your password:
${resetUrl}

This link will expire in 1 hour.

If you did not request a password reset, please ignore this email.`;

        return this.mailDriver.sendMail({
            to: email,
            subject: 'Password Reset Request',
            text,
            html
        });
    }

    /**
     * Send beta invitation email
     * 
     * Sent to users invited to the beta program.
     * Includes exclusive invitation code.
     * 
     * @param email - Recipient email address
     * @param invitationCode - Beta invitation code
     * @returns Send result with message ID
     */
    public async sendBetaInvitation(email: string, invitationCode: string): Promise<SendMailResult> {
        const signupUrl = `${UtilityService.getInstance().getConstants('FRONTEND_URL')}/register?code=${invitationCode}`;
        
        const html = await TemplateEngineService.getInstance().render('beta-invitation.html', [
            { key: 'invitation_code', value: invitationCode },
            { key: 'signup_url', value: signupUrl }
        ]);

        const text = `Welcome to Data Research Analysis Beta!

You've been invited to join our exclusive beta program.

Your invitation code: ${invitationCode}

Sign up now: ${signupUrl}

This is your chance to be among the first to experience our platform.`;

        return this.mailDriver.sendMail({
            to: email,
            subject: 'Welcome to Data Research Analysis Beta!',
            text,
            html
        });
    }

    /**
     * Send project invitation email (RBAC)
     * 
     * Sent when a user is invited to collaborate on a project.
     * Includes project details, role assignment, and acceptance link.
     * 
     * @param email - Recipient email address
     * @param projectName - Name of the project
     * @param inviterName - Name of user sending invitation
     * @param role - Role being assigned (viewer, editor, admin)
     * @param token - Invitation acceptance token
     * @returns Send result with message ID
     */
    public async sendProjectInvitation(
        email: string,
        projectName: string,
        inviterName: string,
        role: string,
        token: string
    ): Promise<SendMailResult> {
        const acceptUrl = `${UtilityService.getInstance().getConstants('FRONTEND_URL')}/accept-invitation?token=${token}`;
        
        const roleDescriptions: Record<string, string> = {
            viewer: 'View project data, dashboards, and reports (read-only access)',
            editor: 'View and modify data models, create dashboards, and manage project content',
            admin: 'Full project control including user management, settings, and deletion'
        };

        const html = await TemplateEngineService.getInstance().render('project-invitation.html', [
            { key: 'inviter_name', value: inviterName },
            { key: 'project_name', value: projectName },
            { key: 'role', value: role },
            { key: 'role_description', value: roleDescriptions[role.toLowerCase()] || 'Collaborate on this project' },
            { key: 'accept_url', value: acceptUrl }
        ]);

        const text = `${inviterName} has invited you to collaborate on "${projectName}"

Role: ${role.toUpperCase()}
${roleDescriptions[role.toLowerCase()] || 'Collaborate on this project'}

Accept invitation: ${acceptUrl}

This invitation will expire in 7 days.

If you did not expect this invitation, please ignore this email.`;

        return this.mailDriver.sendMail({
            to: email,
            subject: `You've been invited to collaborate on "${projectName}"`,
            text,
            html
        });
    }

    /**
     * Send email verification (legacy template with unsubscribe)
     * 
     * Uses the existing verify-email.html template with name, verification code,
     * and unsubscribe code. For new implementations, use sendVerificationEmail().
     * 
     * @param email - Recipient email address
     * @param name - User's full name
     * @param emailVerificationCode - Verification code for URL
     * @param unsubscribeCode - Unsubscribe code for URL
     * @returns Send result with message ID
     */
    public async sendEmailVerificationWithUnsubscribe(
        email: string,
        name: string,
        emailVerificationCode: string,
        unsubscribeCode: string
    ): Promise<SendMailResult> {
        const html = await TemplateEngineService.getInstance().render('verify-email.html', [
            { key: 'name', value: name },
            { key: 'email_verification_code', value: emailVerificationCode },
            { key: 'unsubscribe_code', value: unsubscribeCode }
        ]);

        const text = `Hi ${name}

Thank you for choosing Data Research Analysis for your data analysis needs. To verify your email address, please copy and paste this link into your browser: https://www.dataresearchanalysis.com/verify-email/${emailVerificationCode}

If you have any questions or need assistance, please don't hesitate to contact us at hello@dataresearchanalysis.com

Please note that the code will expire in 3 days from the receipt of this email if you do not verify your email address.`;

        return this.mailDriver.sendMail({
            to: email,
            subject: 'Welcome to Data Research Analysis',
            text,
            html
        });
    }

    /**
     * Send password change request (legacy template with unsubscribe)
     * 
     * Uses the existing password-change-request.html template with name,
     * password change code, and unsubscribe code.
     * 
     * @param email - Recipient email address
     * @param name - User's full name
     * @param passwordChangeRequestCode - Password reset code for URL
     * @param unsubscribeCode - Unsubscribe code for URL
     * @returns Send result with message ID
     */
    public async sendPasswordChangeRequestWithUnsubscribe(
        email: string,
        name: string,
        passwordChangeRequestCode: string,
        unsubscribeCode: string
    ): Promise<SendMailResult> {
        const html = await TemplateEngineService.getInstance().render('password-change-request.html', [
            { key: 'name', value: name },
            { key: 'password_change_request_code', value: passwordChangeRequestCode },
            { key: 'unsubscribe_code', value: unsubscribeCode }
        ]);

        const text = `Hi ${name}

Thank you for choosing Data Research Analysis for your data analysis needs. To change your password, please copy and paste this link into your browser: https://www.dataresearchanalysis.com/forgot-password/${passwordChangeRequestCode}

If you have any questions or need assistance, please don't hesitate to contact us at hello@dataresearchanalysis.com

Please note that the code will expire in 3 days from the receipt of this email if you do not verify your email address.`;

        return this.mailDriver.sendMail({
            to: email,
            subject: 'Password Change Request @ Data Research Analysis',
            text,
            html
        });
    }

    /**
     * Send welcome email for beta user conversion
     * 
     * Uses the existing welcome-beta-users-email.html template with name,
     * email, password, and unsubscribe code.
     * 
     * @param email - Recipient email address
     * @param name - User's full name
     * @param password - User's temporary password
     * @param unsubscribeCode - Unsubscribe code for URL
     * @returns Send result with message ID
     */
    public async sendWelcomeBetaUserEmail(
        email: string,
        name: string,
        password: string,
        unsubscribeCode: string
    ): Promise<SendMailResult> {
        const html = await TemplateEngineService.getInstance().render('welcome-beta-users-email.html', [
            { key: 'name', value: name },
            { key: 'email', value: email },
            { key: 'password', value: password },
            { key: 'unsubscribe_code', value: unsubscribeCode }
        ]);

        const text = `Hi ${name}

Welcome to Data Research Analysis!

Your account is ready to use with your registered email address: ${email}

Log in with your registered email: ${email} and password: ${password}

We're excited to have you on board!`;

        return this.mailDriver.sendMail({
            to: email,
            subject: 'Welcome to Data Research Analysis',
            text,
            html
        });
    }
}
