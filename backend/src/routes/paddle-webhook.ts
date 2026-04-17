import express, { Request, Response } from 'express';
import crypto from 'crypto';
import { SubscriptionProcessor } from '../processors/SubscriptionProcessor.js';
import { AppDataSource } from '../datasources/PostgresDS.js';
import { DRAPaddleWebhookEvent } from '../models/DRAPaddleWebhookEvent.js';
import { DRAOrganizationSubscription } from '../models/DRAOrganizationSubscription.js';
import { DRASubscriptionTier } from '../models/DRASubscriptionTier.js';
import { DRAPaymentTransaction } from '../models/DRAPaymentTransaction.js';
import { getRedisClient } from '../config/redis.config.js';

const router = express.Router();

// Redis key pattern: pending_tier_change:{subscription_db_id}
// TTL: 90 seconds — longer than the prior 60s in-memory window to survive restarts
const PENDING_TIER_CHANGE_TTL_SECONDS = 90;

/**
 * Track an API-initiated tier change to prevent webhooks from reverting it.
 *
 * Previously stored in a process-local Map which was lost on restart.
 * Now stored in Redis so the guard survives container restarts.
 *
 * @param subscriptionId - DRA subscription DB row ID
 * @param expectedTierId - Tier ID the API just applied
 * @param paddleSubscriptionId - Paddle subscription ID (for logging)
 */
export async function trackTierChange(
    subscriptionId: number,
    expectedTierId: number,
    paddleSubscriptionId: string
): Promise<void> {
    const redis = getRedisClient();
    const key = `pending_tier_change:${subscriptionId}`;
    await redis.setex(
        key,
        PENDING_TIER_CHANGE_TTL_SECONDS,
        JSON.stringify({ expectedTierId, paddleSubscriptionId, initiatedAt: Date.now() })
    );
    console.log(`🔒 Tier change persisted to Redis: Subscription ${subscriptionId} → Tier ${expectedTierId} (TTL ${PENDING_TIER_CHANGE_TTL_SECONDS}s)`);
}

/**
 * Check if a webhook should be ignored due to a pending API-initiated tier change.
 * Returns true if the webhook carries stale tier data and should be skipped.
 */
async function shouldIgnoreWebhookTierUpdate(
    subscriptionDbId: number,
    webhookTierId: number,
    currentDbTierId: number
): Promise<boolean> {
    const redis = getRedisClient();
    const key = `pending_tier_change:${subscriptionDbId}`;
    const raw = await redis.get(key);

    if (!raw) {
        return false; // No pending change — process webhook normally
    }

    const pending = JSON.parse(raw) as { expectedTierId: number; paddleSubscriptionId: string; initiatedAt: number };
    const ageMs = Date.now() - pending.initiatedAt;
    console.log(`🔍 Pending tier change found: expecting tier ${pending.expectedTierId}, webhook has ${webhookTierId}, DB has ${currentDbTierId}, age: ${ageMs}ms`);

    // Webhook contains the tier we were waiting for — allow it and clear the lock
    if (webhookTierId === pending.expectedTierId) {
        console.log(`✅ Webhook matches expected tier ${pending.expectedTierId} — clearing Redis lock and allowing update`);
        await redis.del(key);
        return false;
    }

    // Within the TTL window — webhook has stale tier data, ignore it
    if (ageMs < PENDING_TIER_CHANGE_TTL_SECONDS * 1000) {
        console.log(`⏸️  IGNORING webhook with stale tier ${webhookTierId} (expecting ${pending.expectedTierId})`);
        return true;
    }

    // TTL expired but Redis key still present (shouldn't happen often) — allow webhook
    console.log(`⚠️ Redis TTL window expired (${ageMs}ms) — allowing webhook to correct tier`);
    await redis.del(key);
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
    const eventId: string | undefined = req.body.event_id; // Top-level unique event ID from Paddle
    const eventData = req.body.data;

    console.log(`📩 Received Paddle webhook: ${eventType} (ID: ${eventId})`);
    console.log('📦 Webhook payload:', JSON.stringify(req.body, null, 2));

    // Atomic idempotency: INSERT ... ON CONFLICT DO NOTHING on the unique event_id column.
    // If the row already exists, the insert is silently skipped and raw.length === 0.
    // This prevents the race condition where two concurrent deliveries of the same
    // event_id both pass a read-then-check before either marks the row processed.
    let webhookEvent: DRAPaddleWebhookEvent;

    if (eventId) {
        let insertResult: any;
        try {
            insertResult = await manager
                .createQueryBuilder()
                .insert()
                .into(DRAPaddleWebhookEvent)
                .values({ event_id: eventId, event_type: eventType, payload: req.body, processed: false })
                .orIgnore() // ON CONFLICT (event_id) DO NOTHING
                .execute();
        } catch (insertError) {
            console.error('[Webhook] Failed to insert webhook log row:', insertError);
            return res.status(200).json({ success: false, error: 'Failed to log webhook event' });
        }

        if (insertResult.raw.length === 0) {
            // Another request already claimed this event_id — safe no-op
            console.log(`⚠️ Idempotency: event ${eventId} already claimed — returning 200`);
            return res.status(200).json({ success: true, message: 'Already processed' });
        }

        // Fetch the row we just inserted so we can update it after processing
        webhookEvent = await manager.findOneOrFail(DRAPaddleWebhookEvent, {
            where: { event_id: eventId },
        });
    } else {
        // No event_id from Paddle — fall back to best-effort insert (no idempotency guarantee)
        webhookEvent = manager.create(DRAPaddleWebhookEvent, {
            event_type: eventType,
            payload: req.body,
            processed: false,
        });
        try {
            await manager.save(webhookEvent);
        } catch (error) {
            console.error('[Webhook] Failed to log webhook event (no event_id):', error);
            // Continue processing even if logging fails
        }
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
                                const shouldIgnore = await shouldIgnoreWebhookTierUpdate(
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
                console.log('� Invoice URL fields check:', {
                    receipt_url: eventData.receipt_url,
                    invoice_pdf: eventData.invoice_pdf,
                    invoice_id: eventData.invoice_id,
                    details_receipt_url: eventData.details?.receipt_url,
                    details_invoice_pdf: eventData.details?.invoice_pdf,
                    details_invoice_id: eventData.details?.invoice_id,
                });
                console.log('�📦 Custom data location check:', {
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
                    
                    // Extract invoice/receipt URL from Paddle event data
                    // Note: Paddle uses pre-signed S3 URLs, we can't construct them manually
                    let invoiceUrl: string | null = null;
                    if (eventData.receipt_url && typeof eventData.receipt_url === 'string') {
                        invoiceUrl = eventData.receipt_url;
                    } else if (eventData.invoice_pdf && typeof eventData.invoice_pdf === 'string') {
                        invoiceUrl = eventData.invoice_pdf;
                    } else if (eventData.details?.receipt_url && typeof eventData.details.receipt_url === 'string') {
                        invoiceUrl = eventData.details.receipt_url;
                    } else if (eventData.details?.invoice_pdf && typeof eventData.details.invoice_pdf === 'string') {
                        invoiceUrl = eventData.details.invoice_pdf;
                    }
                    console.log(`   Invoice URL extracted: ${invoiceUrl || 'N/A (none provided by Paddle)'}`);
                    
                    await processor.handleSuccessfulPayment({
                        subscription_id: eventData.subscription_id || eventData.id,
                        customer_id: eventData.customer_id,
                        transaction_id: eventData.id,
                        billing_cycle: customData.billingCycle || 'annual',
                        next_billed_at: eventData.billed_at || null,
                        invoice_url: invoiceUrl,
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
                await processor.handleFailedPayment(
                    eventData.subscription_id || eventData.id,
                    eventData.details?.error_code ?? eventData.error_code ?? undefined
                );
                break;
                
            case 'customer.updated':
                console.log('📘 Processing customer.updated');
                // Sync customer data if needed (e.g., email change)
                break;

            case 'adjustment.created':
            case 'adjustment.updated':
                // Record refund or credit adjustments in the financial ledger
                console.log(`📘 Processing ${eventType}`);
                try {
                    const adjType    = eventData.action === 'refund' ? 'refund' : 'credit';
                    // Paddle adjustment amounts are in smallest currency unit (cents)
                    const adjTotal   = eventData.totals?.total ?? eventData.amount?.total ?? 0;
                    const adjAmount  = typeof adjTotal === 'number' ? -(adjTotal / 100) : 0;
                    const adjCurrency = (eventData.currency_code ?? 'USD').toUpperCase();

                    // Find the subscription that owns this transaction
                    const adjSub = await manager.findOne(DRAOrganizationSubscription, {
                        where: { paddle_subscription_id: eventData.subscription_id },
                    });

                    // Lookup org via subscription, falling back to the raw event
                    const adjOrgId: number | null = adjSub?.organization_id ?? null;

                    if (adjOrgId !== null) {
                        // Avoid duplicate inserts on replay
                        const existingAdj = await manager.findOne(DRAPaymentTransaction, {
                            where: { paddle_transaction_id: String(eventData.id) },
                        });

                        if (!existingAdj) {
                            const adjTx = manager.create(DRAPaymentTransaction, {
                                organization_id: adjOrgId,
                                subscription_id: adjSub?.id ?? null,
                                paddle_transaction_id: String(eventData.id),
                                transaction_type: adjType,
                                amount: adjAmount,
                                currency: adjCurrency,
                                description: eventData.reason ?? `Paddle ${adjType} adjustment`,
                                status: eventData.status === 'approved' ? 'completed' : 'pending',
                                processed_at: eventData.created_at ? new Date(eventData.created_at) : new Date(),
                            });
                            await manager.save(adjTx);
                            console.log(`💳 Adjustment ledger entry created: ${adjType} ${adjCurrency} ${Math.abs(adjAmount).toFixed(2)} for org ${adjOrgId}`);
                        } else {
                            // Update status on adjustment.updated
                            existingAdj.status = eventData.status === 'approved' ? 'completed' : 'pending';
                            await manager.save(existingAdj);
                            console.log(`🔄 Adjustment ledger entry updated: ${eventData.id}`);
                        }
                    } else {
                        console.warn(`⚠️  adjustment.created — no matching subscription for subscription_id ${eventData.subscription_id}`);
                    }
                } catch (adjErr) {
                    console.error('❌ Failed to record adjustment in ledger (non-fatal):', adjErr);
                }
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

        // Save error for audit trail (non-blocking)
        webhookEvent.error_message = error.message;
        try { await manager.save(webhookEvent); } catch { /* ignore */ }

        // Transient infrastructure errors — tell Paddle to retry by returning 500
        const isTransient =
            error.code === 'ECONNREFUSED' ||
            error.code === 'ETIMEDOUT' ||
            error.message?.includes('could not connect') ||
            error.message?.includes('ETIMEDOUT') ||
            error.message?.includes('deadlock detected');

        if (isTransient) {
            console.warn(`⚠️ Transient error — returning 500 to trigger Paddle retry`);
            return res.status(500).json({ success: false, error: 'Transient error, please retry' });
        }

        // Application-level errors (bad data, missing org, etc.) — 200 stops Paddle retries
        return res.status(200).json({ success: false, error: error.message });
    }
});

export default router;
