/**
 * Marketing Metrics Calculation Service
 *
 * Data-model-aware service that calculates marketing KPIs from any connected
 * data source by leveraging column metadata and MarketingKPIMatcher for
 * automatic KPI detection.
 *
 * Supports:
 * - Cross-channel comparison
 * - Period-over-period comparison
 * - Campaign-level drill-down
 * - Anomaly detection (4-week rolling average)
 * - AI-enhanced insights via Gemini
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

interface IKPIResult {
    kpi: string;
    label: string;
    current: number | null;
    previous: number | null;
    changePercent: number | null;
}

interface IChannelRow {
    channel: string;
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

interface IPeriodComparison {
    current: Record<string, number | null>;
    previous: Record<string, number | null>;
    changePercents: Record<string, number | null>;
    kpis: IKPIResult[];
}

interface ICampaignDetail {
    campaignId: string;
    campaignName: string;
    channel: string;
    kpis: Record<string, number | null>;
    dailyTrend: Array<{ date: string; [metric: string]: string | number | null }>;
}

interface IAnomaly {
    metric: string;
    date: string;
    value: number;
    expected: number;
    deviationPercent: number;
    severity: 'warning' | 'critical';
}

interface ISummaryResponse {
    kpis: IKPIResult[];
    channelBreakdown: IChannelRow[];
    totalSpend: number;
    totalImpressions: number;
    totalClicks: number;
    totalConversions: number;
    totalRevenue: number;
    averageCtr: number;
    averageCpc: number;
    averageCpa: number;
    overallRoas: number;
    periodDays: number;
}

interface IAIInsight {
    title: string;
    summary: string;
    recommendation: string;
    confidence: number;
    metrics: Record<string, number | null>;
}

interface ICampaignPerformanceRow {
    campaignId: string;
    campaignName: string;
    channel: string;
    spend: number;
    impressions: number;
    clicks: number;
    conversions: number;
    revenue: number;
    ctr: number;
    cpc: number;
    cpa: number;
    roas: number;
    status: 'active' | 'paused' | 'completed';
    dailyTrend: number[];  // 7-day spend trend for sparkline
}

// ---------------------------------------------------------------------------
// Label mappings
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

// ---------------------------------------------------------------------------
// Service
// ---------------------------------------------------------------------------

export class MarketingMetricsService {
    private static instance: MarketingMetricsService;
    private constructor() {}

    public static getInstance(): MarketingMetricsService {
        if (!MarketingMetricsService.instance) {
            MarketingMetricsService.instance = new MarketingMetricsService();
        }
        return MarketingMetricsService.instance;
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

    // -----------------------------------------------------------------------
    // Column Discovery
    // -----------------------------------------------------------------------

    /**
     * Discover KPI, dimension, and date columns from a data model's table metadata.
     * Uses MarketingKPIMatcher to classify each column.
     */
    private async discoverColumns(dataModelId: number): Promise<IDiscoveredColumns[]> {
        const manager = await this.getManager();
        const kpiMatcher = MarketingKPIMatcher.getInstance();

        // Get data model sources to find data_source_ids
        const dmSourceRepo = this.getDataModelSourceRepo();
        const dmSources = await dmSourceRepo.find({
            where: { data_model_id: dataModelId },
        });

        if (!dmSources || dmSources.length === 0) {
            throw new Error(`No data model sources found for data model ${dataModelId}`);
        }

        const dataSourceIds = dmSources.map(s => s.data_source_id);

        // Get table metadata for these data sources
        const tableRepo = this.getTableMetadataRepo();
        const tables = await tableRepo.find({
            where: dataSourceIds.map(id => ({ data_source_id: id })),
        });

        // Deduplicate by schema.physical_table_name
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
            // Query information_schema.columns for column details
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
    // Marketing Summary
    // -----------------------------------------------------------------------

    /**
     * Aggregate marketing KPIs for a data model within a date range.
     */
    public async getMarketingSummary(
        dataModelId: number,
        startDate: Date,
        endDate: Date,
    ): Promise<ISummaryResponse> {
        const manager = await this.getManager();
        const discoveredTables = await this.discoverColumns(dataModelId);

        if (discoveredTables.length === 0) {
            return this.emptySummary();
        }

        const aggregatedKPIs: Record<string, number> = { ...DEFAULT_KPI_VALUES };
        const channelBreakdown: IChannelRow[] = [];
        let hasData = false;

        for (const table of discoveredTables) {
            const sumParts: string[] = [];
            const params: any[] = [startDate.toISOString(), endDate.toISOString()];
            let paramIdx = 3;

            for (const [kpi, colName] of table.kpiColumns) {
                sumParts.push(`COALESCE(SUM("${colName}"), 0) AS "${kpi}"`);
            }

            if (sumParts.length === 0) continue;

            // Find a channel/source dimension if present
            const channelCol = table.dimensionColumns.get('channel') 
                || table.dimensionColumns.get('source') 
                || table.dimensionColumns.get('platform')
                || null;

            const campaignCol = table.dimensionColumns.get('campaign') || null;

            // Aggregate totals query
            let totalQuery = `SELECT ${sumParts.join(', ')} FROM ${table.fullTableName}`;
            const whereClauses: string[] = [];

            if (table.dateColumn) {
                whereClauses.push(`"${table.dateColumn}" BETWEEN $1 AND $2`);
            }
            if (whereClauses.length > 0) {
                totalQuery += ` WHERE ${whereClauses.join(' AND ')}`;
            }

            try {
                const [totals] = await manager.query(totalQuery, params);
                if (totals) {
                    hasData = true;
                    for (const kpi of Object.keys(aggregatedKPIs)) {
                        if (totals[kpi] !== undefined && totals[kpi] !== null) {
                            aggregatedKPIs[kpi] += Number(totals[kpi]);
                        }
                    }
                }
            } catch (err) {
                console.warn(`[MarketingMetricsService] Query failed for table ${table.tableName}:`, err);
                continue;
            }

            // Channel breakdown if a channel dimension exists
            if (channelCol) {
                const channelSelectParts: string[] = [`"${channelCol}" AS channel`];
                for (const [kpi, colName] of table.kpiColumns) {
                    channelSelectParts.push(`COALESCE(SUM("${colName}"), 0) AS "${kpi}"`);
                }

                let channelQuery = `SELECT ${channelSelectParts.join(', ')} FROM ${table.fullTableName}`;
                const channelWhere: string[] = [];
                const channelParams: any[] = [startDate.toISOString(), endDate.toISOString()];

                if (table.dateColumn) {
                    channelWhere.push(`"${table.dateColumn}" BETWEEN $1 AND $2`);
                }
                if (channelWhere.length > 0) {
                    channelQuery += ` WHERE ${channelWhere.join(' AND ')}`;
                }
                channelQuery += ` GROUP BY "${channelCol}"`;

                try {
                    const rows = await manager.query(channelQuery, channelParams);
                    for (const row of rows) {
                        const spend = Number(row.spend || 0);
                        const impressions = Number(row.impressions || 0);
                        const clicks = Number(row.clicks || 0);
                        const conversions = Number(row.conversions || 0);
                        const revenue = Number(row.revenue || 0);

                        channelBreakdown.push({
                            channel: String(row.channel || 'Unknown'),
                            spend,
                            impressions,
                            clicks,
                            conversions,
                            revenue,
                            ctr: impressions > 0 ? (clicks / impressions) * 100 : 0,
                            cpc: clicks > 0 ? spend / clicks : 0,
                            cpa: conversions > 0 ? spend / conversions : 0,
                            roas: spend > 0 ? revenue / spend : 0,
                        });
                    }
                } catch (err) {
                    console.warn(`[MarketingMetricsService] Channel query failed for table ${table.tableName}:`, err);
                }
            }
        }

        // Compute derived metrics
        const totalSpend = aggregatedKPIs.spend || 0;
        const totalImpressions = aggregatedKPIs.impressions || 0;
        const totalClicks = aggregatedKPIs.clicks || 0;
        const totalConversions = aggregatedKPIs.conversions || 0;
        const totalRevenue = aggregatedKPIs.revenue || 0;

        const averageCtr = totalImpressions > 0 ? (totalClicks / totalImpressions) * 100 : 0;
        const averageCpc = totalClicks > 0 ? totalSpend / totalClicks : 0;
        const averageCpa = totalConversions > 0 ? totalSpend / totalConversions : 0;
        const overallRoas = totalSpend > 0 ? totalRevenue / totalSpend : 0;

        // Build KPI results with period-over-period comparison
        const periodMs = endDate.getTime() - startDate.getTime();
        const priorStart = new Date(startDate.getTime() - periodMs);
        const priorEnd = new Date(startDate.getTime() - 86_400_000);

        let priorKPIs: Record<string, number> = { ...DEFAULT_KPI_VALUES };
        try {
            priorKPIs = await this.fetchAggregatedKPIs(manager, discoveredTables, priorStart, priorEnd);
        } catch {
            // Prior period data unavailable — continue with zeros
        }

        const kpis: IKPIResult[] = [];
        for (const [kpi, currentVal] of Object.entries(aggregatedKPIs)) {
            const prevVal = priorKPIs[kpi] ?? 0;
            const changePercent = prevVal > 0 ? ((currentVal - prevVal) / prevVal) * 100 : null;

            kpis.push({
                kpi,
                label: KPI_LABELS[kpi] || kpi,
                current: currentVal,
                previous: prevVal,
                changePercent,
            });
        }

        const periodDays = Math.ceil((endDate.getTime() - startDate.getTime()) / 86_400_000);

        return {
            kpis: kpis.filter(k => (k.current ?? 0) > 0 || (k.previous ?? 0) > 0),
            channelBreakdown,
            totalSpend,
            totalImpressions,
            totalClicks,
            totalConversions,
            totalRevenue,
            averageCtr,
            averageCpc,
            averageCpa,
            overallRoas,
            periodDays,
        };
    }

    // -----------------------------------------------------------------------
    // Cross-Channel Comparison
    // -----------------------------------------------------------------------

    /**
     * Cross-channel comparison for a data model. Returns per-channel metrics.
     */
    public async getChannelComparison(
        dataModelId: number,
        startDate: Date,
        endDate: Date,
    ): Promise<IChannelRow[]> {
        const summary = await this.getMarketingSummary(dataModelId, startDate, endDate);
        return summary.channelBreakdown;
    }

    // -----------------------------------------------------------------------
    // Period-over-Period Comparison
    // -----------------------------------------------------------------------

    /**
     * Compare current period vs previous period for a data model.
     */
    public async getPeriodComparison(
        dataModelId: number,
        currentStart: Date,
        currentEnd: Date,
        priorStart: Date,
        priorEnd: Date,
    ): Promise<IPeriodComparison> {
        const manager = await this.getManager();
        const discoveredTables = await this.discoverColumns(dataModelId);

        const current = await this.fetchAggregatedKPIs(manager, discoveredTables, currentStart, currentEnd);
        const previous = await this.fetchAggregatedKPIs(manager, discoveredTables, priorStart, priorEnd);

        const changePercents: Record<string, number | null> = {};
        const kpis: IKPIResult[] = [];

        for (const kpi of Object.keys(current)) {
            const cur = current[kpi] ?? 0;
            const prev = previous[kpi] ?? 0;
            changePercents[kpi] = prev > 0 ? ((cur - prev) / prev) * 100 : null;

            kpis.push({
                kpi,
                label: KPI_LABELS[kpi] || kpi,
                current: cur,
                previous: prev,
                changePercent: changePercents[kpi],
            });
        }

        return { current, previous, changePercents, kpis };
    }

    // -----------------------------------------------------------------------
    // Campaign-Level Drill-Down
    // -----------------------------------------------------------------------

    /**
     * Drill-down into a specific campaign. Returns daily KPIs and campaign info.
     */
    public async getCampaignDetail(
        dataModelId: number,
        campaignId: string,
        startDate: Date,
        endDate: Date,
    ): Promise<ICampaignDetail> {
        const manager = await this.getManager();
        const discoveredTables = await this.discoverColumns(dataModelId);

        const result: ICampaignDetail = {
            campaignId,
            campaignName: campaignId,
            channel: 'Unknown',
            kpis: {},
            dailyTrend: [],
        };

        for (const table of discoveredTables) {
            const campaignCol = table.dimensionColumns.get('campaign') || null;
            if (!campaignCol || !table.dateColumn) continue;

            const channelCol = table.dimensionColumns.get('channel')
                || table.dimensionColumns.get('source')
                || table.dimensionColumns.get('platform')
                || null;

            // Build KPI select
            const kpiSelectParts: string[] = [];
            for (const [kpi, colName] of table.kpiColumns) {
                kpiSelectParts.push(`COALESCE(SUM("${colName}"), 0) AS "${kpi}"`);
            }
            if (kpiSelectParts.length === 0) continue;

            // Fetch campaign overview
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
                    for (const [kpi] of table.kpiColumns) {
                        if (first[kpi] !== undefined) {
                            result.kpis[kpi] = Number(first[kpi]);
                        }
                    }
                    if (channelCol && first.channel) {
                        result.channel = String(first.channel);
                    }
                }
            } catch (err) {
                console.warn(`[MarketingMetricsService] Campaign overview query failed:`, err);
            }

            // Fetch daily trend
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
                    const entry: any = { date: String(row.date) };
                    for (const [kpi] of table.kpiColumns) {
                        if (row[kpi] !== undefined) {
                            entry[kpi] = Number(row[kpi]);
                        }
                    }
                    return entry;
                });
            } catch (err) {
                console.warn(`[MarketingMetricsService] Daily trend query failed:`, err);
            }
        }

        return result;
    }

    // -----------------------------------------------------------------------
    // Anomaly Detection
    // -----------------------------------------------------------------------

    /**
     * Detect anomalies by comparing current values against 4-week rolling average.
     * Flags deviations exceeding the given threshold (default 20%).
     */
    public async getAnomalies(
        dataModelId: number,
        startDate: Date,
        endDate: Date,
        threshold = 20,
    ): Promise<IAnomaly[]> {
        const manager = await this.getManager();
        const discoveredTables = await this.discoverColumns(dataModelId);
        const anomalies: IAnomaly[] = [];

        // Calculate 4-week rolling average (28 days before start)
        const rollingStart = new Date(startDate.getTime() - 28 * 86_400_000);
        const rollingEnd = new Date(startDate.getTime() - 86_400_000);

        for (const table of discoveredTables) {
            if (!table.dateColumn) continue;

            for (const [kpi, colName] of table.kpiColumns) {
                // Skip derived KPIs — only check raw aggregatable ones
                if (!['spend', 'impressions', 'clicks', 'conversions', 'revenue', 'leads',
                    'engagement', 'opens', 'sends', 'traffic', 'shares', 'likes', 'comments',
                    'video_views', 'reach', 'bounces', 'unsubscribes'].includes(kpi)) continue;

                // Get daily values for the current period
                const currentQuery = `
                    SELECT DATE("${table.dateColumn}") AS date,
                           COALESCE(SUM("${colName}"), 0) AS value
                    FROM ${table.fullTableName}
                    WHERE "${table.dateColumn}" BETWEEN $1 AND $2
                    GROUP BY DATE("${table.dateColumn}")
                    ORDER BY date ASC
                `;

                // Get rolling average
                const rollingQuery = `
                    SELECT COALESCE(AVG(daily_sum), 0) AS avg_value,
                           COALESCE(STDDEV(daily_sum), 0) AS std_value
                    FROM (
                        SELECT DATE("${table.dateColumn}") AS d, SUM("${colName}") AS daily_sum
                        FROM ${table.fullTableName}
                        WHERE "${table.dateColumn}" BETWEEN $1 AND $2
                        GROUP BY DATE("${table.dateColumn}")
                    ) sub
                `;

                try {
                    const [rollingStats] = await manager.query(rollingQuery, [
                        rollingStart.toISOString(), rollingEnd.toISOString(),
                    ]);

                    const rollingAvg = Number(rollingStats?.avg_value || 0);
                    const rollingStd = Number(rollingStats?.std_value || 0);

                    if (rollingAvg === 0) continue;

                    const currentRows = await manager.query(currentQuery, [
                        startDate.toISOString(), endDate.toISOString(),
                    ]);

                    for (const row of currentRows) {
                        const value = Number(row.value);
                        const deviation = ((value - rollingAvg) / rollingAvg) * 100;

                        if (Math.abs(deviation) > threshold) {
                            anomalies.push({
                                metric: KPI_LABELS[kpi] || kpi,
                                date: String(row.date),
                                value,
                                expected: rollingAvg,
                                deviationPercent: deviation,
                                severity: Math.abs(deviation) > threshold * 2 ? 'critical' : 'warning',
                            });
                        }
                    }
                } catch (err) {
                    console.warn(`[MarketingMetricsService] Anomaly query failed for ${kpi} on ${table.tableName}:`, err);
                }
            }
        }

        // Sort by severity then deviation magnitude
        anomalies.sort((a, b) => {
            if (a.severity !== b.severity) return a.severity === 'critical' ? -1 : 1;
            return Math.abs(b.deviationPercent) - Math.abs(a.severity === a.severity ? a.deviationPercent : b.deviationPercent);
        });

        return anomalies;
    }

    // -----------------------------------------------------------------------
    // Campaign Performance List
    // -----------------------------------------------------------------------

    /**
     * Get a paginated list of campaigns with aggregated KPIs, status, and 7-day spend trend.
     * Used by the Campaign Performance Table (MKT-004).
     */
    public async getCampaignPerformanceList(
        dataModelId: number,
        startDate: Date,
        endDate: Date,
        options: {
            search?: string;
            channel?: string;
            status?: string;
            sortBy?: string;
            sortDir?: 'asc' | 'desc';
            page?: number;
            pageSize?: number;
        } = {},
    ): Promise<{ rows: ICampaignPerformanceRow[]; total: number }> {
        const manager = await this.getManager();
        const discoveredTables = await this.discoverColumns(dataModelId);

        const {
            search = '',
            channel = '',
            status = '',
            sortBy = 'spend',
            sortDir = 'desc',
            page = 1,
            pageSize = 20,
        } = options;

        const allRows: ICampaignPerformanceRow[] = [];

        for (const table of discoveredTables) {
            const campaignCol = table.dimensionColumns.get('campaign') || null;
            if (!campaignCol || !table.dateColumn) continue;

            const channelCol = table.dimensionColumns.get('channel')
                || table.dimensionColumns.get('source')
                || table.dimensionColumns.get('platform')
                || null;

            // Build KPI select parts
            const kpiSelectParts: string[] = [];
            for (const [kpi, colName] of table.kpiColumns) {
                kpiSelectParts.push(`COALESCE(SUM("${colName}"), 0) AS "${kpi}"`);
            }
            if (kpiSelectParts.length === 0) continue;

            // Main aggregation query grouped by campaign
            const selectParts: string[] = [
                `"${campaignCol}" AS "campaignId"`,
                `"${campaignCol}" AS "campaignName"`,
                ...kpiSelectParts,
            ];
            if (channelCol) {
                selectParts.push(`MIN("${channelCol}") AS "channel"`);
            }

            let query = `SELECT ${selectParts.join(', ')} FROM ${table.fullTableName}`;
            const params: any[] = [startDate.toISOString(), endDate.toISOString()];
            const whereClauses: string[] = [
                `"${table.dateColumn}" BETWEEN $1 AND $2`,
            ];

            query += ` WHERE ${whereClauses.join(' AND ')}`;
            query += ` GROUP BY "${campaignCol}"`;

            try {
                const rows = await manager.query(query, params);

                for (const row of rows) {
                    const spend = Number(row.spend || 0);
                    const impressions = Number(row.impressions || 0);
                    const clicks = Number(row.clicks || 0);
                    const conversions = Number(row.conversions || 0);
                    const revenue = Number(row.revenue || 0);

                    allRows.push({
                        campaignId: String(row.campaignId || ''),
                        campaignName: String(row.campaignName || row.campaignId || 'Unknown'),
                        channel: channelCol ? String(row.channel || 'Unknown') : 'Unknown',
                        spend,
                        impressions,
                        clicks,
                        conversions,
                        revenue,
                        ctr: impressions > 0 ? (clicks / impressions) * 100 : 0,
                        cpc: clicks > 0 ? spend / clicks : 0,
                        cpa: conversions > 0 ? spend / conversions : 0,
                        roas: spend > 0 ? revenue / spend : 0,
                        status: 'active', // Default; refined below
                        dailyTrend: [],    // Fetched below
                    });
                }
            } catch (err) {
                console.warn(`[MarketingMetricsService] Campaign list query failed for table ${table.tableName}:`, err);
            }
        }

        // Enrich each campaign with status and 7-day spend trend
        for (const campaign of allRows) {
            // Determine status from recent activity
            const campaignCol = discoveredTables[0]?.dimensionColumns.get('campaign');
            const dateCol = discoveredTables[0]?.dateColumn;
            const spendCol = discoveredTables[0]?.kpiColumns.get('spend');

            if (campaignCol && dateCol && spendCol && discoveredTables[0]) {
                const tableName = discoveredTables[0].fullTableName;

                // Check last 7 days for activity
                const recentStart = new Date(endDate.getTime() - 7 * 86_400_000);
                try {
                    const recentQuery = `
                        SELECT COUNT(*) AS cnt
                        FROM ${tableName}
                        WHERE "${campaignCol}" = $1
                          AND "${dateCol}" BETWEEN $2 AND $3
                    `;
                    const [recentResult] = await manager.query(recentQuery, [
                        campaign.campaignId, recentStart.toISOString(), endDate.toISOString(),
                    ]);
                    const cnt = Number(recentResult?.cnt || 0);
                    campaign.status = cnt > 0 ? 'active' : 'completed';
                } catch {
                    campaign.status = 'active';
                }

                // Get 7-day spend trend (last 7 days from endDate)
                try {
                    const trendQuery = `
                        SELECT DATE("${dateCol}") AS date, COALESCE(SUM("${spendCol}"), 0) AS value
                        FROM ${tableName}
                        WHERE "${campaignCol}" = $1
                          AND "${dateCol}" BETWEEN $2 AND $3
                        GROUP BY DATE("${dateCol}")
                        ORDER BY date ASC
                    `;
                    const trendStart = new Date(endDate.getTime() - 6 * 86_400_000);
                    const trendRows = await manager.query(trendQuery, [
                        campaign.campaignId, trendStart.toISOString(), endDate.toISOString(),
                    ]);
                    campaign.dailyTrend = trendRows.map((r: any) => Number(r.value || 0));
                } catch {
                    campaign.dailyTrend = [];
                }
            }
        }

        // Apply filters
        let filtered = allRows;

        if (search) {
            const q = search.toLowerCase();
            filtered = filtered.filter(r =>
                r.campaignName.toLowerCase().includes(q) ||
                r.campaignId.toLowerCase().includes(q)
            );
        }
        if (channel) {
            filtered = filtered.filter(r => r.channel.toLowerCase() === channel.toLowerCase());
        }
        if (status) {
            filtered = filtered.filter(r => r.status === status);
        }

        // Apply sorting
        const sortKey = sortBy as keyof ICampaignPerformanceRow;
        filtered.sort((a, b) => {
            const aVal = (a as any)[sortKey] ?? 0;
            const bVal = (b as any)[sortKey] ?? 0;
            if (typeof aVal === 'string' && typeof bVal === 'string') {
                return sortDir === 'asc' ? aVal.localeCompare(bVal) : bVal.localeCompare(aVal);
            }
            return sortDir === 'asc' ? aVal - bVal : bVal - aVal;
        });

        const total = filtered.length;
        const startIdx = (page - 1) * pageSize;
        const paginatedRows = filtered.slice(startIdx, startIdx + pageSize);

        return { rows: paginatedRows, total };
    }

    // -----------------------------------------------------------------------
    // AI-Enhanced Insights
    // -----------------------------------------------------------------------

    /**
     * Generate AI-powered marketing insights using Gemini.
     */
    public async generateAIInsights(
        dataModelId: number,
        startDate: Date,
        endDate: Date,
    ): Promise<IAIInsight[]> {
        try {
            const summary = await this.getMarketingSummary(dataModelId, startDate, endDate);
            const anomalies = await this.getAnomalies(dataModelId, startDate, endDate);

            const prompt = `Analyze the following marketing performance data and provide actionable insights.

## Summary Metrics
- Total Spend: $${summary.totalSpend.toFixed(2)}
- Total Impressions: ${summary.totalImpressions.toLocaleString()}
- Total Clicks: ${summary.totalClicks.toLocaleString()}
- Total Conversions: ${summary.totalConversions.toLocaleString()}
- Total Revenue: $${summary.totalRevenue.toFixed(2)}
- Average CTR: ${summary.averageCtr.toFixed(2)}%
- Average CPC: $${summary.averageCpc.toFixed(2)}
- Average CPA: $${summary.averageCpa.toFixed(2)}
- Overall ROAS: ${summary.overallRoas.toFixed(2)}x
- Period: ${summary.periodDays} days

## Channel Breakdown
${summary.channelBreakdown.map(ch =>
    `- ${ch.channel}: Spend $${ch.spend.toFixed(2)}, CTR ${ch.ctr.toFixed(2)}%, CPA $${ch.cpa.toFixed(2)}, ROAS ${ch.roas.toFixed(2)}x`
).join('\n')}

## Period-over-Period Changes
${summary.kpis.map(k =>
    `- ${k.label}: ${k.current} vs ${k.previous} (${k.changePercent !== null ? k.changePercent.toFixed(1) + '%' : 'N/A'})`
).join('\n')}

## Detected Anomalies
${anomalies.length > 0 ? anomalies.map(a =>
    `- ${a.metric} on ${a.date}: ${a.value} (expected ~${a.expected.toFixed(0)}, ${a.deviationPercent > 0 ? '+' : ''}${a.deviationPercent.toFixed(1)}% deviation, ${a.severity})`
).join('\n') : 'No anomalies detected.'}

Provide exactly 3-5 insights as a JSON array. Each insight must have: title, summary, recommendation, confidence (0-1), and metrics (object with relevant numbers).
Return ONLY valid JSON, no markdown fences.`;

            const gemini = new GeminiService();
            const conversationId = `mkt-insights-${dataModelId}-${Date.now()}`;
            await gemini.initializeConversation(conversationId, 'You are a marketing analytics expert. Analyze marketing performance data and provide actionable insights. Always respond with valid JSON when requested.');
            const response = await gemini.sendMessage(conversationId, prompt);

            // Parse AI response
            const cleaned = response.replace(/```json?\s*/gi, '').replace(/```/g, '').trim();
            try {
                const insights = JSON.parse(cleaned);
                if (Array.isArray(insights)) {
                    return insights as IAIInsight[];
                }
            } catch {
                // If parsing fails, return a single insight with the raw text
            }

            return [{
                title: 'Marketing Analysis',
                summary: response.substring(0, 500),
                recommendation: 'Review the detailed analysis for actionable recommendations.',
                confidence: 0.7,
                metrics: { totalSpend: summary.totalSpend, roas: summary.overallRoas },
            }];
        } catch (err) {
            console.error('[MarketingMetricsService] AI insights generation failed:', err);
            return [{
                title: 'Insights Unavailable',
                summary: 'Unable to generate AI insights at this time.',
                recommendation: 'Ensure Gemini API key is configured and try again.',
                confidence: 0,
                metrics: {},
            }];
        }
    }

    // -----------------------------------------------------------------------
    // Private Helpers
    // -----------------------------------------------------------------------

    /**
     * Fetch aggregated KPIs for discovered tables within a date range.
     */
    private async fetchAggregatedKPIs(
        manager: any,
        discoveredTables: IDiscoveredColumns[],
        startDate: Date,
        endDate: Date,
    ): Promise<Record<string, number>> {
        const result: Record<string, number> = { ...DEFAULT_KPI_VALUES };

        for (const table of discoveredTables) {
            const sumParts: string[] = [];
            for (const [kpi, colName] of table.kpiColumns) {
                sumParts.push(`COALESCE(SUM("${colName}"), 0) AS "${kpi}"`);
            }
            if (sumParts.length === 0) continue;

            let query = `SELECT ${sumParts.join(', ')} FROM ${table.fullTableName}`;
            const params: any[] = [startDate.toISOString(), endDate.toISOString()];

            if (table.dateColumn) {
                query += ` WHERE "${table.dateColumn}" BETWEEN $1 AND $2`;
            }

            try {
                const [totals] = await manager.query(query, params);
                if (totals) {
                    for (const kpi of Object.keys(result)) {
                        if (totals[kpi] !== undefined && totals[kpi] !== null) {
                            result[kpi] += Number(totals[kpi]);
                        }
                    }
                }
            } catch (err) {
                console.warn(`[MarketingMetricsService] fetchAggregatedKPIs failed for ${table.tableName}:`, err);
            }
        }

        return result;
    }

    private emptySummary(): ISummaryResponse {
        return {
            kpis: [],
            channelBreakdown: [],
            totalSpend: 0,
            totalImpressions: 0,
            totalClicks: 0,
            totalConversions: 0,
            totalRevenue: 0,
            averageCtr: 0,
            averageCpc: 0,
            averageCpa: 0,
            overallRoas: 0,
            periodDays: 0,
        };
    }
}

export default MarketingMetricsService;