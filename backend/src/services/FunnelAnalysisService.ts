/**
 * Funnel Analysis Service
 *
 * Data-model-aware service that auto-detects funnel stages from table columns
 * and computes conversion funnels (impressions → clicks → leads →
 * opportunities → purchases) with drop-off rates, per-channel breakdowns,
 * and time-per-stage estimates.
 *
 * Used by the ATTR-003 funnel visualization endpoint.
 */

import { DBDriver } from '../drivers/DBDriver.js';
import { EDataSourceType } from '../types/EDataSourceType.js';
import { DRATableMetadata } from '../models/DRATableMetadata.js';
import { DRADataModelSource } from '../models/DRADataModelSource.js';
import { AppDataSource } from '../datasources/PostgresDS.js';
import {
    IFunnelAnalysisRequest,
    IFunnelAnalysisResponse,
    IJourneyMapRequest,
    IJourneyMapResponse,
} from '../interfaces/IAttribution.js';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface IFunnelStage {
    id: string;
    name: string;
    order: number;
    count: number;
    conversionRateToNext: number | null;
    dropOffPercent: number | null;
}

export interface IChannelFunnel {
    channel: string;
    stages: IFunnelStage[];
    completionRate: number;
}

export interface ITimePerStage {
    fromStage: string;
    toStage: string;
    averageDays: number;
}

export interface IFunnelResult {
    stages: IFunnelStage[];
    channelFunnels: IChannelFunnel[];
    timePerStage: ITimePerStage[];
}

export interface IFunnelRequest {
    data_model_id: number;
    date_range: { start: string; end: string };
    channel_filter?: string;
}

// ---------------------------------------------------------------------------
// Stage mapping defaults
// ---------------------------------------------------------------------------

interface IStageMapping {
    name: string;
    order: number;
    /** Column name patterns that indicate this stage */
    patterns: string[];
}

const DEFAULT_STAGE_MAPPINGS: IStageMapping[] = [
    { name: 'Awareness', order: 1, patterns: ['impressions', 'impression', 'views', 'views_count', 'impressions_count'] },
    { name: 'Interest', order: 2, patterns: ['clicks', 'click', 'click_count', 'clicks_count', 'visits', 'sessions'] },
    { name: 'Consideration', order: 3, patterns: ['leads', 'lead', 'lead_count', 'signups', 'signup', 'add_to_cart', 'engagement'] },
    { name: 'Intent', order: 4, patterns: ['opportunities', 'opportunity', 'qualified_leads', 'mql', 'checkout', 'intent'] },
    { name: 'Purchase', order: 5, patterns: ['purchases', 'purchase', 'conversions', 'conversion', 'conversion_count', 'orders', 'sales', 'won'] },
];

// ---------------------------------------------------------------------------
// Service
// ---------------------------------------------------------------------------

export class FunnelAnalysisService {
    private static instance: FunnelAnalysisService;

    static getInstance(): FunnelAnalysisService {
        if (!FunnelAnalysisService.instance) {
            FunnelAnalysisService.instance = new FunnelAnalysisService();
        }
        return FunnelAnalysisService.instance;
    }

    /**
     * Get the TypeORM manager for executing queries against the user's data source.
     */
    private async getManager() {
        const driver = await DBDriver.getInstance().getDriver(EDataSourceType.POSTGRESQL);
        if (!driver) throw new Error('PostgreSQL driver not available');
        const concreteDriver = await driver.getConcreteDriver();
        if (!concreteDriver) throw new Error('Failed to get PostgreSQL connection');
        const manager = concreteDriver.manager;
        if (!manager) throw new Error('Database manager not available');
        return manager;
    }

    /**
     * Get the TypeORM repository for table metadata.
     */
    private getTableMetadataRepo() {
        return AppDataSource.getRepository(DRATableMetadata);
    }

    /**
     * Get the TypeORM repository for data model sources.
     */
    private getDataModelSourceRepo() {
        return AppDataSource.getRepository(DRADataModelSource);
    }

    /**
     * Main entry — analyse funnel from a data model's underlying table.
     */
    async analyze(request: IFunnelRequest): Promise<IFunnelResult> {
        const { data_model_id, date_range, channel_filter } = request;

        // 1. Resolve table + columns
        const modelMeta = await this.getDataModelMeta(data_model_id);
        if (!modelMeta) {
            return this.emptyResult();
        }

        const { fullTableName, columns } = modelMeta;

        // 2. Map columns to funnel stages
        const stageMapping = this.mapColumnsToStages(columns);
        if (stageMapping.length === 0) {
            return this.emptyResult();
        }

        // 3. Detect channel column
        const channelCol = this.detectChannelColumn(columns);
        const dateCol = this.detectDateColumn(columns);

        // 4. Aggregate overall funnel counts
        const stages = await this.computeFunnelCounts(fullTableName, stageMapping, dateCol, date_range, channel_filter);

        // 5. Aggregate per-channel funnel counts
        let channelFunnels: IChannelFunnel[] = [];
        if (channelCol) {
            channelFunnels = await this.computeChannelFunnels(fullTableName, stageMapping, channelCol, dateCol, date_range);
        }

        // 6. Compute time-per-stage from date columns if available
        const timePerStage = await this.computeTimePerStage(fullTableName, stageMapping, dateCol, date_range, channel_filter);

        return { stages, channelFunnels, timePerStage };
    }

    // -------------------------------------------------------------------------
    // Private helpers
    // -------------------------------------------------------------------------

    /**
     * Resolve table name and column list from the data model metadata
     * using the same pattern as MarketingMetricsService.
     */
    private async getDataModelMeta(dataModelId: number): Promise<{ fullTableName: string; columns: string[] } | null> {
        try {
            const manager = await this.getManager();

            // Get data model sources to find data_source_ids
            const dmSourceRepo = this.getDataModelSourceRepo();
            const dmSources = await dmSourceRepo.find({
                where: { data_model_id: dataModelId },
            });

            if (!dmSources || dmSources.length === 0) {
                return null;
            }

            const dataSourceIds = dmSources.map(s => s.data_source_id);

            // Get table metadata for these data sources
            const tableRepo = this.getTableMetadataRepo();
            const tables = await tableRepo.find({
                where: dataSourceIds.map(id => ({ data_source_id: id })),
            });

            if (!tables || tables.length === 0) return null;

            // Use the first table
            const table = tables[0];
            const schema = table.schema_name || 'public';
            const physical = table.physical_table_name;
            const schemaPrefix = schema ? `"${schema}".` : '';
            const fullTableName = `${schemaPrefix}"${physical}"`;

            // Query information_schema.columns for column details
            const columns: Array<{ column_name: string }> = await manager.query(
                `SELECT column_name
                 FROM information_schema.columns
                 WHERE table_schema = $1 AND table_name = $2
                 ORDER BY ordinal_position ASC`,
                [schema, physical],
            );

            if (!columns || columns.length === 0) return null;

            return {
                fullTableName,
                columns: columns.map(c => c.column_name),
            };
        } catch (err) {
            console.error('[FunnelAnalysisService] Error resolving data model meta:', err);
            return null;
        }
    }

    /**
     * Map detected table columns to funnel stages.
     */
    mapColumnsToStages(columns: string[]): Array<{ stageName: string; stageOrder: number; columnName: string }> {
        const lowerCols = columns.map(c => c.toLowerCase());
        const mapped: Array<{ stageName: string; stageOrder: number; columnName: string }> = [];

        for (const def of DEFAULT_STAGE_MAPPINGS) {
            for (const pattern of def.patterns) {
                const idx = lowerCols.indexOf(pattern);
                if (idx !== -1) {
                    mapped.push({ stageName: def.name, stageOrder: def.order, columnName: columns[idx] });
                    break; // one column per stage
                }
            }
        }

        // Sort by order
        mapped.sort((a, b) => a.stageOrder - b.stageOrder);
        return mapped;
    }

    private detectChannelColumn(columns: string[]): string | null {
        const patterns = ['channel', 'source', 'medium', 'platform', 'network', 'ad_network', 'campaign_channel'];
        const lower = columns.map(c => c.toLowerCase());
        for (const p of patterns) {
            const idx = lower.indexOf(p);
            if (idx !== -1) return columns[idx];
        }
        // Partial match
        for (let i = 0; i < lower.length; i++) {
            for (const p of patterns) {
                if (lower[i].includes(p)) return columns[i];
            }
        }
        return null;
    }

    private detectDateColumn(columns: string[]): string | null {
        const patterns = ['date', 'created_at', 'timestamp', 'event_date', 'day', 'dt'];
        const lower = columns.map(c => c.toLowerCase());
        for (const p of patterns) {
            const idx = lower.indexOf(p);
            if (idx !== -1) return columns[idx];
        }
        for (let i = 0; i < lower.length; i++) {
            for (const p of patterns) {
                if (lower[i].includes(p)) return columns[i];
            }
        }
        return null;
    }

    /**
     * Compute funnel counts using SQL SUM aggregation via TypeORM manager.
     */
    private async computeFunnelCounts(
        tableName: string,
        stages: Array<{ stageName: string; stageOrder: number; columnName: string }>,
        dateCol: string | null,
        dateRange: { start: string; end: string },
        channelFilter?: string,
    ): Promise<IFunnelStage[]> {
        const manager = await this.getManager();

        const sums = stages.map(s => `COALESCE(SUM("${s.columnName}"), 0) AS "${s.stageName}"`);
        let sql = `SELECT ${sums.join(', ')} FROM ${tableName}`;
        const params: any[] = [];
        const wheres: string[] = [];

        if (dateCol) {
            params.push(dateRange.start, dateRange.end);
            wheres.push(`"${dateCol}" BETWEEN $${params.length - 1} AND $${params.length}`);
        }

        if (channelFilter) {
            // Try to apply channel filter if a channel column exists
            const channelCol = this.detectChannelColumn(stages.map(s => s.columnName));
            if (channelCol) {
                params.push(channelFilter);
                wheres.push(`"${channelCol}" = $${params.length}`);
            }
        }

        if (wheres.length) sql += ` WHERE ${wheres.join(' AND ')}`;

        const rows = await manager.query(sql, params);
        const row = rows[0] ?? {};

        const result: IFunnelStage[] = stages.map((s, i) => {
            const count = Number(row[s.stageName] ?? 0);
            const nextCount = i < stages.length - 1 ? Number(row[stages[i + 1].stageName] ?? 0) : null;
            const conversionRate = nextCount !== null && count > 0 ? (nextCount / count) * 100 : null;
            const dropOff = nextCount !== null && count > 0 ? ((count - nextCount) / count) * 100 : null;

            return {
                id: s.stageName.toLowerCase().replace(/\s+/g, '_'),
                name: s.stageName,
                order: s.stageOrder,
                count,
                conversionRateToNext: conversionRate !== null ? Math.round(conversionRate * 10) / 10 : null,
                dropOffPercent: dropOff !== null ? Math.round(dropOff * 10) / 10 : null,
            };
        });

        return result;
    }

    /**
     * Compute per-channel funnel breakdown.
     */
    private async computeChannelFunnels(
        tableName: string,
        stages: Array<{ stageName: string; stageOrder: number; columnName: string }>,
        channelCol: string,
        dateCol: string | null,
        dateRange: { start: string; end: string },
    ): Promise<IChannelFunnel[]> {
        const manager = await this.getManager();

        const sums = stages.map(s => `COALESCE(SUM("${s.columnName}"), 0) AS "${s.stageName}"`);
        let sql = `SELECT "${channelCol}" AS channel, ${sums.join(', ')} FROM ${tableName}`;
        const params: any[] = [];
        const wheres: string[] = [];

        if (dateCol) {
            params.push(dateRange.start, dateRange.end);
            wheres.push(`"${dateCol}" BETWEEN $${params.length - 1} AND $${params.length}`);
        }
        if (wheres.length) sql += ` WHERE ${wheres.join(' AND ')}`;
        sql += ` GROUP BY "${channelCol}"`;

        const rows = await manager.query(sql, params);

        return rows.map((row: any) => {
            const channelStages: IFunnelStage[] = stages.map((s, i) => {
                const count = Number(row[s.stageName] ?? 0);
                const nextCount = i < stages.length - 1 ? Number(row[stages[i + 1].stageName] ?? 0) : null;
                const conversionRate = nextCount !== null && count > 0 ? (nextCount / count) * 100 : null;
                const dropOff = nextCount !== null && count > 0 ? ((count - nextCount) / count) * 100 : null;

                return {
                    id: s.stageName.toLowerCase().replace(/\s+/g, '_'),
                    name: s.stageName,
                    order: s.stageOrder,
                    count,
                    conversionRateToNext: conversionRate !== null ? Math.round(conversionRate * 10) / 10 : null,
                    dropOffPercent: dropOff !== null ? Math.round(dropOff * 10) / 10 : null,
                };
            });

            const firstCount = channelStages[0]?.count ?? 0;
            const lastCount = channelStages[channelStages.length - 1]?.count ?? 0;
            const completionRate = firstCount > 0 ? Math.round((lastCount / firstCount) * 1000) / 10 : 0;

            return {
                channel: row.channel ?? 'Unknown',
                stages: channelStages,
                completionRate,
            };
        });
    }

    /**
     * Estimate average days between stages using date column groupings.
     * This is a best-effort heuristic when individual timestamp columns exist.
     */
    private async computeTimePerStage(
        tableName: string,
        stages: Array<{ stageName: string; stageOrder: number; columnName: string }>,
        dateCol: string | null,
        dateRange: { start: string; end: string },
        channelFilter?: string,
    ): Promise<ITimePerStage[]> {
        if (!dateCol || stages.length < 2) return [];

        try {
            const manager = await this.getManager();

            let sql = `SELECT "${dateCol}" AS dt`;
            for (const s of stages) {
                sql += `, "${s.columnName}" AS "${s.stageName}"`;
            }
            const params: any[] = [dateRange.start, dateRange.end];
            sql += ` FROM ${tableName} WHERE "${dateCol}" BETWEEN $1 AND $2 ORDER BY "${dateCol}" ASC`;

            const rows = await manager.query(sql, params);

            if (rows.length < 2) return [];

            // Compute weighted-average days between stages
            const result: ITimePerStage[] = [];
            for (let i = 0; i < stages.length - 1; i++) {
                const s1 = stages[i];
                const s2 = stages[i + 1];

                // Accumulate counts and date-weighted sums
                let totalFrom = 0;
                let totalTo = 0;
                let weightedFromDays = 0;
                let weightedToDays = 0;
                const startDate = new Date(rows[0].dt).getTime();

                for (const row of rows) {
                    const fromCount = Number(row[s1.stageName] ?? 0);
                    const toCount = Number(row[s2.stageName] ?? 0);
                    const dayOffset = (new Date(row.dt).getTime() - startDate) / (1000 * 60 * 60 * 24);

                    totalFrom += fromCount;
                    totalTo += toCount;
                    weightedFromDays += fromCount * dayOffset;
                    weightedToDays += toCount * dayOffset;
                }

                const avgFromDays = totalFrom > 0 ? weightedFromDays / totalFrom : 0;
                const avgToDays = totalTo > 0 ? weightedToDays / totalTo : 0;
                const diffDays = Math.max(0, Math.round(Math.abs(avgToDays - avgFromDays) * 10) / 10);

                result.push({
                    fromStage: s1.stageName,
                    toStage: s2.stageName,
                    averageDays: diffDays,
                });
            }

            return result;
        } catch {
            return [];
        }
    }

    private emptyResult(): IFunnelResult {
        return { stages: [], channelFunnels: [], timePerStage: [] };
    }

    // -------------------------------------------------------------------------
    // AttributionProcessor interface methods
    // -------------------------------------------------------------------------

    /**
     * Analyze conversion funnel — compatibility method for AttributionProcessor.
     * Delegates to the data-model-aware analyze() when possible, otherwise
     * returns a stub result.
     */
    async analyzeFunnel(request: IFunnelAnalysisRequest): Promise<IFunnelAnalysisResponse> {
        try {
            // Attempt to derive a data_model_id from the project context.
            // The legacy interface uses projectId + funnelSteps, while our
            // data-model-aware service uses data_model_id.  We bridge them
            // by looking up the first data model for the project.
            const dmSourceRepo = this.getDataModelSourceRepo();
            const dmSources = await dmSourceRepo.find({
                where: { data_model_id: request.projectId },
            });

            if (dmSources && dmSources.length > 0) {
                const result = await this.analyze({
                    data_model_id: request.projectId,
                    date_range: {
                        start: request.dateRangeStart.toISOString(),
                        end: request.dateRangeEnd.toISOString(),
                    },
                });

                return {
                    success: true,
                    data: {
                        id: 0,
                        projectId: request.projectId,
                        funnelName: request.funnelName,
                        funnelSteps: request.funnelSteps,
                        totalEntered: result.stages.length > 0 ? result.stages[0].count : 0,
                        totalCompleted: result.stages.length > 0 ? result.stages[result.stages.length - 1].count : 0,
                        conversionRate: result.stages.length > 1 && result.stages[0].count > 0
                            ? Math.round((result.stages[result.stages.length - 1].count / result.stages[0].count) * 1000) / 10
                            : 0,
                        createdAt: new Date(),
                        updatedAt: new Date(),
                    },
                };
            }

            return {
                success: true,
                data: {
                    id: 0,
                    projectId: request.projectId,
                    funnelName: request.funnelName,
                    funnelSteps: request.funnelSteps,
                    totalEntered: 0,
                    totalCompleted: 0,
                    conversionRate: 0,
                    createdAt: new Date(),
                    updatedAt: new Date(),
                },
            };
        } catch (error) {
            return {
                success: false,
                error: error instanceof Error ? error.message : 'Unknown funnel analysis error',
            };
        }
    }

    /**
     * Get customer journey map — compatibility stub for AttributionProcessor.
     * Returns an empty journey list for now; full implementation requires
     * individual event-level tracking data.
     */
    async getJourneyMap(_request: IJourneyMapRequest): Promise<IJourneyMapResponse> {
        return {
            success: true,
            data: [],
            totalJourneys: 0,
        };
    }
}
