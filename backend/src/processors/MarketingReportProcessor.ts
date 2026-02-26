import { DBDriver } from '../drivers/DBDriver.js';
import { EDataSourceType } from '../types/EDataSourceType.js';
import { DRADataSource } from '../models/DRADataSource.js';
import { DRATableMetadata } from '../models/DRATableMetadata.js';
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
    campaignId: number;
    campaignName: string;
    status: string;
    spend: number;
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
] as string[];

const CHANNEL_LABELS: Record<string, string> = {
    google_ads: 'Google Ads',
    meta_ads: 'Meta Ads',
    linkedin_ads: 'LinkedIn Ads',
    google_analytics: 'Google Analytics (GA4)',
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

        const rows: Array<{ campaign_name: string; campaign_status: string; spend: number; conversions: number }> = [];

        for (const source of googleAdsSources) {
            const tables = await this.getPhysicalTables(manager, source.id, 'campaigns', 'dra_google_ads');
            for (const { fullName } of tables) {
                try {
                    const data = await manager.query(
                        `SELECT campaign_name, campaign_status,
                                SUM(cost) AS spend,
                                SUM(conversions) AS conversions
                         FROM ${fullName}
                         WHERE date BETWEEN $1 AND $2
                         GROUP BY campaign_name, campaign_status
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

        // Merge and sort
        const merged = new Map<string, { campaign_name: string; campaign_status: string; spend: number; conversions: number }>();
        for (const r of rows) {
            const key = r.campaign_name;
            const existing = merged.get(key);
            if (existing) {
                existing.spend += Number(r.spend) || 0;
                existing.conversions += Number(r.conversions) || 0;
            } else {
                merged.set(key, { ...r, spend: Number(r.spend) || 0, conversions: Number(r.conversions) || 0 });
            }
        }

        return Array.from(merged.values())
            .sort((a, b) => b.spend - a.spend)
            .slice(0, limit)
            .map((r, idx) => ({
                campaignId: idx + 1,
                campaignName: r.campaign_name || 'Unknown',
                status: r.campaign_status || 'unknown',
                spend: r.spend,
                conversions: r.conversions,
                cpl: r.conversions > 0 ? r.spend / r.conversions : 0,
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

        let spend = 0, impressions = 0, clicks = 0;

        for (const { fullName } of tables) {
            try {
                const rows = await manager.query(
                    `SELECT COALESCE(SUM(spend), 0) AS spend,
                            COALESCE(SUM(impressions), 0) AS impressions,
                            COALESCE(SUM(clicks), 0) AS clicks
                     FROM ${fullName}
                     WHERE date_start BETWEEN $1 AND $2`,
                    [start, end],
                );
                if (rows?.[0]) {
                    spend += Number(rows[0].spend) || 0;
                    impressions += Number(rows[0].impressions) || 0;
                    clicks += Number(rows[0].clicks) || 0;
                }
            } catch {
                // Skip missing tables
            }
        }

        return this.buildMetrics(EDataSourceType.META_ADS, source.id, spend, impressions, clicks, 0, 0);
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
