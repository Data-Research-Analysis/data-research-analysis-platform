import { Queue, Worker } from 'bullmq';
import { MailDriver } from '../drivers/MailDriver.js';
import { UtilityService } from './UtilityService.js';
import { TemplateEngineService } from './TemplateEngineService.js';
import { convert } from 'html-to-text';

interface SendMailResult {
    messageId: string;
    accepted: string[];
    rejected: string[];
    response: string;
}

export interface IEmailOptions {
    to: string | string[];
    subject: string;
    template?: string;
    templateData?: Record<string, any>;
    html?: string;
    text?: string;
    cc?: string | string[];
    bcc?: string | string[];
    attachments?: Array<{
        filename: string;
        content: Buffer | string;
    }>;
}

/**
 * Email Service - Business Logic Layer for Application Emails
 * 
 * Singleton service that handles all application-specific email sending.
 * Combines high-level business methods with queue-based infrastructure for reliability.
 * 
 * Architecture:
 * - EmailService (this) → BullMQ Queue → Worker → MailDriver → NodeMailerDriver
 * - Queued sending with retry logic (3 attempts, exponential backoff)
 * - Rate limiting: 10 emails per second
 * - Separates business logic from transport layer
 * - Centralizes email template management
 * 
 * Usage:
 *   await EmailService.getInstance().sendVerificationEmail(email, token);
 *   await EmailService.getInstance().sendProjectInvitationToNewUser({...});
 */
export class EmailService {
    private static instance: EmailService;
    private mailDriver: MailDriver;
    private emailQueue: Queue;
    private worker: Worker;

    private constructor() {
        this.mailDriver = MailDriver.getInstance();
        
        // Initialize email queue with Redis
        const redisConnection = {
            host: process.env.REDIS_HOST || 'localhost',
            port: parseInt(process.env.REDIS_PORT || '6379'),
            password: process.env.REDIS_PASSWORD || undefined,
        };
        
        this.emailQueue = new Queue('emails', { 
            connection: redisConnection,
            prefix: 'dra:email'
        });
        
        // Initialize worker to process email jobs
        this.worker = new Worker(
            'emails',
            async (job) => {
                return await this.sendEmailImmediately(job.data);
            },
            {
                connection: redisConnection,
                prefix: 'dra:email',
                limiter: {
                    max: 10,
                    duration: 1000
                }
            }
        );
        
        this.worker.on('failed', (job, err) => {
            console.error(`[EmailService] Job ${job?.id} failed:`, err);
        });
        
        this.worker.on('completed', (job) => {
            console.log(`[EmailService] Job ${job?.id} completed successfully`);
        });
    }

    public static getInstance(): EmailService {
        if (!EmailService.instance) {
            EmailService.instance = new EmailService();
        }
        return EmailService.instance;
    }

    /**
     * Queue email for sending (recommended for bulk operations)
     */
    async sendEmail(options: IEmailOptions): Promise<void> {
        await this.emailQueue.add('send-email', options, {
            attempts: 3,
            backoff: {
                type: 'exponential',
                delay: 2000
            },
            removeOnComplete: true,
            removeOnFail: false
        });
    }

    /**
     * Send email immediately (use for critical notifications)
     */
    async sendEmailImmediately(options: IEmailOptions): Promise<void> {
        try {
            let htmlContent = options.html;
            let textContent = options.text;
            
            // If template is specified, render it
            if (options.template && options.templateData) {
                const templateData = options.templateData;
                
                // Build replacement array for TemplateEngineService
                const replacements: Array<{ key: string; value: string }> = [];
                
                for (const [key, value] of Object.entries(templateData)) {
                    let stringValue = '';
                    
                    if (value === null || value === undefined) {
                        stringValue = '';
                    } else if (value instanceof Date) {
                        stringValue = new Intl.DateTimeFormat('en-US', {
                            year: 'numeric',
                            month: 'long',
                            day: 'numeric'
                        }).format(value);
                    } else if (typeof value === 'number') {
                        stringValue = value.toString();
                    } else {
                        stringValue = String(value);
                    }
                    
                    replacements.push({ key, value: stringValue });
                }
                
                // Add default template variables
                const frontendUrl = UtilityService.getInstance().getConstants('FRONTEND_URL') || 'http://localhost:3000';
                const supportEmail = process.env.SUPPORT_EMAIL || 'support@dataresearchanalysis.com';
                
                replacements.push(
                    { key: 'year', value: new Date().getFullYear().toString() },
                    { key: 'dashboardUrl', value: `${frontendUrl}/dashboard` },
                    { key: 'supportEmail', value: supportEmail },
                    { key: 'unsubscribeUrl', value: `${frontendUrl}/settings/notifications` }
                );
                
                // Render template
                htmlContent = await TemplateEngineService.getInstance().render(
                    `emails/${options.template}.html`,
                    replacements
                );
                
                // Generate plain text version from HTML using a robust converter
                textContent = convert(htmlContent || '', {
                    wordwrap: false,
                    selectors: [
                        { selector: 'script', format: 'skip' },
                        { selector: 'style', format: 'skip' }
                    ]
                }).trim();
            }
            
            // Send via MailDriver
            await this.mailDriver.sendMail({
                to: Array.isArray(options.to) ? options.to[0] : options.to,
                subject: options.subject,
                text: textContent || '',
                html: htmlContent || ''
            });
            
            console.log(`[EmailService] Email sent to ${options.to}`);
        } catch (error: any) {
            console.error('[EmailService] Failed to send email:', error);
            throw error;
        }
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
     * Send project invitation to NEW user (RBAC)
     * 
     * Sent when a non-registered user is invited to collaborate on a project.
     * User must accept invitation via token link.
     * 
     * @param data - Invitation details (email, projectName, inviterName, role, token)
     * @returns Send result with message ID
     */
    public async sendProjectInvitationToNewUser(data: {
        email: string;
        projectName: string;
        inviterName: string;
        role: string;
        token: string;
    }): Promise<SendMailResult> {
        const acceptUrl = `${UtilityService.getInstance().getConstants('FRONTEND_URL')}/invitations/accept/${data.token}`;
        
        const roleDescriptions: Record<string, string> = {
            viewer: 'View project data, dashboards, and reports (read-only access)',
            editor: 'View and modify data models, create dashboards, and manage project content',
            admin: 'Full project control including user management, settings, and deletion'
        };

        const html = await TemplateEngineService.getInstance().render('project-invitation.html', [
            { key: 'inviter_name', value: data.inviterName },
            { key: 'project_name', value: data.projectName },
            { key: 'role', value: data.role },
            { key: 'role_description', value: roleDescriptions[data.role.toLowerCase()] || 'Collaborate on this project' },
            { key: 'accept_url', value: acceptUrl }
        ]);

        const text = `${data.inviterName} has invited you to collaborate on "${data.projectName}"

Role: ${data.role.toUpperCase()}
${roleDescriptions[data.role.toLowerCase()] || 'Collaborate on this project'}

Accept invitation: ${acceptUrl}

This invitation will expire in 7 days.

If you did not expect this invitation, please ignore this email.`;

        return this.mailDriver.sendMail({
            to: data.email,
            subject: `You've been invited to collaborate on "${data.projectName}"`,
            text,
            html
        });
    }

    /**
     * Send project invitation to EXISTING user (RBAC)
     * 
     * Sent when a registered user is added directly to a project.
     * No acceptance needed - they're already a member.
     * 
     * @param data - Invitation details (email, projectName, inviterName, role)
     * @returns Send result with message ID
     */
    public async sendProjectInvitationToExistingUser(data: {
        email: string;
        projectName: string;
        inviterName: string;
        role: string;
    }): Promise<SendMailResult> {
        const projectUrl = `${UtilityService.getInstance().getConstants('FRONTEND_URL')}/projects`;
        
        const roleDescriptions: Record<string, string> = {
            viewer: 'View project data, dashboards, and reports (read-only access)',
            editor: 'View and modify data models, create dashboards, and manage project content',
            admin: 'Full project control including user management, settings, and deletion'
        };

        const html = await TemplateEngineService.getInstance().render('project-invitation-existing.html', [
            { key: 'inviter_name', value: data.inviterName },
            { key: 'project_name', value: data.projectName },
            { key: 'role', value: data.role },
            { key: 'role_description', value: roleDescriptions[data.role.toLowerCase()] || 'Collaborate on this project' },
            { key: 'project_url', value: projectUrl }
        ]);

        const text = `${data.inviterName} has added you to "${data.projectName}"

Role: ${data.role.toUpperCase()}
${roleDescriptions[data.role.toLowerCase()] || 'Collaborate on this project'}

View your projects: ${projectUrl}

You can start collaborating immediately!`;

        return this.mailDriver.sendMail({
            to: data.email,
            subject: `You've been added to "${data.projectName}"`,
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

    /**
     * Send account cancellation requested email
     * 
     * Sent when user initiates account cancellation.
     * Includes retention period, deletion date, and reactivation instructions.
     * 
     * @param email - User email address
     * @param userName - User full name
     * @param effectiveDate - Date when cancellation becomes effective
     * @param deletionDate - Date when data will be permanently deleted
     * @param retentionDays - Number of days data is retained
     * @returns Send result with message ID
     */
    public async sendAccountCancellationRequested(
        email: string,
        userName: string,
        effectiveDate: Date,
        deletionDate: Date,
        retentionDays: number
    ): Promise<SendMailResult> {
        const frontendUrl = UtilityService.getInstance().getConstants('FRONTEND_URL') || 'http://localhost:3000';
        const dashboardUrl = `${frontendUrl}/dashboard`;
        const reactivateUrl = `${frontendUrl}/account/cancel-account?action=reactivate`;
        
        const html = await TemplateEngineService.getInstance().render('account-cancellation-requested.html', [
            { key: 'user_name', value: userName },
            { key: 'effective_date', value: new Intl.DateTimeFormat('en-US', { year: 'numeric', month: 'long', day: 'numeric' }).format(effectiveDate) },
            { key: 'deletion_date', value: new Intl.DateTimeFormat('en-US', { year: 'numeric', month: 'long', day: 'numeric' }).format(deletionDate) },
            { key: 'retention_days', value: retentionDays.toString() },
            { key: 'dashboard_url', value: dashboardUrl },
            { key: 'reactivate_url', value: reactivateUrl }
        ]);

        const text = `Account Cancellation Requested

Hello ${userName},

We've received your request to cancel your Data Research Analysis account.

Important Dates:
- Effective Date: ${effectiveDate.toLocaleDateString()}
- Data Retention Until: ${deletionDate.toLocaleDateString()}
- Days Until Deletion: ${retentionDays} days

What happens next:
• Your account will remain active until ${effectiveDate.toLocaleDateString()}
• After that, we'll retain your data for ${retentionDays} days
• You can reactivate your account anytime before ${deletionDate.toLocaleDateString()}
• We'll send you reminders at 7 days and 1 day before permanent deletion
• On ${deletionDate.toLocaleDateString()}, all your data will be permanently deleted

Don't forget to export your data: ${dashboardUrl}
Reactivate your account: ${reactivateUrl}

If you have any questions, please contact our support team.`;

        return this.mailDriver.sendMail({
            to: email,
            subject: 'Account Cancellation Requested - Data Research Analysis',
            text,
            html
        });
    }

    /**
     * Send 7-day deletion reminder email
     * 
     * Sent 7 days before permanent deletion.
     * Urgent reminder to export data or reactivate account.
     * 
     * @param email - User email address
     * @param userName - User full name
     * @param deletionDate - Date when data will be permanently deleted
     * @returns Send result with message ID
     */
    public async sendAccountCancellationReminder7Days(
        email: string,
        userName: string,
        deletionDate: Date
    ): Promise<SendMailResult> {
        const frontendUrl = UtilityService.getInstance().getConstants('FRONTEND_URL') || 'http://localhost:3000';
        const dashboardUrl = `${frontendUrl}/dashboard`;
        const reactivateUrl = `${frontendUrl}/account/cancel-account?action=reactivate`;
        
        const html = await TemplateEngineService.getInstance().render('account-cancellation-reminder-7days.html', [
            { key: 'user_name', value: userName },
            { key: 'deletion_date', value: new Intl.DateTimeFormat('en-US', { year: 'numeric', month: 'long', day: 'numeric' }).format(deletionDate) },
            { key: 'dashboard_url', value: dashboardUrl },
            { key: 'reactivate_url', value: reactivateUrl }
        ]);

        const text = `⚠️ 7 DAYS UNTIL ACCOUNT DELETION

Hello ${userName},

This is a reminder that your Data Research Analysis account and all associated data will be permanently deleted in 7 days.

Deletion Date: ${deletionDate.toLocaleDateString()}

What will be deleted:
• All projects and data sources
• All data models and queries
• All dashboards and visualizations
• All uploaded files (CSV, Excel, PDF)
• All dashboard exports
• OAuth connections to Google services

TAKE ACTION NOW:
• Reactivate your account: ${reactivateUrl}
• Export your data: ${dashboardUrl}

⚠️ This action is irreversible. Once your data is deleted, it cannot be recovered.

If you did not request this cancellation, please contact support immediately.`;

        return this.mailDriver.sendMail({
            to: email,
            subject: '⚠️ 7 Days Until Account Deletion - Data Research Analysis',
            text,
            html
        });
    }

    /**
     * Send 1-day final deletion warning email
     * 
     * Sent 1 day before permanent deletion.
     * Final urgent warning with data counts.
     * 
     * @param email - User email address
     * @param userName - User full name
     * @param deletionDate - Date when data will be permanently deleted
     * @param dataCounts - Object with counts of projects, data sources, etc.
     * @returns Send result with message ID
     */
    public async sendAccountCancellationReminder1Day(
        email: string,
        userName: string,
        deletionDate: Date,
        dataCounts: {
            projectCount: number;
            dataSourceCount: number;
            dataModelCount: number;
            dashboardCount: number;
        }
    ): Promise<SendMailResult> {
        const frontendUrl = UtilityService.getInstance().getConstants('FRONTEND_URL') || 'http://localhost:3000';
        const dashboardUrl = `${frontendUrl}/dashboard`;
        const reactivateUrl = `${frontendUrl}/account/cancel-account?action=reactivate`;
        const supportUrl = `${frontendUrl}/support`;
        
        const html = await TemplateEngineService.getInstance().render('account-cancellation-reminder-1day.html', [
            { key: 'user_name', value: userName },
            { key: 'deletion_date', value: new Intl.DateTimeFormat('en-US', { year: 'numeric', month: 'long', day: 'numeric', hour: 'numeric', minute: 'numeric' }).format(deletionDate) },
            { key: 'dashboard_url', value: dashboardUrl },
            { key: 'reactivate_url', value: reactivateUrl },
            { key: 'support_url', value: supportUrl },
            { key: 'project_count', value: dataCounts.projectCount.toString() },
            { key: 'data_source_count', value: dataCounts.dataSourceCount.toString() },
            { key: 'data_model_count', value: dataCounts.dataModelCount.toString() },
            { key: 'dashboard_count', value: dataCounts.dashboardCount.toString() }
        ]);

        const text = `🚨 FINAL WARNING: ACCOUNT DELETION TOMORROW

Hello ${userName},

This is your FINAL WARNING. Your Data Research Analysis account will be permanently deleted TOMORROW.

DELETION DATE: ${deletionDate.toLocaleDateString()} at ${deletionDate.toLocaleTimeString()}

Less than 24 hours remaining!

After deletion, the following cannot be recovered:
❌ All ${dataCounts.projectCount} projects
❌ All ${dataCounts.dataSourceCount} data sources
❌ All ${dataCounts.dataModelCount} data models
❌ All ${dataCounts.dashboardCount} dashboards
❌ All uploaded files
❌ All OAuth connections

LAST CHANCE - TAKE ACTION NOW:
✓ REACTIVATE YOUR ACCOUNT: ${reactivateUrl}
📦 Export Data: ${dashboardUrl}
💬 Contact Support: ${supportUrl}

🛑 LAST CHANCE TO SAVE YOUR DATA
This is your last opportunity to reactivate your account or export your data. No recovery will be possible after deletion.

Need help? Contact our support team immediately.`;

        return this.mailDriver.sendMail({
            to: email,
            subject: '🚨 URGENT: Account Deletion Tomorrow - Data Research Analysis',
            text,
            html
        });
    }

    /**
     * Send account reactivated confirmation email
     * 
     * Sent when user successfully reactivates their account.
     * Confirms all data has been preserved.
     * 
     * @param email - User email address
     * @param userName - User full name
     * @returns Send result with message ID
     */
    public async sendAccountReactivated(
        email: string,
        userName: string
    ): Promise<SendMailResult> {
        const frontendUrl = UtilityService.getInstance().getConstants('FRONTEND_URL') || 'http://localhost:3000';
        const dashboardUrl = `${frontendUrl}/dashboard`;
        
        const html = await TemplateEngineService.getInstance().render('account-reactivated.html', [
            { key: 'user_name', value: userName },
            { key: 'dashboard_url', value: dashboardUrl }
        ]);

        const text = `🎉 Welcome Back!

Hello ${userName},

Great news! Your Data Research Analysis account has been successfully reactivated. We're thrilled to have you back!

✓ Your account is now active

All your projects, data sources, data models, and dashboards have been preserved and are ready to use.

What's been restored:
✓ All your projects and data sources
✓ All data models and queries
✓ All dashboards and visualizations
✓ All uploaded files
✓ Your subscription and settings

Go to Dashboard: ${dashboardUrl}

We'd love your feedback - What made you come back?

Thank you for choosing Data Research Analysis. We're committed to providing you with the best analytics experience.`;

        return this.mailDriver.sendMail({
            to: email,
            subject: '🎉 Welcome Back - Account Reactivated Successfully',
            text,
            html
        });
    }

    /**
     * Send account data deleted confirmation email
     * 
     * Sent after all user data has been permanently deleted.
     * Final confirmation of deletion.
     * 
     * @param email - User email address
     * @param userName - User full name
     * @param deletionDate - Date when deletion was completed
     * @returns Send result with message ID
     */
    public async sendAccountDataDeleted(
        email: string,
        userName: string,
        deletionDate: Date
    ): Promise<SendMailResult> {
        const frontendUrl = UtilityService.getInstance().getConstants('FRONTEND_URL') || 'http://localhost:3000';
        const signupUrl = `${frontendUrl}/register`;
        
        const html = await TemplateEngineService.getInstance().render('account-data-deleted.html', [
            { key: 'user_name', value: userName },
            { key: 'deletion_date', value: new Intl.DateTimeFormat('en-US', { year: 'numeric', month: 'long', day: 'numeric' }).format(deletionDate) },
            { key: 'signup_url', value: signupUrl }
        ]);

        const text = `Account Data Deleted

Hello ${userName},

As requested, all data associated with your Data Research Analysis account has been permanently deleted from our servers.

Deletion completed on: ${deletionDate.toLocaleDateString()}

What was deleted:
• All projects and associated data sources
• All data models and queries
• All dashboards and visualizations
• All uploaded files (CSV, Excel, PDF)
• All dashboard exports
• All OAuth connections to external services

Want to start fresh?
You're always welcome to create a new account and experience our platform again. All new users start with a FREE tier with no credit card required.

Create New Account: ${signupUrl}

Thank you for being part of Data Research Analysis. We appreciate your past business and wish you all the best in your future endeavors.

If you believe this was done in error, please contact our support team immediately.`;

        return this.mailDriver.sendMail({
            to: email,
            subject: 'Account Data Deleted - Data Research Analysis',
            text,
            html
        });
    }

    /**
     * Close email service and cleanup resources
     */
    async close(): Promise<void> {
        await this.worker.close();
        await this.emailQueue.close();
        console.log('[EmailService] Service closed');
    }
}
