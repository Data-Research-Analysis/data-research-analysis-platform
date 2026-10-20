/**
 * Paid Media Plans Routes
 *
 * REST endpoints for the Paid Media Loop: plans, steps, chat messages,
 * build-process events, generated artifacts, export, publish and results.
 *
 * RBAC: read = analyst|manager|cmo; run/edit = analyst|manager;
 * publish/delete = manager.
 */

import { Router, Request, Response, NextFunction } from 'express';
import { validateJWT } from '../middleware/authenticate.js';
import { requiresProjectRole } from '../middleware/requiresProjectRole.js';
import { enforcePlanBuildLimit } from '../middleware/tierEnforcement.js';
import { optionalOrganizationContext } from '../middleware/organizationContext.js';
import { optionalWorkspaceContext } from '../middleware/workspaceContext.js';
import { validate } from '../middleware/validator.js';
import { body, param, query } from 'express-validator';
import { PaidMediaPlanProcessor } from '../processors/PaidMediaPlanProcessor.js';
import { PaidMediaPlanService } from '../services/PaidMediaPlanService.js';

const router = Router();
const processor = new PaidMediaPlanProcessor();

router.use(validateJWT);
router.use(optionalOrganizationContext);
router.use(optionalWorkspaceContext);

async function resolvePlanProject(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
        const planId = parseInt(String(req.params.planId), 10);
        if (!planId) {
            res.status(400).json({ success: false, error: 'planId is required' });
            return;
        }
        const plan = await PaidMediaPlanService.getInstance().get(planId);
        (req as any).params.projectId = String(plan.projectId);
        (req as any).planId = planId;
        next();
    } catch (error: any) {
        res.status(404).json({ success: false, error: error.message ?? 'Plan not found' });
    }
}

// ===== Plan CRUD =====

router.post(
    '/',
    requiresProjectRole(['analyst', 'manager']),
    enforcePlanBuildLimit,
    validate([
        body('projectId').isInt().withMessage('projectId must be a valid integer'),
        body('name').optional().isString().trim().withMessage('name must be a string'),
        body('mode').optional().isIn(['basic', 'advanced']).withMessage('mode must be basic or advanced'),
        body('funnelCoverage').optional().isIn(['bofu', 'bofu_mofu', 'full_funnel']).withMessage('invalid funnelCoverage'),
        body('buildMode').optional().isIn(['test_only', 'build_to_scale']).withMessage('invalid buildMode'),
        body('platforms').optional().isArray().withMessage('platforms must be an array'),
        body('markets').optional().isArray().withMessage('markets must be an array'),
        body('budgetTotal').optional({ nullable: true }).isNumeric().withMessage('budgetTotal must be numeric'),
        body('currency').optional().isString().isLength({ max: 3 }).withMessage('currency must be 3 characters'),
    ]),
    async (req: any, res: any) => {
        await processor.createPlan(req, res);
    }
);

router.get(
    '/',
    requiresProjectRole(['analyst', 'manager', 'cmo']),
    validate([query('projectId').isInt().withMessage('projectId is required')]),
    async (req: any, res: any) => {
        await processor.listPlans(req, res);
    }
);

router.get(
    '/:planId',
    resolvePlanProject,
    requiresProjectRole(['analyst', 'manager', 'cmo']),
    validate([param('planId').isInt().withMessage('planId must be an integer')]),
    async (req: any, res: any) => {
        await processor.getPlan(req, res);
    }
);

router.patch(
    '/:planId',
    resolvePlanProject,
    requiresProjectRole(['analyst', 'manager']),
    validate([param('planId').isInt().withMessage('planId must be an integer')]),
    async (req: any, res: any) => {
        await processor.updatePlan(req, res);
    }
);

router.delete(
    '/:planId',
    resolvePlanProject,
    requiresProjectRole(['manager']),
    validate([param('planId').isInt().withMessage('planId must be an integer')]),
    async (req: any, res: any) => {
        await processor.deletePlan(req, res);
    }
);

// ===== Steps =====

router.get(
    '/:planId/steps',
    resolvePlanProject,
    requiresProjectRole(['analyst', 'manager', 'cmo']),
    validate([param('planId').isInt().withMessage('planId must be an integer')]),
    async (req: any, res: any) => {
        await processor.listSteps(req, res);
    }
);

router.post(
    '/:planId/steps/:stepKey/run',
    resolvePlanProject,
    requiresProjectRole(['analyst', 'manager']),
    validate([
        param('planId').isInt().withMessage('planId must be an integer'),
        param('stepKey').isString().trim().notEmpty().withMessage('stepKey is required'),
        body('trigger').optional().isIn(['user', 'auto']).withMessage('trigger must be user or auto'),
    ]),
    async (req: any, res: any) => {
        await processor.runStep(req, res);
    }
);

router.post(
    '/:planId/steps/:stepKey/retry',
    resolvePlanProject,
    requiresProjectRole(['analyst', 'manager']),
    validate([
        param('planId').isInt().withMessage('planId must be an integer'),
        param('stepKey').isString().trim().notEmpty().withMessage('stepKey is required'),
    ]),
    async (req: any, res: any) => {
        await processor.retryStep(req, res);
    }
);

router.post(
    '/:planId/steps/:stepKey/skip',
    resolvePlanProject,
    requiresProjectRole(['analyst', 'manager']),
    validate([
        param('planId').isInt().withMessage('planId must be an integer'),
        param('stepKey').isString().trim().notEmpty().withMessage('stepKey is required'),
    ]),
    async (req: any, res: any) => {
        await processor.skipStep(req, res);
    }
);

router.post(
    '/:planId/start',
    resolvePlanProject,
    requiresProjectRole(['analyst', 'manager']),
    validate([
        param('planId').isInt().withMessage('planId must be an integer'),
        body('fromStep').optional().isString().withMessage('fromStep must be a step key'),
    ]),
    async (req: any, res: any) => {
        await processor.startPlan(req, res);
    }
);

router.post(
    '/:planId/brief',
    resolvePlanProject,
    requiresProjectRole(['analyst', 'manager']),
    validate([param('planId').isInt().withMessage('planId must be an integer')]),
    async (req: any, res: any) => {
        await processor.updateBrief(req, res);
    }
);

router.post(
    '/:planId/pause',
    resolvePlanProject,
    requiresProjectRole(['analyst', 'manager']),
    validate([param('planId').isInt().withMessage('planId must be an integer')]),
    async (req: any, res: any) => {
        await processor.pausePlan(req, res);
    }
);

router.post(
    '/:planId/resume',
    resolvePlanProject,
    requiresProjectRole(['analyst', 'manager']),
    validate([param('planId').isInt().withMessage('planId must be an integer')]),
    async (req: any, res: any) => {
        await processor.resumePlan(req, res);
    }
);

// ===== Chat =====

router.get(
    '/:planId/messages',
    resolvePlanProject,
    requiresProjectRole(['analyst', 'manager', 'cmo']),
    validate([param('planId').isInt().withMessage('planId must be an integer')]),
    async (req: any, res: any) => {
        await processor.listMessages(req, res);
    }
);

router.post(
    '/:planId/messages',
    resolvePlanProject,
    requiresProjectRole(['analyst', 'manager', 'cmo']),
    validate([
        param('planId').isInt().withMessage('planId must be an integer'),
        body().custom((value) => {
            const hasGate = typeof value?.gateId === 'string' && typeof value?.answer === 'string';
            const hasContent = typeof value?.content === 'string' && value.content.trim().length > 0;
            if (!hasGate && !hasContent) {
                throw new Error('Provide {gateId, answer} or {content}');
            }
            return true;
        }),
    ]),
    async (req: any, res: any) => {
        await processor.postMessage(req, res);
    }
);

// ===== Build process log =====

router.get(
    '/:planId/events',
    resolvePlanProject,
    requiresProjectRole(['analyst', 'manager', 'cmo']),
    validate([param('planId').isInt().withMessage('planId must be an integer')]),
    async (req: any, res: any) => {
        await processor.listEvents(req, res);
    }
);

router.get(
    '/:planId/analytics',
    resolvePlanProject,
    requiresProjectRole(['analyst', 'manager', 'cmo']),
    validate([param('planId').isInt().withMessage('planId must be an integer')]),
    async (req: any, res: any) => {
        await processor.getAnalytics(req, res);
    }
);

// ===== Artifacts =====

router.get(
    '/:planId/artifacts',
    resolvePlanProject,
    requiresProjectRole(['analyst', 'manager', 'cmo']),
    validate([param('planId').isInt().withMessage('planId must be an integer')]),
    async (req: any, res: any) => {
        await processor.listArtifacts(req, res);
    }
);

router.get(
    '/:planId/artifacts/:artifactId',
    resolvePlanProject,
    requiresProjectRole(['analyst', 'manager', 'cmo']),
    validate([param('artifactId').isInt().withMessage('artifactId must be an integer')]),
    async (req: any, res: any) => {
        await processor.getArtifact(req, res);
    }
);

router.get(
    '/:planId/artifacts/:artifactId/download',
    resolvePlanProject,
    requiresProjectRole(['analyst', 'manager', 'cmo']),
    validate([param('artifactId').isInt().withMessage('artifactId must be an integer')]),
    async (req: any, res: any) => {
        await processor.downloadArtifact(req, res);
    }
);

router.patch(
    '/:planId/artifacts/:artifactId',
    resolvePlanProject,
    requiresProjectRole(['analyst', 'manager']),
    validate([
        param('artifactId').isInt().withMessage('artifactId must be an integer'),
        body('content').isString().notEmpty().withMessage('content is required'),
    ]),
    async (req: any, res: any) => {
        await processor.editArtifact(req, res);
    }
);

router.post(
    '/:planId/artifacts/:artifactId/regenerate',
    resolvePlanProject,
    requiresProjectRole(['analyst', 'manager']),
    validate([param('artifactId').isInt().withMessage('artifactId must be an integer')]),
    async (req: any, res: any) => {
        await processor.regenerateArtifact(req, res);
    }
);

// ===== Export, publish, results =====

router.get(
    '/:planId/export',
    resolvePlanProject,
    requiresProjectRole(['analyst', 'manager', 'cmo']),
    validate([param('planId').isInt().withMessage('planId must be an integer')]),
    async (req: any, res: any) => {
        await processor.exportPlan(req, res);
    }
);

router.post(
    '/:planId/publish',
    resolvePlanProject,
    requiresProjectRole(['manager']),
    validate([param('planId').isInt().withMessage('planId must be an integer')]),
    async (req: any, res: any) => {
        await processor.publishPlan(req, res);
    }
);

router.post(
    '/:planId/results/sync',
    resolvePlanProject,
    requiresProjectRole(['manager']),
    validate([param('planId').isInt().withMessage('planId must be an integer')]),
    async (req: any, res: any) => {
        await processor.syncResults(req, res);
    }
);

export default router;
