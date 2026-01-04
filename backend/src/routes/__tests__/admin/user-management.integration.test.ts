import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import request from 'supertest';
import express from 'express';
import usersRouter from '../../admin/users.js';

// Mock processors
jest.mock('../../../processors/UserManagementProcessor.js', () => ({
    UserManagementProcessor: {
        getInstance: jest.fn(() => ({
            createUser: jest.fn(),
            getUsers: jest.fn(),
            getPrivateBetaUserForConversion: jest.fn(),
            getUserById: jest.fn(),
            updateUser: jest.fn(),
            changeUserType: jest.fn(),
            toggleEmailVerificationStatus: jest.fn(),
            deleteUser: jest.fn()
        }))
    }
}));

jest.mock('../../../processors/TokenProcessor.js');

import { UserManagementProcessor } from '../../../processors/UserManagementProcessor.js';
import { EUserType } from '../../../types/EUserType.js';

describe('User Management Routes Integration Tests', () => {
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
        
        app.use('/api/admin/users', usersRouter);
        jest.clearAllMocks();
    });

    // ==================== Create User Tests ====================
    describe('POST /api/admin/users/', () => {
        const validUser = {
            first_name: 'John',
            last_name: 'Doe',
            email: 'john.doe@example.com',
            password: 'SecurePass123!',
            user_type: 'normal',
            is_conversion: false
        };

        it('should successfully create user', async () => {
            const mockUser = { user_id: 123, ...validUser };
            const userProcessor = UserManagementProcessor.getInstance();
            (userProcessor.createUser as any).mockResolvedValue(mockUser);
            
            const response = await request(app)
                .post('/api/admin/users/')
                .send(validUser);
            
            expect(response.status).toBe(201);
            expect(response.body.message).toContain('successfully');
            expect(response.body.user).toEqual(mockUser);
        });

        it('should require first_name field', async () => {
            const invalid = { ...validUser };
            delete invalid.first_name;
            
            const response = await request(app)
                .post('/api/admin/users/')
                .send(invalid);
            
            expect(response.status).toBe(400);
        });

        it('should require last_name field', async () => {
            const invalid = { ...validUser };
            delete invalid.last_name;
            
            const response = await request(app)
                .post('/api/admin/users/')
                .send(invalid);
            
            expect(response.status).toBe(400);
        });

        it('should validate email format', async () => {
            const invalid = { ...validUser, email: 'invalid-email' };
            
            const response = await request(app)
                .post('/api/admin/users/')
                .send(invalid);
            
            expect(response.status).toBe(400);
        });

        it('should enforce minimum password length', async () => {
            const invalid = { ...validUser, password: 'short' };
            
            const response = await request(app)
                .post('/api/admin/users/')
                .send(invalid);
            
            expect(response.status).toBe(400);
        });

        it('should validate user_type enum', async () => {
            const invalid = { ...validUser, user_type: 'invalid' };
            
            const response = await request(app)
                .post('/api/admin/users/')
                .send(invalid);
            
            expect(response.status).toBe(400);
        });

        it('should accept admin user_type', async () => {
            const userProcessor = UserManagementProcessor.getInstance();
            (userProcessor.createUser as any).mockResolvedValue({ user_id: 124 });
            
            const adminUser = { ...validUser, user_type: 'admin' };
            const response = await request(app)
                .post('/api/admin/users/')
                .send(adminUser);
            
            expect(response.status).toBe(201);
        });

        it('should handle duplicate email', async () => {
            const userProcessor = UserManagementProcessor.getInstance();
            (userProcessor.createUser as any).mockResolvedValue(null);
            
            const response = await request(app)
                .post('/api/admin/users/')
                .send(validUser);
            
            expect(response.status).toBe(400);
            expect(response.body.message).toContain('Email may already exist');
        });

        it('should require authentication', async () => {
            mockValidateToken.mockImplementation((req: any, res: any) => {
                res.status(401).send({ message: 'Unauthorized' });
            });
            
            const response = await request(app)
                .post('/api/admin/users/')
                .send(validUser);
            
            expect(response.status).toBe(401);
        });
    });

    // ==================== List Users Tests ====================
    describe('GET /api/admin/users/list', () => {
        it('should retrieve all users', async () => {
            const mockUsers = [
                { user_id: 1, email: 'user1@example.com', user_type: EUserType.ADMIN },
                { user_id: 2, email: 'user2@example.com', user_type: EUserType.NORMAL }
            ];
            
            const userProcessor = UserManagementProcessor.getInstance();
            (userProcessor.getUsers as any).mockResolvedValue(mockUsers);
            
            const response = await request(app)
                .get('/api/admin/users/list');
            
            expect(response.status).toBe(200);
            expect(response.body).toEqual(mockUsers);
        });

        it('should handle empty user list', async () => {
            const userProcessor = UserManagementProcessor.getInstance();
            (userProcessor.getUsers as any).mockResolvedValue([]);
            
            const response = await request(app)
                .get('/api/admin/users/list');
            
            expect(response.status).toBe(200);
            expect(response.body).toEqual([]);
        });

        it('should handle processor errors', async () => {
            const userProcessor = UserManagementProcessor.getInstance();
            (userProcessor.getUsers as any).mockResolvedValue(null);
            
            const response = await request(app)
                .get('/api/admin/users/list');
            
            expect(response.status).toBe(400);
        });

        it('should require authentication', async () => {
            mockValidateToken.mockImplementation((req: any, res: any) => {
                res.status(401).send({ message: 'Unauthorized' });
            });
            
            const response = await request(app)
                .get('/api/admin/users/list');
            
            expect(response.status).toBe(401);
        });
    });

    // ==================== Get User by ID Tests ====================
    describe('GET /api/admin/users/:user_id', () => {
        it('should retrieve user by ID', async () => {
            const mockUser = { user_id: 123, email: 'test@example.com' };
            const userProcessor = UserManagementProcessor.getInstance();
            (userProcessor.getUserById as any).mockResolvedValue(mockUser);
            
            const response = await request(app)
                .get('/api/admin/users/123');
            
            expect(response.status).toBe(200);
            expect(response.body).toEqual(mockUser);
            expect(userProcessor.getUserById).toHaveBeenCalledWith(123, validTokenDetails);
        });

        it('should handle user not found', async () => {
            const userProcessor = UserManagementProcessor.getInstance();
            (userProcessor.getUserById as any).mockResolvedValue(null);
            
            const response = await request(app)
                .get('/api/admin/users/999');
            
            expect(response.status).toBe(404);
            expect(response.body.message).toContain('not found');
        });

        it('should reject invalid user ID', async () => {
            const response = await request(app)
                .get('/api/admin/users/invalid');
            
            expect(response.status).toBe(400);
        });

        it('should require authentication', async () => {
            mockValidateToken.mockImplementation((req: any, res: any) => {
                res.status(401).send({ message: 'Unauthorized' });
            });
            
            const response = await request(app)
                .get('/api/admin/users/123');
            
            expect(response.status).toBe(401);
        });
    });

    // ==================== Update User Tests ====================
    describe('PUT /api/admin/users/:user_id', () => {
        it('should successfully update user', async () => {
            const userProcessor = UserManagementProcessor.getInstance();
            (userProcessor.updateUser as any).mockResolvedValue(true);
            
            const response = await request(app)
                .put('/api/admin/users/123')
                .send({
                    first_name: 'Updated',
                    last_name: 'Name',
                    email: 'updated@example.com'
                });
            
            expect(response.status).toBe(200);
            expect(response.body.message).toContain('successfully');
        });

        it('should allow partial updates', async () => {
            const userProcessor = UserManagementProcessor.getInstance();
            (userProcessor.updateUser as any).mockResolvedValue(true);
            
            const response = await request(app)
                .put('/api/admin/users/123')
                .send({ first_name: 'Updated' });
            
            expect(response.status).toBe(200);
        });

        it('should validate email format when provided', async () => {
            const response = await request(app)
                .put('/api/admin/users/123')
                .send({ email: 'invalid-email' });
            
            expect(response.status).toBe(400);
        });

        it('should handle update failures', async () => {
            const userProcessor = UserManagementProcessor.getInstance();
            (userProcessor.updateUser as any).mockResolvedValue(false);
            
            const response = await request(app)
                .put('/api/admin/users/123')
                .send({ first_name: 'Updated' });
            
            expect(response.status).toBe(400);
        });

        it('should require authentication', async () => {
            mockValidateToken.mockImplementation((req: any, res: any) => {
                res.status(401).send({ message: 'Unauthorized' });
            });
            
            const response = await request(app)
                .put('/api/admin/users/123')
                .send({ first_name: 'Updated' });
            
            expect(response.status).toBe(401);
        });
    });

    // ==================== Change User Type Tests ====================
    describe('POST /api/admin/users/:user_id/change-type', () => {
        it('should successfully change user type to admin', async () => {
            const userProcessor = UserManagementProcessor.getInstance();
            (userProcessor.changeUserType as any).mockResolvedValue(true);
            
            const response = await request(app)
                .post('/api/admin/users/123/change-type')
                .send({ user_type: 'admin' });
            
            expect(response.status).toBe(200);
            expect(response.body.message).toContain('successfully');
            expect(userProcessor.changeUserType).toHaveBeenCalledWith(
                123,
                EUserType.ADMIN,
                validTokenDetails
            );
        });

        it('should successfully change user type to normal', async () => {
            const userProcessor = UserManagementProcessor.getInstance();
            (userProcessor.changeUserType as any).mockResolvedValue(true);
            
            const response = await request(app)
                .post('/api/admin/users/123/change-type')
                .send({ user_type: 'normal' });
            
            expect(response.status).toBe(200);
            expect(userProcessor.changeUserType).toHaveBeenCalledWith(
                123,
                EUserType.NORMAL,
                validTokenDetails
            );
        });

        it('should require user_type field', async () => {
            const response = await request(app)
                .post('/api/admin/users/123/change-type')
                .send({});
            
            expect(response.status).toBe(400);
        });

        it('should validate user_type enum', async () => {
            const response = await request(app)
                .post('/api/admin/users/123/change-type')
                .send({ user_type: 'invalid' });
            
            expect(response.status).toBe(400);
        });

        it('should handle change failures', async () => {
            const userProcessor = UserManagementProcessor.getInstance();
            (userProcessor.changeUserType as any).mockResolvedValue(false);
            
            const response = await request(app)
                .post('/api/admin/users/123/change-type')
                .send({ user_type: 'admin' });
            
            expect(response.status).toBe(400);
        });

        it('should require authentication', async () => {
            mockValidateToken.mockImplementation((req: any, res: any) => {
                res.status(401).send({ message: 'Unauthorized' });
            });
            
            const response = await request(app)
                .post('/api/admin/users/123/change-type')
                .send({ user_type: 'admin' });
            
            expect(response.status).toBe(401);
        });
    });

    // ==================== Toggle Email Verification Tests ====================
    describe('POST /api/admin/users/:user_id/toggle-email-verification', () => {
        it('should successfully toggle email verification', async () => {
            const userProcessor = UserManagementProcessor.getInstance();
            (userProcessor.toggleEmailVerificationStatus as any).mockResolvedValue(true);
            
            const response = await request(app)
                .post('/api/admin/users/123/toggle-email-verification');
            
            expect(response.status).toBe(200);
            expect(response.body.message).toContain('successfully');
            expect(userProcessor.toggleEmailVerificationStatus).toHaveBeenCalledWith(
                123,
                validTokenDetails
            );
        });

        it('should reject invalid user ID', async () => {
            const response = await request(app)
                .post('/api/admin/users/invalid/toggle-email-verification');
            
            expect(response.status).toBe(400);
        });

        it('should handle toggle failures', async () => {
            const userProcessor = UserManagementProcessor.getInstance();
            (userProcessor.toggleEmailVerificationStatus as any).mockResolvedValue(false);
            
            const response = await request(app)
                .post('/api/admin/users/123/toggle-email-verification');
            
            expect(response.status).toBe(400);
        });

        it('should require authentication', async () => {
            mockValidateToken.mockImplementation((req: any, res: any) => {
                res.status(401).send({ message: 'Unauthorized' });
            });
            
            const response = await request(app)
                .post('/api/admin/users/123/toggle-email-verification');
            
            expect(response.status).toBe(401);
        });
    });

    // ==================== Delete User Tests ====================
    describe('DELETE /api/admin/users/:user_id', () => {
        it('should successfully delete user', async () => {
            const userProcessor = UserManagementProcessor.getInstance();
            (userProcessor.deleteUser as any).mockResolvedValue(true);
            
            const response = await request(app)
                .delete('/api/admin/users/123');
            
            expect(response.status).toBe(200);
            expect(response.body.message).toContain('successfully');
            expect(userProcessor.deleteUser).toHaveBeenCalledWith(123, validTokenDetails);
        });

        it('should reject invalid user ID', async () => {
            const response = await request(app)
                .delete('/api/admin/users/abc');
            
            expect(response.status).toBe(400);
        });

        it('should handle deletion failures', async () => {
            const userProcessor = UserManagementProcessor.getInstance();
            (userProcessor.deleteUser as any).mockResolvedValue(false);
            
            const response = await request(app)
                .delete('/api/admin/users/123');
            
            expect(response.status).toBe(400);
        });

        it('should require authentication', async () => {
            mockValidateToken.mockImplementation((req: any, res: any) => {
                res.status(401).send({ message: 'Unauthorized' });
            });
            
            const response = await request(app)
                .delete('/api/admin/users/123');
            
            expect(response.status).toBe(401);
        });
    });

    // ==================== Security Tests ====================
    describe('Security & Input Validation', () => {
        it('should normalize email addresses', async () => {
            const userProcessor = UserManagementProcessor.getInstance();
            (userProcessor.createUser as any).mockResolvedValue({ user_id: 125 });
            
            const response = await request(app)
                .post('/api/admin/users/')
                .send({
                    first_name: 'Test',
                    last_name: 'User',
                    email: 'TEST@EXAMPLE.COM',
                    password: 'SecurePass123!',
                    user_type: 'normal'
                });
            
            expect(response.status).toBe(201);
        });

        it('should validate numeric user IDs', async () => {
            const endpoints = [
                '/api/admin/users/abc',
                '/api/admin/users/12.5',
                '/api/admin/users/null'
            ];
            
            for (const endpoint of endpoints) {
                const response = await request(app).get(endpoint);
                expect(response.status).toBe(400);
            }
        });

        it('should enforce authentication on all endpoints', async () => {
            mockValidateToken.mockImplementation((req: any, res: any) => {
                res.status(401).send({ message: 'Unauthorized' });
            });
            
            const endpoints = [
                { method: 'post', path: '/api/admin/users/', body: {} },
                { method: 'get', path: '/api/admin/users/list' },
                { method: 'get', path: '/api/admin/users/123' },
                { method: 'put', path: '/api/admin/users/123', body: {} },
                { method: 'post', path: '/api/admin/users/123/change-type', body: { user_type: 'admin' } },
                { method: 'post', path: '/api/admin/users/123/toggle-email-verification' },
                { method: 'delete', path: '/api/admin/users/123' }
            ];
            
            for (const endpoint of endpoints) {
                let response;
                if (endpoint.method === 'post') {
                    response = await request(app).post(endpoint.path).send(endpoint.body || {});
                } else if (endpoint.method === 'put') {
                    response = await request(app).put(endpoint.path).send(endpoint.body || {});
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
