import { DBDriver } from '../drivers/DBDriver.js';
import { EDataSourceType } from '../types/EDataSourceType.js';
import { DRAUsersPlatform } from '../models/DRAUsersPlatform.js';
import { DRASubscriptionTier } from '../models/DRASubscriptionTier.js';
import { DRAProject } from '../models/DRAProject.js';
import { DRADataSource } from '../models/DRADataSource.js';
import { DRADataModel } from '../models/DRADataModel.js';
import { DRADashboard } from '../models/DRADashboard.js';
import { DRAProjectMember } from '../models/DRAProjectMember.js';
import { EUserType } from '../types/EUserType.js';
import { TierLimitError } from '../types/TierLimitError.js';
import { getRedisClient } from '../config/redis.config.js';
import { OrganizationService } from './OrganizationService.js';

/**
 * Extended usage statistics with tier limit enforcement data
 */
export interface IEnhancedUsageStats {
    tier: string;
    tierDetails: {
        id: number;
        tierName: string;
        pricePerMonth: number;
    };
    rowLimit: number;
    projectCount: number;
    maxProjects: number | null;
    dataSourceCount: number;
    maxDataSources: number | null;
    dataModelCount: number;
    maxDataModels: number | null;
    maxDataModelsPerDataSource: number | null;
    dashboardCount: number;
    maxDashboards: number | null;
    aiGenerationsPerMonth: number | null;
    aiGenerationsUsed: number;
    memberCount: number;
    maxMembersPerProject: number | null;
    canCreateProject: boolean;
    canCreateDataSource: boolean;
    canCreateDataModel: boolean;
    canCreateDashboard: boolean;
    canUseAIGeneration: boolean;
    canAddMember: boolean;
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
     * Get a cached resource count from Redis, falling back to a live DB query if the key
     * is absent or stale.  TTL is intentionally short (30 s) so quota enforcement stays
     * accurate on burst requests while reducing duplicate COUNT queries.
     *
     * @param cacheKey  Unique Redis key — caller is responsible for naming it
     * @param ttlSeconds  How long to cache the count (default 30 s)
     * @param fetchFn  Async function that returns the real count
     */
    private async getCachedCount(
        cacheKey: string,
        ttlSeconds: number,
        fetchFn: () => Promise<number>
    ): Promise<number> {
        try {
            const cached = await this.redis.get(cacheKey);
            if (cached !== null) {
                return parseInt(cached, 10);
            }
        } catch (redisErr) {
            console.warn('[TierEnforcement] Redis read failed for key %s (falling back to DB):', cacheKey, redisErr);
        }

        const count = await fetchFn();

        try {
            await this.redis.setex(cacheKey, ttlSeconds, String(count));
        } catch (redisErr) {
            console.warn('[TierEnforcement] Redis write failed for key %s (non-fatal):', cacheKey, redisErr);
        }

        return count;
    }

    /**
     * Invalidate cached resource counts for a user (call after successful resource creation/deletion).
     * Accepts multiple keys to clear in a single round-trip.
     */
    async invalidateCountCache(...cacheKeys: string[]): Promise<void> {
        if (cacheKeys.length === 0) return;
        try {
            await this.redis.del(...cacheKeys);
        } catch (redisErr) {
            console.warn('[TierEnforcement] Redis cache invalidation failed (non-fatal):', redisErr);
        }
    }

    /**
     * Get user's current subscription tier via their personal organization.
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

        const { tier, orgSubscription } = await OrganizationService.getInstance().getOrgSubscriptionTierForUser(
            userId,
            concreteDriver.manager
        );

        return { tier, subscription: orgSubscription };
    }

    /**
     * Get all available upgrade tiers with their limits
     */
    private async getUpgradeTiers(
        currentTierName: string,
        resourceType: 'project' | 'data_source' | 'data_model' | 'dashboard' | 'ai_generation'
    ): Promise<Array<{ tierName: string; limit: number | null; pricePerMonth: number }>> {
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
                    tierName: t.tier_name,
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

        // Unlimited (-1, null, or override is present)
        if (maxProjects === null || maxProjects === -1) {
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

        const projectCount = await this.getCachedCount(
            `tier:count:projects:user:${userId}`,
            30,
            () => concreteDriver.manager.count(DRAProject, {
                where: { users_platform: { id: userId } }
            })
        );

        if (projectCount >= maxProjects) {
            const upgradeTiers = await this.getUpgradeTiers(tier.tier_name, 'project');
            throw new TierLimitError(
                tier.tier_name,
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

        // Unlimited (-1, null, or override is present)
        if (maxDataSourcesPerProject === null || maxDataSourcesPerProject === -1) {
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
        const dataSourceCount = await this.getCachedCount(
            `tier:count:data_sources:project:${projectId}`,
            30,
            () => concreteDriver.manager.count(DRADataSource, {
                where: {
                    users_platform: { id: userId },
                    project: { id: projectId }
                }
            })
        );

        if (dataSourceCount >= maxDataSourcesPerProject) {
            const upgradeTiers = await this.getUpgradeTiers(tier.tier_name, 'data_source');
            throw new TierLimitError(
                tier.tier_name,
                'data_source',
                dataSourceCount,
                maxDataSourcesPerProject,
                upgradeTiers
            );
        }
    }

    /**
     * Check if user can create a new data model (global limit)
     *
     * Enforcement is GLOBAL across all of the user's data sources (including
     * cross-source models). The total capacity grows with the number of data
     * sources the user has created:
     *   totalCapacity = dataSourcesCreated × max_data_models_per_data_source
     * It does not matter how the models are distributed across data sources.
     *
     * @throws TierLimitError if limit exceeded
     */
    async canCreateDataModel(userId: number): Promise<void> {
        // Admin bypass
        if (await this.isAdmin(userId)) {
            return;
        }

        // Check for active override
        const override = await this.getActiveOverride(userId, 'data_models');
        
        const { tier } = await this.getUserSubscription(userId);
        const maxDataModelsPerDataSource = override !== null ? override : tier.max_data_models_per_data_source;

        // Unlimited (-1, null, or override is present)
        if (maxDataModelsPerDataSource === null || maxDataModelsPerDataSource === -1) {
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

        // Count all data sources the user has created
        const dataSourceCount = await this.getCachedCount(
            `tier:count:data_sources:user:${userId}`,
            30,
            () => concreteDriver.manager.count(DRADataSource, {
                where: { users_platform: { id: userId } }
            })
        );

        // Total capacity = data sources created × models per data source
        const maxDataModels = dataSourceCount * maxDataModelsPerDataSource;

        // Count ALL data models for the user (single-source + cross-source)
        const dataModelCount = await this.getCachedCount(
            `tier:count:data_models:user:${userId}`,
            30,
            () => concreteDriver.manager.count(DRADataModel, {
                where: { users_platform: { id: userId } }
            })
        );

        if (dataModelCount >= maxDataModels) {
            const upgradeTiers = await this.getUpgradeTiers(tier.tier_name, 'data_model');
            throw new TierLimitError(
                tier.tier_name,
                'data_model',
                dataModelCount,
                maxDataModels,
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

        // Unlimited (-1, null, or override is present)
        if (maxDashboards === null || maxDashboards === -1) {
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

        const dashboardCount = await this.getCachedCount(
            `tier:count:dashboards:user:${userId}`,
            30,
            () => concreteDriver.manager.count(DRADashboard, {
                where: { users_platform: { id: userId } }
            })
        );

        if (dashboardCount >= maxDashboards) {
            const upgradeTiers = await this.getUpgradeTiers(tier.tier_name, 'dashboard');
            throw new TierLimitError(
                tier.tier_name,
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

        // Unlimited (-1, null, or override is present)
        if (monthlyLimit === null || monthlyLimit === -1) {
            return;
        }

        const currentUsage = await this.getAIGenerationCount(userId);

        if (currentUsage >= monthlyLimit) {
            const upgradeTiers = await this.getUpgradeTiers(tier.tier_name, 'ai_generation');
            throw new TierLimitError(
                tier.tier_name,
                'ai_generation',
                currentUsage,
                monthlyLimit,
                upgradeTiers
            );
        }
    }

    /**
     * Check if user can add a team member (sub-user limit)
     * @throws TierLimitError if limit exceeded
     */
    async canAddMember(userId: number): Promise<void> {
        // Admin bypass
        if (await this.isAdmin(userId)) {
            return;
        }

        // Check for active override
        const override = await this.getActiveOverride(userId, 'members');
        
        const { tier } = await this.getUserSubscription(userId);
        const maxMembers = override !== null ? override : tier.max_members_per_project;

        // Unlimited (null or -1 or override is present)
        if (maxMembers === null || maxMembers === -1) {
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

        // Count distinct sub-users (excluding the owner themselves)
        const result = await concreteDriver.manager.query(
            `SELECT COUNT(DISTINCT pum.users_platform_id) as count 
             FROM dra_project_members pum
             JOIN dra_projects p ON pum.project_id = p.id
             WHERE p.users_platform_id = $1
             AND pum.users_platform_id != $1`,
            [userId]
        );

        const subUserCount = parseInt(result[0]?.count || '0');

        if (subUserCount >= maxMembers) {
            const upgradeTiers = await this.getUpgradeTiers(tier.tier_name, 'ai_generation');
            throw new TierLimitError(
                tier.tier_name,
                'member',
                subUserCount,
                maxMembers,
                maxMembers === 0 
                    ? [{
                        tierName: "Professional",
                        limit: 100,
                        pricePerMonth: 399
                    }]
                    : upgradeTiers
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

        // Get current usage counts using QueryBuilder to avoid TypeORM alias conflicts
        const [projectCount, dataSourceCount, dataModelCount, dashboardCount] = await Promise.all([
            concreteDriver.manager
                .createQueryBuilder(DRAProject, 'project')
                .innerJoin('project.users_platform', 'user')
                .where('user.id = :userId', { userId })
                .getCount(),
            concreteDriver.manager
                .createQueryBuilder(DRADataSource, 'dataSource')
                .innerJoin('dataSource.users_platform', 'user')
                .where('user.id = :userId', { userId })
                .getCount(),
            concreteDriver.manager
                .createQueryBuilder(DRADataModel, 'dataModel')
                .innerJoin('dataModel.users_platform', 'user')
                .where('user.id = :userId', { userId })
                .getCount(),
            concreteDriver.manager
                .createQueryBuilder(DRADashboard, 'dashboard')
                .innerJoin('dashboard.users_platform', 'user')
                .where('user.id = :userId', { userId })
                .getCount()
        ]);

        const aiGenerationsUsed = await this.getAIGenerationCount(userId);
        const isAdminUser = await this.isAdmin(userId);

        // Count distinct sub-users across all projects owned by this user
        const memberCountResult = await concreteDriver.manager.query(
            `SELECT COUNT(DISTINCT pum.users_platform_id) as count
             FROM dra_project_members pum
             JOIN dra_projects p ON pum.project_id = p.id
             WHERE p.users_platform_id = $1
             AND pum.users_platform_id != $1`,
            [userId]
        );
        const memberCount = parseInt(memberCountResult[0]?.count || '0');
        const maxMembersRaw = tier.max_members_per_project;
        // -1 means unlimited; null also means unlimited
        const maxMembersPerProject: number | null = (maxMembersRaw === -1 || maxMembersRaw === null) ? null : maxMembersRaw;

        // Global data model capacity = data sources created × models per data source.
        // null/-1 on the tier means unlimited.
        const modelsPerDataSourceRaw = tier.max_data_models_per_data_source;
        const unlimitedDataModels = modelsPerDataSourceRaw === null || modelsPerDataSourceRaw === -1;
        const maxDataModels = unlimitedDataModels ? null : dataSourceCount * modelsPerDataSourceRaw;

        // Determine if user can create resources
        const canCreateProject = isAdminUser || tier.max_projects === null || tier.max_projects === -1 || projectCount < tier.max_projects;
        const canCreateDataSource = isAdminUser || tier.max_data_sources_per_project === null || tier.max_data_sources_per_project === -1 || dataSourceCount < tier.max_data_sources_per_project;
        const canCreateDataModel = isAdminUser || unlimitedDataModels || dataModelCount < maxDataModels;
        const canCreateDashboard = isAdminUser || tier.max_dashboards === null || tier.max_dashboards === -1 || dashboardCount < tier.max_dashboards;
        const canUseAIGeneration = isAdminUser || tier.ai_generations_per_month === null || tier.ai_generations_per_month === -1 || aiGenerationsUsed < tier.ai_generations_per_month;
        const canAddMember = isAdminUser || maxMembersPerProject === null || memberCount < maxMembersPerProject;

        return {
            tier: tier.tier_name,
            tierDetails: {
                id: tier.id,
                tierName: tier.tier_name,
                pricePerMonth: Number(tier.price_per_month_usd)
            },
            rowLimit: Number(tier.max_rows_per_data_model),
            projectCount,
            maxProjects: tier.max_projects,
            dataSourceCount,
            maxDataSources: tier.max_data_sources_per_project,
            dataModelCount,
            maxDataModels,
            maxDataModelsPerDataSource: unlimitedDataModels ? null : modelsPerDataSourceRaw,
            dashboardCount,
            maxDashboards: tier.max_dashboards,
            aiGenerationsPerMonth: tier.ai_generations_per_month,
            aiGenerationsUsed,
            memberCount,
            maxMembersPerProject,
            canCreateProject,
            canCreateDataSource,
            canCreateDataModel,
            canCreateDashboard,
            canUseAIGeneration,
            canAddMember,
        };
    }
}
