import { Router } from 'express';
import { validateJWT } from '../middleware/authenticate.js';
import { optionalOrganizationContext } from '../middleware/organizationContext.js';
import { optionalWorkspaceContext } from '../middleware/workspaceContext.js';
import { generalApiLimiter } from '../middleware/rateLimit.js';
import { validate } from '../middleware/validator.js';
import { body } from 'express-validator';
import { ProductEventProcessor } from '../processors/ProductEventProcessor.js';

const router = Router();

router.post(
    '/',
    validateJWT,
    optionalOrganizationContext,
    optionalWorkspaceContext,
    generalApiLimiter,
    validate([
        body('events').isArray().withMessage('events must be an array'),
        body('events.*.name').isString().trim().notEmpty().withMessage('each event needs a name'),
        body('events.*.projectId').optional().isInt().withMessage('projectId must be an integer'),
        body('events.*.planId').optional().isInt().withMessage('planId must be an integer'),
    ]),
    async (req: any, res: any) => {
        await new ProductEventProcessor().ingest(req, res);
    }
);

export default router;
