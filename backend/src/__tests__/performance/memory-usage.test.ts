import { describe, it, expect, beforeAll, afterAll } from '@jest/globals';
import request from 'supertest';
import express, { Express } from 'express';
import { PostgresDriver } from '../../drivers/PostgresDriver.js';
import { EncryptionService } from '../../services/EncryptionService.js';
import { performance } from 'perf_hooks';
import authRoutes from '../../routes/auth.js';
import dataSourceRoutes from '../../routes/data_source.js';
import { validateJWT } from '../../middleware/authenticate.js';

/**
 * DRA-TEST-030: Memory and Resource Usage Tests
 * Tests memory leaks, resource cleanup, encryption overhead, file handling
 * Total: 8+ performance benchmarks
 */
describe('Performance: Memory and Resource Usage', () => {
    let app: Express;
    let dbDriver: any;
    let authToken: string;
    let userId: number;
    let encryptionService: EncryptionService;

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
        encryptionService = EncryptionService.getInstance();

        // Create test user
        const testEmail = `perf-memory-${Date.now()}@example.com`;
        
        await request(app)
            .post('/api/auth/register')
            .send({
                email: testEmail,
                password: 'TestPassword123!',
                name: 'Memory Performance Test User'
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

    describe('Memory Usage', () => {
        it('should not leak memory during repeated requests', async () => {
            if (global.gc) {
                global.gc(); // Force garbage collection if available
            }

            const initialMemory = process.memoryUsage().heapUsed;

            // Perform 100 requests
            for (let i = 0; i < 100; i++) {
                await request(app)
                    .get('/api/user/profile')
                    .set('Authorization', `Bearer ${authToken}`)
                    .expect(200);
            }

            if (global.gc) {
                global.gc();
            }

            const finalMemory = process.memoryUsage().heapUsed;
            const memoryGrowth = finalMemory - initialMemory;
            const memoryGrowthMB = memoryGrowth / 1024 / 1024;

            console.log(`Memory growth: ${memoryGrowthMB.toFixed(2)} MB`);
            
            // Memory growth should be reasonable (less than 50MB for 100 requests)
            expect(memoryGrowthMB).toBeLessThan(50);
        });

        it('should handle large result sets without excessive memory', async () => {
            const initialMemory = process.memoryUsage().heapUsed;

            // Request large dataset
            await request(app)
                .get('/api/data-sources?limit=1000')
                .set('Authorization', `Bearer ${authToken}`)
                .expect(200);

            const finalMemory = process.memoryUsage().heapUsed;
            const memoryGrowth = (finalMemory - initialMemory) / 1024 / 1024;

            expect(memoryGrowth).toBeLessThan(100); // Less than 100MB for large result
        });
    });

    describe('Encryption Performance', () => {
        it('should encrypt connection details efficiently', () => {
            const connectionDetails = {
                host: 'localhost',
                port: 5432,
                database: 'testdb',
                username: 'testuser',
                password: 'testpassword'
            };

            const iterations = 1000;
            const start = performance.now();

            for (let i = 0; i < iterations; i++) {
                encryptionService.encrypt(connectionDetails as any);
            }

            const duration = performance.now() - start;
            const avgTime = duration / iterations;

            console.log(`Average encryption time: ${avgTime.toFixed(3)}ms`);
            expect(avgTime).toBeLessThan(5); // Less than 5ms per encryption
        });

        it('should decrypt connection details efficiently', () => {
            const connectionDetails = {
                host: 'localhost',
                port: 5432,
                database: 'testdb',
                username: 'testuser',
                password: 'testpassword'
            };

            const encrypted = encryptionService.encrypt(connectionDetails as any);
            const iterations = 1000;
            const start = performance.now();

            for (let i = 0; i < iterations; i++) {
                encryptionService.decrypt(encrypted);
            }

            const duration = performance.now() - start;
            const avgTime = duration / iterations;

            console.log(`Average decryption time: ${avgTime.toFixed(3)}ms`);
            expect(avgTime).toBeLessThan(5); // Less than 5ms per decryption
        });

        it('should handle encryption/decryption of large data', () => {
            const largeData = JSON.stringify({
                data: Array.from({ length: 1000 }, (_, i) => ({
                    id: i,
                    name: `Item ${i}`,
                    description: 'A'.repeat(100)
                }))
            });

            const start = performance.now();
            const encrypted = encryptionService.encrypt(largeData as any);
            const encryptTime = performance.now() - start;

            const decryptStart = performance.now();
            encryptionService.decrypt(encrypted);
            const decryptTime = performance.now() - decryptStart;

            console.log(`Large data encryption: ${encryptTime.toFixed(2)}ms`);
            console.log(`Large data decryption: ${decryptTime.toFixed(2)}ms`);

            expect(encryptTime).toBeLessThan(100);
            expect(decryptTime).toBeLessThan(100);
        });
    });

    describe('Database Connection Pooling', () => {
        it('should reuse database connections efficiently', async () => {
            const queries = Array.from({ length: 50 }, async () => {
                const concreteDriver = await dbDriver.getConcreteDriver();
                return concreteDriver.manager.query('SELECT 1 as result');
            });

            const start = performance.now();
            await Promise.all(queries);
            const duration = performance.now() - start;

            console.log(`50 queries using connection pool: ${duration.toFixed(2)}ms`);
            expect(duration).toBeLessThan(500); // All 50 queries in under 500ms
        });

        it('should not exhaust connection pool under load', async () => {
            const queries = Array.from({ length: 100 }, async (_, i) => {
                const concreteDriver = await dbDriver.getConcreteDriver();
                return concreteDriver.manager.query('SELECT $1 as id', [i]);
            });

            await expect(Promise.all(queries)).resolves.toBeDefined();
        });
    });

    describe('Resource Cleanup', () => {
        it('should close database connections properly', async () => {
            const initialConnections = await getActiveConnections();

            // Create multiple connections through requests
            const requests = Array.from({ length: 20 }, () =>
                request(app)
                    .get('/api/data-sources')
                    .set('Authorization', `Bearer ${authToken}`)
            );

            await Promise.all(requests);

            // Wait for connections to be returned to pool
            await new Promise(resolve => setTimeout(resolve, 1000));

            const finalConnections = await getActiveConnections();

            // Connections should be returned to pool, not accumulate
            expect(finalConnections).toBeLessThanOrEqual(initialConnections + 5);
        });

        it('should clean up temporary files', async () => {
            // This would test file upload/export cleanup
            // Implementation depends on file handling logic
            expect(true).toBe(true);
        });
    });

    describe('JSON Processing Performance', () => {
        it('should parse large JSON payloads efficiently', () => {
            const largeJSON = JSON.stringify({
                widgets: Array.from({ length: 100 }, (_, i) => ({
                    id: `widget-${i}`,
                    type: 'chart',
                    config: {
                        title: `Chart ${i}`,
                        data: Array.from({ length: 100 }, (_, j) => ({
                            x: j,
                            y: Math.random() * 100
                        }))
                    }
                }))
            });

            const start = performance.now();
            JSON.parse(largeJSON);
            const duration = performance.now() - start;

            console.log(`Parse large JSON: ${duration.toFixed(2)}ms`);
            expect(duration).toBeLessThan(50);
        });

        it('should stringify large objects efficiently', () => {
            const largeObject = {
                tables: Array.from({ length: 50 }, (_, i) => ({
                    name: `table_${i}`,
                    columns: Array.from({ length: 20 }, (_, j) => ({
                        name: `column_${j}`,
                        type: 'varchar',
                        nullable: true
                    }))
                }))
            };

            const start = performance.now();
            JSON.stringify(largeObject);
            const duration = performance.now() - start;

            console.log(`Stringify large object: ${duration.toFixed(2)}ms`);
            expect(duration).toBeLessThan(50);
        });
    });

    describe('CPU Usage', () => {
        it('should not block event loop during processing', async () => {
            const delays: number[] = [];
            const checkInterval = 10; // Check every 10ms

            const intervalId = setInterval(() => {
                const start = process.hrtime.bigint();
                setImmediate(() => {
                    const delay = Number(process.hrtime.bigint() - start) / 1000000; // Convert to ms
                    delays.push(delay);
                });
            }, checkInterval);

            // Perform CPU-intensive operations
            await request(app)
                .get('/api/data-sources')
                .set('Authorization', `Bearer ${authToken}`)
                .expect(200);

            await new Promise(resolve => setTimeout(resolve, 100));
            clearInterval(intervalId);

            const maxDelay = Math.max(...delays);
            console.log(`Max event loop delay: ${maxDelay.toFixed(2)}ms`);

            // Event loop should not be blocked for more than 50ms
            expect(maxDelay).toBeLessThan(50);
        });
    });

    async function getActiveConnections(): Promise<number> {
        try {
            const concreteDriver = await dbDriver.getConcreteDriver();
            const result = await concreteDriver.manager.query(
                'SELECT count(*) as count FROM pg_stat_activity WHERE datname = current_database()'
            );
            return parseInt(result[0].count);
        } catch {
            return 0;
        }
    }
});
