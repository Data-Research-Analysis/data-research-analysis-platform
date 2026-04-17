import { DBDriver } from "../drivers/DBDriver.js";
import { EDataSourceType } from "../types/EDataSourceType.js";
// Removed ESubscriptionTier - using tier_rank field instead
import { OrganizationService } from "./OrganizationService.js";

export interface ILimitCheckResult {
    allowed: boolean;
    currentCount: number;
    limit: number; // -1 means unlimited
    tier: string;
    message?: string;
}

export class SubscriptionLimitService {
    private static instance: SubscriptionLimitService;
    
    private constructor() {}
    
    public static getInstance(): SubscriptionLimitService {
        if (!SubscriptionLimitService.instance) {
            SubscriptionLimitService.instance = new SubscriptionLimitService();
        }
        return SubscriptionLimitService.instance;
    }
    
    /**
     * Get user's active subscription tier via their personal organization.
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

        const { tier } = await OrganizationService.getInstance().getOrgSubscriptionTierForUser(
            userId,
            concreteDriver.manager
        );

        // Return shape compatible with existing callers: { subscription_tier: DRASubscriptionTier }
        return { subscription_tier: tier };
    }
    
    /**
     * Check if user can create a new project
     */
    async checkProjectLimit(userId: number): Promise<ILimitCheckResult> {
        const subscription = await this.getUserSubscription(userId);
        const tier = subscription.subscription_tier.tier_name;
        const limit = subscription.subscription_tier.max_projects || -1;
        
        // Get current project count
        const driver = await DBDriver.getInstance().getDriver(EDataSourceType.POSTGRESQL);
        const manager = (await driver.getConcreteDriver()).manager;
        const projectCount = await manager.count('DRAProject', {
            where: { users_platform: { id: userId } }
        });
        
        const allowed = limit === -1 || projectCount < limit;
        
        return {
            allowed,
            currentCount: projectCount,
            limit,
            tier,
            message: allowed ? undefined : `You've reached your ${tier} plan limit of ${limit} projects. Upgrade to create more projects.`
        };
    }
    
    /**
     * Check if user can add a sub-user/team member
     */
    async checkSubUserLimit(userId: number): Promise<ILimitCheckResult> {
        const subscription = await this.getUserSubscription(userId);
        const tier = subscription.subscription_tier.tier_name;
        const limit = subscription.subscription_tier.max_members_per_project || 0;
        
        // Get current sub-user count (users invited to projects owned by this user)
        const driver = await DBDriver.getInstance().getDriver(EDataSourceType.POSTGRESQL);
        const manager = (await driver.getConcreteDriver()).manager;
        
        // Count distinct users who have been invited to projects owned by this user
        const result = await manager.query(
            `SELECT COUNT(DISTINCT pm.users_platform_id) as count 
             FROM dra_project_members pm
             JOIN dra_projects p ON pm.project_id = p.id
             WHERE p.users_platform_id = $1
             AND pm.users_platform_id != $1`,
            [userId]
        );
        
        const subUserCount = parseInt(result[0]?.count || '0');
        const allowed = limit === -1 || subUserCount < limit;
        
        return {
            allowed,
            currentCount: subUserCount,
            limit,
            tier,
            message: allowed ? undefined : limit === 0 
                ? `Sub-users are not available on the ${tier} plan. Upgrade to PROFESSIONAL to add up to 100 team members.`
                : `You've reached your ${tier} plan limit of ${limit} team members. Upgrade to add more users.`
        };
    }
    
    /**
     * Check if user can perform AI generation (data modeling, insights, etc.)
     */
    async checkAIGenerationLimit(userId: number): Promise<ILimitCheckResult> {
        const subscription = await this.getUserSubscription(userId);
        const tier = subscription.subscription_tier.tier_name;
        const limit = subscription.subscription_tier.ai_generations_per_month || 0;
        
        // Get AI generation count for current month
        const driver = await DBDriver.getInstance().getDriver(EDataSourceType.POSTGRESQL);
        const manager = (await driver.getConcreteDriver()).manager;
        
        const firstDayOfMonth = new Date();
        firstDayOfMonth.setDate(1);
        firstDayOfMonth.setHours(0, 0, 0, 0);
        
        // Count AI data model conversations created this month
        const aiConversationCount = await manager.count('DRAAIDataModelConversation', {
            where: {
                users_platform: { id: userId },
                created_at: { $gte: firstDayOfMonth } as any
            }
        });
        
        const allowed = limit === -1 || aiConversationCount < limit;
        
        return {
            allowed,
            currentCount: aiConversationCount,
            limit,
            tier,
            message: allowed ? undefined : `You've used all ${limit} AI generations for this month on the ${tier} plan. Upgrade to PROFESSIONAL for unlimited AI generations.`
        };
    }
    
    /**
     * Check if user can create a new data source
     */
    async checkDataSourceLimit(userId: number, projectId?: number): Promise<ILimitCheckResult> {
        const subscription = await this.getUserSubscription(userId);
        const tier = subscription.subscription_tier.tier_name;
        const limit = subscription.subscription_tier.max_data_sources_per_project || 0;
        
        // Get current data source count (all data sources or per project)
        const driver = await DBDriver.getInstance().getDriver(EDataSourceType.POSTGRESQL);
        const manager = (await driver.getConcreteDriver()).manager;
        
        const whereClause: any = { users_platform: { id: userId } };
        if (projectId) {
            whereClause.project_id = projectId;
        }
        
        const dataSourceCount = await manager.count('DRADataSource', { where: whereClause });
        
        const allowed = limit === -1 || dataSourceCount < limit;
        
        return {
            allowed,
            currentCount: dataSourceCount,
            limit,
            tier,
            message: allowed ? undefined : `You've reached your ${tier} plan limit of ${limit} data sources${projectId ? ' per project' : ''}. Upgrade to PROFESSIONAL for unlimited data sources.`
        };
    }
    
    /**
     * Check if user can create a new dashboard
     */
    async checkDashboardLimit(userId: number): Promise<ILimitCheckResult> {
        const subscription = await this.getUserSubscription(userId);
        const tier = subscription.subscription_tier.tier_name;
        const limit = subscription.subscription_tier.max_dashboards || 0;
        
        // Get current dashboard count
        const driver = await DBDriver.getInstance().getDriver(EDataSourceType.POSTGRESQL);
        const manager = (await driver.getConcreteDriver()).manager;
        const dashboardCount = await manager.count('DRADashboard', {
            where: { users_platform: { id: userId } }
        });
        
        const allowed = limit === -1 || dashboardCount < limit;
        
        return {
            allowed,
            currentCount: dashboardCount,
            limit,
            tier,
            message: allowed ? undefined : `You've reached your ${tier} plan limit of ${limit} dashboards. Upgrade to PROFESSIONAL for unlimited dashboards.`
        };
    }
    
    /**
     * Check row limit (delegates to RowLimitService)
     */
    async checkRowLimit(userId: number, rowCount: number): Promise<ILimitCheckResult> {
        const subscription = await this.getUserSubscription(userId);
        const tier = subscription.subscription_tier.tier_name;
        const limit = Number(subscription.subscription_tier.max_rows_per_data_model);
        
        const allowed = limit === -1 || rowCount <= limit;
        
        return {
            allowed,
            currentCount: rowCount,
            limit,
            tier,
            message: allowed ? undefined : `This data model has ${rowCount.toLocaleString()} rows, exceeding your ${tier} plan limit of ${limit.toLocaleString()} rows. Upgrade to PROFESSIONAL for 100M rows or ENTERPRISE for unlimited rows.`
        };
    }
    
    /**
     * Convenience method: throw error if limit exceeded
     */
    async enforceProjectLimit(userId: number): Promise<void> {
        const result = await this.checkProjectLimit(userId);
        if (!result.allowed) {
            throw new Error(result.message || 'Project limit exceeded');
        }
    }
    
    async enforceSubUserLimit(userId: number): Promise<void> {
        const result = await this.checkSubUserLimit(userId);
        if (!result.allowed) {
            throw new Error(result.message || 'Sub-user limit exceeded');
        }
    }
    
    async enforceAIGenerationLimit(userId: number): Promise<void> {
        const result = await this.checkAIGenerationLimit(userId);
        if (!result.allowed) {
            throw new Error(result.message || 'AI generation limit exceeded');
        }
    }
    
    async enforceDataSourceLimit(userId: number, projectId?: number): Promise<void> {
        const result = await this.checkDataSourceLimit(userId, projectId);
        if (!result.allowed) {
            throw new Error(result.message || 'Data source limit exceeded');
        }
    }
    
    async enforceDashboardLimit(userId: number): Promise<void> {
        const result = await this.checkDashboardLimit(userId);
        if (!result.allowed) {
            throw new Error(result.message || 'Dashboard limit exceeded');
        }
    }
    
    async enforceRowLimit(userId: number, rowCount: number): Promise<void> {
        const result = await this.checkRowLimit(userId, rowCount);
        if (!result.allowed) {
            throw new Error(result.message || 'Row limit exceeded');
        }
    }
}
