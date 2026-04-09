import { AppDataSource } from '../datasources/PostgresDS.js';
import { DRAOrganizationSubscription } from '../models/DRAOrganizationSubscription.js';
import { DRASubscriptionTier } from '../models/DRASubscriptionTier.js';
import { DRAOrganization } from '../models/DRAOrganization.js';
import { DRAOrganizationMember } from '../models/DRAOrganizationMember.js';
import { DRADowngradeRequest } from '../models/DRADowngradeRequest.js';
import { PaddleService } from '../services/PaddleService.js';
import { EmailService } from '../services/EmailService.js';
import { TemplateEngineService } from '../services/TemplateEngineService.js';

/**
 * SubscriptionProcessor - Business logic for subscription management
 * 
 * Handles:
 * - Checkout initiation
 * - Subscription creation from webhook events
 * - Upgrades/downgrades with proration
 * - Cancellation
 * - Failed payment handling with grace period
 * - Grace period expiry processing
 * 
 * CRITICAL: This processor coordinates between Paddle and local database.
 * All subscription state changes MUST be triggered by Paddle webhooks.
 * 
 * @see backend/src/services/PaddleService.ts
 * @see documentation/paddle-integration-plan.md
 */
export class SubscriptionProcessor {
    private static instance: SubscriptionProcessor;
    
    private constructor() {
        console.log('📘 Subscription Processor initialized');
    }
    
    public static getInstance(): SubscriptionProcessor {
        if (!SubscriptionProcessor.instance) {
            SubscriptionProcessor.instance = new SubscriptionProcessor();
        }
        return SubscriptionProcessor.instance;
    }
    
    /**
     * Initiate checkout for a new subscription or upgrade
     * 
     * Creates a Paddle checkout session and returns the URL.
     * Actual subscription creation happens via webhook after payment.
     * 
     * @param organizationId - Organization ID
     * @param tierId - Target subscription tier ID
     * @param billingCycle - 'monthly' or 'annual'
     * @returns Checkout session details
     */
    async initiateCheckout(
        organizationId: number,
        tierId: number,
        billingCycle: 'monthly' | 'annual'
    ): Promise<{
        sessionId: string;
        checkoutUrl: string | undefined;
        priceId: string;
        customerId: string;
        customerEmail: string;
    }> {
        const manager = AppDataSource.manager;
        
        // Get organization with members to find owner's email
        const organization = await manager.findOneOrFail(DRAOrganization, {
            where: { id: organizationId },
            relations: ['subscription', 'subscription.subscription_tier', 'members', 'members.user']
        });
        
        // Get owner's email (organizations don't have email field, use owner's email)
        const ownerMember = organization.members.find(m => m.role === 'owner');
        if (!ownerMember || !ownerMember.user) {
            throw new Error('Organization owner not found');
        }
        const customerEmail = ownerMember.user.email;
        
        const newTier = await manager.findOneOrFail(DRASubscriptionTier, {
            where: { id: tierId }
        });
        
        // Get appropriate price ID
        const priceId = billingCycle === 'monthly' 
            ? newTier.paddle_price_id_monthly 
            : newTier.paddle_price_id_annual;
            
        if (!priceId) {
            throw new Error(`Paddle price ID not configured for ${newTier.tier_name} (${billingCycle})`);
        }
        
        // Get or create Paddle customer
        const paddle = PaddleService.getInstance();
        let customerId = organization.subscription?.paddle_customer_id;
        
        if (!customerId) {
            // Get or create customer (handles existing customers automatically)
            const customer = await paddle.getOrCreateCustomer(
                customerEmail,
                organization.name,
                { organizationId }
            );
            customerId = customer.id;
            
            // Save customer ID to local database
            if (!organization.subscription) {
                const freeTier = await manager.findOneOrFail(DRASubscriptionTier, {
                    where: { tier_name: 'free' }
                });
                
                const newSubscription = manager.create(DRAOrganizationSubscription, {
                    organization_id: organizationId,
                    subscription_tier_id: freeTier.id,
                    paddle_customer_id: customerId,
                    billing_cycle: 'monthly',
                    is_active: false
                });
                
                await manager.save(newSubscription);
            } else {
                organization.subscription.paddle_customer_id = customerId;
                await manager.save(organization.subscription);
            }
        }
        
        // Create checkout session
        const session = await paddle.createCheckoutSession(
            priceId,
            customerId,
            { organizationId, tierId, billingCycle }
        );
        
        return {
            sessionId: session.id,
            checkoutUrl: session.checkout?.url,
            priceId,
            customerId,
            customerEmail
        };
    }
    
    /**
     * Handle successful payment from Paddle webhook
     * 
     * Called by webhook handler when subscription.created or subscription.payment_succeeded
     * event is received. Creates or updates local subscription record.
     * 
     * @param paddleData - Webhook payload data
     * @returns Created/updated subscription
     */
    async handleSuccessfulPayment(paddleData: {
        subscription_id: string;
        customer_id: string;
        transaction_id: string;
        billing_cycle: 'monthly' | 'annual';
        next_billed_at: string | null;
        customData: { organizationId: number; tierId: number };
    }): Promise<DRAOrganizationSubscription> {
        const manager = AppDataSource.manager;
        const { organizationId, tierId } = paddleData.customData;
        
        const organization = await manager.findOneOrFail(DRAOrganization, {
            where: { id: organizationId },
            relations: ['subscription']
        });
        
        const tier = await manager.findOneOrFail(DRASubscriptionTier, {
            where: { id: tierId }
        });
        
        // Create or update subscription
        let subscription = organization.subscription;
        
        if (!subscription) {
            subscription = manager.create(DRAOrganizationSubscription, {
                organization_id: organizationId,
                subscription_tier_id: tierId
            });
        }
        
        subscription.paddle_subscription_id = paddleData.subscription_id;
        subscription.paddle_customer_id = paddleData.customer_id;
        subscription.paddle_transaction_id = paddleData.transaction_id;
        subscription.billing_cycle = paddleData.billing_cycle;
        subscription.is_active = true;
        subscription.started_at = new Date();
        subscription.ends_at = paddleData.next_billed_at ? new Date(paddleData.next_billed_at) : null;
        subscription.grace_period_ends_at = null;
        subscription.last_payment_failed_at = null;
        
        await manager.save(subscription);
        
        // Send confirmation email
        const ownerEmail = organization.settings?.owner_email || '';
        const ownerName = organization.settings?.owner_name || organization.name;
        
        if (ownerEmail) {
            const tierDetails = {
                maxProjects: tier.max_projects === null || tier.max_projects === -1 ? 'Unlimited' : tier.max_projects.toString(),
                maxDataSources: tier.max_data_sources_per_project === null || tier.max_data_sources_per_project === -1 ? 'Unlimited' : tier.max_data_sources_per_project.toString(),
                maxDashboards: tier.max_dashboards === null || tier.max_dashboards === -1 ? 'Unlimited' : tier.max_dashboards.toString(),
                maxMembersPerProject: tier.max_members_per_project === null || tier.max_members_per_project === -1 ? 'Unlimited' : tier.max_members_per_project.toString(),
                aiGenerationsPerMonth: tier.ai_generations_per_month === null || tier.ai_generations_per_month === -1 ? 'Unlimited' : tier.ai_generations_per_month.toString(),
                maxRowsPerDataModel: tier.max_rows_per_data_model === null || tier.max_rows_per_data_model === -1 ? 'Unlimited' : tier.max_rows_per_data_model.toString()
            };
            
            const nextPaymentDate = subscription.ends_at || new Date();
            
            await EmailService.getInstance().sendSubscriptionActivated(
                ownerEmail,
                ownerName,
                tier.tier_name.toUpperCase(),
                tierDetails,
                paddleData.billing_cycle === 'monthly' ? 'Monthly' : 'Annual',
                nextPaymentDate
            );
        }
        
        console.log(`✅ Subscription activated for organization ${organizationId} (tier: ${tier.tier_name})`);
        
        // Clear interested_subscription_tier_id for organization members who requested this tier
        // This prevents auto-triggering checkout again on page load
        const members = await manager.find(DRAOrganizationMember, {
            where: { organization_id: organizationId },
            relations: ['user']
        });
        
        for (const member of members) {
            if (member.user && member.user.interested_subscription_tier?.id === tierId) {
                member.user.interested_subscription_tier = undefined;
                await manager.save(member.user);
                console.log(`🧹 Cleared interested_subscription_tier for user ${member.user.email}`);
            }
        }
        
        return subscription;
    }
    
    /**
     * Upgrade subscription to higher tier
     * 
     * Updates the subscription in Paddle with prorated billing.
     * Local record updates automatically via webhook.
     * 
     * @param organizationId - Organization ID
     * @param newTierId - New (higher) tier ID
     * @param billingCycle - Billing cycle to use
     * @returns Updated subscription
     */
    async upgradeSubscription(
        organizationId: number,
        newTierId: number,
        billingCycle: 'monthly' | 'annual'
    ): Promise<DRAOrganizationSubscription> {
        const manager = AppDataSource.manager;
        
        const organization = await manager.findOneOrFail(DRAOrganization, {
            where: { id: organizationId },
            relations: ['subscription', 'subscription.subscription_tier']
        });
        
        if (!organization.subscription?.paddle_subscription_id) {
            throw new Error('No active subscription found');
        }
        
        const currentTier = organization.subscription.subscription_tier;
        const newTier = await manager.findOneOrFail(DRASubscriptionTier, {
            where: { id: newTierId }
        });
        
        // Get new price ID
        const priceId = billingCycle === 'monthly'
            ? newTier.paddle_price_id_monthly
            : newTier.paddle_price_id_annual;
            
        if (!priceId) {
            throw new Error(`Paddle price ID not configured for ${newTier.tier_name}`);
        }
        
        // Update in Paddle (prorated immediately)
        const paddle = PaddleService.getInstance();
        await paddle.updateSubscription(
            organization.subscription.paddle_subscription_id,
            priceId
        );
        
        // Update local record
        organization.subscription.subscription_tier_id = newTierId;
        organization.subscription.billing_cycle = billingCycle;
        await manager.save(organization.subscription);
        
        // Send email
        const ownerEmail = organization.settings?.owner_email || '';
        const ownerName = organization.settings?.owner_name || organization.name;
        
        if (ownerEmail) {
            // Get unlocked features (simplified - shows tier names)
            const newFeatures = [
                `Upgraded to ${newTier.tier_name.toUpperCase()}`,
                `${newTier.max_projects === null ? 'Unlimited' : newTier.max_projects} projects`,
                `${newTier.max_data_sources_per_project === null ? 'Unlimited' : newTier.max_data_sources_per_project} data sources per project`,
                `${newTier.max_dashboards === null ? 'Unlimited' : newTier.max_dashboards} dashboards`
            ];
            
            await EmailService.getInstance().sendSubscriptionUpgraded(
                ownerEmail,
                ownerName,
                currentTier.tier_name.toUpperCase(),
                newTier.tier_name.toUpperCase(),
                newFeatures
            );
        }
        
        console.log(`✅ Subscription upgraded: ${currentTier.tier_name} → ${newTier.tier_name} for org ${organizationId}`);
        
        return organization.subscription;
    }
    
    /**
     * Downgrade subscription (validates usage first)
     * 
     * Checks if organization's current usage fits within new tier limits.
     * If validation passes, updates subscription in Paddle.
     * 
     * @param organizationId - Organization ID
     * @param newTierId - New (lower) tier ID
     * @returns Updated subscription
     * @throws Error if usage exceeds new tier limits
     */
    async downgradeSubscription(organizationId: number, newTierId: number): Promise<DRAOrganizationSubscription> {
        const manager = AppDataSource.manager;
        
        // TODO: Validate usage is within new tier limits
        // const canDowngrade = await TierEnforcementService.getInstance()
        //     .canDowngrade(organizationId, newTierId);
        // if (!canDowngrade.allowed) {
        //     throw new Error(`Cannot downgrade: ${canDowngrade.reason}`);
        // }
        
        const organization = await manager.findOneOrFail(DRAOrganization, {
            where: { id: organizationId },
            relations: ['subscription']
        });
        
        const newTier = await manager.findOneOrFail(DRASubscriptionTier, {
            where: { id: newTierId }
        });
        
        // If downgrading to FREE, cancel Paddle subscription
        if (newTier.tier_name === 'free') {
            if (organization.subscription?.paddle_subscription_id) {
                const paddle = PaddleService.getInstance();
                await paddle.cancelSubscription(
                    organization.subscription.paddle_subscription_id,
                    'next_billing_period'
                );
            }
        } else {
            // Downgrade to different paid tier
            const priceId = organization.subscription!.billing_cycle === 'monthly'
                ? newTier.paddle_price_id_monthly
                : newTier.paddle_price_id_annual;
                
            if (!priceId) {
                throw new Error(`Paddle price ID not configured`);
            }
            
            const paddle = PaddleService.getInstance();
            await paddle.updateSubscription(
                organization.subscription!.paddle_subscription_id!,
                priceId
            );
        }
        
        // Update local record
        organization.subscription!.subscription_tier_id = newTierId;
        await manager.save(organization.subscription);
        
        // Send email
        const ownerEmail = organization.settings?.owner_email || '';
        const ownerName = organization.settings?.owner_name || organization.name;
        
        if (ownerEmail) {
            const currentTierForEmail = await manager.findOne(DRASubscriptionTier, {
                where: { id: organization.subscription!.subscription_tier_id }
            });
            
            const effectiveDate = organization.subscription!.ends_at || new Date();
            
            await EmailService.getInstance().sendSubscriptionDowngraded(
                ownerEmail,
                ownerName,
                currentTierForEmail?.tier_name.toUpperCase() || 'UNKNOWN',
                newTier.tier_name.toUpperCase(),
                effectiveDate
            );
        }
        
        console.log(`✅ Subscription downgraded to ${newTier.tier_name} for org ${organizationId}`);
        
        return organization.subscription!;
    }
    
    /**
     * Cancel subscription (access continues until period end)
     * 
     * Cancels in Paddle effective at next billing period.
     * Organization retains access until ends_at date.
     * 
     * @param organizationId - Organization ID
     * @param reason - Optional cancellation reason
     * @returns Updated subscription
     */
    async cancelSubscription(organizationId: number, reason?: string): Promise<DRAOrganizationSubscription> {
        const manager = AppDataSource.manager;
        
        const organization = await manager.findOneOrFail(DRAOrganization, {
            where: { id: organizationId },
            relations: ['subscription']
        });
        
        if (!organization.subscription?.paddle_subscription_id) {
            throw new Error('No active subscription to cancel');
        }
        
        // Cancel in Paddle (effective at period end)
        const paddle = PaddleService.getInstance();
        await paddle.cancelSubscription(
            organization.subscription.paddle_subscription_id,
            'next_billing_period'
        );
        
        // Update local record
        organization.subscription.cancelled_at = new Date();
        await manager.save(organization.subscription);
        
        // Log cancellation reason
        console.log(`⚠️ Subscription cancelled for org ${organizationId}. Reason: ${reason || 'Not provided'}`);
        
        // Send email
        const ownerEmail = organization.settings?.owner_email || '';
        const ownerName = organization.settings?.owner_name || organization.name;
        
        if (ownerEmail) {
            const tier = await manager.findOne(DRASubscriptionTier, {
                where: { id: organization.subscription.subscription_tier_id }
            });
            
            const effectiveDate = organization.subscription.ends_at || new Date();
            
            await EmailService.getInstance().sendSubscriptionCancelled(
                ownerEmail,
                ownerName,
                tier?.tier_name.toUpperCase() || 'UNKNOWN',
                effectiveDate
            );
        }
        
        return organization.subscription;
    }
    
    /**
     * Change subscription tier immediately with Paddle proration
     * 
     * Handles both upgrades and downgrades. For downgrades, creates a tracking
     * record in dra_downgrade_requests with status 'completed' (since change is immediate).
     * 
     * Uses Paddle's automatic proration:
     * - Upgrades: Charge prorated amount immediately
     * - Downgrades: Apply credit to next billing cycle
     * 
     * @param organizationId - Organization ID
     * @param newTierId - Target tier ID
     * @param userId - User initiating the change (for tracking)
     * @returns Updated subscription
     */
    async changeTier(
        organizationId: number,
        newTierId: number,
        userId: number,
        billingCycle?: 'monthly' | 'annual'
    ): Promise<DRAOrganizationSubscription> {
        const manager = AppDataSource.manager;
        
        // Load organization with subscription and current tier
        const organization = await manager.findOneOrFail(DRAOrganization, {
            where: { id: organizationId },
            relations: ['subscription', 'subscription.subscription_tier', 'members', 'members.user']
        });
        
        if (!organization.subscription) {
            throw new Error('Organization has no active subscription');
        }
        
        // Load new tier
        const newTier = await manager.findOneOrFail(DRASubscriptionTier, {
            where: { id: newTierId }
        });
        
        // Check if this is a downgrade
        const currentTier = organization.subscription.subscription_tier;
        const isDowngrade = this.isDowngrade(currentTier.tier_name, newTier.tier_name);
        
        // Create downgrade tracking record if applicable
        if (isDowngrade) {
            await this.createDowngradeRequestFromTierChange(
                organizationId,
                userId,
                currentTier.tier_name,
                newTier.tier_name
            );
            console.log(`📊 Downgrade tracked: ${currentTier.tier_name} → ${newTier.tier_name}`);
        }
        
        // Check if organization has an active Paddle subscription
        const hasPaddleSubscription = !!organization.subscription.paddle_subscription_id;
        
        if (hasPaddleSubscription) {
            // Route A: Update via Paddle API with automatic proration
            console.log(`🔄 Updating Paddle subscription for Org ${organizationId}`);
            
            // Get appropriate Paddle price ID based on provided or current billing cycle
            const targetBillingCycle = billingCycle || organization.subscription.billing_cycle || 'monthly';
            const newPriceId = targetBillingCycle === 'monthly' 
                ? newTier.paddle_price_id_monthly 
                : newTier.paddle_price_id_annual;
            
            if (!newPriceId) {
                throw new Error(`No Paddle price ID configured for ${newTier.tier_name} (${targetBillingCycle})`);
            }
            
            // Update subscription in Paddle with proration
            const paddle = PaddleService.getInstance();
            await paddle.updateSubscription(
                organization.subscription.paddle_subscription_id,
                newPriceId
            );
            
            console.log(`✅ Paddle subscription updated with proration`);
        } else {
            // Route B: Direct database update (free tier, manual billing, enterprise)
            console.log(`📝 Direct database update for Org ${organizationId} (no Paddle subscription)`);
        }
        
        // Update local database
        organization.subscription.subscription_tier_id = newTierId;
        organization.subscription.subscription_tier = newTier;
        
        // Update billing cycle if provided (e.g., admin changing from monthly to annual)
        if (billingCycle && billingCycle !== organization.subscription.billing_cycle) {
            console.log(`🔄 Updating billing cycle: ${organization.subscription.billing_cycle} → ${billingCycle}`);
            organization.subscription.billing_cycle = billingCycle;
        }
        
        await manager.save(organization.subscription);
        
        console.log(`✅ Tier changed: Org ${organizationId} → ${newTier.tier_name} (${hasPaddleSubscription ? 'Paddle' : 'Direct'})`);
        
        // Debug: Log members information
        console.log(`🔍 Organization members count: ${organization.members?.length || 0}`);
        if (organization.members?.length > 0) {
            organization.members.forEach(m => {
                console.log(`  - Member: role=${m.role}, user_id=${m.users_platform_id}, has_user=${!!m.user}, email=${m.user?.email || 'N/A'}`);
            });
        }
        
        // Send email notification (wrapped in try-catch to not block tier change on email failure)
        const ownerMember = organization.members.find(m => m.role === 'owner');
        console.log(`🔍 Owner member found: ${!!ownerMember}, email: ${ownerMember?.user?.email || 'N/A'}`);
        
        if (ownerMember?.user?.email) {
            try {
                const emailService = EmailService.getInstance();
                const templateService = TemplateEngineService.getInstance();
                const changeType = isDowngrade ? 'downgraded' : 'upgraded';
                const changeTypeCaps = changeType.charAt(0).toUpperCase() + changeType.slice(1);
                const subject = `Subscription ${changeType} to ${newTier.tier_name.toUpperCase()}`;
                const tierNameDisplay = newTier.tier_name.replace(/_/g, ' ').toUpperCase();
                const previousTierDisplay = currentTier.tier_name.replace(/_/g, ' ').toUpperCase();
                
                // Determine billing message based on subscription type
                const billingMessage = hasPaddleSubscription 
                    ? `Your Paddle subscription has been updated with ${isDowngrade ? 'a credit applied to' : 'a prorated charge for'} your next billing cycle.`
                    : 'This change is reflected in your organization settings.';
                
                // Render email from template
                const html = await templateService.render('admin-tier-change-notification.html', [
                    { key: 'user_first_name', value: ownerMember.user.first_name || 'there' },
                    { key: 'change_type', value: changeType },
                    { key: 'change_type_caps', value: changeTypeCaps },
                    { key: 'previous_tier', value: previousTierDisplay },
                    { key: 'new_tier', value: tierNameDisplay },
                    { key: 'billing_message', value: billingMessage },
                    { key: 'unsubscribe_code', value: '' }
                ]);
                
                // Use sendEmailImmediately for critical notification (with retry logic)
                await emailService.sendEmailImmediately({
                    to: ownerMember.user.email,
                    subject: subject,
                    html: html,
                    text: `Your organization subscription has been ${changeType} to ${tierNameDisplay}. The change is effective immediately.`
                });
                
                console.log(`📧 Email notification sent to ${ownerMember.user.email}`);
            } catch (emailError: any) {
                // Log error but don't fail the tier change
                console.error(`❌ Failed to send email notification to ${ownerMember.user.email}:`, emailError.message);
            }
        } else {
            console.warn(`⚠️ No owner found or owner has no email for organization ${organizationId}`);
        }
        
        return organization.subscription;
    }
    
    /**
     * Helper: Determine if tier change is a downgrade
     * 
     * Compares tier ranking. Lower index = lower tier.
     * 
     * @param currentTier - Current tier name
     * @param newTier - Target tier name
     * @returns True if downgrade, false if upgrade or lateral
     */
    private isDowngrade(currentTier: string, newTier: string): boolean {
        const ranking = ['free', 'starter', 'professional', 'professional_plus', 'enterprise'];
        
        const currentIndex = ranking.indexOf(currentTier.toLowerCase());
        const newIndex = ranking.indexOf(newTier.toLowerCase());
        
        if (currentIndex === -1 || newIndex === -1) {
            console.warn(`⚠️ Unknown tier in ranking: current=${currentTier}, new=${newTier}`);
            return false;
        }
        
        return newIndex < currentIndex;
    }
    
    /**
     * Helper: Create downgrade request tracking record
     * 
     * Links billing section tier changes to the downgrade tracking system.
     * Status is set to 'completed' since changes via billing are immediate
     * (vs 'pending' for requests submitted via pricing page forms).
     * 
     * @param organizationId - Organization ID
     * @param userId - User who initiated the change
     * @param currentTier - Current tier name
     * @param newTier - Target tier name
     */
    private async createDowngradeRequestFromTierChange(
        organizationId: number,
        userId: number,
        currentTier: string,
        newTier: string
    ): Promise<void> {
        const manager = AppDataSource.manager;
        
        const downgradeRequest = manager.create(DRADowngradeRequest, {
            user_id: userId,
            organization_id: organizationId,
            current_tier: currentTier,
            requested_tier: newTier,
            reason: 'Tier change via billing section',
            message: 'Immediate tier change initiated through organization billing settings',
            status: 'completed',
            completed_at: new Date()
        });
        
        await manager.save(downgradeRequest);
        console.log(`📝 Downgrade request created: ID ${downgradeRequest.id}`);
    }
    
    /**
     * Get payment method from Paddle customer
     * 
     * Retrieves the payment method details (last 4 digits, expiry, brand) for
     * display in the billing UI. Returns null if no payment method on file.
     * 
     * PCI compliant - only returns last 4 digits and metadata, never full card number.
     * 
     * @param organizationId - Organization ID
     * @returns Payment method details or null
     */
    async getPaymentMethod(organizationId: number): Promise<{
        type: string;
        last4: string;
        expiryMonth: number;
        expiryYear: number;
        brand: string;
        hasPaddleSubscription: boolean;
        paddleSubscriptionId: string | null;
        billingType: 'paddle' | 'manual' | 'free';
    } | null> {
        const manager = AppDataSource.manager;
        
        const organization = await manager.findOneOrFail(DRAOrganization, {
            where: { id: organizationId },
            relations: ['subscription', 'subscription.subscription_tier']
        });
        
        if (!organization.subscription) {
            return null;
        }
        
        const hasPaddleSubscription = !!organization.subscription.paddle_subscription_id;
        const currentTier = organization.subscription.subscription_tier;
        
        // Determine billing type
        let billingType: 'paddle' | 'manual' | 'free';
        if (hasPaddleSubscription) {
            billingType = 'paddle';
        } else if (currentTier?.tier_name === 'free') {
            billingType = 'free';
        } else {
            billingType = 'manual';
        }
        
        if (!organization.subscription?.paddle_customer_id) {
            // No Paddle customer = FREE tier or no subscription
            return {
                type: 'none',
                last4: '',
                expiryMonth: 0,
                expiryYear: 0,
                brand: '',
                hasPaddleSubscription,
                paddleSubscriptionId: organization.subscription.paddle_subscription_id || null,
                billingType
            };
        }
        
        const paddle = PaddleService.getInstance();
        const customer = await paddle.getCustomer(organization.subscription.paddle_customer_id);
        
        // Extract payment method from Paddle customer object
        // Structure varies by Paddle SDK version, handle defensively
        const paymentMethod = (customer as any).payment_method || (customer as any).paymentMethod;
        
        if (!paymentMethod) {
            return {
                type: 'none',
                last4: '',
                expiryMonth: 0,
                expiryYear: 0,
                brand: '',
                hasPaddleSubscription,
                paddleSubscriptionId: organization.subscription.paddle_subscription_id || null,
                billingType
            };
        }
        
        // Card details are nested under 'card' property
        const card = paymentMethod.card || (paymentMethod as any).Card;
        
        if (!card) {
            // Non-card payment method (PayPal, etc.)
            return {
                type: paymentMethod.type || 'unknown',
                last4: '',
                expiryMonth: 0,
                expiryYear: 0,
                brand: paymentMethod.type || 'unknown',
                hasPaddleSubscription,
                paddleSubscriptionId: organization.subscription.paddle_subscription_id || null,
                billingType
            };
        }
        
        // Return card details (PCI compliant - last4 only)
        return {
            type: 'card',
            last4: card.last4 || card.lastFour || '',
            expiryMonth: card.expiry_month || card.expiryMonth || 0,
            expiryYear: card.expiry_year || card.expiryYear || 0,
            brand: card.brand || card.type || 'unknown',
            hasPaddleSubscription,
            paddleSubscriptionId: organization.subscription.paddle_subscription_id || null,
            billingType
        };
    }
    
    /**
     * Handle failed payment - start grace period
     * 
     * Called by webhook when payment fails. Starts 14-day grace period.
     * Organization retains access during grace period.
     * 
     * @param subscriptionId - Paddle subscription ID
     * @returns Updated subscription
     */
    async handleFailedPayment(subscriptionId: string): Promise<DRAOrganizationSubscription> {
        const manager = AppDataSource.manager;
        
        const subscription = await manager.findOneOrFail(DRAOrganizationSubscription, {
            where: { paddle_subscription_id: subscriptionId },
            relations: ['organization']
        });
        
        const gracePeriodDays = 14;
        const gracePeriodEnds = new Date();
        gracePeriodEnds.setDate(gracePeriodEnds.getDate() + gracePeriodDays);
        
        subscription.last_payment_failed_at = new Date();
        subscription.grace_period_ends_at = gracePeriodEnds;
        
        await manager.save(subscription);
        
        // Send notification email
        const ownerEmail = subscription.organization.settings?.owner_email || '';
        const ownerName = subscription.organization.settings?.owner_name || subscription.organization.name;
        
        if (ownerEmail) {
            const tier = await manager.findOne(DRASubscriptionTier, {
                where: { id: subscription.subscription_tier_id }
            });
            
            await EmailService.getInstance().sendPaymentFailed(
                ownerEmail,
                ownerName,
                tier?.tier_name.toUpperCase() || 'UNKNOWN',
                gracePeriodEnds,
                gracePeriodDays
            );
        }
        
        console.log(`⚠️ Payment failed for subscription ${subscriptionId}. Grace period until ${gracePeriodEnds.toISOString()}`);
        
        return subscription;
    }
    
    /**
     * Process grace period expiry (run by cron job)
     * 
     * Finds all subscriptions with expired grace periods and downgrades to FREE.
     * Should be run daily by a cron job.
     * 
     * @returns Number of subscriptions downgraded
     */
    async processGracePeriodExpiry(): Promise<number> {
        const manager = AppDataSource.manager;
        
        // Find subscriptions with expired grace periods
        const expiredSubscriptions = await manager
            .createQueryBuilder(DRAOrganizationSubscription, 'sub')
            .leftJoinAndSelect('sub.organization', 'org')
            .where('sub.grace_period_ends_at < NOW()')
            .andWhere('sub.is_active = true')
            .getMany();
            
        for (const subscription of expiredSubscriptions) {
            // Downgrade to FREE tier
            const freeTier = await manager.findOneOrFail(DRASubscriptionTier, {
                where: { tier_name: 'free' }
            });
            
            subscription.subscription_tier_id = freeTier.id;
            subscription.is_active = false;
            subscription.grace_period_ends_at = null;
            
            await manager.save(subscription);
            
            // Send notification
            const ownerEmail = subscription.organization.settings?.owner_email || '';
            const ownerName = subscription.organization.settings?.owner_name || subscription.organization.name;
            
            if (ownerEmail) {
                const oldTier = await manager.findOne(DRASubscriptionTier, {
                    where: { id: subscription.subscription_tier_id }
                });
                
                const oldTierDetails = {
                    maxProjects: oldTier?.max_projects?.toString() || 'Unlimited',
                    maxDataSources: oldTier?.max_data_sources_per_project?.toString() || 'Unlimited',
                    maxDashboards: oldTier?.max_dashboards?.toString() || 'Unlimited',
                    aiGenerationsPerMonth: oldTier?.ai_generations_per_month?.toString() || 'Unlimited'
                };
                
                const newTierDetails = {
                    maxProjects: freeTier.max_projects?.toString() || '1',
                    maxDataSources: freeTier.max_data_sources_per_project?.toString() || '2',
                    maxDashboards: freeTier.max_dashboards?.toString() || '2',
                    aiGenerationsPerMonth: freeTier.ai_generations_per_month?.toString() || '5'
                };
                
                await EmailService.getInstance().sendDowngradedToFree(
                    ownerEmail,
                    ownerName,
                    oldTier?.tier_name.toUpperCase() || 'PAID',
                    oldTierDetails,
                    newTierDetails
                );
            }
            
            console.log(`⚠️ Downgraded organization ${subscription.organization_id} to FREE after grace period`);
        }
        
        return expiredSubscriptions.length;
    }
    
    /**
     * Get billing portal URL for customer
     * 
     * Generates a URL where customer can update payment method.
     * 
     * @param organizationId - Organization ID
     * @returns Billing portal URL
     */
    async getBillingPortalUrl(organizationId: number): Promise<string | undefined> {
        const manager = AppDataSource.manager;
        
        const organization = await manager.findOneOrFail(DRAOrganization, {
            where: { id: organizationId },
            relations: ['subscription']
        });
        
        if (!organization.subscription?.paddle_customer_id) {
            throw new Error('No Paddle customer found');
        }
        
        const paddle = PaddleService.getInstance();
        const url = await paddle.generatePaymentMethodUpdateUrl(
            organization.subscription.paddle_customer_id
        );
        
        return url;
    }
    
    /**
     * Get subscription details for frontend
     * 
     * @param organizationId - Organization ID
     * @returns Subscription with tier details
     */
    async getSubscriptionDetails(organizationId: number): Promise<DRAOrganizationSubscription | null> {
        const manager = AppDataSource.manager;
        
        const subscription = await manager.findOne(DRAOrganizationSubscription, {
            where: { organization_id: organizationId },
            relations: ['subscription_tier']
        });
        
        return subscription;
    }
    
    /**
     * Get payment history from Paddle
     * 
     * Fetches transaction history for the organization's Paddle customer.
     * Returns formatted payment records with invoice URLs.
     * 
     * @param organizationId - Organization ID
     * @returns Array of payment transactions
     */
    async getPaymentHistory(organizationId: number): Promise<any[]> {
        const manager = AppDataSource.manager;
        
        const organization = await manager.findOneOrFail(DRAOrganization, {
            where: { id: organizationId },
            relations: ['subscription']
        });
        
        if (!organization.subscription?.paddle_customer_id) {
            // No Paddle customer = no payment history (FREE tier user)
            return [];
        }
        
        const paddle = PaddleService.getInstance();
        const transactions = await paddle.getCustomerTransactions(
            organization.subscription.paddle_customer_id
        );
        
        // Format transactions for frontend
        const transactionsArray = [] as any[];
        for await (const txn of transactions) {
            transactionsArray.push(txn);
        }
        
        return transactionsArray.map((txn: any) => ({
            id: txn.id,
            created_at: txn.created_at || txn.createdAt,
            amount: txn.details?.totals?.total || 0,
            currency: txn.currency_code || 'USD',
            status: txn.status,
            invoice_url: txn.invoice_pdf || txn.receipt_url || null
        }));
    }
}
