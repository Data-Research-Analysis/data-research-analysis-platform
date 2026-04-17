import { AppDataSource } from '../datasources/PostgresDS.js';
import { DRAPromoCode, EDiscountType } from '../models/DRAPromoCode.js';
import { DRAPromoCodeRedemption, ERedemptionStatus } from '../models/DRAPromoCodeRedemption.js';
import { DRAUsersPlatform } from '../models/DRAUsersPlatform.js';
import { DRASubscriptionTier } from '../models/DRASubscriptionTier.js';
import { DRAOrganizationSubscription } from '../models/DRAOrganizationSubscription.js';
import { DRAOrganization } from '../models/DRAOrganization.js';
import { In } from 'typeorm';

export interface IPromoCodeValidation {
    valid: boolean;
    code?: DRAPromoCode;
    discountAmount?: number;
    finalPrice?: number;
    discountDescription?: string;
    error?: string;
}

export interface IDiscountCalculation {
    originalPrice: number;
    discountAmount: number;
    finalPrice: number;
    discountDescription: string;
}

export interface IPromoCodeAnalytics {
    totalRedemptions: number;
    activeRedemptions: number;
    totalRevenue: number;
    totalDiscount: number;
    conversionRate: number;
}

/**
 * Promo Code Service - Business Logic Layer for Promotional Codes
 * 
 * Singleton service that handles promo code validation, redemption, and analytics.
 * 
 * Features:
 * - Multiple discount types: percentage, fixed amount, free trial, upgraded tier
 * - Usage limits (global and per-user)
 * - Time-based validity
 * - Tier restrictions
 * - Email domain restrictions
 * - New users only restriction
 * 
 * Usage:
 *   const validation = await PromoCodeService.getInstance().validatePromoCode('LAUNCH50', userId, tierId);
 *   const redemption = await PromoCodeService.getInstance().redeemPromoCode('LAUNCH50', userId, tierId, subscriptionId);
 */
export class PromoCodeService {
    private static instance: PromoCodeService;

    private constructor() {
        console.log('📘 PromoCodeService initialized');
    }

    public static getInstance(): PromoCodeService {
        if (!PromoCodeService.instance) {
            PromoCodeService.instance = new PromoCodeService();
        }
        return PromoCodeService.instance;
    }

    /**
     * Validate promo code for user and tier
     * 
     * @param codeString - Promo code string
     * @param userId - User ID attempting to use the code
     * @param tierId - Subscription tier ID
     * @param billingCycle - Billing cycle (monthly or annual)
     * @returns Validation result with discount details or error message
     */
    async validatePromoCode(
        codeString: string,
        userId: number,
        tierId: number,
        billingCycle: 'monthly' | 'annual' = 'monthly'
    ): Promise<IPromoCodeValidation> {
        const manager = AppDataSource.manager;

        // Find promo code (case-insensitive)
        const promoCode = await manager.findOne(DRAPromoCode, {
            where: { code: codeString.toUpperCase() },
            relations: ['upgraded_tier']
        });

        if (!promoCode) {
            return { valid: false, error: 'Invalid promo code' };
        }

        // Check if active
        if (!promoCode.is_active) {
            return { valid: false, error: 'This promo code is no longer active' };
        }

        // Check validity dates
        const now = new Date();
        if (promoCode.valid_from && promoCode.valid_from > now) {
            return { valid: false, error: 'This promo code is not yet valid' };
        }
        if (promoCode.valid_until && promoCode.valid_until < now) {
            return { valid: false, error: 'This promo code has expired' };
        }

        // Check max uses
        if (promoCode.max_uses && promoCode.current_uses >= promoCode.max_uses) {
            return { valid: false, error: 'This promo code has reached its usage limit' };
        }

        // Check user-specific usage
        const userRedemptions = await manager.count(DRAPromoCodeRedemption, {
            where: {
                promo_code_id: promoCode.id,
                user_id: userId
            }
        });

        if (promoCode.max_uses_per_user && userRedemptions >= promoCode.max_uses_per_user) {
            return { valid: false, error: 'You have already used this promo code' };
        }

        // Check tier restrictions
        if (promoCode.applicable_tiers && Array.isArray(promoCode.applicable_tiers)) {
            if (!promoCode.applicable_tiers.includes(tierId)) {
                return { valid: false, error: 'This promo code is not valid for the selected plan' };
            }
        }

        // Check applicable users restriction (allowlist)
        if (promoCode.applicable_users && Array.isArray(promoCode.applicable_users) && promoCode.applicable_users.length > 0) {
            const user = await manager.findOne(DRAUsersPlatform, { where: { id: userId } });
            if (!user) {
                return { valid: false, error: 'User not found' };
            }
            // Check if user ID or email is in the allowlist
            const userIdMatch = promoCode.applicable_users.some(val => 
                typeof val === 'number' ? val === userId : false
            );
            const emailMatch = promoCode.applicable_users.some(val => 
                typeof val === 'string' ? val.toLowerCase() === user.email.toLowerCase() : false
            );
            if (!userIdMatch && !emailMatch) {
                return { valid: false, error: 'This promo code is not available to you' };
            }
        }

        // Check email domain restriction
        if (promoCode.email_domain_restriction) {
            const user = await manager.findOne(DRAUsersPlatform, { where: { id: userId } });
            if (!user?.email.endsWith(promoCode.email_domain_restriction)) {
                return {
                    valid: false,
                    error: `This promo code is only valid for ${promoCode.email_domain_restriction} email addresses`
                };
            }
        }

        // Check new users only restriction - verify user has no previous subscription history
        if (promoCode.new_users_only) {
            // Find all organizations where user is a member
            const userOrgs = await manager.find(DRAOrganization, {
                where: {
                    members: {
                        users_platform_id: userId
                    }
                },
                relations: ['subscription']
            });
            
            // Check if any of those organizations have/had a paid subscription
            const hasPaidSubscriptionHistory = userOrgs.some(org => 
                org.subscription && 
                org.subscription.subscription_tier_id && 
                org.subscription.subscription_tier_id > 1 // tier_rank > 1 means paid tier
            );
            
            if (hasPaidSubscriptionHistory) {
                return { valid: false, error: 'This promo code is only valid for new users' };
            }
        }

        // Calculate discount
        const tier = await manager.findOne(DRASubscriptionTier, { where: { id: tierId } });
        if (!tier) {
            return { valid: false, error: 'Invalid tier' };
        }

        const calculation = this.calculateDiscount(promoCode, tier, billingCycle);

        return {
            valid: true,
            code: promoCode,
            discountAmount: calculation.discountAmount,
            finalPrice: calculation.finalPrice,
            discountDescription: calculation.discountDescription
        };
    }

    /**
     * Calculate discount amount based on promo code type
     * 
     * @param promoCode - Promo code entity
     * @param tier - Subscription tier entity
     * @param billingCycle - Billing cycle (monthly or annual)
     * @returns Discount calculation details
     */
    calculateDiscount(
        promoCode: DRAPromoCode,
        tier: DRASubscriptionTier,
        billingCycle: 'monthly' | 'annual' = 'monthly'
    ): IDiscountCalculation {
        const originalPrice = billingCycle === 'monthly'
            ? parseFloat(tier.price_per_month_usd?.toString() || '0')
            : parseFloat(tier.price_per_year_usd?.toString() || '0');

        let discountAmount = 0;
        let discountDescription = '';

        switch (promoCode.discount_type) {
            case EDiscountType.PERCENTAGE:
                discountAmount = (originalPrice * ((promoCode.discount_value || 0) / 100));
                discountDescription = `${promoCode.discount_value}% off`;
                break;

            case EDiscountType.FIXED_AMOUNT:
                discountAmount = Math.min(promoCode.discount_value || 0, originalPrice);
                discountDescription = `$${promoCode.discount_value} off`;
                break;

            case EDiscountType.FREE_TRIAL:
                discountAmount = originalPrice;
                discountDescription = `${promoCode.discount_duration_months} months free`;
                break;

            case EDiscountType.UPGRADED_TIER:
                // Discount is difference between current tier and upgraded tier
                // This is handled differently in the subscription flow
                discountDescription = `Upgraded to ${promoCode.upgraded_tier?.tier_name || 'higher tier'} for ${promoCode.upgraded_tier_duration_months} months`;
                break;
        }

        // Apply duration if specified
        if (promoCode.discount_duration_months && promoCode.discount_duration_months > 0) {
            discountDescription += ` for ${promoCode.discount_duration_months} months`;
        } else if (promoCode.discount_duration_months === -1) {
            discountDescription += ` forever`;
        }

        const finalPrice = Math.max(0, originalPrice - discountAmount);

        return {
            originalPrice,
            discountAmount,
            finalPrice,
            discountDescription
        };
    }

    /**
     * Redeem promo code and create redemption record
     * 
     * @param codeString - Promo code string
     * @param userId - User ID redeeming the code
     * @param tierId - Subscription tier ID
     * @param subscriptionId - Organization subscription ID
     * @param organizationId - Organization ID (optional)
     * @param billingCycle - Billing cycle (monthly or annual)
     * @returns Promo code redemption record
     */
    async redeemPromoCode(
        codeString: string,
        userId: number,
        tierId: number,
        subscriptionId: number,
        organizationId?: number,
        billingCycle: 'monthly' | 'annual' = 'monthly'
    ): Promise<DRAPromoCodeRedemption> {
        const manager = AppDataSource.manager;

        // Validate first
        const validation = await this.validatePromoCode(codeString, userId, tierId, billingCycle);
        if (!validation.valid || !validation.code) {
            throw new Error(validation.error || 'Invalid promo code');
        }

        return await manager.transaction(async (transactionalEntityManager) => {
            // Lock the promo code row and re-check limits to prevent race conditions
            const lockedPromoCode = await transactionalEntityManager.findOne(DRAPromoCode, {
                where: { id: validation.code!.id },
                lock: { mode: 'pessimistic_write' }
            });

            if (!lockedPromoCode) {
                throw new Error('Promo code not found');
            }

            // Re-validate max uses under lock
            if (lockedPromoCode.max_uses && lockedPromoCode.current_uses >= lockedPromoCode.max_uses) {
                throw new Error('This promo code has reached its usage limit');
            }

            // Re-validate max uses per user under lock
            if (lockedPromoCode.max_uses_per_user) {
                const userRedemptionCount = await transactionalEntityManager.count(DRAPromoCodeRedemption, {
                    where: {
                        promo_code_id: lockedPromoCode.id,
                        user_id: userId
                    }
                });
                if (userRedemptionCount >= lockedPromoCode.max_uses_per_user) {
                    throw new Error('You have already used this promo code the maximum number of times');
                }
            }

            // Increment usage count
            await transactionalEntityManager.increment(
                DRAPromoCode,
                { id: lockedPromoCode.id },
                'current_uses',
                1
            );

            // Get tier for price calculation
            const tier = await transactionalEntityManager.findOne(DRASubscriptionTier, {
                where: { id: tierId }
            });

            if (!tier) {
                throw new Error('Tier not found');
            }

            const calculation = this.calculateDiscount(validation.code!, tier, billingCycle);

            // Calculate expiration date if time-limited
            let expiresAt: Date | null = null;
            if (validation.code!.discount_duration_months && validation.code!.discount_duration_months > 0) {
                expiresAt = new Date();
                expiresAt.setMonth(expiresAt.getMonth() + validation.code!.discount_duration_months);
            }

            // Create redemption record
            const redemption = transactionalEntityManager.create(DRAPromoCodeRedemption, {
                promo_code_id: validation.code!.id,
                user_id: userId,
                organization_id: organizationId || null,
                subscription_id: subscriptionId,
                redeemed_at: new Date(),
                discount_applied: calculation.discountAmount,
                original_price: calculation.originalPrice,
                final_price: calculation.finalPrice,
                status: ERedemptionStatus.ACTIVE,
                expires_at: expiresAt
            });

            return await transactionalEntityManager.save(redemption);
        });
    }

    /**
     * Get promo code analytics
     * 
     * @param promoCodeId - Promo code ID
     * @returns Analytics data including redemptions, revenue, and conversion
     */
    async getPromoCodeAnalytics(promoCodeId: number): Promise<IPromoCodeAnalytics> {
        const manager = AppDataSource.manager;

        const redemptions = await manager.find(DRAPromoCodeRedemption, {
            where: { promo_code_id: promoCodeId }
        });

        const totalRedemptions = redemptions.length;
        const activeRedemptions = redemptions.filter(r => r.status === ERedemptionStatus.ACTIVE).length;
        const totalRevenue = redemptions.reduce((sum, r) => sum + parseFloat(r.final_price.toString()), 0);
        const totalDiscount = redemptions.reduce((sum, r) => sum + parseFloat(r.discount_applied.toString()), 0);

        // Conversion rate (simplified - would need view tracking in real implementation)
        const conversionRate = totalRedemptions > 0 ? (activeRedemptions / totalRedemptions) * 100 : 0;

        return {
            totalRedemptions,
            activeRedemptions,
            totalRevenue,
            totalDiscount,
            conversionRate
        };
    }

    /**
     * Get user's redemption history
     * 
     * @param userId - User ID
     * @returns Array of redemption records
     */
    async getUserRedemptions(userId: number): Promise<DRAPromoCodeRedemption[]> {
        const manager = AppDataSource.manager;

        return await manager.find(DRAPromoCodeRedemption, {
            where: { user_id: userId },
            relations: ['promo_code'],
            order: { redeemed_at: 'DESC' }
        });
    }

    /**
     * Cancel a redemption (admin function)
     * 
     * @param redemptionId - Redemption ID to cancel
     */
    async cancelRedemption(redemptionId: number): Promise<void> {
        const manager = AppDataSource.manager;

        await manager.update(
            DRAPromoCodeRedemption,
            { id: redemptionId },
            { status: ERedemptionStatus.CANCELLED }
        );
    }

    /**
     * Expire old redemptions (scheduled job)
     * 
     * Marks redemptions as expired if their expires_at date has passed
     */
    async expireOldRedemptions(): Promise<number> {
        const manager = AppDataSource.manager;

        const result = await manager
            .createQueryBuilder()
            .update(DRAPromoCodeRedemption)
            .set({ status: ERedemptionStatus.EXPIRED })
            .where('expires_at < :now', { now: new Date() })
            .andWhere('status = :status', { status: ERedemptionStatus.ACTIVE })
            .execute();

        return result.affected || 0;
    }
}
