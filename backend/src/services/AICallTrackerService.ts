import { getAppDataSource } from '../datasources/PostgresDS.js';
import { DRAAICallLog } from '../models/DRAAICallLog.js';

/**
 * AI usage instrumentation (see documentation/ai-usage-instrumentation-plan.md).
 *
 * Single choke point that records every Gemini call with its token counts and
 * computed USD cost, and exposes monthly rollups for fair-use ceilings and
 * monitoring. Writes are fire-and-forget: a DB failure must never block or
 * fail the AI call itself.
 */

/** Feature keys (fixed enum). Keep in sync with the plan doc §5.3. */
export const AI_FEATURE_KEYS = {
    PLAN_BUILD: 'plan_build',
    PLAN_CHAT: 'plan_chat',
    DATA_MODELER_CHAT: 'data_modeler_chat',
    ATTRIBUTION: 'attribution',
    AI_INSIGHTS_GENERATE: 'ai_insights_generate',
    AI_INSIGHTS_CHAT: 'ai_insights_chat',
    AI_INSIGHTS_REPORT_CHAT: 'ai_insights_report_chat',
    REPORT_WIDGET: 'report_widget',
    DASHBOARD_AUTO_GENERATE: 'dashboard_auto_generate',
    DASHBOARD_WIDGET_SPEC: 'dashboard_widget_spec',
    DATA_MODEL_CHAT: 'data_model_chat',
    AI_ANALYSIS: 'ai_analysis',
    JOIN_INFERENCE: 'join_inference',
    DATA_MODEL_ANALYSIS: 'data_model_analysis',
    ANOMALY_DETECTION: 'anomaly_detection',
    BUDGET_OPTIMIZATION: 'budget_optimization',
    SEARCH_GROUNDING: 'search_grounding',
} as const;

export type AIFeatureKey = typeof AI_FEATURE_KEYS[keyof typeof AI_FEATURE_KEYS];

/** Model rates in USD per 1M tokens (standard pricing, 2026-10-19). */
const MODEL_RATES: Record<string, { input: number; output: number; cachedInput: number }> = {
    'gemini-2.5-flash': { input: 0.30, output: 2.50, cachedInput: 0.03 },
    'gemini-2.5-flash-lite': { input: 0.10, output: 0.40, cachedInput: 0.01 },
    'gemini-2.5-pro': { input: 1.25, output: 10.00, cachedInput: 0.125 },
};

/** Fallback when the model id is unknown (treat as flash pricing). */
const DEFAULT_RATES = MODEL_RATES['gemini-2.5-flash'];

export interface IAICallLogInput {
    featureKey: AIFeatureKey;
    actionId?: string | null;
    userId?: number | null;
    orgId?: number | null;
    projectId?: number | null;
    modelId: string;
    inputTokens: number;
    cachedInputTokens: number;
    outputTokens: number;
    thoughtTokens?: number;
    status?: 'success' | 'failed' | 'fallback' | 'skipped_no_data';
    errorInfo?: string | null;
    latencyMs?: number;
    cacheEnabled?: boolean;
}

export interface IAIMonthlyFeatureRollup {
    feature_key: string;
    call_count: number;
    actions_count: number;
    cost_usd: number;
    active_users: number;
}

export class AICallTrackerService {
    private static instance: AICallTrackerService | null = null;

    public static getInstance(): AICallTrackerService {
        if (!AICallTrackerService.instance) {
            AICallTrackerService.instance = new AICallTrackerService();
        }
        return AICallTrackerService.instance;
    }

    public static resetInstance(): void {
        AICallTrackerService.instance = null as any;
    }

    /** Cost in USD for one call using the model's published rates. */
    public static computeCost(
        modelId: string,
        inputTokens: number,
        cachedInputTokens: number,
        outputTokens: number
    ): number {
        const rates = MODEL_RATES[modelId] ?? DEFAULT_RATES;
        return (
            (inputTokens * rates.input +
                cachedInputTokens * rates.cachedInput +
                outputTokens * rates.output) /
            1_000_000
        );
    }

    /**
     * Record one Gemini call. Fire-and-forget: swallows DB errors so the AI
     * path is never slowed or broken by instrumentation.
     */
    public async track(input: IAICallLogInput): Promise<void> {
        try {
            const dataSource = await getAppDataSource();
            if (!dataSource?.isInitialized) return;

            const inputTokens = Math.max(0, Math.round(input.inputTokens));
            const cachedInputTokens = Math.max(0, Math.round(input.cachedInputTokens));
            const outputTokens = Math.max(0, Math.round(input.outputTokens));
            const thoughtTokens = Math.max(0, Math.round(input.thoughtTokens ?? 0));

            const row = new DRAAICallLog();
            row.feature_key = input.featureKey;
            row.action_id = input.actionId ?? null;
            row.user_id = input.userId ?? null;
            row.org_id = input.orgId ?? null;
            row.project_id = input.projectId ?? null;
            row.model_id = input.modelId;
            row.input_tokens = inputTokens;
            row.cached_input_tokens = cachedInputTokens;
            row.output_tokens = outputTokens;
            row.thought_tokens = thoughtTokens;
            row.total_tokens = inputTokens + cachedInputTokens + outputTokens;
            row.status = input.status ?? 'success';
            row.error_info = input.errorInfo ?? null;
            row.latency_ms = Math.max(0, Math.round(input.latencyMs ?? 0));
            row.cost_usd = AICallTrackerService.computeCost(
                input.modelId,
                inputTokens,
                cachedInputTokens,
                outputTokens
            );
            row.cache_enabled = input.cacheEnabled ?? false;

            await dataSource.manager.save(DRAAICallLog, row);
        } catch (err) {
            console.warn('[AICallTracker] Failed to record AI call (non-fatal):', (err as Error)?.message);
        }
    }

    /** Monthly cost rollup per (org, feature). */
    public async getMonthlyOrgRollup(
        orgId: number,
        start: Date,
        end: Date
    ): Promise<IAIMonthlyFeatureRollup[]> {
        const dataSource = await getAppDataSource();
        const rows = await dataSource.manager
            .createQueryBuilder(DRAAICallLog, 'log')
            .select('log.feature_key', 'feature_key')
            .addSelect('COUNT(*)', 'call_count')
            .addSelect('COUNT(DISTINCT log.action_id)', 'actions_count')
            .addSelect('SUM(log.cost_usd)', 'cost_usd')
            .addSelect('COUNT(DISTINCT log.user_id)', 'active_users')
            .where('log.org_id = :orgId', { orgId })
            .andWhere('log.created_at >= :start', { start })
            .andWhere('log.created_at < :end', { end })
            .groupBy('log.feature_key')
            .orderBy('SUM(log.cost_usd)', 'DESC')
            .getRawMany();

        return rows.map((r) => ({
            feature_key: r.feature_key,
            call_count: parseInt(r.call_count, 10),
            actions_count: parseInt(r.actions_count, 10),
            cost_usd: Number(r.cost_usd ?? 0),
            active_users: parseInt(r.active_users, 10),
        }));
    }

    /** Monthly cost rollup per (user, feature). */
    public async getMonthlyUserRollup(
        userId: number,
        start: Date,
        end: Date
    ): Promise<IAIMonthlyFeatureRollup[]> {
        const dataSource = await getAppDataSource();
        const rows = await dataSource.manager
            .createQueryBuilder(DRAAICallLog, 'log')
            .select('log.feature_key', 'feature_key')
            .addSelect('COUNT(*)', 'call_count')
            .addSelect('COUNT(DISTINCT log.action_id)', 'actions_count')
            .addSelect('SUM(log.cost_usd)', 'cost_usd')
            .addSelect('COUNT(DISTINCT log.user_id)', 'active_users')
            .where('log.user_id = :userId', { userId })
            .andWhere('log.created_at >= :start', { start })
            .andWhere('log.created_at < :end', { end })
            .groupBy('log.feature_key')
            .orderBy('SUM(log.cost_usd)', 'DESC')
            .getRawMany();

        return rows.map((r) => ({
            feature_key: r.feature_key,
            call_count: parseInt(r.call_count, 10),
            actions_count: parseInt(r.actions_count, 10),
            cost_usd: Number(r.cost_usd ?? 0),
            active_users: parseInt(r.active_users, 10),
        }));
    }

    /** Total monthly AI cost for an org (dollar figure for fair-use ceilings). */
    public async getMonthlyOrgCost(orgId: number, start: Date, end: Date): Promise<number> {
        const dataSource = await getAppDataSource();
        const result = await dataSource.manager
            .createQueryBuilder(DRAAICallLog, 'log')
            .select('COALESCE(SUM(log.cost_usd), 0)', 'total')
            .where('log.org_id = :orgId', { orgId })
            .andWhere('log.created_at >= :start', { start })
            .andWhere('log.created_at < :end', { end })
            .getRawOne();
        return Number(result?.total ?? 0);
    }

    /** Per-action cost for one org+feature (e.g. which plan_id is expensive). */
    public async getActionCosts(
        orgId: number,
        featureKey: AIFeatureKey,
        start: Date,
        end: Date,
        limit = 20
    ): Promise<Array<{ action_id: string; call_count: number; cost_usd: number }>> {
        const dataSource = await getAppDataSource();
        const rows = await dataSource.manager
            .createQueryBuilder(DRAAICallLog, 'log')
            .select('log.action_id', 'action_id')
            .addSelect('COUNT(*)', 'call_count')
            .addSelect('SUM(log.cost_usd)', 'cost_usd')
            .where('log.org_id = :orgId', { orgId })
            .andWhere('log.feature_key = :featureKey', { featureKey })
            .andWhere('log.action_id IS NOT NULL')
            .andWhere('log.created_at >= :start', { start })
            .andWhere('log.created_at < :end', { end })
            .groupBy('log.action_id')
            .orderBy('SUM(log.cost_usd)', 'DESC')
            .limit(limit)
            .getRawMany();

        return rows.map((r) => ({
            action_id: r.action_id,
            call_count: parseInt(r.call_count, 10),
            cost_usd: Number(r.cost_usd ?? 0),
        }));
    }
}
