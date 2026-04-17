import express, { Request, Response } from 'express';
import { validateJWT } from '../../middleware/authenticate.js';
import { PromoCodeProcessor, ICreatePromoCodeParams, IUpdatePromoCodeParams } from '../../processors/PromoCodeProcessor.js';
import { EUserType } from '../../types/EUserType.js';
import { EDiscountType } from '../../models/DRAPromoCode.js';

const router = express.Router();
const promoCodeProcessor = PromoCodeProcessor.getInstance();

// Middleware to check if user is admin
async function requireAdmin(req: any, res: any, next: any) {
    const tokenDetails = req.tokenDetails || req.body.tokenDetails;
    if (!tokenDetails || tokenDetails.user_type !== EUserType.ADMIN) {
        return res.status(403).send({ message: 'Admin access required' });
    }
    next();
}

/**
 * GET /admin/promo-codes/list
 * Get all promo codes with optional filtering
 */
router.get('/list', validateJWT, requireAdmin, async (req: Request, res: Response) => {
    try {
        const { isActive, campaignName, validNow } = req.query;
        
        const filters: any = {};
        if (isActive !== undefined) {
            filters.isActive = isActive === 'true';
        }
        if (campaignName) {
            filters.campaignName = campaignName as string;
        }
        if (validNow !== undefined) {
            filters.validNow = validNow === 'true';
        }
        
        const promoCodes = await promoCodeProcessor.getAllPromoCodes(filters);
        
        res.json({
            success: true,
            data: promoCodes
        });
    } catch (error: any) {
        console.error('Error fetching promo codes:', error);
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

/**
 * GET /admin/promo-codes/campaigns/list
 * Get all active campaigns with stats
 */
router.get('/campaigns/list', validateJWT, requireAdmin, async (req: Request, res: Response) => {
    try {
        const campaigns = await promoCodeProcessor.getActiveCampaigns();
        
        res.json({
            success: true,
            data: campaigns
        });
    } catch (error: any) {
        console.error('Error fetching campaigns:', error);
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

/**
 * GET /admin/promo-codes/:id
 * Get promo code by ID with analytics
 */
router.get('/:id', validateJWT, requireAdmin, async (req: Request, res: Response) => {
    try {
        const { id } = req.params;
        
        const promoCode = await promoCodeProcessor.getPromoCodeById(parseInt(id));
        const analytics = await promoCodeProcessor.getPromoCodeAnalytics(parseInt(id));
        const redemptions = await promoCodeProcessor.getRedemptions(parseInt(id), 50);
        
        res.json({
            success: true,
            data: {
                promoCode,
                analytics,
                redemptions
            }
        });
    } catch (error: any) {
        console.error('Error fetching promo code:', error);
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

/**
 * POST /admin/promo-codes/create
 * Create a new promo code
 */
router.post('/create', validateJWT, requireAdmin, async (req: Request, res: Response) => {
    try {
        const userId = req.body.tokenDetails.user_id;
        const {
            code,
            discountType,
            discountValue,
            discountDurationMonths,
            upgradedTierId,
            upgradedTierDurationMonths,
            validFrom,
            validUntil,
            maxUses,
            maxUsesPerUser,
            applicableTiers,
            applicableUsers,
            emailDomainRestriction,
            newUsersOnly,
            description,
            campaignName,
            paddleDiscountId
        } = req.body;
        
        // Validate required fields
        if (!code || !discountType) {
            return res.status(400).json({
                success: false,
                error: 'Code and discount type are required'
            });
        }
        
        // Validate discount type
        if (!Object.values(EDiscountType).includes(discountType)) {
            return res.status(400).json({
                success: false,
                error: `Invalid discount type. Must be one of: ${Object.values(EDiscountType).join(', ')}`
            });
        }
        
        const params: ICreatePromoCodeParams = {
            code,
            discountType,
            discountValue: discountValue ? parseFloat(discountValue) : undefined,
            discountDurationMonths: discountDurationMonths ? parseInt(discountDurationMonths) : undefined,
            upgradedTierId: upgradedTierId ? parseInt(upgradedTierId) : undefined,
            upgradedTierDurationMonths: upgradedTierDurationMonths ? parseInt(upgradedTierDurationMonths) : undefined,
            validFrom: validFrom ? new Date(validFrom) : undefined,
            validUntil: validUntil ? new Date(validUntil) : undefined,
            maxUses: maxUses ? parseInt(maxUses) : undefined,
            maxUsesPerUser: maxUsesPerUser ? parseInt(maxUsesPerUser) : undefined,
            applicableTiers,
            applicableUsers,
            emailDomainRestriction,
            newUsersOnly: newUsersOnly === true || newUsersOnly === 'true',
            description,
            campaignName,
            paddleDiscountId: paddleDiscountId || undefined,
            createdBy: userId
        };
        
        const promoCode = await promoCodeProcessor.createPromoCode(params);
        
        res.json({
            success: true,
            data: promoCode
        });
    } catch (error: any) {
        console.error('Error creating promo code:', error);
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

/**
 * PATCH /admin/promo-codes/:id
 * Update promo code
 */
router.patch('/:id', validateJWT, requireAdmin, async (req: Request, res: Response) => {
    try {
        const { id } = req.params;
        const { isActive, validUntil, maxUses, description, discountValue, paddleDiscountId } = req.body;
        
        const params: IUpdatePromoCodeParams = {
            id: parseInt(id),
            isActive: isActive !== undefined ? (isActive === true || isActive === 'true') : undefined,
            validUntil: validUntil ? new Date(validUntil) : undefined,
            maxUses: maxUses ? parseInt(maxUses) : undefined,
            description,
            discountValue: discountValue ? parseFloat(discountValue) : undefined,
            paddleDiscountId: paddleDiscountId !== undefined ? (paddleDiscountId || null) : undefined
        };
        
        const promoCode = await promoCodeProcessor.updatePromoCode(params);
        
        res.json({
            success: true,
            data: promoCode
        });
    } catch (error: any) {
        console.error('Error updating promo code:', error);
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

/**
 * POST /admin/promo-codes/:id/activate
 * Activate promo code
 */
router.post('/:id/activate', validateJWT, requireAdmin, async (req: Request, res: Response) => {
    try {
        const { id } = req.params;
        
        await promoCodeProcessor.activatePromoCode(parseInt(id));
        
        res.json({
            success: true,
            message: 'Promo code activated'
        });
    } catch (error: any) {
        console.error('Error activating promo code:', error);
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

/**
 * POST /admin/promo-codes/:id/deactivate
 * Deactivate promo code
 */
router.post('/:id/deactivate', validateJWT, requireAdmin, async (req: Request, res: Response) => {
    try {
        const { id } = req.params;
        
        await promoCodeProcessor.deactivatePromoCode(parseInt(id));
        
        res.json({
            success: true,
            message: 'Promo code deactivated'
        });
    } catch (error: any) {
        console.error('Error deactivating promo code:', error);
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

/**
 * DELETE /admin/promo-codes/:id
 * Delete promo code (only if not used)
 */
router.delete('/:id', validateJWT, requireAdmin, async (req: Request, res: Response) => {
    try {
        const { id } = req.params;
        
        await promoCodeProcessor.deletePromoCode(parseInt(id));
        
        res.json({
            success: true,
            message: 'Promo code deleted'
        });
    } catch (error: any) {
        console.error('Error deleting promo code:', error);
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

/**
 * GET /admin/promo-codes/:id/analytics
 * Get detailed analytics for a promo code
 */
router.get('/:id/analytics', validateJWT, requireAdmin, async (req: Request, res: Response) => {
    try {
        const { id } = req.params;
        
        const analytics = await promoCodeProcessor.getPromoCodeAnalytics(parseInt(id));
        
        res.json({
            success: true,
            analytics
        });
    } catch (error: any) {
        console.error('Error fetching analytics:', error);
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

/**
 * GET /admin/promo-codes/:id/redemptions
 * Get redemptions for a promo code
 */
router.get('/:id/redemptions', validateJWT, requireAdmin, async (req: Request, res: Response) => {
    try {
        const { id } = req.params;
        const { limit } = req.query;
        
        const redemptions = await promoCodeProcessor.getRedemptions(
            parseInt(id),
            limit ? parseInt(limit as string) : 100
        );
        
        res.json({
            success: true,
            redemptions
        });
    } catch (error: any) {
        console.error('Error fetching redemptions:', error);
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

export default router;
