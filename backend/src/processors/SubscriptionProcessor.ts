import { AppDataSource } from '../datasources/PostgresDS.js';
import { DRAOrganizationSubscription } from '../models/DRAOrganizationSubscription.js';
import { DRASubscriptionTier } from '../models/DRASubscriptionTier.js';
import { DRAOrganization } from '../models/DRAOrganization.js';
import { DRAOrganizationMember } from '../models/DRAOrganizationMember.js';
import { DRAProject } from '../models/DRAProject.js';
import { DRADowngradeRequest } from '../models/DRADowngradeRequest.js';
import { DRAPromoCode } from '../models/DRAPromoCode.js';
import { PromoCodeService } from '../services/PromoCodeService.js';
import { DRAPaymentTransaction } from '../models/DRAPaymentTransaction.js';
import { PaymentAlertService } from '../services/PaymentAlertService.js';
import { PaddleService } from '../services/PaddleService.js';
import { EmailService } from '../services/EmailService.js';
import { TemplateEngineService } from '../services/TemplateEngineService.js';
import { In } from 'typeorm';

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
        billingCycle: 'monthly' | 'annual',
        userId?: number,
        promoCode?: string
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
        
        // Validate and process promo code if provided
        let promoCodeId: number | undefined;
        let discountAmount: number | undefined;
        let finalPrice: number | undefined;
        let paddleDiscountId: string | undefined;
        
        if (promoCode && userId) {
            const promoCodeService = PromoCodeService.getInstance();
            const validation = await promoCodeService.validatePromoCode(
                promoCode,
                userId,
                tierId,
                billingCycle
            );
            
            if (!validation.valid) {
                throw new Error(validation.error || 'Invalid promo code');
            }
            
            promoCodeId = validation.code?.id;
            discountAmount = validation.discountAmount;
            finalPrice = validation.finalPrice;
            paddleDiscountId = validation.code?.paddle_discount_id ?? undefined;
            console.log(`[initiateCheckout] Promo code validated: id=${promoCodeId}, paddleDiscountId=${paddleDiscountId || 'NONE'}`);
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
        
        // Create checkout session with promo code in metadata
        const customData: any = { organizationId, tierId, billingCycle };
        if (promoCodeId) {
            customData.promoCodeId = promoCodeId;
        }
        
        const session = await paddle.createCheckoutSession(
            priceId,
            customerId,
            customData,
            paddleDiscountId
        );
        console.log(`[initiateCheckout] Transaction created: id=${session.id}, discountApplied=${!!paddleDiscountId}`);
        
        const result: any = {
            sessionId: session.id,
            checkoutUrl: session.checkout?.url,
            priceId,
            customerId,
            customerEmail
        };
        
        // Include promo code details if applied
        if (promoCodeId && discountAmount !== undefined && finalPrice !== undefined) {
            result.promoCodeApplied = true;
            result.discountAmount = discountAmount;
            result.finalPrice = finalPrice;
        }
        
        return result;
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
        invoice_url?: string | null;
        customData: { organizationId: number; tierId: number; promoCodeId?: number };
    }): Promise<DRAOrganizationSubscription> {
        const manager = AppDataSource.manager;
        const { organizationId, tierId } = paddleData.customData;
        
        console.log(`🔔 handleSuccessfulPayment called for Org ${organizationId}, Tier ${tierId}`);
        console.log(`   Paddle Subscription ID: ${paddleData.subscription_id}`);
        console.log(`   Billing Cycle: ${paddleData.billing_cycle}`);
        
        const organization = await manager.findOneOrFail(DRAOrganization, {
            where: { id: organizationId },
            relations: ['subscription', 'subscription.subscription_tier']
        });
        
        console.log(`   Current Tier: ${organization.subscription?.subscription_tier?.tier_name || 'None'}`);
        console.log(`   Current Paddle Sub ID: ${organization.subscription?.paddle_subscription_id || 'None'}`);
        
        const tier = await manager.findOneOrFail(DRASubscriptionTier, {
            where: { id: tierId }
        });
        
        console.log(`   Target Tier: ${tier.tier_name}`);
        
        // Create or update subscription
        let subscription = organization.subscription;
        
        if (!subscription) {
            subscription = manager.create(DRAOrganizationSubscription, {
                organization_id: organizationId,
                subscription_tier_id: tierId
            });
        }
        
        // Update subscription details (ALWAYS update tier even if subscription exists)
        subscription.subscription_tier_id = tierId;
        subscription.subscription_tier = tier;
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
        
        console.log(`✅ Subscription saved for Org ${organizationId}:`);
        console.log(`   - Tier: ${tier.tier_name} (ID: ${tierId})`);
        console.log(`   - Paddle Subscription: ${paddleData.subscription_id}`);
        console.log(`   - Billing Cycle: ${paddleData.billing_cycle}`);
        console.log(`   - Active: ${subscription.is_active}`);
        
        // Create promo code redemption if promo code was used
        if (paddleData.customData.promoCodeId) {
            try {
                const promoCodeService = PromoCodeService.getInstance();
                const tier = await manager.findOneOrFail(DRASubscriptionTier, { where: { id: tierId } });
                const originalPrice = paddleData.billing_cycle === 'monthly'
                    ? parseFloat(tier.price_per_month_usd?.toString() || '0')
                    : parseFloat(tier.price_per_year_usd?.toString() || '0');
                
                // Get the promo code to calculate discount
                const promoCode = await manager.findOne(DRAPromoCode, { where: { id: paddleData.customData.promoCodeId } });
                if (promoCode) {
                    const calculation = promoCodeService.calculateDiscount(promoCode, tier, paddleData.billing_cycle);
                    
                    // Find the organization owner to use as the user ID for redemption
                    const ownerMember = await manager.findOne(DRAOrganizationMember, {
                        where: { organization_id: organizationId, role: 'owner' }
                    });
                    
                    if (ownerMember) {
                        await promoCodeService.redeemPromoCode(
                            promoCode.code,
                            ownerMember.users_platform_id,
                            tierId,
                            subscription.id,
                            organizationId,
                            paddleData.billing_cycle as 'monthly' | 'annual'
                        );
                        console.log(`✅ Promo code ${promoCode.code} redeemed for organization ${organizationId}`);
                    }
                }
            } catch (error) {
                console.error('❌ Failed to create promo code redemption:', error);
                // Don't fail the payment if redemption tracking fails
            }
        }
        
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

        // Record in financial transaction ledger (non-blocking — must not fail the payment confirmation)
        try {
            const txRecord = manager.create(DRAPaymentTransaction, {
                organization_id: organizationId,
                subscription_id: subscription.id,
                paddle_transaction_id: paddleData.transaction_id || null,
                transaction_type: 'charge',
                amount: 0, // amount not provided in this context; enriched later via adjustment webhook
                currency: 'USD',
                description: `${tier.tier_name.toUpperCase()} plan — ${paddleData.billing_cycle} subscription`,
                paddle_invoice_url: paddleData.invoice_url || null,
                status: 'completed',
                tier_name: tier.tier_name,
                billing_cycle: paddleData.billing_cycle,
                processed_at: new Date(),
            });
            await manager.save(txRecord);
            console.log(`💳 Transaction ledger entry created for org ${organizationId} (Paddle tx: ${paddleData.transaction_id}, Invoice: ${paddleData.invoice_url || 'N/A'})`);
        } catch (ledgerErr) {
            console.error('⚠️ Failed to write transaction ledger entry (non-fatal):', ledgerErr);
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
        
        // Track this tier change to prevent race condition with webhooks
        // This prevents webhooks with stale tier data from reverting the database
        const { trackTierChange } = await import('../routes/paddle-webhook.js');
        await trackTierChange(organization.subscription.id, newTierId, organization.subscription.paddle_subscription_id);
        console.log(`🔒 Tier change tracked in Redis - webhooks with old tier will be ignored for 90 seconds`);
        
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
        
        // Validate that org's current usage fits within the new (lower) tier's limits
        const validation = await this.validateDowngrade(organizationId, newTierId);
        if (!validation.allowed) {
            const err: any = new Error('Cannot downgrade: usage exceeds new tier limits');
            err.code = 'DOWNGRADE_BLOCKED';
            err.violations = validation.violations;
            throw err;
        }
        
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
            
            // Track this tier change to prevent race condition with webhooks
            const { trackTierChange } = await import('../routes/paddle-webhook.js');
            await trackTierChange(organization.subscription!.id, newTierId, organization.subscription!.paddle_subscription_id!);
            console.log(`🔒 Tier change tracked in Redis - webhooks with old tier will be ignored for 90 seconds`);
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
        
        // DO NOT set cancelled_at here - wait for webhook confirmation
        // Paddle will send subscription.canceled webhook which will set cancelled_at
        // This ensures local state only reflects confirmed Paddle state
        
        // Log cancellation request (not confirmed until webhook received)
        console.log(`⚠️ Cancellation requested for org ${organizationId}. Waiting for Paddle webhook confirmation. Reason: ${reason || 'Not provided'}`);
        
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
        billingCycle?: 'monthly' | 'annual',
        discountId?: string
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
        const isDowngrade = this.isDowngrade(currentTier, newTier);
        
        // CRITICAL VALIDATION: Prevent free tier upgrade without payment
        // Check BEFORE any database changes to prevent unpaid upgrades
        const hasPaddleSubscription = !!organization.subscription.paddle_subscription_id;
        const isFreeTier = (tier: DRASubscriptionTier) => tier.tier_rank === 0;
        const isUpgradeToPaidTier = isFreeTier(currentTier) && !isFreeTier(newTier);
        const isPaidToPaidWithoutSubscription = !isFreeTier(currentTier) && !isFreeTier(newTier) && !hasPaddleSubscription;
        
        if (isUpgradeToPaidTier && !hasPaddleSubscription) {
            console.log(`🛑 Blocking FREE → ${newTier.tier_name} upgrade without payment. Redirecting to checkout.`);
            throw new Error('SUBSCRIPTION_CANCELED_USE_CHECKOUT');
        }
        
        if (isPaidToPaidWithoutSubscription) {
            console.log(`🛑 Blocking ${currentTier.tier_name} → ${newTier.tier_name} tier change without active subscription. Redirecting to checkout.`);
            throw new Error('SUBSCRIPTION_CANCELED_USE_CHECKOUT');
        }
        
        // Create downgrade tracking record if applicable
        if (isDowngrade) {
            // Validate usage fits within the new lower tier before proceeding
            const validation = await this.validateDowngrade(organizationId, newTierId);
            if (!validation.allowed) {
                const err: any = new Error('Cannot downgrade: usage exceeds new tier limits');
                err.code = 'DOWNGRADE_BLOCKED';
                err.violations = validation.violations;
                throw err;
            }

            await this.createDowngradeRequestFromTierChange(
                organizationId,
                userId,
                currentTier.tier_name,
                newTier.tier_name
            );
            console.log(`📊 Downgrade tracked: ${currentTier.tier_name} → ${newTier.tier_name}`);
        }
        
        // Check if organization has an active Paddle subscription
        
        // If we have a Paddle subscription ID, verify it's actually active
        if (hasPaddleSubscription) {
            try {
                const paddle = PaddleService.getInstance();
                const paddleSubscription = await paddle.getSubscription(organization.subscription.paddle_subscription_id);
                
                // Check if subscription is canceled or inactive
                if (paddleSubscription.status === 'canceled' || paddleSubscription.status === 'past_due') {
                    console.log(`⚠️ Paddle subscription ${organization.subscription.paddle_subscription_id} is ${paddleSubscription.status}. Clearing from database.`);
                    
                    // Clear the paddle_subscription_id from database
                    organization.subscription.paddle_subscription_id = null;
                    await manager.save(organization.subscription);
                    
                    // Throw specific error that frontend can catch
                    throw new Error('SUBSCRIPTION_CANCELED_USE_CHECKOUT');
                }
            } catch (error: any) {
                // If subscription not found in Paddle, clear it from database
                if (error.message.includes('not found') || error.message.includes('404')) {
                    console.log(`⚠️ Paddle subscription ${organization.subscription.paddle_subscription_id} not found. Clearing from database.`);
                    organization.subscription.paddle_subscription_id = null;
                    await manager.save(organization.subscription);
                    throw new Error('SUBSCRIPTION_CANCELED_USE_CHECKOUT');
                }
                
                // Re-throw SUBSCRIPTION_CANCELED_USE_CHECKOUT as-is
                if (error.message === 'SUBSCRIPTION_CANCELED_USE_CHECKOUT') {
                    throw error;
                }
                
                // For other Paddle API errors, log and continue
                console.error(`⚠️ Failed to check Paddle subscription status:`, error.message);
            }
        }
        
        // Special handling for downgrade to Free tier
        if (newTier.tier_name === 'free') {
            // Cancel Paddle subscription if it exists
            if (hasPaddleSubscription && organization.subscription.paddle_subscription_id) {
                console.log(`🔄 Cancelling Paddle subscription for Org ${organizationId} (downgrade to Free)`);
                const paddle = PaddleService.getInstance();
                try {
                    await paddle.cancelSubscription(
                        organization.subscription.paddle_subscription_id,
                        'immediately' // Cancel immediately for admin-initiated downgrades to free
                    );
                    console.log(`✅ Paddle subscription cancelled`);
                } catch (cancelError: any) {
                    console.error(`⚠️ Failed to cancel Paddle subscription:`, cancelError);
                    // Continue anyway - we'll clear the ID from database
                }
                
                // Clear Paddle subscription ID from database since subscription is cancelled
                console.log(`🗑️ Clearing paddle_subscription_id from database`);
                organization.subscription.paddle_subscription_id = null;
                organization.subscription.is_active = false;
            } else {
                console.log(`📝 Direct database update for Org ${organizationId} (changing to Free, no Paddle subscription)`);
            }
        }
        
        // Update local database FIRST (before Paddle API call to avoid race condition with webhook)
        console.log(`📝 Updating database: Org ${organizationId}`);
        console.log(`📝 Current tier: ${organization.subscription.subscription_tier?.tier_name} (ID: ${organization.subscription.subscription_tier_id})`);
        console.log(`📝 New tier: ${newTier.tier_name} (ID: ${newTierId})`);
        
        organization.subscription.subscription_tier_id = newTierId;
        organization.subscription.subscription_tier = newTier;
        
        // Update billing cycle if provided (e.g., admin changing from monthly to annual)
        if (billingCycle && billingCycle !== organization.subscription.billing_cycle) {
            console.log(`🔄 Updating billing cycle: ${organization.subscription.billing_cycle} → ${billingCycle}`);
            organization.subscription.billing_cycle = billingCycle;
        }
        
        console.log(`💾 Saving subscription to database...`);
        try {
            const savedSubscription = await manager.save(organization.subscription);
            console.log(`✅ Database saved successfully!`);
            console.log(`✅ Saved tier ID: ${savedSubscription.subscription_tier_id}, tier name: ${savedSubscription.subscription_tier?.tier_name}`);
            
            // Verify the save by fetching back from database
            const verification = await manager.findOne(DRAOrganizationSubscription, {
                where: { id: savedSubscription.id },
                relations: ['subscription_tier']
            });
            console.log(`🔍 Verification: DB now shows tier "${verification?.subscription_tier?.tier_name}" (ID: ${verification?.subscription_tier_id})`);
            
            if (verification?.subscription_tier_id !== newTierId) {
                console.error(`❌ CRITICAL: Database save verification failed! Expected ${newTierId}, got ${verification?.subscription_tier_id}`);
                throw new Error('Database save verification failed - tier did not persist');
            }
            
            // Track this tier change to prevent race condition with webhooks
            // This prevents webhooks with stale tier data from reverting the database
            if (hasPaddleSubscription && organization.subscription.paddle_subscription_id) {
                const { trackTierChange } = await import('../routes/paddle-webhook.js');
                await trackTierChange(savedSubscription.id, newTierId, organization.subscription.paddle_subscription_id);
                console.log(`🔒 Tier change tracked in Redis - webhooks with old tier will be ignored for 90 seconds`);
            }
        } catch (saveError: any) {
            console.error(`❌ Failed to save subscription to database:`, saveError);
            throw new Error(`Database save failed: ${saveError.message}`);
        }
        
        // Now update Paddle subscription (after database is updated)
        if (newTier.tier_name !== 'free' && hasPaddleSubscription && organization.subscription.paddle_subscription_id) {
            // Route A: Update via Paddle API with automatic proration (paid tier to paid tier)
            console.log(`🔄 Updating Paddle subscription for Org ${organizationId}`);
            
            // Get appropriate Paddle price ID based on provided or current billing cycle
            const targetBillingCycle = billingCycle || organization.subscription.billing_cycle || 'monthly';
            const newPriceId = targetBillingCycle === 'monthly' 
                ? newTier.paddle_price_id_monthly 
                : newTier.paddle_price_id_annual;
            
            if (!newPriceId) {
                throw new Error(`No Paddle price ID configured for ${newTier.tier_name} (${targetBillingCycle})`);
            }
            
            console.log(`📤 Sending to Paddle: price ID ${newPriceId} for tier ${newTier.tier_name} (${targetBillingCycle})`);
            
            // Update subscription in Paddle with proration
            const paddle = PaddleService.getInstance();
            try {
                await paddle.updateSubscription(
                    organization.subscription.paddle_subscription_id,
                    newPriceId,
                    discountId
                );
                console.log(`✅ Paddle subscription updated with proration`);
            } catch (paddleError: any) {
                console.error(`❌ Failed to update Paddle subscription:`, paddleError);
                // Database is already updated - log error but don't fail the tier change
                // The webhook should eventually sync if Paddle update succeeds later
                console.warn(`⚠️ Database updated but Paddle API call failed. Webhook will sync if Paddle processes the update.`);
            }
        }
        
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
    private async validateDowngrade(
        organizationId: number,
        newTierId: number
    ): Promise<{ allowed: boolean; violations: string[] }> {
        const manager = AppDataSource.manager;
        const violations: string[] = [];

        const newTier = await manager.findOneOrFail(DRASubscriptionTier, { where: { id: newTierId } });

        // Projects
        const projectCount = await manager.count(DRAProject, { where: { organization_id: organizationId } });
        if (newTier.max_projects !== null && newTier.max_projects !== -1 && projectCount > newTier.max_projects) {
            violations.push(
                `You have ${projectCount} project(s) but the ${newTier.tier_name} plan allows ${newTier.max_projects}. Please delete ${projectCount - newTier.max_projects} project(s) before downgrading.`
            );
        }

        // Members (exclude owner from count - owner always exists and doesn't count against limit)
        const memberCount = await manager.count(DRAOrganizationMember, {
            where: { 
                organization_id: organizationId, 
                is_active: true,
                role: In(['admin', 'member']) // Only count admins and members, not the owner
            },
        });
        const memberLimit = newTier.max_members_per_project; // reuse closest field; replace if a dedicated column exists
        if (memberLimit !== null && memberLimit !== -1 && memberCount > memberLimit) {
            violations.push(
                `You have ${memberCount} additional member(s) but the ${newTier.tier_name} plan allows ${memberLimit}. Please remove members before downgrading.`
            );
        }

        return { allowed: violations.length === 0, violations };
    }

    /**
     * Check if target tier is a downgrade from current tier
     * Uses numeric tier_rank field for comparison (higher rank = better tier)
     * 
     * @param currentTier - Current subscription tier entity
     * @param newTier - Target subscription tier entity
     * @returns true if newTier rank < currentTier rank
     */
    private isDowngrade(currentTier: DRASubscriptionTier, newTier: DRASubscriptionTier): boolean {
        return newTier.tier_rank < currentTier.tier_rank;
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
     * Preview upgrade cost for organization owner
     * 
     * Called before showing confirmation modal to display exact charge amount.
     * Validates:
     * - Organization has active Paddle subscription
     * - Target tier is higher than current
     * - User is organization owner
     * 
     * @param organizationId - Organization ID
     * @param newTierId - Target tier ID
     * @param userId - User requesting (must be owner)
     * @param billingCycle - Selected billing cycle from UI toggle
     * @returns Proration details from Paddle
     */
    async previewUpgrade(
        organizationId: number,
        newTierId: number,
        userId: number,
        billingCycle: 'monthly' | 'annual',
        discountId?: string
    ): Promise<{
        currentTier: string;
        newTier: string;
        currentBillingCycle: string;
        newBillingCycle: string;
        billingCycleChanging: boolean;
        immediateCharge: string | null;
        currency: string;
        nextBillingAmount: string;
        nextBillingDate: string;
        discountApplied?: any;
    }> {
        const manager = AppDataSource.manager;
        
        console.log(`[previewUpgrade] Starting for Org ${organizationId}, Tier ${newTierId}, User ${userId}`);
        
        try {
            // Get organization with subscription and members
            const organization = await manager.findOneOrFail(DRAOrganization, {
                where: { id: organizationId },
                relations: ['subscription', 'subscription.subscription_tier', 'members']
            });
            
            console.log('[previewUpgrade] Organization loaded:', {
                orgId: organization.id,
                hasSubscription: !!organization.subscription,
                subscriptionTierId: organization.subscription?.subscription_tier_id,
                hasTierRelation: !!organization.subscription?.subscription_tier,
                paddleSubId: organization.subscription?.paddle_subscription_id
            });
            
            // Validate has Paddle subscription
            if (!organization.subscription?.paddle_subscription_id) {
                console.log('[previewUpgrade] No Paddle subscription ID, throwing SUBSCRIPTION_CANCELED_USE_CHECKOUT');
                throw new Error('SUBSCRIPTION_CANCELED_USE_CHECKOUT');
            }
            
            // Validate current tier exists
            if (!organization.subscription.subscription_tier) {
                console.error('[previewUpgrade] ERROR: subscription_tier is undefined!');
                console.error('Subscription data:', JSON.stringify(organization.subscription, null, 2));
                throw new Error('Organization subscription tier not found');
            }
            
            // Get new tier
            const newTier = await manager.findOneOrFail(DRASubscriptionTier, {
                where: { id: newTierId }
            });
            
            console.log('[previewUpgrade] Tiers:', {
                current: organization.subscription.subscription_tier.tier_name,
                currentRank: organization.subscription.subscription_tier.tier_rank,
                new: newTier.tier_name,
                newRank: newTier.tier_rank
            });
            
            // Validate upgrade (not downgrade or lateral)
            const currentTier = organization.subscription.subscription_tier;
            if (!this.isUpgrade(currentTier, newTier)) {
                throw new Error('Target tier is not an upgrade');
            }
            
            // Get price ID for selected billing cycle (from UI toggle)
            const newPriceId = billingCycle === 'monthly'
                ? newTier.paddle_price_id_monthly
                : newTier.paddle_price_id_annual;
                
            if (!newPriceId) {
                throw new Error(`Paddle price ID not configured for ${newTier.tier_name} (${billingCycle})`);
            }
            
            // Get proration preview from Paddle
            const paddle = PaddleService.getInstance();
            const preview = await paddle.previewSubscriptionUpdate(
                organization.subscription.paddle_subscription_id,
                newPriceId,
                discountId
            );
            
            const currentBillingCycle = organization.subscription.billing_cycle || 'monthly';
            const billingCycleChanging = currentBillingCycle !== billingCycle;
            
            return {
                currentTier: currentTier.tier_name,
                newTier: newTier.tier_name,
                currentBillingCycle,
                newBillingCycle: billingCycle,
                billingCycleChanging,
                immediateCharge: preview.immediatePayment?.amount || null,
                currency: preview.immediatePayment?.currency || preview.credit?.currency || 'USD',
                nextBillingAmount: preview.nextBillingAmount,
                nextBillingDate: preview.nextBillingDate,
                discountApplied: preview.discountApplied
            };
        } catch (error: any) {
            console.error('[previewUpgrade] Error:', error.message);
            console.error('[previewUpgrade] Stack:', error.stack);
            throw error;
        }
    }
    
    /**
     * Execute upgrade after user confirms proration
     * 
     * Similar to changeTier but specifically for self-service owner upgrades.
     * Assumes validation already done in previewUpgrade.
     * 
     * @param organizationId - Organization ID
     * @param newTierId - Target tier ID  
     * @param userId - User confirming (must be owner)
     * @param billingCycle - Selected billing cycle from UI
     * @returns Updated subscription
     */
    async executeUpgrade(
        organizationId: number,
        newTierId: number,
        userId: number,
        billingCycle: 'monthly' | 'annual',
        discountId?: string
    ): Promise<DRAOrganizationSubscription> {
        const manager = AppDataSource.manager;
        
        const organization = await manager.findOneOrFail(DRAOrganization, {
            where: { id: organizationId },
            relations: ['members']
        });
        
        // Validate user is owner
        const memberRole = organization.members.find(m => m.users_platform_id === userId)?.role;
        if (memberRole !== 'owner') {
            throw new Error('Only organization owner can upgrade subscription');
        }
        
        // Use existing changeTier method with billing cycle parameter
        return this.changeTier(organizationId, newTierId, userId, billingCycle, discountId);
    }
    
    /**
     * Validate payment method is valid and not expired
     * 
     * Fetches payment method from Paddle and checks expiry date.
     * Returns validation status + expiry info.
     * 
     * @param organizationId - Organization ID
     * @returns Validation result with details
     */
    async validatePaymentMethod(organizationId: number): Promise<{
        isValid: boolean;
        reason?: string;
        expiryMonth?: number;
        expiryYear?: number;
        last4?: string;
        brand?: string;
    }> {
        const manager = AppDataSource.manager;
        
        const organization = await manager.findOneOrFail(DRAOrganization, {
            where: { id: organizationId },
            relations: ['subscription', 'subscription.subscription_tier']
        });
        
        // Check if subscription has Paddle subscription ID
        if (organization.subscription?.paddle_subscription_id) {
            // Check if the subscription is actually active
            try {
                const paddle = PaddleService.getInstance();
                const paddleSubscription = await paddle.getSubscription(organization.subscription.paddle_subscription_id);
                
                // If subscription is canceled, return as invalid (but without showing payment warning)
                if (paddleSubscription.status === 'canceled' || paddleSubscription.status === 'past_due') {
                    console.log(`[validatePaymentMethod] Subscription ${organization.subscription.paddle_subscription_id} is ${paddleSubscription.status}`);
                    // Don't validate payment for canceled subscriptions - they'll use checkout
                    return { isValid: false, reason: 'Subscription canceled' };
                }
            } catch (error: any) {
                console.log(`[validatePaymentMethod] Failed to check subscription:`, error.message);
                // If subscription not found, it's likely canceled
                return { isValid: false, reason: 'Subscription not found' };
            }
        } else {
            // No paddle_subscription_id - check if they're on a paid tier
            const currentTierName = organization.subscription?.subscription_tier?.tier_name;
            if (currentTierName && currentTierName !== 'free') {
                console.log(`[validatePaymentMethod] Organization on paid tier "${currentTierName}" but no Paddle subscription ID`);
                return { isValid: false, reason: 'No active subscription' };
            }
        }
        
        // Check has Paddle customer ID
        if (!organization.subscription?.paddle_customer_id) {
            return { isValid: false, reason: 'No payment method on file' };
        }
        
        // Get payment method from Paddle
        const paddle = PaddleService.getInstance();
        try {
            const customer = await paddle.getCustomer(organization.subscription.paddle_customer_id);
            const paymentMethod = (customer as any).payment_method || (customer as any).paymentMethod;
            
            if (!paymentMethod) {
                return { isValid: false, reason: 'No payment method on file' };
            }
            
            const card = paymentMethod.card || (paymentMethod as any).Card;
            if (!card) {
                // Non-card payment method (PayPal, etc.) - assume valid
                return { isValid: true };
            }
            
            // Check expiry
            const expiryMonth = card.expiry_month || card.expiryMonth;
            const expiryYear = card.expiry_year || card.expiryYear;
            const now = new Date();
            const currentYear = now.getFullYear();
            const currentMonth = now.getMonth() + 1;
            
            const isExpired = expiryYear < currentYear || 
                (expiryYear === currentYear && expiryMonth < currentMonth);
            
            if (isExpired) {
                return {
                    isValid: false,
                    reason: 'Payment method has expired',
                    expiryMonth,
                    expiryYear,
                    last4: card.last4 || card.lastFour,
                    brand: card.brand || card.type
                };
            }
            
            return {
                isValid: true,
                expiryMonth,
                expiryYear,
                last4: card.last4 || card.lastFour,
                brand: card.brand || card.type
            };
            
        } catch (error: any) {
            console.error('Error validating payment method:', error);
            return { isValid: false, reason: 'Unable to validate payment method' };
        }
    }
    
    /**
     * Helper: Check if tier change is an upgrade
     * 
     * @param currentTier - Current tier name
     * @param newTier - Target tier name
     * @returns True if upgrade, false if downgrade or lateral
    /**
     * Check if target tier is an upgrade from current tier
     * Uses numeric tier_rank field for comparison (higher rank = better tier)
     * 
     * @param currentTier - Current subscription tier entity
     * @param newTier - Target subscription tier entity
     * @returns true if newTier rank > currentTier rank
     */
    private isUpgrade(currentTier: DRASubscriptionTier, newTier: DRASubscriptionTier): boolean {
        return newTier.tier_rank > currentTier.tier_rank;
    }
    
    /**
    /**
     * Handle failed payment - start grace period
     *
     * Reads the configured grace_period_days from the subscription tier (default 14).
     * Permanent failure codes (card-level declines) get half the grace period since
     * the user must take action rather than waiting for an automatic retry.
     *
     * @param subscriptionId - Paddle subscription ID
     * @param failureCode    - Optional Paddle error code from the webhook payload
     * @returns Updated subscription
     */
    async handleFailedPayment(subscriptionId: string, failureCode?: string): Promise<DRAOrganizationSubscription> {
        const manager = AppDataSource.manager;

        const subscription = await manager.findOneOrFail(DRAOrganizationSubscription, {
            where: { paddle_subscription_id: subscriptionId },
            relations: ['organization', 'subscription_tier'],
        });

        // Failure codes that are typically transient (automatic retry may succeed)
        const TEMPORARY_CODES = [
            'insufficient_funds', 'do_not_honor', 'transaction_not_allowed',
            'bank_declined', 'issuer_unavailable',
        ];
        const isPermanent = failureCode !== undefined && !TEMPORARY_CODES.includes(failureCode);

        // Use tier-specific grace period (falls back to 14 days if column not yet present)
        const basePeriod = subscription.subscription_tier?.grace_period_days ?? 14;
        const gracePeriodDays = isPermanent ? Math.max(7, Math.floor(basePeriod / 2)) : basePeriod;

        const gracePeriodEnds = new Date();
        gracePeriodEnds.setDate(gracePeriodEnds.getDate() + gracePeriodDays);

        subscription.last_payment_failed_at = new Date();
        subscription.grace_period_ends_at = gracePeriodEnds;
        subscription.payment_failure_code = failureCode ?? null;
        subscription.payment_retry_count = (subscription.payment_retry_count ?? 0) + 1;

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

        console.log(`⚠️ Payment failed for subscription ${subscriptionId}. Code: ${failureCode ?? 'none'}. Grace period: ${gracePeriodDays} days (until ${gracePeriodEnds.toISOString()})`);

        // Admin alert (rate-limited — suppressed if already sent within cooldown window)
        PaymentAlertService.getInstance().alertOrg('payment_failed', subscription.organization_id, {
            paddle_subscription_id: subscriptionId,
            failure_code: failureCode ?? 'unknown',
            retry_count: subscription.payment_retry_count,
            grace_period_ends: gracePeriodEnds.toISOString(),
            tier: subscription.subscription_tier?.tier_name ?? 'unknown',
        }).catch(err => console.error('[SubscriptionProcessor] PaymentAlertService error:', err));

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

            // Admin alert for each org downgraded
            PaymentAlertService.getInstance().alertOrg('grace_period_expired', subscription.organization_id, {
                downgraded_to: 'free',
            }).catch(err => console.error('[SubscriptionProcessor] PaymentAlertService grace_period_expired error:', err));
        }
        
        return expiredSubscriptions.length;
    }
    
    /**
     * Process expired cancelled subscriptions
     * 
     * Finds subscriptions that were cancelled (cancelled_at IS NOT NULL) and have
     * passed their end date (ends_at < NOW()), then downgrades them to FREE tier.
     * 
     * This handles the case where a user cancels their subscription but continues
     * to have access until the end of their billing period. After ends_at passes,
     * they should be automatically downgraded to FREE.
     * 
     * Should be run daily by a cron job.
     * 
     * @returns Number of subscriptions downgraded
     */
    async processExpiredCancelledSubscriptions(): Promise<number> {
        const manager = AppDataSource.manager;
        
        // Find subscriptions that were cancelled and have expired
        const expiredSubscriptions = await manager
            .createQueryBuilder(DRAOrganizationSubscription, 'sub')
            .leftJoinAndSelect('sub.organization', 'org')
            .leftJoinAndSelect('sub.subscription_tier', 'tier')
            .where('sub.cancelled_at IS NOT NULL')
            .andWhere('sub.ends_at < NOW()')
            .andWhere('sub.is_active = true')
            .getMany();
            
        console.log(`   🔍 Found ${expiredSubscriptions.length} expired cancelled subscriptions to process`);
        
        for (const subscription of expiredSubscriptions) {
            const oldTierName = subscription.subscription_tier?.tier_name || 'Unknown';
            
            // Find FREE tier (use tier_rank = 0 to handle both 'free' and other FREE tier names)
            const freeTier = await manager.findOne(DRASubscriptionTier, {
                where: { tier_rank: 0 },
                order: { id: 'ASC' }
            });
            
            if (!freeTier) {
                console.error(`   ❌ Could not find FREE tier for organization ${subscription.organization_id}`);
                continue;
            }
            
            // Downgrade to FREE tier
            subscription.subscription_tier_id = freeTier.id;
            subscription.is_active = false;
            
            await manager.save(subscription);
            
            // Send notification email
            const ownerEmail = subscription.organization.settings?.owner_email || '';
            const ownerName = subscription.organization.settings?.owner_name || subscription.organization.name;
            
            if (ownerEmail) {
                const oldTierDetails = {
                    maxProjects: subscription.subscription_tier?.max_projects?.toString() || 'Unlimited',
                    maxDataSources: subscription.subscription_tier?.max_data_sources_per_project?.toString() || 'Unlimited',
                    maxDashboards: subscription.subscription_tier?.max_dashboards?.toString() || 'Unlimited',
                    aiGenerationsPerMonth: subscription.subscription_tier?.ai_generations_per_month?.toString() || 'Unlimited'
                };
                
                const newTierDetails = {
                    maxProjects: freeTier.max_projects?.toString() || '1',
                    maxDataSources: freeTier.max_data_sources_per_project?.toString() || '2',
                    maxDashboards: freeTier.max_dashboards?.toString() || '2',
                    aiGenerationsPerMonth: freeTier.ai_generations_per_month?.toString() || '5'
                };
                
                try {
                    await EmailService.getInstance().sendDowngradedToFree(
                        ownerEmail,
                        ownerName,
                        oldTierName.toUpperCase(),
                        oldTierDetails,
                        newTierDetails
                    );
                    console.log(`   📧 Sent downgrade notification to ${ownerEmail}`);
                } catch (emailError) {
                    console.error(`   ❌ Failed to send email to ${ownerEmail}:`, emailError);
                }
            }
            
            console.log(`   ✅ Downgraded organization ${subscription.organization_id} (${subscription.organization.name}) from ${oldTierName} to FREE after subscription expired`);

            // Admin alert for each org downgraded
            PaymentAlertService.getInstance().alertOrg('subscription_expired_downgraded', subscription.organization_id, {
                old_tier: oldTierName,
                downgraded_to: freeTier.tier_name,
                cancelled_at: subscription.cancelled_at?.toISOString(),
                ended_at: subscription.ends_at?.toISOString()
            }).catch(err => console.error('[SubscriptionProcessor] PaymentAlertService subscription_expired_downgraded error:', err));
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
        
        if (!organization.subscription?.paddle_subscription_id) {
            throw new Error('No active Paddle subscription found');
        }
        
        const paddle = PaddleService.getInstance();
        
        // Get subscription from Paddle to access management URLs
        try {
            const paddleSubscription = await paddle.getSubscription(
                organization.subscription.paddle_subscription_id
            );
            
            // Return the update payment method URL from Paddle
            return paddleSubscription.managementUrls?.updatePaymentMethod;
        } catch (error: any) {
            console.error('Failed to get Paddle subscription:', error);
            throw new Error('Failed to generate billing portal URL');
        }
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
        
        // Fetch invoice URLs for transactions that have invoices
        const transactionsWithInvoices = await Promise.all(
            transactionsArray.map(async (txn: any) => {
                let invoiceUrl: string | null = null;
                
                // If transaction has an invoiceId, fetch the invoice to get PDF URL
                if (txn.invoiceId) {
                    try {
                        const invoice = await paddle.getInvoice(txn.invoiceId);
                        if (invoice?.pdfUrl) {
                            invoiceUrl = invoice.pdfUrl;
                        }
                    } catch (error) {
                        console.error(`Failed to fetch invoice ${txn.invoiceId}:`, error);
                    }
                }
                
                return {
                    ...txn,
                    invoice_url: invoiceUrl
                };
            })
        );
        
        const paddleRows = transactionsWithInvoices.map((txn: any) => {
            return {
                id: txn.id,
                created_at: txn.created_at || txn.createdAt,
                amount: txn.details?.totals?.total || 0,
                currency: txn.currency_code || 'USD',
                status: txn.status,
                invoice_url: txn.invoice_url, // Already fetched above
                transaction_type: 'charge' as const,
                // These will be overridden by ledger data if available
                tier_name: null as string | null,
                billing_cycle: null as string | null,
                description: null as string | null,
            };
        });

        // Merge ledger data (tier_name, billing_cycle, description, refunds/adjustments)
        try {
            const ledgerRows = await manager.find(DRAPaymentTransaction, {
                where: { organization_id: organizationId },
                order: { created_at: 'DESC' },
            });

            // Build a map of paddle_transaction_id → ledger row for fast lookup
            const ledgerMap = new Map(
                ledgerRows
                    .filter(r => r.paddle_transaction_id)
                    .map(r => [r.paddle_transaction_id!, r])
            );

            // Enrich Paddle rows with local ledger data
            const enriched = paddleRows.map(row => {
                const local = ledgerMap.get(row.id);
                if (!local) return row;
                return {
                    ...row,
                    tier_name: local.tier_name ?? row.tier_name,
                    billing_cycle: local.billing_cycle ?? row.billing_cycle,
                    description: local.description ?? row.description,
                    transaction_type: local.transaction_type ?? row.transaction_type,
                    // Prefer ledger invoice URL (captured from webhook) over Paddle API URL
                    invoice_url: local.paddle_invoice_url ?? row.invoice_url,
                };
            });

            // Append ledger-only rows (adjustments/refunds not in Paddle transaction list)
            const paddleIds = new Set(paddleRows.map(r => r.id));
            const adjustmentRows = ledgerRows
                .filter(r => r.paddle_transaction_id && !paddleIds.has(r.paddle_transaction_id))
                .map(r => ({
                    id: r.paddle_transaction_id as string,
                    created_at: r.created_at?.toISOString() ?? null,
                    amount: Number(r.amount),
                    currency: r.currency,
                    status: r.status,
                    invoice_url: r.paddle_invoice_url ?? null,
                    transaction_type: r.transaction_type,
                    tier_name: r.tier_name,
                    billing_cycle: r.billing_cycle,
                    description: r.description,
                }));

            return [...enriched, ...adjustmentRows];
        } catch (ledgerErr) {
            console.error('[getPaymentHistory] Failed to merge ledger data (returning raw Paddle data):', ledgerErr);
            return paddleRows;
        }
    }
    
    /**
     * Sync subscription from Paddle
     * 
     * Fetches current subscription state from Paddle and updates database to match.
     * Useful for fixing sync issues when database and Paddle are out of sync.
     * 
     * @param organizationId - Organization ID
     * @param userId - User ID (must be organization owner)
     * @returns Updated subscription with sync details
     */
    async syncSubscriptionFromPaddle(
        organizationId: number,
        userId: number
    ): Promise<{
        subscription: DRAOrganizationSubscription;
        wasDifferent: boolean;
        changes: string[];
    }> {
        const manager = AppDataSource.manager;
        
        // Load organization
        const organization = await manager.findOneOrFail(DRAOrganization, {
            where: { id: organizationId },
            relations: ['subscription', 'subscription.subscription_tier', 'members']
        });
        
        // Validate user is owner
        const memberRole = organization.members.find(m => m.users_platform_id === userId)?.role;
        if (memberRole !== 'owner') {
            throw new Error('Only organization owner can sync subscription');
        }
        
        if (!organization.subscription) {
            throw new Error('Organization has no subscription record');
        }
        
        if (!organization.subscription.paddle_subscription_id) {
            throw new Error('Organization has no Paddle subscription ID');
        }
        
        console.log(`🔄 [syncFromPaddle] Fetching Paddle subscription: ${organization.subscription.paddle_subscription_id}`);
        
        // Fetch current state from Paddle
        const paddle = PaddleService.getInstance();
        const paddleSubscription = await paddle.getSubscription(organization.subscription.paddle_subscription_id);
        
        console.log(`📦 [syncFromPaddle] Paddle subscription status: ${paddleSubscription.status}`);
        console.log(`📦 [syncFromPaddle] Paddle items:`, paddleSubscription.items);
        
        // Extract price ID from Paddle subscription
        const paddlePriceId = paddleSubscription.items?.[0]?.price?.id;
        if (!paddlePriceId) {
            throw new Error('Could not extract price ID from Paddle subscription');
        }
        
        console.log(`🔍 [syncFromPaddle] Paddle price ID: ${paddlePriceId}`);
        
        // Find tier matching this price ID
        const matchingTier = await manager.findOne(DRASubscriptionTier, {
            where: [
                { paddle_price_id_monthly: paddlePriceId },
                { paddle_price_id_annual: paddlePriceId }
            ]
        });
        
        if (!matchingTier) {
            throw new Error(`No tier found in database matching Paddle price ID: ${paddlePriceId}`);
        }
        
        console.log(`✅ [syncFromPaddle] Found matching tier: ${matchingTier.tier_name} (ID: ${matchingTier.id})`);
        
        // Detect changes
        const changes: string[] = [];
        let wasDifferent = false;
        
        // Check tier mismatch
        if (organization.subscription.subscription_tier_id !== matchingTier.id) {
            const oldTier = organization.subscription.subscription_tier?.tier_name || 'unknown';
            changes.push(`Tier: ${oldTier} → ${matchingTier.tier_name}`);
            wasDifferent = true;
            
            console.log(`🔄 [syncFromPaddle] Tier mismatch! DB: ${oldTier}, Paddle: ${matchingTier.tier_name}`);
            
            organization.subscription.subscription_tier_id = matchingTier.id;
            organization.subscription.subscription_tier = matchingTier;
        }
        
        // Check billing cycle
        const isMonthly = matchingTier.paddle_price_id_monthly === paddlePriceId;
        const paddleBillingCycle = isMonthly ? 'monthly' : 'annual';
        
        if (organization.subscription.billing_cycle !== paddleBillingCycle) {
            changes.push(`Billing cycle: ${organization.subscription.billing_cycle} → ${paddleBillingCycle}`);
            wasDifferent = true;
            
            console.log(`🔄 [syncFromPaddle] Billing cycle mismatch! DB: ${organization.subscription.billing_cycle}, Paddle: ${paddleBillingCycle}`);
            
            organization.subscription.billing_cycle = paddleBillingCycle;
        }
        
        // Update status if needed
        const isActive = paddleSubscription.status === 'active';
        if (organization.subscription.is_active !== isActive) {
            changes.push(`Active status: ${organization.subscription.is_active} → ${isActive}`);
            wasDifferent = true;
            organization.subscription.is_active = isActive;
        }
        
        // Save changes if any
        if (wasDifferent) {
            console.log(`💾 [syncFromPaddle] Saving changes to database...`);
            await manager.save(organization.subscription);
            console.log(`✅ [syncFromPaddle] Database updated successfully!`);
        } else {
            console.log(`✅ [syncFromPaddle] Database already in sync with Paddle`);
        }
        
        return {
            subscription: organization.subscription,
            wasDifferent,
            changes
        };
    }
}
