import { DBDriver } from "../drivers/DBDriver.js";
import { EDataSourceType } from "../types/EDataSourceType.js";
import { DRASubscriptionTier, ESubscriptionTier } from "../models/DRASubscriptionTier.js";
import { PaddleService } from "../services/PaddleService.js";

export interface ISubscriptionTierData {
    tier_name: string;
    max_rows_per_data_model: number;
    max_projects: number | null;
    max_data_sources_per_project: number | null;
    max_dashboards: number | null;
    ai_generations_per_month: number | null;
    price_per_month_usd: number;
    price_per_year_usd?: number | null;
    is_active?: boolean;
    // Paddle IDs are now auto-set by the processor — not accepted from external input
}

export class SubscriptionTierProcessor {
    private static instance: SubscriptionTierProcessor;
    
    private constructor() {}
    
    public static getInstance(): SubscriptionTierProcessor {
        if (!SubscriptionTierProcessor.instance) {
            SubscriptionTierProcessor.instance = new SubscriptionTierProcessor();
        }
        return SubscriptionTierProcessor.instance;
    }
    
    /**
     * Get all active subscription tiers
     */
    async getAllTiers(includeInactive: boolean = false): Promise<DRASubscriptionTier[]> {
        const driver = await DBDriver.getInstance().getDriver(EDataSourceType.POSTGRESQL);
        if (!driver) {
            throw new Error('PostgreSQL driver not available');
        }
        
        const concreteDriver = await driver.getConcreteDriver();
        if (!concreteDriver) {
            throw new Error('Failed to get PostgreSQL connection');
        }
        
        const manager = concreteDriver.manager;
        if (!manager) {
            throw new Error('Database manager not available');
        }
        
        const whereClause = includeInactive ? {} : { is_active: true };
        
        const tiers = await manager.find(DRASubscriptionTier, {
            where: whereClause,
            order: {
                max_rows_per_data_model: 'ASC'
            }
        });
        
        return tiers;
    }
    
    /**
     * Get subscription tier by ID
     */
    async getTierById(id: number): Promise<DRASubscriptionTier | null> {
        const driver = await DBDriver.getInstance().getDriver(EDataSourceType.POSTGRESQL);
        if (!driver) {
            throw new Error('PostgreSQL driver not available');
        }
        
        const concreteDriver = await driver.getConcreteDriver();
        if (!concreteDriver) {
            throw new Error('Failed to get PostgreSQL connection');
        }
        
        const manager = concreteDriver.manager;
        if (!manager) {
            throw new Error('Database manager not available');
        }
        
        const tier = await manager.findOne(DRASubscriptionTier, {
            where: { id }
        });
        
        return tier;
    }
    
    /**
     * Get subscription tier by name
     */
    async getTierByName(tierName: ESubscriptionTier): Promise<DRASubscriptionTier | null> {
        const driver = await DBDriver.getInstance().getDriver(EDataSourceType.POSTGRESQL);
        if (!driver) {
            throw new Error('PostgreSQL driver not available');
        }
        
        const concreteDriver = await driver.getConcreteDriver();
        if (!concreteDriver) {
            throw new Error('Failed to get PostgreSQL connection');
        }
        
        const manager = concreteDriver.manager;
        if (!manager) {
            throw new Error('Database manager not available');
        }
        
        const tier = await manager.findOne(DRASubscriptionTier, {
            where: { tier_name: tierName }
        });
        
        return tier;
    }
    
    /**
     * Create a new subscription tier
     */
    async createTier(tierData: ISubscriptionTierData): Promise<DRASubscriptionTier> {
        // Validate input
        this.validateTierData(tierData);
        
        const driver = await DBDriver.getInstance().getDriver(EDataSourceType.POSTGRESQL);
        if (!driver) {
            throw new Error('PostgreSQL driver not available');
        }
        
        const concreteDriver = await driver.getConcreteDriver();
        if (!concreteDriver) {
            throw new Error('Failed to get PostgreSQL connection');
        }
        
        const manager = concreteDriver.manager;
        if (!manager) {
            throw new Error('Database manager not available');
        }
        
        // Check if tier already exists
        const existing = await manager.findOne(DRASubscriptionTier, {
            where: { tier_name: tierData.tier_name }
        });
        
        if (existing) {
            throw new Error(`Tier ${tierData.tier_name} already exists`);
        }
        
        const tier = manager.create(DRASubscriptionTier, {
            ...tierData,
            is_active: tierData.is_active !== undefined ? tierData.is_active : true,
            paddle_product_id: null,
            paddle_price_id_monthly: null,
            paddle_price_id_annual: null
        });

        // Create Paddle product + prices for paid tiers
        const isPaidTier = tierData.price_per_month_usd > 0;
        if (isPaidTier) {
            let paddleProductId: string | null = null;
            try {
                const paddle = PaddleService.getInstance();
                paddleProductId = await paddle.createProduct(
                    tierData.tier_name,
                    `DRA ${tierData.tier_name} subscription tier`
                );
                tier.paddle_product_id = paddleProductId;

                const monthCents = Math.round(tierData.price_per_month_usd * 100);
                tier.paddle_price_id_monthly = await paddle.createPrice(
                    paddleProductId, monthCents, 'month', `${tierData.tier_name} — Monthly`
                );

                if (tierData.price_per_year_usd != null && tierData.price_per_year_usd > 0) {
                    const yearCents = Math.round(tierData.price_per_year_usd * 100);
                    tier.paddle_price_id_annual = await paddle.createPrice(
                        paddleProductId, yearCents, 'year', `${tierData.tier_name} — Annual`
                    );
                }
            } catch (paddleError: any) {
                // Roll back any partial Paddle assets before rethrowing
                if (paddleProductId) {
                    PaddleService.getInstance().archiveProduct(paddleProductId).catch(console.error);
                }
                throw new Error(`Failed to create Paddle assets for tier: ${paddleError.message}`);
            }
        }

        await manager.save(tier);
        return tier;
    }
    
    /**
     * Update an existing subscription tier
     */
    async updateTier(id: number, tierData: Partial<ISubscriptionTierData>): Promise<DRASubscriptionTier> {
        // Validate input if row limit is being updated
        if (tierData.max_rows_per_data_model !== undefined) {
            if (tierData.max_rows_per_data_model !== -1 && tierData.max_rows_per_data_model <= 0) {
                throw new Error('max_rows_per_data_model must be positive or -1 for unlimited');
            }
        }
        
        if (tierData.price_per_month_usd !== undefined && tierData.price_per_month_usd < 0) {
            throw new Error('price_per_month_usd cannot be negative');
        }
        
        if (tierData.price_per_year_usd !== undefined && tierData.price_per_year_usd !== null && tierData.price_per_year_usd < 0) {
            throw new Error('price_per_year_usd cannot be negative');
        }
        
        const driver = await DBDriver.getInstance().getDriver(EDataSourceType.POSTGRESQL);
        if (!driver) {
            throw new Error('PostgreSQL driver not available');
        }
        
        const concreteDriver = await driver.getConcreteDriver();
        if (!concreteDriver) {
            throw new Error('Failed to get PostgreSQL connection');
        }
        
        const manager = concreteDriver.manager;
        if (!manager) {
            throw new Error('Database manager not available');
        }
        
        const tier = await manager.findOne(DRASubscriptionTier, {
            where: { id }
        });

        if (!tier) {
            throw new Error(`Tier with ID ${id} not found`);
        }

        const paddle = PaddleService.getInstance();
        const hasPaddleProduct = !!tier.paddle_product_id;

        // Detect pricing changes (only relevant for paid tiers with Paddle assets)
        const newMonthlyPrice = tierData.price_per_month_usd;
        const newAnnualPrice = tierData.price_per_year_usd;
        const monthlyPriceChanged = newMonthlyPrice !== undefined &&
            Math.abs(parseFloat(String(tier.price_per_month_usd)) - newMonthlyPrice) > 0.001;
        const annualPriceChanged = newAnnualPrice !== undefined &&
            ((newAnnualPrice === null) !== (tier.price_per_year_usd === null) ||
             (newAnnualPrice !== null && tier.price_per_year_usd !== null &&
              Math.abs(parseFloat(String(tier.price_per_year_usd)) - newAnnualPrice) > 0.001));

        if (hasPaddleProduct && (monthlyPriceChanged || annualPriceChanged)) {
            // Archive old prices and create new ones
            if (monthlyPriceChanged && tier.paddle_price_id_monthly) {
                await paddle.archivePrice(tier.paddle_price_id_monthly);
                const cents = Math.round((newMonthlyPrice as number) * 100);
                tier.paddle_price_id_monthly = await paddle.createPrice(
                    tier.paddle_product_id!, cents, 'month', `${tier.tier_name} — Monthly`
                );
            }
            if (annualPriceChanged) {
                if (tier.paddle_price_id_annual) {
                    await paddle.archivePrice(tier.paddle_price_id_annual);
                }
                if (newAnnualPrice != null && newAnnualPrice > 0) {
                    const cents = Math.round(newAnnualPrice * 100);
                    tier.paddle_price_id_annual = await paddle.createPrice(
                        tier.paddle_product_id!, cents, 'year', `${tier.tier_name} — Annual`
                    );
                } else {
                    tier.paddle_price_id_annual = null;
                }
            }
        }

        // Sync name change to Paddle
        if (hasPaddleProduct && tierData.tier_name && tierData.tier_name !== tier.tier_name) {
            await paddle.updateProduct(tier.paddle_product_id!, tierData.tier_name);
        }

        // Apply all requested field updates (paddle ID fields already updated above)
        Object.assign(tier, tierData);

        await manager.save(tier);
        return tier;
    }
    
    /**
     * Soft delete (deactivate) a subscription tier
     */
    async deleteTier(id: number): Promise<boolean> {
        const driver = await DBDriver.getInstance().getDriver(EDataSourceType.POSTGRESQL);
        if (!driver) {
            throw new Error('PostgreSQL driver not available');
        }
        
        const concreteDriver = await driver.getConcreteDriver();
        if (!concreteDriver) {
            throw new Error('Failed to get PostgreSQL connection');
        }
        
        const manager = concreteDriver.manager;
        if (!manager) {
            throw new Error('Database manager not available');
        }
        
        const tier = await manager.findOne(DRASubscriptionTier, {
            where: { id },
            relations: ['organization_subscriptions']
        });
        
        if (!tier) {
            throw new Error(`Tier with ID ${id} not found`);
        }
        
        // Check if there are active subscriptions
        const activeSubscriptions = tier.organization_subscriptions?.filter(sub => sub.is_active) || [];
        if (activeSubscriptions.length > 0) {
            throw new Error(`Cannot delete tier: ${activeSubscriptions.length} active subscriptions exist`);
        }
        
        // Archive in Paddle if assets exist
        if (tier.paddle_product_id) {
            try {
                await PaddleService.getInstance().archiveProduct(tier.paddle_product_id);
            } catch (paddleError: any) {
                console.error(`[SubscriptionTierProcessor] Failed to archive Paddle product ${tier.paddle_product_id}:`, paddleError);
                // Don't block deletion — log and continue
            }
        }

        // Soft delete by setting is_active to false
        tier.is_active = false;
        await manager.save(tier);
        return true;
    }
    
    /**
     * Validate tier data
     */
    private validateTierData(tierData: ISubscriptionTierData): void {
        // Validate tier name — any non-empty alphanumeric/underscore/hyphen/space string is allowed
        if (!tierData.tier_name || tierData.tier_name.trim() === '') {
            throw new Error('Tier name is required');
        }

        // Validate row limit (-1 for unlimited, or positive number)
        if (tierData.max_rows_per_data_model !== -1 && tierData.max_rows_per_data_model <= 0) {
            throw new Error('max_rows_per_data_model must be positive or -1 for unlimited');
        }
        
        // Validate price
        if (tierData.price_per_month_usd < 0) {
            throw new Error('price_per_month_usd cannot be negative');
        }
        
        if (tierData.price_per_year_usd !== undefined && tierData.price_per_year_usd !== null && tierData.price_per_year_usd < 0) {
            throw new Error('price_per_year_usd cannot be negative');
        }
        
        // Validate nullable number fields (if not null, must be positive)
        const nullableFields: (keyof ISubscriptionTierData)[] = [
            'max_projects',
            'max_data_sources_per_project',
            'max_dashboards',
            'ai_generations_per_month'
        ];
        
        for (const field of nullableFields) {
            const value = tierData[field];
            if (value !== null && value !== undefined && typeof value === 'number' && value !== -1 && value <= 0) {
                throw new Error(`${field} must be positive, -1 for unlimited, or null`);
            }
        }
    }
}
