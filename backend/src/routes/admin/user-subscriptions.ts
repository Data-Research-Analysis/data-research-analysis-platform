import express from 'express';
import { body, param, validationResult } from 'express-validator';
import { UserSubscriptionProcessor } from '../../processors/UserSubscriptionProcessor.js';
import { SubscriptionTierProcessor } from '../../processors/SubscriptionTierProcessor.js';
import { getRedisClient } from '../../config/redis.config.js';

const router = express.Router();
const userSubscriptionProcessor = UserSubscriptionProcessor.getInstance();
const subscriptionTierProcessor = SubscriptionTierProcessor.getInstance();
const redis = getRedisClient();

/**
 * GET /admin/users/:userId/subscription
 * Get user's current active subscription
 */
router.get(
    '/:userId/subscription',
    param('userId').isInt().withMessage('User ID must be an integer'),
    async (req, res) => {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(400).json({ 
                success: false, 
                errors: errors.array() 
            });
        }
        
        try {
            const userId = parseInt(req.params.userId);
            const subscription = await userSubscriptionProcessor.getUserSubscription(userId);
            
            if (!subscription) {
                return res.status(200).json({
                    success: true,
                    data: null,
                    message: 'No active subscription found for this user'
                });
            }
            
            return res.status(200).json({
                success: true,
                data: subscription
            });
        } catch (error: any) {
            console.error('Error fetching user subscription:', error);
            return res.status(500).json({
                success: false,
                message: error.message || 'Failed to fetch user subscription'
            });
        }
    }
);

/**
 * PUT /admin/users/:userId/subscription
 * Assign or update user's subscription tier
 */
router.put(
    '/:userId/subscription',
    [
        param('userId').isInt().withMessage('User ID must be an integer'),
        body('tier_id')
            .isInt({ min: 1 })
            .withMessage('Tier ID must be a positive integer'),
        body('ends_at')
            .optional()
            .isISO8601()
            .withMessage('ends_at must be a valid ISO 8601 date')
    ],
    async (req, res) => {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(400).json({ 
                success: false, 
                errors: errors.array() 
            });
        }
        
        try {
            const userId = parseInt(req.params.userId);
            const { tier_id, ends_at } = req.body;
            
            const endsAtDate = ends_at ? new Date(ends_at) : null;
            
            const subscription = await userSubscriptionProcessor.assignSubscription(
                userId,
                tier_id,
                endsAtDate
            );
            
            return res.status(200).json({
                success: true,
                message: 'Subscription updated successfully',
                data: subscription
            });
        } catch (error: any) {
            console.error('Error updating user subscription:', error);
            return res.status(500).json({
                success: false,
                message: error.message || 'Failed to update user subscription'
            });
        }
    }
);

/**
 * DELETE /admin/users/:userId/subscription
 * Cancel user's active subscription
 */
router.delete(
    '/:userId/subscription',
    param('userId').isInt().withMessage('User ID must be an integer'),
    async (req, res) => {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(400).json({ 
                success: false, 
                errors: errors.array() 
            });
        }
        
        try {
            const userId = parseInt(req.params.userId);
            await userSubscriptionProcessor.cancelSubscription(userId);
            
            return res.status(200).json({
                success: true,
                message: 'Subscription cancelled successfully'
            });
        } catch (error: any) {
            console.error('Error cancelling user subscription:', error);
            return res.status(500).json({
                success: false,
                message: error.message || 'Failed to cancel user subscription'
            });
        }
    }
);

/**
 * GET /admin/users/:userId/subscription/history
 * Get user's subscription history (all subscriptions including inactive)
 */
router.get(
    '/:userId/subscription/history',
    param('userId').isInt().withMessage('User ID must be an integer'),
    async (req, res) => {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(400).json({ 
                success: false, 
                errors: errors.array() 
            });
        }
        
        try {
            const userId = parseInt(req.params.userId);
            const history = await userSubscriptionProcessor.getUserSubscriptionHistory(userId);
            
            return res.status(200).json({
                success: true,
                data: history
            });
        } catch (error: any) {
            console.error('Error fetching user subscription history:', error);
            return res.status(500).json({
                success: false,
                message: error.message || 'Failed to fetch subscription history'
            });
        }
    }
);

/**
 * GET /admin/users/:userId/available-tiers
 * Get all available subscription tiers for assignment
 */
router.get(
    '/:userId/available-tiers',
    param('userId').isInt().withMessage('User ID must be an integer'),
    async (req, res) => {
        try {
            const tiers = await subscriptionTierProcessor.getAllTiers(false);
            
            return res.status(200).json({
                success: true,
                data: tiers
            });
        } catch (error: any) {
            console.error('Error fetching available tiers:', error);
            return res.status(500).json({
                success: false,
                message: error.message || 'Failed to fetch available tiers'
            });
        }
    }
);

/**
 * POST /admin/users/:userId/tier-override
 * Grant temporary tier limit override for a specific resource
 * Stores override in Redis with expiration
 */
router.post(
    '/:userId/tier-override',
    [
        param('userId').isInt().withMessage('User ID must be an integer'),
        body('resource')
            .isIn(['projects', 'data_sources', 'dashboards', 'ai_generations'])
            .withMessage('Resource must be one of: projects, data_sources, dashboards, ai_generations'),
        body('overrideCount')
            .isInt({ min: 1 })
            .withMessage('Override count must be a positive integer'),
        body('expiresInHours')
            .optional()
            .isInt({ min: 1, max: 720 })
            .withMessage('Expiration must be between 1 and 720 hours (30 days)')
    ],
    async (req, res) => {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(400).json({ 
                success: false, 
                errors: errors.array() 
            });
        }
        
        try {
            const userId = parseInt(req.params.userId);
            const { resource, overrideCount, expiresInHours = 24 } = req.body;
            const adminId = req.user?.user_id;
            
            // Create Redis key: tier-override:{userId}:{resource}
            const overrideKey = `tier-override:${userId}:${resource}`;
            const expiresInSeconds = expiresInHours * 60 * 60;
            
            // Store override data in Redis
            const overrideData = {
                userId,
                resource,
                overrideCount,
                grantedBy: adminId,
                grantedAt: new Date().toISOString(),
                expiresAt: new Date(Date.now() + expiresInSeconds * 1000).toISOString()
            };
            
            await redis.set(
                overrideKey,
                JSON.stringify(overrideData),
                'EX',
                expiresInSeconds
            );
            
            console.log(`[ADMIN OVERRIDE] Admin ${adminId} granted ${overrideCount} ${resource} override to user ${userId} for ${expiresInHours} hours`);
            
            return res.status(200).json({
                success: true,
                message: `Tier override granted successfully`,
                data: overrideData
            });
        } catch (error: any) {
            console.error('Error granting tier override:', error);
            return res.status(500).json({
                success: false,
                message: error.message || 'Failed to grant tier override'
            });
        }
    }
);

/**
 * GET /admin/users/:userId/tier-overrides
 * Get all active tier overrides for a user
 */
router.get(
    '/:userId/tier-overrides',
    param('userId').isInt().withMessage('User ID must be an integer'),
    async (req, res) => {
        try {
            const userId = parseInt(req.params.userId);
            const resources = ['projects', 'data_sources', 'dashboards', 'ai_generations'];
            const overrides: any[] = [];
            
            for (const resource of resources) {
                const overrideKey = `tier-override:${userId}:${resource}`;
                const overrideData = await redis.get(overrideKey);
                
                if (overrideData) {
                    const ttl = await redis.ttl(overrideKey);
                    const parsed = JSON.parse(overrideData);
                    overrides.push({
                        ...parsed,
                        remainingSeconds: ttl
                    });
                }
            }
            
            return res.status(200).json({
                success: true,
                data: overrides
            });
        } catch (error: any) {
            console.error('Error fetching tier overrides:', error);
            return res.status(500).json({
                success: false,
                message: error.message || 'Failed to fetch tier overrides'
            });
        }
    }
);

/**
 * DELETE /admin/users/:userId/tier-override/:resource
 * Remove a tier override for a specific resource
 */
router.delete(
    '/:userId/tier-override/:resource',
    [
        param('userId').isInt().withMessage('User ID must be an integer'),
        param('resource')
            .isIn(['projects', 'data_sources', 'dashboards', 'ai_generations'])
            .withMessage('Resource must be one of: projects, data_sources, dashboards, ai_generations')
    ],
    async (req, res) => {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(400).json({ 
                success: false, 
                errors: errors.array() 
            });
        }
        
        try {
            const userId = parseInt(req.params.userId);
            const resource = req.params.resource;
            const adminId = req.user?.user_id;
            
            const overrideKey = `tier-override:${userId}:${resource}`;
            const deleted = await redis.del(overrideKey);
            
            if (deleted === 0) {
                return res.status(404).json({
                    success: false,
                    message: 'No override found for this resource'
                });
            }
            
            console.log(`[ADMIN OVERRIDE] Admin ${adminId} removed ${resource} override for user ${userId}`);
            
            return res.status(200).json({
                success: true,
                message: 'Tier override removed successfully'
            });
        } catch (error: any) {
            console.error('Error removing tier override:', error);
            return res.status(500).json({
                success: false,
                message: error.message || 'Failed to remove tier override'
            });
        }
    }
);

export default router;
