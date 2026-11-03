import express, { Request, Response } from 'express';
import { validateJWT } from '../middleware/authenticate.js';
import { validate } from '../middleware/validator.js';
import { body, param, query, matchedData } from 'express-validator';
import { DashboardProcessor } from '../processors/DashboardProcessor.js';
import { InsightsProcessor } from '../processors/InsightsProcessor.js';
import { GeminiService } from '../services/GeminiService.js';
import { AI_FEATURE_KEYS } from '../services/AICallTrackerService.js';
import { AISQLValidatorService } from '../services/AISQLValidatorService.js';
import { DashboardAutoGenerationService } from '../services/DashboardAutoGenerationService.js';
import { authorize } from '../middleware/authorize.js';
import { Permission } from '../constants/permissions.js';
import { 
    requireProjectPermission, 
    requireDashboardPermission 
} from '../middleware/rbacMiddleware.js';
import { EAction } from '../services/PermissionService.js';
import { aiOperationsLimiter } from '../middleware/rateLimit.js';
import { optionalOrganizationContext, organizationContext, type IOrganizationContextRequest } from '../middleware/organizationContext.js';
import { workspaceContext, type IWorkspaceContextRequest } from '../middleware/workspaceContext.js';
import { BrandingService } from '../services/BrandingService.js';
import { CreditWalletService } from '../services/CreditWalletService.js';
import { CreditInsufficientError } from '../types/CreditInsufficientError.js';
import { resolveProjectOrganizationId } from '../utils/orgResolver.js';
const router = express.Router();

router.get('/list', async (req: Request, res: Response, next: any) => {
    next();
}, validateJWT, optionalOrganizationContext, async (req: IOrganizationContextRequest, res: Response) => {
    const organizationId = req.organizationId || null;
    const data_sources_list = await DashboardProcessor.getInstance().getDashboards(req.body.tokenDetails, organizationId);    
    res.status(200).send(data_sources_list);
});

/**
 * GET /dashboard/:dashboard_id
 * Return a single dashboard by ID (with project and charts data).
 */
router.post('/add', async (req: Request, res: Response, next: any) => {
    next();
}, validateJWT, validate([body('project_id').notEmpty().toInt(), body('data').notEmpty()]), authorize(Permission.DASHBOARD_CREATE), requireProjectPermission(EAction.CREATE, 'project_id'),
async (req: Request, res: Response) => {
    const { project_id, data } = matchedData(req);
    const result = await DashboardProcessor.getInstance().addDashboard(project_id, data, req.body.tokenDetails);
    if (result) {
        res.status(200).send({message: 'The dashboard has been added.'});
    } else {
        res.status(400).send({message: 'The dashboard could not be added.'});
    }
});
router.post('/update/:dashboard_id', async (req: Request, res: Response, next: any) => {
    next();
}, validateJWT, organizationContext, workspaceContext, validate([param('dashboard_id').notEmpty().toInt(), body('project_id').notEmpty().toInt(), body('data').notEmpty()]), authorize(Permission.DASHBOARD_EDIT), requireDashboardPermission(EAction.UPDATE, 'dashboard_id'),
async (req: IWorkspaceContextRequest, res: Response) => {
    const { dashboard_id, project_id, data } = matchedData(req);
    const result = await DashboardProcessor.getInstance().updateDashboard(
        dashboard_id,
        project_id,
        data,
        req.body.tokenDetails,
        req.organizationId!,
        req.workspaceId!
    );
    if (result) {
        res.status(200).send({message: 'The dashboard has been updated.'});
    } else {
        res.status(400).send({message: 'The dashboard could not be updated.'});
    }
});
/**
 * GET /dashboard/:dashboard_id
 * Return a single dashboard by ID (with project and charts data).
 */
router.get('/:dashboard_id', async (req: Request, res: Response, next: any) => {
    next();
}, validateJWT, validate([param('dashboard_id').notEmpty().toInt()]),
async (req: Request, res: Response) => {
    const { dashboard_id } = matchedData(req);
    const dashboard = await DashboardProcessor.getInstance().getDashboardById(
        dashboard_id,
        req.body.tokenDetails
    );
    if (dashboard) {
        res.status(200).send(dashboard);
    } else {
        res.status(404).send({message: 'Dashboard not found.'});
    }
});
router.delete('/delete/:dashboard_id', async (req: Request, res: Response, next: any) => {
    next();
}, validateJWT, organizationContext, workspaceContext, validate([param('dashboard_id').notEmpty().toInt()]), authorize(Permission.DASHBOARD_DELETE), requireDashboardPermission(EAction.DELETE, 'dashboard_id'),
async (req: IWorkspaceContextRequest, res: Response) => {
    const { dashboard_id } = matchedData(req);
    const result = await DashboardProcessor.getInstance().deleteDashboard(
        dashboard_id,
        req.body.tokenDetails,
        req.organizationId!,
        req.workspaceId!
    );            
    if (result) {
        res.status(200).send({message: 'The dashboard has been deleted.'});        
    } else {
        res.status(400).send({message: 'The dashboard could not be deleted.'});
    }
});
router.get('/generate-public-export-link/:dashboard_id', async (req: Request, res: Response, next: any) => {
    next();
}, validateJWT, validate([param('dashboard_id').notEmpty().trim().escape().toInt()]), authorize(Permission.DASHBOARD_SHARE), requireDashboardPermission(EAction.READ, 'dashboard_id'),
async (req: Request, res: Response) => {
    const { dashboard_id } = matchedData(req);
    const key = await DashboardProcessor.getInstance().generatePublicExportLink(dashboard_id,  req.body.tokenDetails);            
    if (key) {
        res.status(200).send({message: 'The public export link has been generated.', key: key});        
    } else {
        res.status(400).send({message: 'The public export link could not be generated.'});
    }
});
router.get('/public-dashboard-link/:dashboard_key', async (req: Request, res: Response, next: any) => {
    next();
}, validateJWT, validate([param('dashboard_key').notEmpty()]),
async (req: Request, res: Response) => {
    const { dashboard_key } = matchedData(req);
    const dashboard = await DashboardProcessor.getInstance().getPublicDashboard(encodeURIComponent(dashboard_key));
    if (dashboard) {
        const brandingService = BrandingService.getInstance();
        const projectId = (dashboard as any)?.dashboard?.project?.id;
        const branding = projectId
            ? await brandingService.getBrandingForProject(projectId)
            : null;
        res.status(200).send({ ...dashboard, branding });
    } else {
        res.status(400).send({message: 'The public dashboard link could not be retrieved.'});
    }
});

/**
 * Fetch widget data by executing the stored ai_sql with date bindings.
 * GET /dashboard/widgets/data?dashboardId=&chartId=&startDate=&endDate=
 * 
 * Public endpoint - requires token with "non-auth" authorization type
 * Frontend must first call /generate-token, then use that token with Authorization-Type: non-auth
 */
router.get(
    '/widgets/data',
    validateJWT,
    validate([
        query('dashboardId').notEmpty().toInt(),
        query('chartId').notEmpty().toInt(),
        query('startDate').optional().isISO8601().withMessage('startDate must be a valid date (YYYY-MM-DD)'),
        query('endDate').optional().isISO8601().withMessage('endDate must be a valid date (YYYY-MM-DD)'),
    ]),
    async (req: Request, res: Response) => {
        try {
            const dashboardId = parseInt(String(req.query.dashboardId));
            const chartId = parseInt(String(req.query.chartId));
            const startDate = req.query.startDate ? String(req.query.startDate) : undefined;
            const endDate = req.query.endDate ? String(req.query.endDate) : undefined;

            const { rows, dateRange } = await DashboardProcessor.getInstance().getWidgetData(
                dashboardId,
                chartId,
                startDate,
                endDate
            );
            res.status(200).json({ success: true, data: rows, dateRange });
        } catch (error: any) {
            res.status(500).json({ success: false, error: error.message });
        }
    }
);

/**
 * Regenerate the SQL for an AI Insights widget using a new/refined insight text.
 * PATCH /dashboard/widgets/regenerate
 *
 * Body: dashboardId, chartId, projectId, insightText
 * Only the widget owner (created_by) may call this.
 */
router.patch(
    '/widgets/regenerate',
    validateJWT,
    aiOperationsLimiter,
    validate([
        body('dashboardId').notEmpty().isInt(),
        body('chartId').notEmpty().isInt(),
        body('projectId').notEmpty().isInt(),
        body('insightText').notEmpty().isString(),
    ]),
    async (req: Request, res: Response) => {
        const wallet = CreditWalletService.getInstance();
        let orgId: number | null = null;
        let refId = '';
        let metered = false;
        try {
            const { dashboardId, chartId, projectId, insightText } = req.body;
            const tokenDetails = req.body.tokenDetails;
            const userId: number = tokenDetails?.user_id;

            const dashProcessor = DashboardProcessor.getInstance();

            // Verify ownership
            const chart = await dashProcessor.getAIChart(parseInt(dashboardId), parseInt(chartId));
            if (!chart) {
                res.status(404).json({ success: false, error: 'Widget not found' });
                return;
            }
            if (chart.source_type !== 'ai_insights') {
                res.status(400).json({ success: false, error: 'Widget is not an AI Insights widget' });
                return;
            }
            if (chart.created_by !== undefined && chart.created_by !== userId) {
                res.status(403).json({ success: false, error: 'You do not have permission to regenerate this widget' });
                return;
            }

            // Rebuild schema context
            const schemaContext = await InsightsProcessor.getInstance().getOrRebuildSchemaContext(
                parseInt(projectId),
                userId,
                tokenDetails
            );
            if (!schemaContext) {
                res.status(400).json({ success: false, error: 'No schema context available. Please reinitialise your insights session.' });
                return;
            }

            // Generate new spec (dashboard_widget_spec is a metered per_action).
            orgId = await resolveProjectOrganizationId(parseInt(projectId));
            if (CreditWalletService.isEnabled() && orgId !== null) {
                refId = `widget-spec:${dashboardId}:${Date.now()}`;
                await wallet.ensureReserved(orgId, 'dashboard_widget_spec', refId);
                metered = true;
            }
            const spec = await new GeminiService().generateWidgetSpec(
                String(insightText),
                schemaContext,
                parseInt(projectId),
                {
                    featureKey: AI_FEATURE_KEYS.DASHBOARD_WIDGET_SPEC,
                    actionId: String(dashboardId),
                    userId,
                    projectId: parseInt(projectId),
                    orgId,
                }
            );

            // Validate SQL
            const validation = await AISQLValidatorService.getInstance().validate(spec.sql, parseInt(projectId));
            if (!validation.valid) {
                if (metered && orgId !== null) {
                    try {
                        await wallet.release(orgId, 'dashboard_widget_spec', refId);
                    } catch (releaseError) {
                        console.warn('[DashboardWidgetSpec] Credit release failed (non-fatal):', (releaseError as Error)?.message);
                    }
                }
                res.status(422).json({ success: false, error: `Generated SQL is not safe: ${validation.reason}` });
                return;
            }

            // Persist updated spec
            await dashProcessor.updateAIWidgetSQL(parseInt(dashboardId), parseInt(chartId), userId, spec);

            // Settle the reserved credits — only successful regenerations are charged.
            if (metered && orgId !== null) {
                try {
                    await wallet.settle(orgId, 'dashboard_widget_spec', refId);
                } catch (settleError) {
                    console.warn('[DashboardWidgetSpec] Credit settle failed (non-fatal):', (settleError as Error)?.message);
                }
            }

            res.status(200).json({ success: true, spec });
        } catch (error: any) {
            // Release the reservation on failure — failed regenerations charge nothing.
            if (metered && orgId !== null) {
                try {
                    await wallet.release(orgId, 'dashboard_widget_spec', refId);
                } catch (releaseError) {
                    console.warn('[DashboardWidgetSpec] Credit release failed (non-fatal):', (releaseError as Error)?.message);
                }
            }
            if (error instanceof CreditInsufficientError) {
                res.status(402).json({ success: false, ...error.toJSON() });
                return;
            }
            res.status(500).json({ success: false, error: error.message });
        }
    }
);

/**
 * Auto-generate marketing dashboards for a data model.
 * POST /dashboard/auto-generate
 *
 * Analyzes the data model's columns and generates appropriate marketing dashboards
 * (Performance Overview, Channel Breakdown, Campaign Performance, Time Analysis)
 * based on detected KPI, dimension, and time columns.
 */
router.post(
    '/auto-generate',
    validateJWT,
    validate([
        body('data_model_id').notEmpty().isInt().withMessage('data_model_id is required and must be an integer'),
        body('project_id').notEmpty().isInt().withMessage('project_id is required and must be an integer'),
    ]),
    authorize(Permission.DASHBOARD_CREATE),
    requireProjectPermission(EAction.CREATE, 'project_id'),
    async (req: Request, res: Response) => {
        const wallet = CreditWalletService.getInstance();
        let orgId: number | null = null;
        let refId = '';
        let metered = false;
        try {
            const { data_model_id, project_id } = matchedData(req);
            const { user_id } = req.body.tokenDetails;

            // Credit metering (plan §5.2): reserve the dashboard_auto_generate
            // price before generating. A failed reservation (CreditInsufficientError
            // → 402) blocks the run. Settled only when at least one dashboard is
            // actually generated; released otherwise / on failure.
            const numericProjectId = parseInt(String(project_id));
            orgId = await resolveProjectOrganizationId(numericProjectId);
            if (CreditWalletService.isEnabled() && orgId !== null) {
                refId = `dashboard-auto:${parseInt(String(data_model_id))}:${Date.now()}`;
                await wallet.ensureReserved(orgId, 'dashboard_auto_generate', refId);
                metered = true;
            }

            const service = DashboardAutoGenerationService.getInstance();
            const results = await service.autoGenerate({
                data_model_id: parseInt(String(data_model_id)),
                users_platform_id: user_id,
                project_id: numericProjectId,
            });

            if (results.length > 0 && metered && orgId !== null) {
                try {
                    await wallet.settle(orgId, 'dashboard_auto_generate', refId);
                } catch (settleError) {
                    console.warn('[DashboardAutoGenerate] Credit settle failed (non-fatal):', (settleError as Error)?.message);
                }
            } else if (metered && orgId !== null) {
                try {
                    await wallet.release(orgId, 'dashboard_auto_generate', refId);
                } catch (releaseError) {
                    console.warn('[DashboardAutoGenerate] Credit release failed (non-fatal):', (releaseError as Error)?.message);
                }
            }

            res.status(200).json({
                success: true,
                message: results.length > 0
                    ? `Generated ${results.length} dashboard(s)`
                    : 'No marketing columns detected — no dashboards generated',
                dashboards: results,
            });
        } catch (error: any) {
            if (metered && orgId !== null) {
                try {
                    await wallet.release(orgId, 'dashboard_auto_generate', refId);
                } catch (releaseError) {
                    console.warn('[DashboardAutoGenerate] Credit release failed (non-fatal):', (releaseError as Error)?.message);
                }
            }
            console.error('[DashboardAutoGenerate] Error:', error.message);
            if (error instanceof CreditInsufficientError) {
                res.status(402).json({ success: false, ...error.toJSON() });
                return;
            }
            res.status(500).json({
                success: false,
                error: error.message || 'Failed to auto-generate dashboards',
            });
        }
    }
);

export default router;