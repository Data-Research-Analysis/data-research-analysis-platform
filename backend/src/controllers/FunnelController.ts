import { Request, Response } from 'express';
import { FunnelDefinitionService } from '../services/FunnelDefinitionService.js';
import { FunnelMatcherService } from '../services/FunnelMatcherService.js';
import { AttributionCalculatorService } from '../services/AttributionCalculatorService.js';
import type { AttributionModel } from '../interfaces/IAttribution.js';
import type { IAdPlatformTouchpoint } from '../services/FunnelMatcherService.js';

export class FunnelController {
    private static definitionService = FunnelDefinitionService.getInstance();
    private static matcherService = FunnelMatcherService.getInstance();
    private static attributionCalculator = AttributionCalculatorService.getInstance();

    static async create(req: Request, res: Response): Promise<void> {
        try {
            const { project_id, name, steps } = req.body;
            if (!project_id || !name || !steps || !Array.isArray(steps) || steps.length < 2) {
                res.status(400).json({
                    success: false,
                    message: 'Missing required fields: project_id, name, and steps (minimum 2)',
                });
                return;
            }
            const funnel = await FunnelController.definitionService.create(project_id, name, steps, (req as any).user?.id);
            res.status(201).json({ success: true, data: funnel });
        } catch (error: any) {
            console.error('[FunnelController] create error:', error);
            res.status(500).json({ success: false, message: 'Failed to create funnel', error: error.message });
        }
    }

    static async list(req: Request, res: Response): Promise<void> {
        try {
            const projectId = req.query.projectId || req.query.project_id;
            if (!projectId) {
                res.status(400).json({ success: false, message: 'Missing required query parameter: projectId' });
                return;
            }
            const funnels = await FunnelController.definitionService.getByProject(Number(projectId));
            res.json({ success: true, data: funnels });
        } catch (error: any) {
            console.error('[FunnelController] list error:', error);
            res.status(500).json({ success: false, message: 'Failed to list funnels', error: error.message });
        }
    }

    static async getById(req: Request, res: Response): Promise<void> {
        try {
            const id = parseInt(req.params.id, 10);
            if (isNaN(id)) {
                res.status(400).json({ success: false, message: 'Invalid funnel ID' });
                return;
            }
            const funnel = await FunnelController.definitionService.getById(id);
            if (!funnel) {
                res.status(404).json({ success: false, message: 'Funnel not found' });
                return;
            }
            res.json({ success: true, data: funnel });
        } catch (error: any) {
            console.error('[FunnelController] getById error:', error);
            res.status(500).json({ success: false, message: 'Failed to get funnel', error: error.message });
        }
    }

    static async update(req: Request, res: Response): Promise<void> {
        try {
            const id = parseInt(req.params.id, 10);
            if (isNaN(id)) {
                res.status(400).json({ success: false, message: 'Invalid funnel ID' });
                return;
            }
            const { name, steps } = req.body;
            const funnel = await FunnelController.definitionService.update(id, { name, steps });
            if (!funnel) {
                res.status(404).json({ success: false, message: 'Funnel not found' });
                return;
            }
            res.json({ success: true, data: funnel });
        } catch (error: any) {
            console.error('[FunnelController] update error:', error);
            res.status(500).json({ success: false, message: 'Failed to update funnel', error: error.message });
        }
    }

    static async delete(req: Request, res: Response): Promise<void> {
        try {
            const id = parseInt(req.params.id, 10);
            if (isNaN(id)) {
                res.status(400).json({ success: false, message: 'Invalid funnel ID' });
                return;
            }
            const deleted = await FunnelController.definitionService.delete(id);
            if (!deleted) {
                res.status(404).json({ success: false, message: 'Funnel not found' });
                return;
            }
            res.json({ success: true, message: 'Funnel deleted' });
        } catch (error: any) {
            console.error('[FunnelController] delete error:', error);
            res.status(500).json({ success: false, message: 'Failed to delete funnel', error: error.message });
        }
    }

    static async previewStageMatch(req: Request, res: Response): Promise<void> {
        try {
            const { project_id, stage } = req.body;
            if (!project_id || !stage || !stage.conditions) {
                res.status(400).json({ success: false, message: 'Missing project_id or stage conditions' });
                return;
            }
            const { startDate, endDate } = req.query;
            const start = startDate ? new Date(startDate as string) : undefined;
            const end = endDate ? new Date(endDate as string) : undefined;

            const count = await FunnelController.matcherService.estimateMatchCount(
                project_id,
                stage.conditions,
                stage.matchType || 'all',
                start,
                end,
            );
            res.json({ success: true, data: { estimatedMatches: count } });
        } catch (error: any) {
            console.error('[FunnelController] previewStageMatch error:', error);
            res.status(500).json({ success: false, message: 'Failed to preview stage match', error: error.message });
        }
    }

    static async analyze(req: Request, res: Response): Promise<void> {
        try {
            const id = parseInt(req.params.id, 10);
            const { startDate, endDate } = req.query;

            if (isNaN(id)) {
                res.status(400).json({ success: false, message: 'Invalid funnel ID' });
                return;
            }
            if (!startDate || !endDate) {
                res.status(400).json({ success: false, message: 'Missing startDate and endDate query parameters' });
                return;
            }

            const funnel = await FunnelController.definitionService.getById(id);
            if (!funnel) {
                res.status(404).json({ success: false, message: 'Funnel not found' });
                return;
            }

            const start = new Date(startDate as string);
            const end = new Date(endDate as string);

            const stageResults = await FunnelController.matcherService.matchFunnelSteps(
                funnel.project_id,
                funnel.steps,
                start,
                end,
            );

            const stages = stageResults.map((sr, idx) => {
                const nextCount = idx < stageResults.length - 1 ? stageResults[idx + 1].uniqueUsers : null;
                const conversionToNext = nextCount !== null && sr.uniqueUsers > 0
                    ? Math.round((nextCount / sr.uniqueUsers) * 1000) / 10
                    : null;
                const dropOff = nextCount !== null && sr.uniqueUsers > 0
                    ? Math.round(((sr.uniqueUsers - nextCount) / sr.uniqueUsers) * 1000) / 10
                    : null;

                return {
                    id: sr.stepName.toLowerCase().replace(/\s+/g, '_'),
                    name: sr.stepName,
                    order: sr.stepOrder,
                    count: sr.uniqueUsers,
                    conversionRateToNext: conversionToNext,
                    dropOffPercent: dropOff,
                };
            });

            await FunnelController.definitionService.saveAnalysisResults(
                id,
                funnel.project_id,
                stageResults.map(sr => ({
                    stageName: sr.stepName,
                    stageOrder: sr.stepOrder,
                    userCount: sr.uniqueUsers,
                    eventCount: sr.matchedEvents.length,
                    conversionToNext: stages.find(s => s.name === sr.stepName)?.conversionRateToNext ?? null,
                    dropOffPercent: stages.find(s => s.name === sr.stepName)?.dropOffPercent ?? null,
                    channelData: null,
                    utmDistribution: null,
                })),
                startDate as string,
                endDate as string,
            );

            res.json({ success: true, data: { stages, channelFunnels: [], timePerStage: [] } });
        } catch (error: any) {
            console.error('[FunnelController] analyze error:', error);
            res.status(500).json({ success: false, message: 'Failed to analyze funnel', error: error.message });
        }
    }

    /**
     * GET /funnels/:id/attribution?model=X&startDate=Y&endDate=Z&source=ad_platforms
     * Run attribution models against the events matched by funnel steps.
     * When source=ad_platforms, queries ad platform physical tables instead of dra_attribution_events.
     * Returns per-channel attributed conversions and revenue for the selected model.
     */
    static async funnelAttribution(req: Request, res: Response): Promise<void> {
        try {
            const id = parseInt(req.params.id, 10);
            const { model, startDate, endDate, source } = req.query;

            if (isNaN(id)) {
                res.status(400).json({ success: false, message: 'Invalid funnel ID' });
                return;
    }

            const funnel = await FunnelController.definitionService.getById(id);
            if (!funnel) {
                res.status(404).json({ success: false, message: 'Funnel not found' });
                return;
            }

            const attModel = model as AttributionModel;
            const validModels: AttributionModel[] = ['first_touch', 'last_touch', 'linear', 'time_decay', 'u_shaped', 'data_driven'];
            if (!validModels.includes(attModel)) {
                res.status(400).json({ success: false, message: `Invalid model. Valid: ${validModels.join(', ')}` });
                return;
            }

            const start = new Date(startDate as string);
            const end = new Date(endDate as string);

            if (source === 'ad_platforms') {
                await FunnelController.handleAdPlatformAttribution(funnel, attModel, start, end, res);
                return;
            }

            // Original path: use dra_attribution_events
            // Get all journey events for the funnel
            const journeys = await FunnelController.matcherService.getFunnelJourneyEvents(
                funnel.project_id,
                funnel.steps,
                start,
                end,
            );

            // Aggregate conversion events and run attribution for each user journey
            const channelTotals = new Map<number, { channelId: number; channelName: string; conversions: number; revenue: number }>();

            // Fetch channel names
            const { AppDataSource } = await import('../datasources/PostgresDS.js');
            const queryRunner = AppDataSource.createQueryRunner();
            await queryRunner.connect();
            const channelRows = await queryRunner.query(
                `SELECT id, name FROM "dra_attribution_channels" WHERE project_id = $1`,
                [funnel.project_id],
            );
            await queryRunner.release();
            const channelNames = new Map<number, string>();
            for (const row of channelRows) {
                channelNames.set(row.id, row.name);
            }

            for (const journey of journeys) {
                const events = journey.events;
                if (events.length < 2) continue;

                const conversionEvent = events[events.length - 1];
                const priorEvents = events.slice(0, -1);

                if (priorEvents.length === 0) continue;

                const result = await FunnelController.attributionCalculator.calculateAttribution({
                    projectId: funnel.project_id,
                    userIdentifier: journey.userIdentifier,
                    conversionEventId: conversionEvent.id,
                    model: attModel,
                    touchpoints: events,
                });

                for (const tp of result.touchpoints) {
                    if (tp.touchpointEventId === conversionEvent.id) continue;
                    const chId = tp.channelId;
                    if (!channelTotals.has(chId)) {
                        channelTotals.set(chId, {
                            channelId: chId,
                            channelName: channelNames.get(chId) || `Channel ${chId}`,
                            conversions: 0,
                            revenue: 0,
                        });
                    }
                    const ct = channelTotals.get(chId)!;
                    ct.conversions += 1;
                    ct.revenue += tp.attributedValue;
                }
            }

            const channelBreakdown = Array.from(channelTotals.values())
                .sort((a, b) => b.revenue - a.revenue);

            const totalRevenue = channelBreakdown.reduce((s, c) => s + c.revenue, 0);
            const totalConversions = channelBreakdown.reduce((s, c) => s + c.conversions, 0);

            res.json({
                success: true,
                data: {
                    model: attModel,
                    funnelName: funnel.name,
                    totalConversions,
                    totalRevenue,
                    channelBreakdown: channelBreakdown.map(c => ({
                        ...c,
                        revenuePercentage: totalRevenue > 0 ? Math.round((c.revenue / totalRevenue) * 1000) / 10 : 0,
                        conversionPercentage: totalConversions > 0 ? Math.round((c.conversions / totalConversions) * 1000) / 10 : 0,
                    })),
                },
            });
        } catch (error: any) {
            console.error('[FunnelController] funnelAttribution error:', error);
            res.status(500).json({ success: false, message: 'Failed to calculate attribution', error: error.message });
        }
    }

    /**
     * Handle attribution using ad platform physical tables.
     * Each campaign×date row is treated as a touchpoint.
     */
    private static async handleAdPlatformAttribution(
        funnel: { project_id: number; name: string; steps: any[] },
        attModel: AttributionModel,
        start: Date,
        end: Date,
        res: Response,
    ): Promise<void> {
        const touchpoints = await FunnelController.matcherService.getAdPlatformTouchpoints(
            funnel.project_id,
            funnel.steps,
            start,
            end,
        );

        if (touchpoints.length === 0) {
            res.json({
                success: true,
                data: {
                    model: attModel,
                    funnelName: funnel.name,
                    totalConversions: 0,
                    totalRevenue: 0,
                    channelBreakdown: [],
                },
            });
            return;
        }

        // Group touchpoints by channel for attribution
        const channelTouchpoints = new Map<number, IAdPlatformTouchpoint[]>();
        for (const tp of touchpoints) {
            if (!channelTouchpoints.has(tp.channelId)) {
                channelTouchpoints.set(tp.channelId, []);
            }
            channelTouchpoints.get(tp.channelId)!.push(tp);
        }

        // Calculate weights per channel using the attribution model
        // We treat each channel's touchpoints as its "journey"
        let totalConversionValue = 0;
        const channelResults = Array.from(channelTouchpoints.entries()).map(([chId, tps]) => {
            const sorted = tps.sort((a, b) => a.dateObj.getTime() - b.dateObj.getTime());

            const weights = FunnelController.attributionCalculator.calculateWeightsPublic(
                attModel,
                sorted.map(tp => ({ eventTimestamp: tp.dateObj, channelId: tp.channelId, eventValue: tp.conversionValue || tp.conversions })),
                { eventTimestamp: end },
            );

            let attributedRevenue = 0;
            let attributedConversions = 0;
            for (let i = 0; i < sorted.length; i++) {
                const tp = sorted[i];
                const w = weights[i] || 0;
                attributedRevenue += w * (tp.conversionValue || 0);
                attributedConversions += w * (tp.conversions || 0);
            }

            totalConversionValue += attributedRevenue;

            return {
                channelId: chId,
                channelName: tps[0].channelName,
                conversions: Math.round(attributedConversions),
                revenue: attributedRevenue,
            };
        });

        channelResults.sort((a, b) => b.revenue - a.revenue);
        const totalConversions = channelResults.reduce((s, c) => s + c.conversions, 0);

        res.json({
            success: true,
            data: {
                model: attModel,
                funnelName: funnel.name,
                totalConversions,
                totalRevenue: totalConversionValue,
                channelBreakdown: channelResults.map(c => ({
                    ...c,
                    revenuePercentage: totalConversionValue > 0 ? Math.round((c.revenue / totalConversionValue) * 1000) / 10 : 0,
                    conversionPercentage: totalConversions > 0 ? Math.round((c.conversions / totalConversions) * 1000) / 10 : 0,
                })),
            },
        });
    }

    /**
     * GET /funnels/attribution-summary?projectId=X&startDate=Y&endDate=Z
     * Returns multi-model channel credit comparison for all 6 models at once.
     * Uses existing dra_attribution_touchpoints data for speed.
     * When source=ad_platforms, queries ad platform physical tables instead.
     */
    static async attributionSummary(req: Request, res: Response): Promise<void> {
        try {
            const projectId = parseInt(req.query.projectId as string, 10);
            const { startDate, endDate, source } = req.query;

            if (isNaN(projectId)) {
                res.status(400).json({ success: false, message: 'Missing or invalid projectId' });
                return;
            }
            if (!startDate || !endDate) {
                res.status(400).json({ success: false, message: 'Missing startDate and endDate' });
                return;
            }

            const allModels: AttributionModel[] = ['first_touch', 'last_touch', 'linear', 'time_decay', 'u_shaped', 'data_driven'];

            // If source=ad_platforms, run attribution against ad platform tables
            if (source === 'ad_platforms') {
                await FunnelController.handleAdPlatformSummary(projectId, startDate as string, endDate as string, allModels, res);
                return;
            }

            const modelResults: Array<{
                model: AttributionModel;
                label: string;
                channels: Array<{ channelId: number; channelName: string; conversions: number; revenue: number; revenuePercentage: number }>;
            }> = [];

            // Check if dra_attribution_touchpoints has data
            const { AppDataSource } = await import('../datasources/PostgresDS.js');
            const queryRunner = AppDataSource.createQueryRunner();
            await queryRunner.connect();

            const countResult = await queryRunner.query(
                `SELECT COUNT(*) AS cnt FROM "dra_attribution_touchpoints" WHERE project_id = $1`,
                [projectId],
            );
            const hasTouchpoints = parseInt(countResult[0]?.cnt || '0', 10) > 0;

            if (hasTouchpoints) {
                // Fast path: use pre-computed touchpoint weights
                for (const model of allModels) {
                    const channelData = await FunnelController.attributionCalculator.getChannelAttribution(
                        projectId, model, new Date(startDate as string), new Date(endDate as string),
                    );
                    const totalRevenue = channelData.reduce((s, c) => s + c.revenue, 0);
                    modelResults.push({
                        model,
                        label: FunnelController.modelLabel(model),
                        channels: channelData.map(c => ({
                            ...c,
                            revenuePercentage: totalRevenue > 0 ? Math.round((c.revenue / totalRevenue) * 1000) / 10 : 0,
                        })),
                    });
                }
            } else {
                // Slow path: compute from events directly
                let funnel;
                const funnelId = req.query.funnelId ? parseInt(req.query.funnelId as string, 10) : null;
                if (funnelId) {
                    funnel = await FunnelController.definitionService.getById(funnelId);
                } else {
                    const funnels = await FunnelController.definitionService.getByProject(projectId);
                    funnel = funnels[0];
                }
                if (!funnel) {
                    res.json({ success: true, data: { models: [], message: 'No funnels defined for this project. Create a funnel first.' } });
                    return;
                }

                const start = new Date(startDate as string);
                const end = new Date(endDate as string);

                const journeys = await FunnelController.matcherService.getFunnelJourneyEvents(
                    projectId, funnel.steps, start, end,
                );

                for (const model of allModels) {
                    const channelTotals = new Map<number, { channelId: number; channelName: string; conversions: number; revenue: number }>();

                    // Get channel names
                    const channelRows = await queryRunner.query(
                        `SELECT id, name FROM "dra_attribution_channels" WHERE project_id = $1`,
                        [projectId],
                    );
                    const channelNames = new Map<number, string>();
                    for (const row of channelRows) {
                        channelNames.set(row.id, row.name);
                    }

                    for (const journey of journeys) {
                        if (journey.events.length < 2) continue;
                        const conversionEvent = journey.events[journey.events.length - 1];
                        const priorEvents = journey.events.slice(0, -1);
                        if (priorEvents.length === 0) continue;

                        const result = await FunnelController.attributionCalculator.calculateAttribution({
                            projectId,
                            userIdentifier: journey.userIdentifier,
                            conversionEventId: conversionEvent.id,
                            model,
                            touchpoints: journey.events,
                        });

                        for (const tp of result.touchpoints) {
                            if (tp.touchpointEventId === conversionEvent.id) continue;
                            const chId = tp.channelId;
                            if (!channelTotals.has(chId)) {
                                channelTotals.set(chId, {
                                    channelId: chId,
                                    channelName: channelNames.get(chId) || `Channel ${chId}`,
                                    conversions: 0,
                                    revenue: 0,
                                });
                            }
                            const ct = channelTotals.get(chId)!;
                            ct.conversions += 1;
                            ct.revenue += tp.attributedValue;
                        }
                    }

                    const totalRevenue = Array.from(channelTotals.values()).reduce((s, c) => s + c.revenue, 0);
                    modelResults.push({
                        model,
                        label: FunnelController.modelLabel(model),
                        channels: Array.from(channelTotals.values())
                            .sort((a, b) => b.revenue - a.revenue)
                            .map(c => ({
                                ...c,
                                revenuePercentage: totalRevenue > 0 ? Math.round((c.revenue / totalRevenue) * 1000) / 10 : 0,
                            })),
                    });
                }
            }

            await queryRunner.release();

            res.json({ success: true, data: { models: modelResults } });
        } catch (error: any) {
            console.error('[FunnelController] attributionSummary error:', error);
            res.status(500).json({ success: false, message: 'Failed to get attribution summary', error: error.message });
        }
    }

    /**
     * Handle attribution summary using ad platform physical tables.
     * Runs all 6 models against campaign×date touchpoints.
     */
    private static async handleAdPlatformSummary(
        projectId: number,
        startDate: string,
        endDate: string,
        allModels: AttributionModel[],
        res: Response,
    ): Promise<void> {
        const start = new Date(startDate);
        const end = new Date(endDate);

        // Get all funnels for this project
        const funnels = await FunnelController.definitionService.getByProject(projectId);
        if (funnels.length === 0) {
            res.json({ success: true, data: { models: [], message: 'No funnels defined. Create a funnel first.' } });
            return;
        }

        // Use the first funnel's steps for matching
        const funnel = funnels[0];

        const touchpoints = await FunnelController.matcherService.getAdPlatformTouchpoints(
            projectId, funnel.steps, start, end,
        );

        if (touchpoints.length === 0) {
            res.json({ success: true, data: { models: [], message: 'No touchpoints found for the date range.' } });
            return;
        }

        const modelResults = allModels.map(model => {
            const channelTouchpoints = new Map<number, IAdPlatformTouchpoint[]>();
            for (const tp of touchpoints) {
                if (!channelTouchpoints.has(tp.channelId)) {
                    channelTouchpoints.set(tp.channelId, []);
                }
                channelTouchpoints.get(tp.channelId)!.push(tp);
            }

            const channelResults = Array.from(channelTouchpoints.entries()).map(([chId, tps]) => {
                const sorted = tps.sort((a, b) => a.dateObj.getTime() - b.dateObj.getTime());

                const weights = FunnelController.attributionCalculator.calculateWeightsPublic(
                    model,
                    sorted.map(tp => ({ eventTimestamp: tp.dateObj, channelId: tp.channelId, eventValue: tp.conversionValue || tp.conversions })),
                    { eventTimestamp: end },
                );

                let revenue = 0;
                for (let i = 0; i < sorted.length; i++) {
                    revenue += (weights[i] || 0) * (sorted[i].conversionValue || 0);
                }

                return {
                    channelId: chId,
                    channelName: tps[0].channelName,
                    conversions: sorted.reduce((s, tp) => s + tp.conversions, 0),
                    revenue,
                };
            });

            channelResults.sort((a, b) => b.revenue - a.revenue);
            const totalRevenue = channelResults.reduce((s, c) => s + c.revenue, 0);

            return {
                model,
                label: FunnelController.modelLabel(model),
                channels: channelResults.map(c => ({
                    ...c,
                    revenuePercentage: totalRevenue > 0 ? Math.round((c.revenue / totalRevenue) * 1000) / 10 : 0,
                })),
            };
        });

        res.json({ success: true, data: { models: modelResults } });
    }

    private static modelLabel(model: AttributionModel): string {
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
}

export default FunnelController;
