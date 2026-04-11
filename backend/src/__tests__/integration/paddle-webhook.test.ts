import { describe, it, expect, beforeAll, afterAll } from '@jest/globals';
import request from 'supertest';
import express, { Express } from 'express';
import crypto from 'crypto';
import { AppDataSource } from '../../datasources/PostgresDS.js';
import { DRAOrganization } from '../../models/DRAOrganization.js';
import { DRAUsersPlatform } from '../../models/DRAUsersPlatform.js';
import { DRASubscriptionTier, ESubscriptionTier } from '../../models/DRASubscriptionTier.js';
import { DRAOrganizationSubscription } from '../../models/DRAOrganizationSubscription.js';
import { DRAPaddleWebhookEvent } from '../../models/DRAPaddleWebhookEvent.js';
import paddleWebhookRoutes from '../../routes/paddle-webhook.js';

/**
 * DRA-TEST-PADDLE-002: Paddle Webhook Handler Integration Tests
 * 
 * Tests the Paddle webhook event handling including:
 * - Signature verification
 * - Event logging
 * - Idempotency checks
 * - Subscription creation/update from webhooks
 * - Payment failure handling
 * - Subscription cancellation
 * 
 * Uses real webhook payload structures from Paddle documentation.
 */
describe('Paddle Webhook Handler Integration Tests', () => {
    let app: Express;
    let testUser: DRAUsersPlatform;
    let testOrganization: DRAOrganization;
    let freeTier: DRASubscriptionTier;
    let starterTier: DRASubscriptionTier;
    const webhookSecret = process.env.PADDLE_WEBHOOK_SECRET || 'test-webhook-secret';

    beforeAll(async () => {
        // Ensure database connection
        if (!AppDataSource.isInitialized) {
            await AppDataSource.initialize();
        }

        // Create Express app with webhook routes
        app = express();
        app.use(express.json());
        app.use(express.text({ type: 'application/json' })); // Paddle sends raw body
        app.use('/paddle', paddleWebhookRoutes);

        const manager = AppDataSource.manager;

        // Create test user
        testUser = manager.create(DRAUsersPlatform, {
            email: `webhook-test-${Date.now()}@example.com`,
            name: 'Webhook Test User',
            password: 'HashedPassword123!',
            email_verified: true
        });
        await manager.save(testUser);

        // Get subscription tiers
        freeTier = await manager.findOneOrFail(DRASubscriptionTier, {
            where: { tier_name: ESubscriptionTier.FREE }
        });

        starterTier = await manager.findOneOrFail(DRASubscriptionTier, {
            where: { tier_name: ESubscriptionTier.STARTER }
        });

        // Create test organization
        testOrganization = manager.create(DRAOrganization, {
            name: 'Test Organization for Webhooks',
            email: testUser.email,
            owner_id: testUser.id,
            settings: {
                owner_email: testUser.email,
                owner_name: `${testUser.first_name} ${testUser.last_name}`
            }
        });
        await manager.save(testOrganization);
    });

    afterAll(async () => {
        // Cleanup test data
        const manager = AppDataSource.manager;

        try {
            if (testOrganization?.id) {
                await manager.delete(DRAOrganizationSubscription, { organization_id: testOrganization.id });
                await manager.delete(DRAPaddleWebhookEvent, { event_id: 'test_event_' }); // Wildcard cleanup
                await manager.delete(DRAOrganization, { id: testOrganization.id });
            }
            if (testUser?.id) {
                await manager.delete(DRAUsersPlatform, { id: testUser.id });
            }
        } catch (error) {
            console.error('Cleanup error:', error);
        }
    });

    /**
     * Helper function to generate Paddle webhook signature
     */
    function generatePaddleSignature(payload: any, timestamp: string): string {
        const payloadString = typeof payload === 'string' ? payload : JSON.stringify(payload);
        const signedPayload = `${timestamp}:${payloadString}`;
        return crypto
            .createHmac('sha256', webhookSecret)
            .update(signedPayload)
            .digest('hex');
    }

    describe('Webhook Signature Verification', () => {
        it('should reject webhook without signature', async () => {
            const payload = {
                event_id: 'test_event_no_sig',
                event_type: 'subscription.created',
                data: {}
            };

            const response = await request(app)
                .post('/paddle/webhook')
                .send(payload)
                .expect(401); // Handler returns 401 for missing/invalid signature

            expect(response.body).toHaveProperty('success', false);
            expect(response.body).toHaveProperty('error', 'Invalid signature');
        });

        it('should reject webhook with invalid signature', async () => {
            const payload = {
                event_id: 'test_event_bad_sig',
                event_type: 'subscription.created',
                data: {}
            };

            const timestamp = Math.floor(Date.now() / 1000).toString();

            const response = await request(app)
                .post('/paddle/webhook')
                .set('Paddle-Signature', `ts=${timestamp};h1=invalid_signature`)
                .send(payload)
                .expect(401); // Handler returns 401 for invalid signature

            expect(response.body).toHaveProperty('success', false);
            expect(response.body).toHaveProperty('error', 'Invalid signature');
        });

        it('should accept webhook with valid signature', async () => {
            const payload = {
                event_id: 'test_event_valid_sig',
                event_type: 'subscription.created',
                occurred_at: new Date().toISOString(),
                data: {
                    id: 'sub_test123',
                    status: 'active',
                    custom_data: {
                        organizationId: testOrganization.id,
                        tierId: starterTier.id,
                        billingCycle: 'monthly'
                    }
                }
            };

            const timestamp = Math.floor(Date.now() / 1000).toString();
            const signature = generatePaddleSignature(payload, timestamp);

            const response = await request(app)
                .post('/paddle/webhook')
                .set('Paddle-Signature', `ts=${timestamp};h1=${signature}`)
                .send(payload)
                .expect(200);

            expect(response.body.success).toBe(true);

            // Verify event was logged successfully
            const manager = AppDataSource.manager;
            const loggedEvent = await manager.findOne(DRAPaddleWebhookEvent, {
                where: {},
                order: { received_at: 'DESC' }
            });

            expect(loggedEvent).toBeDefined();
            expect(loggedEvent?.processed).toBe(true);
            expect(loggedEvent?.error_message).toBeNull();
        });
    });

    describe('Event Idempotency', () => {
        it('should process duplicate events only once', async () => {
            const payload = {
                event_id: 'test_event_duplicate',
                event_type: 'transaction.completed',
                occurred_at: new Date().toISOString(),
                data: {
                    id: 'txn_test123',
                    status: 'completed',
                    custom_data: {
                        organizationId: testOrganization.id
                    }
                }
            };

            const timestamp = Math.floor(Date.now() / 1000).toString();
            const signature = generatePaddleSignature(payload, timestamp);

            // Send webhook first time
            const response1 = await request(app)
                .post('/paddle/webhook')
                .set('Paddle-Signature', `ts=${timestamp};h1=${signature}`)
                .send(payload)
                .expect(200);

            expect(response1.body.success).toBe(true);

            // Send same webhook again (duplicate)
            const response2 = await request(app)
                .post('/paddle/webhook')
                .set('Paddle-Signature', `ts=${timestamp};h1=${signature}`)
                .send(payload)
                .expect(200);

            expect(response2.body.success).toBe(true);
            expect(response2.body.message).toMatch(/already processed/i);

            // Verify only one event was logged
            const manager = AppDataSource.manager;
            const events = await manager.find(DRAPaddleWebhookEvent, {
                order: { received_at: 'DESC' },
                take: 10
            });

            expect(events.length).toBe(1);
        });
    });

    describe('Subscription Event Handling', () => {
        it('should handle subscription.created event', async () => {
            const payload = {
                event_id: 'test_sub_created',
                event_type: 'subscription.created',
                occurred_at: new Date().toISOString(),
                data: {
                    id: 'sub_created_test',
                    status: 'active',
                    customer_id: 'cus_test123',
                    billing_cycle: {
                        interval: 'month',
                        frequency: 1
                    },
                    custom_data: {
                        organizationId: testOrganization.id,
                        tierId: starterTier.id,
                        billingCycle: 'monthly'
                    },
                    scheduled_change: null,
                    started_at: new Date().toISOString(),
                    next_billed_at: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString()
                }
            };

            const timestamp = Math.floor(Date.now() / 1000).toString();
            const signature = generatePaddleSignature(payload, timestamp);

            const response = await request(app)
                .post('/paddle/webhook')
                .set('Paddle-Signature', `ts=${timestamp};h1=${signature}`)
                .send(payload)
                .expect(200);

            expect(response.body.success).toBe(true);

            // Verify subscription was created in database
            const manager = AppDataSource.manager;
            const subscription = await manager.findOne(DRAOrganizationSubscription, {
                where: { 
                    organization_id: testOrganization.id,
                    paddle_subscription_id: 'sub_created_test'
                }
            });

            expect(subscription).toBeDefined();
            expect(subscription?.is_active).toBe(true);
            expect(subscription?.paddle_customer_id).toBe('cus_test123');
            expect(subscription?.billing_cycle).toBe('monthly');
        });

        it('should handle transaction.completed (payment succeeded)', async () => {
            // First create a subscription
            const manager = AppDataSource.manager;
            const subscription = manager.create(DRAOrganizationSubscription, {
                organization_id: testOrganization.id,
                subscription_tier_id: starterTier.id,
                paddle_subscription_id: 'sub_payment_test',
                paddle_customer_id: 'cus_payment_test',
                is_active: true,
                billing_cycle: 'monthly',
                started_at: new Date()
            });
            await manager.save(subscription);

            const payload = {
                event_id: 'test_payment_succeeded',
                event_type: 'transaction.completed',
                occurred_at: new Date().toISOString(),
                data: {
                    id: 'txn_success123',
                    status: 'completed',
                    subscription_id: 'sub_payment_test',
                    custom_data: {
                        organizationId: testOrganization.id
                    }
                }
            };

            const timestamp = Math.floor(Date.now() / 1000).toString();
            const signature = generatePaddleSignature(payload, timestamp);

            const response = await request(app)
                .post('/paddle/webhook')
                .set('Paddle-Signature', `ts=${timestamp};h1=${signature}`)
                .send(payload)
                .expect(200);

            expect(response.body.success).toBe(true);

            // Verify grace period was cleared (if it existed)
            const updatedSub = await manager.findOne(DRAOrganizationSubscription, {
                where: { id: subscription.id }
            });

            expect(updatedSub?.grace_period_ends_at).toBeNull();
            expect(updatedSub?.last_payment_failed_at).toBeNull();
        });

        it('should handle transaction.payment_failed', async () => {
            // Create a subscription
            const manager = AppDataSource.manager;
            const subscription = manager.create(DRAOrganizationSubscription, {
                organization_id: testOrganization.id,
                subscription_tier_id: starterTier.id,
                paddle_subscription_id: 'sub_failed_payment',
                paddle_customer_id: 'cus_failed_test',
                is_active: true,
                billing_cycle: 'annual',
                started_at: new Date()
            });
            await manager.save(subscription);

            const payload = {
                event_id: 'test_payment_failed',
                event_type: 'transaction.payment_failed',
                occurred_at: new Date().toISOString(),
                data: {
                    id: 'txn_failed123',
                    subscription_id: 'sub_failed_payment',
                    custom_data: {
                        organizationId: testOrganization.id
                    }
                }
            };

            const timestamp = Math.floor(Date.now() / 1000).toString();
            const signature = generatePaddleSignature(payload, timestamp);

            const response = await request(app)
                .post('/paddle/webhook')
                .set('Paddle-Signature', `ts=${timestamp};h1=${signature}`)
                .send(payload)
                .expect(200);

            expect(response.body.success).toBe(true);

            // Verify grace period was set (14 days)
            const updatedSub = await manager.findOne(DRAOrganizationSubscription, {
                where: { id: subscription.id }
            });

            expect(updatedSub?.grace_period_ends_at).toBeDefined();
            expect(updatedSub?.last_payment_failed_at).toBeDefined();
            
            // Grace period should be ~14 days from now
            const gracePeriodEnd = new Date(updatedSub!.grace_period_ends_at!);
            const expectedEnd = new Date(Date.now() + 14 * 24 * 60 * 60 * 1000);
            const timeDiff = Math.abs(gracePeriodEnd.getTime() - expectedEnd.getTime());
            expect(timeDiff).toBeLessThan(60000); // Within 1 minute tolerance
        });

        it('should handle subscription.canceled event', async () => {
            // Create a subscription
            const manager = AppDataSource.manager;
            const subscription = manager.create(DRAOrganizationSubscription, {
                organization_id: testOrganization.id,
                subscription_tier_id: starterTier.id,
                paddle_subscription_id: 'sub_cancel_test',
                paddle_customer_id: 'cus_cancel_test',
                is_active: true,
                billing_cycle: 'monthly',
                started_at: new Date()
            });
            await manager.save(subscription);

            const canceledAt = new Date();
            const payload = {
                event_id: 'test_sub_canceled',
                event_type: 'subscription.canceled',
                occurred_at: canceledAt.toISOString(),
                data: {
                    id: 'sub_cancel_test',
                    status: 'canceled',
                    canceled_at: canceledAt.toISOString(),
                    custom_data: {
                        organizationId: testOrganization.id
                    }
                }
            };

            const timestamp = Math.floor(Date.now() / 1000).toString();
            const signature = generatePaddleSignature(payload, timestamp);

            const response = await request(app)
                .post('/paddle/webhook')
                .set('Paddle-Signature', `ts=${timestamp};h1=${signature}`)
                .send(payload)
                .expect(200);

            expect(response.body.success).toBe(true);

            // Verify subscription was marked as canceled
            const updatedSub = await manager.findOne(DRAOrganizationSubscription, {
                where: { id: subscription.id }
            });

            expect(updatedSub?.cancelled_at).toBeDefined();
            expect(new Date(updatedSub!.cancelled_at!).getTime()).toBeCloseTo(canceledAt.getTime(), -2);
        });
    });

    describe('Error Handling', () => {
        it('should log errors for events with missing data', async () => {
            const payload = {
                event_id: 'test_missing_data',
                event_type: 'subscription.created',
                occurred_at: new Date().toISOString(),
                data: {
                    // Missing required fields like id, status, etc.
                }
            };

            const timestamp = Math.floor(Date.now() / 1000).toString();
            const signature = generatePaddleSignature(payload, timestamp);

            const response = await request(app)
                .post('/paddle/webhook')
                .set('Paddle-Signature', `ts=${timestamp};h1=${signature}`)
                .send(payload)
                .expect(200); // Always return 200 to Paddle

            // Verify error was logged
            const manager = AppDataSource.manager;
            const loggedEvent = await manager.findOne(DRAPaddleWebhookEvent, {
                where: {},
                order: { received_at: 'DESC' }
            });

            expect(loggedEvent).toBeDefined();
            expect(loggedEvent?.processed).toBe(false);
            expect(loggedEvent?.error_message).toBeDefined();
        });
    });
});
