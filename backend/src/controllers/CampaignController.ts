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
            const { dataModelId, projectId, startDate, endDate, sourceTable, campaignColumn } = req.query;

            console.log(`[CampaignController] getAnalysis called — campaignId: "${campaignId}", projectId: "${projectId}", dataModelId: "${dataModelId}", startDate: "${startDate}", endDate: "${endDate}", sourceTable: "${sourceTable}", campaignColumn: "${campaignColumn}"`);

            if (!campaignId) {
                console.log(`[CampaignController] FAILED: campaignId is required`);
                res.status(400).json({ success: false, error: 'campaignId is required' });
                return;
            }
            if (!dataModelId && !projectId) {
                console.log(`[CampaignController] FAILED: dataModelId or projectId is required`);
                res.status(400).json({ success: false, error: 'dataModelId or projectId is required' });
                return;
            }
            if (!startDate || !endDate) {
                console.log(`[CampaignController] FAILED: startDate and endDate are required`);
                res.status(400).json({ success: false, error: 'startDate and endDate are required' });
                return;
            }

            const service = CampaignAnalysisService.getInstance();
            const id = projectId ? Number(projectId) : Number(dataModelId);
            console.log(`[CampaignController] Calling getAnalysis with id=${id}, isProjectId=${!!projectId}`);
            const result = await service.getAnalysis(
                id,
                campaignId,
                new Date(startDate as string),
                new Date(endDate as string),
                {
                    isProjectId: !!projectId,
                    sourceTable: sourceTable as string | undefined,
                    campaignColumn: campaignColumn as string | undefined,
                },
            );

            console.log(`[CampaignController] SUCCESS — result keys: ${Object.keys(result).join(', ')}, kpis: ${result.kpis?.length ?? 0}, dailyTrend: ${result.dailyTrend?.length ?? 0}, dimensionBreakdowns: ${result.dimensionBreakdowns?.length ?? 0}`);
            res.json({ success: true, data: result });
        } catch (error: any) {
            console.error(`[CampaignController] getAnalysis ERROR: "${error.message}"`, error.stack);
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
            const { dataModelId, projectId, startDate, endDate, sourceTable, campaignColumn } = req.query;

            if (!campaignId || (!dataModelId && !projectId) || !startDate || !endDate) {
                res.status(400).json({
                    success: false,
                    error: 'campaignId, dataModelId or projectId, startDate, and endDate are required',
                });
                return;
            }

            const service = CampaignAnalysisService.getInstance();
            const id = projectId ? Number(projectId) : Number(dataModelId);
            const result = await service.getKpisOnly(
                id,
                campaignId,
                new Date(startDate as string),
                new Date(endDate as string),
                {
                    isProjectId: !!projectId,
                    sourceTable: sourceTable as string | undefined,
                    campaignColumn: campaignColumn as string | undefined,
                },
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
            const { dataModelId, projectId, startDate, endDate, sourceTable, campaignColumn } = req.query;

            if (!campaignId || (!dataModelId && !projectId) || !startDate || !endDate) {
                res.status(400).json({
                    success: false,
                    error: 'campaignId, dataModelId or projectId, startDate, and endDate are required',
                });
                return;
            }

            const service = CampaignAnalysisService.getInstance();
            const id = projectId ? Number(projectId) : Number(dataModelId);
            const result = await service.getTrendOnly(
                id,
                campaignId,
                new Date(startDate as string),
                new Date(endDate as string),
                {
                    isProjectId: !!projectId,
                    sourceTable: sourceTable as string | undefined,
                    campaignColumn: campaignColumn as string | undefined,
                },
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
            const { dataModelId, projectId, startDate, endDate, sourceTable, campaignColumn } = req.query;

            if (!campaignId || (!dataModelId && !projectId) || !startDate || !endDate) {
                res.status(400).json({
                    success: false,
                    error: 'campaignId, dataModelId or projectId, startDate, and endDate are required',
                });
                return;
            }

            const service = CampaignAnalysisService.getInstance();
            const id = projectId ? Number(projectId) : Number(dataModelId);
            const result = await service.getDimensionsOnly(
                id,
                campaignId,
                new Date(startDate as string),
                new Date(endDate as string),
                {
                    isProjectId: !!projectId,
                    sourceTable: sourceTable as string | undefined,
                    campaignColumn: campaignColumn as string | undefined,
                },
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