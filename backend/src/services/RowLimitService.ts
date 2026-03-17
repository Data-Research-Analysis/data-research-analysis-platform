import { DBDriver } from "../drivers/DBDriver.js";
import { EDataSourceType } from "../types/EDataSourceType.js";
import { DRAUsersPlatform } from "../models/DRAUsersPlatform.js";
import { ESubscriptionTier } from "../models/DRASubscriptionTier.js";
import { OrganizationService } from "./OrganizationService.js";

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
     * Get user's current subscription tier via their personal organization.
     * Always fetches from database - NO CACHING
     */
    async getUserTier(userId: number): Promise<ESubscriptionTier> {
        try {
            const driver = await DBDriver.getInstance().getDriver(EDataSourceType.POSTGRESQL);
            if (!driver) {
                console.error('PostgreSQL driver not available - defaulting to FREE tier');
                return ESubscriptionTier.FREE;
            }

            const concreteDriver = await driver.getConcreteDriver();
            if (!concreteDriver?.manager) {
                console.error('Database manager not available - defaulting to FREE tier');
                return ESubscriptionTier.FREE;
            }

            const { tier } = await OrganizationService.getInstance().getOrgSubscriptionTierForUser(
                userId,
                concreteDriver.manager
            );
            return tier.tier_name as ESubscriptionTier;
        } catch (error) {
            console.error('[RowLimitService] Error getting user tier, defaulting to FREE:', error);
            return ESubscriptionTier.FREE;
        }
    }
    
    /**
     * Get row limit for user's current tier via their personal organization.
     * Always fetches from database - NO CACHING for real-time updates
     */
    async getRowLimit(userId: number): Promise<number> {
        try {
            const driver = await DBDriver.getInstance().getDriver(EDataSourceType.POSTGRESQL);
            if (!driver) {
                console.error('PostgreSQL driver not available - defaulting to FREE tier limit');
                return 100000;
            }

            const concreteDriver = await driver.getConcreteDriver();
            if (!concreteDriver?.manager) {
                console.error('Database manager not available - defaulting to FREE tier limit');
                return 100000;
            }

            const { tier } = await OrganizationService.getInstance().getOrgSubscriptionTierForUser(
                userId,
                concreteDriver.manager
            );
            // CRITICAL: Always read from database for real-time admin updates
            return Number(tier.max_rows_per_data_model);
        } catch (error) {
            console.error('[RowLimitService] Error getting row limit, defaulting to FREE:', error);
            return 100000;
        }
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
     * Assign free tier to user.
     * @deprecated Subscription tiers are now managed at the organization level.
     * A FREE tier is assigned automatically when a personal organization is created.
     * This method is a no-op kept for backward compatibility during the transition.
     */
    async assignFreeTier(userId: number): Promise<void> {
        console.log(`[RowLimitService] assignFreeTier called for user ${userId} - no-op (org-level subscriptions)`);
    }
    
    /**
     * Get usage statistics for user via their personal organization subscription.
     */
    async getUsageStats(userId: number): Promise<IUsageStats> {
        const driver = await DBDriver.getInstance().getDriver(EDataSourceType.POSTGRESQL);
        if (!driver) {
            throw new Error('Database driver not available');
        }

        const concreteDriver = await driver.getConcreteDriver();
        if (!concreteDriver?.manager) {
            throw new Error('Database manager not available');
        }

        const manager = concreteDriver.manager;

        const user = await manager.findOne(DRAUsersPlatform, {
            where: { id: userId },
            relations: ['projects', 'data_sources', 'dashboards']
        });

        if (!user) {
            throw new Error('User not found');
        }

        const { tier } = await OrganizationService.getInstance().getOrgSubscriptionTierForUser(userId, manager);

        return {
            tier: tier.tier_name as ESubscriptionTier,
            rowLimit: Number(tier.max_rows_per_data_model),
            projectCount: user.projects?.length || 0,
            maxProjects: tier.max_projects,
            dataSourceCount: user.data_sources?.length || 0,
            maxDataSources: tier.max_data_sources_per_project,
            dashboardCount: user.dashboards?.length || 0,
            maxDashboards: tier.max_dashboards,
            aiGenerationsPerMonth: tier.ai_generations_per_month
        };
    }
}
