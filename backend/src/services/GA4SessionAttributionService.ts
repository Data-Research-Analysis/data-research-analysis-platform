import { AppDataSource } from '../datasources/PostgresDS.js';
import { DRADataSource } from '../models/DRADataSource.js';
import { EDataSourceType } from '../types/EDataSourceType.js';
import { TableMetadataService } from './TableMetadataService.js';
import { AttributionCalculatorService } from './AttributionCalculatorService.js';
import type { AttributionModel, IAttributionEvent } from '../interfaces/IAttribution.js';

/**
 * Session-level multi-touch attribution from the GA4 BigQuery layer.
 *
 * The BigQuery plane materializes one row per session per user, ordered by
 * session_start_ts. That is enough to run first/last/linear/time-decay/U-shaped
 * and (Shapley) data-driven models across a user's real session journey —
 * something the aggregate Data API cannot do.
 */

export interface ISessionAttributionChannel {
    channel: string;
    conversions: number;
    revenue: number;
    conversionPercentage: number;
    revenuePercentage: number;
}

export interface ISessionAttributionResult {
    model: AttributionModel;
    totalConversions: number;
    totalRevenue: number;
    channelBreakdown: ISessionAttributionChannel[];
}

export interface IModelComparisonEntry {
    model: AttributionModel;
    label: string;
    channels: Array<{ channel: string; conversions: number; revenue: number; revenuePercentage: number }>;
}

interface ISessionRow {
    user_key: string;
    session_id: string;
    ts: number;
    source: string;
    medium: string;
    campaign_name: string;
    campaign_key: string;
    is_conversion: boolean;
    conversions: number;
    conversion_value: number;
}

interface IUserJourney {
    userKey: string;
    sessions: ISessionRow[];
}

const MODELS: AttributionModel[] = ['first_touch', 'last_touch', 'linear', 'time_decay', 'u_shaped', 'data_driven'];

export class GA4SessionAttributionService {
    private static instance: GA4SessionAttributionService;
    private readonly tableMetadataService = TableMetadataService.getInstance();
    private readonly calculator = AttributionCalculatorService.getInstance();

    static getInstance(): GA4SessionAttributionService {
        if (!GA4SessionAttributionService.instance) {
            GA4SessionAttributionService.instance = new GA4SessionAttributionService();
        }
        return GA4SessionAttributionService.instance;
    }

    /**
     * Channel label for a session. Campaign name wins; otherwise source/medium.
     */
    static channelLabel(source: string, medium: string, campaignName: string): string {
        if (campaignName && campaignName !== '(not set)') return campaignName;
        return `${source || '(not set)'} / ${medium || '(not set)'}`;
    }

    static modelLabel(model: AttributionModel): string {
        const labels: Record<AttributionModel, string> = {
            first_touch: 'First Touch',
            last_touch: 'Last Touch',
            linear: 'Linear',
            time_decay: 'Time Decay',
            u_shaped: 'Position Based (U-Shaped)',
            data_driven: 'Data Driven (Shapley)',
        };
        return labels[model] || model;
    }

    async getAttribution(
        projectId: number,
        model: AttributionModel,
        start: string,
        end: string,
        attributionWindowDays: number = 30,
    ): Promise<ISessionAttributionResult> {
        const journeys = await this.loadJourneys(projectId, start, end, attributionWindowDays);
        return this.computeModel(journeys, model, attributionWindowDays);
    }

    async getModelComparison(
        projectId: number,
        start: string,
        end: string,
        attributionWindowDays: number = 30,
    ): Promise<IModelComparisonEntry[]> {
        const journeys = await this.loadJourneys(projectId, start, end, attributionWindowDays);
        return MODELS.map(model => {
            const result = this.computeModel(journeys, model, attributionWindowDays);
            return {
                model,
                label: GA4SessionAttributionService.modelLabel(model),
                channels: result.channelBreakdown.map(c => ({
                    channel: c.channel,
                    conversions: c.conversions,
                    revenue: c.revenue,
                    revenuePercentage: c.revenuePercentage,
                })),
            };
        });
    }

    /**
     * Load ordered session journeys from every GA4 BigQuery data source in the
     * project. The window is extended backwards by the attribution window so
     * pre-conversion touchpoints are included.
     */
    private async loadJourneys(
        projectId: number,
        start: string,
        end: string,
        attributionWindowDays: number,
    ): Promise<IUserJourney[]> {
        const manager = AppDataSource.manager;
        const dataSources = await manager.find(DRADataSource, {
            where: { project: { id: projectId }, data_type: EDataSourceType.GOOGLE_ANALYTICS },
        });
        if (!dataSources.length) return [];

        const startDate = new Date(`${start}T00:00:00Z`);
        startDate.setUTCDate(startDate.getUTCDate() - attributionWindowDays);
        const windowStart = startDate.toISOString().slice(0, 10);

        const byUser = new Map<string, ISessionRow[]>();

        for (const ds of dataSources) {
            const cfg = ds.connection_details?.api_connection_details?.api_config;
            if (!cfg?.bq_enabled) continue;
            const physical = await this.tableMetadataService.getPhysicalTableName(manager, ds.id, 'sessions');
            if (!physical) continue;
            const full = `"dra_google_analytics_bq"."${physical}"`;

            try {
                const rows = await manager.query(
                    `SELECT user_key, session_id, session_start_ts, source, medium, campaign_name, campaign_key,
                            is_conversion, conversions, conversion_value
                     FROM ${full}
                     WHERE session_date BETWEEN $1 AND $2
                     ORDER BY user_key, session_start_ts ASC`,
                    [windowStart, end],
                );

                for (const row of rows || []) {
                    const ts = row.session_start_ts ? new Date(row.session_start_ts).getTime() : 0;
                    const session: ISessionRow = {
                        user_key: row.user_key || '(not set)',
                        session_id: row.session_id || '',
                        ts,
                        source: row.source || '(not set)',
                        medium: row.medium || '(not set)',
                        campaign_name: row.campaign_name || '(not set)',
                        campaign_key: row.campaign_key || '(not set)',
                        is_conversion: !!row.is_conversion,
                        conversions: Number(row.conversions) || 0,
                        conversion_value: Number(row.conversion_value) || 0,
                    };
                    if (!byUser.has(session.user_key)) byUser.set(session.user_key, []);
                    byUser.get(session.user_key)!.push(session);
                }
            } catch (error: any) {
                console.warn(`[GA4SessionAttribution] Failed to read ${physical}:`, error?.message);
            }
        }

        const journeys: IUserJourney[] = [];
        for (const [userKey, sessions] of byUser.entries()) {
            sessions.sort((a, b) => a.ts - b.ts);
            journeys.push({ userKey, sessions });
        }
        return journeys;
    }

    private computeModel(
        journeys: IUserJourney[],
        model: AttributionModel,
        attributionWindowDays: number,
    ): ISessionAttributionResult {
        const windowMs = attributionWindowDays * 24 * 60 * 60 * 1000;
        const channelTotals = new Map<string, { conversions: number; revenue: number }>();

        for (const journey of journeys) {
            const conversionSessions = journey.sessions.filter(s => s.is_conversion);
            if (conversionSessions.length === 0) continue;

            for (const conversion of conversionSessions) {
                const windowStart = conversion.ts - windowMs;
                const touchpoints = journey.sessions.filter(
                    s => s.ts >= windowStart && s.ts <= conversion.ts,
                );
                if (touchpoints.length === 0) continue;

                // Synthetic numeric channel ids for the shared weight calculator.
                const channelIds = new Map<string, number>();
                const events: IAttributionEvent[] = touchpoints.map((s, i) => {
                    const label = GA4SessionAttributionService.channelLabel(s.source, s.medium, s.campaign_name);
                    if (!channelIds.has(label)) channelIds.set(label, channelIds.size + 1);
                    return {
                        id: i,
                        projectId: 0,
                        userIdentifier: journey.userKey,
                        sessionId: s.session_id,
                        eventType: 'session',
                        eventName: 'session',
                        eventValue: s.conversions,
                        channelId: channelIds.get(label)!,
                        eventTimestamp: new Date(s.ts),
                        createdAt: new Date(s.ts),
                    } as unknown as IAttributionEvent;
                });

                const conversionEvent = events[events.length - 1];
                const weights = this.calculator.calculateWeightsPublic(model, events, conversionEvent);
                const conversionCount = Math.max(1, conversion.conversions);
                const conversionValue = conversion.conversion_value;

                touchpoints.forEach((s, i) => {
                    const label = GA4SessionAttributionService.channelLabel(s.source, s.medium, s.campaign_name);
                    const w = weights[i] || 0;
                    const current = channelTotals.get(label) || { conversions: 0, revenue: 0 };
                    current.conversions += w * conversionCount;
                    current.revenue += w * conversionValue;
                    channelTotals.set(label, current);
                });
            }
        }

        const totalConversions = Array.from(channelTotals.values()).reduce((s, c) => s + c.conversions, 0);
        const totalRevenue = Array.from(channelTotals.values()).reduce((s, c) => s + c.revenue, 0);

        const channelBreakdown: ISessionAttributionChannel[] = Array.from(channelTotals.entries())
            .map(([channel, t]) => ({
                channel,
                conversions: Math.round(t.conversions * 100) / 100,
                revenue: Math.round(t.revenue * 100) / 100,
                conversionPercentage: totalConversions > 0 ? Math.round((t.conversions / totalConversions) * 1000) / 10 : 0,
                revenuePercentage: totalRevenue > 0 ? Math.round((t.revenue / totalRevenue) * 1000) / 10 : 0,
            }))
            .sort((a, b) => b.conversions - a.conversions);

        return { model, totalConversions, totalRevenue, channelBreakdown };
    }
}

export default GA4SessionAttributionService;
