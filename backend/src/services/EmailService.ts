import nodemailer from 'nodemailer';
import { Queue, Worker } from 'bullmq';
import { getRedisClient } from '../config/redis.config.js';
import { renderEmailTemplate } from '../utils/emailTemplates.js';

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

export class EmailService {
    private static instance: EmailService;
    private transporter: nodemailer.Transporter;
    private emailQueue: Queue;
    private worker: Worker;
    
    private constructor() {
        // Initialize SMTP transporter
        this.transporter = nodemailer.createTransport({
            host: process.env.SMTP_HOST || 'smtp.gmail.com',
            port: parseInt(process.env.SMTP_PORT || '587'),
            secure: process.env.SMTP_SECURE === 'true',
            auth: {
                user: process.env.SMTP_USER,
                pass: process.env.SMTP_PASSWORD
            }
        });
        
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
                max: 10, // Max 10 emails per interval
                duration: 1000 // 1 second interval
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
            
            // Render template if provided
            if (options.template && options.templateData) {
                const rendered = await renderEmailTemplate(
                    options.template,
                    options.templateData
                );
                htmlContent = rendered.html;
                textContent = rendered.text;
            }
            
            const mailOptions = {
                from: `${process.env.EMAIL_FROM_NAME || 'Data Research Analysis'} <${process.env.EMAIL_FROM_ADDRESS || 'noreply@dataresearchanalysis.com'}>`,
                to: options.to,
                cc: options.cc,
                bcc: options.bcc,
                subject: options.subject,
                html: htmlContent,
                text: textContent,
                attachments: options.attachments
            };
            
            const info = await this.transporter.sendMail(mailOptions);
            console.log(`[EmailService] Email sent: ${info.messageId} to ${options.to}`);
        } catch (error: any) {
            console.error('[EmailService] Failed to send email:', error);
            throw error;
        }
    }
    
    /**
     * Verify SMTP connection
     */
    async verifyConnection(): Promise<boolean> {
        try {
            await this.transporter.verify();
            console.log('[EmailService] SMTP connection verified');
            return true;
        } catch (error) {
            console.error('[EmailService] SMTP connection failed:', error);
            return false;
        }
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

