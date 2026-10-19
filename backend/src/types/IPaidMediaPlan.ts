import { MarketingRole } from '../middleware/requiresProjectRole.js';

export type PlanMode = 'basic' | 'advanced';
export type PlanStatus = 'draft' | 'running' | 'paused' | 'completed' | 'failed' | 'archived';
export type PlanFunnelCoverage = 'bofu' | 'bofu_mofu' | 'full_funnel';
export type PlanBuildMode = 'test_only' | 'build_to_scale';
export type PlanStepStatus = 'pending' | 'running' | 'waiting_for_input' | 'completed' | 'failed' | 'skipped';
export type PlanPhase = 'discover' | 'define' | 'build' | 'launch' | 'present';
export type PlanArtifactKind = 'markdown' | 'json' | 'csv' | 'xlsx' | 'pptx' | 'html' | 'image';
export type PlanArtifactSource = 'ai' | 'user_edited' | 'uploaded';
export type PlanMessageRole = 'user' | 'assistant' | 'system' | 'tool';
export type PlanEventSeverity = 'info' | 'warn' | 'error';
export type PlanAutonomy = 'manual' | 'assisted' | 'auto';
export type PlanOutcomeSource = 'platform_sync' | 'manual' | 'offline';
export type PlanBenchmarkMetric = 'cpc' | 'cpm' | 'ctr' | 'cvr' | 'cpl' | 'roas' | 'cpa';
export type PlanBenchmarkSource = 'learned' | 'external' | 'user';

export interface IPlanGate {
    id: string;
    stepKey: string;
    question: string;
    options?: Array<{ label: string; value: string; recommended?: boolean }>;
    purpose?: 'info' | 'confirm';
    context?: Record<string, any>;
    answered?: boolean;
    answer?: string | null;
    answeredAt?: string | null;
}

export interface IPlanRunMeta {
    model?: string;
    tokensIn?: number;
    tokensOut?: number;
    toolCalls?: number;
    costEstimate?: number;
    startedAt?: string;
    completedAt?: string;
}

export interface IPlanCoreFacts {
    company?: Record<string, any>;
    website?: string | null;
    product?: Record<string, any>;
    industry?: string | null;
    platforms?: string[];
    markets?: string[];
    budget?: Record<string, any>;
    dates?: Record<string, any>;
    cta?: string[];
    events?: Array<Record<string, any>>;
    landing_pages?: string[];
    competitors?: Array<Record<string, any>>;
    tracking?: Record<string, any>;
    guardrails?: Record<string, any>;
    notes?: string | null;
}

export interface IPlanStepOutput {
    artifact?: string;
    decisions?: any[];
    flags?: any[];
    open?: any[];
}

export interface IPlanState {
    core_facts?: IPlanCoreFacts;
    funnel_and_scale?: Record<string, any>;
    basic_mode_source?: Record<string, any>;
    step_outputs?: Record<string, IPlanStepOutput>;
    next_step_needs?: Record<string, any>;
    verification?: Record<string, 'VERIFIED' | 'ESTIMATE' | 'NOT VERIFIED'>;
    /** Single authoritative structured client brief, set from the Client Brief form. */
    client_brief?: string;
    /** Client-supplied information from chat, visible to every step. */
    user_notes?: Array<{ text: string; source: string; at: string }>;
}

export interface IPlanDetail {
    id: number;
    projectId: number;
    organizationId: number;
    workspaceId: number;
    createdBy: number;
    name: string;
    slug: string;
    mode: PlanMode;
    status: PlanStatus;
    funnelCoverage: PlanFunnelCoverage;
    buildMode: PlanBuildMode;
    platforms: string[];
    markets: string[];
    budgetTotal: number | null;
    currency: string;
    startDate: string | null;
    endDate: string | null;
    currentStep: number;
    state: IPlanState;
    settings: Record<string, any>;
    createdAt: string;
    updatedAt: string;
    steps?: IPlanStep[];
    stepCount?: number;
    completedStepCount?: number;
    artifactCount?: number;
    lastRunStepKey?: string | null;
}

export interface IPlanStep {
    id: number;
    planId: number;
    stepNumber: number;
    stepKey: string;
    title: string;
    phase: PlanPhase;
    status: PlanStepStatus;
    startedAt: string | null;
    completedAt: string | null;
    durationMs: number | null;
    attempts: number;
    error: string | null;
    outputSummary: string | null;
    gate: IPlanGate | null;
    runMeta: IPlanRunMeta | null;
    createdAt: string;
    updatedAt: string;
}

export interface IPlanMessage {
    id: number;
    planId: number;
    stepId: number | null;
    role: PlanMessageRole;
    content: string;
    metadata: Record<string, any> | null;
    createdAt: string;
}

export interface IPlanEvent {
    id: number;
    planId: number;
    stepId: number | null;
    eventType: string;
    severity: PlanEventSeverity;
    message: string;
    data: Record<string, any> | null;
    createdAt: string;
}

export interface IPlanArtifact {
    id: number;
    planId: number;
    stepId: number | null;
    artifactKey: string;
    title: string;
    kind: PlanArtifactKind;
    mimeType: string;
    content: string | null;
    storageKey: string | null;
    byteSize: number;
    version: number;
    isCurrent: boolean;
    source: PlanArtifactSource;
    metadata: Record<string, any> | null;
    createdAt: string;
    updatedAt: string;
}

export interface IPlanSummary {
    id: number;
    projectId: number;
    name: string;
    slug: string;
    mode: PlanMode;
    status: PlanStatus;
    funnelCoverage: PlanFunnelCoverage;
    buildMode: PlanBuildMode;
    platforms: string[];
    markets: string[];
    budgetTotal: number | null;
    currency: string;
    currentStep: number;
    completedStepCount: number;
    stepCount: number;
    artifactCount: number;
    updatedAt: string;
}

export interface IPlanOutcome {
    id: number;
    planId: number;
    campaignId: number | null;
    channelType: string;
    market: string | null;
    periodStart: string | null;
    periodEnd: string | null;
    spend: number;
    impressions: number;
    clicks: number;
    conversions: number;
    revenue: number;
    source: PlanOutcomeSource;
    raw: Record<string, any> | null;
    createdAt: string;
}

export interface IPlanBenchmark {
    id: number;
    industry: string;
    market: string;
    platform: string;
    metric: PlanBenchmarkMetric;
    value: number;
    sampleSize: number;
    source: PlanBenchmarkSource;
    confidence: number;
    updatedAt: string;
}

export interface IPlanCreateInput {
    projectId: number;
    name?: string;
    website?: string | null;
    mode?: PlanMode;
    funnelCoverage?: PlanFunnelCoverage;
    buildMode?: PlanBuildMode;
    platforms?: string[];
    markets?: string[];
    budgetTotal?: number | null;
    currency?: string;
    startDate?: string | null;
    endDate?: string | null;
    autonomy?: PlanAutonomy;
    industry?: string | null;
    product?: string | null;
    teamSize?: number | null;
    channels?: string[];
    competitors?: Array<{ name: string; website?: string | null }>;
    notes?: string | null;
}

export interface IPlanScopedCreateInput extends IPlanCreateInput {
    organizationId: number;
    workspaceId: number;
    createdBy: number;
}

export interface IPlanRunOptions {
    trigger?: 'user' | 'auto';
    fromStep?: string | null;
    userId: number;
    projectRole: MarketingRole;
}

export interface IPlanGateAnswer {
    gateId: string;
    answer: string;
}
