/**
 * Campaign Controller
 *
 * Handles HTTP requests for campaign analysis endpoints.
 * Delegates to CampaignAnalysisService for business logic.
 */

import { Request, Response } from 'express';
import { CampaignAnalysisService } from '../services/CampaignAnalysisService.js';

export class CampaignController {
    /**
     * GET /campaign-analysis/:campaignId
     *
     * Returns deep campaign analysis including:
     * - Aggregated KPIs
     * - Daily trend data
     * - Dimension breakdowns (ad_group, keyword, device, geo)
     * - Performance scoring (1-100) with status labels
     * - AI-generated analysis and recommendations
     *
     * Query params:
     *   dataModelId (required) - ID of the data model
     *   startDate   (required) - ISO 8601 date string
     *   endDate     (required) - ISO 8601 date string
     */
    static async getAnalysis(req: Request, res: Response): Promise<void> {
        try {
            const { campaignId } = req.params;
            const { dataModelId, startDate, endDate } = req.query;

            if (!campaignId) {
                res.status(400).json({ success: false, error: 'campaignId is required' });
                return;
            }
            if (!dataModelId) {
                res.status(400).json({ success: false, error: 'dataModelId is required' });
                return;
            }
            if (!startDate || !endDate) {
                res.status(400).json({ success: false, error: 'startDate and endDate are required' });
                return;
            }

            const service = CampaignAnalysisService.getInstance();
            const result = await service.getAnalysis(
                Number(dataModelId),
                campaignId,
                new Date(startDate as string),
                new Date(endDate as string),
            );

            res.json({ success: true, data: result });
        } catch (error: any) {
            console.error('[CampaignController] getAnalysis error:', error);
            res.status(500).json({
                success: false,
                error: error.message || 'Failed to analyze campaign',
            });
        }
    }

    /**
     * GET /campaign-analysis/:campaignId/summary
     *
     * Returns just the campaign KPI summary cards (lighter endpoint).
     */
    static async getSummary(req: Request, res: Response): Promise<void> {
        try {
            const { campaignId } = req.params;
            const { dataModelId, startDate, endDate } = req.query;

            if (!campaignId || !dataModelId || !startDate || !endDate) {
                res.status(400).json({
                    success: false,
                    error: 'campaignId, dataModelId, startDate, and endDate are required',
                });
                return;
            }

            const service = CampaignAnalysisService.getInstance();
            const result = await service.getKpisOnly(
                Number(dataModelId),
                campaignId,
                new Date(startDate as string),
                new Date(endDate as string),
            );

            // Return only KPIs and basic info
            res.json({
                success: true,
                data: result,
            });
        } catch (error: any) {
            console.error('[CampaignController] getSummary error:', error);
            res.status(500).json({
                success: false,
                error: error.message || 'Failed to get campaign summary',
            });
        }
    }

    /**
     * GET /campaign-analysis/:campaignId/trend
     *
     * Returns only the daily trend data for a campaign.
     */
    static async getTrend(req: Request, res: Response): Promise<void> {
        try {
            const { campaignId } = req.params;
            const { dataModelId, startDate, endDate } = req.query;

            if (!campaignId || !dataModelId || !startDate || !endDate) {
                res.status(400).json({
                    success: false,
                    error: 'campaignId, dataModelId, startDate, and endDate are required',
                });
                return;
            }

            const service = CampaignAnalysisService.getInstance();
            const result = await service.getTrendOnly(
                Number(dataModelId),
                campaignId,
                new Date(startDate as string),
                new Date(endDate as string),
            );

            res.json({
                success: true,
                data: result,
            });
        } catch (error: any) {
            console.error('[CampaignController] getTrend error:', error);
            res.status(500).json({
                success: false,
                error: error.message || 'Failed to get campaign trend',
            });
        }
    }

    /**
     * GET /campaign-analysis/:campaignId/dimensions
     *
     * Returns only the dimension breakdowns for a campaign.
     */
    static async getDimensions(req: Request, res: Response): Promise<void> {
        try {
            const { campaignId } = req.params;
            const { dataModelId, startDate, endDate } = req.query;

            if (!campaignId || !dataModelId || !startDate || !endDate) {
                res.status(400).json({
                    success: false,
                    error: 'campaignId, dataModelId, startDate, and endDate are required',
                });
                return;
            }

            const service = CampaignAnalysisService.getInstance();
            const result = await service.getDimensionsOnly(
                Number(dataModelId),
                campaignId,
                new Date(startDate as string),
                new Date(endDate as string),
            );

            res.json({
                success: true,
                data: result,
            });
        } catch (error: any) {
            console.error('[CampaignController] getDimensions error:', error);
            res.status(500).json({
                success: false,
                error: error.message || 'Failed to get campaign dimensions',
            });
        }
    }
}

export default CampaignController;