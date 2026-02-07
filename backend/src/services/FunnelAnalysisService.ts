import { AppDataSource } from '../datasources/PostgresDS.js';
import {
    IConversionFunnel,
    IFunnelStep,
    IFunnelAnalysisRequest,
    IFunnelAnalysisResponse,
    IStepCompletionRate,
    IDropOffPoint,
    ICustomerJourney,
    IJourneyTouchpoint,
    IJourneyConversion,
    IJourneyMapRequest,
    IJourneyMapResponse
} from '../interfaces/IAttribution.js';

/**
 * Funnel Analysis Service
 * Phase 2: Marketing Attribution Engine
 * 
 * Multi-step funnel tracking, drop-off analysis, customer journey mapping
 */
export class FunnelAnalysisService {
    private static instance: FunnelAnalysisService;

    private constructor() {}

    public static getInstance(): FunnelAnalysisService {
        if (!FunnelAnalysisService.instance) {
            FunnelAnalysisService.instance = new FunnelAnalysisService();
        }
        return FunnelAnalysisService.instance;
    }

    /**
     * Analyze conversion funnel
     */
    public async analyzeFunnel(request: IFunnelAnalysisRequest): Promise<IFunnelAnalysisResponse> {
        try {
            console.log(`[FunnelAnalysis] Analyzing funnel: ${request.funnelName}`);

            // Get user journeys for the date range
            const journeys = await this.getUserJourneys(
                request.projectId,
                request.dateRangeStart,
                request.dateRangeEnd
            );

            // Calculate funnel metrics
            const stepCompletionRates = this.calculateStepCompletion(
                journeys,
                request.funnelSteps
            );

            const dropOffAnalysis = this.analyzeDropOffs(stepCompletionRates);

            const totalEntered = stepCompletionRates.length > 0 
                ? stepCompletionRates[0].usersEntered 
                : 0;

            const totalCompleted = stepCompletionRates.length > 0
                ? stepCompletionRates[stepCompletionRates.length - 1].usersCompleted
                : 0;

            const conversionRate = totalEntered > 0
                ? (totalCompleted / totalEntered) * 100
                : 0;

            const avgTimeToComplete = this.calculateAvgTimeToComplete(
                journeys,
                request.funnelSteps
            );

            // Save funnel to database
            const funnelId = await this.saveFunnel({
                projectId: request.projectId,
                funnelName: request.funnelName,
                funnelSteps: request.funnelSteps,
                totalEntered,
                totalCompleted,
                conversionRate,
                stepCompletionRates,
                dropOffAnalysis,
                avgTimeToCompleteMinutes: avgTimeToComplete,
                createdByUserId: request.userId
            });

            const funnel = await this.getFunnelById(funnelId);

            return {
                success: true,
                data: funnel!
            };

        } catch (error) {
            console.error('[FunnelAnalysis] Error analyzing funnel:', error);
            return {
                success: false,
                error: error instanceof Error ? error.message : 'Unknown error'
            };
        }
    }

    /**
     * Get customer journey map
     */
    public async getJourneyMap(request: IJourneyMapRequest): Promise<IJourneyMapResponse> {
        const queryRunner = AppDataSource.createQueryRunner();
        await queryRunner.connect();

        try {
            const limit = request.limit || 100;

            // Get journey data
            const query = request.userIdentifier
                ? `SELECT DISTINCT user_identifier FROM "dra_attribution_events"
                   WHERE project_id = $1
                     AND event_timestamp BETWEEN $2 AND $3
                     AND user_identifier = $4
                   LIMIT 1`
                : `SELECT DISTINCT user_identifier FROM "dra_attribution_events"
                   WHERE project_id = $1
                     AND event_timestamp BETWEEN $2 AND $3
                   LIMIT $4`;

            const params = request.userIdentifier
                ? [request.projectId, request.dateRangeStart, request.dateRangeEnd, request.userIdentifier]
                : [request.projectId, request.dateRangeStart, request.dateRangeEnd, limit];

            const users = await queryRunner.query(query, params);

            const journeys: ICustomerJourney[] = [];

            for (const user of users) {
                const journey = await this.buildCustomerJourney(
                    queryRunner,
                    request.projectId,
                    user.user_identifier,
                    request.dateRangeStart,
                    request.dateRangeEnd
                );

                if (journey) {
                    journeys.push(journey);
                }
            }

            return {
                success: true,
                data: journeys,
                totalJourneys: journeys.length
            };

        } catch (error) {
            console.error('[FunnelAnalysis] Error getting journey map:', error);
            return {
                success: false,
                totalJourneys: 0,
                error: error instanceof Error ? error.message : 'Unknown error'
            };
        } finally {
            await queryRunner.release();
        }
    }

    /**
     * Build customer journey from events
     */
    private async buildCustomerJourney(
        queryRunner: any,
        projectId: number,
        userIdentifier: string,
        startDate: Date,
        endDate: Date
    ): Promise<ICustomerJourney | null> {
        try {
            // Get all events for user
            const events = await queryRunner.query(
                `SELECT 
                    e.*,
                    c.name as channel_name,
                    c.category as channel_category
                 FROM "dra_attribution_events" e
                 LEFT JOIN "dra_attribution_channels" c ON c.id = e.channel_id
                 WHERE e.project_id = $1
                   AND e.user_identifier = $2
                   AND e.event_timestamp BETWEEN $3 AND $4
                 ORDER BY e.event_timestamp ASC`,
                [projectId, userIdentifier, startDate, endDate]
            );

            if (events.length === 0) {
                return null;
            }

            const touchpoints: IJourneyTouchpoint[] = [];
            const conversions: IJourneyConversion[] = [];
            let totalRevenue = 0;

            for (const event of events) {
                if (event.event_type === 'conversion') {
                    // Get attributed channels for this conversion
                    const attributedChannels = await this.getAttributedChannels(
                        queryRunner,
                        event.id
                    );

                    conversions.push({
                        eventId: event.id,
                        eventName: event.event_name || 'Conversion',
                        conversionValue: parseFloat(event.event_value || 0),
                        timestamp: new Date(event.event_timestamp),
                        attributedChannels
                    });

                    totalRevenue += parseFloat(event.event_value || 0);
                } else {
                    touchpoints.push({
                        eventId: event.id,
                        eventType: event.event_type,
                        channelName: event.channel_name || 'Direct',
                        channelCategory: event.channel_category || 'direct',
                        timestamp: new Date(event.event_timestamp),
                        pageUrl: event.page_url,
                        eventValue: event.event_value ? parseFloat(event.event_value) : undefined
                    });
                }
            }

            const journeyStart = new Date(events[0].event_timestamp);
            const journeyEnd = new Date(events[events.length - 1].event_timestamp);
            const journeyDurationHours = (journeyEnd.getTime() - journeyStart.getTime()) / (1000 * 60 * 60);

            return {
                userIdentifier,
                journeyStart,
                journeyEnd,
                totalTouchpoints: touchpoints.length,
                touchpoints,
                conversions,
                totalRevenue,
                journeyDurationHours
            };

        } catch (error) {
            console.error('[FunnelAnalysis] Error building customer journey:', error);
            return null;
        }
    }

    /**
     * Get attributed channels for a conversion
     */
    private async getAttributedChannels(
        queryRunner: any,
        conversionEventId: number
    ): Promise<Array<{ channelName: string; weight: number; attributedValue: number }>> {
        try {
            const result = await queryRunner.query(
                `SELECT 
                    c.name as channel_name,
                    t.attribution_weight_linear as weight,
                    e.event_value * t.attribution_weight_linear as attributed_value
                 FROM "dra_attribution_touchpoints" t
                 INNER JOIN "dra_attribution_channels" c ON c.id = t.channel_id
                 INNER JOIN "dra_attribution_events" e ON e.id = t.conversion_event_id
                 WHERE t.conversion_event_id = $1`,
                [conversionEventId]
            );

            return result.map((row: any) => ({
                channelName: row.channel_name,
                weight: parseFloat(row.weight),
                attributedValue: parseFloat(row.attributed_value)
            }));

        } catch (error) {
            console.error('[FunnelAnalysis] Error getting attributed channels:', error);
            return [];
        }
    }

    /**
     * Get user journeys for funnel analysis
     */
    private async getUserJourneys(
        projectId: number,
        startDate: Date,
        endDate: Date
    ): Promise<Map<string, any[]>> {
        const queryRunner = AppDataSource.createQueryRunner();
        await queryRunner.connect();

        try {
            const events = await queryRunner.query(
                `SELECT * FROM "dra_attribution_events"
                 WHERE project_id = $1
                   AND event_timestamp BETWEEN $2 AND $3
                 ORDER BY user_identifier, event_timestamp ASC`,
                [projectId, startDate, endDate]
            );

            const journeys = new Map<string, any[]>();

            for (const event of events) {
                const userEvents = journeys.get(event.user_identifier) || [];
                userEvents.push(event);
                journeys.set(event.user_identifier, userEvents);
            }

            return journeys;

        } catch (error) {
            console.error('[FunnelAnalysis] Error getting user journeys:', error);
            return new Map();
        } finally {
            await queryRunner.release();
        }
    }

    /**
     * Calculate step completion rates
     */
    private calculateStepCompletion(
        journeys: Map<string, any[]>,
        funnelSteps: IFunnelStep[]
    ): IStepCompletionRate[] {
        const completionRates: IStepCompletionRate[] = [];
        let usersAtPreviousStep = journeys.size;

        for (let i = 0; i < funnelSteps.length; i++) {
            const step = funnelSteps[i];
            let usersCompletedStep = 0;

            for (const [, events] of journeys) {
                const matchingEvent = events.find(e => 
                    e.event_type === step.eventType &&
                    (!step.eventName || e.event_name === step.eventName)
                );

                if (matchingEvent) {
                    usersCompletedStep++;
                }
            }

            const completionRate = usersAtPreviousStep > 0
                ? (usersCompletedStep / usersAtPreviousStep) * 100
                : 0;

            const dropOffRate = 100 - completionRate;

            completionRates.push({
                stepNumber: step.stepNumber,
                stepName: step.stepName,
                usersEntered: usersAtPreviousStep,
                usersCompleted: usersCompletedStep,
                completionRate,
                dropOffRate
            });

            usersAtPreviousStep = usersCompletedStep;
        }

        return completionRates;
    }

    /**
     * Analyze drop-off points
     */
    private analyzeDropOffs(completionRates: IStepCompletionRate[]): IDropOffPoint[] {
        const dropOffs: IDropOffPoint[] = [];

        for (let i = 0; i < completionRates.length - 1; i++) {
            const current = completionRates[i];
            const next = completionRates[i + 1];

            const dropOffCount = current.usersCompleted - next.usersCompleted;
            const dropOffRate = current.usersCompleted > 0
                ? (dropOffCount / current.usersCompleted) * 100
                : 0;

            if (dropOffRate > 0) {
                dropOffs.push({
                    fromStep: current.stepNumber,
                    toStep: next.stepNumber,
                    dropOffCount,
                    dropOffRate
                });
            }
        }

        return dropOffs.sort((a, b) => b.dropOffRate - a.dropOffRate);
    }

    /**
     * Calculate average time to complete funnel
     */
    private calculateAvgTimeToComplete(
        journeys: Map<string, any[]>,
        funnelSteps: IFunnelStep[]
    ): number {
        let totalTime = 0;
        let completedCount = 0;

        for (const [, events] of journeys) {
            const firstEvent = events.find(e => 
                e.event_type === funnelSteps[0].eventType
            );

            const lastEvent = events.find(e =>
                e.event_type === funnelSteps[funnelSteps.length - 1].eventType
            );

            if (firstEvent && lastEvent) {
                const timeDiff = new Date(lastEvent.event_timestamp).getTime() - 
                                new Date(firstEvent.event_timestamp).getTime();
                totalTime += timeDiff / (1000 * 60); // Convert to minutes
                completedCount++;
            }
        }

        return completedCount > 0 ? totalTime / completedCount : 0;
    }

    /**
     * Save funnel to database
     */
    private async saveFunnel(funnel: Partial<IConversionFunnel>): Promise<number> {
        const queryRunner = AppDataSource.createQueryRunner();
        await queryRunner.connect();

        try {
            const result = await queryRunner.query(
                `INSERT INTO "dra_conversion_funnels"
                 (project_id, funnel_name, funnel_steps, total_entered, total_completed,
                  conversion_rate, step_completion_rates, drop_off_analysis, 
                  avg_time_to_complete_minutes, created_by_user_id)
                 VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
                 RETURNING id`,
                [
                    funnel.projectId,
                    funnel.funnelName,
                    JSON.stringify(funnel.funnelSteps),
                    funnel.totalEntered,
                    funnel.totalCompleted,
                    funnel.conversionRate,
                    JSON.stringify(funnel.stepCompletionRates),
                    JSON.stringify(funnel.dropOffAnalysis),
                    funnel.avgTimeToCompleteMinutes,
                    funnel.createdByUserId || null
                ]
            );

            return result[0].id;

        } catch (error) {
            console.error('[FunnelAnalysis] Error saving funnel:', error);
            throw error;
        } finally {
            await queryRunner.release();
        }
    }

    /**
     * Get funnel by ID
     */
    private async getFunnelById(funnelId: number): Promise<IConversionFunnel | null> {
        const queryRunner = AppDataSource.createQueryRunner();
        await queryRunner.connect();

        try {
            const result = await queryRunner.query(
                `SELECT * FROM "dra_conversion_funnels" WHERE id = $1`,
                [funnelId]
            );

            if (result.length === 0) {
                return null;
            }

            return this.mapFunnelFromDB(result[0]);

        } catch (error) {
            console.error('[FunnelAnalysis] Error getting funnel:', error);
            return null;
        } finally {
            await queryRunner.release();
        }
    }

    /**
     * Map database row to IConversionFunnel
     */
    private mapFunnelFromDB(row: any): IConversionFunnel {
        return {
            id: row.id,
            projectId: row.project_id,
            funnelName: row.funnel_name,
            funnelSteps: row.funnel_steps,
            totalEntered: row.total_entered,
            totalCompleted: row.total_completed,
            conversionRate: row.conversion_rate ? parseFloat(row.conversion_rate) : undefined,
            stepCompletionRates: row.step_completion_rates,
            dropOffAnalysis: row.drop_off_analysis,
            avgTimeToCompleteMinutes: row.avg_time_to_complete_minutes 
                ? parseFloat(row.avg_time_to_complete_minutes) 
                : undefined,
            createdByUserId: row.created_by_user_id,
            createdAt: new Date(row.created_at),
            updatedAt: new Date(row.updated_at)
        };
    }
}
