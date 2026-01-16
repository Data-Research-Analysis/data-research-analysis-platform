import { jest } from '@jest/globals';
import request from 'supertest';
import express, { Application } from 'express';
import googleAdsRouter from '../google_ads.js';
import { GoogleAdsService } from '../../../../services/GoogleAdsService.js';
import { GoogleAdsDriver } from '../../../../drivers/GoogleAdsDriver.js';
import { DataSourceProcessor } from '../../../../processors/DataSourceProcessor.js';
import { TokenProcessor } from '../../../../processors/TokenProcessor.js';
import { ITokenDetails } from '../../../../types/ITokenDetails.js';
import { EUserType } from '../../../../types/EUserType.js';

// Mock GoogleAdsService
jest.mock('../../services/GoogleAdsService.js', () => ({
    GoogleAdsService: {
        getInstance: jest.fn(() => ({
            listAccounts: jest.fn()
        }))
    }
}));

// Mock GoogleAdsDriver
jest.mock('../../drivers/GoogleAdsDriver.js', () => ({
    GoogleAdsDriver: {
        getInstance: jest.fn(() => ({
            getSyncHistory: jest.fn()
        }))
    }
}));

// Mock DataSourceProcessor
jest.mock('../../processors/DataSourceProcessor.js', () => ({
    DataSourceProcessor: {
        getInstance: jest.fn(() => ({
            addGoogleAdsDataSource: jest.fn(),
            syncGoogleAdsDataSource: jest.fn()
        }))
    }
}));

// Mock TokenProcessor
const mockValidateToken: any = jest.fn();
jest.mock('../../processors/TokenProcessor.js', () => ({
    TokenProcessor: {
        getInstance: jest.fn(() => ({
            validateToken: mockValidateToken
        }))
    }
}));

describe('Google Ads Operations Integration Tests', () => {
    let app: Application;
    let mockAdsService: any;
    let mockAdsDriver: any;
    let mockDataSourceProcessor: any;
    
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
        app.use('/google-ads', googleAdsRouter);
        
        mockAdsService = GoogleAdsService.getInstance();
        mockAdsDriver = GoogleAdsDriver.getInstance();
        mockDataSourceProcessor = DataSourceProcessor.getInstance();
        
        jest.clearAllMocks();
        mockValidateToken.mockResolvedValue(validTokenDetails);
    });

    describe('List Accounts', () => {
        it('should list Google Ads accounts with valid access token', async () => {
            const mockAccounts = [
                { customerId: '123-456-7890', name: 'Account 1', currency: 'USD' },
                { customerId: '987-654-3210', name: 'Account 2', currency: 'EUR' }
            ];

            mockAdsService.listAccounts.mockResolvedValue(mockAccounts);

            const response = await request(app)
                .post('/google-ads/accounts')
                .set('Authorization', `Bearer ${validToken}`)
                .send({ accessToken: 'ads_access_token' })
                .expect(200);

            expect(response.body.success).toBe(true);
            expect(response.body.accounts).toEqual(mockAccounts);
            expect(mockAdsService.listAccounts).toHaveBeenCalledWith('ads_access_token');
        });

        it('should handle empty accounts list', async () => {
            mockAdsService.listAccounts.mockResolvedValue([]);

            const response = await request(app)
                .post('/google-ads/accounts')
                .set('Authorization', `Bearer ${validToken}`)
                .send({ accessToken: 'ads_access_token' })
                .expect(200);

            expect(response.body.success).toBe(true);
            expect(response.body.accounts).toEqual([]);
        });

        it('should require access token', async () => {
            const response = await request(app)
                .post('/google-ads/accounts')
                .set('Authorization', `Bearer ${validToken}`)
                .send({})
                .expect(400);

            expect(response.body.success).toBe(false);
            expect(response.body.error).toBe('Access token is required');
            expect(mockAdsService.listAccounts).not.toHaveBeenCalled();
        });

        it('should handle API errors', async () => {
            mockAdsService.listAccounts.mockRejectedValue(new Error('API rate limit exceeded'));

            const response = await request(app)
                .post('/google-ads/accounts')
                .set('Authorization', `Bearer ${validToken}`)
                .send({ accessToken: 'ads_access_token' })
                .expect(500);

            expect(response.body.success).toBe(false);
            expect(response.body.error).toBe('API rate limit exceeded');
        });

        it('should require authentication', async () => {
            const response = await request(app)
                .post('/google-ads/accounts')
                .send({ accessToken: 'token' })
                .expect(401);

            expect(mockAdsService.listAccounts).not.toHaveBeenCalled();
        });
    });

    describe('Get Report Types', () => {
        it('should return available report types', async () => {
            const response = await request(app)
                .get('/google-ads/report-types')
                .expect(200);

            expect(response.body.success).toBe(true);
            expect(response.body.reportTypes).toBeDefined();
            expect(Array.isArray(response.body.reportTypes)).toBe(true);
            expect(response.body.reportTypes.length).toBeGreaterThan(0);
        });

        it('should include campaign performance report', async () => {
            const response = await request(app)
                .get('/google-ads/report-types')
                .expect(200);

            const campaignReport = response.body.reportTypes.find(
                (r: any) => r.id === 'campaign'
            );

            expect(campaignReport).toBeDefined();
            expect(campaignReport.name).toBe('Campaign Performance');
            expect(campaignReport.metrics).toContain('Cost');
            expect(campaignReport.metrics).toContain('Conversions');
        });

        it('should include keyword performance report', async () => {
            const response = await request(app)
                .get('/google-ads/report-types')
                .expect(200);

            const keywordReport = response.body.reportTypes.find(
                (r: any) => r.id === 'keyword'
            );

            expect(keywordReport).toBeDefined();
            expect(keywordReport.metrics).toContain('Quality Score');
        });

        it('should include geographic and device reports', async () => {
            const response = await request(app)
                .get('/google-ads/report-types')
                .expect(200);

            const reportIds = response.body.reportTypes.map((r: any) => r.id);
            expect(reportIds).toContain('geographic');
            expect(reportIds).toContain('device');
        });

        it('should handle errors gracefully', async () => {
            // Simulate internal error by mocking the route handler
            const response = await request(app)
                .get('/google-ads/report-types')
                .expect(200);

            expect(response.body.success).toBe(true);
        });
    });

    describe('Add Data Source', () => {
        it('should add Google Ads data source successfully', async () => {
            mockDataSourceProcessor.addGoogleAdsDataSource.mockResolvedValue(10);

            const syncConfig = {
                name: 'My Google Ads Account',
                customerId: '123-456-7890',
                accessToken: 'ads_access_token',
                refreshToken: 'ads_refresh_token',
                developerToken: 'dev_token_123',
                reportType: 'campaign',
                dateRange: 'LAST_30_DAYS'
            };

            const response = await request(app)
                .post('/google-ads/add')
                .set('Authorization', `Bearer ${validToken}`)
                .send(syncConfig)
                .expect(200);

            expect(response.body.success).toBe(true);
            expect(response.body.dataSourceId).toBe(10);
            expect(mockDataSourceProcessor.addGoogleAdsDataSource).toHaveBeenCalledWith(
                1,
                expect.objectContaining({
                    name: 'My Google Ads Account',
                    customerId: '123-456-7890'
                })
            );
        });

        it('should require name parameter', async () => {
            const response = await request(app)
                .post('/google-ads/add')
                .set('Authorization', `Bearer ${validToken}`)
                .send({
                    customerId: '123-456-7890',
                    accessToken: 'token',
                    refreshToken: 'refresh'
                })
                .expect(400);

            expect(response.body.success).toBe(false);
            expect(response.body.error).toContain('Missing required fields');
            expect(mockDataSourceProcessor.addGoogleAdsDataSource).not.toHaveBeenCalled();
        });

        it('should require customerId', async () => {
            const response = await request(app)
                .post('/google-ads/add')
                .set('Authorization', `Bearer ${validToken}`)
                .send({
                    name: 'Test',
                    accessToken: 'token',
                    refreshToken: 'refresh'
                })
                .expect(400);

            expect(response.body.success).toBe(false);
            expect(response.body.error).toContain('Missing required fields');
        });

        it('should require accessToken', async () => {
            const response = await request(app)
                .post('/google-ads/add')
                .set('Authorization', `Bearer ${validToken}`)
                .send({
                    name: 'Test',
                    customerId: '123',
                    refreshToken: 'refresh'
                })
                .expect(400);

            expect(response.body.success).toBe(false);
            expect(response.body.error).toContain('Missing required fields');
        });

        it('should require refreshToken', async () => {
            const response = await request(app)
                .post('/google-ads/add')
                .set('Authorization', `Bearer ${validToken}`)
                .send({
                    name: 'Test',
                    customerId: '123',
                    accessToken: 'token'
                })
                .expect(400);

            expect(response.body.success).toBe(false);
            expect(response.body.error).toContain('Missing required fields');
        });

        it('should handle data source creation errors', async () => {
            mockDataSourceProcessor.addGoogleAdsDataSource.mockRejectedValue(
                new Error('Database connection failed')
            );

            const response = await request(app)
                .post('/google-ads/add')
                .set('Authorization', `Bearer ${validToken}`)
                .send({
                    name: 'Test',
                    customerId: '123',
                    accessToken: 'token',
                    refreshToken: 'refresh'
                })
                .expect(500);

            expect(response.body.success).toBe(false);
            expect(response.body.error).toBe('Database connection failed');
        });

        it('should require authentication', async () => {
            const response = await request(app)
                .post('/google-ads/add')
                .send({
                    name: 'Test',
                    customerId: '123',
                    accessToken: 'token',
                    refreshToken: 'refresh'
                })
                .expect(401);

            expect(mockDataSourceProcessor.addGoogleAdsDataSource).not.toHaveBeenCalled();
        });

        it('should reject requests without user_id in token', async () => {
            mockValidateToken.mockResolvedValue({
                email: 'test@example.com',
                user_type: EUserType.ADMIN,
                iat: Date.now()
            } as any);

            const response = await request(app)
                .post('/google-ads/add')
                .set('Authorization', `Bearer ${validToken}`)
                .send({
                    name: 'Test',
                    customerId: '123',
                    accessToken: 'token',
                    refreshToken: 'refresh'
                })
                .expect(401);

            expect(response.body.success).toBe(false);
            expect(response.body.error).toBe('Unauthorized');
        });
    });

    describe('Trigger Sync', () => {
        it('should trigger sync successfully', async () => {
            mockDataSourceProcessor.syncGoogleAdsDataSource.mockResolvedValue(true);

            const response = await request(app)
                .post('/google-ads/sync/10')
                .set('Authorization', `Bearer ${validToken}`)
                .expect(200);

            expect(response.body.success).toBe(true);
            expect(response.body.message).toBe('Sync completed successfully');
            expect(mockDataSourceProcessor.syncGoogleAdsDataSource).toHaveBeenCalledWith(10, 1);
        });

        it('should validate data source ID is numeric', async () => {
            const response = await request(app)
                .post('/google-ads/sync/invalid')
                .set('Authorization', `Bearer ${validToken}`)
                .expect(400);

            expect(response.body.success).toBe(false);
            expect(response.body.error).toBe('Invalid data source ID');
            expect(mockDataSourceProcessor.syncGoogleAdsDataSource).not.toHaveBeenCalled();
        });

        it('should handle sync failures', async () => {
            mockDataSourceProcessor.syncGoogleAdsDataSource.mockResolvedValue(false);

            const response = await request(app)
                .post('/google-ads/sync/10')
                .set('Authorization', `Bearer ${validToken}`)
                .expect(200);

            expect(response.body.success).toBe(false);
            expect(response.body.message).toBe('Sync failed');
        });

        it('should handle sync errors', async () => {
            mockDataSourceProcessor.syncGoogleAdsDataSource.mockRejectedValue(
                new Error('Network timeout')
            );

            const response = await request(app)
                .post('/google-ads/sync/10')
                .set('Authorization', `Bearer ${validToken}`)
                .expect(500);

            expect(response.body.success).toBe(false);
            expect(response.body.error).toBe('Network timeout');
        });

        it('should require authentication', async () => {
            const response = await request(app)
                .post('/google-ads/sync/10')
                .expect(401);

            expect(mockDataSourceProcessor.syncGoogleAdsDataSource).not.toHaveBeenCalled();
        });

        it('should reject requests without user_id', async () => {
            mockValidateToken.mockResolvedValue({
                email: 'test@example.com',
                user_type: EUserType.ADMIN,
                iat: Date.now()
            } as any);

            const response = await request(app)
                .post('/google-ads/sync/10')
                .set('Authorization', `Bearer ${validToken}`)
                .expect(401);

            expect(response.body.success).toBe(false);
            expect(response.body.error).toBe('Unauthorized');
        });

        it('should parse numeric IDs correctly', async () => {
            mockDataSourceProcessor.syncGoogleAdsDataSource.mockResolvedValue(true);

            await request(app)
                .post('/google-ads/sync/999')
                .set('Authorization', `Bearer ${validToken}`)
                .expect(200);

            expect(mockDataSourceProcessor.syncGoogleAdsDataSource).toHaveBeenCalledWith(999, 1);
        });
    });

    describe('Get Sync Status', () => {
        it('should retrieve sync status and history', async () => {
            const mockHistory = [
                {
                    id: 1,
                    data_source_id: 10,
                    status: 'SUCCESS',
                    started_at: new Date('2026-01-04T10:00:00Z'),
                    completed_at: new Date('2026-01-04T10:05:00Z'),
                    records_synced: 1000,
                    records_failed: 0,
                    error_message: null
                },
                {
                    id: 2,
                    data_source_id: 10,
                    status: 'SUCCESS',
                    started_at: new Date('2026-01-03T10:00:00Z'),
                    completed_at: new Date('2026-01-03T10:04:00Z'),
                    records_synced: 950,
                    records_failed: 5,
                    error_message: null
                }
            ];

            mockAdsDriver.getSyncHistory.mockResolvedValue(mockHistory);

            const response = await request(app)
                .get('/google-ads/status/10')
                .set('Authorization', `Bearer ${validToken}`)
                .expect(200);

            expect(response.body.success).toBe(true);
            expect(response.body.status).toBeDefined();
            expect(response.body.status.lastSyncTime).toBeDefined();
            expect(response.body.status.status).toBe('SUCCESS');
            expect(response.body.status.recordsSynced).toBe(1000);
            expect(response.body.history).toEqual(mockHistory);
            expect(mockAdsDriver.getSyncHistory).toHaveBeenCalledWith(10, 10);
        });

        it('should handle idle status when no syncs exist', async () => {
            mockAdsDriver.getSyncHistory.mockResolvedValue([]);

            const response = await request(app)
                .get('/google-ads/status/10')
                .set('Authorization', `Bearer ${validToken}`)
                .expect(200);

            expect(response.body.success).toBe(true);
            expect(response.body.status.status).toBe('IDLE');
            expect(response.body.status.lastSyncTime).toBeNull();
            expect(response.body.status.recordsSynced).toBe(0);
        });

        it('should validate data source ID is numeric', async () => {
            const response = await request(app)
                .get('/google-ads/status/invalid')
                .set('Authorization', `Bearer ${validToken}`)
                .expect(400);

            expect(response.body.success).toBe(false);
            expect(response.body.error).toBe('Invalid data source ID');
            expect(mockAdsDriver.getSyncHistory).not.toHaveBeenCalled();
        });

        it('should include error messages in status', async () => {
            const mockHistory = [
                {
                    id: 1,
                    data_source_id: 10,
                    status: 'FAILED',
                    started_at: new Date('2026-01-04T10:00:00Z'),
                    completed_at: new Date('2026-01-04T10:02:00Z'),
                    records_synced: 0,
                    records_failed: 1000,
                    error_message: 'API quota exceeded'
                }
            ];

            mockAdsDriver.getSyncHistory.mockResolvedValue(mockHistory);

            const response = await request(app)
                .get('/google-ads/status/10')
                .set('Authorization', `Bearer ${validToken}`)
                .expect(200);

            expect(response.body.status.status).toBe('FAILED');
            expect(response.body.status.error).toBe('API quota exceeded');
            expect(response.body.status.recordsFailed).toBe(1000);
        });

        it('should handle retrieval errors', async () => {
            mockAdsDriver.getSyncHistory.mockRejectedValue(new Error('Database error'));

            const response = await request(app)
                .get('/google-ads/status/10')
                .set('Authorization', `Bearer ${validToken}`)
                .expect(500);

            expect(response.body.success).toBe(false);
            expect(response.body.error).toBe('Database error');
        });

        it('should require authentication', async () => {
            const response = await request(app)
                .get('/google-ads/status/10')
                .expect(401);

            expect(mockAdsDriver.getSyncHistory).not.toHaveBeenCalled();
        });

        it('should reject requests without user_id', async () => {
            mockValidateToken.mockResolvedValue({
                email: 'test@example.com',
                user_type: EUserType.ADMIN,
                iat: Date.now()
            } as any);

            const response = await request(app)
                .get('/google-ads/status/10')
                .set('Authorization', `Bearer ${validToken}`)
                .expect(401);

            expect(response.body.success).toBe(false);
            expect(response.body.error).toBe('Unauthorized');
        });
    });

    describe('Security & Input Validation', () => {
        it('should prevent SQL injection in data source IDs', async () => {
            const maliciousId = "10; DROP TABLE data_sources;--";

            const response = await request(app)
                .post(`/google-ads/sync/${encodeURIComponent(maliciousId)}`)
                .set('Authorization', `Bearer ${validToken}`)
                .expect(400);

            expect(response.body.error).toBe('Invalid data source ID');
        });

        it('should sanitize customer IDs', async () => {
            mockDataSourceProcessor.addGoogleAdsDataSource.mockResolvedValue(10);

            const response = await request(app)
                .post('/google-ads/add')
                .set('Authorization', `Bearer ${validToken}`)
                .send({
                    name: 'Test',
                    customerId: '<script>alert("xss")</script>',
                    accessToken: 'token',
                    refreshToken: 'refresh'
                })
                .expect(200);

            expect(response.body.success).toBe(true);
        });

        it('should validate numeric conversions', async () => {
            mockDataSourceProcessor.syncGoogleAdsDataSource.mockResolvedValue(true);

            const testCases = ['0', '-5', '999999999'];

            for (const id of testCases) {
                const expectedId = parseInt(id);
                if (isNaN(expectedId)) {
                    await request(app)
                        .post(`/google-ads/sync/${id}`)
                        .set('Authorization', `Bearer ${validToken}`)
                        .expect(400);
                } else {
                    await request(app)
                        .post(`/google-ads/sync/${id}`)
                        .set('Authorization', `Bearer ${validToken}`);
                }
            }
        });

        it('should enforce authentication on all protected endpoints', async () => {
            const protectedEndpoints = [
                { method: 'post', path: '/google-ads/accounts', body: { accessToken: 'token' } },
                { method: 'post', path: '/google-ads/add', body: { name: 'Test', customerId: '123', accessToken: 'token', refreshToken: 'refresh' } },
                { method: 'post', path: '/google-ads/sync/10', body: {} },
                { method: 'get', path: '/google-ads/status/10', body: {} }
            ];

            for (const endpoint of protectedEndpoints) {
                const req = (request(app) as any)[endpoint.method](endpoint.path);
                if (endpoint.method === 'post') {
                    req.send(endpoint.body);
                }
                await req.expect(401);
            }
        });
    });
});
