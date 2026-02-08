import { AppDataSource } from '../datasources/PostgresDS.js';
import {
    IChannelPerformance,
    IAttributionChannel,
    AttributionModel,
    IROIMetrics
} from '../interfaces/IAttribution.js';

/**
 * Channel Tracking and Performance Service
 * Phase 2: Marketing Attribution Engine
 * 
 * Aggregates channel performance metrics, ROI calculations,
 * and provides channel-level analytics
 */
export class ChannelTrackingService {
    private static instance: ChannelTrackingService;

    private constructor() {}

    public static getInstance(): ChannelTrackingService {
        if (!ChannelTrackingService.instance) {
            ChannelTrackingService.instance = new ChannelTrackingService();
        }
        return ChannelTrackingService.instance;
    }

    /**
     * Get channel performance metrics for a date range
     */
    public async getChannelPerformance(
        projectId: number,
        attributionModel: AttributionModel,
        startDate: Date,
        endDate: Date
    ): Promise<IChannelPerformance[]> {
        const queryRunner = AppDataSource.createQueryRunner();
        await queryRunner.connect();

        try {
            const weightColumn = this.getWeightColumnName(attributionModel);

            const result = await queryRunner.query(
                `WITH conversion_events AS (
                    SELECT id, event_value, event_timestamp
                    FROM "dra_attribution_events"
                    WHERE project_id = $1
                      AND event_type = 'conversion'
                      AND event_timestamp BETWEEN $2 AND $3
                ),
                channel_metrics AS (
                    SELECT 
                        t.channel_id,
                        c.name as channel_name,
                        c.category as channel_category,
                        COUNT(DISTINCT t.touchpoint_event_id) as total_touchpoints,
                        COUNT(DISTINCT t.conversion_event_id) as total_conversions,
                        COALESCE(SUM(ce.event_value * t.${weightColumn}), 0) as total_revenue,
                        AVG(t.time_to_conversion_hours) as avg_time_to_conversion
                    FROM "dra_attribution_touchpoints" t
                    INNER JOIN "dra_attribution_channels" c ON c.id = t.channel_id
                    INNER JOIN conversion_events ce ON ce.id = t.conversion_event_id
                    WHERE t.project_id = $1
                    GROUP BY t.channel_id, c.name, c.category
                ),
                channel_totals AS (
                    SELECT 
                        channel_id,
                        COUNT(*) as total_events
                    FROM "dra_attribution_events"
                    WHERE project_id = $1
                      AND event_timestamp BETWEEN $2 AND $3
                      AND channel_id IS NOT NULL
                    GROUP BY channel_id
                )
                SELECT 
                    cm.*,
                    COALESCE(ct.total_events, 0) as total_traffic,
                    CASE 
                        WHEN ct.total_events > 0 
                        THEN (cm.total_conversions::float / ct.total_events * 100)
                        ELSE 0 
                    END as conversion_rate
                FROM channel_metrics cm
                LEFT JOIN channel_totals ct ON ct.channel_id = cm.channel_id
                ORDER BY cm.total_revenue DESC`,
                [projectId, startDate, endDate]
            );

            return result.map((row: any) => ({
                channelId: row.channel_id,
                channelName: row.channel_name,
                channelCategory: row.channel_category,
                totalTouchpoints: parseInt(row.total_touchpoints),
                totalConversions: parseInt(row.total_conversions),
                totalRevenue: parseFloat(row.total_revenue),
                avgTimeToConversion: parseFloat(row.avg_time_to_conversion || 0),
                conversionRate: parseFloat(row.conversion_rate || 0)
            }));

        } catch (error) {
            console.error('[ChannelTrackingService] Error getting channel performance:', error);
            throw error;
        } finally {
            await queryRunner.release();
        }
    }

    /**
     * Get all channels for a project
     */
    public async getProjectChannels(projectId: number): Promise<IAttributionChannel[]> {
        const queryRunner = AppDataSource.createQueryRunner();
        await queryRunner.connect();

        try {
            const result = await queryRunner.query(
                `SELECT * FROM "dra_attribution_channels"
                 WHERE project_id = $1
                 ORDER BY created_at DESC`,
                [projectId]
            );

            return result.map((row: any) => this.mapChannelFromDB(row));

        } catch (error) {
            console.error('[ChannelTrackingService] Error getting project channels:', error);
            throw error;
        } finally {
            await queryRunner.release();
        }
    }

    /**
     * Get top conversion paths
     */
    public async getTopConversionPaths(
        projectId: number,
        attributionModel: AttributionModel,
        startDate: Date,
        endDate: Date,
        limit: number = 10
    ): Promise<Array<{
        path: string[];
        pathString: string;
        conversions: number;
        revenue: number;
        avgTouchpoints: number;
        avgTimeToConversion: number;
    }>> {
        const queryRunner = AppDataSource.createQueryRunner();
        await queryRunner.connect();

        try {
            const weightColumn = this.getWeightColumnName(attributionModel);

            const result = await queryRunner.query(
                `WITH conversion_touchpoints AS (
                    SELECT 
                        t.conversion_event_id,
                        t.touchpoint_position,
                        c.name as channel_name,
                        e.event_value,
                        t.${weightColumn} as attribution_weight
                    FROM "dra_attribution_touchpoints" t
                    INNER JOIN "dra_attribution_channels" c ON c.id = t.channel_id
                    INNER JOIN "dra_attribution_events" e ON e.id = t.conversion_event_id
                    WHERE t.project_id = $1
                      AND e.event_timestamp BETWEEN $2 AND $3
                    ORDER BY t.conversion_event_id, t.touchpoint_position
                ),
                conversion_paths AS (
                    SELECT 
                        conversion_event_id,
                        ARRAY_AGG(channel_name ORDER BY touchpoint_position) as path,
                        MAX(event_value) as conversion_value,
                        COUNT(*) as touchpoint_count
                    FROM conversion_touchpoints
                    GROUP BY conversion_event_id
                )
                SELECT 
                    path,
                    ARRAY_TO_STRING(path, ' → ') as path_string,
                    COUNT(*) as conversions,
                    SUM(conversion_value) as revenue,
                    AVG(touchpoint_count) as avg_touchpoints
                FROM conversion_paths
                GROUP BY path
                ORDER BY conversions DESC, revenue DESC
                LIMIT $4`,
                [projectId, startDate, endDate, limit]
            );

            return result.map((row: any) => ({
                path: row.path,
                pathString: row.path_string,
                conversions: parseInt(row.conversions),
                revenue: parseFloat(row.revenue || 0),
                avgTouchpoints: parseFloat(row.avg_touchpoints || 0),
                avgTimeToConversion: 0 // Can be calculated if needed
            }));

        } catch (error) {
            console.error('[ChannelTrackingService] Error getting top conversion paths:', error);
            throw error;
        } finally {
            await queryRunner.release();
        }
    }

    /**
     * Calculate ROI metrics by channel
     */
    public async calculateROIMetrics(
        projectId: number,
        attributionModel: AttributionModel,
        startDate: Date,
        endDate: Date,
        channelSpendData?: Map<number, number>
    ): Promise<IROIMetrics[]> {
        const queryRunner = AppDataSource.createQueryRunner();
        await queryRunner.connect();

        try {
            const weightColumn = this.getWeightColumnName(attributionModel);

            const result = await queryRunner.query(
                `SELECT 
                    t.channel_id,
                    c.name as channel_name,
                    COUNT(DISTINCT t.conversion_event_id) as total_conversions,
                    COALESCE(SUM(e.event_value * t.${weightColumn}), 0) as total_revenue
                 FROM "dra_attribution_touchpoints" t
                 INNER JOIN "dra_attribution_channels" c ON c.id = t.channel_id
                 INNER JOIN "dra_attribution_events" e ON e.id = t.conversion_event_id
                 WHERE t.project_id = $1
                   AND e.event_timestamp BETWEEN $2 AND $3
                   AND e.event_type = 'conversion'
                 GROUP BY t.channel_id, c.name`,
                [projectId, startDate, endDate]
            );

            return result.map((row: any) => {
                const channelId = row.channel_id;
                const totalRevenue = parseFloat(row.total_revenue);
                const totalConversions = parseInt(row.total_conversions);
                const totalSpend = channelSpendData?.get(channelId) || undefined;

                const metrics: IROIMetrics = {
                    channelId,
                    channelName: row.channel_name,
                    totalRevenue,
                    totalConversions,
                    revenuePerConversion: totalConversions > 0 ? totalRevenue / totalConversions : 0
                };

                if (totalSpend !== undefined && totalSpend > 0) {
                    metrics.totalSpend = totalSpend;
                    metrics.roi = ((totalRevenue - totalSpend) / totalSpend) * 100;
                    metrics.roas = totalRevenue / totalSpend;
                    metrics.costPerConversion = totalSpend / totalConversions;
                    metrics.profitMargin = ((totalRevenue - totalSpend) / totalRevenue) * 100;
                }

                return metrics;
            });

        } catch (error) {
            console.error('[ChannelTrackingService] Error calculating ROI metrics:', error);
            throw error;
        } finally {
            await queryRunner.release();
        }
    }

    /**
     * Get channel comparison across attribution models
     */
    public async compareAttributionModels(
        projectId: number,
        channelId: number,
        startDate: Date,
        endDate: Date
    ): Promise<Record<AttributionModel, { conversions: number; revenue: number }>> {
        const queryRunner = AppDataSource.createQueryRunner();
        await queryRunner.connect();

        try {
            const models: AttributionModel[] = ['first_touch', 'last_touch', 'linear', 'time_decay', 'u_shaped'];
            const comparison: any = {};

            for (const model of models) {
                const weightColumn = this.getWeightColumnName(model);

                const result = await queryRunner.query(
                    `SELECT 
                        COUNT(DISTINCT t.conversion_event_id) as conversions,
                        COALESCE(SUM(e.event_value * t.${weightColumn}), 0) as revenue
                     FROM "dra_attribution_touchpoints" t
                     INNER JOIN "dra_attribution_events" e ON e.id = t.conversion_event_id
                     WHERE t.project_id = $1
                       AND t.channel_id = $2
                       AND e.event_timestamp BETWEEN $3 AND $4
                       AND e.event_type = 'conversion'`,
                    [projectId, channelId, startDate, endDate]
                );

                comparison[model] = {
                    conversions: parseInt(result[0].conversions),
                    revenue: parseFloat(result[0].revenue)
                };
            }

            return comparison;

        } catch (error) {
            console.error('[ChannelTrackingService] Error comparing attribution models:', error);
            throw error;
        } finally {
            await queryRunner.release();
        }
    }

    /**
     * Get weight column name for attribution model
     */
    private getWeightColumnName(model: AttributionModel): string {
        const columnMap: Record<AttributionModel, string> = {
            'first_touch': 'attribution_weight_first_touch',
            'last_touch': 'attribution_weight_last_touch',
            'linear': 'attribution_weight_linear',
            'time_decay': 'attribution_weight_time_decay',
            'u_shaped': 'attribution_weight_u_shaped'
        };
        return columnMap[model];
    }

    /**
     * Map database row to IAttributionChannel
     */
    private mapChannelFromDB(row: any): IAttributionChannel {
        return {
            id: row.id,
            name: row.name,
            category: row.category,
            source: row.source,
            medium: row.medium,
            campaign: row.campaign,
            projectId: row.project_id,
            createdAt: new Date(row.created_at),
            updatedAt: new Date(row.updated_at)
        };
    }
}
