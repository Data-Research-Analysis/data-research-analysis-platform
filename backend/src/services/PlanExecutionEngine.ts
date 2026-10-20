import { getAppDataSource } from '../datasources/PostgresDS.js';
import { DRAPaidMediaPlan } from '../models/DRAPaidMediaPlan.js';
import { DRAPaidMediaPlanStep } from '../models/DRAPaidMediaPlanStep.js';
import { PaidMediaPlanService } from './PaidMediaPlanService.js';
import { SkillRunnerService } from './SkillRunnerService.js';
import { PlanEventService } from './PlanEventService.js';
import { NotificationHelperService } from './NotificationHelperService.js';
import { GUEST_MAX_STEP_NUMBER } from '../constants/planSteps.js';

/**
 * PlanExecutionEngine
 *
 * Server-side durable execution loop for paid media plans. The plan steps table
 * IS the queue: the engine watches plans that have work to do, runs exactly one
 * step per iteration (re-reading plan/step state from the DB between steps), and
 * re-enqueues the plan so the chain continues — or stops when the plan is paused,
 * waiting at a gate, completed, or terminally failed.
 *
 * This makes a 17-step run a real long-running background process: it keeps
 * working while the user is away from the page, pauses at user gates, survives
 * backend restarts (interrupted steps are recovered and auto-retried), and can be
 * paused/resumed at will via the API.
 */
const MAX_STEP_ATTEMPTS = 3;
const STALE_RUNNING_MS = 45 * 60 * 1000;
const HEARTBEAT_MS = 60 * 1000;

export class PlanExecutionEngine {
    private static instance: PlanExecutionEngine;

    private constructor() {}

    public static getInstance(): PlanExecutionEngine {
        if (!PlanExecutionEngine.instance) {
            PlanExecutionEngine.instance = new PlanExecutionEngine();
        }
        return PlanExecutionEngine.instance;
    }

    public static resetInstance(): void {
        if (PlanExecutionEngine.instance?.heartbeat) {
            clearInterval(PlanExecutionEngine.instance.heartbeat);
        }
        PlanExecutionEngine.instance = null as any;
    }

    private queue: number[] = [];
    private queued = new Set<number>();
    private running = new Set<number>();
    private draining = false;
    private heartbeat: NodeJS.Timeout | null = null;

    /** Ask the engine to process a plan. Idempotent while the plan is queued or running. */
    public enqueue(planId: number): void {
        if (this.queued.has(planId) || this.running.has(planId)) return;
        this.queued.add(planId);
        this.queue.push(planId);
        void this.drain();
    }

    /** Boot the engine: recover orphans, re-queue incomplete plans, start heartbeat. */
    public async initialize(): Promise<void> {
        if (this.heartbeat) return;
        try {
            await this.recoverInterruptedSteps();
            await this.requeueIncompletePlans();
        } catch (error) {
            console.error('[PlanExecutionEngine] initialization error:', error);
        }
        this.heartbeat = setInterval(() => {
            void this.heartbeatTick();
        }, HEARTBEAT_MS);
        this.heartbeat.unref?.();
        this.drain();
        console.log('✅ Plan execution engine started');
    }

    public async shutdown(): Promise<void> {
        if (this.heartbeat) {
            clearInterval(this.heartbeat);
            this.heartbeat = null;
        }
    }

    // ===== Worker loop =====

    private async drain(): Promise<void> {
        if (this.draining) return;
        this.draining = true;
        try {
            while (this.queue.length > 0) {
                const planId = this.queue.shift()!;
                this.queued.delete(planId);
                try {
                    await this.processStep(planId);
                } catch (error) {
                    console.error(`[PlanExecutionEngine] error processing plan ${planId}:`, error);
                }
            }
        } finally {
            this.draining = false;
        }
    }

    private async processStep(planId: number): Promise<void> {
        const service = PaidMediaPlanService.getInstance();
        if (this.running.has(planId)) return;

        let plan: any;
        try {
            plan = await service.get(planId);
        } catch {
            return; // plan deleted
        }

        // Respect explicit lifecycle states. 'failed' plans are allowed through:
        // if their failed step is still retryable the engine heals them, and if
        // attempts are exhausted the target logic fails the plan again (no-op).
        if (plan.status === 'paused' || plan.status === 'completed' || plan.status === 'archived') {
            return;
        }

        const steps: Array<{ stepKey: string; status: string; attempts: number; stepNumber: number }> = plan.steps ?? [];

        // A step is actively running elsewhere; leave it alone.
        if (steps.some((s) => s.status === 'running')) return;

        // A gate is open; wait for the user in advanced mode. In basic mode the
        // pipeline never asks, so auto-approve the gate and continue.
        const waiting = steps.find((s) => s.status === 'waiting_for_input');
        if (waiting) {
            if (plan.mode !== 'basic') return;
            this.running.add(planId);
            try {
                await SkillRunnerService.getInstance().autoApproveGate(planId, waiting.stepKey);
            } catch (error) {
                console.error(`[PlanExecutionEngine] auto-approve failed for ${waiting.stepKey}:`, error);
            } finally {
                this.running.delete(planId);
            }
            this.enqueue(planId);
            return;
        }

        // Always advance in step order: pick the earliest step that is not
        // complete, so a failed prerequisite is never skipped over.
        const target = steps.find((s) => s.status === 'pending' || s.status === 'failed');
        if (!target) {
            if (steps.every((s) => s.status === 'completed' || s.status === 'skipped')) {
                if (plan.status !== 'completed') {
                    await service.setStatus(planId, 'completed');
                    console.log(`[PlanExecutionEngine] plan ${planId} completed`);
                }
            } else if (steps.some((s) => s.status === 'failed')) {
                await this.failPlan(planId, plan, 'A step has exhausted its retry attempts.');
            }
            return;
        }

        const stepKey = target.stepKey;

        // Guest lead-in plans stop after the free step range. The remaining
        // deliverables are the registration hook: the plan pauses here and
        // resumes (runs the locked steps) once the guest registers and claims it.
        if (plan.is_guest && target.stepNumber > GUEST_MAX_STEP_NUMBER) {
            await service.setStatus(planId, 'paused');
            await PlanEventService.getInstance().record({
                planId,
                stepId: null,
                eventType: 'guest_limit_reached',
                message: `Guest preview covers the first ${GUEST_MAX_STEP_NUMBER} steps. Register to unlock the rest.`,
                socketEvent: 'plan:updated',
                socketData: { planId, status: 'paused', reason: 'guest_limit_reached' },
            });
            console.log(`[PlanExecutionEngine] guest plan ${planId} paused at free-step limit (step ${target.stepNumber})`);
            return;
        }

        if (target.status === 'failed' && target.attempts >= MAX_STEP_ATTEMPTS) {
            await this.failPlan(planId, plan, `Step "${stepKey}" failed ${target.attempts} times.`);
            return;
        }

        this.running.add(planId);
        try {
            if (plan.status !== 'running') {
                await service.setStatus(planId, 'running');
            }
            let result: any;
            try {
                result = await SkillRunnerService.getInstance().run(planId, stepKey, {
                    trigger: 'auto',
                    userId: plan.createdBy,
                });
            } catch (error: any) {
                const step = await service.getStep(planId, stepKey).catch(() => null);
                if (step && step.status === 'pending') {
                    await service.updateStep(planId, stepKey, {
                        status: 'failed',
                        error: error.message ?? String(error),
                        completedAt: new Date(),
                    });
                    await PlanEventService.getInstance().record({
                        planId,
                        stepId: step.id,
                        eventType: 'plan_step_failed',
                        severity: 'error',
                        message: `Step ${stepKey} failed: ${error.message ?? 'unknown error'}`,
                        socketEvent: 'plan:step:failed',
                        socketData: { planId, stepKey, status: 'failed', error: error.message ?? String(error) },
                    });
                }
                result = { stepKey, status: 'failed', pausedAtGate: false, nextStepKey: null, error: error.message ?? String(error) };
            }
            if (result.status === 'failed') {
                const step = (await service.listSteps(planId)).find((s) => s.stepKey === stepKey);
                const message = step?.error ?? result.error ?? '';
                // Validation-style failures (missing deliverable, prerequisite,
                // etc.) will not fix themselves by re-running — fail the plan
                // right away so the user decides. Only transient errors get
                // auto-retried, and only up to MAX_STEP_ATTEMPTS.
                const isTransient = this.isTransientFailure(message);
                if (!isTransient || (step && step.attempts >= MAX_STEP_ATTEMPTS)) {
                    await this.failPlan(planId, plan, step ? `Step "${stepKey}" could not finish: ${message.slice(0, 300)}` : `Step "${stepKey}" could not finish.`);
                }
            }
        } finally {
            this.running.delete(planId);
        }

        // One step at a time: re-enqueue so the next step is picked from fresh
        // DB state, making the whole chain durable across restarts.
        this.enqueue(planId);
    }

    /** Errors that won't resolve by retrying the same step. */
    private isTransientFailure(message: string): boolean {
        const lower = (message ?? '').toLowerCase();
        const permanentMarkers = [
            'prerequisite step',
            'is already running',
            'not waiting for input',
            'not found',
            'invalid',
        ];
        return !permanentMarkers.some((marker) => lower.includes(marker));
    }

    private async failPlan(planId: number, plan: any, reason: string): Promise<void> {
        const service = PaidMediaPlanService.getInstance();
        if (plan.status === 'failed') return;
        await service.setStatus(planId, 'failed');
        await PlanEventService.getInstance().record({
            planId,
            stepId: null,
            eventType: 'plan_failed',
            severity: 'error',
            message: reason,
            socketEvent: 'plan:updated',
            socketData: { planId, status: 'failed', reason },
        });
        if (plan.createdBy) {
            await NotificationHelperService.getInstance().notifyPlanStepFailed(
                plan.createdBy,
                plan.projectId,
                planId,
                'plan',
                reason
            );
        }
        console.log(`[PlanExecutionEngine] plan ${planId} failed: ${reason}`);
    }

    // ===== Recovery & maintenance =====

    /** At boot: steps left 'running' by a previous process are orphans — mark them
     *  failed and queue their plans for automatic retry. */
    private async recoverInterruptedSteps(): Promise<void> {
        const dataSource = await getAppDataSource();
        const stepRepo = dataSource.getRepository(DRAPaidMediaPlanStep);
        const rows = await stepRepo.find({ where: { status: 'running' } });
        const affected = new Set<number>();
        for (const row of rows) {
            row.status = 'failed';
            row.error = 'Interrupted — the plan engine restarted. The step will be retried automatically.';
            row.completed_at = new Date();
            await stepRepo.save(row);
            await PlanEventService.getInstance().record({
                planId: row.plan_id,
                stepId: row.id,
                eventType: 'plan_step_failed',
                severity: 'warn',
                message: `Step ${row.step_key} was interrupted by an engine restart and queued for retry`,
                socketEvent: 'plan:step:failed',
                socketData: { planId: row.plan_id, stepKey: row.step_key, status: 'failed', error: row.error },
            });
            affected.add(row.plan_id);
        }
        for (const planId of affected) this.enqueue(planId);
        if (rows.length > 0) {
            console.log(`[PlanExecutionEngine] recovered ${rows.length} interrupted step(s)`);
        }
    }

    /** At boot: any plan that has pending work but is not queued gets enqueued. */
    private async requeueIncompletePlans(): Promise<void> {
        const dataSource = await getAppDataSource();
        const planRepo = dataSource.getRepository(DRAPaidMediaPlan);
        const rows = await planRepo.find({ where: [{ status: 'draft' }, { status: 'running' }, { status: 'failed' }] });
        const service = PaidMediaPlanService.getInstance();
        let count = 0;
        for (const row of rows) {
            const steps = await service.listSteps(row.id);
            if (
                steps.some((s) => s.status === 'pending') ||
                steps.some((s) => s.status === 'failed' && s.attempts < MAX_STEP_ATTEMPTS) ||
                (row.mode === 'basic' && steps.some((s) => s.status === 'waiting_for_input'))
            ) {
                this.enqueue(row.id);
                count += 1;
            }
        }
        if (count > 0) {
            console.log(`[PlanExecutionEngine] re-queued ${count} incomplete plan(s)`);
        }
    }

    /** Periodic maintenance: heal genuinely stuck steps and re-kick anything that
     *  has pending work but was never re-enqueued. */
    private async heartbeatTick(): Promise<void> {
        try {
            const dataSource = await getAppDataSource();
            const stepRepo = dataSource.getRepository(DRAPaidMediaPlanStep);
            const cutoff = new Date(Date.now() - STALE_RUNNING_MS);
            const stale = await stepRepo
                .createQueryBuilder('step')
                .where('step.status = :status', { status: 'running' })
                .andWhere('step.started_at IS NOT NULL')
                .andWhere('step.started_at < :cutoff', { cutoff })
                .getMany();
            const affected = new Set<number>();
            for (const row of stale) {
                row.status = 'failed';
                row.error = 'Interrupted — the step ran too long and was recovered by the plan engine.';
                row.completed_at = new Date();
                await stepRepo.save(row);
                await PlanEventService.getInstance().record({
                    planId: row.plan_id,
                    stepId: row.id,
                    eventType: 'plan_step_failed',
                    severity: 'warn',
                    message: `Step ${row.step_key} was recovered after running too long`,
                    socketEvent: 'plan:step:failed',
                    socketData: { planId: row.plan_id, stepKey: row.step_key, status: 'failed', error: row.error },
                });
                affected.add(row.plan_id);
            }
            for (const planId of affected) this.enqueue(planId);

            const planRepo = dataSource.getRepository(DRAPaidMediaPlan);

            // Expire guest previews: the access token lives for 24h, so the
            // underlying anonymous plan row is removed afterwards (children
            // cascade). Running plans are left for the next tick.
            const guestCutoff = new Date(Date.now() - 24 * 60 * 60 * 1000);
            await planRepo
                .createQueryBuilder()
                .delete()
                .from(DRAPaidMediaPlan)
                .where('is_guest = true')
                .andWhere('created_at < :guestCutoff', { guestCutoff })
                .andWhere('status != :running', { running: 'running' })
                .execute();

            const planRows = await planRepo.find({ where: [{ status: 'draft' }, { status: 'running' }, { status: 'failed' }] });
            const service = PaidMediaPlanService.getInstance();
            for (const row of planRows) {
                if (this.queued.has(row.id) || this.running.has(row.id)) continue;
                const steps = await service.listSteps(row.id);
                if (
                    steps.some((s) => s.status === 'pending') ||
                    steps.some((s) => s.status === 'failed' && s.attempts < MAX_STEP_ATTEMPTS) ||
                    (row.mode === 'basic' && steps.some((s) => s.status === 'waiting_for_input'))
                ) {
                    this.enqueue(row.id);
                }
            }
        } catch (error) {
            console.error('[PlanExecutionEngine] heartbeat error:', error);
        }
    }
}
