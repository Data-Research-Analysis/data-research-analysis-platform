import { AppDataSource } from '../datasources/PostgresDS.js';
import { DRAPromoCode, EDiscountType } from '../models/DRAPromoCode.js';
import { DRAPromoCodeRedemption } from '../models/DRAPromoCodeRedemption.js';
import { PromoCodeService } from '../services/PromoCodeService.js';
import { PaddleService } from '../services/PaddleService.js';
import { In } from 'typeorm';

export interface ICreatePromoCodeParams {
    code: string;
    discountType: EDiscountType;
    discountValue?: number;
    discountDurationMonths?: number;
    upgradedTierId?: number;
    upgradedTierDurationMonths?: number;
    validFrom?: Date;
    validUntil?: Date;
    maxUses?: number;
    maxUsesPerUser?: number;
    applicableTiers?: number[];
    applicableUsers?: (number | string)[];
    emailDomainRestriction?: string;
    newUsersOnly?: boolean;
    description?: string;
    campaignName?: string;
    paddleDiscountId?: string;
    createdBy: number;
}

export interface IUpdatePromoCodeParams {
    id: number;
    isActive?: boolean;
    validUntil?: Date;
    maxUses?: number;
    description?: string;
    discountValue?: number;
    paddleDiscountId?: string | null;
}

/**
 * PromoCodeProcessor - Business logic for promo code management
 * 
 * Handles:
 * - Creating and managing promo codes
 * - Validating codes for users
 * - Applying codes during checkout
 * - Analytics and reporting
 * - Admin operations
 * 
 * @see backend/src/services/PromoCodeService.ts
 * @see documentation/subscription-payment-gaps-analysis.md
 */
export class PromoCodeProcessor {
    private static instance: PromoCodeProcessor;
    
    private constructor() {
        console.log('📘 PromoCodeProcessor initialized');
    }
    
    public static getInstance(): PromoCodeProcessor {
        

 if (!PromoCodeProcessor.instance) {
            PromoCodeProcessor.instance = new PromoCodeProcessor();
        }
        return PromoCodeProcessor.instance;
    }
    
    /**
     * Create a new promo code
     * 
     * @param params - Promo code creation parameters
     * @returns Created promo code
     */
    async createPromoCode(params: ICreatePromoCodeParams): Promise<DRAPromoCode> {
        const manager = AppDataSource.manager;
        
        // Validate code format (uppercase, alphanumeric + hyphens)
        const codeUpper = params.code.toUpperCase();
        if (!/^[A-Z0-9-]+$/.test(codeUpper)) {
            throw new Error('Promo code must contain only letters, numbers, and hyphens');
        }
        
        // Check if code already exists
        const existing = await manager.findOne(DRAPromoCode, {
            where: { code: codeUpper }
        });
        
        if (existing) {
            throw new Error('A promo code with this code already exists');
        }
        
        // Validate discount type specific fields
        if (params.discountType === EDiscountType.PERCENTAGE) {
            if (!params.discountValue || params.discountValue < 1 || params.discountValue > 100) {
                throw new Error('Percentage discount must be between 1 and 100');
            }
        }
        
        if (params.discountType === EDiscountType.FIXED_AMOUNT) {
            if (!params.discountValue || params.discountValue <= 0) {
                throw new Error('Fixed amount discount must be greater than 0');
            }
        }
        
        if (params.discountType === EDiscountType.FREE_TRIAL) {
            if (!params.discountDurationMonths || params.discountDurationMonths <= 0) {
                throw new Error('Free trial duration must be specified');
            }
        }
        
        if (params.discountType === EDiscountType.UPGRADED_TIER) {
            if (!params.upgradedTierId) {
                throw new Error('Upgraded tier must be specified for upgraded_tier discount type');
            }
            if (!params.upgradedTierDurationMonths || params.upgradedTierDurationMonths <= 0) {
                throw new Error('Upgraded tier duration must be specified');
            }
        }
        
        // Create promo code in DB first so we get its ID
        const promoCode = manager.create(DRAPromoCode, {
            code: codeUpper,
            discount_type: params.discountType,
            discount_value: params.discountValue || null,
            discount_duration_months: params.discountDurationMonths || null,
            upgraded_tier_id: params.upgradedTierId || null,
            upgraded_tier_duration_months: params.upgradedTierDurationMonths || null,
            valid_from: params.validFrom || new Date(),
            valid_until: params.validUntil || null,
            is_active: true,
            max_uses: params.maxUses || null,
            max_uses_per_user: params.maxUsesPerUser || 1,
            current_uses: 0,
            applicable_tiers: params.applicableTiers || null,
            applicable_users: params.applicableUsers || null,
            email_domain_restriction: params.emailDomainRestriction || null,
            new_users_only: params.newUsersOnly || false,
            created_by: params.createdBy,
            description: params.description || null,
            campaign_name: params.campaignName || null,
            paddle_discount_id: params.paddleDiscountId || null
        });

        // For percentage and fixed-amount types, also create in Paddle
        if (this.isPaddleCompatibleType(params.discountType) && !params.paddleDiscountId) {
            try {
                const { recur, maximumRecurringIntervals } = this.toPaddleRecur(params.discountDurationMonths || null);
                const paddleType = params.discountType === EDiscountType.PERCENTAGE ? 'percentage' : 'flat';
                const amount = this.toPaddleAmount(params.discountType, params.discountValue || 0);

                const paddleDiscountId = await PaddleService.getInstance().createDiscount({
                    type: paddleType,
                    amount,
                    code: codeUpper,
                    recur,
                    maximumRecurringIntervals,
                    usageLimit: params.maxUses || null,
                    expiresAt: params.validUntil ? params.validUntil.toISOString() : null,
                    description: params.description || params.campaignName || codeUpper
                });
                promoCode.paddle_discount_id = paddleDiscountId;
            } catch (paddleError: any) {
                console.error('[PromoCodeProcessor] Failed to create Paddle discount:', paddleError);
                throw new Error(`Failed to create Paddle discount: ${paddleError.message}`);
            }
        }

        return await manager.save(promoCode);
    }

    // ─── Paddle helpers ───────────────────────────────────────────────────────

    /** Returns true for discount types that can be represented in Paddle.
     *  FREE_TRIAL and UPGRADED_TIER are DRA-only and never synced to Paddle. */
    private isPaddleCompatibleType(discountType: EDiscountType): boolean {
        return discountType === EDiscountType.PERCENTAGE || discountType === EDiscountType.FIXED_AMOUNT;
    }

    /** Map DRA discount value + type to the Paddle `amount` string. */
    private toPaddleAmount(discountType: EDiscountType, discountValue: number): string {
        if (discountType === EDiscountType.PERCENTAGE) {
            return String(Math.round(discountValue)); // e.g. "10" for 10%
        }
        return String(Math.round(discountValue * 100)); // cents, e.g. "1000" for $10
    }

    /** Map DRA duration semantics to Paddle recur params.
     *  Paddle subscription discounts require recur: true, so null ("apply once")
     *  maps to maximumRecurringIntervals: 1 (one billing period). */
    private toPaddleRecur(durationMonths: number | null | undefined): { recur: boolean; maximumRecurringIntervals: number | null } {
        if (durationMonths === -1) {
            return { recur: true, maximumRecurringIntervals: null }; // forever
        }
        if (durationMonths == null) {
            return { recur: true, maximumRecurringIntervals: 1 }; // one billing period
        }
        return { recur: true, maximumRecurringIntervals: durationMonths };
    }

    /**
     * Update promo code
     * 
     * @param params - Update parameters
     * @returns Updated promo code
     */
    async updatePromoCode(params: IUpdatePromoCodeParams): Promise<DRAPromoCode> {
        const manager = AppDataSource.manager;
        
        const promoCode = await manager.findOneOrFail(DRAPromoCode, {
            where: { id: params.id }
        });
        
        // Update allowed fields
        if (params.isActive !== undefined) {
            promoCode.is_active = params.isActive;
        }
        
        if (params.validUntil !== undefined) {
            promoCode.valid_until = params.validUntil;
        }
        
        if (params.maxUses !== undefined) {
            promoCode.max_uses = params.maxUses;
        }
        
        if (params.description !== undefined) {
            promoCode.description = params.description;
        }

        if (params.discountValue !== undefined) {
            if (promoCode.discount_type === EDiscountType.PERCENTAGE) {
                if (params.discountValue < 1 || params.discountValue > 100) {
                    throw new Error('Percentage discount must be between 1 and 100');
                }
            }
            
            if (promoCode.discount_type === EDiscountType.FIXED_AMOUNT) {
                if (params.discountValue <= 0) {
                    throw new Error('Fixed amount discount must be greater than 0');
                }
            }

            promoCode.discount_value = params.discountValue;
        }

        if (params.paddleDiscountId !== undefined) {
            promoCode.paddle_discount_id = params.paddleDiscountId;
        }

        // Sync mutable fields to Paddle if this code has a Paddle discount
        if (promoCode.paddle_discount_id && this.isPaddleCompatibleType(promoCode.discount_type)) {
            try {
                const paddleUpdates: any = {};

                if (params.discountValue !== undefined) {
                    paddleUpdates.amount = this.toPaddleAmount(promoCode.discount_type, params.discountValue);
                }
                if (params.validUntil !== undefined) {
                    paddleUpdates.expiresAt = params.validUntil ? params.validUntil.toISOString() : null;
                }
                if (params.maxUses !== undefined) {
                    paddleUpdates.usageLimit = params.maxUses ?? null;
                }
                if (params.isActive !== undefined) {
                    paddleUpdates.status = params.isActive ? 'active' : 'archived';
                }

                if (Object.keys(paddleUpdates).length > 0) {
                    await PaddleService.getInstance().updateDiscount(promoCode.paddle_discount_id, paddleUpdates);
                }
            } catch (paddleError: any) {
                console.error('[PromoCodeProcessor] Failed to update Paddle discount:', paddleError);
                throw new Error(`Failed to update Paddle discount: ${paddleError.message}`);
            }
        }

        return await manager.save(promoCode);
    }
    
    /**
     * Deactivate promo code
     * 
     * @param id - Promo code ID
     */
    async deactivatePromoCode(id: number): Promise<void> {
        const manager = AppDataSource.manager;
        const promoCode = await manager.findOne(DRAPromoCode, { where: { id } });
        if (promoCode?.paddle_discount_id) {
            try {
                await PaddleService.getInstance().updateDiscount(promoCode.paddle_discount_id, { status: 'archived' });
            } catch (err: any) {
                console.error('[PromoCodeProcessor] Failed to archive Paddle discount:', err);
            }
        }
        await manager.update(DRAPromoCode, { id }, { is_active: false });
    }
    
    /**
     * Activate promo code
     * 
     * @param id - Promo code ID
     */
    async activatePromoCode(id: number): Promise<void> {
        const manager = AppDataSource.manager;
        const promoCode = await manager.findOne(DRAPromoCode, { where: { id } });
        if (promoCode?.paddle_discount_id) {
            try {
                await PaddleService.getInstance().updateDiscount(promoCode.paddle_discount_id, { status: 'active' });
            } catch (err: any) {
                console.error('[PromoCodeProcessor] Failed to reactivate Paddle discount:', err);
            }
        }
        await manager.update(DRAPromoCode, { id }, { is_active: true });
    }
    
    /**
     * Get all promo codes with optional filtering
     * 
     * @param filters - Optional filters
     * @returns Array of promo codes
     */
    async getAllPromoCodes(filters?: {
        isActive?: boolean;
        campaignName?: string;
        validNow?: boolean;
    }): Promise<DRAPromoCode[]> {
        const manager = AppDataSource.manager;
        
        const queryBuilder = manager.createQueryBuilder(DRAPromoCode, 'promo')
            .leftJoinAndSelect('promo.upgraded_tier', 'upgraded_tier')
            .leftJoinAndSelect('promo.creator', 'creator')
            .orderBy('promo.created_at', 'DESC');
        
        if (filters?.isActive !== undefined) {
            queryBuilder.andWhere('promo.is_active = :isActive', { isActive: filters.isActive });
        }
        
        if (filters?.campaignName) {
            queryBuilder.andWhere('promo.campaign_name = :campaignName', { campaignName: filters.campaignName });
        }
        
        if (filters?.validNow) {
            const now = new Date();
            queryBuilder
                .andWhere('promo.valid_from <= :now', { now })
                .andWhere('(promo.valid_until IS NULL OR promo.valid_until >= :now)', { now });
        }
        
        return await queryBuilder.getMany();
    }
    
    /**
     * Get promo code by ID
     * 
     * @param id - Promo code ID
     * @returns Promo code with relations
     */
    async getPromoCodeById(id: number): Promise<DRAPromoCode> {
        const manager = AppDataSource.manager;
        
        return await manager.findOneOrFail(DRAPromoCode, {
            where: { id },
            relations: ['upgraded_tier', 'creator']
        });
    }
    
    /**
     * Get promo code by code string
     * 
     * @param code - Promo code string
     * @returns Promo code with relations
     */
    async getPromoCodeByCode(code: string): Promise<DRAPromoCode | null> {
        const manager = AppDataSource.manager;
        
        return await manager.findOne(DRAPromoCode, {
            where: { code: code.toUpperCase() },
            relations: ['upgraded_tier']
        });
    }
    
    /**
     * Validate promo code for user
     * 
     * Delegates to PromoCodeService
     */
    async validatePromoCode(
        code: string,
        userId: number,
        tierId: number,
        billingCycle: 'monthly' | 'annual' = 'monthly'
    ) {
        const service = PromoCodeService.getInstance();
        return await service.validatePromoCode(code, userId, tierId, billingCycle);
    }
    
    /**
     * Get promo code analytics
     * 
     * @param id - Promo code ID
     * @returns Analytics data
     */
    async getPromoCodeAnalytics(id: number) {
        const service = PromoCodeService.getInstance();
        return await service.getPromoCodeAnalytics(id);
    }
    
    /**
     * Get redemptions for a promo code
     * 
     * @param promoCodeId - Promo code ID
     * @param limit - Maximum number of redemptions to return
     * @returns Array of redemptions
     */
    async getRedemptions(promoCodeId: number, limit: number = 100) {
        const manager = AppDataSource.manager;
        
        const redemptions = await manager.find(DRAPromoCodeRedemption, {
            where: { promo_code_id: promoCodeId },
            relations: ['user', 'organization'],
            order: { redeemed_at: 'DESC' },
            take: limit
        });
        
        // Transform to include user_email and organization_name at top level
        return redemptions.map(r => ({
            id: r.id,
            user_email: r.user?.email || 'Unknown',
            organization_name: r.organization?.name || null,
            discount_applied: parseFloat(r.discount_applied.toString()),
            original_price: parseFloat(r.original_price.toString()),
            final_price: parseFloat(r.final_price.toString()),
            status: r.status,
            redeemed_at: r.redeemed_at.toISOString()
        }));
    }
    
    /**
     * Delete promo code
     * 
     * Note: This will cascade delete all redemptions
     * 
     * @param id - Promo code ID
     */
    async deletePromoCode(id: number): Promise<void> {
        const manager = AppDataSource.manager;

        // Check if code has been used
        const redemptionCount = await manager.count(DRAPromoCodeRedemption, {
            where: { promo_code_id: id }
        });

        if (redemptionCount > 0) {
            throw new Error('Cannot delete a promo code that has been redeemed. Deactivate it instead.');
        }

        // Archive in Paddle before removing from DB
        const promoCode = await manager.findOne(DRAPromoCode, { where: { id } });
        if (promoCode?.paddle_discount_id) {
            try {
                await PaddleService.getInstance().archiveDiscount(promoCode.paddle_discount_id);
            } catch (err: any) {
                console.error('[PromoCodeProcessor] Failed to archive Paddle discount on delete:', err);
            }
        }

        await manager.delete(DRAPromoCode, { id });
    }
    
    /**
     * Get active campaigns
     * 
     * @returns Array of campaign names with stats
     */
    async getActiveCampaigns(): Promise<Array<{
        campaignName: string;
        codeCount: number;
        totalRedemptions: number;
    }>> {
        const manager = AppDataSource.manager;
        
        const campaigns = await manager
            .createQueryBuilder(DRAPromoCode, 'promo')
            .select('promo.campaign_name', 'campaignName')
            .addSelect('COUNT(DISTINCT promo.id)', 'codeCount')
            .addSelect('SUM(promo.current_uses)', 'totalRedemptions')
            .where('promo.campaign_name IS NOT NULL')
            .andWhere('promo.is_active = true')
            .groupBy('promo.campaign_name')
            .orderBy('SUM(promo.current_uses)', 'DESC')
            .getRawMany();
        
        return campaigns.map(c => ({
            campaignName: c.campaignName,
            codeCount: parseInt(c.codeCount),
            totalRedemptions: parseInt(c.totalRedemptions || '0')
        }));
    }
}
