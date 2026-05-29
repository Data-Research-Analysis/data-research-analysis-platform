/**
 * Auto-Dashboard Generation Service (DASH-001)
 *
 * Automatically generates dashboards with pre-configured chart widgets
 * when a marketing data source is connected and a data model is created.
 *
 * Generates the following dashboards based on detected columns:
 *   - Performance Overview: Spend/Conversions/ROAS/CPA trends + KPI cards
 *   - Channel Breakdown: Pie/bar charts by channel dimension
 *   - Campaign Performance: Top campaigns by spend, CPA comparison
 *   - Time Analysis: Daily/weekly/monthly trends, WoW/MoM comparison
 */

import { AppDataSource } from '../datasources/PostgresDS.js';
import { DRADataModel } from '../models/DRADataModel.js';
import { DRADataSource } from '../models/DRADataSource.js';
import { DRADataModelSource } from '../models/DRADataModelSource.js';
import { DRAProject } from '../models/DRAProject.js';
import { DRAUsersPlatform } from '../models/DRAUsersPlatform.js';
import { DRADashboard } from '../models/DRADashboard.js';
import {
    IDashboardChart,
    IDashboardDataStructure,
    ChartType,
} from '../types/IDashboard.js';
import { IColumn } from '../types/IColumn.js';
import { IDimension } from '../types/IDimension.js';
import { ILocation } from '../types/ILocation.js';
import {
    SchemaAutoDetectionService,
} from './SchemaAutoDetectionService.js';
import {
    ISchemaDetectionResult,
    IDetectedTable,
    IDetectedColumn,
} from './detection/ISchemaDetectionResult.js';

// ─── Column Pattern Definitions ──────────────────────────────────────────────

const KPI_COLUMN_PATTERNS: Record<string, RegExp[]> = {
    spend: [/spend/i, /cost(?!_per)/i, /cost_micros/i, /amount_spent/i, /budget/i, /ad_spend/i],
    impressions: [/impressions?/i, /impr/i],
    clicks: [/clicks?/i, /click_count/i],
    conversions: [/conversions?/i, /leads?/i, /purchases?/i, /signups?/i, /transactions?/i],
    revenue: [/revenue/i, /conversion_value/i, /purchase_value/i, /sales_amount/i, /income/i],
};

const DIMENSION_COLUMN_PATTERNS: Record<string, RegExp[]> = {
    campaign: [/campaign_name/i, /campaign$/i, /campaign_id/i, /campaign/i],
    ad_group: [/ad_group/i, /adset/i, /ad_set/i],
    channel: [/channel/i, /platform/i, /source/i, /medium/i],
    keyword: [/keyword/i, /search_term/i],
    device: [/device/i, /device_type/i],
    geo: [/country/i, /region/i, /city/i, /geo/i, /location/i],
};

const TIME_COLUMN_PATTERNS: RegExp[] = [
    /^date$/i, /^day$/i, /^week$/i, /^month$/i, /^year$/i,
    /^date_day$/i, /^report_date$/i, /^campaign_date$/i,
    /_date$/i, /^created_at$/i, /^updated_at$/i,
    /date/i, /timestamp/i, /^time$/i,
];

// ─── Interfaces ──────────────────────────────────────────────────────────────

interface IDetectedColumnInfo {
    name: string;
    role: 'metric' | 'dimension' | 'time';
    kpiKey?: string;
    dimensionKey?: string;
}

interface IDashboardGenerationResult {
    dashboard_id: number;
    dashboard_name: string;
    dashboard_type: string;
    chart_count: number;
    charts: Array<{
        chart_id: number;
        chart_type: string;
        title: string;
    }>;
}

interface IAutoGenerateOptions {
    data_model_id: number;
    users_platform_id: number;
    project_id: number;
}

interface IChartConfig {
    title: string;
    chartType: ChartType;
    metricColumns: string[];
    dimensionColumn?: string;
    timeColumn?: string;
    aggregation: 'SUM' | 'AVG' | 'COUNT';
    sortBy?: string;
    sortOrder?: 'ASC' | 'DESC';
    limit?: number;
    sql: string;
    xAxis: string | null;
    yAxis: string | null;
}

interface IDashboardConfig {
    name: string;
    type: string;
    charts: IChartConfig[];
}

// ─── Service Implementation ──────────────────────────────────────────────────

export class DashboardAutoGenerationService {
    private static instance: DashboardAutoGenerationService;

    private constructor() {}

    /**
     * Sanitize a SQL identifier (table name, schema name, column name) to prevent SQL injection.
     * Only allows alphanumeric characters, underscores, and dots (for schema.table patterns).
     * Strips everything else and rejects empty results.
     */
    private sanitizeSqlIdentifier(identifier: string): string {
        const sanitized = identifier.replace(/[^a-zA-Z0-9_.]/g, '');
        if (!sanitized || sanitized.length === 0) {
            throw new Error(`Invalid SQL identifier: "${identifier}"`);
        }
        return sanitized;
    }

    public static getInstance(): DashboardAutoGenerationService {
        if (!DashboardAutoGenerationService.instance) {
            DashboardAutoGenerationService.instance = new DashboardAutoGenerationService();
        }
        return DashboardAutoGenerationService.instance;
    }

    /**
     * Main entry point: Auto-generate dashboards for a data model.
     * Analyzes the data model's columns and generates appropriate marketing dashboards.
     */
    public async autoGenerate(options: IAutoGenerateOptions): Promise<IDashboardGenerationResult[]> {
        const { data_model_id, users_platform_id, project_id } = options;
        const manager = AppDataSource.manager;

        // Step 1: Load data model with relations
        const dataModel = await manager.findOne(DRADataModel, {
            where: { id: data_model_id },
            relations: ['data_source', 'data_model_sources', 'data_model_sources.data_source'],
        });

        if (!dataModel) {
            throw new Error(`Data model ${data_model_id} not found`);
        }

        // Step 2: Load project for multi-tenant fields
        const project = await manager.findOne(DRAProject, {
            where: { id: project_id },
        });

        if (!project) {
            throw new Error(`Project ${project_id} not found`);
        }

        const user = await manager.findOne(DRAUsersPlatform, {
            where: { id: users_platform_id },
        });

        if (!user) {
            throw new Error(`User ${users_platform_id} not found`);
        }

        // Step 3: Detect columns from the data model
        const detectedColumns = await this.detectColumns(dataModel);

        if (detectedColumns.length === 0) {
            console.log(`[DashboardAutoGeneration] No columns detected for data model ${data_model_id}, skipping dashboard generation`);
            return [];
        }

        // Step 4: Classify detected columns
        const classified = this.classifyColumns(detectedColumns);

        // Step 5: Check if this is marketing data — require at least one metric and one dimension/time
        const hasMetrics = classified.some(c => c.role === 'metric');
        const hasDimensionsOrTime = classified.some(c => c.role === 'dimension' || c.role === 'time');

        if (!hasMetrics) {
            console.log(`[DashboardAutoGeneration] No marketing metric columns detected for data model ${data_model_id}, skipping`);
            return [];
        }

        // Step 6: Determine which dashboards to generate
        const dashboardConfigs = this.planDashboards(classified, dataModel);

        if (dashboardConfigs.length === 0) {
            console.log(`[DashboardAutoGeneration] No applicable dashboards for data model ${data_model_id}`);
            return [];
        }

        // Step 7: Generate each dashboard
        const results: IDashboardGenerationResult[] = [];

        for (const config of dashboardConfigs) {
            try {
                const result = await this.createDashboard(
                    config,
                    dataModel,
                    project,
                    user,
                    classified
                );
                results.push(result);
            } catch (error: any) {
                console.error(
                    `[DashboardAutoGeneration] Failed to create "${config.name}" dashboard:`,
                    error.message
                );
            }
        }

        console.log(
            `[DashboardAutoGeneration] Generated ${results.length} dashboards for data model ${data_model_id}`
        );

        return results;
    }

    // ─── Column Detection ────────────────────────────────────────────────────

    /**
     * Detect columns from a data model by running schema detection on its data source,
     * or by parsing the SQL query as fallback.
     */
    private async detectColumns(dataModel: DRADataModel): Promise<IDetectedColumnInfo[]> {
        const columns: IDetectedColumnInfo[] = [];

        // Strategy 1: Use SchemaAutoDetectionService if data source is available
        if (dataModel.data_source?.id) {
            try {
                const detectionService = SchemaAutoDetectionService.getInstance();
                const result: ISchemaDetectionResult = await detectionService.detect({
                    source_type: dataModel.data_source.data_type,
                    data_source_id: dataModel.data_source.id,
                    include_row_estimates: false,
                });

                if (result.tables.length > 0) {
                    // Find the most relevant table (the one matching the data model's primary table)
                    const table = this.findRelevantTable(result.tables, dataModel);
                    if (table) {
                        for (const col of table.columns) {
                            columns.push({
                                name: col.column_name,
                                role: this.mapColumnRole(col),
                                kpiKey: col.kpi_match || undefined,
                                dimensionKey: col.dimension_match || undefined,
                            });
                        }
                        return columns;
                    }
                }
            } catch (error: any) {
                console.warn(
                    `[DashboardAutoGeneration] Schema detection failed for data model ${dataModel.id}, falling back to SQL parsing:`,
                    error.message
                );
            }
        }

        // Strategy 2: Parse columns from the SQL query
        return this.extractColumnsFromQuery(dataModel);
    }

    /**
     * Find the most relevant table from schema detection results that matches the data model.
     */
    private findRelevantTable(tables: IDetectedTable[], dataModel: DRADataModel): IDetectedTable | null {
        // Try to match by table name in SQL query
        const sqlLower = dataModel.sql_query?.toLowerCase() || '';

        for (const table of tables) {
            if (sqlLower.includes(table.table_name.toLowerCase())) {
                return table;
            }
        }

        // Fallback: prefer fact tables, then the table with the most columns
        const factTable = tables.find(t => t.classification === 'fact_table');
        if (factTable) return factTable;

        // Return the table with the most columns (likely the most relevant)
        return tables.reduce((best, current) =>
            current.columns.length > best.columns.length ? current : best,
            tables[0]
        );
    }

    /**
     * Map a detected column's role from schema detection to our internal role.
     */
    private mapColumnRole(col: IDetectedColumn): 'metric' | 'dimension' | 'time' {
        if (col.role === 'time' || col.role === 'fact') {
            // Check if it's actually a time column
            for (const pattern of TIME_COLUMN_PATTERNS) {
                if (pattern.test(col.column_name)) return 'time';
            }
            return col.role === 'fact' ? 'metric' : 'dimension';
        }
        if (col.role === 'dimension') return 'dimension';
        return 'dimension'; // default
    }

    /**
     * Extract column names from the data model's SQL query as a fallback.
     * Parses SELECT clause or uses the query JSONB structure.
     */
    private extractColumnsFromQuery(dataModel: DRADataModel): IDetectedColumnInfo[] {
        const columns: IDetectedColumnInfo[] = [];

        // Try the query JSONB structure first
        const query = dataModel.query as any;
        if (query?.select && Array.isArray(query.select)) {
            for (const sel of query.select) {
                if (sel.type === 'wildcard') {
                    // SELECT * — can't determine columns, return empty
                    return [];
                }
                const colName = sel.alias || sel.value || sel.column;
                if (colName) {
                    columns.push(this.classifySingleColumn(this.sanitizeSqlIdentifier(colName)));
                }
            }
            if (columns.length > 0) return columns;
        }

        // Fallback: parse SELECT clause from SQL
        const sql = dataModel.sql_query || '';
        const selectMatch = sql.match(/SELECT\s+(.+?)\s+FROM\s/is);
        if (!selectMatch) return [];

        const selectClause = selectMatch[1];
        if (selectClause.trim() === '*') return [];

        // Split by comma, handle expressions with aliases
        const parts = this.splitSelectClause(selectClause);
        for (const part of parts) {
            // Extract alias (AS alias_name) or use the column/expression itself
            const aliasMatch = part.match(/\bAS\s+["']?(\w+)["']?\s*$/i);
            const name = aliasMatch
                ? aliasMatch[1]
                : part.trim().replace(/["']/g, '').split('.').pop() || part.trim();

            if (name && name !== '*') {
                columns.push(this.classifySingleColumn(name));
            }
        }

        return columns;
    }

    /**
     * Split a SELECT clause by commas, respecting parentheses and quoted strings.
     */
    private splitSelectClause(clause: string): string[] {
        const parts: string[] = [];
        let depth = 0;
        let current = '';

        for (const char of clause) {
            if (char === '(') depth++;
            else if (char === ')') depth--;
            else if (char === ',' && depth === 0) {
                parts.push(current.trim());
                current = '';
                continue;
            }
            current += char;
        }
        if (current.trim()) parts.push(current.trim());

        return parts;
    }

    // ─── Column Classification ───────────────────────────────────────────────

    /**
     * Classify a single column name into metric, dimension, or time.
     */
    private classifySingleColumn(columnName: string): IDetectedColumnInfo {
        const name = columnName.toLowerCase().replace(/["']/g, '');

        // Check time columns first
        for (const pattern of TIME_COLUMN_PATTERNS) {
            if (pattern.test(name)) {
                return { name: columnName, role: 'time' };
            }
        }

        // Check KPI/metric columns
        for (const [kpiKey, patterns] of Object.entries(KPI_COLUMN_PATTERNS)) {
            for (const pattern of patterns) {
                if (pattern.test(name)) {
                    return { name: columnName, role: 'metric', kpiKey };
                }
            }
        }

        // Check dimension columns
        for (const [dimKey, patterns] of Object.entries(DIMENSION_COLUMN_PATTERNS)) {
            for (const pattern of patterns) {
                if (pattern.test(name)) {
                    return { name: columnName, role: 'dimension', dimensionKey: dimKey };
                }
            }
        }

        // Default to dimension for unrecognized columns
        return { name: columnName, role: 'dimension' };
    }

    /**
     * Classify an array of detected columns using pattern matching.
     */
    private classifyColumns(columns: IDetectedColumnInfo[]): IDetectedColumnInfo[] {
        return columns.map(col => {
            // If already classified with kpi/dimension match, keep it
            if (col.kpiKey || col.dimensionKey) return col;
            // Re-classify using pattern matching
            return this.classifySingleColumn(col.name);
        });
    }

    // ─── Dashboard Planning ──────────────────────────────────────────────────

    /**
     * Plan which dashboards to generate based on detected columns.
     */
    private planDashboards(
        columns: IDetectedColumnInfo[],
        dataModel: DRADataModel
    ): IDashboardConfig[] {
        const configs: IDashboardConfig[] = [];

        const metrics = columns.filter(c => c.role === 'metric');
        const dimensions = columns.filter(c => c.role === 'dimension');
        const timeColumns = columns.filter(c => c.role === 'time');

        const hasSpend = metrics.some(m => m.kpiKey === 'spend');
        const hasConversions = metrics.some(m => m.kpiKey === 'conversions');
        const hasClicks = metrics.some(m => m.kpiKey === 'clicks');
        const hasImpressions = metrics.some(m => m.kpiKey === 'impressions');
        const hasRevenue = metrics.some(m => m.kpiKey === 'revenue');
        const hasTime = timeColumns.length > 0;

        const campaignCol = dimensions.find(d => d.dimensionKey === 'campaign');
        const channelCol = dimensions.find(d => d.dimensionKey === 'channel');

        const tableName = this.getTableNameFromModel(dataModel);
        const schemaPrefix = this.getSchemaPrefix(dataModel);

        // 1. Performance Overview — always if spend + conversions detected
        if (hasSpend && hasConversions) {
            const charts: IChartConfig[] = [];

            // Spend trend (line chart, daily)
            if (hasTime) {
                charts.push({
                    title: 'Spend Trend',
                    chartType: 'multiline',
                    metricColumns: ['spend'],
                    timeColumn: timeColumns[0].name,
                    aggregation: 'SUM',
                    sql: `SELECT "${timeColumns[0].name}", SUM("${this.findActualColumn(metrics, 'spend')}") AS spend FROM ${schemaPrefix}"${tableName}" GROUP BY "${timeColumns[0].name}" ORDER BY "${timeColumns[0].name}"`,
                    xAxis: timeColumns[0].name,
                    yAxis: 'spend',
                });

                // Conversions trend
                charts.push({
                    title: 'Conversions Trend',
                    chartType: 'multiline',
                    metricColumns: ['conversions'],
                    timeColumn: timeColumns[0].name,
                    aggregation: 'SUM',
                    sql: `SELECT "${timeColumns[0].name}", SUM("${this.findActualColumn(metrics, 'conversions')}") AS conversions FROM ${schemaPrefix}"${tableName}" GROUP BY "${timeColumns[0].name}" ORDER BY "${timeColumns[0].name}"`,
                    xAxis: timeColumns[0].name,
                    yAxis: 'conversions',
                });

                // ROAS trend (if revenue available)
                if (hasRevenue) {
                    charts.push({
                        title: 'ROAS Trend',
                        chartType: 'multiline',
                        metricColumns: ['revenue', 'spend'],
                        timeColumn: timeColumns[0].name,
                        aggregation: 'SUM',
                        sql: `SELECT "${timeColumns[0].name}", CASE WHEN SUM("${this.findActualColumn(metrics, 'spend')}") > 0 THEN ROUND(SUM("${this.findActualColumn(metrics, 'revenue')}")::numeric / SUM("${this.findActualColumn(metrics, 'spend')}"), 2) ELSE 0 END AS roas FROM ${schemaPrefix}"${tableName}" GROUP BY "${timeColumns[0].name}" ORDER BY "${timeColumns[0].name}"`,
                        xAxis: timeColumns[0].name,
                        yAxis: 'roas',
                    });
                }

                // CPA trend
                charts.push({
                    title: 'CPA Trend',
                    chartType: 'multiline',
                    metricColumns: ['spend', 'conversions'],
                    timeColumn: timeColumns[0].name,
                    aggregation: 'SUM',
                    sql: `SELECT "${timeColumns[0].name}", CASE WHEN SUM("${this.findActualColumn(metrics, 'conversions')}") > 0 THEN ROUND(SUM("${this.findActualColumn(metrics, 'spend')}")::numeric / SUM("${this.findActualColumn(metrics, 'conversions')}"), 2) ELSE 0 END AS cpa FROM ${schemaPrefix}"${tableName}" GROUP BY "${timeColumns[0].name}" ORDER BY "${timeColumns[0].name}"`,
                    xAxis: timeColumns[0].name,
                    yAxis: 'cpa',
                });
            }

            // Total Spend KPI card
            charts.push({
                title: 'Total Spend',
                chartType: 'kpi_scorecard',
                metricColumns: ['spend'],
                aggregation: 'SUM',
                sql: `SELECT SUM("${this.findActualColumn(metrics, 'spend')}") AS total_spend FROM ${schemaPrefix}"${tableName}"`,
                xAxis: null,
                yAxis: 'total_spend',
            });

            // Total Conversions KPI card
            charts.push({
                title: 'Total Conversions',
                chartType: 'kpi_scorecard',
                metricColumns: ['conversions'],
                aggregation: 'SUM',
                sql: `SELECT SUM("${this.findActualColumn(metrics, 'conversions')}") AS total_conversions FROM ${schemaPrefix}"${tableName}"`,
                xAxis: null,
                yAxis: 'total_conversions',
            });

            configs.push({
                name: 'Performance Overview',
                type: 'performance_overview',
                charts,
            });
        }

        // 2. Channel Breakdown — if multi-channel data (channel dimension detected)
        if (channelCol && metrics.length > 0) {
            const charts: IChartConfig[] = [];
            const spendCol = this.findActualColumn(metrics, 'spend');
            const convCol = this.findActualColumn(metrics, 'conversions');
            const revCol = this.findActualColumn(metrics, 'revenue');

            // Spend by channel (pie chart)
            if (spendCol) {
                charts.push({
                    title: 'Spend by Channel',
                    chartType: 'pie',
                    metricColumns: ['spend'],
                    dimensionColumn: channelCol.name,
                    aggregation: 'SUM',
                    sql: `SELECT "${channelCol.name}", SUM("${spendCol}") AS spend FROM ${schemaPrefix}"${tableName}" GROUP BY "${channelCol.name}" ORDER BY spend DESC`,
                    xAxis: channelCol.name,
                    yAxis: 'spend',
                });
            }

            // Conversions by channel (bar chart)
            if (convCol) {
                charts.push({
                    title: 'Conversions by Channel',
                    chartType: 'vertical_bar',
                    metricColumns: ['conversions'],
                    dimensionColumn: channelCol.name,
                    aggregation: 'SUM',
                    sql: `SELECT "${channelCol.name}", SUM("${convCol}") AS conversions FROM ${schemaPrefix}"${tableName}" GROUP BY "${channelCol.name}" ORDER BY conversions DESC`,
                    xAxis: channelCol.name,
                    yAxis: 'conversions',
                });
            }

            // ROAS by channel (bar chart)
            if (spendCol && revCol) {
                charts.push({
                    title: 'ROAS by Channel',
                    chartType: 'vertical_bar',
                    metricColumns: ['revenue', 'spend'],
                    dimensionColumn: channelCol.name,
                    aggregation: 'SUM',
                    sql: `SELECT "${channelCol.name}", CASE WHEN SUM("${spendCol}") > 0 THEN ROUND(SUM("${revCol}")::numeric / SUM("${spendCol}"), 2) ELSE 0 END AS roas FROM ${schemaPrefix}"${tableName}" GROUP BY "${channelCol.name}" ORDER BY roas DESC`,
                    xAxis: channelCol.name,
                    yAxis: 'roas',
                });
            }

            if (charts.length > 0) {
                configs.push({
                    name: 'Channel Breakdown',
                    type: 'channel_breakdown',
                    charts,
                });
            }
        }

        // 3. Campaign Performance — if campaign_name column detected
        if (campaignCol && metrics.length > 0) {
            const charts: IChartConfig[] = [];
            const spendCol = this.findActualColumn(metrics, 'spend');
            const convCol = this.findActualColumn(metrics, 'conversions');

            // Top 10 campaigns by spend (horizontal bar)
            if (spendCol) {
                charts.push({
                    title: 'Top 10 Campaigns by Spend',
                    chartType: 'horizontal_bar',
                    metricColumns: ['spend'],
                    dimensionColumn: campaignCol.name,
                    aggregation: 'SUM',
                    sql: `SELECT "${campaignCol.name}", SUM("${spendCol}") AS spend FROM ${schemaPrefix}"${tableName}" GROUP BY "${campaignCol.name}" ORDER BY spend DESC LIMIT 10`,
                    xAxis: campaignCol.name,
                    yAxis: 'spend',
                    limit: 10,
                });
            }

            // Campaign CPA comparison (bar chart)
            if (spendCol && convCol) {
                charts.push({
                    title: 'Campaign CPA Comparison',
                    chartType: 'vertical_bar',
                    metricColumns: ['spend', 'conversions'],
                    dimensionColumn: campaignCol.name,
                    aggregation: 'SUM',
                    sql: `SELECT "${campaignCol.name}", CASE WHEN SUM("${convCol}") > 0 THEN ROUND(SUM("${spendCol}")::numeric / SUM("${convCol}"), 2) ELSE 0 END AS cpa FROM ${schemaPrefix}"${tableName}" GROUP BY "${campaignCol.name}" HAVING SUM("${convCol}") > 0 ORDER BY cpa ASC LIMIT 15`,
                    xAxis: campaignCol.name,
                    yAxis: 'cpa',
                    limit: 15,
                });
            }

            if (charts.length > 0) {
                configs.push({
                    name: 'Campaign Performance',
                    type: 'campaign_performance',
                    charts,
                });
            }
        }

        // 4. Time Analysis — if date column detected
        if (hasTime && metrics.length > 0) {
            const charts: IChartConfig[] = [];
            const timeCol = timeColumns[0].name;
            const spendCol = this.findActualColumn(metrics, 'spend');
            const convCol = this.findActualColumn(metrics, 'conversions');

            // Daily/weekly/monthly trends (line chart)
            if (spendCol) {
                charts.push({
                    title: 'Daily Spend & Conversions Trend',
                    chartType: 'multiline',
                    metricColumns: ['spend', 'conversions'],
                    timeColumn: timeCol,
                    aggregation: 'SUM',
                    sql: `SELECT "${timeCol}", SUM("${spendCol}") AS spend${convCol ? `, SUM("${convCol}") AS conversions` : ''} FROM ${schemaPrefix}"${tableName}" GROUP BY "${timeCol}" ORDER BY "${timeCol}"`,
                    xAxis: timeCol,
                    yAxis: 'spend',
                });
            }

            // WoW comparison (bar chart — week number vs metric)
            if (spendCol) {
                charts.push({
                    title: 'Week-over-Week Spend Comparison',
                    chartType: 'vertical_bar',
                    metricColumns: ['spend'],
                    timeColumn: timeCol,
                    aggregation: 'SUM',
                    sql: `SELECT DATE_TRUNC('week', "${timeCol}"::timestamp)::date AS week_start, SUM("${spendCol}") AS spend FROM ${schemaPrefix}"${tableName}" GROUP BY week_start ORDER BY week_start`,
                    xAxis: 'week_start',
                    yAxis: 'spend',
                });
            }

            // MoM comparison (bar chart — month vs metric)
            if (spendCol) {
                charts.push({
                    title: 'Month-over-Month Spend Comparison',
                    chartType: 'vertical_bar',
                    metricColumns: ['spend'],
                    timeColumn: timeCol,
                    aggregation: 'SUM',
                    sql: `SELECT DATE_TRUNC('month', "${timeCol}"::timestamp)::date AS month_start, SUM("${spendCol}") AS spend FROM ${schemaPrefix}"${tableName}" GROUP BY month_start ORDER BY month_start`,
                    xAxis: 'month_start',
                    yAxis: 'spend',
                });
            }

            if (charts.length > 0) {
                configs.push({
                    name: 'Time Analysis',
                    type: 'time_analysis',
                    charts,
                });
            }
        }

        return configs;
    }

    /**
     * Find the actual column name in the detected metrics for a given KPI key.
     */
    private findActualColumn(metrics: IDetectedColumnInfo[], kpiKey: string): string | null {
        const match = metrics.find(m => m.kpiKey === kpiKey);
        return match ? match.name : null;
    }

    /**
     * Extract the primary table name from the data model's SQL query.
     */
    private getTableNameFromModel(dataModel: DRADataModel): string {
        // Try query JSONB first
        const query = dataModel.query as any;
        if (query?.from?.value) {
            return this.sanitizeSqlIdentifier(query.from.value);
        }

        // Parse from SQL
        const sql = dataModel.sql_query || '';
        const fromMatch = sql.match(/FROM\s+(?:(?:"?(\w+)"?\.)?"?(\w+)"?)/i);
        if (fromMatch) {
            return fromMatch[2] || fromMatch[1];
        }

        // Fallback to data model name
        return this.sanitizeSqlIdentifier(dataModel.name.replace(/\s*\(auto\)\s*/i, '').trim());
    }

    /**
     * Get the schema prefix for SQL queries.
     */
    private getSchemaPrefix(dataModel: DRADataModel): string {
        const query = dataModel.query as any;
        if (query?.from?.schema) {
            return `"${this.sanitizeSqlIdentifier(query.from.schema)}".`;
        }
        if (dataModel.schema && dataModel.schema !== 'public') {
            return `"${this.sanitizeSqlIdentifier(dataModel.schema)}".`;
        }
        return '';
    }

    // ─── Dashboard Creation ──────────────────────────────────────────────────

    /**
     * Create a dashboard with its configured chart widgets.
     */
    private async createDashboard(
        config: IDashboardConfig,
        dataModel: DRADataModel,
        project: DRAProject,
        user: DRAUsersPlatform,
        columns: IDetectedColumnInfo[]
    ): Promise<IDashboardGenerationResult> {
        const manager = AppDataSource.manager;

        // Build chart widgets
        const charts: IDashboardChart[] = config.charts.map((chartConfig, index) => {
            return this.buildChartWidget(chartConfig, index + 1, dataModel.id);
        });

        // Create the dashboard data structure
        const dashboardData: IDashboardDataStructure = { charts };

        // Create the dashboard entity
        const dashboard = new DRADashboard();
        dashboard.name = config.name;
        dashboard.data = dashboardData;
        dashboard.project = project;
        dashboard.users_platform = user;
        dashboard.is_template = false;
        // REQUIRED: Inherit organization_id and workspace_id from parent project
        dashboard.organization_id = project.organization_id;
        dashboard.workspace_id = project.workspace_id;

        const savedDashboard = await manager.save(DRADashboard, dashboard);

        console.log(
            `[DashboardAutoGeneration] Created dashboard "${config.name}" (ID: ${savedDashboard.id}) with ${charts.length} charts`
        );

        return {
            dashboard_id: savedDashboard.id,
            dashboard_name: config.name,
            dashboard_type: config.type,
            chart_count: charts.length,
            charts: charts.map(c => ({
                chart_id: c.chart_id,
                chart_type: c.chart_type,
                title: c.ai_chart_spec?.title || '',
            })),
        };
    }

    /**
     * Build a chart widget from a chart configuration.
     */
    private buildChartWidget(
        config: IChartConfig,
        chartId: number,
        dataModelId: number
    ): IDashboardChart {
        const chartType = config.chartType;

        // Determine dimensions based on chart type
        const dimensions = this.getChartDimensions(chartType);

        // Build columns array from metric columns
        const columns: IColumn[] = config.metricColumns.map(metric => ({
            columnName: metric,
            dataType: 'numeric',
            tableName: '',
            schema: '',
            aliasName: metric,
        }));

        // Build the chart
        const chart: IDashboardChart = {
            chart_id: chartId,
            chart_type: chartType,
            columns,
            data: [],
            dimensions,
            location: this.getChartLocation(chartId),
            x_axis_label: config.xAxis || undefined,
            y_axis_label: config.yAxis || undefined,
            source_type: 'ai_insights',
            ai_sql: config.sql,
            ai_chart_spec: {
                title: config.title,
                chart_type: this.mapToWidgetSpecType(chartType),
                sql: config.sql,
                x_axis: config.xAxis,
                y_axis: config.yAxis,
                description: `${config.title} — auto-generated from data model`,
            },
            created_by: null,
        };

        return chart;
    }

    /**
     * Get appropriate chart dimensions based on chart type.
     */
    private getChartDimensions(chartType: ChartType): IDimension {
        switch (chartType) {
            case 'kpi_scorecard':
                return { width: '3', height: '2', widthDraggable: 'true', heightDraggable: 'true' };
            case 'pie':
            case 'donut':
                return { width: '4', height: '4', widthDraggable: 'true', heightDraggable: 'true' };
            case 'horizontal_bar':
                return { width: '6', height: '5', widthDraggable: 'true', heightDraggable: 'true' };
            case 'multiline':
                return { width: '12', height: '4', widthDraggable: 'true', heightDraggable: 'true' };
            default:
                return { width: '6', height: '4', widthDraggable: 'true', heightDraggable: 'true' };
        }
    }

    /**
     * Get chart location (grid position) based on chart index.
     * Arranges charts in a 2-column grid.
     */
    private getChartLocation(chartId: number): ILocation {
        const row = Math.floor((chartId - 1) / 2);
        const col = (chartId - 1) % 2;
        return {
            top: String(row * 300),
            left: String(col * 50),
        };
    }

    /**
     * Map internal ChartType to IWidgetSpec chart_type.
     */
    private mapToWidgetSpecType(chartType: ChartType): 'bar' | 'line' | 'pie' | 'donut' | 'kpi' | 'table' | 'area' {
        switch (chartType) {
            case 'vertical_bar':
            case 'horizontal_bar':
            case 'stacked_bar':
                return 'bar';
            case 'multiline':
                return 'line';
            case 'pie':
                return 'pie';
            case 'donut':
                return 'donut';
            case 'kpi_scorecard':
                return 'kpi';
            case 'table':
            case 'channel_comparison_table':
                return 'table';
            default:
                return 'bar';
        }
    }
}
