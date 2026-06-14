/**
 * Marketing Metrics Controller
 *
 * HTTP request/response handler for marketing metrics calculation endpoints.
 * Handles authentication, input validation, and delegates to MarketingMetricsService.
 *
 * ARCHITECTURE REFACTOR (Plan v2 — Project-Based Resolution):
 * - Primary parameter is now projectId (for API-based data sources)
 * - dataModelId is still accepted as fallback for file-based sources
 * - Backend resolves physical tables via project_id instead of data_model_id
 */

import { Request, Response } from 'express';
import { MarketingMetricsService } from '../services/MarketingMetricsService.js';
import { AnomalyDetectionService } from '../services/AnomalyDetectionService.js';
import { BudgetOptimizationService } from '../services/BudgetOptimizationService.js';

export class MarketingMetricsController {
    private static service = MarketingMetricsService.getInstance();
    private static anomalyService = AnomalyDetectionService.getInstance();
    private static budgetOptimizationService = BudgetOptimizationService.getInstance();

    /**
     * Extract projectId or dataModelId from request (query or body).
     * Priority: projectId > dataModelId
     */
    private static extractId(req: Request): { projectId?: number; dataModelId?: number } {
        const projectId = req.query.projectId || req.body?.projectId || req.query.project_id || req.body?.project_id;
        const dataModelId = req.query.dataModelId || req.body?.dataModelId || req.query.data_model_id || req.body?.data_model_id;

        if (projectId) {
            const pid = Number(projectId);
            if (!isNaN(pid) && pid > 0) return { projectId: pid };
        }
        if (dataModelId) {
            const dmId = Number(dataModelId);
            if (!isNaN(dmId) && dmId > 0) return { dataModelId: dmId };
        }
        return {};
    }

    /**
     * Validate that an identifier (projectId or dataModelId) was provided.
     */
    private static validateId(ids: { projectId?: number; dataModelId?: number }): boolean {
        return !!(ids.projectId || ids.dataModelId);
    }

    /**
     * GET /marketing-metrics/summary
     */
    static async getSummary(req: Request, res: Response): Promise<void> {
        try {
            const { startDate, endDate } = req.query;
            const ids = MarketingMetricsController.extractId(req);

            if (!MarketingMetricsController.validateId(ids) || !startDate || !endDate) {
                res.status(400).json({
                    success: false,
                    message: 'Missing required query parameters: (projectId or dataModelId), startDate, endDate',
                });
                return;
            }

            const id = ids.projectId || ids.dataModelId!;
            const isProjectId = !!ids.projectId;

            const start = new Date(startDate as string);
            const end = new Date(endDate as string);
            if (isNaN(start.getTime()) || isNaN(end.getTime())) {
                res.status(400).json({ success: false, message: 'Invalid date format' });
                return;
            }
            if (start > end) {
                res.status(400).json({ success: false, message: 'startDate must be before endDate' });
                return;
            }

            const summary = await MarketingMetricsController.service.getMarketingSummary(id, start, end, { isProjectId });
            res.json({ success: true, data: summary });
        } catch (error: any) {
            console.error('[MarketingMetricsController] getSummary error:', error);
            res.status(500).json({
                success: false,
                message: 'Failed to calculate marketing summary',
                error: error.message,
            });
        }
    }

    /**
     * GET /marketing-metrics/channels
     */
    static async getChannelComparison(req: Request, res: Response): Promise<void> {
        try {
            const { startDate, endDate } = req.query;
            const ids = MarketingMetricsController.extractId(req);

            if (!MarketingMetricsController.validateId(ids) || !startDate || !endDate) {
                res.status(400).json({
                    success: false,
                    message: 'Missing required query parameters: (projectId or dataModelId), startDate, endDate',
                });
                return;
            }

            const id = ids.projectId || ids.dataModelId!;
            const isProjectId = !!ids.projectId;

            const start = new Date(startDate as string);
            const end = new Date(endDate as string);
            if (isNaN(start.getTime()) || isNaN(end.getTime())) {
                res.status(400).json({ success: false, message: 'Invalid date format' });
                return;
            }
            if (start > end) {
                res.status(400).json({ success: false, message: 'startDate must be before endDate' });
                return;
            }

            const channels = await MarketingMetricsController.service.getChannelComparison(id, start, end, { isProjectId });
            res.json({ success: true, data: channels });
        } catch (error: any) {
            console.error('[MarketingMetricsController] getChannelComparison error:', error);
            res.status(500).json({
                success: false,
                message: 'Failed to compare channels',
                error: error.message,
            });
        }
    }

    /**
     * POST /marketing-metrics/period-comparison
     */
    static async getPeriodComparison(req: Request, res: Response): Promise<void> {
        try {
            const { currentStart, currentEnd, priorStart, priorEnd } = req.body;
            const ids = MarketingMetricsController.extractId(req);

            if (!MarketingMetricsController.validateId(ids) || !currentStart || !currentEnd || !priorStart || !priorEnd) {
                res.status(400).json({
                    success: false,
                    message: 'Missing required body parameters: (projectId or dataModelId), currentStart, currentEnd, priorStart, priorEnd',
                });
                return;
            }

            const id = ids.projectId || ids.dataModelId!;
            const isProjectId = !!ids.projectId;

            const cStart = new Date(currentStart);
            const cEnd = new Date(currentEnd);
            const pStart = new Date(priorStart);
            const pEnd = new Date(priorEnd);

            if ([cStart, cEnd, pStart, pEnd].some(d => isNaN(d.getTime()))) {
                res.status(400).json({ success: false, message: 'Invalid date format' });
                return;
            }
            if (cStart >= cEnd) {
                res.status(400).json({ success: false, message: 'currentStart must be before currentEnd' });
                return;
            }
            if (pStart >= pEnd) {
                res.status(400).json({ success: false, message: 'priorStart must be before priorEnd' });
                return;
            }

            const comparison = await MarketingMetricsController.service.getPeriodComparison(
                id, cStart, cEnd, pStart, pEnd, { isProjectId },
            );
            res.json({ success: true, data: comparison });
        } catch (error: any) {
            console.error('[MarketingMetricsController] getPeriodComparison error:', error);
            res.status(500).json({
                success: false,
                message: 'Failed to compare periods',
                error: error.message,
            });
        }
    }

    /**
     * GET /marketing-metrics/campaigns/:campaignId
     */
    static async getCampaignDetail(req: Request, res: Response): Promise<void> {
        try {
            const { campaignId } = req.params;
            const { startDate, endDate } = req.query;
            const ids = MarketingMetricsController.extractId(req);

            if (!campaignId) {
                res.status(400).json({ success: false, message: 'Missing campaignId parameter' });
                return;
            }

            if (!MarketingMetricsController.validateId(ids) || !startDate || !endDate) {
                res.status(400).json({
                    success: false,
                    message: 'Missing required query parameters: (projectId or dataModelId), startDate, endDate',
                });
                return;
            }

            const id = ids.projectId || ids.dataModelId!;
            const isProjectId = !!ids.projectId;

            const start = new Date(startDate as string);
            const end = new Date(endDate as string);
            if (isNaN(start.getTime()) || isNaN(end.getTime())) {
                res.status(400).json({ success: false, message: 'Invalid date format' });
                return;
            }
            if (start > end) {
                res.status(400).json({ success: false, message: 'startDate must be before endDate' });
                return;
            }

            const detail = await MarketingMetricsController.service.getCampaignDetail(
                id, campaignId, start, end, { isProjectId },
            );
            res.json({ success: true, data: detail });
        } catch (error: any) {
            console.error('[MarketingMetricsController] getCampaignDetail error:', error);
            res.status(500).json({
                success: false,
                message: 'Failed to get campaign detail',
                error: error.message,
            });
        }
    }

    /**
     * GET /marketing-metrics/campaigns
     */
    static async getCampaignPerformanceList(req: Request, res: Response): Promise<void> {
        try {
            const { startDate, endDate, search, channel, status, sortBy, sortDir, page, pageSize } = req.query;
            const ids = MarketingMetricsController.extractId(req);

            if (!MarketingMetricsController.validateId(ids) || !startDate || !endDate) {
                res.status(400).json({
                    success: false,
                    message: 'Missing required query parameters: (projectId or dataModelId), startDate, endDate',
                });
                return;
            }

            const id = ids.projectId || ids.dataModelId!;
            const isProjectId = !!ids.projectId;

            const start = new Date(startDate as string);
            const end = new Date(endDate as string);
            if (isNaN(start.getTime()) || isNaN(end.getTime())) {
                res.status(400).json({ success: false, message: 'Invalid date format' });
                return;
            }
            if (start > end) {
                res.status(400).json({ success: false, message: 'startDate must be before endDate' });
                return;
            }

            const result = await MarketingMetricsController.service.getCampaignPerformanceList(id, start, end, {
                isProjectId,
                search: search as string | undefined,
                channel: channel as string | undefined,
                status: status as string | undefined,
                sortBy: sortBy as string | undefined,
                sortDir: sortDir as 'asc' | 'desc' | undefined,
                page: page ? Number(page) : undefined,
                pageSize: pageSize ? Number(pageSize) : undefined,
            });
            res.json({ success: true, data: result.rows, total: result.total });
        } catch (error: any) {
            console.error('[MarketingMetricsController] getCampaignPerformanceList error:', error);
            res.status(500).json({
                success: false,
                message: 'Failed to fetch campaign performance list',
                error: error.message,
            });
        }
    }

    /**
     * GET /marketing-metrics/anomalies
     */
    static async getAnomalies(req: Request, res: Response): Promise<void> {
        try {
            const { startDate, endDate, threshold } = req.query;
            const ids = MarketingMetricsController.extractId(req);

            if (!MarketingMetricsController.validateId(ids) || !startDate || !endDate) {
                res.status(400).json({
                    success: false,
                    message: 'Missing required query parameters: (projectId or dataModelId), startDate, endDate',
                });
                return;
            }

            const id = ids.projectId || ids.dataModelId!;
            const isProjectId = !!ids.projectId;

            const start = new Date(startDate as string);
            const end = new Date(endDate as string);
            if (isNaN(start.getTime()) || isNaN(end.getTime())) {
                res.status(400).json({ success: false, message: 'Invalid date format' });
                return;
            }
            if (start > end) {
                res.status(400).json({ success: false, message: 'startDate must be before endDate' });
                return;
            }

            const thresholdNum = threshold ? Number(threshold) : 20;
            if (isNaN(thresholdNum) || thresholdNum <= 0) {
                res.status(400).json({ success: false, message: 'Invalid threshold value' });
                return;
            }

            const anomalies = await MarketingMetricsController.service.getAnomalies(id, start, end, thresholdNum, { isProjectId });
            res.json({ success: true, data: anomalies });
        } catch (error: any) {
            console.error('[MarketingMetricsController] getAnomalies error:', error);
            res.status(500).json({
                success: false,
                message: 'Failed to detect anomalies',
                error: error.message,
            });
        }
    }

    /**
     * POST /marketing-metrics/anomalies
     *
     * Body: { project_id (or data_model_id), date_range, thresholds, include_ai_enhancement, daily_budget, cpa_target, roas_target }
     */
    static async detectAnomalies(req: Request, res: Response): Promise<void> {
        try {
            const {
                data_model_id,
                project_id,
                date_range,
                thresholds,
                include_ai_enhancement,
                daily_budget,
                cpa_target,
                roas_target,
            } = req.body;

            let id: number;
            let isProjectId: boolean;

            if (project_id) {
                id = Number(project_id);
                isProjectId = true;
            } else if (data_model_id) {
                id = Number(data_model_id);
                isProjectId = false;
            } else {
                res.status(400).json({
                    success: false,
                    message: 'Missing required body parameter: project_id or data_model_id',
                });
                return;
            }

            if (isNaN(id) || id <= 0) {
                res.status(400).json({ success: false, message: 'Invalid project_id or data_model_id' });
                return;
            }

            if (!date_range || !date_range.start || !date_range.end) {
                res.status(400).json({
                    success: false,
                    message: 'Missing required body parameter: date_range with start and end',
                });
                return;
            }

            const startDate = new Date(date_range.start);
            const endDate = new Date(date_range.end);
            if (isNaN(startDate.getTime()) || isNaN(endDate.getTime())) {
                res.status(400).json({ success: false, message: 'Invalid date format in date_range' });
                return;
            }
            if (startDate > endDate) {
                res.status(400).json({ success: false, message: 'date_range.start must be before date_range.end' });
                return;
            }

            const result = await MarketingMetricsController.anomalyService.detectAlerts(
                id,
                startDate,
                endDate,
                {
                    thresholds,
                    includeAiEnhancement: include_ai_enhancement ?? false,
                    dailyBudget: daily_budget,
                    cpaTarget: cpa_target,
                    roasTarget: roas_target,
                },
            );

            res.json({ success: true, data: result });
        } catch (error: any) {
            console.error('[MarketingMetricsController] detectAnomalies error:', error);
            res.status(500).json({
                success: false,
                message: 'Failed to detect anomalies',
                error: error.message,
            });
        }
    }

    /**
     * POST /marketing-metrics/budget-optimize
     *
     * Body: { project_id (or data_model_id), total_budget, date_range, optimization_goal, include_ai_enhancement }
     */
    static async optimizeBudget(req: Request, res: Response): Promise<void> {
        try {
            const {
                data_model_id,
                project_id,
                total_budget,
                date_range,
                optimization_goal,
                include_ai_enhancement,
            } = req.body;

            let id: number;
            let isProjectId: boolean;

            if (project_id) {
                id = Number(project_id);
                isProjectId = true;
            } else if (data_model_id) {
                id = Number(data_model_id);
                isProjectId = false;
            } else {
                res.status(400).json({
                    success: false,
                    message: 'Missing required body parameter: project_id or data_model_id',
                });
                return;
            }

            if (isNaN(id) || id <= 0) {
                res.status(400).json({ success: false, message: 'Invalid project_id or data_model_id' });
                return;
            }

            if (total_budget === undefined || total_budget === null || total_budget <= 0) {
                res.status(400).json({
                    success: false,
                    message: 'Missing or invalid required body parameter: total_budget (must be > 0)',
                });
                return;
            }

            if (!date_range || !date_range.start || !date_range.end) {
                res.status(400).json({
                    success: false,
                    message: 'Missing required body parameter: date_range with start and end',
                });
                return;
            }

            const validGoals = ['maximize_conversions', 'minimize_cpa', 'maximize_roas'];
            if (!optimization_goal || !validGoals.includes(optimization_goal)) {
                res.status(400).json({
                    success: false,
                    message: `Invalid optimization_goal. Must be one of: ${validGoals.join(', ')}`,
                });
                return;
            }

            const startDate = new Date(date_range.start);
            const endDate = new Date(date_range.end);
            if (isNaN(startDate.getTime()) || isNaN(endDate.getTime())) {
                res.status(400).json({ success: false, message: 'Invalid date format in date_range' });
                return;
            }
            if (startDate > endDate) {
                res.status(400).json({ success: false, message: 'date_range.start must be before date_range.end' });
                return;
            }

            const result = await MarketingMetricsController.budgetOptimizationService.optimize({
                ...(isProjectId ? { project_id: id } : { data_model_id: id }),
                total_budget: Number(total_budget),
                date_range: { start: startDate, end: endDate },
                optimization_goal: optimization_goal as any,
                include_ai_enhancement: include_ai_enhancement ?? false,
            });

            res.json({ success: true, data: result });
        } catch (error: any) {
            console.error('[MarketingMetricsController] optimizeBudget error:', error);
            res.status(500).json({
                success: false,
                message: 'Failed to optimize budget allocation',
                error: error.message,
            });
        }
    }

    /**
     * POST /marketing-metrics/insights
     *
     * Body: { projectId (or dataModelId or project_id or data_model_id), startDate, endDate }
     */
    static async getAIInsights(req: Request, res: Response): Promise<void> {
        try {
            const { startDate, endDate } = req.body;

            let id: number;
            let isProjectId: boolean;

            if (req.body.projectId || req.body.project_id) {
                id = Number(req.body.projectId || req.body.project_id);
                isProjectId = true;
            } else if (req.body.dataModelId || req.body.data_model_id) {
                id = Number(req.body.dataModelId || req.body.data_model_id);
                isProjectId = false;
            } else {
                res.status(400).json({
                    success: false,
                    message: 'Missing required body parameters: (projectId or dataModelId), startDate, endDate',
                });
                return;
            }

            if (!startDate || !endDate) {
                res.status(400).json({
                    success: false,
                    message: 'Missing required body parameters: startDate, endDate',
                });
                return;
            }

            if (isNaN(id) || id <= 0) {
                res.status(400).json({ success: false, message: 'Invalid projectId or dataModelId' });
                return;
            }

            const start = new Date(startDate);
            const end = new Date(endDate);
            if (isNaN(start.getTime()) || isNaN(end.getTime())) {
                res.status(400).json({ success: false, message: 'Invalid date format' });
                return;
            }
            if (start > end) {
                res.status(400).json({ success: false, message: 'startDate must be before endDate' });
                return;
            }

            const insights = await MarketingMetricsController.service.generateAIInsights(id, start, end, { isProjectId });
            res.json({ success: true, data: insights });
        } catch (error: any) {
            console.error('[MarketingMetricsController] getAIInsights error:', error);
            res.status(500).json({
                success: false,
                message: 'Failed to generate AI insights',
                error: error.message,
            });
        }
    }

}

export default MarketingMetricsController;
