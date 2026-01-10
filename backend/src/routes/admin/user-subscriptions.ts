import express from 'express';
import { body, param, validationResult } from 'express-validator';
import { UserSubscriptionProcessor } from '../../processors/UserSubscriptionProcessor.js';
import { SubscriptionTierProcessor } from '../../processors/SubscriptionTierProcessor.js';

const router = express.Router();
const userSubscriptionProcessor = UserSubscriptionProcessor.getInstance();
const subscriptionTierProcessor = SubscriptionTierProcessor.getInstance();

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

export default router;
