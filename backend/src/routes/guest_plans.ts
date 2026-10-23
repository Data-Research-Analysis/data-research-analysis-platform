/**
 * Guest Plan Routes
 *
 * Unauthenticated lead-in endpoints for the paid media plan builder. A guest
 * creates a plan with their website plus basic-mode fields, receives a
 * high-entropy token (Redis, 24h TTL), and drives the build with that token.
 * Registering claims the plan into their account.
 */

import { Router } from 'express';
import { validateJWT } from '../middleware/authenticate.js';
import { validate } from '../middleware/validator.js';
import { body, param } from 'express-validator';
import { GuestPlanProcessor } from '../processors/GuestPlanProcessor.js';
import { aiOperationsLimiter, generalApiLimiter } from '../middleware/rateLimit.js';

const router = Router();
const processor = new GuestPlanProcessor();

router.post(
    '/',
    aiOperationsLimiter,
    validate([
        body('website').isString().trim().notEmpty().withMessage('website is required'),
        body('name').optional().isString().trim().withMessage('name must be a string'),
        body('platforms').optional().isArray().withMessage('platforms must be an array'),
        body('markets').optional().isArray().withMessage('markets must be an array'),
        body('budgetTotal').optional({ nullable: true }).isNumeric().withMessage('budgetTotal must be numeric'),
        body('currency').optional().isString().isLength({ max: 3 }).withMessage('currency must be 3 characters'),
    ]),
    async (req: any, res: any) => {
        await processor.createGuestPlan(req, res);
    }
);

router.get(
    '/:guestToken',
    generalApiLimiter,
    validate([param('guestToken').isString().trim().notEmpty().withMessage('guestToken is required')]),
    async (req: any, res: any) => {
        await processor.getGuestPlan(req, res);
    }
);

router.post(
    '/:guestToken/start',
    aiOperationsLimiter,
    validate([param('guestToken').isString().trim().notEmpty().withMessage('guestToken is required')]),
    async (req: any, res: any) => {
        await processor.startGuestPlan(req, res);
    }
);

router.post(
    '/:guestToken/steps/:stepKey/run',
    aiOperationsLimiter,
    validate([
        param('guestToken').isString().trim().notEmpty().withMessage('guestToken is required'),
        param('stepKey').isString().trim().notEmpty().withMessage('stepKey is required'),
    ]),
    async (req: any, res: any) => {
        await processor.runGuestStep(req, res);
    }
);

router.post(
    '/:guestToken/messages',
    aiOperationsLimiter,
    validate([param('guestToken').isString().trim().notEmpty().withMessage('guestToken is required')]),
    async (req: any, res: any) => {
        await processor.postMessage(req, res);
    }
);

router.get(
    '/:guestToken/events',
    generalApiLimiter,
    validate([param('guestToken').isString().trim().notEmpty().withMessage('guestToken is required')]),
    async (req: any, res: any) => {
        await processor.listGuestEvents(req, res);
    }
);

router.get(
    '/:guestToken/artifacts',
    generalApiLimiter,
    validate([param('guestToken').isString().trim().notEmpty().withMessage('guestToken is required')]),
    async (req: any, res: any) => {
        await processor.listGuestArtifacts(req, res);
    }
);

router.get(
    '/:guestToken/messages',
    generalApiLimiter,
    validate([param('guestToken').isString().trim().notEmpty().withMessage('guestToken is required')]),
    async (req: any, res: any) => {
        await processor.listGuestMessages(req, res);
    }
);

router.post(
    '/:guestToken/claim',
    validateJWT,
    validate([param('guestToken').isString().trim().notEmpty().withMessage('guestToken is required')]),
    async (req: any, res: any) => {
        await processor.claimGuestPlan(req, res);
    }
);

export default router;
