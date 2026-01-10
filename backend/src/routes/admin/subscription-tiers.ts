import express, { Request, Response } from 'express';
import { validateJWT } from '../../middleware/authenticate.js';
import { validate } from '../../middleware/validator.js';
import { body, matchedData, param } from 'express-validator';
import { SubscriptionTierProcessor } from '../../processors/SubscriptionTierProcessor.js';
import { ESubscriptionTier } from '../../models/DRASubscriptionTier.js';

const router = express.Router();

// List all subscription tiers
router.get('/', async (req: Request, res: Response, next: any) => {
    next();
}, validateJWT, async (req: Request, res: Response) => {
    try {
        const includeInactive = req.query.includeInactive === 'true';
        const tiers = await SubscriptionTierProcessor.getInstance().getAllTiers(includeInactive);
        res.status(200).json({
            success: true,
            data: tiers
        });
    } catch (error) {
        console.error('Error fetching subscription tiers:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to fetch subscription tiers'
        });
    }
});

// Get subscription tier by ID
router.get('/:id', async (req: Request, res: Response, next: any) => {
    next();
}, validateJWT, validate([
    param('id').notEmpty().isInt().withMessage('Valid tier ID is required')
]), async (req: Request, res: Response) => {
    try {
        const { id } = matchedData(req);
        const tier = await SubscriptionTierProcessor.getInstance().getTierById(parseInt(id));
        
        if (!tier) {
            return res.status(404).json({
                success: false,
                message: 'Subscription tier not found'
            });
        }
        
        res.status(200).json({
            success: true,
            data: tier
        });
    } catch (error) {
        console.error('Error fetching subscription tier:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to fetch subscription tier'
        });
    }
});

// Create new subscription tier
router.post('/', async (req: Request, res: Response, next: any) => {
    next();
}, validateJWT, validate([
    body('tier_name')
        .notEmpty()
        .isIn(Object.values(ESubscriptionTier))
        .withMessage('Valid tier name is required (free, pro, team, business, enterprise)'),
    body('max_rows_per_data_model')
        .notEmpty()
        .isInt()
        .custom((value) => value === -1 || value > 0)
        .withMessage('max_rows_per_data_model must be positive or -1 for unlimited'),
    body('max_projects')
        .optional({ nullable: true })
        .isInt({ gt: 0 })
        .withMessage('max_projects must be positive or null'),
    body('max_data_sources_per_project')
        .optional({ nullable: true })
        .isInt({ gt: 0 })
        .withMessage('max_data_sources_per_project must be positive or null'),
    body('max_dashboards')
        .optional({ nullable: true })
        .isInt({ gt: 0 })
        .withMessage('max_dashboards must be positive or null'),
    body('ai_generations_per_month')
        .optional({ nullable: true })
        .isInt({ gt: 0 })
        .withMessage('ai_generations_per_month must be positive or null'),
    body('price_per_month_usd')
        .notEmpty()
        .isFloat({ min: 0 })
        .withMessage('price_per_month_usd must be non-negative'),
    body('is_active')
        .optional()
        .isBoolean()
        .withMessage('is_active must be a boolean')
]), async (req: Request, res: Response) => {
    try {
        const tierData = matchedData(req);
        const tier = await SubscriptionTierProcessor.getInstance().createTier(tierData);
        
        res.status(201).json({
            success: true,
            message: 'Subscription tier created successfully',
            data: tier
        });
    } catch (error: any) {
        console.error('Error creating subscription tier:', error);
        res.status(400).json({
            success: false,
            message: error.message || 'Failed to create subscription tier'
        });
    }
});

// Update subscription tier
router.put('/:id', async (req: Request, res: Response, next: any) => {
    next();
}, validateJWT, validate([
    param('id').notEmpty().isInt().withMessage('Valid tier ID is required'),
    body('tier_name')
        .optional()
        .isIn(Object.values(ESubscriptionTier))
        .withMessage('Valid tier name is required (free, pro, team, business, enterprise)'),
    body('max_rows_per_data_model')
        .optional()
        .isInt()
        .custom((value) => value === -1 || value > 0)
        .withMessage('max_rows_per_data_model must be positive or -1 for unlimited'),
    body('max_projects')
        .optional({ nullable: true })
        .isInt({ gt: 0 })
        .withMessage('max_projects must be positive or null'),
    body('max_data_sources_per_project')
        .optional({ nullable: true })
        .isInt({ gt: 0 })
        .withMessage('max_data_sources_per_project must be positive or null'),
    body('max_dashboards')
        .optional({ nullable: true })
        .isInt({ gt: 0 })
        .withMessage('max_dashboards must be positive or null'),
    body('ai_generations_per_month')
        .optional({ nullable: true })
        .isInt({ gt: 0 })
        .withMessage('ai_generations_per_month must be positive or null'),
    body('price_per_month_usd')
        .optional()
        .isFloat({ min: 0 })
        .withMessage('price_per_month_usd must be non-negative'),
    body('is_active')
        .optional()
        .isBoolean()
        .withMessage('is_active must be a boolean')
]), async (req: Request, res: Response) => {
    try {
        const { id } = matchedData(req);
        const tierData = matchedData(req);
        delete tierData.id; // Remove id from update data
        
        const tier = await SubscriptionTierProcessor.getInstance().updateTier(parseInt(id), tierData);
        
        res.status(200).json({
            success: true,
            message: 'Subscription tier updated successfully',
            data: tier
        });
    } catch (error: any) {
        console.error('Error updating subscription tier:', error);
        res.status(400).json({
            success: false,
            message: error.message || 'Failed to update subscription tier'
        });
    }
});

// Delete (deactivate) subscription tier
router.delete('/:id', async (req: Request, res: Response, next: any) => {
    next();
}, validateJWT, validate([
    param('id').notEmpty().isInt().withMessage('Valid tier ID is required')
]), async (req: Request, res: Response) => {
    try {
        const { id } = matchedData(req);
        await SubscriptionTierProcessor.getInstance().deleteTier(parseInt(id));
        
        res.status(200).json({
            success: true,
            message: 'Subscription tier deactivated successfully'
        });
    } catch (error: any) {
        console.error('Error deleting subscription tier:', error);
        res.status(400).json({
            success: false,
            message: error.message || 'Failed to delete subscription tier'
        });
    }
});

export default router;
