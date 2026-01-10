import { DBDriver } from "../drivers/DBDriver.js";
import { EDataSourceType } from "../types/EDataSourceType.js";
import { DRASubscriptionTier, ESubscriptionTier } from "../models/DRASubscriptionTier.js";

export interface ISubscriptionTierData {
    tier_name: ESubscriptionTier;
    max_rows_per_data_model: number;
    max_projects: number | null;
    max_data_sources_per_project: number | null;
    max_dashboards: number | null;
    ai_generations_per_month: number | null;
    price_per_month_usd: number;
    is_active?: boolean;
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
            is_active: tierData.is_active !== undefined ? tierData.is_active : true
        });
        
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
        
        // Update fields
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
            relations: ['user_subscriptions']
        });
        
        if (!tier) {
            throw new Error(`Tier with ID ${id} not found`);
        }
        
        // Check if there are active subscriptions
        const activeSubscriptions = tier.user_subscriptions?.filter(sub => sub.is_active) || [];
        if (activeSubscriptions.length > 0) {
            throw new Error(`Cannot delete tier: ${activeSubscriptions.length} active subscriptions exist`);
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
        // Validate tier name
        if (!Object.values(ESubscriptionTier).includes(tierData.tier_name)) {
            throw new Error(`Invalid tier name: ${tierData.tier_name}`);
        }
        
        // Validate row limit (-1 for unlimited, or positive number)
        if (tierData.max_rows_per_data_model !== -1 && tierData.max_rows_per_data_model <= 0) {
            throw new Error('max_rows_per_data_model must be positive or -1 for unlimited');
        }
        
        // Validate price
        if (tierData.price_per_month_usd < 0) {
            throw new Error('price_per_month_usd cannot be negative');
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
            if (value !== null && value !== undefined && typeof value === 'number' && value <= 0) {
                throw new Error(`${field} must be positive or null`);
            }
        }
    }
}
