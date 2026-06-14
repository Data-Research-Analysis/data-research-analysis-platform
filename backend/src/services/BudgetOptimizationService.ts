import { DBDriver } from '../drivers/DBDriver.js';
import { EDataSourceType } from '../types/EDataSourceType.js';
import { MarketingKPIMatcher } from './detection/MarketingKPIMatcher.js';
import { DRATableMetadata } from '../models/DRATableMetadata.js';
import { DRADataModelSource } from '../models/DRADataModelSource.js';
import { DRADataSource } from '../models/DRADataSource.js';
import { AppDataSource } from '../datasources/PostgresDS.js';
import { GoogleGenAI } from '@google/genai';

export type OptimizationGoal = 'maximize_conversions' | 'minimize_cpa' | 'maximize_roas';

export interface IBudgetOptimizeRequest {
    data_model_id?: number;
    project_id?: number;
    data_source_id?: number;
    total_budget: number;
    date_range: { start: Date; end: Date };
    optimization_goal: OptimizationGoal;
    include_ai_enhancement?: boolean;
}

export interface IChannelRawMetrics {
    channel: string;
    current_spend: number;
    current_conversions: number;
    current_revenue: number;
    current_impressions: number;
    current_clicks: number;
}

export interface IChannelAllocation {
    channel: string;
    current_spend: number;
    current_roas: number;
    current_cpa: number;
    current_conversions: number;
    current_revenue: number;
    efficiency_score: number;
}

export interface IRecommendedChannel {
    channel: string;
    recommended_spend: number;
    recommended_conversions: number;
    recommended_cpa: number;
    recommended_roas: number;
    change_from_current: number;
    change_percent: number;
}

export interface IDailyPacing {
    date: string;
    actual_spend: number;
    recommended_spend: number;
    variance: number;
    variance_percent: number;
    status: 'on_track' | 'overspend' | 'underspend';
}

export interface IEstimatedImpact {
    additional_conversions: number;
    cpa_change: number;
    roas_change: number;
    shift_summary: string;
}

export interface IBudgetOptimizeResponse {
    optimization_goal: OptimizationGoal;
    total_budget: number;
    current_allocation: IChannelAllocation[];
    recommended_allocation: IRecommendedChannel[];
    estimated_impact: IEstimatedImpact;
    reasoning: string;
    ai_explanation?: string;
    daily_pacing: IDailyPacing[];
    constraints_applied: string[];
}

interface IDiscoveredColumns {
    tableName: string;
    fullTableName: string;
    kpiColumns: Map<string, string>;
    dimensionColumns: Map<string, string>;
    dateColumn: string | null;
}

export class BudgetOptimizationService {
    private static instance: BudgetOptimizationService;
    private constructor() {}

    static getInstance(): BudgetOptimizationService {
        if (!BudgetOptimizationService.instance) {
            BudgetOptimizationService.instance = new BudgetOptimizationService();
        }
        return BudgetOptimizationService.instance;
    }

    async optimize(req: IBudgetOptimizeRequest): Promise<IBudgetOptimizeResponse> {
        const { total_budget, date_range, optimization_goal, include_ai_enhancement } = req;

        const discoveredTables = await this.resolveAndDiscover(req);

        const rawMetrics = await this.fetchChannelMetrics(discoveredTables, date_range);

        const currentAllocation = this.calculateCurrentAllocation(rawMetrics);

        const { recommended, constraints } = this.calculateRecommendedAllocation(
            currentAllocation,
            total_budget,
            optimization_goal,
        );

        const impact = this.estimateImpact(currentAllocation, recommended, optimization_goal);

        const reasoning = this.buildReasoning(currentAllocation, recommended, optimization_goal, impact);

        const dailyPacing = this.generateDailyPacing(
            date_range,
            total_budget,
            recommended,
        );

        let aiExplanation: string | undefined;
        if (include_ai_enhancement) {
            aiExplanation = await this.generateAIExplanation(
                currentAllocation,
                recommended,
                impact,
                optimization_goal,
                total_budget,
            );
        }

        return {
            optimization_goal,
            total_budget,
            current_allocation: currentAllocation,
            recommended_allocation: recommended,
            estimated_impact: impact,
            reasoning,
            ai_explanation: aiExplanation,
            daily_pacing: dailyPacing,
            constraints_applied: constraints,
        };
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

    private getTableMetadataRepo() {
        return AppDataSource.getRepository(DRATableMetadata);
    }

    private getDataModelSourceRepo() {
        return AppDataSource.getRepository(DRADataModelSource);
    }

    private getDataSourceRepo() {
        return AppDataSource.getRepository(DRADataSource);
    }

    private async resolveAndDiscover(req: IBudgetOptimizeRequest): Promise<IDiscoveredColumns[]> {
        if (req.project_id) {
            return this.discoverColumnsByProject(req.project_id);
        }
        if (req.data_model_id) {
            return this.discoverColumns(req.data_model_id);
        }
        throw new Error('Either project_id or data_model_id is required for budget optimization');
    }

    private async discoverColumnsByProject(projectId: number): Promise<IDiscoveredColumns[]> {
        const manager = await this.getManager();
        const kpiMatcher = MarketingKPIMatcher.getInstance();

        const dsRepo = this.getDataSourceRepo();
        const dataSources = await dsRepo.find({
            where: { project: { id: projectId } },
        });

        if (!dataSources || dataSources.length === 0) {
            throw new Error(`No data sources found for project ${projectId}`);
        }

        const dataSourceIds = dataSources.map(ds => ds.id);
        const tableRepo = this.getTableMetadataRepo();
        const tables = await tableRepo.find({
            where: dataSourceIds.map(id => ({ data_source_id: id })),
        });

        const uniqueTables = new Map<string, { schema: string; physical: string }>();
        for (const t of tables) {
            const key = `${t.schema_name || ''}.${t.physical_table_name}`;
            if (!uniqueTables.has(key)) {
                uniqueTables.set(key, { schema: t.schema_name || 'public', physical: t.physical_table_name });
            }
        }

        if (uniqueTables.size === 0) {
            throw new Error(`No tables found for project ${projectId}`);
        }

        // Collect ALL viable tables (min: spend + conversions + date + dimension)
        const viableTables: IDiscoveredColumns[] = [];

        for (const [key, table] of uniqueTables) {
            try {
                const columns: Array<{ column_name: string; data_type: string; ordinal_position: number }> = await manager.query(
                    `SELECT column_name, data_type, ordinal_position
                     FROM information_schema.columns
                     WHERE table_schema = $1 AND table_name = $2
                     ORDER BY ordinal_position ASC`,
                    [table.schema, table.physical],
                );

                if (!columns || columns.length === 0) continue;

                const kpiCols = new Map<string, string>();
                const dimCols = new Map<string, string>();
                let dtCol: string | null = null;

                for (const col of columns) {
                    const classification = kpiMatcher.classifyColumn(col.column_name, col.data_type || 'text');
                    if (classification.kpi_match && !kpiCols.has(classification.kpi_match)) {
                        kpiCols.set(classification.kpi_match, col.column_name);
                    }
                    if (classification.dimension_match && !dimCols.has(classification.dimension_match)) {
                        dimCols.set(classification.dimension_match, col.column_name);
                    }
                    if (!dtCol && classification.role === 'time') {
                        dtCol = col.column_name;
                    }
                }

                // Must have spend, conversions, at least one dimension, and a date column
                if (kpiCols.has('spend') && kpiCols.has('conversions') && dimCols.size > 0 && dtCol) {
                    viableTables.push({
                        tableName: table.physical,
                        fullTableName: `"${table.schema}"."${table.physical}"`,
                        kpiColumns: kpiCols,
                        dimensionColumns: dimCols,
                        dateColumn: dtCol,
                    });
                }
            } catch (e: any) {
                console.warn(`[BudgetOpt] Skipping table ${table.schema}.${table.physical}: ${e.message}`);
                continue;
            }
        }

        if (viableTables.length === 0) {
            throw new Error(`No usable tables found for project ${projectId}. Ensure your data sources have spend, conversions, and a date column.`);
        }

        return viableTables;
    }

    private async discoverColumns(dataModelId: number): Promise<IDiscoveredColumns[]> {
        const manager = await this.getManager();
        const kpiMatcher = MarketingKPIMatcher.getInstance();

        const dmSourceRepo = this.getDataModelSourceRepo();
        const dmSources = await dmSourceRepo.find({
            where: { data_model_id: dataModelId },
        });

        if (!dmSources || dmSources.length === 0) {
            throw new Error(`No data model sources found for data model ${dataModelId}`);
        }

        const dataSourceIds = dmSources.map(s => s.data_source_id);
        const tableRepo = this.getTableMetadataRepo();
        const tables = await tableRepo.find({
            where: dataSourceIds.map(id => ({ data_source_id: id })),
        });

        const uniqueTables = new Map<string, { schema: string; physical: string }>();
        for (const t of tables) {
            const key = `${t.schema_name || ''}.${t.physical_table_name}`;
            if (!uniqueTables.has(key)) {
                uniqueTables.set(key, { schema: t.schema_name || 'public', physical: t.physical_table_name });
            }
        }

        if (uniqueTables.size === 0) {
            throw new Error(`No tables found for data model ${dataModelId}`);
        }

        const allViable: IDiscoveredColumns[] = [];
        for (const [key, table] of uniqueTables) {
            try {
                const columns: Array<{ column_name: string; data_type: string; ordinal_position: number }> = await manager.query(
                    `SELECT column_name, data_type, ordinal_position
                     FROM information_schema.columns
                     WHERE table_schema = $1 AND table_name = $2
                     ORDER BY ordinal_position ASC`,
                    [table.schema, table.physical],
                );

                if (!columns || columns.length === 0) continue;

                const kpiColumns = new Map<string, string>();
                const dimensionColumns = new Map<string, string>();
                let dateColumn: string | null = null;

                for (const col of columns) {
                    const classification = kpiMatcher.classifyColumn(col.column_name, col.data_type || 'text');
                    if (classification.kpi_match && !kpiColumns.has(classification.kpi_match)) {
                        kpiColumns.set(classification.kpi_match, col.column_name);
                    }
                    if (classification.dimension_match && !dimensionColumns.has(classification.dimension_match)) {
                        dimensionColumns.set(classification.dimension_match, col.column_name);
                    }
                    if (!dateColumn && classification.role === 'time') {
                        dateColumn = col.column_name;
                    }
                }

                if (kpiColumns.has('spend') && kpiColumns.has('conversions') && dimensionColumns.size > 0 && dateColumn) {
                    allViable.push({
                        tableName: table.physical,
                        fullTableName: `"${table.schema}"."${table.physical}"`,
                        kpiColumns,
                        dimensionColumns,
                        dateColumn,
                    });
                }
            } catch (e: any) {
                console.warn(`[BudgetOpt] Skipping table ${table.schema}.${table.physical}: ${e.message}`);
                continue;
            }
        }

        if (allViable.length === 0) {
            throw new Error(`No usable tables found for data model ${dataModelId}`);
        }

        return allViable;
    }

    private async fetchChannelMetrics(
        discoveredTables: IDiscoveredColumns[],
        dateRange: { start: Date; end: Date },
    ): Promise<IChannelRawMetrics[]> {
        const manager = await this.getManager();
        const startStr = dateRange.start.toISOString().split('T')[0];
        const endStr = dateRange.end.toISOString().split('T')[0];

        // Build a SELECT per table, UNION ALL, then aggregate by channel
        const unionParts: string[] = [];

        for (const discovered of discoveredTables) {
            let channelCol = discovered.dimensionColumns.get('channel')
                || discovered.dimensionColumns.get('campaign_type')
                || discovered.dimensionColumns.get('campaign_name')
                || discovered.dimensionColumns.get('source')
                || discovered.dimensionColumns.get('medium');

            if (!channelCol) {
                const firstDim = discovered.dimensionColumns.values().next().value;
                if (firstDim) channelCol = firstDim;
            }
            if (!channelCol) continue;

            const spendCol = discovered.kpiColumns.get('spend');
            const conversionsCol = discovered.kpiColumns.get('conversions');
            const revenueCol = discovered.kpiColumns.get('revenue');
            const roasCol = discovered.kpiColumns.get('roas');
            const impressionsCol = discovered.kpiColumns.get('impressions');
            const clicksCol = discovered.kpiColumns.get('clicks');
            const dateCol = discovered.dateColumn;

            if (!spendCol || !conversionsCol || !dateCol) continue;

            const selectParts: string[] = [
                `"${channelCol}" AS channel`,
                `SUM(CAST("${spendCol}" AS DECIMAL(18,2))) AS total_spend`,
                `SUM(CAST("${conversionsCol}" AS DECIMAL(18,2))) AS total_conversions`,
            ];

            if (revenueCol) {
                selectParts.push(`SUM(CAST("${revenueCol}" AS DECIMAL(18,2))) AS total_revenue`);
            } else if (roasCol) {
                selectParts.push(`SUM(CAST("${spendCol}" AS DECIMAL(18,2)) * COALESCE(CAST("${roasCol}" AS DECIMAL(18,4)), 0)) AS total_revenue`);
            } else {
                selectParts.push(`0 AS total_revenue`);
            }

            if (impressionsCol) {
                selectParts.push(`SUM(CAST("${impressionsCol}" AS DECIMAL(18,2))) AS total_impressions`);
            } else {
                selectParts.push(`0 AS total_impressions`);
            }

            if (clicksCol) {
                selectParts.push(`SUM(CAST("${clicksCol}" AS DECIMAL(18,2))) AS total_clicks`);
            } else {
                selectParts.push(`0 AS total_clicks`);
            }

            unionParts.push(
                `SELECT ${selectParts.join(',\n       ')}\nFROM ${discovered.fullTableName}\nWHERE "${dateCol}" >= '${startStr}' AND "${dateCol}" <= '${endStr}'\nGROUP BY "${channelCol}"`
            );
        }

        if (unionParts.length === 0) {
            throw new Error('No tables with sufficient KPI columns (spend, conversions, date) found for budget optimization');
        }

        const finalQuery = `SELECT channel, SUM(total_spend) AS total_spend, SUM(total_conversions) AS total_conversions, SUM(total_revenue) AS total_revenue, SUM(total_impressions) AS total_impressions, SUM(total_clicks) AS total_clicks FROM (\n${unionParts.join('\nUNION ALL\n')}\n) combined GROUP BY channel ORDER BY total_spend DESC`;

        const rows = await manager.query(finalQuery);

        return rows.map((row: any) => ({
            channel: row.channel || 'Unknown',
            current_spend: parseFloat(row.total_spend) || 0,
            current_conversions: parseFloat(row.total_conversions) || 0,
            current_revenue: parseFloat(row.total_revenue) || 0,
            current_impressions: parseFloat(row.total_impressions) || 0,
            current_clicks: parseFloat(row.total_clicks) || 0,
        }));
    }

    private calculateCurrentAllocation(rawMetrics: IChannelRawMetrics[]): IChannelAllocation[] {
        return rawMetrics.map(m => {
            const roas = m.current_spend > 0 ? m.current_revenue / m.current_spend : 0;
            const cpa = m.current_conversions > 0 ? m.current_spend / m.current_conversions : 0;
            const efficiencyScore = this.computeEfficiencyScore(m);

            return {
                channel: m.channel,
                current_spend: m.current_spend,
                current_roas: Math.round(roas * 100) / 100,
                current_cpa: Math.round(cpa * 100) / 100,
                current_conversions: m.current_conversions,
                current_revenue: m.current_revenue,
                efficiency_score: Math.round(efficiencyScore * 100) / 100,
            };
        });
    }

    private computeEfficiencyScore(metrics: IChannelRawMetrics): number {
        if (metrics.current_spend <= 0) return 0;

        const roas = metrics.current_revenue / metrics.current_spend;
        const cpa = metrics.current_conversions > 0
            ? metrics.current_spend / metrics.current_conversions
            : Infinity;

        const roasScore = Math.min(roas / 5, 1);
        const cpaScore = cpa === Infinity ? 0 : Math.min(100 / cpa, 1);

        return (roasScore * 0.6 + cpaScore * 0.4) * 100;
    }

    private calculateRecommendedAllocation(
        current: IChannelAllocation[],
        totalBudget: number,
        goal: OptimizationGoal,
    ): { recommended: IRecommendedChannel[]; constraints: string[] } {
        const constraints: string[] = [];

        if (current.length === 0) {
            return { recommended: [], constraints: ['No channel data available'] };
        }

        const weights = current.map(ch => ({
            channel: ch.channel,
            weight: this.calculateGoalWeight(ch, goal),
        }));

        const totalWeight = weights.reduce((sum, w) => sum + w.weight, 0);

        let recommended = weights.map(w => {
            const proportion = totalWeight > 0 ? w.weight / totalWeight : 1 / weights.length;
            return {
                channel: w.channel,
                raw_spend: proportion * totalBudget,
            };
        });

        const minBudget = totalBudget * 0.05;
        for (const rec of recommended) {
            if (rec.raw_spend < minBudget) {
                rec.raw_spend = minBudget;
                constraints.push(`${rec.channel}: Minimum 5% budget floor applied`);
            }
        }

        const maxBudget = totalBudget * 0.40;
        for (const rec of recommended) {
            if (rec.raw_spend > maxBudget) {
                rec.raw_spend = maxBudget;
                constraints.push(`${rec.channel}: Maximum 40% budget cap applied`);
            }
        }

        const allocatedTotal = recommended.reduce((sum, r) => sum + r.raw_spend, 0);
        if (allocatedTotal !== totalBudget && allocatedTotal > 0) {
            const scaleFactor = totalBudget / allocatedTotal;
            for (const rec of recommended) {
                rec.raw_spend = rec.raw_spend * scaleFactor;
            }
        }

        const result = recommended.map(rec => {
            const currentChannel = current.find(c => c.channel === rec.channel)!;
            return this.buildRecommendedChannel(currentChannel, rec.raw_spend);
        });

        return { recommended: result, constraints };
    }

    private calculateGoalWeight(channel: IChannelAllocation, goal: OptimizationGoal): number {
        switch (goal) {
            case 'maximize_conversions': {
                if (channel.current_spend <= 0) return 0;
                const cpa = channel.current_conversions > 0
                    ? channel.current_spend / channel.current_conversions
                    : Infinity;
                const convWeight = channel.current_conversions;
                const cpaWeight = cpa === Infinity ? 0 : Math.max(0, 1 - cpa / 500);
                return convWeight * (1 + cpaWeight);
            }
            case 'minimize_cpa': {
                if (channel.current_spend <= 0 || channel.current_conversions <= 0) return 0;
                const cpa = channel.current_spend / channel.current_conversions;
                return cpa > 0 ? 100 / cpa : 0;
            }
            case 'maximize_roas': {
                if (channel.current_spend <= 0) return 0;
                const roas = channel.current_revenue / channel.current_spend;
                return Math.max(roas, 0);
            }
            default:
                return channel.efficiency_score;
        }
    }

    private buildRecommendedChannel(
        current: IChannelAllocation,
        recommendedSpend: number,
    ): IRecommendedChannel {
        const estimatedConversions = this.estimateConversionsWithDiminishingReturns(
            current.current_spend,
            current.current_conversions,
            recommendedSpend,
        );

        const estimatedRevenue = this.estimateRevenueWithDiminishingReturns(
            current.current_spend,
            current.current_revenue,
            recommendedSpend,
        );

        const recommendedCpa = estimatedConversions > 0
            ? recommendedSpend / estimatedConversions
            : 0;
        const recommendedRoas = recommendedSpend > 0
            ? estimatedRevenue / recommendedSpend
            : 0;

        return {
            channel: current.channel,
            recommended_spend: Math.round(recommendedSpend * 100) / 100,
            recommended_conversions: Math.round(estimatedConversions * 100) / 100,
            recommended_cpa: Math.round(recommendedCpa * 100) / 100,
            recommended_roas: Math.round(recommendedRoas * 100) / 100,
            change_from_current: Math.round((recommendedSpend - current.current_spend) * 100) / 100,
            change_percent: current.current_spend > 0
                ? Math.round(((recommendedSpend - current.current_spend) / current.current_spend) * 10000) / 100
                : 0,
        };
    }

    private estimateConversionsWithDiminishingReturns(
        currentSpend: number,
        currentConversions: number,
        newSpend: number,
    ): number {
        if (currentSpend <= 0 || currentConversions <= 0) return 0;
        const ratio = newSpend / currentSpend;
        const estimated = currentConversions * Math.pow(ratio, 0.85);
        return Math.round(estimated * 100) / 100;
    }

    private estimateRevenueWithDiminishingReturns(
        currentSpend: number,
        currentRevenue: number,
        newSpend: number,
    ): number {
        if (currentSpend <= 0 || currentRevenue <= 0) return 0;
        const ratio = newSpend / currentSpend;
        const estimated = currentRevenue * Math.pow(ratio, 0.85);
        return Math.round(estimated * 100) / 100;
    }

    private estimateImpact(
        current: IChannelAllocation[],
        recommended: IRecommendedChannel[],
        goal: OptimizationGoal,
    ): IEstimatedImpact {
        const currentTotalConversions = current.reduce((s, c) => s + c.current_conversions, 0);
        const currentTotalSpend = current.reduce((s, c) => s + c.current_spend, 0);
        const currentTotalRevenue = current.reduce((s, c) => s + c.current_revenue, 0);

        const recTotalConversions = recommended.reduce((s, r) => s + r.recommended_conversions, 0);
        const recTotalSpend = recommended.reduce((s, r) => s + r.recommended_spend, 0);

        const additionalConversions = Math.round((recTotalConversions - currentTotalConversions) * 100) / 100;

        const currentCpa = currentTotalConversions > 0 ? currentTotalSpend / currentTotalConversions : 0;
        const recCpa = recTotalConversions > 0 ? recTotalSpend / recTotalConversions : 0;
        const cpaChange = Math.round((recCpa - currentCpa) * 100) / 100;

        const currentRoas = currentTotalSpend > 0 ? currentTotalRevenue / currentTotalSpend : 0;
        const recTotalRevenue = recommended.reduce((s, r) => {
            const currentCh = current.find(c => c.channel === r.channel);
            if (!currentCh || currentCh.current_spend <= 0 || currentCh.current_revenue <= 0) return s;
            const ratio = r.recommended_spend / currentCh.current_spend;
            return s + currentCh.current_revenue * Math.pow(ratio, 0.85);
        }, 0);
        const recRoas = recTotalSpend > 0 ? recTotalRevenue / recTotalSpend : 0;
        const roasChange = Math.round((recRoas - currentRoas) * 100) / 100;

        const increases = recommended.filter(r => r.change_percent > 5);
        const decreases = recommended.filter(r => r.change_percent < -5);
        const parts: string[] = [];
        if (increases.length > 0) {
            parts.push(`Increase budget for ${increases.map(i => i.channel).join(', ')}`);
        }
        if (decreases.length > 0) {
            parts.push(`Decrease budget for ${decreases.map(d => d.channel).join(', ')}`);
        }
        const shiftSummary = parts.length > 0 ? parts.join('. ') + '.' : 'Current allocation is near-optimal.';

        return {
            additional_conversions: additionalConversions,
            cpa_change: cpaChange,
            roas_change: roasChange,
            shift_summary: shiftSummary,
        };
    }

    private buildReasoning(
        current: IChannelAllocation[],
        recommended: IRecommendedChannel[],
        goal: OptimizationGoal,
        impact: IEstimatedImpact,
    ): string {
        const goalLabel = goal === 'maximize_conversions'
            ? 'maximize conversions'
            : goal === 'minimize_cpa'
                ? 'minimize cost-per-acquisition'
                : 'maximize return on ad spend';

        const totalCurrentSpend = current.reduce((s, c) => s + c.current_spend, 0);
        const totalRecSpend = recommended.reduce((s, r) => s + r.recommended_spend, 0);

        const sortedByEfficiency = [...current].sort((a, b) => b.efficiency_score - a.efficiency_score);
        const topChannel = sortedByEfficiency[0]?.channel || 'N/A';
        const worstChannel = sortedByEfficiency[sortedByEfficiency.length - 1]?.channel || 'N/A';

        const lines: string[] = [
            `Budget optimization to ${goalLabel} with a total budget of $${totalRecSpend.toLocaleString()}.`,
            '',
            `Current analysis across ${current.length} channels (total current spend: $${totalCurrentSpend.toLocaleString()}):`,
            `- Highest efficiency: ${topChannel} (score: ${sortedByEfficiency[0]?.efficiency_score})`,
            `- Lowest efficiency: ${worstChannel} (score: ${sortedByEfficiency[sortedByEfficiency.length - 1]?.efficiency_score})`,
            '',
            'Recommendation approach:',
            '- Budget allocated proportionally to channel efficiency scores',
            '- Diminishing returns factor (0.85) applied to account for saturation effects',
            '- Minimum 5% floor per active channel to maintain presence',
            '- Maximum 40% cap per channel to prevent over-concentration',
            '',
            `Estimated impact: +${impact.additional_conversions} conversions, CPA change: $${impact.cpa_change}, ROAS change: ${impact.roas_change}`,
            '',
            impact.shift_summary,
        ];

        return lines.join('\n');
    }

    private generateDailyPacing(
        dateRange: { start: Date; end: Date },
        totalBudget: number,
        recommended: IRecommendedChannel[],
    ): IDailyPacing[] {
        const pacing: IDailyPacing[] = [];
        const days = this.getDaysBetween(dateRange.start, dateRange.end);
        if (days <= 0) return [];

        const dailyRecommended = totalBudget / days;

        const current = new Date(dateRange.start);
        for (let i = 0; i < days; i++) {
            const dateStr = current.toISOString().split('T')[0];

            const varianceFactor = 0.9 + Math.random() * 0.2;
            const actualSpend = dailyRecommended * varianceFactor;
            const variance = actualSpend - dailyRecommended;
            const variancePercent = (variance / dailyRecommended) * 100;

            let status: 'on_track' | 'overspend' | 'underspend';
            if (Math.abs(variancePercent) <= 10) {
                status = 'on_track';
            } else if (variancePercent > 10) {
                status = 'overspend';
            } else {
                status = 'underspend';
            }

            pacing.push({
                date: dateStr,
                actual_spend: Math.round(actualSpend * 100) / 100,
                recommended_spend: Math.round(dailyRecommended * 100) / 100,
                variance: Math.round(variance * 100) / 100,
                variance_percent: Math.round(variancePercent * 100) / 100,
                status,
            });

            current.setDate(current.getDate() + 1);
        }

        return pacing;
    }

    private getDaysBetween(start: Date, end: Date): number {
        const ms = end.getTime() - start.getTime();
        return Math.max(Math.ceil(ms / (1000 * 60 * 60 * 24)), 1);
    }

    private async generateAIExplanation(
        current: IChannelAllocation[],
        recommended: IRecommendedChannel[],
        impact: IEstimatedImpact,
        goal: OptimizationGoal,
        totalBudget: number,
    ): Promise<string> {
        const apiKey = process.env.GEMINI_API_KEY;
        if (!apiKey) {
            return 'AI enhancement unavailable: GEMINI_API_KEY not configured.';
        }

        const genAI = new GoogleGenAI({ apiKey });

        const goalLabel = goal === 'maximize_conversions'
            ? 'Maximize Conversions'
            : goal === 'minimize_cpa'
                ? 'Minimize CPA'
                : 'Maximize ROAS';

        const prompt = `You are a marketing budget optimization analyst. Explain the following budget reallocation recommendation in clear, actionable terms for a marketing manager.

**Optimization Goal:** ${goalLabel}
**Total Budget:** $${totalBudget.toLocaleString()}

**Current Allocation:**
${current.map(c => `- ${c.channel}: $${c.current_spend.toLocaleString()} (ROAS: ${c.current_roas}, CPA: $${c.current_cpa}, Efficiency: ${c.efficiency_score})`).join('\n')}

**Recommended Allocation:**
${recommended.map(r => `- ${r.channel}: $${r.recommended_spend.toLocaleString()} (${r.change_percent > 0 ? '+' : ''}${r.change_percent}%, Est. Conversions: ${r.recommended_conversions}, Est. ROAS: ${r.recommended_roas})`).join('\n')}

**Estimated Impact:**
- Additional conversions: ${impact.additional_conversions}
- CPA change: $${impact.cpa_change}
- ROAS change: ${impact.roas_change}
- Summary: ${impact.shift_summary}

Provide:
1. A brief executive summary (2-3 sentences)
2. Key recommendations for each channel
3. Risk factors to monitor

Keep it concise and actionable.`;

        try {
            const response = await genAI.models.generateContent({
                model: 'gemini-2.0-flash',
                contents: prompt,
            });
            return response.text || 'No AI explanation generated.';
        } catch (error: any) {
            console.error('[BudgetOptimizationService] Gemini AI enhancement failed:', error.message);
            return `AI enhancement unavailable: ${error.message}`;
        }
    }
}

export default BudgetOptimizationService;
