/**
 * Marketing Metrics Controller
 *
 * HTTP request/response handler for marketing metrics calculation endpoints.
 * Handles authentication, input validation, and delegates to MarketingMetricsService.
 */

import { Request, Response } from 'express';
import { MarketingMetricsService } from '../services/MarketingMetricsService.js';
import { AnomalyDetectionService } from '../services/AnomalyDetectionService.js';

export class MarketingMetricsController {
    private static service = MarketingMetricsService.getInstance();
    private static anomalyService = AnomalyDetectionService.getInstance();

    /**
     * GET /marketing-metrics/summary
     *
     * Returns aggregated marketing KPIs for a data model within a date range.
     * Query params: dataModelId (required), startDate (required), endDate (required)
     */
    static async getSummary(req: Request, res: Response): Promise<void> {
        try {
            const { dataModelId, startDate, endDate } = req.query;

            if (!dataModelId || !startDate || !endDate) {
                res.status(400).json({
                    success: false,
                    message: 'Missing required query parameters: dataModelId, startDate, endDate',
                });
                return;
            }

            const dmId = Number(dataModelId);
            if (isNaN(dmId) || dmId <= 0) {
                res.status(400).json({ success: false, message: 'Invalid dataModelId' });
                return;
            }

            const start = new Date(startDate as string);
            const end = new Date(endDate as string);
            if (isNaN(start.getTime()) || isNaN(end.getTime())) {
                res.status(400).json({ success: false, message: 'Invalid date format' });
                return;
            }
            if (start >= end) {
                res.status(400).json({ success: false, message: 'startDate must be before endDate' });
                return;
            }

            const summary = await MarketingMetricsController.service.getMarketingSummary(dmId, start, end);
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
     *
     * Returns cross-channel comparison for a data model.
     * Query params: dataModelId (required), startDate (required), endDate (required)
     */
    static async getChannelComparison(req: Request, res: Response): Promise<void> {
        try {
            const { dataModelId, startDate, endDate } = req.query;

            if (!dataModelId || !startDate || !endDate) {
                res.status(400).json({
                    success: false,
                    message: 'Missing required query parameters: dataModelId, startDate, endDate',
                });
                return;
            }

            const dmId = Number(dataModelId);
            if (isNaN(dmId) || dmId <= 0) {
                res.status(400).json({ success: false, message: 'Invalid dataModelId' });
                return;
            }

            const start = new Date(startDate as string);
            const end = new Date(endDate as string);
            if (isNaN(start.getTime()) || isNaN(end.getTime())) {
                res.status(400).json({ success: false, message: 'Invalid date format' });
                return;
            }
            if (start >= end) {
                res.status(400).json({ success: false, message: 'startDate must be before endDate' });
                return;
            }

            const channels = await MarketingMetricsController.service.getChannelComparison(dmId, start, end);
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
     *
     * Returns period-over-period comparison.
     * Body: { dataModelId, currentStart, currentEnd, priorStart, priorEnd }
     */
    static async getPeriodComparison(req: Request, res: Response): Promise<void> {
        try {
            const { dataModelId, currentStart, currentEnd, priorStart, priorEnd } = req.body;

            if (!dataModelId || !currentStart || !currentEnd || !priorStart || !priorEnd) {
                res.status(400).json({
                    success: false,
                    message: 'Missing required body parameters: dataModelId, currentStart, currentEnd, priorStart, priorEnd',
                });
                return;
            }

            const dmId = Number(dataModelId);
            if (isNaN(dmId) || dmId <= 0) {
                res.status(400).json({ success: false, message: 'Invalid dataModelId' });
                return;
            }

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
                dmId, cStart, cEnd, pStart, pEnd,
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
     *
     * Returns campaign-level drill-down with daily KPIs.
     * Query params: dataModelId (required), startDate (required), endDate (required)
     * Path params: campaignId (required)
     */
    static async getCampaignDetail(req: Request, res: Response): Promise<void> {
        try {
            const { campaignId } = req.params;
            const { dataModelId, startDate, endDate } = req.query;

            if (!campaignId) {
                res.status(400).json({ success: false, message: 'Missing campaignId parameter' });
                return;
            }

            if (!dataModelId || !startDate || !endDate) {
                res.status(400).json({
                    success: false,
                    message: 'Missing required query parameters: dataModelId, startDate, endDate',
                });
                return;
            }

            const dmId = Number(dataModelId);
            if (isNaN(dmId) || dmId <= 0) {
                res.status(400).json({ success: false, message: 'Invalid dataModelId' });
                return;
            }

            const start = new Date(startDate as string);
            const end = new Date(endDate as string);
            if (isNaN(start.getTime()) || isNaN(end.getTime())) {
                res.status(400).json({ success: false, message: 'Invalid date format' });
                return;
            }
            if (start >= end) {
                res.status(400).json({ success: false, message: 'startDate must be before endDate' });
                return;
            }

            const detail = await MarketingMetricsController.service.getCampaignDetail(
                dmId, campaignId, start, end,
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
     *
     * Returns paginated campaign performance list with KPIs, status, and trends.
     * Query params: dataModelId (required), startDate (required), endDate (required),
     *               search (optional), channel (optional), status (optional),
     *               sortBy (optional, default 'spend'), sortDir (optional, default 'desc'),
     *               page (optional, default 1), pageSize (optional, default 20)
     */
    static async getCampaignPerformanceList(req: Request, res: Response): Promise<void> {
        try {
            const { dataModelId, startDate, endDate, search, channel, status, sortBy, sortDir, page, pageSize } = req.query;

            if (!dataModelId || !startDate || !endDate) {
                res.status(400).json({
                    success: false,
                    message: 'Missing required query parameters: dataModelId, startDate, endDate',
                });
                return;
            }

            const dmId = Number(dataModelId);
            if (isNaN(dmId) || dmId <= 0) {
                res.status(400).json({ success: false, message: 'Invalid dataModelId' });
                return;
            }

            const start = new Date(startDate as string);
            const end = new Date(endDate as string);
            if (isNaN(start.getTime()) || isNaN(end.getTime())) {
                res.status(400).json({ success: false, message: 'Invalid date format' });
                return;
            }
            if (start >= end) {
                res.status(400).json({ success: false, message: 'startDate must be before endDate' });
                return;
            }

            const result = await MarketingMetricsController.service.getCampaignPerformanceList(dmId, start, end, {
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
     *
     * Returns detected anomalies based on 4-week rolling average.
     * Query params: dataModelId (required), startDate (required), endDate (required), threshold (optional, default 20)
     */
    static async getAnomalies(req: Request, res: Response): Promise<void> {
        try {
            const { dataModelId, startDate, endDate, threshold } = req.query;

            if (!dataModelId || !startDate || !endDate) {
                res.status(400).json({
                    success: false,
                    message: 'Missing required query parameters: dataModelId, startDate, endDate',
                });
                return;
            }

            const dmId = Number(dataModelId);
            if (isNaN(dmId) || dmId <= 0) {
                res.status(400).json({ success: false, message: 'Invalid dataModelId' });
                return;
            }

            const start = new Date(startDate as string);
            const end = new Date(endDate as string);
            if (isNaN(start.getTime()) || isNaN(end.getTime())) {
                res.status(400).json({ success: false, message: 'Invalid date format' });
                return;
            }
            if (start >= end) {
                res.status(400).json({ success: false, message: 'startDate must be before endDate' });
                return;
            }

            const thresholdNum = threshold ? Number(threshold) : 20;
            if (isNaN(thresholdNum) || thresholdNum <= 0) {
                res.status(400).json({ success: false, message: 'Invalid threshold value' });
                return;
            }

            const anomalies = await MarketingMetricsController.service.getAnomalies(dmId, start, end, thresholdNum);
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
     * Detects anomalies and generates actionable alerts using four detection methods:
     * - Sudden Change (>2 std dev from 30-day rolling average)
     * - Trend Break (direction reversal)
     * - Budget Pacing (>120% or <80% of daily budget)
     * - Performance Threshold (CPA > 2x target, ROAS < 0.5x target)
     *
     * Optionally enhances alerts with AI-generated descriptions via Gemini.
     *
     * Body: {
     *   data_model_id (required),
     *   date_range: { start, end } (required),
     *   thresholds?: { suddenChange, budgetHigh, budgetLow, cpaMultiplier, roasMultiplier },
     *   include_ai_enhancement?: boolean,
     *   daily_budget?: number,
     *   cpa_target?: number,
     *   roas_target?: number
     * }
     */
    static async detectAnomalies(req: Request, res: Response): Promise<void> {
        try {
            const {
                data_model_id,
                date_range,
                thresholds,
                include_ai_enhancement,
                daily_budget,
                cpa_target,
                roas_target,
            } = req.body;

            if (!data_model_id) {
                res.status(400).json({
                    success: false,
                    message: 'Missing required body parameter: data_model_id',
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

            const dmId = Number(data_model_id);
            if (isNaN(dmId) || dmId <= 0) {
                res.status(400).json({ success: false, message: 'Invalid data_model_id' });
                return;
            }

            const startDate = new Date(date_range.start);
            const endDate = new Date(date_range.end);
            if (isNaN(startDate.getTime()) || isNaN(endDate.getTime())) {
                res.status(400).json({ success: false, message: 'Invalid date format in date_range' });
                return;
            }
            if (startDate >= endDate) {
                res.status(400).json({ success: false, message: 'date_range.start must be before date_range.end' });
                return;
            }

            const result = await MarketingMetricsController.anomalyService.detectAlerts(
                dmId,
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
     * POST /marketing-metrics/insights
     *
     * Generates AI-powered marketing insights using Gemini.
     * Body: { dataModelId, startDate, endDate }
     */
    static async getAIInsights(req: Request, res: Response): Promise<void> {
        try {
            const { dataModelId, startDate, endDate } = req.body;

            if (!dataModelId || !startDate || !endDate) {
                res.status(400).json({
                    success: false,
                    message: 'Missing required body parameters: dataModelId, startDate, endDate',
                });
                return;
            }

            const dmId = Number(dataModelId);
            if (isNaN(dmId) || dmId <= 0) {
                res.status(400).json({ success: false, message: 'Invalid dataModelId' });
                return;
            }

            const start = new Date(startDate);
            const end = new Date(endDate);
            if (isNaN(start.getTime()) || isNaN(end.getTime())) {
                res.status(400).json({ success: false, message: 'Invalid date format' });
                return;
            }
            if (start >= end) {
                res.status(400).json({ success: false, message: 'startDate must be before endDate' });
                return;
            }

            const insights = await MarketingMetricsController.service.generateAIInsights(dmId, start, end);
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