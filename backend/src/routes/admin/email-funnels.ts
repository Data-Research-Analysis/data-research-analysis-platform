import express, { Request, Response } from 'express';
import { validateJWT } from '../../middleware/authenticate.js';
import { EUserType } from '../../types/EUserType.js';
import { validate } from '../../middleware/validator.js';
import { body, matchedData, param, query } from 'express-validator';
import { EmailFunnelProcessor } from '../../processors/EmailFunnelProcessor.js';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';
import { DBDriver } from '../../drivers/DBDriver.js';
import { EDataSourceType } from '../../types/EDataSourceType.js';
import { Queue } from 'bullmq';
import { DRABlogSubscriber } from '../../models/DRABlogSubscriber.js';
import { DRALeadGeneratorLead } from '../../models/DRALeadGeneratorLead.js';
import { DRAEnterpriseQuery } from '../../models/DRAEnterpriseQuery.js';
import { DRAEnterpriseContactRequest } from '../../models/DRAEnterpriseContactRequest.js';
import { DRAUsersPlatform } from '../../models/DRAUsersPlatform.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const router = express.Router();
const processor = EmailFunnelProcessor.getInstance();
const projectRoot = path.resolve(__dirname, '../../..');
const templatesDir = path.join(projectRoot, 'src/templates');

async function requireAdmin(req: any, res: any, next: any) {
    const tokenDetails = req.tokenDetails || req.body.tokenDetails;
    if (!tokenDetails || tokenDetails.user_type !== EUserType.ADMIN) {
        return res.status(403).json({ success: false, message: 'Admin access required' });
    }
    next();
}

// ---- Static routes (must be before /:id routes) ----

router.get(
    '/templates',
    validateJWT,
    requireAdmin,
    async (_req: Request, res: Response) => {
        try {
            const files = fs.readdirSync(templatesDir).filter(f => f.endsWith('.html'));
            res.status(200).json({ success: true, data: files });
        } catch (error: any) {
            res.status(500).json({ success: false, error: error.message });
        }
    }
);

router.get(
    '/broadcasts/list',
    validateJWT,
    requireAdmin,
    async (_req: Request, res: Response) => {
        try {
            const broadcasts = await processor.getBroadcasts();
            res.status(200).json({ success: true, data: broadcasts });
        } catch (error: any) {
            res.status(500).json({ success: false, error: error.message });
        }
    }
);

router.post(
    '/broadcasts/create',
    validateJWT,
    requireAdmin,
    validate([
        body('subject').notEmpty().trim(),
        body('template_file').notEmpty().trim(),
        body('template_data').optional().isString(),
        body('audience').notEmpty().trim(),
        body('scheduled_at').optional({ values: 'null' }).isString(),
    ]),
    async (req: Request, res: Response) => {
        try {
            const data = matchedData(req);
            const broadcast = await processor.createBroadcast({
                subject: data.subject,
                template_file: data.template_file,
                template_data: data.template_data || '{}',
                audience: data.audience,
                scheduled_at: data.scheduled_at || undefined,
            });

            // If not scheduled, trigger immediate processing to start sending
            if (!data.scheduled_at) {
                processor.processBroadcasts().catch(err => {
                    console.error('[admin/email-funnels] processBroadcasts after create failed:', err);
                });
            }

            res.status(200).json({ success: true, data: broadcast });
        } catch (error: any) {
            res.status(500).json({ success: false, error: error.message });
        }
    }
);

router.delete(
    '/broadcasts/delete/:id',
    validateJWT,
    requireAdmin,
    validate([param('id').notEmpty().toInt()]),
    async (req: Request, res: Response) => {
        try {
            const { id } = matchedData(req);
            await processor.deleteBroadcast(id);
            res.status(200).json({ success: true, message: 'Broadcast deleted' });
        } catch (error: any) {
            res.status(500).json({ success: false, error: error.message });
        }
    }
);

router.put(
    '/broadcasts/pause/:id',
    validateJWT,
    requireAdmin,
    validate([param('id').notEmpty().toInt()]),
    async (req: Request, res: Response) => {
        try {
            const { id } = matchedData(req);
            const broadcast = await processor.toggleBroadcastPause(id);
            if (!broadcast) {
                return res.status(404).json({ success: false, error: 'Broadcast not found or already sent' });
            }
            res.status(200).json({ success: true, data: broadcast });
        } catch (error: any) {
            res.status(500).json({ success: false, error: error.message });
        }
    }
);

router.get(
    '/broadcasts/estimate',
    validateJWT,
    requireAdmin,
    async (_req: Request, res: Response) => {
        try {
            const dailyLimit = processor.getDailyLimit();
            const dailySent = processor.getDailySentCount();
            const remaining = Math.max(0, dailyLimit - dailySent);
            res.status(200).json({
                success: true,
                data: {
                    daily_limit: dailyLimit,
                    daily_sent: dailySent,
                    daily_remaining: remaining,
                },
            });
        } catch (error: any) {
            res.status(500).json({ success: false, error: error.message });
        }
    }
);

router.get(
    '/broadcasts/:id',
    validateJWT,
    requireAdmin,
    validate([param('id').notEmpty().toInt()]),
    async (req: Request, res: Response) => {
        try {
            const { id } = matchedData(req);
            const broadcast = await processor.getBroadcastById(id);
            if (!broadcast) {
                return res.status(404).json({ success: false, error: 'Broadcast not found' });
            }
            res.status(200).json({ success: true, data: broadcast });
        } catch (error: any) {
            res.status(500).json({ success: false, error: error.message });
        }
    }
);

router.post(
    '/broadcasts/preview',
    validateJWT,
    requireAdmin,
    validate([
        body('template_file').notEmpty().trim(),
        body('template_data').optional().isString(),
        body('subject').optional().isString(),
    ]),
    async (req: Request, res: Response) => {
        try {
            const data = matchedData(req);
            const html = await processor.previewTemplate(
                data.template_file,
                data.template_data || '{}',
                data.subject || '',
            );
            res.status(200).json({ success: true, data: html });
        } catch (error: any) {
            res.status(500).json({ success: false, error: error.message });
        }
    }
);

router.post(
    '/broadcasts/send-now/:id',
    validateJWT,
    requireAdmin,
    validate([param('id').notEmpty().toInt()]),
    async (req: Request, res: Response) => {
        try {
            const { id } = matchedData(req);
            const broadcast = await processor.sendBroadcastImmediately(id);
            if (!broadcast) {
                return res.status(400).json({ success: false, error: 'Broadcast not found or already in progress' });
            }

            // Trigger immediate processing
            processor.processBroadcasts().catch(err => {
                console.error('[admin/email-funnels] processBroadcasts after send-now failed:', err);
            });

            res.status(200).json({ success: true, data: broadcast });
        } catch (error: any) {
            res.status(500).json({ success: false, error: error.message });
        }
    }
);

router.get(
    '/broadcasts/:id/stats',
    validateJWT,
    requireAdmin,
    validate([param('id').notEmpty().toInt()]),
    async (req: Request, res: Response) => {
        try {
            const { id } = matchedData(req);
            const broadcast = await processor.getBroadcastById(id);
            if (!broadcast) return res.status(404).json({ success: false, error: 'Broadcast not found' });
            let stats;
            try {
                stats = await processor.getBroadcastStats(id);
            } catch {
                stats = { sent: 0, opened: 0, clicked: 0, failed: 0, openRate: 0, clickRate: 0 };
            }
            res.status(200).json({ success: true, data: { ...stats, broadcast } });
        } catch (error: any) {
            res.status(500).json({ success: false, error: error.message });
        }
    }
);

router.get(
    '/broadcasts/:id/logs',
    validateJWT,
    requireAdmin,
    validate([param('id').notEmpty().toInt()]),
    async (req: Request, res: Response) => {
        try {
            const { id } = matchedData(req);
            let logs: any[] = [];
            try {
                logs = await processor.getBroadcastLogs(id);
            } catch {
                logs = [];
            }
            res.status(200).json({ success: true, data: logs });
        } catch (error: any) {
            res.status(500).json({ success: false, error: error.message });
        }
    }
);

router.get(
    '/broadcasts/:id/logs/:logId/preview',
    validateJWT,
    requireAdmin,
    validate([param('id').notEmpty().toInt(), param('logId').notEmpty().toInt()]),
    async (req: Request, res: Response) => {
        try {
            const { id, logId } = matchedData(req);
            let html: string | null = null;
            try {
                html = await processor.renderBroadcastForRecipient(id, logId);
            } catch {
                html = null;
            }
            if (!html) return res.status(404).json({ success: false, error: 'Broadcast or log not found' });
            res.status(200).json({ success: true, data: html });
        } catch (error: any) {
            res.status(500).json({ success: false, error: error.message });
        }
    }
);

// ---- Unified Leads ----

router.get(
    '/leads',
    validateJWT,
    requireAdmin,
    validate([
        query('source').optional().isIn(['blog_subscribers', 'lead_generator_downloads', 'enterprise_queries', 'enterprise_contact_requests', 'registered_users']),
        query('page').optional().toInt(),
        query('limit').optional().toInt(),
        query('search').optional().trim(),
    ]),
    async (req: Request, res: Response) => {
        try {
            const raw = matchedData(req) as any;
            const source = raw.source;
            const page = Number.isFinite(raw.page) ? raw.page : 1;
            const limit = Number.isFinite(raw.limit) ? raw.limit : 50;
            const search = raw.search;
            const driver = await DBDriver.getInstance().getDriver(EDataSourceType.POSTGRESQL);
            if (!driver) throw new Error('Database driver not available');
            const manager = (await driver.getConcreteDriver()).manager;

            interface LeadRow {
                email: string;
                name: string | null;
                source: string;
                created_at: Date;
                extra: Record<string, any>;
            }

            const sources: { key: string; fetch: () => Promise<LeadRow[]> }[] = [
                {
                    key: 'blog_subscribers',
                    fetch: async () => {
                        const rows = await manager.find(DRABlogSubscriber, { order: { created_at: 'DESC' } });
                        return rows.map(r => ({ email: r.email, name: r.name, source: 'blog_subscribers', created_at: r.created_at, extra: {} }));
                    },
                },
                {
                    key: 'lead_generator_downloads',
                    fetch: async () => {
                        const rows = await manager.find(DRALeadGeneratorLead, { order: { created_at: 'DESC' }, relations: ['lead_generator'] });
                        return rows.map(r => ({
                            email: r.email,
                            name: r.full_name,
                            source: 'lead_generator_downloads',
                            created_at: r.created_at,
                            extra: { company: r.company, job_title: r.job_title, lead_generator: (r as any).lead_generator?.title || null },
                        }));
                    },
                },
                {
                    key: 'enterprise_queries',
                    fetch: async () => {
                        const rows = await manager.find(DRAEnterpriseQuery, { order: { created_at: 'DESC' } });
                        return rows.map(r => ({
                            email: r.business_email,
                            name: `${r.first_name} ${r.last_name}`,
                            source: 'enterprise_queries',
                            created_at: r.created_at,
                            extra: { company: r.company_name, country: r.country, opted_in: r.agree_to_receive_updates },
                        }));
                    },
                },
                {
                    key: 'enterprise_contact_requests',
                    fetch: async () => {
                        const rows = await manager.find(DRAEnterpriseContactRequest, { order: { created_at: 'DESC' }, relations: ['user'] });
                        return rows.map(r => ({
                            email: r.user.email,
                            name: `${r.user.first_name} ${r.user.last_name}`,
                            source: 'enterprise_contact_requests',
                            created_at: r.created_at,
                            extra: { company: r.company_name, team_size: r.team_size, status: r.status },
                        }));
                    },
                },
                {
                    key: 'registered_users',
                    fetch: async () => {
                        const rows = await manager.find(DRAUsersPlatform, {
                            order: { id: 'DESC' },
                            where: { unsubscribe_from_emails_at: null },
                        });
                        return rows.map(r => ({
                            email: r.email,
                            name: `${r.first_name} ${r.last_name}`,
                            source: 'registered_users',
                            created_at: new Date(0),
                            extra: { user_id: r.id, user_type: r.user_type },
                        }));
                    },
                },
            ];

            const filtered = source ? sources.filter(s => s.key === source) : sources;
            const allLeads: LeadRow[] = [];
            for (const s of filtered) {
                const rows = await s.fetch();
                allLeads.push(...rows);
            }

            // Apply search filter
            let matched = allLeads;
            if (search) {
                const q = search.toLowerCase();
                matched = allLeads.filter(r =>
                    r.email.toLowerCase().includes(q) ||
                    (r.name && r.name.toLowerCase().includes(q))
                );
            }

            // Sort by created_at descending
            matched.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());

            const total = matched.length;
            const offset = (page - 1) * limit;
            const data = matched.slice(offset, offset + limit);

            res.status(200).json({ success: true, data, total, page, limit });
        } catch (error: any) {
            res.status(500).json({ success: false, error: error.message });
        }
    }
);

// ---- Queue Status ----

router.get(
    '/queue-status',
    validateJWT,
    requireAdmin,
    async (_req: Request, res: Response) => {
        try {
            const redisConnection = {
                host: process.env.REDIS_HOST || 'localhost',
                port: parseInt(process.env.REDIS_PORT || '6379'),
                password: process.env.REDIS_PASSWORD || undefined,
            };
            const emailQueue = new Queue('emails', {
                connection: redisConnection,
                prefix: 'dra:email',
            });

            const [waiting, active, completed, failed, delayed] = await Promise.all([
                emailQueue.getWaitingCount(),
                emailQueue.getActiveCount(),
                emailQueue.getCompletedCount(),
                emailQueue.getFailedCount(),
                emailQueue.getDelayedCount(),
            ]);

            const jobCounts = { waiting, active, completed, failed, delayed };
            const total = waiting + active + delayed;

            // Get recent failed jobs for detail
            const recentFailed = await emailQueue.getJobs(['failed'], 0, 10);
            const failedJobs = recentFailed.map(j => ({
                id: j.id,
                failedReason: j.failedReason,
                timestamp: j.timestamp,
                data: { to: (j.data as any)?.to, subject: (j.data as any)?.subject },
            }));

            // Get recent completed jobs
            const recentCompleted = await emailQueue.getJobs(['completed'], 0, 10);
            const completedJobs = recentCompleted.map(j => ({
                id: j.id,
                timestamp: j.timestamp,
                finishedOn: j.finishedOn,
                data: { to: (j.data as any)?.to, subject: (j.data as any)?.subject },
            }));

            const dailySent = processor.getDailySentCount();
            const dailyLimit = processor.getDailyLimit();

            res.status(200).json({
                success: true,
                data: { jobCounts, total, failedJobs, completedJobs, dailySent, dailyLimit },
            });

            await emailQueue.close();
        } catch (error: any) {
            res.status(500).json({ success: false, error: error.message });
        }
    }
);

// ---- Funnels ----

router.get(
    '/',
    validateJWT,
    requireAdmin,
    async (_req: Request, res: Response) => {
        try {
            const funnels = await processor.getFunnels();
            res.status(200).json({ success: true, data: funnels });
        } catch (error: any) {
            res.status(500).json({ success: false, error: error.message });
        }
    }
);

router.get(
    '/:id',
    validateJWT,
    requireAdmin,
    validate([param('id').notEmpty().toInt()]),
    async (req: Request, res: Response) => {
        try {
            const { id } = matchedData(req);
            const funnel = await processor.getFunnel(id);
            res.status(200).json({ success: true, data: funnel });
        } catch (error: any) {
            res.status(500).json({ success: false, error: error.message });
        }
    }
);

// ---- Unsubscribes ----

router.get(
    '/unsubscribes',
    validateJWT,
    requireAdmin,
    validate([
        query('page').optional().toInt(),
        query('limit').optional().toInt(),
    ]),
    async (req: Request, res: Response) => {
        try {
            const raw = matchedData(req) as any;
            const page = Number.isFinite(raw.page) ? raw.page : 1;
            const limit = Number.isFinite(raw.limit) ? raw.limit : 50;
            const result = await processor.getUnsubscribes(page, limit);
            res.status(200).json({ success: true, data: result.data, total: result.total, page, limit });
        } catch (error: any) {
            res.status(500).json({ success: false, error: error.message });
        }
    }
);

router.post(
    '/',
    validateJWT,
    requireAdmin,
    validate([
        body('name').notEmpty().trim(),
        body('slug').notEmpty().trim(),
        body('trigger_type').notEmpty().trim(),
        body('target_user_type').notEmpty().trim(),
    ]),
    async (req: Request, res: Response) => {
        try {
            const data = matchedData(req) as { name: string; slug: string; trigger_type: string; target_user_type: string };
            const funnel = await processor.createFunnel(data);
            res.status(200).json({ success: true, data: funnel });
        } catch (error: any) {
            res.status(500).json({ success: false, error: error.message });
        }
    }
);

router.put(
    '/:id',
    validateJWT,
    requireAdmin,
    validate([
        param('id').notEmpty().toInt(),
        body('name').optional().trim(),
        body('slug').optional().trim(),
        body('trigger_type').optional().trim(),
        body('target_user_type').optional().trim(),
        body('is_active').optional().isBoolean().toBoolean(),
    ]),
    async (req: Request, res: Response) => {
        try {
            const { id, ...updates } = matchedData(req);
            const funnel = await processor.updateFunnel(id, updates);
            res.status(200).json({ success: true, data: funnel });
        } catch (error: any) {
            res.status(500).json({ success: false, error: error.message });
        }
    }
);

// ---- Funnel Steps ----

router.get(
    '/:id/steps',
    validateJWT,
    requireAdmin,
    validate([param('id').notEmpty().toInt()]),
    async (req: Request, res: Response) => {
        try {
            const { id } = matchedData(req);
            const steps = await processor.getSteps(id);
            res.status(200).json({ success: true, data: steps });
        } catch (error: any) {
            res.status(500).json({ success: false, error: error.message });
        }
    }
);

router.post(
    '/:id/steps',
    validateJWT,
    requireAdmin,
    validate([
        param('id').notEmpty().toInt(),
        body('step_order').notEmpty().toInt(),
        body('delay_hours').notEmpty().toInt(),
        body('template_file').notEmpty().trim(),
        body('subject_template').notEmpty().trim(),
    ]),
    async (req: Request, res: Response) => {
        try {
            const data = matchedData(req);
            const step = await processor.createStep({
                funnel_id: data.id,
                step_order: data.step_order,
                delay_hours: data.delay_hours,
                template_file: data.template_file,
                subject_template: data.subject_template,
            });
            res.status(200).json({ success: true, data: step });
        } catch (error: any) {
            res.status(500).json({ success: false, error: error.message });
        }
    }
);

router.put(
    '/:id/steps/:stepId',
    validateJWT,
    requireAdmin,
    validate([
        param('id').notEmpty().toInt(),
        param('stepId').notEmpty().toInt(),
        body('step_order').optional().toInt(),
        body('delay_hours').optional().toInt(),
        body('template_file').optional().trim(),
        body('subject_template').optional().trim(),
        body('is_active').optional().isBoolean().toBoolean(),
    ]),
    async (req: Request, res: Response) => {
        try {
            const data = matchedData(req);
            const updates: any = {};
            if (data.step_order !== undefined) updates.step_order = data.step_order;
            if (data.delay_hours !== undefined) updates.delay_hours = data.delay_hours;
            if (data.template_file !== undefined) updates.template_file = data.template_file;
            if (data.subject_template !== undefined) updates.subject_template = data.subject_template;
            if (data.is_active !== undefined) updates.is_active = data.is_active;
            const step = await processor.updateStep(data.stepId, updates);
            res.status(200).json({ success: true, data: step });
        } catch (error: any) {
            res.status(500).json({ success: false, error: error.message });
        }
    }
);

router.delete(
    '/:id/steps/:stepId',
    validateJWT,
    requireAdmin,
    validate([
        param('id').notEmpty().toInt(),
        param('stepId').notEmpty().toInt(),
    ]),
    async (req: Request, res: Response) => {
        try {
            const data = matchedData(req);
            await processor.deleteStep(data.stepId);
            res.status(200).json({ success: true, message: 'Step deleted' });
        } catch (error: any) {
            res.status(500).json({ success: false, error: error.message });
        }
    }
);

// ---- Enrollments ----

router.get(
    '/:id/enrollments',
    validateJWT,
    requireAdmin,
    validate([
        param('id').notEmpty().toInt(),
        query('page').optional().toInt(),
        query('limit').optional().toInt(),
        query('is_active').optional().isBoolean().toBoolean(),
    ]),
    async (req: Request, res: Response) => {
        try {
            const raw = matchedData(req) as any;
            const id = raw.id;
            const page = Number.isFinite(raw.page) ? raw.page : undefined;
            const limit = Number.isFinite(raw.limit) ? raw.limit : undefined;
            const is_active = raw.is_active;
            const result = await processor.getEnrollments(id, { page, limit, isActive: is_active });
            res.status(200).json({ success: true, ...result });
        } catch (error: any) {
            res.status(500).json({ success: false, error: error.message });
        }
    }
);

// ---- Stats ----

router.get(
    '/:id/stats',
    validateJWT,
    requireAdmin,
    validate([param('id').notEmpty().toInt()]),
    async (req: Request, res: Response) => {
        try {
            const { id } = matchedData(req);
            const stats = await processor.getFunnelStats(id);
            res.status(200).json({ success: true, data: stats });
        } catch (error: any) {
            res.status(500).json({ success: false, error: error.message });
        }
    }
);

export default router;
