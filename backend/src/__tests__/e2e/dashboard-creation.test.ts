import { describe, it, expect, beforeAll, afterAll, jest } from '@jest/globals';
import request from 'supertest';
import express, { Express } from 'express';
import { PostgresDriver } from '../../drivers/PostgresDriver.js';
import authRoutes from '../../routes/auth.js';
import dataSourceRoutes from '../../routes/data_source.js';
import dataModelRoutes from '../../routes/data_model.js';
import dashboardRoutes from '../../routes/dashboard.js';
import { validateJWT } from '../../middleware/authenticate.js';
import { EDataSourceType } from '../../types/EDataSourceType.js';

/**
 * DRA-TEST-027: E2E Dashboard Creation Flow
 * Tests complete dashboard creation, widget configuration, layout, and export
 * Total: 18+ assertions across dashboard workflow
 */
describe('E2E: Dashboard Creation Flow', () => {
    let app: Express;
    let dbDriver: any;
    let authToken: string;
    let userId: number;
    let dataSourceId: number;
    let dataModelId: number;
    let dashboardId: number;

    beforeAll(async () => {
        // Create Express app with routes
        app = express();
        app.use(express.json());
        app.use('/api/auth', authRoutes);
        app.use('/api/data-sources', validateJWT, dataSourceRoutes);
        app.use('/api/data-models', validateJWT, dataModelRoutes);
        app.use('/api/dashboards', validateJWT, dashboardRoutes);

        dbDriver = PostgresDriver.getInstance();

        // Create test user
        const testEmail = `dashboard-e2e-${Date.now()}@example.com`;
        
        await request(app)
            .post('/api/auth/register')
            .send({
                email: testEmail,
                password: 'TestPassword123!',
                name: 'Dashboard Test User'
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
                name: 'Dashboard Test Database',
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

        // Create test data model
        const dmResponse = await request(app)
            .post('/api/data-models')
            .set('Authorization', `Bearer ${authToken}`)
            .send({
                name: 'Dashboard Test Model',
                data_source_id: dataSourceId,
                selected_tables: ['users', 'orders'],
                join_conditions: [
                    { from: 'users.id', to: 'orders.user_id', type: 'INNER' }
                ]
            });

        dataModelId = dmResponse.body.id;
    });

    afterAll(async () => {
        try {
            const concreteDriver = await dbDriver.getConcreteDriver();
            await concreteDriver.manager.query('DELETE FROM dra_users_platform WHERE id = $1', [userId]);
        } catch (error) {
            console.error('Cleanup error:', error);
        }
    });

    describe('Dashboard Creation', () => {
        it('should create empty dashboard', async () => {
            const response = await request(app)
                .post('/api/dashboards')
                .set('Authorization', `Bearer ${authToken}`)
                .send({
                    name: 'Sales Dashboard',
                    data_model_id: dataModelId,
                    layout: { widgets: [] }
                })
                .expect(201)
                .expect('Content-Type', /json/);

            expect(response.body).toHaveProperty('id');
            expect(response.body).toHaveProperty('name', 'Sales Dashboard');
            expect(response.body).toHaveProperty('data_model_id', dataModelId);
            expect(response.body).toHaveProperty('layout');

            dashboardId = response.body.id;
        });

        it('should create dashboard with widgets', async () => {
            const response = await request(app)
                .post('/api/dashboards')
                .set('Authorization', `Bearer ${authToken}`)
                .send({
                    name: 'Analytics Dashboard',
                    data_model_id: dataModelId,
                    layout: {
                        widgets: [
                            {
                                id: 'widget-1',
                                type: 'chart',
                                chartType: 'bar',
                                x: 0,
                                y: 0,
                                width: 6,
                                height: 4,
                                config: {
                                    xAxis: 'date',
                                    yAxis: 'revenue'
                                }
                            }
                        ]
                    }
                })
                .expect(201);

            expect(response.body.layout.widgets).toHaveLength(1);
            expect(response.body.layout.widgets[0]).toHaveProperty('type', 'chart');
        });

        it('should reject dashboard without name', async () => {
            await request(app)
                .post('/api/dashboards')
                .set('Authorization', `Bearer ${authToken}`)
                .send({
                    data_model_id: dataModelId,
                    layout: {}
                })
                .expect(400);
        });

        it('should reject dashboard without data_model_id', async () => {
            await request(app)
                .post('/api/dashboards')
                .set('Authorization', `Bearer ${authToken}`)
                .send({
                    name: 'Invalid Dashboard',
                    layout: {}
                })
                .expect(400);
        });
    });

    describe('Widget Configuration', () => {
        it('should add bar chart widget', async () => {
            const response = await request(app)
                .post(`/api/dashboards/${dashboardId}/widgets`)
                .set('Authorization', `Bearer ${authToken}`)
                .send({
                    type: 'chart',
                    chartType: 'bar',
                    x: 0,
                    y: 0,
                    width: 6,
                    height: 4,
                    config: {
                        title: 'Monthly Revenue',
                        xAxis: 'month',
                        yAxis: 'revenue'
                    }
                })
                .expect(201);

            expect(response.body).toHaveProperty('widgets');
        });

        it('should add line chart widget', async () => {
            const response = await request(app)
                .post(`/api/dashboards/${dashboardId}/widgets`)
                .set('Authorization', `Bearer ${authToken}`)
                .send({
                    type: 'chart',
                    chartType: 'line',
                    x: 6,
                    y: 0,
                    width: 6,
                    height: 4,
                    config: {
                        title: 'User Growth',
                        xAxis: 'date',
                        yAxis: 'user_count'
                    }
                })
                .expect(201);

            expect(response.body.widgets.length).toBeGreaterThanOrEqual(2);
        });

        it('should add pie chart widget', async () => {
            const response = await request(app)
                .post(`/api/dashboards/${dashboardId}/widgets`)
                .set('Authorization', `Bearer ${authToken}`)
                .send({
                    type: 'chart',
                    chartType: 'pie',
                    x: 0,
                    y: 4,
                    width: 4,
                    height: 4,
                    config: {
                        title: 'Order Status Distribution',
                        valueField: 'count',
                        labelField: 'status'
                    }
                })
                .expect(201);

            expect(response.body.widgets.length).toBeGreaterThanOrEqual(3);
        });

        it('should add KPI widget', async () => {
            const response = await request(app)
                .post(`/api/dashboards/${dashboardId}/widgets`)
                .set('Authorization', `Bearer ${authToken}`)
                .send({
                    type: 'kpi',
                    x: 4,
                    y: 4,
                    width: 2,
                    height: 2,
                    config: {
                        title: 'Total Revenue',
                        metric: 'SUM(revenue)',
                        format: 'currency'
                    }
                })
                .expect(201);

            expect(response.body.widgets.length).toBeGreaterThanOrEqual(4);
        });

        it('should add table widget', async () => {
            const response = await request(app)
                .post(`/api/dashboards/${dashboardId}/widgets`)
                .set('Authorization', `Bearer ${authToken}`)
                .send({
                    type: 'table',
                    x: 0,
                    y: 8,
                    width: 12,
                    height: 4,
                    config: {
                        title: 'Recent Orders',
                        columns: ['id', 'user', 'amount', 'date'],
                        sortBy: 'date',
                        sortOrder: 'DESC',
                        limit: 10
                    }
                })
                .expect(201);

            expect(response.body.widgets.length).toBeGreaterThanOrEqual(5);
        });
    });

    describe('Dashboard Layout', () => {
        it('should update widget position', async () => {
            const response = await request(app)
                .put(`/api/dashboards/${dashboardId}`)
                .set('Authorization', `Bearer ${authToken}`)
                .send({
                    layout: {
                        widgets: [
                            {
                                id: 'widget-1',
                                type: 'chart',
                                chartType: 'bar',
                                x: 2,
                                y: 2,
                                width: 8,
                                height: 6
                            }
                        ]
                    }
                })
                .expect(200);

            expect(response.body.layout.widgets[0]).toHaveProperty('x', 2);
            expect(response.body.layout.widgets[0]).toHaveProperty('y', 2);
        });

        it('should update widget size', async () => {
            const response = await request(app)
                .put(`/api/dashboards/${dashboardId}`)
                .set('Authorization', `Bearer ${authToken}`)
                .send({
                    layout: {
                        widgets: [
                            {
                                id: 'widget-1',
                                type: 'chart',
                                chartType: 'bar',
                                x: 0,
                                y: 0,
                                width: 12,
                                height: 8
                            }
                        ]
                    }
                })
                .expect(200);

            expect(response.body.layout.widgets[0]).toHaveProperty('width', 12);
            expect(response.body.layout.widgets[0]).toHaveProperty('height', 8);
        });

        it('should remove widget from dashboard', async () => {
            const currentDashboard = await request(app)
                .get(`/api/dashboards/${dashboardId}`)
                .set('Authorization', `Bearer ${authToken}`);

            const updatedWidgets = currentDashboard.body.layout.widgets.slice(1); // Remove first widget

            const response = await request(app)
                .put(`/api/dashboards/${dashboardId}`)
                .set('Authorization', `Bearer ${authToken}`)
                .send({
                    layout: { widgets: updatedWidgets }
                })
                .expect(200);

            expect(response.body.layout.widgets.length).toBe(updatedWidgets.length);
        });
    });

    describe('Dashboard Retrieval', () => {
        it('should get all user dashboards', async () => {
            const response = await request(app)
                .get('/api/dashboards')
                .set('Authorization', `Bearer ${authToken}`)
                .expect(200);

            expect(Array.isArray(response.body)).toBe(true);
            expect(response.body.length).toBeGreaterThan(0);
        });

        it('should get specific dashboard by ID', async () => {
            const response = await request(app)
                .get(`/api/dashboards/${dashboardId}`)
                .set('Authorization', `Bearer ${authToken}`)
                .expect(200);

            expect(response.body).toHaveProperty('id', dashboardId);
            expect(response.body).toHaveProperty('name', 'Sales Dashboard');
            expect(response.body).toHaveProperty('layout');
        });

        it('should filter dashboards by data model', async () => {
            const response = await request(app)
                .get(`/api/dashboards?data_model_id=${dataModelId}`)
                .set('Authorization', `Bearer ${authToken}`)
                .expect(200);

            expect(Array.isArray(response.body)).toBe(true);
            response.body.forEach((dashboard: any) => {
                expect(dashboard.data_model_id).toBe(dataModelId);
            });
        });
    });

    describe('Dashboard Data Fetching', () => {
        it('should fetch widget data', async () => {
            const response = await request(app)
                .get(`/api/dashboards/${dashboardId}/data`)
                .set('Authorization', `Bearer ${authToken}`)
                .expect(200);

            expect(response.body).toHaveProperty('widgets');
            expect(typeof response.body.widgets).toBe('object');
        });

        it('should apply date range filter', async () => {
            const response = await request(app)
                .get(`/api/dashboards/${dashboardId}/data?startDate=2024-01-01&endDate=2024-12-31`)
                .set('Authorization', `Bearer ${authToken}`)
                .expect(200);

            expect(response.body).toHaveProperty('widgets');
        });

        it('should apply custom filters', async () => {
            const response = await request(app)
                .post(`/api/dashboards/${dashboardId}/data`)
                .set('Authorization', `Bearer ${authToken}`)
                .send({
                    filters: {
                        status: 'completed',
                        amount: { gte: 100 }
                    }
                })
                .expect(200);

            expect(response.body).toHaveProperty('widgets');
        });
    });

    describe('Dashboard Export', () => {
        it('should export dashboard as PDF', async () => {
            const response = await request(app)
                .post(`/api/dashboards/${dashboardId}/export`)
                .set('Authorization', `Bearer ${authToken}`)
                .send({ format: 'pdf' })
                .expect(200);

            expect(response.body).toHaveProperty('downloadUrl');
        });

        it('should export dashboard as PNG', async () => {
            const response = await request(app)
                .post(`/api/dashboards/${dashboardId}/export`)
                .set('Authorization', `Bearer ${authToken}`)
                .send({ format: 'png' })
                .expect(200);

            expect(response.body).toHaveProperty('downloadUrl');
        });

        it('should export dashboard as CSV', async () => {
            const response = await request(app)
                .post(`/api/dashboards/${dashboardId}/export`)
                .set('Authorization', `Bearer ${authToken}`)
                .send({ format: 'csv' })
                .expect(200);

            expect(response.body).toHaveProperty('downloadUrl');
        });
    });

    describe('Dashboard Updates', () => {
        it('should update dashboard name', async () => {
            const response = await request(app)
                .put(`/api/dashboards/${dashboardId}`)
                .set('Authorization', `Bearer ${authToken}`)
                .send({ name: 'Updated Sales Dashboard' })
                .expect(200);

            expect(response.body).toHaveProperty('name', 'Updated Sales Dashboard');
        });

        it('should update dashboard description', async () => {
            const response = await request(app)
                .put(`/api/dashboards/${dashboardId}`)
                .set('Authorization', `Bearer ${authToken}`)
                .send({ description: 'Monthly sales analytics and trends' })
                .expect(200);

            expect(response.body).toHaveProperty('description', 'Monthly sales analytics and trends');
        });

        it('should verify updated dashboard', async () => {
            const response = await request(app)
                .get(`/api/dashboards/${dashboardId}`)
                .set('Authorization', `Bearer ${authToken}`)
                .expect(200);

            expect(response.body).toHaveProperty('name', 'Updated Sales Dashboard');
            expect(response.body).toHaveProperty('description', 'Monthly sales analytics and trends');
        });
    });

    describe('Dashboard Deletion', () => {
        it('should delete dashboard', async () => {
            const response = await request(app)
                .delete(`/api/dashboards/${dashboardId}`)
                .set('Authorization', `Bearer ${authToken}`)
                .expect(200);

            expect(response.body).toHaveProperty('success', true);
        });

        it('should not find deleted dashboard', async () => {
            await request(app)
                .get(`/api/dashboards/${dashboardId}`)
                .set('Authorization', `Bearer ${authToken}`)
                .expect(404);
        });

        it('should reject deletion of non-existent dashboard', async () => {
            await request(app)
                .delete('/api/dashboards/99999')
                .set('Authorization', `Bearer ${authToken}`)
                .expect(404);
        });
    });
});
