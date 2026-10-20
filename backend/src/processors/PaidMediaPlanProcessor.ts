import { Request, Response } from 'express';
import { getAppDataSource } from '../datasources/PostgresDS.js';
import { DRAProject } from '../models/DRAProject.js';
import { DRAPaidMediaPlanEvent } from '../models/DRAPaidMediaPlanEvent.js';
import { DRAPaidMediaPlanArtifact } from '../models/DRAPaidMediaPlanArtifact.js';
import { DRAPaidMediaPlanMessage } from '../models/DRAPaidMediaPlanMessage.js';
import { DRAPlanOutcome } from '../models/DRAPlanOutcome.js';
import { DRACampaign } from '../models/DRACampaign.js';
import { IOrganizationContextRequest } from '../middleware/organizationContext.js';
import { PaidMediaPlanService } from '../services/PaidMediaPlanService.js';
import { SkillRunnerService } from '../services/SkillRunnerService.js';
import { PlanExecutionEngine } from '../services/PlanExecutionEngine.js';
import { PlanArtifactService } from '../services/PlanArtifactService.js';
import { PlanEventService } from '../services/PlanEventService.js';
import { PlanExportService } from '../services/PlanExportService.js';
import { PlanStateService } from '../services/PlanStateService.js';
import { ProductAnalyticsService } from '../services/ProductAnalyticsService.js';
import { TierEnforcementService } from '../services/TierEnforcementService.js';
import { GeminiService } from '../services/GeminiService.js';
import { PlanLaunchService } from '../services/PlanLaunchService.js';
import { PlanOutcomeService } from '../services/PlanOutcomeService.js';
import { PLAN_QUESTION_ANSWER_PROMPT } from '../constants/planPrompts.js';
import { IPlanScopedCreateInput } from '../types/IPaidMediaPlan.js';

export class PaidMediaPlanProcessor {
    private service = PaidMediaPlanService.getInstance();
    private runner = SkillRunnerService.getInstance();
    private artifactService = PlanArtifactService.getInstance();
    private eventService = PlanEventService.getInstance();
    private exportService = PlanExportService.getInstance();
    private analyticsService = ProductAnalyticsService.getInstance();

    private userId(req: Request): number {
        return (req as any).tokenDetails?.user_id ?? (req as any).user?.id ?? 0;
    }

    async createPlan(req: IOrganizationContextRequest, res: Response): Promise<void> {
        try {
            const body = req.body ?? {};
            const projectId = parseInt(String(body.projectId), 10);
            const project = await getAppDataSource()
                .then((ds) => ds.getRepository(DRAProject).findOne({ where: { id: projectId } }));
            if (!project) {
                res.status(400).json({ success: false, error: `Project not found: ${projectId}` });
                return;
            }

            // Advanced mode is a paid-plan feature; basic mode is available on every tier.
            if (body.mode === 'advanced') {
                const advancedAllowed = await TierEnforcementService.getInstance()
                    .canUsePlanAdvancedMode(this.userId(req));
                if (!advancedAllowed) {
                    res.status(402).json({
                        success: false,
                        message: 'Advanced mode is available on Starter and above. Upgrade to use it.',
                        code: 'plan_advanced_mode_not_allowed',
                    });
                    return;
                }
            }

            const input: IPlanScopedCreateInput = {
                projectId,
                name: body.name,
                website: body.website ?? null,
                mode: body.mode,
                funnelCoverage: body.funnelCoverage,
                buildMode: body.buildMode,
                platforms: Array.isArray(body.platforms) ? body.platforms : undefined,
                markets: Array.isArray(body.markets) ? body.markets : undefined,
                budgetTotal: body.budgetTotal != null ? Number(body.budgetTotal) : undefined,
                currency: body.currency,
                startDate: body.startDate ?? null,
                endDate: body.endDate ?? null,
                autonomy: body.autonomy,
                industry: body.industry ?? null,
                product: body.product ?? null,
                teamSize: body.teamSize != null ? Number(body.teamSize) : null,
                channels: Array.isArray(body.channels) ? body.channels : undefined,
                existingCampaigns: Array.isArray(body.existingCampaigns) ? body.existingCampaigns : undefined,
                competitors: Array.isArray(body.competitors) ? body.competitors : undefined,
                notes: body.notes ?? null,
                organizationId: req.organizationId ?? project.organization_id,
                workspaceId: (req as any).workspaceId ?? project.workspace_id,
                createdBy: this.userId(req),
            };
            const plan = await this.service.create(input);
            await this.eventService.record({
                planId: plan.id,
                stepId: null,
                eventType: 'plan_created',
                message: `Plan "${plan.name}" created`,
            });
            await this.analyticsService.record({
                eventName: 'plan_created',
                userId: plan.createdBy,
                projectId: plan.projectId,
                organizationId: plan.organizationId,
                workspaceId: plan.workspaceId,
                planId: plan.id,
                properties: { mode: plan.mode, platforms: plan.platforms, markets: plan.markets },
            });

            // Hand the plan to the execution engine. The engine runs one step at
            // a time in the background (durable across page navigation/restarts)
            // and pauses automatically at user gates.
            PlanExecutionEngine.getInstance().enqueue(plan.id);

            res.status(201).json({ success: true, data: plan });
        } catch (error: any) {
            console.error('[PaidMediaPlanProcessor] createPlan error:', error);
            res.status(400).json({ success: false, error: error.message ?? 'Failed to create plan' });
        }
    }

    async listPlans(req: Request, res: Response): Promise<void> {
        try {
            const projectId = parseInt(String(req.query.projectId ?? req.query.project_id), 10);
            if (!projectId) {
                res.status(400).json({ success: false, error: 'projectId query parameter is required' });
                return;
            }
            const plans = await this.service.list(projectId);
            res.status(200).json({ success: true, data: plans });
        } catch (error: any) {
            console.error('[PaidMediaPlanProcessor] listPlans error:', error);
            res.status(500).json({ success: false, error: 'Failed to list plans' });
        }
    }

    async getPlan(req: Request, res: Response): Promise<void> {
        try {
            const planId = parseInt(String(req.params.planId), 10);
            const plan = await this.service.get(planId);
            res.status(200).json({ success: true, data: plan });
        } catch (error: any) {
            console.error('[PaidMediaPlanProcessor] getPlan error:', error);
            res.status(404).json({ success: false, error: error.message ?? 'Plan not found' });
        }
    }

    async updatePlan(req: Request, res: Response): Promise<void> {
        try {
            const planId = parseInt(String(req.params.planId), 10);
            const patch = req.body ?? {};
            const plan = await this.service.update(planId, patch);
            await this.eventService.record({ planId, stepId: null, eventType: 'user_edit', message: 'Plan updated' });
            res.status(200).json({ success: true, data: plan });
        } catch (error: any) {
            console.error('[PaidMediaPlanProcessor] updatePlan error:', error);
            res.status(400).json({ success: false, error: error.message ?? 'Failed to update plan' });
        }
    }

    async deletePlan(req: Request, res: Response): Promise<void> {
        try {
            const planId = parseInt(String(req.params.planId), 10);
            await this.service.delete(planId);
            res.status(204).send();
        } catch (error: any) {
            console.error('[PaidMediaPlanProcessor] deletePlan error:', error);
            res.status(400).json({ success: false, error: error.message ?? 'Failed to delete plan' });
        }
    }

    async listSteps(req: Request, res: Response): Promise<void> {
        try {
            const planId = parseInt(String(req.params.planId), 10);
            const steps = await this.service.listSteps(planId);
            res.status(200).json({ success: true, data: steps });
        } catch (error: any) {
            console.error('[PaidMediaPlanProcessor] listSteps error:', error);
            res.status(404).json({ success: false, error: error.message ?? 'Failed to list steps' });
        }
    }

    async runStep(req: Request, res: Response): Promise<void> {
        try {
            const planId = parseInt(String(req.params.planId), 10);
            const stepKey = String(req.params.stepKey);
            const trigger = req.body?.trigger === 'auto' ? 'auto' : 'user';
            const userId = this.userId(req);

            if (req.query.sync === 'true') {
                const result = await this.runner.run(planId, stepKey, { trigger, userId });
                PlanExecutionEngine.getInstance().enqueue(planId);
                res.status(200).json({ success: true, data: result });
                return;
            }

            this.runner.run(planId, stepKey, { trigger, userId }).then(() => {
                PlanExecutionEngine.getInstance().enqueue(planId);
            }).catch((error) => {
                console.error(`[PaidMediaPlanProcessor] background run failed for plan ${planId} step ${stepKey}:`, error);
            });
            res.status(202).json({
                success: true,
                data: { jobId: `plan-step-${planId}-${stepKey}-${Date.now()}`, planId, stepKey, status: 'queued' },
            });
        } catch (error: any) {
            console.error('[PaidMediaPlanProcessor] runStep error:', error);
            res.status(400).json({ success: false, error: error.message ?? 'Failed to run step' });
        }
    }

    async retryStep(req: Request, res: Response): Promise<void> {
        try {
            const planId = parseInt(String(req.params.planId), 10);
            const stepKey = String(req.params.stepKey);
            const result = await this.runner.run(planId, stepKey, { trigger: 'user', userId: this.userId(req) });
            PlanExecutionEngine.getInstance().enqueue(planId);
            res.status(200).json({ success: true, data: result });
        } catch (error: any) {
            console.error('[PaidMediaPlanProcessor] retryStep error:', error);
            res.status(400).json({ success: false, error: error.message ?? 'Failed to retry step' });
        }
    }

    async skipStep(req: Request, res: Response): Promise<void> {
        try {
            const planId = parseInt(String(req.params.planId), 10);
            const stepKey = String(req.params.stepKey);
            const reason = req.body?.reason;
            const result = await this.runner.skip(planId, stepKey, reason);
            PlanExecutionEngine.getInstance().enqueue(planId);
            res.status(200).json({ success: true, data: result });
        } catch (error: any) {
            console.error('[PaidMediaPlanProcessor] skipStep error:', error);
            res.status(400).json({ success: false, error: error.message ?? 'Failed to skip step' });
        }
    }

    async updateBrief(req: Request, res: Response): Promise<void> {
        try {
            const planId = parseInt(String(req.params.planId), 10);
            const body = req.body ?? {};
            const plan = await this.service.get(planId);
            const state: any = { ...(plan.state ?? {}) };
            const coreFacts: any = { ...(state.core_facts ?? {}) };
            const company = { ...(coreFacts.company ?? {}) };
            const budget = { ...(coreFacts.budget ?? {}) };

            if (typeof body.website === 'string') coreFacts.website = body.website.trim() || null;
            if (Array.isArray(body.platforms)) coreFacts.platforms = body.platforms;
            if (Array.isArray(body.markets)) coreFacts.markets = body.markets;
            if (body.budgetTotal != null && body.budgetTotal !== '') budget.total = Number(body.budgetTotal) || null;
            if (typeof body.currency === 'string' && body.currency) budget.currency = body.currency;
            if (typeof body.industry === 'string') coreFacts.industry = body.industry.trim() || null;
            if (typeof body.product === 'string') company.product_service = body.product.trim() || null;
            if (body.teamSize != null && body.teamSize !== '') company.team_size = Number(body.teamSize) || null;
            if (Array.isArray(body.channels)) company.channels = body.channels;
            if (Array.isArray(body.competitors)) coreFacts.competitors = body.competitors;
            if (typeof body.notes === 'string') coreFacts.notes = body.notes.trim() || null;
            if (typeof body.startDate === 'string' || typeof body.endDate === 'string') {
                const dates = { ...(coreFacts.dates ?? {}) };
                if (typeof body.startDate === 'string') dates.start = body.startDate || null;
                if (typeof body.endDate === 'string') dates.end = body.endDate || null;
                coreFacts.dates = dates;
            }

            coreFacts.company = company;
            coreFacts.budget = budget;
            state.core_facts = coreFacts;
            state.client_brief = this.compileBrief(body);

            const updates: Record<string, any> = { state };
            if (typeof body.name === 'string' && body.name.trim()) updates.name = body.name.trim();

            await this.service.update(planId, updates);
            await this.eventService.record({
                planId,
                stepId: null,
                eventType: 'plan_brief_updated',
                message: 'Client brief updated',
                socketEvent: 'plan:updated',
                socketData: { planId, status: plan.status },
            });

            const updated = await this.service.get(planId);
            res.status(200).json({ success: true, data: updated });
        } catch (error: any) {
            console.error('[PaidMediaPlanProcessor] updateBrief error:', error);
            res.status(400).json({ success: false, error: error.message ?? 'Failed to update client brief' });
        }
    }

    private compileBrief(body: Record<string, any>): string {
        const lines: string[] = [];
        const name = String(body.name ?? '').trim();
        if (name) lines.push(`Company: ${name}`);
        const website = String(body.website ?? '').trim();
        if (website) lines.push(`Website: ${website}`);
        const industry = String(body.industry ?? '').trim();
        if (industry) lines.push(`Industry: ${industry}`);
        const product = String(body.product ?? '').trim();
        if (product) lines.push(`Product/service: ${product}`);
        if (Array.isArray(body.markets) && body.markets.length) lines.push(`Target markets: ${body.markets.join(', ')}`);
        if (Array.isArray(body.platforms) && body.platforms.length) lines.push(`Platforms: ${body.platforms.join(', ')}`);
        if (body.budgetTotal != null && body.budgetTotal !== '') {
            lines.push(`Budget: ${body.budgetTotal} ${String(body.currency ?? '')}`);
        }
        if (body.teamSize != null && body.teamSize !== '') lines.push(`Team size: ${body.teamSize}`);
        if (Array.isArray(body.channels) && body.channels.length) {
            lines.push(`Existing channels: ${body.channels.filter(Boolean).join(', ')}`);
        }
        if (Array.isArray(body.competitors) && body.competitors.length) {
            const list = body.competitors
                .map((c: any) => (c?.name ? `${c.name}${c?.website ? ` (${c.website})` : ''}` : ''))
                .filter(Boolean)
                .join(', ');
            if (list) lines.push(`Competitors: ${list}`);
        }
        const notes = String(body.notes ?? '').trim();
        if (notes) lines.push(`Notes: ${notes}`);
        return lines.join('\n');
    }

    async pausePlan(req: Request, res: Response): Promise<void> {
        try {
            const planId = parseInt(String(req.params.planId), 10);
            const plan = await this.service.update(planId, { status: 'paused' });
            await this.eventService.record({
                planId,
                stepId: null,
                eventType: 'plan_paused',
                message: 'Plan paused by user',
                socketEvent: 'plan:updated',
                socketData: { planId, status: 'paused' },
            });
            res.status(200).json({ success: true, data: plan });
        } catch (error: any) {
            console.error('[PaidMediaPlanProcessor] pausePlan error:', error);
            res.status(400).json({ success: false, error: error.message ?? 'Failed to pause plan' });
        }
    }

    async resumePlan(req: Request, res: Response): Promise<void> {
        try {
            const planId = parseInt(String(req.params.planId), 10);
            // A user-initiated resume always retries failed steps: reset their
            // attempt budget so the engine picks them up again.
            const steps = await this.service.listSteps(planId);
            for (const step of steps) {
                if (step.status === 'failed') {
                    await this.service.updateStep(planId, step.stepKey, { attempts: 0, error: null });
                }
            }
            const plan = await this.service.update(planId, { status: 'running' });
            await this.eventService.record({
                planId,
                stepId: null,
                eventType: 'plan_resumed',
                message: 'Plan resumed by user',
                socketEvent: 'plan:updated',
                socketData: { planId, status: 'running' },
            });
            PlanExecutionEngine.getInstance().enqueue(planId);
            res.status(200).json({ success: true, data: plan });
        } catch (error: any) {
            console.error('[PaidMediaPlanProcessor] resumePlan error:', error);
            res.status(400).json({ success: false, error: error.message ?? 'Failed to resume plan' });
        }
    }

    async startPlan(req: Request, res: Response): Promise<void> {
        try {
            const planId = parseInt(String(req.params.planId), 10);
            const plan = await this.service.update(planId, { status: 'running' });
            await this.eventService.record({
                planId,
                stepId: null,
                eventType: 'plan_started',
                message: 'Plan started',
                socketEvent: 'plan:updated',
                socketData: { planId, status: 'running' },
            });
            PlanExecutionEngine.getInstance().enqueue(planId);
            res.status(202).json({ success: true, data: { planId, status: 'queued' } });
        } catch (error: any) {
            console.error('[PaidMediaPlanProcessor] startPlan error:', error);
            res.status(400).json({ success: false, error: error.message ?? 'Failed to start plan' });
        }
    }

    async listMessages(req: Request, res: Response): Promise<void> {
        try {
            const planId = parseInt(String(req.params.planId), 10);
            const since = req.query.since ? parseInt(String(req.query.since), 10) : undefined;
            const limit = req.query.limit ? parseInt(String(req.query.limit), 10) : 200;
            const messages = await this.service.listMessages(planId, since, limit);
            res.status(200).json({ success: true, data: messages });
        } catch (error: any) {
            console.error('[PaidMediaPlanProcessor] listMessages error:', error);
            res.status(404).json({ success: false, error: error.message ?? 'Failed to list messages' });
        }
    }

    async postMessage(req: Request, res: Response): Promise<void> {
        try {
            const planId = parseInt(String(req.params.planId), 10);
            const plan = await this.service.get(planId);
            const body = req.body ?? {};

            if (body.gateId && typeof body.answer === 'string') {
                const step = await this.findStepByGate(planId, body.gateId);
                if (!step) {
                    res.status(404).json({ success: false, error: 'Gate not found' });
                    return;
                }
                if (req.query.sync === 'true') {
                    const result = await this.runner.resume(planId, step.stepKey, body.answer);
                    PlanExecutionEngine.getInstance().enqueue(planId);
                    res.status(200).json({ success: true, data: result });
                    return;
                }
                this.runner.resume(planId, step.stepKey, body.answer).then(() => {
                    PlanExecutionEngine.getInstance().enqueue(planId);
                }).catch((error) => {
                    console.error(`[PaidMediaPlanProcessor] background resume failed for plan ${planId}:`, error);
                });
                res.status(202).json({ success: true, data: { status: 'queued', gateId: body.gateId } });
                return;
            }

            const content = String(body.content ?? '').trim();
            if (!content) {
                res.status(400).json({ success: false, error: 'content is required' });
                return;
            }

            const waitingStep = (plan.steps ?? []).find((s) => s.status === 'waiting_for_input');
            if (waitingStep) {
                const result = await this.runner.resume(planId, waitingStep.stepKey, content);
                PlanExecutionEngine.getInstance().enqueue(planId);
                res.status(200).json({ success: true, data: result });
                return;
            }

            const steps = await this.service.listSteps(planId);
            const result = await this.handleFreeForm(planId, plan, steps, content);
            res.status(200).json({ success: true, data: result });
        } catch (error: any) {
            console.error('[PaidMediaPlanProcessor] postMessage error:', error);
            res.status(400).json({ success: false, error: error.message ?? 'Failed to process message' });
        }
    }

    public async findStepByGate(planId: number, gateId: string) {
        const steps = await this.service.listSteps(planId);
        return steps.find((s) => s.gate?.id === gateId) ?? null;
    }

    public async handleFreeForm(planId: number, plan: any, steps: any[], content: string): Promise<Record<string, any>> {
        const service = this.service;
        const lower = content.toLowerCase();

        if (/\b(skip|skip it)\b/.test(lower)) {
            const current = steps.find((s) => s.status === 'running' || s.status === 'failed');
            if (current) {
                const result = await this.runner.skip(planId, current.stepKey, content);
                return { action: 'skip', result };
            }
        }
        if (/\b(retry|retry it|try again)\b/.test(lower)) {
            const current = steps.find((s) => s.status === 'failed');
            if (current) {
                const result = await this.runner.run(planId, current.stepKey, { trigger: 'user', userId: plan.createdBy });
                PlanExecutionEngine.getInstance().enqueue(planId);
                return { action: 'retry', result };
            }
        }
        if (/\b(run|start|continue|go)\b/.test(lower)) {
            const next = steps.find((s) => s.status === 'pending' || (s.status === 'failed' && s.attempts < 3));
            if (next) {
                const result = await this.runner.run(planId, next.stepKey, { trigger: 'user', userId: plan.createdBy });
                PlanExecutionEngine.getInstance().enqueue(planId);
                return { action: 'run', result };
            }
        }
        if (/\b(pause|stop)\b/.test(lower)) {
            await service.update(planId, { status: 'paused' });
            await this.eventService.record({ planId, stepId: null, eventType: 'plan_paused', message: 'Plan paused by user', socketEvent: 'plan:updated', socketData: { planId, status: 'paused' } });
            return { action: 'pause' };
        }
        if (/\b(resume|continue|keep going)\b/.test(lower)) {
            await service.update(planId, { status: 'running' });
            await this.eventService.record({ planId, stepId: null, eventType: 'plan_resumed', message: 'Plan resumed by user', socketEvent: 'plan:updated', socketData: { planId, status: 'running' } });
            PlanExecutionEngine.getInstance().enqueue(planId);
            return { action: 'resume' };
        }

        // Attach free-form input to the step that actually needs it. Prefer the
        // open gate, then a running step, then the most recent failed step —
        // never an earlier completed step (which made chat answers invisible to
        // the step that asked the question).
        const step =
            steps.find((s) => s.status === 'waiting_for_input') ??
            steps.find((s) => s.status === 'running') ??
            [...steps].reverse().find((s) => s.status === 'failed') ??
            [...steps].reverse().find((s) => s.status === 'completed');
        await service.addMessage(planId, step?.id ?? null, 'user', content, { source: 'free_form' });
        // Make this client-supplied input visible to every current and future
        // step, so the loop never asks again for facts already provided.
        await service.addUserNote(planId, content, 'free_form');
        const context = await PlanStateService.getInstance().projectToMarkdown(planId, true);
        const prompt = PLAN_QUESTION_ANSWER_PROMPT
            .replace('{context}', context.slice(0, 20000))
            .replace('{question}', content.slice(0, 4000));
        const answer = await new GeminiService().askQuestion(prompt, content);
        await service.addMessage(planId, step?.id ?? null, 'assistant', answer, { source: 'free_form' });
        return { action: 'question', answer };
    }

    async getAnalytics(req: Request, res: Response): Promise<void> {
        try {
            const planId = parseInt(String(req.params.planId), 10);
            const dataSource = await getAppDataSource();
            const eventRepository = dataSource.getRepository(DRAPaidMediaPlanEvent);
            const artifactRepository = dataSource.getRepository(DRAPaidMediaPlanArtifact);
            const messageRepository = dataSource.getRepository(DRAPaidMediaPlanMessage);
            const outcomeRepository = dataSource.getRepository(DRAPlanOutcome);
            const campaignRepository = dataSource.getRepository(DRACampaign);

            const eventRows = await eventRepository
                .createQueryBuilder('event')
                .select('event.event_type', 'event_type')
                .addSelect('COUNT(*)', 'count')
                .where('event.plan_id = :planId', { planId })
                .groupBy('event.event_type')
                .getRawMany();
            const artifactRows = await artifactRepository
                .createQueryBuilder('artifact')
                .select('artifact.source', 'source')
                .addSelect('COUNT(*)', 'count')
                .where('artifact.plan_id = :planId', { planId })
                .groupBy('artifact.source')
                .getRawMany();
            const messageRows = await messageRepository
                .createQueryBuilder('message')
                .select('message.role', 'role')
                .addSelect('COUNT(*)', 'count')
                .where('message.plan_id = :planId', { planId })
                .groupBy('message.role')
                .getRawMany();

            const [outcomeCount, campaignCount] = await Promise.all([
                outcomeRepository.count({ where: { plan_id: planId } }),
                campaignRepository.count({ where: { plan_id: planId } }),
            ]);

            res.status(200).json({
                success: true,
                data: {
                    events: eventRows,
                    artifactsBySource: artifactRows,
                    messagesByRole: messageRows,
                    outcomeCount,
                    campaignCount,
                },
            });
        } catch (error: any) {
            console.error('[PaidMediaPlanProcessor] getAnalytics error:', error);
            res.status(404).json({ success: false, error: error.message ?? 'Failed to load analytics' });
        }
    }

    async listEvents(req: Request, res: Response): Promise<void> {
        try {
            const planId = parseInt(String(req.params.planId), 10);
            const since = req.query.since ? parseInt(String(req.query.since), 10) : undefined;
            const events = await this.eventService.list(planId, since);
            res.status(200).json({ success: true, data: events });
        } catch (error: any) {
            console.error('[PaidMediaPlanProcessor] listEvents error:', error);
            res.status(404).json({ success: false, error: error.message ?? 'Failed to list events' });
        }
    }

    async listArtifacts(req: Request, res: Response): Promise<void> {
        try {
            const planId = parseInt(String(req.params.planId), 10);
            const currentOnly = req.query.currentOnly === 'false' ? false : true;
            const artifacts = await this.artifactService.list(planId, currentOnly);
            res.status(200).json({ success: true, data: artifacts });
        } catch (error: any) {
            console.error('[PaidMediaPlanProcessor] listArtifacts error:', error);
            res.status(404).json({ success: false, error: error.message ?? 'Failed to list artifacts' });
        }
    }

    async getArtifact(req: Request, res: Response): Promise<void> {
        try {
            const artifactId = parseInt(String(req.params.artifactId), 10);
            const artifact = await this.artifactService.get(artifactId);
            res.status(200).json({ success: true, data: artifact });
        } catch (error: any) {
            console.error('[PaidMediaPlanProcessor] getArtifact error:', error);
            res.status(404).json({ success: false, error: error.message ?? 'Artifact not found' });
        }
    }

    async downloadArtifact(req: Request, res: Response): Promise<void> {
        try {
            const artifactId = parseInt(String(req.params.artifactId), 10);
            const artifact = await this.artifactService.get(artifactId);

            // The client presentation deck is a Professional+ deliverable.
            if (artifact.kind === 'pptx') {
                const userId = req.body.tokenDetails?.user_id;
                const allowed = await TierEnforcementService.getInstance().canExportPlanDeck(userId);
                if (!allowed) {
                    res.status(402).json({
                        success: false,
                        message: 'The client presentation deck is available on Professional and above.',
                        code: 'plan_deck_not_allowed',
                    });
                    return;
                }
            }

            const plan = await this.service.get(artifact.planId);
            await this.analyticsService.record({
                eventName: 'plan_artifact_downloaded',
                userId: plan.createdBy,
                projectId: plan.projectId,
                organizationId: plan.organizationId,
                workspaceId: plan.workspaceId,
                planId: plan.id,
                properties: { artifactId, artifactKey: artifact.artifactKey },
            });
            res.setHeader('Content-Type', artifact.mimeType);
            res.setHeader('Content-Disposition', `attachment; filename="${artifact.artifactKey}.${artifact.kind === 'markdown' ? 'md' : artifact.kind}"`);
            if (artifact.kind === 'xlsx' || artifact.kind === 'pptx' || artifact.kind === 'image') {
                if (artifact.storageKey) {
                    res.sendFile(artifact.storageKey);
                    return;
                }
                res.status(404).json({ success: false, error: 'Binary artifact has no stored file' });
                return;
            }
            res.send(artifact.content ?? '');
        } catch (error: any) {
            console.error('[PaidMediaPlanProcessor] downloadArtifact error:', error);
            res.status(404).json({ success: false, error: error.message ?? 'Artifact not found' });
        }
    }

    async editArtifact(req: Request, res: Response): Promise<void> {
        try {
            const artifactId = parseInt(String(req.params.artifactId), 10);
            const content = String(req.body?.content ?? '');
            if (!content) {
                res.status(400).json({ success: false, error: 'content is required' });
                return;
            }
            const artifact = await this.artifactService.editContent(artifactId, content, 'user_edited');
            const plan = await this.service.get(artifact.planId);
            await this.eventService.record({
                planId: artifact.planId,
                stepId: artifact.stepId,
                eventType: 'plan_artifact_edited',
                message: `Artifact ${artifact.artifactKey} edited (v${artifact.version})`,
                data: { artifactId: artifact.id, artifactKey: artifact.artifactKey, version: artifact.version },
            });
            await this.analyticsService.record({
                eventName: 'plan_artifact_edited',
                userId: plan.createdBy,
                projectId: plan.projectId,
                organizationId: plan.organizationId,
                workspaceId: plan.workspaceId,
                planId: plan.id,
                properties: { artifactId, artifactKey: artifact.artifactKey, version: artifact.version },
            });
            res.status(200).json({ success: true, data: artifact });
        } catch (error: any) {
            console.error('[PaidMediaPlanProcessor] editArtifact error:', error);
            res.status(400).json({ success: false, error: error.message ?? 'Failed to edit artifact' });
        }
    }

    async regenerateArtifact(req: Request, res: Response): Promise<void> {
        try {
            const artifactId = parseInt(String(req.params.artifactId), 10);
            const artifact = await this.artifactService.get(artifactId);
            await this.eventService.record({
                planId: artifact.planId,
                stepId: artifact.stepId,
                eventType: 'plan_artifact_regenerated',
                message: `Artifact ${artifact.artifactKey} regenerate requested`,
                data: { artifactId },
            });
            res.status(202).json({ success: true, data: { status: 'queued', artifactId, note: 'Regeneration with instructions is available after the loop engine upgrade' } });
        } catch (error: any) {
            console.error('[PaidMediaPlanProcessor] regenerateArtifact error:', error);
            res.status(400).json({ success: false, error: error.message ?? 'Failed to regenerate artifact' });
        }
    }

    async exportPlan(req: Request, res: Response): Promise<void> {
        try {
            const planId = parseInt(String(req.params.planId), 10);
            await this.exportService.exportPlan(planId, res);
        } catch (error: any) {
            console.error('[PaidMediaPlanProcessor] exportPlan error:', error);
            if (!res.headersSent) {
                res.status(400).json({ success: false, error: error.message ?? 'Export failed' });
            }
        }
    }

    async publishPlan(req: Request, res: Response): Promise<void> {
        try {
            const planId = parseInt(String(req.params.planId), 10);
            const createCampaigns = req.body?.createCampaigns === true;
            const result = await PlanLaunchService.getInstance().publish(planId, {
                createCampaigns,
                userId: this.userId(req),
            });
            res.status(200).json({
                success: true,
                data: { plan: await this.service.get(planId), campaigns: result.campaigns, targets: result.targets },
            });
        } catch (error: any) {
            console.error('[PaidMediaPlanProcessor] publishPlan error:', error);
            res.status(400).json({ success: false, error: error.message ?? 'Failed to publish plan' });
        }
    }

    async syncResults(req: Request, res: Response): Promise<void> {
        try {
            const planId = parseInt(String(req.params.planId), 10);
            const outcomes = await PlanOutcomeService.getInstance().sync(planId, {
                startDate: req.body?.startDate ?? null,
                endDate: req.body?.endDate ?? null,
            });
            res.status(200).json({ success: true, data: { outcomes } });
        } catch (error: any) {
            console.error('[PaidMediaPlanProcessor] syncResults error:', error);
            res.status(400).json({ success: false, error: error.message ?? 'Failed to sync results' });
        }
    }
}
