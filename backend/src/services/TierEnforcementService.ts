import { DBDriver } from '../drivers/DBDriver.js';
import { EDataSourceType } from '../types/EDataSourceType.js';
import { DRAUsersPlatform } from '../models/DRAUsersPlatform.js';
import { DRAUserSubscription } from '../models/DRAUserSubscription.js';
import { DRASubscriptionTier, ESubscriptionTier } from '../models/DRASubscriptionTier.js';
import { DRAProject } from '../models/DRAProject.js';
import { DRADataSource } from '../models/DRADataSource.js';
import { DRADataModel } from '../models/DRADataModel.js';
import { DRADashboard } from '../models/DRADashboard.js';
import { EUserType } from '../types/EUserType.js';
import { TierLimitError } from '../types/TierLimitError.js';
import { getRedisClient } from '../config/redis.config.js';

/**
 * Extended usage statistics with tier limit enforcement data
 */
export interface IEnhancedUsageStats {
    tier: ESubscriptionTier;
    tierDetails: {
        id: number;
        tierName: ESubscriptionTier;
        pricePerMonth: number;
    };
    rowLimit: number;
    projectCount: number;
    maxProjects: number | null;
    dataSourceCount: number;
    maxDataSources: number | null;
    dataModelCount: number;
    maxDataModels: number | null;
    dashboardCount: number;
    maxDashboards: number | null;
    aiGenerationsPerMonth: number | null;
    aiGenerationsUsed: number;
    canCreateProject: boolean;
    canCreateDataSource: boolean;
    canCreateDataModel: boolean;
    canCreateDashboard: boolean;
    canUseAIGeneration: boolean;
}

/**
 * TierEnforcementService
 * 
 * Enforces subscription tier limits for resource creation (projects, data sources, dashboards, AI generations).
 * Integrates with existing RowLimitService for tier information and adds Redis-based AI generation tracking.
 * 
 * Key Features:
 * - Checks resource limits before creation (throws TierLimitError if exceeded)
 * - Admin bypass for all limits (user_type === 'admin')
 * - Redis-based AI generation counters with monthly reset (31-day TTL)
 * - Per-project data source limits (max_data_sources_per_project)
 * - Unlimited tier support (null limits = unlimited)
 */
export class TierEnforcementService {
    private static instance: TierEnforcementService;
    private redis = getRedisClient();

    private constructor() {}

    public static getInstance(): TierEnforcementService {
        if (!TierEnforcementService.instance) {
            TierEnforcementService.instance = new TierEnforcementService();
        }
        return TierEnforcementService.instance;
    }

    /**
     * Check if user is admin (bypasses all limits)
     */
    async isAdmin(userId: number): Promise<boolean> {
        const driver = await DBDriver.getInstance().getDriver(EDataSourceType.POSTGRESQL);
        if (!driver) {
            console.error('[TierEnforcement] PostgreSQL driver not available');
            return false;
        }

        const concreteDriver = await driver.getConcreteDriver();
        if (!concreteDriver?.manager) {
            console.error('[TierEnforcement] Database manager not available');
            return false;
        }

        const user = await concreteDriver.manager.findOne(DRAUsersPlatform, {
            where: { id: userId }
        });

        const isAdminUser = user?.user_type === EUserType.ADMIN;
        
        if (isAdminUser) {
            console.log(`[TierEnforcement] Admin user ${userId} bypassing tier limits`);
        }

        return isAdminUser;
    }

    /**
     * Check if user has an active admin override for a resource
     * Returns the override count if active, null otherwise
     */
    private async getActiveOverride(userId: number, resource: string): Promise<number | null> {
        try {
            const overrideKey = `tier-override:${userId}:${resource}`;
            const overrideData = await this.redis.get(overrideKey);
            
            if (overrideData) {
                const parsed = JSON.parse(overrideData);
                console.log(`[TierEnforcement] Active override found for user ${userId}, resource ${resource}: ${parsed.overrideCount}`);
                return parsed.overrideCount;
            }
            
            return null;
        } catch (error) {
            console.error(`[TierEnforcement] Error checking override for user ${userId}:`, error);
            return null;
        }
    }

    /**
     * Get user's current subscription with tier details
     */
    private async getUserSubscription(userId: number) {
        const driver = await DBDriver.getInstance().getDriver(EDataSourceType.POSTGRESQL);
        if (!driver) {
            throw new Error('Database driver not available');
        }

        const concreteDriver = await driver.getConcreteDriver();
        if (!concreteDriver?.manager) {
            throw new Error('Database manager not available');
        }

        const subscription = await concreteDriver.manager.findOne(DRAUserSubscription, {
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
            // Default to FREE tier if no subscription found
            const freeTier = await concreteDriver.manager.findOne(DRASubscriptionTier, {
                where: { tier_name: ESubscriptionTier.FREE }
            });
            
            if (!freeTier) {
                throw new Error('FREE tier not found - run database seeders');
            }

            return {
                tier: freeTier,
                subscription: null
            };
        }

        return {
            tier: subscription.subscription_tier,
            subscription
        };
    }

    /**
     * Get all available upgrade tiers with their limits
     */
    private async getUpgradeTiers(
        currentTierName: ESubscriptionTier,
        resourceType: 'project' | 'data_source' | 'data_model' | 'dashboard' | 'ai_generation'
    ): Promise<Array<{ tierName: ESubscriptionTier; limit: number | null; pricePerMonth: number }>> {
        const driver = await DBDriver.getInstance().getDriver(EDataSourceType.POSTGRESQL);
        if (!driver) {
            return [];
        }

        const concreteDriver = await driver.getConcreteDriver();
        if (!concreteDriver?.manager) {
            return [];
        }

        const allTiers = await concreteDriver.manager.find(DRASubscriptionTier, {
            where: { is_active: true },
            order: { price_per_month_usd: 'ASC' }
        });

        // Filter tiers with higher price than current tier
        const currentTier = allTiers.find(t => t.tier_name === currentTierName);
        const currentPrice = currentTier?.price_per_month_usd || 0;

        const upgradeTiers = allTiers
            .filter(t => Number(t.price_per_month_usd) > currentPrice)
            .map(t => {
                let limit: number | null = null;
                
                switch (resourceType) {
                    case 'project':
                        limit = t.max_projects;
                        break;
                    case 'data_source':
                        limit = t.max_data_sources_per_project;
                        break;
                    case 'data_model':
                        limit = t.max_data_models_per_data_source;
                        break;
                    case 'dashboard':
                        limit = t.max_dashboards;
                        break;
                    case 'ai_generation':
                        limit = t.ai_generations_per_month;
                        break;
                }

                return {
                    tierName: t.tier_name as ESubscriptionTier,
                    limit,
                    pricePerMonth: Number(t.price_per_month_usd)
                };
            });

        return upgradeTiers;
    }

    /**
     * Check if user can create a new project
     * @throws TierLimitError if limit exceeded
     */
    async canCreateProject(userId: number): Promise<void> {
        // Admin bypass
        if (await this.isAdmin(userId)) {
            return;
        }

        // Check for active override
        const override = await this.getActiveOverride(userId, 'projects');
        
        const { tier } = await this.getUserSubscription(userId);
        const maxProjects = override !== null ? override : tier.max_projects;

        // Unlimited (null or override is present)
        if (maxProjects === null) {
            return;
        }

        const driver = await DBDriver.getInstance().getDriver(EDataSourceType.POSTGRESQL);
        if (!driver) {
            throw new Error('Database driver not available');
        }

        const concreteDriver = await driver.getConcreteDriver();
        if (!concreteDriver?.manager) {
            throw new Error('Database manager not available');
        }

        const projectCount = await concreteDriver.manager.count(DRAProject, {
            where: { users_platform: { id: userId } }
        });

        if (projectCount >= maxProjects) {
            const upgradeTiers = await this.getUpgradeTiers(tier.tier_name as ESubscriptionTier, 'project');
            throw new TierLimitError(
                tier.tier_name as ESubscriptionTier,
                'project',
                projectCount,
                maxProjects,
                upgradeTiers
            );
        }
    }

    /**
     * Check if user can create a new data source (per-project limit)
     * @throws TierLimitError if limit exceeded
     */
    async canCreateDataSource(userId: number, projectId: number): Promise<void> {
        // Admin bypass
        if (await this.isAdmin(userId)) {
            return;
        }

        // Check for active override
        const override = await this.getActiveOverride(userId, 'data_sources');
        
        const { tier } = await this.getUserSubscription(userId);
        const maxDataSourcesPerProject = override !== null ? override : tier.max_data_sources_per_project;

        // Unlimited (null or override is present)
        if (maxDataSourcesPerProject === null) {
            return;
        }

        const driver = await DBDriver.getInstance().getDriver(EDataSourceType.POSTGRESQL);
        if (!driver) {
            throw new Error('Database driver not available');
        }

        const concreteDriver = await driver.getConcreteDriver();
        if (!concreteDriver?.manager) {
            throw new Error('Database manager not available');
        }

        // Count data sources for this specific project
        const dataSourceCount = await concreteDriver.manager.count(DRADataSource, {
            where: {
                users_platform: { id: userId },
                project: { id: projectId }
            }
        });

        if (dataSourceCount >= maxDataSourcesPerProject) {
            const upgradeTiers = await this.getUpgradeTiers(tier.tier_name as ESubscriptionTier, 'data_source');
            throw new TierLimitError(
                tier.tier_name as ESubscriptionTier,
                'data_source',
                dataSourceCount,
                maxDataSourcesPerProject,
                upgradeTiers
            );
        }
    }

    /**
     * Check if user can create a new data model (per-data-source limit)
     * @throws TierLimitError if limit exceeded
     */
    async canCreateDataModel(userId: number, dataSourceId: number): Promise<void> {
        // Admin bypass
        if (await this.isAdmin(userId)) {
            return;
        }

        // Check for active override
        const override = await this.getActiveOverride(userId, 'data_models');
        
        const { tier } = await this.getUserSubscription(userId);
        const maxDataModelsPerDataSource = override !== null ? override : tier.max_data_models_per_data_source;

        // Unlimited (null or override is present)
        if (maxDataModelsPerDataSource === null) {
            return;
        }

        const driver = await DBDriver.getInstance().getDriver(EDataSourceType.POSTGRESQL);
        if (!driver) {
            throw new Error('Database driver not available');
        }

        const concreteDriver = await driver.getConcreteDriver();
        if (!concreteDriver?.manager) {
            throw new Error('Database manager not available');
        }

        // Count data models for this specific data source
        const dataModelCount = await concreteDriver.manager.count(DRADataModel, {
            where: {
                users_platform: { id: userId },
                data_source: { id: dataSourceId }
            }
        });

        if (dataModelCount >= maxDataModelsPerDataSource) {
            const upgradeTiers = await this.getUpgradeTiers(tier.tier_name as ESubscriptionTier, 'data_model');
            throw new TierLimitError(
                tier.tier_name as ESubscriptionTier,
                'data_model',
                dataModelCount,
                maxDataModelsPerDataSource,
                upgradeTiers
            );
        }
    }

    /**
     * Check if user can create a new dashboard
     * @throws TierLimitError if limit exceeded
     */
    async canCreateDashboard(userId: number): Promise<void> {
        // Admin bypass
        if (await this.isAdmin(userId)) {
            return;
        }

        // Check for active override
        const override = await this.getActiveOverride(userId, 'dashboards');
        
        const { tier } = await this.getUserSubscription(userId);
        const maxDashboards = override !== null ? override : tier.max_dashboards;

        // Unlimited (null or override is present)
        if (maxDashboards === null) {
            return;
        }

        const driver = await DBDriver.getInstance().getDriver(EDataSourceType.POSTGRESQL);
        if (!driver) {
            throw new Error('Database driver not available');
        }

        const concreteDriver = await driver.getConcreteDriver();
        if (!concreteDriver?.manager) {
            throw new Error('Database manager not available');
        }

        const dashboardCount = await concreteDriver.manager.count(DRADashboard, {
            where: { users_platform: { id: userId } }
        });

        if (dashboardCount >= maxDashboards) {
            const upgradeTiers = await this.getUpgradeTiers(tier.tier_name as ESubscriptionTier, 'dashboard');
            throw new TierLimitError(
                tier.tier_name as ESubscriptionTier,
                'dashboard',
                dashboardCount,
                maxDashboards,
                upgradeTiers
            );
        }
    }

    /**
     * Check if user can use AI generation (monthly limit)
     * @throws TierLimitError if limit exceeded
     */
    async canUseAIGeneration(userId: number): Promise<void> {
        // Admin bypass
        if (await this.isAdmin(userId)) {
            return;
        }

        // Check for active override
        const override = await this.getActiveOverride(userId, 'ai_generations');
        
        const { tier } = await this.getUserSubscription(userId);
        const monthlyLimit = override !== null ? override : tier.ai_generations_per_month;

        // Unlimited (null or override is present)
        if (monthlyLimit === null) {
            return;
        }

        const currentUsage = await this.getAIGenerationCount(userId);

        if (currentUsage >= monthlyLimit) {
            const upgradeTiers = await this.getUpgradeTiers(tier.tier_name as ESubscriptionTier, 'ai_generation');
            throw new TierLimitError(
                tier.tier_name as ESubscriptionTier,
                'ai_generation',
                currentUsage,
                monthlyLimit,
                upgradeTiers
            );
        }
    }

    /**
     * Increment AI generation counter in Redis (monthly reset via 31-day TTL)
     */
    async incrementAIGenerationCount(userId: number): Promise<number> {
        const key = `ai-generation-count:${userId}`;
        const count = await this.redis.incr(key);
        
        // Set expiry on first increment (31 days for monthly reset)
        if (count === 1) {
            await this.redis.expire(key, 31 * 24 * 60 * 60); // 31 days in seconds
        }

        return count;
    }

    /**
     * Get current AI generation count from Redis
     */
    async getAIGenerationCount(userId: number): Promise<number> {
        const key = `ai-generation-count:${userId}`;
        const count = await this.redis.get(key);
        return count ? parseInt(count, 10) : 0;
    }

    /**
     * Get comprehensive usage statistics with tier enforcement flags
     */
    async getUsageStats(userId: number): Promise<IEnhancedUsageStats> {
        const driver = await DBDriver.getInstance().getDriver(EDataSourceType.POSTGRESQL);
        if (!driver) {
            throw new Error('Database driver not available');
        }

        const concreteDriver = await driver.getConcreteDriver();
        if (!concreteDriver?.manager) {
            throw new Error('Database manager not available');
        }

        const { tier } = await this.getUserSubscription(userId);

        // Get current usage counts
        const [projectCount, dataSourceCount, dataModelCount, dashboardCount] = await Promise.all([
            concreteDriver.manager.count(DRAProject, {
                where: { users_platform: { id: userId } }
            }),
            concreteDriver.manager.count(DRADataSource, {
                where: { users_platform: { id: userId } }
            }),
            concreteDriver.manager.count(DRADataModel, {
                where: { users_platform: { id: userId } }
            }),
            concreteDriver.manager.count(DRADashboard, {
                where: { users_platform: { id: userId } }
            })
        ]);

        const aiGenerationsUsed = await this.getAIGenerationCount(userId);
        const isAdminUser = await this.isAdmin(userId);

        // Determine if user can create resources
        const canCreateProject = isAdminUser || tier.max_projects === null || projectCount < tier.max_projects;
        const canCreateDataSource = isAdminUser || tier.max_data_sources_per_project === null; // Per-project check needed
        const canCreateDataModel = isAdminUser || tier.max_data_models_per_data_source === null; // Per-data-source check needed
        const canCreateDashboard = isAdminUser || tier.max_dashboards === null || dashboardCount < tier.max_dashboards;
        const canUseAIGeneration = isAdminUser || tier.ai_generations_per_month === null || aiGenerationsUsed < tier.ai_generations_per_month;

        return {
            tier: tier.tier_name as ESubscriptionTier,
            tierDetails: {
                id: tier.id,
                tierName: tier.tier_name as ESubscriptionTier,
                pricePerMonth: Number(tier.price_per_month_usd)
            },
            rowLimit: Number(tier.max_rows_per_data_model),
            projectCount,
            maxProjects: tier.max_projects,
            dataSourceCount,
            maxDataSources: tier.max_data_sources_per_project,
            dataModelCount,
            maxDataModels: tier.max_data_models_per_data_source,
            dashboardCount,
            maxDashboards: tier.max_dashboards,
            aiGenerationsPerMonth: tier.ai_generations_per_month,
            aiGenerationsUsed,
            canCreateProject,
            canCreateDataSource,
            canCreateDataModel,
            canCreateDashboard,
            canUseAIGeneration
        };
    }
}
