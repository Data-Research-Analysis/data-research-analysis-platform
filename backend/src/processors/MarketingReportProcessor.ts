import { DBDriver } from '../drivers/DBDriver.js';
import { EDataSourceType } from '../types/EDataSourceType.js';
import { DRADataSource } from '../models/DRADataSource.js';
import { DRATableMetadata } from '../models/DRATableMetadata.js';
import { DRACampaign } from '../models/DRACampaign.js';
import { DRACampaignChannel } from '../models/DRACampaignChannel.js';
import { DRACampaignOfflineData } from '../models/DRACampaignOfflineData.js';
import { In } from 'typeorm';

// ---------------------------------------------------------------------------
// Interfaces
// ---------------------------------------------------------------------------

export interface IChannelMetrics {
    channelType: string;
    channelLabel: string;
    spend: number;
    impressions: number;
    clicks: number;
    ctr: number;
    conversions: number;
    cpl: number;
    roas: number;
    pipelineValue: number;
    dataSourceId: number | null;
}

export interface IMarketingTotals {
    spend: number;
    impressions: number;
    clicks: number;
    conversions: number;
    cpl: number;
    pipelineValue: number;
}

export interface IWeeklyTrendPoint {
    weekStart: string;
    byChannel: Record<string, number>;
}

export interface IMarketingHubSummary {
    channels: IChannelMetrics[];
    totals: IMarketingTotals;
    priorPeriodTotals: IMarketingTotals;
    weeklyTrend: IWeeklyTrendPoint[];
}

export interface ITopCampaign {
    campaignId: string;       // platform campaign ID or name-based key
    campaignName: string;
    status: string;
    platform: string;         // 'google_ads' | 'linkedin_ads' | 'meta_ads'
    spend: number;
    impressions: number;
    clicks: number;
    conversions: number;
    cpl: number;
}

// ---------------------------------------------------------------------------
// Channel meta
// ---------------------------------------------------------------------------

const AD_CHANNEL_TYPES = [
    EDataSourceType.GOOGLE_ADS,
    EDataSourceType.META_ADS,
    EDataSourceType.LINKEDIN_ADS,
    EDataSourceType.GOOGLE_ANALYTICS,
    EDataSourceType.HUBSPOT,
    EDataSourceType.KLAVIYO,
] as string[];

const CHANNEL_LABELS: Record<string, string> = {
    google_ads: 'Google Ads',
    meta_ads: 'Meta Ads',
    linkedin_ads: 'LinkedIn Ads',
    google_analytics: 'Google Analytics (GA4)',
    hubspot: 'HubSpot CRM',
    klaviyo: 'Klaviyo Email',
};

// ---------------------------------------------------------------------------
// Processor
// ---------------------------------------------------------------------------

export class MarketingReportProcessor {
    private static instance: MarketingReportProcessor;
    private constructor() {}

    public static getInstance(): MarketingReportProcessor {
        if (!MarketingReportProcessor.instance) {
            MarketingReportProcessor.instance = new MarketingReportProcessor();
        }
        return MarketingReportProcessor.instance;
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

    // -----------------------------------------------------------------------
    // Public API
    // -----------------------------------------------------------------------

    /**
     * Main hub summary — aggregates all connected ad channels for a project.
     */
    public async getMarketingHubSummary(
        projectId: number,
        startDate: Date,
        endDate: Date,
        campaignId?: number,
    ): Promise<IMarketingHubSummary> {
        const manager = await this.getManager();

        // 1. Load all ad data sources for the project
        const allSources: DRADataSource[] = await manager.find(DRADataSource, {
            where: {
                project: { id: projectId } as any,
                data_type: In(AD_CHANNEL_TYPES) as any,
            },
            relations: ['project'],
        });

        // 2. If a campaign filter is provided, restrict to sources linked to that campaign
        let allowedSourceIds: Set<number> | null = null;
        if (campaignId) {
            const channels: DRACampaignChannel[] = await manager.find(DRACampaignChannel, {
                where: { campaign_id: campaignId },
            });
            allowedSourceIds = new Set(
                channels
                    .filter(c => c.data_source_id !== null)
                    .map(c => c.data_source_id as number),
            );
        }

        const sources = allowedSourceIds
            ? allSources.filter(s => allowedSourceIds!.has(s.id))
            : allSources;

        // 3. Build current-period and prior-period channel metrics
        const periodMs = endDate.getTime() - startDate.getTime();
        const priorStart = new Date(startDate.getTime() - periodMs);
        const priorEnd = new Date(startDate.getTime() - 86_400_000); // day before startDate

        const channels: IChannelMetrics[] = [];
        const priorChannels: IChannelMetrics[] = [];

        for (const source of sources) {
            const current = await this.fetchChannelMetrics(manager, source, startDate, endDate);
            const prior = await this.fetchChannelMetrics(manager, source, priorStart, priorEnd);
            if (current) {
                channels.push(current);
                if (prior) priorChannels.push(prior);
            }
        }

        // 4. Add offline channel spend if campaignId provided
        if (campaignId) {
            const offlineMetrics = await this.fetchOfflineMetrics(manager, campaignId, startDate, endDate);
            channels.push(...offlineMetrics);
            const priorOffline = await this.fetchOfflineMetrics(manager, campaignId, priorStart, priorEnd);
            priorChannels.push(...priorOffline);
        }

        // 5. Compute totals
        const totals = this.computeTotals(channels);
        const priorPeriodTotals = this.computeTotals(priorChannels);

        // 6. Weekly trend
        const weeklyTrend = await this.buildWeeklyTrend(manager, sources, startDate, endDate, campaignId);

        return { channels, totals, priorPeriodTotals, weeklyTrend };
    }

    /**
     * Top campaigns by spend for a project.
     */
    public async getTopCampaigns(
        projectId: number,
        startDate: Date,
        endDate: Date,
        limit = 5,
    ): Promise<ITopCampaign[]> {
        const manager = await this.getManager();

        const googleAdsSources: DRADataSource[] = await manager.find(DRADataSource, {
            where: { project: { id: projectId } as any, data_type: EDataSourceType.GOOGLE_ADS as any },
            relations: ['project'],
        });

        const start = startDate.toISOString().split('T')[0];
        const end = endDate.toISOString().split('T')[0];

        const rows: Array<{
            campaign_id: string;
            campaign_name: string;
            campaign_status: string;
            platform: string;
            spend: number;
            impressions: number;
            clicks: number;
            conversions: number;
        }> = [];

        // ── Google Ads ────────────────────────────────────────────────────
        for (const source of googleAdsSources) {
            const tables = await this.getPhysicalTables(manager, source.id, 'campaigns', 'dra_google_ads');
            for (const { fullName } of tables) {
                try {
                    const data = await manager.query(
                        `SELECT COALESCE(campaign_id::text, campaign_name) AS campaign_id,
                                campaign_name,
                                campaign_status,
                                'google_ads'             AS platform,
                                COALESCE(SUM(cost), 0)          AS spend,
                                COALESCE(SUM(impressions), 0)   AS impressions,
                                COALESCE(SUM(clicks), 0)        AS clicks,
                                COALESCE(SUM(conversions), 0)   AS conversions
                         FROM ${fullName}
                         WHERE date BETWEEN $1 AND $2
                         GROUP BY campaign_id, campaign_name, campaign_status
                         ORDER BY spend DESC
                         LIMIT $3`,
                        [start, end, limit],
                    );
                    rows.push(...data);
                } catch {
                    // Table may not exist yet
                }
            }
        }

        // ── LinkedIn Ads ──────────────────────────────────────────────────
        const linkedInSources: DRADataSource[] = await manager.find(DRADataSource, {
            where: { project: { id: projectId } as any, data_type: EDataSourceType.LINKEDIN_ADS as any },
            relations: ['project'],
        });

        for (const source of linkedInSources) {
            const campaignTables = await this.getPhysicalTables(manager, source.id, 'campaigns', 'dra_linkedin_ads');
            const analyticsTables = await this.getPhysicalTables(manager, source.id, 'campaign_analytics', 'dra_linkedin_ads');

            if (campaignTables.length === 0 || analyticsTables.length === 0) continue;

            const campaignTable = campaignTables[0].fullName;
            const analyticsTable = analyticsTables[0].fullName;

            try {
                const data = await manager.query(
                    `SELECT
                        c.id::text                                       AS campaign_id,
                        c.name                                           AS campaign_name,
                        c.status                                         AS campaign_status,
                        'linkedin_ads'                                   AS platform,
                        COALESCE(SUM(COALESCE(a.cost_local, a.cost_usd)), 0) AS spend,
                        COALESCE(SUM(a.impressions), 0)                  AS impressions,
                        COALESCE(SUM(a.clicks), 0)                       AS clicks,
                        COALESCE(SUM(a.external_conversions), 0)         AS conversions
                     FROM ${campaignTable} c
                     INNER JOIN ${analyticsTable} a ON c.id::text = a.entity_id
                     WHERE a.date_start BETWEEN $1 AND $2
                     GROUP BY c.id, c.name, c.status
                     ORDER BY spend DESC
                     LIMIT $3`,
                    [start, end, limit],
                );
                rows.push(...data);
            } catch {
                // Table may not exist yet or sync in progress
            }
        }

        // ── Meta Ads ──────────────────────────────────────────────────────
        const metaSources: DRADataSource[] = await manager.find(DRADataSource, {
            where: { project: { id: projectId } as any, data_type: EDataSourceType.META_ADS as any },
            relations: ['project'],
        });

        for (const source of metaSources) {
            const campaignTables = await this.getPhysicalTables(manager, source.id, 'campaigns', 'dra_meta_ads');
            const insightsTables = await this.getPhysicalTables(manager, source.id, 'insights', 'dra_meta_ads');

            if (campaignTables.length === 0 || insightsTables.length === 0) continue;

            const campaignTable = campaignTables[0].fullName;
            const insightsTable = insightsTables[0].fullName;

            try {
                const data = await manager.query(
                    `SELECT
                        c.id                                AS campaign_id,
                        c.name                              AS campaign_name,
                        c.status                            AS campaign_status,
                        'meta_ads'                          AS platform,
                        COALESCE(SUM(i.spend), 0)           AS spend,
                        COALESCE(SUM(i.impressions), 0)     AS impressions,
                        COALESCE(SUM(i.clicks), 0)          AS clicks,
                        COALESCE(SUM(i.conversions), 0)     AS conversions
                     FROM ${campaignTable} c
                     INNER JOIN ${insightsTable} i ON c.id = i.campaign_id
                     WHERE i.date_start BETWEEN $1 AND $2
                     GROUP BY c.id, c.name, c.status
                     ORDER BY spend DESC
                     LIMIT $3`,
                    [start, end, limit],
                );
                rows.push(...data);
            } catch {
                // Skip if tables not synced yet
            }
        }

        // ── Merge and sort (cross-platform deduplication) ─────────────────
        const merged = new Map<string, {
            campaign_id: string;
            campaign_name: string;
            campaign_status: string;
            platform: string;
            spend: number;
            impressions: number;
            clicks: number;
            conversions: number;
        }>();

        for (const r of rows) {
            const key = `${r.platform ?? 'google_ads'}::${r.campaign_id || r.campaign_name}`;
            const existing = merged.get(key);
            if (existing) {
                existing.spend       += Number(r.spend) || 0;
                existing.impressions += Number(r.impressions) || 0;
                existing.clicks      += Number(r.clicks) || 0;
                existing.conversions += Number(r.conversions) || 0;
            } else {
                merged.set(key, {
                    ...r,
                    spend:       Number(r.spend) || 0,
                    impressions: Number(r.impressions) || 0,
                    clicks:      Number(r.clicks) || 0,
                    conversions: Number(r.conversions) || 0,
                });
            }
        }

        return Array.from(merged.values())
            .sort((a, b) => b.spend - a.spend)
            .slice(0, limit)
            .map(r => ({
                campaignId:   r.campaign_id || r.campaign_name,
                campaignName: r.campaign_name || 'Unknown',
                status:       r.campaign_status || 'unknown',
                platform:     r.platform,
                spend:        r.spend,
                impressions:  r.impressions,
                clicks:       r.clicks,
                conversions:  r.conversions,
                cpl:          r.conversions > 0 ? r.spend / r.conversions : 0,
            }));
    }

    /**
     * Total digital spend for a specific campaign (used by Budget vs Digital chart).
     */
    public async getDigitalSpendForCampaign(
        campaignId: number,
        startDate: Date,
        endDate: Date,
    ): Promise<number> {
        const manager = await this.getManager();

        const channels: DRACampaignChannel[] = await manager.find(DRACampaignChannel, {
            where: { campaign_id: campaignId },
        });

        const digitalSourceIds = channels
            .filter(c => !c.is_offline && c.data_source_id !== null)
            .map(c => c.data_source_id as number);

        if (digitalSourceIds.length === 0) return 0;

        const sources: DRADataSource[] = await manager.findBy(DRADataSource, {
            id: In(digitalSourceIds) as any,
        });

        let totalSpend = 0;
        for (const source of sources) {
            const metrics = await this.fetchChannelMetrics(manager, source, startDate, endDate);
            if (metrics) totalSpend += metrics.spend;
        }

        return totalSpend;
    }

    // -----------------------------------------------------------------------
    // Private helpers
    // -----------------------------------------------------------------------

    /**
     * Fetch normalised metrics for a single data source.
     * Returns null if no table exists or no data found.
     */
    private async fetchChannelMetrics(
        manager: any,
        source: DRADataSource,
        startDate: Date,
        endDate: Date,
    ): Promise<IChannelMetrics | null> {
        const start = startDate.toISOString().split('T')[0];
        const end = endDate.toISOString().split('T')[0];

        try {
            switch (source.data_type) {
                case EDataSourceType.GOOGLE_ADS:
                    return await this.fetchGoogleAdsMetrics(manager, source, start, end);
                case EDataSourceType.META_ADS:
                    return await this.fetchMetaAdsMetrics(manager, source, start, end);
                case EDataSourceType.LINKEDIN_ADS:
                    return await this.fetchLinkedInAdsMetrics(manager, source, start, end);
                case EDataSourceType.GOOGLE_ANALYTICS:
                    return await this.fetchGA4Metrics(manager, source, start, end);
                case EDataSourceType.HUBSPOT:
                    return await this.fetchHubSpotMetrics(manager, source, start, end);
                case EDataSourceType.KLAVIYO:
                    return await this.fetchKlaviyoMetrics(manager, source, start, end);
                default:
                    return null;
            }
        } catch (err) {
            console.warn(`[MarketingReportProcessor] Could not fetch metrics for source ${source.id}:`, (err as Error).message);
            return null;
        }
    }

    private async fetchGoogleAdsMetrics(
        manager: any,
        source: DRADataSource,
        start: string,
        end: string,
    ): Promise<IChannelMetrics | null> {
        const tables = await this.getPhysicalTables(manager, source.id, 'campaigns', 'dra_google_ads');
        if (tables.length === 0) return null;

        let spend = 0, impressions = 0, clicks = 0, conversions = 0, convValue = 0;

        for (const { fullName } of tables) {
            try {
                const rows = await manager.query(
                    `SELECT COALESCE(SUM(cost), 0) AS spend,
                            COALESCE(SUM(impressions), 0) AS impressions,
                            COALESCE(SUM(clicks), 0) AS clicks,
                            COALESCE(SUM(conversions), 0) AS conversions,
                            COALESCE(SUM(conversion_value), 0) AS conv_value
                     FROM ${fullName}
                     WHERE date BETWEEN $1 AND $2`,
                    [start, end],
                );
                if (rows?.[0]) {
                    spend += Number(rows[0].spend) || 0;
                    impressions += Number(rows[0].impressions) || 0;
                    clicks += Number(rows[0].clicks) || 0;
                    conversions += Number(rows[0].conversions) || 0;
                    convValue += Number(rows[0].conv_value) || 0;
                }
            } catch {
                // Skip missing tables
            }
        }

        return this.buildMetrics(EDataSourceType.GOOGLE_ADS, source.id, spend, impressions, clicks, conversions, convValue);
    }

    private async fetchMetaAdsMetrics(
        manager: any,
        source: DRADataSource,
        start: string,
        end: string,
    ): Promise<IChannelMetrics | null> {
        const tables = await this.getPhysicalTables(manager, source.id, 'insights', 'dra_meta_ads');
        if (tables.length === 0) return null;

        let spend = 0, impressions = 0, clicks = 0, conversions = 0;

        for (const { fullName } of tables) {
            try {
                const rows = await manager.query(
                    `SELECT COALESCE(SUM(spend), 0) AS spend,
                            COALESCE(SUM(impressions), 0) AS impressions,
                            COALESCE(SUM(clicks), 0) AS clicks,
                            COALESCE(SUM(conversions), 0) AS conversions
                     FROM ${fullName}
                     WHERE date_start BETWEEN $1 AND $2`,
                    [start, end],
                );
                if (rows?.[0]) {
                    spend       += Number(rows[0].spend) || 0;
                    impressions += Number(rows[0].impressions) || 0;
                    clicks      += Number(rows[0].clicks) || 0;
                    conversions += Number(rows[0].conversions) || 0;
                }
            } catch {
                // Skip missing tables
            }
        }

        return this.buildMetrics(EDataSourceType.META_ADS, source.id, spend, impressions, clicks, conversions, 0);
    }

    private async fetchLinkedInAdsMetrics(
        manager: any,
        source: DRADataSource,
        start: string,
        end: string,
    ): Promise<IChannelMetrics | null> {
        const tables = await this.getPhysicalTables(manager, source.id, 'campaign_analytics', 'dra_linkedin_ads');
        if (tables.length === 0) return null;

        let spend = 0, impressions = 0, clicks = 0, conversions = 0;

        for (const { fullName } of tables) {
            try {
                const rows = await manager.query(
                    `SELECT COALESCE(SUM(COALESCE(cost_local, cost_usd)), 0) AS spend,
                            COALESCE(SUM(impressions), 0) AS impressions,
                            COALESCE(SUM(clicks), 0) AS clicks,
                            COALESCE(SUM(external_conversions), 0) AS conversions
                     FROM ${fullName}
                     WHERE date_start BETWEEN $1 AND $2`,
                    [start, end],
                );
                if (rows?.[0]) {
                    spend += Number(rows[0].spend) || 0;
                    impressions += Number(rows[0].impressions) || 0;
                    clicks += Number(rows[0].clicks) || 0;
                    conversions += Number(rows[0].conversions) || 0;
                }
            } catch {
                // Skip missing tables
            }
        }

        return this.buildMetrics(EDataSourceType.LINKEDIN_ADS, source.id, spend, impressions, clicks, conversions, 0);
    }

    private async fetchGA4Metrics(
        manager: any,
        source: DRADataSource,
        start: string,
        end: string,
    ): Promise<IChannelMetrics | null> {
        const tables = await this.getPhysicalTables(manager, source.id, 'traffic_overview', 'dra_google_analytics');
        if (tables.length === 0) return null;

        let sessions = 0, totalUsers = 0;

        for (const { fullName } of tables) {
            try {
                const rows = await manager.query(
                    `SELECT COALESCE(SUM(sessions), 0) AS sessions,
                            COALESCE(SUM(total_users), 0) AS total_users
                     FROM ${fullName}
                     WHERE date BETWEEN $1 AND $2`,
                    [start, end],
                );
                if (rows?.[0]) {
                    sessions += Number(rows[0].sessions) || 0;
                    totalUsers += Number(rows[0].total_users) || 0;
                }
            } catch {
                // Skip missing tables
            }
        }

        // GA4 row: spend = null → rendered as Web row in comparison table
        return {
            channelType: EDataSourceType.GOOGLE_ANALYTICS,
            channelLabel: CHANNEL_LABELS[EDataSourceType.GOOGLE_ANALYTICS],
            spend: 0,        // no spend data from GA4
            impressions: sessions,   // sessions mapped to impressions slot
            clicks: totalUsers,      // total users mapped to clicks slot
            ctr: 0,
            conversions: 0,
            cpl: 0,
            roas: 0,
            pipelineValue: 0,
            dataSourceId: source.id,
        };
    }

    /**
     * Fetch HubSpot CRM channel metrics — pipeline value from open deals.
     * Spend is always 0 (HubSpot is not a paid ad channel).
     * pipelineValue maps to getCurrentPipelineValue() rather than a date range query
     * because deal value represents current pipeline state, not spend for the period.
     */
    private async fetchHubSpotMetrics(
        manager: any,
        source: DRADataSource,
        start: string,
        end: string,
    ): Promise<IChannelMetrics | null> {
        try {
            const rows = await manager.query(
                `SELECT
                    COUNT(*) FILTER (WHERE is_closed_won = FALSE) AS open_deals,
                    COALESCE(SUM(amount) FILTER (WHERE is_closed_won = FALSE), 0) AS pipeline_value,
                    COUNT(*) FILTER (WHERE is_closed_won = TRUE
                        AND close_date BETWEEN $1 AND $2) AS closed_won_in_period,
                    COALESCE(SUM(amount) FILTER (WHERE is_closed_won = TRUE
                        AND close_date BETWEEN $1 AND $2), 0) AS revenue_in_period
                 FROM dra_hubspot.deals
                 WHERE data_source_id = $3`,
                [start, end, source.id],
            );

            if (!rows?.[0]) return null;

            const pipelineValue = Number(rows[0].pipeline_value) || 0;
            const conversions = Number(rows[0].closed_won_in_period) || 0;
            const revenue = Number(rows[0].revenue_in_period) || 0;

            return {
                channelType: EDataSourceType.HUBSPOT,
                channelLabel: CHANNEL_LABELS[EDataSourceType.HUBSPOT],
                spend: 0,
                impressions: 0,
                clicks: 0,
                ctr: 0,
                conversions,
                cpl: 0,
                roas: 0,
                pipelineValue,
                dataSourceId: source.id,
            };
        } catch {
            return null;
        }
    }

    /**
     * Fetch Klaviyo Email Marketing channel metrics.
     * spend is 0 (subscription cost not tracked per-campaign).
     * impressions = sends, clicks = unique_clicks, conversions = placed_orders.
     * roas is mapped to revenue but displayed as "N/A" by frontend when spend = 0.
     */
    private async fetchKlaviyoMetrics(
        manager: any,
        source: DRADataSource,
        start: string,
        end: string,
    ): Promise<IChannelMetrics | null> {
        try {
            const rows = await manager.query(
                `SELECT
                    COALESCE(SUM(sends), 0)         AS sends,
                    COALESCE(SUM(unique_opens), 0)   AS unique_opens,
                    COALESCE(SUM(unique_clicks), 0)  AS unique_clicks,
                    COALESCE(SUM(placed_orders), 0)  AS placed_orders,
                    COALESCE(SUM(revenue), 0)        AS revenue
                 FROM dra_klaviyo.campaign_metrics
                 WHERE data_source_id = $1
                   AND metric_date BETWEEN $2 AND $3`,
                [source.id, start, end],
            );

            if (!rows?.[0]) return null;

            const sends = Number(rows[0].sends) || 0;
            const uniqueClicks = Number(rows[0].unique_clicks) || 0;
            const placedOrders = Number(rows[0].placed_orders) || 0;
            const revenue = Number(rows[0].revenue) || 0;
            const uniqueOpens = Number(rows[0].unique_opens) || 0;

            return {
                channelType: EDataSourceType.KLAVIYO,
                channelLabel: CHANNEL_LABELS[EDataSourceType.KLAVIYO],
                spend: 0,
                impressions: sends,
                clicks: uniqueClicks,
                ctr: sends > 0 ? uniqueClicks / sends : 0,
                conversions: placedOrders,
                cpl: 0,
                roas: 0,       // "N/A" — no spend tracked; frontend renders accordingly
                pipelineValue: revenue,   // revenue attributed from email → pipelineValue slot
                dataSourceId: source.id,
            };
        } catch {
            return null;
        }
    }

    /**
     * Fetch offline channel metrics for a campaign and date range.
     */
    private async fetchOfflineMetrics(
        manager: any,
        campaignId: number,
        startDate: Date,
        endDate: Date,
    ): Promise<IChannelMetrics[]> {
        const start = startDate.toISOString().split('T')[0];
        const end = endDate.toISOString().split('T')[0];

        try {
            const rows = await manager.query(
                `SELECT cc.channel_type, cc.channel_name,
                        COALESCE(SUM(od.actual_spend), 0) AS spend,
                        COALESCE(SUM(od.impressions_estimated), 0) AS impressions,
                        COALESCE(SUM(od.leads_generated), 0) AS conversions,
                        COALESCE(SUM(od.pipeline_value), 0) AS pipeline_value
                 FROM dra_campaign_channels cc
                 LEFT JOIN dra_campaign_offline_data od
                        ON od.campaign_channel_id = cc.id
                       AND od.entry_date BETWEEN $1 AND $2
                 WHERE cc.campaign_id = $3 AND cc.is_offline = true
                 GROUP BY cc.id, cc.channel_type, cc.channel_name`,
                [start, end, campaignId],
            );

            return rows.map((r: any): IChannelMetrics => {
                const spend = Number(r.spend) || 0;
                const conversions = Number(r.conversions) || 0;
                const type = `offline_${r.channel_type}`;
                return {
                    channelType: type,
                    channelLabel: `Offline – ${r.channel_name || r.channel_type}`,
                    spend,
                    impressions: Number(r.impressions) || 0,
                    clicks: 0,
                    ctr: 0,
                    conversions,
                    cpl: conversions > 0 ? spend / conversions : 0,
                    roas: 0,
                    pipelineValue: Number(r.pipeline_value) || 0,
                    dataSourceId: null,
                };
            });
        } catch {
            return [];
        }
    }

    /**
     * Build weekly spend trend for all sources in the date range.
     */
    private async buildWeeklyTrend(
        manager: any,
        sources: DRADataSource[],
        startDate: Date,
        endDate: Date,
        campaignId?: number,
    ): Promise<IWeeklyTrendPoint[]> {
        const start = startDate.toISOString().split('T')[0];
        const end = endDate.toISOString().split('T')[0];

        // Collect per-channel weekly spend
        const weekMap = new Map<string, Record<string, number>>();

        const addToWeekMap = (weekStart: string, channelType: string, spend: number) => {
            if (!weekMap.has(weekStart)) weekMap.set(weekStart, {});
            const week = weekMap.get(weekStart)!;
            week[channelType] = (week[channelType] || 0) + spend;
        };

        for (const source of sources) {
            try {
                switch (source.data_type) {
                    case EDataSourceType.GOOGLE_ADS: {
                        const tables = await this.getPhysicalTables(manager, source.id, 'campaigns', 'dra_google_ads');
                        for (const { fullName } of tables) {
                            try {
                                const rows = await manager.query(
                                    `SELECT DATE_TRUNC('week', date)::DATE AS week_start,
                                            COALESCE(SUM(cost), 0) AS spend
                                     FROM ${fullName}
                                     WHERE date BETWEEN $1 AND $2
                                     GROUP BY week_start ORDER BY week_start`,
                                    [start, end],
                                );
                                for (const r of rows) addToWeekMap(r.week_start?.toISOString?.()?.split('T')[0] ?? String(r.week_start), EDataSourceType.GOOGLE_ADS, Number(r.spend) || 0);
                            } catch { /* skip */ }
                        }
                        break;
                    }
                    case EDataSourceType.META_ADS: {
                        const tables = await this.getPhysicalTables(manager, source.id, 'insights', 'dra_meta_ads');
                        for (const { fullName } of tables) {
                            try {
                                const rows = await manager.query(
                                    `SELECT DATE_TRUNC('week', date_start)::DATE AS week_start,
                                            COALESCE(SUM(spend), 0) AS spend
                                     FROM ${fullName}
                                     WHERE date_start BETWEEN $1 AND $2
                                     GROUP BY week_start ORDER BY week_start`,
                                    [start, end],
                                );
                                for (const r of rows) addToWeekMap(r.week_start?.toISOString?.()?.split('T')[0] ?? String(r.week_start), EDataSourceType.META_ADS, Number(r.spend) || 0);
                            } catch { /* skip */ }
                        }
                        break;
                    }
                    case EDataSourceType.LINKEDIN_ADS: {
                        const tables = await this.getPhysicalTables(manager, source.id, 'campaign_analytics', 'dra_linkedin_ads');
                        for (const { fullName } of tables) {
                            try {
                                const rows = await manager.query(
                                    `SELECT DATE_TRUNC('week', date_start)::DATE AS week_start,
                                            COALESCE(SUM(COALESCE(cost_local, cost_usd)), 0) AS spend
                                     FROM ${fullName}
                                     WHERE date_start BETWEEN $1 AND $2
                                     GROUP BY week_start ORDER BY week_start`,
                                    [start, end],
                                );
                                for (const r of rows) addToWeekMap(r.week_start?.toISOString?.()?.split('T')[0] ?? String(r.week_start), EDataSourceType.LINKEDIN_ADS, Number(r.spend) || 0);
                            } catch { /* skip */ }
                        }
                        break;
                    }
                    default:
                        break;
                }
            } catch {
                // Skip sources that error
            }
        }

        // Add offline weekly spend if campaign provided
        if (campaignId) {
            try {
                const rows = await manager.query(
                    `SELECT DATE_TRUNC('week', od.entry_date)::DATE AS week_start,
                            cc.channel_type,
                            COALESCE(SUM(od.actual_spend), 0) AS spend
                     FROM dra_campaign_offline_data od
                     JOIN dra_campaign_channels cc ON cc.id = od.campaign_channel_id
                     WHERE cc.campaign_id = $1
                       AND od.entry_date BETWEEN $2 AND $3
                       AND cc.is_offline = true
                     GROUP BY week_start, cc.channel_type
                     ORDER BY week_start`,
                    [campaignId, start, end],
                );
                for (const r of rows) {
                    addToWeekMap(
                        r.week_start?.toISOString?.()?.split('T')[0] ?? String(r.week_start),
                        `offline_${r.channel_type}`,
                        Number(r.spend) || 0,
                    );
                }
            } catch { /* skip */ }
        }

        // Emit sorted by week_start
        return Array.from(weekMap.entries())
            .sort(([a], [b]) => a.localeCompare(b))
            .map(([weekStart, byChannel]) => ({ weekStart, byChannel }));
    }

    /**
     * Look up all physical table names for a data source + logical name pair.
     * Returns an array because Google Ads may have one table per customer account.
     */
    private async getPhysicalTables(
        manager: any,
        dataSourceId: number,
        logicalTableName: string,
        schemaName: string,
    ): Promise<Array<{ fullName: string }>> {
        try {
            const rows: DRATableMetadata[] = await manager.find(DRATableMetadata, {
                where: { data_source_id: dataSourceId, logical_table_name: logicalTableName },
            });
            return rows.map(r => ({ fullName: `${r.schema_name}.${r.physical_table_name}` }));
        } catch {
            return [];
        }
    }

    /**
     * Build an IChannelMetrics from raw aggregated values.
     */
    private buildMetrics(
        channelType: string,
        dataSourceId: number,
        spend: number,
        impressions: number,
        clicks: number,
        conversions: number,
        convValue: number,
    ): IChannelMetrics {
        return {
            channelType,
            channelLabel: CHANNEL_LABELS[channelType] ?? channelType,
            spend,
            impressions,
            clicks,
            ctr: impressions > 0 ? clicks / impressions : 0,
            conversions,
            cpl: conversions > 0 ? spend / conversions : 0,
            roas: spend > 0 ? convValue / spend : 0,
            pipelineValue: convValue,
            dataSourceId,
        };
    }

    // -----------------------------------------------------------------------
    // Widget data methods (Option A — data comes from connected ad sources)
    // -----------------------------------------------------------------------

    /**
     * KPI Scorecard: single metric for current period + prior period delta.
     */
    public async getKpiScorecardWidgetData(
        projectId: number,
        metric: string,
        startDate: Date,
        endDate: Date,
    ): Promise<{ current_value: number; prior_value: number; delta_pct: number | null }> {
        const periodMs = endDate.getTime() - startDate.getTime();
        const priorStart = new Date(startDate.getTime() - periodMs);
        const priorEnd = new Date(startDate.getTime() - 86_400_000);

        const [current, prior] = await Promise.all([
            this.getMarketingHubSummary(projectId, startDate, endDate),
            this.getMarketingHubSummary(projectId, priorStart, priorEnd),
        ]);

        const extractMetric = (totals: IMarketingTotals, channels: IChannelMetrics[]): number => {
            switch (metric) {
                case 'spend': return totals.spend;
                case 'impressions': return totals.impressions;
                case 'clicks': return totals.clicks;
                case 'conversions': return totals.conversions;
                case 'cpl': return totals.cpl;
                case 'pipeline_value': return totals.pipelineValue;
                case 'roas': {
                    const totalSpend = totals.spend;
                    const totalRevenue = channels.reduce((s, c) => s + c.pipelineValue, 0);
                    return totalSpend > 0 ? totalRevenue / totalSpend : 0;
                }
                default: return 0;
            }
        };

        const currentVal = extractMetric(current.totals, current.channels);
        const priorVal = extractMetric(prior.totals, prior.channels);
        const deltaPct = priorVal !== 0 ? ((currentVal - priorVal) / priorVal) * 100 : null;

        return { current_value: currentVal, prior_value: priorVal, delta_pct: deltaPct };
    }

    /**
     * Budget Gauge: campaign spend vs total budget with pacing info.
     * If campaignId is null, picks the most recent active campaign for the project.
     */
    public async getBudgetGaugeWidgetData(
        projectId: number,
        campaignId: number | null,
        startDate: Date,
        endDate: Date,
    ): Promise<{
        campaign_name: string;
        total_budget: number;
        spent: number;
        pct_spent: number;
        days_total: number;
        days_elapsed: number;
        days_remaining: number;
        daily_budget: number;
        daily_actual: number;
    } | null> {
        const manager = await this.getManager();

        let campaign: any | null = null;
        if (campaignId) {
            campaign = await manager.findOne(DRACampaign, {
                where: { id: campaignId, project_id: projectId },
            }).catch(() => null);
        } else {
            const campaigns = await manager.find(DRACampaign, {
                where: { project_id: projectId, status: 'active' },
                order: { created_at: 'DESC' },
                take: 1,
            }).catch(() => []);
            campaign = campaigns[0] ?? null;
        }

        if (!campaign) return null;

        const spent = await this.getDigitalSpendForCampaign(
            campaign.id,
            startDate,
            endDate,
        );

        const budget = Number(campaign.budget_total) || 0;
        const pctSpent = budget > 0 ? (spent / budget) * 100 : 0;

        const campStart = campaign.start_date ? new Date(campaign.start_date) : startDate;
        const campEnd = campaign.end_date ? new Date(campaign.end_date) : endDate;
        const now = new Date();
        const daysTotal = Math.max(1, Math.ceil((campEnd.getTime() - campStart.getTime()) / 86_400_000));
        const daysElapsed = Math.min(daysTotal, Math.max(0, Math.ceil((now.getTime() - campStart.getTime()) / 86_400_000)));
        const daysRemaining = Math.max(0, daysTotal - daysElapsed);
        const dailyBudget = daysTotal > 0 ? budget / daysTotal : 0;
        const dailyActual = daysElapsed > 0 ? spent / daysElapsed : 0;

        return {
            campaign_name: campaign.name,
            total_budget: budget,
            spent,
            pct_spent: pctSpent,
            days_total: daysTotal,
            days_elapsed: daysElapsed,
            days_remaining: daysRemaining,
            daily_budget: dailyBudget,
            daily_actual: dailyActual,
        };
    }

    /**
     * Channel Comparison: per-channel metrics table.
     */
    public async getChannelComparisonWidgetData(
        projectId: number,
        startDate: Date,
        endDate: Date,
    ): Promise<{ channels: IChannelMetrics[]; totals: IMarketingTotals }> {
        const summary = await this.getMarketingHubSummary(projectId, startDate, endDate);
        return { channels: summary.channels, totals: summary.totals };
    }

    /**
     * Journey Sankey: simplified last-touch attribution flow by channel.
     * Nodes: [channel1, channel2, ..., "Conversions"]
     * Links: each channel → Conversions node weighted by conversion count.
     */
    public async getJourneySankeyWidgetData(
        projectId: number,
        maxPaths: number,
        startDate: Date,
        endDate: Date,
    ): Promise<{ nodes: string[]; links: Array<{ source: number; target: number; value: number }> }> {
        const summary = await this.getMarketingHubSummary(projectId, startDate, endDate);

        // Filter to channels with conversions, sorted descending, capped at maxPaths
        const contributing = summary.channels
            .filter((c) => c.conversions > 0 || c.spend > 0)
            .sort((a, b) => b.conversions - a.conversions || b.spend - a.spend)
            .slice(0, maxPaths);

        if (contributing.length === 0) return { nodes: [], links: [] };

        const nodes = [...contributing.map((c) => c.channelLabel), 'Conversions'];
        const conversionIdx = nodes.length - 1;

        const links = contributing.map((c, i) => ({
            source: i,
            target: conversionIdx,
            value: c.conversions > 0 ? c.conversions : Math.max(1, Math.round(c.spend / 100)),
        }));

        return { nodes, links };
    }

    /**
     * ROI Waterfall: per-channel spend vs revenue.
     */
    public async getRoiWaterfallWidgetData(
        projectId: number,
        groupBy: string,
        includeOffline: boolean,
        startDate: Date,
        endDate: Date,
        campaignId?: number,
    ): Promise<{
        channels: Array<{ label: string; spend: number; revenue: number; colour: string }>;
        total_spend: number;
        total_revenue: number;
        overall_roas: number;
    }> {
        const summary = await this.getMarketingHubSummary(projectId, startDate, endDate, campaignId);

        const COLOURS = ['#4285f4', '#ea4335', '#fbbc04', '#34a853', '#9c27b0', '#0a66c2', '#ff6d00'];

        let sources = summary.channels;
        if (!includeOffline) {
            sources = sources.filter((c) => !c.channelType.startsWith('offline_'));
        }

        const channels = sources.map((c, i) => ({
            label: c.channelLabel,
            spend: c.spend,
            revenue: c.pipelineValue,
            colour: COLOURS[i % COLOURS.length],
        }));

        const totalSpend = channels.reduce((s, c) => s + c.spend, 0);
        const totalRevenue = channels.reduce((s, c) => s + c.revenue, 0);
        const overallRoas = totalSpend > 0 ? totalRevenue / totalSpend : 0;

        return { channels, total_spend: totalSpend, total_revenue: totalRevenue, overall_roas: overallRoas };
    }

    /**
     * Campaign Timeline: Gantt-style list of campaigns with budget pacing.
     */
    public async getCampaignTimelineWidgetData(
        projectId: number,
        showOnlyActive: boolean,
        startDate: Date,
        endDate: Date,
    ): Promise<{
        campaigns: Array<{
            id: number;
            name: string;
            status: string;
            start_date: string | null;
            end_date: string | null;
            budget_total: number;
            spent: number;
            pct_spent: number;
        }>;
    }> {
        const manager = await this.getManager();

        const whereClause: any = { project_id: projectId };
        if (showOnlyActive) whereClause.status = 'active';

        const campaigns: DRACampaign[] = await manager.find(DRACampaign, {
            where: whereClause,
            order: { start_date: 'ASC' },
            take: 20,
        }).catch(() => []);

        const campaignData = await Promise.all(campaigns.map(async (c) => {
            const spent = await this.getDigitalSpendForCampaign(c.id, startDate, endDate).catch(() => 0);
            const budget = Number(c.budget_total) || 0;
            return {
                id: c.id,
                name: c.name,
                status: c.status,
                start_date: c.start_date ? new Date(c.start_date).toISOString().split('T')[0] : null,
                end_date: c.end_date ? new Date(c.end_date).toISOString().split('T')[0] : null,
                budget_total: budget,
                spent,
                pct_spent: budget > 0 ? (spent / budget) * 100 : 0,
            };
        }));

        return { campaigns: campaignData };
    }

    /**
     * Anomaly Alert: current period metric vs rolling comparison window average.
     */
    public async getAnomalyAlertWidgetData(
        projectId: number,
        metric: string,
        thresholdPct: number,
        comparisonWindow: string,
        alertDirection: string,
    ): Promise<{
        metric: string;
        current_value: number;
        comparison_value: number;
        delta_pct: number;
        is_anomaly: boolean;
        direction: 'spike' | 'drop' | 'normal';
    }> {
        const now = new Date();
        // Current 7-day window
        const currentEnd = now;
        const currentStart = new Date(now.getTime() - 7 * 86_400_000);

        // Number of historical weeks to average
        const weeksBack = comparisonWindow === '2_week_avg' ? 2
            : comparisonWindow === '8_week_avg' ? 8
            : 4; // default: 4_week_avg

        // Fetch each prior week and average
        const priorValues: number[] = [];
        for (let w = 1; w <= weeksBack; w++) {
            const wEnd = new Date(currentStart.getTime() - (w - 1) * 7 * 86_400_000);
            const wStart = new Date(wEnd.getTime() - 7 * 86_400_000);
            const d = await this.getKpiScorecardWidgetData(projectId, metric, wStart, wEnd);
            priorValues.push(d.current_value);
        }

        const current = await this.getKpiScorecardWidgetData(projectId, metric, currentStart, currentEnd);
        const currentVal = current.current_value;
        const comparisonVal = priorValues.length > 0
            ? priorValues.reduce((s, v) => s + v, 0) / priorValues.length
            : 0;

        const deltaPct = comparisonVal !== 0
            ? ((currentVal - comparisonVal) / comparisonVal) * 100
            : 0;

        const isAnomaly = Math.abs(deltaPct) >= thresholdPct;
        const direction: 'spike' | 'drop' | 'normal' = !isAnomaly ? 'normal'
            : deltaPct > 0 ? 'spike' : 'drop';

        return {
            metric,
            current_value: currentVal,
            comparison_value: comparisonVal,
            delta_pct: deltaPct,
            is_anomaly: isAnomaly,
            direction,
        };
    }

    /**
     * Aggregate a list of channel metrics into totals.
     */
    private computeTotals(channels: IChannelMetrics[]): IMarketingTotals {
        const totalSpend = channels.reduce((s, c) => s + c.spend, 0);
        const totalImpressions = channels.reduce((s, c) => s + c.impressions, 0);
        const totalClicks = channels.reduce((s, c) => s + c.clicks, 0);
        const totalConversions = channels.reduce((s, c) => s + c.conversions, 0);
        const totalPipeline = channels.reduce((s, c) => s + c.pipelineValue, 0);
        return {
            spend: totalSpend,
            impressions: totalImpressions,
            clicks: totalClicks,
            conversions: totalConversions,
            cpl: totalConversions > 0 ? totalSpend / totalConversions : 0,
            pipelineValue: totalPipeline,
        };
    }
}
