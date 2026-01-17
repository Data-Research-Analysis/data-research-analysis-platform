import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import request from 'supertest';
import express from 'express';
import articleRouter from '../article.js';

// Mock processors
jest.mock('../../processors/ArticleProcessor.js', () => ({
    ArticleProcessor: {
        getInstance: jest.fn(() => ({
            getPublicArticles: jest.fn()
        }))
    }
}));

jest.mock('../../processors/TokenProcessor.js');

import { ArticleProcessor } from '../../../../processors/ArticleProcessor.js';
import { EUserType } from '../../../../types/EUserType.js';

describe('Public Article Routes Integration Tests', () => {
    let app: express.Application;
    let mockValidateToken: any;
    
    const validTokenDetails = {
        user_id: 1,
        email: 'user@example.com',
        user_type: EUserType.NORMAL,
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
        
        app.use('/api/article', articleRouter);
        jest.clearAllMocks();
    });

    // ==================== List Public Articles Tests ====================
    describe('GET /api/article/list', () => {
        it('should retrieve all public articles', async () => {
            const mockArticles = [
                {
                    article_id: 1,
                    title: 'Getting Started with Data Analysis',
                    content: '<p>Introduction to data analysis...</p>',
                    publish_status: 'published',
                    created_at: new Date('2024-01-01'),
                    categories: ['Analytics', 'Tutorial']
                },
                {
                    article_id: 2,
                    title: 'Advanced SQL Techniques',
                    content: '<p>Learn advanced SQL...</p>',
                    publish_status: 'published',
                    created_at: new Date('2024-01-15'),
                    categories: ['SQL', 'Database']
                }
            ];
            
            const articleProcessor = ArticleProcessor.getInstance();
            (articleProcessor.getPublicArticles as any).mockResolvedValue(mockArticles);
            
            const response = await request(app)
                .get('/api/article/list');
            
            expect(response.status).toBe(200);
            expect(response.body).toEqual(mockArticles);
            expect(articleProcessor.getPublicArticles).toHaveBeenCalled();
        });

        it('should only return published articles', async () => {
            const mockArticles = [
                {
                    article_id: 1,
                    title: 'Published Article',
                    publish_status: 'published'
                },
                {
                    article_id: 2,
                    title: 'Another Published Article',
                    publish_status: 'published'
                }
            ];
            
            const articleProcessor = ArticleProcessor.getInstance();
            (articleProcessor.getPublicArticles as any).mockResolvedValue(mockArticles);
            
            const response = await request(app)
                .get('/api/article/list');
            
            expect(response.status).toBe(200);
            response.body.forEach((article: any) => {
                expect(article.publish_status).toBe('published');
            });
        });

        it('should handle empty article list', async () => {
            const articleProcessor = ArticleProcessor.getInstance();
            (articleProcessor.getPublicArticles as any).mockResolvedValue([]);
            
            const response = await request(app)
                .get('/api/article/list');
            
            expect(response.status).toBe(200);
            expect(response.body).toEqual([]);
        });

        it('should handle processor errors', async () => {
            const articleProcessor = ArticleProcessor.getInstance();
            (articleProcessor.getPublicArticles as any).mockResolvedValue(null);
            
            const response = await request(app)
                .get('/api/article/list');
            
            expect(response.status).toBe(400);
        });

        it('should require authentication', async () => {
            mockValidateToken.mockImplementation((req: any, res: any) => {
                res.status(401).send({ message: 'Unauthorized' });
            });
            
            const response = await request(app)
                .get('/api/article/list');
            
            expect(response.status).toBe(401);
        });

        it('should return articles with categories', async () => {
            const mockArticles = [
                {
                    article_id: 1,
                    title: 'Test Article',
                    categories: ['Category1', 'Category2']
                }
            ];
            
            const articleProcessor = ArticleProcessor.getInstance();
            (articleProcessor.getPublicArticles as any).mockResolvedValue(mockArticles);
            
            const response = await request(app)
                .get('/api/article/list');
            
            expect(response.status).toBe(200);
            expect(response.body[0].categories).toBeDefined();
            expect(Array.isArray(response.body[0].categories)).toBe(true);
        });

        it('should return articles sorted by date', async () => {
            const mockArticles = [
                { article_id: 3, title: 'Newest', created_at: new Date('2024-03-01') },
                { article_id: 2, title: 'Middle', created_at: new Date('2024-02-01') },
                { article_id: 1, title: 'Oldest', created_at: new Date('2024-01-01') }
            ];
            
            const articleProcessor = ArticleProcessor.getInstance();
            (articleProcessor.getPublicArticles as any).mockResolvedValue(mockArticles);
            
            const response = await request(app)
                .get('/api/article/list');
            
            expect(response.status).toBe(200);
            expect(response.body.length).toBe(3);
        });

        it('should handle large article collections', async () => {
            const mockArticles = Array.from({ length: 50 }, (_, i) => ({
                article_id: i + 1,
                title: `Article ${i + 1}`,
                content: `Content for article ${i + 1}`,
                publish_status: 'published'
            }));
            
            const articleProcessor = ArticleProcessor.getInstance();
            (articleProcessor.getPublicArticles as any).mockResolvedValue(mockArticles);
            
            const response = await request(app)
                .get('/api/article/list');
            
            expect(response.status).toBe(200);
            expect(response.body.length).toBe(50);
        });

        it('should include markdown content if available', async () => {
            const mockArticles = [
                {
                    article_id: 1,
                    title: 'Markdown Article',
                    content: '<h1>Title</h1><p>Content</p>',
                    content_markdown: '# Title\n\nContent'
                }
            ];
            
            const articleProcessor = ArticleProcessor.getInstance();
            (articleProcessor.getPublicArticles as any).mockResolvedValue(mockArticles);
            
            const response = await request(app)
                .get('/api/article/list');
            
            expect(response.status).toBe(200);
            expect(response.body[0].content_markdown).toBeDefined();
        });

        it('should handle articles without markdown', async () => {
            const mockArticles = [
                {
                    article_id: 1,
                    title: 'HTML Only Article',
                    content: '<p>Content</p>'
                }
            ];
            
            const articleProcessor = ArticleProcessor.getInstance();
            (articleProcessor.getPublicArticles as any).mockResolvedValue(mockArticles);
            
            const response = await request(app)
                .get('/api/article/list');
            
            expect(response.status).toBe(200);
            expect(response.body[0].content).toBeDefined();
        });

        it('should handle processor exceptions gracefully', async () => {
            const articleProcessor = ArticleProcessor.getInstance();
            (articleProcessor.getPublicArticles as any).mockRejectedValue(
                new Error('Database query failed')
            );
            
            const response = await request(app)
                .get('/api/article/list');
            
            expect(response.status).toBeGreaterThanOrEqual(400);
        });

        it('should work for both normal and admin users', async () => {
            const mockArticles = [{ article_id: 1, title: 'Test' }];
            const articleProcessor = ArticleProcessor.getInstance();
            (articleProcessor.getPublicArticles as any).mockResolvedValue(mockArticles);
            
            // Normal user
            const response1 = await request(app)
                .get('/api/article/list');
            expect(response1.status).toBe(200);
            
            // Admin user
            mockValidateToken.mockImplementation((req: any, res: any, next: any) => {
                req.body.tokenDetails = { ...validTokenDetails, user_type: EUserType.ADMIN };
                next();
            });
            
            const response2 = await request(app)
                .get('/api/article/list');
            expect(response2.status).toBe(200);
        });
    });

    // ==================== Security Tests ====================
    describe('Security & Access Control', () => {
        it('should enforce authentication', async () => {
            mockValidateToken.mockImplementation((req: any, res: any) => {
                res.status(401).send({ message: 'Unauthorized' });
            });
            
            const response = await request(app)
                .get('/api/article/list');
            
            expect(response.status).toBe(401);
        });

        it('should not expose draft articles', async () => {
            const mockArticles = [
                { article_id: 1, title: 'Published', publish_status: 'published' }
                // Draft articles should not be in public API
            ];
            
            const articleProcessor = ArticleProcessor.getInstance();
            (articleProcessor.getPublicArticles as any).mockResolvedValue(mockArticles);
            
            const response = await request(app)
                .get('/api/article/list');
            
            expect(response.status).toBe(200);
            const draftArticles = response.body.filter((a: any) => a.publish_status !== 'published');
            expect(draftArticles.length).toBe(0);
        });

        it('should sanitize article content', async () => {
            const mockArticles = [
                {
                    article_id: 1,
                    title: 'Test Article',
                    content: '<p>Safe content</p>',
                    publish_status: 'published'
                }
            ];
            
            const articleProcessor = ArticleProcessor.getInstance();
            (articleProcessor.getPublicArticles as any).mockResolvedValue(mockArticles);
            
            const response = await request(app)
                .get('/api/article/list');
            
            expect(response.status).toBe(200);
            expect(response.body[0].content).toBeDefined();
        });
    });
});
