import express, { Request, Response } from 'express';
import { validateJWT } from '../middleware/authenticate.js';
import { validate } from '../middleware/validator.js';
import { body, param } from 'express-validator';
import { InsightsController } from '../controllers/InsightsController.js';
import { aiOperationsLimiter, insightsLimiter } from '../middleware/rateLimit.js';

const router = express.Router();

// ===== SESSION ENDPOINTS =====

/**
 * Initialize an insights session
 * POST /insights/session/initialize
 */
router.post(
    '/session/initialize',
    validateJWT,
    insightsLimiter,
    validate([
        body('projectId').notEmpty().isInt().withMessage('projectId must be a valid integer'),
        body('dataSourceIds').isArray({ min: 1 }).withMessage('dataSourceIds must be a non-empty array'),
        body('dataSourceIds.*').isInt().withMessage('Each dataSourceId must be an integer')
    ]),
    async (req: Request, res: Response) => {
        await InsightsController.initializeSession(req, res);
    }
);

/**
 * Generate insights from AI
 * POST /insights/session/generate
 */
router.post(
    '/session/generate',
    validateJWT,
    insightsLimiter,
    validate([
        body('projectId').notEmpty().isInt().withMessage('projectId must be a valid integer')
    ]),
    async (req: Request, res: Response) => {
        await InsightsController.generateInsights(req, res);
    }
);

/**
 * Ask a follow-up question
 * POST /insights/session/chat
 */
router.post(
    '/session/chat',
    validateJWT,
    aiOperationsLimiter,
    validate([
        body('projectId').notEmpty().isInt().withMessage('projectId must be a valid integer'),
        body('message').notEmpty().trim().withMessage('message is required and cannot be empty')
    ]),
    async (req: Request, res: Response) => {
        await InsightsController.askFollowUp(req, res);
    }
);

/**
 * Get active session for a project
 * GET /insights/session/:projectId
 */
router.get(
    '/session/:projectId',
    validateJWT,
    validate([
        param('projectId').notEmpty().isInt().withMessage('projectId must be a valid integer')
    ]),
    async (req: Request, res: Response) => {
        await InsightsController.getActiveSession(req, res);
    }
);

/**
 * Cancel active session without saving
 * DELETE /insights/session/:projectId
 */
router.delete(
    '/session/:projectId',
    validateJWT,
    validate([
        param('projectId').notEmpty().isInt().withMessage('projectId must be a valid integer')
    ]),
    async (req: Request, res: Response) => {
        await InsightsController.cancelSession(req, res);
    }
);

// ===== REPORT ENDPOINTS =====

/**
 * Save insight report to database
 * POST /insights/reports/save
 */
router.post(
    '/reports/save',
    validateJWT,
    validate([
        body('projectId').notEmpty().isInt().withMessage('projectId must be a valid integer'),
        body('title').optional().isString().trim().withMessage('title must be a string')
    ]),
    async (req: Request, res: Response) => {
        await InsightsController.saveReport(req, res);
    }
);

/**
 * Get all insight reports for a project
 * GET /insights/reports/project/:projectId
 */
router.get(
    '/reports/project/:projectId',
    validateJWT,
    validate([
        param('projectId').notEmpty().isInt().withMessage('projectId must be a valid integer')
    ]),
    async (req: Request, res: Response) => {
        await InsightsController.getReports(req, res);
    }
);

/**
 * Get a specific insight report
 * GET /insights/reports/:reportId
 */
router.get(
    '/reports/:reportId',
    validateJWT,
    validate([
        param('reportId').notEmpty().isInt().withMessage('reportId must be a valid integer')
    ]),
    async (req: Request, res: Response) => {
        await InsightsController.getReport(req, res);
    }
);

/**
 * Delete an insight report
 * DELETE /insights/reports/:reportId
 */
router.delete(
    '/reports/:reportId',
    validateJWT,
    validate([
        param('reportId').notEmpty().isInt().withMessage('reportId must be a valid integer')
    ]),
    async (req: Request, res: Response) => {
        await InsightsController.deleteReport(req, res);
    }
);

export default router;
