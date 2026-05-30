/**
 * Campaign Analysis Service
 *
 * Provides deep campaign-level analysis with dimension breakdowns,
 * performance scoring, and AI-generated insights.
 *
 * Follows the same column-discovery pattern as MarketingMetricsService,
 * leveraging MarketingKPIMatcher for automatic KPI/dimension detection.
 */

import { DBDriver } from '../drivers/DBDriver.js';
import { EDataSourceType } from '../types/EDataSourceType.js';
import { MarketingKPIMatcher, IColumnClassification } from './detection/MarketingKPIMatcher.js';
import { DRATableMetadata } from '../models/DRATableMetadata.js';
import { DRADataModelSource } from '../models/DRADataModelSource.js';
import { AppDataSource } from '../datasources/PostgresDS.js';
import { GeminiService } from './GeminiService.js';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface IDiscoveredColumns {
    tableName: string;
    fullTableName: string;
    kpiColumns: Map<string, string>;      // kpi_match -> column_name
    dimensionColumns: Map<string, string>; // dimension_match -> column_name
    dateColumn: string | null;
    allColumns: Array<{ column_name: string; classification: IColumnClassification }>;
}

interface ICampaignKPICard {
    kpi: string;
    label: string;
    value: number | null;
}

interface IDailyTrendPoint {
    date: string;
    spend: number;
    impressions: number;
    clicks: number;
    conversions: number;
    revenue: number;
    ctr: number;
    cpc: number;
    cpa: number;
    roas: number;
}

interface IDimensionBreakdownRow {
    label: string;
    spend: number;
    impressions: number;
    clicks: number;
    conversions: number;
    revenue: number;
    ctr: number;
    cpc: number;
    cpa: number;
    roas: number;
    performanceScore: number;
    status: 'top_performer' | 'underperformer' | 'normal';
}

interface IDimensionBreakdown {
    dimension: string;
    available: boolean;
    rows: IDimensionBreakdownRow[];
}

interface ICampaignAnalysis {
    campaignId: string;
    campaignName: string;
    channel: string;
    kpis: ICampaignKPICard[];
    dailyTrend: IDailyTrendPoint[];
    dimensionBreakdowns: IDimensionBreakdown[];
    aiAnalysis: string | null;
    recommendations: string[];
}

// ---------------------------------------------------------------------------
// Label mappings (same as MarketingMetricsService)
// ---------------------------------------------------------------------------

const KPI_LABELS: Record<string, string> = {
    spend: 'Total Spend',
    impressions: 'Total Impressions',
    clicks: 'Total Clicks',
    conversions: 'Total Conversions',
    revenue: 'Total Revenue',
    leads: 'Total Leads',
    engagement: 'Total Engagement',
    opens: 'Total Opens',
    sends: 'Total Sends',
    unsubscribes: 'Total Unsubscribes',
    bounces: 'Total Bounces',
    traffic: 'Total Sessions',
    shares: 'Total Shares',
    likes: 'Total Likes',
    comments: 'Total Comments',
    video_views: 'Total Video Views',
    reach: 'Total Reach',
    frequency: 'Average Frequency',
};

const DEFAULT_KPI_VALUES: Record<string, number> = {
    spend: 0,
    impressions: 0,
    clicks: 0,
    conversions: 0,
    revenue: 0,
    leads: 0,
    engagement: 0,
    opens: 0,
    sends: 0,
    unsubscribes: 0,
    bounces: 0,
    traffic: 0,
    shares: 0,
    likes: 0,
    comments: 0,
    video_views: 0,
    reach: 0,
    frequency: 0,
};

// Dimension column names to try (in priority order)
const DIMENSION_KEYS: Record<string, string[]> = {
    ad_group: ['ad_group', 'ad_set', 'adgroup', 'adset'],
    keyword: ['keyword', 'search_keyword', 'search_term'],
    device: ['device', 'device_type', 'platform_type'],
    geo: ['geo', 'region', 'country', 'location', 'geo_target'],
};

// ---------------------------------------------------------------------------
// Service
// ---------------------------------------------------------------------------

export class CampaignAnalysisService {
    private static instance: CampaignAnalysisService;
    private constructor() {}

    public static getInstance(): CampaignAnalysisService {
        if (!CampaignAnalysisService.instance) {
            CampaignAnalysisService.instance = new CampaignAnalysisService();
        }
        return CampaignAnalysisService.instance;
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

    // -----------------------------------------------------------------------
    // Column Discovery (same pattern as MarketingMetricsService)
    // -----------------------------------------------------------------------

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

        const results: IDiscoveredColumns[] = [];

        for (const table of uniqueTables.values()) {
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
            const allColumns: IDiscoveredColumns['allColumns'] = [];

            for (const col of columns) {
                const classification = kpiMatcher.classifyColumn(col.column_name, col.data_type || 'text');
                allColumns.push({ column_name: col.column_name, classification });

                if (classification.kpi_match && !kpiColumns.has(classification.kpi_match)) {
                    kpiColumns.set(classification.kpi_match, col.column_name);
                }
                if (classification.dimension_match && !dimensionColumns.has(classification.dimension_match)) {
                    dimensionColumns.set(classification.dimension_match, col.column_name);
                }
                if (classification.detected_type === 'date' && !dateColumn) {
                    dateColumn = col.column_name;
                }
            }

            const schemaPrefix = table.schema ? `"${table.schema}".` : '';
            const fullTableName = `${schemaPrefix}"${table.physical}"`;

            results.push({
                tableName: table.physical,
                fullTableName,
                kpiColumns,
                dimensionColumns,
                dateColumn,
                allColumns,
            });
        }

        return results;
    }

    // -----------------------------------------------------------------------
    // Main Campaign Analysis
    // -----------------------------------------------------------------------

    /**
     * Get full campaign analysis including KPIs, daily trend,
     * dimension breakdowns, and AI analysis.
     */
    public async getAnalysis(
        dataModelId: number,
        campaignId: string,
        startDate: Date,
        endDate: Date,
    ): Promise<ICampaignAnalysis> {
        const manager = await this.getManager();
        const discoveredTables = await this.discoverColumns(dataModelId);

        // Initialize result
        const result: ICampaignAnalysis = {
            campaignId,
            campaignName: campaignId,
            channel: 'Unknown',
            kpis: [],
            dailyTrend: [],
            dimensionBreakdowns: [],
            aiAnalysis: null,
            recommendations: [],
        };

        let campaignCol: string | null = null;
        let table: IDiscoveredColumns | null = null;

        for (const t of discoveredTables) {
            const cc = t.dimensionColumns.get('campaign') || null;
            if (cc && t.dateColumn) {
                campaignCol = cc;
                table = t;
                break;
            }
        }

        if (!campaignCol || !table) {
            throw new Error(`No campaign column found for data model ${dataModelId}`);
        }

        const channelCol = table.dimensionColumns.get('channel')
            || table.dimensionColumns.get('source')
            || table.dimensionColumns.get('platform')
            || null;

        // 1. Aggregate KPIs for this campaign
        const kpiSelectParts: string[] = [];
        for (const [kpi, colName] of table.kpiColumns) {
            kpiSelectParts.push(`COALESCE(SUM("${colName}"), 0) AS "${kpi}"`);
        }

        if (kpiSelectParts.length > 0) {
            let overviewQuery = `SELECT ${kpiSelectParts.join(', ')}`;
            if (channelCol) overviewQuery += `, "${channelCol}" AS channel`;
            overviewQuery += ` FROM ${table.fullTableName}`;
            overviewQuery += ` WHERE "${campaignCol}" = $1 AND "${table.dateColumn}" BETWEEN $2 AND $3`;
            if (channelCol) overviewQuery += ` GROUP BY "${channelCol}"`;

            try {
                const overviewRows = await manager.query(overviewQuery, [
                    campaignId, startDate.toISOString(), endDate.toISOString(),
                ]);

                if (overviewRows.length > 0) {
                    const first = overviewRows[0];
                    const rawKPIs: Record<string, number> = {};
                    for (const [kpi] of table.kpiColumns) {
                        if (first[kpi] !== undefined) {
                            rawKPIs[kpi] = Number(first[kpi]);
                        }
                    }
                    if (channelCol && first.channel) {
                        result.channel = String(first.channel);
                    }

                    // Compute derived KPIs
                    const spend = rawKPIs.spend || 0;
                    const impressions = rawKPIs.impressions || 0;
                    const clicks = rawKPIs.clicks || 0;
                    const conversions = rawKPIs.conversions || 0;
                    const revenue = rawKPIs.revenue || 0;

                    result.kpis = [
                        { kpi: 'spend', label: KPI_LABELS.spend, value: spend },
                        { kpi: 'impressions', label: KPI_LABELS.impressions, value: impressions },
                        { kpi: 'clicks', label: KPI_LABELS.clicks, value: clicks },
                        { kpi: 'conversions', label: KPI_LABELS.conversions, value: conversions },
                        { kpi: 'revenue', label: KPI_LABELS.revenue, value: revenue },
                        { kpi: 'ctr', label: 'CTR', value: impressions > 0 ? (clicks / impressions) * 100 : 0 },
                        { kpi: 'cpc', label: 'CPC', value: clicks > 0 ? spend / clicks : 0 },
                        { kpi: 'cpa', label: 'CPA', value: conversions > 0 ? spend / conversions : 0 },
                        { kpi: 'roas', label: 'ROAS', value: spend > 0 ? revenue / spend : 0 },
                    ];
                }
            } catch (err) {
                console.warn(`[CampaignAnalysisService] Campaign overview query failed:`, err);
            }
        }

        // 2. Daily trend
        if (table.dateColumn) {
            const dailySelectParts: string[] = [
                `DATE("${table.dateColumn}") AS date`,
            ];
            for (const [kpi, colName] of table.kpiColumns) {
                dailySelectParts.push(`COALESCE(SUM("${colName}"), 0) AS "${kpi}"`);
            }

            let dailyQuery = `SELECT ${dailySelectParts.join(', ')} FROM ${table.fullTableName}`;
            dailyQuery += ` WHERE "${campaignCol}" = $1 AND "${table.dateColumn}" BETWEEN $2 AND $3`;
            dailyQuery += ` GROUP BY DATE("${table.dateColumn}")`;
            dailyQuery += ` ORDER BY date ASC`;

            try {
                const dailyRows = await manager.query(dailyQuery, [
                    campaignId, startDate.toISOString(), endDate.toISOString(),
                ]);

                result.dailyTrend = dailyRows.map((row: any) => {
                    const spend = Number(row.spend || 0);
                    const impressions = Number(row.impressions || 0);
                    const clicks = Number(row.clicks || 0);
                    const conversions = Number(row.conversions || 0);
                    const revenue = Number(row.revenue || 0);

                    return {
                        date: String(row.date),
                        spend,
                        impressions,
                        clicks,
                        conversions,
                        revenue,
                        ctr: impressions > 0 ? (clicks / impressions) * 100 : 0,
                        cpc: clicks > 0 ? spend / clicks : 0,
                        cpa: conversions > 0 ? spend / conversions : 0,
                        roas: spend > 0 ? revenue / spend : 0,
                    };
                });
            } catch (err) {
                console.warn(`[CampaignAnalysisService] Daily trend query failed:`, err);
            }
        }

        // 3. Dimension breakdowns
        result.dimensionBreakdowns = await this.fetchDimensionBreakdowns(
            manager, table, campaignCol, campaignId, startDate, endDate,
        );

        // 4. AI analysis
        try {
            const aiResult = await this.generateAIAnalysis(result);
            result.aiAnalysis = aiResult.analysis;
            result.recommendations = aiResult.recommendations;
        } catch (err) {
            console.warn('[CampaignAnalysisService] AI analysis generation failed:', err);
            result.aiAnalysis = null;
            result.recommendations = [];
        }

        return result;
    }

    // -----------------------------------------------------------------------
    // Dimension Breakdowns
    // -----------------------------------------------------------------------

    /**
     * Fetch all available dimension breakdowns for a campaign.
     * Gracefully skips dimensions that don't exist in the data.
     */
    private async fetchDimensionBreakdowns(
        manager: any,
        table: IDiscoveredColumns,
        campaignCol: string,
        campaignId: string,
        startDate: Date,
        endDate: Date,
    ): Promise<IDimensionBreakdown[]> {
        const breakdowns: IDimensionBreakdown[] = [];

        for (const [dimension, possibleKeys] of Object.entries(DIMENSION_KEYS)) {
            // Find which dimension column matches
            let dimCol: string | null = null;
            for (const key of possibleKeys) {
                const found = table.dimensionColumns.get(key);
                if (found) {
                    dimCol = found;
                    break;
                }
            }

            if (!dimCol) {
                breakdowns.push({
                    dimension,
                    available: false,
                    rows: [],
                });
                continue;
            }

            try {
                const rows = await this.fetchDimensionRows(
                    manager, table, campaignCol, campaignId, dimCol, startDate, endDate,
                );
                breakdowns.push({
                    dimension,
                    available: rows.length > 0,
                    rows,
                });
            } catch (err) {
                console.warn(`[CampaignAnalysisService] Dimension breakdown '${dimension}' failed:`, err);
                breakdowns.push({
                    dimension,
                    available: false,
                    rows: [],
                });
            }
        }

        return breakdowns;
    }

    /**
     * Fetch breakdown rows for a specific dimension column.
     */
    private async fetchDimensionRows(
        manager: any,
        table: IDiscoveredColumns,
        campaignCol: string,
        campaignId: string,
        dimCol: string,
        startDate: Date,
        endDate: Date,
    ): Promise<IDimensionBreakdownRow[]> {
        const kpiSelectParts: string[] = [];
        for (const [kpi, colName] of table.kpiColumns) {
            kpiSelectParts.push(`COALESCE(SUM("${colName}"), 0) AS "${kpi}"`);
        }
        if (kpiSelectParts.length === 0) return [];

        const query = `
            SELECT "${dimCol}" AS label, ${kpiSelectParts.join(', ')}
            FROM ${table.fullTableName}
            WHERE "${campaignCol}" = $1 AND "${table.dateColumn}" BETWEEN $2 AND $3
            GROUP BY "${dimCol}"
            ORDER BY COALESCE(SUM("${table.kpiColumns.get('spend') || table.kpiColumns.values().next().value}"), 0) DESC
        `;

        const rawRows = await manager.query(query, [
            campaignId, startDate.toISOString(), endDate.toISOString(),
        ]);

        const rows: IDimensionBreakdownRow[] = rawRows.map((row: any) => {
            const spend = Number(row.spend || 0);
            const impressions = Number(row.impressions || 0);
            const clicks = Number(row.clicks || 0);
            const conversions = Number(row.conversions || 0);
            const revenue = Number(row.revenue || 0);

            return {
                label: String(row.label || 'Unknown'),
                spend,
                impressions,
                clicks,
                conversions,
                revenue,
                ctr: impressions > 0 ? (clicks / impressions) * 100 : 0,
                cpc: clicks > 0 ? spend / clicks : 0,
                cpa: conversions > 0 ? spend / conversions : 0,
                roas: spend > 0 ? revenue / spend : 0,
                performanceScore: 50, // Placeholder — calculated below
                status: 'normal' as const,
            };
        });

        // Calculate performance scores
        this.calculatePerformanceScores(rows);

        return rows;
    }

    // -----------------------------------------------------------------------
    // Performance Scoring
    // -----------------------------------------------------------------------

    /**
     * Calculate performance scores (1-100) for dimension rows.
     *
     * Scoring factors:
     * - CPA: lower is better (below avg = bonus points, above avg = penalty)
     * - ROAS: higher is better (above avg = bonus points, below avg = penalty)
     *
     * Status thresholds:
     * - score < 40  => underperformer
     * - score > 80  => top_performer
     * - otherwise   => normal
     */
    private calculatePerformanceScores(rows: IDimensionBreakdownRow[]): void {
        if (rows.length === 0) return;

        // Filter rows with actual activity for averaging
        const activeRows = rows.filter(r => r.spend > 0);
        if (activeRows.length === 0) {
            rows.forEach(r => {
                r.performanceScore = 50;
                r.status = 'normal';
            });
            return;
        }

        // Compute averages for comparison
        const avgCpa = activeRows.reduce((sum, r) => sum + r.cpa, 0) / activeRows.length;
        const avgRoas = activeRows.reduce((sum, r) => sum + r.roas, 0) / activeRows.length;

        for (const row of rows) {
            if (row.spend === 0) {
                row.performanceScore = 50;
                row.status = 'normal';
                continue;
            }

            let score = 50;

            // CPA factor: -20 to +20 points
            if (avgCpa > 0) {
                const cpaRatio = row.cpa / avgCpa;
                if (cpaRatio < 1) {
                    // Better than average (lower CPA = good)
                    score += Math.min(20, (1 - cpaRatio) * 20);
                } else {
                    // Worse than average (higher CPA = bad)
                    score -= Math.min(20, (cpaRatio - 1) * 20);
                }
            }

            // ROAS factor: -20 to +20 points
            if (avgRoas > 0) {
                const roasRatio = row.roas / avgRoas;
                if (roasRatio > 1) {
                    // Better than average (higher ROAS = good)
                    score += Math.min(20, (roasRatio - 1) * 20);
                } else {
                    // Worse than average (lower ROAS = bad)
                    score -= Math.min(20, (1 - roasRatio) * 20);
                }
            }

            // Clamp to 1-100
            row.performanceScore = Math.max(1, Math.min(100, Math.round(score)));

            // Assign status
            if (row.performanceScore < 40) {
                row.status = 'underperformer';
            } else if (row.performanceScore > 80) {
                row.status = 'top_performer';
            } else {
                row.status = 'normal';
            }
        }
    }

    // -----------------------------------------------------------------------
    // Lightweight Endpoints (no AI, no unnecessary queries)
    // -----------------------------------------------------------------------

    /**
     * Get only KPI summary cards for a campaign (no trend, no dimensions, no AI).
     * Used by the /summary endpoint for fast response times.
     */
    public async getKpisOnly(
        dataModelId: number,
        campaignId: string,
        startDate: Date,
        endDate: Date,
    ): Promise<{ campaignId: string; campaignName: string; channel: string; kpis: ICampaignKPICard[] }> {
        const manager = await this.getManager();
        const discoveredTables = await this.discoverColumns(dataModelId);

        let campaignCol: string | null = null;
        let table: IDiscoveredColumns | null = null;

        for (const t of discoveredTables) {
            const cc = t.dimensionColumns.get('campaign') || null;
            if (cc && t.dateColumn) {
                campaignCol = cc;
                table = t;
                break;
            }
        }

        if (!campaignCol || !table) {
            throw new Error(`No campaign column found for data model ${dataModelId}`);
        }

        const result = {
            campaignId,
            campaignName: campaignId,
            channel: 'Unknown',
            kpis: [] as ICampaignKPICard[],
        };

        const channelCol = table.dimensionColumns.get('channel')
            || table.dimensionColumns.get('source')
            || table.dimensionColumns.get('platform')
            || null;

        const kpiSelectParts: string[] = [];
        for (const [kpi, colName] of table.kpiColumns) {
            kpiSelectParts.push(`COALESCE(SUM("${colName}"), 0) AS "${kpi}"`);
        }

        if (kpiSelectParts.length > 0) {
            let overviewQuery = `SELECT ${kpiSelectParts.join(', ')}`;
            if (channelCol) overviewQuery += `, "${channelCol}" AS channel`;
            overviewQuery += ` FROM ${table.fullTableName}`;
            overviewQuery += ` WHERE "${campaignCol}" = $1 AND "${table.dateColumn}" BETWEEN $2 AND $3`;
            if (channelCol) overviewQuery += ` GROUP BY "${channelCol}"`;

            const overviewRows = await manager.query(overviewQuery, [
                campaignId, startDate.toISOString(), endDate.toISOString(),
            ]);

            if (overviewRows.length > 0) {
                const first = overviewRows[0];
                const rawKPIs: Record<string, number> = {};
                for (const [kpi] of table.kpiColumns) {
                    if (first[kpi] !== undefined) {
                        rawKPIs[kpi] = Number(first[kpi]);
                    }
                }
                if (channelCol && first.channel) {
                    result.channel = String(first.channel);
                }

                const spend = rawKPIs.spend || 0;
                const impressions = rawKPIs.impressions || 0;
                const clicks = rawKPIs.clicks || 0;
                const conversions = rawKPIs.conversions || 0;
                const revenue = rawKPIs.revenue || 0;

                result.kpis = [
                    { kpi: 'spend', label: KPI_LABELS.spend, value: spend },
                    { kpi: 'impressions', label: KPI_LABELS.impressions, value: impressions },
                    { kpi: 'clicks', label: KPI_LABELS.clicks, value: clicks },
                    { kpi: 'conversions', label: KPI_LABELS.conversions, value: conversions },
                    { kpi: 'revenue', label: KPI_LABELS.revenue, value: revenue },
                    { kpi: 'ctr', label: 'CTR', value: impressions > 0 ? (clicks / impressions) * 100 : 0 },
                    { kpi: 'cpc', label: 'CPC', value: clicks > 0 ? spend / clicks : 0 },
                    { kpi: 'cpa', label: 'CPA', value: conversions > 0 ? spend / conversions : 0 },
                    { kpi: 'roas', label: 'ROAS', value: spend > 0 ? revenue / spend : 0 },
                ];
            }
        }

        return result;
    }

    /**
     * Get only daily trend data for a campaign (no KPI aggregation, no dimensions, no AI).
     * Used by the /trend endpoint for fast response times.
     */
    public async getTrendOnly(
        dataModelId: number,
        campaignId: string,
        startDate: Date,
        endDate: Date,
    ): Promise<{ campaignId: string; dailyTrend: IDailyTrendPoint[] }> {
        const manager = await this.getManager();
        const discoveredTables = await this.discoverColumns(dataModelId);

        let campaignCol: string | null = null;
        let table: IDiscoveredColumns | null = null;

        for (const t of discoveredTables) {
            const cc = t.dimensionColumns.get('campaign') || null;
            if (cc && t.dateColumn) {
                campaignCol = cc;
                table = t;
                break;
            }
        }

        if (!campaignCol || !table) {
            throw new Error(`No campaign column found for data model ${dataModelId}`);
        }

        const result = {
            campaignId,
            dailyTrend: [] as IDailyTrendPoint[],
        };

        if (table.dateColumn) {
            const dailySelectParts: string[] = [
                `DATE("${table.dateColumn}") AS date`,
            ];
            for (const [kpi, colName] of table.kpiColumns) {
                dailySelectParts.push(`COALESCE(SUM("${colName}"), 0) AS "${kpi}"`);
            }

            let dailyQuery = `SELECT ${dailySelectParts.join(', ')} FROM ${table.fullTableName}`;
            dailyQuery += ` WHERE "${campaignCol}" = $1 AND "${table.dateColumn}" BETWEEN $2 AND $3`;
            dailyQuery += ` GROUP BY DATE("${table.dateColumn}")`;
            dailyQuery += ` ORDER BY date ASC`;

            const dailyRows = await manager.query(dailyQuery, [
                campaignId, startDate.toISOString(), endDate.toISOString(),
            ]);

            result.dailyTrend = dailyRows.map((row: any) => {
                const spend = Number(row.spend || 0);
                const impressions = Number(row.impressions || 0);
                const clicks = Number(row.clicks || 0);
                const conversions = Number(row.conversions || 0);
                const revenue = Number(row.revenue || 0);

                return {
                    date: String(row.date),
                    spend,
                    impressions,
                    clicks,
                    conversions,
                    revenue,
                    ctr: impressions > 0 ? (clicks / impressions) * 100 : 0,
                    cpc: clicks > 0 ? spend / clicks : 0,
                    cpa: conversions > 0 ? spend / conversions : 0,
                    roas: spend > 0 ? revenue / spend : 0,
                };
            });
        }

        return result;
    }

    /**
     * Get only dimension breakdowns for a campaign (no KPI summary, no trend, no AI).
     * Used by the /dimensions endpoint for fast response times.
     */
    public async getDimensionsOnly(
        dataModelId: number,
        campaignId: string,
        startDate: Date,
        endDate: Date,
    ): Promise<IDimensionBreakdown[]> {
        const manager = await this.getManager();
        const discoveredTables = await this.discoverColumns(dataModelId);

        let campaignCol: string | null = null;
        let table: IDiscoveredColumns | null = null;

        for (const t of discoveredTables) {
            const cc = t.dimensionColumns.get('campaign') || null;
            if (cc && t.dateColumn) {
                campaignCol = cc;
                table = t;
                break;
            }
        }

        if (!campaignCol || !table) {
            throw new Error(`No campaign column found for data model ${dataModelId}`);
        }

        return this.fetchDimensionBreakdowns(
            manager, table, campaignCol, campaignId, startDate, endDate,
        );
    }

    // -----------------------------------------------------------------------
    // AI Analysis
    // -----------------------------------------------------------------------

    /**
     * Generate AI-powered campaign analysis using Gemini.
     */
    private async generateAIAnalysis(
        campaignData: ICampaignAnalysis,
    ): Promise<{ analysis: string; recommendations: string[] }> {
        // Build a summary of dimension breakdowns for the prompt
        const breakdownSummary = campaignData.dimensionBreakdowns
            .filter(d => d.available && d.rows.length > 0)
            .map(d => {
                const topPerformers = d.rows.filter(r => r.status === 'top_performer');
                const underperformers = d.rows.filter(r => r.status === 'underperformer');

                let summary = `### ${d.dimension}\n`;
                summary += d.rows.slice(0, 10).map(r =>
                    `  - ${r.label}: Spend $${r.spend.toFixed(2)}, CPA $${r.cpa.toFixed(2)}, ROAS ${r.roas.toFixed(2)}x, Score ${r.performanceScore}`
                ).join('\n');

                if (topPerformers.length > 0) {
                    summary += `\n  Top performers: ${topPerformers.map(r => r.label).join(', ')}`;
                }
                if (underperformers.length > 0) {
                    summary += `\n  Underperformers: ${underperformers.map(r => r.label).join(', ')}`;
                }

                return summary;
            })
            .join('\n\n');

        const kpis = campaignData.kpis.reduce((acc, k) => {
            acc[k.kpi] = k.value;
            return acc;
        }, {} as Record<string, number | null>);

        const prompt = `Analyze the following campaign performance data and provide insights.

## Campaign: ${campaignData.campaignName}
- Channel: ${campaignData.channel}
- Campaign ID: ${campaignData.campaignId}

## KPIs
${campaignData.kpis.map(k => `- ${k.label}: ${k.value !== null ? (k.value % 1 === 0 ? k.value.toLocaleString() : k.value.toFixed(2)) : 'N/A'}`).join('\n')}

## Daily Trend (${campaignData.dailyTrend.length} days)
${campaignData.dailyTrend.length > 0 ? `Latest 7 days:\n${campaignData.dailyTrend.slice(-7).map(d =>
    `  ${d.date}: Spend $${d.spend.toFixed(2)}, Clicks ${d.clicks}, Conversions ${d.conversions}, Revenue $${d.revenue.toFixed(2)}, ROAS ${d.roas.toFixed(2)}x`
).join('\n')}` : 'No daily trend data available.'}

## Dimension Breakdowns
${breakdownSummary || 'No dimension breakdowns available.'}

Provide your response in this exact JSON format:
{
  "analysis": "A 2-4 sentence natural language analysis of this campaign's performance, highlighting key strengths and weaknesses.",
  "recommendations": ["Actionable recommendation 1", "Actionable recommendation 2", "Actionable recommendation 3"]
}

Return ONLY valid JSON, no markdown fences.`;

        try {
            const gemini = new GeminiService();
            const conversationId = `campaign-analysis-${campaignData.campaignId}-${Date.now()}`;
            await gemini.initializeConversation(
                conversationId,
                'You are a marketing analytics expert. Analyze campaign data and provide actionable insights. Always respond with valid JSON when requested.',
            );
            const response = await gemini.sendMessage(conversationId, prompt);

            // Parse AI response
            const cleaned = response.replace(/```json?\s*/gi, '').replace(/```/g, '').trim();
            try {
                const parsed = JSON.parse(cleaned);
                return {
                    analysis: parsed.analysis || null,
                    recommendations: Array.isArray(parsed.recommendations) ? parsed.recommendations : [],
                };
            } catch {
                // If parsing fails, use raw response as analysis
                return {
                    analysis: response.substring(0, 1000),
                    recommendations: [],
                };
            }
        } catch (err) {
            console.error('[CampaignAnalysisService] AI analysis failed:', err);
            return {
                analysis: null,
                recommendations: [],
            };
        }
    }
}

export default CampaignAnalysisService;