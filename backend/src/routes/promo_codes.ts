import express, { Request, Response } from 'express';
import { validateJWT } from '../middleware/authenticate.js';
import { PromoCodeService } from '../services/PromoCodeService.js';
import { AppDataSource } from '../datasources/PostgresDS.js';
import { DRAPromoCodeRedemption } from '../models/DRAPromoCodeRedemption.js';

const router = express.Router();
const promoCodeService = PromoCodeService.getInstance();

/**
 * POST /promo-codes/validate
 * 
 * Validate a promo code for current user
 * 
 * Request body:
 * {
 *   code: string,          // Promo code to validate
 *   tierId: number,        // Subscription tier ID
 *   billingCycle: string   // 'monthly' or 'annual'
 * }
 * 
 * Response:
 * {
 *   success: boolean,
 *   data?: {
 *     valid: boolean,
 *     discountAmount?: number,
 *     finalPrice?: number,
 *     discountDescription?: string,
 *     discountType?: string,
 *     discountValue?: number,
 *     upgradesTo?: { id: number, name: string }
 *   },
 *   error?: string
 * }
 */
router.post('/validate', validateJWT, async (req: Request, res: Response) => {
    try {
        const userId = req.body.tokenDetails.user_id;
        const { code, tierId, billingCycle } = req.body;

        // Validate input
        if (!code || !tierId) {
            return res.status(400).json({
                success: false,
                error: 'Missing required fields: code, tierId'
            });
        }

        if (billingCycle && billingCycle !== 'monthly' && billingCycle !== 'annual') {
            return res.status(400).json({
                success: false,
                error: 'Invalid billing cycle. Must be "monthly" or "annual"'
            });
        }

        // Validate promo code
        const validation = await promoCodeService.validatePromoCode(
            code,
            userId,
            parseInt(tierId),
            billingCycle || 'monthly'
        );

        if (!validation.valid) {
            return res.status(200).json({
                success: true,
                data: {
                    valid: false,
                    error: validation.error
                }
            });
        }

        // Return successful validation with discount details
        const response: any = {
            valid: true,
            discountAmount: validation.discountAmount,
            finalPrice: validation.finalPrice,
            discountDescription: validation.discountDescription,
            discountType: validation.code?.discount_type,
            discountValue: validation.code?.discount_value,
            paddleDiscountId: validation.code?.paddle_discount_id || null
        };

        // Include upgraded tier info if applicable
        if (validation.code?.upgraded_tier) {
            response.upgradesTo = {
                id: validation.code.upgraded_tier.id,
                name: validation.code.upgraded_tier.name
            };
        }

        res.status(200).json({
            success: true,
            data: response
        });

    } catch (error: any) {
        console.error('[PromoCode Validate] Error:', error);
        res.status(500).json({
            success: false,
            error: error.message || 'Failed to validate promo code'
        });
    }
});

/**
 * GET /promo-codes/user/redemptions
 * 
 * Get current user's promo code redemption history
 * 
 * Query params:
 * - limit (optional): Number of results to return (default: 50, max: 100)
 * - status (optional): Filter by status (active, expired, cancelled)
 * 
 * Response:
 * {
 *   success: boolean,
 *   data: Array<{
 *     id: number,
 *     code: string,
 *     discountApplied: number,
 *     originalPrice: number,
 *     finalPrice: number,
 *     status: string,
 *     redeemedAt: Date,
 *     expiresAt: Date | null,
 *     organization: { id: number, name: string } | null
 *   }>
 * }
 */
router.get('/user/redemptions', validateJWT, async (req: Request, res: Response) => {
    try {
        const userId = req.body.tokenDetails.user_id;
        const limit = Math.min(parseInt(req.query.limit as string) || 50, 100);
        const status = req.query.status as string;

        const manager = AppDataSource.manager;
        const queryBuilder = manager.createQueryBuilder(DRAPromoCodeRedemption, 'redemption')
            .leftJoinAndSelect('redemption.promo_code', 'promo_code')
            .leftJoinAndSelect('redemption.organization', 'organization')
            .where('redemption.user_id = :userId', { userId })
            .orderBy('redemption.redeemed_at', 'DESC')
            .take(limit);

        // Filter by status if provided
        if (status && ['active', 'expired', 'cancelled'].includes(status)) {
            queryBuilder.andWhere('redemption.status = :status', { status });
        }

        const redemptions = await queryBuilder.getMany();

        // Format response
        const formattedRedemptions = redemptions.map(redemption => ({
            id: redemption.id,
            code: redemption.promo_code?.code || 'N/A',
            discountApplied: parseFloat(redemption.discount_applied?.toString() || '0'),
            originalPrice: parseFloat(redemption.original_price?.toString() || '0'),
            finalPrice: parseFloat(redemption.final_price?.toString() || '0'),
            status: redemption.status,
            redeemedAt: redemption.redeemed_at,
            expiresAt: redemption.expires_at,
            organization: redemption.organization ? {
                id: redemption.organization.id,
                name: redemption.organization.name
            } : null
        }));

        res.status(200).json({
            success: true,
            data: formattedRedemptions
        });

    } catch (error: any) {
        console.error('[PromoCode User Redemptions] Error:', error);
        res.status(500).json({
            success: false,
            error: error.message || 'Failed to fetch redemption history'
        });
    }
});

/**
 * GET /promo-codes/user/active
 * 
 * Get current user's active promo code redemptions
 * Returns only redemptions with status='active' and not yet expired
 * 
 * Response:
 * {
 *   success: boolean,
 *   data: Array<{
 *     id: number,
 *     code: string,
 *     discountApplied: number,
 *     status: string,
 *     redeemedAt: Date,
 *     expiresAt: Date | null,
 *     organization: { id: number, name: string } | null
 *   }>
 * }
 */
router.get('/user/active', validateJWT, async (req: Request, res: Response) => {
    try {
        const userId = req.body.tokenDetails.user_id;

        const activeRedemptions = await promoCodeService.getUserRedemptions(userId, 'active');

        // Format response
        const formattedRedemptions = activeRedemptions.map(redemption => ({
            id: redemption.id,
            code: redemption.promo_code?.code || 'N/A',
            discountApplied: parseFloat(redemption.discount_applied?.toString() || '0'),
            status: redemption.status,
            redeemedAt: redemption.redeemed_at,
            expiresAt: redemption.expires_at,
            organization: redemption.organization ? {
                id: redemption.organization.id,
                name: redemption.organization.name
            } : null
        }));

        res.status(200).json({
            success: true,
            data: formattedRedemptions
        });

    } catch (error: any) {
        console.error('[PromoCode User Active] Error:', error);
        res.status(500).json({
            success: false,
            error: error.message || 'Failed to fetch active redemptions'
        });
    }
});

export default router;
