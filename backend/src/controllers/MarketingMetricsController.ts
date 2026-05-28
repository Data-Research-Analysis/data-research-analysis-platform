/**
 * Marketing Metrics Controller
 *
 * HTTP request/response handler for marketing metrics calculation endpoints.
 * Handles authentication, input validation, and delegates to MarketingMetricsService.
 */

import { Request, Response } from 'express';
import { MarketingMetricsService } from '../services/MarketingMetricsService.js';

export class MarketingMetricsController {
    private static service = MarketingMetricsService.getInstance();

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