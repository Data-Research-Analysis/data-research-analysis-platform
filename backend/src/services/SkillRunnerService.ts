import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { getAppDataSource } from '../datasources/PostgresDS.js';
import { GeminiService, IRunWithToolsEvent } from './GeminiService.js';
import { AICallTrackerService, AI_FEATURE_KEYS } from './AICallTrackerService.js';
import { SkillRegistryService, ISkillPack } from './SkillRegistryService.js';
import { SkillToolRegistry, ISkillToolContext } from './SkillToolRegistry.js';
import { PaidMediaPlanService } from './PaidMediaPlanService.js';
import { PlanStateService } from './PlanStateService.js';
import { PlanArtifactService, ICreateArtifactInput } from './PlanArtifactService.js';
import { PlanEventService } from './PlanEventService.js';
import { ProductAnalyticsService } from './ProductAnalyticsService.js';
import { NotificationHelperService } from './NotificationHelperService.js';
import { DRAPaidMediaPlanMessage } from '../models/DRAPaidMediaPlanMessage.js';
import { DRAPaidMediaPlanStep } from '../models/DRAPaidMediaPlanStep.js';
import { PlanArtifactKind } from '../types/IPaidMediaPlan.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const REPO_ROOT = join(__dirname, '..', '..', '..');
const { resolveSkillsRoot } = await import('./SkillRegistryService.js');
const SKILLS_BASE = resolveSkillsRoot();
const GUARDRAILS_FILE = join(SKILLS_BASE, '_shared', 'guardrails.md');
const TOOLS_FILE = join(SKILLS_BASE, '_shared', 'tools.md');

export interface IRunStepOptions {
    trigger: 'user' | 'auto';
    userId: number;
}

export interface IRunStepResult {
    stepKey: string;
    status: 'completed' | 'waiting_for_input' | 'failed' | 'skipped';
    pausedAtGate: boolean;
    nextStepKey: string | null;
    error?: string;
}

export class GatePauseError extends Error {}

export class SkillRunnerService {
    private static instance: SkillRunnerService;

    private constructor() {}

    public static getInstance(): SkillRunnerService {
        if (!SkillRunnerService.instance) {
            SkillRunnerService.instance = new SkillRunnerService();
        }
        return SkillRunnerService.instance;
    }

    public static resetInstance(): void {
        SkillRunnerService.instance = null as any;
    }

    private readSharedFile(file: string): string {
        try {
            return readFileSync(file, 'utf-8');
        } catch {
            return '';
        }
    }

    private skillRegistry(): SkillRegistryService {
        return SkillRegistryService.getInstance();
    }

    // ===== Public entry points =====

    /**
     * Executes exactly one step. Continuation of the chain (next pending step,
     * retries, completion) is the job of the PlanExecutionEngine, which
     * re-enqueues the plan after every step. This keeps the 17-step run durable:
     * each step re-reads fresh DB state, so the loop survives page navigation and
     * backend restarts.
     */
    public async run(planId: number, stepKey: string, options: IRunStepOptions): Promise<IRunStepResult> {
        const service = PaidMediaPlanService.getInstance();
        const step = await service.getStep(planId, stepKey);
        if (step.status === 'running') {
            return { stepKey, status: 'failed', pausedAtGate: false, nextStepKey: null, error: 'Step is already running' };
        }
        return this.executeStep(planId, stepKey, options.trigger, planId);
    }

    public async autoApproveGate(planId: number, stepKey: string): Promise<IRunStepResult> {
        const service = PaidMediaPlanService.getInstance();
        const step = await service.getStep(planId, stepKey);

        if (step.status !== 'waiting_for_input') {
            throw new Error(`Step ${stepKey} is not waiting for input`);
        }

        const plan = await service.get(planId);
        const note = 'Auto-approved — basic mode runs without questions.';
        await service.addMessage(planId, step.id, 'user', note, { gateId: step.gate?.id ?? null });

        const answeredGate = step.gate
            ? { ...step.gate, answered: true, answer: 'auto-approved (basic mode)', answeredAt: new Date().toISOString() }
            : null;

        await PlanEventService.getInstance().record({
            planId,
            stepId: step.id,
            eventType: 'plan_gate_answered',
            message: 'Gate auto-approved (basic mode)',
            data: { gateId: step.gate?.id ?? null },
            socketEvent: 'plan:updated',
            socketData: { planId, stepKey, status: 'running' },
        });

        await service.updateStep(planId, stepKey, {
            status: 'running',
            startedAt: new Date(),
            gate: answeredGate,
        });

        return this.executeStep(planId, stepKey, 'user', planId);
    }

    public async resume(planId: number, stepKey: string, answer: string): Promise<IRunStepResult> {
        const service = PaidMediaPlanService.getInstance();
        const step = await service.getStep(planId, stepKey);

        if (step.status !== 'waiting_for_input') {
            throw new Error(`Step ${stepKey} is not waiting for input`);
        }

        const plan = await service.get(planId);
        await service.addMessage(planId, step.id, 'user', answer, { gateId: step.gate?.id ?? null });
        // Gate answers are client-supplied facts: make them visible to every
        // current and future step via plan state.
        await service.addUserNote(planId, answer, 'gate_answer');

        const answeredGate = step.gate
            ? { ...step.gate, answered: true, answer, answeredAt: new Date().toISOString() }
            : null;

        await PlanEventService.getInstance().record({
            planId,
            stepId: step.id,
            eventType: 'plan_gate_answered',
            message: `Gate answered: ${answer}`,
            data: { gateId: step.gate?.id ?? null },
            socketEvent: 'plan:updated',
            socketData: { planId, stepKey, status: 'running' },
        });

        await service.updateStep(planId, stepKey, {
            status: 'running',
            startedAt: new Date(),
            gate: answeredGate,
        });

        const result = await this.executeStep(planId, stepKey, 'user', planId);
        await ProductAnalyticsService.getInstance().record({
            eventName: 'plan_gate_answered',
            userId: plan.createdBy,
            projectId: plan.projectId,
            organizationId: plan.organizationId,
            workspaceId: plan.workspaceId,
            planId,
        });

        return result;
    }

    public async skip(planId: number, stepKey: string, reason?: string): Promise<IRunStepResult> {
        const service = PaidMediaPlanService.getInstance();
        const step = await service.getStep(planId, stepKey);
        await service.updateStep(planId, stepKey, {
            status: 'skipped',
            completedAt: new Date(),
            outputSummary: reason?.slice(0, 200) ?? 'Skipped by user',
        });
        await PlanEventService.getInstance().record({
            planId,
            stepId: step.id,
            eventType: 'plan_step_skipped',
            message: `Step ${stepKey} skipped${reason ? `: ${reason}` : ''}`,
            socketEvent: 'plan:updated',
            socketData: { planId, stepKey, status: 'skipped' },
        });
        return { stepKey, status: 'skipped', pausedAtGate: false, nextStepKey: null };
    }

    // ===== Single step execution =====

    private async executeStep(planId: number, stepKey: string, trigger: 'user' | 'auto', initiatedByPlanId: number): Promise<IRunStepResult> {
        const service = PaidMediaPlanService.getInstance();
        const registry = this.skillRegistry();
        const step = await service.getStep(planId, stepKey);
        const plan = await service.get(planId);

        const skill = registry.get(stepKey);
        await this.assertPrerequisites(planId, skill);

        const startedAt = new Date();
        await service.updateStep(planId, stepKey, {
            status: 'running',
            startedAt,
            error: null,
            attempts: step.attempts + 1,
            gate: null,
        });
        await PlanEventService.getInstance().record({
            planId,
            stepId: step.id,
            eventType: 'plan_step_started',
            message: `Step ${stepKey} started`,
            data: { trigger },
            socketEvent: 'plan:step:started',
            socketData: { planId, stepKey, title: step.title, stepNumber: step.step_number },
        });

        try {
            const result = await this.executeStepConversation(planId, stepKey, trigger);

            if (result.gate) {
                // An information gate (ask_user for facts the plan cannot
                // determine) must pause the step so the user's chat answer
                // resumes this same conversation. Only the step's own
                // confirmation gate requires the deliverable to exist first, so
                // the user never confirms a step that later fails validation.
                const isConfirmationGate = result.gate.purpose === 'confirm';
                if (isConfirmationGate) {
                    await this.validateOutputs(planId, skill, result.text);
                }
                await service.updatePlanCurrentStep(planId, stepKey, step.step_number);
                return {
                    stepKey,
                    status: 'waiting_for_input',
                    pausedAtGate: true,
                    nextStepKey: null,
                };
            }

            const artifacts = await this.validateOutputs(planId, skill, result.text);
            const completedAt = new Date();
            const durationMs = completedAt.getTime() - startedAt.getTime();

            const outputSummary = artifacts.length > 0
                ? artifacts.map((a) => a.artifactKey).join(', ')
                : result.text.slice(0, 120);

            await service.updateStep(planId, stepKey, {
                status: 'completed',
                completedAt,
                durationMs: durationMs,
                outputSummary: outputSummary,
                runMeta: {
                    model: skill.model?.name,
                    toolCalls: result.toolCalls,
                    tokensIn: undefined,
                    tokensOut: undefined,
                    costEstimate: undefined,
                    startedAt: startedAt.toISOString(),
                    completedAt: completedAt.toISOString(),
                },
            });
            await service.updatePlanCurrentStep(planId, stepKey, step.step_number);

            for (const artifact of artifacts) {
                await PlanEventService.getInstance().record({
                    planId,
                    stepId: step.id,
                    eventType: 'plan_artifact_generated',
                    message: `Artifact generated: ${artifact.artifactKey}`,
                    data: { artifactId: artifact.id, artifactKey: artifact.artifactKey, version: artifact.version },
                    socketEvent: 'plan:artifact',
                    socketData: { planId, stepKey, artifact },
                });
            }

            await PlanEventService.getInstance().record({
                planId,
                stepId: step.id,
                eventType: 'plan_step_completed',
                message: `Step ${stepKey} completed`,
                data: { durationMs, toolCalls: result.toolCalls, artifacts: artifacts.map((a) => a.artifactKey) },
                socketEvent: 'plan:step:completed',
                socketData: { planId, stepKey, status: 'completed', durationMs },
            });

            await this.maybeCompletePlan(planId);

            await ProductAnalyticsService.getInstance().record({
                eventName: 'plan_step_completed',
                userId: plan.createdBy,
                projectId: plan.projectId,
                organizationId: plan.organizationId,
                workspaceId: plan.workspaceId,
                planId,
                properties: { stepKey, durationMs, toolCalls: result.toolCalls, artifacts: artifacts.map((a) => a.artifactKey) },
            });

            return { stepKey, status: 'completed', pausedAtGate: false, nextStepKey: null };
        } catch (error: any) {
            const completedAt = new Date();
            const durationMs = completedAt.getTime() - startedAt.getTime();
            await service.updateStep(planId, stepKey, {
                status: 'failed',
                completedAt,
                durationMs: durationMs,
                error: error.message ?? String(error),
            });
            await PlanEventService.getInstance().record({
                planId,
                stepId: step.id,
                eventType: 'plan_step_failed',
                severity: 'error',
                message: `Step ${stepKey} failed: ${error.message ?? 'unknown error'}`,
                data: { durationMs },
                socketEvent: 'plan:step:failed',
                socketData: { planId, stepKey, status: 'failed', error: error.message ?? String(error) },
            });
            await NotificationHelperService.getInstance().notifyPlanStepFailed(
                plan.createdBy,
                plan.projectId,
                planId,
                stepKey,
                error.message ?? String(error)
            );
            return { stepKey, status: 'failed', pausedAtGate: false, nextStepKey: null, error: error.message ?? String(error) };
        }
    }

    private async assertPrerequisites(planId: number, skill: ISkillPack): Promise<void> {
        const service = PaidMediaPlanService.getInstance();
        for (const requiredStepKey of skill.requires) {
            const step = await service.getStep(planId, requiredStepKey).catch(() => null);
            if (!step || step.status !== 'completed') {
                throw new Error(`Prerequisite step ${requiredStepKey} must be completed before ${skill.stepKey}`);
            }
        }
    }

    // ===== Conversation loop =====

    private async executeStepConversation(planId: number, stepKey: string, trigger: 'user' | 'auto'): Promise<{ text: string; toolCalls: number; gate: Record<string, any> | null }> {
        const service = PaidMediaPlanService.getInstance();
        const registry = SkillRegistryService.getInstance();
        const step = await service.getStep(planId, stepKey);
        const plan = await service.get(planId);
        const skill = registry.get(stepKey);

        const isBasic = plan.mode === 'basic';
        const systemInstruction = await this.buildSystemPrompt(skill, plan.state, plan, Boolean(step.gate?.answered), isBasic);
        const contents = await this.buildConversationContents(planId, stepKey);

        if (contents.length === 0) {
            const userPrompt = this.buildUserPrompt(skill, plan);
            await service.addMessage(planId, step.id, 'user', userPrompt, { trigger });
            contents.push({ role: 'user', parts: [{ text: userPrompt }] });
        }

        // Everything already in `contents` came from persisted messages; only
        // turns produced by this run should be persisted again. Re-persisting
        // the whole history duplicates it on every retry (exponentially).
        const turnStartIndex = contents.length;

        const tools = SkillToolRegistry.getInstance()
            .getToolDefinitions(skill)
            .filter((tool) => !(isBasic && tool.name === 'ask_user'));

        let assistantBuffer = '';
        let turnHasToolCall = false;
        let toolCallCount = 0;
        const creatorId = plan.createdBy;
        const streamingMessageId = `plan-${stepKey}-${Date.now()}`;
        let streamingStarted = false;
        const eventService = PlanEventService.getInstance();

        const toolContext: ISkillToolContext = {
            planId,
            stepId: step.id,
            stepKey,
            projectId: plan.projectId,
            organizationId: plan.organizationId,
            workspaceId: plan.workspaceId,
            userId: plan.createdBy,
            askUser: async (args) => {
                const gateId = `${stepKey}-${Date.now()}`;
                const purpose: 'info' | 'confirm' = args.purpose === 'confirm' ? 'confirm' : 'info';
                const gate = {
                    id: gateId,
                    stepKey,
                    question: args.question,
                    options: args.options ?? null,
                    purpose,
                    answered: false,
                    answer: null,
                };
                await service.updateStep(planId, stepKey, { status: 'waiting_for_input', gate });
                await PlanEventService.getInstance().record({
                    planId,
                    stepId: step.id,
                    eventType: 'plan_gate_raised',
                    message: `Gate raised: ${args.question}`,
                    data: { gateId },
                    socketEvent: 'plan:step:gate',
                    socketData: { planId, stepKey, gate },
                });
                await NotificationHelperService.getInstance().notifyPlanGateRaised(
                    plan.createdBy,
                    plan.projectId,
                    planId,
                    stepKey,
                    args.question
                );
                return { __plan_gate: true, gateId, question: args.question, options: args.options ?? [], purpose, stepKey };
            },
        };

        const executeTool = async (name: string, args: any): Promise<any> => {
            toolCallCount += 1;
            await PlanEventService.getInstance().record({
                planId,
                stepId: step.id,
                eventType: 'tool_call',
                message: `Tool: ${name}`,
                data: { toolName: name, toolArgs: args },
                socketEvent: 'plan:step:progress',
                socketData: { planId, stepKey, toolName: name, toolArgs: args },
            });
            return SkillToolRegistry.getInstance().execute(name, args, toolContext);
        };

        const onEvent = async (event: IRunWithToolsEvent): Promise<void> => {
            if (event.type === 'text_delta') {
                assistantBuffer += event.text ?? '';
                streamingStarted = true;
                await eventService.emitToUser(creatorId, 'plan:message', {
                    planId,
                    stepKey,
                    messageId: streamingMessageId,
                    delta: event.text,
                    done: false,
                });
            }
            if (event.type === 'tool_call') {
                turnHasToolCall = true;
            }
        };

        const geminiService = new GeminiService();
        const result = await geminiService.runWithTools({
            systemInstruction,
            contents,
            tools,
            executeTool,
            onEvent,
            maxToolCalls: skill.maxToolCalls ?? 40,
            maxOutputTokens: skill.model?.maxOutputTokens ?? 32768,
            model: skill.model?.name,
            temperature: skill.model?.temperature,
        }, {
            featureKey: AI_FEATURE_KEYS.PLAN_BUILD,
            actionId: String(planId),
            userId: plan.createdBy ?? null,
            orgId: plan.organizationId ?? null,
            projectId: plan.projectId ?? null,
        });

        if (streamingStarted) {
            await eventService.emitToUser(creatorId, 'plan:message', {
                planId,
                stepKey,
                messageId: streamingMessageId,
                text: assistantBuffer,
                done: true,
            });
        }

        await this.persistTurn(planId, step.id, assistantBuffer, turnHasToolCall, result.contents, toolCallCount, turnStartIndex);

        return { text: result.text, toolCalls: result.toolCalls, gate: result.gate ?? null };
    }

    private async persistTurn(
        planId: number,
        stepId: number | null,
        assistantText: string,
        turnHasToolCall: boolean,
        finalContents: any[],
        toolCallCount: number,
        turnStartIndex: number
    ): Promise<void> {
        const service = PaidMediaPlanService.getInstance();

        const newContents = finalContents.slice(turnStartIndex);
        const modelTurns = newContents.filter((content) => content.role === 'model');
        const toolResponses = newContents.filter((content) =>
            content.parts?.some((part: any) => part.functionResponse)
        );

        for (const modelTurn of modelTurns) {
            const functionCallParts = modelTurn.parts.filter((part: any) => part.functionCall);
            if (functionCallParts.length > 0) {
                const call = functionCallParts[0].functionCall;
                await service.addMessage(planId, stepId, 'assistant', '', {
                    tool_call: true,
                    tool_name: call.name,
                    tool_args: call.args,
                });
            } else {
                const text = modelTurn.parts.map((part: any) => part.text ?? '').join('');
                if (text.trim()) {
                    await service.addMessage(planId, stepId, 'assistant', text);
                }
            }
        }

        for (const toolResponse of toolResponses) {
            for (const part of toolResponse.parts.filter((p: any) => p.functionResponse)) {
                const fr = part.functionResponse;
                await service.addMessage(planId, stepId, 'tool', typeof fr.response === 'string' ? fr.response : JSON.stringify(fr.response ?? {}), {
                    tool_name: fr.name,
                });
            }
        }

        if (assistantText.trim() && modelTurns.filter((t) => !t.parts?.some((p: any) => p.functionCall)).length === 0) {
            await service.addMessage(planId, stepId, 'assistant', assistantText);
        }
    }

    private async buildConversationContents(planId: number, stepKey: string): Promise<any[]> {
        const dataSource = await getAppDataSource();
        const step = await PaidMediaPlanService.getInstance().getStep(planId, stepKey);
        const rows = await dataSource.getRepository(DRAPaidMediaPlanMessage).find({
            where: { plan_id: planId, step_id: step.id },
            order: { id: 'ASC' },
        });
        const contents: any[] = [];
        for (const row of rows) {
            const metadata = row.metadata ?? {};
            if (row.role === 'user') {
                contents.push({ role: 'user', parts: [{ text: row.content }] });
            } else if (row.role === 'assistant') {
                if (metadata.tool_call) {
                    contents.push({ role: 'model', parts: [{ functionCall: { name: metadata.tool_name, args: metadata.tool_args ?? {} } }] });
                } else if (row.content.trim()) {
                    contents.push({ role: 'model', parts: [{ text: row.content }] });
                }
            } else if (row.role === 'tool') {
                let response: any = {};
                try {
                    response = JSON.parse(row.content);
                } catch {
                    response = { text: row.content };
                }
                contents.push({ role: 'user', parts: [{ functionResponse: { name: metadata.tool_name ?? 'unknown', response } }] });
            }
        }
        return contents;
    }

    private async buildSystemPrompt(skill: ISkillPack, state: Record<string, any>, plan: Record<string, any>, gateAnswered = false, isBasic = false): Promise<string> {
        const guardrails = this.readSharedFile(GUARDRAILS_FILE);
        const toolsDoc = this.readSharedFile(TOOLS_FILE);
        const stateService = PlanStateService.getInstance();
        const stateMarkdown = stateService.stateToMarkdown('Plan', state as any, true);

        // Basic mode never asks the user anything: no confirmation gates, no
        // ask_user questions. The AI researches everything and uses defaults
        // (labelled ESTIMATE) for facts it cannot verify.
        const gateInstruction = !isBasic && skill.gate && !gateAnswered
            ? `\n\nAfter producing the deliverable for this step, call the ask_user tool with purpose "confirm" and this confirmation gate:\n"${skill.gate.question}"\nThe user must confirm before the step is complete.`
            : '';
        const resumeInstruction = gateAnswered
            ? '\n\nThe user has answered your question. Continue this step now and produce the required deliverable. Do not ask the same question again.'
            : '';

        const askPolicy = isBasic
            ? 'Do not ask the user any questions. Research every fact from the website and the prior deliverables above; where a fact cannot be verified, set a sensible default and label it ESTIMATE or NOT VERIFIED in state. Never call ask_user.'
            : 'If you need information from the client, first check the plan state and the prior deliverables listed above and read the exact artifact key you need with read_artifact. Never ask the user for data that already exists in a prior deliverable or in the "Client-supplied information" section above. If the data is genuinely missing, call the ask_user tool once with purpose "info" and a single concise question, then STOP — never bundle multiple questions, never write questions into your response text, and never repeat the same question. Never ask for secrets, credentials, API keys, access tokens, passwords, tracking/pixel IDs (GA4 Measurement ID, GTM Container ID, Meta Pixel ID), or other private identifiers: ask only whether a setup exists and use placeholders such as <GA4_MEASUREMENT_ID>, <GTM_CONTAINER_ID>, and <META_PIXEL_ID> in the deliverable.';

        const needsBenchmarks = skill.tools.includes('read_benchmarks') ||
            ['pm-media-plan', 'pm-keyword-research', 'pm-results-review'].includes(skill.stepKey);
        const benchmarkSection = needsBenchmarks ? await this.buildBenchmarkContext(plan) : '';
        const deliverablesSection = await this.buildDeliverablesContext(plan.id);

        return [
            skill.content,
            '---',
            toolsDoc,
            '---',
            guardrails,
            '---',
            '## Current plan state (read-only summary; use read_state for the authoritative state)',
            stateMarkdown,
            deliverablesSection,
            benchmarkSection,
            gateInstruction,
            resumeInstruction,
            '---',
            'You are executing this step inside the DRA Paid Media Loop. Follow the skill definition exactly. Merge structured facts with write_state. Never fabricate research: label every volume, benchmark, and competitor claim VERIFIED, ESTIMATE, or NOT VERIFIED with its source.',
            '---',
            'The step FAILS if any required deliverable is missing. Before finishing, you MUST call write_artifact once per deliverable listed for this step using its exact artifact key and full content — never finish without every deliverable written.',
            '---',
            askPolicy,
        ].join('\n');
    }

    private async buildDeliverablesContext(planId: number): Promise<string> {
        try {
            const artifacts = await PlanArtifactService.getInstance().list(planId);
            const current = artifacts.filter((artifact) => artifact.isCurrent);
            if (current.length === 0) return '';
            const lines = current.map(
                (artifact) => `- ${artifact.artifactKey} — ${artifact.title} (${artifact.kind}, ${artifact.byteSize} bytes)`
            );
            return [
                '',
                '## Prior deliverables already built for this plan',
                'Use read_artifact with the exact key below. Do not guess keys and do not ask the user for data that already exists here.',
                ...lines,
                '',
            ].join('\n');
        } catch {
            return '';
        }
    }

    private async buildBenchmarkContext(plan: Record<string, any>): Promise<string> {
        try {
            const { PlanBenchmarkService } = await import('./PlanBenchmarkService.js');
            const benchmarks = await PlanBenchmarkService.getInstance().getForPlan(plan);
            if (benchmarks.length === 0) return '';
            const lines = benchmarks.map((b) => `- ${b.platform} / ${b.market} / ${b.metric}: ${b.value} (sample ${b.sampleSize}, confidence ${b.confidence})`);
            return [
                '',
                '## Learned benchmarks (from past plan outcomes)',
                'Use these to set bid caps, forecast volumes, and calibrate winner criteria instead of generic assumptions.',
                ...lines,
                '',
            ].join('\n');
        } catch {
            return '';
        }
    }

    private buildUserPrompt(skill: ISkillPack, plan: Record<string, any>): string {
        const artifactList = skill.artifacts.map((a) => `${a.key} (${a.kind})`).join(', ') || 'no deliverable (state only)';
        return `Run step ${skill.stepNumber} "${skill.title}".\n\nCompany/website: ${(plan as any).name}\nMarkets: ${(plan as any).markets?.join(', ') || 'not set'}\nPlatforms: ${(plan as any).platforms?.join(', ') || 'not set'}\nBudget: ${(plan as any).budgetTotal ?? 'not set'} ${(plan as any).currency ?? 'USD'}\nMode: ${(plan as any).mode}\nFunnel coverage: ${(plan as any).funnelCoverage}\nBuild mode: ${(plan as any).buildMode}\n\nDeliverable(s) for this step: ${artifactList}.\n\nProduce the deliverable now.`;
    }

    private async validateOutputs(planId: number, skill: ISkillPack, finalText: string): Promise<Array<{ id: number; artifactKey: string; version: number }>> {
        const service = PlanArtifactService.getInstance();
        const artifacts = await service.list(planId);
        const written = skill.artifacts
            .map((contract) => artifacts.find((a) => a.artifactKey === contract.key && a.isCurrent))
            .filter((artifact): artifact is NonNullable<typeof artifact> => Boolean(artifact));

        const requiredTextContracts = skill.artifacts.filter((contract) =>
            ['markdown', 'json', 'csv', 'html'].includes(contract.kind)
        );

        if (requiredTextContracts.length > 0) {
            const writtenKeys = written.map((a) => a.artifactKey);
            const missing = requiredTextContracts.filter((c) => !writtenKeys.includes(c.key));
            if (missing.length > 0) {
                // The model sometimes writes the complete deliverable as its
                // final text instead of calling write_artifact. Salvage that
                // text for a single text deliverable rather than failing the
                // step and losing the work.
                const contract = missing.length === 1 ? missing[0] : null;
                const salvageable = contract && finalText.trim().length >= 200;
                if (!salvageable || !contract) {
                    throw new Error(`Step ${skill.stepKey} is missing deliverable artifact(s): ${missing.map((c) => c.key).join(', ')}`);
                }
                const step = await PaidMediaPlanService.getInstance().getStep(planId, skill.stepKey);
                const created = await service.create({
                    planId,
                    stepId: step.id,
                    artifactKey: contract.key,
                    title: contract.title ?? contract.key,
                    kind: contract.kind as PlanArtifactKind,
                    content: this.stripCodeFence(finalText),
                    metadata: { salvagedFromText: true },
                });
                written.push(created);
            }
        }

        const contract = skill.outputContract;
        if (contract.type === 'markdown' && written.length > 0) {
            const content = written[0].content ?? '';
            if (content.trim().length < 40) {
                throw new Error(`Step ${skill.stepKey} deliverable is too short to be valid`);
            }
        }
        return written.map((a) => ({ id: a.id, artifactKey: a.artifactKey, version: a.version }));
    }

    private stripCodeFence(text: string): string {
        return text
            .trim()
            .replace(/^```(?:markdown|md|json|csv|html)?\s*\n?/i, '')
            .replace(/\n?```\s*$/i, '')
            .trim();
    }

    private async maybeCompletePlan(planId: number): Promise<void> {
        const service = PaidMediaPlanService.getInstance();
        const plan = await service.get(planId);
        const allDone = (plan.steps ?? []).every((step) => step.status === 'completed' || step.status === 'skipped');
        if (allDone && plan.status !== 'completed') {
            await service.setStatus(planId, 'completed');
            await PlanEventService.getInstance().record({
                planId,
                stepId: null,
                eventType: 'plan_completed',
                message: 'Plan completed',
                socketEvent: 'plan:updated',
                socketData: { planId, status: 'completed' },
            });
            await NotificationHelperService.getInstance().notifyPlanComplete(
                plan.createdBy,
                plan.projectId,
                planId,
                plan.artifactCount ?? 0
            );
            await ProductAnalyticsService.getInstance().record({
                eventName: 'plan_completed',
                userId: plan.createdBy,
                projectId: plan.projectId,
                organizationId: plan.organizationId,
                workspaceId: plan.workspaceId,
                planId,
            });
        }
    }
}
