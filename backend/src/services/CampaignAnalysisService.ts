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
import { DRADataSource } from '../models/DRADataSource.js';
import { AppDataSource } from '../datasources/PostgresDS.js';
import { GeminiService } from './GeminiService.js';
import { CampaignTargetsService, ICampaignTarget } from './CampaignTargetsService.js';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface IDiscoveredColumns {
    tableName: string;
    logicalTableName: string;
    fullTableName: string;
    dataSourceId: number | null;
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
    status: 'outperforming' | 'on-track' | 'underperforming';
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
    settings: ICampaignSettings | null;
    targets: ICampaignTargetsSummary;
    targetScope: ICampaignTargetScope;
}

/**
 * Identifies where this campaign's user-defined targets live, so the client
 * saves edits back to the same project/data source/channel scope.
 */
interface ICampaignTargetScope {
    projectId: number | null;
    dataSourceId: number | null;
    channel: string | null;
}

/**
 * User-authored north-star metrics for a campaign and its ad sets / ad groups.
 */
interface ICampaignTargetsSummary {
    campaign: ICampaignTarget | null;
    adSets: ICampaignTarget[];
}

/**
 * Human-readable summary of an ad set's `targeting` object, limited to the
 * fields most useful for performance analysis and AI recommendations.
 */
interface ITargetingSummary {
    ageMin: number | null;
    ageMax: number | null;
    genders: string[] | null;
    countries: string[] | null;
    regions: string[] | null;
    cityCount: number | null;
    interests: string[] | null;
    customAudienceCount: number | null;
    excludedCustomAudienceCount: number | null;
    publisherPlatforms: string[] | null;
    positions: string[] | null;
}

interface IAdSetSettings {
    id: string;
    name: string;
    status: string | null;
    effectiveStatus: string | null;
    optimizationGoal: string | null;
    billingEvent: string | null;
    bidStrategy: string | null;
    bidAmount: number | null;
    bidConstraints: any | null;
    dailyBudget: number | null;
    lifetimeBudget: number | null;
    dailyMinSpendTarget: number | null;
    dailySpendCap: number | null;
    destinationType: string | null;
    destinationUrls: string[];
    urlParameters: string[];
    attributionSpec: any | null;
    promotedObject: any | null;
    pacingType: string[] | null;
    startTime: string | null;
    endTime: string | null;
    targeting: ITargetingSummary | null;
}

interface ICampaignSettings {
    objective: string | null;
    effectiveStatus: string | null;
    buyingType: string | null;
    bidStrategy: string | null;
    specialAdCategories: string[] | null;
    spendCap: number | null;
    budgetRemaining: number | null;
    dailyBudget: number | null;
    lifetimeBudget: number | null;
    startTime: string | null;
    stopTime: string | null;
    adSets: IAdSetSettings[];
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
    ad_group: ['ad_group', 'ad_set', 'adgroup', 'adset', 'adset_name'],
    keyword: ['keyword', 'search_keyword', 'search_term'],
    device: ['device', 'device_type', 'impression_device', 'device_platform', 'platform_type'],
    geo: ['geo', 'region', 'country', 'location', 'geo_target'],
    demographic: ['demographic', 'age', 'gender'],
    platform: ['platform', 'publisher_platform'],
    placement: ['placement', 'platform_position'],
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

    private getDataSourceRepo() {
        return AppDataSource.getRepository(DRADataSource);
    }

    /**
     * Map EDataSourceType values to human-readable channel names.
     */
    private static readonly DATA_SOURCE_TYPE_TO_CHANNEL: Record<string, string> = {
        [EDataSourceType.GOOGLE_ADS]: 'Google Ads',
        [EDataSourceType.GOOGLE_ANALYTICS]: 'Google Analytics',
        [EDataSourceType.GOOGLE_AD_MANAGER]: 'Google Ad Manager',
        [EDataSourceType.META_ADS]: 'Meta Ads',
        [EDataSourceType.LINKEDIN_ADS]: 'LinkedIn Ads',
        [EDataSourceType.HUBSPOT]: 'HubSpot',
        [EDataSourceType.KLAVIYO]: 'Klaviyo',
        [EDataSourceType.EXCEL]: 'Excel Import',
        [EDataSourceType.CSV]: 'CSV Import',
        [EDataSourceType.PDF]: 'PDF Import',
        [EDataSourceType.POSTGRESQL]: 'PostgreSQL',
        [EDataSourceType.MYSQL]: 'MySQL',
        [EDataSourceType.MARIADB]: 'MariaDB',
        [EDataSourceType.MONGODB]: 'MongoDB',
    };

    // -----------------------------------------------------------------------
    // Column Discovery (same pattern as MarketingMetricsService)
    // -----------------------------------------------------------------------

    /**
     * Resolve discovered columns based on whether the ID is a project_id or data_model_id.
     */
    private async resolveDiscoveredColumns(id: number, isProjectId?: boolean): Promise<IDiscoveredColumns[]> {
        if (isProjectId) {
            return this.discoverColumnsByProject(id);
        }
        return this.discoverColumns(id);
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

        return this.discoverColumnsFromDataSourceIds(manager, kpiMatcher, dataSourceIds, `data model ${dataModelId}`);
    }

    /**
     * Discover columns from a project's data sources (bypasses data model).
     */
    private async discoverColumnsByProject(projectId: number): Promise<IDiscoveredColumns[]> {
        const manager = await this.getManager();
        const kpiMatcher = MarketingKPIMatcher.getInstance();

        const dsRepo = this.getDataSourceRepo();
        const dataSources = await dsRepo.find({
            where: { project: { id: projectId } },
        });

        for (const ds of dataSources) {
        }

        if (!dataSources || dataSources.length === 0) {
            throw new Error(`No data sources found for project ${projectId}`);
        }

        const dataSourceIds = dataSources.map(ds => ds.id);
        return this.discoverColumnsFromDataSourceIds(manager, kpiMatcher, dataSourceIds, `project ${projectId}`);
    }

    /**
     * Core column discovery logic shared by both paths.
     */
    private async discoverColumnsFromDataSourceIds(
        manager: any,
        kpiMatcher: MarketingKPIMatcher,
        dataSourceIds: number[],
        contextLabel: string,
    ): Promise<IDiscoveredColumns[]> {

        const tableRepo = this.getTableMetadataRepo();
        const tables = await tableRepo.find({
            where: dataSourceIds.map(id => ({ data_source_id: id })),
        });

        if (tables.length > 0) {
        }

        const uniqueTables = new Map<string, { schema: string; physical: string; logical: string; dataSourceId: number | null }>();
        for (const t of tables) {
            const key = `${t.schema_name || ''}.${t.physical_table_name}`;
            if (!uniqueTables.has(key)) {
                uniqueTables.set(key, {
                    schema: t.schema_name || 'public',
                    physical: t.physical_table_name,
                    logical: t.logical_table_name || '',
                    dataSourceId: t.data_source_id != null ? Number(t.data_source_id) : null,
                });
            }
        }

        for (const [key, t] of uniqueTables) {
        }

        if (uniqueTables.size === 0) {
            throw new Error(`No tables found for ${contextLabel}`);
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

            if (columns && columns.length > 0) {
            }

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
                logicalTableName: table.logical,
                fullTableName,
                dataSourceId: table.dataSourceId,
                kpiColumns,
                dimensionColumns,
                dateColumn,
                allColumns,
            });
        }

        return results;
    }

    // -----------------------------------------------------------------------
    // Table Selection with Campaign-ID Verification
    // -----------------------------------------------------------------------

    /**
     * Select the best table for a campaign, verifying the campaign ID
     * actually exists in the selected table. Falls back to other tables
     * if the primary choice has no matching rows.
     */
    private async selectTableForCampaign(
        manager: any,
        discoveredTables: IDiscoveredColumns[],
        campaignId: string,
        sourceTableOverride?: string,
        campaignColumnOverride?: string,
    ): Promise<{ table: IDiscoveredColumns; campaignCol: string; campaignNameCol: string | null } | null> {
        // If the caller already knows which table + column to use, skip discovery
        if (sourceTableOverride && campaignColumnOverride) {
            const match = discoveredTables.find(t => t.fullTableName === sourceTableOverride);
            if (match) {
                const nc = match.allColumns.find(
                    c => c.column_name !== campaignColumnOverride && c.classification.dimension_match === 'campaign'
                )?.column_name || null;
                return { table: match, campaignCol: campaignColumnOverride, campaignNameCol: nc };
            }
        }

        // Trial each table: find which ones contain this campaign ID
        const candidates: Array<{ table: IDiscoveredColumns; campaignCol: string; campaignNameCol: string | null; kpiCount: number }> = [];

        for (const t of discoveredTables) {
            const cc = t.dimensionColumns.get('campaign') || null;
            if (!cc || !t.dateColumn) continue;
            const nc = t.allColumns.find(
                c => c.column_name !== cc && c.classification.dimension_match === 'campaign'
            )?.column_name || null;

            const trialQuery = `SELECT COUNT(*) AS cnt FROM ${t.fullTableName} WHERE ("${cc}" = $1${nc ? ` OR "${nc}" = $1` : ''}) LIMIT 1`;
            try {
                const trialResult = await manager.query(trialQuery, [campaignId]);
                if (Number(trialResult[0]?.cnt || 0) > 0) {
                    candidates.push({ table: t, campaignCol: cc, campaignNameCol: nc, kpiCount: t.kpiColumns.size });
                }
            } catch {
                // skip table on query error
            }
        }

        if (candidates.length === 0) return null;

        // Prefer the campaign-level insights table, then the candidate with the most KPI columns
        candidates.sort((a, b) => {
            const aCampaignLevel = a.table.logicalTableName === 'insights' ? 1 : 0;
            const bCampaignLevel = b.table.logicalTableName === 'insights' ? 1 : 0;
            if (aCampaignLevel !== bCampaignLevel) return bCampaignLevel - aCampaignLevel;
            return b.kpiCount - a.kpiCount;
        });

        const best = candidates[0];

        return { table: best.table, campaignCol: best.campaignCol, campaignNameCol: best.campaignNameCol };
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
        options?: { isProjectId?: boolean; sourceTable?: string; campaignColumn?: string },
    ): Promise<ICampaignAnalysis> {

        const manager = await this.getManager();

        const discoveredTables = await this.resolveDiscoveredColumns(dataModelId, options?.isProjectId);
        for (const t of discoveredTables) {
        }

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
            settings: null,
            targets: { campaign: null, adSets: [] },
            targetScope: { projectId: null, dataSourceId: null, channel: null },
        };

        const selected = await this.selectTableForCampaign(manager, discoveredTables, campaignId, options?.sourceTable, options?.campaignColumn);
        if (!selected) {
            throw new Error(`No campaign column found for ${options?.isProjectId ? 'project' : 'data model'} ${dataModelId}`);
        }

        const { table, campaignCol, campaignNameCol } = selected;

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
            overviewQuery += ` WHERE ("${campaignCol}" = $1${campaignNameCol ? ` OR "${campaignNameCol}" = $1` : ''}) AND "${table.dateColumn}" BETWEEN $2 AND $3`;
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
            dailyQuery += ` WHERE ("${campaignCol}" = $1${campaignNameCol ? ` OR "${campaignNameCol}" = $1` : ''}) AND "${table.dateColumn}" BETWEEN $2 AND $3`;
            dailyQuery += ` GROUP BY DATE("${table.dateColumn}")`;
            dailyQuery += ` ORDER BY date ASC`;


            try {
                const dailyRows = await manager.query(dailyQuery, [
                    campaignId, startDate.toISOString(), endDate.toISOString(),
                ]);

                if (dailyRows.length > 0) {
                }

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
            }
        } else {
        }

        // 3. Dimension breakdowns
        result.dimensionBreakdowns = await this.fetchDimensionBreakdowns(
            manager, table, campaignCol, campaignNameCol, campaignId, startDate, endDate, discoveredTables,
        );

        // 3b. Campaign and ad set settings (objective, budgets, bid strategy,
        // targeting) from the Meta Ads configuration tables, when available.
        result.settings = await this.fetchCampaignSettings(
            manager, discoveredTables, campaignId, result.campaignName,
        );

        // 3c. User-defined targets (north-star metrics) for this campaign and
        // its ad sets. Failure is non-fatal — analysis works without targets.
        try {
            result.targetScope = await this.resolveTargetScope(
                manager, table, dataModelId, options?.isProjectId,
            );
            if (result.targetScope.projectId) {
                result.targets = await CampaignTargetsService.getInstance().getForCampaign(
                    result.targetScope.projectId,
                    result.targetScope.dataSourceId,
                    campaignId,
                );
            }
        } catch (err) {
            result.targets = { campaign: null, adSets: [] };
        }

        // 4. AI analysis
        try {
            const aiResult = await this.generateAIAnalysis(result);
            result.aiAnalysis = aiResult.analysis;
            result.recommendations = aiResult.recommendations;
        } catch (err) {
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
        campaignNameCol: string | null,
        campaignId: string,
        startDate: Date,
        endDate: Date,
        discoveredTables?: IDiscoveredColumns[],
    ): Promise<IDimensionBreakdown[]> {
        const breakdowns: IDimensionBreakdown[] = [];

        for (const [dimension, possibleKeys] of Object.entries(DIMENSION_KEYS)) {
            let dimCol: string | null = null;
            let dimTable = table;
            let dimCampaignCol = campaignCol;
            let dimCampaignNameCol = campaignNameCol;

            // Check primary table first
            for (const key of possibleKeys) {
                const found = table.dimensionColumns.get(key);
                if (found) {
                    dimCol = found;
                    break;
                }
            }

            // If not found in primary table, search other tables that
            // have this dimension column AND contain the campaign ID
            if (!dimCol && discoveredTables) {
                for (const other of discoveredTables) {
                    if (other === table) continue;
                    // Metadata-only tables (e.g. `ads`, `adsets`) can carry the
                    // dimension column (such as adset_id) but have no metric
                    // columns, so they cannot produce a breakdown. Skip them so
                    // the search reaches the performance table (e.g.
                    // `adset_insights`).
                    if (other.kpiColumns.size === 0) continue;
                    const oc = other.dimensionColumns.get('campaign') || null;
                    if (!oc || !other.dateColumn) continue;

                    let foundDim: string | null = null;
                    for (const key of possibleKeys) {
                        const f = other.dimensionColumns.get(key);
                        if (f) { foundDim = f; break; }
                    }
                    if (!foundDim) continue;

                    const onc = other.allColumns.find(
                        c => c.column_name !== oc && c.classification.dimension_match === 'campaign'
                    )?.column_name || null;

                    // Verify campaign exists in this table
                    const trialSql = `SELECT COUNT(*) AS cnt FROM ${other.fullTableName} WHERE ("${oc}" = $1${onc ? ` OR "${onc}" = $1` : ''}) LIMIT 1`;
                    try {
                        const trial = await manager.query(trialSql, [campaignId]);
                        if (Number(trial[0]?.cnt || 0) > 0) {
                            dimCol = foundDim;
                            dimTable = other;
                            dimCampaignCol = oc;
                            dimCampaignNameCol = onc;
                            break;
                        }
                    } catch {
                        // skip
                    }
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

            // Prefer a human-readable name column over an id column when the
            // same dimension is available under both (e.g. adset_name vs adset_id).
            const preferredNameCol = dimTable.allColumns.find(
                c => c.classification.dimension_match === dimension
                    && c.column_name !== dimCol
                    && /_name$/i.test(c.column_name)
            )?.column_name;
            if (preferredNameCol) {
                dimCol = preferredNameCol;
            }

            try {
                const rows = await this.fetchDimensionRows(
                    manager, dimTable, dimCampaignCol, dimCampaignNameCol, campaignId, dimCol, startDate, endDate,
                );
                if (rows.length > 0) {
                }
                breakdowns.push({
                    dimension,
                    available: rows.length > 0,
                    rows,
                });
            } catch (err) {
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
        campaignNameCol: string | null,
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
            WHERE ("${campaignCol}" = $1${campaignNameCol ? ` OR "${campaignNameCol}" = $1` : ''}) AND "${table.dateColumn}" BETWEEN $2 AND $3
            GROUP BY "${dimCol}"
            ORDER BY COALESCE(SUM("${table.kpiColumns.get('spend') || table.kpiColumns.values().next().value}"), 0) DESC
        `;


        const rawRows = await manager.query(query, [
            campaignId, startDate.toISOString(), endDate.toISOString(),
        ]);

        if (rawRows.length > 0) {
        }

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
                status: 'on-track' as const,
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
     * - CPA: lower is better (below blended avg = bonus points, above avg = penalty)
     * - ROAS: higher is better (above blended avg = bonus points, below avg = penalty)
     *
     * Averages are spend-weighted (blended) so small-spend rows don't skew the
     * benchmark. Rows with no conversions (CPA = 0) are treated as no CPA signal
     * rather than getting the maximum CPA bonus.
     *
     * Status thresholds:
     * - score >= 70 => outperforming
     * - score >= 40 => on-track
     * - otherwise    => underperformer
     */
    private calculatePerformanceScores(rows: IDimensionBreakdownRow[]): void {
        if (rows.length === 0) return;

        // Filter rows with actual activity for averaging
        const activeRows = rows.filter(r => r.spend > 0);
        if (activeRows.length === 0) {
            rows.forEach(r => {
                r.performanceScore = 50;
                r.status = 'on-track';
            });
            return;
        }

        // Spend-weighted (blended) benchmarks: total spend / total conversions
        // and total revenue / total spend across all active rows.
        const totalSpend = activeRows.reduce((sum, r) => sum + r.spend, 0);
        const totalConversions = activeRows.reduce((sum, r) => sum + r.conversions, 0);
        const totalRevenue = activeRows.reduce((sum, r) => sum + r.revenue, 0);
        const avgCpa = totalConversions > 0 ? totalSpend / totalConversions : 0;
        const avgRoas = totalSpend > 0 ? totalRevenue / totalSpend : 0;

        for (const row of rows) {
            if (row.spend === 0) {
                row.performanceScore = 50;
                row.status = 'on-track';
                continue;
            }

            let score = 50;

            // CPA factor: -25 to +25 points. Rows with no conversions have
            // no CPA signal, so they are left neutral instead of being
            // rewarded for a zero CPA.
            if (row.conversions > 0 && avgCpa > 0) {
                const cpaRatio = row.cpa / avgCpa;
                if (cpaRatio < 1) {
                    score += Math.min(25, (1 - cpaRatio) * 25);
                } else {
                    score -= Math.min(25, (cpaRatio - 1) * 25);
                }
            }

            // ROAS factor: -25 to +25 points
            if (avgRoas > 0) {
                const roasRatio = row.roas / avgRoas;
                if (roasRatio > 1) {
                    score += Math.min(25, (roasRatio - 1) * 25);
                } else {
                    score -= Math.min(25, (1 - roasRatio) * 25);
                }
            }

            // Clamp to 1-100
            row.performanceScore = Math.max(1, Math.min(100, Math.round(score)));

            // Assign status
            if (row.performanceScore >= 70) {
                row.status = 'outperforming';
            } else if (row.performanceScore >= 40) {
                row.status = 'on-track';
            } else {
                row.status = 'underperforming';
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
        options?: { isProjectId?: boolean; sourceTable?: string; campaignColumn?: string },
    ): Promise<{ campaignId: string; campaignName: string; channel: string; kpis: ICampaignKPICard[] }> {
        const manager = await this.getManager();
        const discoveredTables = await this.resolveDiscoveredColumns(dataModelId, options?.isProjectId);

        const selected = await this.selectTableForCampaign(manager, discoveredTables, campaignId, options?.sourceTable, options?.campaignColumn);
        if (!selected) {
            throw new Error(`No campaign column found for ${options?.isProjectId ? 'project' : 'data model'} ${dataModelId}`);
        }

        const { table, campaignCol, campaignNameCol } = selected;

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
            overviewQuery += ` WHERE ("${campaignCol}" = $1${campaignNameCol ? ` OR "${campaignNameCol}" = $1` : ''}) AND "${table.dateColumn}" BETWEEN $2 AND $3`;
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
        options?: { isProjectId?: boolean; sourceTable?: string; campaignColumn?: string },
    ): Promise<{ campaignId: string; dailyTrend: IDailyTrendPoint[] }> {
        const manager = await this.getManager();
        const discoveredTables = await this.resolveDiscoveredColumns(dataModelId, options?.isProjectId);

        const selected = await this.selectTableForCampaign(manager, discoveredTables, campaignId, options?.sourceTable, options?.campaignColumn);
        if (!selected) {
            throw new Error(`No campaign column found for ${options?.isProjectId ? 'project' : 'data model'} ${dataModelId}`);
        }

        const { table, campaignCol, campaignNameCol } = selected;

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
            dailyQuery += ` WHERE ("${campaignCol}" = $1${campaignNameCol ? ` OR "${campaignNameCol}" = $1` : ''}) AND "${table.dateColumn}" BETWEEN $2 AND $3`;
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
        options?: { isProjectId?: boolean; sourceTable?: string; campaignColumn?: string },
    ): Promise<IDimensionBreakdown[]> {
        const manager = await this.getManager();
        const discoveredTables = await this.resolveDiscoveredColumns(dataModelId, options?.isProjectId);

        const selected = await this.selectTableForCampaign(manager, discoveredTables, campaignId, options?.sourceTable, options?.campaignColumn);
        if (!selected) {
            throw new Error(`No campaign column found for ${options?.isProjectId ? 'project' : 'data model'} ${dataModelId}`);
        }

        const { table, campaignCol, campaignNameCol } = selected;

        return this.fetchDimensionBreakdowns(
            manager, table, campaignCol, campaignNameCol, campaignId, startDate, endDate, discoveredTables,
        );
    }

    // -----------------------------------------------------------------------
    // Campaign / Ad Set Settings
    // -----------------------------------------------------------------------

    private parseJson(value: any): any {
        if (value === null || value === undefined) return null;
        if (typeof value === 'string') {
            try {
                return JSON.parse(value);
            } catch {
                return null;
            }
        }
        return value;
    }

    /**
     * Reduce a Meta `targeting` object to the audience fields most relevant
     * for performance analysis and AI recommendations.
     */
    private summarizeTargeting(targeting: any): ITargetingSummary | null {
        const t = this.parseJson(targeting);
        if (!t || typeof t !== 'object') return null;

        const geo = t.geo_locations || {};
        const countries = Array.isArray(geo.countries) ? geo.countries : null;
        const regions = Array.isArray(geo.regions)
            ? geo.regions.map((r: any) => r?.name).filter(Boolean)
            : null;
        const cityCount = Array.isArray(geo.cities) ? geo.cities.length : null;

        const interests = Array.isArray(t.interests)
            ? t.interests.map((i: any) => i?.name).filter(Boolean)
            : null;

        const positions: string[] = [];
        for (const key of ['facebook_positions', 'instagram_positions', 'messenger_positions', 'audience_network_positions']) {
            if (Array.isArray(t[key])) positions.push(...t[key]);
        }

        let genders: string[] | null = null;
        if (Array.isArray(t.genders)) {
            genders = t.genders.map((g: number) => (g === 1 ? 'men' : g === 2 ? 'women' : 'all'));
        }

        return {
            ageMin: t.age_min ?? null,
            ageMax: t.age_max ?? null,
            genders,
            countries,
            regions,
            cityCount,
            interests,
            customAudienceCount: Array.isArray(t.custom_audiences) ? t.custom_audiences.length : null,
            excludedCustomAudienceCount: Array.isArray(t.excluded_custom_audiences) ? t.excluded_custom_audiences.length : null,
            publisherPlatforms: Array.isArray(t.publisher_platforms) ? t.publisher_platforms : null,
            positions: positions.length > 0 ? positions : null,
        };
    }

    private mapAdSetSettings(
        row: any,
        extras: { destinationUrls: string[]; urlParameters: string[] } = { destinationUrls: [], urlParameters: [] },
    ): IAdSetSettings {
        const rawDestination = row.destination_type ? String(row.destination_type) : null;
        return {
            id: String(row.id),
            name: row.name || '',
            status: row.status ?? null,
            effectiveStatus: row.effective_status ?? null,
            optimizationGoal: row.optimization_goal ?? null,
            billingEvent: row.billing_event ?? null,
            bidStrategy: row.bid_strategy ?? null,
            bidAmount: row.bid_amount != null ? Number(row.bid_amount) : null,
            bidConstraints: this.parseJson(row.bid_constraints),
            dailyBudget: row.daily_budget != null ? Number(row.daily_budget) : null,
            lifetimeBudget: row.lifetime_budget != null ? Number(row.lifetime_budget) : null,
            dailyMinSpendTarget: row.daily_min_spend_target != null ? Number(row.daily_min_spend_target) : null,
            dailySpendCap: row.daily_spend_cap != null ? Number(row.daily_spend_cap) : null,
            // Meta returns the literal "UNDEFINED" for ad sets whose destination
            // has not been resolved; treat it as not set rather than displaying it.
            destinationType: rawDestination && rawDestination.toUpperCase() !== 'UNDEFINED'
                ? rawDestination
                : null,
            destinationUrls: extras.destinationUrls,
            urlParameters: extras.urlParameters,
            attributionSpec: this.parseJson(row.attribution_spec),
            promotedObject: this.parseJson(row.promoted_object),
            pacingType: this.parseJson(row.pacing_type),
            startTime: row.start_time ? String(row.start_time) : null,
            endTime: row.end_time ? String(row.end_time) : null,
            targeting: this.summarizeTargeting(row.targeting),
        };
    }

    /**
     * Extract the click-through destination URL from a stored ad creative.
     * Meta puts it in `link_url` for simple creatives, or nested inside
     * `object_story_spec` / `asset_feed_spec` for other formats.
     */
    private extractCreativeUrl(creative: any): string | null {
        if (!creative) return null;

        if (typeof creative.link_url === 'string' && creative.link_url.length > 0) {
            return creative.link_url;
        }

        const objectStory = this.parseJson(creative.object_story_spec);
        if (objectStory) {
            const candidates = [
                objectStory.link_data?.link,
                objectStory.video_data?.call_to_action?.value?.link,
                objectStory.photo_data?.call_to_action?.value?.link,
                objectStory.template_data?.link,
            ];
            const found = candidates.find((u: any) => typeof u === 'string' && u.length > 0);
            if (found) return found;
        }

        const assetFeed = this.parseJson(creative.asset_feed_spec);
        if (assetFeed && Array.isArray(assetFeed.link_urls)) {
            const found = assetFeed.link_urls
                .map((l: any) => l?.website_url)
                .find((u: any) => typeof u === 'string' && u.length > 0);
            if (found) return found;
        }

        return null;
    }

    /**
     * Build a map of ad set id -> destination URLs and URL parameter strings
     * (UTM tracking) by joining the `ads` table (adset_id, creative_id) to the
     * `creatives` table. URL tags may be set on either the ad or the creative.
     */
    private async fetchAdSetUrlInfo(
        manager: any,
        discoveredTables: IDiscoveredColumns[],
        adSetIds: string[],
    ): Promise<Map<string, { destinationUrls: string[]; urlParameters: string[] }>> {
        const result = new Map<string, { destinationUrls: string[]; urlParameters: string[] }>();
        const adTable = discoveredTables.find(t => t.logicalTableName === 'ads');
        const creativeTable = discoveredTables.find(t => t.logicalTableName === 'creatives');
        if (!adTable || !creativeTable || adSetIds.length === 0) return result;

        try {
            const ads = await manager.query(
                `SELECT adset_id, creative_id, url_tags FROM ${adTable.fullTableName} WHERE adset_id = ANY($1::text[])`,
                [adSetIds],
            );

            const creativeIds = Array.from(
                new Set(ads.map((a: any) => a.creative_id).filter(Boolean).map(String)),
            );
            if (creativeIds.length === 0) return result;

            const creatives = await manager.query(
                `SELECT id, link_url, url_tags, object_story_spec, asset_feed_spec FROM ${creativeTable.fullTableName} WHERE id = ANY($1::text[])`,
                [creativeIds],
            );

            const creativeMap = new Map<string, any>();
            for (const creative of creatives) creativeMap.set(String(creative.id), creative);

            for (const ad of ads) {
                const creative = creativeMap.get(String(ad.creative_id));
                const key = String(ad.adset_id);
                const entry = result.get(key) || { destinationUrls: [] as string[], urlParameters: [] as string[] };

                const url = this.extractCreativeUrl(creative);
                if (url && !entry.destinationUrls.includes(url)) {
                    entry.destinationUrls.push(url);
                }

                const urlTags: string[] = [];
                if (typeof ad.url_tags === 'string' && ad.url_tags.length > 0) urlTags.push(ad.url_tags);
                if (creative && typeof creative.url_tags === 'string' && creative.url_tags.length > 0) urlTags.push(creative.url_tags);
                for (const tag of urlTags) {
                    if (!entry.urlParameters.includes(tag)) entry.urlParameters.push(tag);
                }

                result.set(key, entry);
            }
        } catch {
            // Ads/creatives tables may be absent for this source; ignore.
        }

        return result;
    }

    /**
     * Resolve the project/data source/channel scope that campaign targets are
     * stored under. Works for both the projectId and legacy dataModelId paths.
     */
    private async resolveTargetScope(
        manager: any,
        table: IDiscoveredColumns,
        inputId: number,
        isProjectId?: boolean,
    ): Promise<ICampaignTargetScope> {
        const dataSourceId = table.dataSourceId;
        let projectId: number | null = isProjectId ? inputId : null;

        if (!projectId && dataSourceId) {
            try {
                const rows = await manager.query(
                    `SELECT project_id FROM dra_data_sources WHERE id = $1 LIMIT 1`,
                    [dataSourceId],
                );
                projectId = rows?.[0]?.project_id != null ? Number(rows[0].project_id) : null;
            } catch {
                projectId = null;
            }
        }

        return { projectId, dataSourceId, channel: this.channelFromTable(table) };
    }

    /**
     * Derive a stable channel key (e.g. `meta_ads`) from the discovered table's
     * schema name (`dra_meta_ads`), falling back to null.
     */
    private channelFromTable(table: IDiscoveredColumns): string | null {
        const match = /^"([^"]+)"/.exec(table.fullTableName);
        const schema = match?.[1] || null;
        if (!schema) return null;
        return schema.startsWith('dra_') ? schema.slice(4) : schema;
    }

    /**
     * Load campaign configuration from the platform `campaigns` physical table
     * discovered for this project/data model (Meta Ads and Google Ads both
     * expose `objective`, budgets and bid strategy through column-aware
     * mappings). Ad-set configuration is loaded from the Meta Ads `adsets`
     * table when available. Returns null when the tables are unavailable.
     */
    private async fetchCampaignSettings(
        manager: any,
        discoveredTables: IDiscoveredColumns[],
        campaignId: string,
        campaignName?: string,
    ): Promise<ICampaignSettings | null> {
        const campaignTable = discoveredTables.find(t => t.logicalTableName === 'campaigns');
        if (!campaignTable) return null;

        const columnNames = new Set(campaignTable.allColumns.map(c => c.column_name));
        if (!columnNames.has('objective')) return null;

        let campaignRow: any = null;
        try {
            const rows = await manager.query(
                `SELECT * FROM ${campaignTable.fullTableName} WHERE "id" = $1 LIMIT 1`,
                [campaignId],
            );
            campaignRow = rows?.[0] || null;
        } catch {
            campaignRow = null;
        }

        if (!campaignRow && campaignName) {
            try {
                const rows = await manager.query(
                    `SELECT * FROM ${campaignTable.fullTableName} WHERE "name" = $1 LIMIT 1`,
                    [campaignName],
                );
                campaignRow = rows?.[0] || null;
            } catch {
                campaignRow = null;
            }
        }

        if (!campaignRow) return null;

        const adSetTable = discoveredTables.find(t => t.logicalTableName === 'adsets');
        let adSets: IAdSetSettings[] = [];
        if (adSetTable) {
            try {
                const rows = await manager.query(
                    `SELECT * FROM ${adSetTable.fullTableName} WHERE "campaign_id" = $1 ORDER BY "name" ASC`,
                    [campaignRow.id],
                );
                const adSetRows: any[] = rows || [];
                const urlInfo = await this.fetchAdSetUrlInfo(
                    manager,
                    discoveredTables,
                    adSetRows.map(r => String(r.id)),
                );
                adSets = adSetRows.map((r: any) => this.mapAdSetSettings(r, urlInfo.get(String(r.id)) || {
                    destinationUrls: [],
                    urlParameters: [],
                }));
            } catch {
                adSets = [];
            }
        }

        return {
            objective: campaignRow.objective ?? null,
            effectiveStatus: campaignRow.effective_status ?? campaignRow.primary_status ?? campaignRow.status ?? null,
            buyingType: campaignRow.buying_type ?? null,
            bidStrategy: campaignRow.bid_strategy ?? campaignRow.bidding_strategy_type ?? null,
            specialAdCategories: this.parseJson(campaignRow.special_ad_categories),
            spendCap: campaignRow.spend_cap != null ? Number(campaignRow.spend_cap) : null,
            budgetRemaining: campaignRow.budget_remaining != null ? Number(campaignRow.budget_remaining) : null,
            dailyBudget: campaignRow.daily_budget != null ? Number(campaignRow.daily_budget) : null,
            lifetimeBudget: campaignRow.lifetime_budget != null ? Number(campaignRow.lifetime_budget)
                : (campaignRow.total_budget != null ? Number(campaignRow.total_budget) : null),
            startTime: campaignRow.start_time ? String(campaignRow.start_time)
                : (campaignRow.start_date ? String(campaignRow.start_date) : null),
            stopTime: campaignRow.stop_time ? String(campaignRow.stop_time)
                : (campaignRow.end_date ? String(campaignRow.end_date) : null),
            adSets,
        };
    }

    /**
     * Render campaign/ad set settings as markdown for the AI prompt.
     */
    private formatSettingsForPrompt(settings: ICampaignSettings | null): string {
        if (!settings) return '';

        const money = (v: number | null) => (v !== null && v > 0 ? v.toFixed(2) : null);
        const campaignLines: string[] = [];
        const push = (label: string, value: any) => {
            if (value !== null && value !== undefined && value !== '') campaignLines.push(`- ${label}: ${value}`);
        };

        push('Objective', settings.objective);
        push('Effective status', settings.effectiveStatus);
        push('Buying type', settings.buyingType);
        push('Bid strategy', settings.bidStrategy);
        push('Special ad categories', settings.specialAdCategories?.join(', '));
        push('Daily budget', money(settings.dailyBudget));
        push('Lifetime budget', money(settings.lifetimeBudget));
        push('Spend cap', money(settings.spendCap));
        push('Budget remaining', money(settings.budgetRemaining));
        push('Start', settings.startTime);
        push('Stop', settings.stopTime);

        const adSetBlocks = settings.adSets.map(as => {
            const lines: string[] = [`### Ad set: ${as.name} (${as.id})`];
            const aPush = (label: string, value: any) => {
                if (value !== null && value !== undefined && value !== '') lines.push(`  - ${label}: ${value}`);
            };
            aPush('Status', as.effectiveStatus || as.status);
            aPush('Optimization goal', as.optimizationGoal);
            aPush('Billing event', as.billingEvent);
            aPush('Bid strategy', as.bidStrategy);
            aPush('Bid amount', money(as.bidAmount));
            aPush('Daily budget', money(as.dailyBudget));
            aPush('Lifetime budget', money(as.lifetimeBudget));
            aPush('Daily min spend target', money(as.dailyMinSpendTarget));
            aPush('Daily spend cap', money(as.dailySpendCap));
            aPush('Destination', as.destinationType);
            aPush('Destination URL', as.destinationUrls?.join(', '));
            aPush('URL parameters', as.urlParameters?.join(' | '));
            aPush('Pacing', as.pacingType?.join(', '));

            const t = as.targeting;
            if (t) {
                if (t.ageMin !== null || t.ageMax !== null) lines.push(`  - Age: ${t.ageMin ?? '?'}-${t.ageMax ?? '?'}`);
                if (t.genders) lines.push(`  - Genders: ${t.genders.join(', ')}`);
                if (t.countries) lines.push(`  - Countries: ${t.countries.join(', ')}`);
                if (t.regions) lines.push(`  - Regions: ${t.regions.slice(0, 5).join(', ')}`);
                if (t.cityCount !== null) lines.push(`  - Cities targeted: ${t.cityCount}`);
                if (t.interests) lines.push(`  - Interests: ${t.interests.join(', ')}`);
                if (t.customAudienceCount !== null) lines.push(`  - Custom audiences: ${t.customAudienceCount}`);
                if (t.excludedCustomAudienceCount !== null) lines.push(`  - Excluded custom audiences: ${t.excludedCustomAudienceCount}`);
                if (t.publisherPlatforms) lines.push(`  - Publisher platforms: ${t.publisherPlatforms.join(', ')}`);
                if (t.positions) lines.push(`  - Placements: ${t.positions.join(', ')}`);
            }

            return lines.join('\n');
        });

        return [
            campaignLines.join('\n'),
            adSetBlocks.length > 0 ? `\n### Ad sets (${adSetBlocks.length})\n${adSetBlocks.join('\n\n')}` : 'No ad set settings available.',
        ].join('\n');
    }

    /**
     * Render the CMO/manager-defined north-star targets as markdown for the AI
     * prompt so recommendations can be measured against expectations.
     */
    private formatTargetsForPrompt(targets: ICampaignTargetsSummary): string {
        const blocks: string[] = [];

        const targetLines = (t: ICampaignTarget): string[] => {
            const lines: string[] = [];
            const push = (label: string, value: any) => {
                if (value !== null && value !== undefined && value !== '') lines.push(`  - ${label}: ${value}`);
            };
            push('Buying model', t.buyingModel);
            push('Audience size', t.audienceSize);
            push('Target CTR', t.targetCtr != null ? `${t.targetCtr}%` : null);
            push('Target clicks', t.targetClicks);
            push('Target impressions', t.targetImpressions);
            push('Target ROAS', t.targetRoas != null ? `${t.targetRoas}x` : null);
            push('Target leads', t.targetLeads);
            push('Target conversions', t.targetConversions);
            push('Target revenue', t.targetRevenue);
            push('Target CPC', t.targetCpc);
            push('Target CPM', t.targetCpm);
            push('Target CPA', t.targetCpa);
            push('Target CPL', t.targetCpl);
            push('Target frequency', t.targetFrequency);
            push('Initial investment', t.initialInvestment);
            push('Daily budget target', t.dailyBudget);
            push('Lifetime budget target', t.lifetimeBudget);
            push('Flight', t.flightStartDate || t.flightEndDate ? `${t.flightStartDate ?? '?'} → ${t.flightEndDate ?? '?'}` : null);
            push('Notes', t.notes);
            return lines;
        };

        if (targets.campaign) {
            const lines = targetLines(targets.campaign);
            if (lines.length) {
                blocks.push(`### Campaign targets (${targets.campaign.entityName || targets.campaign.entityId})\n${lines.join('\n')}`);
            }
        }

        for (const t of targets.adSets) {
            const lines = targetLines(t);
            if (lines.length) {
                blocks.push(`### Ad set targets (${t.entityName || t.entityId})\n${lines.join('\n')}`);
            }
        }

        return blocks.join('\n\n');
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
                const topPerformers = d.rows.filter(r => r.status === 'outperforming');
                const underperformers = d.rows.filter(r => r.status === 'underperforming');

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

        const settingsSummary = this.formatSettingsForPrompt(campaignData.settings);
        const targetsSummary = this.formatTargetsForPrompt(campaignData.targets);

        const prompt = `Analyze the following campaign performance data and provide insights.

## Campaign: ${campaignData.campaignName}
- Channel: ${campaignData.channel}
- Campaign ID: ${campaignData.campaignId}

## KPIs
${campaignData.kpis.map(k => `- ${k.label}: ${k.value !== null ? (k.value % 1 === 0 ? k.value.toLocaleString() : k.value.toFixed(2)) : 'N/A'}`).join('\n')}

## Campaign & Ad Set Settings (targets and configuration)
${settingsSummary || 'No campaign settings available.'}

## North-Star Targets (defined by the CMO/manager)
${targetsSummary || 'No targets have been defined for this campaign or its ad sets.'}

## Daily Trend (${campaignData.dailyTrend.length} days)
${campaignData.dailyTrend.length > 0 ? `Latest 7 days:\n${campaignData.dailyTrend.slice(-7).map(d =>
    `  ${d.date}: Spend $${d.spend.toFixed(2)}, Clicks ${d.clicks}, Conversions ${d.conversions}, Revenue $${d.revenue.toFixed(2)}, ROAS ${d.roas.toFixed(2)}x`
).join('\n')}` : 'No daily trend data available.'}

## Dimension Breakdowns
${breakdownSummary || 'No dimension breakdowns available.'}

When making recommendations, use the campaign and ad set settings above: compare spend against budgets and spend targets/caps, assess whether performance meets the bidding strategy and optimization goal, and consider the target audience, placements and attribution settings. Reference concrete settings (budgets, bid strategy, target CPA/ROAS, audience) in your recommendations. When north-star targets are present, explicitly compare actual performance against each target (CTR, CPC, CPA/CPL, ROAS, clicks, impressions, leads, budget pacing) and state whether the campaign is on track, ahead of, or behind each target.

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
            return {
                analysis: null,
                recommendations: [],
            };
        }
    }
}

export default CampaignAnalysisService;