# Paddle Payment Integration — Implementation Plan

**Created:** April 4, 2026  
**Status:** Planning Phase  
**Platform:** Paddle.com Payment Gateway

## Overview
Integration of Paddle.com payment gateway into the Data Research Analysis Platform with organization-level subscriptions, self-service billing management, and tier enforcement.

### Key Decisions
- **Paddle Fields:** Replace Stripe field names with Paddle-specific fields (`paddle_subscription_id`, `paddle_customer_id`)
- **Checkout Method:** Paddle Overlay (modal on our domain)
- **Price ID Storage:** Database (`dra_subscription_tiers` table)
- **Billing Cycles:** Both monthly and annual
- **Free Tier:** Never requires payment (current behavior maintained)
- **Self-Service:** Full subscription management (upgrade, downgrade, cancel, payment method)
- **Failed Payments:** 14-day grace period, then downgrade to FREE
- **Environment Toggle:** `PADDLE_ENVIRONMENT` environment variable (sandbox|production)
- **Trial Periods:** No separate trials (FREE tier serves as trial)
- **Webhook Processing:** Synchronous processing in webhook handler
- **Tier Changes:** Immediate with prorated billing via Paddle
- **Multi-Org Billing:** Separate subscription per organization
- **Cancellation:** Access continues until end of paid period, then downgrade to FREE

---

## Phase 1: Database & Model Updates

### Issue #1: Database Migration — Add Paddle Fields
**Priority:** P0 (Blocking)  
**Size:** Small  
**Dependencies:** None

**Changes:**
- **Create migration:** `backend/src/migrations/XXXXXX-AddPaddleFieldsToSubscriptions.ts`
  - Rename `stripe_subscription_id` → `paddle_subscription_id`
  - Rename `stripe_customer_id` → `paddle_customer_id`
  - Add `paddle_transaction_id` (varchar 100, nullable)
  - Add `paddle_update_url` (text, nullable) — URL for customer billing portal
  - Add `billing_cycle` enum ('monthly', 'annual')
  - Add `grace_period_ends_at` (timestamp, nullable) — for failed payment handling
  - Add `last_payment_failed_at` (timestamp, nullable)

- **Update model:** `backend/src/models/DRAOrganizationSubscription.ts`
  - Update column names and types to match migration
  - Add interfaces for type safety

**Migration Example:**
```typescript
public async up(queryRunner: QueryRunner): Promise<void> {
    // Rename Stripe fields to Paddle
    await queryRunner.renameColumn('dra_organization_subscriptions', 'stripe_subscription_id', 'paddle_subscription_id');
    await queryRunner.renameColumn('dra_organization_subscriptions', 'stripe_customer_id', 'paddle_customer_id');
    
    // Add new Paddle-specific fields
    await queryRunner.addColumn('dra_organization_subscriptions', new TableColumn({
        name: 'paddle_transaction_id',
        type: 'varchar',
        length: '100',
        isNullable: true
    }));
    
    await queryRunner.addColumn('dra_organization_subscriptions', new TableColumn({
        name: 'paddle_update_url',
        type: 'text',
        isNullable: true
    }));
    
    await queryRunner.addColumn('dra_organization_subscriptions', new TableColumn({
        name: 'billing_cycle',
        type: 'enum',
        enum: ['monthly', 'annual'],
        default: "'annual'"
    }));
    
    await queryRunner.addColumn('dra_organization_subscriptions', new TableColumn({
        name: 'grace_period_ends_at',
        type: 'timestamp',
        isNullable: true
    }));
    
    await queryRunner.addColumn('dra_organization_subscriptions', new TableColumn({
        name: 'last_payment_failed_at',
        type: 'timestamp',
        isNullable: true
    }));
}
```

**Testing:**
- Run migration on test database
- Verify rollback works
- Test with existing subscription data

---

### Issue #2: Add Paddle Price IDs to Subscription Tiers
**Priority:** P0 (Blocking)  
**Size:** Small  
**Dependencies:** Issue #1

**Changes:**
- **Migration:** `backend/src/migrations/XXXXXX-AddPaddlePriceIds.ts`
  - Add `paddle_price_id_monthly` (varchar 100, nullable)
  - Add `paddle_price_id_annual` (varchar 100, nullable)
  - Add `paddle_product_id` (varchar 100, nullable)

- **Update model:** `backend/src/models/DRASubscriptionTier.ts`
  - Add new fields with proper types
  - Update interfaces

**Migration Example:**
```typescript
public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.addColumn('dra_subscription_tiers', new TableColumn({
        name: 'paddle_price_id_monthly',
        type: 'varchar',
        length: '100',
        isNullable: true
    }));
    
    await queryRunner.addColumn('dra_subscription_tiers', new TableColumn({
        name: 'paddle_price_id_annual',
        type: 'varchar',
        length: '100',
        isNullable: true
    }));
    
    await queryRunner.addColumn('dra_subscription_tiers', new TableColumn({
        name: 'paddle_product_id',
        type: 'varchar',
        length: '100',
        isNullable: true
    }));
}
```

**Model Update:**
```typescript
@Column({ type: 'varchar', length: 100, nullable: true })
paddle_price_id_monthly!: string | null;

@Column({ type: 'varchar', length: 100, nullable: true })
paddle_price_id_annual!: string | null;

@Column({ type: 'varchar', length: 100, nullable: true })
paddle_product_id!: string | null;
```

- **Seed data:** Update seed to include Paddle sandbox IDs for testing

**Testing:**
- Verify admin can edit Paddle IDs via existing tier management UI
- Confirm IDs stored/retrieved correctly

---

## Phase 2: Backend Services & Infrastructure

### Issue #3: Create PaddleService — Core SDK Integration
**Priority:** P0 (Blocking)  
**Size:** Medium  
**Dependencies:** None

**File:** `backend/src/services/PaddleService.ts`

**Implementation:**
```typescript
import { Paddle } from '@paddle/paddle-node-sdk';

export class PaddleService {
    private static instance: PaddleService;
    private paddle: Paddle;
    
    private constructor() {
        const apiKey = process.env.PADDLE_API_KEY;
        const environment = process.env.PADDLE_ENVIRONMENT || 'sandbox';
        
        if (!apiKey) {
            throw new Error('PADDLE_API_KEY environment variable is required');
        }
        
        this.paddle = new Paddle(apiKey, {
            environment: environment as 'sandbox' | 'production'
        });
        
        console.log(`📘 Paddle Service initialized (${environment})`);
    }
    
    public static getInstance(): PaddleService {
        if (!PaddleService.instance) {
            PaddleService.instance = new PaddleService();
        }
        return PaddleService.instance;
    }
    
    /**
     * Create a checkout session for subscription purchase
     */
    async createCheckoutSession(
        priceId: string,
        customerId?: string,
        metadata?: Record<string, any>
    ) {
        return await this.paddle.transactions.create({
            items: [{ priceId, quantity: 1 }],
            customerId,
            customData: metadata
        });
    }
    
    /**
     * Get subscription details from Paddle
     */
    async getSubscription(subscriptionId: string) {
        return await this.paddle.subscriptions.get(subscriptionId);
    }
    
    /**
     * Cancel a subscription
     */
    async cancelSubscription(
        subscriptionId: string,
        effectiveFrom: 'immediately' | 'next_billing_period' = 'next_billing_period'
    ) {
        return await this.paddle.subscriptions.cancel(subscriptionId, {
            effectiveFrom
        });
    }
    
    /**
     * Update subscription (for upgrades/downgrades)
     */
    async updateSubscription(subscriptionId: string, priceId: string) {
        return await this.paddle.subscriptions.update(subscriptionId, {
            items: [{ priceId, quantity: 1 }],
            prorationBillingMode: 'prorated_immediately'
        });
    }
    
    /**
     * Get customer details
     */
    async getCustomer(customerId: string) {
        return await this.paddle.customers.get(customerId);
    }
    
    /**
     * Create a new customer
     */
    async createCustomer(email: string, name: string, metadata?: Record<string, any>) {
        return await this.paddle.customers.create({
            email,
            name,
            customData: metadata
        });
    }
    
    /**
     * Generate payment method update URL
     */
    async generatePaymentMethodUpdateUrl(customerId: string) {
        const transaction = await this.paddle.transactions.create({
            items: [], // Empty for payment method update
            customerId
        });
        return transaction.checkout?.url;
    }
}
```

**Environment Variables:** Add to `.env.example`:
```bash
# Paddle Payment Gateway
PADDLE_API_KEY=your_paddle_api_key
PADDLE_ENVIRONMENT=sandbox
PADDLE_WEBHOOK_SECRET=your_webhook_secret
PADDLE_VENDOR_ID=your_vendor_id
PADDLE_CLIENT_TOKEN=your_paddle_client_side_token
```

**Package Installation:**
```bash
npm install @paddle/paddle-node-sdk
```

**Testing:**
- Unit tests with mocked Paddle SDK
- Integration tests against Paddle sandbox
- Test error handling (network failures, invalid IDs)

---

### Issue #4: Create SubscriptionProcessor — Business Logic Layer
**Priority:** P0 (Blocking)  
**Size:** Large  
**Dependencies:** Issue #3

**File:** `backend/src/processors/SubscriptionProcessor.ts`

**Implementation:**
```typescript
import { AppDataSource } from '../datasources/PostgresDS.js';
import { DRAOrganizationSubscription } from '../models/DRAOrganizationSubscription.js';
import { DRASubscriptionTier } from '../models/DRASubscriptionTier.js';
import { DRAOrganization } from '../models/DRAOrganization.js';
import { PaddleService } from '../services/PaddleService.js';
import { EmailService } from '../services/EmailService.js';
import { TierEnforcementService } from '../services/TierEnforcementService.js';

export class SubscriptionProcessor {
    private static instance: SubscriptionProcessor;
    
    private constructor() {}
    
    public static getInstance(): SubscriptionProcessor {
        if (!SubscriptionProcessor.instance) {
            SubscriptionProcessor.instance = new SubscriptionProcessor();
        }
        return SubscriptionProcessor.instance;
    }
    
    /**
     * Initiate checkout for a new subscription or upgrade
     */
    async initiateCheckout(
        organizationId: number,
        tierId: number,
        billingCycle: 'monthly' | 'annual'
    ) {
        const manager = AppDataSource.manager;
        
        // Get organization and tier
        const organization = await manager.findOneOrFail(DRAOrganization, {
            where: { id: organizationId },
            relations: ['subscription', 'subscription.subscription_tier']
        });
        
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
            // Create new customer in Paddle
            const customer = await paddle.createCustomer(
                organization.settings.owner_email || '',
                organization.name,
                { organizationId }
            );
            customerId = customer.id;
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
            customerId
        };
    }
    
    /**
     * Handle successful payment from Paddle webhook
     */
    async handleSuccessfulPayment(paddleData: any) {
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
        await EmailService.getInstance().sendSubscriptionActivated(
            organization,
            tier.tier_name,
            paddleData.billing_cycle
        );
        
        return subscription;
    }
    
    /**
     * Upgrade subscription to higher tier
     */
    async upgradeSubscription(
        organizationId: number,
        newTierId: number,
        billingCycle: 'monthly' | 'annual'
    ) {
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
        await EmailService.getInstance().sendSubscriptionUpgraded(
            organization,
            currentTier.tier_name,
            newTier.tier_name
        );
        
        return organization.subscription;
    }
    
    /**
     * Downgrade subscription (validates usage first)
     */
    async downgradeSubscription(organizationId: number, newTierId: number) {
        const manager = AppDataSource.manager;
        
        // Validate usage is within new tier limits
        const canDowngrade = await TierEnforcementService.getInstance()
            .canDowngrade(organizationId, newTierId);
            
        if (!canDowngrade.allowed) {
            throw new Error(`Cannot downgrade: ${canDowngrade.reason}`);
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
            const priceId = organization.subscription.billing_cycle === 'monthly'
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
        await EmailService.getInstance().sendSubscriptionDowngraded(
            organization,
            newTier.tier_name
        );
        
        return organization.subscription;
    }
    
    /**
     * Cancel subscription (access continues until period end)
     */
    async cancelSubscription(organizationId: number, reason?: string) {
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
        console.log(`Subscription cancelled for org ${organizationId}. Reason: ${reason || 'Not provided'}`);
        
        // Send email
        await EmailService.getInstance().sendSubscriptionCancelled(
            organization,
            organization.subscription.ends_at || new Date()
        );
        
        return organization.subscription;
    }
    
    /**
     * Handle failed payment - start grace period
     */
    async handleFailedPayment(subscriptionId: string) {
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
        await EmailService.getInstance().sendPaymentFailed(
            subscription.organization,
            gracePeriodEnds
        );
        
        return subscription;
    }
    
    /**
     * Process grace period expiry (run by cron job)
     */
    async processGracePeriodExpiry() {
        const manager = AppDataSource.manager;
        
        // Find subscriptions with expired grace periods
        const expiredSubscriptions = await manager
            .createQueryBuilder(DRAOrganizationSubscription, 'sub')
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
            
            console.log(`Downgraded organization ${subscription.organization_id} to FREE after grace period`);
        }
        
        return expiredSubscriptions.length;
    }
    
    /**
     * Get billing portal URL for customer
     */
    async getBillingPortalUrl(organizationId: number) {
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
     */
    async getSubscriptionDetails(organizationId: number) {
        const manager = AppDataSource.manager;
        
        const subscription = await manager.findOne(DRAOrganizationSubscription, {
            where: { organization_id: organizationId },
            relations: ['subscription_tier']
        });
        
        return subscription;
    }
}
```

**Testing:**
- Test all subscription lifecycle events
- Test edge cases (downgrade with excess usage, failed payment during trial)
- Mock Paddle responses

---

### Issue #5: Webhook Handler — Event Processing
**Priority:** P0 (Blocking)  
**Size:** Medium  
**Dependencies:** Issue #4

**File:** `backend/src/routes/paddle-webhook.ts`

**Implementation:**
```typescript
import express, { Request, Response } from 'express';
import crypto from 'crypto';
import { SubscriptionProcessor } from '../processors/SubscriptionProcessor.js';
import { AppDataSource } from '../datasources/PostgresDS.js';
import { DRAPaddleWebhookEvent } from '../models/DRAPaddleWebhookEvent.js';

const router = express.Router();

/**
 * Verify Paddle webhook signature
 */
function verifyPaddleSignature(req: Request): boolean {
    const signature = req.headers['paddle-signature'] as string;
    const webhookSecret = process.env.PADDLE_WEBHOOK_SECRET;
    
    if (!signature || !webhookSecret) {
        return false;
    }
    
    const body = JSON.stringify(req.body);
    const hmac = crypto.createHmac('sha256', webhookSecret);
    const digest = hmac.update(body).digest('hex');
    
    return signature === digest;
}

/**
 * Paddle webhook endpoint
 * NO authentication middleware - Paddle sends these directly
 */
router.post('/webhook', async (req: Request, res: Response) => {
    const manager = AppDataSource.manager;
    
    // Verify signature
    if (!verifyPaddleSignature(req)) {
        console.error('❌ Invalid Paddle webhook signature');
        return res.status(401).json({ success: false, error: 'Invalid signature' });
    }
    
    const eventType = req.body.event_type;
    const eventData = req.body.data;
    
    // Log webhook event
    const webhookEvent = manager.create(DRAPaddleWebhookEvent, {
        event_type: eventType,
        payload: req.body,
        processed: false
    });
    
    try {
        await manager.save(webhookEvent);
    } catch (error) {
        console.error('Failed to log webhook event:', error);
    }
    
    // Check for duplicate processing (idempotency)
    if (eventData.transaction_id) {
        const existing = await manager.findOne(DRAPaddleWebhookEvent, {
            where: {
                event_type: eventType,
                processed: true,
                payload: {
                    data: { transaction_id: eventData.transaction_id }
                }
            }
        });
        
        if (existing) {
            console.log(`⚠️ Duplicate webhook event detected: ${eventType} - ${eventData.transaction_id}`);
            return res.status(200).json({ success: true, message: 'Already processed' });
        }
    }
    
    const processor = SubscriptionProcessor.getInstance();
    
    try {
        switch (eventType) {
            case 'subscription.created':
                console.log('📘 Processing subscription.created');
                await processor.handleSuccessfulPayment({
                    subscription_id: eventData.subscription_id,
                    customer_id: eventData.customer_id,
                    transaction_id: eventData.transaction_id,
                    billing_cycle: eventData.billing_period.interval,
                    next_billed_at: eventData.next_billed_at,
                    customData: eventData.custom_data
                });
                break;
                
            case 'subscription.updated':
                console.log('📘 Processing subscription.updated');
                // Handle tier changes, billing cycle changes
                // Implementation depends on what changed
                break;
                
            case 'subscription.canceled':
                console.log('📘 Processing subscription.canceled');
                // Mark subscription as cancelled
                const cancelledSub = await manager.findOne(DRAOrganizationSubscription, {
                    where: { paddle_subscription_id: eventData.subscription_id }
                });
                if (cancelledSub) {
                    cancelledSub.is_active = false;
                    cancelledSub.cancelled_at = new Date();
                    await manager.save(cancelledSub);
                }
                break;
                
            case 'subscription.payment_succeeded':
                console.log('📘 Processing subscription.payment_succeeded');
                // Clear failed payment flags
                const successSub = await manager.findOne(DRAOrganizationSubscription, {
                    where: { paddle_subscription_id: eventData.subscription_id }
                });
                if (successSub) {
                    successSub.last_payment_failed_at = null;
                    successSub.grace_period_ends_at = null;
                    await manager.save(successSub);
                }
                break;
                
            case 'subscription.payment_failed':
                console.log('📘 Processing subscription.payment_failed');
                await processor.handleFailedPayment(eventData.subscription_id);
                break;
                
            case 'customer.updated':
                console.log('📘 Processing customer.updated');
                // Sync customer data if needed
                break;
                
            default:
                console.log(`⚠️ Unhandled webhook event: ${eventType}`);
        }
        
        // Mark as processed
        webhookEvent.processed = true;
        await manager.save(webhookEvent);
        
        // Always return 200 to Paddle
        res.status(200).json({ success: true });
        
    } catch (error: any) {
        console.error(`❌ Error processing webhook ${eventType}:`, error);
        
        // Log error but still return 200 to prevent Paddle retries
        webhookEvent.error_message = error.message;
        await manager.save(webhookEvent);
        
        res.status(200).json({ success: false, error: error.message });
    }
});

export default router;
```

**Create Webhook Event Model:**
```typescript
// backend/src/models/DRAPaddleWebhookEvent.ts
import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn } from 'typeorm';

@Entity('dra_paddle_webhook_events')
export class DRAPaddleWebhookEvent {
    @PrimaryGeneratedColumn()
    id!: number;
    
    @Column({ type: 'varchar', length: 100 })
    event_type!: string;
    
    @Column({ type: 'jsonb' })
    payload!: any;
    
    @Column({ type: 'boolean', default: false })
    processed!: boolean;
    
    @Column({ type: 'text', nullable: true })
    error_message!: string | null;
    
    @CreateDateColumn({ type: 'timestamp' })
    received_at!: Date;
}
```

**Migration for Webhook Events Table:**
```typescript
public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.createTable(new Table({
        name: 'dra_paddle_webhook_events',
        columns: [
            { name: 'id', type: 'int', isPrimary: true, isGenerated: true, generationStrategy: 'increment' },
            { name: 'event_type', type: 'varchar', length: '100' },
            { name: 'payload', type: 'jsonb' },
            { name: 'processed', type: 'boolean', default: false },
            { name: 'error_message', type: 'text', isNullable: true },
            { name: 'received_at', type: 'timestamp', default: 'CURRENT_TIMESTAMP' }
        ]
    }));
    
    // Index for faster lookups
    await queryRunner.createIndex('dra_paddle_webhook_events', new TableIndex({
        name: 'IDX_paddle_webhook_event_type',
        columnNames: ['event_type']
    }));
}
```

**Mount in `backend/src/index.ts`:**
```typescript
import paddleWebhook from './routes/paddle-webhook.js';

// After other route mounts, around line 285
app.use('/paddle', paddleWebhook);
```

**Testing:**
- Test signature validation (valid, invalid, missing)
- Test each event type with Paddle sandbox webhook simulator
- Test idempotency (send same event twice)
- Verify error logging doesn't break Paddle retry mechanism

---

### Issue #6: Grace Period Cron Job
**Priority:** P1 (High)  
**Size:** Small  
**Dependencies:** Issue #4

**File:** `backend/src/jobs/subscriptionGracePeriodJob.ts`

**Implementation:**
```typescript
import { SubscriptionProcessor } from '../processors/SubscriptionProcessor.js';
import { EmailService } from '../services/EmailService.js';
import { AppDataSource } from '../datasources/PostgresDS.js';
import { DRAOrganizationSubscription } from '../models/DRAOrganizationSubscription.js';

export class SubscriptionGracePeriodJob {
    /**
     * Run daily to check for expired grace periods
     */
    static async run() {
        console.log('🔄 Running subscription grace period check...');
        
        try {
            const processor = SubscriptionProcessor.getInstance();
            const expiredCount = await processor.processGracePeriodExpiry();
            
            console.log(`✅ Processed ${expiredCount} expired grace periods`);
            
            // Also send reminders for grace periods ending soon
            await this.sendGracePeriodReminders();
            
        } catch (error) {
            console.error('❌ Error in grace period job:', error);
        }
    }
    
    /**
     * Send reminders at 7, 3, and 1 days before grace period expires
     */
    private static async sendGracePeriodReminders() {
        const manager = AppDataSource.manager;
        const now = new Date();
        
        // Calculate dates for 7, 3, and 1 days from now
        const reminderDays = [7, 3, 1];
        
        for (const days of reminderDays) {
            const targetDate = new Date(now);
            targetDate.setDate(targetDate.getDate() + days);
            
            // Find subscriptions expiring on this day (within 1 hour window)
            const startWindow = new Date(targetDate);
            startWindow.setHours(0, 0, 0, 0);
            
            const endWindow = new Date(targetDate);
            endWindow.setHours(23, 59, 59, 999);
            
            const expiringSubscriptions = await manager
                .createQueryBuilder(DRAOrganizationSubscription, 'sub')
                .leftJoinAndSelect('sub.organization', 'org')
                .where('sub.grace_period_ends_at >= :start', { start: startWindow })
                .andWhere('sub.grace_period_ends_at <= :end', { end: endWindow })
                .andWhere('sub.is_active = true')
                .getMany();
                
            for (const subscription of expiringSubscriptions) {
                await EmailService.getInstance().sendGracePeriodExpiring(
                    subscription.organization,
                    days
                );
            }
            
            console.log(`📧 Sent ${expiringSubscriptions.length} grace period reminders (${days} days)`);
        }
    }
}

// Run daily at 2 AM UTC
// Add to your cron scheduler (e.g., node-cron, Bull, etc.)
```

**Integration with Cron:**
```typescript
// In backend/src/index.ts or a dedicated scheduler file
import cron from 'node-cron';
import { SubscriptionGracePeriodJob } from './jobs/subscriptionGracePeriodJob.js';

// Run every day at 2 AM UTC
cron.schedule('0 2 * * *', async () => {
    await SubscriptionGracePeriodJob.run();
});
```

**Testing:**
- Test with manually set grace period expiry dates
- Verify email sent
- Confirm tier enforcement updates

---

## Phase 3: Frontend Integration

### Issue #7: Paddle SDK Integration — Frontend Setup
**Priority:** P0 (Blocking)  
**Size:** Small  
**Dependencies:** None

**File:** `frontend/plugins/paddle.client.ts`

**Implementation:**
```typescript
export default defineNuxtPlugin(() => {
    if (import.meta.client) {
        const config = useRuntimeConfig();
        
        // Load Paddle.js script
        const script = document.createElement('script');
        script.src = 'https://cdn.paddle.com/paddle/v2/paddle.js';
        script.async = true;
        document.head.appendChild(script);
        
        script.onload = () => {
            console.log('✅ Paddle SDK loaded');
            
            // Initialize Paddle
            // @ts-ignore - Paddle is loaded dynamically
            if (window.Paddle) {
                // @ts-ignore
                window.Paddle.Environment.set(config.public.paddleEnvironment);
                // @ts-ignore
                window.Paddle.Initialize({
                    token: config.public.paddleClientToken
                });
                
                console.log(`📘 Paddle initialized (${config.public.paddleEnvironment})`);
            }
        };
        
        script.onerror = () => {
            console.error('❌ Failed to load Paddle SDK');
        };
    }
});
```

**Add to `nuxt.config.ts`:**
```typescript
runtimeConfig: {
    public: {
        apiBase: process.env.NUXT_API_URL || 'http://localhost:3002',
        paddleEnvironment: process.env.PADDLE_ENVIRONMENT || 'sandbox',
        paddleClientToken: process.env.PADDLE_CLIENT_TOKEN || ''
    }
}
```

**Update `.env.example`:**
```bash
# Paddle Frontend Configuration
PADDLE_CLIENT_TOKEN=your_paddle_client_side_token
PADDLE_ENVIRONMENT=sandbox
```

**Testing:**
- Verify Paddle SDK loads in browser console
- Check sandbox vs production environment switches correctly
- Test on different browsers

---

### Issue #8: usePaddle Composable — Payment UI Logic
**Priority:** P0 (Blocking)  
**Size:** Medium  
**Dependencies:** Issue #7

**File:** `frontend/composables/usePaddle.ts`

**Implementation:**
```typescript
export const usePaddle = () => {
    const config = useRuntimeConfig();
    
    /**
     * Open Paddle checkout overlay
     */
    const openCheckout = async (
        tierId: number,
        billingCycle: 'monthly' | 'annual',
        organizationId: number
    ): Promise<void> => {
        try {
            const token = getAuthToken();
            if (!token) {
                throw new Error('Authentication required');
            }
            
            // Get checkout session from backend
            const response = await $fetch<{
                success: boolean;
                priceId: string;
                sessionId: string;
                customerEmail: string;
            }>(`${config.public.apiBase}/subscription/checkout`, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Authorization-Type': 'auth',
                    'Content-Type': 'application/json'
                },
                body: { tierId, billingCycle, organizationId }
            });
            
            if (!response.success) {
                throw new Error('Failed to create checkout session');
            }
            
            // Open Paddle Overlay
            if (import.meta.client && window.Paddle) {
                // @ts-ignore
                window.Paddle.Checkout.open({
                    items: [{ priceId: response.priceId, quantity: 1 }],
                    customer: { email: response.customerEmail },
                    customData: { 
                        organizationId, 
                        tierId,
                        billingCycle 
                    },
                    successCallback: (data: any) => {
                        handleCheckoutSuccess(data.transaction_id, organizationId);
                    },
                    closeCallback: () => {
                        console.log('Checkout closed');
                    }
                });
            }
        } catch (error: any) {
            console.error('Checkout error:', error);
            throw error;
        }
    };
    
    /**
     * Handle successful checkout
     */
    const handleCheckoutSuccess = async (
        transactionId: string,
        organizationId: number
    ) => {
        console.log('✅ Payment successful:', transactionId);
        
        // Poll backend for subscription activation (webhook may take a few seconds)
        let attempts = 0;
        const maxAttempts = 10;
        
        const pollInterval = setInterval(async () => {
            attempts++;
            
            try {
                const token = getAuthToken();
                const response = await $fetch<{ success: boolean; activated: boolean }>(
                    `${config.public.apiBase}/subscription/check-activation`,
                    {
                        method: 'POST',
                        headers: {
                            'Authorization': `Bearer ${token}`,
                            'Authorization-Type': 'auth',
                            'Content-Type': 'application/json'
                        },
                        body: { organizationId, transactionId }
                    }
                );
                
                if (response.activated) {
                    clearInterval(pollInterval);
                    
                    // Refresh subscription data
                    const subscriptionStore = useSubscriptionStore();
                    await subscriptionStore.retrieveSubscription(organizationId);
                    
                    // Show success message
                    if (import.meta.client) {
                        const { $swal } = useNuxtApp();
                        $swal.fire({
                            icon: 'success',
                            title: 'Subscription Activated!',
                            text: 'Your subscription has been successfully activated.',
                            confirmButtonText: 'Continue'
                        });
                    }
                    
                    // Navigate to dashboard or billing page
                    navigateTo('/billing');
                }
            } catch (error) {
                console.error('Poll error:', error);
            }
            
            if (attempts >= maxAttempts) {
                clearInterval(pollInterval);
                console.warn('Max polling attempts reached');
            }
        }, 2000); // Poll every 2 seconds
    };
    
    /**
     * Open Paddle billing portal (for payment method updates, etc.)
     */
    const manageBilling = async (organizationId: number): Promise<void> => {
        try {
            const token = getAuthToken();
            if (!token) {
                throw new Error('Authentication required');
            }
            
            const response = await $fetch<{ success: boolean; url: string }>(
                `${config.public.apiBase}/subscription/portal-url`,
                {
                    method: 'POST',
                    headers: {
                        'Authorization': `Bearer ${token}`,
                        'Authorization-Type': 'auth',
                        'Content-Type': 'application/json'
                    },
                    body: { organizationId }
                }
            );
            
            if (response.success && response.url && import.meta.client) {
                window.open(response.url, '_blank');
            }
        } catch (error: any) {
            console.error('Billing portal error:', error);
            throw error;
        }
    };
    
    /**
     * Format price for display
     */
    const formatPrice = (amount: number, currency: string = 'USD'): string => {
        return new Intl.NumberFormat('en-US', {
            style: 'currency',
            currency
        }).format(amount);
    };
    
    /**
     * Calculate annual savings
     */
    const calculateAnnualSavings = (monthlyPrice: number, annualPrice: number): string => {
        const monthlyCost = monthlyPrice * 12;
        const savings = monthlyCost - annualPrice;
        const percentage = Math.round((savings / monthlyCost) * 100);
        return `${percentage}%`;
    };
    
    return {
        openCheckout,
        manageBilling,
        formatPrice,
        calculateAnnualSavings
    };
};

// TypeScript declarations
declare global {
    interface Window {
        Paddle: any;
    }
}
```

**Testing:**
- Test checkout flow with sandbox payment
- Test cancellation during checkout
- Verify error handling
- Test polling mechanism for activation

---

### Issue #9: Update pricing-section.vue — Add Checkout CTAs
**Priority:** P1 (High)  
**Size:** Small  
**Dependencies:** Issue #8

**File:** `frontend/components/pricing-section.vue`

**Changes:**
Add subscription buttons to each pricing tier card. Currently the pricing cards display information but don't have action buttons.

**Add to script section:**
```typescript
import { usePaddle } from '~/composables/usePaddle';
import { useOrganizationsStore } from '~/stores/organizations';

const paddle = usePaddle();
const orgStore = useOrganizationsStore();
const router = useRouter();

const state = reactive({
    loading: false,
    processingTier: null as string | null
});

const handleSubscribe = async (tier: PricingTier) => {
    if (!orgStore.currentOrganization) {
        // Redirect to login/register
        router.push('/login');
        return;
    }
    
    state.loading = true;
    state.processingTier = tier.name;
    
    try {
        // Map tier name to tier ID (you'll need to fetch this from backend)
        const tierMap: Record<string, number> = {
            'STARTER': 2,
            'PROFESSIONAL': 3,
            'PROFESSIONAL_PLUS': 4,
            'ENTERPRISE': 5
        };
        
        const tierId = tierMap[tier.name];
        
        if (tier.name === 'ENTERPRISE') {
            // Open enterprise contact modal
            // (implement modal component)
        } else {
            await paddle.openCheckout(
                tierId,
                billingPeriod.value,
                orgStore.currentOrganization.id
            );
        }
    } catch (error: any) {
        console.error('Subscription error:', error);
        const { $swal } = useNuxtApp();
        $swal.fire({
            icon: 'error',
            title: 'Subscription Error',
            text: error.message || 'Failed to start subscription process'
        });
    } finally {
        state.loading = false;
        state.processingTier = null;
    }
};

const handleFreeTierClick = () => {
    router.push('/register');
};
```

**Add buttons to template (inside each pricing card):**
```vue
<!-- After the features list, add action button -->
<div class="mt-6">
    <combo-button
        v-if="tier.name === 'FREE'"
        label="Start Free"
        color="primary"
        class="w-full h-12"
        @click="handleFreeTierClick"
    />
    
    <combo-button
        v-else-if="tier.name === 'ENTERPRISE'"
        label="Contact Sales"
        color="primary"
        class="w-full h-12"
        @click="handleSubscribe(tier)"
    />
    
    <combo-button
        v-else
        :label="state.processingTier === tier.name ? 'Processing...' : `Subscribe ${billingPeriod === 'monthly' ? 'Monthly' : 'Annually'}`"
        color="primary"
        class="w-full h-12"
        :disabled="state.loading"
        @click="handleSubscribe(tier)"
    />
</div>
```

**Testing:**
- Test checkout opens correctly for each tier
- Verify billing cycle selection is passed correctly
- Test on mobile responsive view
- Test without authentication (should redirect to login)

---

### Issue #10: Billing Management Page
**Priority:** P1 (High)  
**Size:** Large  
**Dependencies:** Issue #8

**File:** `frontend/pages/billing/index.vue`

**Implementation:**
```vue
<template>
    <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div class="mb-8">
            <h1 class="text-3xl font-bold text-gray-900">Billing & Subscription</h1>
            <p class="mt-2 text-gray-600">Manage your subscription and billing details</p>
        </div>
        
        <!-- Current Subscription Card -->
        <div class="bg-white shadow rounded-lg p-6 mb-6">
            <h2 class="text-xl font-semibold text-gray-900 mb-4">Current Subscription</h2>
            
            <div v-if="state.loading" class="text-center py-8">
                <font-awesome-icon :icon="['fas', 'spinner']" class="animate-spin text-4xl text-primary-blue-100" />
            </div>
            
            <div v-else-if="state.subscription" class="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div>
                    <p class="text-sm text-gray-500">Plan</p>
                    <p class="text-lg font-semibold text-gray-900">{{ state.subscription.tier_name }}</p>
                </div>
                
                <div>
                    <p class="text-sm text-gray-500">Billing Cycle</p>
                    <p class="text-lg font-semibold text-gray-900">{{ state.subscription.billing_cycle }}</p>
                </div>
                
                <div>
                    <p class="text-sm text-gray-500">Next Payment</p>
                    <p class="text-lg font-semibold text-gray-900">
                        {{ formatDate(state.subscription.ends_at) }}
                    </p>
                </div>
                
                <!-- Grace Period Warning -->
                <div v-if="state.subscription.grace_period_ends_at" class="col-span-3">
                    <div class="bg-orange-50 border border-orange-200 rounded-lg p-4">
                        <div class="flex items-start">
                            <font-awesome-icon :icon="['fas', 'triangle-exclamation']" class="text-orange-500 mr-3 mt-1" />
                            <div>
                                <h3 class="text-sm font-semibold text-orange-900">Payment Failed</h3>
                                <p class="text-sm text-orange-700 mt-1">
                                    Your last payment failed. Please update your payment method by 
                                    {{ formatDate(state.subscription.grace_period_ends_at) }} 
                                    to avoid service interruption.
                                </p>
                                <combo-button
                                    label="Update Payment Method"
                                    color="warning"
                                    class="mt-3"
                                    @click="handleUpdatePaymentMethod"
                                />
                            </div>
                        </div>
                    </div>
                </div>
            </div>
            
            <!-- Action Buttons -->
            <div class="mt-6 flex flex-wrap gap-3">
                <combo-button
                    v-if="canUpgrade"
                    label="Upgrade Plan"
                    color="primary"
                    @click="showUpgradeModal = true"
                />
                
                <combo-button
                    v-if="canDowngrade"
                    label="Downgrade Plan"
                    color="secondary"
                    @click="showDowngradeModal = true"
                />
                
                <combo-button
                    v-if="state.subscription?.paddle_subscription_id"
                    label="Update Payment Method"
                    color="secondary"
                    @click="handleUpdatePaymentMethod"
                />
                
                <combo-button
                    v-if="state.subscription?.paddle_subscription_id && !state.subscription.cancelled_at"
                    label="Cancel Subscription"
                    color="danger"
                    @click="showCancelModal = true"
                />
            </div>
        </div>
        
        <!-- Usage Overview (reuse SubscriptionUsageCard logic) -->
        <SubscriptionUsageCard />
        
        <!-- Payment History -->
        <div class="bg-white shadow rounded-lg p-6 mt-6">
            <h2 class="text-xl font-semibold text-gray-900 mb-4">Payment History</h2>
            
            <div v-if="state.paymentHistory.length === 0" class="text-center py-8 text-gray-500">
                No payment history available
            </div>
            
            <table v-else class="min-w-full divide-y divide-gray-200">
                <thead>
                    <tr>
                        <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Date</th>
                        <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Amount</th>
                        <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
                        <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Invoice</th>
                    </tr>
                </thead>
                <tbody class="bg-white divide-y divide-gray-200">
                    <tr v-for="payment in state.paymentHistory" :key="payment.id">
                        <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                            {{ formatDate(payment.date) }}
                        </td>
                        <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                            {{ formatCurrency(payment.amount) }}
                        </td>
                        <td class="px-6 py-4 whitespace-nowrap">
                            <span :class="getStatusClass(payment.status)" class="px-2 py-1 text-xs rounded-full">
                                {{ payment.status }}
                            </span>
                        </td>
                        <td class="px-6 py-4 whitespace-nowrap text-sm">
                            <a :href="payment.invoice_url" target="_blank" class="text-primary-blue-100 hover:underline">
                                Download
                            </a>
                        </td>
                    </tr>
                </tbody>
            </table>
        </div>
        
        <!-- Modals -->
        <UpgradeModal v-if="showUpgradeModal" @close="showUpgradeModal = false" />
        <DowngradeModal v-if="showDowngradeModal" @close="showDowngradeModal = false" />
        <CancelSubscriptionModal v-if="showCancelModal" @close="showCancelModal = false" />
    </div>
</template>

<script setup lang="ts">
definePageMeta({ 
    layout: 'project',
    middleware: ['auth'] // Ensure user is authenticated
});

import { usePaddle } from '~/composables/usePaddle';
import { useSubscriptionStore } from '~/stores/subscription';
import { useOrganizationsStore } from '~/stores/organizations';

const paddle = usePaddle();
const subscriptionStore = useSubscriptionStore();
const orgStore = useOrganizationsStore();

const state = reactive({
    loading: true,
    subscription: null as any,
    paymentHistory: [] as any[],
});

const showUpgradeModal = ref(false);
const showDowngradeModal = ref(false);
const showCancelModal = ref(false);

const canUpgrade = computed(() => {
    // Logic to determine if user can upgrade (not on highest tier)
    return state.subscription?.tier_name !== 'ENTERPRISE';
});

const canDowngrade = computed(() => {
    // Logic to determine if user can downgrade
    return state.subscription?.tier_name !== 'FREE';
});

const handleUpdatePaymentMethod = async () => {
    try {
        await paddle.manageBilling(orgStore.currentOrganization!.id);
    } catch (error: any) {
        const { $swal } = useNuxtApp();
        $swal.fire({
            icon: 'error',
            title: 'Error',
            text: error.message || 'Failed to open billing portal'
        });
    }
};

const formatDate = (date: string | Date | null) => {
    if (!date) return 'N/A';
    return new Date(date).toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'long',
        day: 'numeric'
    });
};

const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
        style: 'currency',
        currency: 'USD'
    }).format(amount);
};

const getStatusClass = (status: string) => {
    const classes: Record<string, string> = {
        'succeeded': 'bg-green-100 text-green-800',
        'failed': 'bg-red-100 text-red-800',
        'pending': 'bg-yellow-100 text-yellow-800'
    };
    return classes[status.toLowerCase()] || 'bg-gray-100 text-gray-800';
};

// Load data on mount
onMounted(async () => {
    if (!orgStore.currentOrganization) {
        navigateTo('/');
        return;
    }
    
    try {
        state.subscription = await subscriptionStore.retrieveSubscription(
            orgStore.currentOrganization.id
        );
        
        // Load payment history
        const config = useRuntimeConfig();
        const token = getAuthToken();
        const response = await $fetch(
            `${config.public.apiBase}/subscription/payment-history/${orgStore.currentOrganization.id}`,
            {
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Authorization-Type': 'auth'
                }
            }
        );
        
        if (response.success) {
            state.paymentHistory = response.data;
        }
    } catch (error) {
        console.error('Failed to load billing data:', error);
    } finally {
        state.loading = false;
    }
});
</script>
```

**Add to Navigation:**
Update `frontend/components/sidebar-main.vue` to include billing menu item.

**Testing:**
- Test all actions as owner and non-owner
- Test with active subscription, cancelled subscription, free tier
- Verify payment history displays correctly

---

### Issue #11: Update SubscriptionUsageCard — Add Billing CTA
**Priority:** P1 (High)  
**Size:** Small  
**Dependencies:** Issue #10

**File:** `frontend/components/SubscriptionUsageCard.vue`

**Changes:**
Add billing management buttons and grace period warning to the existing usage card component.

**Add to template (after usage stats):**
```vue
<!-- Billing Actions -->
<div class="mt-6 pt-6 border-t border-gray-200">
    <div v-if="subscription?.grace_period_ends_at" class="mb-4">
        <div class="bg-red-50 border border-red-200 rounded-lg p-3">
            <div class="flex items-start">
                <font-awesome-icon :icon="['fas', 'triangle-exclamation']" class="text-red-500 mr-2 mt-0.5" />
                <div class="text-sm">
                    <p class="font-semibold text-red-900">Payment Failed</p>
                    <p class="text-red-700 mt-1">
                        {{ daysRemainingInGracePeriod }} days remaining to update payment
                    </p>
                </div>
            </div>
        </div>
    </div>
    
    <div class="flex flex-col gap-2">
        <combo-button
            v-if="showUpgradeButton"
            label="Upgrade Plan"
            color="primary"
            class="w-full"
            @click="navigateTo('/billing')"
        />
        
        <combo-button
            v-if="subscription?.paddle_subscription_id"
            label="Manage Subscription"
            color="secondary"
            class="w-full"
            @click="navigateTo('/billing')"
        />
        
        <NuxtLink
            to="/pricing"
            class="text-center text-sm text-primary-blue-100 hover:underline mt-2"
        >
            View All Plans
        </NuxtLink>
    </div>
</div>
```

**Add to script:**
```typescript
const subscription = computed(() => subscriptionStore.currentSubscription);

const showUpgradeButton = computed(() => {
    const tier = subscription.value?.tier_name;
    return tier === 'FREE' || tier === 'STARTER';
});

const daysRemainingInGracePeriod = computed(() => {
    if (!subscription.value?.grace_period_ends_at) return 0;
    
    const now = new Date();
    const gracePeriodEnd = new Date(subscription.value.grace_period_ends_at);
    const diffTime = gracePeriodEnd.getTime() - now.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    
    return Math.max(0, diffDays);
});
```

**Testing:**
- Test display for each tier
- Verify navigation works
- Test grace period warning display

---

## Phase 4: Backend Routes

### Issue #12: Subscription Routes — Customer-Facing APIs
**Priority:** P0 (Blocking)  
**Size:** Medium  
**Dependencies:** Issue #4

**File:** `backend/src/routes/subscription.ts` (update existing)

**Add Routes:**
```typescript
import { SubscriptionProcessor } from '../processors/SubscriptionProcessor.js';
import { expensiveOperationsLimiter } from '../middleware/rateLimit.js';

const processor = SubscriptionProcessor.getInstance();

// Create checkout session
router.post('/checkout', validateJWT, expensiveOperationsLimiter, async (req: Request, res: Response) => {
    try {
        const { tierId, billingCycle, organizationId } = req.body;
        const userId = req.body.tokenDetails.user_id;
        
        // Verify user is member of organization
        // (implement authorization check)
        
        const session = await processor.initiateCheckout(
            organizationId,
            tierId,
            billingCycle
        );
        
        res.json({
            success: true,
            ...session
        });
    } catch (error: any) {
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

// Upgrade subscription
router.post('/upgrade', validateJWT, expensiveOperationsLimiter, async (req: Request, res: Response) => {
    try {
        const { organizationId, newTierId, billingCycle } = req.body;
        
        // Verify user is owner of organization
        // (implement authorization check)
        
        const subscription = await processor.upgradeSubscription(
            organizationId,
            newTierId,
            billingCycle
        );
        
        res.json({
            success: true,
            data: subscription
        });
    } catch (error: any) {
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

// Downgrade subscription
router.post('/downgrade', validateJWT, async (req: Request, res: Response) => {
    try {
        const { organizationId, newTierId } = req.body;
        
        // Verify user is owner
        
        const subscription = await processor.downgradeSubscription(
            organizationId,
            newTierId
        );
        
        res.json({
            success: true,
            data: subscription
        });
    } catch (error: any) {
        res.status(400).json({
            success: false,
            error: error.message
        });
    }
});

// Cancel subscription
router.post('/cancel', validateJWT, async (req: Request, res: Response) => {
    try {
        const { organizationId, reason } = req.body;
        
        // Verify user is owner
        
        const subscription = await processor.cancelSubscription(
            organizationId,
            reason
        );
        
        res.json({
            success: true,
            data: subscription
        });
    } catch (error: any) {
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

// Get billing portal URL
router.post('/portal-url', validateJWT, async (req: Request, res: Response) => {
    try {
        const { organizationId } = req.body;
        
        const url = await processor.getBillingPortalUrl(organizationId);
        
        res.json({
            success: true,
            url
        });
    } catch (error: any) {
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

// Get payment history
router.get('/payment-history/:organizationId', validateJWT, async (req: Request, res: Response) => {
    try {
        const organizationId = parseInt(req.params.organizationId);
        
        // Fetch from Paddle or local cache
        // (implement payment history retrieval)
        
        res.json({
            success: true,
            data: []
        });
    } catch (error: any) {
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

// Check subscription activation (polling endpoint)
router.post('/check-activation', validateJWT, async (req: Request, res: Response) => {
    try {
        const { organizationId, transactionId } = req.body;
        
        const subscription = await processor.getSubscriptionDetails(organizationId);
        const activated = subscription?.paddle_transaction_id === transactionId 
            && subscription?.is_active;
        
        res.json({
            success: true,
            activated
        });
    } catch (error: any) {
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});
```

**Authorization Middleware:**
Create helper to verify organization ownership:
```typescript
// backend/src/middleware/organizationOwner.ts
export const requireOrganizationOwner = async (req: Request, res: Response, next: any) => {
    const userId = req.body.tokenDetails.user_id;
    const organizationId = req.body.organizationId || req.params.organizationId;
    
    // Query DRAOrganizationMember to verify role === 'owner'
    // If not owner, return 403
    
    next();
};
```

**Testing:**
- Test all routes with valid and invalid tokens
- Test permission checks (non-owner trying to upgrade)
- Test with non-existent organization IDs

---

### Issue #13: Admin Routes — Subscription Management
**Priority:** P2 (Medium)  
**Size:** Small  
**Dependencies:** Issue #4

**File:** `backend/src/routes/admin/subscriptions.ts` (new)

**Implementation:**
```typescript
import express, { Request, Response } from 'express';
import { validateJWT } from '../../middleware/authenticate.js';
import { requireAdmin } from '../../middleware/requireAdmin.js';
import { AppDataSource } from '../../datasources/PostgresDS.js';
import { DRAOrganizationSubscription } from '../../models/DRAOrganizationSubscription.js';
import { SubscriptionProcessor } from '../../processors/SubscriptionProcessor.js';
import { PaddleService } from '../../services/PaddleService.js';

const router = express.Router();

// List all active subscriptions
router.get('/', validateJWT, requireAdmin, async (req: Request, res: Response) => {
    try {
        const manager = AppDataSource.manager;
        
        const subscriptions = await manager.find(DRAOrganizationSubscription, {
            relations: ['subscription_tier', 'organization'],
            order: { started_at: 'DESC' }
        });
        
        res.json({
            success: true,
            data: subscriptions
        });
    } catch (error: any) {
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

// Force sync with Paddle
router.post('/:id/sync', validateJWT, requireAdmin, async (req: Request, res: Response) => {
    try {
        const subscriptionId = parseInt(req.params.id);
        const manager = AppDataSource.manager;
        
        const subscription = await manager.findOneOrFail(DRAOrganizationSubscription, {
            where: { id: subscriptionId }
        });
        
        if (!subscription.paddle_subscription_id) {
            return res.status(400).json({
                success: false,
                error: 'No Paddle subscription ID found'
            });
        }
        
        // Fetch from Paddle
        const paddle = PaddleService.getInstance();
        const paddleData = await paddle.getSubscription(subscription.paddle_subscription_id);
        
        // Update local record
        subscription.is_active = paddleData.status === 'active';
        // Update other fields as needed
        
        await manager.save(subscription);
        
        res.json({
            success: true,
            data: subscription
        });
    } catch (error: any) {
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

// Manual override (emergency use)
router.post('/:id/override', validateJWT, requireAdmin, async (req: Request, res: Response) => {
    try {
        const subscriptionId = parseInt(req.params.id);
        const { newTierId, reason } = req.body;
        const manager = AppDataSource.manager;
        
        const subscription = await manager.findOneOrFail(DRAOrganizationSubscription, {
            where: { id: subscriptionId }
        });
        
        subscription.subscription_tier_id = newTierId;
        await manager.save(subscription);
        
        console.log(`⚠️ ADMIN OVERRIDE: Subscription ${subscriptionId} changed to tier ${newTierId}. Reason: ${reason}`);
        
        res.json({
            success: true,
            data: subscription
        });
    } catch (error: any) {
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

export default router;
```

**Mount in `backend/src/index.ts`:**
```typescript
import admin_subscriptions from './routes/admin/subscriptions.js';

// Around line 276
app.use('/admin/subscriptions', admin_subscriptions);
```

**Testing:**
- Test admin access only
- Test sync functionality
- Test manual override with validation

---

## Phase 5: Integration & Testing

### Issue #14: Update TierEnforcementService — Paddle Integration
**Priority:** P0 (Blocking)  
**Size:** Small  
**Dependencies:** Issue #4

**File:** `backend/src/services/TierEnforcementService.ts`

**Changes:**
```typescript
// Update to read from paddle_subscription_id instead of stripe_subscription_id
// Add grace period check

/**
 * Check if organization has active subscription (including grace period)
 */
async hasActiveSubscription(organizationId: number): Promise<boolean> {
    const manager = AppDataSource.manager;
    
    const subscription = await manager.findOne(DRAOrganizationSubscription, {
        where: { organization_id: organizationId }
    });
    
    if (!subscription) return false;
    
    // Active subscription
    if (subscription.is_active) return true;
    
    // Grace period active
    if (subscription.grace_period_ends_at) {
        const now = new Date();
        return subscription.grace_period_ends_at > now;
    }
    
    return false;
}

/**
 * Check if organization can downgrade to new tier
 */
async canDowngrade(
    organizationId: number,
    newTierId: number
): Promise<{ allowed: boolean; reason?: string }> {
    const manager = AppDataSource.manager;
    
    const newTier = await manager.findOneOrFail(DRASubscriptionTier, {
        where: { id: newTierId }
    });
    
    // Get current usage
    const usage = await this.getUsageStats(organizationId);
    
    // Check if usage exceeds new tier limits
    if (newTier.max_projects !== null && newTier.max_projects !== -1) {
        if (usage.projects_count > newTier.max_projects) {
            return {
                allowed: false,
                reason: `You have ${usage.projects_count} projects but ${newTier.tier_name} tier allows only ${newTier.max_projects}`
            };
        }
    }
    
    if (newTier.max_data_sources_per_project !== null && newTier.max_data_sources_per_project !== -1) {
        // Check across all projects
        const maxDataSources = await this.getMaxDataSourcesInAnyProject(organizationId);
        if (maxDataSources > newTier.max_data_sources_per_project) {
            return {
                allowed: false,
                reason: `One of your projects has ${maxDataSources} data sources but ${newTier.tier_name} tier allows only ${newTier.max_data_sources_per_project}`
            };
        }
    }
    
    // Similar checks for other limits...
    
    return { allowed: true };
}
```

**Testing:**
- Test grace period allows access
- Test downgrade validation blocks if usage exceeds limits
- Test with various tier combinations

---

### Issue #15: Email Notifications — Subscription Events
**Priority:** P1 (High)  
**Size:** Medium  
**Dependencies:** Issue #4

**File:** `backend/src/services/EmailService.ts` (update existing)

**Add Methods:**
```typescript
/**
 * Send subscription activated email
 */
public async sendSubscriptionActivated(
    organization: DRAOrganization,
    tierName: string,
    billingCycle: 'monthly' | 'annual'
) {
    const subject = '🎉 Your Subscription is Active!';
    const html = `
        <h2>Welcome to ${tierName} Plan!</h2>
        <p>Your subscription has been successfully activated.</p>
        <p><strong>Plan:</strong> ${tierName}</p>
        <p><strong>Billing Cycle:</strong> ${billingCycle}</p>
        <p>You now have access to all ${tierName} tier features.</p>
        <p><a href="${process.env.FRONTEND_URL}/billing">Manage Subscription</a></p>
    `;
    
    await this.sendEmail(organization.settings.owner_email, subject, html);
}

/**
 * Send subscription upgraded email
 */
public async sendSubscriptionUpgraded(
    organization: DRAOrganization,
    oldTier: string,
    newTier: string
) {
    const subject = '🚀 Subscription Upgraded!';
    const html = `
        <h2>Your Plan Has Been Upgraded</h2>
        <p>You've successfully upgraded from ${oldTier} to ${newTier}.</p>
        <p>You now have access to enhanced features and higher limits.</p>
        <p><a href="${process.env.FRONTEND_URL}/billing">View Details</a></p>
    `;
    
    await this.sendEmail(organization.settings.owner_email, subject, html);
}

/**
 * Send payment failed email
 */
public async sendPaymentFailed(
    organization: DRAOrganization,
    gracePeriodEnds: Date
) {
    const subject = '⚠️ Payment Failed - Action Required';
    const html = `
        <h2>Payment Failed</h2>
        <p>We were unable to process your recent payment.</p>
        <p>Your subscription will remain active until ${gracePeriodEnds.toLocaleDateString()}.</p>
        <p>Please update your payment method to avoid service interruption.</p>
        <p><a href="${process.env.FRONTEND_URL}/billing">Update Payment Method</a></p>
    `;
    
    await this.sendEmail(organization.settings.owner_email, subject, html);
}

/**
 * Send grace period expiring reminder
 */
public async sendGracePeriodExpiring(
    organization: DRAOrganization,
    daysRemaining: number
) {
    const subject = `⏰ ${daysRemaining} Days Until Service Interruption`;
    const html = `
        <h2>Update Payment Method Soon</h2>
        <p>Your subscription will be downgraded to the FREE tier in ${daysRemaining} days due to payment failure.</p>
        <p>Update your payment method now to maintain access to your current features.</p>
        <p><a href="${process.env.FRONTEND_URL}/billing">Update Payment Method</a></p>
    `;
    
    await this.sendEmail(organization.settings.owner_email, subject, html);
}

// Additional methods for other events...
```

**Testing:**
- Preview all email templates
- Test variable substitution
- Test send functionality

---

### Issue #16: Frontend Stores — Subscription State Management
**Priority:** P1 (High)  
**Size:** Medium  
**Dependencies:** Issue #8, Issue #10

**File:** `frontend/stores/subscription.ts` (update existing)

**Implementation:**
```typescript
import { defineStore } from 'pinia';

export interface IOrganizationSubscription {
    id: number;
    organization_id: number;
    subscription_tier_id: number;
    tier_name: string;
    paddle_subscription_id: string | null;
    paddle_customer_id: string | null;
    billing_cycle: 'monthly' | 'annual';
    is_active: boolean;
    grace_period_ends_at: Date | null;
    last_payment_failed_at: Date | null;
    started_at: Date;
    ends_at: Date | null;
    cancelled_at: Date | null;
}

export const useSubscriptionStore = defineStore('subscriptionDRA', () => {
    const currentSubscription = ref<IOrganizationSubscription | null>(null);
    const billingCycle = ref<'monthly' | 'annual'>('annual');
    
    const isGracePeriod = computed(() => {
        if (!currentSubscription.value?.grace_period_ends_at) return false;
        const now = new Date();
        const gracePeriodEnd = new Date(currentSubscription.value.grace_period_ends_at);
        return gracePeriodEnd > now;
    });
    
    const daysRemainingInGracePeriod = computed(() => {
        if (!currentSubscription.value?.grace_period_ends_at) return 0;
        
        const now = new Date();
        const gracePeriodEnd = new Date(currentSubscription.value.grace_period_ends_at);
        const diffTime = gracePeriodEnd.getTime() - now.getTime();
        const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
        
        return Math.max(0, diffDays);
    });
    
    /**
     * Retrieve subscription for organization
     */
    async function retrieveSubscription(organizationId: number) {
        try {
            const config = useRuntimeConfig();
            const token = getAuthToken();
            
            const response = await $fetch<{ success: boolean; data: IOrganizationSubscription }>(
                `${config.public.apiBase}/subscription/current`,
                {
                    method: 'POST',
                    headers: {
                        'Authorization': `Bearer ${token}`,
                        'Authorization-Type': 'auth',
                        'Content-Type': 'application/json'
                    },
                    body: { organizationId }
                }
            );
            
            if (response.success) {
                setSubscription(response.data);
                return response.data;
            }
            
            return null;
        } catch (error) {
            console.error('Failed to retrieve subscription:', error);
            return null;
        }
    }
    
    /**
     * Set subscription and sync to localStorage
     */
    function setSubscription(subscription: IOrganizationSubscription | null) {
        currentSubscription.value = subscription;
        
        if (import.meta.client) {
            if (subscription) {
                localStorage.setItem('currentSubscription', JSON.stringify(subscription));
            } else {
                localStorage.removeItem('currentSubscription');
            }
        }
    }
    
    /**
     * Get subscription from localStorage
     */
    function getSubscription() {
        if (import.meta.client) {
            const stored = localStorage.getItem('currentSubscription');
            if (stored) {
                currentSubscription.value = JSON.parse(stored);
            }
        }
        return currentSubscription.value;
    }
    
    /**
     * Clear subscription data
     */
    function clearSubscription() {
        setSubscription(null);
    }
    
    return {
        currentSubscription,
        billingCycle,
        isGracePeriod,
        daysRemainingInGracePeriod,
        retrieveSubscription,
        setSubscription,
        getSubscription,
        clearSubscription
    };
});
```

**Testing:**
- Test store persistence across page refreshes
- Test reactive updates after subscription changes
- Test localStorage sync

---

### Issue #17: Admin UI — Subscription Management Panel
**Priority:** P2 (Medium)  
**Size:** Large  
**Dependencies:** Issue #13

**File:** `frontend/pages/admin/subscriptions/index.vue` (new)

**Features:**
- Table of all subscriptions with filters (tier, status, billing cycle)
- Search by organization name or email
- View subscription details modal
- Force sync button
- Manual override modal
- Export to CSV
- Revenue metrics (MRR, ARR, churn)

**Implementation:** (Similar pattern to existing admin pages)

**Testing:**
- Test all filters and search
- Test sync functionality
- Verify manual override requires confirmation

---

### Issue #18: Paddle Price ID Management UI
**Priority:** P1 (High)  
**Size:** Small  
**Dependencies:** Issue #2

**File:** `frontend/pages/admin/subscription-tiers/[id].vue` (update or create)

**Add Fields:**
```vue
<!-- In tier edit form -->
<div class="mb-4">
    <label class="block text-sm font-semibold text-gray-700 mb-2">
        Paddle Product ID
    </label>
    <input
        v-model="tierData.paddle_product_id"
        type="text"
        class="w-full border border-gray-300 rounded-lg px-4 py-2"
        placeholder="pro_01..."
    />
</div>

<div class="mb-4">
    <label class="block text-sm font-semibold text-gray-700 mb-2">
        Paddle Price ID (Monthly)
    </label>
    <input
        v-model="tierData.paddle_price_id_monthly"
        type="text"
        class="w-full border border-gray-300 rounded-lg px-4 py-2"
        placeholder="pri_01..."
    />
</div>

<div class="mb-4">
    <label class="block text-sm font-semibold text-gray-700 mb-2">
        Paddle Price ID (Annual)
    </label>
    <input
        v-model="tierData.paddle_price_id_annual"
        type="text"
        class="w-full border border-gray-300 rounded-lg px-4 py-2"
        placeholder="pri_01..."
    />
</div>

<!-- Environment indicator -->
<div class="mb-4 p-3 bg-blue-50 rounded-lg">
    <p class="text-sm text-blue-800">
        <strong>Environment:</strong> {{ config.public.paddleEnvironment }}
    </p>
</div>
```

**Testing:**
- Test CRUD operations
- Verify validation
- Test environment display

---

### Issue #19: Integration Tests — Full Checkout Flow
**Priority:** P0 (Blocking)  
**Size:** Large  
**Dependencies:** All previous issues

**Test Files:**
- `backend/tests/integration/paddle-checkout.test.ts`
- `backend/tests/integration/paddle-webhooks.test.ts`

**Test Scenarios:**
1. New subscription (FREE → STARTER)
2. Upgrade (STARTER → PROFESSIONAL)
3. Downgrade (PROFESSIONAL → STARTER)
4. Payment failure → Grace period → Downgrade
5. Cancellation → Access until period end

**Implementation:** (Use Jest + Paddle sandbox)

---

### Issue #20: Documentation & Deployment Guide
**Priority:** P1 (High)  
**Size:** Small  
**Dependencies:** All previous issues

**Create Files:**
1. `documentation/paddle-integration-guide.md`
2. `documentation/paddle-setup-instructions.md`
3. `documentation/paddle-troubleshooting.md`

**Update `README.md`:**
Add Paddle environment variables to setup section.

---

## Summary

### Total Issues: 20
### Estimated Timeline: 4-6 weeks

**Phase Breakdown:**
- **Phase 1 (Database):** 2-3 days
- **Phase 2 (Backend Services):** 1.5-2 weeks
- **Phase 3 (Frontend):** 1-1.5 weeks
- **Phase 4 (Routes):** 3-4 days
- **Phase 5 (Integration):** 1-1.5 weeks

### Critical Path
Issues #1 → #2 → #3 → #4 → #5 → #7 → #8 → #12 → #19

### Key Risks
1. **Webhook reliability:** Implement idempotency and error logging
2. **Proration edge cases:** Test thoroughly in sandbox
3. **Grace period timing:** Use reliable job scheduler
4. **Sandbox → Production migration:** Comprehensive testing required

### Environment Variables Required

**Backend:**
```bash
PADDLE_API_KEY=your_paddle_api_key
PADDLE_ENVIRONMENT=sandbox
PADDLE_WEBHOOK_SECRET=your_webhook_secret
PADDLE_VENDOR_ID=your_vendor_id
```

**Frontend:**
```bash
PADDLE_CLIENT_TOKEN=your_paddle_client_side_token
PADDLE_ENVIRONMENT=sandbox
```

### Post-Launch Monitoring
- Webhook success rate (target: >99.9%)
- Failed payment recovery rate
- Subscription churn rate
- Checkout abandonment rate
- Average downgrade reason

### Next Steps
1. Set up Paddle sandbox account
2. Create products and prices in Paddle dashboard
3. Begin Phase 1 (database migrations)
4. Implement backend services (Phase 2)
5. Build frontend integration (Phase 3)
6. Comprehensive testing (Phase 5)
7. Production deployment

---

**Last Updated:** April 4, 2026
