import { DBDriver } from '../drivers/DBDriver.js';
import { EDataSourceType } from '../types/EDataSourceType.js';

const SCHEMA = 'dra_klaviyo';
/** Klaviyo stable API revision (Q1 2026) */
const REVISION = '2024-02-15';

/**
 * Klaviyo Email Marketing Service
 * Uses a private API key (no OAuth).
 *
 * Tables written:
 *  - campaigns        — campaign metadata
 *  - campaign_metrics — per-campaign per-day performance metrics
 *  - flow_metrics     — automation flow metrics per day
 */
export class KlaviyoService {
    private static instance: KlaviyoService;

    private static readonly API_BASE = 'https://a.klaviyo.com/api';

    private constructor() {
        console.log('🟣 Klaviyo Service initialized');
    }

    public static getInstance(): KlaviyoService {
        if (!KlaviyoService.instance) {
            KlaviyoService.instance = new KlaviyoService();
        }
        return KlaviyoService.instance;
    }

    // -------------------------------------------------------------------------
    // DB helper
    // -------------------------------------------------------------------------

    private async getDbQuery(): Promise<(sql: string, params?: any[]) => Promise<any[]>> {
        const driver = await DBDriver.getInstance().getDriver(EDataSourceType.POSTGRESQL);
        if (!driver) throw new Error('PostgreSQL driver unavailable');
        const dataSource = await driver.getConcreteDriver();
        return (sql: string, params?: any[]) => dataSource.query(sql, params);
    }

    // -------------------------------------------------------------------------
    // API request helper
    // -------------------------------------------------------------------------

    private async request<T = any>(
        path: string,
        apiKey: string,
        params?: Record<string, string>
    ): Promise<T> {
        const url = new URL(`${KlaviyoService.API_BASE}/${path}`);
        if (params) {
            Object.entries(params).forEach(([k, v]) => url.searchParams.set(k, v));
        }

        const response = await fetch(url.toString(), {
            headers: {
                Authorization: `Klaviyo-API-Key ${apiKey}`,
                revision: REVISION,
                Accept: 'application/json',
            },
        });

        if (!response.ok) {
            const body = await response.text();
            throw new Error(`Klaviyo API ${path} failed (${response.status}): ${body}`);
        }

        return response.json() as Promise<T>;
    }

    // -------------------------------------------------------------------------
    // Validate API key
    // -------------------------------------------------------------------------

    /**
     * Validate a Klaviyo private API key by calling /accounts/.
     * Returns false for invalid keys without throwing.
     */
    public async validateApiKey(apiKey: string): Promise<boolean> {
        try {
            const data: any = await this.request('accounts/', apiKey);
            return Array.isArray(data?.data) || !!data?.data;
        } catch {
            return false;
        }
    }

    // -------------------------------------------------------------------------
    // Ensure schema and tables
    // -------------------------------------------------------------------------

    public async ensureSchema(query: (sql: string, params?: any[]) => Promise<any[]>): Promise<void> {
        await query(`CREATE SCHEMA IF NOT EXISTS ${SCHEMA}`);

        await query(`
            CREATE TABLE IF NOT EXISTS ${SCHEMA}.campaigns (
                id              SERIAL PRIMARY KEY,
                data_source_id  INTEGER NOT NULL,
                klaviyo_id      VARCHAR(100) NOT NULL,
                campaign_name   VARCHAR(512),
                subject_line    VARCHAR(512),
                send_time       TIMESTAMP,
                status          VARCHAR(50),
                UNIQUE(data_source_id, klaviyo_id)
            )
        `);

        await query(`
            CREATE TABLE IF NOT EXISTS ${SCHEMA}.campaign_metrics (
                id              SERIAL PRIMARY KEY,
                data_source_id  INTEGER NOT NULL,
                campaign_id     VARCHAR(100) NOT NULL,
                metric_date     DATE NOT NULL,
                sends           INTEGER DEFAULT 0,
                opens           INTEGER DEFAULT 0,
                unique_opens    INTEGER DEFAULT 0,
                clicks          INTEGER DEFAULT 0,
                unique_clicks   INTEGER DEFAULT 0,
                unsubscribes    INTEGER DEFAULT 0,
                bounces         INTEGER DEFAULT 0,
                revenue         NUMERIC(12,2) DEFAULT 0,
                placed_orders   INTEGER DEFAULT 0,
                UNIQUE(data_source_id, campaign_id, metric_date)
            )
        `);

        await query(`
            CREATE TABLE IF NOT EXISTS ${SCHEMA}.flow_metrics (
                id              SERIAL PRIMARY KEY,
                data_source_id  INTEGER NOT NULL,
                flow_id         VARCHAR(100) NOT NULL,
                flow_name       VARCHAR(512),
                metric_date     DATE NOT NULL,
                emails_sent     INTEGER DEFAULT 0,
                opens           INTEGER DEFAULT 0,
                clicks          INTEGER DEFAULT 0,
                revenue         NUMERIC(12,2) DEFAULT 0,
                UNIQUE(data_source_id, flow_id, metric_date)
            )
        `);
    }

    // -------------------------------------------------------------------------
    // Sync campaigns
    // -------------------------------------------------------------------------

    public async syncCampaigns(dataSourceId: number, apiKey: string): Promise<number> {
        const query = await this.getDbQuery();
        await this.ensureSchema(query);

        let cursor: string | undefined;
        let synced = 0;

        do {
            const params: Record<string, string> = {
                'filter': 'equals(messages.channel,\'email\')',
                'page[size]': '50',
            };
            if (cursor) params['page[cursor]'] = cursor;

            const data: any = await this.request('campaigns/', apiKey, params);
            const results: any[] = data?.data ?? [];

            for (const campaign of results) {
                const attrs = campaign.attributes ?? {};
                await query(
                    `INSERT INTO ${SCHEMA}.campaigns
                        (data_source_id, klaviyo_id, campaign_name, subject_line, send_time, status)
                     VALUES ($1,$2,$3,$4,$5,$6)
                     ON CONFLICT (data_source_id, klaviyo_id) DO UPDATE SET
                        campaign_name = EXCLUDED.campaign_name,
                        subject_line  = EXCLUDED.subject_line,
                        send_time     = EXCLUDED.send_time,
                        status        = EXCLUDED.status`,
                    [
                        dataSourceId,
                        campaign.id,
                        attrs.name ?? null,
                        attrs.message?.subject_line ?? null,
                        attrs.send_time ? new Date(attrs.send_time) : null,
                        attrs.status ?? null,
                    ]
                );
                synced++;

                // Sync metrics for sent campaigns
                if (attrs.status === 'sent' || attrs.status === 'cancelled') {
                    await this.syncCampaignMetrics(dataSourceId, apiKey, campaign.id).catch(() => {});
                }
            }

            cursor = data?.links?.next
                ? new URL(data.links.next).searchParams.get('page[cursor]') ?? undefined
                : undefined;
        } while (cursor);

        console.log(`[Klaviyo] Synced ${synced} campaigns for data source ${dataSourceId}`);
        return synced;
    }

    // -------------------------------------------------------------------------
    // Sync campaign metrics
    // -------------------------------------------------------------------------

    public async syncCampaignMetrics(
        dataSourceId: number,
        apiKey: string,
        campaignId: string
    ): Promise<void> {
        const query = await this.getDbQuery();

        // Use Campaign Values Report endpoint (aggregate metrics)
        const payload = {
            data: {
                type: 'campaign-values-report',
                attributes: {
                    statistics: [
                        'sent_count', 'open_count', 'open_unique_count',
                        'click_count', 'click_unique_count',
                        'unsubscribed_count', 'bounced_count',
                        'revenue', 'placed_order_count',
                    ],
                    timeframe: { key: 'last_365_days' },
                    conversion_metric_id: null,
                    filter: `equals(campaign_id,"${campaignId}")`,
                },
            },
        };

        try {
            const response = await fetch(
                `${KlaviyoService.API_BASE}/campaign-values-reports/`,
                {
                    method: 'POST',
                    headers: {
                        Authorization: `Klaviyo-API-Key ${apiKey}`,
                        revision: REVISION,
                        'Content-Type': 'application/json',
                        Accept: 'application/json',
                    },
                    body: JSON.stringify(payload),
                }
            );

            if (!response.ok) return;

            const data: any = await response.json();
            const results: any[] = data?.data?.attributes?.results ?? [];
            const today = new Date().toISOString().split('T')[0];

            for (const row of results) {
                const stats = row.statistics ?? {};
                await query(
                    `INSERT INTO ${SCHEMA}.campaign_metrics
                        (data_source_id, campaign_id, metric_date, sends, opens, unique_opens,
                         clicks, unique_clicks, unsubscribes, bounces, revenue, placed_orders)
                     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)
                     ON CONFLICT (data_source_id, campaign_id, metric_date) DO UPDATE SET
                        sends          = EXCLUDED.sends,
                        opens          = EXCLUDED.opens,
                        unique_opens   = EXCLUDED.unique_opens,
                        clicks         = EXCLUDED.clicks,
                        unique_clicks  = EXCLUDED.unique_clicks,
                        unsubscribes   = EXCLUDED.unsubscribes,
                        bounces        = EXCLUDED.bounces,
                        revenue        = EXCLUDED.revenue,
                        placed_orders  = EXCLUDED.placed_orders`,
                    [
                        dataSourceId,
                        campaignId,
                        today,
                        Number(stats.sent_count ?? 0),
                        Number(stats.open_count ?? 0),
                        Number(stats.open_unique_count ?? 0),
                        Number(stats.click_count ?? 0),
                        Number(stats.click_unique_count ?? 0),
                        Number(stats.unsubscribed_count ?? 0),
                        Number(stats.bounced_count ?? 0),
                        parseFloat(stats.revenue ?? '0') || 0,
                        Number(stats.placed_order_count ?? 0),
                    ]
                );
            }
        } catch (err) {
            console.warn(`[Klaviyo] Could not sync metrics for campaign ${campaignId}:`, err);
        }
    }

    // -------------------------------------------------------------------------
    // Sync flow metrics
    // -------------------------------------------------------------------------

    public async syncFlowMetrics(dataSourceId: number, apiKey: string): Promise<void> {
        const query = await this.getDbQuery();

        const payload = {
            data: {
                type: 'flow-values-report',
                attributes: {
                    statistics: [
                        'sent_count', 'open_count', 'click_count', 'revenue',
                    ],
                    timeframe: { key: 'last_365_days' },
                    conversion_metric_id: null,
                },
            },
        };

        try {
            const response = await fetch(
                `${KlaviyoService.API_BASE}/flow-values-reports/`,
                {
                    method: 'POST',
                    headers: {
                        Authorization: `Klaviyo-API-Key ${apiKey}`,
                        revision: REVISION,
                        'Content-Type': 'application/json',
                        Accept: 'application/json',
                    },
                    body: JSON.stringify(payload),
                }
            );

            if (!response.ok) return;

            const data: any = await response.json();
            const results: any[] = data?.data?.attributes?.results ?? [];
            const today = new Date().toISOString().split('T')[0];

            for (const row of results) {
                const stats = row.statistics ?? {};
                const flowId = row.flow_id ?? row.groupings?.flow_id;
                const flowName = row.flow_message_name ?? row.groupings?.flow_message_name ?? null;

                if (!flowId) continue;

                await query(
                    `INSERT INTO ${SCHEMA}.flow_metrics
                        (data_source_id, flow_id, flow_name, metric_date, emails_sent, opens, clicks, revenue)
                     VALUES ($1,$2,$3,$4,$5,$6,$7,$8)
                     ON CONFLICT (data_source_id, flow_id, metric_date) DO UPDATE SET
                        flow_name   = EXCLUDED.flow_name,
                        emails_sent = EXCLUDED.emails_sent,
                        opens       = EXCLUDED.opens,
                        clicks      = EXCLUDED.clicks,
                        revenue     = EXCLUDED.revenue`,
                    [
                        dataSourceId,
                        flowId,
                        flowName,
                        today,
                        Number(stats.sent_count ?? 0),
                        Number(stats.open_count ?? 0),
                        Number(stats.click_count ?? 0),
                        parseFloat(stats.revenue ?? '0') || 0,
                    ]
                );
            }
        } catch (err) {
            console.warn('[Klaviyo] Could not sync flow metrics:', err);
        }
    }

    // -------------------------------------------------------------------------
    // Full sync
    // -------------------------------------------------------------------------

    public async syncAll(dataSourceId: number, apiKey: string): Promise<{ campaigns: number }> {
        const campaigns = await this.syncCampaigns(dataSourceId, apiKey);
        await this.syncFlowMetrics(dataSourceId, apiKey);
        return { campaigns };
    }

    // -------------------------------------------------------------------------
    // Read helpers used by MarketingReportProcessor
    // -------------------------------------------------------------------------

    public async getCampaignMetricsSummary(
        dataSourceId: number,
        startDate: string,
        endDate: string
    ): Promise<{ sends: number; clicks: number; revenue: number; placed_orders: number }> {
        try {
            const query = await this.getDbQuery();
            const rows = await query(
                `SELECT
                    COALESCE(SUM(sends), 0)         AS sends,
                    COALESCE(SUM(unique_clicks), 0)  AS clicks,
                    COALESCE(SUM(revenue), 0)        AS revenue,
                    COALESCE(SUM(placed_orders), 0)  AS placed_orders
                 FROM ${SCHEMA}.campaign_metrics
                 WHERE data_source_id = $1
                   AND metric_date BETWEEN $2 AND $3`,
                [dataSourceId, startDate, endDate]
            );
            const row = rows[0] ?? {};
            return {
                sends: Number(row.sends ?? 0),
                clicks: Number(row.clicks ?? 0),
                revenue: Number(row.revenue ?? 0),
                placed_orders: Number(row.placed_orders ?? 0),
            };
        } catch {
            return { sends: 0, clicks: 0, revenue: 0, placed_orders: 0 };
        }
    }
}
