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
    private failedEmailQueue: Array<{emailOptions: IEmailOptions, retryAt: Date}> = [];
    private queueProcessor: NodeJS.Timeout | null = null;
    private lastEmailTime = 0;
    private emailCount = 0;
    private readonly MAX_EMAILS_PER_SECOND: number;
    private readonly EMAIL_RATE_LIMIT_DURATION: number;

    private constructor() {
        // Initialize rate limit configuration from environment variables
        // Default: 1 email per 1000ms (1 second) - conservative for Mailtrap free tier
        this.MAX_EMAILS_PER_SECOND = parseInt(process.env.EMAIL_RATE_LIMIT_MAX || '1');
        this.EMAIL_RATE_LIMIT_DURATION = parseInt(process.env.EMAIL_RATE_LIMIT_DURATION || '1000');
        
        this.mailDriver = MailDriver.getInstance();
        // Check if email sending is disabled
        if (process.env.EMAIL_ENABLED === 'false') {
            console.log('⚠️ Email sending is DISABLED (EMAIL_ENABLED=false)');
            // Create dummy queue and worker that don't process anything
            const redisConnection = {
                host: process.env.REDIS_HOST || 'localhost',
                port: parseInt(process.env.REDIS_PORT || '6379'),
                password: process.env.REDIS_PASSWORD || undefined,
            };
            this.emailQueue = new Queue('emails', { 
                connection: redisConnection,
                prefix: 'dra:email'
            });
            this.worker = null as any;
            return;
        }
        
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
        
        // Initialize worker to process email jobs with configurable rate limiting
        // Configured via EMAIL_RATE_LIMIT_MAX and EMAIL_RATE_LIMIT_DURATION env variables
        this.worker = new Worker(
            'emails',
            async (job) => {
                // Add delay between emails to respect rate limits
                const timeSinceLastEmail = Date.now() - this.lastEmailTime;
                const minDelay = this.EMAIL_RATE_LIMIT_DURATION / this.MAX_EMAILS_PER_SECOND;
                
                if (timeSinceLastEmail < minDelay) {
                    await this.sleep(minDelay - timeSinceLastEmail);
                }
                
                try {
                    const result = await this.sendEmailImmediately(job.data);
                    this.lastEmailTime = Date.now();
                    return result;
                } catch (error: any) {
                    // If it's a rate limit error, add extra delay before retry
                    if (this.isRateLimitError(error)) {
                        console.warn(`⚠️ Rate limit hit, waiting 5 seconds before retry...`);
                        await this.sleep(5000);
                    }
                    throw error;
                }
            },
            {
                connection: redisConnection,
                prefix: 'dra:email',
                limiter: {
                    max: this.MAX_EMAILS_PER_SECOND,
                    duration: this.EMAIL_RATE_LIMIT_DURATION
                },
                settings: {
                    backoffStrategy: async (attemptsMade: number) => {
                        // Exponential backoff: 2s, 4s, 8s
                        return Math.pow(2, attemptsMade) * 1000;
                    }
                }
            }
        );
        
        this.worker.on('failed', (job, err) => {
            if (this.isRateLimitError(err)) {
                console.error(`[EmailService] ⚠️ Rate limit error for job ${job?.id} - will retry with backoff`);
            } else {
                console.error(`[EmailService] Job ${job?.id} failed:`, err.message || err);
            }
        });
        
        this.worker.on('completed', (job) => {
            console.log(`[EmailService] ✅ Email sent successfully (job ${job?.id})`);
        });
        
        console.log(`✅ EmailService initialized with rate limit: ${this.MAX_EMAILS_PER_SECOND} emails per ${this.EMAIL_RATE_LIMIT_DURATION}ms`);
    }

    public static getInstance(): EmailService {
        if (!EmailService.instance) {
            EmailService.instance = new EmailService();
        }
        return EmailService.instance;
    }

    /**
     * Reset the singleton instance (for testing purposes only)
     * WARNING: This should only be called in test environments
     */
    public static resetInstance(): void {
        if (process.env.NODE_ENV !== 'test') {
            console.warn('[EmailService] resetInstance should only be called in test environment');
        }
        EmailService.instance = null as any;
    }

    /**
     * Check if error is a rate limit error
     * @private
     */
    private isRateLimitError(error: any): boolean {
        return (
            error.code === 'EENVELOPE' && 
            error.responseCode === 550 && 
            error.response?.includes('Too many emails per second')
        ) || (
            error.response?.includes('rate limit') ||
            error.response?.includes('Rate limit')
        );
    }

    /**
     * Check if error is temporary/retriable
     * @private
     */
    private isTemporaryError(error: any): boolean {
        const tempCodes = ['ECONNECTION', 'ETIMEDOUT', 'ENOTFOUND', 'ECONNRESET'];
        const tempResponseCodes = [421, 450, 451, 452];
        
        return (
            tempCodes.includes(error.code) || 
            tempResponseCodes.includes(error.responseCode)
        );
    }

    /**
     * Sleep helper for retry delays
     * @private
     */
    private sleep(ms: number): Promise<void> {
        return new Promise(resolve => setTimeout(resolve, ms));
    }

    /**
     * Sanitize user-controlled strings for use in email subjects
     * Prevents format string injection and other email header vulnerabilities
     * 
     * @param input - User-controlled string to sanitize
     * @param maxLength - Maximum allowed length (default: 100)
     * @returns Sanitized string safe for email subjects
     * @private
     */
    private sanitizeForSubject(input: string, maxLength: number = 100): string {
        if (!input || typeof input !== 'string') {
            return '';
        }
        
        // Remove control characters, newlines, and potential header injection chars
        let sanitized = input
            .replace(/[\r\n\t\x00-\x1F\x7F]/g, '') // Control chars
            .replace(/[<>]/g, '') // Angle brackets (potential for header injection)
            .trim();
        
        // Truncate to max length
        if (sanitized.length > maxLength) {
            sanitized = sanitized.substring(0, maxLength) + '...';
        }
        
        return sanitized;
    }

    /**
     * Enforce rate limiting before sending emails
     * @private
     */
    private async enforceRateLimit(): Promise<void> {
        const now = Date.now();
        const timeSinceLastEmail = now - this.lastEmailTime;
        
        if (timeSinceLastEmail < this.EMAIL_RATE_LIMIT_DURATION) {
            this.emailCount++;
            if (this.emailCount >= this.MAX_EMAILS_PER_SECOND) {
                const sleepTime = this.EMAIL_RATE_LIMIT_DURATION - timeSinceLastEmail;
                console.log(`[EmailService] Rate limiting: sleeping ${sleepTime}ms`);
                await this.sleep(sleepTime);
                this.emailCount = 0;
            }
        } else {
            this.emailCount = 1;
        }
        
        this.lastEmailTime = Date.now();
    }

    /**
     * Queue failed email for later retry
     * @private
     */
    private async queueEmailForLater(emailOptions: IEmailOptions): Promise<void> {
        const retryAt = new Date(Date.now() + 60000); // Retry in 1 minute
        this.failedEmailQueue.push({ emailOptions, retryAt });
        
        console.log(`[EmailService] Email queued for retry at ${retryAt.toISOString()}`);
        
        if (!this.queueProcessor) {
            this.startQueueProcessor();
        }
    }

    /**
     * Start processing failed email queue
     * @private
     */
    private startQueueProcessor(): void {
        this.queueProcessor = setInterval(async () => {
            if (this.failedEmailQueue.length === 0) {
                return;
            }
            
            const now = new Date();
            const readyEmails = this.failedEmailQueue.filter(item => item.retryAt <= now);
            
            if (readyEmails.length === 0) {
                return;
            }
            
            console.log(`[EmailService] Processing ${readyEmails.length} queued emails`);
            
            for (const item of readyEmails) {
                try {
                    await this.sendWithRetry(item.emailOptions, 1);
                    this.failedEmailQueue = this.failedEmailQueue.filter(q => q !== item);
                    console.log(`[EmailService] Successfully sent queued email`);
                } catch (error: any) {
                    console.error('[EmailService] Failed to send queued email:', error.message);
                    // Remove from queue if permanent failure
                    this.failedEmailQueue = this.failedEmailQueue.filter(q => q !== item);
                }
            }
            
            if (this.failedEmailQueue.length === 0 && this.queueProcessor) {
                clearInterval(this.queueProcessor);
                this.queueProcessor = null;
                console.log('[EmailService] Queue processor stopped');
            }
        }, 30000); // Check every 30 seconds
        
        console.log('[EmailService] Queue processor started');
    }

    /**
     * Queue email for sending (recommended for bulk operations)
     */
    async sendEmail(options: IEmailOptions): Promise<void> {
        if (process.env.EMAIL_ENABLED === 'false') {
            console.log(`[EmailService] Email sending disabled - skipping email to: ${options.to}`);
            return;
        }
        
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
     * Send email immediately with retry logic (use for critical notifications)
     */
    async sendEmailImmediately(options: IEmailOptions): Promise<void> {
        console.log(`[EmailService] sendEmailImmediately called for: ${options.to}`);
        console.log(`[EmailService] EMAIL_ENABLED = ${process.env.EMAIL_ENABLED}`);
        
        if (process.env.EMAIL_ENABLED === 'false') {
            console.log(`[EmailService] Email sending disabled - skipping email to: ${options.to}`);
            return;
        }
        
        return this.sendWithRetry(options, 3);
    }

    /**
     * Send email with retry logic and error handling
     * @private
     */
    private async sendWithRetry(options: IEmailOptions, maxRetries: number): Promise<void> {
        for (let attempt = 1; attempt <= maxRetries; attempt++) {
            try {
                // Enforce rate limiting before sending
                await this.enforceRateLimit();
                
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
                        { key: 'projectsUrl', value: `${frontendUrl}/projects` },
                        { key: 'supportEmail', value: supportEmail },
                        { key: 'unsubscribeUrl', value: `${frontendUrl}/settings/notifications` }
                    );
                    
                    // Render template
                    htmlContent = await TemplateEngineService.getInstance().render(
                        `${options.template}.html`,
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
                
                console.log(`[EmailService] Email sent successfully to ${options.to}`);
                return; // Success - exit retry loop
                
            } catch (error: any) {
                const isLastAttempt = attempt === maxRetries;
                
                if (this.isRateLimitError(error)) {
                    const delay = Math.pow(2, attempt) * 1000; // 2s, 4s, 8s
                    console.warn(`[EmailService] Rate limited (attempt ${attempt}/${maxRetries}): ${error.message}`);
                    
                    if (!isLastAttempt) {
                        console.log(`[EmailService] Retrying in ${delay}ms...`);
                        await this.sleep(delay);
                        continue;
                    } else {
                        // Queue for later if all retries exhausted
                        console.warn('[EmailService] Max retries exhausted, queuing email for later');
                        await this.queueEmailForLater(options);
                        return; // Don't throw, email is queued
                    }
                } else if (this.isTemporaryError(error)) {
                    const delay = 1000 * attempt; // 1s, 2s, 3s
                    console.warn(`[EmailService] Temporary error (attempt ${attempt}/${maxRetries}): ${error.message}`);
                    
                    if (!isLastAttempt) {
                        console.log(`[EmailService] Retrying in ${delay}ms...`);
                        await this.sleep(delay);
                        continue;
                    }
                }
                
                // Permanent error or max retries reached
                console.error(`[EmailService] Failed to send email (attempt ${attempt}/${maxRetries}):`, {
                    error: error.message,
                    code: error.code,
                    responseCode: error.responseCode,
                    to: options.to
                });
                
                if (isLastAttempt) {
                    // Don't throw - log error but don't crash the server
                    console.error('[EmailService] Max retries reached, email send failed permanently');
                    return;
                }
            }
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
            { key: 'verification_url', value: verificationUrl },
            { key: 'unsubscribe_code', value: '' } // Will be populated by sendEmail wrapper if needed
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
            { key: 'reset_url', value: resetUrl },
            { key: 'unsubscribe_code', value: '' } // Will be populated by sendEmail wrapper if needed
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
            { key: 'signup_url', value: signupUrl },
            { key: 'unsubscribe_code', value: '' } // Will be populated by sendEmail wrapper if needed
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
            { key: 'accept_url', value: acceptUrl },
            { key: 'unsubscribe_code', value: '' } // Will be populated by sendEmail wrapper if needed
        ]);

        const text = `${data.inviterName} has invited you to collaborate on "${data.projectName}"

Role: ${data.role.toUpperCase()}
${roleDescriptions[data.role.toLowerCase()] || 'Collaborate on this project'}

Accept invitation: ${acceptUrl}

This invitation will expire in 7 days.

If you did not expect this invitation, please ignore this email.`;

        return this.mailDriver.sendMail({
            to: data.email,
            subject: `You've been invited to collaborate on "${this.sanitizeForSubject(data.projectName)}"`,
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
            { key: 'project_url', value: projectUrl },
            { key: 'unsubscribe_code', value: '' } // Will be populated by sendEmail wrapper if needed
        ]);

        const text = `${data.inviterName} has added you to "${data.projectName}"

Role: ${data.role.toUpperCase()}
${roleDescriptions[data.role.toLowerCase()] || 'Collaborate on this project'}

View your projects: ${projectUrl}

You can start collaborating immediately!`;

        return this.mailDriver.sendMail({
            to: data.email,
            subject: `You've been added to "${this.sanitizeForSubject(data.projectName)}"`,
            text,
            html
        });
    }

    /**
     * Send organization invitation to NEW user
     * 
     * Sent when a non-registered user is invited to join an organization.
     * User must accept invitation via token link.
     * 
     * @param data - Invitation details (email, organizationName, inviterName, role, token, frontendUrl)
     * @returns Send result with message ID
     */
    public async sendOrganizationInvitation(data: {
        email: string;
        organizationName: string;
        inviterName: string;
        role: string;
        token: string;
        frontendUrl: string;
    }): Promise<SendMailResult> {
        const acceptUrl = `${data.frontendUrl}/organization-invitations/accept/${data.token}`;
        
        const roleDescriptions: Record<string, string> = {
            owner: 'Full control over the organization, including billing and deletion',
            admin: 'Manage members, projects, and organization settings',
            member: 'Access permitted projects and collaborate with team members'
        };

        const text = `${data.inviterName} has invited you to join "${data.organizationName}"

Role: ${data.role.toUpperCase()}
${roleDescriptions[data.role.toLowerCase()] || 'Join this organization'}

Accept invitation: ${acceptUrl}

This invitation will expire in 7 days.

If you did not expect this invitation, please ignore this email.`;

        return this.mailDriver.sendMail({
            to: data.email,
            subject: `You've been invited to join ${data.organizationName}`,
            text,
            html: `
<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
    <div style="background-color: #3b82f6; padding: 30px; text-align: center; border-radius: 8px 8px 0 0;">
        <h1 style="color: white; margin: 0;">You're Invited!</h1>
    </div>
    
    <div style="background-color: #f9fafb; padding: 30px; border: 1px solid #e5e7eb; border-top: none; border-radius: 0 0 8px 8px;">
        <p style="font-size: 16px; margin-bottom: 20px;">Hi there,</p>
        
        <p style="font-size: 16px; margin-bottom: 20px;">
            <strong>${data.inviterName}</strong> has invited you to join 
            <strong>${data.organizationName}</strong> as a <strong>${data.role}</strong> 
            on Data Research Analysis.
        </p>
        
        <div style="text-align: center; margin: 30px 0;">
            <a href="${acceptUrl}" 
               style="display: inline-block; padding: 14px 28px; background-color: #10b981; color: white; text-decoration: none; border-radius: 6px; font-weight: bold; font-size: 16px;">
                Accept Invitation
            </a>
        </div>
        
        <p style="font-size: 14px; color: #6b7280; margin-top: 20px;">
            This invitation expires in 7 days.
        </p>
        
        <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 30px 0;">
        
        <p style="font-size: 13px; color: #9ca3af;">
            If you don't have an account yet, clicking the button will take you to registration. 
            Your account will be automatically added to the organization.
        </p>
        
        <p style="font-size: 13px; color: #9ca3af; margin-top: 20px;">
            If you didn't expect this invitation, you can safely ignore this email.
        </p>
    </div>
</body>
</html>`
        });
    }

    /**
     * Send notification to EXISTING user added to organization
     * 
     * Sent when a registered user is added directly to an organization.
     * No acceptance needed - they're already a member.
     * 
     * @param data - Invitation details (email, organizationName, inviterName, role)
     * @returns Send result with message ID
     */
    public async sendOrganizationMemberAdded(data: {
        email: string;
        organizationName: string;
        inviterName: string;
        role: string;
    }): Promise<SendMailResult> {
        const projectsUrl = `${UtilityService.getInstance().getConstants('FRONTEND_URL')}/projects`;
        
        const text = `${data.inviterName} has added you to "${data.organizationName}"

Role: ${data.role.toUpperCase()}

View your projects: ${projectsUrl}

You can start collaborating immediately!`;

        return this.mailDriver.sendMail({
            to: data.email,
            subject: `You've been added to ${data.organizationName}`,
            text,
            html: `
<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
    <div style="background-color: #3b82f6; padding: 30px; text-align: center; border-radius: 8px 8px 0 0;">
        <h1 style="color: white; margin: 0;">Welcome to the Team!</h1>
    </div>
    
    <div style="background-color: #f9fafb; padding: 30px; border: 1px solid #e5e7eb; border-top: none; border-radius: 0 0 8px 8px;">
        <p style="font-size: 16px; margin-bottom: 20px;">Hi there,</p>
        
        <p style="font-size: 16px; margin-bottom: 20px;">
            <strong>${data.inviterName}</strong> has added you to 
            <strong>${data.organizationName}</strong> as a <strong>${data.role}</strong>.
        </p>
        
        <p style="font-size: 16px; margin-bottom: 20px;">
            You can now access the organization and its projects.
        </p>
        
        <div style="text-align: center; margin: 30px 0;">
            <a href="${projectsUrl}" 
               style="display: inline-block; padding: 14px 28px; background-color: #3b82f6; color: white; text-decoration: none; border-radius: 6px; font-weight: bold; font-size: 16px;">
                View Projects
            </a>
        </div>
    </div>
</body>
</html>`
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
        const projectsUrl = `${frontendUrl}/projects`;
        const reactivateUrl = `${frontendUrl}/account/cancel-account?action=reactivate`;
        
        const html = await TemplateEngineService.getInstance().render('account-cancellation-requested.html', [
            { key: 'user_name', value: userName },
            { key: 'effective_date', value: new Intl.DateTimeFormat('en-US', { year: 'numeric', month: 'long', day: 'numeric' }).format(effectiveDate) },
            { key: 'deletion_date', value: new Intl.DateTimeFormat('en-US', { year: 'numeric', month: 'long', day: 'numeric' }).format(deletionDate) },
            { key: 'retention_days', value: retentionDays.toString() },
            { key: 'dashboard_url', value: projectsUrl },
            { key: 'reactivate_url', value: reactivateUrl },
            { key: 'unsubscribe_code', value: '' } // Will be populated by sendEmail wrapper if needed
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

Don't forget to export your data: ${projectsUrl}
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
        const projectsUrl = `${frontendUrl}/projects`;
        const reactivateUrl = `${frontendUrl}/account/cancel-account?action=reactivate`;
        
        const html = await TemplateEngineService.getInstance().render('account-cancellation-reminder-7days.html', [
            { key: 'user_name', value: userName },
            { key: 'deletion_date', value: new Intl.DateTimeFormat('en-US', { year: 'numeric', month: 'long', day: 'numeric' }).format(deletionDate) },
            { key: 'dashboard_url', value: projectsUrl },
            { key: 'reactivate_url', value: reactivateUrl },
            { key: 'unsubscribe_code', value: '' } // Will be populated by sendEmail wrapper if needed
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
• Export your data: ${projectsUrl}

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
        const projectsUrl = `${frontendUrl}/dashboard`;
        const reactivateUrl = `${frontendUrl}/account/cancel-account?action=reactivate`;
        const supportUrl = `${frontendUrl}/support`;
        
        const html = await TemplateEngineService.getInstance().render('account-cancellation-reminder-1day.html', [
            { key: 'user_name', value: userName },
            { key: 'deletion_date', value: new Intl.DateTimeFormat('en-US', { year: 'numeric', month: 'long', day: 'numeric', hour: 'numeric', minute: 'numeric' }).format(deletionDate) },
            { key: 'dashboard_url', value: projectsUrl },
            { key: 'reactivate_url', value: reactivateUrl },
            { key: 'support_url', value: supportUrl },
            { key: 'project_count', value: dataCounts.projectCount.toString() },
            { key: 'data_source_count', value: dataCounts.dataSourceCount.toString() },
            { key: 'data_model_count', value: dataCounts.dataModelCount.toString() },
            { key: 'dashboard_count', value: dataCounts.dashboardCount.toString() },
            { key: 'unsubscribe_code', value: '' } // Will be populated by sendEmail wrapper if needed
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
📦 Export Data: ${projectsUrl}
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
        const projectsUrl = `${frontendUrl}/dashboard`;
        
        const html = await TemplateEngineService.getInstance().render('account-reactivated.html', [
            { key: 'user_name', value: userName },
            { key: 'dashboard_url', value: projectsUrl },
            { key: 'unsubscribe_code', value: '' } // Will be populated by sendEmail wrapper if needed
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

Go to Dashboard: ${projectsUrl}

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
            { key: 'signup_url', value: signupUrl },
            { key: 'unsubscribe_code', value: '' } // Will be populated by sendEmail wrapper if needed
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
     * Send subscription upgraded email
     * 
     * Sent when user's subscription is upgraded to a higher tier.
     * Includes new features and benefits.
     * 
     * @param email - User email address
     * @param userName - User full name
     * @param oldTier - Previous subscription tier name
     * @param newTier - New subscription tier name
     * @param newFeatures - Array of new features unlocked
     * @returns Send result with message ID
     */
    public async sendSubscriptionUpgraded(
        email: string,
        userName: string,
        oldTier: string,
        newTier: string,
        newFeatures: string[]
    ): Promise<SendMailResult> {
        const frontendUrl = UtilityService.getInstance().getConstants('FRONTEND_URL') || 'http://localhost:3000';
        const dashboardUrl = `${frontendUrl}/dashboard`;
        const featuresHtml = newFeatures.map(f => `<li>${f}</li>`).join('');
        const featuresText = newFeatures.map(f => `• ${f}`).join('\n');
        
        const html = await TemplateEngineService.getInstance().render('subscription-upgraded.html', [
            { key: 'user_name', value: userName },
            { key: 'old_tier', value: oldTier },
            { key: 'new_tier', value: newTier },
            { key: 'new_features', value: featuresHtml },
            { key: 'dashboard_url', value: dashboardUrl },
            { key: 'unsubscribe_code', value: '' }
        ]);

        const text = `🎉 Subscription Upgraded!

Hello ${userName},

Great news! Your subscription has been upgraded from ${oldTier} to ${newTier}.

New Features Unlocked:
${featuresText}

Start exploring your new features: ${dashboardUrl}

Thank you for your continued support!`;

        return this.mailDriver.sendMail({
            to: email,
            subject: `🎉 Subscription Upgraded to ${this.sanitizeForSubject(newTier)}`,
            text,
            html
        });
    }

    /**
     * Send subscription downgraded email
     * 
     * Sent when user's subscription is downgraded to a lower tier.
     * Includes information about changed features.
     * 
     * @param email - User email address
     * @param userName - User full name
     * @param oldTier - Previous subscription tier name
     * @param newTier - New subscription tier name
     * @param effectiveDate - Date when downgrade takes effect
     * @returns Send result with message ID
     */
    public async sendSubscriptionDowngraded(
        email: string,
        userName: string,
        oldTier: string,
        newTier: string,
        effectiveDate: Date
    ): Promise<SendMailResult> {
        const frontendUrl = UtilityService.getInstance().getConstants('FRONTEND_URL') || 'http://localhost:3000';
        const dashboardUrl = `${frontendUrl}/dashboard`;
        const upgradeUrl = `${frontendUrl}/subscription/upgrade`;
        
        const html = await TemplateEngineService.getInstance().render('subscription-downgraded.html', [
            { key: 'user_name', value: userName },
            { key: 'old_tier', value: oldTier },
            { key: 'new_tier', value: newTier },
            { key: 'effective_date', value: new Intl.DateTimeFormat('en-US', { year: 'numeric', month: 'long', day: 'numeric' }).format(effectiveDate) },
            { key: 'dashboard_url', value: dashboardUrl },
            { key: 'upgrade_url', value: upgradeUrl },
            { key: 'unsubscribe_code', value: '' }
        ]);

        const text = `Subscription Downgraded

Hello ${userName},

Your subscription has been changed from ${oldTier} to ${newTier}.

Effective Date: ${effectiveDate.toLocaleDateString()}

View your subscription details: ${dashboardUrl}
Want to upgrade? ${upgradeUrl}

If you have any questions, please contact our support team.`;

        return this.mailDriver.sendMail({
            to: email,
            subject: `Subscription Changed to ${this.sanitizeForSubject(newTier)}`,
            text,
            html
        });
    }

    /**
     * Send subscription cancelled email
     * 
     * Sent when user cancels their subscription.
     * Account will revert to free tier.
     * 
     * @param email - User email address
     * @param userName - User full name
     * @param tierName - Cancelled subscription tier name
     * @param effectiveDate - Date when cancellation takes effect
     * @returns Send result with message ID
     */
    public async sendSubscriptionCancelled(
        email: string,
        userName: string,
        tierName: string,
        effectiveDate: Date
    ): Promise<SendMailResult> {
        const frontendUrl = UtilityService.getInstance().getConstants('FRONTEND_URL') || 'http://localhost:3000';
        const dashboardUrl = `${frontendUrl}/dashboard`;
        const renewUrl = `${frontendUrl}/subscription/renew`;
        
        const html = await TemplateEngineService.getInstance().render('subscription-cancelled.html', [
            { key: 'user_name', value: userName },
            { key: 'tier_name', value: tierName },
            { key: 'effective_date', value: new Intl.DateTimeFormat('en-US', { year: 'numeric', month: 'long', day: 'numeric' }).format(effectiveDate) },
            { key: 'dashboard_url', value: dashboardUrl },
            { key: 'renew_url', value: renewUrl },
            { key: 'unsubscribe_code', value: '' }
        ]);

        const text = `Subscription Cancelled

Hello ${userName},

Your ${tierName} subscription has been cancelled.

Cancellation effective: ${effectiveDate.toLocaleDateString()}

After this date, your account will revert to the FREE tier with limited features.

Changed your mind? Renew your subscription: ${renewUrl}
View your account: ${dashboardUrl}

We're sorry to see you go. If you have feedback on how we can improve, we'd love to hear it.`;

        return this.mailDriver.sendMail({
            to: email,
            subject: 'Subscription Cancelled - Data Research Analysis',
            text,
            html
        });
    }

    /**
     * Send subscription expired email
     * 
     * Sent when user's subscription has expired.
     * Account has been downgraded to free tier.
     * 
     * @param email - User email address
     * @param userName - User full name
     * @param tierName - Expired subscription tier name
     * @param expirationDate - Date when subscription expired
     * @returns Send result with message ID
     */
    public async sendSubscriptionExpired(
        email: string,
        userName: string,
        tierName: string,
        expirationDate: Date
    ): Promise<SendMailResult> {
        const frontendUrl = UtilityService.getInstance().getConstants('FRONTEND_URL') || 'http://localhost:3000';
        const dashboardUrl = `${frontendUrl}/dashboard`;
        const renewUrl = `${frontendUrl}/subscription/renew`;
        
        const html = await TemplateEngineService.getInstance().render('subscription-expired.html', [
            { key: 'user_name', value: userName },
            { key: 'tier_name', value: tierName },
            { key: 'expiration_date', value: new Intl.DateTimeFormat('en-US', { year: 'numeric', month: 'long', day: 'numeric' }).format(expirationDate) },
            { key: 'dashboard_url', value: dashboardUrl },
            { key: 'renew_url', value: renewUrl },
            { key: 'unsubscribe_code', value: '' }
        ]);

        const text = `⚠️ Subscription Expired

Hello ${userName},

Your ${tierName} subscription expired on ${expirationDate.toLocaleDateString()}.

Your account has been downgraded to the FREE tier. You still have access to basic features, but premium features are now limited.

Want to continue enjoying premium features?
Renew your subscription: ${renewUrl}

View your account: ${dashboardUrl}

Thank you for being part of Data Research Analysis!`;

        return this.mailDriver.sendMail({
            to: email,
            subject: '⚠️ Subscription Expired - Data Research Analysis',
            text,
            html
        });
    }

    /**
     * Send subscription expiring warning email
     * 
     * Sent before subscription expires (usually 7 days before).
     * Prompts user to renew or update payment method.
     * 
     * @param email - User email address
     * @param userName - User full name
     * @param tierName - Current subscription tier name
     * @param expirationDate - Date when subscription will expire
     * @param daysUntilExpiration - Number of days until expiration
     * @returns Send result with message ID
     */
    public async sendSubscriptionExpiringWarning(
        email: string,
        userName: string,
        tierName: string,
        expirationDate: Date,
        daysUntilExpiration: number
    ): Promise<SendMailResult> {
        const frontendUrl = UtilityService.getInstance().getConstants('FRONTEND_URL') || 'http://localhost:3000';
        const dashboardUrl = `${frontendUrl}/dashboard`;
        const renewUrl = `${frontendUrl}/subscription/renew`;
        const paymentUrl = `${frontendUrl}/settings/billing`;
        
        const html = await TemplateEngineService.getInstance().render('subscription-expiring-warning.html', [
            { key: 'user_name', value: userName },
            { key: 'tier_name', value: tierName },
            { key: 'expiration_date', value: new Intl.DateTimeFormat('en-US', { year: 'numeric', month: 'long', day: 'numeric' }).format(expirationDate) },
            { key: 'days_until_expiration', value: daysUntilExpiration.toString() },
            { key: 'dashboard_url', value: dashboardUrl },
            { key: 'renew_url', value: renewUrl },
            { key: 'payment_url', value: paymentUrl },
            { key: 'unsubscribe_code', value: '' }
        ]);

        const text = `⚠️ Subscription Expiring Soon

Hello ${userName},

Your ${tierName} subscription will expire in ${daysUntilExpiration} days.

Expiration Date: ${expirationDate.toLocaleDateString()}

Don't lose access to your premium features!

Action Required:
• Renew your subscription: ${renewUrl}
• Update payment method: ${paymentUrl}

View your subscription: ${dashboardUrl}

Questions? Contact our support team.`;

        return this.mailDriver.sendMail({
            to: email,
            subject: `⚠️ Your ${this.sanitizeForSubject(tierName)} Subscription Expires in ${daysUntilExpiration} Days`,
            text,
            html
        });
    }

    /**
     * Send subscription assigned email
     * 
     * Sent when an admin assigns a subscription to a user.
     * Includes tier details and welcome message.
     * 
     * @param email - User email address
     * @param userName - User full name
     * @param tierName - Assigned subscription tier name
     * @param assignedBy - Name of admin who assigned the subscription
     * @param features - Array of features included in the tier
     * @returns Send result with message ID
     */
    public async sendSubscriptionAssigned(
        email: string,
        userName: string,
        tierName: string,
        assignedBy: string,
        features: string[]
    ): Promise<SendMailResult> {
        const frontendUrl = UtilityService.getInstance().getConstants('FRONTEND_URL') || 'http://localhost:3000';
        const dashboardUrl = `${frontendUrl}/dashboard`;
        const featuresHtml = features.map(f => `<li>${f}</li>`).join('');
        const featuresText = features.map(f => `• ${f}`).join('\n');
        
        const html = await TemplateEngineService.getInstance().render('subscription-assigned.html', [
            { key: 'user_name', value: userName },
            { key: 'tier_name', value: tierName },
            { key: 'assigned_by', value: assignedBy },
            { key: 'features', value: featuresHtml },
            { key: 'dashboard_url', value: dashboardUrl },
            { key: 'unsubscribe_code', value: '' }
        ]);

        const text = `🎉 Subscription Assigned!

Hello ${userName},

Great news! ${assignedBy} has assigned you a ${tierName} subscription.

Included Features:
${featuresText}

Start using your new features: ${dashboardUrl}

Enjoy your premium access!`;

        return this.mailDriver.sendMail({
            to: email,
            subject: `🎉 You've Been Assigned a ${this.sanitizeForSubject(tierName)} Subscription`,
            text,
            html
        });
    }

    /**
     * Send subscription activated email
     * 
     * Sent when a new subscription is successfully created via Paddle checkout.
     * Welcomes user and confirms their subscription details.
     * 
     * @param email - User email address
     * @param userName - User full name
     * @param tierName - Activated subscription tier name
     * @param tierDetails - Tier limits and features
     * @param billingCycle - Billing frequency (monthly/annual)
     * @param nextPaymentDate - Date of next payment
     * @returns Send result with message ID
     */
    public async sendSubscriptionActivated(
        email: string,
        userName: string,
        tierName: string,
        tierDetails: {
            maxProjects: string;
            maxDataSources: string;
            maxDashboards: string;
            maxMembersPerProject: string;
            aiGenerationsPerMonth: string;
            maxRowsPerDataModel: string;
        },
        billingCycle: string,
        nextPaymentDate: Date
    ): Promise<SendMailResult> {
        const frontendUrl = UtilityService.getInstance().getConstants('FRONTEND_URL') || 'http://localhost:3000';
        const dashboardUrl = `${frontendUrl}/dashboard`;
        const billingUrl = `${frontendUrl}/billing`;
        const supportEmail = process.env.MAIL_REPLY_TO || 'support@dataresearchanalysis.com';
        
        const html = await TemplateEngineService.getInstance().render('subscription-activated.html', [
            { key: 'user_name', value: userName },
            { key: 'tier_name', value: tierName },
            { key: 'max_projects', value: tierDetails.maxProjects },
            { key: 'max_data_sources', value: tierDetails.maxDataSources },
            { key: 'max_dashboards', value: tierDetails.maxDashboards },
            { key: 'max_members_per_project', value: tierDetails.maxMembersPerProject },
            { key: 'ai_generations_per_month', value: tierDetails.aiGenerationsPerMonth },
            { key: 'max_rows_per_data_model', value: tierDetails.maxRowsPerDataModel },
            { key: 'billing_cycle', value: billingCycle },
            { key: 'next_payment_date', value: new Intl.DateTimeFormat('en-US', { year: 'numeric', month: 'long', day: 'numeric' }).format(nextPaymentDate) },
            { key: 'dashboard_url', value: dashboardUrl },
            { key: 'billing_url', value: billingUrl },
            { key: 'support_email', value: supportEmail },
            { key: 'unsubscribe_code', value: '' }
        ]);

        const text = `🎉 Welcome to ${tierName}!

Hello ${userName},

Thank you for subscribing! Your ${tierName} subscription is now active.

Your Plan Includes:
• ${tierDetails.maxProjects} projects
• ${tierDetails.maxDataSources} data sources per project
• ${tierDetails.maxDashboards} dashboards
• ${tierDetails.maxMembersPerProject} members per project
• ${tierDetails.aiGenerationsPerMonth} AI generations per month
• ${tierDetails.maxRowsPerDataModel} rows per data model

Billing Cycle: ${billingCycle}
Next Payment: ${nextPaymentDate.toLocaleDateString()}

Get started: ${dashboardUrl}
Manage subscription: ${billingUrl}

Questions? Contact us at ${supportEmail}`;

        return this.mailDriver.sendMail({
            to: email,
            subject: `🎉 Welcome to ${this.sanitizeForSubject(tierName)}!`,
            text,
            html
        });
    }

    /**
     * Send payment failed email
     * 
     * Sent when a subscription payment fails.
     * Starts grace period and prompts user to update payment method.
     * 
     * @param email - User email address
     * @param userName - User full name
     * @param tierName - Current subscription tier name
     * @param gracePeriodEndsAt - Date when grace period expires
     * @param daysRemaining - Days until downgrade
     * @returns Send result with message ID
     */
    public async sendPaymentFailed(
        email: string,
        userName: string,
        tierName: string,
        gracePeriodEndsAt: Date,
        daysRemaining: number
    ): Promise<SendMailResult> {
        const frontendUrl = UtilityService.getInstance().getConstants('FRONTEND_URL') || 'http://localhost:3000';
        const updatePaymentUrl = `${frontendUrl}/billing`;
        const billingUrl = `${frontendUrl}/billing`;
        const supportEmail = process.env.MAIL_REPLY_TO || 'support@dataresearchanalysis.com';
        
        const html = await TemplateEngineService.getInstance().render('payment-failed.html', [
            { key: 'user_name', value: userName },
            { key: 'tier_name', value: tierName },
            { key: 'grace_period_ends_at', value: new Intl.DateTimeFormat('en-US', { year: 'numeric', month: 'long', day: 'numeric' }).format(gracePeriodEndsAt) },
            { key: 'days_remaining', value: daysRemaining.toString() },
            { key: 'update_payment_url', value: updatePaymentUrl },
            { key: 'billing_url', value: billingUrl },
            { key: 'support_email', value: supportEmail },
            { key: 'unsubscribe_code', value: '' }
        ]);

        const text = `⚠️ Payment Failed

Hello ${userName},

We were unable to process your recent payment for the ${tierName} subscription.

Grace Period: Your subscription will remain active until ${gracePeriodEndsAt.toLocaleDateString()} (${daysRemaining} days).

Please update your payment method before this date to avoid service interruption.

Update payment method: ${updatePaymentUrl}
View billing details: ${billingUrl}

After the grace period, your account will be downgraded to the FREE tier.

Need help? Contact us at ${supportEmail}`;

        return this.mailDriver.sendMail({
            to: email,
            subject: '⚠️ Payment Failed - Action Required',
            text,
            html
        });
    }

    /**
     * Send grace period expiring email
     * 
     * Sent at 7, 3, and 1 days before grace period expires.
     * Urgent reminder to update payment method.
     * 
     * @param email - User email address
     * @param userName - User full name
     * @param tierName - Current subscription tier name
     * @param gracePeriodEndsAt - Date when grace period expires
     * @param daysRemaining - Days until downgrade
     * @returns Send result with message ID
     */
    public async sendGracePeriodExpiring(
        email: string,
        userName: string,
        tierName: string,
        gracePeriodEndsAt: Date,
        daysRemaining: number
    ): Promise<SendMailResult> {
        const frontendUrl = UtilityService.getInstance().getConstants('FRONTEND_URL') || 'http://localhost:3000';
        const updatePaymentUrl = `${frontendUrl}/billing`;
        const supportEmail = process.env.MAIL_REPLY_TO || 'support@dataresearchanalysis.com';
        
        const html = await TemplateEngineService.getInstance().render('grace-period-expiring.html', [
            { key: 'user_name', value: userName },
            { key: 'tier_name', value: tierName },
            { key: 'grace_period_ends_at', value: new Intl.DateTimeFormat('en-US', { year: 'numeric', month: 'long', day: 'numeric' }).format(gracePeriodEndsAt) },
            { key: 'days_remaining', value: daysRemaining.toString() },
            { key: 'update_payment_url', value: updatePaymentUrl },
            { key: 'support_email', value: supportEmail },
            { key: 'unsubscribe_code', value: '' }
        ]);

        const text = `⏰ Urgent: Subscription Expiring in ${daysRemaining} Days

Hello ${userName},

Your ${tierName} subscription grace period ends soon!

Days Remaining: ${daysRemaining}
Grace Period Ends: ${gracePeriodEndsAt.toLocaleDateString()}

ACTION REQUIRED: Update your payment method immediately to maintain your premium features.

Update payment method now: ${updatePaymentUrl}

What happens if no action is taken:
• Loss of premium features
• Limited projects and data sources
• Reduced AI generation quota
• Limited team collaboration

Need help? Contact us at ${supportEmail}`;

        return this.mailDriver.sendMail({
            to: email,
            subject: `⏰ Urgent: Only ${daysRemaining} Days Left - Update Payment`,
            text,
            html
        });
    }

    /**
     * Send downgraded to free email
     * 
     * Sent when grace period expires and account is downgraded to FREE.
     * Explains what changed and how to upgrade.
     * 
     * @param email - User email address
     * @param userName - User full name
     * @param oldTierName - Previous paid tier name
     * @param oldTierDetails - Previous tier limits
     * @param newTierDetails - FREE tier limits
     * @returns Send result with message ID
     */
    public async sendDowngradedToFree(
        email: string,
        userName: string,
        oldTierName: string,
        oldTierDetails: {
            maxProjects: string;
            maxDataSources: string;
            maxDashboards: string;
            aiGenerationsPerMonth: string;
        },
        newTierDetails: {
            maxProjects: string;
            maxDataSources: string;
            maxDashboards: string;
            aiGenerationsPerMonth: string;
        }
    ): Promise<SendMailResult> {
        const frontendUrl = UtilityService.getInstance().getConstants('FRONTEND_URL') || 'http://localhost:3000';
        const upgradeUrl = `${frontendUrl}/pricing`;
        const supportEmail = process.env.MAIL_REPLY_TO || 'support@dataresearchanalysis.com';
        
        const html = await TemplateEngineService.getInstance().render('downgraded-to-free.html', [
            { key: 'user_name', value: userName },
            { key: 'old_tier_name', value: oldTierName },
            { key: 'old_max_projects', value: oldTierDetails.maxProjects },
            { key: 'old_max_data_sources', value: oldTierDetails.maxDataSources },
            { key: 'old_max_dashboards', value: oldTierDetails.maxDashboards },
            { key: 'old_ai_generations', value: oldTierDetails.aiGenerationsPerMonth },
            { key: 'new_max_projects', value: newTierDetails.maxProjects },
            { key: 'new_max_data_sources', value: newTierDetails.maxDataSources },
            { key: 'new_max_dashboards', value: newTierDetails.maxDashboards },
            { key: 'new_ai_generations', value: newTierDetails.aiGenerationsPerMonth },
            { key: 'upgrade_url', value: upgradeUrl },
            { key: 'support_email', value: supportEmail },
            { key: 'unsubscribe_code', value: '' }
        ]);

        const text = `Account Downgraded to FREE

Hello ${userName},

Your account has been downgraded to the FREE tier due to the grace period expiring after failed payment.

What Changed:
• Projects: ${oldTierDetails.maxProjects} → ${newTierDetails.maxProjects}
• Data Sources: ${oldTierDetails.maxDataSources} → ${newTierDetails.maxDataSources}
• Dashboards: ${oldTierDetails.maxDashboards} → ${newTierDetails.maxDashboards}
• AI Generations/Month: ${oldTierDetails.aiGenerationsPerMonth} → ${newTierDetails.aiGenerationsPerMonth}

Good News: Your existing data and projects are safe. You still have access to basic features on the FREE tier.

Want your premium features back? Upgrade anytime: ${upgradeUrl}

Questions or need assistance? Contact us at ${supportEmail}`;

        return this.mailDriver.sendMail({
            to: email,
            subject: 'Account Downgraded to FREE - Data Research Analysis',
            text,
            html
        });
    }

    /**
     * Send data source sync complete email
     * 
     * Sent when a data source sync successfully completes.
     * Includes sync statistics and timestamp.
     * 
     * @param email - User email address
     * @param userName - User full name
     * @param dataSourceName - Name of the synced data source
     * @param syncTime - Time when sync completed
     * @param recordCount - Number of records synced
     * @returns Send result with message ID
     */
    public async sendSyncComplete(
        email: string,
        userName: string,
        dataSourceName: string,
        syncTime: Date,
        recordCount: number
    ): Promise<SendMailResult> {
        const frontendUrl = UtilityService.getInstance().getConstants('FRONTEND_URL') || 'http://localhost:3000';
        const dashboardUrl = `${frontendUrl}/dashboard`;
        const dataSourcesUrl = `${frontendUrl}/data-sources`;
        
        const html = await TemplateEngineService.getInstance().render('sync-complete.html', [
            { key: 'user_name', value: userName },
            { key: 'data_source_name', value: dataSourceName },
            { key: 'sync_time', value: new Intl.DateTimeFormat('en-US', { year: 'numeric', month: 'long', day: 'numeric', hour: 'numeric', minute: 'numeric' }).format(syncTime) },
            { key: 'record_count', value: recordCount.toLocaleString() },
            { key: 'dashboard_url', value: dashboardUrl },
            { key: 'data_sources_url', value: dataSourcesUrl },
            { key: 'unsubscribe_code', value: '' }
        ]);

        const text = `✅ Data Sync Complete

Hello ${userName},

Your data source "${dataSourceName}" has been successfully synced.

Sync Details:
• Completed: ${syncTime.toLocaleString()}
• Records Synced: ${recordCount.toLocaleString()}

View your data: ${dashboardUrl}
Manage data sources: ${dataSourcesUrl}

Your data is now up to date!`;

        return this.mailDriver.sendMail({
            to: email,
            subject: `✅ Sync Complete: ${dataSourceName}`,
            text,
            html
        });
    }

    /**
     * Send data source sync failure email
     * 
     * Sent when a data source sync fails.
     * Includes error details and troubleshooting steps.
     * 
     * @param email - User email address
     * @param userName - User full name
     * @param dataSourceName - Name of the data source that failed
     * @param errorMessage - Error message from the sync failure
     * @param failureTime - Time when sync failed
     * @returns Send result with message ID
     */
    public async sendSyncFailure(
        email: string,
        userName: string,
        dataSourceName: string,
        errorMessage: string,
        failureTime: Date
    ): Promise<SendMailResult> {
        const frontendUrl = UtilityService.getInstance().getConstants('FRONTEND_URL') || 'http://localhost:3000';
        const dataSourcesUrl = `${frontendUrl}/data-sources`;
        const supportUrl = `${frontendUrl}/support`;
        
        const html = await TemplateEngineService.getInstance().render('sync-failure.html', [
            { key: 'user_name', value: userName },
            { key: 'data_source_name', value: dataSourceName },
            { key: 'error_message', value: errorMessage },
            { key: 'failure_time', value: new Intl.DateTimeFormat('en-US', { year: 'numeric', month: 'long', day: 'numeric', hour: 'numeric', minute: 'numeric' }).format(failureTime) },
            { key: 'data_sources_url', value: dataSourcesUrl },
            { key: 'support_url', value: supportUrl },
            { key: 'unsubscribe_code', value: '' }
        ]);

        const text = `❌ Data Sync Failed

Hello ${userName},

Your data source "${dataSourceName}" sync failed.

Failure Details:
• Time: ${failureTime.toLocaleString()}
• Error: ${errorMessage}

Troubleshooting Steps:
1. Check your data source connection settings
2. Verify credentials are still valid
3. Ensure the data source is accessible
4. Try syncing again manually

Manage data sources: ${dataSourcesUrl}
Need help? Contact support: ${supportUrl}

We'll automatically retry the sync. You can also retry manually from your dashboard.`;

        return this.mailDriver.sendMail({
            to: email,
            subject: `❌ Sync Failed: ${dataSourceName}`,
            text,
            html
        });
    }

    /**
     * Send dashboard export complete email
     * 
     * Sent when a dashboard export is ready for download.
     * Includes download link and expiration info.
     * 
     * @param email - User email address
     * @param userName - User full name
     * @param dashboardName - Name of the exported dashboard
     * @param exportFormat - Format of export (PDF, CSV, Excel, etc.)
     * @param downloadUrl - URL to download the export
     * @param expirationHours - Hours until download link expires
     * @returns Send result with message ID
     */
    public async sendExportComplete(
        email: string,
        userName: string,
        dashboardName: string,
        exportFormat: string,
        downloadUrl: string,
        expirationHours: number
    ): Promise<SendMailResult> {
        const frontendUrl = UtilityService.getInstance().getConstants('FRONTEND_URL') || 'http://localhost:3000';
        const dashboardUrl = `${frontendUrl}/dashboard`;
        
        const html = await TemplateEngineService.getInstance().render('export-complete.html', [
            { key: 'user_name', value: userName },
            { key: 'dashboard_name', value: dashboardName },
            { key: 'export_format', value: exportFormat.toUpperCase() },
            { key: 'download_url', value: downloadUrl },
            { key: 'expiration_hours', value: expirationHours.toString() },
            { key: 'dashboard_url', value: dashboardUrl },
            { key: 'unsubscribe_code', value: '' }
        ]);

        const text = `📊 Export Ready for Download

Hello ${userName},

Your "${dashboardName}" export is ready!

Export Details:
• Format: ${exportFormat.toUpperCase()}
• Expires in: ${expirationHours} hours

Download now: ${downloadUrl}

⚠️ This link will expire in ${expirationHours} hours. Please download your export before then.

Back to dashboard: ${dashboardUrl}

Need another export? You can create a new one from your dashboard.`;

        return this.mailDriver.sendMail({
            to: email,
            subject: `📊 Export Ready: ${dashboardName}`,
            text,
            html
        });
    }

    /**
     * Send paid plans launch notification
     * 
     * Sent to users who expressed interest in paid plans when plans become available.
     * Includes personalized tier information and upgrade CTA.
     * 
     * @param email - User email address
     * @param userName - User full name
     * @param interestedTier - Tier user expressed interest in (PROFESSIONAL or ENTERPRISE)
     * @param tierPrice - Monthly price of the interested tier
     * @param tierMaxRows - Max rows for the interested tier
     * @param tierMaxMembers - Max members for the interested tier
     * @returns Send result with message ID
     */
    public async sendPaidPlansLaunch(
        email: string,
        userName: string,
        interestedTier: string,
        tierPrice: number,
        tierMaxRows: string,
        tierMaxMembers: string
    ): Promise<SendMailResult> {
        const frontendUrl = UtilityService.getInstance().getConstants('FRONTEND_URL') || 'http://localhost:3000';
        const upgradeUrl = `${frontendUrl}/pricing?plan=${interestedTier.toLowerCase()}`;
        const pricingUrl = `${frontendUrl}/pricing`;
        const projectsUrl = `${frontendUrl}/projects`;
        const supportEmail = process.env.SUPPORT_EMAIL || 'support@dataresearchanalysis.com';
        
        const html = await TemplateEngineService.getInstance().render('paid-plans-launch.html', [
            { key: 'user_name', value: userName },
            { key: 'interested_tier', value: interestedTier },
            { key: 'tier_price', value: tierPrice.toString() },
            { key: 'tier_max_rows', value: tierMaxRows },
            { key: 'tier_max_members', value: tierMaxMembers },
            { key: 'upgrade_url', value: upgradeUrl },
            { key: 'pricing_url', value: pricingUrl },
            { key: 'projects_url', value: projectsUrl },
            { key: 'support_email', value: supportEmail },
            { key: 'unsubscribe_url', value: `${frontendUrl}/settings/notifications` },
            { key: 'year', value: new Date().getFullYear().toString() }
        ]);

        const text = `🚀 Paid Plans Are Live!

Hi ${userName},

Great news! You expressed interest in our ${interestedTier} plan, and we're excited to let you know that our paid plans are now available.

Upgrade today to unlock all the powerful features you've been waiting for:

✓ Unlimited projects, data sources, and dashboards
✓ ${tierMaxRows} rows per data model
✓ ${tierMaxMembers} team members per project
✓ Unlimited AI-powered data modeling
✓ Priority support and advanced features

${interestedTier} Plan: $${tierPrice}/month

Upgrade now: ${upgradeUrl}

Want to compare all available plans? Visit our pricing page: ${pricingUrl}

Have questions? Our team is here to help! Contact us at ${supportEmail}.

Data Research Analysis Platform
${projectsUrl}`;

        return this.mailDriver.sendMail({
            to: email,
            subject: `🚀 ${interestedTier} Plan Now Available - Upgrade Today!`,
            text,
            html
        });
    }

    /**
     * Send enterprise inquiry notification to admin
     * 
     * Sent to admin when a new enterprise contact form is submitted.
     * Includes all contact details and link to admin dashboard.
     * 
     * @param data - Enterprise inquiry details
     * @returns Send result with message ID
     */
    public async sendEnterpriseInquiryNotificationToAdmin(data: {
        firstName: string;
        lastName: string;
        businessEmail: string;
        phoneNumber: string;
        companyName: string;
        country: string;
        agreeToReceiveUpdates: boolean;
        submittedAt: Date;
    }): Promise<SendMailResult> {
        const frontendUrl = UtilityService.getInstance().getConstants('FRONTEND_URL') || 'http://localhost:3000';
        const adminUrl = `${frontendUrl}/admin/enterprise-queries`;
        const adminEmail = process.env.ADMIN_EMAIL || process.env.SUPPORT_EMAIL || 'admin@dataresearchanalysis.com';
        
        const html = await TemplateEngineService.getInstance().render('enterprise-inquiry-admin-notification.html', [
            { key: 'first_name', value: data.firstName },
            { key: 'last_name', value: data.lastName },
            { key: 'business_email', value: data.businessEmail },
            { key: 'phone_number', value: data.phoneNumber },
            { key: 'company_name', value: data.companyName },
            { key: 'country', value: data.country },
            { key: 'marketing_consent', value: data.agreeToReceiveUpdates ? 'Yes' : 'No' },
            { key: 'submitted_at', value: new Intl.DateTimeFormat('en-US', {
                year: 'numeric',
                month: 'long',
                day: 'numeric',
                hour: '2-digit',
                minute: '2-digit',
                timeZoneName: 'short'
            }).format(data.submittedAt) },
            { key: 'admin_url', value: adminUrl }
        ]);

        const text = `New Enterprise Inquiry Received

A new enterprise inquiry has been submitted through the contact form.

Contact Information:
- Full Name: ${data.firstName} ${data.lastName}
- Business Email: ${data.businessEmail}
- Phone Number: ${data.phoneNumber}
- Company: ${data.companyName}
- Country: ${data.country}
- Marketing Consent: ${data.agreeToReceiveUpdates ? 'Yes' : 'No'}
- Submitted: ${data.submittedAt.toISOString()}

View in Admin Dashboard: ${adminUrl}

Action Required: Please review this inquiry and follow up with the potential client within 24 hours for the best conversion rates.`;

        return this.mailDriver.sendMail({
            to: adminEmail,
            subject: `🎯 New Enterprise Inquiry from ${data.companyName}`,
            text,
            html
        });
    }

    /**
     * Send enterprise inquiry confirmation to user
     * 
     * Sent to user after they submit the enterprise contact form.
     * Thanks them and sets expectations for response time.
     * 
     * @param data - Enterprise inquiry details
     * @returns Send result with message ID
     */
    public async sendEnterpriseInquiryConfirmationToUser(data: {
        firstName: string;
        businessEmail: string;
        companyName: string;
    }): Promise<SendMailResult> {
        const frontendUrl = UtilityService.getInstance().getConstants('FRONTEND_URL') || 'http://localhost:3000';
        const platformUrl = frontendUrl;
        const supportEmail = process.env.SUPPORT_EMAIL || 'hello@dataresearchanalysis.com';
        const caseStudiesUrl = `${frontendUrl}/articles?category=case-studies`;
        const featuresUrl = `${frontendUrl}/#features`;
        const documentationUrl = `${frontendUrl}/articles`;
        const privacyPolicyUrl = `${frontendUrl}/privacy-policy`;
        
        const html = await TemplateEngineService.getInstance().render('enterprise-inquiry-user-confirmation.html', [
            { key: 'first_name', value: data.firstName },
            { key: 'company_name', value: data.companyName },
            { key: 'platform_url', value: platformUrl },
            { key: 'support_email', value: supportEmail },
            { key: 'case_studies_url', value: caseStudiesUrl },
            { key: 'features_url', value: featuresUrl },
            { key: 'documentation_url', value: documentationUrl },
            { key: 'privacy_policy_url', value: privacyPolicyUrl }
        ]);

        const text = `Thank You for Your Inquiry

Hi ${data.firstName},

Thank you for your interest in Data Research Analysis Platform's enterprise solutions. We've received your inquiry and our team is excited to connect with you.

A member of our enterprise sales team will review your information and reach out to you within 1-2 business days to discuss how we can support ${data.companyName}'s data analytics needs.

What Happens Next?
1. Our team reviews your requirements
2. We prepare a customized demo and proposal
3. Schedule a personalized consultation call
4. Discuss pricing, implementation, and next steps

What Makes Us Different?
✓ Connect to 10+ data sources (PostgreSQL, MySQL, MongoDB, Google Analytics, HubSpot, and more)
✓ AI-powered data modeling and insights generation
✓ Build interactive dashboards without coding
✓ Enterprise-grade security and compliance
✓ Dedicated support and onboarding

Explore Our Platform: ${platformUrl}

In the meantime, check out:
- Customer Success Stories: ${caseStudiesUrl}
- Platform Features: ${featuresUrl}
- Documentation: ${documentationUrl}

If you have any immediate questions, feel free to reply to this email or contact us at ${supportEmail}.

Best regards,
Enterprise Sales Team
Data Research Analysis Platform
${platformUrl}`;

        return this.mailDriver.sendMail({
            to: data.businessEmail,
            subject: 'Thank You for Your Enterprise Inquiry - Data Research Analysis',
            text,
            html
        });
    }

    /**
     * Close email service and cleanup resources
     */
    async close(): Promise<void> {
        // Stop queue processor if running
        if (this.queueProcessor) {
            clearInterval(this.queueProcessor);
            this.queueProcessor = null;
        }

        // Clear failed email queue
        this.failedEmailQueue = [];

        // Close worker and queue
        if (this.worker) {
            await this.worker.close();
        }
        if (this.emailQueue) {
            await this.emailQueue.close();
        }

        console.log('[EmailService] Service closed');
    }

    /**
     * Reset internal state (for testing purposes)
     * Clears rate limiting state and failed email queue
     */
    public resetState(): void {
        this.failedEmailQueue = [];
        this.lastEmailTime = 0;
        this.emailCount = 0;
        if (this.queueProcessor) {
            clearInterval(this.queueProcessor);
            this.queueProcessor = null;
        }
    }
}
