/**
 * Email Service
 * Handles sending email notifications for sync completions, failures, and exports
 */

import nodemailer, { Transporter } from 'nodemailer';
import Handlebars from 'handlebars';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export interface EmailConfig {
    host: string;
    port: number;
    secure: boolean;
    auth: {
        user: string;
        pass: string;
    };
    from: string;
}

export interface SyncCompleteEmailData {
    reportType: string;
    networkCode: string;
    recordCount: number;
    duration: number;
    startDate?: string;
    endDate?: string;
    dataSourceName: string;
}

export interface SyncFailureEmailData {
    reportType: string;
    networkCode: string;
    error: string;
    dataSourceName: string;
    timestamp: string;
}

export interface ExportCompleteEmailData {
    reportType: string;
    format: string;
    fileName: string;
    fileSize: number;
    recordCount: number;
    downloadUrl: string;
    expiresAt: string;
}

export class EmailService {
    private transporter: Transporter | null = null;
    private emailConfig: EmailConfig | null = null;
    private templatesPath: string;
    private templates: Map<string, HandlebarsTemplateDelegate> = new Map();

    constructor() {
        this.templatesPath = path.join(__dirname, '../templates/emails');
        this.initialize();
    }

    /**
     * Initialize email service with configuration
     */
    private initialize(): void {
        try {
            // Load email configuration from environment variables
            const host = process.env.SMTP_HOST || 'localhost';
            const port = parseInt(process.env.SMTP_PORT || '587', 10);
            const secure = process.env.SMTP_SECURE === 'true';
            const user = process.env.SMTP_USER || '';
            const pass = process.env.SMTP_PASS || '';
            const from = process.env.SMTP_FROM || 'noreply@dataresearch.com';

            // Only initialize if SMTP is configured
            if (!user || !pass) {
                console.warn('⚠️  Email service not configured. Set SMTP_USER and SMTP_PASS environment variables.');
                return;
            }

            this.emailConfig = {
                host,
                port,
                secure,
                auth: { user, pass },
                from
            };

            // Create transporter
            this.transporter = nodemailer.createTransport({
                host: this.emailConfig.host,
                port: this.emailConfig.port,
                secure: this.emailConfig.secure,
                auth: {
                    user: this.emailConfig.auth.user,
                    pass: this.emailConfig.auth.pass
                }
            });

            console.log('✅ Email service initialized successfully');

            // Load email templates
            this.loadTemplates();
        } catch (error) {
            console.error('❌ Failed to initialize email service:', error);
        }
    }

    /**
     * Load email templates
     */
    private loadTemplates(): void {
        const templateFiles = [
            'sync-complete.html',
            'sync-failure.html',
            'export-complete.html'
        ];

        templateFiles.forEach(templateFile => {
            try {
                const templatePath = path.join(this.templatesPath, templateFile);
                
                // Check if template file exists
                if (fs.existsSync(templatePath)) {
                    const templateContent = fs.readFileSync(templatePath, 'utf-8');
                    const template = Handlebars.compile(templateContent);
                    const templateName = templateFile.replace('.html', '');
                    this.templates.set(templateName, template);
                    console.log(`✅ Loaded email template: ${templateName}`);
                }
            } catch (error) {
                console.error(`❌ Failed to load template ${templateFile}:`, error);
            }
        });

        // Register Handlebars helpers
        this.registerHandlebarsHelpers();
    }

    /**
     * Register Handlebars helpers
     */
    private registerHandlebarsHelpers(): void {
        Handlebars.registerHelper('formatNumber', (num: number) => {
            return num.toLocaleString();
        });

        Handlebars.registerHelper('formatDuration', (seconds: number) => {
            if (seconds < 60) return `${seconds}s`;
            const minutes = Math.floor(seconds / 60);
            const remainingSeconds = seconds % 60;
            return `${minutes}m ${remainingSeconds}s`;
        });

        Handlebars.registerHelper('formatFileSize', (bytes: number) => {
            if (bytes === 0) return '0 Bytes';
            const k = 1024;
            const sizes = ['Bytes', 'KB', 'MB', 'GB'];
            const i = Math.floor(Math.log(bytes) / Math.log(k));
            return Math.round((bytes / Math.pow(k, i)) * 100) / 100 + ' ' + sizes[i];
        });

        Handlebars.registerHelper('formatDate', (dateString: string) => {
            const date = new Date(dateString);
            return date.toLocaleString('en-US', {
                year: 'numeric',
                month: 'long',
                day: 'numeric',
                hour: '2-digit',
                minute: '2-digit'
            });
        });
    }

    /**
     * Send sync completion email
     */
    async sendSyncCompleteEmail(
        to: string | string[],
        data: SyncCompleteEmailData
    ): Promise<boolean> {
        if (!this.transporter || !this.emailConfig) {
            console.warn('⚠️  Email service not configured. Skipping email notification.');
            return false;
        }

        try {
            const template = this.templates.get('sync-complete');
            const html = template ? template(data) : this.getDefaultSyncCompleteTemplate(data);

            const subject = `✅ Sync Complete: ${data.reportType} - ${data.dataSourceName}`;

            await this.sendEmail(to, subject, html);
            console.log(`✅ Sent sync complete email to ${Array.isArray(to) ? to.join(', ') : to}`);
            return true;
        } catch (error) {
            console.error('❌ Failed to send sync complete email:', error);
            return false;
        }
    }

    /**
     * Send sync failure email
     */
    async sendSyncFailureEmail(
        to: string | string[],
        data: SyncFailureEmailData
    ): Promise<boolean> {
        if (!this.transporter || !this.emailConfig) {
            console.warn('⚠️  Email service not configured. Skipping email notification.');
            return false;
        }

        try {
            const template = this.templates.get('sync-failure');
            const html = template ? template(data) : this.getDefaultSyncFailureTemplate(data);

            const subject = `❌ Sync Failed: ${data.reportType} - ${data.dataSourceName}`;

            await this.sendEmail(to, subject, html);
            console.log(`✅ Sent sync failure email to ${Array.isArray(to) ? to.join(', ') : to}`);
            return true;
        } catch (error) {
            console.error('❌ Failed to send sync failure email:', error);
            return false;
        }
    }

    /**
     * Send export completion email
     */
    async sendExportCompleteEmail(
        to: string | string[],
        data: ExportCompleteEmailData
    ): Promise<boolean> {
        if (!this.transporter || !this.emailConfig) {
            console.warn('⚠️  Email service not configured. Skipping email notification.');
            return false;
        }

        try {
            const template = this.templates.get('export-complete');
            const html = template ? template(data) : this.getDefaultExportCompleteTemplate(data);

            const subject = `📊 Export Ready: ${data.reportType} (${data.format.toUpperCase()})`;

            await this.sendEmail(to, subject, html);
            console.log(`✅ Sent export complete email to ${Array.isArray(to) ? to.join(', ') : to}`);
            return true;
        } catch (error) {
            console.error('❌ Failed to send export complete email:', error);
            return false;
        }
    }

    /**
     * Send email using configured transporter
     */
    private async sendEmail(
        to: string | string[],
        subject: string,
        html: string
    ): Promise<void> {
        if (!this.transporter || !this.emailConfig) {
            throw new Error('Email service not configured');
        }

        const recipients = Array.isArray(to) ? to.join(', ') : to;

        await this.transporter.sendMail({
            from: this.emailConfig.from,
            to: recipients,
            subject,
            html
        });
    }

    /**
     * Test email configuration
     */
    async testConnection(): Promise<boolean> {
        if (!this.transporter) {
            throw new Error('Email service not configured');
        }

        try {
            await this.transporter.verify();
            console.log('✅ Email connection test successful');
            return true;
        } catch (error) {
            console.error('❌ Email connection test failed:', error);
            return false;
        }
    }

    /**
     * Send test email
     */
    async sendTestEmail(to: string): Promise<boolean> {
        if (!this.transporter || !this.emailConfig) {
            throw new Error('Email service not configured');
        }

        try {
            const html = `
                <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
                    <h2 style="color: #2563eb;">Test Email</h2>
                    <p>This is a test email from the Data Research Analysis system.</p>
                    <p>If you received this email, your email configuration is working correctly.</p>
                    <p style="color: #666; font-size: 12px; margin-top: 30px;">
                        Sent at: ${new Date().toLocaleString()}
                    </p>
                </div>
            `;

            await this.sendEmail(to, 'Test Email - Data Research Analysis', html);
            console.log(`✅ Sent test email to ${to}`);
            return true;
        } catch (error) {
            console.error('❌ Failed to send test email:', error);
            return false;
        }
    }

    /**
     * Default sync complete template (fallback)
     */
    private getDefaultSyncCompleteTemplate(data: SyncCompleteEmailData): string {
        return `
            <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
                <div style="background-color: #10b981; color: white; padding: 20px; border-radius: 8px 8px 0 0;">
                    <h2 style="margin: 0;">✅ Sync Completed Successfully</h2>
                </div>
                <div style="background-color: #f9fafb; padding: 20px; border: 1px solid #e5e7eb; border-top: none; border-radius: 0 0 8px 8px;">
                    <h3 style="color: #1f2937; margin-top: 0;">Sync Details</h3>
                    <table style="width: 100%; border-collapse: collapse;">
                        <tr>
                            <td style="padding: 8px 0; color: #6b7280; font-weight: bold;">Data Source:</td>
                            <td style="padding: 8px 0; color: #1f2937;">${data.dataSourceName}</td>
                        </tr>
                        <tr>
                            <td style="padding: 8px 0; color: #6b7280; font-weight: bold;">Report Type:</td>
                            <td style="padding: 8px 0; color: #1f2937;">${data.reportType}</td>
                        </tr>
                        <tr>
                            <td style="padding: 8px 0; color: #6b7280; font-weight: bold;">Network Code:</td>
                            <td style="padding: 8px 0; color: #1f2937;">${data.networkCode}</td>
                        </tr>
                        <tr>
                            <td style="padding: 8px 0; color: #6b7280; font-weight: bold;">Records Synced:</td>
                            <td style="padding: 8px 0; color: #1f2937;">${data.recordCount.toLocaleString()}</td>
                        </tr>
                        <tr>
                            <td style="padding: 8px 0; color: #6b7280; font-weight: bold;">Duration:</td>
                            <td style="padding: 8px 0; color: #1f2937;">${this.formatDuration(data.duration)}</td>
                        </tr>
                        ${data.startDate ? `
                        <tr>
                            <td style="padding: 8px 0; color: #6b7280; font-weight: bold;">Date Range:</td>
                            <td style="padding: 8px 0; color: #1f2937;">${data.startDate} to ${data.endDate || 'now'}</td>
                        </tr>
                        ` : ''}
                    </table>
                    <p style="color: #6b7280; font-size: 12px; margin-top: 30px; text-align: center;">
                        This is an automated notification from Data Research Analysis System
                    </p>
                </div>
            </div>
        `;
    }

    /**
     * Default sync failure template (fallback)
     */
    private getDefaultSyncFailureTemplate(data: SyncFailureEmailData): string {
        return `
            <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
                <div style="background-color: #ef4444; color: white; padding: 20px; border-radius: 8px 8px 0 0;">
                    <h2 style="margin: 0;">❌ Sync Failed</h2>
                </div>
                <div style="background-color: #f9fafb; padding: 20px; border: 1px solid #e5e7eb; border-top: none; border-radius: 0 0 8px 8px;">
                    <h3 style="color: #1f2937; margin-top: 0;">Failure Details</h3>
                    <table style="width: 100%; border-collapse: collapse;">
                        <tr>
                            <td style="padding: 8px 0; color: #6b7280; font-weight: bold;">Data Source:</td>
                            <td style="padding: 8px 0; color: #1f2937;">${data.dataSourceName}</td>
                        </tr>
                        <tr>
                            <td style="padding: 8px 0; color: #6b7280; font-weight: bold;">Report Type:</td>
                            <td style="padding: 8px 0; color: #1f2937;">${data.reportType}</td>
                        </tr>
                        <tr>
                            <td style="padding: 8px 0; color: #6b7280; font-weight: bold;">Network Code:</td>
                            <td style="padding: 8px 0; color: #1f2937;">${data.networkCode}</td>
                        </tr>
                        <tr>
                            <td style="padding: 8px 0; color: #6b7280; font-weight: bold;">Timestamp:</td>
                            <td style="padding: 8px 0; color: #1f2937;">${data.timestamp}</td>
                        </tr>
                    </table>
                    <div style="background-color: #fee2e2; border-left: 4px solid #ef4444; padding: 15px; margin-top: 20px; border-radius: 4px;">
                        <h4 style="color: #991b1b; margin: 0 0 10px 0;">Error Message:</h4>
                        <p style="color: #7f1d1d; margin: 0; font-family: monospace; word-break: break-word;">${data.error}</p>
                    </div>
                    <p style="color: #6b7280; font-size: 12px; margin-top: 30px; text-align: center;">
                        This is an automated notification from Data Research Analysis System
                    </p>
                </div>
            </div>
        `;
    }

    /**
     * Default export complete template (fallback)
     */
    private getDefaultExportCompleteTemplate(data: ExportCompleteEmailData): string {
        return `
            <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
                <div style="background-color: #2563eb; color: white; padding: 20px; border-radius: 8px 8px 0 0;">
                    <h2 style="margin: 0;">📊 Export Ready for Download</h2>
                </div>
                <div style="background-color: #f9fafb; padding: 20px; border: 1px solid #e5e7eb; border-top: none; border-radius: 0 0 8px 8px;">
                    <h3 style="color: #1f2937; margin-top: 0;">Export Details</h3>
                    <table style="width: 100%; border-collapse: collapse;">
                        <tr>
                            <td style="padding: 8px 0; color: #6b7280; font-weight: bold;">Report Type:</td>
                            <td style="padding: 8px 0; color: #1f2937;">${data.reportType}</td>
                        </tr>
                        <tr>
                            <td style="padding: 8px 0; color: #6b7280; font-weight: bold;">Format:</td>
                            <td style="padding: 8px 0; color: #1f2937;">${data.format.toUpperCase()}</td>
                        </tr>
                        <tr>
                            <td style="padding: 8px 0; color: #6b7280; font-weight: bold;">File Name:</td>
                            <td style="padding: 8px 0; color: #1f2937;">${data.fileName}</td>
                        </tr>
                        <tr>
                            <td style="padding: 8px 0; color: #6b7280; font-weight: bold;">File Size:</td>
                            <td style="padding: 8px 0; color: #1f2937;">${this.formatFileSize(data.fileSize)}</td>
                        </tr>
                        <tr>
                            <td style="padding: 8px 0; color: #6b7280; font-weight: bold;">Record Count:</td>
                            <td style="padding: 8px 0; color: #1f2937;">${data.recordCount.toLocaleString()}</td>
                        </tr>
                        <tr>
                            <td style="padding: 8px 0; color: #6b7280; font-weight: bold;">Expires:</td>
                            <td style="padding: 8px 0; color: #1f2937;">${data.expiresAt}</td>
                        </tr>
                    </table>
                    <div style="text-align: center; margin-top: 30px;">
                        <a href="${data.downloadUrl}" style="display: inline-block; background-color: #2563eb; color: white; padding: 12px 30px; text-decoration: none; border-radius: 6px; font-weight: bold;">
                            Download Export
                        </a>
                    </div>
                    <p style="color: #6b7280; font-size: 12px; margin-top: 30px; text-align: center;">
                        This file will be automatically deleted after 7 days<br>
                        This is an automated notification from Data Research Analysis System
                    </p>
                </div>
            </div>
        `;
    }

    /**
     * Format duration helper
     */
    private formatDuration(seconds: number): string {
        if (seconds < 60) return `${seconds}s`;
        const minutes = Math.floor(seconds / 60);
        const remainingSeconds = seconds % 60;
        return `${minutes}m ${remainingSeconds}s`;
    }

    /**
     * Format file size helper
     */
    private formatFileSize(bytes: number): string {
        if (bytes === 0) return '0 Bytes';
        const k = 1024;
        const sizes = ['Bytes', 'KB', 'MB', 'GB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return Math.round((bytes / Math.pow(k, i)) * 100) / 100 + ' ' + sizes[i];
    }

    /**
     * Check if email service is configured
     */
    isConfigured(): boolean {
        return this.transporter !== null && this.emailConfig !== null;
    }
}

// Export singleton instance
export const emailService = new EmailService();
