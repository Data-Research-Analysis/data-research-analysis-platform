import { describe, it, expect, beforeAll, afterAll, jest } from '@jest/globals';
import request from 'supertest';
import express, { Express } from 'express';
import { PostgresDriver } from '../../drivers/PostgresDriver.js';
import authRoutes from '../../routes/auth.js';
import dataSourceRoutes from '../../routes/data_source.js';
import dataModelRoutes from '../../routes/data_model.js';
import { validateJWT } from '../../middleware/authenticate.js';
import { EDataSourceType } from '../../types/EDataSourceType.js';

/**
 * DRA-TEST-026: E2E Data Model Builder Flow
 * Tests complete data model creation, table selection, joins, computed columns
 * Total: 18+ assertions across model building workflow
 */
describe('E2E: Data Model Builder Flow', () => {
    let app: Express;
    let dbDriver: any;
    let authToken: string;
    let userId: number;
    let dataSourceId: number;
    let dataModelId: number;

    beforeAll(async () => {
        // Create Express app with routes
        app = express();
        app.use(express.json());
        app.use('/api/auth', authRoutes);
        app.use('/api/data-sources', validateJWT, dataSourceRoutes);
        app.use('/api/data-models', validateJWT, dataModelRoutes);

        dbDriver = PostgresDriver.getInstance();

        // Create test user
        const testEmail = `datamodel-e2e-${Date.now()}@example.com`;
        
        await request(app)
            .post('/api/auth/register')
            .send({
                email: testEmail,
                password: 'TestPassword123!',
                name: 'Data Model Test User'
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

        // Create test data source
        const dsResponse = await request(app)
            .post('/api/data-sources')
            .set('Authorization', `Bearer ${authToken}`)
            .send({
                name: 'Model Test Database',
                type: EDataSourceType.POSTGRESQL,
                connection_details: {
                    host: 'localhost',
                    port: 5432,
                    database: 'testdb',
                    username: 'testuser',
                    password: 'testpass'
                }
            });

        dataSourceId = dsResponse.body.id;
    });

    afterAll(async () => {
        try {
            const concreteDriver = await dbDriver.getConcreteDriver();
            await concreteDriver.manager.query('DELETE FROM dra_users_platform WHERE id = $1', [userId]);
        } catch (error) {
            console.error('Cleanup error:', error);
        }
    });

    describe('Data Model Creation', () => {
        it('should create simple data model with single table', async () => {
            const response = await request(app)
                .post('/api/data-models')
                .set('Authorization', `Bearer ${authToken}`)
                .send({
                    name: 'Simple User Model',
                    data_source_id: dataSourceId,
                    selected_tables: ['users'],
                    join_conditions: []
                })
                .expect(201)
                .expect('Content-Type', /json/);

            expect(response.body).toHaveProperty('id');
            expect(response.body).toHaveProperty('name', 'Simple User Model');
            expect(response.body).toHaveProperty('data_source_id', dataSourceId);
            expect(response.body.selected_tables).toHaveLength(1);

            dataModelId = response.body.id;
        });

        it('should create data model with multiple tables', async () => {
            const response = await request(app)
                .post('/api/data-models')
                .set('Authorization', `Bearer ${authToken}`)
                .send({
                    name: 'Multi-Table Model',
                    data_source_id: dataSourceId,
                    selected_tables: ['users', 'orders', 'products'],
                    join_conditions: []
                })
                .expect(201);

            expect(response.body.selected_tables).toHaveLength(3);
            expect(response.body.selected_tables).toContain('users');
            expect(response.body.selected_tables).toContain('orders');
            expect(response.body.selected_tables).toContain('products');
        });

        it('should reject data model without tables', async () => {
            const response = await request(app)
                .post('/api/data-models')
                .set('Authorization', `Bearer ${authToken}`)
                .send({
                    name: 'Empty Model',
                    data_source_id: dataSourceId,
                    selected_tables: []
                })
                .expect(400);

            expect(response.body).toHaveProperty('error');
        });

        it('should reject data model without data_source_id', async () => {
            await request(app)
                .post('/api/data-models')
                .set('Authorization', `Bearer ${authToken}`)
                .send({
                    name: 'No Source Model',
                    selected_tables: ['users']
                })
                .expect(400);
        });
    });

    describe('Join Conditions', () => {
        it('should create data model with INNER join', async () => {
            const response = await request(app)
                .post('/api/data-models')
                .set('Authorization', `Bearer ${authToken}`)
                .send({
                    name: 'User Orders Model',
                    data_source_id: dataSourceId,
                    selected_tables: ['users', 'orders'],
                    join_conditions: [
                        {
                            from: 'users.id',
                            to: 'orders.user_id',
                            type: 'INNER'
                        }
                    ]
                })
                .expect(201);

            expect(response.body.join_conditions).toHaveLength(1);
            expect(response.body.join_conditions[0]).toHaveProperty('type', 'INNER');
        });

        it('should create data model with LEFT join', async () => {
            const response = await request(app)
                .post('/api/data-models')
                .set('Authorization', `Bearer ${authToken}`)
                .send({
                    name: 'Users with Optional Orders',
                    data_source_id: dataSourceId,
                    selected_tables: ['users', 'orders'],
                    join_conditions: [
                        {
                            from: 'users.id',
                            to: 'orders.user_id',
                            type: 'LEFT'
                        }
                    ]
                })
                .expect(201);

            expect(response.body.join_conditions[0]).toHaveProperty('type', 'LEFT');
        });

        it('should create data model with multiple joins', async () => {
            const response = await request(app)
                .post('/api/data-models')
                .set('Authorization', `Bearer ${authToken}`)
                .send({
                    name: 'Complex Join Model',
                    data_source_id: dataSourceId,
                    selected_tables: ['users', 'orders', 'products', 'categories'],
                    join_conditions: [
                        { from: 'users.id', to: 'orders.user_id', type: 'INNER' },
                        { from: 'orders.product_id', to: 'products.id', type: 'INNER' },
                        { from: 'products.category_id', to: 'categories.id', type: 'LEFT' }
                    ]
                })
                .expect(201);

            expect(response.body.join_conditions).toHaveLength(3);
        });

        it('should validate join condition structure', async () => {
            const response = await request(app)
                .post('/api/data-models')
                .set('Authorization', `Bearer ${authToken}`)
                .send({
                    name: 'Invalid Join Model',
                    data_source_id: dataSourceId,
                    selected_tables: ['users', 'orders'],
                    join_conditions: [
                        { from: 'users.id', type: 'INNER' } // Missing 'to'
                    ]
                })
                .expect(400);

            expect(response.body).toHaveProperty('error');
        });
    });

    describe('Computed Columns', () => {
        it('should create data model with computed column', async () => {
            const response = await request(app)
                .post('/api/data-models')
                .set('Authorization', `Bearer ${authToken}`)
                .send({
                    name: 'Model with Computed Columns',
                    data_source_id: dataSourceId,
                    selected_tables: ['orders'],
                    join_conditions: [],
                    computed_columns: [
                        {
                            name: 'total_price',
                            expression: 'quantity * unit_price',
                            type: 'number'
                        }
                    ]
                })
                .expect(201);

            expect(response.body.computed_columns).toHaveLength(1);
            expect(response.body.computed_columns[0]).toHaveProperty('name', 'total_price');
        });

        it('should create data model with multiple computed columns', async () => {
            const response = await request(app)
                .post('/api/data-models')
                .set('Authorization', `Bearer ${authToken}`)
                .send({
                    name: 'Multiple Computed Columns Model',
                    data_source_id: dataSourceId,
                    selected_tables: ['users'],
                    join_conditions: [],
                    computed_columns: [
                        { name: 'full_name', expression: "first_name || ' ' || last_name", type: 'string' },
                        { name: 'age', expression: 'EXTRACT(YEAR FROM AGE(birth_date))', type: 'number' },
                        { name: 'is_adult', expression: 'age >= 18', type: 'boolean' }
                    ]
                })
                .expect(201);

            expect(response.body.computed_columns).toHaveLength(3);
        });

        it('should prevent SQL injection in computed column expressions', async () => {
            const response = await request(app)
                .post('/api/data-models')
                .set('Authorization', `Bearer ${authToken}`)
                .send({
                    name: 'Malicious Computed Model',
                    data_source_id: dataSourceId,
                    selected_tables: ['users'],
                    computed_columns: [
                        {
                            name: 'malicious',
                            expression: "'; DROP TABLE users; --",
                            type: 'string'
                        }
                    ]
                })
                .expect(400);

            expect(response.body).toHaveProperty('error');
        });
    });

    describe('Data Model Retrieval', () => {
        it('should get all user data models', async () => {
            const response = await request(app)
                .get('/api/data-models')
                .set('Authorization', `Bearer ${authToken}`)
                .expect(200);

            expect(Array.isArray(response.body)).toBe(true);
            expect(response.body.length).toBeGreaterThan(0);
        });

        it('should get specific data model by ID', async () => {
            const response = await request(app)
                .get(`/api/data-models/${dataModelId}`)
                .set('Authorization', `Bearer ${authToken}`)
                .expect(200);

            expect(response.body).toHaveProperty('id', dataModelId);
            expect(response.body).toHaveProperty('name', 'Simple User Model');
        });

        it('should filter data models by data source', async () => {
            const response = await request(app)
                .get(`/api/data-models?data_source_id=${dataSourceId}`)
                .set('Authorization', `Bearer ${authToken}`)
                .expect(200);

            expect(Array.isArray(response.body)).toBe(true);
            response.body.forEach((model: any) => {
                expect(model.data_source_id).toBe(dataSourceId);
            });
        });
    });

    describe('Data Model Updates', () => {
        it('should update data model name', async () => {
            const response = await request(app)
                .put(`/api/data-models/${dataModelId}`)
                .set('Authorization', `Bearer ${authToken}`)
                .send({ name: 'Updated User Model' })
                .expect(200);

            expect(response.body).toHaveProperty('name', 'Updated User Model');
        });

        it('should update selected tables', async () => {
            const response = await request(app)
                .put(`/api/data-models/${dataModelId}`)
                .set('Authorization', `Bearer ${authToken}`)
                .send({
                    selected_tables: ['users', 'profiles']
                })
                .expect(200);

            expect(response.body.selected_tables).toHaveLength(2);
            expect(response.body.selected_tables).toContain('profiles');
        });

        it('should update join conditions', async () => {
            const response = await request(app)
                .put(`/api/data-models/${dataModelId}`)
                .set('Authorization', `Bearer ${authToken}`)
                .send({
                    join_conditions: [
                        { from: 'users.id', to: 'profiles.user_id', type: 'LEFT' }
                    ]
                })
                .expect(200);

            expect(response.body.join_conditions).toHaveLength(1);
        });
    });

    describe('Data Preview', () => {
        it('should preview data from data model', async () => {
            const response = await request(app)
                .get(`/api/data-models/${dataModelId}/preview`)
                .set('Authorization', `Bearer ${authToken}`)
                .expect(200);

            expect(response.body).toHaveProperty('rows');
            expect(Array.isArray(response.body.rows)).toBe(true);
        });

        it('should apply limit to preview data', async () => {
            const response = await request(app)
                .get(`/api/data-models/${dataModelId}/preview?limit=5`)
                .set('Authorization', `Bearer ${authToken}`)
                .expect(200);

            expect(response.body.rows.length).toBeLessThanOrEqual(5);
        });

        it('should include column metadata in preview', async () => {
            const response = await request(app)
                .get(`/api/data-models/${dataModelId}/preview`)
                .set('Authorization', `Bearer ${authToken}`)
                .expect(200);

            expect(response.body).toHaveProperty('columns');
            expect(Array.isArray(response.body.columns)).toBe(true);
        });
    });

    describe('Data Model Deletion', () => {
        it('should delete data model', async () => {
            const response = await request(app)
                .delete(`/api/data-models/${dataModelId}`)
                .set('Authorization', `Bearer ${authToken}`)
                .expect(200);

            expect(response.body).toHaveProperty('success', true);
        });

        it('should not find deleted data model', async () => {
            await request(app)
                .get(`/api/data-models/${dataModelId}`)
                .set('Authorization', `Bearer ${authToken}`)
                .expect(404);
        });

        it('should cascade delete related dashboards', async () => {
            // Verify related dashboards are deleted
            const dashboardsResponse = await request(app)
                .get('/api/dashboards')
                .set('Authorization', `Bearer ${authToken}`)
                .expect(200);

            const relatedDashboards = dashboardsResponse.body.filter(
                (dashboard: any) => dashboard.data_model_id === dataModelId
            );

            expect(relatedDashboards).toHaveLength(0);
        });
    });
});
