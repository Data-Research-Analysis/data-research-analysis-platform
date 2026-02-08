import {
    IAttributionEvent,
    IAttributionChannel,
    IAttributionReport,
    AttributionModel,
    IChannelPerformance,
    IFunnelAnalysisRequest,
    IFunnelAnalysisResponse,
    IJourneyMapRequest,
    IJourneyMapResponse,
    IROIMetrics,
    IUTMParameters
} from '../interfaces/IAttribution.js';
import { UTMParameterService } from '../services/UTMParameterService.js';
import { AttributionCalculatorService } from '../services/AttributionCalculatorService.js';
import { ChannelTrackingService } from '../services/ChannelTrackingService.js';
import { FunnelAnalysisService } from '../services/FunnelAnalysisService.js';
import { AppDataSource } from '../datasources/PostgresDS.js';
import PostgresDSMigrations from '../datasources/PostgresDSMigrations.js';

/**
 * Attribution Processor
 * Phase 2: Marketing Attribution Engine
 * 
 * Orchestrates all attribution services, providing high-level business logic
 * for tracking events, calculating attribution, analyzing funnels, and generating reports
 */
export class AttributionProcessor {
    private static instance: AttributionProcessor;
    private utmService: UTMParameterService;
    private calculatorService: AttributionCalculatorService;
    private channelService: ChannelTrackingService;
    private funnelService: FunnelAnalysisService;

    private constructor() {
        this.utmService = UTMParameterService.getInstance();
        this.calculatorService = AttributionCalculatorService.getInstance();
        this.channelService = ChannelTrackingService.getInstance();
        this.funnelService = FunnelAnalysisService.getInstance();
    }

    public static getInstance(): AttributionProcessor {
        if (!AttributionProcessor.instance) {
            AttributionProcessor.instance = new AttributionProcessor();
        }
        return AttributionProcessor.instance;
    }

    /**
     * Track a user event (pageview, interaction, conversion)
     */
    public async trackEvent(
        projectId: number,
        userIdentifier: string,
        eventData: Partial<IAttributionEvent> & { utmParams?: IUTMParameters }
    ): Promise<{ success: boolean; eventId?: number; error?: string }> {
        try {
            console.log(`[AttributionProcessor] Tracking event: ${eventData.eventType} for user: ${userIdentifier}`);

            // Parse UTM parameters if URL provided
            let utmParams = eventData.utmParams || {};
            if (eventData.referrer || eventData.pageUrl) {
                utmParams = this.utmService.parseUTMParameters(
                    eventData.pageUrl || eventData.referrer || ''
                );
            }

            // Identify channel
            const channelId = await this.utmService.identifyChannel(
                projectId,
                utmParams,
                eventData.referrer
            );

            // Track the event
            const eventId = await this.utmService.trackEvent({
                projectId,
                userIdentifier,
                eventType: eventData.eventType!,
                eventName: eventData.eventName,
                eventValue: eventData.eventValue,
                pageUrl: eventData.pageUrl,
                referrer: eventData.referrer,
                utmParams,
                metadata: eventData.metadata
            });

            // If this is a conversion event, calculate attribution
            if (eventData.eventType === 'conversion') {
                await this.processConversion(projectId, userIdentifier, eventId);
            }

            return { success: true, eventId };

        } catch (error) {
            console.error('[AttributionProcessor] Error tracking event:', error);
            return {
                success: false,
                error: error instanceof Error ? error.message : 'Unknown error'
            };
        }
    }

    /**
     * Process a conversion and calculate attribution
     */
    private async processConversion(
        projectId: number,
        userIdentifier: string,
        conversionEventId: number
    ): Promise<void> {
        try {
            console.log(`[AttributionProcessor] Processing conversion: ${conversionEventId}`);

            // Get user's journey events
            const journeyEvents = await this.utmService.getUserEvents(
                projectId,
                userIdentifier
            );

            if (journeyEvents.length === 0) {
                console.warn('[AttributionProcessor] No journey events found for user');
                return;
            }

            // Calculate attribution across all models
            const attributionResults = await this.calculatorService.calculateAttribution({
                projectId,
                userIdentifier,
                conversionEventId,
                model: 'linear',
                touchpoints: journeyEvents
            });

            // Save touchpoints with attribution weights
            await this.calculatorService.saveAttributionTouchpoints(
                attributionResults,
                projectId,
                userIdentifier
            );

            console.log(`[AttributionProcessor] Attribution calculated: ${attributionResults.touchpoints.length} touchpoints`);

        } catch (error) {
            console.error('[AttributionProcessor] Error processing conversion:', error);
            throw error;
        }
    }

    /**
     * Generate attribution report
     */
    public async generateReport(
        projectId: number,
        reportName: string,
        attributionModel: AttributionModel,
        startDate: Date,
        endDate: Date,
        userId?: number
    ): Promise<{ success: boolean; report?: IAttributionReport; error?: string }> {
        const queryRunner = AppDataSource.createQueryRunner();
        await queryRunner.connect();

        try {
            console.log(`[AttributionProcessor] Generating report: ${reportName}`);

            // Get channel performance
            const channelPerformance = await this.channelService.getChannelPerformance(
                projectId,
                attributionModel,
                startDate,
                endDate
            );

            // Calculate totals
            const totalRevenue = channelPerformance.reduce((sum, ch) => sum + ch.totalRevenue, 0);
            const totalConversions = channelPerformance.reduce((sum, ch) => sum + ch.totalConversions, 0);
            const avgConversionRate = channelPerformance.length > 0
                ? channelPerformance.reduce((sum, ch) => sum + ch.conversionRate, 0) / channelPerformance.length
                : 0;

            // Get top conversion paths
            const topPaths = await this.channelService.getTopConversionPaths(
                projectId,
                attributionModel,
                startDate,
                endDate,
                10
            );

            // Build channel breakdown
            const channelBreakdown = channelPerformance.map(ch => ({
                channelId: ch.channelId,
                channelName: ch.channelName,
                channelCategory: ch.channelCategory,
                conversions: ch.totalConversions,
                revenue: ch.totalRevenue,
                revenuePercentage: totalRevenue > 0 ? (ch.totalRevenue / totalRevenue) * 100 : 0,
                avgTimeToConversion: ch.avgTimeToConversion,
                avgTouchpoints: ch.totalTouchpoints / (ch.totalConversions || 1)
            }));

            // Save report
            const result = await queryRunner.query(
                `INSERT INTO "dra_attribution_reports"
                 (project_id, report_name, attribution_model, date_range_start, date_range_end,
                  total_conversions, total_revenue, avg_conversion_rate,
                  channel_breakdown, conversion_paths, generated_by_user_id)
                 VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
                 RETURNING *`,
                [
                    projectId,
                    reportName,
                    attributionModel,
                    startDate,
                    endDate,
                    totalConversions,
                    totalRevenue,
                    avgConversionRate,
                    JSON.stringify(channelBreakdown),
                    JSON.stringify(topPaths),
                    userId || null
                ]
            );

            const report: IAttributionReport = {
                id: result[0].id,
                projectId,
                reportType: 'channel_performance',
                attributionModel,
                dateRangeStart: startDate,
                dateRangeEnd: endDate,
                totalConversions,
                totalRevenue,
                channelBreakdown,
                topPaths,
                generatedByUserId: userId,
                createdAt: new Date(result[0].created_at),
                updatedAt: new Date(result[0].updated_at)
            };

            console.log('[AttributionProcessor] Report generated successfully');
            return { success: true, report };

        } catch (error) {
            console.error('[AttributionProcessor] Error generating report:', error);
            return {
                success: false,
                error: error instanceof Error ? error.message : 'Unknown error'
            };
        } finally {
            await queryRunner.release();
        }
    }

    /**
     * Get channel performance metrics
     */
    public async getChannelPerformance(
        projectId: number,
        attributionModel: AttributionModel,
        startDate: Date,
        endDate: Date
    ): Promise<IChannelPerformance[]> {
        return this.channelService.getChannelPerformance(
            projectId,
            attributionModel,
            startDate,
            endDate
        );
    }

    /**
     * Calculate ROI metrics by channel
     */
    public async calculateROI(
        projectId: number,
        attributionModel: AttributionModel,
        startDate: Date,
        endDate: Date,
        channelSpend?: Map<number, number>
    ): Promise<IROIMetrics[]> {
        return this.channelService.calculateROIMetrics(
            projectId,
            attributionModel,
            startDate,
            endDate,
            channelSpend
        );
    }

    /**
     * Compare attribution models for a channel
     */
    public async compareModels(
        projectId: number,
        channelId: number,
        startDate: Date,
        endDate: Date
    ): Promise<Record<AttributionModel, { conversions: number; revenue: number }>> {
        return this.channelService.compareAttributionModels(
            projectId,
            channelId,
            startDate,
            endDate
        );
    }

    /**
     * Analyze conversion funnel
     */
    public async analyzeFunnel(request: IFunnelAnalysisRequest): Promise<IFunnelAnalysisResponse> {
        return this.funnelService.analyzeFunnel(request);
    }

    /**
     * Get customer journey map
     */
    public async getJourneyMap(request: IJourneyMapRequest): Promise<IJourneyMapResponse> {
        return this.funnelService.getJourneyMap(request);
    }

    /**
     * Get all channels for a project
     */
    public async getProjectChannels(projectId: number): Promise<IAttributionChannel[]> {
        return this.channelService.getProjectChannels(projectId);
    }

    /**
     * Create default attribution channels for a project
     */
    public async createDefaultChannels(
        projectId: number,
        channels: Array<{ name: string; category: string; source: string | null; medium: string | null; campaign?: string | null }>
    ): Promise<IAttributionChannel[]> {
        const dataSource = await PostgresDSMigrations.initialize();
        const createdChannels: IAttributionChannel[] = [];

        try {
            await dataSource.transaction(async (transactionManager) => {
                for (const channelData of channels) {
                    const result = await transactionManager.query(
                        `INSERT INTO dra_attribution_channels 
                        (name, category, source, medium, campaign, project_id, created_at, updated_at) 
                        VALUES ($1, $2, $3, $4, $5, $6, NOW(), NOW()) 
                        RETURNING id, name, category, source, medium, campaign, project_id, created_at, updated_at`,
                        [
                            channelData.name,
                            channelData.category,
                            channelData.source,
                            channelData.medium,
                            channelData.campaign || null,
                            projectId
                        ]
                    );

                    if (result && result.length > 0) {
                        createdChannels.push({
                            id: result[0].id,
                            name: result[0].name,
                            category: result[0].category,
                            source: result[0].source,
                            medium: result[0].medium,
                            campaign: result[0].campaign,
                            projectId: result[0].project_id,
                            createdAt: result[0].created_at,
                            updatedAt: result[0].updated_at
                        });
                    }
                }
            });

            return createdChannels;
        } finally {
            if (dataSource.isInitialized) {
                await dataSource.destroy();
            }
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
        limit?: number
    ): Promise<Array<{
        path: string[];
        pathString: string;
        conversions: number;
        revenue: number;
        avgTouchpoints: number;
        avgTimeToConversion: number;
    }>> {
        return this.channelService.getTopConversionPaths(
            projectId,
            attributionModel,
            startDate,
            endDate,
            limit
        );
    }

    /**
     * Get user event history
     */
    public async getUserEventHistory(
        projectId: number,
        userIdentifier: string
    ): Promise<IAttributionEvent[]> {
        return this.utmService.getUserEvents(projectId, userIdentifier);
    }

    /**
     * Get attribution report by ID
     */
    public async getReportById(reportId: number): Promise<IAttributionReport | null> {
        const queryRunner = AppDataSource.createQueryRunner();
        await queryRunner.connect();

        try {
            const result = await queryRunner.query(
                `SELECT * FROM "dra_attribution_reports" WHERE id = $1`,
                [reportId]
            );

            if (result.length === 0) {
                return null;
            }

            const row = result[0];
            return {
                id: row.id,
                projectId: row.project_id,
                reportType: row.report_type || 'channel_performance',
                attributionModel: row.attribution_model,
                dateRangeStart: new Date(row.date_range_start),
                dateRangeEnd: new Date(row.date_range_end),
                totalConversions: row.total_conversions,
                totalRevenue: parseFloat(row.total_revenue),
                channelBreakdown: row.channel_breakdown,
                topPaths: row.conversion_paths,
                generatedByUserId: row.generated_by_user_id,
                createdAt: new Date(row.created_at),
                updatedAt: new Date(row.updated_at)
            };

        } catch (error) {
            console.error('[AttributionProcessor] Error getting report:', error);
            return null;
        } finally {
            await queryRunner.release();
        }
    }

    /**
     * List all reports for a project
     */
    public async listProjectReports(projectId: number): Promise<IAttributionReport[]> {
        const queryRunner = AppDataSource.createQueryRunner();
        await queryRunner.connect();

        try {
            const result = await queryRunner.query(
                `SELECT * FROM "dra_attribution_reports"
                 WHERE project_id = $1
                 ORDER BY created_at DESC`,
                [projectId]
            );

            return result.map((row: any) => ({
                id: row.id,
                projectId: row.project_id,
                reportType: row.report_type || 'channel_performance',
                attributionModel: row.attribution_model,
                dateRangeStart: new Date(row.date_range_start),
                dateRangeEnd: new Date(row.date_range_end),
                totalConversions: row.total_conversions,
                totalRevenue: parseFloat(row.total_revenue),
                channelBreakdown: row.channel_breakdown,
                topPaths: row.conversion_paths,
                generatedByUserId: row.generated_by_user_id,
                createdAt: new Date(row.created_at),
                updatedAt: new Date(row.updated_at)
            }));

        } catch (error) {
            console.error('[AttributionProcessor] Error listing reports:', error);
            return [];
        } finally {
            await queryRunner.release();
        }
    }

    /**
     * Delete attribution report
     */
    public async deleteReport(reportId: number): Promise<boolean> {
        const queryRunner = AppDataSource.createQueryRunner();
        await queryRunner.connect();

        try {
            await queryRunner.query(
                `DELETE FROM "dra_attribution_reports" WHERE id = $1`,
                [reportId]
            );

            console.log(`[AttributionProcessor] Report ${reportId} deleted`);
            return true;

        } catch (error) {
            console.error('[AttributionProcessor] Error deleting report:', error);
            return false;
        } finally {
            await queryRunner.release();
        }
    }
}
