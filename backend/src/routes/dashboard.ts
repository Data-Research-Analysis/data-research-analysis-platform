import express, { Request, Response } from 'express';
import { validateJWT } from '../middleware/authenticate.js';
import { validate } from '../middleware/validator.js';
import { body, param, query, matchedData } from 'express-validator';
import { DashboardProcessor } from '../processors/DashboardProcessor.js';
import { InsightsProcessor } from '../processors/InsightsProcessor.js';
import { GeminiService } from '../services/GeminiService.js';
import { AISQLValidatorService } from '../services/AISQLValidatorService.js';
import { enforceDashboardLimit } from '../middleware/tierEnforcement.js';
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
const router = express.Router();

router.get('/list', async (req: Request, res: Response, next: any) => {
    next();
}, validateJWT, optionalOrganizationContext, async (req: IOrganizationContextRequest, res: Response) => {
    const organizationId = req.organizationId || null;
    const data_sources_list = await DashboardProcessor.getInstance().getDashboards(req.body.tokenDetails, organizationId);    
    res.status(200).send(data_sources_list);
});
router.post('/add', async (req: Request, res: Response, next: any) => {
    next();
}, validateJWT, enforceDashboardLimit, validate([body('project_id').notEmpty().toInt(), body('data').notEmpty()]), authorize(Permission.DASHBOARD_CREATE), requireProjectPermission(EAction.CREATE, 'project_id'),
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
        res.status(200).send(dashboard);
    } else {
        res.status(400).send({message: 'The public dashboard link could not be retrieved.'});
    }
});

router.get('/templates', async (req: Request, res: Response, next: any) => {
    next();
}, validateJWT, async (req: Request, res: Response) => {
    const templates = await DashboardProcessor.getInstance().getTemplates();
    res.status(200).send(templates);
});

router.post('/clone-template', async (req: Request, res: Response, next: any) => {
    next();
}, validateJWT, enforceDashboardLimit, validate([
    body('template_id').notEmpty().toInt(),
    body('project_id').notEmpty().toInt(),
]), authorize(Permission.DASHBOARD_CREATE), requireProjectPermission(EAction.CREATE, 'project_id'),
async (req: Request, res: Response) => {
    const { template_id, project_id } = matchedData(req);
    const { user_id } = req.body.tokenDetails;
    const result = await DashboardProcessor.getInstance().cloneDashboard(template_id, project_id, user_id);
    if (result) {
        res.status(200).send({ message: 'Dashboard created from template.', dashboard: result });
    } else {
        res.status(400).send({ message: 'The dashboard could not be cloned from the template.' });
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
        query('startDate').notEmpty().isISO8601().withMessage('startDate must be a valid date (YYYY-MM-DD)'),
        query('endDate').notEmpty().isISO8601().withMessage('endDate must be a valid date (YYYY-MM-DD)'),
    ]),
    async (req: Request, res: Response) => {
        try {
            const dashboardId = parseInt(String(req.query.dashboardId));
            const chartId = parseInt(String(req.query.chartId));
            const startDate = String(req.query.startDate);
            const endDate = String(req.query.endDate);

            const rows = await DashboardProcessor.getInstance().getWidgetData(
                dashboardId,
                chartId,
                startDate,
                endDate
            );
            res.status(200).json({ success: true, data: rows });
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

            // Generate new spec
            const spec = await new GeminiService().generateWidgetSpec(
                String(insightText),
                schemaContext,
                parseInt(projectId)
            );

            // Validate SQL
            const validation = await AISQLValidatorService.getInstance().validate(spec.sql, parseInt(projectId));
            if (!validation.valid) {
                res.status(422).json({ success: false, error: `Generated SQL is not safe: ${validation.reason}` });
                return;
            }

            // Persist updated spec
            await dashProcessor.updateAIWidgetSQL(parseInt(dashboardId), parseInt(chartId), userId, spec);

            res.status(200).json({ success: true, spec });
        } catch (error: any) {
            res.status(500).json({ success: false, error: error.message });
        }
    }
);

export default router;