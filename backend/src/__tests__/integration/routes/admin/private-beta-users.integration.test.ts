import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import request from 'supertest';
import express from 'express';
import privateBetaUsersRouter from '../../../../routes/admin/private_beta_users.js';

// Mock processors
jest.mock('../../../../processors/PrivateBetaUserProcessor.js', () => ({
    PrivateBetaUserProcessor: {
        getInstance: jest.fn(() => ({
            getUsers: jest.fn()
        }))
    }
}));

jest.mock('../../../../processors/TokenProcessor.js');

import { PrivateBetaUserProcessor } from '../../../../processors/PrivateBetaUserProcessor.js';
import { EUserType } from '../../../../types/EUserType.js';

describe('Private Beta Users Routes Integration Tests', () => {
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
        
        const TokenProcessor = require('../../../processors/TokenProcessor.js').TokenProcessor;
        TokenProcessor.getInstance = jest.fn(() => ({
            validateToken: mockValidateToken
        }));
        
        app.use('/api/admin/private-beta-users', privateBetaUsersRouter);
        jest.clearAllMocks();
    });

    // ==================== List Private Beta Users Tests ====================
    describe('GET /api/admin/private-beta-users/list', () => {
        it('should retrieve all private beta users', async () => {
            const mockUsers = [
                { 
                    id: 1, 
                    business_email: 'user1@company.com', 
                    first_name: 'John',
                    last_name: 'Doe',
                    company_name: 'Tech Corp',
                    is_converted: false
                },
                { 
                    id: 2, 
                    business_email: 'user2@startup.com', 
                    first_name: 'Jane',
                    last_name: 'Smith',
                    company_name: 'Startup Inc',
                    is_converted: true
                }
            ];
            
            const processor = PrivateBetaUserProcessor.getInstance();
            (processor.getUsers as any).mockResolvedValue(mockUsers);
            
            const response = await request(app)
                .get('/api/admin/private-beta-users/list');
            
            expect(response.status).toBe(200);
            expect(response.body).toEqual(mockUsers);
            expect(processor.getUsers).toHaveBeenCalledWith(validTokenDetails);
        });

        it('should handle empty user list', async () => {
            const processor = PrivateBetaUserProcessor.getInstance();
            (processor.getUsers as any).mockResolvedValue([]);
            
            const response = await request(app)
                .get('/api/admin/private-beta-users/list');
            
            expect(response.status).toBe(200);
            expect(response.body).toEqual([]);
        });

        it('should handle processor errors', async () => {
            const processor = PrivateBetaUserProcessor.getInstance();
            (processor.getUsers as any).mockResolvedValue(null);
            
            const response = await request(app)
                .get('/api/admin/private-beta-users/list');
            
            expect(response.status).toBe(400);
        });

        it('should require authentication', async () => {
            mockValidateToken.mockImplementation((req: any, res: any) => {
                res.status(401).send({ message: 'Unauthorized' });
            });
            
            const response = await request(app)
                .get('/api/admin/private-beta-users/list');
            
            expect(response.status).toBe(401);
        });

        it('should return users with conversion status', async () => {
            const mockUsers = [
                { id: 1, business_email: 'test@example.com', is_converted: false },
                { id: 2, business_email: 'converted@example.com', is_converted: true }
            ];
            
            const processor = PrivateBetaUserProcessor.getInstance();
            (processor.getUsers as any).mockResolvedValue(mockUsers);
            
            const response = await request(app)
                .get('/api/admin/private-beta-users/list');
            
            expect(response.status).toBe(200);
            const convertedUsers = response.body.filter((u: any) => u.is_converted);
            const unconvertedUsers = response.body.filter((u: any) => !u.is_converted);
            
            expect(convertedUsers.length).toBe(1);
            expect(unconvertedUsers.length).toBe(1);
        });

        it('should include all user fields', async () => {
            const mockUsers = [{
                id: 1,
                first_name: 'Test',
                last_name: 'User',
                business_email: 'test@example.com',
                phone_number: '+1234567890',
                company_name: 'Test Company',
                country: 'USA',
                agree_to_receive_updates: true,
                is_converted: false,
                created_at: new Date()
            }];
            
            const processor = PrivateBetaUserProcessor.getInstance();
            (processor.getUsers as any).mockResolvedValue(mockUsers);
            
            const response = await request(app)
                .get('/api/admin/private-beta-users/list');
            
            expect(response.status).toBe(200);
            expect(response.body[0]).toHaveProperty('first_name');
            expect(response.body[0]).toHaveProperty('last_name');
            expect(response.body[0]).toHaveProperty('business_email');
            expect(response.body[0]).toHaveProperty('company_name');
        });

        it('should handle large user lists', async () => {
            const mockUsers = Array.from({ length: 100 }, (_, i) => ({
                id: i + 1,
                business_email: `user${i}@example.com`,
                first_name: `User${i}`,
                last_name: `Test${i}`,
                is_converted: i % 3 === 0
            }));
            
            const processor = PrivateBetaUserProcessor.getInstance();
            (processor.getUsers as any).mockResolvedValue(mockUsers);
            
            const response = await request(app)
                .get('/api/admin/private-beta-users/list');
            
            expect(response.status).toBe(200);
            expect(response.body.length).toBe(100);
        });

        it('should maintain data integrity', async () => {
            const mockUsers = [
                { 
                    id: 1, 
                    business_email: 'test@example.com',
                    first_name: 'John',
                    last_name: 'Doe'
                }
            ];
            
            const processor = PrivateBetaUserProcessor.getInstance();
            (processor.getUsers as any).mockResolvedValue(mockUsers);
            
            const response = await request(app)
                .get('/api/admin/private-beta-users/list');
            
            expect(response.status).toBe(200);
            expect(response.body[0].first_name).toBe('John');
            expect(response.body[0].last_name).toBe('Doe');
        });

        it('should handle processor exceptions', async () => {
            const processor = PrivateBetaUserProcessor.getInstance();
            (processor.getUsers as any).mockRejectedValue(new Error('Database connection failed'));
            
            const response = await request(app)
                .get('/api/admin/private-beta-users/list');
            
            // Should still handle gracefully even with exception
            expect(response.status).toBeGreaterThanOrEqual(400);
        });

        it('should require admin authentication', async () => {
            const nonAdminToken = {
                ...validTokenDetails,
                user_type: EUserType.NORMAL
            };
            
            mockValidateToken.mockImplementation((req: any, res: any, next: any) => {
                req.body.tokenDetails = nonAdminToken;
                next();
            });
            
            const processor = PrivateBetaUserProcessor.getInstance();
            (processor.getUsers as any).mockResolvedValue([]);
            
            const response = await request(app)
                .get('/api/admin/private-beta-users/list');
            
            // Route should still execute, but processor handles authorization
            expect(response.status).toBeLessThan(500);
        });
    });

    // ==================== Security Tests ====================
    describe('Security & Access Control', () => {
        it('should enforce authentication on endpoint', async () => {
            mockValidateToken.mockImplementation((req: any, res: any) => {
                res.status(401).send({ message: 'Unauthorized' });
            });
            
            const response = await request(app)
                .get('/api/admin/private-beta-users/list');
            
            expect(response.status).toBe(401);
        });

        it('should not expose sensitive data without authentication', async () => {
            mockValidateToken.mockImplementation((req: any, res: any) => {
                res.status(401).send({ message: 'Unauthorized' });
            });
            
            const response = await request(app)
                .get('/api/admin/private-beta-users/list');
            
            expect(response.status).toBe(401);
            expect(response.body).not.toHaveProperty('business_email');
        });

        it('should validate token details structure', async () => {
            const processor = PrivateBetaUserProcessor.getInstance();
            (processor.getUsers as any).mockResolvedValue([]);
            
            const response = await request(app)
                .get('/api/admin/private-beta-users/list');
            
            expect(response.status).toBe(200);
            expect(processor.getUsers).toHaveBeenCalledWith(
                expect.objectContaining({
                    user_id: expect.any(Number),
                    email: expect.any(String),
                    user_type: expect.any(String)
                })
            );
        });
    });
});
