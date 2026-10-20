import { getAppDataSource } from '../datasources/PostgresDS.js';
import { DRAPaidMediaPlan } from '../models/DRAPaidMediaPlan.js';
import { DRAPaidMediaPlanStep } from '../models/DRAPaidMediaPlanStep.js';
import { DRAPaidMediaPlanMessage } from '../models/DRAPaidMediaPlanMessage.js';
import { DRAPaidMediaPlanArtifact } from '../models/DRAPaidMediaPlanArtifact.js';
import { DRAPaidMediaPlanEvent } from '../models/DRAPaidMediaPlanEvent.js';
import { DRACampaign } from '../models/DRACampaign.js';
import {
    IPlanCreateInput,
    IPlanScopedCreateInput,
    IPlanDetail,
    IPlanStep,
    IPlanMessage,
    IPlanSummary,
    PlanStepStatus,
    PlanMessageRole,
    PlanStatus,
    IPlanState,
    IPlanGate,
} from '../types/IPaidMediaPlan.js';
import {
    PLAN_STEP_DEFINITIONS,
    PLAN_DEFAULT_AUTONOMY,
    PLAN_DEFAULT_CURRENCY,
    PLAN_DEFAULT_MODE,
    PLAN_DEFAULT_FUNNEL_COVERAGE,
    PLAN_DEFAULT_BUILD_MODE,
} from '../constants/planSteps.js';

function slugify(value: string): string {
    return value
        .toLowerCase()
        .trim()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-+|-+$/g, '')
        .slice(0, 60);
}

function planToSummary(row: DRAPaidMediaPlan, completedStepCount: number, stepCount: number, artifactCount: number): IPlanSummary {
    return {
        id: row.id,
        projectId: row.project_id,
        name: row.name,
        slug: row.slug,
        mode: row.mode,
        status: row.status,
        funnelCoverage: row.funnel_coverage,
        buildMode: row.build_mode,
        platforms: row.platforms ?? [],
        markets: row.markets ?? [],
        budgetTotal: row.budget_total !== null ? Number(row.budget_total) : null,
        currency: row.currency,
        currentStep: row.current_step,
        completedStepCount,
        stepCount,
        artifactCount,
        updatedAt: row.updated_at.toISOString(),
    };
}

function stepToDTO(row: DRAPaidMediaPlanStep, phase: string): IPlanStep {
    return {
        id: row.id,
        planId: row.plan_id,
        stepNumber: row.step_number,
        stepKey: row.step_key,
        title: row.title,
        phase: phase as IPlanStep['phase'],
        status: row.status,
        startedAt: row.started_at ? row.started_at.toISOString() : null,
        completedAt: row.completed_at ? row.completed_at.toISOString() : null,
        durationMs: row.duration_ms,
        attempts: row.attempts,
        error: row.error,
        outputSummary: row.output_summary,
        gate: row.gate,
        runMeta: row.run_meta,
        createdAt: row.created_at.toISOString(),
        updatedAt: row.updated_at.toISOString(),
    };
}

function messageToDTO(row: DRAPaidMediaPlanMessage): IPlanMessage {
    return {
        id: row.id,
        planId: row.plan_id,
        stepId: row.step_id,
        role: row.role,
        content: row.content,
        metadata: row.metadata,
        createdAt: row.created_at.toISOString(),
    };
}

export class PaidMediaPlanService {
    private static instance: PaidMediaPlanService;

    private constructor() {}

    public static getInstance(): PaidMediaPlanService {
        if (!PaidMediaPlanService.instance) {
            PaidMediaPlanService.instance = new PaidMediaPlanService();
        }
        return PaidMediaPlanService.instance;
    }

    public static resetInstance(): void {
        PaidMediaPlanService.instance = null as any;
    }

    private phaseForStepKey(stepKey: string): string {
        const definition = PLAN_STEP_DEFINITIONS.find((d) => d.stepKey === stepKey);
        return definition?.phase ?? 'discover';
    }

    private toDateString(value: Date | string): string {
        if (value instanceof Date) return value.toISOString().slice(0, 10);
        return String(value).slice(0, 10);
    }

    public async create(input: IPlanScopedCreateInput): Promise<IPlanDetail> {
        const dataSource = await getAppDataSource();
        const repository = dataSource.getRepository(DRAPaidMediaPlan);
        const stepRepository = dataSource.getRepository(DRAPaidMediaPlanStep);

        const name = input.name?.trim() || 'Paid Media Plan';
        const website = input.website?.trim() || null;
        const baseSlug = `paid-media-plan-${slugify(name) || 'plan'}`;
        let slug = baseSlug;
        let attempt = 0;
        while (attempt < 5) {
            const existing = await repository.findOne({ where: { project_id: input.projectId, slug } });
            if (!existing) break;
            attempt += 1;
            slug = `${baseSlug}-${Date.now().toString(36)}`;
        }

        const initialState: IPlanState = {
            core_facts: {
                ...(website ? { website } : {}),
                platforms: input.platforms ?? [],
                markets: input.markets ?? [],
                budget: { total: input.budgetTotal ?? null, currency: input.currency ?? PLAN_DEFAULT_CURRENCY },
                dates: { start: input.startDate ?? null, end: input.endDate ?? null },
                ...(input.industry ? { industry: input.industry } : {}),
                ...(input.competitors?.length ? { competitors: input.competitors } : {}),
                ...(input.notes?.trim() ? { notes: input.notes.trim() } : {}),
                ...(input.product || input.teamSize || input.channels?.length
                    ? {
                          company: {
                              ...(input.product ? { product_service: input.product } : {}),
                              ...(input.teamSize != null ? { team_size: input.teamSize } : {}),
                              ...(input.channels?.length ? { channels: input.channels } : {}),
                          },
                      }
                    : {}),
            },
            funnel_and_scale: {
                coverage: input.funnelCoverage ?? PLAN_DEFAULT_FUNNEL_COVERAGE,
                build_mode: input.buildMode ?? PLAN_DEFAULT_BUILD_MODE,
            },
            ...(website ? { basic_mode_source: { url: website, verified: [], open_questions: [] } } : {}),
            ...(input.mode === 'advanced' ? { client_brief: this.compileBriefFromCreate(input) } : {}),
        };

        const plan = repository.create({
            project_id: input.projectId,
            organization_id: input.organizationId,
            workspace_id: input.workspaceId,
            created_by: input.createdBy,
            is_guest: input.isGuest ?? false,
            guest_token: input.guestToken ?? null,
            name,
            slug,
            mode: input.mode ?? PLAN_DEFAULT_MODE,
            status: 'draft',
            funnel_coverage: input.funnelCoverage ?? PLAN_DEFAULT_FUNNEL_COVERAGE,
            build_mode: input.buildMode ?? PLAN_DEFAULT_BUILD_MODE,
            platforms: input.platforms ?? [],
            markets: input.markets ?? [],
            budget_total: input.budgetTotal ?? null,
            currency: input.currency ?? PLAN_DEFAULT_CURRENCY,
            start_date: input.startDate ? new Date(input.startDate) : null,
            end_date: input.endDate ? new Date(input.endDate) : null,
            current_step: 0,
            state: initialState,
            settings: { autonomy: input.autonomy ?? PLAN_DEFAULT_AUTONOMY },
        });

        const saved = await repository.save(plan);

        const stepRows = PLAN_STEP_DEFINITIONS.map((definition) =>
            stepRepository.create({
                plan_id: saved.id,
                step_number: definition.stepNumber,
                step_key: definition.stepKey,
                title: definition.title,
                status: 'pending',
                attempts: 0,
                completed_at: null,
                output_summary: null,
                gate: null,
                run_meta: null,
            })
        );
        await stepRepository.save(stepRows);

        return this.get(saved.id);
    }

    public async list(projectId: number): Promise<IPlanSummary[]> {
        const dataSource = await getAppDataSource();
        const repository = dataSource.getRepository(DRAPaidMediaPlan);
        const rows = await repository.find({ where: { project_id: projectId }, order: { updated_at: 'DESC' } });

        const summaries: IPlanSummary[] = [];
        for (const row of rows) {
            const stepCount = PLAN_STEP_DEFINITIONS.length;
            const completed = await dataSource
                .getRepository(DRAPaidMediaPlanStep)
                .count({ where: { plan_id: row.id, status: 'completed' } });
            const artifactCount = await dataSource
                .getRepository(DRAPaidMediaPlanArtifact)
                .count({ where: { plan_id: row.id, is_current: true } });
            summaries.push(planToSummary(row, completed, stepCount, artifactCount));
        }
        return summaries;
    }

    public async get(planId: number): Promise<IPlanDetail> {
        const dataSource = await getAppDataSource();
        const repository = dataSource.getRepository(DRAPaidMediaPlan);
        const row = await repository.findOne({ where: { id: planId } });
        if (!row) {
            throw new Error(`Plan not found: ${planId}`);
        }

        const stepRows = await dataSource
            .getRepository(DRAPaidMediaPlanStep)
            .find({ where: { plan_id: planId }, order: { step_number: 'ASC' } });
        const artifactCount = await dataSource
            .getRepository(DRAPaidMediaPlanArtifact)
            .count({ where: { plan_id: planId, is_current: true } });

        const completedStepCount = stepRows.filter((s) => s.status === 'completed').length;
        const lastRunning = stepRows.filter((s) => s.status === 'running' || s.status === 'waiting_for_input').slice(-1)[0];

        return {
            id: row.id,
            projectId: row.project_id,
            organizationId: row.organization_id,
            workspaceId: row.workspace_id,
            createdBy: row.created_by,
            isGuest: row.is_guest,
            guestToken: row.guest_token,
            name: row.name,
            slug: row.slug,
            mode: row.mode,
            status: row.status,
            funnelCoverage: row.funnel_coverage,
            buildMode: row.build_mode,
            platforms: row.platforms ?? [],
            markets: row.markets ?? [],
            budgetTotal: row.budget_total !== null ? Number(row.budget_total) : null,
            currency: row.currency,
            startDate: row.start_date ? this.toDateString(row.start_date) : null,
            endDate: row.end_date ? this.toDateString(row.end_date) : null,
            currentStep: row.current_step,
            state: (row.state ?? {}) as IPlanState,
            settings: row.settings ?? {},
            createdAt: row.created_at.toISOString(),
            updatedAt: row.updated_at.toISOString(),
            steps: stepRows.map((stepRow) => stepToDTO(stepRow, this.phaseForStepKey(stepRow.step_key))),
            stepCount: stepRows.length,
            completedStepCount,
            artifactCount,
            lastRunStepKey: lastRunning ? lastRunning.step_key : null,
        };
    }

    public async update(planId: number, patch: Partial<IPlanDetail>): Promise<IPlanDetail> {
        const repository = (await getAppDataSource()).getRepository(DRAPaidMediaPlan);
        const row = await repository.findOne({ where: { id: planId } });
        if (!row) {
            throw new Error(`Plan not found: ${planId}`);
        }
        if (patch.name !== undefined) row.name = patch.name;
        if (patch.mode !== undefined) row.mode = patch.mode;
        if (patch.status !== undefined) row.status = patch.status;
        if (patch.funnelCoverage !== undefined) row.funnel_coverage = patch.funnelCoverage;
        if (patch.buildMode !== undefined) row.build_mode = patch.buildMode;
        if (patch.platforms !== undefined) row.platforms = patch.platforms;
        if (patch.markets !== undefined) row.markets = patch.markets;
        if (patch.budgetTotal !== undefined) row.budget_total = patch.budgetTotal;
        if (patch.currency !== undefined) row.currency = patch.currency;
        if (patch.startDate !== undefined) row.start_date = patch.startDate ? new Date(patch.startDate) : null;
        if (patch.endDate !== undefined) row.end_date = patch.endDate ? new Date(patch.endDate) : null;
        if (patch.settings !== undefined) row.settings = patch.settings;
        if (patch.state !== undefined) row.state = patch.state;
        await repository.save(row);
        return this.get(planId);
    }

    public async delete(planId: number): Promise<void> {
        const repository = (await getAppDataSource()).getRepository(DRAPaidMediaPlan);
        const row = await repository.findOne({ where: { id: planId } });
        if (!row) {
            throw new Error(`Plan not found: ${planId}`);
        }
        await repository.remove(row);
    }

    public async setStatus(planId: number, status: PlanStatus): Promise<IPlanDetail> {
        return this.update(planId, { status });
    }

    // ===== Steps =====

    public async getStep(planId: number, stepKey: string): Promise<DRAPaidMediaPlanStep> {
        const repository = (await getAppDataSource()).getRepository(DRAPaidMediaPlanStep);
        const step = await repository.findOne({ where: { plan_id: planId, step_key: stepKey } });
        if (!step) {
            throw new Error(`Step ${stepKey} not found for plan ${planId}`);
        }
        return step;
    }

    public async listSteps(planId: number): Promise<IPlanStep[]> {
        const dataSource = await getAppDataSource();
        const rows = await dataSource
            .getRepository(DRAPaidMediaPlanStep)
            .find({ where: { plan_id: planId }, order: { step_number: 'ASC' } });
        return rows.map((row) => stepToDTO(row, this.phaseForStepKey(row.step_key)));
    }

    public async updateStep(
        planId: number,
        stepKey: string,
        patch: Partial<{
            status: PlanStepStatus;
            startedAt: Date | null;
            completedAt: Date | null;
            durationMs: number | null;
            attempts: number;
            error: string | null;
            outputSummary: string | null;
            gate: IPlanGate | null;
            runMeta: Record<string, any> | null;
        }>
    ): Promise<DRAPaidMediaPlanStep> {
        const repository = (await getAppDataSource()).getRepository(DRAPaidMediaPlanStep);
        const step = await this.getStep(planId, stepKey);
        if (patch.status !== undefined) step.status = patch.status;
        if (patch.startedAt !== undefined) step.started_at = patch.startedAt;
        if (patch.completedAt !== undefined) step.completed_at = patch.completedAt;
        if (patch.durationMs !== undefined) step.duration_ms = patch.durationMs;
        if (patch.attempts !== undefined) step.attempts = patch.attempts;
        if (patch.error !== undefined) step.error = patch.error;
        if (patch.outputSummary !== undefined) step.output_summary = patch.outputSummary;
        if (patch.gate !== undefined) step.gate = patch.gate;
        if (patch.runMeta !== undefined) step.run_meta = patch.runMeta;
        await repository.save(step);
        return step;
    }

    public async updatePlanCurrentStep(planId: number, stepKey: string, stepNumber: number): Promise<void> {
        const repository = (await getAppDataSource()).getRepository(DRAPaidMediaPlan);
        const row = await repository.findOne({ where: { id: planId } });
        if (!row) return;
        row.current_step = stepNumber;
        await repository.save(row);
        if (row.created_by) {
            const socketDriver = (await import('../drivers/SocketIODriver.js')).SocketIODriver.getInstance();
            await socketDriver.emitToUser(row.created_by, 'plan:updated', { planId, currentStep: stepNumber, stepKey });
        }
        if (row.guest_token) {
            const socketDriver = (await import('../drivers/SocketIODriver.js')).SocketIODriver.getInstance();
            socketDriver.emitToRoom(`guest-plan:${row.guest_token}`, 'plan:updated', { planId, currentStep: stepNumber, stepKey });
        }
    }

    // ===== Messages =====

    public async addUserNote(planId: number, text: string, source: string): Promise<void> {
        const repository = (await getAppDataSource()).getRepository(DRAPaidMediaPlan);
        const row = await repository.findOne({ where: { id: planId } });
        if (!row) return;
        const state = (row.state ?? {}) as IPlanState;
        state.user_notes = state.user_notes ?? [];
        state.user_notes.push({ text, source, at: new Date().toISOString() });
        row.state = state;
        await repository.save(row);
    }

    private compileBriefFromCreate(input: IPlanScopedCreateInput): string {
        const lines: string[] = [];
        const name = input.name?.trim();
        if (name) lines.push(`Company: ${name}`);
        const website = input.website?.trim();
        if (website) lines.push(`Website: ${website}`);
        const industry = input.industry?.trim();
        if (industry) lines.push(`Industry: ${industry}`);
        const product = input.product?.trim();
        if (product) lines.push(`Product/service: ${product}`);
        if (input.markets?.length) lines.push(`Target markets: ${input.markets.join(', ')}`);
        if (input.platforms?.length) lines.push(`Platforms: ${input.platforms.join(', ')}`);
        if (input.budgetTotal != null) lines.push(`Budget: ${input.budgetTotal} ${input.currency ?? ''}`);
        if (input.teamSize != null) lines.push(`Team size: ${input.teamSize}`);
        if (input.channels?.length) lines.push(`Existing channels: ${input.channels.filter(Boolean).join(', ')}`);
        if (input.existingCampaigns?.length) {
            lines.push(`Existing campaigns already running (analyze and improve on these): ${input.existingCampaigns.filter(Boolean).join(', ')}`);
        }
        if (input.competitors?.length) {
            const list = input.competitors
                .map((c) => (c.name ? `${c.name}${c.website ? ` (${c.website})` : ''}` : ''))
                .filter(Boolean)
                .join(', ');
            if (list) lines.push(`Competitors: ${list}`);
        }
        const notes = input.notes?.trim();
        if (notes) lines.push(`Notes: ${notes}`);
        return lines.join('\n');
    }

    public async addMessage(
        planId: number,
        stepId: number | null,
        role: PlanMessageRole,
        content: string,
        metadata?: Record<string, any> | null
    ): Promise<IPlanMessage> {
        const repository = (await getAppDataSource()).getRepository(DRAPaidMediaPlanMessage);
        const row = repository.create({
            plan_id: planId,
            step_id: stepId,
            role,
            content,
            metadata: metadata ?? null,
        });
        await repository.save(row);
        return messageToDTO(row);
    }

    public async listMessages(planId: number, since?: number, limit = 200): Promise<IPlanMessage[]> {
        const repository = (await getAppDataSource()).getRepository(DRAPaidMediaPlanMessage);
        const query = repository
            .createQueryBuilder('message')
            .where('message.plan_id = :planId', { planId })
            .orderBy('message.id', 'ASC')
            .take(Math.min(limit, 1000));
        if (since) {
            query.andWhere('message.id > :since', { since });
        }
        const rows = await query.getMany();
        return rows.map(messageToDTO);
    }

    public async countMessages(planId: number): Promise<number> {
        const repository = (await getAppDataSource()).getRepository(DRAPaidMediaPlanMessage);
        return repository.count({ where: { plan_id: planId } });
    }

    // ===== Campaign linking =====

    public async linkCampaign(planId: number, campaignId: number): Promise<void> {
        const repository = (await getAppDataSource()).getRepository(DRACampaign);
        const campaign = await repository.findOne({ where: { id: campaignId } });
        if (!campaign) {
            throw new Error(`Campaign not found: ${campaignId}`);
        }
        campaign.plan_id = planId;
        await repository.save(campaign);
    }
}
