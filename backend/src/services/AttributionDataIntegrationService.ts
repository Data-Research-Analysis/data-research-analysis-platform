/**
 * Attribution Data Integration Service (ATTR-002)
 *
 * Integrates attribution data with real campaign/channel data from connected
 * ad platforms (Google Ads, Meta Ads, LinkedIn Ads, HubSpot, etc.), replacing
 * mock data with actual computed attribution.
 *
 * Features:
 * - Pulls campaign names from connected data sources via column discovery
 * - Matches attribution touchpoints to actual campaigns using campaign name/ID
 * - Pulls actual spend data to calculate attribution-weighted ROI
 * - Supports 5 attribution models: First Touch, Last Touch, Linear, Time Decay, U-Shaped
 * - Detects conversion paths from touchpoint sequences
 * - Calculates time-to-conversion metrics
 * - Generates AI insights via GeminiService
 *
 * Endpoint: POST /attribution/analyze
 *   Input:  { data_model_id, attribution_model, date_range: { start, end } }
 *   Output: { channelAttribution[], conversionPaths[], timeToConversion, roiByChannel[], aiInsights }
 */

import { DBDriver } from '../drivers/DBDriver.js';
import { EDataSourceType } from '../types/EDataSourceType.js';
import { MarketingKPIMatcher, IColumnClassification } from './detection/MarketingKPIMatcher.js';
import { DRATableMetadata } from '../models/DRATableMetadata.js';
import { DRADataModelSource } from '../models/DRADataModelSource.js';
import { AppDataSource } from '../datasources/PostgresDS.js';
import fetch from 'node-fetch';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type AttributionModel = 'first_touch' | 'last_touch' | 'linear' | 'time_decay' | 'u_shaped';

export interface IAnalyzeRequest {
    data_model_id: number;
    attribution_model: AttributionModel;
    date_range: { start: string; end: string };
}

export interface IChannelAttribution {
    channel: string;
    attributedConversions: number;
    attributedRevenue: number;
    attributedROAS: number;
    /** Percentage of total attributed conversions (0-100) */
    conversionShare: number;
}

export interface IConversionPath {
    /** Ordered list of channel touchpoints in this path */
    path: string[];
    /** Frequency — how many users/sessions followed this path */
    frequency: number;
    /** Number of conversions from this path */
    conversions: number;
}

export interface ITimeToConversion {
    average: number;
    median: number;
    min: number;
    max: number;
    /** Distribution buckets for histogram: { label, count } */
    distribution: { label: string; count: number }[];
}

export interface IAttributionROI {
    channel: string;
    spend: number;
    attributedConversions: number;
    attributedRevenue: number;
    attributedROAS: number;
}

export interface IAnalyzeResponse {
    channelAttribution: IChannelAttribution[];
    conversionPaths: IConversionPath[];
    timeToConversion: ITimeToConversion;
    roiByChannel: IAttributionROI[];
    aiInsights: string;
}

// Internal: discovered columns from data model
interface IDiscoveredColumns {
    tableName: string;
    fullTableName: string;
    kpiColumns: Map<string, string>;      // kpi_match -> column_name
    dimensionColumns: Map<string, string>; // dimension_match -> column_name
    dateColumn: string | null;
    allColumns: Array<{ column_name: string; classification: IColumnClassification }>;
}

// Internal: a raw row fetched from the data source
interface IRawRow {
    [key: string]: any;
}

// Internal: a touchpoint derived from raw data
interface ITouchpoint {
    channel: string;
    campaign: string;
    campaignId: string;
    date: Date;
    spend: number;
    conversions: number;
    revenue: number;
    userId: string; // synthetic user/session identifier for path building
    eventType: string; // 'click', 'impression', 'conversion', etc.
}

// Internal: a journey (sequence of touchpoints for a single user/session)
interface IJourney {
    userId: string;
    touchpoints: ITouchpoint[];
    conversionDate: Date | null;
    conversionValue: number;
    firstTouchDate: Date;
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const TIME_DECAY_HALF_LIFE_DAYS = 7;

// ---------------------------------------------------------------------------
// Service
// ---------------------------------------------------------------------------

export class AttributionDataIntegrationService {
    private static instance: AttributionDataIntegrationService;
    private constructor() {}

    public static getInstance(): AttributionDataIntegrationService {
        if (!AttributionDataIntegrationService.instance) {
            AttributionDataIntegrationService.instance = new AttributionDataIntegrationService();
        }
        return AttributionDataIntegrationService.instance;
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

        for (const [, tableInfo] of uniqueTables) {
            const fullTableName = tableInfo.schema === 'public'
                ? tableInfo.physical
                : `${tableInfo.schema}.${tableInfo.physical}`;

            // Get column names and data types from the actual table
            let columnEntries: Array<{ column_name: string; data_type: string }> = [];
            try {
                const columnsResult = await manager.query(
                    `SELECT column_name, data_type FROM information_schema.columns WHERE table_schema = $1 AND table_name = $2`,
                    [tableInfo.schema, tableInfo.physical]
                );
                columnEntries = columnsResult.map((r: any) => ({ column_name: r.column_name, data_type: r.data_type }));
            } catch {
                // Fallback: use metadata columns (assume text type)
                const metaCols = tables.filter(
                    t => t.physical_table_name === tableInfo.physical
                        && (t.schema_name || 'public') === tableInfo.schema
                );
                // DRATableMetadata doesn't store individual column names — use logical_table_name as fallback hint
                // This path is unlikely since information_schema is almost always available
                columnEntries = [];
            }

            if (columnEntries.length === 0) continue;

            const kpiColumns = new Map<string, string>();
            const dimensionColumns = new Map<string, string>();
            let dateColumn: string | null = null;
            const allColumns: IDiscoveredColumns['allColumns'] = [];

            for (const { column_name: colName, data_type } of columnEntries) {
                const classification = kpiMatcher.classifyColumn(colName, data_type);
                allColumns.push({ column_name: colName, classification });

                if (classification.role === 'fact' && classification.kpi_match) {
                    kpiColumns.set(classification.kpi_match, colName);
                } else if (classification.role === 'dimension' && classification.dimension_match) {
                    dimensionColumns.set(classification.dimension_match, colName);
                } else if (classification.role === 'time') {
                    if (!dateColumn) dateColumn = colName;
                }
            }

            results.push({
                tableName: tableInfo.physical,
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
    // Data Fetching
    // -----------------------------------------------------------------------

    /**
     * Fetch raw rows from the data source for the given date range.
     */
    private async fetchRawData(
        discovered: IDiscoveredColumns[],
        startDate: string,
        endDate: string,
    ): Promise<IRawRow[]> {
        const manager = await this.getManager();
        const allRows: IRawRow[] = [];

        for (const dc of discovered) {
            const selectCols: string[] = [];
            const colMap: Record<string, string> = {};

            // Collect KPI columns
            for (const [match, colName] of dc.kpiColumns) {
                selectCols.push(`"${colName}"`);
                colMap[colName] = match;
            }

            // Collect dimension columns
            for (const [match, colName] of dc.dimensionColumns) {
                selectCols.push(`"${colName}"`);
                colMap[colName] = match;
            }

            // Date column
            if (dc.dateColumn) {
                selectCols.push(`"${dc.dateColumn}"`);
                colMap[dc.dateColumn] = 'date';
            }

            if (selectCols.length === 0) continue;

            let query = `SELECT ${selectCols.join(', ')} FROM "${dc.fullTableName}"`;
            const params: any[] = [];
            const conditions: string[] = [];

            if (dc.dateColumn) {
                params.push(startDate);
                conditions.push(`"${dc.dateColumn}" >= $${params.length}`);
                params.push(endDate);
                conditions.push(`"${dc.dateColumn}" <= $${params.length}`);
            }

            if (conditions.length > 0) {
                query += ` WHERE ${conditions.join(' AND ')}`;
            }

            try {
                const rows = await manager.query(query, params);

                for (const row of rows) {
                    const normalized: IRawRow = {};
                    for (const [colName, value] of Object.entries(row)) {
                        const match = colMap[colName];
                        if (match) {
                            normalized[match] = value;
                        } else {
                            normalized[colName] = value;
                        }
                    }
                    allRows.push(normalized);
                }
            } catch (err: any) {
                console.warn(`[AttributionDataIntegration] Query failed for ${dc.fullTableName}:`, err.message);
            }
        }

        return allRows;
    }

    // -----------------------------------------------------------------------
    // Touchpoint & Journey Building
    // -----------------------------------------------------------------------

    /**
     * Build touchpoints from raw data rows.
     * Maps dimension columns to channels and campaigns, KPI columns to metrics.
     */
    private buildTouchpoints(rows: IRawRow[]): ITouchpoint[] {
        const touchpoints: ITouchpoint[] = [];

        for (let i = 0; i < rows.length; i++) {
            const row = rows[i];

            // Determine channel from dimension columns
            const channel = this.resolveChannel(row);
            const campaign = this.resolveCampaign(row);
            const campaignId = row['campaign_id'] || row['campaign'] || campaign;

            // Date
            const dateVal = row['date'];
            const date = dateVal ? new Date(dateVal) : new Date();

            // KPI values
            const spend = this.toNumber(row['spend'] ?? 0);
            const clicks = this.toNumber(row['clicks'] ?? 0);
            const impressions = this.toNumber(row['impressions'] ?? 0);
            const conversions = this.toNumber(row['conversions'] ?? 0);
            const revenue = this.toNumber(row['revenue'] ?? 0);

            // Synthetic user ID for path building (uses campaign + index as proxy)
            const userId = row['user_id'] || row['session_id'] || row['visitor_id'] || `row_${i}`;

            // Determine event types present
            if (impressions > 0) {
                touchpoints.push({
                    channel,
                    campaign,
                    campaignId,
                    date,
                    spend: spend * (impressions / Math.max(impressions + clicks + conversions, 1)),
                    conversions: 0,
                    revenue: 0,
                    userId: `${userId}_imp`,
                    eventType: 'impression',
                });
            }

            if (clicks > 0) {
                touchpoints.push({
                    channel,
                    campaign,
                    campaignId,
                    date,
                    spend: spend * (clicks / Math.max(impressions + clicks + conversions, 1)),
                    conversions: 0,
                    revenue: 0,
                    userId: `${userId}_click`,
                    eventType: 'click',
                });
            }

            if (conversions > 0) {
                touchpoints.push({
                    channel,
                    campaign,
                    campaignId,
                    date,
                    spend: spend * (conversions / Math.max(impressions + clicks + conversions, 1)),
                    conversions,
                    revenue,
                    userId: `${userId}_conv`,
                    eventType: 'conversion',
                });
            }

            // If no specific KPIs, still create a row-level touchpoint
            if (impressions === 0 && clicks === 0 && conversions === 0) {
                touchpoints.push({
                    channel,
                    campaign,
                    campaignId,
                    date,
                    spend,
                    conversions: 0,
                    revenue,
                    userId: `${userId}_gen`,
                    eventType: 'interaction',
                });
            }
        }

        return touchpoints;
    }

    /**
     * Build journeys by grouping touchpoints by userId and sorting by date.
     * A "journey" is the sequence of touchpoints for a single user leading to a conversion.
     */
    private buildJourneys(touchpoints: ITouchpoint[]): IJourney[] {
        // Group by user
        const userMap = new Map<string, ITouchpoint[]>();
        for (const tp of touchpoints) {
            const key = tp.userId;
            if (!userMap.has(key)) userMap.set(key, []);
            userMap.get(key)!.push(tp);
        }

        const journeys: IJourney[] = [];

        for (const [userId, userTouchpoints] of userMap) {
            // Sort by date ascending
            userTouchpoints.sort((a, b) => a.date.getTime() - b.date.getTime());

            // Find conversion touchpoints
            const conversionTps = userTouchpoints.filter(tp => tp.conversions > 0 || tp.eventType === 'conversion');

            const conversionDate = conversionTps.length > 0
                ? conversionTps[conversionTps.length - 1].date
                : null;

            const conversionValue = conversionTps.reduce((sum, tp) => sum + tp.revenue, 0);

            journeys.push({
                userId,
                touchpoints: userTouchpoints,
                conversionDate,
                conversionValue,
                firstTouchDate: userTouchpoints[0].date,
            });
        }

        return journeys;
    }

    // -----------------------------------------------------------------------
    // Attribution Models
    // -----------------------------------------------------------------------

    /**
     * Apply attribution model to journeys and return per-channel attributed conversions & revenue.
     */
    private applyAttributionModel(journeys: IJourney[], model: AttributionModel): Map<string, { conversions: number; revenue: number }> {
        const channelCredits = new Map<string, { conversions: number; revenue: number }>();

        for (const journey of journeys) {
            const tps = journey.touchpoints;
            if (tps.length === 0) continue;

            // Only attribute to journeys with conversions
            const hasConversion = tps.some(tp => tp.conversions > 0 || tp.eventType === 'conversion');
            if (!hasConversion && journey.conversionValue <= 0) continue;

            // Get unique channel sequence (deduplicate consecutive same-channel)
            const uniqueChannelTps: ITouchpoint[] = [];
            for (const tp of tps) {
                if (uniqueChannelTps.length === 0 || uniqueChannelTps[uniqueChannelTps.length - 1].channel !== tp.channel) {
                    uniqueChannelTps.push(tp);
                }
            }

            const totalConversions = Math.max(
                tps.reduce((s, tp) => s + tp.conversions, 0),
                1
            );
            const totalRevenue = journey.conversionValue > 0
                ? journey.conversionValue
                : tps.reduce((s, tp) => s + tp.revenue, 0);

            switch (model) {
                case 'first_touch': {
                    const ch = uniqueChannelTps[0].channel;
                    this.addCredit(channelCredits, ch, totalConversions, totalRevenue);
                    break;
                }

                case 'last_touch': {
                    const ch = uniqueChannelTps[uniqueChannelTps.length - 1].channel;
                    this.addCredit(channelCredits, ch, totalConversions, totalRevenue);
                    break;
                }

                case 'linear': {
                    const share = 1 / uniqueChannelTps.length;
                    for (const tp of uniqueChannelTps) {
                        this.addCredit(channelCredits, tp.channel, totalConversions * share, totalRevenue * share);
                    }
                    break;
                }

                case 'time_decay': {
                    const conversionDate = journey.conversionDate || tps[tps.length - 1].date;
                    const weights: number[] = uniqueChannelTps.map(tp => {
                        const daysDiff = Math.max(0, (conversionDate.getTime() - tp.date.getTime()) / (1000 * 60 * 60 * 24));
                        return Math.pow(0.5, daysDiff / TIME_DECAY_HALF_LIFE_DAYS);
                    });
                    const totalWeight = weights.reduce((s, w) => s + w, 0);
                    if (totalWeight > 0) {
                        for (let i = 0; i < uniqueChannelTps.length; i++) {
                            const share = weights[i] / totalWeight;
                            this.addCredit(channelCredits, uniqueChannelTps[i].channel, totalConversions * share, totalRevenue * share);
                        }
                    }
                    break;
                }

                case 'u_shaped': {
                    if (uniqueChannelTps.length === 1) {
                        this.addCredit(channelCredits, uniqueChannelTps[0].channel, totalConversions, totalRevenue);
                    } else if (uniqueChannelTps.length === 2) {
                        this.addCredit(channelCredits, uniqueChannelTps[0].channel, totalConversions * 0.5, totalRevenue * 0.5);
                        this.addCredit(channelCredits, uniqueChannelTps[1].channel, totalConversions * 0.5, totalRevenue * 0.5);
                    } else {
                        // 40% first, 40% last, 20% distributed among middle
                        this.addCredit(channelCredits, uniqueChannelTps[0].channel, totalConversions * 0.4, totalRevenue * 0.4);
                        this.addCredit(channelCredits, uniqueChannelTps[uniqueChannelTps.length - 1].channel, totalConversions * 0.4, totalRevenue * 0.4);
                        const middleShare = 0.2 / (uniqueChannelTps.length - 2);
                        for (let i = 1; i < uniqueChannelTps.length - 1; i++) {
                            this.addCredit(channelCredits, uniqueChannelTps[i].channel, totalConversions * middleShare, totalRevenue * middleShare);
                        }
                    }
                    break;
                }
            }
        }

        return channelCredits;
    }

    private addCredit(map: Map<string, { conversions: number; revenue: number }>, channel: string, conversions: number, revenue: number) {
        const existing = map.get(channel) || { conversions: 0, revenue: 0 };
        existing.conversions += conversions;
        existing.revenue += revenue;
        map.set(channel, existing);
    }

    // -----------------------------------------------------------------------
    // Conversion Path Detection
    // -----------------------------------------------------------------------

    /**
     * Build conversion paths by grouping touchpoints by user and extracting
     * ordered channel sequences. Then aggregate common paths.
     */
    private detectConversionPaths(journeys: IJourney[], limit: number = 10): IConversionPath[] {
        const pathMap = new Map<string, { frequency: number; conversions: number }>();

        for (const journey of journeys) {
            const hasConversion = journey.touchpoints.some(tp => tp.conversions > 0 || tp.eventType === 'conversion');
            if (!hasConversion && journey.conversionValue <= 0) continue;

            // Build unique channel sequence
            const channelSequence: string[] = [];
            for (const tp of journey.touchpoints) {
                if (channelSequence.length === 0 || channelSequence[channelSequence.length - 1] !== tp.channel) {
                    channelSequence.push(tp.channel);
                }
            }

            const pathKey = channelSequence.join(' → ');
            const existing = pathMap.get(pathKey) || { frequency: 0, conversions: 0 };
            existing.frequency += 1;
            existing.conversions += Math.max(
                journey.touchpoints.reduce((s, tp) => s + tp.conversions, 0),
                journey.conversionValue > 0 ? 1 : 0
            );
            pathMap.set(pathKey, existing);
        }

        // Sort by frequency descending and take top N
        const sorted = Array.from(pathMap.entries())
            .sort((a, b) => b[1].frequency - a[1].frequency)
            .slice(0, limit);

        return sorted.map(([pathStr, data]) => ({
            path: pathStr.split(' → '),
            frequency: data.frequency,
            conversions: data.conversions,
        }));
    }

    // -----------------------------------------------------------------------
    // Time to Conversion
    // -----------------------------------------------------------------------

    /**
     * Calculate time-to-conversion from first touch to conversion timestamp.
     */
    private calculateTimeToConversion(journeys: IJourney[]): ITimeToConversion {
        const convertingJourneys = journeys.filter(j => j.conversionDate !== null);
        const dayDiffs: number[] = [];

        for (const journey of convertingJourneys) {
            if (!journey.conversionDate) continue;
            const diffMs = journey.conversionDate.getTime() - journey.firstTouchDate.getTime();
            const diffDays = Math.max(0, diffMs / (1000 * 60 * 60 * 24));
            dayDiffs.push(diffDays);
        }

        if (dayDiffs.length === 0) {
            return {
                average: 0,
                median: 0,
                min: 0,
                max: 0,
                distribution: [],
            };
        }

        dayDiffs.sort((a, b) => a - b);

        const average = dayDiffs.reduce((s, d) => s + d, 0) / dayDiffs.length;
        const median = dayDiffs.length % 2 === 0
            ? (dayDiffs[dayDiffs.length / 2 - 1] + dayDiffs[dayDiffs.length / 2]) / 2
            : dayDiffs[Math.floor(dayDiffs.length / 2)];
        const min = dayDiffs[0];
        const max = dayDiffs[dayDiffs.length - 1];

        // Build distribution buckets
        const buckets = [
            { label: '0 days', min: 0, max: 0.99 },
            { label: '1-3 days', min: 1, max: 3 },
            { label: '4-7 days', min: 4, max: 7 },
            { label: '8-14 days', min: 8, max: 14 },
            { label: '15-30 days', min: 15, max: 30 },
            { label: '31-60 days', min: 31, max: 60 },
            { label: '60+ days', min: 61, max: Infinity },
        ];

        const distribution = buckets.map(bucket => ({
            label: bucket.label,
            count: dayDiffs.filter(d => d >= bucket.min && d <= bucket.max).length,
        }));

        return { average, median, min, max, distribution };
    }

    // -----------------------------------------------------------------------
    // ROI by Channel
    // -----------------------------------------------------------------------

    /**
     * Calculate ROI by channel using actual spend data from touchpoints and
     * attribution-weighted conversions/revenue.
     */
    private calculateROIByChannel(
        touchpoints: ITouchpoint[],
        channelAttribution: Map<string, { conversions: number; revenue: number }>,
    ): IAttributionROI[] {
        // Aggregate actual spend per channel
        const channelSpend = new Map<string, number>();
        for (const tp of touchpoints) {
            const existing = channelSpend.get(tp.channel) || 0;
            channelSpend.set(tp.channel, existing + tp.spend);
        }

        // Merge with attribution data
        const allChannels = new Set([
            ...channelSpend.keys(),
            ...channelAttribution.keys(),
        ]);

        const roi: IAttributionROI[] = [];
        for (const channel of allChannels) {
            const spend = channelSpend.get(channel) || 0;
            const attr = channelAttribution.get(channel) || { conversions: 0, revenue: 0 };
            const attributedROAS = spend > 0 ? attr.revenue / spend : 0;

            roi.push({
                channel,
                spend,
                attributedConversions: attr.conversions,
                attributedRevenue: attr.revenue,
                attributedROAS,
            });
        }

        return roi.sort((a, b) => b.attributedRevenue - a.attributedRevenue);
    }

    // -----------------------------------------------------------------------
    // AI Insights
    // -----------------------------------------------------------------------

    /**
     * Generate AI insights from attribution data using available AI service.
     * Falls back to rule-based insights when AI is unavailable.
     */
    private async generateAIInsights(
        model: AttributionModel,
        channelAttribution: IChannelAttribution[],
        conversionPaths: IConversionPath[],
        timeToConversion: ITimeToConversion,
        roiByChannel: IAttributionROI[],
    ): Promise<string> {
        try {
            // Try Gemini API directly if GEMINI_API_KEY is available
            const geminiKey = process.env.GEMINI_API_KEY;
            if (geminiKey) {
                const topChannels = channelAttribution.slice(0, 5).map(c =>
                    `${c.channel}: ${c.conversionShare.toFixed(1)}% share, $${c.attributedRevenue.toFixed(0)} revenue, ${c.attributedROAS.toFixed(2)}x ROAS`
                ).join('\n');

                const topPaths = conversionPaths.slice(0, 3).map(p =>
                    `${p.path.join(' → ')}: ${p.frequency} occurrences, ${p.conversions} conversions`
                ).join('\n');

                const topROI = roiByChannel.slice(0, 5).map(r =>
                    `${r.channel}: $${r.spend.toFixed(0)} spend, $${r.attributedRevenue.toFixed(0)} attributed revenue, ${r.attributedROAS.toFixed(2)}x ROAS`
                ).join('\n');

                const prompt = `Analyze the following multi-touch attribution data and provide actionable marketing insights.

Attribution Model: ${model}

Channel Attribution:
${topChannels}

Top Conversion Paths:
${topPaths}

ROI by Channel:
${topROI}

Time to Conversion: Average ${timeToConversion.average.toFixed(1)} days, Median ${timeToConversion.median.toFixed(1)} days

Provide 3-5 concise, specific insights about:
1. Which channels are performing best/worst under this attribution model
2. Patterns in conversion paths
3. Recommendations for budget allocation based on attribution-weighted ROI
4. Any concerning trends

Keep each insight to 1-2 sentences. Be specific with numbers and channel names.`;

                const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${geminiKey}`;
                const response = await fetch(url, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        contents: [{ parts: [{ text: prompt }] }],
                    }),
                });

                const result = (await response.json()) as any;
                const text = result?.candidates?.[0]?.content?.parts?.[0]?.text;
                if (text) return text;
            }
        } catch (err: any) {
            console.warn('[AttributionDataIntegration] AI insights generation failed:', err.message);
        }

        return this.generateFallbackInsights(model, channelAttribution, conversionPaths, roiByChannel);
    }

    /**
     * Generate rule-based fallback insights when AI is unavailable.
     */
    private generateFallbackInsights(
        model: AttributionModel,
        channelAttribution: IChannelAttribution[],
        conversionPaths: IConversionPath[],
        roiByChannel: IAttributionROI[],
    ): string {
        const insights: string[] = [];

        if (channelAttribution.length > 0) {
            const topChannel = channelAttribution[0];
            const modelLabel = model.replace(/_/g, ' ');
            insights.push(
                `Under the ${modelLabel} model, ${topChannel.channel} leads with ${topChannel.conversionShare.toFixed(1)}% of attributed conversions and $${topChannel.attributedRevenue.toFixed(0)} in attributed revenue.`
            );

            if (channelAttribution.length > 1) {
                const bottomChannel = channelAttribution[channelAttribution.length - 1];
                insights.push(
                    `${bottomChannel.channel} has the lowest attribution share at ${bottomChannel.conversionShare.toFixed(1)}%, suggesting it may play a lesser role in the conversion journey.`
                );
            }
        }

        if (conversionPaths.length > 0) {
            const topPath = conversionPaths[0];
            insights.push(
                `The most common conversion path is ${topPath.path.join(' → ')} with ${topPath.frequency} occurrences and ${topPath.conversions} conversions.`
            );
        }

        const highROAS = roiByChannel.filter(r => r.attributedROAS > 3);
        if (highROAS.length > 0) {
            insights.push(
                `High-ROAS channels: ${highROAS.map(r => `${r.channel} (${r.attributedROAS.toFixed(1)}x)`).join(', ')}. Consider increasing budget allocation.`
            );
        }

        const lowROAS = roiByChannel.filter(r => r.attributedROAS < 1 && r.spend > 0);
        if (lowROAS.length > 0) {
            insights.push(
                `Below-break-even channels: ${lowROAS.map(r => `${r.channel} (${r.attributedROAS.toFixed(1)}x)`).join(', ')}. Review targeting and creative.`
            );
        }

        return insights.join(' ');
    }

    // -----------------------------------------------------------------------
    // Helpers
    // -----------------------------------------------------------------------

    /**
     * Resolve channel name from dimension columns.
     */
    private resolveChannel(row: IRawRow): string {
        // Check various dimension matches
        for (const key of ['channel', 'source', 'medium', 'platform', 'network', 'ad_network']) {
            if (row[key] && typeof row[key] === 'string' && row[key].trim()) {
                return this.normalizeChannel(row[key]);
            }
        }

        // Check campaign name for hints
        const campaignName = row['campaign_name'] || row['campaign'] || '';
        if (typeof campaignName === 'string') {
            const lower = campaignName.toLowerCase();
            if (lower.includes('google') || lower.includes('gads')) return 'Google Ads';
            if (lower.includes('meta') || lower.includes('facebook') || lower.includes('fb')) return 'Meta Ads';
            if (lower.includes('linkedin') || lower.includes('li')) return 'LinkedIn Ads';
            if (lower.includes('email') || lower.includes('newsletter')) return 'Email';
        }

        return 'Unknown';
    }

    /**
     * Normalize channel names to consistent labels.
     */
    private normalizeChannel(raw: string): string {
        const lower = raw.toLowerCase().trim();

        if (lower.includes('google') || lower.includes('gads') || lower.includes('adwords') || lower.includes('gad')) return 'Google Ads';
        if (lower.includes('meta') || lower.includes('facebook') || lower.includes('fb') || lower.includes('instagram')) return 'Meta Ads';
        if (lower.includes('linkedin') || lower.includes('li')) return 'LinkedIn Ads';
        if (lower.includes('email') || lower.includes('newsletter') || lower.includes('klaviyo') || lower.includes('hubspot')) return 'Email';
        if (lower.includes('organic') || lower.includes('seo')) return 'Organic Search';
        if (lower.includes('direct')) return 'Direct';
        if (lower.includes('referral')) return 'Referral';
        if (lower.includes('display')) return 'Display';
        if (lower.includes('cpc') || lower.includes('paid') || lower.includes('ppc')) return 'Paid Search';
        if (lower.includes('social')) return 'Social';

        // Capitalize first letter
        return raw.charAt(0).toUpperCase() + raw.slice(1).toLowerCase();
    }

    /**
     * Resolve campaign name from dimension columns.
     */
    private resolveCampaign(row: IRawRow): string {
        for (const key of ['campaign_name', 'campaign', 'ad_group', 'ad_group_name']) {
            if (row[key] && typeof row[key] === 'string' && row[key].trim()) {
                return row[key];
            }
        }
        return 'Unknown Campaign';
    }

    /**
     * Safely convert a value to a number.
     */
    private toNumber(val: any): number {
        if (typeof val === 'number') return val;
        if (typeof val === 'string') {
            const cleaned = val.replace(/[$,]/g, '');
            const num = parseFloat(cleaned);
            return isNaN(num) ? 0 : num;
        }
        return 0;
    }

    // -----------------------------------------------------------------------
    // Main Analyze Method
    // -----------------------------------------------------------------------

    /**
     * Analyze attribution data for a data model using the specified attribution model.
     *
     * This is the main entry point for POST /attribution/analyze.
     *
     * @param request - The analysis request containing data_model_id, attribution_model, and date_range
     * @returns Full attribution analysis including channel attribution, conversion paths,
     *          time-to-conversion, ROI by channel, and AI insights
     */
    public async analyze(request: IAnalyzeRequest): Promise<IAnalyzeResponse> {
        const { data_model_id, attribution_model, date_range } = request;

        // Validate inputs
        const validModels: AttributionModel[] = ['first_touch', 'last_touch', 'linear', 'time_decay', 'u_shaped'];
        if (!validModels.includes(attribution_model)) {
            throw new Error(`Invalid attribution model: ${attribution_model}. Must be one of: ${validModels.join(', ')}`);
        }

        if (!date_range || !date_range.start || !date_range.end) {
            throw new Error('Date range with start and end dates is required');
        }

        // 1. Discover columns from data model
        const discovered = await this.discoverColumns(data_model_id);

        // 2. Fetch raw data from connected sources
        const rawRows = await this.fetchRawData(discovered, date_range.start, date_range.end);

        // If no data, return empty response
        if (rawRows.length === 0) {
            return {
                channelAttribution: [],
                conversionPaths: [],
                timeToConversion: { average: 0, median: 0, min: 0, max: 0, distribution: [] },
                roiByChannel: [],
                aiInsights: 'No data available for the selected date range. Connect a data source with marketing campaign data to enable attribution analysis.',
            };
        }

        // 3. Build touchpoints from raw data
        const touchpoints = this.buildTouchpoints(rawRows);

        // 4. Build journeys (group touchpoints by user/session)
        const journeys = this.buildJourneys(touchpoints);

        // 5. Apply attribution model
        const channelCredits = this.applyAttributionModel(journeys, attribution_model);

        // 6. Build channel attribution response
        const totalAttributedConversions = Array.from(channelCredits.values())
            .reduce((s, c) => s + c.conversions, 0);

        const channelAttribution: IChannelAttribution[] = Array.from(channelCredits.entries())
            .map(([channel, credits]) => ({
                channel,
                attributedConversions: credits.conversions,
                attributedRevenue: credits.revenue,
                attributedROAS: 0, // Will be calculated with spend data
                conversionShare: totalAttributedConversions > 0
                    ? (credits.conversions / totalAttributedConversions) * 100
                    : 0,
            }))
            .sort((a, b) => b.attributedConversions - a.attributedConversions);

        // 7. Calculate ROI by channel
        const roiByChannel = this.calculateROIByChannel(touchpoints, channelCredits);

        // Update channelAttribution with ROAS from ROI data
        const spendMap = new Map(roiByChannel.map(r => [r.channel, r.spend]));
        for (const ca of channelAttribution) {
            const spend = spendMap.get(ca.channel) || 0;
            ca.attributedROAS = spend > 0 ? ca.attributedRevenue / spend : 0;
        }

        // 8. Detect conversion paths
        const conversionPaths = this.detectConversionPaths(journeys);

        // 9. Calculate time-to-conversion
        const timeToConversion = this.calculateTimeToConversion(journeys);

        // 10. Generate AI insights
        const aiInsights = await this.generateAIInsights(
            attribution_model,
            channelAttribution,
            conversionPaths,
            timeToConversion,
            roiByChannel,
        );

        return {
            channelAttribution,
            conversionPaths,
            timeToConversion,
            roiByChannel,
            aiInsights,
        };
    }
}