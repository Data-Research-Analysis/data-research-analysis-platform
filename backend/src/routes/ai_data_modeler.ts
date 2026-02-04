import express, { Request, Response } from 'express';
import { validateJWT } from '../middleware/authenticate.js';
import { validate } from '../middleware/validator.js';
import { body, param } from 'express-validator';
import { AIDataModelerController } from '../controllers/AIDataModelerController.js';
import { aiOperationsLimiter } from '../middleware/rateLimit.js';
import { enforceAIGenerationLimit } from '../middleware/tierEnforcement.js';

const router = express.Router();

// ===== REDIS-BASED SESSION ENDPOINTS =====

/**
 * Initialize or restore AI session from Redis
 * POST /api/ai-data-modeler/session/initialize
 */
router.post(
    '/session/initialize',
    validateJWT,
    aiOperationsLimiter,
    validate([
        body('dataSourceId').notEmpty().isInt().withMessage('dataSourceId must be a valid integer')
    ]),
    async (req: Request, res: Response) => {
        await AIDataModelerController.initializeSession(req, res);
    }
);

/**
 * Initialize cross-source AI session
 * POST /api/ai-data-modeler/session/initialize-cross-source
 */
router.post(
    '/session/initialize-cross-source',
    validateJWT,
    aiOperationsLimiter,
    validate([
        body('projectId').notEmpty().isInt().withMessage('projectId must be a valid integer'),
        body('dataSources').isArray({min: 1}).withMessage('dataSources must be a non-empty array')
    ]),
    async (req: Request, res: Response) => {
        await AIDataModelerController.initializeCrossSourceSession(req, res);
    }
);

/**
 * Send a message and save to Redis
 * POST /api/ai-data-modeler/session/chat
 */
router.post(
    '/session/chat',
    validateJWT,
    aiOperationsLimiter,
    enforceAIGenerationLimit,
    validate([
        body('dataSourceId').optional().isInt().withMessage('dataSourceId must be a valid integer'),
        body('conversationId').optional().isUUID().withMessage('conversationId must be a valid UUID'),
        body('isCrossSource').optional().isBoolean().withMessage('isCrossSource must be a boolean'),
        body('message').notEmpty().trim().withMessage('message is required')
    ]),
    async (req: Request, res: Response) => {
        await AIDataModelerController.sendMessageWithRedis(req, res);
    }
);

/**
 * Update model draft in Redis
 * POST /api/ai-data-modeler/session/model-draft
 */
router.post(
    '/session/model-draft',
    validateJWT,
    validate([
        body('dataSourceId').notEmpty().isInt().withMessage('dataSourceId must be a valid integer'),
        body('modelState').notEmpty().isObject().withMessage('modelState must be an object')
    ]),
    async (req: Request, res: Response) => {
        await AIDataModelerController.updateModelDraft(req, res);
    }
);

/**
 * Get current session state from Redis
 * GET /api/ai-data-modeler/session/:dataSourceId
 */
router.get(
    '/session/:dataSourceId',
    validateJWT,
    validate([
        param('dataSourceId').notEmpty().isInt().withMessage('dataSourceId must be a valid integer')
    ]),
    async (req: Request, res: Response) => {
        await AIDataModelerController.getSession(req, res);
    }
);

/**
 * Save conversation to database and clear Redis
 * POST /api/ai-data-modeler/session/save
 */
router.post(
    '/session/save',
    validateJWT,
    validate([
        body('dataSourceId').notEmpty().isInt().withMessage('dataSourceId must be a valid integer'),
        body('title').notEmpty().trim().withMessage('title is required')
    ]),
    async (req: Request, res: Response) => {
        await AIDataModelerController.saveConversation(req, res);
    }
);

/**
 * Cancel session and clear Redis
 * DELETE /api/ai-data-modeler/session/:dataSourceId
 */
router.delete(
    '/session/:dataSourceId',
    validateJWT,
    validate([
        param('dataSourceId').notEmpty().isInt().withMessage('dataSourceId must be a valid integer')
    ]),
    async (req: Request, res: Response) => {
        await AIDataModelerController.cancelSession(req, res);
    }
);

/**
 * Get saved conversation from database
 * GET /api/ai-data-modeler/conversations/:dataModelId
 */
router.get(
    '/conversations/:dataModelId',
    validateJWT,
    validate([
        param('dataModelId').notEmpty().isInt().withMessage('dataModelId must be a valid integer')
    ]),
    async (req: Request, res: Response) => {
        await AIDataModelerController.getSavedConversation(req, res);
    }
);

// ===== LEGACY ENDPOINTS (backward compatibility) =====

/**
 * Initialize a new AI conversation with schema context (Legacy)
 * POST /api/ai-data-modeler/initialize
 */
router.post(
    '/initialize',
    validateJWT,
    validate([
        body('dataSourceId').notEmpty().isInt().withMessage('dataSourceId must be a valid integer')
    ]),
    async (req: Request, res: Response) => {
        await AIDataModelerController.initializeConversation(req, res);
    }
);

/**
 * Send a message in an existing conversation (Legacy)
 * POST /api/ai-data-modeler/chat
 */
router.post(
    '/chat',
    validateJWT,
    validate([
        body('conversationId').notEmpty().isUUID().withMessage('conversationId must be a valid UUID'),
        body('message').notEmpty().trim().withMessage('message is required')
    ]),
    async (req: Request, res: Response) => {
        await AIDataModelerController.sendMessage(req, res);
    }
);

/**
 * Close an active conversation (Legacy)
 * DELETE /api/ai-data-modeler/conversation/:conversationId
 */
router.delete(
    '/conversation/:conversationId',
    validateJWT,
    validate([
        param('conversationId').notEmpty().isUUID().withMessage('conversationId must be a valid UUID')
    ]),
    async (req: Request, res: Response) => {
        await AIDataModelerController.closeConversation(req, res);
    }
);

/**
 * Get suggested JOIN relationships for a data source (Issue #270)
 * GET /api/ai-data-modeler/suggested-joins/:dataSourceId
 */
router.get(
    '/suggested-joins/:dataSourceId',
    validateJWT,
    validate([
        param('dataSourceId').notEmpty().isInt().withMessage('dataSourceId must be a valid integer')
    ]),
    async (req: Request, res: Response) => {
        await AIDataModelerController.getSuggestedJoins(req, res);
    }
);

export default router;
