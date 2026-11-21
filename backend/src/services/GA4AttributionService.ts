import { DBDriver } from '../drivers/DBDriver.js';
import { EDataSourceType } from '../types/EDataSourceType.js';

/**
 * Blended (ads + GA4) ROI per channel.
 *
 * Ad platforms provide spend/impressions/clicks; GA4 provides on-site sessions
 * and conversions. Joining them gives cost per session, CPA and ROAS that
 * neither source can produce alone.
 *
 * This is an aggregate, channel-level view. Campaign-level joins by
 * `campaign_key` are a later enhancement.
 */
export interface IBlendedRoiRow {
    channel: string;
    /** Ad platform data type ('google_ads' | 'meta_ads' | 'linkedin_ads') or null for unmatched GA channels. */
    platform: string | null;
    spend: number;
    impressions: number;
    clicks: number;
    sessions: number;
    conversions: number;
    /** Ad-platform conversion value (proxy for revenue). */
    revenue: number;
    cpa: number | null;
    costPerSession: number | null;
    roas: number | null;
}

export interface ICampaignRoiRow {
    campaignKey: string;
    campaignName: string;
    platform: string | null;
    spend: number;
    impressions: number;
    clicks: number;
    sessions: number;
    conversions: number;
    revenue: number;
    cpa: number | null;
    costPerSession: number | null;
    roas: number | null;
    /** True when GA4 sessions/conversions matched ad spend by campaign_key. */
    matched: boolean;
}

interface IAdTotals {
    spend: number;
    impressions: number;
    clicks: number;
    conversions: number;
    revenue: number;
}

interface IGaTotals {
    sessions: number;
    conversions: number;
}

export class GA4AttributionService {
    private static instance: GA4AttributionService;

    static getInstance(): GA4AttributionService {
        if (!GA4AttributionService.instance) {
            GA4AttributionService.instance = new GA4AttributionService();
        }
        return GA4AttributionService.instance;
    }

    /**
     * Map a GA4 channel group to an ad platform. Heuristic — GA4 channel groups
     * do not carry platform identifiers.
     */
    static mapChannelGroupToPlatform(channelGroup: string, availablePlatforms: Set<string>): string | null {
        const cg = (channelGroup || '').toLowerCase();

        if (
            cg.includes('paid search') ||
            cg.includes('display') ||
            cg.includes('paid shopping') ||
            cg.includes('cross-network') ||
            cg.includes('paid other')
        ) {
            return 'google_ads';
        }

        if (cg.includes('paid social')) {
            if (availablePlatforms.has('meta_ads')) return 'meta_ads';
            if (availablePlatforms.has('linkedin_ads')) return 'linkedin_ads';
            return null;
        }

        if (cg.includes('paid video')) {
            if (availablePlatforms.has('google_ads')) return 'google_ads';
            if (availablePlatforms.has('meta_ads')) return 'meta_ads';
            return null;
        }

        return null;
    }

    /**
     * Compute blended channel ROI for a project and date range.
     */
    async getBlendedRoi(projectId: number, start: Date, end: Date): Promise<IBlendedRoiRow[]> {
        const manager = await this.getManager();
        const startStr = start.toISOString().split('T')[0];
        const endStr = end.toISOString().split('T')[0];

        const adTotals = await this.getAdTotals(manager, projectId, startStr, endStr);
        const gaTotals = await this.getGaTotals(manager, projectId, startStr, endStr);

        const availablePlatforms = new Set(adTotals.keys());
        const rows = new Map<string, IBlendedRoiRow>();

        // Seed rows from ad platforms (spend side).
        for (const [platform, totals] of adTotals.entries()) {
            rows.set(platform, {
                channel: this.platformLabel(platform),
                platform,
                spend: totals.spend,
                impressions: totals.impressions,
                clicks: totals.clicks,
                sessions: 0,
                conversions: 0,
                revenue: totals.revenue,
                cpa: null,
                costPerSession: null,
                roas: null,
            });
        }

        // Merge GA4 sessions/conversions into platform rows; unmatched channels
        // get their own rows so they remain visible.
        for (const [channelGroup, totals] of gaTotals.entries()) {
            const platform = GA4AttributionService.mapChannelGroupToPlatform(channelGroup, availablePlatforms);

            if (platform) {
                let row = rows.get(platform);
                if (!row) {
                    row = {
                        channel: this.platformLabel(platform),
                        platform,
                        spend: 0,
                        impressions: 0,
                        clicks: 0,
                        sessions: 0,
                        conversions: 0,
                        revenue: 0,
                        cpa: null,
                        costPerSession: null,
                        roas: null,
                    };
                    rows.set(platform, row);
                }
                row.sessions += totals.sessions;
                row.conversions += totals.conversions;
            } else {
                const key = `unmatched:${channelGroup}`;
                rows.set(key, {
                    channel: channelGroup,
                    platform: null,
                    spend: 0,
                    impressions: 0,
                    clicks: 0,
                    sessions: totals.sessions,
                    conversions: totals.conversions,
                    revenue: 0,
                    cpa: null,
                    costPerSession: null,
                    roas: null,
                });
            }
        }

        const result = Array.from(rows.values()).map(row => ({
            ...row,
            cpa: row.conversions > 0 ? this.round(row.spend / row.conversions) : null,
            costPerSession: row.sessions > 0 ? this.round(row.spend / row.sessions) : null,
            roas: row.spend > 0 ? this.round(row.revenue / row.spend) : null,
        }));

        return result.sort((a, b) => b.spend - a.spend);
    }

    /**
     * Campaign-level blended ROI. Joins ad-platform campaign spend with GA4
     * sessions/conversions by `campaign_key` (Ads campaign ID / utm_id).
     */
    async getCampaignRoi(projectId: number, start: Date, end: Date): Promise<ICampaignRoiRow[]> {
        const manager = await this.getManager();
        const startStr = start.toISOString().split('T')[0];
        const endStr = end.toISOString().split('T')[0];

        const adMap = new Map<string, { campaignKey: string; campaignName: string; platform: string; spend: number; impressions: number; clicks: number; conversions: number; revenue: number }>();
        const adTables = await manager.query(
            `SELECT tm.schema_name, tm.physical_table_name, ds.data_type
             FROM "dra_table_metadata" tm
             JOIN "dra_data_sources" ds ON ds.id = tm.data_source_id
             WHERE ds.project_id = $1
               AND tm.logical_table_name = 'insights'
               AND ds.data_type IN ('google_ads', 'meta_ads')`,
            [projectId],
        );
        for (const t of adTables) {
            const full = `"${t.schema_name}"."${t.physical_table_name}"`;
            try {
                const rows = await manager.query(
                    `SELECT campaign_id, ANY_VALUE(campaign_name) AS campaign_name,
                            COALESCE(SUM(spend), 0) AS spend,
                            COALESCE(SUM(impressions), 0) AS impressions,
                            COALESCE(SUM(clicks), 0) AS clicks,
                            COALESCE(SUM(conversions), 0) AS conversions,
                            COALESCE(SUM(COALESCE(conversion_value, 0)), 0) AS revenue
                     FROM ${full}
                     WHERE date_start BETWEEN $1 AND $2
                     GROUP BY campaign_id`,
                    [startStr, endStr],
                );
                for (const r of rows || []) {
                    const cid = String(r.campaign_id ?? '');
                    if (!cid) continue;
                    const key = `${t.data_type}:${cid}`;
                    const cur = adMap.get(key) || {
                        campaignKey: cid,
                        campaignName: r.campaign_name || '(not set)',
                        platform: t.data_type,
                        spend: 0, impressions: 0, clicks: 0, conversions: 0, revenue: 0,
                    };
                    cur.spend += Number(r.spend) || 0;
                    cur.impressions += Number(r.impressions) || 0;
                    cur.clicks += Number(r.clicks) || 0;
                    cur.conversions += Number(r.conversions) || 0;
                    cur.revenue += Number(r.revenue) || 0;
                    adMap.set(key, cur);
                }
            } catch {
                // Skip tables without the expected columns
            }
        }

        const gaMap = new Map<string, { sessions: number; conversions: number; name: string }>();
        const gaTables = await manager.query(
            `SELECT tm.schema_name, tm.physical_table_name
             FROM "dra_table_metadata" tm
             JOIN "dra_data_sources" ds ON ds.id = tm.data_source_id
             WHERE ds.project_id = $1
               AND tm.logical_table_name = 'session_attribution'
               AND ds.data_type = 'google_analytics'`,
            [projectId],
        );
        for (const t of gaTables) {
            const full = `"${t.schema_name}"."${t.physical_table_name}"`;
            try {
                const rows = await manager.query(
                    `SELECT campaign_key,
                            ANY_VALUE(session_campaign_name) AS campaign_name,
                            COALESCE(SUM(sessions), 0) AS sessions,
                            COALESCE(SUM(conversions), 0) AS conversions
                     FROM ${full}
                     WHERE date BETWEEN $1 AND $2
                     GROUP BY campaign_key`,
                    [startStr, endStr],
                );
                for (const r of rows || []) {
                    const key = String(r.campaign_key ?? '');
                    if (!key) continue;
                    const cur = gaMap.get(key) || { sessions: 0, conversions: 0, name: '' };
                    cur.sessions += Number(r.sessions) || 0;
                    cur.conversions += Number(r.conversions) || 0;
                    if (!cur.name && r.campaign_name && r.campaign_name !== '(not set)') cur.name = r.campaign_name;
                    gaMap.set(key, cur);
                }
            } catch {
                // Skip legacy tables
            }
        }

        const rows: ICampaignRoiRow[] = [];
        const matched = new Set<string>();
        for (const ad of adMap.values()) {
            const ga = gaMap.get(ad.campaignKey);
            if (ga) matched.add(ad.campaignKey);
            rows.push(this.campaignRow(
                ad.campaignKey,
                ad.campaignName !== '(not set)' ? ad.campaignName : (ga?.name || '(not set)'),
                ad.platform,
                ad.spend, ad.impressions, ad.clicks,
                ga?.sessions || 0, ga?.conversions || 0, ad.revenue,
                !!ga,
            ));
        }
        for (const [key, ga] of gaMap.entries()) {
            if (matched.has(key)) continue;
            rows.push(this.campaignRow(key, ga.name || '(not set)', null, 0, 0, 0, ga.sessions, ga.conversions, 0, false));
        }

        return rows.sort((a, b) => b.spend - a.spend);
    }

    private campaignRow(
        campaignKey: string,
        campaignName: string,
        platform: string | null,
        spend: number,
        impressions: number,
        clicks: number,
        sessions: number,
        conversions: number,
        revenue: number,
        matched: boolean,
    ): ICampaignRoiRow {
        return {
            campaignKey,
            campaignName,
            platform,
            spend,
            impressions,
            clicks,
            sessions,
            conversions,
            revenue,
            matched,
            cpa: conversions > 0 ? this.round(spend / conversions) : null,
            costPerSession: sessions > 0 ? this.round(spend / sessions) : null,
            roas: spend > 0 ? this.round(revenue / spend) : null,
        };
    }

    private async getAdTotals(
        manager: any,
        projectId: number,
        start: string,
        end: string,
    ): Promise<Map<string, IAdTotals>> {
        const totals = new Map<string, IAdTotals>();
        const tables = await manager.query(
            `SELECT tm.schema_name, tm.physical_table_name, tm.logical_table_name, ds.data_type
             FROM "dra_table_metadata" tm
             JOIN "dra_data_sources" ds ON ds.id = tm.data_source_id
             WHERE ds.project_id = $1
               AND tm.logical_table_name IN ('insights', 'campaign_analytics')
               AND ds.data_type IN ('google_ads', 'meta_ads', 'linkedin_ads')`,
            [projectId],
        );

        for (const t of tables) {
            const full = `"${t.schema_name}"."${t.physical_table_name}"`;
            const isLinkedIn = t.data_type === 'linkedin_ads';
            const spendCol = isLinkedIn ? 'cost_usd' : 'spend';
            const conversionsCol = isLinkedIn ? 'external_conversions' : 'conversions';
            const revenueCol = isLinkedIn ? '0' : 'COALESCE(conversion_value, 0)';

            try {
                const rows = await manager.query(
                    `SELECT COALESCE(SUM("${spendCol}"), 0) AS spend,
                            COALESCE(SUM(impressions), 0) AS impressions,
                            COALESCE(SUM(clicks), 0) AS clicks,
                            COALESCE(SUM("${conversionsCol}"), 0) AS conversions,
                            COALESCE(SUM(${revenueCol}), 0) AS revenue
                     FROM ${full}
                     WHERE date_start BETWEEN $1 AND $2`,
                    [start, end],
                );
                const row = rows?.[0];
                if (!row) continue;

                const current = totals.get(t.data_type) || { spend: 0, impressions: 0, clicks: 0, conversions: 0, revenue: 0 };
                current.spend += Number(row.spend) || 0;
                current.impressions += Number(row.impressions) || 0;
                current.clicks += Number(row.clicks) || 0;
                current.conversions += Number(row.conversions) || 0;
                current.revenue += Number(row.revenue) || 0;
                totals.set(t.data_type, current);
            } catch {
                // Skip tables without the expected columns
            }
        }

        return totals;
    }

    private async getGaTotals(
        manager: any,
        projectId: number,
        start: string,
        end: string,
    ): Promise<Map<string, IGaTotals>> {
        const totals = new Map<string, IGaTotals>();
        const tables = await manager.query(
            `SELECT tm.schema_name, tm.physical_table_name
             FROM "dra_table_metadata" tm
             JOIN "dra_data_sources" ds ON ds.id = tm.data_source_id
             WHERE ds.project_id = $1
               AND tm.logical_table_name = 'session_attribution'
               AND ds.data_type = 'google_analytics'`,
            [projectId],
        );

        for (const t of tables) {
            const full = `"${t.schema_name}"."${t.physical_table_name}"`;
            try {
                const rows = await manager.query(
                    `SELECT COALESCE(session_default_channel_group, '(not set)') AS channel,
                            COALESCE(SUM(sessions), 0) AS sessions,
                            COALESCE(SUM(conversions), 0) AS conversions
                     FROM ${full}
                     WHERE date BETWEEN $1 AND $2
                     GROUP BY channel`,
                    [start, end],
                );
                for (const row of rows || []) {
                    const key = row.channel || '(not set)';
                    const current = totals.get(key) || { sessions: 0, conversions: 0 };
                    current.sessions += Number(row.sessions) || 0;
                    current.conversions += Number(row.conversions) || 0;
                    totals.set(key, current);
                }
            } catch {
                // Skip legacy tables
            }
        }

        return totals;
    }

    private platformLabel(dataType: string): string {
        switch (dataType) {
            case 'google_ads': return 'Google Ads';
            case 'meta_ads': return 'Meta Ads';
            case 'linkedin_ads': return 'LinkedIn Ads';
            default: return dataType;
        }
    }

    private round(value: number): number {
        return Math.round(value * 100) / 100;
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

export default GA4AttributionService;
