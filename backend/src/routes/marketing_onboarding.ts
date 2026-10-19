import { Router } from 'express';
import { validateJWT } from '../middleware/authenticate.js';
import { requiresProjectRole } from '../middleware/requiresProjectRole.js';
import { optionalOrganizationContext } from '../middleware/organizationContext.js';
import { optionalWorkspaceContext } from '../middleware/workspaceContext.js';
import { validate } from '../middleware/validator.js';
import { param } from 'express-validator';
import { MarketingOnboardingService } from '../services/MarketingOnboardingService.js';

const router = Router();

router.post(
    '/:projectid/marketing-onboarding',
    validateJWT,
    optionalOrganizationContext,
    optionalWorkspaceContext,
    requiresProjectRole(['analyst', 'manager', 'cmo']),
    validate([param('projectid').isInt().withMessage('projectId must be an integer')]),
    async (req: any, res: any) => {
        try {
            const projectId = parseInt(String(req.params.projectid), 10);
            const userId = req.tokenDetails?.user_id ?? req.user?.id ?? 0;
            const result = await MarketingOnboardingService.getInstance().onboard(
                projectId,
                userId,
                req.organizationId,
                (req as any).workspaceId
            );
            res.status(200).json({ success: true, data: result });
        } catch (error: any) {
            console.error('[MarketingOnboarding] error:', error);
            res.status(400).json({ success: false, error: error.message ?? 'Onboarding failed' });
        }
    }
);

export default router;
