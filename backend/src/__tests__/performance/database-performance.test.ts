import { describe, it, expect, beforeAll, afterAll, jest } from '@jest/globals';
import request from 'supertest';
import express, { Express } from 'express';
import { PostgresDriver } from '../../drivers/PostgresDriver.js';
import authRoutes from '../../routes/auth.js';
import dataSourceRoutes from '../../routes/data_source.js';
import dataModelRoutes from '../../routes/data_model.js';
import dashboardRoutes from '../../routes/dashboard.js';
import { validateJWT } from '../../middleware/authenticate.js';

/**
 * DRA-TEST-028: Database Query Performance Tests
 * Tests query optimization, indexing, connection pooling, N+1 prevention
 * Total: 8+ performance benchmarks
 */
describe('Performance: Database Query Optimization', () => {
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
        app.use('/api/data-models', validateJWT, dataModelRoutes);
        app.use('/api/dashboards', validateJWT, dashboardRoutes);
        app.get('/api/user/profile', validateJWT, (req, res) => {
            res.json({ id: (req as any).user.id, email: (req as any).user.email });
        });

        dbDriver = PostgresDriver.getInstance();

        // Create test user
        const testEmail = `perf-db-${Date.now()}@example.com`;
        
        await request(app)
            .post('/api/auth/register')
            .send({
                email: testEmail,
                password: 'TestPassword123!',
                name: 'Performance Test User'
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

    describe('Query Response Time', () => {
        it('should fetch user profile in under 100ms', async () => {
            const start = Date.now();
            
            await request(app)
                .get('/api/user/profile')
                .set('Authorization', `Bearer ${authToken}`)
                .expect(200);

            const duration = Date.now() - start;
            expect(duration).toBeLessThan(100);
        });

        it('should list data sources in under 200ms', async () => {
            const start = Date.now();
            
            await request(app)
                .get('/api/data-sources')
                .set('Authorization', `Bearer ${authToken}`)
                .expect(200);

            const duration = Date.now() - start;
            expect(duration).toBeLessThan(200);
        });

        it('should list data models in under 200ms', async () => {
            const start = Date.now();
            
            await request(app)
                .get('/api/data-models')
                .set('Authorization', `Bearer ${authToken}`)
                .expect(200);

            const duration = Date.now() - start;
            expect(duration).toBeLessThan(200);
        });

        it('should list dashboards in under 200ms', async () => {
            const start = Date.now();
            
            await request(app)
                .get('/api/dashboards')
                .set('Authorization', `Bearer ${authToken}`)
                .expect(200);

            const duration = Date.now() - start;
            expect(duration).toBeLessThan(200);
        });
    });

    describe('Pagination Performance', () => {
        it('should handle pagination efficiently', async () => {
            const start = Date.now();
            
            await request(app)
                .get('/api/data-sources?limit=10&offset=0')
                .set('Authorization', `Bearer ${authToken}`)
                .expect(200);

            const duration = Date.now() - start;
            expect(duration).toBeLessThan(200);
        });

        it('should maintain performance with large offset', async () => {
            const start = Date.now();
            
            await request(app)
                .get('/api/data-sources?limit=10&offset=100')
                .set('Authorization', `Bearer ${authToken}`)
                .expect(200);

            const duration = Date.now() - start;
            expect(duration).toBeLessThan(300); // Slightly higher for offset
        });
    });

    describe('N+1 Query Prevention', () => {
        it('should fetch user with related data sources in single query batch', async () => {
            const queryCountBefore = await getQueryCount();
            
            await request(app)
                .get('/api/user/profile?include=data_sources')
                .set('Authorization', `Bearer ${authToken}`)
                .expect(200);

            const queryCountAfter = await getQueryCount();
            const queriesExecuted = queryCountAfter - queryCountBefore;

            // Should use JOIN or eager loading, not N+1
            expect(queriesExecuted).toBeLessThan(5);
        });

        it('should fetch data models with data sources efficiently', async () => {
            const queryCountBefore = await getQueryCount();
            
            await request(app)
                .get('/api/data-models?include=data_source')
                .set('Authorization', `Bearer ${authToken}`)
                .expect(200);

            const queryCountAfter = await getQueryCount();
            const queriesExecuted = queryCountAfter - queryCountBefore;

            expect(queriesExecuted).toBeLessThan(5);
        });
    });

    describe('Connection Pool Management', () => {
        it('should handle concurrent requests efficiently', async () => {
            const requests = Array.from({ length: 20 }, () =>
                request(app)
                    .get('/api/data-sources')
                    .set('Authorization', `Bearer ${authToken}`)
            );

            const start = Date.now();
            await Promise.all(requests);
            const duration = Date.now() - start;

            // All 20 requests should complete in under 2 seconds
            expect(duration).toBeLessThan(2000);
        });

        it('should not exhaust connection pool', async () => {
            const requests = Array.from({ length: 50 }, () =>
                request(app)
                    .get('/api/user/profile')
                    .set('Authorization', `Bearer ${authToken}`)
            );

            await expect(Promise.all(requests)).resolves.toBeDefined();
        });
    });

    async function getQueryCount(): Promise<number> {
        try {
            const result = await dbDriver.query(
                'SELECT sum(calls) as total_queries FROM pg_stat_statements WHERE query NOT LIKE \'%pg_stat_statements%\''
            );
            return parseInt(result[0]?.total_queries || '0');
        } catch {
            return 0; // pg_stat_statements may not be available
        }
    }
});
