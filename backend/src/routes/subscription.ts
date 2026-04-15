import express, { Request, Response } from 'express';
import { validateJWT } from '../middleware/authenticate.js';
import { expensiveOperationsLimiter } from '../middleware/rateLimit.js';
import { organizationContext } from '../middleware/organizationContext.js';
import { RowLimitService } from '../services/RowLimitService.js';
import { TierEnforcementService } from '../services/TierEnforcementService.js';
import { SubscriptionProcessor } from '../processors/SubscriptionProcessor.js';
import { AppDataSource } from '../datasources/PostgresDS.js';
import { DRAOrganization } from '../models/DRAOrganization.js';
import { DRAOrganizationMember } from '../models/DRAOrganizationMember.js';
import { DRASubscriptionTier } from '../models/DRASubscriptionTier.js';
import { In } from 'typeorm';

const router = express.Router();
const subscriptionProcessor = SubscriptionProcessor.getInstance();

// Get current user's subscription and usage stats
router.get('/current', async (req: Request, res: Response, next: any) => {
    next();
}, validateJWT, async (req: Request, res: Response) => {
    try {
        const { user_id } = req.body.tokenDetails;
        const rowLimitService = RowLimitService.getInstance();
        
        const stats = await rowLimitService.getUsageStats(user_id);
        
        res.status(200).json({
            success: true,
            data: stats
        });
    } catch (error: any) {
        console.error('Error fetching subscription:', error);
        res.status(500).json({
            success: false,
            message: error.message || 'Failed to fetch subscription details'
        });
    }
});

// Get enhanced usage stats with tier enforcement flags
router.get('/usage', async (req: Request, res: Response, next: any) => {
    next();
}, validateJWT, async (req: Request, res: Response) => {
    try {
        const { user_id } = req.body.tokenDetails;
        const tierService = TierEnforcementService.getInstance();
        
        const stats = await tierService.getUsageStats(user_id);
        
        res.status(200).json({
            success: true,
            data: stats
        });
    } catch (error: any) {
        console.error('Error fetching usage stats:', error);
        res.status(500).json({
            success: false,
            message: error.message || 'Failed to fetch usage statistics'
        });
    }
});

// ============================================================================
// PADDLE PAYMENT INTEGRATION ROUTES
// ============================================================================

/**
 * POST /subscription/checkout
 * 
 * Create Paddle checkout session for subscription purchase
 * Requires: tierId, billingCycle, organizationId
 * Returns: priceId, sessionId, customerEmail, checkoutUrl
 */
router.post('/checkout', validateJWT, expensiveOperationsLimiter, async (req: Request, res: Response) => {
    try {
        const { tierId, billingCycle, organizationId, promoCode } = req.body;
        const userId = req.body.tokenDetails.user_id;
        
        // Validate input
        if (!tierId || !billingCycle || !organizationId) {
            return res.status(400).json({
                success: false,
                error: 'Missing required fields: tierId, billingCycle, organizationId'
            });
        }
        
        if (billingCycle !== 'monthly' && billingCycle !== 'annual') {
            return res.status(400).json({
                success: false,
                error: 'Invalid billing cycle. Must be "monthly" or "annual"'
            });
        }
        
        // Verify user is member of organization
        const manager = AppDataSource.manager;
        const membership = await manager.findOne(DRAOrganizationMember, {
            where: {
                organization_id: organizationId,
                users_platform_id: userId
            }
        });
        
        if (!membership) {
            return res.status(403).json({
                success: false,
                error: 'You are not a member of this organization'
            });
        }
        
        // Create checkout session (with optional promo code)
        const session = await subscriptionProcessor.initiateCheckout(
            organizationId,
            tierId,
            billingCycle,
            userId,
            promoCode
        );
        
        res.json({
            success: true,
            ...session
        });
    } catch (error: any) {
        console.error('Checkout error:', error);
        res.status(500).json({
            success: false,
            error: error.message || 'Failed to create checkout session'
        });
    }
});

/**
 * POST /subscription/check-activation
 * 
 * Check if subscription has been activated (used for polling after checkout)
 * Requires: organizationId, transactionId
 * Returns: activated (boolean), subscription (if activated)
 */
router.post('/check-activation', validateJWT, async (req: Request, res: Response) => {
    try {
        const { organizationId, transactionId } = req.body;
        const userId = req.body.tokenDetails.user_id;
        
        if (!organizationId || !transactionId) {
            return res.status(400).json({
                success: false,
                error: 'Missing required fields: organizationId, transactionId'
            });
        }
        
        // Verify user is member of organization
        const manager = AppDataSource.manager;
        const membership = await manager.findOne(DRAOrganizationMember, {
            where: {
                organization_id: organizationId,
                users_platform_id: userId
            }
        });
        
        if (!membership) {
            return res.status(403).json({
                success: false,
                error: 'You are not a member of this organization'
            });
        }
        
        // Check if organization has active subscription with this transaction
        const organization = await manager.findOne(DRAOrganization, {
            where: { id: organizationId },
            relations: ['subscription', 'subscription.subscription_tier']
        });
        
        if (!organization) {
            return res.status(404).json({
                success: false,
                error: 'Organization not found'
            });
        }
        
        const subscription = organization.subscription;
        const activated = subscription?.paddle_transaction_id === transactionId && subscription?.is_active === true;
        
        res.json({
            success: true,
            activated,
            subscription: activated ? {
                id: subscription.id,
                tier_name: subscription.subscription_tier?.tier_name,
                billing_cycle: subscription.billing_cycle,
                is_active: subscription.is_active,
                ends_at: subscription.ends_at
            } : null
        });
    } catch (error: any) {
        console.error('Check activation error:', error);
        res.status(500).json({
            success: false,
            error: error.message || 'Failed to check activation status'
        });
    }
});

/**
 * POST /subscription/portal-url
 * 
 * Generate Paddle billing portal URL for payment method updates
 * Requires: organizationId
 * Returns: url (Paddle portal URL)
 */
router.post('/portal-url', validateJWT, async (req: Request, res: Response) => {
    try {
        const { organizationId } = req.body;
        const userId = req.body.tokenDetails.user_id;
        
        if (!organizationId) {
            return res.status(400).json({
                success: false,
                error: 'Missing required field: organizationId'
            });
        }
        
        // Verify user is owner of organization
        const manager = AppDataSource.manager;
        const organization = await manager.findOne(DRAOrganization, {
            where: { id: organizationId }
        });
        
        if (!organization) {
            return res.status(404).json({
                success: false,
                error: 'Organization not found'
            });
        }
        
        const ownerMember = organization.members?.find(m => m.role === 'owner');
        if (!ownerMember || ownerMember.users_platform_id !== userId) {
            return res.status(403).json({
                success: false,
                error: 'Only organization owner can access billing portal'
            });
        }
        
        // Generate billing portal URL
        const url = await subscriptionProcessor.getBillingPortalUrl(organizationId);
        
        res.json({
            success: true,
            url
        });
    } catch (error: any) {
        console.error('Portal URL error:', error);
        res.status(500).json({
            success: false,
            error: error.message || 'Failed to generate billing portal URL'
        });
    }
});

/**
 * POST /subscription/cancel
 * 
 * Cancel subscription (access continues until end of billing period)
 * Requires: organizationId, reason (optional)
 * Returns: subscription data
 */
router.post('/cancel', validateJWT, async (req: Request, res: Response) => {
    try {
        const { organizationId, reason } = req.body;
        const userId = req.body.tokenDetails.user_id;
        
        if (!organizationId) {
            return res.status(400).json({
                success: false,
                error: 'Missing required field: organizationId'
            });
        }
        
        // Verify user is owner of organization
        const manager = AppDataSource.manager;
        const organization = await manager.findOne(DRAOrganization, {
            where: { id: organizationId },
            relations: ['members', 'members.user']
        });
        
        if (!organization) {
            return res.status(404).json({
                success: false,
                error: 'Organization not found'
            });
        }
        
        const ownerMember = organization.members?.find(m => m.role === 'owner');
        if (!ownerMember || ownerMember.users_platform_id !== userId) {
            return res.status(403).json({
                success: false,
                error: 'Only organization owner can cancel subscription'
            });
        }
        
        // Cancel subscription
        const subscription = await subscriptionProcessor.cancelSubscription(
            organizationId,
            reason || 'not_specified'
        );
        
        res.json({
            success: true,
            data: subscription
        });
    } catch (error: any) {
        console.error('Cancel subscription error:', error);
        res.status(500).json({
            success: false,
            error: error.message || 'Failed to cancel subscription'
        });
    }
});

/**
 * GET /subscription/tiers
 * 
 * Get all available subscription tiers with pricing
 * Public endpoint - used for tier selection modals and pricing pages
 * 
 * Returns: Array of tiers with id, name, pricing, and feature limits
 */
router.get('/tiers', async (req: Request, res: Response) => {
    try {
        const manager = AppDataSource.manager;
        
        const tiers = await manager.find(DRASubscriptionTier, {
            where: { is_active: true },
            order: { price_per_month_usd: 'ASC' }
        });
        
        // Format for frontend consumption
        const formattedTiers = tiers.map(tier => ({
            id: tier.id,
            tier_name: tier.tier_name,
            price_monthly: parseFloat(tier.price_per_month_usd.toString()),
            price_annual: tier.price_per_year_usd ? parseFloat(tier.price_per_year_usd.toString()) : null,
            paddle_price_id_monthly: tier.paddle_price_id_monthly,
            paddle_price_id_annual: tier.paddle_price_id_annual,
            features: {
                max_projects: tier.max_projects,
                max_data_sources_per_project: tier.max_data_sources_per_project,
                max_data_models_per_data_source: tier.max_data_models_per_data_source,
                max_dashboards: tier.max_dashboards,
                max_members_per_project: tier.max_members_per_project,
                max_rows_per_data_model: tier.max_rows_per_data_model,
                ai_generations_per_month: tier.ai_generations_per_month
            }
        }));
        
        res.json({ success: true, data: formattedTiers });
    } catch (error: any) {
        console.error('Get tiers error:', error);
        res.status(500).json({
            success: false,
            error: error.message || 'Failed to retrieve subscription tiers'
        });
    }
});

/**
 * GET /subscription/:organizationId
 * 
 * Get organization subscription details
 * Returns: subscription with tier information
 */
router.get('/:organizationId', validateJWT, async (req: Request, res: Response) => {
    try {
        const organizationId = parseInt(req.params.organizationId);
        const userId = req.body.tokenDetails.user_id;
        
        if (isNaN(organizationId)) {
            return res.status(400).json({
                success: false,
                error: 'Invalid organization ID'
            });
        }
        
        // Verify user is member of organization
        const manager = AppDataSource.manager;
        const membership = await manager.findOne(DRAOrganizationMember, {
            where: {
                organization_id: organizationId,
                users_platform_id: userId
            }
        });
        
        if (!membership) {
            return res.status(403).json({
                success: false,
                error: 'You are not a member of this organization'
            });
        }
        
        // Get organization with subscription
        const organization = await manager.findOne(DRAOrganization, {
            where: { id: organizationId },
            relations: ['subscription', 'subscription.subscription_tier']
        });
        
        if (!organization) {
            return res.status(404).json({
                success: false,
                error: 'Organization not found'
            });
        }
        
        const subscription = organization.subscription;
        
        res.json({
            success: true,
            data: subscription ? {
                id: subscription.id,
                tier_name: subscription.subscription_tier?.tier_name || 'FREE',
                billing_cycle: subscription.billing_cycle,
                is_active: subscription.is_active,
                started_at: subscription.started_at,
                ends_at: subscription.ends_at,
                cancelled_at: subscription.cancelled_at,
                grace_period_ends_at: subscription.grace_period_ends_at,
                last_payment_failed_at: subscription.last_payment_failed_at,
                paddle_subscription_id: subscription.paddle_subscription_id,
                paddle_customer_id: subscription.paddle_customer_id,
                paddle_update_url: subscription.paddle_update_url
            } : null
        });
    } catch (error: any) {
        console.error('Get subscription error:', error);
        res.status(500).json({
            success: false,
            error: error.message || 'Failed to fetch subscription'
        });
    }
});

/**
 * GET /subscription/payment-history/:organizationId
 * 
 * Get payment history for organization subscription
 * Returns: array of transactions from Paddle
 */
router.get('/payment-history/:organizationId', validateJWT, async (req: Request, res: Response) => {
    try {
        const organizationId = parseInt(req.params.organizationId);
        const userId = req.body.tokenDetails.user_id;
        
        if (isNaN(organizationId)) {
            return res.status(400).json({
                success: false,
                error: 'Invalid organization ID'
            });
        }
        
        // Verify user is member of organization
        const manager = AppDataSource.manager;
        const membership = await manager.findOne(DRAOrganizationMember, {
            where: {
                organization_id: organizationId,
                users_platform_id: userId
            }
        });
        
        if (!membership) {
            return res.status(403).json({
                success: false,
                error: 'You are not a member of this organization'
            });
        }
        
        // Get payment history from Paddle
        const paymentHistory = await subscriptionProcessor.getPaymentHistory(organizationId);
        
        res.json({
            success: true,
            data: paymentHistory
        });
    } catch (error: any) {
        console.error('Get payment history error:', error);
        res.status(500).json({
            success: false,
            error: error.message || 'Failed to fetch payment history'
        });
    }
});

// Submit Enterprise plan inquiry
router.post('/enterprise-request', validateJWT, async (req: Request, res: Response) => {
    try {
        const { companyName, teamSize, message } = req.body;
        const userId = req.body.tokenDetails.user_id;
        
        // Validate required fields
        if (!companyName || !teamSize) {
            return res.status(400).json({
                success: false,
                error: 'Company name and team size are required'
            });
        }
        
        const manager = AppDataSource.manager;
        
        // Get user's organization (if any)
        const organizationMember = await manager.findOne(DRAOrganizationMember, {
            where: { users_platform_id: userId },
            order: { id: 'DESC' } // Get most recent organization
        });
        
        // Import entity dynamically to avoid circular dependency
        const { DRAEnterpriseContactRequest } = await import('../models/DRAEnterpriseContactRequest.js');
        
        // Create enterprise contact request
        const request = manager.create(DRAEnterpriseContactRequest, {
            user_id: userId,
            organization_id: organizationMember?.organization_id || null,
            company_name: companyName,
            team_size: teamSize,
            message: message || null,
            status: 'pending'
        });
        
        const saved = await manager.save(request);
        
        console.log(`✅ Enterprise contact request created: ID ${saved.id}, Company: ${companyName}, Team Size: ${teamSize}`);
        
        // TODO: Send email notification to sales team
        
        res.json({
            success: true,
            data: {
                id: saved.id,
                message: 'Your inquiry has been submitted successfully. Our team will contact you within 24 hours.'
            }
        });
    } catch (error: any) {
        console.error('Enterprise request error:', error);
        res.status(500).json({
            success: false,
            error: error.message || 'Failed to submit enterprise inquiry'
        });
    }
});

// Submit downgrade request
router.post('/downgrade-request', validateJWT, async (req: Request, res: Response) => {
    try {
        const { currentTier, requestedTier, reason, message } = req.body;
        const userId = req.body.tokenDetails.user_id;
        
        // Validate required fields
        if (!currentTier || !requestedTier || !reason) {
            return res.status(400).json({
                success: false,
                error: 'Current tier, requested tier, and reason are required'
            });
        }
        
        const manager = AppDataSource.manager;
        
        // Get user's organization (if any)
        const organizationMember = await manager.findOne(DRAOrganizationMember, {
            where: { users_platform_id: userId },
            order: { id: 'DESC' } // Get most recent organization
        });
        
        // Import entity dynamically to avoid circular dependency
        const { DRADowngradeRequest } = await import('../models/DRADowngradeRequest.js');
        
        // Create downgrade request
        const request = manager.create(DRADowngradeRequest, {
            user_id: userId,
            organization_id: organizationMember?.organization_id || null,
            current_tier: currentTier,
            requested_tier: requestedTier,
            reason: reason,
            message: message || null,
            status: 'pending'
        });
        
        const saved = await manager.save(request);
        
        console.log(`✅ Downgrade request created: ID ${saved.id}, ${currentTier} → ${requestedTier}, Reason: ${reason}`);
        
        // TODO: Send email notification to support team
        
        res.json({
            success: true,
            data: {
                id: saved.id,
                message: 'Your downgrade request has been submitted. Our support team will contact you within 24-48 hours.'
            }
        });
    } catch (error: any) {
        console.error('Downgrade request error:', error);
        res.status(500).json({
            success: false,
            error: error.message || 'Failed to submit downgrade request'
        });
    }
});

/**
 * POST /subscription/change-tier
 * Immediately change subscription tier with prorated billing
 * 
 * Body:
 * - organizationId: number (required)
 * - newTierId: number (required)
 * - billingCycle: 'monthly' | 'annual' (optional, defaults to current cycle)
 * 
 * Auth: validateJWT + organizationContext
 * Permission: Owner or Admin
 * 
 * Returns: Updated subscription object
 */
router.post('/change-tier', validateJWT, organizationContext, async (req: Request, res: Response) => {
    try {
        const { organizationId, newTierId, billingCycle } = req.body;
        const userId = req.body.tokenDetails.user_id;
        
        // Verify owner/admin role (set by organizationContext middleware)
        const reqWithContext = req as any;
        if (reqWithContext.organizationRole !== 'owner' && reqWithContext.organizationRole !== 'admin') {
            return res.status(403).json({ 
                success: false,
                error: 'Only owners and admins can change subscription tier' 
            });
        }
        
        // Call processor
        const subscription = await subscriptionProcessor.changeTier(organizationId, newTierId, userId, billingCycle);
        
        res.json({ 
            success: true, 
            data: subscription 
        });
    } catch (error: any) {
        console.error('Tier change error:', error);
        
        // Special handling for canceled subscriptions
        if (error.message === 'SUBSCRIPTION_CANCELED_USE_CHECKOUT') {
            return res.status(200).json({
                success: false,
                useCheckout: true,
                error: 'Subscription was canceled. Please use checkout to create a new subscription.',
                message: 'Your previous subscription was canceled. To subscribe to this plan, please complete the checkout process.'
            });
        }
        
        res.status(500).json({
            success: false,
            error: error.message || 'Failed to change subscription tier'
        });
    }
});

/**
 * GET /subscription/payment-method/:organizationId
 * Get current payment method details from Paddle
 * 
 * Auth: validateJWT + organizationContext
 * Permission: Owner, Admin, or Platform Admin (read-only)
 * 
 * Returns: { type, last4, expiryMonth, expiryYear, brand }
 */
router.get('/payment-method/:organizationId', validateJWT, organizationContext, async (req: Request, res: Response) => {
    try {
        const orgId = parseInt(req.params.organizationId);
        
        if (isNaN(orgId)) {
            return res.status(400).json({
                success: false,
                error: 'Invalid organization ID'
            });
        }
        
        const paymentMethod = await subscriptionProcessor.getPaymentMethod(orgId);
        
        res.json({ 
            success: true, 
            data: paymentMethod 
        });
    } catch (error: any) {
        console.error('Get payment method error:', error);
        res.status(500).json({
            success: false,
            error: error.message || 'Failed to retrieve payment method'
        });
    }
});

/**
 * GET /subscription/downgrade-requests/:organizationId
 * Get active downgrade requests for organization
 * 
 * Returns only pending/contacted requests for billing section display
 */
router.get('/downgrade-requests/:organizationId', validateJWT, organizationContext, async (req: Request, res: Response) => {
    try {
        const orgId = parseInt(req.params.organizationId);
        
        if (isNaN(orgId)) {
            return res.status(400).json({
                success: false,
                error: 'Invalid organization ID'
            });
        }
        
        const manager = AppDataSource.manager;
        const { DRADowngradeRequest } = await import('../models/DRADowngradeRequest.js');
        
        const requests = await manager.find(DRADowngradeRequest, {
            where: { 
                organization_id: orgId,
                status: In(['pending', 'contacted'])
            },
            order: { created_at: 'DESC' }
        });
        
        res.json({ success: true, data: requests });
    } catch (error: any) {
        console.error('Get downgrade requests error:', error);
        res.status(500).json({
            success: false,
            error: error.message || 'Failed to retrieve downgrade requests'
        });
    }
});

/**
 * GET /subscription/validate-payment-method/:organizationId
 * Validate payment method on file
 * 
 * Returns validation status, expiry info, and card details.
 * Organization owner only.
 */
router.get('/validate-payment-method/:organizationId',
    validateJWT,
    async (req: Request, res: Response) => {
        try {
            const organizationId = parseInt(req.params.organizationId);
            
            if (isNaN(organizationId)) {
                return res.status(400).json({ 
                    success: false, 
                    error: 'Invalid organization ID' 
                });
            }
            
            const validation = await subscriptionProcessor.validatePaymentMethod(organizationId);
            
            res.json({ success: true, validation });
        } catch (error: any) {
            console.error('Validate payment method error:', error);
            res.status(400).json({ success: false, error: error.message });
        }
    }
);

/**
 * GET /subscription/preview-upgrade/:organizationId/:tierId/:billingCycle
 * Preview upgrade cost (proration)
 * 
 * Returns proration details WITHOUT executing upgrade.
 * Organization owner only.
 */
router.get('/preview-upgrade/:organizationId/:tierId/:billingCycle', 
    validateJWT,
    organizationContext,
    async (req: Request, res: Response) => {
        try {
            const organizationId = parseInt(req.params.organizationId);
            const tierId = parseInt(req.params.tierId);
            const billingCycle = req.params.billingCycle as 'monthly' | 'annual';
            const userId = req.tokenDetails?.user_id || req.user_id;
            const discountId = req.query.discountId as string | undefined;

            // Verify owner role (set by organizationContext middleware)
            const reqWithContext = req as any;
            if (reqWithContext.organizationRole !== 'owner') {
                return res.status(403).json({
                    success: false,
                    error: 'Only organization owner can preview subscription upgrade'
                });
            }
            
            if (!userId) {
                return res.status(401).json({ 
                    success: false, 
                    error: 'Authentication required' 
                });
            }
            
            if (isNaN(organizationId) || isNaN(tierId)) {
                return res.status(400).json({ 
                    success: false, 
                    error: 'Invalid organization ID or tier ID' 
                });
            }
            
            if (billingCycle !== 'monthly' && billingCycle !== 'annual') {
                return res.status(400).json({ 
                    success: false, 
                    error: 'Invalid billing cycle. Must be "monthly" or "annual"' 
                });
            }
            
            const preview = await subscriptionProcessor.previewUpgrade(
                organizationId, 
                tierId, 
                userId, 
                billingCycle,
                discountId || undefined
            );
            
            res.json({ success: true, preview });
        } catch (error: any) {
            console.error('Preview upgrade error:', error);
            res.status(400).json({ success: false, error: error.message });
        }
    }
);

/**
 * POST /subscription/execute-upgrade
 * Execute upgrade after confirmation
 * 
 * Body: { organizationId, tierId, billingCycle }
 * 
 * Charges payment method on file via Paddle.
 * Organization owner only.
 */
router.post('/execute-upgrade', 
    validateJWT,
    organizationContext,
    expensiveOperationsLimiter,
    async (req: Request, res: Response) => {
        try {
            const { organizationId, tierId, billingCycle, discountId } = req.body;
            const userId = req.tokenDetails?.user_id || req.user_id;

            // Verify owner role (set by organizationContext middleware)
            const reqWithContext = req as any;
            if (reqWithContext.organizationRole !== 'owner') {
                return res.status(403).json({
                    success: false,
                    error: 'Only organization owner can execute subscription upgrade'
                });
            }
            
            console.log('[POST /execute-upgrade] Request received:', {
                organizationId,
                tierId,
                billingCycle,
                discountId: discountId || null,
                userId
            });
            
            if (!organizationId || !tierId || !billingCycle) {
                return res.status(400).json({ 
                    success: false, 
                    error: 'Missing required fields: organizationId, tierId, billingCycle' 
                });
            }
            
            if (billingCycle !== 'monthly' && billingCycle !== 'annual') {
                return res.status(400).json({ 
                    success: false, 
                    error: 'Invalid billing cycle. Must be "monthly" or "annual"' 
                });
            }
            
            const subscription = await subscriptionProcessor.executeUpgrade(
                parseInt(organizationId),
                parseInt(tierId),
                userId,
                billingCycle,
                discountId || undefined
            );
            
            console.log('[POST /execute-upgrade] Success! Subscription updated:', {
                subscriptionId: subscription.id,
                tierId: subscription.subscription_tier_id,
                tierName: subscription.subscription_tier?.tier_name,
                billingCycle: subscription.billing_cycle
            });
            
            res.json({ success: true, subscription });
        } catch (error: any) {
            console.error('[POST /execute-upgrade] Error:', error);
            
            // Special handling for canceled subscriptions
            if (error.message === 'SUBSCRIPTION_CANCELED_USE_CHECKOUT') {
                return res.status(200).json({
                    success: false,
                    useCheckout: true,
                    error: 'SUBSCRIPTION_CANCELED_USE_CHECKOUT',
                    message: 'Your previous subscription was canceled. To subscribe to this plan, please complete the checkout process.'
                });
            }
            
            res.status(400).json({ success: false, error: error.message });
        }
    }
);

/**
 * Sync subscription state from Paddle
 * 
 * Manually fetches current subscription from Paddle and updates database to match.
 * Useful when database and Paddle are out of sync.
 * 
 * Organization owner only.
 */
router.post('/sync-from-paddle/:organizationId',
    validateJWT,
    async (req: Request, res: Response) => {
        try {
            const organizationId = parseInt(req.params.organizationId);
            const userId = req.tokenDetails?.user_id || req.user_id;
            
            if (!userId) {
                return res.status(401).json({ 
                    success: false, 
                    error: 'Authentication required' 
                });
            }
            
            console.log('[POST /sync-from-paddle] Syncing org:', organizationId);
            
            const result = await subscriptionProcessor.syncSubscriptionFromPaddle(organizationId, userId);
            
            console.log('[POST /sync-from-paddle] Sync complete:', result);
            
            res.json({ success: true, data: result });
        } catch (error: any) {
            console.error('[POST /sync-from-paddle] Error:', error);
            res.status(400).json({ success: false, error: error.message });
        }
    }
);

export default router;
