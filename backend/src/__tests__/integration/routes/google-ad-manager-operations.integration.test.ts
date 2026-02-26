import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import request from 'supertest';
import express from 'express';
import googleAdManagerRouter from '../../../routes/google_ad_manager.js';

// Mock services
jest.mock('../../../services/GoogleAdManagerService.js', () => ({
    GoogleAdManagerService: {
        getInstance: jest.fn(() => ({
            listNetworks: jest.fn(),
            getRateLimitStatus: jest.fn(),
            getRateLimitStats: jest.fn()
        }))
    }
}));

jest.mock('../../drivers/GoogleAdManagerDriver.js', () => ({
    GoogleAdManagerDriver: {
        getInstance: jest.fn(() => ({
            getLastSyncTime: jest.fn(),
            getSyncHistory: jest.fn()
        }))
    }
}));

jest.mock('../../processors/GoogleAdManagerProcessor.js', () => ({
    GoogleAdManagerProcessor: {
        getInstance: jest.fn(() => ({
            addGoogleAdManagerDataSource: jest.fn(),
            syncGoogleAdManagerDataSource: jest.fn()
        }))
    }
}));

jest.mock('../../processors/DataSourceProcessor.js', () => ({
    DataSourceProcessor: {
        getInstance: jest.fn(() => ({
            deleteDataSource: jest.fn()
        }))
    }
}));

jest.mock('../../../processors/TokenProcessor.js');

import { GoogleAdManagerService } from '../../../services/GoogleAdManagerService.js';
import { GoogleAdManagerDriver } from '../../../drivers/GoogleAdManagerDriver.js';
import { DataSourceProcessor } from '../../../processors/DataSourceProcessor.js';
import { GoogleAdManagerProcessor } from '../../../processors/GoogleAdManagerProcessor.js';
import { EUserType } from '../../../types/EUserType.js';

describe('Google Ad Manager Operations Integration Tests', () => {
    let app: express.Application;
    let mockValidateToken: any;
    
    const validTokenDetails = {
        user_id: 1,
        email: 'test@example.com',
        user_type: EUserType.ADMIN,
        iat: Math.floor(Date.now() / 1000)
    };

    beforeEach(() => {
        // Create fresh Express app for each test
        app = express();
        app.use(express.json());
        
        // Mock TokenProcessor validation
        mockValidateToken = jest.fn((req: any, res: any, next: any) => {
            req.body.tokenDetails = validTokenDetails;
            next();
        });
        
        const TokenProcessor = require('../../processors/TokenProcessor.js').TokenProcessor;
        TokenProcessor.getInstance = jest.fn(() => ({
            validateToken: mockValidateToken
        }));
        
        app.use('/api/google-ad-manager', googleAdManagerRouter);
        
        // Reset all mocks
        jest.clearAllMocks();
    });

    // ==================== List Networks Tests ====================
    describe('POST /api/google-ad-manager/networks', () => {
        it('should list accessible GAM networks', async () => {
            const mockNetworks = [
                { network_code: '12345', network_id: 'net_1', network_name: 'Test Network 1' },
                { network_code: '67890', network_id: 'net_2', network_name: 'Test Network 2' }
            ];
            
            const gamService = GoogleAdManagerService.getInstance();
            (gamService.listNetworks as any).mockResolvedValue(mockNetworks);
            
            const response = await request(app)
                .post('/api/google-ad-manager/networks')
                .send({ access_token: 'valid_token_123' });
            
            expect(response.status).toBe(200);
            expect(response.body.success).toBe(true);
            expect(response.body.networks).toEqual(mockNetworks);
            expect(gamService.listNetworks).toHaveBeenCalledWith('valid_token_123');
        });

        it('should return empty array when no networks available', async () => {
            const gamService = GoogleAdManagerService.getInstance();
            (gamService.listNetworks as any).mockResolvedValue([]);
            
            const response = await request(app)
                .post('/api/google-ad-manager/networks')
                .send({ access_token: 'valid_token' });
            
            expect(response.status).toBe(200);
            expect(response.body.networks).toEqual([]);
        });

        it('should require access_token', async () => {
            const response = await request(app)
                .post('/api/google-ad-manager/networks')
                .send({});
            
            expect(response.status).toBe(400);
        });

        it('should handle API errors gracefully', async () => {
            const gamService = GoogleAdManagerService.getInstance();
            (gamService.listNetworks as any).mockRejectedValue(new Error('API error'));
            
            const response = await request(app)
                .post('/api/google-ad-manager/networks')
                .send({ access_token: 'valid_token' });
            
            expect(response.status).toBe(500);
            expect(response.body.message).toContain('Failed to list networks');
        });

        it('should require authentication', async () => {
            mockValidateToken.mockImplementation((req: any, res: any) => {
                res.status(401).send({ message: 'Unauthorized' });
            });
            
            const response = await request(app)
                .post('/api/google-ad-manager/networks')
                .send({ access_token: 'token' });
            
            expect(response.status).toBe(401);
        });
    });

    // ==================== Report Types Tests ====================
    describe('GET /api/google-ad-manager/report-types', () => {
        it('should return all available report types', async () => {
            const response = await request(app)
                .get('/api/google-ad-manager/report-types');
            
            expect(response.status).toBe(200);
            expect(response.body.success).toBe(true);
            expect(response.body.report_types).toBeDefined();
            expect(Array.isArray(response.body.report_types)).toBe(true);
            expect(response.body.report_types.length).toBeGreaterThan(0);
        });

        it('should include revenue report type', async () => {
            const response = await request(app)
                .get('/api/google-ad-manager/report-types');
            
            expect(response.status).toBe(200);
            const revenueReport = response.body.report_types.find((r: any) => r.id === 'revenue');
            expect(revenueReport).toBeDefined();
            expect(revenueReport.name).toBe('Revenue Report');
        });

        it('should include inventory report type', async () => {
            const response = await request(app)
                .get('/api/google-ad-manager/report-types');
            
            const inventoryReport = response.body.report_types.find((r: any) => r.id === 'inventory');
            expect(inventoryReport).toBeDefined();
        });

        it('should include orders and geography report types', async () => {
            const response = await request(app)
                .get('/api/google-ad-manager/report-types');
            
            const orders = response.body.report_types.find((r: any) => r.id === 'orders');
            const geography = response.body.report_types.find((r: any) => r.id === 'geography');
            
            expect(orders).toBeDefined();
            expect(geography).toBeDefined();
        });

        it('should require authentication', async () => {
            mockValidateToken.mockImplementation((req: any, res: any) => {
                res.status(401).send({ message: 'Unauthorized' });
            });
            
            const response = await request(app)
                .get('/api/google-ad-manager/report-types');
            
            expect(response.status).toBe(401);
        });
    });

    // ==================== Add Data Source Tests ====================
    describe('POST /api/google-ad-manager/add-data-source', () => {
        const validDataSource = {
            name: 'Test GAM Data Source',
            network_code: '12345',
            network_id: 'network_123',
            network_name: 'Test Network',
            access_token: 'access_token_123',
            refresh_token: 'refresh_token_123',
            token_expiry: new Date().toISOString(),
            project_id: 1,
            report_types: ['revenue', 'inventory'],
            sync_frequency: 'daily'
        };

        it('should successfully add GAM data source', async () => {
            const dsProcessor = DataSourceProcessor.getInstance();
            ((GoogleAdManagerProcessor.getInstance() as any).addGoogleAdManagerDataSource as any).mockResolvedValue(123);
            
            const response = await request(app)
                .post('/api/google-ad-manager/add-data-source')
                .send(validDataSource);
            
            expect(response.status).toBe(201);
            expect(response.body.success).toBe(true);
            expect(response.body.data_source_id).toBe(123);
            expect(response.body.message).toContain('successfully');
        });

        it('should require name field', async () => {
            const invalid = { ...validDataSource };
            delete invalid.name;
            
            const response = await request(app)
                .post('/api/google-ad-manager/add-data-source')
                .send(invalid);
            
            expect(response.status).toBe(400);
        });

        it('should require network_code field', async () => {
            const invalid = { ...validDataSource };
            delete invalid.network_code;
            
            const response = await request(app)
                .post('/api/google-ad-manager/add-data-source')
                .send(invalid);
            
            expect(response.status).toBe(400);
        });

        it('should require network_id field', async () => {
            const invalid = { ...validDataSource };
            delete invalid.network_id;
            
            const response = await request(app)
                .post('/api/google-ad-manager/add-data-source')
                .send(invalid);
            
            expect(response.status).toBe(400);
        });

        it('should require access_token field', async () => {
            const invalid = { ...validDataSource };
            delete invalid.access_token;
            
            const response = await request(app)
                .post('/api/google-ad-manager/add-data-source')
                .send(invalid);
            
            expect(response.status).toBe(400);
        });

        it('should require refresh_token field', async () => {
            const invalid = { ...validDataSource };
            delete invalid.refresh_token;
            
            const response = await request(app)
                .post('/api/google-ad-manager/add-data-source')
                .send(invalid);
            
            expect(response.status).toBe(400);
        });

        it('should require token_expiry field', async () => {
            const invalid = { ...validDataSource };
            delete invalid.token_expiry;
            
            const response = await request(app)
                .post('/api/google-ad-manager/add-data-source')
                .send(invalid);
            
            expect(response.status).toBe(400);
        });

        it('should require project_id field', async () => {
            const invalid = { ...validDataSource };
            delete invalid.project_id;
            
            const response = await request(app)
                .post('/api/google-ad-manager/add-data-source')
                .send(invalid);
            
            expect(response.status).toBe(400);
        });

        it('should require report_types array with at least one type', async () => {
            const invalid = { ...validDataSource, report_types: [] };
            
            const response = await request(app)
                .post('/api/google-ad-manager/add-data-source')
                .send(invalid);
            
            expect(response.status).toBe(400);
        });

        it('should validate sync_frequency enum values', async () => {
            const invalid = { ...validDataSource, sync_frequency: 'invalid' };
            
            const response = await request(app)
                .post('/api/google-ad-manager/add-data-source')
                .send(invalid);
            
            expect(response.status).toBe(400);
        });

        it('should accept valid sync_frequency values', async () => {
            const dsProcessor = DataSourceProcessor.getInstance();
            ((GoogleAdManagerProcessor.getInstance() as any).addGoogleAdManagerDataSource as any).mockResolvedValue(124);
            
            const frequencies = ['hourly', 'daily', 'weekly', 'manual'];
            
            for (const freq of frequencies) {
                const data = { ...validDataSource, sync_frequency: freq };
                const response = await request(app)
                    .post('/api/google-ad-manager/add-data-source')
                    .send(data);
                
                expect(response.status).toBe(201);
            }
        });

        it('should handle creation failures', async () => {
            const dsProcessor = DataSourceProcessor.getInstance();
            ((GoogleAdManagerProcessor.getInstance() as any).addGoogleAdManagerDataSource as any).mockResolvedValue(null);
            
            const response = await request(app)
                .post('/api/google-ad-manager/add-data-source')
                .send(validDataSource);
            
            expect(response.status).toBe(400);
            expect(response.body.success).toBe(false);
        });

        it('should handle processor errors', async () => {
            const dsProcessor = DataSourceProcessor.getInstance();
            ((GoogleAdManagerProcessor.getInstance() as any).addGoogleAdManagerDataSource as any).mockRejectedValue(
                new Error('Database connection failed')
            );
            
            const response = await request(app)
                .post('/api/google-ad-manager/add-data-source')
                .send(validDataSource);
            
            expect(response.status).toBe(500);
            expect(response.body.message).toContain('Failed to add');
        });

        it('should require authentication', async () => {
            mockValidateToken.mockImplementation((req: any, res: any) => {
                res.status(401).send({ message: 'Unauthorized' });
            });
            
            const response = await request(app)
                .post('/api/google-ad-manager/add-data-source')
                .send(validDataSource);
            
            expect(response.status).toBe(401);
        });
    });

    // ==================== Trigger Sync Tests ====================
    describe('POST /api/google-ad-manager/sync/:dataSourceId', () => {
        it('should successfully trigger sync', async () => {
            const dsProcessor = DataSourceProcessor.getInstance();
            ((GoogleAdManagerProcessor.getInstance() as any).syncGoogleAdManagerDataSource as any).mockResolvedValue(true);
            
            const response = await request(app)
                .post('/api/google-ad-manager/sync/123');
            
            expect(response.status).toBe(200);
            expect(response.body.success).toBe(true);
            expect(response.body.message).toContain('successfully');
            expect((GoogleAdManagerProcessor.getInstance() as any).syncGoogleAdManagerDataSource).toHaveBeenCalledWith(
                123,
                validTokenDetails
            );
        });

        it('should reject invalid data source ID format', async () => {
            const response = await request(app)
                .post('/api/google-ad-manager/sync/invalid');
            
            expect(response.status).toBe(400);
        });

        it('should reject negative data source ID', async () => {
            const response = await request(app)
                .post('/api/google-ad-manager/sync/-5');
            
            expect(response.status).toBe(400);
        });

        it('should reject zero data source ID', async () => {
            const response = await request(app)
                .post('/api/google-ad-manager/sync/0');
            
            expect(response.status).toBe(400);
        });

        it('should handle sync failures', async () => {
            const dsProcessor = DataSourceProcessor.getInstance();
            ((GoogleAdManagerProcessor.getInstance() as any).syncGoogleAdManagerDataSource as any).mockResolvedValue(false);
            
            const response = await request(app)
                .post('/api/google-ad-manager/sync/123');
            
            expect(response.status).toBe(400);
            expect(response.body.success).toBe(false);
            expect(response.body.message).toContain('failed');
        });

        it('should handle processor errors', async () => {
            const dsProcessor = DataSourceProcessor.getInstance();
            ((GoogleAdManagerProcessor.getInstance() as any).syncGoogleAdManagerDataSource as any).mockRejectedValue(
                new Error('Sync process crashed')
            );
            
            const response = await request(app)
                .post('/api/google-ad-manager/sync/123');
            
            expect(response.status).toBe(500);
            expect(response.body.message).toContain('Failed to sync');
        });

        it('should require authentication', async () => {
            mockValidateToken.mockImplementation((req: any, res: any) => {
                res.status(401).send({ message: 'Unauthorized' });
            });
            
            const response = await request(app)
                .post('/api/google-ad-manager/sync/123');
            
            expect(response.status).toBe(401);
        });
    });

    // ==================== Get Sync Status Tests ====================
    describe('GET /api/google-ad-manager/sync-status/:dataSourceId', () => {
        it('should retrieve sync status and history', async () => {
            const mockLastSync = new Date('2024-01-15T10:00:00Z');
            const mockHistory = [
                { sync_time: new Date(), status: 'completed', records_synced: 1000 },
                { sync_time: new Date(), status: 'completed', records_synced: 950 }
            ];
            
            const gamDriver = GoogleAdManagerDriver.getInstance();
            (gamDriver.getLastSyncTime as any).mockResolvedValue(mockLastSync);
            (gamDriver.getSyncHistory as any).mockResolvedValue(mockHistory);
            
            const response = await request(app)
                .get('/api/google-ad-manager/sync-status/123');
            
            expect(response.status).toBe(200);
            expect(response.body.last_sync).toBeDefined();
            expect(response.body.sync_history).toEqual(mockHistory);
            expect(gamDriver.getSyncHistory).toHaveBeenCalledWith(123, 10);
        });

        it('should handle data source with no sync history', async () => {
            const gamDriver = GoogleAdManagerDriver.getInstance();
            (gamDriver.getLastSyncTime as any).mockResolvedValue(null);
            (gamDriver.getSyncHistory as any).mockResolvedValue([]);
            
            const response = await request(app)
                .get('/api/google-ad-manager/sync-status/123');
            
            expect(response.status).toBe(200);
            expect(response.body.last_sync).toBeNull();
            expect(response.body.sync_history).toEqual([]);
        });

        it('should reject invalid data source ID format', async () => {
            const response = await request(app)
                .get('/api/google-ad-manager/sync-status/abc');
            
            expect(response.status).toBe(400);
        });

        it('should reject negative data source ID', async () => {
            const response = await request(app)
                .get('/api/google-ad-manager/sync-status/-10');
            
            expect(response.status).toBe(400);
        });

        it('should handle driver errors', async () => {
            const gamDriver = GoogleAdManagerDriver.getInstance();
            (gamDriver.getLastSyncTime as any).mockRejectedValue(
                new Error('Database query failed')
            );
            
            const response = await request(app)
                .get('/api/google-ad-manager/sync-status/123');
            
            expect(response.status).toBe(500);
            expect(response.body.message).toContain('Failed to retrieve');
        });

        it('should require authentication', async () => {
            mockValidateToken.mockImplementation((req: any, res: any) => {
                res.status(401).send({ message: 'Unauthorized' });
            });
            
            const response = await request(app)
                .get('/api/google-ad-manager/sync-status/123');
            
            expect(response.status).toBe(401);
        });
    });

    // ==================== Delete Data Source Tests ====================
    describe('DELETE /api/google-ad-manager/data-source/:dataSourceId', () => {
        it('should successfully delete data source', async () => {
            const dsProcessor = DataSourceProcessor.getInstance();
            (dsProcessor.deleteDataSource as any).mockResolvedValue(true);
            
            const response = await request(app)
                .delete('/api/google-ad-manager/data-source/123');
            
            expect(response.status).toBe(200);
            expect(response.body.success).toBe(true);
            expect(response.body.message).toContain('successfully');
            expect(dsProcessor.deleteDataSource).toHaveBeenCalledWith(
                123,
                validTokenDetails
            );
        });

        it('should reject invalid data source ID', async () => {
            const response = await request(app)
                .delete('/api/google-ad-manager/data-source/invalid');
            
            expect(response.status).toBe(400);
        });

        it('should reject negative data source ID', async () => {
            const response = await request(app)
                .delete('/api/google-ad-manager/data-source/-5');
            
            expect(response.status).toBe(400);
        });

        it('should handle deletion failures', async () => {
            const dsProcessor = DataSourceProcessor.getInstance();
            (dsProcessor.deleteDataSource as any).mockResolvedValue(false);
            
            const response = await request(app)
                .delete('/api/google-ad-manager/data-source/123');
            
            expect(response.status).toBe(400);
            expect(response.body.success).toBe(false);
        });

        it('should handle processor errors', async () => {
            const dsProcessor = DataSourceProcessor.getInstance();
            (dsProcessor.deleteDataSource as any).mockRejectedValue(
                new Error('Cascade delete failed')
            );
            
            const response = await request(app)
                .delete('/api/google-ad-manager/data-source/123');
            
            expect(response.status).toBe(500);
            expect(response.body.message).toContain('Failed to delete');
        });

        it('should require authentication', async () => {
            mockValidateToken.mockImplementation((req: any, res: any) => {
                res.status(401).send({ message: 'Unauthorized' });
            });
            
            const response = await request(app)
                .delete('/api/google-ad-manager/data-source/123');
            
            expect(response.status).toBe(401);
        });
    });

    // ==================== Rate Limit Status Tests ====================
    describe('GET /api/google-ad-manager/rate-limit', () => {
        it('should retrieve rate limit status', async () => {
            const mockStatus = { allowed: true, remaining: 95, reset: Date.now() + 3600000 };
            const mockStats = { total_requests: 5, total_allowed: 5, total_blocked: 0 };
            
            const gamService = GoogleAdManagerService.getInstance();
            (gamService.getRateLimitStatus as any).mockReturnValue(mockStatus);
            (gamService.getRateLimitStats as any).mockReturnValue(mockStats);
            
            const response = await request(app)
                .get('/api/google-ad-manager/rate-limit');
            
            expect(response.status).toBe(200);
            expect(response.body.success).toBe(true);
            expect(response.body.data.status).toEqual(mockStatus);
            expect(response.body.data.stats).toEqual(mockStats);
        });

        it('should show blocked status when rate limited', async () => {
            const mockStatus = { allowed: false, remaining: 0, reset: Date.now() + 3600000 };
            const mockStats = { total_requests: 105, total_allowed: 100, total_blocked: 5 };
            
            const gamService = GoogleAdManagerService.getInstance();
            (gamService.getRateLimitStatus as any).mockReturnValue(mockStatus);
            (gamService.getRateLimitStats as any).mockReturnValue(mockStats);
            
            const response = await request(app)
                .get('/api/google-ad-manager/rate-limit');
            
            expect(response.status).toBe(200);
            expect(response.body.data.status.allowed).toBe(false);
            expect(response.body.data.stats.total_blocked).toBe(5);
        });

        it('should handle service errors', async () => {
            const gamService = GoogleAdManagerService.getInstance();
            (gamService.getRateLimitStatus as any).mockImplementation(() => {
                throw new Error('Service unavailable');
            });
            
            const response = await request(app)
                .get('/api/google-ad-manager/rate-limit');
            
            expect(response.status).toBe(500);
            expect(response.body.message).toContain('Failed to retrieve');
        });

        it('should require authentication', async () => {
            mockValidateToken.mockImplementation((req: any, res: any) => {
                res.status(401).send({ message: 'Unauthorized' });
            });
            
            const response = await request(app)
                .get('/api/google-ad-manager/rate-limit');
            
            expect(response.status).toBe(401);
        });
    });

    // ==================== Security & Validation Tests ====================
    describe('Security & Input Validation', () => {
        it('should sanitize SQL injection attempts in name field', async () => {
            const dsProcessor = DataSourceProcessor.getInstance();
            ((GoogleAdManagerProcessor.getInstance() as any).addGoogleAdManagerDataSource as any).mockResolvedValue(125);
            
            const maliciousData = {
                name: "Test'; DROP TABLE dra_data_sources; --",
                network_code: '12345',
                network_id: 'net_1',
                access_token: 'token',
                refresh_token: 'refresh',
                token_expiry: new Date().toISOString(),
                project_id: 1,
                report_types: ['revenue']
            };
            
            const response = await request(app)
                .post('/api/google-ad-manager/add-data-source')
                .send(maliciousData);
            
            expect(response.status).toBe(201);
            // Name should be sanitized by express-validator escape()
        });

        it('should sanitize XSS attempts in name field', async () => {
            const dsProcessor = DataSourceProcessor.getInstance();
            ((GoogleAdManagerProcessor.getInstance() as any).addGoogleAdManagerDataSource as any).mockResolvedValue(126);
            
            const xssData = {
                name: '<script>alert("XSS")</script>',
                network_code: '12345',
                network_id: 'net_1',
                access_token: 'token',
                refresh_token: 'refresh',
                token_expiry: new Date().toISOString(),
                project_id: 1,
                report_types: ['revenue']
            };
            
            const response = await request(app)
                .post('/api/google-ad-manager/add-data-source')
                .send(xssData);
            
            expect(response.status).toBe(201);
            // XSS should be escaped
        });

        it('should validate numeric IDs in all ID parameters', async () => {
            const endpoints = [
                { method: 'post', path: '/api/google-ad-manager/sync/abc' },
                { method: 'get', path: '/api/google-ad-manager/sync-status/xyz' },
                { method: 'delete', path: '/api/google-ad-manager/data-source/invalid' }
            ];
            
            for (const endpoint of endpoints) {
                const response = endpoint.method === 'post' 
                    ? await request(app).post(endpoint.path)
                    : endpoint.method === 'get'
                    ? await request(app).get(endpoint.path)
                    : await request(app).delete(endpoint.path);
                
                expect(response.status).toBe(400);
            }
        });

        it('should enforce authentication on all protected endpoints', async () => {
            mockValidateToken.mockImplementation((req: any, res: any) => {
                res.status(401).send({ message: 'Unauthorized' });
            });
            
            const endpoints = [
                { method: 'post', path: '/api/google-ad-manager/networks', body: { access_token: 't' } },
                { method: 'get', path: '/api/google-ad-manager/report-types' },
                { method: 'post', path: '/api/google-ad-manager/add-data-source', body: {} },
                { method: 'post', path: '/api/google-ad-manager/sync/123' },
                { method: 'get', path: '/api/google-ad-manager/sync-status/123' },
                { method: 'delete', path: '/api/google-ad-manager/data-source/123' },
                { method: 'get', path: '/api/google-ad-manager/rate-limit' }
            ];
            
            for (const endpoint of endpoints) {
                let response;
                if (endpoint.method === 'post') {
                    response = await request(app).post(endpoint.path).send(endpoint.body || {});
                } else if (endpoint.method === 'delete') {
                    response = await request(app).delete(endpoint.path);
                } else {
                    response = await request(app).get(endpoint.path);
                }
                
                expect(response.status).toBe(401);
            }
        });
    });
});
