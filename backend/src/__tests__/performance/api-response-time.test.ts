import { describe, it, expect, beforeAll, afterAll } from '@jest/globals';
import request from 'supertest';
import express, { Express } from 'express';
import { PostgresDriver } from '../../drivers/PostgresDriver.js';
import authRoutes from '../../routes/auth.js';
import dataSourceRoutes from '../../routes/data_source.js';
import { validateJWT } from '../../middleware/authenticate.js';

/**
 * DRA-TEST-029: API Response Time Tests
 * Tests endpoint response times, throughput, concurrent load handling
 * Total: 8+ performance benchmarks
 */
describe('Performance: API Response Times', () => {
    let app: Express;
    let dbDriver: any;
    let authToken: string;
    let userId: number;

    beforeAll(async () => {
        // Create Express app with routes
        app = express();
        app.use(express.json());
        app.use('/api/auth', authRoutes);
        app.use('/api/data-sources', validateJWT, dataSourceRoutes);
        app.get('/api/user/profile', validateJWT, (req, res) => {
            res.json({ id: (req as any).user.id, email: (req as any).user.email });
        });

        dbDriver = PostgresDriver.getInstance();

        // Create test user
        const testEmail = `perf-api-${Date.now()}@example.com`;
        
        await request(app)
            .post('/api/auth/register')
            .send({
                email: testEmail,
                password: 'TestPassword123!',
                name: 'API Performance Test User'
            });

        const concreteDriver = await dbDriver.getConcreteDriver();
        const userResult = await concreteDriver.manager.query(
            'UPDATE dra_users_platform SET email_verified = true WHERE email = $1 RETURNING id',
            [testEmail]
        );
        userId = userResult[0].id;

        const loginResponse = await request(app)
            .post('/api/auth/login')
            .send({ email: testEmail, password: 'TestPassword123!' });

        authToken = loginResponse.body.token;
    });

    afterAll(async () => {
        try {
            const concreteDriver = await dbDriver.getConcreteDriver();
            await concreteDriver.manager.query('DELETE FROM dra_users_platform WHERE id = $1', [userId]);
        } catch (error) {
            console.error('Cleanup error:', error);
        }
    });

    describe('Authentication Endpoints', () => {
        it('should complete login in under 500ms', async () => {
            const start = Date.now();
            
            await request(app)
                .post('/api/auth/login')
                .send({
                    email: `perf-api-${userId}@example.com`,
                    password: 'TestPassword123!'
                });

            const duration = Date.now() - start;
            expect(duration).toBeLessThan(500);
        });

        it('should validate token in under 50ms', async () => {
            const start = Date.now();
            
            await request(app)
                .get('/api/user/profile')
                .set('Authorization', `Bearer ${authToken}`)
                .expect(200);

            const duration = Date.now() - start;
            expect(duration).toBeLessThan(50);
        });
    });

    describe('CRUD Operations Performance', () => {
        it('should create data source in under 300ms', async () => {
            const start = Date.now();
            
            await request(app)
                .post('/api/data-sources')
                .set('Authorization', `Bearer ${authToken}`)
                .send({
                    name: 'Performance Test Source',
                    type: 'POSTGRESQL',
                    connection_details: {
                        host: 'localhost',
                        port: 5432,
                        database: 'testdb',
                        username: 'user',
                        password: 'pass'
                    }
                });

            const duration = Date.now() - start;
            expect(duration).toBeLessThan(300);
        });

        it('should retrieve single resource in under 100ms', async () => {
            // Create test resource first
            const createResponse = await request(app)
                .post('/api/data-sources')
                .set('Authorization', `Bearer ${authToken}`)
                .send({
                    name: 'Test Source',
                    type: 'POSTGRESQL',
                    connection_details: {
                        host: 'localhost',
                        port: 5432,
                        database: 'test',
                        username: 'user',
                        password: 'pass'
                    }
                });

            const resourceId = createResponse.body.id;

            const start = Date.now();
            
            await request(app)
                .get(`/api/data-sources/${resourceId}`)
                .set('Authorization', `Bearer ${authToken}`)
                .expect(200);

            const duration = Date.now() - start;
            expect(duration).toBeLessThan(100);
        });

        it('should update resource in under 200ms', async () => {
            const createResponse = await request(app)
                .post('/api/data-sources')
                .set('Authorization', `Bearer ${authToken}`)
                .send({
                    name: 'Update Test Source',
                    type: 'MYSQL',
                    connection_details: {
                        host: 'localhost',
                        port: 3306,
                        database: 'test',
                        username: 'user',
                        password: 'pass'
                    }
                });

            const resourceId = createResponse.body.id;

            const start = Date.now();
            
            await request(app)
                .put(`/api/data-sources/${resourceId}`)
                .set('Authorization', `Bearer ${authToken}`)
                .send({ name: 'Updated Name' })
                .expect(200);

            const duration = Date.now() - start;
            expect(duration).toBeLessThan(200);
        });

        it('should delete resource in under 200ms', async () => {
            const createResponse = await request(app)
                .post('/api/data-sources')
                .set('Authorization', `Bearer ${authToken}`)
                .send({
                    name: 'Delete Test Source',
                    type: 'CSV',
                    connection_details: {
                        file_path: '/uploads/test.csv'
                    }
                });

            const resourceId = createResponse.body.id;

            const start = Date.now();
            
            await request(app)
                .delete(`/api/data-sources/${resourceId}`)
                .set('Authorization', `Bearer ${authToken}`)
                .expect(200);

            const duration = Date.now() - start;
            expect(duration).toBeLessThan(200);
        });
    });

    describe('Concurrent Request Handling', () => {
        it('should handle 10 concurrent GET requests efficiently', async () => {
            const requests = Array.from({ length: 10 }, () =>
                request(app)
                    .get('/api/data-sources')
                    .set('Authorization', `Bearer ${authToken}`)
            );

            const start = Date.now();
            const responses = await Promise.all(requests);
            const duration = Date.now() - start;

            expect(responses.every(r => r.status === 200)).toBe(true);
            expect(duration).toBeLessThan(1000); // All 10 in under 1 second
        });

        it('should handle mixed concurrent requests', async () => {
            const requests = [
                request(app).get('/api/data-sources').set('Authorization', `Bearer ${authToken}`),
                request(app).get('/api/data-models').set('Authorization', `Bearer ${authToken}`),
                request(app).get('/api/dashboards').set('Authorization', `Bearer ${authToken}`),
                request(app).get('/api/user/profile').set('Authorization', `Bearer ${authToken}`),
                request(app).get('/api/data-sources').set('Authorization', `Bearer ${authToken}`)
            ];

            const start = Date.now();
            const responses = await Promise.all(requests);
            const duration = Date.now() - start;

            expect(responses.every(r => r.status === 200)).toBe(true);
            expect(duration).toBeLessThan(800);
        });
    });

    describe('Throughput Tests', () => {
        it('should maintain performance under sustained load', async () => {
            const iterations = 50;
            const durations: number[] = [];

            for (let i = 0; i < iterations; i++) {
                const start = Date.now();
                
                await request(app)
                    .get('/api/user/profile')
                    .set('Authorization', `Bearer ${authToken}`)
                    .expect(200);

                durations.push(Date.now() - start);
            }

            const averageTime = durations.reduce((a, b) => a + b, 0) / durations.length;
            const maxTime = Math.max(...durations);

            expect(averageTime).toBeLessThan(100);
            expect(maxTime).toBeLessThan(300); // No single request takes too long
        });

        it('should calculate requests per second', async () => {
            const duration = 5000; // 5 seconds
            const startTime = Date.now();
            let requestCount = 0;

            while (Date.now() - startTime < duration) {
                await request(app)
                    .get('/api/user/profile')
                    .set('Authorization', `Bearer ${authToken}`)
                    .expect(200);
                
                requestCount++;
            }

            const actualDuration = (Date.now() - startTime) / 1000;
            const rps = requestCount / actualDuration;

            console.log(`Requests per second: ${rps.toFixed(2)}`);
            expect(rps).toBeGreaterThan(5); // At least 5 RPS
        });
    });

    describe('Payload Size Impact', () => {
        it('should handle small payloads quickly', async () => {
            const start = Date.now();
            
            await request(app)
                .post('/api/data-sources')
                .set('Authorization', `Bearer ${authToken}`)
                .send({
                    name: 'Small Payload',
                    type: 'CSV',
                    connection_details: { file_path: '/test.csv' }
                });

            const duration = Date.now() - start;
            expect(duration).toBeLessThan(200);
        });

        it('should handle large payloads reasonably', async () => {
            const largeLayout = {
                widgets: Array.from({ length: 50 }, (_, i) => ({
                    id: `widget-${i}`,
                    type: 'chart',
                    chartType: 'bar',
                    x: i % 12,
                    y: Math.floor(i / 12) * 4,
                    width: 4,
                    height: 4,
                    config: {
                        title: `Widget ${i}`,
                        xAxis: 'date',
                        yAxis: 'value'
                    }
                }))
            };

            const start = Date.now();
            
            await request(app)
                .post('/api/dashboards')
                .set('Authorization', `Bearer ${authToken}`)
                .send({
                    name: 'Large Dashboard',
                    data_model_id: 1,
                    layout: largeLayout
                });

            const duration = Date.now() - start;
            expect(duration).toBeLessThan(1000); // Under 1 second even for large payload
        });
    });
});
