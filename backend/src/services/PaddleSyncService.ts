import { Paddle } from '@paddle/paddle-node-sdk';
import { AppDataSource } from '../datasources/PostgresDS.js';
import { DRASubscriptionTier } from '../models/DRASubscriptionTier.js';
import { DRAOrganizationSubscription } from '../models/DRAOrganizationSubscription.js';
import { DRAPromoCode, EDiscountType } from '../models/DRAPromoCode.js';

export interface ITierSyncResult {
    tier_name: string;
    paddle_product_id: string;
    action: 'created' | 'updated' | 'unchanged';
    orgs_migrated?: number;
    old_tier_id?: number;
    new_tier_id?: number;
}

export interface IDiscountSyncResult {
    code: string;
    paddle_discount_id: string;
    action: 'created' | 'updated' | 'unchanged' | 'skipped';
    reason?: string;
}

export interface IPaddleSyncResults {
    tiers: ITierSyncResult[];
    discounts: IDiscountSyncResult[];
    errors: string[];
    synced_at: string;
}

export class PaddleSyncService {
    private static instance: PaddleSyncService;

    private constructor() {
        console.log('📘 PaddleSyncService initialized');
    }

    public static getInstance(): PaddleSyncService {
        if (!PaddleSyncService.instance) {
            PaddleSyncService.instance = new PaddleSyncService();
        }
        return PaddleSyncService.instance;
    }

    /**
     * Run a full sync: tiers (products + prices) and discounts from Paddle into DRA.
     */
    async sync(paddle: Paddle): Promise<IPaddleSyncResults> {
        const results: IPaddleSyncResults = {
            tiers: [],
            discounts: [],
            errors: [],
            synced_at: new Date().toISOString()
        };

        try {
            const tierResults = await this.syncTiers(paddle);
            results.tiers = tierResults;
        } catch (err: any) {
            console.error('[PaddleSyncService] syncTiers error:', err);
            results.errors.push(`Tier sync failed: ${err.message}`);
        }

        try {
            const discountResults = await this.syncDiscounts(paddle);
            results.discounts = discountResults;
        } catch (err: any) {
            console.error('[PaddleSyncService] syncDiscounts error:', err);
            results.errors.push(`Discount sync failed: ${err.message}`);
        }

        console.log(`[PaddleSyncService] Sync complete. Tiers: ${results.tiers.length}, Discounts: ${results.discounts.length}, Errors: ${results.errors.length}`);
        return results;
    }

    // ─── Tier sync ───────────────────────────────────────────────────────────

    private async syncTiers(paddle: Paddle): Promise<ITierSyncResult[]> {
        const manager = AppDataSource.manager;
        const results: ITierSyncResult[] = [];

        // Load all existing tiers that have a paddle_product_id (previously synced or manually linked)
        const existingTiers = await manager.find(DRASubscriptionTier, {
            where: {}
        });
        const tiersByProductId = new Map<string, DRASubscriptionTier>();
        for (const tier of existingTiers) {
            if (tier.paddle_product_id) {
                // Only keep the active one per product; if multiple exist (due to versioning), take the active one
                if (tier.is_active || !tiersByProductId.has(tier.paddle_product_id)) {
                    tiersByProductId.set(tier.paddle_product_id, tier);
                }
            }
        }

        // Fetch all active products from Paddle
        const paddleProducts: any[] = [];
        for await (const product of paddle.products.list({ status: ['active'] })) {
            paddleProducts.push(product);
        }
        console.log(`[PaddleSyncService] Found ${paddleProducts.length} active Paddle products`);

        for (const product of paddleProducts) {
            try {
                const tierResult = await this.syncSingleTier(paddle, product, tiersByProductId, manager);
                if (tierResult) results.push(tierResult);
            } catch (err: any) {
                console.error(`[PaddleSyncService] Error syncing product ${product.id}:`, err);
                results.push({
                    tier_name: product.name || product.id,
                    paddle_product_id: product.id,
                    action: 'unchanged',
                } as ITierSyncResult);
            }
        }

        return results;
    }

    private async syncSingleTier(
        paddle: Paddle,
        product: any,
        tiersByProductId: Map<string, DRASubscriptionTier>,
        manager: typeof AppDataSource.manager
    ): Promise<ITierSyncResult | null> {
        // Fetch prices for this product
        const prices: any[] = [];
        for await (const price of paddle.prices.list({ productId: product.id, status: ['active'] })) {
            prices.push(price);
        }

        // Identify monthly and annual USD prices based on billing cycle
        let monthlyPrice: any = null;
        let annualPrice: any = null;

        for (const price of prices) {
            if (!price.billingCycle) continue; // skip one-time prices
            if (price.unitPrice?.currencyCode !== 'USD') continue; // only USD
            if (price.billingCycle.interval === 'month' && price.billingCycle.frequency === 1) {
                monthlyPrice = price;
            } else if (price.billingCycle.interval === 'year' && price.billingCycle.frequency === 1) {
                annualPrice = price;
            }
        }

        if (!monthlyPrice) {
            console.log(`[PaddleSyncService] Product ${product.id} (${product.name}) has no active USD monthly price, skipping`);
            return null;
        }

        const priceMonthlyUsd = parseFloat(monthlyPrice.unitPrice.amount) / 100;
        const priceAnnualUsd = annualPrice ? parseFloat(annualPrice.unitPrice.amount) / 100 : null;
        const paddlePriceIdMonthly = monthlyPrice.id as string;
        const paddlePriceIdAnnual = annualPrice ? (annualPrice.id as string) : null;
        const tierName = (product.name as string) || product.id;

        const existingTier = tiersByProductId.get(product.id);

        if (!existingTier) {
            // New product in Paddle — create a new DRA tier
            const newTier = manager.create(DRASubscriptionTier, {
                tier_name: tierName,
                paddle_product_id: product.id,
                paddle_price_id_monthly: paddlePriceIdMonthly,
                paddle_price_id_annual: paddlePriceIdAnnual,
                price_per_month_usd: priceMonthlyUsd,
                price_per_year_usd: priceAnnualUsd,
                is_active: true,
                // Default limits: -1 means unlimited; admin should update these after sync
                max_rows_per_data_model: -1,
                max_projects: null,
                max_data_sources_per_project: null,
                max_data_models_per_data_source: null,
                max_dashboards: null,
                max_members_per_project: null,
                ai_generations_per_month: null
            });
            const savedTier = await manager.save(newTier);
            console.log(`[PaddleSyncService] Created new tier: ${tierName} (id=${savedTier.id})`);
            return {
                tier_name: tierName,
                paddle_product_id: product.id,
                action: 'created',
                new_tier_id: savedTier.id
            };
        }

        // Existing tier — check for changes
        const hasChanged =
            existingTier.paddle_price_id_monthly !== paddlePriceIdMonthly ||
            existingTier.paddle_price_id_annual !== paddlePriceIdAnnual ||
            Math.abs(parseFloat(String(existingTier.price_per_month_usd)) - priceMonthlyUsd) > 0.001 ||
            (priceAnnualUsd !== null && existingTier.price_per_year_usd !== null &&
                Math.abs(parseFloat(String(existingTier.price_per_year_usd)) - priceAnnualUsd) > 0.001) ||
            (priceAnnualUsd === null) !== (existingTier.price_per_year_usd === null);

        if (!hasChanged) {
            // Also update name if Paddle product name changed in place (non-structural change)
            if (existingTier.tier_name !== tierName) {
                existingTier.tier_name = tierName;
                await manager.save(existingTier);
            }
            return {
                tier_name: tierName,
                paddle_product_id: product.id,
                action: 'unchanged'
            };
        }

        // Prices changed: retire old tier, create new tier, migrate org subscriptions
        // Step 1: Rename old tier to free up the unique tier_name
        const retireSuffix = ` (R${existingTier.id})`;
        const retiredName = existingTier.tier_name.substring(0, 50 - retireSuffix.length) + retireSuffix;
        existingTier.tier_name = retiredName;
        existingTier.is_active = false;
        await manager.save(existingTier);

        // Step 2: Create new tier, inheriting limit fields from the old tier
        const newTier = manager.create(DRASubscriptionTier, {
            tier_name: tierName,
            paddle_product_id: product.id,
            paddle_price_id_monthly: paddlePriceIdMonthly,
            paddle_price_id_annual: paddlePriceIdAnnual,
            price_per_month_usd: priceMonthlyUsd,
            price_per_year_usd: priceAnnualUsd,
            is_active: true,
            // Inherit limit fields from the retired tier so admin doesn't lose settings
            max_rows_per_data_model: existingTier.max_rows_per_data_model,
            max_projects: existingTier.max_projects,
            max_data_sources_per_project: existingTier.max_data_sources_per_project,
            max_data_models_per_data_source: existingTier.max_data_models_per_data_source,
            max_dashboards: existingTier.max_dashboards,
            max_members_per_project: existingTier.max_members_per_project,
            ai_generations_per_month: existingTier.ai_generations_per_month
        });
        const savedNewTier = await manager.save(newTier);

        // Step 3: Migrate all org subscriptions to the new tier
        const migrateResult = await manager.createQueryBuilder()
            .update(DRAOrganizationSubscription)
            .set({ subscription_tier_id: savedNewTier.id })
            .where('subscription_tier_id = :oldId', { oldId: existingTier.id })
            .execute();
        const orgsMigrated = migrateResult.affected || 0;

        console.log(`[PaddleSyncService] Tier "${tierName}" updated: old id=${existingTier.id} → new id=${savedNewTier.id}, ${orgsMigrated} orgs migrated`);

        return {
            tier_name: tierName,
            paddle_product_id: product.id,
            action: 'updated',
            old_tier_id: existingTier.id,
            new_tier_id: savedNewTier.id,
            orgs_migrated: orgsMigrated
        };
    }

    // ─── Discount sync ───────────────────────────────────────────────────────

    private async syncDiscounts(paddle: Paddle): Promise<IDiscountSyncResult[]> {
        const manager = AppDataSource.manager;
        const results: IDiscountSyncResult[] = [];

        // Load all existing promo codes that have a paddle_discount_id
        const existingCodes = await manager.find(DRAPromoCode, { where: {} });
        const codesByPaddleId = new Map<string, DRAPromoCode>();
        for (const code of existingCodes) {
            if (code.paddle_discount_id) {
                codesByPaddleId.set(code.paddle_discount_id, code);
            }
        }

        // Fetch all active discounts from Paddle
        const paddleDiscounts: any[] = [];
        for await (const discount of paddle.discounts.list({ status: ['active'] })) {
            paddleDiscounts.push(discount);
        }
        console.log(`[PaddleSyncService] Found ${paddleDiscounts.length} active Paddle discounts`);

        for (const discount of paddleDiscounts) {
            try {
                const result = await this.syncSingleDiscount(discount, codesByPaddleId, manager);
                if (result) results.push(result);
            } catch (err: any) {
                console.error(`[PaddleSyncService] Error syncing discount ${discount.id}:`, err);
                results.push({
                    code: discount.code || discount.id,
                    paddle_discount_id: discount.id,
                    action: 'skipped',
                    reason: err.message
                });
            }
        }

        return results;
    }

    private async syncSingleDiscount(
        discount: any,
        codesByPaddleId: Map<string, DRAPromoCode>,
        manager: typeof AppDataSource.manager
    ): Promise<IDiscountSyncResult | null> {
        const discountType = this.mapDiscountType(discount.type);
        if (!discountType) {
            return {
                code: discount.code || discount.id,
                paddle_discount_id: discount.id,
                action: 'skipped',
                reason: `Unsupported Paddle discount type: ${discount.type}`
            };
        }

        const discountValue = this.mapDiscountValue(discount.type, discount.amount);
        const durationMonths = this.mapDurationMonths(discount.recur, discount.maximumRecurringIntervals);
        const validUntil = discount.expiresAt ? new Date(discount.expiresAt) : null;
        const isActive = discount.status === 'active';
        const code = discount.code || discount.id; // Fall back to ID if no promo code

        const existingCode = codesByPaddleId.get(discount.id);

        if (!existingCode) {
            // New discount: create promo code with Paddle data; DRA-only fields left null
            const newCode = manager.create(DRAPromoCode, {
                paddle_discount_id: discount.id,
                code,
                discount_type: discountType,
                discount_value: discountValue,
                discount_duration_months: durationMonths,
                valid_until: validUntil,
                is_active: isActive,
                max_uses: discount.usageLimit ?? null,
                current_uses: discount.timesUsed ?? 0,
                description: discount.description ?? null,
                // DRA-only fields: null until admin fills them in
                max_uses_per_user: 1,
                new_users_only: false,
                applicable_tiers: null,
                applicable_users: null,
                email_domain_restriction: null,
                upgraded_tier_id: null,
                upgraded_tier_duration_months: null,
                campaign_name: null,
                created_by: null
            });

            try {
                await manager.save(newCode);
                console.log(`[PaddleSyncService] Created promo code: ${code} (paddle_id=${discount.id})`);
                return { code, paddle_discount_id: discount.id, action: 'created' };
            } catch (err: any) {
                // Likely unique constraint violation on `code`
                return {
                    code,
                    paddle_discount_id: discount.id,
                    action: 'skipped',
                    reason: `Code already exists with different paddle_discount_id: ${err.message}`
                };
            }
        }

        // Existing promo code: check if Paddle-sourced fields changed
        const hasChanged =
            existingCode.code !== code ||
            existingCode.discount_type !== discountType ||
            Math.abs((parseFloat(String(existingCode.discount_value ?? 0)) - discountValue)) > 0.001 ||
            existingCode.discount_duration_months !== durationMonths ||
            existingCode.is_active !== isActive ||
            existingCode.max_uses !== (discount.usageLimit ?? null) ||
            (existingCode.valid_until?.toISOString() ?? null) !== validUntil?.toISOString();

        if (!hasChanged) {
            // Still update current_uses (usage count may have changed without affecting other fields)
            if (existingCode.current_uses !== (discount.timesUsed ?? 0)) {
                existingCode.current_uses = discount.timesUsed ?? 0;
                await manager.save(existingCode);
            }
            return { code, paddle_discount_id: discount.id, action: 'unchanged' };
        }

        // Update Paddle-sourced fields, preserve DRA-only fields
        existingCode.code = code;
        existingCode.discount_type = discountType;
        existingCode.discount_value = discountValue;
        existingCode.discount_duration_months = durationMonths;
        existingCode.valid_until = validUntil;
        existingCode.is_active = isActive;
        existingCode.max_uses = discount.usageLimit ?? null;
        existingCode.current_uses = discount.timesUsed ?? 0;
        existingCode.description = discount.description ?? existingCode.description;

        await manager.save(existingCode);
        console.log(`[PaddleSyncService] Updated promo code: ${code} (paddle_id=${discount.id})`);
        return { code, paddle_discount_id: discount.id, action: 'updated' };
    }

    // ─── Helpers ─────────────────────────────────────────────────────────────

    private mapDiscountType(paddleType: string): EDiscountType | null {
        switch (paddleType) {
            case 'percentage':
                return EDiscountType.PERCENTAGE;
            case 'flat':
            case 'flat_per_seat':
                return EDiscountType.FIXED_AMOUNT;
            default:
                return null;
        }
    }

    private mapDiscountValue(paddleType: string, amount: string): number {
        const raw = parseFloat(amount);
        if (paddleType === 'percentage') {
            return raw; // e.g. "10" → 10 (representing 10%)
        }
        // flat / flat_per_seat: Paddle returns smallest currency unit (cents for USD)
        return raw / 100; // e.g. "1000" → 10.00
    }

    private mapDurationMonths(recur: boolean, maximumRecurringIntervals: number | null): number | null {
        if (!recur) return null; // apply once
        if (maximumRecurringIntervals === null) return -1; // forever
        return maximumRecurringIntervals; // e.g. 3 months
    }
}
