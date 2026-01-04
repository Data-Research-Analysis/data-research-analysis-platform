import { describe, it, expect, beforeAll, afterAll, jest } from '@jest/globals';
import request from 'supertest';
import express, { Express } from 'express';
import { PostgresDriver } from '../../drivers/PostgresDriver.js';
import authRoutes from '../../routes/auth.js';
import { validateJWT } from '../../middleware/authenticate.js';

/**
 * DRA-TEST-024: E2E Registration and Login Flow
 * Tests complete user registration, email verification, login, and authentication flow
 * Total: 18+ assertions across multiple scenarios
 */
describe('E2E: User Registration and Login Flow', () => {
    let app: Express;
    let dbDriver: any;
    let testUserEmail: string;
    let verificationToken: string;
    let authToken: string;

    beforeAll(async () => {
        // Create Express app with routes
        app = express();
        app.use(express.json());
        app.use('/api/auth', authRoutes);
        app.get('/api/user/profile', validateJWT, (req, res) => {
            res.json({ id: (req as any).tokenDetails.user_id, email: (req as any).tokenDetails.email });
        });

        dbDriver = PostgresDriver.getInstance();
        testUserEmail = `e2e-test-${Date.now()}@example.com`;
    });

    afterAll(async () => {
        // Cleanup test data
        try {
            const concreteDriver = await dbDriver.getConcreteDriver();
            await concreteDriver.manager.query(
                'DELETE FROM dra_users_platform WHERE email = $1',
                [testUserEmail]
            );
        } catch (error) {
            console.error('Cleanup error:', error);
        }
    });

    describe('User Registration', () => {
        it('should register new user with valid data', async () => {
            const response = await request(app)
                .post('/api/auth/register')
                .send({
                    email: testUserEmail,
                    password: 'SecurePassword123!',
                    name: 'E2E Test User'
                })
                .expect(201)
                .expect('Content-Type', /json/);

            expect(response.body).toHaveProperty('success', true);
            expect(response.body).toHaveProperty('message');
            expect(response.body.message).toMatch(/verification|registered/i);
        });

        it('should reject duplicate email registration', async () => {
            const response = await request(app)
                .post('/api/auth/register')
                .send({
                    email: testUserEmail,
                    password: 'AnotherPassword123!',
                    name: 'Duplicate User'
                })
                .expect(400)
                .expect('Content-Type', /json/);

            expect(response.body).toHaveProperty('error');
            expect(response.body.error).toMatch(/exists|already|duplicate/i);
        });

        it('should reject registration with weak password', async () => {
            const response = await request(app)
                .post('/api/auth/register')
                .send({
                    email: 'newuser@example.com',
                    password: '123',
                    name: 'Weak Password User'
                })
                .expect(400);

            expect(response.body).toHaveProperty('error');
            expect(response.body.error).toMatch(/password/i);
        });

        it('should reject registration with invalid email', async () => {
            const response = await request(app)
                .post('/api/auth/register')
                .send({
                    email: 'not-an-email',
                    password: 'SecurePassword123!',
                    name: 'Invalid Email User'
                })
                .expect(400);

            expect(response.body).toHaveProperty('error');
            expect(response.body.error).toMatch(/email/i);
        });
    });

    describe('Email Verification', () => {
        it('should send verification email after registration', async () => {
            // In real scenario, this would check email service
            // For testing, we retrieve token from database
            const concreteDriver = await dbDriver.getConcreteDriver();
            const result = await concreteDriver.manager.query(
                'SELECT id FROM dra_users_platform WHERE email = $1',
                [testUserEmail]
            );

            expect(result.length).toBe(1);
            expect(result[0]).toHaveProperty('id');
        });

        it('should verify email with valid token', async () => {
            // Generate verification token (in real scenario, from email)
            const concreteDriver = await dbDriver.getConcreteDriver();
            const userResult = await concreteDriver.manager.query(
                'SELECT id FROM dra_users_platform WHERE email = $1',
                [testUserEmail]
            );
            const userId = userResult[0].id;

            // Create verification token
            const { sign } = await import('jsonwebtoken');
            verificationToken = sign({ user_id: userId }, process.env.JWT_SECRET || 'test-secret', { expiresIn: '24h' });

            const response = await request(app)
                .post('/api/auth/verify-email')
                .send({ token: verificationToken })
                .expect(200);

            expect(response.body).toHaveProperty('success', true);
        });

        it('should reject invalid verification token', async () => {
            const response = await request(app)
                .post('/api/auth/verify-email')
                .send({ token: 'invalid-token' })
                .expect(400);

            expect(response.body).toHaveProperty('error');
        });
    });

    describe('User Login', () => {
        it('should login with correct credentials', async () => {
            const response = await request(app)
                .post('/api/auth/login')
                .send({
                    email: testUserEmail,
                    password: 'SecurePassword123!'
                })
                .expect(200)
                .expect('Content-Type', /json/);

            expect(response.body).toHaveProperty('token');
            expect(response.body).toHaveProperty('user');
            expect(response.body.user).toHaveProperty('email', testUserEmail);
            expect(response.body.user).toHaveProperty('name', 'E2E Test User');

            authToken = response.body.token;
        });

        it('should reject login with incorrect password', async () => {
            const response = await request(app)
                .post('/api/auth/login')
                .send({
                    email: testUserEmail,
                    password: 'WrongPassword123!'
                })
                .expect(401);

            expect(response.body).toHaveProperty('error');
            expect(response.body.error).toMatch(/invalid|incorrect|wrong/i);
        });

        it('should reject login with non-existent email', async () => {
            const response = await request(app)
                .post('/api/auth/login')
                .send({
                    email: 'nonexistent@example.com',
                    password: 'Password123!'
                })
                .expect(401);

            expect(response.body).toHaveProperty('error');
        });

        it('should return JWT token on successful login', async () => {
            expect(authToken).toBeDefined();
            expect(typeof authToken).toBe('string');
            expect(authToken.split('.')).toHaveLength(3); // JWT format: header.payload.signature
        });
    });

    describe('Authenticated Requests', () => {
        it('should access protected route with valid token', async () => {
            const response = await request(app)
                .get('/api/user/profile')
                .set('Authorization', `Bearer ${authToken}`)
                .expect(200);

            expect(response.body).toHaveProperty('email', testUserEmail);
        });

        it('should reject protected route without token', async () => {
            await request(app)
                .get('/api/user/profile')
                .expect(401);
        });

        it('should reject protected route with invalid token', async () => {
            await request(app)
                .get('/api/user/profile')
                .set('Authorization', 'Bearer invalid-token')
                .expect(401);
        });

        it('should reject protected route with expired token', async () => {
            const { sign } = await import('jsonwebtoken');
            const expiredToken = sign(
                { user_id: 999 },
                process.env.JWT_SECRET || 'test-secret',
                { expiresIn: '0s' }
            );

            await request(app)
                .get('/api/user/profile')
                .set('Authorization', `Bearer ${expiredToken}`)
                .expect(401);
        });
    });

    describe('Password Reset Flow', () => {
        it('should request password reset', async () => {
            const response = await request(app)
                .post('/api/auth/forgot-password')
                .send({ email: testUserEmail })
                .expect(200);

            expect(response.body).toHaveProperty('success', true);
            expect(response.body).toHaveProperty('message');
        });

        it('should reset password with valid token', async () => {
            // Generate reset token
            const concreteDriver = await dbDriver.getConcreteDriver();
            const userResult = await concreteDriver.manager.query(
                'SELECT id FROM dra_users_platform WHERE email = $1',
                [testUserEmail]
            );
            const userId = userResult[0].id;

            const { sign } = await import('jsonwebtoken');
            const resetToken = sign(
                { user_id: userId, type: 'password_reset' },
                process.env.JWT_SECRET || 'test-secret',
                { expiresIn: '1h' }
            );

            const response = await request(app)
                .post('/api/auth/reset-password')
                .send({
                    token: resetToken,
                    password: 'NewSecurePassword456!'
                })
                .expect(200);

            expect(response.body).toHaveProperty('success', true);
        });

        it('should login with new password after reset', async () => {
            const response = await request(app)
                .post('/api/auth/login')
                .send({
                    email: testUserEmail,
                    password: 'NewSecurePassword456!'
                })
                .expect(200);

            expect(response.body).toHaveProperty('token');
        });
    });

    describe('User Profile Management', () => {
        it('should update user profile', async () => {
            const response = await request(app)
                .put('/api/user/profile')
                .set('Authorization', `Bearer ${authToken}`)
                .send({ name: 'Updated E2E User' })
                .expect(200);

            expect(response.body).toHaveProperty('success', true);
        });

        it('should retrieve updated profile', async () => {
            const response = await request(app)
                .get('/api/user/profile')
                .set('Authorization', `Bearer ${authToken}`)
                .expect(200);

            expect(response.body).toHaveProperty('name', 'Updated E2E User');
        });

        it('should logout user', async () => {
            const response = await request(app)
                .post('/api/auth/logout')
                .set('Authorization', `Bearer ${authToken}`)
                .expect(200);

            expect(response.body).toHaveProperty('success', true);
        });
    });
});
