import { DBDriver } from "../drivers/DBDriver.js";
import { EDataSourceType } from "../types/EDataSourceType.js";
import { DRAUserSubscription } from "../models/DRAUserSubscription.js";
import { DRASubscriptionTier, ESubscriptionTier } from "../models/DRASubscriptionTier.js";
import { DRAUsersPlatform } from "../models/DRAUsersPlatform.js";
import { EmailService } from "../services/EmailService.js";
import { EmailPreferencesProcessor } from "./EmailPreferencesProcessor.js";

export interface IUserSubscriptionData {
    subscription_id?: number;
    subscription_tier: {
        id: number;
        tier_name: string;
        max_rows_per_data_model: string;
        max_projects: number | null;
        max_data_sources_per_project: number | null;
        max_dashboards: number | null;
        ai_generations_per_month: number | null;
        price_per_month_usd: string;
    };
    started_at: Date;
    ends_at: Date | null;
    is_active: boolean;
}

export class UserSubscriptionProcessor {
    private static instance: UserSubscriptionProcessor;
    
    private constructor() {}
    
    public static getInstance(): UserSubscriptionProcessor {
        if (!UserSubscriptionProcessor.instance) {
            UserSubscriptionProcessor.instance = new UserSubscriptionProcessor();
        }
        return UserSubscriptionProcessor.instance;
    }
    
    /**
     * Get user's current active subscription
     */
    async getUserSubscription(userId: number): Promise<IUserSubscriptionData | null> {
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
        
        // Verify user exists
        const user = await manager.findOne(DRAUsersPlatform, { where: { id: userId } });
        if (!user) {
            throw new Error(`User with id ${userId} not found`);
        }
        
        // Get active subscription with tier details
        const subscription = await manager.findOne(DRAUserSubscription, {
            where: { 
                users_platform: { id: userId },
                is_active: true
            },
            relations: ['subscription_tier', 'users_platform']
        });
        
        if (!subscription || !subscription.subscription_tier) {
            return null;
        }
        
        return {
            subscription_id: subscription.id,
            subscription_tier: {
                id: subscription.subscription_tier.id,
                tier_name: subscription.subscription_tier.tier_name,
                max_rows_per_data_model: subscription.subscription_tier.max_rows_per_data_model.toString(),
                max_projects: subscription.subscription_tier.max_projects,
                max_data_sources_per_project: subscription.subscription_tier.max_data_sources_per_project,
                max_dashboards: subscription.subscription_tier.max_dashboards,
                ai_generations_per_month: subscription.subscription_tier.ai_generations_per_month,
                price_per_month_usd: subscription.subscription_tier.price_per_month_usd.toString()
            },
            started_at: subscription.started_at,
            ends_at: subscription.ends_at,
            is_active: subscription.is_active
        };
    }
    
    /**
     * Assign or update user's subscription
     * Deactivates old subscription and creates new one
     */
    async assignSubscription(
        userId: number, 
        tierId: number, 
        endsAt?: Date | null
    ): Promise<IUserSubscriptionData> {
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
        
        // Verify user exists
        const user = await manager.findOne(DRAUsersPlatform, { where: { id: userId } });
        if (!user) {
            throw new Error(`User with id ${userId} not found`);
        }
        
        // Verify tier exists and is active
        const tier = await manager.findOne(DRASubscriptionTier, { where: { id: tierId } });
        if (!tier) {
            throw new Error(`Subscription tier with id ${tierId} not found`);
        }
        
        if (!tier.is_active) {
            throw new Error(`Cannot assign inactive subscription tier: ${tier.tier_name}`);
        }
        
        // Start transaction to ensure atomicity
        return await manager.transaction(async (transactionalEntityManager) => {
            // Deactivate any existing active subscriptions for this user using QueryBuilder
            await transactionalEntityManager
                .createQueryBuilder()
                .update(DRAUserSubscription)
                .set({ is_active: false })
                .where("users_platform_id = :userId", { userId })
                .andWhere("is_active = :isActive", { isActive: true })
                .execute();
            
            // Create new subscription
            const newSubscription = transactionalEntityManager.create(DRAUserSubscription, {
                started_at: new Date(),
                ends_at: endsAt || null,
                is_active: true,
                stripe_subscription_id: null,
                cancelled_at: null
            });
            
            // Set relations using the loaded entities
            newSubscription.users_platform = user;
            newSubscription.subscription_tier = tier;
            
            const savedSubscription = await transactionalEntityManager.save(newSubscription);
            
            // Send email notification (async, don't wait)
            this.sendSubscriptionEmail(user, tier, savedSubscription, 'assigned').catch(err => {
                console.error('[UserSubscriptionProcessor] Failed to send subscription email:', err);
            });
            
            // Return subscription data with tier details
            return {
                subscription_id: savedSubscription.id,
                subscription_tier: {
                    id: tier.id,
                    tier_name: tier.tier_name,
                    max_rows_per_data_model: tier.max_rows_per_data_model.toString(),
                    max_projects: tier.max_projects,
                    max_data_sources_per_project: tier.max_data_sources_per_project,
                    max_dashboards: tier.max_dashboards,
                    ai_generations_per_month: tier.ai_generations_per_month,
                    price_per_month_usd: tier.price_per_month_usd.toString()
                },
                started_at: savedSubscription.started_at,
                ends_at: savedSubscription.ends_at,
                is_active: savedSubscription.is_active
            };
        });
    }
    
    /**
     * Cancel user's active subscription
     */
    async cancelSubscription(userId: number): Promise<boolean> {
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
        
        // Find active subscription
        const subscription = await manager.findOne(DRAUserSubscription, {
            where: { 
                users_platform: { id: userId },
                is_active: true
            },
            relations: ['users_platform']
        });
        
        if (!subscription) {
            throw new Error('No active subscription found for this user');
        }
        
        // Update subscription to inactive and set cancelled_at
        await manager.update(
            DRAUserSubscription,
            { id: subscription.id },
            { 
                is_active: false,
                cancelled_at: new Date()
            }
        );
        
        // Send cancellation email notification (async, don't wait)
        const updatedSubscription = await manager.findOne(DRAUserSubscription, {
            where: { id: subscription.id },
            relations: ['users_platform', 'subscription_tier']
        });
        
        if (updatedSubscription) {
            this.sendSubscriptionEmail(
                updatedSubscription.users_platform, 
                updatedSubscription.subscription_tier, 
                updatedSubscription, 
                'cancelled'
            ).catch(err => {
                console.error('[UserSubscriptionProcessor] Failed to send cancellation email:', err);
            });
        }
        
        return true;
    }
    
    /**
     * Get all subscriptions for a user (including inactive/history)
     */
    async getUserSubscriptionHistory(userId: number): Promise<IUserSubscriptionData[]> {
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
        
        const subscriptions = await manager.find(DRAUserSubscription, {
            where: { users_platform: { id: userId } },
            relations: ['subscription_tier', 'users_platform'],
            order: { started_at: 'DESC' }
        });
        
        return subscriptions.map(sub => ({
            subscription_id: sub.id,
            subscription_tier: {
                id: sub.subscription_tier.id,
                tier_name: sub.subscription_tier.tier_name,
                max_rows_per_data_model: sub.subscription_tier.max_rows_per_data_model.toString(),
                max_projects: sub.subscription_tier.max_projects,
                max_data_sources_per_project: sub.subscription_tier.max_data_sources_per_project,
                max_dashboards: sub.subscription_tier.max_dashboards,
                ai_generations_per_month: sub.subscription_tier.ai_generations_per_month,
                price_per_month_usd: sub.subscription_tier.price_per_month_usd.toString()
            },
            started_at: sub.started_at,
            ends_at: sub.ends_at,
            is_active: sub.is_active
        }));
    }
    
    /**
     * Send subscription-related email notification
     * @private
     */
    private async sendSubscriptionEmail(
        user: DRAUsersPlatform,
        tier: DRASubscriptionTier,
        subscription: DRAUserSubscription,
        emailType: 'assigned' | 'upgraded' | 'downgraded' | 'cancelled'
    ): Promise<void> {
        try {
            // Check user email preferences
            const preferencesProcessor = EmailPreferencesProcessor.getInstance();
            const canSend = await preferencesProcessor.canSendEmail(user.id, 'subscription_updates');
            
            if (!canSend) {
                console.log(`[UserSubscriptionProcessor] User ${user.id} has disabled subscription update emails`);
                return;
            }
            
            const emailService = EmailService.getInstance();
            const userName = `${user.first_name} ${user.last_name}`.trim() || user.email.split('@')[0];
            
            // Determine subject and template based on email type
            let subject: string;
            let template: string;
            
            switch (emailType) {
                case 'assigned':
                    subject = `Welcome to ${tier.tier_name}!`;
                    template = 'subscription-assigned';
                    break;
                case 'upgraded':
                    subject = `You've been upgraded to ${tier.tier_name}!`;
                    template = 'subscription-upgraded';
                    break;
                case 'downgraded':
                    subject = `Your subscription changed to ${tier.tier_name}`;
                    template = 'subscription-downgraded';
                    break;
                case 'cancelled':
                    subject = 'Your subscription has been cancelled';
                    template = 'subscription-cancelled';
                    break;
                default:
                    throw new Error(`Unknown email type: ${emailType}`);
            }
            
            // Helper function to format limit values (null, undefined, or -1 = Unlimited)
            const formatLimit = (value: number | null | undefined): string => {
                if (value === null || value === undefined || value === -1) {
                    return 'Unlimited';
                }
                return value.toString();
            };
            
            await emailService.sendEmail({
                to: user.email,
                subject,
                template,
                templateData: {
                    userName,
                    tierName: tier.tier_name,
                    maxProjects: formatLimit(tier.max_projects),
                    maxDataSources: formatLimit(tier.max_data_sources_per_project),
                    maxDashboards: formatLimit(tier.max_dashboards),
                    maxMembersPerProject: formatLimit(tier.max_members_per_project),
                    aiGenerationsPerMonth: formatLimit(tier.ai_generations_per_month),
                    maxRowsPerDataModel: tier.max_rows_per_data_model.toLocaleString(),
                    startDate: subscription.started_at,
                    expirationDate: subscription.ends_at || 'Ongoing',
                    endDate: subscription.cancelled_at || ''
                }
            });
            
            console.log(`[UserSubscriptionProcessor] ${emailType} email queued for user ${user.email}`);
        } catch (error: any) {
            // Don't fail subscription operations if email fails
            console.error(`[UserSubscriptionProcessor] Failed to send ${emailType} email:`, error);
        }
    }
}
