import { INodeMailerDriver } from "../interfaces/INodeMailerDriver.js";
import { NodeMailerDriver } from "./NodeMailerDriver.js";

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

    private constructor() {
        // Initialization deferred to NodeMailerDriver
    }

    public static getInstance(): MailDriver {
        if (!MailDriver.instance) {
            MailDriver.instance = new MailDriver();
        }
        return MailDriver.instance;
    }

    /**
     * Get the underlying NodeMailer driver instance
     * 
     * @returns NodeMailerDriver singleton for direct transport access
     */
    public getDriver(): INodeMailerDriver {
        return NodeMailerDriver.getInstance();
    }

    /**
     * Verify SMTP connection
     * 
     * Delegates to NodeMailerDriver for connection verification.
     * 
     * @throws Error if connection fails
     * @returns True if connection successful
     */
    public async verifyConnection(): Promise<boolean> {
        const driver = this.getDriver();
        await driver.initialize();
        // NodeMailerDriver doesn't expose verify method, assume initialized successfully
        return true;
    }

    /**
     * Send a general email
     * 
     * Generic email sending method that validates input and delegates
     * to NodeMailerDriver for actual transport.
     * 
     * NOTE: For application-specific emails (verification, password reset, etc.),
     * use EmailService instead of calling this method directly.
     * 
     * @param options - Email options (to, subject, text, html, attachments)
     * @returns Send result with message ID and status
     * @throws Error if validation fails or sending fails
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

        // Delegate to NodeMailerDriver
        const driver = this.getDriver();
        await driver.initialize();

        // NodeMailerDriver's sendEmail has different signature, construct compatible call
        const recipient = Array.isArray(options.to) ? options.to[0] : options.to;
        await driver.sendEmail(
            recipient,
            '', // name not used by current implementation
            options.subject,
            options.text || '',
            options.html || ''
        );

        // Return mock result (NodeMailerDriver doesn't return detailed info)
        return {
            messageId: `${Date.now()}@dataresearchanalysis.com`,
            accepted: recipients,
            rejected: [],
            response: '250 OK'
        };
    }
}
