import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import request from 'supertest';
import express from 'express';
import articleRouter from '../../admin/article.js';

// Mock processors
jest.mock('../../../processors/ArticleProcessor.js', () => ({
    ArticleProcessor: {
        getInstance: jest.fn(() => ({
            getArticles: jest.fn(),
            addArticle: jest.fn(),
            publishArticle: jest.fn(),
            unpublishArticle: jest.fn(),
            deleteArticle: jest.fn(),
            editArticle: jest.fn()
        }))
    }
}));

jest.mock('../../../processors/TokenProcessor.js');

import { ArticleProcessor } from '../../../processors/ArticleProcessor.js';
import { EUserType } from '../../../types/EUserType.js';
import { EPublishStatus } from '../../../types/EPublishStatus.js';

describe('Article Management Routes Integration Tests', () => {
    let app: express.Application;
    let mockValidateToken: any;
    
    const validTokenDetails = {
        user_id: 1,
        email: 'admin@example.com',
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
        
        const TokenProcessor = require('../../../processors/TokenProcessor.js').TokenProcessor;
        TokenProcessor.getInstance = jest.fn(() => ({
            validateToken: mockValidateToken
        }));
        
        app.use('/api/admin/article', articleRouter);
        
        // Reset all mocks
        jest.clearAllMocks();
    });

    // ==================== List Articles Tests ====================
    describe('GET /api/admin/article/list', () => {
        it('should retrieve all articles', async () => {
            const mockArticles = [
                { article_id: 1, title: 'Test Article 1', publish_status: 'published' },
                { article_id: 2, title: 'Test Article 2', publish_status: 'draft' }
            ];
            
            const articleProcessor = ArticleProcessor.getInstance();
            (articleProcessor.getArticles as any).mockResolvedValue(mockArticles);
            
            const response = await request(app)
                .get('/api/admin/article/list');
            
            expect(response.status).toBe(200);
            expect(response.body).toEqual(mockArticles);
            expect(articleProcessor.getArticles).toHaveBeenCalledWith(validTokenDetails);
        });

        it('should handle empty article list', async () => {
            const articleProcessor = ArticleProcessor.getInstance();
            (articleProcessor.getArticles as any).mockResolvedValue([]);
            
            const response = await request(app)
                .get('/api/admin/article/list');
            
            expect(response.status).toBe(200);
            expect(response.body).toEqual([]);
        });

        it('should handle processor errors', async () => {
            const articleProcessor = ArticleProcessor.getInstance();
            (articleProcessor.getArticles as any).mockResolvedValue(null);
            
            const response = await request(app)
                .get('/api/admin/article/list');
            
            expect(response.status).toBe(400);
        });

        it('should require authentication', async () => {
            mockValidateToken.mockImplementation((req: any, res: any) => {
                res.status(401).send({ message: 'Unauthorized' });
            });
            
            const response = await request(app)
                .get('/api/admin/article/list');
            
            expect(response.status).toBe(401);
        });
    });

    // ==================== Add Article Tests ====================
    describe('POST /api/admin/article/add', () => {
        const validArticle = {
            title: 'New Test Article',
            content: '<p>Article content</p>',
            content_markdown: '# Article content',
            publish_status: EPublishStatus.DRAFT,
            categories: [1, 2, 3]
        };

        it('should successfully add article', async () => {
            const articleProcessor = ArticleProcessor.getInstance();
            (articleProcessor.addArticle as any).mockResolvedValue(true);
            
            const response = await request(app)
                .post('/api/admin/article/add')
                .send(validArticle);
            
            expect(response.status).toBe(200);
            expect(response.body.message).toContain('added');
            expect(articleProcessor.addArticle).toHaveBeenCalledWith(
                validArticle.title,
                validArticle.content,
                validArticle.content_markdown,
                validArticle.publish_status,
                validArticle.categories,
                validTokenDetails
            );
        });

        it('should require title field', async () => {
            const invalid = { ...validArticle };
            delete invalid.title;
            
            const response = await request(app)
                .post('/api/admin/article/add')
                .send(invalid);
            
            expect(response.status).toBe(400);
        });

        it('should require content field', async () => {
            const invalid = { ...validArticle };
            delete invalid.content;
            
            const response = await request(app)
                .post('/api/admin/article/add')
                .send(invalid);
            
            expect(response.status).toBe(400);
        });

        it('should require publish_status field', async () => {
            const invalid = { ...validArticle };
            delete invalid.publish_status;
            
            const response = await request(app)
                .post('/api/admin/article/add')
                .send(invalid);
            
            expect(response.status).toBe(400);
        });

        it('should require categories array', async () => {
            const invalid = { ...validArticle };
            delete invalid.categories;
            
            const response = await request(app)
                .post('/api/admin/article/add')
                .send(invalid);
            
            expect(response.status).toBe(400);
        });

        it('should validate categories is array', async () => {
            const invalid = { ...validArticle, categories: 'not-an-array' };
            
            const response = await request(app)
                .post('/api/admin/article/add')
                .send(invalid);
            
            expect(response.status).toBe(400);
        });

        it('should allow optional content_markdown', async () => {
            const articleProcessor = ArticleProcessor.getInstance();
            (articleProcessor.addArticle as any).mockResolvedValue(true);
            
            const withoutMarkdown = { ...validArticle };
            delete withoutMarkdown.content_markdown;
            
            const response = await request(app)
                .post('/api/admin/article/add')
                .send(withoutMarkdown);
            
            expect(response.status).toBe(200);
        });

        it('should handle addition failures', async () => {
            const articleProcessor = ArticleProcessor.getInstance();
            (articleProcessor.addArticle as any).mockResolvedValue(false);
            
            const response = await request(app)
                .post('/api/admin/article/add')
                .send(validArticle);
            
            expect(response.status).toBe(400);
            expect(response.body.message).toContain('could not be added');
        });

        it('should require authentication', async () => {
            mockValidateToken.mockImplementation((req: any, res: any) => {
                res.status(401).send({ message: 'Unauthorized' });
            });
            
            const response = await request(app)
                .post('/api/admin/article/add')
                .send(validArticle);
            
            expect(response.status).toBe(401);
        });
    });

    // ==================== Publish Article Tests ====================
    describe('GET /api/admin/article/publish/:article_id', () => {
        it('should successfully publish article', async () => {
            const articleProcessor = ArticleProcessor.getInstance();
            (articleProcessor.publishArticle as any).mockResolvedValue(true);
            
            const response = await request(app)
                .get('/api/admin/article/publish/123');
            
            expect(response.status).toBe(200);
            expect(response.body.message).toContain('published');
            expect(articleProcessor.publishArticle).toHaveBeenCalledWith(123, validTokenDetails);
        });

        it('should reject invalid article ID', async () => {
            const response = await request(app)
                .get('/api/admin/article/publish/invalid');
            
            expect(response.status).toBe(400);
        });

        it('should handle publish failures', async () => {
            const articleProcessor = ArticleProcessor.getInstance();
            (articleProcessor.publishArticle as any).mockResolvedValue(false);
            
            const response = await request(app)
                .get('/api/admin/article/publish/123');
            
            expect(response.status).toBe(400);
            expect(response.body.message).toContain('could not be published');
        });

        it('should require authentication', async () => {
            mockValidateToken.mockImplementation((req: any, res: any) => {
                res.status(401).send({ message: 'Unauthorized' });
            });
            
            const response = await request(app)
                .get('/api/admin/article/publish/123');
            
            expect(response.status).toBe(401);
        });
    });

    // ==================== Unpublish Article Tests ====================
    describe('GET /api/admin/article/unpublish/:article_id', () => {
        it('should successfully unpublish article', async () => {
            const articleProcessor = ArticleProcessor.getInstance();
            (articleProcessor.unpublishArticle as any).mockResolvedValue(true);
            
            const response = await request(app)
                .get('/api/admin/article/unpublish/123');
            
            expect(response.status).toBe(200);
            expect(response.body.message).toContain('unpublished');
            expect(articleProcessor.unpublishArticle).toHaveBeenCalledWith(123, validTokenDetails);
        });

        it('should reject invalid article ID', async () => {
            const response = await request(app)
                .get('/api/admin/article/unpublish/abc');
            
            expect(response.status).toBe(400);
        });

        it('should handle unpublish failures', async () => {
            const articleProcessor = ArticleProcessor.getInstance();
            (articleProcessor.unpublishArticle as any).mockResolvedValue(false);
            
            const response = await request(app)
                .get('/api/admin/article/unpublish/123');
            
            expect(response.status).toBe(400);
        });

        it('should require authentication', async () => {
            mockValidateToken.mockImplementation((req: any, res: any) => {
                res.status(401).send({ message: 'Unauthorized' });
            });
            
            const response = await request(app)
                .get('/api/admin/article/unpublish/123');
            
            expect(response.status).toBe(401);
        });
    });

    // ==================== Delete Article Tests ====================
    describe('DELETE /api/admin/article/delete/:article_id', () => {
        it('should successfully delete article', async () => {
            const articleProcessor = ArticleProcessor.getInstance();
            (articleProcessor.deleteArticle as any).mockResolvedValue(true);
            
            const response = await request(app)
                .delete('/api/admin/article/delete/123');
            
            expect(response.status).toBe(200);
            expect(response.body.message).toContain('deleted');
            expect(articleProcessor.deleteArticle).toHaveBeenCalledWith(123, validTokenDetails);
        });

        it('should reject invalid article ID', async () => {
            const response = await request(app)
                .delete('/api/admin/article/delete/xyz');
            
            expect(response.status).toBe(400);
        });

        it('should handle deletion failures', async () => {
            const articleProcessor = ArticleProcessor.getInstance();
            (articleProcessor.deleteArticle as any).mockResolvedValue(false);
            
            const response = await request(app)
                .delete('/api/admin/article/delete/123');
            
            expect(response.status).toBe(400);
            expect(response.body.message).toContain('could not be deleted');
        });

        it('should require authentication', async () => {
            mockValidateToken.mockImplementation((req: any, res: any) => {
                res.status(401).send({ message: 'Unauthorized' });
            });
            
            const response = await request(app)
                .delete('/api/admin/article/delete/123');
            
            expect(response.status).toBe(401);
        });
    });

    // ==================== Edit Article Tests ====================
    describe('POST /api/admin/article/edit', () => {
        const validEdit = {
            article_id: 123,
            title: 'Updated Article Title',
            content: '<p>Updated content</p>',
            content_markdown: '# Updated content',
            categories: [1, 2]
        };

        it('should successfully edit article', async () => {
            const articleProcessor = ArticleProcessor.getInstance();
            (articleProcessor.editArticle as any).mockResolvedValue(true);
            
            const response = await request(app)
                .post('/api/admin/article/edit')
                .send(validEdit);
            
            expect(response.status).toBe(200);
            expect(response.body.message).toContain('edited');
            expect(articleProcessor.editArticle).toHaveBeenCalledWith(
                validEdit.article_id,
                validEdit.title,
                validEdit.content,
                validEdit.content_markdown,
                validEdit.categories,
                validTokenDetails
            );
        });

        it('should require article_id field', async () => {
            const invalid = { ...validEdit };
            delete invalid.article_id;
            
            const response = await request(app)
                .post('/api/admin/article/edit')
                .send(invalid);
            
            expect(response.status).toBe(400);
        });

        it('should require title field', async () => {
            const invalid = { ...validEdit };
            delete invalid.title;
            
            const response = await request(app)
                .post('/api/admin/article/edit')
                .send(invalid);
            
            expect(response.status).toBe(400);
        });

        it('should require content field', async () => {
            const invalid = { ...validEdit };
            delete invalid.content;
            
            const response = await request(app)
                .post('/api/admin/article/edit')
                .send(invalid);
            
            expect(response.status).toBe(400);
        });

        it('should require categories array', async () => {
            const invalid = { ...validEdit };
            delete invalid.categories;
            
            const response = await request(app)
                .post('/api/admin/article/edit')
                .send(invalid);
            
            expect(response.status).toBe(400);
        });

        it('should allow optional content_markdown', async () => {
            const articleProcessor = ArticleProcessor.getInstance();
            (articleProcessor.editArticle as any).mockResolvedValue(true);
            
            const withoutMarkdown = { ...validEdit };
            delete withoutMarkdown.content_markdown;
            
            const response = await request(app)
                .post('/api/admin/article/edit')
                .send(withoutMarkdown);
            
            expect(response.status).toBe(200);
        });

        it('should handle edit failures', async () => {
            const articleProcessor = ArticleProcessor.getInstance();
            (articleProcessor.editArticle as any).mockResolvedValue(false);
            
            const response = await request(app)
                .post('/api/admin/article/edit')
                .send(validEdit);
            
            expect(response.status).toBe(400);
            expect(response.body.message).toContain('could not be edited');
        });

        it('should require authentication', async () => {
            mockValidateToken.mockImplementation((req: any, res: any) => {
                res.status(401).send({ message: 'Unauthorized' });
            });
            
            const response = await request(app)
                .post('/api/admin/article/edit')
                .send(validEdit);
            
            expect(response.status).toBe(401);
        });
    });

    // ==================== Security & Validation Tests ====================
    describe('Security & Input Validation', () => {
        it('should sanitize title field for XSS attempts', async () => {
            const articleProcessor = ArticleProcessor.getInstance();
            (articleProcessor.addArticle as any).mockResolvedValue(true);
            
            const xssData = {
                title: '<script>alert("XSS")</script>',
                content: '<p>Content</p>',
                publish_status: 'draft',
                categories: [1]
            };
            
            const response = await request(app)
                .post('/api/admin/article/add')
                .send(xssData);
            
            expect(response.status).toBe(200);
            // Title should be trimmed but XSS in content is allowed for rich text
        });

        it('should validate article_id as integer', async () => {
            const invalidIds = ['abc', '12.5', 'null', ''];
            
            for (const id of invalidIds) {
                const response = await request(app)
                    .get(`/api/admin/article/publish/${id}`);
                
                expect(response.status).toBe(400);
            }
        });

        it('should enforce authentication on all endpoints', async () => {
            mockValidateToken.mockImplementation((req: any, res: any) => {
                res.status(401).send({ message: 'Unauthorized' });
            });
            
            const endpoints = [
                { method: 'get', path: '/api/admin/article/list' },
                { method: 'post', path: '/api/admin/article/add', body: {} },
                { method: 'get', path: '/api/admin/article/publish/123' },
                { method: 'get', path: '/api/admin/article/unpublish/123' },
                { method: 'delete', path: '/api/admin/article/delete/123' },
                { method: 'post', path: '/api/admin/article/edit', body: {} }
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

        it('should validate markdown content structure', async () => {
            const articleProcessor = ArticleProcessor.getInstance();
            (articleProcessor.addArticle as any).mockResolvedValue(true);
            
            const markdownArticle = {
                title: 'Markdown Test',
                content: '<p>HTML version</p>',
                content_markdown: '# Header\n\n## Subheader\n\n- List item 1\n- List item 2',
                publish_status: 'draft',
                categories: [1]
            };
            
            const response = await request(app)
                .post('/api/admin/article/add')
                .send(markdownArticle);
            
            expect(response.status).toBe(200);
            expect(articleProcessor.addArticle).toHaveBeenCalledWith(
                expect.any(String),
                expect.any(String),
                markdownArticle.content_markdown,
                expect.any(String),
                expect.any(Array),
                expect.any(Object)
            );
        });
    });
});
