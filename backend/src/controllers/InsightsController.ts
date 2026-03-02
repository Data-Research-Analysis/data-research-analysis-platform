import { Request, Response } from 'express';
import { InsightsProcessor } from '../processors/InsightsProcessor.js';
import { DashboardProcessor } from '../processors/DashboardProcessor.js';
import { GeminiService } from '../services/GeminiService.js';
import { AISQLValidatorService } from '../services/AISQLValidatorService.js';

export class InsightsController {
    /**
     * Initialize an insights session
     * POST /insights/session/initialize
     */
    static async initializeSession(req: Request, res: Response): Promise<void> {
        try {
            const { projectId, dataSourceIds } = req.body;
            const tokenDetails = req.body.tokenDetails;
            const userId = tokenDetails?.user_id;

            if (!projectId || !dataSourceIds || !Array.isArray(dataSourceIds) || dataSourceIds.length === 0) {
                res.status(400).json({ 
                    error: 'projectId and dataSourceIds (array with at least 1 element) are required' 
                });
                return;
            }

            const processor = InsightsProcessor.getInstance();
            const result = await processor.initializeSession(
                projectId,
                dataSourceIds,
                userId,
                tokenDetails
            );

            if (result.success) {
                res.status(200).json(result);
            } else {
                res.status(400).json(result);
            }
        } catch (error: any) {
            console.error('Error in initializeSession:', error);
            res.status(500).json({ 
                success: false,
                error: 'Internal server error',
                message: error.message 
            });
        }
    }

    /**
     * Generate insights from AI
     * POST /insights/session/generate
     * Returns immediately (202 Accepted) and processes in background with Socket.IO progress updates
     */
    static async generateInsights(req: Request, res: Response): Promise<void> {
        try {
            const { projectId } = req.body;
            const tokenDetails = req.body.tokenDetails;
            const userId = tokenDetails?.user_id;

            if (!projectId) {
                res.status(400).json({ error: 'projectId is required' });
                return;
            }

            // Immediately return 202 Accepted
            res.status(202).json({ 
                success: true, 
                status: 'processing',
                message: 'Insights generation started. Listen for Socket.IO events for progress updates.'
            });

            // Process in background without awaiting
            const processor = InsightsProcessor.getInstance();
            processor.generateInsights(projectId, userId)
                .catch((error: any) => {
                    console.error('Error in background insights generation:', error);
                    // Emit error event via Socket.IO
                    const { SocketIODriver } = require('../drivers/SocketIODriver.js');
                    SocketIODriver.getInstance().emitToUser(userId, 'insight-error', {
                        projectId,
                        error: error.message || 'Failed to generate insights'
                    });
                });

        } catch (error: any) {
            console.error('Error in generateInsights:', error);
            res.status(500).json({ 
                success: false,
                error: 'Internal server error',
                message: error.message 
            });
        }
    }

    /**
     * Ask a follow-up question
     * POST /insights/session/chat
     */
    static async askFollowUp(req: Request, res: Response): Promise<void> {
        try {
            const { projectId, message } = req.body;
            const tokenDetails = req.body.tokenDetails;
            const userId = tokenDetails?.user_id;

            if (!projectId || !message) {
                res.status(400).json({ error: 'projectId and message are required' });
                return;
            }

            const processor = InsightsProcessor.getInstance();
            const result = await processor.askFollowUp(projectId, message, userId);

            if (result.success) {
                res.status(200).json(result);
            } else {
                res.status(400).json(result);
            }
        } catch (error: any) {
            console.error('Error in askFollowUp:', error);
            res.status(500).json({ 
                success: false,
                error: 'An unexpected error occurred. Please try again later.'
            });
        }
    }

    /**
     * Get active session for a project
     * GET /insights/session/:projectId
     */
    static async getActiveSession(req: Request, res: Response): Promise<void> {
        try {
            const projectId = parseInt(req.params.projectId);
            const tokenDetails = req.body.tokenDetails;
            const userId = tokenDetails?.user_id;

            if (!projectId || isNaN(projectId)) {
                res.status(400).json({ error: 'Valid projectId is required' });
                return;
            }

            const processor = InsightsProcessor.getInstance();
            const result = await processor.getActiveSession(projectId, userId);

            res.status(200).json(result);
        } catch (error: any) {
            console.error('Error in getActiveSession:', error);
            res.status(500).json({ 
                error: 'Internal server error',
                message: error.message 
            });
        }
    }

    /**
     * Cancel active session without saving
     * DELETE /insights/session/:projectId
     */
    static async cancelSession(req: Request, res: Response): Promise<void> {
        try {
            const projectId = parseInt(req.params.projectId);
            const tokenDetails = req.body.tokenDetails;
            const userId = tokenDetails?.user_id;

            if (!projectId || isNaN(projectId)) {
                res.status(400).json({ error: 'Valid projectId is required' });
                return;
            }

            const processor = InsightsProcessor.getInstance();
            const result = await processor.cancelSession(projectId, userId);

            if (result.success) {
                res.status(200).json(result);
            } else {
                res.status(400).json(result);
            }
        } catch (error: any) {
            console.error('Error in cancelSession:', error);
            res.status(500).json({ 
                success: false,
                error: 'Internal server error',
                message: error.message 
            });
        }
    }

    /**
     * Save insight report to database
     * POST /insights/reports/save
     */
    static async saveReport(req: Request, res: Response): Promise<void> {
        try {
            const { projectId, title } = req.body;
            const tokenDetails = req.body.tokenDetails;
            const userId = tokenDetails?.user_id;

            if (!projectId) {
                res.status(400).json({ error: 'projectId is required' });
                return;
            }

            const processor = InsightsProcessor.getInstance();
            const result = await processor.saveInsightReport(projectId, userId, title);

            if (result.success) {
                res.status(201).json(result);
            } else {
                res.status(400).json(result);
            }
        } catch (error: any) {
            console.error('Error in saveReport:', error);
            res.status(500).json({ 
                success: false,
                error: 'Internal server error',
                message: error.message 
            });
        }
    }

    /**
     * Get all insight reports for a project
     * GET /insights/reports/project/:projectId
     */
    static async getReports(req: Request, res: Response): Promise<void> {
        try {
            const projectId = parseInt(req.params.projectId);
            const page = parseInt(req.query.page as string) || 1;
            const limit = parseInt(req.query.limit as string) || 20;
            const tokenDetails = req.body.tokenDetails;
            const userId = tokenDetails?.user_id;

            if (!projectId || isNaN(projectId)) {
                res.status(400).json({ error: 'Valid projectId is required' });
                return;
            }

            const processor = InsightsProcessor.getInstance();
            const result = await processor.getInsightReports(projectId, userId, page, limit);

            if (result.error) {
                res.status(403).json({ error: result.error });
            } else {
                res.status(200).json({
                    reports: result.reports,
                    total: result.total,
                    page,
                    limit,
                    totalPages: Math.ceil(result.total / limit)
                });
            }
        } catch (error: any) {
            console.error('Error in getReports:', error);
            res.status(500).json({ 
                error: 'Internal server error',
                message: error.message 
            });
        }
    }

    /**
     * Get a specific insight report
     * GET /insights/reports/:reportId
     */
    static async getReport(req: Request, res: Response): Promise<void> {
        try {
            const reportId = parseInt(req.params.reportId);
            const tokenDetails = req.body.tokenDetails;
            const userId = tokenDetails?.user_id;

            if (!reportId || isNaN(reportId)) {
                res.status(400).json({ error: 'Valid reportId is required' });
                return;
            }

            const processor = InsightsProcessor.getInstance();
            const result = await processor.getInsightReport(reportId, userId);

            if (result.error) {
                res.status(result.error === 'Report not found' ? 404 : 403).json({ error: result.error });
            } else {
                res.status(200).json(result);
            }
        } catch (error: any) {
            console.error('Error in getReport:', error);
            res.status(500).json({ 
                error: 'Internal server error',
                message: error.message 
            });
        }
    }

    /**
     * Delete an insight report
     * DELETE /insights/reports/:reportId
     */
    static async deleteReport(req: Request, res: Response): Promise<void> {
        try {
            const reportId = parseInt(req.params.reportId);
            const tokenDetails = req.body.tokenDetails;
            const userId = tokenDetails?.user_id;

            if (!reportId || isNaN(reportId)) {
                res.status(400).json({ error: 'Valid reportId is required' });
                return;
            }

            const processor = InsightsProcessor.getInstance();
            const result = await processor.deleteInsightReport(reportId, userId);

            if (result.success) {
                res.status(200).json(result);
            } else {
                res.status(result.error === 'Report not found' ? 404 : 403).json(result);
            }
        } catch (error: any) {
            console.error('Error in deleteReport:', error);
            res.status(500).json({ 
                success: false,
                error: 'Internal server error',
                message: error.message 
            });
        }
    }

    /**
     * Generate an AI dashboard widget from an insights message and add it to a dashboard.
     * POST /insights/session/create-widget
     *
     * Body:
     *   projectId      {number}   — the active project
     *   insightText    {string}   — the AI message text to visualise
     *   dashboardId?   {number}   — existing dashboard to append to (optional)
     *   dashboardName? {string}   — name for a new dashboard when dashboardId is absent
     */
    static async createWidget(req: Request, res: Response): Promise<void> {
        try {
            const { projectId, insightText, dashboardId, dashboardName } = req.body;
            const tokenDetails = req.body.tokenDetails;
            const userId: number = tokenDetails?.user_id;

            if (!projectId || !insightText) {
                res.status(400).json({ error: 'projectId and insightText are required' });
                return;
            }

            const insightsProcessor = InsightsProcessor.getInstance();

            // 1. Retrieve schema context (cached or rebuilt)
            const schemaContext = await insightsProcessor.getOrRebuildSchemaContext(
                parseInt(projectId),
                userId,
                tokenDetails
            );

            if (!schemaContext) {
                res.status(400).json({
                    success: false,
                    error: 'No schema context available. Please initialise an insights session first.',
                });
                return;
            }

            // 2. Ask Gemini to generate the widget spec
            const geminiService = new GeminiService();
            const spec = await geminiService.generateWidgetSpec(
                String(insightText),
                schemaContext,
                parseInt(projectId)
            );

            // 3. Validate the generated SQL
            const validation = await AISQLValidatorService.getInstance().validate(
                spec.sql,
                parseInt(projectId)
            );

            if (!validation.valid) {
                res.status(422).json({
                    success: false,
                    error: `Generated SQL is not safe to execute: ${validation.reason}`,
                });
                return;
            }

            // 4. Resolve or create the target dashboard
            const dashProcessor = DashboardProcessor.getInstance();
            const resolvedDashboardId = await dashProcessor.resolveOrCreateDashboard(
                parseInt(projectId),
                userId,
                dashboardId ? parseInt(dashboardId) : undefined,
                dashboardName
            );

            // 5. Append the widget
            const { chartId } = await dashProcessor.createAIWidget({
                dashboardId: resolvedDashboardId,
                userId,
                spec,
            });

            res.status(200).json({
                success: true,
                dashboardId: resolvedDashboardId,
                chartId,
                spec,
            });
        } catch (error: any) {
            console.error('Error in createWidget:', error);
            res.status(500).json({
                success: false,
                error: 'Internal server error',
                message: error.message,
            });
        }
    }
}
