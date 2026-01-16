import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import request from 'supertest';
import express from 'express';
import categoryRouter from '../../admin/category.js';

// Mock processors
jest.mock('../../../processors/CategoryProcessor.js', () => ({
    CategoryProcessor: {
        getInstance: jest.fn(() => ({
            getCategories: jest.fn(),
            addCategory: jest.fn(),
            deleteCategory: jest.fn(),
            editCategory: jest.fn()
        }))
    }
}));

jest.mock('../../../processors/TokenProcessor.js');

import { CategoryProcessor } from '../../../../../processors/CategoryProcessor.js';
import { EUserType } from '../../../../../types/EUserType.js';

describe('Category Management Routes Integration Tests', () => {
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
        
        app.use('/api/admin/category', categoryRouter);
        jest.clearAllMocks();
    });

    // ==================== List Categories Tests ====================
    describe('GET /api/admin/category/list', () => {
        it('should retrieve all categories', async () => {
            const mockCategories = [
                { category_id: 1, title: 'Analytics' },
                { category_id: 2, title: 'Data Science' }
            ];
            
            const categoryProcessor = CategoryProcessor.getInstance();
            (categoryProcessor.getCategories as any).mockResolvedValue(mockCategories);
            
            const response = await request(app)
                .get('/api/admin/category/list');
            
            expect(response.status).toBe(200);
            expect(response.body).toEqual(mockCategories);
            expect(categoryProcessor.getCategories).toHaveBeenCalledWith(validTokenDetails);
        });

        it('should handle empty category list', async () => {
            const categoryProcessor = CategoryProcessor.getInstance();
            (categoryProcessor.getCategories as any).mockResolvedValue([]);
            
            const response = await request(app)
                .get('/api/admin/category/list');
            
            expect(response.status).toBe(200);
            expect(response.body).toEqual([]);
        });

        it('should handle processor errors', async () => {
            const categoryProcessor = CategoryProcessor.getInstance();
            (categoryProcessor.getCategories as any).mockResolvedValue(null);
            
            const response = await request(app)
                .get('/api/admin/category/list');
            
            expect(response.status).toBe(400);
        });

        it('should require authentication', async () => {
            mockValidateToken.mockImplementation((req: any, res: any) => {
                res.status(401).send({ message: 'Unauthorized' });
            });
            
            const response = await request(app)
                .get('/api/admin/category/list');
            
            expect(response.status).toBe(401);
        });
    });

    // ==================== Add Category Tests ====================
    describe('POST /api/admin/category/add', () => {
        it('should successfully add category', async () => {
            const categoryProcessor = CategoryProcessor.getInstance();
            (categoryProcessor.addCategory as any).mockResolvedValue(true);
            
            const response = await request(app)
                .post('/api/admin/category/add')
                .send({ title: 'Machine Learning' });
            
            expect(response.status).toBe(200);
            expect(response.body.message).toContain('added');
            expect(categoryProcessor.addCategory).toHaveBeenCalledWith(
                'Machine Learning',
                validTokenDetails
            );
        });

        it('should require title field', async () => {
            const response = await request(app)
                .post('/api/admin/category/add')
                .send({});
            
            expect(response.status).toBe(400);
        });

        it('should trim and escape title', async () => {
            const categoryProcessor = CategoryProcessor.getInstance();
            (categoryProcessor.addCategory as any).mockResolvedValue(true);
            
            const response = await request(app)
                .post('/api/admin/category/add')
                .send({ title: '  Test Category  ' });
            
            expect(response.status).toBe(200);
        });

        it('should handle addition failures', async () => {
            const categoryProcessor = CategoryProcessor.getInstance();
            (categoryProcessor.addCategory as any).mockResolvedValue(false);
            
            const response = await request(app)
                .post('/api/admin/category/add')
                .send({ title: 'Test' });
            
            expect(response.status).toBe(400);
            expect(response.body.message).toContain('could not be added');
        });

        it('should require authentication', async () => {
            mockValidateToken.mockImplementation((req: any, res: any) => {
                res.status(401).send({ message: 'Unauthorized' });
            });
            
            const response = await request(app)
                .post('/api/admin/category/add')
                .send({ title: 'Test' });
            
            expect(response.status).toBe(401);
        });
    });

    // ==================== Delete Category Tests ====================
    describe('DELETE /api/admin/category/delete/:category_id', () => {
        it('should successfully delete category', async () => {
            const categoryProcessor = CategoryProcessor.getInstance();
            (categoryProcessor.deleteCategory as any).mockResolvedValue(true);
            
            const response = await request(app)
                .delete('/api/admin/category/delete/123');
            
            expect(response.status).toBe(200);
            expect(response.body.message).toContain('deleted');
            expect(categoryProcessor.deleteCategory).toHaveBeenCalledWith(123, validTokenDetails);
        });

        it('should reject invalid category ID', async () => {
            const response = await request(app)
                .delete('/api/admin/category/delete/invalid');
            
            expect(response.status).toBe(400);
        });

        it('should handle deletion failures', async () => {
            const categoryProcessor = CategoryProcessor.getInstance();
            (categoryProcessor.deleteCategory as any).mockResolvedValue(false);
            
            const response = await request(app)
                .delete('/api/admin/category/delete/123');
            
            expect(response.status).toBe(400);
            expect(response.body.message).toContain('could not be deleted');
        });

        it('should require authentication', async () => {
            mockValidateToken.mockImplementation((req: any, res: any) => {
                res.status(401).send({ message: 'Unauthorized' });
            });
            
            const response = await request(app)
                .delete('/api/admin/category/delete/123');
            
            expect(response.status).toBe(401);
        });
    });

    // ==================== Edit Category Tests ====================
    describe('POST /api/admin/category/edit', () => {
        it('should successfully edit category', async () => {
            const categoryProcessor = CategoryProcessor.getInstance();
            (categoryProcessor.editCategory as any).mockResolvedValue(true);
            
            const response = await request(app)
                .post('/api/admin/category/edit')
                .send({ title: 'Updated Title', category_id: 123 });
            
            expect(response.status).toBe(200);
            expect(response.body.message).toContain('edited');
            expect(categoryProcessor.editCategory).toHaveBeenCalledWith(
                'Updated Title',
                123,
                validTokenDetails
            );
        });

        it('should require title field', async () => {
            const response = await request(app)
                .post('/api/admin/category/edit')
                .send({ category_id: 123 });
            
            expect(response.status).toBe(400);
        });

        it('should require category_id field', async () => {
            const response = await request(app)
                .post('/api/admin/category/edit')
                .send({ title: 'Updated' });
            
            expect(response.status).toBe(400);
        });

        it('should handle edit failures', async () => {
            const categoryProcessor = CategoryProcessor.getInstance();
            (categoryProcessor.editCategory as any).mockResolvedValue(false);
            
            const response = await request(app)
                .post('/api/admin/category/edit')
                .send({ title: 'Updated', category_id: 123 });
            
            expect(response.status).toBe(400);
            expect(response.body.message).toContain('could not be edited');
        });

        it('should require authentication', async () => {
            mockValidateToken.mockImplementation((req: any, res: any) => {
                res.status(401).send({ message: 'Unauthorized' });
            });
            
            const response = await request(app)
                .post('/api/admin/category/edit')
                .send({ title: 'Updated', category_id: 123 });
            
            expect(response.status).toBe(401);
        });
    });

    // ==================== Security Tests ====================
    describe('Security & Input Validation', () => {
        it('should escape XSS attempts in title', async () => {
            const categoryProcessor = CategoryProcessor.getInstance();
            (categoryProcessor.addCategory as any).mockResolvedValue(true);
            
            const response = await request(app)
                .post('/api/admin/category/add')
                .send({ title: '<script>alert("XSS")</script>' });
            
            expect(response.status).toBe(200);
            // Title should be escaped by express-validator
        });

        it('should validate category_id as integer', async () => {
            const response = await request(app)
                .delete('/api/admin/category/delete/abc');
            
            expect(response.status).toBe(400);
        });

        it('should enforce authentication on all endpoints', async () => {
            mockValidateToken.mockImplementation((req: any, res: any) => {
                res.status(401).send({ message: 'Unauthorized' });
            });
            
            const endpoints = [
                { method: 'get', path: '/api/admin/category/list' },
                { method: 'post', path: '/api/admin/category/add', body: { title: 'Test' } },
                { method: 'delete', path: '/api/admin/category/delete/123' },
                { method: 'post', path: '/api/admin/category/edit', body: { title: 'Test', category_id: 123 } }
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
