import { describe, it, expect, beforeAll, afterAll, jest } from '@jest/globals';
import request from 'supertest';
import express, { Express } from 'express';
import { PostgresDriver } from '../../drivers/PostgresDriver.js';
import authRoutes from '../../routes/auth.js';
import dataSourceRoutes from '../../routes/data_source.js';
import { validateJWT } from '../../middleware/authenticate.js';
import { EDataSourceType } from '../../types/EDataSourceType.js';

/**
 * DRA-TEST-025: E2E Data Source Lifecycle
 * Tests complete data source creation, connection testing, updating, and deletion
 * Total: 18+ assertions across CRUD operations
 */
describe('E2E: Data Source Lifecycle', () => {
    let app: Express;
    let dbDriver: any;
    let authToken: string;
    let userId: number;
    let dataSourceId: number;

    beforeAll(async () => {
        // Create Express app with routes
        app = express();
        app.use(express.json());
        app.use('/api/auth', authRoutes);
        app.use('/api/data-sources', validateJWT, dataSourceRoutes);

        dbDriver = PostgresDriver.getInstance();

        // Create test user and login
        const testEmail = `datasource-e2e-${Date.now()}@example.com`;
        
        await request(app)
            .post('/api/auth/register')
            .send({
                email: testEmail,
                password: 'TestPassword123!',
                name: 'Data Source Test User'
            });

        // Verify email
        const concreteDriver = await dbDriver.getConcreteDriver();
        const userResult = await concreteDriver.manager.query(
            'UPDATE dra_users_platform SET email_verified = true WHERE email = $1 RETURNING id',
            [testEmail]
        );
        userId = userResult[0].id;

        // Login
        const loginResponse = await request(app)
            .post('/api/auth/login')
            .send({
                email: testEmail,
                password: 'TestPassword123!'
            });

        authToken = loginResponse.body.token;
    });

    afterAll(async () => {
        // Cleanup test data
        try {
            const concreteDriver = await dbDriver.getConcreteDriver();
            await concreteDriver.manager.query('DELETE FROM dra_users_platform WHERE id = $1', [userId]);
        } catch (error) {
            console.error('Cleanup error:', error);
        }
    });

    describe('Data Source Creation', () => {
        it('should create PostgreSQL data source', async () => {
            const response = await request(app)
                .post('/api/data-sources')
                .set('Authorization', `Bearer ${authToken}`)
                .send({
                    name: 'Test PostgreSQL Database',
                    type: EDataSourceType.POSTGRESQL,
                    connection_details: {
                        host: 'localhost',
                        port: 5432,
                        database: 'testdb',
                        username: 'testuser',
                        password: 'testpass'
                    }
                })
                .expect(201)
                .expect('Content-Type', /json/);

            expect(response.body).toHaveProperty('id');
            expect(response.body).toHaveProperty('name', 'Test PostgreSQL Database');
            expect(response.body).toHaveProperty('type', EDataSourceType.POSTGRESQL);
            expect(response.body).toHaveProperty('user_id', userId);

            dataSourceId = response.body.id;
        });

        it('should create MySQL data source', async () => {
            const response = await request(app)
                .post('/api/data-sources')
                .set('Authorization', `Bearer ${authToken}`)
                .send({
                    name: 'Test MySQL Database',
                    type: EDataSourceType.MYSQL,
                    connection_details: {
                        host: 'mysql.example.com',
                        port: 3306,
                        database: 'mydb',
                        username: 'root',
                        password: 'mysql-pass'
                    }
                })
                .expect(201);

            expect(response.body).toHaveProperty('id');
            expect(response.body).toHaveProperty('type', EDataSourceType.MYSQL);
        });

        it('should create CSV data source', async () => {
            const response = await request(app)
                .post('/api/data-sources')
                .set('Authorization', `Bearer ${authToken}`)
                .send({
                    name: 'CSV File Import',
                    type: EDataSourceType.CSV,
                    connection_details: {
                        file_path: '/uploads/test-data.csv'
                    }
                })
                .expect(201);

            expect(response.body).toHaveProperty('type', EDataSourceType.CSV);
        });

        it('should reject data source without authentication', async () => {
            await request(app)
                .post('/api/data-sources')
                .send({
                    name: 'Unauthorized Source',
                    type: EDataSourceType.POSTGRESQL,
                    connection_details: {}
                })
                .expect(401);
        });

        it('should reject data source with invalid type', async () => {
            const response = await request(app)
                .post('/api/data-sources')
                .set('Authorization', `Bearer ${authToken}`)
                .send({
                    name: 'Invalid Source',
                    type: 'INVALID_TYPE',
                    connection_details: {}
                })
                .expect(400);

            expect(response.body).toHaveProperty('error');
        });
    });

    describe('Connection Testing', () => {
        it('should test data source connection', async () => {
            const response = await request(app)
                .post(`/api/data-sources/${dataSourceId}/test-connection`)
                .set('Authorization', `Bearer ${authToken}`)
                .expect(200);

            expect(response.body).toHaveProperty('success');
            expect(response.body).toHaveProperty('message');
        });

        it('should retrieve database schema', async () => {
            const response = await request(app)
                .get(`/api/data-sources/${dataSourceId}/schema`)
                .set('Authorization', `Bearer ${authToken}`)
                .expect(200);

            expect(response.body).toHaveProperty('tables');
            expect(Array.isArray(response.body.tables)).toBe(true);
        });

        it('should retrieve table metadata', async () => {
            const response = await request(app)
                .get(`/api/data-sources/${dataSourceId}/tables/users/metadata`)
                .set('Authorization', `Bearer ${authToken}`)
                .expect(200);

            expect(response.body).toHaveProperty('columns');
            expect(Array.isArray(response.body.columns)).toBe(true);
        });
    });

    describe('Data Source Retrieval', () => {
        it('should get all user data sources', async () => {
            const response = await request(app)
                .get('/api/data-sources')
                .set('Authorization', `Bearer ${authToken}`)
                .expect(200);

            expect(Array.isArray(response.body)).toBe(true);
            expect(response.body.length).toBeGreaterThan(0);
            expect(response.body[0]).toHaveProperty('id');
            expect(response.body[0]).toHaveProperty('name');
        });

        it('should get specific data source by ID', async () => {
            const response = await request(app)
                .get(`/api/data-sources/${dataSourceId}`)
                .set('Authorization', `Bearer ${authToken}`)
                .expect(200);

            expect(response.body).toHaveProperty('id', dataSourceId);
            expect(response.body).toHaveProperty('name', 'Test PostgreSQL Database');
            expect(response.body).toHaveProperty('connection_details');
        });

        it('should not expose connection password in response', async () => {
            const response = await request(app)
                .get(`/api/data-sources/${dataSourceId}`)
                .set('Authorization', `Bearer ${authToken}`)
                .expect(200);

            // Connection details should be encrypted or masked
            if (response.body.connection_details) {
                expect(response.body.connection_details.password).not.toBe('testpass');
            }
        });

        it('should reject access to other user data sources', async () => {
            // Create another user
            const otherEmail = `other-user-${Date.now()}@example.com`;
            await request(app)
                .post('/api/auth/register')
                .send({
                    email: otherEmail,
                    password: 'Password123!',
                    name: 'Other User'
                });

            const concreteDriver = await dbDriver.getConcreteDriver();
            await concreteDriver.manager.query(
                'UPDATE dra_users_platform SET email_verified = true WHERE email = $1',
                [otherEmail]
            );

            const otherLoginResponse = await request(app)
                .post('/api/auth/login')
                .send({ email: otherEmail, password: 'Password123!' });

            const otherToken = otherLoginResponse.body.token;

            // Try to access first user's data source
            await request(app)
                .get(`/api/data-sources/${dataSourceId}`)
                .set('Authorization', `Bearer ${otherToken}`)
                .expect(403);
        });
    });

    describe('Data Source Updates', () => {
        it('should update data source name', async () => {
            const response = await request(app)
                .put(`/api/data-sources/${dataSourceId}`)
                .set('Authorization', `Bearer ${authToken}`)
                .send({ name: 'Updated PostgreSQL Database' })
                .expect(200);

            expect(response.body).toHaveProperty('name', 'Updated PostgreSQL Database');
        });

        it('should update connection details', async () => {
            const response = await request(app)
                .put(`/api/data-sources/${dataSourceId}`)
                .set('Authorization', `Bearer ${authToken}`)
                .send({
                    connection_details: {
                        host: 'updated-host.example.com',
                        port: 5433,
                        database: 'updateddb',
                        username: 'newuser',
                        password: 'newpass'
                    }
                })
                .expect(200);

            expect(response.body).toHaveProperty('id', dataSourceId);
        });

        it('should verify updated data source', async () => {
            const response = await request(app)
                .get(`/api/data-sources/${dataSourceId}`)
                .set('Authorization', `Bearer ${authToken}`)
                .expect(200);

            expect(response.body).toHaveProperty('name', 'Updated PostgreSQL Database');
        });

        it('should reject update without authentication', async () => {
            await request(app)
                .put(`/api/data-sources/${dataSourceId}`)
                .send({ name: 'Unauthorized Update' })
                .expect(401);
        });
    });

    describe('Data Source Deletion', () => {
        it('should delete data source', async () => {
            const response = await request(app)
                .delete(`/api/data-sources/${dataSourceId}`)
                .set('Authorization', `Bearer ${authToken}`)
                .expect(200);

            expect(response.body).toHaveProperty('success', true);
        });

        it('should not find deleted data source', async () => {
            await request(app)
                .get(`/api/data-sources/${dataSourceId}`)
                .set('Authorization', `Bearer ${authToken}`)
                .expect(404);
        });

        it('should cascade delete related data models', async () => {
            // Verify related data models are also deleted
            const modelsResponse = await request(app)
                .get('/api/data-models')
                .set('Authorization', `Bearer ${authToken}`)
                .expect(200);

            const relatedModels = modelsResponse.body.filter(
                (model: any) => model.data_source_id === dataSourceId
            );

            expect(relatedModels).toHaveLength(0);
        });

        it('should reject deletion of non-existent data source', async () => {
            await request(app)
                .delete('/api/data-sources/99999')
                .set('Authorization', `Bearer ${authToken}`)
                .expect(404);
        });
    });

    describe('Data Query Execution', () => {
        let queryDataSourceId: number;

        beforeAll(async () => {
            // Create a data source for query testing
            const response = await request(app)
                .post('/api/data-sources')
                .set('Authorization', `Bearer ${authToken}`)
                .send({
                    name: 'Query Test Database',
                    type: EDataSourceType.POSTGRESQL,
                    connection_details: {
                        host: 'localhost',
                        port: 5432,
                        database: 'testdb',
                        username: 'testuser',
                        password: 'testpass'
                    }
                });

            queryDataSourceId = response.body.id;
        });

        it('should execute SQL query on data source', async () => {
            const response = await request(app)
                .post(`/api/data-sources/${queryDataSourceId}/query`)
                .set('Authorization', `Bearer ${authToken}`)
                .send({ query: 'SELECT * FROM users LIMIT 10' })
                .expect(200);

            expect(response.body).toHaveProperty('rows');
            expect(Array.isArray(response.body.rows)).toBe(true);
        });

        it('should prevent SQL injection in queries', async () => {
            const response = await request(app)
                .post(`/api/data-sources/${queryDataSourceId}/query`)
                .set('Authorization', `Bearer ${authToken}`)
                .send({ query: "SELECT * FROM users WHERE id = 1; DROP TABLE users; --" })
                .expect(400);

            expect(response.body).toHaveProperty('error');
        });
    });
});
