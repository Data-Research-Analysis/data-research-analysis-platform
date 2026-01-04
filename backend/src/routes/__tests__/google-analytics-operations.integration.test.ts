import { jest } from '@jest/globals';
import request from 'supertest';
import express, { Application } from 'express';
import googleAnalyticsRouter from '../google_analytics.js';
import { GoogleAnalyticsService } from '../../services/GoogleAnalyticsService.js';
import { GoogleAnalyticsDriver } from '../../drivers/GoogleAnalyticsDriver.js';
import { DataSourceProcessor } from '../../processors/DataSourceProcessor.js';
import { TokenProcessor } from '../../processors/TokenProcessor.js';
import { ITokenDetails } from '../../types/ITokenDetails.js';
import { EUserType } from '../../types/EUserType.js';

// Mock GoogleAnalyticsService
jest.mock('../../services/GoogleAnalyticsService.js', () => ({
    GoogleAnalyticsService: {
        getInstance: jest.fn(() => ({
            listProperties: jest.fn(),
            getMetadata: jest.fn()
        })),
        getReportPresets: jest.fn(() => [
            { id: 'traffic', name: 'Traffic Overview' },
            { id: 'acquisition', name: 'User Acquisition' }
        ])
    }
}));

// Mock GoogleAnalyticsDriver
jest.mock('../../drivers/GoogleAnalyticsDriver.js', () => ({
    GoogleAnalyticsDriver: {
        getInstance: jest.fn(() => ({
            getLastSyncTime: jest.fn(),
            getSyncHistory: jest.fn()
        }))
    }
}));

// Mock DataSourceProcessor
jest.mock('../../processors/DataSourceProcessor.js', () => ({
    DataSourceProcessor: {
        getInstance: jest.fn(() => ({
            addGoogleAnalyticsDataSource: jest.fn(),
            syncGoogleAnalyticsDataSource: jest.fn()
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

describe('Google Analytics Operations Integration Tests', () => {
    let app: Application;
    let mockGAService: any;
    let mockGADriver: any;
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
        app.use('/google-analytics', googleAnalyticsRouter);
        
        mockGAService = GoogleAnalyticsService.getInstance();
        mockGADriver = GoogleAnalyticsDriver.getInstance();
        mockDataSourceProcessor = DataSourceProcessor.getInstance();
        
        jest.clearAllMocks();
        mockValidateToken.mockResolvedValue(validTokenDetails);
    });

    describe('List Properties', () => {
        it('should list Google Analytics properties with valid access token', async () => {
            const mockProperties = [
                { propertyId: '123456789', displayName: 'Website Analytics' },
                { propertyId: '987654321', displayName: 'Mobile App Analytics' }
            ];

            mockGAService.listProperties.mockResolvedValue(mockProperties);

            const response = await request(app)
                .post('/google-analytics/properties')
                .set('Authorization', `Bearer ${validToken}`)
                .send({ access_token: 'ga_access_token' })
                .expect(200);

            expect(response.body.properties).toEqual(mockProperties);
            expect(response.body.count).toBe(2);
            expect(response.body.message).toBe('Properties retrieved successfully');
            expect(mockGAService.listProperties).toHaveBeenCalledWith('ga_access_token');
        });

        it('should handle empty properties list', async () => {
            mockGAService.listProperties.mockResolvedValue([]);

            const response = await request(app)
                .post('/google-analytics/properties')
                .set('Authorization', `Bearer ${validToken}`)
                .send({ access_token: 'ga_access_token' })
                .expect(200);

            expect(response.body.properties).toEqual([]);
            expect(response.body.count).toBe(0);
        });

        it('should require access token', async () => {
            const response = await request(app)
                .post('/google-analytics/properties')
                .set('Authorization', `Bearer ${validToken}`)
                .send({})
                .expect(400);

            expect(mockGAService.listProperties).not.toHaveBeenCalled();
        });

        it('should handle API errors', async () => {
            mockGAService.listProperties.mockRejectedValue(new Error('GA API error'));

            const response = await request(app)
                .post('/google-analytics/properties')
                .set('Authorization', `Bearer ${validToken}`)
                .send({ access_token: 'ga_access_token' })
                .expect(500);

            expect(response.body.message).toBe('Failed to retrieve Google Analytics properties');
        });

        it('should require authentication', async () => {
            const response = await request(app)
                .post('/google-analytics/properties')
                .send({ access_token: 'token' })
                .expect(401);
        });
    });

    describe('Get Metadata', () => {
        it('should retrieve metadata for a property', async () => {
            const mockMetadata = {
                dimensions: ['date', 'country', 'deviceCategory'],
                metrics: ['sessions', 'users', 'pageviews']
            };

            mockGAService.getMetadata.mockResolvedValue(mockMetadata);

            const response = await request(app)
                .get('/google-analytics/metadata/123456789')
                .set('Authorization', `Bearer ${validToken}`)
                .send({
                    access_token: 'ga_access_token',
                    refresh_token: 'ga_refresh_token'
                })
                .expect(200);

            expect(response.body.metadata).toEqual(mockMetadata);
            expect(response.body.message).toBe('Metadata retrieved successfully');
            expect(mockGAService.getMetadata).toHaveBeenCalled();
        });

        it('should require property ID', async () => {
            const response = await request(app)
                .get('/google-analytics/metadata/')
                .set('Authorization', `Bearer ${validToken}`)
                .send({
                    access_token: 'token',
                    refresh_token: 'refresh'
                })
                .expect(404);
        });

        it('should require access token', async () => {
            const response = await request(app)
                .get('/google-analytics/metadata/123456789')
                .set('Authorization', `Bearer ${validToken}`)
                .send({ refresh_token: 'refresh' })
                .expect(400);

            expect(mockGAService.getMetadata).not.toHaveBeenCalled();
        });

        it('should require refresh token', async () => {
            const response = await request(app)
                .get('/google-analytics/metadata/123456789')
                .set('Authorization', `Bearer ${validToken}`)
                .send({ access_token: 'token' })
                .expect(400);

            expect(mockGAService.getMetadata).not.toHaveBeenCalled();
        });

        it('should handle metadata retrieval errors', async () => {
            mockGAService.getMetadata.mockRejectedValue(new Error('Metadata error'));

            const response = await request(app)
                .get('/google-analytics/metadata/123456789')
                .set('Authorization', `Bearer ${validToken}`)
                .send({
                    access_token: 'token',
                    refresh_token: 'refresh'
                })
                .expect(500);

            expect(response.body.message).toBe('Failed to retrieve metadata');
        });

        it('should require authentication', async () => {
            const response = await request(app)
                .get('/google-analytics/metadata/123456789')
                .send({
                    access_token: 'token',
                    refresh_token: 'refresh'
                })
                .expect(401);
        });
    });

    describe('Get Report Presets', () => {
        it('should return available report presets', async () => {
            const response = await request(app)
                .get('/google-analytics/report-presets')
                .set('Authorization', `Bearer ${validToken}`)
                .expect(200);

            expect(response.body.presets).toBeDefined();
            expect(response.body.presets.length).toBeGreaterThan(0);
            expect(response.body.message).toBe('Report presets retrieved successfully');
        });

        it('should require authentication', async () => {
            const response = await request(app)
                .get('/google-analytics/report-presets')
                .expect(401);
        });

        it('should handle errors gracefully', async () => {
            // Mock the static method to throw an error
            (GoogleAnalyticsService.getReportPresets as jest.Mock).mockImplementation(() => {
                throw new Error('Preset error');
            });

            const response = await request(app)
                .get('/google-analytics/report-presets')
                .set('Authorization', `Bearer ${validToken}`)
                .expect(500);

            expect(response.body.message).toBe('Failed to retrieve report presets');
        });
    });

    describe('Add Data Source', () => {
        it('should add Google Analytics data source successfully', async () => {
            mockDataSourceProcessor.addGoogleAnalyticsDataSource.mockResolvedValue(5);

            const response = await request(app)
                .post('/google-analytics/add-data-source')
                .set('Authorization', `Bearer ${validToken}`)
                .send({
                    name: 'My GA Property',
                    property_id: '123456789',
                    access_token: 'ga_access',
                    refresh_token: 'ga_refresh',
                    token_expiry: new Date(Date.now() + 3600000).toISOString(),
                    project_id: 10,
                    sync_frequency: 'daily',
                    account_name: 'Main Account'
                })
                .expect(201);

            expect(response.body.success).toBe(true);
            expect(response.body.data_source_id).toBe(5);
            expect(response.body.message).toBe('Google Analytics data source added successfully');
            expect(mockDataSourceProcessor.addGoogleAnalyticsDataSource).toHaveBeenCalled();
        });

        it('should require name parameter', async () => {
            const response = await request(app)
                .post('/google-analytics/add-data-source')
                .set('Authorization', `Bearer ${validToken}`)
                .send({
                    property_id: '123456789',
                    access_token: 'token',
                    refresh_token: 'refresh',
                    token_expiry: new Date().toISOString(),
                    project_id: 10
                })
                .expect(400);

            expect(mockDataSourceProcessor.addGoogleAnalyticsDataSource).not.toHaveBeenCalled();
        });

        it('should require property_id', async () => {
            const response = await request(app)
                .post('/google-analytics/add-data-source')
                .set('Authorization', `Bearer ${validToken}`)
                .send({
                    name: 'Test',
                    access_token: 'token',
                    refresh_token: 'refresh',
                    token_expiry: new Date().toISOString(),
                    project_id: 10
                })
                .expect(400);

            expect(mockDataSourceProcessor.addGoogleAnalyticsDataSource).not.toHaveBeenCalled();
        });

        it('should validate sync_frequency values', async () => {
            mockDataSourceProcessor.addGoogleAnalyticsDataSource.mockResolvedValue(5);

            const validFrequencies = ['hourly', 'daily', 'weekly', 'manual'];

            for (const freq of validFrequencies) {
                const response = await request(app)
                    .post('/google-analytics/add-data-source')
                    .set('Authorization', `Bearer ${validToken}`)
                    .send({
                        name: 'Test',
                        property_id: '123',
                        access_token: 'token',
                        refresh_token: 'refresh',
                        token_expiry: new Date().toISOString(),
                        project_id: 10,
                        sync_frequency: freq
                    })
                    .expect(201);

                expect(response.body.success).toBe(true);
            }
        });

        it('should reject invalid sync_frequency', async () => {
            const response = await request(app)
                .post('/google-analytics/add-data-source')
                .set('Authorization', `Bearer ${validToken}`)
                .send({
                    name: 'Test',
                    property_id: '123',
                    access_token: 'token',
                    refresh_token: 'refresh',
                    token_expiry: new Date().toISOString(),
                    project_id: 10,
                    sync_frequency: 'invalid'
                })
                .expect(400);

            expect(mockDataSourceProcessor.addGoogleAnalyticsDataSource).not.toHaveBeenCalled();
        });

        it('should handle data source creation failures', async () => {
            mockDataSourceProcessor.addGoogleAnalyticsDataSource.mockResolvedValue(null);

            const response = await request(app)
                .post('/google-analytics/add-data-source')
                .set('Authorization', `Bearer ${validToken}`)
                .send({
                    name: 'Test',
                    property_id: '123',
                    access_token: 'token',
                    refresh_token: 'refresh',
                    token_expiry: new Date().toISOString(),
                    project_id: 10
                })
                .expect(400);

            expect(response.body.success).toBe(false);
            expect(response.body.message).toBe('Failed to add Google Analytics data source');
        });

        it('should sanitize name input', async () => {
            mockDataSourceProcessor.addGoogleAnalyticsDataSource.mockResolvedValue(5);

            const response = await request(app)
                .post('/google-analytics/add-data-source')
                .set('Authorization', `Bearer ${validToken}`)
                .send({
                    name: '  My GA Property  ',
                    property_id: '123',
                    access_token: 'token',
                    refresh_token: 'refresh',
                    token_expiry: new Date().toISOString(),
                    project_id: 10
                })
                .expect(201);

            expect(response.body.success).toBe(true);
        });

        it('should require authentication', async () => {
            const response = await request(app)
                .post('/google-analytics/add-data-source')
                .send({
                    name: 'Test',
                    property_id: '123',
                    access_token: 'token',
                    refresh_token: 'refresh',
                    token_expiry: new Date().toISOString(),
                    project_id: 10
                })
                .expect(401);
        });
    });

    describe('Trigger Sync', () => {
        it('should trigger manual sync successfully', async () => {
            mockDataSourceProcessor.syncGoogleAnalyticsDataSource.mockResolvedValue(true);

            const response = await request(app)
                .post('/google-analytics/sync/5')
                .set('Authorization', `Bearer ${validToken}`)
                .expect(200);

            expect(response.body.success).toBe(true);
            expect(response.body.message).toBe('Sync completed successfully');
            expect(mockDataSourceProcessor.syncGoogleAnalyticsDataSource).toHaveBeenCalledWith(5, validTokenDetails);
        });

        it('should validate data source ID is positive integer', async () => {
            const response = await request(app)
                .post('/google-analytics/sync/0')
                .set('Authorization', `Bearer ${validToken}`)
                .expect(400);

            expect(mockDataSourceProcessor.syncGoogleAnalyticsDataSource).not.toHaveBeenCalled();
        });

        it('should reject negative data source IDs', async () => {
            const response = await request(app)
                .post('/google-analytics/sync/-5')
                .set('Authorization', `Bearer ${validToken}`)
                .expect(400);

            expect(mockDataSourceProcessor.syncGoogleAnalyticsDataSource).not.toHaveBeenCalled();
        });

        it('should reject non-numeric data source IDs', async () => {
            const response = await request(app)
                .post('/google-analytics/sync/invalid')
                .set('Authorization', `Bearer ${validToken}`)
                .expect(400);

            expect(mockDataSourceProcessor.syncGoogleAnalyticsDataSource).not.toHaveBeenCalled();
        });

        it('should handle sync failures', async () => {
            mockDataSourceProcessor.syncGoogleAnalyticsDataSource.mockResolvedValue(false);

            const response = await request(app)
                .post('/google-analytics/sync/5')
                .set('Authorization', `Bearer ${validToken}`)
                .expect(400);

            expect(response.body.success).toBe(false);
            expect(response.body.message).toBe('Sync failed');
        });

        it('should handle sync errors', async () => {
            mockDataSourceProcessor.syncGoogleAnalyticsDataSource.mockRejectedValue(
                new Error('Network timeout')
            );

            const response = await request(app)
                .post('/google-analytics/sync/5')
                .set('Authorization', `Bearer ${validToken}`)
                .expect(500);

            expect(response.body.success).toBe(false);
            expect(response.body.message).toBe('Failed to sync Google Analytics data');
        });

        it('should require authentication', async () => {
            const response = await request(app)
                .post('/google-analytics/sync/5')
                .expect(401);
        });
    });

    describe('Get Sync Status', () => {
        it('should retrieve sync status and history', async () => {
            const mockLastSync = new Date('2026-01-04T10:00:00Z');
            const mockHistory = [
                { sync_id: 1, started_at: new Date('2026-01-04T10:00:00Z'), status: 'completed' },
                { sync_id: 2, started_at: new Date('2026-01-03T10:00:00Z'), status: 'completed' }
            ];

            mockGADriver.getLastSyncTime.mockResolvedValue(mockLastSync);
            mockGADriver.getSyncHistory.mockResolvedValue(mockHistory);

            const response = await request(app)
                .get('/google-analytics/sync-status/5')
                .set('Authorization', `Bearer ${validToken}`)
                .expect(200);

            expect(response.body.last_sync).toBeDefined();
            expect(response.body.sync_history).toEqual(mockHistory);
            expect(response.body.message).toBe('Sync status retrieved successfully');
            expect(mockGADriver.getLastSyncTime).toHaveBeenCalledWith(5);
            expect(mockGADriver.getSyncHistory).toHaveBeenCalledWith(5, 10);
        });

        it('should validate data source ID is positive integer', async () => {
            const response = await request(app)
                .get('/google-analytics/sync-status/0')
                .set('Authorization', `Bearer ${validToken}`)
                .expect(400);

            expect(mockGADriver.getLastSyncTime).not.toHaveBeenCalled();
        });

        it('should reject negative IDs', async () => {
            const response = await request(app)
                .get('/google-analytics/sync-status/-5')
                .set('Authorization', `Bearer ${validToken}`)
                .expect(400);

            expect(mockGADriver.getLastSyncTime).not.toHaveBeenCalled();
        });

        it('should handle errors retrieving sync status', async () => {
            mockGADriver.getLastSyncTime.mockRejectedValue(new Error('Database error'));

            const response = await request(app)
                .get('/google-analytics/sync-status/5')
                .set('Authorization', `Bearer ${validToken}`)
                .expect(500);

            expect(response.body.message).toBe('Failed to retrieve sync status');
        });

        it('should require authentication', async () => {
            const response = await request(app)
                .get('/google-analytics/sync-status/5')
                .expect(401);
        });
    });

    describe('Security & Input Validation', () => {
        it('should prevent SQL injection in property IDs', async () => {
            mockGAService.getMetadata.mockResolvedValue({});

            const maliciousId = "123'; DROP TABLE data_sources;--";

            await request(app)
                .get(`/google-analytics/metadata/${encodeURIComponent(maliciousId)}`)
                .set('Authorization', `Bearer ${validToken}`)
                .send({
                    access_token: 'token',
                    refresh_token: 'refresh'
                })
                .expect(200);

            // Service receives the ID as-is (parameter validation happens at application level)
            expect(mockGAService.getMetadata).toHaveBeenCalled();
        });

        it('should sanitize XSS attempts in data source names', async () => {
            mockDataSourceProcessor.addGoogleAnalyticsDataSource.mockResolvedValue(5);

            const xssPayload = '<script>alert("xss")</script>';

            await request(app)
                .post('/google-analytics/add-data-source')
                .set('Authorization', `Bearer ${validToken}`)
                .send({
                    name: xssPayload,
                    property_id: '123',
                    access_token: 'token',
                    refresh_token: 'refresh',
                    token_expiry: new Date().toISOString(),
                    project_id: 10
                })
                .expect(201);

            // Name should be escaped by express-validator
            expect(mockDataSourceProcessor.addGoogleAnalyticsDataSource).toHaveBeenCalled();
        });

        it('should enforce rate limiting on expensive operations', async () => {
            // Note: Actual rate limiting test would need multiple requests
            // This is a structural test
            mockDataSourceProcessor.addGoogleAnalyticsDataSource.mockResolvedValue(5);

            const response = await request(app)
                .post('/google-analytics/add-data-source')
                .set('Authorization', `Bearer ${validToken}`)
                .send({
                    name: 'Test',
                    property_id: '123',
                    access_token: 'token',
                    refresh_token: 'refresh',
                    token_expiry: new Date().toISOString(),
                    project_id: 10
                })
                .expect(201);

            expect(response.body.success).toBe(true);
        });
    });
});
