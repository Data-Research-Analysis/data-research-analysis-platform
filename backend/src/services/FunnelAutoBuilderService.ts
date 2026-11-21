import { DBDriver } from '../drivers/DBDriver.js';
import { EDataSourceType } from '../types/EDataSourceType.js';
import { FunnelDefinitionService, IFunnel, IFunnelStep, FunnelSource } from './FunnelDefinitionService.js';
import { IFunnelStage, IChannelFunnel } from './FunnelAnalysisService.js';

/**
 * Auto-generated funnel definitions.
 *
 * GA4 (Data API) is aggregate-only, so auto funnels are stage-metric funnels:
 * each stage sums a metric from a data plane (GA4 aggregate tables or ad
 * platform tables). They are regenerated after each sync and can be detached
 * by the user (manual edit sets is_auto = false).
 */
export interface IAutoFunnelAvailability {
    hasSessionAttribution: boolean;
    hasUserAcquisition: boolean;
    hasAds: boolean;
    /** True when the optional GA4 BigQuery layer has materialized sessions. */
    hasBigQuery?: boolean;
}

export interface IAutoFunnelDefinition {
    autoKey: string;
    name: string;
    source: FunnelSource;
    dateRangePreset: string;
    attributionModel: string | null;
    steps: IFunnelStep[];
}

export interface IStageFunnelResult {
    stages: IFunnelStage[];
    channelFunnels: IChannelFunnel[];
}

export class FunnelAutoBuilderService {
    private static instance: FunnelAutoBuilderService;

    static getInstance(): FunnelAutoBuilderService {
        if (!FunnelAutoBuilderService.instance) {
            FunnelAutoBuilderService.instance = new FunnelAutoBuilderService();
        }
        return FunnelAutoBuilderService.instance;
    }

    // -----------------------------------------------------------------------
    // Pure definition builder (testable)
    // -----------------------------------------------------------------------

    private static stageStep(
        name: string,
        order: number,
        source: FunnelSource,
        metric: string,
    ): IFunnelStep {
        return {
            name,
            order,
            match_type: 'all',
            conditions: [],
            type: 'stage',
            source,
            metric,
            aggregation: 'sum',
        };
    }

    /**
     * Build the auto-funnel definitions available for a project based on the
     * connected sources. Pure function — no DB access.
     */
    static buildAutoFunnelDefinitions(availability: IAutoFunnelAvailability): IAutoFunnelDefinition[] {
        const defs: IAutoFunnelDefinition[] = [];

        if (availability.hasSessionAttribution) {
            defs.push({
                autoKey: 'ga4_site_acquisition',
                name: 'Site Acquisition (GA4)',
                source: 'google_analytics',
                dateRangePreset: 'last_90_days',
                attributionModel: null,
                steps: [
                    FunnelAutoBuilderService.stageStep('Sessions', 1, 'google_analytics', 'sessions'),
                    FunnelAutoBuilderService.stageStep('Engaged Sessions', 2, 'google_analytics', 'engaged_sessions'),
                    FunnelAutoBuilderService.stageStep('Sessions with Key Events', 3, 'google_analytics', 'key_event_sessions'),
                ],
            });
        }

        if (availability.hasUserAcquisition) {
            defs.push({
                autoKey: 'ga4_first_touch',
                name: 'First-Touch Acquisition (GA4)',
                source: 'google_analytics',
                dateRangePreset: 'last_90_days',
                attributionModel: null,
                steps: [
                    FunnelAutoBuilderService.stageStep('New Users', 1, 'google_analytics', 'new_users'),
                    FunnelAutoBuilderService.stageStep('Sessions', 2, 'google_analytics', 'sessions'),
                    FunnelAutoBuilderService.stageStep('Sessions with Key Events', 3, 'google_analytics', 'key_event_sessions'),
                ],
            });
        }

        if (availability.hasSessionAttribution && availability.hasAds) {
            defs.push({
                autoKey: 'ga4_paid_to_site',
                name: 'Paid → Site (Ads + GA4)',
                source: 'blended',
                dateRangePreset: 'last_90_days',
                attributionModel: 'linear',
                steps: [
                    FunnelAutoBuilderService.stageStep('Impressions', 1, 'blended', 'impressions'),
                    FunnelAutoBuilderService.stageStep('Clicks', 2, 'blended', 'clicks'),
                    FunnelAutoBuilderService.stageStep('Sessions', 3, 'google_analytics', 'sessions'),
                    FunnelAutoBuilderService.stageStep('Engaged Sessions', 4, 'google_analytics', 'engaged_sessions'),
                    FunnelAutoBuilderService.stageStep('Sessions with Key Events', 5, 'google_analytics', 'key_event_sessions'),
                ],
            });
        }

        if (availability.hasBigQuery) {
            defs.push({
                autoKey: 'ga4_user_journey',
                name: 'User Journey (GA4)',
                source: 'google_analytics_bigquery',
                dateRangePreset: 'last_90_days',
                attributionModel: 'linear',
                steps: [
                    FunnelAutoBuilderService.stageStep('First Session', 1, 'google_analytics_bigquery', 'sessions_first'),
                    FunnelAutoBuilderService.stageStep('Return Session', 2, 'google_analytics_bigquery', 'sessions_return'),
                    FunnelAutoBuilderService.stageStep('Conversion Session', 3, 'google_analytics_bigquery', 'conversion_sessions'),
                ],
            });
        }

        return defs;
    }

    // -----------------------------------------------------------------------
    // Generation (DB)
    // -----------------------------------------------------------------------

    /**
     * Generate/regenerate auto funnels for a project. Idempotent: upserts by
     * (project_id, auto_key). Safe to call after every sync.
     */
    async generateForProject(projectId: number, userId?: number): Promise<IFunnel[]> {
        const manager = await this.getManager();

        const sources: Array<{ id: number; data_type: string }> = await manager.query(
            `SELECT id, data_type FROM "dra_data_sources"
             WHERE project_id = $1
               AND data_type IN ('google_analytics', 'google_ads', 'meta_ads', 'linkedin_ads')`,
            [projectId],
        );

        const hasAds = sources.some(s => ['google_ads', 'meta_ads', 'linkedin_ads'].includes(s.data_type));
        const gaSourceIds = sources.filter(s => s.data_type === 'google_analytics').map(s => s.id);

        let hasSessionAttribution = false;
        let hasUserAcquisition = false;
        let hasBigQuery = false;
        if (gaSourceIds.length > 0) {
            const tables: Array<{ logical_table_name: string }> = await manager.query(
                `SELECT DISTINCT logical_table_name FROM "dra_table_metadata"
                 WHERE data_source_id = ANY($1)
                   AND logical_table_name IN ('session_attribution', 'user_acquisition', 'sessions')`,
                [gaSourceIds],
            );
            hasSessionAttribution = tables.some(t => t.logical_table_name === 'session_attribution');
            hasUserAcquisition = tables.some(t => t.logical_table_name === 'user_acquisition');
            hasBigQuery = tables.some(t => t.logical_table_name === 'sessions');
        }

        const definitions = FunnelAutoBuilderService.buildAutoFunnelDefinitions({
            hasSessionAttribution,
            hasUserAcquisition,
            hasAds,
            hasBigQuery,
        });

        const service = FunnelDefinitionService.getInstance();
        const funnels: IFunnel[] = [];
        for (const def of definitions) {
            funnels.push(await service.upsertAuto(
                projectId,
                def.autoKey,
                def.name,
                def.steps,
                def.source,
                def.dateRangePreset,
                def.attributionModel,
                userId,
            ));
        }

        // Remove auto funnels that are no longer supported by the project's
        // connected sources (e.g. after a data source was deleted). Manual
        // funnels are untouched.
        await service.pruneAutoFunnels(projectId, definitions.map(d => d.autoKey));

        return funnels;
    }

    // -----------------------------------------------------------------------
    // Execution (stage-metric funnels)
    // -----------------------------------------------------------------------

    /**
     * Compute a stage-metric funnel by summing each stage's metric across the
     * project's GA4 and/or ad platform tables.
     */
    async computeStageFunnel(
        projectId: number,
        steps: IFunnelStep[],
        start: Date,
        end: Date,
    ): Promise<IStageFunnelResult> {
        const manager = await this.getManager();
        const startStr = start.toISOString().split('T')[0];
        const endStr = end.toISOString().split('T')[0];

        const totals: number[] = [];
        const channelTotals = new Map<string, number[]>();

        for (let i = 0; i < steps.length; i++) {
            const step = steps[i];
            if (step.type !== 'stage' || !step.metric) {
                totals.push(0);
                continue;
            }
            const { total, byChannel } = await this.sumStage(manager, projectId, step, startStr, endStr);
            totals.push(total);
            for (const [channel, value] of byChannel.entries()) {
                if (!channelTotals.has(channel)) {
                    channelTotals.set(channel, new Array(steps.length).fill(0));
                }
                channelTotals.get(channel)![i] += value;
            }
        }

        const stages = this.toStages(steps, totals);
        const channelFunnels: IChannelFunnel[] = Array.from(channelTotals.entries())
            .map(([channel, counts]) => {
                const channelStages = this.toStages(steps, counts);
                const first = channelStages[0]?.count ?? 0;
                const last = channelStages[channelStages.length - 1]?.count ?? 0;
                return {
                    channel,
                    stages: channelStages,
                    completionRate: first > 0 ? Math.round((last / first) * 1000) / 10 : 0,
                };
            })
            .sort((a, b) => (b.stages[0]?.count ?? 0) - (a.stages[0]?.count ?? 0));

        return { stages, channelFunnels };
    }

    private toStages(steps: IFunnelStep[], counts: number[]): IFunnelStage[] {
        return steps.map((s, i) => {
            // key_event_sessions is derived from a rate (sessions * rate), so
            // round it; integer metrics are unaffected.
            const count = Math.round(counts[i] ?? 0);
            const next = i < steps.length - 1 ? Math.round(counts[i + 1] ?? 0) : null;
            const conversion = next !== null && count > 0 ? (next / count) * 100 : null;
            const dropOff = next !== null && count > 0 ? ((count - next) / count) * 100 : null;

            return {
                id: s.name.toLowerCase().replace(/\s+/g, '_'),
                name: s.name,
                order: s.order,
                count,
                conversionRateToNext: conversion !== null ? Math.round(conversion * 10) / 10 : null,
                dropOffPercent: dropOff !== null ? Math.round(dropOff * 10) / 10 : null,
            };
        });
    }

    private async sumStage(
        manager: any,
        projectId: number,
        step: IFunnelStep,
        start: string,
        end: string,
    ): Promise<{ total: number; byChannel: Map<string, number> }> {
        const metric = (step.metric || '').toLowerCase();
        if (step.source === 'google_analytics_bigquery') {
            return this.sumBigQueryJourneyMetric(manager, projectId, metric, start, end);
        }
        if (metric === 'impressions' || metric === 'clicks') {
            return this.sumAdMetric(manager, projectId, metric, start, end);
        }
        return this.sumGaMetric(manager, projectId, metric, start, end);
    }

    /**
     * User-journey stages from the BigQuery sessions table (distinct users).
     */
    private async sumBigQueryJourneyMetric(
        manager: any,
        projectId: number,
        metric: string,
        start: string,
        end: string,
    ): Promise<{ total: number; byChannel: Map<string, number> }> {
        const byChannel = new Map<string, number>();
        let condition: string | null = null;
        if (metric === 'sessions_first') condition = 'session_order = 1';
        else if (metric === 'sessions_return') condition = 'session_order > 1';
        else if (metric === 'conversion_sessions') condition = 'is_conversion = true';
        if (!condition) return { total: 0, byChannel };

        const tables = await manager.query(
            `SELECT tm.schema_name, tm.physical_table_name
             FROM "dra_table_metadata" tm
             JOIN "dra_data_sources" ds ON ds.id = tm.data_source_id
             WHERE ds.project_id = $1
               AND ds.data_type = 'google_analytics'
               AND tm.logical_table_name = 'sessions'`,
            [projectId],
        );

        let total = 0;
        for (const t of tables) {
            const full = `"${t.schema_name}"."${t.physical_table_name}"`;
            try {
                const rows = await manager.query(
                    `SELECT COUNT(DISTINCT user_key) AS total
                     FROM ${full}
                     WHERE session_date BETWEEN $1 AND $2 AND ${condition}`,
                    [start, end],
                );
                total += Number(rows?.[0]?.total) || 0;

                const groups = await manager.query(
                    `SELECT COALESCE(NULLIF(campaign_name, '(not set)'), source || ' / ' || medium, '(not set)') AS channel,
                            COUNT(DISTINCT user_key) AS total
                     FROM ${full}
                     WHERE session_date BETWEEN $1 AND $2 AND ${condition}
                     GROUP BY channel`,
                    [start, end],
                );
                for (const g of groups || []) {
                    const key = g.channel || '(not set)';
                    byChannel.set(key, (byChannel.get(key) || 0) + (Number(g.total) || 0));
                }
            } catch {
                // Skip tables missing the expected columns
            }
        }

        return { total, byChannel };
    }

    private resolveGaMetric(metric: string): { logicalTable: string; column: string; channelColumn: string } | null {
        switch (metric) {
            case 'new_users':
                return { logicalTable: 'user_acquisition', column: 'new_users', channelColumn: 'first_user_default_channel_group' };
            case 'sessions':
                return { logicalTable: 'session_attribution', column: 'sessions', channelColumn: 'session_default_channel_group' };
            case 'engaged_sessions':
                return { logicalTable: 'session_attribution', column: 'engaged_sessions', channelColumn: 'session_default_channel_group' };
            case 'conversions':
                return { logicalTable: 'session_attribution', column: 'conversions', channelColumn: 'session_default_channel_group' };
            case 'key_event_sessions':
                // Sessions in which at least one key event fired. Derived from
                // the session key-event rate (see gaMetricExpression), not a
                // raw key-event count.
                return { logicalTable: 'session_attribution', column: 'sessions', channelColumn: 'session_default_channel_group' };
            case 'total_users':
                return { logicalTable: 'session_attribution', column: 'total_users', channelColumn: 'session_default_channel_group' };
            default:
                return null;
        }
    }

    private async sumGaMetric(
        manager: any,
        projectId: number,
        metric: string,
        start: string,
        end: string,
    ): Promise<{ total: number; byChannel: Map<string, number> }> {
        const map = this.resolveGaMetric(metric);
        const byChannel = new Map<string, number>();
        if (!map) return { total: 0, byChannel };

        const tables = await this.getTables(manager, projectId, [map.logicalTable], ['google_analytics']);
        let total = 0;

        for (const t of tables) {
            const full = `"${t.schema_name}"."${t.physical_table_name}"`;
            try {
                const columnExpr = await this.gaMetricExpression(
                    manager,
                    t.schema_name,
                    t.physical_table_name,
                    metric,
                    map.column,
                );
                const rows = await manager.query(
                    `SELECT COALESCE(SUM(${columnExpr}), 0) AS total
                     FROM ${full} WHERE date BETWEEN $1 AND $2`,
                    [start, end],
                );
                total += Number(rows?.[0]?.total) || 0;

                const groups = await manager.query(
                    `SELECT COALESCE("${map.channelColumn}", '(not set)') AS channel,
                            COALESCE(SUM(${columnExpr}), 0) AS total
                     FROM ${full} WHERE date BETWEEN $1 AND $2
                     GROUP BY channel`,
                    [start, end],
                );
                for (const g of groups || []) {
                    const key = g.channel || '(not set)';
                    byChannel.set(key, (byChannel.get(key) || 0) + (Number(g.total) || 0));
                }
            } catch {
                // Skip legacy tables missing the column
            }
        }

        return { total, byChannel };
    }

    /**
     * SQL expression used inside SUM() for a GA metric.
     *
     * Most metrics are plain column sums. `key_event_sessions` is derived from
     * the GA4 session key-event rate: sessions * rate gives the number of
     * sessions in which a key event fired (GA4's `sessionKeyEventRate`). For
     * rows synced before that column existed we fall back to an upper-bound
     * estimate, LEAST(conversions, sessions), which can never exceed sessions
     * and keeps the funnel monotonic.
     */
    private async gaMetricExpression(
        manager: any,
        schemaName: string,
        tableName: string,
        metric: string,
        column: string,
    ): Promise<string> {
        if (metric !== 'key_event_sessions') {
            return `"${column}"`;
        }
        const hasRate = await this.tableHasColumn(manager, schemaName, tableName, 'session_key_event_rate');
        if (hasRate) {
            return 'COALESCE(sessions * session_key_event_rate, LEAST(conversions, sessions))';
        }
        return 'LEAST(conversions, sessions)';
    }

    private async tableHasColumn(
        manager: any,
        schemaName: string,
        tableName: string,
        columnName: string,
    ): Promise<boolean> {
        const rows = await manager.query(
            `SELECT 1 FROM information_schema.columns
             WHERE table_schema = $1 AND table_name = $2 AND column_name = $3
             LIMIT 1`,
            [schemaName, tableName, columnName],
        );
        return Array.isArray(rows) && rows.length > 0;
    }

    private async sumAdMetric(
        manager: any,
        projectId: number,
        metric: string,
        start: string,
        end: string,
    ): Promise<{ total: number; byChannel: Map<string, number> }> {
        const column = metric === 'impressions' ? 'impressions' : 'clicks';
        const byChannel = new Map<string, number>();
        const tables = await this.getTables(
            manager,
            projectId,
            ['insights', 'campaign_analytics'],
            ['google_ads', 'meta_ads', 'linkedin_ads'],
        );

        let total = 0;
        for (const t of tables) {
            const full = `"${t.schema_name}"."${t.physical_table_name}"`;
            try {
                const rows = await manager.query(
                    `SELECT COALESCE(SUM("${column}"), 0) AS total
                     FROM ${full} WHERE date_start BETWEEN $1 AND $2`,
                    [start, end],
                );
                const value = Number(rows?.[0]?.total) || 0;
                total += value;
                const label = this.platformLabel(t.data_type);
                byChannel.set(label, (byChannel.get(label) || 0) + value);
            } catch {
                // Skip tables without the column
            }
        }

        return { total, byChannel };
    }

    private async getTables(
        manager: any,
        projectId: number,
        logicalNames: string[],
        dataTypes: string[],
    ): Promise<Array<{ schema_name: string; physical_table_name: string; data_type: string; logical_table_name: string }>> {
        return manager.query(
            `SELECT tm.schema_name, tm.physical_table_name, tm.logical_table_name, ds.data_type
             FROM "dra_table_metadata" tm
             JOIN "dra_data_sources" ds ON ds.id = tm.data_source_id
             WHERE ds.project_id = $1
               AND tm.logical_table_name = ANY($2)
               AND ds.data_type = ANY($3)`,
            [projectId, logicalNames, dataTypes],
        );
    }

    private platformLabel(dataType: string): string {
        switch (dataType) {
            case 'google_ads': return 'Google Ads';
            case 'meta_ads': return 'Meta Ads';
            case 'linkedin_ads': return 'LinkedIn Ads';
            default: return dataType;
        }
    }

    private async getManager() {
        const driver = await DBDriver.getInstance().getDriver(EDataSourceType.POSTGRESQL);
        if (!driver) throw new Error('PostgreSQL driver not available');
        const concreteDriver = await driver.getConcreteDriver();
        if (!concreteDriver) throw new Error('Failed to get PostgreSQL connection');
        const manager = concreteDriver.manager;
        if (!manager) throw new Error('Database manager not available');
        return manager;
    }
}

export default FunnelAutoBuilderService;
