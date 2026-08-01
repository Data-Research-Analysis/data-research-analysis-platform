import path from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';
import { createHash } from 'crypto';
import { DBDriver } from '../drivers/DBDriver.js';
import { EDataSourceType } from '../types/EDataSourceType.js';
import { DRAEmailFunnel } from '../models/DRAEmailFunnel.js';
import { DRAEmailFunnelStep } from '../models/DRAEmailFunnelStep.js';
import { DRAEmailFunnelEnrollment } from '../models/DRAEmailFunnelEnrollment.js';
import { DRAEmailFunnelSentLog } from '../models/DRAEmailFunnelSentLog.js';
import { DRAEmailFunnelUnsubscribe } from '../models/DRAEmailFunnelUnsubscribe.js';
import { DRABlogSubscriber } from '../models/DRABlogSubscriber.js';
import { DRAEmailBroadcast } from '../models/DRAEmailBroadcast.js';
import { DRAEmailBroadcastLog } from '../models/DRAEmailBroadcastLog.js';
import { DRAUsersPlatform } from '../models/DRAUsersPlatform.js';
import { DRALeadGeneratorLead } from '../models/DRALeadGeneratorLead.js';
import { DRAEnterpriseQuery } from '../models/DRAEnterpriseQuery.js';
import { DRAEnterpriseContactRequest } from '../models/DRAEnterpriseContactRequest.js';
import { DRALeadGenerator } from '../models/DRALeadGenerator.js';
import { DRALeadGeneratorRelatedResource } from '../models/DRALeadGeneratorRelatedResource.js';
import { EmailService } from '../services/EmailService.js';
import { TemplateEngineService } from '../services/TemplateEngineService.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const UNSUBSCRIBE_SECRET = process.env.EMAIL_FUNNEL_UNSUBSCRIBE_SECRET || 'email-funnel-secret';

const projectRoot = path.resolve(__dirname, '..');

export class EmailFunnelProcessor {
    private static instance: EmailFunnelProcessor;

    private dailySentCount: number = 0;
    private dailySentDate: string = '';
    private readonly dailyLimit: number = parseInt(process.env.EMAIL_FUNNEL_DAILY_LIMIT || '200', 10);

    private constructor() {}

    public static getInstance(): EmailFunnelProcessor {
        if (!EmailFunnelProcessor.instance) {
            EmailFunnelProcessor.instance = new EmailFunnelProcessor();
        }
        return EmailFunnelProcessor.instance;
    }

    private async getManager() {
        const driver = await DBDriver.getInstance().getDriver(EDataSourceType.POSTGRESQL);
        if (!driver) throw new Error('Database driver not available');
        return (await driver.getConcreteDriver()).manager;
    }

    // ----------------------------------------------------------------
    // Funnel CRUD
    // ----------------------------------------------------------------

    async getFunnels(): Promise<DRAEmailFunnel[]> {
        const manager = await this.getManager();
        return manager.find(DRAEmailFunnel, { order: { created_at: 'DESC' } });
    }

    async getFunnel(id: number): Promise<DRAEmailFunnel> {
        const manager = await this.getManager();
        return manager.findOneOrFail(DRAEmailFunnel, { where: { id } });
    }

    async getFunnelBySlug(slug: string): Promise<DRAEmailFunnel | null> {
        const manager = await this.getManager();
        return manager.findOne(DRAEmailFunnel, { where: { slug, is_active: true } });
    }

    async createFunnel(params: {
        name: string; slug: string; trigger_type: string; target_user_type: string;
    }): Promise<DRAEmailFunnel> {
        const manager = await this.getManager();
        const funnel = manager.create(DRAEmailFunnel, params);
        return manager.save(funnel);
    }

    async updateFunnel(id: number, params: Partial<{
        name: string; slug: string; trigger_type: string; target_user_type: string; is_active: boolean;
    }>): Promise<DRAEmailFunnel> {
        const manager = await this.getManager();
        const funnel = await manager.findOneOrFail(DRAEmailFunnel, { where: { id } });
        Object.assign(funnel, params);
        return manager.save(funnel);
    }

    // ----------------------------------------------------------------
    // Step CRUD
    // ----------------------------------------------------------------

    async getSteps(funnelId: number): Promise<DRAEmailFunnelStep[]> {
        const manager = await this.getManager();
        return manager.find(DRAEmailFunnelStep, {
            where: { funnel_id: funnelId },
            order: { step_order: 'ASC' },
        });
    }

    async createStep(params: {
        funnel_id: number; step_order: number; delay_hours: number;
        template_file: string; subject_template: string;
    }): Promise<DRAEmailFunnelStep> {
        const manager = await this.getManager();
        const step = manager.create(DRAEmailFunnelStep, params);
        return manager.save(step);
    }

    async updateStep(id: number, params: Partial<{
        step_order: number; delay_hours: number; template_file: string;
        subject_template: string; is_active: boolean;
    }>): Promise<DRAEmailFunnelStep> {
        const manager = await this.getManager();
        const step = await manager.findOneOrFail(DRAEmailFunnelStep, { where: { id } });
        Object.assign(step, params);
        return manager.save(step);
    }

    async deleteStep(id: number): Promise<void> {
        const manager = await this.getManager();
        await manager.delete(DRAEmailFunnelStep, { id });
    }

    // ----------------------------------------------------------------
    // Enrollment
    // ----------------------------------------------------------------

    async enroll(params: {
        funnelId: number;
        leadEmail: string;
        leadName?: string;
        leadGeneratorId?: number;
        userId?: number;
    }): Promise<DRAEmailFunnelEnrollment> {
        const manager = await this.getManager();
        const steps = await manager.find(DRAEmailFunnelStep, {
            where: { funnel_id: params.funnelId, is_active: true },
            order: { step_order: 'ASC' },
        });

        if (!steps.length) {
            throw new Error('Funnel has no active steps');
        }

        const existing = await manager.findOne(DRAEmailFunnelEnrollment, {
            where: {
                funnel_id: params.funnelId,
                lead_email: params.leadEmail,
                lead_generator_id: params.leadGeneratorId || null,
                is_active: true,
            },
        });
        if (existing) return existing;

        const enrollment = manager.create(DRAEmailFunnelEnrollment, {
            funnel_id: params.funnelId,
            lead_email: params.leadEmail,
            lead_name: params.leadName || null,
            lead_generator_id: params.leadGeneratorId || null,
            user_id: params.userId || null,
            current_step: 0,
            total_steps: steps.length,
            is_active: true,
        });
        return manager.save(enrollment);
    }

    async getEnrollments(funnelId?: number, filters?: {
        page?: number; limit?: number; isActive?: boolean;
    }): Promise<{ data: DRAEmailFunnelEnrollment[]; total: number }> {
        const manager = await this.getManager();
        const page = filters?.page || 1;
        const limit = filters?.limit || 50;
        const where: any = {};
        if (funnelId) where.funnel_id = funnelId;
        if (filters?.isActive !== undefined) where.is_active = filters.isActive;

        const [data, total] = await manager.findAndCount(DRAEmailFunnelEnrollment, {
            where,
            order: { started_at: 'DESC' },
            skip: (page - 1) * limit,
            take: limit,
        });
        return { data, total };
    }

    // ----------------------------------------------------------------
    // Sending Engine
    // ----------------------------------------------------------------

    async processReadySteps(): Promise<number> {
        const manager = await this.getManager();

        if (!this.checkDailyLimit()) {
            console.log('[EmailFunnelProcessor] Daily limit reached, skipping');
            return 0;
        }

        const readyEnrollments = await manager.find(DRAEmailFunnelEnrollment, {
            where: {
                is_active: true,
                completed_at: null,
            },
            relations: ['funnel'],
        });

        let sent = 0;
        for (const enrollment of readyEnrollments) {
            if (!this.checkDailyLimit()) break;

            const steps = await manager.find(DRAEmailFunnelStep, {
                where: { funnel_id: enrollment.funnel_id, is_active: true },
                order: { step_order: 'ASC' },
            });

            if (enrollment.current_step >= steps.length) {
                enrollment.is_active = false;
                enrollment.completed_at = new Date();
                await manager.save(enrollment);
                continue;
            }

            const step = steps[enrollment.current_step];
            const shouldSend = this.isStepReady(enrollment, step);
            if (!shouldSend) continue;

            try {
                await this.sendStep(enrollment, step);
                enrollment.current_step += 1;
                enrollment.last_sent_at = new Date();

                if (enrollment.current_step >= steps.length) {
                    enrollment.is_active = false;
                    enrollment.completed_at = new Date();
                }

                await manager.save(enrollment);
                sent++;
                this.incrementDailyCount();
            } catch (err: any) {
                console.error(`[EmailFunnelProcessor] Failed to send step ${step.id} for enrollment ${enrollment.id}:`, err.message);
                const log = manager.create(DRAEmailFunnelSentLog, {
                    enrollment_id: enrollment.id,
                    step_id: step.id,
                    sent_at: new Date(),
                    error: err.message,
                });
                await manager.save(log);
            }
        }

        return sent;
    }

    private isStepReady(enrollment: DRAEmailFunnelEnrollment, step: DRAEmailFunnelStep): boolean {
        const now = Date.now();
        const stepIndex = enrollment.current_step;
        const totalDelay = step.delay_hours * 60 * 60 * 1000;

        if (stepIndex === 0) {
            return now >= enrollment.started_at.getTime() + totalDelay;
        }

        if (enrollment.last_sent_at) {
            return now >= enrollment.last_sent_at.getTime() + totalDelay;
        }

        return true;
    }

    private async sendStep(enrollment: DRAEmailFunnelEnrollment, step: DRAEmailFunnelStep): Promise<void> {
        const manager = await this.getManager();

        const templatePath = path.join(projectRoot, 'templates', step.template_file);
        const templateName = path.basename(templatePath);

        const unsubscribeToken = this.generateUnsubscribeToken(enrollment.lead_email, enrollment.funnel_id);
        const unsubscribeUrl = `${process.env.BACKEND_URL || 'http://localhost:3002'}/email-funnels/unsubscribe?token=${unsubscribeToken}&email=${encodeURIComponent(enrollment.lead_email)}&funnel_id=${enrollment.funnel_id}`;

        const firstName = enrollment.lead_name?.split(' ')[0] || 'there';
        const frontendUrl = process.env.FRONTEND_URL || process.env.SOCKETIO_CLIENT_URL || 'http://localhost:3000';
        const supportEmail = process.env.MAIL_REPLY_TO || 'support@dataresearchanalysis.com';

        // Resolve lead generator info and related resources
        let pdfTitle = '';
        let relatedResources: { url: string; title: string }[] = [];
        if (enrollment.lead_generator_id) {
            const leadGen = await manager.findOne(DRALeadGenerator, {
                where: { id: enrollment.lead_generator_id },
            });
            if (leadGen) {
                pdfTitle = leadGen.title;
                const resources = await manager.find(DRALeadGeneratorRelatedResource, {
                    where: { lead_generator_id: enrollment.lead_generator_id },
                    order: { sort_order: 'ASC' },
                });
                relatedResources = resources.map((r) => ({
                    url: `${frontendUrl}/resources/${r.related_id}`,
                    title: `${r.related_type} #${r.related_id}`,
                }));
            }
        }

        const html = await TemplateEngineService.getInstance().render(templateName, [
            { key: 'first_name', value: firstName },
            { key: 'subscriber_name', value: firstName },
            { key: 'lead_name', value: enrollment.lead_name || firstName },
            { key: 'lead_email', value: enrollment.lead_email },
            { key: 'pdf_title', value: pdfTitle },
            { key: 'support_email', value: supportEmail },
            { key: 'frontend_url', value: frontendUrl },
            { key: 'current_year', value: String(new Date().getFullYear()) },
            { key: 'unsubscribe_url', value: unsubscribeUrl },
            { key: 'unsubscribe_code', value: '' },
            { key: 'related_resources', value: JSON.stringify(relatedResources) },
            { key: 'tracking_pixel', value: `${process.env.BACKEND_URL || 'http://localhost:3002'}/email-funnels/track/open?enrollment_id=${enrollment.id}&step_id=${step.id}` },
        ]);

        const subject = step.subject_template.replace(/\{\{first_name\}\}/g, firstName)
            .replace(/\{\{pdf_title\}\}/g, pdfTitle);

        await EmailService.getInstance().sendEmail({
            to: enrollment.lead_email,
            subject,
            html,
            text: `Hi ${firstName},\n\nThank you for your interest.\n\n${unsubscribeUrl}`,
        });

        const log = manager.create(DRAEmailFunnelSentLog, {
            enrollment_id: enrollment.id,
            step_id: step.id,
            sent_at: new Date(),
        });
        await manager.save(log);
    }

    // ----------------------------------------------------------------
    // Unsubscribe
    // ----------------------------------------------------------------

    generateUnsubscribeToken(email: string, funnelId: number): string {
        return createHash('sha256')
            .update(`${email}:${funnelId}:${UNSUBSCRIBE_SECRET}`)
            .digest('hex');
    }

    async unsubscribe(email: string, funnelId: number | null, token: string): Promise<boolean> {
        const expectedToken = this.generateUnsubscribeToken(email, funnelId || 0);
        if (token !== expectedToken) return false;

        const manager = await this.getManager();

        const existing = await manager.findOne(DRAEmailFunnelUnsubscribe, {
            where: { email, funnel_id: funnelId || null },
        });
        if (existing) return true;

        await manager.save(manager.create(DRAEmailFunnelUnsubscribe, {
            email, funnel_id: funnelId || null, token,
        }));

        if (funnelId) {
            await manager.update(DRAEmailFunnelEnrollment, {
                lead_email: email, funnel_id: funnelId, is_active: true,
            }, { is_active: false });
        }

        return true;
    }

    async isUnsubscribed(email: string, funnelId: number): Promise<boolean> {
        const manager = await this.getManager();
        const result = await manager.findOne(DRAEmailFunnelUnsubscribe, {
            where: [
                { email, funnel_id: funnelId },
                { email, funnel_id: null },
            ],
        });
        return !!result;
    }

    async getUnsubscribes(page: number = 1, limit: number = 50): Promise<{ data: DRAEmailFunnelUnsubscribe[]; total: number }> {
        const manager = await this.getManager();
        const [data, total] = await manager.findAndCount(DRAEmailFunnelUnsubscribe, {
            order: { unsubscribed_at: 'DESC' },
            skip: (page - 1) * limit,
            take: limit,
        });
        return { data, total };
    }

    // ----------------------------------------------------------------
    // Blog Subscribers
    // ----------------------------------------------------------------

    async subscribeToBlog(email: string, name?: string): Promise<DRABlogSubscriber> {
        const manager = await this.getManager();
        const existing = await manager.findOne(DRABlogSubscriber, { where: { email } });
        if (existing) return existing;

        const subscriber = manager.create(DRABlogSubscriber, { email, name: name || null });
        return manager.save(subscriber);
    }

    // ----------------------------------------------------------------
    // New Article Notifications
    // ----------------------------------------------------------------

    async sendNewArticleToBlogSubscribers(articleTitle: string, articleSlug: string, articleExcerpt: string): Promise<number> {
        const manager = await this.getManager();

        if (!this.checkDailyLimit()) {
            console.log('[EmailFunnelProcessor] Daily limit reached, skipping new article broadcast');
            return 0;
        }

        const subscribers = await manager.find(DRABlogSubscriber, {});

        const blogFunnel = await this.getFunnelBySlug('blog-subscriber');
        const frontendUrl = process.env.FRONTEND_URL || process.env.SOCKETIO_CLIENT_URL || 'http://localhost:3000';
        const supportEmail = process.env.MAIL_REPLY_TO || 'support@dataresearchanalysis.com';
        const templateName = 'blog-subscriber-new-article.html';

        let sent = 0;
        for (const subscriber of subscribers) {
            if (!this.checkDailyLimit()) break;

            const firstName = subscriber.name?.split(' ')[0] || 'there';
            const unsubscribeToken = this.generateUnsubscribeToken(subscriber.email, blogFunnel?.id || 0);
            const unsubscribeUrl = `${process.env.BACKEND_URL || 'http://localhost:3002'}/email-funnels/unsubscribe?token=${unsubscribeToken}&email=${encodeURIComponent(subscriber.email)}&funnel_id=${blogFunnel?.id || 0}`;

            try {
                const html = await TemplateEngineService.getInstance().render(templateName, [
                    { key: 'subscriber_name', value: firstName },
                    { key: 'article_title', value: articleTitle },
                    { key: 'article_slug', value: articleSlug },
                    { key: 'article_excerpt', value: articleExcerpt },
                    { key: 'support_email', value: supportEmail },
                    { key: 'frontend_url', value: frontendUrl },
                    { key: 'current_year', value: String(new Date().getFullYear()) },
                    { key: 'unsubscribe_url', value: unsubscribeUrl },
                    { key: 'tracking_pixel', value: `${process.env.BACKEND_URL || 'http://localhost:3002'}/email-funnels/track/open?enrollment_id=0&step_id=0` },
                ]);

                await EmailService.getInstance().sendEmail({
                    to: subscriber.email,
                    subject: `New Article: ${articleTitle}`,
                    html,
                    text: `Hi ${firstName},\n\nWe just published: ${articleTitle}\n\n${frontendUrl}/articles/${articleSlug}\n\n${unsubscribeUrl}`,
                });

                sent++;
                this.incrementDailyCount();
            } catch (err: any) {
                console.error(`[EmailFunnelProcessor] Failed to send new article notification to ${subscriber.email}:`, err.message);
            }
        }

        return sent;
    }

    // ----------------------------------------------------------------
    // Broadcasts (admin-scheduled one-off emails)
    // ----------------------------------------------------------------

    async createBroadcast(params: {
        subject: string;
        template_file: string;
        template_data: string;
        audience: string;
        scheduled_at?: string;
    }): Promise<DRAEmailBroadcast> {
        const manager = await this.getManager();
        const broadcast = manager.create(DRAEmailBroadcast, {
            subject: params.subject,
            template_file: params.template_file,
            template_data: params.template_data,
            audience: params.audience,
            scheduled_at: params.scheduled_at ? new Date(params.scheduled_at) : null,
            status: 'pending',
            sent_count: 0,
            total_count: 0,
        });
        return manager.save(broadcast);
    }

    async getBroadcasts(): Promise<DRAEmailBroadcast[]> {
        const manager = await this.getManager();
        return manager.find(DRAEmailBroadcast, { order: { created_at: 'DESC' } });
    }

    async deleteBroadcast(id: number): Promise<boolean> {
        const manager = await this.getManager();
        const result = await manager.delete(DRAEmailBroadcast, { id });
        return (result.affected ?? 0) > 0;
    }

    async getBroadcastById(id: number): Promise<DRAEmailBroadcast | null> {
        const manager = await this.getManager();
        return manager.findOne(DRAEmailBroadcast, { where: { id } });
    }

    async toggleBroadcastPause(id: number): Promise<DRAEmailBroadcast | null> {
        const manager = await this.getManager();
        const broadcast = await manager.findOne(DRAEmailBroadcast, { where: { id } });
        if (!broadcast || broadcast.status === 'sent') return null;
        broadcast.paused = !broadcast.paused;
        return manager.save(broadcast);
    }

    private async resolveSubscribers(audienceKey: string, manager: any): Promise<{ email: string; name: string | null }[]> {
        if (audienceKey === 'blog_subscribers') {
            const rows = await manager.find(DRABlogSubscriber, {});
            return rows.map(r => ({ email: r.email, name: r.name }));
        } else if (audienceKey === 'registered_users') {
            const rows = await manager.find(DRAUsersPlatform, {
                where: { unsubscribe_from_emails_at: null },
            });
            return rows.map(r => ({ email: r.email, name: `${r.first_name} ${r.last_name}` }));
        } else if (audienceKey === 'lead_generator_downloads') {
            const rows = await manager.find(DRALeadGeneratorLead, {});
            return rows.map(r => ({ email: r.email, name: r.full_name }));
        } else if (audienceKey === 'enterprise_queries') {
            const rows = await manager.find(DRAEnterpriseQuery, {
                where: { agree_to_receive_updates: true },
            });
            return rows.map(r => ({ email: r.business_email, name: `${r.first_name} ${r.last_name}` }));
        } else if (audienceKey === 'enterprise_contact_requests') {
            const rows = await manager.find(DRAEnterpriseContactRequest, { relations: ['user'] });
            return rows.map(r => ({
                email: r.user.email,
                name: `${r.user.first_name} ${r.user.last_name}`,
            }));
        }
        return [];
    }

    async processBroadcasts(): Promise<number> {
        const manager = await this.getManager();

        if (!this.checkDailyLimit()) return 0;

        const due = await manager.find(DRAEmailBroadcast, {
            where: {
                status: 'pending',
                paused: false,
                scheduled_at: null,
            },
        });
        const scheduledDue = await manager.createQueryBuilder(DRAEmailBroadcast, 'b')
            .where("b.status = 'pending'")
            .andWhere('b.paused = false')
            .andWhere('b.scheduled_at IS NOT NULL')
            .andWhere('b.scheduled_at <= :now', { now: new Date() })
            .getMany();

        const inProgress = await manager.find(DRAEmailBroadcast, {
            where: {
                status: 'in_progress',
                paused: false,
            },
        });

        const broadcasts = [...due, ...scheduledDue, ...inProgress];
        if (!broadcasts.length) return 0;

        const frontendUrl = process.env.FRONTEND_URL || process.env.SOCKETIO_CLIENT_URL || 'http://localhost:3000';
        const supportEmail = process.env.MAIL_REPLY_TO || 'support@dataresearchanalysis.com';
        const blogFunnel = await this.getFunnelBySlug('blog-subscriber');

        let totalSent = 0;
        for (const broadcast of broadcasts) {
            const templateDataObj: Record<string, string> = (() => {
                try { return JSON.parse(broadcast.template_data); } catch { return {}; }
            })();
            const audienceKey = broadcast.audience || 'blog_subscribers';

            const subscribers = await this.resolveSubscribers(audienceKey, manager);
            if (broadcast.status === 'pending') {
                broadcast.total_count = subscribers.length;
                broadcast.status = 'in_progress';
                await manager.save(broadcast);
            }

            for (let i = broadcast.sent_count; i < subscribers.length; i++) {
                if (!this.checkDailyLimit()) break;
                const sub = subscribers[i];

                const firstName = sub.name?.split(' ')[0] || 'there';
                const unsubscribeToken = this.generateUnsubscribeToken(sub.email, blogFunnel?.id || 0);
                const unsubscribeUrl = `${process.env.BACKEND_URL || 'http://localhost:3002'}/email-funnels/unsubscribe?token=${unsubscribeToken}&email=${encodeURIComponent(sub.email)}&funnel_id=${blogFunnel?.id || 0}`;

                try {
                    const subject = broadcast.subject.replace(/\{\{first_name\}\}/g, firstName);

                    // Create log entry first to get an ID for tracking
                    const log = manager.create(DRAEmailBroadcastLog, {
                        broadcast_id: broadcast.id,
                        recipient_email: sub.email,
                        recipient_name: sub.name,
                        subject,
                    });
                    await manager.save(log);

                    const trackingPixel = `${process.env.BACKEND_URL || 'http://localhost:3002'}/email-funnels/track/broadcast-open?log_id=${log.id}`;
                    const trackingClickUrl = `${process.env.BACKEND_URL || 'http://localhost:3002'}/email-funnels/track/broadcast-click?log_id=${log.id}&redirect=`;

                    const replacements = [
                        { key: 'subscriber_name', value: firstName },
                        { key: 'first_name', value: firstName },
                        { key: 'subject', value: subject },
                        { key: 'support_email', value: supportEmail },
                        { key: 'frontend_url', value: frontendUrl },
                        { key: 'current_year', value: String(new Date().getFullYear()) },
                        { key: 'unsubscribe_url', value: unsubscribeUrl },
                        { key: 'tracking_pixel', value: trackingPixel },
                        { key: 'tracking_click_url', value: trackingClickUrl },
                    ];
                    for (const [k, v] of Object.entries(templateDataObj)) {
                        replacements.push({ key: k, value: v });
                    }

                    const html = await TemplateEngineService.getInstance().render(broadcast.template_file, replacements);

                    await EmailService.getInstance().sendEmail({
                        to: sub.email,
                        subject,
                        html,
                        text: `Hi ${firstName},\n\n${unsubscribeUrl}`,
                    });

                    broadcast.sent_count += 1;
                    this.incrementDailyCount();
                    totalSent++;
                } catch (err: any) {
                    console.error(`[EmailFunnelProcessor] Broadcast ${broadcast.id} failed for ${sub.email}:`, err.message);
                    // Update the log entry with error if one was created
                    try {
                        const failedLog = await manager.findOne(DRAEmailBroadcastLog, {
                            where: { broadcast_id: broadcast.id, recipient_email: sub.email, error: null },
                            order: { sent_at: 'DESC' },
                        });
                        if (failedLog) {
                            failedLog.error = err.message;
                            await manager.save(failedLog);
                        }
                    } catch {}
                }
            }

            if (broadcast.sent_count >= broadcast.total_count) {
                broadcast.status = 'sent';
                broadcast.sent_at = new Date();
            }

            await manager.save(broadcast);
        }

        return totalSent;
    }

    // ----------------------------------------------------------------
    // Tracking
    // ----------------------------------------------------------------

    async trackOpen(enrollmentId: number, stepId: number): Promise<void> {
        const manager = await this.getManager();
        const log = await manager.findOne(DRAEmailFunnelSentLog, {
            where: { enrollment_id: enrollmentId, step_id: stepId, opened_at: null },
            order: { sent_at: 'DESC' },
        });
        if (log) {
            log.opened_at = new Date();
            await manager.save(log);
        }
    }

    async trackClick(enrollmentId: number, stepId: number): Promise<void> {
        const manager = await this.getManager();
        const log = await manager.findOne(DRAEmailFunnelSentLog, {
            where: { enrollment_id: enrollmentId, step_id: stepId, clicked_at: null },
            order: { sent_at: 'DESC' },
        });
        if (log) {
            log.clicked_at = new Date();
            await manager.save(log);
        }
    }

    async trackBroadcastOpen(logId: number): Promise<void> {
        const manager = await this.getManager();
        const log = await manager.findOne(DRAEmailBroadcastLog, {
            where: { id: logId, opened_at: null },
        });
        if (log) {
            log.opened_at = new Date();
            await manager.save(log);
        }
    }

    async trackBroadcastClick(logId: number): Promise<void> {
        const manager = await this.getManager();
        const log = await manager.findOne(DRAEmailBroadcastLog, {
            where: { id: logId, clicked_at: null },
        });
        if (log) {
            log.clicked_at = new Date();
            await manager.save(log);
        }
    }

    // ----------------------------------------------------------------
    // Stats
    // ----------------------------------------------------------------

    async getFunnelStats(funnelId: number): Promise<{
        totalEnrollments: number;
        activeEnrollments: number;
        completedEnrollments: number;
        totalSent: number;
        totalOpens: number;
        totalClicks: number;
        totalUnsubscribes: number;
        stepStats: Array<{
            stepId: number;
            stepOrder: number;
            templateFile: string;
            sent: number;
            opens: number;
            clicks: number;
        }>;
    }> {
        const manager = await this.getManager();

        const totalEnrollments = await manager.count(DRAEmailFunnelEnrollment, { where: { funnel_id: funnelId } });
        const activeEnrollments = await manager.count(DRAEmailFunnelEnrollment, { where: { funnel_id: funnelId, is_active: true } });
        const completedEnrollments = await manager.count(DRAEmailFunnelEnrollment, { where: { funnel_id: funnelId, completed_at: null, is_active: false } });
        const totalSent = await manager.count(DRAEmailFunnelSentLog, { where: { step_id: funnelId } });
        const totalUnsubscribes = await manager.count(DRAEmailFunnelUnsubscribe, { where: { funnel_id: funnelId } });

        const steps = await this.getSteps(funnelId);
        const stepStats = [];
        for (const step of steps) {
            const sent = await manager.count(DRAEmailFunnelSentLog, { where: { step_id: step.id } });
            const opens = await manager.count(DRAEmailFunnelSentLog, { where: { step_id: step.id, opened_at: null } });
            stepStats.push({ stepId: step.id, stepOrder: step.step_order, templateFile: step.template_file, sent, opens, clicks: 0 });
        }

        return {
            totalEnrollments, activeEnrollments, completedEnrollments,
            totalSent, totalOpens: 0, totalClicks: 0, totalUnsubscribes, stepStats,
        };
    }

    // ----------------------------------------------------------------
    // Daily Rate Limiter
    // ----------------------------------------------------------------

    private checkDailyLimit(): boolean {
        const today = new Date().toISOString().slice(0, 10);
        if (this.dailySentDate !== today) {
            this.dailySentCount = 0;
            this.dailySentDate = today;
        }
        return this.dailySentCount < this.dailyLimit;
    }

    private incrementDailyCount(): void {
        this.dailySentCount++;
    }

    async sendBroadcastImmediately(id: number): Promise<DRAEmailBroadcast | null> {
        const manager = await this.getManager();
        const broadcast = await manager.findOne(DRAEmailBroadcast, { where: { id } });
        if (!broadcast || broadcast.status !== 'pending') return null;

        broadcast.scheduled_at = null;
        await manager.save(broadcast);
        return broadcast;
    }

    async getBroadcastLogs(broadcastId: number): Promise<DRAEmailBroadcastLog[]> {
        const manager = await this.getManager();
        return manager.find(DRAEmailBroadcastLog, {
            where: { broadcast_id: broadcastId },
            order: { sent_at: 'DESC' },
        });
    }

    async getBroadcastStats(broadcastId: number): Promise<{
        sent: number; opened: number; clicked: number; failed: number; openRate: number; clickRate: number;
    }> {
        const manager = await this.getManager();
        const logs = await manager.find(DRAEmailBroadcastLog, {
            where: { broadcast_id: broadcastId },
        });
        const sent = logs.length;
        const opened = logs.filter(l => l.opened_at).length;
        const clicked = logs.filter(l => l.clicked_at).length;
        const failed = logs.filter(l => l.error).length;
        return {
            sent, opened, clicked, failed,
            openRate: sent > 0 ? Math.round((opened / sent) * 100) : 0,
            clickRate: sent > 0 ? Math.round((clicked / sent) * 100) : 0,
        };
    }

    async renderBroadcastForRecipient(broadcastId: number, logId: number): Promise<string | null> {
        const manager = await this.getManager();
        const broadcast = await manager.findOne(DRAEmailBroadcast, { where: { id: broadcastId } });
        if (!broadcast) return null;
        const log = await manager.findOne(DRAEmailBroadcastLog, { where: { id: logId, broadcast_id: broadcastId } });
        if (!log) return null;

        const templateDataObj: Record<string, string> = (() => {
            try { return JSON.parse(broadcast.template_data); } catch { return {}; }
        })();
        const frontendUrl = process.env.FRONTEND_URL || process.env.SOCKETIO_CLIENT_URL || 'http://localhost:3000';
        const supportEmail = process.env.MAIL_REPLY_TO || 'support@dataresearchanalysis.com';
        const blogFunnel = await this.getFunnelBySlug('blog-subscriber');
        const firstName = log.recipient_name?.split(' ')[0] || 'there';
        const unsubscribeToken = this.generateUnsubscribeToken(log.recipient_email, blogFunnel?.id || 0);
        const unsubscribeUrl = `${process.env.BACKEND_URL || 'http://localhost:3002'}/email-funnels/unsubscribe?token=${unsubscribeToken}&email=${encodeURIComponent(log.recipient_email)}&funnel_id=${blogFunnel?.id || 0}`;
        const subject = broadcast.subject.replace(/\{\{first_name\}\}/g, firstName);

        const replacements = [
            { key: 'subscriber_name', value: firstName },
            { key: 'first_name', value: firstName },
            { key: 'subject', value: subject },
            { key: 'support_email', value: supportEmail },
            { key: 'frontend_url', value: frontendUrl },
            { key: 'current_year', value: String(new Date().getFullYear()) },
            { key: 'unsubscribe_url', value: unsubscribeUrl },
            { key: 'tracking_pixel', value: '' },
        ];
        for (const [k, v] of Object.entries(templateDataObj)) {
            replacements.push({ key: k, value: v });
        }

        return TemplateEngineService.getInstance().render(broadcast.template_file, replacements);
    }

    async previewTemplate(template_file: string, template_data: string, subject: string): Promise<string> {
        const templateDataObj: Record<string, string> = (() => {
            try { return JSON.parse(template_data); } catch { return {}; }
        })();
        const frontendUrl = process.env.FRONTEND_URL || process.env.SOCKETIO_CLIENT_URL || 'http://localhost:3000';
        const supportEmail = process.env.MAIL_REPLY_TO || 'support@dataresearchanalysis.com';

        const replacements = [
            { key: 'subscriber_name', value: 'Test User' },
            { key: 'first_name', value: 'Test' },
            { key: 'subject', value: subject },
            { key: 'support_email', value: supportEmail },
            { key: 'frontend_url', value: frontendUrl },
            { key: 'current_year', value: String(new Date().getFullYear()) },
            { key: 'unsubscribe_url', value: `${frontendUrl}/unsubscribe?token=test` },
            { key: 'tracking_pixel', value: '' },
        ];
        for (const [k, v] of Object.entries(templateDataObj)) {
            replacements.push({ key: k, value: v });
        }

        return TemplateEngineService.getInstance().render(template_file, replacements);
    }

    getDailyLimit(): number { return this.dailyLimit; }
    getDailySentCount(): number { return this.dailySentCount; }
}
