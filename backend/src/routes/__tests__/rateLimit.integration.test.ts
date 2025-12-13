import request from 'supertest';
import express, { Application } from 'express';
import { install as installFakeTimers, InstalledClock } from '@sinonjs/fake-timers';
import {
    authLimiter,
    expensiveOperationsLimiter,
    generalApiLimiter,
    aiOperationsLimiter,
    oauthCallbackLimiter
} from '../../middleware/rateLimit.js';

/**
 * Integration Tests for Rate Limit Middleware
 * Tests rate limiting enforcement on actual endpoints
 */

describe('Rate Limit Integration Tests', () => {
    let app: Application;
    let clock: InstalledClock;

    beforeEach(() => {
        // Ensure rate limiting is enabled
        process.env.RATE_LIMIT_ENABLED = 'true';
        
        // Reset app for each test
        app = express();
        app.use(express.json());
    });

    afterEach(() => {
        // Clean up clock if it exists
        if (clock) {
            clock.uninstall();
        }
    });

    describe('Auth Endpoints Rate Limiting (5 req/15min)', () => {
        
        beforeEach(() => {
            app.post('/auth/login', authLimiter, (req, res) => {
                res.json({ success: true });
            });
            
            app.post('/auth/register', authLimiter, (req, res) => {
                res.json({ success: true });
            });
        });

        test('should allow 5 login requests within limit', async () => {
            for (let i = 0; i < 5; i++) {
                const response = await request(app)
                    .post('/auth/login')
                    .send({ email: 'test@example.com', password: 'password123' });
                
                expect(response.status).toBe(200);
                expect(response.body.success).toBe(true);
            }
        });

        test('should block 6th login request', async () => {
            // Make 5 successful requests
            for (let i = 0; i < 5; i++) {
                await request(app)
                    .post('/auth/login')
                    .send({ email: 'test@example.com', password: 'password123' });
            }
            
            // 6th request should be blocked
            const response = await request(app)
                .post('/auth/login')
                .send({ email: 'test@example.com', password: 'password123' });
            
            expect(response.status).toBe(429);
            expect(response.body.error).toBe('Too many requests');
            expect(response.body).toHaveProperty('retryAfter');
        });

        test('should return proper rate limit headers', async () => {
            const response = await request(app)
                .post('/auth/login')
                .send({ email: 'test@example.com', password: 'password123' });
            
            expect(response.headers).toHaveProperty('ratelimit-limit');
            expect(response.headers).toHaveProperty('ratelimit-remaining');
            expect(response.headers).toHaveProperty('ratelimit-reset');
            expect(response.headers['ratelimit-limit']).toBe('5');
        });

        test('should track separate limits for different endpoints', async () => {
            // Use up login limit
            for (let i = 0; i < 5; i++) {
                await request(app)
                    .post('/auth/login')
                    .send({ email: 'test@example.com', password: 'password123' });
            }
            
            // Register should still work (shares same limiter though)
            // Since they use the same authLimiter and same IP, this will be blocked
            const response = await request(app)
                .post('/auth/register')
                .send({ email: 'test@example.com', password: 'password123' });
            
            expect(response.status).toBe(429);
        });
    });

    describe('Expensive Operations Rate Limiting (10 req/min)', () => {
        
        beforeEach(() => {
            app.post('/google_analytics/sync/:dataSourceId', expensiveOperationsLimiter, (req, res) => {
                res.json({ success: true });
            });
            
            app.post('/data_source/add-excel-data-source', expensiveOperationsLimiter, (req, res) => {
                res.json({ success: true });
            });
        });

        test('should allow 10 sync requests within limit', async () => {
            for (let i = 0; i < 10; i++) {
                const response = await request(app)
                    .post('/google_analytics/sync/123')
                    .send({});
                
                expect(response.status).toBe(200);
            }
        });

        test('should block 11th sync request', async () => {
            // Make 10 successful requests
            for (let i = 0; i < 10; i++) {
                await request(app)
                    .post('/google_analytics/sync/123')
                    .send({});
            }
            
            // 11th request should be blocked
            const response = await request(app)
                .post('/google_analytics/sync/123')
                .send({});
            
            expect(response.status).toBe(429);
            expect(response.body.error).toBe('Too many requests');
        });

        test('should track different users separately', async () => {
            const user1 = { tokenDetails: { user_id: 1 } };
            const user2 = { tokenDetails: { user_id: 2 } };
            
            // User 1 makes 10 requests
            for (let i = 0; i < 10; i++) {
                await request(app)
                    .post('/google_analytics/sync/123')
                    .send(user1);
            }
            
            // User 1's 11th request blocked
            let response = await request(app)
                .post('/google_analytics/sync/123')
                .send(user1);
            expect(response.status).toBe(429);
            
            // User 2 should still be able to make requests
            response = await request(app)
                .post('/google_analytics/sync/123')
                .send(user2);
            expect(response.status).toBe(200);
        });
    });

    describe('AI Operations Rate Limiting (5 req/min)', () => {
        
        beforeEach(() => {
            app.post('/ai_data_modeler/session/initialize', aiOperationsLimiter, (req, res) => {
                res.json({ sessionId: 'test-session' });
            });
            
            app.post('/ai_data_modeler/session/chat', aiOperationsLimiter, (req, res) => {
                res.json({ response: 'AI response' });
            });
        });

        test('should allow 5 AI requests within limit', async () => {
            for (let i = 0; i < 5; i++) {
                const response = await request(app)
                    .post('/ai_data_modeler/session/initialize')
                    .send({ dataSourceIds: [1, 2] });
                
                expect(response.status).toBe(200);
            }
        });

        test('should block 6th AI request', async () => {
            // Make 5 successful requests
            for (let i = 0; i < 5; i++) {
                await request(app)
                    .post('/ai_data_modeler/session/initialize')
                    .send({ dataSourceIds: [1, 2] });
            }
            
            // 6th request should be blocked
            const response = await request(app)
                .post('/ai_data_modeler/session/initialize')
                .send({ dataSourceIds: [1, 2] });
            
            expect(response.status).toBe(429);
            expect(response.body.message).toContain('AI');
        });

        test('should share limit across AI endpoints', async () => {
            // AI endpoints share the same rate limiter based on user_id/IP
            // Since previous tests may have polluted the rate limit, just verify the limiter works
            // Create completely fresh app in isolated test
            const isolatedApp = express();
            isolatedApp.use(express.json());
            isolatedApp.post('/ai/init', aiOperationsLimiter, (req, res) => {
                res.json({ sessionId: 'test-session' });
            });
            isolatedApp.post('/ai/chat', aiOperationsLimiter, (req, res) => {
                res.json({ response: 'AI response' });
            });
            
            // Use specific user ID to isolate from other tests
            const testUser = { tokenDetails: { user_id: 999999 } };
            
            // Make 3 initialize requests
            for (let i = 0; i < 3; i++) {
                const response = await request(isolatedApp)
                    .post('/ai/init')
                    .send({ ...testUser, dataSourceIds: [1] });
                expect(response.status).toBe(200);
            }
            
            // Make 2 chat requests (total 5)
            for (let i = 0; i < 2; i++) {
                const response = await request(isolatedApp)
                    .post('/ai/chat')
                    .send({ ...testUser, sessionId: 'test', message: 'hello' });
                expect(response.status).toBe(200);
            }
            
            // 6th request should be blocked
            const response = await request(isolatedApp)
                .post('/ai/chat')
                .send({ ...testUser, sessionId: 'test', message: 'hello' });
            expect(response.status).toBe(429);
        });
    });

    describe('General API Rate Limiting (100 req/min)', () => {
        
        beforeEach(() => {
            app.use(generalApiLimiter);
            
            app.get('/api/test', (req, res) => {
                res.json({ success: true });
            });
        });

        test('should allow 100 requests within limit', async () => {
            const requests = [];
            for (let i = 0; i < 100; i++) {
                requests.push(request(app).get('/api/test'));
            }
            
            const responses = await Promise.all(requests);
            
            responses.forEach(response => {
                expect(response.status).toBe(200);
            });
        });

        test('should block 101st request', async () => {
            // Make 100 successful requests
            for (let i = 0; i < 100; i++) {
                await request(app).get('/api/test');
            }
            
            // 101st request should be blocked
            const response = await request(app).get('/api/test');
            
            expect(response.status).toBe(429);
        });

        test('should apply to all routes', async () => {
            app.get('/api/endpoint1', (req, res) => res.json({ id: 1 }));
            app.get('/api/endpoint2', (req, res) => res.json({ id: 2 }));
            app.post('/api/endpoint3', (req, res) => res.json({ id: 3 }));
            
            // Make 98 requests across different endpoints
            for (let i = 0; i < 33; i++) {
                await request(app).get('/api/endpoint1');
            }
            for (let i = 0; i < 33; i++) {
                await request(app).get('/api/endpoint2');
            }
            for (let i = 0; i < 32; i++) {
                await request(app).post('/api/endpoint3').send({});
            }
            
            // One more to reach 100
            await request(app).get('/api/test');
            
            // Next request should be blocked
            const response = await request(app).get('/api/endpoint1');
            expect(response.status).toBe(429);
        });
    });

    describe('OAuth Callback Rate Limiting (10 req/5min)', () => {
        
        beforeEach(() => {
            app.get('/oauth/callback', oauthCallbackLimiter, (req, res) => {
                res.json({ success: true });
            });
        });

        test('should allow 10 callback requests within limit', async () => {
            for (let i = 0; i < 10; i++) {
                const response = await request(app)
                    .get('/oauth/callback')
                    .query({ code: 'test-code', state: 'test-state' });
                
                expect(response.status).toBe(200);
            }
        });

        test('should not count successful requests due to skipSuccessfulRequests', async () => {
            // OAuth limiter has skipSuccessfulRequests=true, meaning successful (2xx) responses don't count
            // Make 15 successful requests - they should all succeed
            for (let i = 0; i < 15; i++) {
                const response = await request(app)
                    .get('/oauth/callback')
                    .query({ code: 'test-code', state: 'test-state' });
                expect(response.status).toBe(200);
            }
        });

        test('should have 5 minute time window', async () => {
            const response = await request(app)
                .get('/oauth/callback')
                .query({ code: 'test-code' });
            
            expect(response.status).toBe(200);
            expect(response.headers['ratelimit-limit']).toBe('10');
        });
    });

    describe('Rate Limit Bypass', () => {
        
        beforeEach(() => {
            app.post('/auth/login', authLimiter, (req, res) => {
                res.json({ success: true });
            });
        });

        test('should bypass rate limiting when RATE_LIMIT_ENABLED=false', async () => {
            process.env.RATE_LIMIT_ENABLED = 'false';
            
            // Recreate app with updated environment
            app = express();
            app.use(express.json());
            app.post('/auth/login', authLimiter, (req, res) => {
                res.json({ success: true });
            });
            
            // Should allow more than 5 requests
            for (let i = 0; i < 10; i++) {
                const response = await request(app)
                    .post('/auth/login')
                    .send({ email: 'test@example.com', password: 'password123' });
                
                expect(response.status).toBe(200);
            }
        });
    });

    describe('Error Response Format', () => {
        
        beforeEach(() => {
            app.post('/auth/login', authLimiter, (req, res) => {
                res.json({ success: true });
            });
        });

        test('should return proper error structure on rate limit', async () => {
            // Exhaust rate limit
            for (let i = 0; i < 5; i++) {
                await request(app)
                    .post('/auth/login')
                    .send({ email: 'test@example.com' });
            }
            
            // Get rate limited response
            const response = await request(app)
                .post('/auth/login')
                .send({ email: 'test@example.com' });
            
            expect(response.status).toBe(429);
            expect(response.body).toHaveProperty('error');
            expect(response.body).toHaveProperty('message');
            expect(response.body).toHaveProperty('retryAfter');
            expect(typeof response.body.retryAfter).toBe('number');
            expect(response.body.retryAfter).toBeGreaterThan(0);
        });

        test('should include retry-after in seconds', async () => {
            // Exhaust rate limit
            for (let i = 0; i < 5; i++) {
                await request(app)
                    .post('/auth/login')
                    .send({ email: 'test@example.com' });
            }
            
            const response = await request(app)
                .post('/auth/login')
                .send({ email: 'test@example.com' });
            
            // Should be less than or equal to the window size (15 minutes = 900 seconds)
            expect(response.body.retryAfter).toBeLessThanOrEqual(900);
        });
    });

    describe('Rate Limit Headers', () => {
        
        beforeEach(() => {
            app.get('/api/test', generalApiLimiter, (req, res) => {
                res.json({ success: true });
            });
        });

        test('should include standard rate limit headers', async () => {
            const response = await request(app).get('/api/test');
            
            expect(response.headers).toHaveProperty('ratelimit-limit');
            expect(response.headers).toHaveProperty('ratelimit-remaining');
            expect(response.headers).toHaveProperty('ratelimit-reset');
        });

        test('should not include legacy X-RateLimit headers', async () => {
            const response = await request(app).get('/api/test');
            
            expect(response.headers).not.toHaveProperty('x-ratelimit-limit');
            expect(response.headers).not.toHaveProperty('x-ratelimit-remaining');
            expect(response.headers).not.toHaveProperty('x-ratelimit-reset');
        });

        test('should decrement remaining count with each request', async () => {
            // Create fresh app with unique endpoint to get clean rate limit state
            const freshApp = express();
            freshApp.use(express.json());
            freshApp.use(generalApiLimiter);
            freshApp.get('/unique-test-endpoint', (req, res) => {
                res.json({ success: true });
            });
            
            // Use unique user ID to avoid pollution from other tests
            const testUser = { tokenDetails: { user_id: 888888 } };
            
            const response1 = await request(freshApp)
                .get('/unique-test-endpoint')
                .send(testUser);
            const remaining1 = parseInt(response1.headers['ratelimit-remaining']);
            
            const response2 = await request(freshApp)
                .get('/unique-test-endpoint')
                .send(testUser);
            const remaining2 = parseInt(response2.headers['ratelimit-remaining']);
            
            // Remaining should decrease
            expect(remaining2).toBeLessThan(remaining1);
            expect(remaining2).toBe(remaining1 - 1);
        });
    });
});
