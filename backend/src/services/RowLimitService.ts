import { DBDriver } from "../drivers/DBDriver.js";
import { EDataSourceType } from "../types/EDataSourceType.js";
import { OrganizationService } from "./OrganizationService.js";
import { DRAOrganizationSubscription } from "../models/DRAOrganizationSubscription.js";

export interface IUsageStats {
    tier: {
        id: number;
        tier_name: string;
        max_rows_per_data_model: string;
        price_per_month_usd: string;
    };
    rowLimit: number;
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
    async getUserTier(userId: number): Promise<string> {
        try {
            const driver = await DBDriver.getInstance().getDriver(EDataSourceType.POSTGRESQL);
            if (!driver) {
                console.error('PostgreSQL driver not available - defaulting to FREE tier');
                return 'Free';
            }

            const concreteDriver = await driver.getConcreteDriver();
            if (!concreteDriver?.manager) {
                console.error('Database manager not available - defaulting to FREE tier');
                return 'Free';
            }

            const { tier } = await OrganizationService.getInstance().getOrgSubscriptionTierForUser(
                userId,
                concreteDriver.manager
            );
            return tier.tier_name;
        } catch (error) {
            console.error('[RowLimitService] Error getting user tier, defaulting to FREE:', error);
            return 'Free';
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
     * Platform-wide safety ceiling from `max_data_model_rows`.
     * Returns 0 when the setting is missing or disabled.
     */
    async getGlobalRowLimit(): Promise<number> {
        try {
            const { PlatformSettingsProcessor } = await import('../processors/PlatformSettingsProcessor.js');
            const { EPlatformSettingKey } = await import('../models/DRAPlatformSettings.js');
            const value = await PlatformSettingsProcessor.getInstance()
                .getSetting<number>(EPlatformSettingKey.MAX_DATA_MODEL_ROWS);
            return typeof value === 'number' && Number.isFinite(value) ? value : 0;
        } catch (error) {
            console.error('[RowLimitService] Error reading global row limit:', error);
            return 0;
        }
    }

    /**
     * Row limit configured on a specific organization's subscription tier.
     * Returns null when the organization has no subscription/tier.
     */
    async getOrgRowLimit(organizationId: number): Promise<number | null> {
        try {
            const driver = await DBDriver.getInstance().getDriver(EDataSourceType.POSTGRESQL);
            if (!driver) return null;
            const concreteDriver = await driver.getConcreteDriver();
            if (!concreteDriver?.manager) return null;

            const subscription = await concreteDriver.manager.findOne(DRAOrganizationSubscription, {
                where: { organization_id: organizationId },
                relations: ['subscription_tier'],
            });
            const limit = subscription?.subscription_tier?.max_rows_per_data_model;
            return limit === undefined || limit === null ? null : Number(limit);
        } catch (error) {
            console.error('[RowLimitService] Error reading organization row limit:', error);
            return null;
        }
    }

    /**
     * Effective row limit for a user/org, combining the tier limit with the
     * platform-wide safety ceiling.
     *
     * - Returns -1 when unlimited.
     * - Resolves the tier from the organization that owns the data (when
     *   provided), falling back to the user's personal organization.
     * - A tier or global value of -1/0 is treated as "not set".
     */
    async getEffectiveRowLimit(
        userId: number | null | undefined,
        organizationId?: number | null,
    ): Promise<number> {
        let tierLimit: number | null = null;

        try {
            if (organizationId) {
                tierLimit = await this.getOrgRowLimit(organizationId);
            }
            if (tierLimit === null && userId) {
                tierLimit = await this.getRowLimit(userId);
            }
        } catch (error) {
            console.error('[RowLimitService] Error resolving tier row limit:', error);
            tierLimit = null;
        }

        const globalLimit = await this.getGlobalRowLimit();

        const isUnset = (value: number | null | undefined): boolean =>
            value === null ||
            value === undefined ||
            value === -1 ||
            value === 0 ||
            !Number.isFinite(value);

        const tierUnlimited = isUnset(tierLimit);
        const globalUnlimited = isUnset(globalLimit);

        if (tierUnlimited && globalUnlimited) return -1;
        if (tierUnlimited) return globalLimit as number;
        if (globalUnlimited) return tierLimit as number;
        return Math.min(tierLimit as number, globalLimit as number);
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
        const { tier } = await OrganizationService.getInstance().getOrgSubscriptionTierForUser(userId, manager);

        return {
            tier: {
                id: tier.id,
                tier_name: tier.tier_name,
                max_rows_per_data_model: String(tier.max_rows_per_data_model),
                price_per_month_usd: String(tier.price_per_month_usd)
            },
            rowLimit: Number(tier.max_rows_per_data_model)
        };
    }
}
