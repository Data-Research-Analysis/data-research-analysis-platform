import { Request, Response } from 'express';
import { getAppDataSource } from '../datasources/PostgresDS.js';
import { DRAProject } from '../models/DRAProject.js';
import { DRAProjectMember } from '../models/DRAProjectMember.js';
import { DRAOrganizationMember } from '../models/DRAOrganizationMember.js';
import { DRAWorkspace } from '../models/DRAWorkspace.js';
import { DRAUsersPlatform } from '../models/DRAUsersPlatform.js';
import { DRAPaidMediaPlan } from '../models/DRAPaidMediaPlan.js';
import { PaidMediaPlanService } from '../services/PaidMediaPlanService.js';
import { PaidMediaPlanProcessor } from './PaidMediaPlanProcessor.js';
import { GuestPlanService } from '../services/GuestPlanService.js';
import { PlanExecutionEngine } from '../services/PlanExecutionEngine.js';
import { SkillRunnerService } from '../services/SkillRunnerService.js';
import { PlanEventService } from '../services/PlanEventService.js';
import { PlanArtifactService } from '../services/PlanArtifactService.js';
import { GUEST_MAX_STEP_NUMBER } from '../constants/planSteps.js';
import { ProductAnalyticsService } from '../services/ProductAnalyticsService.js';
import { TierEnforcementService } from '../services/TierEnforcementService.js';
import { IPlanScopedCreateInput } from '../types/IPaidMediaPlan.js';

/**
 * Guest (lead-in) plan flows.
 *
 * Guests create a plan with only their website plus the basic-mode fields.
 * The plan is stored as a normal plan row with is_guest = true and scoping
 * columns null; access is via a high-entropy token kept in Redis with a 24h
 * TTL (see GuestPlanService). Registering claims the plan into the user's
 * personal project so the lead is not lost.
 *
 * The 24h preview is enforced server-side on the plan row itself (created_at
 * + 24h), not only by the Redis token TTL — a guest plan older than 24h is
 * expired even if a stale token still resolves. Quota semantics: claiming a
 * plan within its 24h window consumes one monthly plan build; claiming after
 * expiry is rejected, so quota is untouched until the user builds a new plan.
 */

const GUEST_PLAN_HOURS = 24;
const GUEST_PLAN_TTL_MS = GUEST_PLAN_HOURS * 60 * 60 * 1000;

export class GuestPlanProcessor {
    private service = PaidMediaPlanService.getInstance();
    private guestService = GuestPlanService.getInstance();
    private plansProcessor = new PaidMediaPlanProcessor();
    private runner = SkillRunnerService.getInstance();
    private eventService = PlanEventService.getInstance();
    private analyticsService = ProductAnalyticsService.getInstance();

    private guestToken(req: Request): string {
        return String(req.params.guestToken ?? '');
    }

    private async resolvePlan(req: Request): Promise<number | null> {
        const planId = await this.guestService.resolve(this.guestToken(req));
        if (!planId) return null;
        const plan = await this.service.get(planId).catch(() => null);
        if (!plan || !plan.isGuest) return null;
        // Server-side 24h expiry: the preview contract holds even if a Redis
        // token outlived its TTL (flush, restart, manual key reset).
        const createdAt = plan.created_at ? new Date(plan.created_at).getTime() : Date.now();
        if (Date.now() - createdAt > GUEST_PLAN_TTL_MS) {
            await this.guestService.revoke(this.guestToken(req), planId);
            return null;
        }
        return planId;
    }

    async createGuestPlan(req: Request, res: Response): Promise<void> {
        try {
            const body = req.body ?? {};
            const website = String(body.website ?? '').trim();
            const platforms = Array.isArray(body.platforms) ? body.platforms : [];
            const markets = Array.isArray(body.markets) ? body.markets : [];
            const startDate = String(body.startDate ?? '').trim();
            const endDate = String(body.endDate ?? '').trim();

            if (!website) {
                res.status(400).json({ success: false, error: 'website is required in guest mode' });
                return;
            }
            if (!platforms.length || !markets.length || !startDate || !endDate) {
                res.status(400).json({ success: false, error: 'platforms, markets, startDate and endDate are required' });
                return;
            }

            const token = this.guestService.generateToken();
            const input: IPlanScopedCreateInput = {
                projectId: null,
                name: String(body.name ?? '').trim() || 'Paid Media Plan',
                website,
                mode: 'basic',
                funnelCoverage: body.funnelCoverage,
                buildMode: body.buildMode,
                platforms,
                markets,
                budgetTotal: body.budgetTotal != null ? Number(body.budgetTotal) : undefined,
                currency: body.currency,
                startDate,
                endDate,
                autonomy: 'auto',
                isGuest: true,
                guestToken: token,
                organizationId: null,
                workspaceId: null,
                createdBy: null,
            };

            const plan = await this.service.create(input);
            await this.guestService.bind(token, plan.id);
            await this.eventService.record({
                planId: plan.id,
                stepId: null,
                eventType: 'plan_created',
                message: `Guest plan "${plan.name}" created`,
            });

            PlanExecutionEngine.getInstance().enqueue(plan.id);

            res.status(201).json({ success: true, data: { ...plan, guestToken: token } });
        } catch (error: any) {
            console.error('[GuestPlanProcessor] createGuestPlan error:', error);
            res.status(400).json({ success: false, error: error.message ?? 'Failed to create guest plan' });
        }
    }

    async getGuestPlan(req: Request, res: Response): Promise<void> {
        try {
            const planId = await this.resolvePlan(req);
            if (!planId) {
                res.status(404).json({ success: false, error: 'Guest plan not found or expired. Register to keep your plan.' });
                return;
            }
            const plan = await this.service.get(planId);
            res.status(200).json({ success: true, data: { ...plan, guestToken: this.guestToken(req) } });
        } catch (error: any) {
            console.error('[GuestPlanProcessor] getGuestPlan error:', error);
            res.status(404).json({ success: false, error: error.message ?? 'Guest plan not found or expired' });
        }
    }

    async startGuestPlan(req: Request, res: Response): Promise<void> {
        try {
            const planId = await this.resolvePlan(req);
            if (!planId) {
                res.status(404).json({ success: false, error: 'Guest plan not found or expired' });
                return;
            }
            const plan = await this.service.update(planId, { status: 'running' });
            await this.eventService.record({
                planId,
                stepId: null,
                eventType: 'plan_started',
                message: 'Guest plan started',
                socketEvent: 'plan:updated',
                socketData: { planId, status: 'running' },
            });
            PlanExecutionEngine.getInstance().enqueue(planId);
            res.status(202).json({ success: true, data: { planId, status: 'queued' } });
        } catch (error: any) {
            console.error('[GuestPlanProcessor] startGuestPlan error:', error);
            res.status(400).json({ success: false, error: error.message ?? 'Failed to start guest plan' });
        }
    }

    async runGuestStep(req: Request, res: Response): Promise<void> {
        try {
            const planId = await this.resolvePlan(req);
            if (!planId) {
                res.status(404).json({ success: false, error: 'Guest plan not found or expired' });
                return;
            }
            const stepKey = String(req.params.stepKey);
            const step = await this.service.getStep(planId, stepKey);
            if (!step) {
                res.status(404).json({ success: false, error: 'Step not found' });
                return;
            }
            if (step.step_number > GUEST_MAX_STEP_NUMBER) {
                res.status(403).json({
                    success: false,
                    error: 'Register a free account to unlock this deliverable.',
                    code: 'guest_step_locked',
                });
                return;
            }
            const result = await this.runner.run(planId, stepKey, { trigger: 'user', userId: 0 });
            PlanExecutionEngine.getInstance().enqueue(planId);
            res.status(200).json({ success: true, data: result });
        } catch (error: any) {
            console.error('[GuestPlanProcessor] runGuestStep error:', error);
            res.status(400).json({ success: false, error: error.message ?? 'Failed to run step' });
        }
    }

    async listGuestEvents(req: Request, res: Response): Promise<void> {
        try {
            const planId = await this.resolvePlan(req);
            if (!planId) {
                res.status(404).json({ success: false, error: 'Guest plan not found or expired' });
                return;
            }
            const since = req.query.since ? parseInt(String(req.query.since), 10) : undefined;
            const events = await this.eventService.list(planId, since);
            res.status(200).json({ success: true, data: events });
        } catch (error: any) {
            console.error('[GuestPlanProcessor] listGuestEvents error:', error);
            res.status(404).json({ success: false, error: error.message ?? 'Failed to list events' });
        }
    }

    async listGuestArtifacts(req: Request, res: Response): Promise<void> {
        try {
            const planId = await this.resolvePlan(req);
            if (!planId) {
                res.status(404).json({ success: false, error: 'Guest plan not found or expired' });
                return;
            }
            const artifacts = await PlanArtifactService.getInstance().list(planId, true);
            res.status(200).json({ success: true, data: artifacts });
        } catch (error: any) {
            console.error('[GuestPlanProcessor] listGuestArtifacts error:', error);
            res.status(404).json({ success: false, error: error.message ?? 'Failed to list artifacts' });
        }
    }

    async listGuestMessages(req: Request, res: Response): Promise<void> {
        try {
            const planId = await this.resolvePlan(req);
            if (!planId) {
                res.status(404).json({ success: false, error: 'Guest plan not found or expired' });
                return;
            }
            const since = req.query.since ? parseInt(String(req.query.since), 10) : undefined;
            const limit = req.query.limit ? parseInt(String(req.query.limit), 10) : 200;
            const messages = await this.service.listMessages(planId, since, limit);
            res.status(200).json({ success: true, data: messages });
        } catch (error: any) {
            console.error('[GuestPlanProcessor] listGuestMessages error:', error);
            res.status(404).json({ success: false, error: error.message ?? 'Failed to list messages' });
        }
    }

    async postMessage(req: Request, res: Response): Promise<void> {
        try {
            const planId = await this.resolvePlan(req);
            if (!planId) {
                res.status(404).json({ success: false, error: 'Guest plan not found or expired' });
                return;
            }
            const body = req.body ?? {};

            if (body.gateId && typeof body.answer === 'string') {
                const step = await this.plansProcessor.findStepByGate(planId, body.gateId);
                if (!step) {
                    res.status(404).json({ success: false, error: 'Gate not found' });
                    return;
                }
                const result = await this.runner.resume(planId, step.stepKey, body.answer);
                PlanExecutionEngine.getInstance().enqueue(planId);
                res.status(200).json({ success: true, data: result });
                return;
            }

            const content = String(body.content ?? '').trim();
            if (!content) {
                res.status(400).json({ success: false, error: 'content is required' });
                return;
            }

            const plan = await this.service.get(planId);
            const waitingStep = (plan.steps ?? []).find((s) => s.status === 'waiting_for_input');
            if (waitingStep) {
                const result = await this.runner.resume(planId, waitingStep.stepKey, content);
                PlanExecutionEngine.getInstance().enqueue(planId);
                res.status(200).json({ success: true, data: result });
                return;
            }

            const steps = await this.service.listSteps(planId);
            const result = await this.plansProcessor.handleFreeForm(planId, plan, steps, content);
            res.status(200).json({ success: true, data: result });
        } catch (error: any) {
            console.error('[GuestPlanProcessor] postMessage error:', error);
            res.status(400).json({ success: false, error: error.message ?? 'Failed to process message' });
        }
    }

    /**
     * Registering guest keeps their plan: attach it to the user's personal
     * organization + a default project, clear the guest markers, and revoke
     * the Redis token so only the user can see it from now on.
     */
    async claimGuestPlan(req: Request, res: Response): Promise<void> {
        try {
            const userId = (req as any).tokenDetails?.user_id ?? (req as any).user?.id;
            if (!userId) {
                res.status(401).json({ success: false, error: 'Authentication required' });
                return;
            }
            const planId = await this.resolvePlan(req);
            if (!planId) {
                res.status(404).json({ success: false, error: 'Guest plan not found or expired' });
                return;
            }

            const dataSource = await getAppDataSource();
            const memberRepo = dataSource.getRepository(DRAOrganizationMember);
            const member = await memberRepo.findOne({
                where: { users_platform_id: userId, role: 'owner', is_active: true },
            });
            if (!member) {
                res.status(400).json({ success: false, error: 'You need an organization to claim a plan' });
                return;
            }

            const workspaceRepo = dataSource.getRepository(DRAWorkspace);
            const workspace = await workspaceRepo.findOne({
                where: { organization_id: member.organization_id, is_active: true },
            });
            if (!workspace) {
                res.status(400).json({ success: false, error: 'You need a workspace to claim a plan' });
                return;
            }

            const userRepo = dataSource.getRepository(DRAUsersPlatform);
            const user = await userRepo.findOne({ where: { id: userId } });
            if (!user) {
                res.status(400).json({ success: false, error: 'User not found' });
                return;
            }

            // Create a default project the claimed plan lives in, mirroring
            // ProjectProcessor.addProject (project row + analyst member row).
            const projectRepo = dataSource.getRepository(DRAProject);
            const projectMemberRepo = dataSource.getRepository(DRAProjectMember);
            let project = await projectRepo.findOne({
                where: { organization_id: member.organization_id, name: 'Lead-in Plans' },
            });
            if (!project) {
                project = projectRepo.create({
                    name: 'Lead-in Plans',
                    description: 'Plans built before you registered are saved here.',
                    organization_id: member.organization_id,
                    workspace_id: workspace.id,
                });
                project.users_platform = user;
                project = await projectRepo.save(project);
                await projectMemberRepo.save(
                    projectMemberRepo.create({
                        project: project,
                        user: user,
                        marketing_role: 'analyst',
                    })
                );
            }

            const planRepo = dataSource.getRepository(DRAPaidMediaPlan);
            const planRow = await planRepo.findOne({ where: { id: planId } });
            if (!planRow) {
                res.status(404).json({ success: false, error: 'Plan not found' });
                return;
            }
            planRow.project_id = project.id;
            planRow.organization_id = member.organization_id;
            planRow.workspace_id = workspace.id;
            planRow.created_by = userId;
            planRow.is_guest = false;
            planRow.guest_token = null;
            await planRepo.save(planRow);

            await this.guestService.revoke(this.guestToken(req), planId);
            await this.eventService.record({
                planId,
                stepId: null,
                eventType: 'plan_claimed',
                message: 'Guest plan claimed by registered user',
            });

            // The plan may have paused at the guest step limit; claiming it
            // unlocks the remaining steps, so hand it back to the engine.
            const claimedPlan = await this.service.get(planId);
            const hasPendingWork =
                claimedPlan.status !== 'completed' &&
                claimedPlan.status !== 'failed' &&
                (claimedPlan.steps ?? []).some((s) => s.status === 'pending' || s.status === 'failed');
            if (hasPendingWork) {
                await this.service.update(planId, { status: 'running' });
                PlanExecutionEngine.getInstance().enqueue(planId);
            }

            // The guest build is the user's plan build for this month. Counting
            // it here means a free account gets one plan build no matter whether
            // it was created directly or carried over from a guest preview.
            await TierEnforcementService.getInstance().incrementPlanBuildCount(userId);
            await this.analyticsService.record({
                eventName: 'guest_plan_claimed',
                userId,
                projectId: project.id,
                organizationId: member.organization_id,
                workspaceId: workspace.id,
                planId,
            });

            const plan = await this.service.get(planId);
            res.status(200).json({ success: true, data: plan });
        } catch (error: any) {
            console.error('[GuestPlanProcessor] claimGuestPlan error:', error);
            res.status(400).json({ success: false, error: error.message ?? 'Failed to claim guest plan' });
        }
    }
}
