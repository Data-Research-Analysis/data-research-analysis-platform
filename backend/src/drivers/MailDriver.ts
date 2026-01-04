import { INodeMailerDriver } from "../interfaces/INodeMailerDriver.js";
import { UtilityService } from "../services/UtilityService.js";
import { NodeMailerDriver } from "./NodeMailerDriver.js";
import nodemailer from 'nodemailer';

interface MailOptions {
    to: string | string[];
    subject: string;
    text?: string;
    html?: string;
    attachments?: Array<{
        filename: string;
        content: any;
        contentType?: string;
    }>;
}

interface SendMailResult {
    messageId: string;
    accepted: string[];
    rejected: string[];
    response: string;
}

export class MailDriver {
    private static instance: MailDriver;
    private transporter: nodemailer.Transporter;

    private constructor() {
        // Initialize nodemailer transporter with SMTP config
        this.transporter = nodemailer.createTransport({
            host: UtilityService.getInstance().getConstants('MAIL_HOST'),
            port: Number(UtilityService.getInstance().getConstants('MAIL_PORT')),
            auth: {
                user: UtilityService.getInstance().getConstants('MAIL_USER'),
                pass: UtilityService.getInstance().getConstants('MAIL_PASS'),
            }
        });
    }

    public static getInstance(): MailDriver {
        if (!MailDriver.instance) {
            MailDriver.instance = new MailDriver();
        }
        return MailDriver.instance;
    }

    public getDriver(): INodeMailerDriver {
        return NodeMailerDriver.getInstance();
    }

    /**
     * Verify SMTP connection
     * @throws Error if connection fails
     */
    public async verifyConnection(): Promise<boolean> {
        try {
            await this.transporter.verify();
            return true;
        } catch (error) {
            throw new Error(`Mail server connection failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
    }

    /**
     * Send a general email
     */
    public async sendMail(options: MailOptions): Promise<SendMailResult> {
        // Validation
        if (!options.to || (Array.isArray(options.to) && options.to.length === 0)) {
            throw new Error('Recipient email address is required');
        }

        if (!options.subject || options.subject.trim() === '') {
            throw new Error('Email subject is required');
        }

        if ((!options.text || options.text.trim() === '') && (!options.html || options.html.trim() === '')) {
            throw new Error('Email must contain either text or HTML content');
        }

        // Validate email format
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        const recipients = Array.isArray(options.to) ? options.to : [options.to];
        
        for (const recipient of recipients) {
            if (!emailRegex.test(recipient)) {
                throw new Error(`Invalid email address: ${recipient}`);
            }
        }

        const from = UtilityService.getInstance().getConstants('MAIL_FROM');
        
        const mailOptions: any = {
            from: from,
            to: options.to,
            subject: options.subject,
            text: options.text,
            html: options.html
        };

        if (options.attachments) {
            mailOptions.attachments = options.attachments;
        }

        const result = await this.transporter.sendMail(mailOptions);
        
        return {
            messageId: result.messageId,
            accepted: result.accepted as string[],
            rejected: result.rejected as string[],
            response: result.response
        };
    }

    /**
     * Send email verification email
     */
    public async sendVerificationEmail(email: string, token: string): Promise<SendMailResult> {
        const verificationUrl = `${UtilityService.getInstance().getConstants('FRONTEND_URL')}/verify-email?token=${token}`;
        
        const html = `
            <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
                <h2>Email Verification</h2>
                <p>Thank you for registering with Data Research Analysis Platform.</p>
                <p>Please click the link below to verify your email address:</p>
                <p>
                    <a href="${verificationUrl}" style="background-color: #4CAF50; color: white; padding: 12px 24px; text-decoration: none; border-radius: 4px; display: inline-block;">
                        Verify Email
                    </a>
                </p>
                <p>Or copy and paste this link into your browser:</p>
                <p style="word-break: break-all;">${verificationUrl}</p>
                <p>This link will expire in 24 hours.</p>
                <p>If you did not create an account, please ignore this email.</p>
            </div>
        `;

        const text = `
Thank you for registering with Data Research Analysis Platform.

Please verify your email address by clicking the following link:
${verificationUrl}

This link will expire in 24 hours.

If you did not create an account, please ignore this email.
        `;

        return this.sendMail({
            to: email,
            subject: 'Verify Your Email Address',
            text,
            html
        });
    }

    /**
     * Send password reset email
     */
    public async sendPasswordResetEmail(email: string, token: string): Promise<SendMailResult> {
        const resetUrl = `${UtilityService.getInstance().getConstants('FRONTEND_URL')}/reset-password?token=${token}`;
        
        const html = `
            <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
                <h2>Password Reset Request</h2>
                <p>We received a request to reset your password for your Data Research Analysis Platform account.</p>
                <p>Click the button below to reset your password:</p>
                <p>
                    <a href="${resetUrl}" style="background-color: #2196F3; color: white; padding: 12px 24px; text-decoration: none; border-radius: 4px; display: inline-block;">
                        Reset Password
                    </a>
                </p>
                <p>Or copy and paste this link into your browser:</p>
                <p style="word-break: break-all;">${resetUrl}</p>
                <p>This link will expire in 1 hour.</p>
                <p>If you did not request a password reset, please ignore this email or contact support if you have concerns.</p>
            </div>
        `;

        const text = `
Password Reset Request

We received a request to reset your password for your Data Research Analysis Platform account.

Click the link below to reset your password:
${resetUrl}

This link will expire in 1 hour.

If you did not request a password reset, please ignore this email or contact support if you have concerns.
        `;

        return this.sendMail({
            to: email,
            subject: 'Password Reset Request',
            text,
            html
        });
    }

    /**
     * Send beta invitation email
     */
    public async sendBetaInvitation(email: string, invitationCode: string): Promise<SendMailResult> {
        const signupUrl = `${UtilityService.getInstance().getConstants('FRONTEND_URL')}/register?code=${invitationCode}`;
        
        const html = `
            <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
                <h2>You're Invited to Our Beta Program!</h2>
                <p>Congratulations! You've been selected to participate in the Data Research Analysis Platform beta program.</p>
                <p>Your exclusive invitation code is:</p>
                <div style="background-color: #f5f5f5; padding: 16px; border-radius: 4px; text-align: center; font-size: 24px; font-weight: bold; letter-spacing: 2px; margin: 20px 0;">
                    ${invitationCode}
                </div>
                <p>Click the button below to get started:</p>
                <p>
                    <a href="${signupUrl}" style="background-color: #FF9800; color: white; padding: 12px 24px; text-decoration: none; border-radius: 4px; display: inline-block;">
                        Join Beta Program
                    </a>
                </p>
                <p>Or copy and paste this link into your browser:</p>
                <p style="word-break: break-all;">${signupUrl}</p>
                <p>We're excited to have you on board!</p>
            </div>
        `;

        const text = `
You're Invited to Our Beta Program!

Congratulations! You've been selected to participate in the Data Research Analysis Platform beta program.

Your exclusive invitation code is: ${invitationCode}

Sign up here:
${signupUrl}

We're excited to have you on board!
        `;

        return this.sendMail({
            to: email,
            subject: 'Welcome to Data Research Analysis Beta!',
            text,
            html
        });
    }
}