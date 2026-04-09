import express, { Request, Response } from 'express';
import crypto from 'crypto';
import { SubscriptionProcessor } from '../processors/SubscriptionProcessor.js';
import { AppDataSource } from '../datasources/PostgresDS.js';
import { DRAPaddleWebhookEvent } from '../models/DRAPaddleWebhookEvent.js';
import { DRAOrganizationSubscription } from '../models/DRAOrganizationSubscription.js';

const router = express.Router();

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
        
        const isValid = computedSignature === signature;
        
        if (!isValid) {
            console.error('❌ Signature mismatch');
            console.error('Expected:', signature);
            console.error('Computed:', computedSignature);
        } else {
            console.log('✅ Signature verified');
        }
        
        return isValid;
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
    const eventData = req.body.data;
    
    console.log(`📩 Received Paddle webhook: ${eventType}`);
    
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
    
    // Check for duplicate processing (idempotency)
    if (eventData.transaction_id) {
        const existing = await manager
            .createQueryBuilder(DRAPaddleWebhookEvent, 'event')
            .where('event.event_type = :eventType', { eventType })
            .andWhere('event.processed = true')
            .andWhere("event.payload#>>'{data,transaction_id}' = :transactionId", {
                transactionId: eventData.transaction_id
            })
            .getOne();
        
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
                    subscription_id: eventData.subscription_id || eventData.id,
                    customer_id: eventData.customer_id,
                    transaction_id: eventData.transaction_id || eventData.id,
                    billing_cycle: eventData.billing_period?.interval || 'annual',
                    next_billed_at: eventData.next_billed_at || eventData.billing_period?.ends_at,
                    customData: eventData.custom_data || {}
                });
                break;
                
            case 'subscription.updated':
                console.log('📘 Processing subscription.updated');
                // Handle tier changes, billing cycle changes
                // The subscription processor already updates via upgrade/downgrade methods
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
                
                // If this is a new subscription purchase (has custom_data with organizationId and tierId)
                if (eventData.custom_data?.organizationId && eventData.custom_data?.tierId) {
                    console.log('🆕 New subscription transaction detected');
                    await processor.handleSuccessfulPayment({
                        subscription_id: eventData.subscription_id || eventData.id,
                        customer_id: eventData.customer_id,
                        transaction_id: eventData.id,
                        billing_cycle: eventData.custom_data?.billingCycle || 'annual',
                        next_billed_at: eventData.billed_at || null,
                        customData: eventData.custom_data
                    });
                } else {
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
