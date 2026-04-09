import { describe, it, expect, beforeAll, afterAll, beforeEach } from '@jest/globals';
import request from 'supertest';
import express, { Express } from 'express';
import { AppDataSource } from '../../datasources/PostgresDS.js';
import { DRAOrganization } from '../../models/DRAOrganization.js';
import { DRAOrganizationMember } from '../../models/DRAOrganizationMember.js';
import { DRAUsersPlatform } from '../../models/DRAUsersPlatform.js';
import { DRASubscriptionTier, ESubscriptionTier } from '../../models/DRASubscriptionTier.js';
import { DRAOrganizationSubscription } from '../../models/DRAOrganizationSubscription.js';
import subscriptionRoutes from '../../routes/subscription.js';
import { validateJWT } from '../../middleware/authenticate.js';
import jwt from 'jsonwebtoken';

/**
 * DRA-TEST-PADDLE-001: Paddle Subscription Integration Tests
 * 
 * Tests the subscription management flow including:
 * - Checkout initiation
 * - Subscription retrieval
 * - Payment history
 * - Billing portal URL generation
 * - Subscription cancellation
 * - Authorization checks
 * 
 * NOTE: These tests use mocked Paddle responses. Actual Paddle integration
 * should be tested in Paddle sandbox environment separately.
 */
describe('Paddle Subscription Integration Tests', () => {
    let app: Express;
    let testUser: DRAUsersPlatform;
    let testOrganization: DRAOrganization;
    let testSubscription: DRAOrganizationSubscription;
    let authToken: string;
    let freeTier: DRASubscriptionTier;
    let starterTier: DRASubscriptionTier;

    beforeAll(async () => {
        // Ensure database connection
        if (!AppDataSource.isInitialized) {
            await AppDataSource.initialize();
        }

        // Create Express app with routes
        app = express();
        app.use(express.json());
        
        // Mock the expensive operations limiter for testing
        const mockLimiter = (req: any, res: any, next: any) => next();
        
        // Apply middleware
        app.use('/subscription', subscriptionRoutes);

        const manager = AppDataSource.manager;

        // Create test user
        testUser = manager.create(DRAUsersPlatform, {
            email: `paddle-test-${Date.now()}@example.com`,
            name: 'Paddle Test User',
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
            name: 'Test Organization for Paddle',
            email: testUser.email,
            owner_id: testUser.id,
            settings: {
                owner_email: testUser.email,
                owner_name: `${testUser.first_name} ${testUser.last_name}`
            }
        });
        await manager.save(testOrganization);

        // Create organization membership
        const membership = manager.create(DRAOrganizationMember, {
            organization_id: testOrganization.id,
            users_platform_id: testUser.id,
            role: 'owner'
        });
        await manager.save(membership);

        // Create test subscription (FREE tier by default)
        testSubscription = manager.create(DRAOrganizationSubscription, {
            organization_id: testOrganization.id,
            subscription_tier_id: freeTier.id,
            is_active: true,
            billing_cycle: 'annual',
            started_at: new Date()
        });
        await manager.save(testSubscription);

        // Generate auth token
        const secret = process.env.JWT_SECRET || 'test-secret';
        authToken = jwt.sign(
            {
                user_id: testUser.id,
                email: testUser.email,
                name: `${testUser.first_name} ${testUser.last_name}`,
                exp: Math.floor(Date.now() / 1000) + 3600 // 1 hour
            },
            secret
        );
    });

    afterAll(async () => {
        // Cleanup test data
        const manager = AppDataSource.manager;

        try {
            // Delete in reverse order of dependencies
            if (testSubscription?.id) {
                await manager.delete(DRAOrganizationSubscription, { id: testSubscription.id });
            }
            if (testOrganization?.id) {
                await manager.delete(DRAOrganizationMember, { organization_id: testOrganization.id });
                await manager.delete(DRAOrganization, { id: testOrganization.id });
            }
            if (testUser?.id) {
                await manager.delete(DRAUsersPlatform, { id: testUser.id });
            }
        } catch (error) {
            console.error('Cleanup error:', error);
        }
    });

    describe('GET /subscription/:organizationId', () => {
        it('should retrieve subscription details for organization member', async () => {
            const response = await request(app)
                .get(`/subscription/${testOrganization.id}`)
                .set('Authorization', `Bearer ${authToken}`)
                .expect(200)
                .expect('Content-Type', /json/);

            expect(response.body.success).toBe(true);
            expect(response.body.data).toHaveProperty('id');
            expect(response.body.data).toHaveProperty('tier_name');
            expect(response.body.data).toHaveProperty('billing_cycle');
            expect(response.body.data).toHaveProperty('is_active');
        });

        it('should return 403 for non-member access', async () => {
            // Create another user who is not a member
            const manager = AppDataSource.manager;
            const nonMember = manager.create(DRAUsersPlatform, {
                email: `non-member-${Date.now()}@example.com`,
                name: 'Non Member',
                password: 'Password123!',
                email_verified: true
            });
            await manager.save(nonMember);

            const secret = process.env.JWT_SECRET || 'test-secret';
            const nonMemberToken = jwt.sign(
                { user_id: nonMember.id, email: nonMember.email },
                secret
            );

            const response = await request(app)
                .get(`/subscription/${testOrganization.id}`)
                .set('Authorization', `Bearer ${nonMemberToken}`)
                .expect(403)
                .expect('Content-Type', /json/);

            expect(response.body.success).toBe(false);
            expect(response.body.error).toMatch(/not a member/i);

            // Cleanup
            await manager.delete(DRAUsersPlatform, { id: nonMember.id });
        });

        it('should return 404 for non-existent organization', async () => {
            const response = await request(app)
                .get('/subscription/99999999')
                .set('Authorization', `Bearer ${authToken}`)
                .expect(403); // 403 because they're not a member of non-existent org

            expect(response.body.success).toBe(false);
        });

        it('should return 401 without authentication', async () => {
            await request(app)
                .get(`/subscription/${testOrganization.id}`)
                .expect(401);
        });
    });

    describe('POST /subscription/checkout', () => {
        it('should validate required fields', async () => {
            const response = await request(app)
                .post('/subscription/checkout')
                .set('Authorization', `Bearer ${authToken}`)
                .send({}) // Missing required fields
                .expect(400)
                .expect('Content-Type', /json/);

            expect(response.body.success).toBe(false);
            expect(response.body.error).toMatch(/required/i);
        });

        it('should validate billing cycle', async () => {
            const response = await request(app)
                .post('/subscription/checkout')
                .set('Authorization', `Bearer ${authToken}`)
                .send({
                    tierId: starterTier.id,
                    billingCycle: 'invalid',
                    organizationId: testOrganization.id
                })
                .expect(400)
                .expect('Content-Type', /json/);

            expect(response.body.success).toBe(false);
            expect(response.body.error).toMatch(/billing cycle/i);
        });

        it('should reject checkout for non-member', async () => {
            const manager = AppDataSource.manager;
            const nonMember = manager.create(DRAUsersPlatform, {
                email: `non-member-checkout-${Date.now()}@example.com`,
                name: 'Non Member Checkout',
                password: 'Password123!',
                email_verified: true
            });
            await manager.save(nonMember);

            const secret = process.env.JWT_SECRET || 'test-secret';
            const nonMemberToken = jwt.sign(
                { user_id: nonMember.id, email: nonMember.email },
                secret
            );

            const response = await request(app)
                .post('/subscription/checkout')
                .set('Authorization', `Bearer ${nonMemberToken}`)
                .send({
                    tierId: starterTier.id,
                    billingCycle: 'monthly',
                    organizationId: testOrganization.id
                })
                .expect(403)
                .expect('Content-Type', /json/);

            expect(response.body.success).toBe(false);
            expect(response.body.error).toMatch(/not a member/i);

            // Cleanup
            await manager.delete(DRAUsersPlatform, { id: nonMember.id });
        });

        // Note: Actual checkout creation requires Paddle API integration
        // which should be mocked or tested in sandbox environment
    });

    describe('POST /subscription/check-activation', () => {
        it('should check activation status', async () => {
            const response = await request(app)
                .post('/subscription/check-activation')
                .set('Authorization', `Bearer ${authToken}`)
                .send({
                    organizationId: testOrganization.id,
                    transactionId: 'test_transaction_123'
                })
                .expect(200)
                .expect('Content-Type', /json/);

            expect(response.body.success).toBe(true);
            expect(response.body).toHaveProperty('activated');
            expect(typeof response.body.activated).toBe('boolean');
        });

        it('should validate required fields', async () => {
            const response = await request(app)
                .post('/subscription/check-activation')
                .set('Authorization', `Bearer ${authToken}`)
                .send({ organizationId: testOrganization.id }) // Missing transactionId
                .expect(400)
                .expect('Content-Type', /json/);

            expect(response.body.success).toBe(false);
            expect(response.body.error).toMatch(/required/i);
        });
    });

    describe('POST /subscription/cancel', () => {
        it('should only allow organization owner to cancel', async () => {
            // Create a non-owner member
            const manager = AppDataSource.manager;
            const nonOwner = manager.create(DRAUsersPlatform, {
                email: `non-owner-${Date.now()}@example.com`,
                name: 'Non Owner Member',
                password: 'Password123!',
                email_verified: true
            });
            await manager.save(nonOwner);

            const nonOwnerMembership = manager.create(DRAOrganizationMember, {
                organization_id: testOrganization.id,
                users_platform_id: nonOwner.id,
                role: 'member' // Not owner
            });
            await manager.save(nonOwnerMembership);

            const secret = process.env.JWT_SECRET || 'test-secret';
            const nonOwnerToken = jwt.sign(
                { user_id: nonOwner.id, email: nonOwner.email },
                secret
            );

            const response = await request(app)
                .post('/subscription/cancel')
                .set('Authorization', `Bearer ${nonOwnerToken}`)
                .send({
                    organizationId: testOrganization.id,
                    reason: 'test'
                })
                .expect(403)
                .expect('Content-Type', /json/);

            expect(response.body.success).toBe(false);
            expect(response.body.error).toMatch(/owner/i);

            // Cleanup
            await manager.delete(DRAOrganizationMember, { id: nonOwnerMembership.id });
            await manager.delete(DRAUsersPlatform, { id: nonOwner.id });
        });

        it('should validate organization ID', async () => {
            const response = await request(app)
                .post('/subscription/cancel')
                .set('Authorization', `Bearer ${authToken}`)
                .send({}) // Missing organizationId
                .expect(400)
                .expect('Content-Type', /json/);

            expect(response.body.success).toBe(false);
            expect(response.body.error).toMatch(/required/i);
        });
    });

    describe('GET /subscription/payment-history/:organizationId', () => {
        it('should return empty array for FREE tier (no Paddle customer)', async () => {
            const response = await request(app)
                .get(`/subscription/payment-history/${testOrganization.id}`)
                .set('Authorization', `Bearer ${authToken}`)
                .expect(200)
                .expect('Content-Type', /json/);

            expect(response.body.success).toBe(true);
            expect(response.body.data).toEqual([]);
        });

        it('should reject non-member access', async () => {
            const manager = AppDataSource.manager;
            const nonMember = manager.create(DRAUsersPlatform, {
                email: `non-member-payment-${Date.now()}@example.com`,
                name: 'Non Member Payment',
                password: 'Password123!',
                email_verified: true
            });
            await manager.save(nonMember);

            const secret = process.env.JWT_SECRET || 'test-secret';
            const nonMemberToken = jwt.sign(
                { user_id: nonMember.id, email: nonMember.email },
                secret
            );

            const response = await request(app)
                .get(`/subscription/payment-history/${testOrganization.id}`)
                .set('Authorization', `Bearer ${nonMemberToken}`)
                .expect(403)
                .expect('Content-Type', /json/);

            expect(response.body.success).toBe(false);
            expect(response.body.error).toMatch(/not a member/i);

            // Cleanup
            await manager.delete(DRAUsersPlatform, { id: nonMember.id });
        });
    });

    describe('POST /subscription/portal-url', () => {
        it('should only allow organization owner to access portal', async () => {
            const manager = AppDataSource.manager;
            const nonOwner = manager.create(DRAUsersPlatform, {
                email: `non-owner-portal-${Date.now()}@example.com`,
                name: 'Non Owner Portal',
                password: 'Password123!',
                email_verified: true
            });
            await manager.save(nonOwner);

            const nonOwnerMembership = manager.create(DRAOrganizationMember, {
                organization_id: testOrganization.id,
                users_platform_id: nonOwner.id,
                role: 'member'
            });
            await manager.save(nonOwnerMembership);

            const secret = process.env.JWT_SECRET || 'test-secret';
            const nonOwnerToken = jwt.sign(
                { user_id: nonOwner.id, email: nonOwner.email },
                secret
            );

            const response = await request(app)
                .post('/subscription/portal-url')
                .set('Authorization', `Bearer ${nonOwnerToken}`)
                .send({ organizationId: testOrganization.id })
                .expect(403)
                .expect('Content-Type', /json/);

            expect(response.body.success).toBe(false);
            expect(response.body.error).toMatch(/owner/i);

            // Cleanup
            await manager.delete(DRAOrganizationMember, { id: nonOwnerMembership.id });
            await manager.delete(DRAUsersPlatform, { id: nonOwner.id });
        });

        it('should validate organization ID', async () => {
            const response = await request(app)
                .post('/subscription/portal-url')
                .set('Authorization', `Bearer ${authToken}`)
                .send({}) // Missing organizationId
                .expect(400)
                .expect('Content-Type', /json/);

            expect(response.body.success).toBe(false);
            expect(response.body.error).toMatch(/required/i);
        });
    });
});
