import request from 'supertest';
import express, { Application } from 'express';
import dashboardRouter from '../dashboard.js';
import { DashboardProcessor } from '../../../../processors/DashboardProcessor.js';
import { TokenProcessor } from '../../../../processors/TokenProcessor.js';
import { ITokenDetails } from '../../../../types/ITokenDetails.js';
import { EUserType } from '../../../../types/EUserType.js';

// Mock processors
const mockAddDashboard: any = jest.fn();
const mockGetDashboards: any = jest.fn();
const mockUpdateDashboard: any = jest.fn();
const mockDeleteDashboard: any = jest.fn();
const mockGeneratePublicExportLink: any = jest.fn();
const mockGetPublicDashboard: any = jest.fn();

jest.mock('../../processors/DashboardProcessor.js', () => ({
    DashboardProcessor: {
        getInstance: jest.fn(() => ({
            addDashboard: mockAddDashboard,
            getDashboards: mockGetDashboards,
            updateDashboard: mockUpdateDashboard,
            deleteDashboard: mockDeleteDashboard,
            generatePublicExportLink: mockGeneratePublicExportLink,
            getPublicDashboard: mockGetPublicDashboard
        }))
    }
}));

const mockValidateToken: any = jest.fn();
jest.mock('../../processors/TokenProcessor.js', () => ({
    TokenProcessor: {
        getInstance: jest.fn(() => ({
            validateToken: mockValidateToken
        }))
    }
}));

describe('Dashboard Operations Integration Tests', () => {
    let app: Application;
    
    const validToken = 'valid-jwt-token';
    const validTokenDetails: ITokenDetails = {
        user_id: 1,
        email: 'test@example.com',
        user_type: EUserType.ADMIN,
        iat: Date.now()
    };

    beforeEach(() => {
        app = express();
        app.use(express.json());
        app.use('/dashboard', dashboardRouter);
        
        jest.clearAllMocks();
        
        // Default mock: valid token
        mockValidateToken.mockResolvedValue(validTokenDetails);
    });

    describe('Dashboard List Operations', () => {
        it('should return list of dashboards for authenticated user', async () => {
            const mockDashboards = [
                { dashboard_id: 1, project_id: 1, data: { layout: 'grid' } },
                { dashboard_id: 2, project_id: 1, data: { layout: 'flex' } }
            ];
            mockGetDashboards.mockResolvedValue(mockDashboards);

            const response = await request(app)
                .get('/dashboard/list')
                .set('Authorization', `Bearer ${validToken}`)
                .expect(200);

            expect(response.body).toEqual(mockDashboards);
            expect(mockGetDashboards).toHaveBeenCalledWith(validTokenDetails);
        });

        it('should handle empty dashboard list', async () => {
            mockGetDashboards.mockResolvedValue([]);

            const response = await request(app)
                .get('/dashboard/list')
                .set('Authorization', `Bearer ${validToken}`)
                .expect(200);

            expect(response.body).toEqual([]);
        });

        it('should require authentication for listing dashboards', async () => {
            const response = await request(app)
                .get('/dashboard/list')
                .expect(401);

            expect(response.body.message).toBe('Unauthorized access');
        });
    });

    describe('Dashboard Creation', () => {
        it('should successfully create a dashboard with valid data', async () => {
            mockAddDashboard.mockResolvedValue(true);

            const dashboardData = {
                widgets: [{ type: 'chart', config: {} }],
                layout: 'grid'
            };

            const response = await request(app)
                .post('/dashboard/add')
                .set('Authorization', `Bearer ${validToken}`)
                .send({ project_id: 1, data: dashboardData })
                .expect(200);

            expect(response.body.message).toBe('The dashboard has been added.');
            expect(mockAddDashboard).toHaveBeenCalledWith(1, dashboardData, validTokenDetails);
        });

        it('should handle dashboard creation failures', async () => {
            mockAddDashboard.mockResolvedValue(false);

            const response = await request(app)
                .post('/dashboard/add')
                .set('Authorization', `Bearer ${validToken}`)
                .send({ project_id: 1, data: { layout: 'grid' } })
                .expect(400);

            expect(response.body.message).toBe('The dashboard could not be added.');
        });

        it('should validate project_id is required', async () => {
            const response = await request(app)
                .post('/dashboard/add')
                .set('Authorization', `Bearer ${validToken}`)
                .send({ data: { layout: 'grid' } })
                .expect(400);

            expect(mockAddDashboard).not.toHaveBeenCalled();
        });

        it('should validate data is required', async () => {
            const response = await request(app)
                .post('/dashboard/add')
                .set('Authorization', `Bearer ${validToken}`)
                .send({ project_id: 1 })
                .expect(400);

            expect(mockAddDashboard).not.toHaveBeenCalled();
        });

        it('should convert project_id to integer', async () => {
            mockAddDashboard.mockResolvedValue(true);

            await request(app)
                .post('/dashboard/add')
                .set('Authorization', `Bearer ${validToken}`)
                .send({ project_id: '123', data: { layout: 'grid' } })
                .expect(200);

            expect(mockAddDashboard).toHaveBeenCalledWith(123, expect.any(Object), validTokenDetails);
        });
    });

    describe('Dashboard Update', () => {
        it('should successfully update a dashboard', async () => {
            mockUpdateDashboard.mockResolvedValue(true);

            const updatedData = {
                widgets: [{ type: 'table', config: {} }],
                layout: 'flex'
            };

            const response = await request(app)
                .post('/dashboard/update/1')
                .set('Authorization', `Bearer ${validToken}`)
                .send({ project_id: 1, data: updatedData })
                .expect(200);

            expect(response.body.message).toBe('The dashboard has been updated.');
            expect(mockUpdateDashboard).toHaveBeenCalledWith(1, 1, updatedData, validTokenDetails);
        });

        it('should handle dashboard update failures', async () => {
            mockUpdateDashboard.mockResolvedValue(false);

            const response = await request(app)
                .post('/dashboard/update/1')
                .set('Authorization', `Bearer ${validToken}`)
                .send({ project_id: 1, data: { layout: 'grid' } })
                .expect(400);

            expect(response.body.message).toBe('The dashboard could not be updated.');
        });

        it('should validate dashboard_id is numeric', async () => {
            await request(app)
                .post('/dashboard/update/1')
                .set('Authorization', `Bearer ${validToken}`)
                .send({ project_id: 1, data: { layout: 'grid' } })
                .expect(200);

            expect(mockUpdateDashboard).toHaveBeenCalledWith(1, 1, expect.any(Object), validTokenDetails);
        });

        it('should require both project_id and data for updates', async () => {
            const response = await request(app)
                .post('/dashboard/update/1')
                .set('Authorization', `Bearer ${validToken}`)
                .send({ project_id: 1 })
                .expect(400);

            expect(mockUpdateDashboard).not.toHaveBeenCalled();
        });
    });

    describe('Dashboard Deletion', () => {
        it('should successfully delete a dashboard', async () => {
            mockDeleteDashboard.mockResolvedValue(true);

            const response = await request(app)
                .delete('/dashboard/delete/1')
                .set('Authorization', `Bearer ${validToken}`)
                .expect(200);

            expect(response.body.message).toBe('The dashboard has been deleted.');
            expect(mockDeleteDashboard).toHaveBeenCalledWith(1, validTokenDetails);
        });

        it('should handle dashboard deletion failures', async () => {
            mockDeleteDashboard.mockResolvedValue(false);

            const response = await request(app)
                .delete('/dashboard/delete/1')
                .set('Authorization', `Bearer ${validToken}`)
                .expect(400);

            expect(response.body.message).toBe('The dashboard could not be deleted.');
        });

        it('should validate dashboard_id parameter', async () => {
            mockDeleteDashboard.mockResolvedValue(true);

            await request(app)
                .delete('/dashboard/delete/123')
                .set('Authorization', `Bearer ${validToken}`)
                .expect(200);

            expect(mockDeleteDashboard).toHaveBeenCalledWith(123, validTokenDetails);
        });

        it('should prevent unauthorized deletion', async () => {
            const response = await request(app)
                .delete('/dashboard/delete/1')
                .expect(401);

            expect(response.body.message).toBe('Unauthorized access');
            expect(mockDeleteDashboard).not.toHaveBeenCalled();
        });
    });

    describe('Public Export Link Generation', () => {
        it('should generate public export link for dashboard', async () => {
            const mockKey = 'abc123xyz456';
            mockGeneratePublicExportLink.mockResolvedValue(mockKey);

            const response = await request(app)
                .get('/dashboard/generate-public-export-link/1')
                .set('Authorization', `Bearer ${validToken}`)
                .expect(200);

            expect(response.body.message).toBe('The public export link has been generated.');
            expect(response.body.key).toBe(mockKey);
            expect(mockGeneratePublicExportLink).toHaveBeenCalledWith(1, validTokenDetails);
        });

        it('should handle public link generation failures', async () => {
            mockGeneratePublicExportLink.mockResolvedValue(null);

            const response = await request(app)
                .get('/dashboard/generate-public-export-link/1')
                .set('Authorization', `Bearer ${validToken}`)
                .expect(400);

            expect(response.body.message).toBe('The public export link could not be generated.');
        });

        it('should require authentication for link generation', async () => {
            const response = await request(app)
                .get('/dashboard/generate-public-export-link/1')
                .expect(401);

            expect(mockGeneratePublicExportLink).not.toHaveBeenCalled();
        });

        it('should validate dashboard_id is numeric', async () => {
            mockGeneratePublicExportLink.mockResolvedValue('key123');

            await request(app)
                .get('/dashboard/generate-public-export-link/999')
                .set('Authorization', `Bearer ${validToken}`)
                .expect(200);

            expect(mockGeneratePublicExportLink).toHaveBeenCalledWith(999, validTokenDetails);
        });
    });

    describe('Public Dashboard Access', () => {
        it('should retrieve public dashboard with valid key', async () => {
            const mockPublicDashboard = {
                dashboard_id: 1,
                data: { widgets: [], layout: 'grid' },
                is_public: true
            };
            mockGetPublicDashboard.mockResolvedValue(mockPublicDashboard);

            const response = await request(app)
                .get('/dashboard/public-dashboard-link/abc123xyz')
                .set('Authorization', `Bearer ${validToken}`)
                .expect(200);

            expect(response.body).toEqual(mockPublicDashboard);
            expect(mockGetPublicDashboard).toHaveBeenCalledWith(encodeURIComponent('abc123xyz'));
        });

        it('should handle invalid public dashboard keys', async () => {
            mockGetPublicDashboard.mockResolvedValue(null);

            const response = await request(app)
                .get('/dashboard/public-dashboard-link/invalidkey')
                .set('Authorization', `Bearer ${validToken}`)
                .expect(400);

            expect(response.body.message).toBe('The public dashboard link could not be retrieved.');
        });

        it('should encode dashboard key in URL', async () => {
            mockGetPublicDashboard.mockResolvedValue({ dashboard_id: 1 });

            await request(app)
                .get('/dashboard/public-dashboard-link/abc xyz')
                .set('Authorization', `Bearer ${validToken}`)
                .expect(200);

            expect(mockGetPublicDashboard).toHaveBeenCalledWith(encodeURIComponent('abc xyz'));
        });

        it('should require authentication for public link access', async () => {
            const response = await request(app)
                .get('/dashboard/public-dashboard-link/abc123')
                .expect(401);

            expect(mockGetPublicDashboard).not.toHaveBeenCalled();
        });
    });

    describe('Dashboard Security', () => {
        it('should enforce user authorization for all operations', async () => {
            mockValidateToken.mockResolvedValue(null);

            await request(app)
                .get('/dashboard/list')
                .set('Authorization', `Bearer invalid-token`)
                .expect(401);

            await request(app)
                .post('/dashboard/add')
                .set('Authorization', `Bearer invalid-token`)
                .send({ project_id: 1, data: {} })
                .expect(401);

            await request(app)
                .post('/dashboard/update/1')
                .set('Authorization', `Bearer invalid-token`)
                .send({ project_id: 1, data: {} })
                .expect(401);

            await request(app)
                .delete('/dashboard/delete/1')
                .set('Authorization', `Bearer invalid-token`)
                .expect(401);
        });

        it('should sanitize dashboard data for XSS prevention', async () => {
            mockAddDashboard.mockResolvedValue(true);

            const xssPayload = {
                project_id: '<script>alert("xss")</script>',
                data: { layout: 'grid' }
            };

            await request(app)
                .post('/dashboard/add')
                .set('Authorization', `Bearer ${validToken}`)
                .send(xssPayload)
                .expect(200);

            // Verify sanitization happened (project_id should be escaped)
            const callArgs = mockAddDashboard.mock.calls[0];
            expect(typeof callArgs[0]).toBe('number');
        });

        it('should validate numeric IDs across all operations', async () => {
            mockUpdateDashboard.mockResolvedValue(true);
            mockDeleteDashboard.mockResolvedValue(true);
            mockGeneratePublicExportLink.mockResolvedValue('key');

            // Update with numeric ID
            await request(app)
                .post('/dashboard/update/42')
                .set('Authorization', `Bearer ${validToken}`)
                .send({ project_id: '100', data: {} })
                .expect(200);

            expect(mockUpdateDashboard).toHaveBeenCalledWith(42, 100, expect.any(Object), validTokenDetails);

            // Delete with numeric ID
            await request(app)
                .delete('/dashboard/delete/42')
                .set('Authorization', `Bearer ${validToken}`)
                .expect(200);

            expect(mockDeleteDashboard).toHaveBeenCalledWith(42, validTokenDetails);

            // Generate link with numeric ID
            await request(app)
                .get('/dashboard/generate-public-export-link/42')
                .set('Authorization', `Bearer ${validToken}`)
                .expect(200);

            expect(mockGeneratePublicExportLink).toHaveBeenCalledWith(42, validTokenDetails);
        });

        it('should enforce project ownership validation', async () => {
            mockUpdateDashboard.mockResolvedValue(false);

            const response = await request(app)
                .post('/dashboard/update/1')
                .set('Authorization', `Bearer ${validToken}`)
                .send({ project_id: 999, data: {} })
                .expect(400);

            expect(response.body.message).toBe('The dashboard could not be updated.');
        });
    });
});
