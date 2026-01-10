import { DBDriver } from "../drivers/DBDriver.js";
import { EDataSourceType } from "../types/EDataSourceType.js";
import { DRAUserSubscription } from "../models/DRAUserSubscription.js";
import { DRAUsersPlatform } from "../models/DRAUsersPlatform.js";
import { ESubscriptionTier, DRASubscriptionTier } from "../models/DRASubscriptionTier.js";

export interface IUsageStats {
    tier: ESubscriptionTier;
    rowLimit: number;
    projectCount: number;
    maxProjects: number | null;
    dataSourceCount: number;
    maxDataSources: number | null;
    dashboardCount: number;
    maxDashboards: number | null;
    aiGenerationsPerMonth: number | null;
}

export class RowLimitService {
    private static instance: RowLimitService;
    
    private constructor() {}
    
    public static getInstance(): RowLimitService {
        if (!RowLimitService.instance) {
            RowLimitService.instance = new RowLimitService();
        }
        return RowLimitService.instance;
    }
    
    /**
     * Get user's current subscription tier
     * Always fetches from database - NO CACHING
     */
    async getUserTier(userId: number): Promise<ESubscriptionTier> {
        const driver = await DBDriver.getInstance().getDriver(EDataSourceType.POSTGRESQL);
        if (!driver) {
            console.error('PostgreSQL driver not available - defaulting to FREE tier');
            return ESubscriptionTier.FREE;
        }
        
        const concreteDriver = await driver.getConcreteDriver();
        if (!concreteDriver) {
            console.error('Failed to get PostgreSQL connection - defaulting to FREE tier');
            return ESubscriptionTier.FREE;
        }
        
        const manager = concreteDriver.manager;
        if (!manager) {
            console.error('Database manager not available - defaulting to FREE tier');
            return ESubscriptionTier.FREE;
        }
        
        const subscription = await manager.findOne(DRAUserSubscription, {
            where: {
                users_platform: { id: userId },
                is_active: true
            },
            relations: ['subscription_tier'],
            order: {
                started_at: 'DESC' // Get most recent
            }
        });
        
        if (!subscription) {
            // Auto-assign free tier for users without subscription
            await this.assignFreeTier(userId);
            return ESubscriptionTier.FREE;
        }
        
        return subscription.subscription_tier.tier_name;
    }
    
    /**
     * Get row limit for user's current tier
     * Always fetches from database - NO CACHING for real-time updates
     */
    async getRowLimit(userId: number): Promise<number> {
        const driver = await DBDriver.getInstance().getDriver(EDataSourceType.POSTGRESQL);
        if (!driver) {
            console.error('PostgreSQL driver not available - defaulting to FREE tier limit');
            return 100000; // Default to free tier limit
        }
        
        const concreteDriver = await driver.getConcreteDriver();
        if (!concreteDriver) {
            console.error('Failed to get PostgreSQL connection - defaulting to FREE tier limit');
            return 100000;
        }
        
        const manager = concreteDriver.manager;
        if (!manager) {
            console.error('Database manager not available - defaulting to FREE tier limit');
            return 100000;
        }
        
        const subscription = await manager.findOne(DRAUserSubscription, {
            where: {
                users_platform: { id: userId },
                is_active: true
            },
            relations: ['subscription_tier'],
            order: {
                started_at: 'DESC'
            }
        });
        
        if (!subscription) {
            // Auto-assign free tier
            await this.assignFreeTier(userId);
            return 100000; // Default FREE tier limit
        }
        
        // CRITICAL: Always read from database for real-time admin updates
        return Number(subscription.subscription_tier.max_rows_per_data_model);
    }
    
    /**
     * Check if row count exceeds user's limit
     */
    async exceedsLimit(userId: number, rowCount: number): Promise<boolean> {
        const limit = await this.getRowLimit(userId);
        
        // -1 means unlimited (enterprise)
        if (limit === -1) {
            return false;
        }
        
        return rowCount > limit;
    }
    
    /**
     * Apply row limit to SQL query
     * CRITICAL: Fetches limit from database on each call for real-time enforcement
     */
    async applyLimitToQuery(userId: number, query: string): Promise<string> {
        const limit = await this.getRowLimit(userId);
        
        // Don't modify if unlimited
        if (limit === -1) {
            return query;
        }
        
        // Remove trailing whitespace and semicolons
        query = query.trim().replace(/;+$/, '');
        
        // Check if query already has LIMIT clause (case-insensitive)
        const limitRegex = /\bLIMIT\s+(\d+)\s*$/i;
        const match = query.match(limitRegex);
        
        if (match) {
            // Replace existing LIMIT with tier limit if it's higher
            const existingLimit = parseInt(match[1]);
            const effectiveLimit = Math.min(existingLimit, limit);
            return query.replace(limitRegex, `LIMIT ${effectiveLimit}`);
        }
        
        // Add LIMIT clause
        return `${query} LIMIT ${limit}`;
    }
    
    /**
     * Assign free tier to user (for new users or users without subscription)
     */
    async assignFreeTier(userId: number): Promise<void> {
        const driver = await DBDriver.getInstance().getDriver(EDataSourceType.POSTGRESQL);
        if (!driver) {
            console.error('Cannot assign free tier - PostgreSQL driver not available');
            return;
        }
        
        const concreteDriver = await driver.getConcreteDriver();
        if (!concreteDriver) {
            console.error('Cannot assign free tier - Failed to get PostgreSQL connection');
            return;
        }
        
        const manager = concreteDriver.manager;
        if (!manager) {
            console.error('Cannot assign free tier - Database manager not available');
            return;
        }
        
        // Check if user already has a subscription
        const existingSubscription = await manager.findOne(DRAUserSubscription, {
            where: {
                users_platform: { id: userId },
                is_active: true
            }
        });
        
        if (existingSubscription) {
            console.log(`User ${userId} already has an active subscription`);
            return;
        }
        
        const user = await manager.findOne(DRAUsersPlatform, { 
            where: { id: userId } 
        });
        
        if (!user) {
            console.error(`User ${userId} not found`);
            return;
        }
        
        const freeTier = await manager.findOne(DRASubscriptionTier, {
            where: { tier_name: ESubscriptionTier.FREE }
        });
        
        if (!freeTier) {
            console.error('FREE tier not found in database - run seeders');
            return;
        }
        
        const subscription = manager.create(DRAUserSubscription, {
            users_platform: user,
            subscription_tier: freeTier,
            started_at: new Date(),
            is_active: true
        });
        
        await manager.save(subscription);
        console.log(`✅ Assigned FREE tier to user ${userId}`);
    }
    
    /**
     * Get usage statistics for user
     */
    async getUsageStats(userId: number): Promise<IUsageStats> {
        const driver = await DBDriver.getInstance().getDriver(EDataSourceType.POSTGRESQL);
        if (!driver) {
            throw new Error('Database driver not available');
        }
        
        const concreteDriver = await driver.getConcreteDriver();
        if (!concreteDriver) {
            throw new Error('Failed to get PostgreSQL connection');
        }
        
        const manager = concreteDriver.manager;
        if (!manager) {
            throw new Error('Database manager not available');
        }
        
        const user = await manager.findOne(DRAUsersPlatform, {
            where: { id: userId },
            relations: ['projects', 'data_sources', 'dashboards']
        });
        
        if (!user) {
            throw new Error('User not found');
        }
        
        const tier = await this.getUserTier(userId);
        const rowLimit = await this.getRowLimit(userId);
        
        const subscription = await manager.findOne(DRAUserSubscription, {
            where: {
                users_platform: { id: userId },
                is_active: true
            },
            relations: ['subscription_tier'],
            order: {
                started_at: 'DESC'
            }
        });
        
        return {
            tier,
            rowLimit,
            projectCount: user.projects?.length || 0,
            maxProjects: subscription?.subscription_tier.max_projects || null,
            dataSourceCount: user.data_sources?.length || 0,
            maxDataSources: subscription?.subscription_tier.max_data_sources_per_project || null,
            dashboardCount: user.dashboards?.length || 0,
            maxDashboards: subscription?.subscription_tier.max_dashboards || null,
            aiGenerationsPerMonth: subscription?.subscription_tier.ai_generations_per_month || null
        };
    }
}
