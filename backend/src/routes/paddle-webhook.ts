import express, { Request, Response } from 'express';
import crypto from 'crypto';
import { SubscriptionProcessor } from '../processors/SubscriptionProcessor.js';
import { AppDataSource } from '../datasources/PostgresDS.js';
import { DRAPaddleWebhookEvent } from '../models/DRAPaddleWebhookEvent.js';
import { DRAOrganizationSubscription } from '../models/DRAOrganizationSubscription.js';
import { DRASubscriptionTier } from '../models/DRASubscriptionTier.js';

const router = express.Router();

/**
 * In-memory cache to track recent API-initiated tier changes
 * Prevents race condition where webhook with old tier data arrives before Paddle processes update
 * 
 * Key: subscription_id
 * Value: { expectedTierId, initiatedAt, paddleSubscriptionId }
 * 
 * Cleared after 60 seconds or when webhook with expected tier arrives
 */
interface PendingTierChange {
    expectedTierId: number;
    initiatedAt: Date;
    paddleSubscriptionId: string;
}

const pendingTierChanges = new Map<number, PendingTierChange>();

/**
 * Track an API-initiated tier change to prevent webhooks from reverting it
 */
export function trackTierChange(subscriptionId: number, expectedTierId: number, paddleSubscriptionId: string): void {
    console.log(`🔒 Tracking tier change: Subscription ${subscriptionId} → Tier ${expectedTierId}`);
    pendingTierChanges.set(subscriptionId, {
        expectedTierId,
        initiatedAt: new Date(),
        paddleSubscriptionId
    });
    
    // Auto-clear after 60 seconds
    setTimeout(() => {
        if (pendingTierChanges.has(subscriptionId)) {
            console.log(`⏰ Auto-clearing pending tier change for subscription ${subscriptionId} after timeout`);
            pendingTierChanges.delete(subscriptionId);
        }
    }, 60000);
}

/**
 * Check if a webhook should be ignored due to pending tier change
 * Returns true if webhook has stale tier data and should be ignored
 */
function shouldIgnoreWebhookTierUpdate(
    subscriptionDbId: number,
    webhookTierId: number,
    currentDbTierId: number
): boolean {
    const pending = pendingTierChanges.get(subscriptionDbId);
    
    if (!pending) {
        return false; // No pending change, process webhook normally
    }
    
    const ageMs = Date.now() - pending.initiatedAt.getTime();
    console.log(`🔍 Pending tier change found: expecting tier ${pending.expectedTierId}, webhook has ${webhookTierId}, DB has ${currentDbTierId}, age: ${ageMs}ms`);
    
    // If webhook has the expected new tier, clear the pending change and allow update
    if (webhookTierId === pending.expectedTierId) {
        console.log(`✅ Webhook matches expected tier ${pending.expectedTierId} - clearing pending change and allowing update`);
        pendingTierChanges.delete(subscriptionDbId);
        return false; // Don't ignore - this is the webhook we're waiting for
    }
    
    // If webhook has OLD tier data (not matching expected new tier)
    // and we're within 60 seconds of the API change, ignore it
    if (ageMs < 60000) {
        console.log(`⏸️  IGNORING webhook with stale tier ${webhookTierId} (expecting ${pending.expectedTierId}) - within grace period`);
        return true; // Ignore this webhook
    }
    
    // After 60 seconds, assume the API call failed and allow webhook to correct database
    console.log(`⚠️ Grace period expired (${ageMs}ms) - allowing webhook to update tier`);
    pendingTierChanges.delete(subscriptionDbId);
    return false;
}

// Middleware to capture raw body for signature verification
router.use(express.json({
    verify: (req: any, res, buf) => {
        req.rawBody = buf.toString('utf8');
    }
}));

/**
 * Verify Paddle webhook signature
 * 
 * Paddle Billing API signs webhooks with HMAC-SHA256.
 * Signature format: "Paddle-Signature: ts=1234567890;h1=signature_hash"
 * 
 * We verify by:
 * 1. Extracting timestamp (ts) and signature (h1) from header
 * 2. Constructing signed payload: "{timestamp}:{raw_body}"
 * 3. Computing HMAC-SHA256 and comparing
 * 
 * @param req - Express request with Paddle-Signature header
 * @returns true if signature is valid
 */
function verifyPaddleSignature(req: Request, rawBody: string): boolean {
    const signatureHeader = req.headers['paddle-signature'] as string;
    const webhookSecret = process.env.PADDLE_WEBHOOK_SECRET;
    
    if (!signatureHeader || !webhookSecret) {
        console.error('❌ Missing signature or webhook secret');
        console.error('Signature header:', signatureHeader);
        console.error('Webhook secret exists:', !!webhookSecret);
        return false;
    }
    
    try {
        // Parse signature header: "ts=1234567890;h1=abc123..."
        const signatureParts: Record<string, string> = {};
        signatureHeader.split(';').forEach(part => {
            const [key, value] = part.split('=');
            if (key && value) {
                signatureParts[key.trim()] = value.trim();
            }
        });
        
        const timestamp = signatureParts['ts'];
        const signature = signatureParts['h1'];
        
        if (!timestamp || !signature) {
            console.error('❌ Invalid signature format - missing ts or h1');
            console.error('Parsed parts:', signatureParts);
            return false;
        }
        
        // Construct signed payload: "{timestamp}:{raw_body}"
        const signedPayload = `${timestamp}:${rawBody}`;
        
        // Compute HMAC-SHA256
        const hmac = crypto.createHmac('sha256', webhookSecret);
        const computedSignature = hmac.update(signedPayload).digest('hex');
        
        // Use timing-safe comparison to prevent timing attacks
        const computedBuffer = Buffer.from(computedSignature, 'hex');
        const signatureBuffer = Buffer.from(signature, 'hex');
        
        const isValid = computedBuffer.length === signatureBuffer.length && 
                       crypto.timingSafeEqual(computedBuffer, signatureBuffer);
        
        if (!isValid) {
            console.error('❌ Signature mismatch');
            console.error('Expected:', signature);
            console.error('Computed:', computedSignature);
            return false;
        }
        
        // Validate timestamp to prevent replay attacks (allow 5-minute skew window)
        const timestampSeconds = parseInt(timestamp);
        const currentTimestamp = Math.floor(Date.now() / 1000);
        const timestampSkew = Math.abs(currentTimestamp - timestampSeconds);
        const maxSkewSeconds = 300; // 5 minutes
        
        if (timestampSkew > maxSkewSeconds) {
            console.error('❌ Webhook timestamp too old or in the future');
            console.error('Timestamp:', timestampSeconds);
            console.error('Current:', currentTimestamp);
            console.error('Skew (seconds):', timestampSkew);
            return false;
        }
        
        console.log('✅ Signature and timestamp verified');
        return true;
    } catch (error) {
        console.error('❌ Error verifying Paddle signature:', error);
        return false;
    }
}

/**
 * Paddle webhook endpoint
 * 
 * Receives events from Paddle for:
 * - subscription.created: New subscription activated
 * - subscription.updated: Tier or billing cycle changed
 * - subscription.canceled: Subscription cancelled
 * - subscription.payment_succeeded: Payment succeeded (clears grace period)
 * - subscription.payment_failed: Payment failed (starts grace period)
 * - customer.updated: Customer information changed
 * 
 * IMPORTANT: NO authentication middleware - Paddle sends these directly.
 * Security is provided by signature verification.
 * 
 * Always returns 200 to Paddle to prevent retries, even on errors.
 * Errors are logged to dra_paddle_webhook_events table for manual review.
 */
router.post('/webhook', async (req: Request, res: Response) => {
    const manager = AppDataSource.manager;
    
    // Get raw body for signature verification
    const rawBody = (req as any).rawBody || JSON.stringify(req.body);
    
    // Verify signature
    if (!verifyPaddleSignature(req, rawBody)) {
        console.error('❌ Invalid Paddle webhook signature');
        return res.status(401).json({ success: false, error: 'Invalid signature' });
    }
    
    const eventType = req.body.event_type;
    const eventId = req.body.event_id; // Top-level unique event ID from Paddle
    const eventData = req.body.data;
    
    console.log(`📩 Received Paddle webhook: ${eventType} (ID: ${eventId})`);
    console.log('📦 Webhook payload:', JSON.stringify(req.body, null, 2));
    
    // Check for duplicate processing (idempotency) using event_id
    // Paddle guarantees event_id is unique across all events
    if (eventId) {
        const existing = await manager
            .createQueryBuilder(DRAPaddleWebhookEvent, 'event')
            .where("event.payload->> 'event_id' = :eventId", { eventId })
            .getOne();
        
        if (existing) {
            if (existing.processed) {
                console.log(`⚠️ Duplicate webhook event detected (already processed): ${eventType} - ${eventId}`);
                return res.status(200).json({ success: true, message: 'Already processed' });
            } else if (existing.error_message) {
                console.log(`⚠️ Retrying previously failed webhook event: ${eventType} - ${eventId}`);
                // Continue processing - this is a retry of a failed event
            }
        }
    }
    
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
        // Continue processing even if logging fails
    }
    
    const processor = SubscriptionProcessor.getInstance();
    
    try {
        switch (eventType) {
            case 'subscription.created':
                console.log('📘 Processing subscription.created');
                console.log('📦 Event data:', JSON.stringify(eventData, null, 2));
                
                // Extract custom_data - check multiple locations
                let createCustomData = eventData.custom_data;
                
                // Check items array if top-level custom_data is missing
                if (!createCustomData && eventData.items?.[0]?.price?.custom_data) {
                    createCustomData = eventData.items[0].price.custom_data;
                    console.log('✅ Found custom_data in items[0].price.custom_data:', createCustomData);
                }
                
                // Parse if stringified
                if (typeof createCustomData === 'string') {
                    try {
                        createCustomData = JSON.parse(createCustomData);
                        console.log('✅ Parsed stringified custom_data:', createCustomData);
                    } catch (e) {
                        console.error('❌ Failed to parse custom_data string:', createCustomData);
                        createCustomData = {};
                    }
                }
                
                // Ensure we have valid custom_data with organizationId and tierId
                if (createCustomData?.organizationId && createCustomData?.tierId) {
                    // Convert to numbers if they're strings
                    const organizationId = typeof createCustomData.organizationId === 'string' 
                        ? parseInt(createCustomData.organizationId) 
                        : createCustomData.organizationId;
                    const tierId = typeof createCustomData.tierId === 'string'
                        ? parseInt(createCustomData.tierId)
                        : createCustomData.tierId;
                    
                    console.log('✅ Valid custom_data found:', { organizationId, tierId });
                    
                    await processor.handleSuccessfulPayment({
                        subscription_id: eventData.subscription_id || eventData.id,
                        customer_id: eventData.customer_id,
                        transaction_id: eventData.transaction_id || eventData.id,
                        billing_cycle: createCustomData.billingCycle || eventData.billing_period?.interval || 'annual',
                        next_billed_at: eventData.next_billed_at || eventData.billing_period?.ends_at,
                        customData: {
                            organizationId,
                            tierId
                        }
                    });
                } else {
                    console.error('❌ Missing organizationId or tierId in custom_data:', createCustomData);
                }
                break;
                
            case 'subscription.updated':
                console.log('📘 Processing subscription.updated');
                console.log('📦 Subscription update data:', {
                    subscriptionId: eventData.id || eventData.subscription_id,
                    status: eventData.status,
                    items: eventData.items,
                    customData: eventData.custom_data
                });
                
                // Get the subscription from database
                const updatedSub = await manager.findOne(DRAOrganizationSubscription, {
                    where: { paddle_subscription_id: eventData.subscription_id || eventData.id },
                    relations: ['subscription_tier']
                });
                
                if (updatedSub) {
                    console.log(`🔍 Found subscription in DB: Org ${updatedSub.organization_id}, Current tier: ${updatedSub.subscription_tier?.tier_name}`);
                    
                    // Extract the new price ID from the subscription items
                    const newPriceId = eventData.items?.[0]?.price?.id;
                    
                    if (newPriceId) {
                        console.log(`🔍 Looking up tier for price ID: ${newPriceId}`);
                        
                        // Find the tier that matches this price ID
                        const matchingTier = await manager.findOne(DRASubscriptionTier, {
                            where: [
                                { paddle_price_id_monthly: newPriceId },
                                { paddle_price_id_annual: newPriceId }
                            ]
                        });
                        
                        if (matchingTier) {
                            console.log(`✅ Found matching tier: ${matchingTier.tier_name} (ID: ${matchingTier.id})`);
                            
                            // Only update if tier has actually changed
                            if (updatedSub.subscription_tier_id !== matchingTier.id) {
                                console.log(`🔄 Tier mismatch detected! DB has ${updatedSub.subscription_tier?.tier_name}, Paddle has ${matchingTier.tier_name}`);
                                
                                // Check if we should ignore this webhook due to pending API tier change
                                const shouldIgnore = shouldIgnoreWebhookTierUpdate(
                                    updatedSub.id,
                                    matchingTier.id,
                                    updatedSub.subscription_tier_id
                                );
                                
                                if (shouldIgnore) {
                                    console.log(`⏸️  SKIPPING tier update - waiting for webhook with expected tier after recent API change`);
                                } else {
                                    console.log(`📝 Updating database to match Paddle...`);
                                    
                                    updatedSub.subscription_tier_id = matchingTier.id;
                                    updatedSub.subscription_tier = matchingTier;
                                    
                                    // Determine billing cycle from price ID
                                    const isMonthly = matchingTier.paddle_price_id_monthly === newPriceId;
                                    const billingCycle = isMonthly ? 'monthly' : 'annual';
                                    if (updatedSub.billing_cycle !== billingCycle) {
                                        console.log(`🔄 Billing cycle update: ${updatedSub.billing_cycle} → ${billingCycle}`);
                                        updatedSub.billing_cycle = billingCycle;
                                    }
                                    
                                    await manager.save(updatedSub);
                                    console.log(`✅ Database updated from webhook to tier: ${matchingTier.tier_name}`);
                                }
                            } else {
                                console.log(`✅ Tier already correct in database: ${updatedSub.subscription_tier?.tier_name}`);
                            }
                        } else {
                            console.warn(`⚠️ No tier found matching price ID ${newPriceId}`);
                        }
                    } else {
                        console.warn(`⚠️ No price ID in subscription.updated event`);
                    }
                } else {
                    console.warn(`⚠️ subscription.updated event but no matching subscription in DB for ${eventData.subscription_id || eventData.id}`);
                }
                break;
                
            case 'subscription.canceled':
                console.log('📘 Processing subscription.canceled');
                // Mark subscription as cancelled
                const cancelledSub = await manager.findOne(DRAOrganizationSubscription, {
                    where: { paddle_subscription_id: eventData.subscription_id || eventData.id }
                });
                if (cancelledSub) {
                    cancelledSub.is_active = false;
                    cancelledSub.cancelled_at = new Date();
                    await manager.save(cancelledSub);
                    console.log(`✅ Marked subscription ${cancelledSub.id} as cancelled`);
                }
                break;
                
            case 'subscription.payment_succeeded':
            case 'transaction.completed':
                console.log(`📘 Processing ${eventType}`);
                console.log('📦 Event data keys:', Object.keys(eventData));
                console.log('📦 Custom data location check:', {
                    topLevel: eventData.custom_data,
                    topLevelType: typeof eventData.custom_data,
                    hasItems: !!eventData.items,
                    itemsLength: eventData.items?.length,
                    firstItemPrice: eventData.items?.[0]?.price,
                    firstItemCustomData: eventData.items?.[0]?.price?.custom_data,
                    firstItemCustomDataType: typeof eventData.items?.[0]?.price?.custom_data
                });
                
                // Extract custom_data - it might be at different locations depending on event type
                let customData = eventData.custom_data;
                
                // For transaction.completed, custom_data is often on the first item's price
                if (!customData && eventData.items?.[0]?.price?.custom_data) {
                    customData = eventData.items[0].price.custom_data;
                    console.log('✅ Found custom_data in items[0].price.custom_data:', customData);
                }
                
                // Paddle sometimes stringifies custom_data - parse if needed
                if (typeof customData === 'string') {
                    try {
                        customData = JSON.parse(customData);
                        console.log('✅ Parsed stringified custom_data:', customData);
                    } catch (e) {
                        console.error('❌ Failed to parse custom_data string:', customData);
                    }
                }
                
                // Skip handleSuccessfulPayment for upgrade/downgrade transactions - the tier was already
                // updated by the API (changeTier). Using stale customData here would downgrade the tier.
                if (eventData.origin === 'subscription_update') {
                    console.log('⏭️  Skipping handleSuccessfulPayment for subscription_update transaction (upgrade/downgrade)');
                    // Just clear any failed payment flags for safety
                    const upgradeSub = await manager.findOne(DRAOrganizationSubscription, {
                        where: { paddle_subscription_id: eventData.subscription_id || eventData.id }
                    });
                    if (upgradeSub) {
                        upgradeSub.last_payment_failed_at = null;
                        upgradeSub.grace_period_ends_at = null;
                        await manager.save(upgradeSub);
                        console.log(`✅ Cleared grace period for upgrade transaction on subscription ${upgradeSub.id}`);
                    }
                // If this is a new subscription purchase (has custom_data with organizationId and tierId)
                } else if (customData?.organizationId && customData?.tierId) {
                    console.log('🆕 New subscription transaction detected');
                    console.log('   Organization ID:', customData.organizationId, typeof customData.organizationId);
                    console.log('   Tier ID:', customData.tierId, typeof customData.tierId);
                    console.log('   Billing Cycle:', customData.billingCycle);
                    
                    // Convert to numbers if they're strings
                    const organizationId = typeof customData.organizationId === 'string' 
                        ? parseInt(customData.organizationId) 
                        : customData.organizationId;
                    const tierId = typeof customData.tierId === 'string'
                        ? parseInt(customData.tierId)
                        : customData.tierId;
                    
                    await processor.handleSuccessfulPayment({
                        subscription_id: eventData.subscription_id || eventData.id,
                        customer_id: eventData.customer_id,
                        transaction_id: eventData.id,
                        billing_cycle: customData.billingCycle || 'annual',
                        next_billed_at: eventData.billed_at || null,
                        customData: {
                            organizationId,
                            tierId
                        }
                    });
                } else {
                    console.log('⚠️ No custom_data found - treating as renewal payment');
                    console.log('   Subscription ID:', eventData.subscription_id || eventData.id);
                    
                    // For renewal payments, just clear failed payment flags
                    const successSub = await manager.findOne(DRAOrganizationSubscription, {
                        where: { paddle_subscription_id: eventData.subscription_id || eventData.id }
                    });
                    if (successSub) {
                        successSub.last_payment_failed_at = null;
                        successSub.grace_period_ends_at = null;
                        await manager.save(successSub);
                        console.log(`✅ Cleared grace period for subscription ${successSub.id}`);
                    } else {
                        console.log('⚠️ No existing subscription found for transaction');
                    }
                }
                break;
                
            case 'subscription.payment_failed':
            case 'transaction.payment_failed':
                console.log('📘 Processing subscription.payment_failed');
                await processor.handleFailedPayment(eventData.subscription_id || eventData.id);
                break;
                
            case 'customer.updated':
                console.log('📘 Processing customer.updated');
                // Sync customer data if needed (e.g., email change)
                break;
                
            default:
                console.log(`⚠️ Unhandled webhook event: ${eventType}`);
        }
        
        // Mark as processed
        webhookEvent.processed = true;
        webhookEvent.processed_at = new Date();
        await manager.save(webhookEvent);
        
        // Always return 200 to Paddle
        res.status(200).json({ success: true });
        
    } catch (error: any) {
        console.error(`❌ Error processing webhook ${eventType}:`, error);
        
        // Log error but still return 200 to prevent Paddle retries
        webhookEvent.error_message = error.message;
        await manager.save(webhookEvent);
        
        // Return 200 to stop Paddle from retrying
        // Failed events can be manually reviewed in dra_paddle_webhook_events
        res.status(200).json({ success: false, error: error.message });
    }
});

export default router;
