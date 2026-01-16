import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import request from 'supertest';
import express from 'express';
import performanceRouter from '../performance.js';

// Mock performance aggregator
const mockPerformanceAggregator = {
    getAllMetrics: jest.fn(),
    getMetrics: jest.fn(),
    getSlowestOperations: jest.fn(),
    getBottleneckAnalysis: jest.fn(),
    getSnapshotCount: jest.fn(),
    clear: jest.fn(),
    clearOperation: jest.fn()
};

jest.mock('../../utils/PerformanceMetrics.js', () => ({
    globalPerformanceAggregator: mockPerformanceAggregator
}));

jest.mock('../../processors/TokenProcessor.js');

import { EUserType } from '../../../../types/EUserType.js';

describe('Performance Monitoring Routes Integration Tests', () => {
    let app: express.Application;
    let mockValidateToken: any;
    
    const validTokenDetails = {
        user_id: 1,
        email: 'admin@example.com',
        user_type: EUserType.ADMIN,
        iat: Math.floor(Date.now() / 1000)
    };

    beforeEach(() => {
        app = express();
        app.use(express.json());
        
        mockValidateToken = jest.fn((req: any, res: any, next: any) => {
            req.body.tokenDetails = validTokenDetails;
            next();
        });
        
        const TokenProcessor = require('../../processors/TokenProcessor.js').TokenProcessor;
        TokenProcessor.getInstance = jest.fn(() => ({
            validateToken: mockValidateToken
        }));
        
        app.use('/api/performance', performanceRouter);
        jest.clearAllMocks();
    });

    // ==================== Get All Metrics Tests ====================
    describe('GET /api/performance/metrics', () => {
        it('should retrieve all performance metrics', async () => {
            const mockMetrics = [
                { operation: 'database_query', avgDuration: 120, count: 500 },
                { operation: 'api_call', avgDuration: 250, count: 1000 }
            ];
            
            mockPerformanceAggregator.getAllMetrics.mockReturnValue(mockMetrics);
            
            const response = await request(app)
                .get('/api/performance/metrics');
            
            expect(response.status).toBe(200);
            expect(response.body.success).toBe(true);
            expect(response.body.data).toEqual(mockMetrics);
            expect(response.body.count).toBe(2);
        });

        it('should handle empty metrics', async () => {
            mockPerformanceAggregator.getAllMetrics.mockReturnValue([]);
            
            const response = await request(app)
                .get('/api/performance/metrics');
            
            expect(response.status).toBe(200);
            expect(response.body.data).toEqual([]);
            expect(response.body.count).toBe(0);
        });

        it('should handle errors gracefully', async () => {
            mockPerformanceAggregator.getAllMetrics.mockImplementation(() => {
                throw new Error('Metrics collection failed');
            });
            
            const response = await request(app)
                .get('/api/performance/metrics');
            
            expect(response.status).toBe(500);
            expect(response.body.success).toBe(false);
        });

        it('should require authentication', async () => {
            mockValidateToken.mockImplementation((req: any, res: any) => {
                res.status(401).send({ message: 'Unauthorized' });
            });
            
            const response = await request(app)
                .get('/api/performance/metrics');
            
            expect(response.status).toBe(401);
        });
    });

    // ==================== Get Operation Metrics Tests ====================
    describe('GET /api/performance/metrics/:operationName', () => {
        it('should retrieve metrics for specific operation', async () => {
            const mockMetrics = {
                operation: 'database_query',
                avgDuration: 120,
                minDuration: 50,
                maxDuration: 300,
                count: 500
            };
            
            mockPerformanceAggregator.getMetrics.mockReturnValue(mockMetrics);
            
            const response = await request(app)
                .get('/api/performance/metrics/database_query');
            
            expect(response.status).toBe(200);
            expect(response.body.success).toBe(true);
            expect(response.body.data).toEqual(mockMetrics);
        });

        it('should handle operation not found', async () => {
            mockPerformanceAggregator.getMetrics.mockReturnValue(null);
            
            const response = await request(app)
                .get('/api/performance/metrics/unknown_operation');
            
            expect(response.status).toBe(404);
            expect(response.body.success).toBe(false);
            expect(response.body.message).toContain('No metrics found');
        });

        it('should handle errors', async () => {
            mockPerformanceAggregator.getMetrics.mockImplementation(() => {
                throw new Error('Query failed');
            });
            
            const response = await request(app)
                .get('/api/performance/metrics/test_operation');
            
            expect(response.status).toBe(500);
        });

        it('should require authentication', async () => {
            mockValidateToken.mockImplementation((req: any, res: any) => {
                res.status(401).send({ message: 'Unauthorized' });
            });
            
            const response = await request(app)
                .get('/api/performance/metrics/test_operation');
            
            expect(response.status).toBe(401);
        });
    });

    // ==================== Get Slowest Operations Tests ====================
    describe('GET /api/performance/slowest', () => {
        it('should retrieve slowest operations with default limit', async () => {
            const mockSlowest = [
                { operation: 'slow_query', avgDuration: 5000, count: 10 },
                { operation: 'slow_api', avgDuration: 3000, count: 50 }
            ];
            
            mockPerformanceAggregator.getSlowestOperations.mockReturnValue(mockSlowest);
            
            const response = await request(app)
                .get('/api/performance/slowest');
            
            expect(response.status).toBe(200);
            expect(response.body.success).toBe(true);
            expect(response.body.data).toEqual(mockSlowest);
            expect(mockPerformanceAggregator.getSlowestOperations).toHaveBeenCalledWith(10);
        });

        it('should respect custom limit parameter', async () => {
            const mockSlowest = [
                { operation: 'slow_query', avgDuration: 5000 }
            ];
            
            mockPerformanceAggregator.getSlowestOperations.mockReturnValue(mockSlowest);
            
            const response = await request(app)
                .get('/api/performance/slowest?limit=5');
            
            expect(response.status).toBe(200);
            expect(mockPerformanceAggregator.getSlowestOperations).toHaveBeenCalledWith(5);
        });

        it('should handle invalid limit parameter', async () => {
            mockPerformanceAggregator.getSlowestOperations.mockReturnValue([]);
            
            const response = await request(app)
                .get('/api/performance/slowest?limit=invalid');
            
            expect(response.status).toBe(200);
            expect(mockPerformanceAggregator.getSlowestOperations).toHaveBeenCalledWith(10);
        });

        it('should require authentication', async () => {
            mockValidateToken.mockImplementation((req: any, res: any) => {
                res.status(401).send({ message: 'Unauthorized' });
            });
            
            const response = await request(app)
                .get('/api/performance/slowest');
            
            expect(response.status).toBe(401);
        });
    });

    // ==================== Get Bottlenecks Tests ====================
    describe('GET /api/performance/bottlenecks', () => {
        it('should retrieve bottleneck analysis', async () => {
            const mockBottlenecks = [
                { operation: 'database_pool', severity: 'high', impact: 'critical' },
                { operation: 'api_rate_limit', severity: 'medium', impact: 'moderate' }
            ];
            
            mockPerformanceAggregator.getBottleneckAnalysis.mockReturnValue(mockBottlenecks);
            
            const response = await request(app)
                .get('/api/performance/bottlenecks');
            
            expect(response.status).toBe(200);
            expect(response.body.success).toBe(true);
            expect(response.body.data).toEqual(mockBottlenecks);
            expect(response.body.count).toBe(2);
        });

        it('should handle no bottlenecks', async () => {
            mockPerformanceAggregator.getBottleneckAnalysis.mockReturnValue([]);
            
            const response = await request(app)
                .get('/api/performance/bottlenecks');
            
            expect(response.status).toBe(200);
            expect(response.body.data).toEqual([]);
        });

        it('should handle errors', async () => {
            mockPerformanceAggregator.getBottleneckAnalysis.mockImplementation(() => {
                throw new Error('Analysis failed');
            });
            
            const response = await request(app)
                .get('/api/performance/bottlenecks');
            
            expect(response.status).toBe(500);
        });

        it('should require authentication', async () => {
            mockValidateToken.mockImplementation((req: any, res: any) => {
                res.status(401).send({ message: 'Unauthorized' });
            });
            
            const response = await request(app)
                .get('/api/performance/bottlenecks');
            
            expect(response.status).toBe(401);
        });
    });

    // ==================== Get Snapshot Count Tests ====================
    describe('GET /api/performance/count', () => {
        it('should retrieve total snapshot count', async () => {
            mockPerformanceAggregator.getSnapshotCount.mockReturnValue(1000);
            
            const response = await request(app)
                .get('/api/performance/count');
            
            expect(response.status).toBe(200);
            expect(response.body.success).toBe(true);
            expect(response.body.data.count).toBe(1000);
            expect(response.body.data.operation).toBe('all');
        });

        it('should retrieve count for specific operation', async () => {
            mockPerformanceAggregator.getSnapshotCount.mockReturnValue(250);
            
            const response = await request(app)
                .get('/api/performance/count?operation=database_query');
            
            expect(response.status).toBe(200);
            expect(response.body.data.operation).toBe('database_query');
            expect(response.body.data.count).toBe(250);
            expect(mockPerformanceAggregator.getSnapshotCount).toHaveBeenCalledWith('database_query');
        });

        it('should handle errors', async () => {
            mockPerformanceAggregator.getSnapshotCount.mockImplementation(() => {
                throw new Error('Count failed');
            });
            
            const response = await request(app)
                .get('/api/performance/count');
            
            expect(response.status).toBe(500);
        });

        it('should require authentication', async () => {
            mockValidateToken.mockImplementation((req: any, res: any) => {
                res.status(401).send({ message: 'Unauthorized' });
            });
            
            const response = await request(app)
                .get('/api/performance/count');
            
            expect(response.status).toBe(401);
        });
    });

    // ==================== Clear Metrics Tests ====================
    describe('DELETE /api/performance/metrics', () => {
        it('should clear all metrics', async () => {
            mockPerformanceAggregator.clear.mockReturnValue(undefined);
            
            const response = await request(app)
                .delete('/api/performance/metrics');
            
            expect(response.status).toBe(200);
            expect(response.body.success).toBe(true);
            expect(response.body.message).toContain('Cleared all');
            expect(mockPerformanceAggregator.clear).toHaveBeenCalled();
        });

        it('should clear specific operation metrics', async () => {
            mockPerformanceAggregator.clearOperation.mockReturnValue(undefined);
            
            const response = await request(app)
                .delete('/api/performance/metrics?operation=slow_query');
            
            expect(response.status).toBe(200);
            expect(response.body.success).toBe(true);
            expect(response.body.message).toContain('slow_query');
            expect(mockPerformanceAggregator.clearOperation).toHaveBeenCalledWith('slow_query');
        });

        it('should handle clear errors', async () => {
            mockPerformanceAggregator.clear.mockImplementation(() => {
                throw new Error('Clear failed');
            });
            
            const response = await request(app)
                .delete('/api/performance/metrics');
            
            expect(response.status).toBe(500);
        });

        it('should require authentication', async () => {
            mockValidateToken.mockImplementation((req: any, res: any) => {
                res.status(401).send({ message: 'Unauthorized' });
            });
            
            const response = await request(app)
                .delete('/api/performance/metrics');
            
            expect(response.status).toBe(401);
        });
    });

    // ==================== Security Tests ====================
    describe('Security & Access Control', () => {
        it('should enforce authentication on all endpoints', async () => {
            mockValidateToken.mockImplementation((req: any, res: any) => {
                res.status(401).send({ message: 'Unauthorized' });
            });
            
            const endpoints = [
                { method: 'get', path: '/api/performance/metrics' },
                { method: 'get', path: '/api/performance/metrics/test' },
                { method: 'get', path: '/api/performance/slowest' },
                { method: 'get', path: '/api/performance/bottlenecks' },
                { method: 'get', path: '/api/performance/count' },
                { method: 'delete', path: '/api/performance/metrics' }
            ];
            
            for (const endpoint of endpoints) {
                let response;
                if (endpoint.method === 'delete') {
                    response = await request(app).delete(endpoint.path);
                } else {
                    response = await request(app).get(endpoint.path);
                }
                
                expect(response.status).toBe(401);
            }
        });

        it('should validate query parameters', async () => {
            mockPerformanceAggregator.getSlowestOperations.mockReturnValue([]);
            
            const response = await request(app)
                .get('/api/performance/slowest?limit=-1');
            
            expect(response.status).toBe(200);
            // Should use default limit for negative values
            expect(mockPerformanceAggregator.getSlowestOperations).toHaveBeenCalledWith(10);
        });

        it('should handle large limit values', async () => {
            mockPerformanceAggregator.getSlowestOperations.mockReturnValue([]);
            
            const response = await request(app)
                .get('/api/performance/slowest?limit=10000');
            
            expect(response.status).toBe(200);
            expect(mockPerformanceAggregator.getSlowestOperations).toHaveBeenCalledWith(10000);
        });
    });
});
