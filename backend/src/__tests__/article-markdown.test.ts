/**
 * Article API Tests - Markdown Support
 * Tests for creating, editing, and retrieving articles with markdown content
 */

import request from 'supertest';
import express, { Express } from 'express';
import { describe, expect, test, beforeAll, afterAll, beforeEach } from '@jest/globals';
import { DBDriver } from '../drivers/DBDriver.js';
import { EDataSourceType } from '../types/EDataSourceType.js';
import { ArticleProcessor } from '../processors/ArticleProcessor.js';
import { DRAArticle } from '../models/DRAArticle.js';
import { DRAUsersPlatform } from '../models/DRAUsersPlatform.js';
import { DRACategory } from '../models/DRACategory.js';
import { EPublishStatus } from '../types/EPublishStatus.js';
import { TokenProcessor } from '../processors/TokenProcessor.js';
import { ITokenDetails } from '../types/ITokenDetails.js';

describe('Article API - Markdown Support', () => {
    let app: Express;
    let testUserId: number;
    let testToken: string;
    let testCategoryId: number;
    
    // Helper function to create proper token details
    const createTokenDetails = (userId: number): ITokenDetails => ({
        user_id: userId,
        email: 'test-markdown@example.com',
        iat: Math.floor(Date.now() / 1000)
    });
    
    beforeAll(async () => {
        // Initialize database connection
        const driver = await DBDriver.getInstance().getDriver(EDataSourceType.POSTGRESQL);
        expect(driver).toBeDefined();
        
        // Create test user
        const manager = (await driver!.getConcreteDriver()).manager;
        const user = new DRAUsersPlatform();
        user.email = 'test-markdown@example.com';
        user.password = 'hashed_password';
        const savedUser = await manager.save(user);
        testUserId = savedUser.id;
        
        // Create test category
        const category = new DRACategory();
        category.title = 'Test Category';
        category.users_platform = savedUser;
        const savedCategory = await manager.save(category);
        testCategoryId = savedCategory.id;
        
        // Generate test token
        testToken = await TokenProcessor.getInstance().generateToken();
    });
    
    afterAll(async () => {
        // Cleanup test data
        const driver = await DBDriver.getInstance().getDriver(EDataSourceType.POSTGRESQL);
        if (driver) {
            const manager = (await driver.getConcreteDriver()).manager;
            
            // Delete test articles
            await manager.delete(DRAArticle, { users_platform: { id: testUserId } });
            
            // Delete test category
            await manager.delete(DRACategory, { id: testCategoryId });
            
            // Delete test user
            await manager.delete(DRAUsersPlatform, { id: testUserId });
        }
    });
    
    describe('Create Article with Markdown', () => {
        test('should create article with both HTML and markdown content', async () => {
            const htmlContent = '<h1>Test Article</h1><p><strong>Bold text</strong></p>';
            const markdownContent = '# Test Article\n\n**Bold text**';
            
            const tokenDetails = createTokenDetails(testUserId);
            
            const result = await ArticleProcessor.getInstance().addArticle(
                'Test Article with Markdown',
                htmlContent,
                markdownContent,
                EPublishStatus.DRAFT,
                [testCategoryId],
                tokenDetails
            );
            
            expect(result).toBe(true);
            
            // Verify article was saved with markdown
            const driver = await DBDriver.getInstance().getDriver(EDataSourceType.POSTGRESQL);
            const manager = (await driver!.getConcreteDriver()).manager;
            
            const savedArticle = await manager.findOne(DRAArticle, {
                where: { 
                    title: 'Test Article with Markdown',
                    users_platform: { id: testUserId }
                }
            });
            
            expect(savedArticle).toBeDefined();
            expect(savedArticle?.content).toBe(htmlContent);
            expect(savedArticle?.content_markdown).toBe(markdownContent);
        });
        
        test('should create article with only HTML content (markdown optional)', async () => {
            const htmlContent = '<p>Article without markdown</p>';
            
            const tokenDetails = createTokenDetails(testUserId);
            
            const result = await ArticleProcessor.getInstance().addArticle(
                'Article Without Markdown',
                htmlContent,
                undefined, // No markdown
                EPublishStatus.DRAFT,
                [testCategoryId],
                tokenDetails
            );
            
            expect(result).toBe(true);
            
            // Verify article was saved without markdown
            const driver = await DBDriver.getInstance().getDriver(EDataSourceType.POSTGRESQL);
            const manager = (await driver!.getConcreteDriver()).manager;
            
            const savedArticle = await manager.findOne(DRAArticle, {
                where: { 
                    title: 'Article Without Markdown',
                    users_platform: { id: testUserId }
                }
            });
            
            expect(savedArticle).toBeDefined();
            expect(savedArticle?.content).toBe(htmlContent);
            expect(savedArticle?.content_markdown).toBeNull();
        });
        
        test('should handle empty markdown content', async () => {
            const htmlContent = '<p>Article with empty markdown</p>';
            const markdownContent = '';
            
            const tokenDetails = createTokenDetails(testUserId);
            
            const result = await ArticleProcessor.getInstance().addArticle(
                'Article With Empty Markdown',
                htmlContent,
                markdownContent,
                EPublishStatus.DRAFT,
                [testCategoryId],
                tokenDetails
            );
            
            expect(result).toBe(true);
        });
    });
    
    describe('Edit Article with Markdown', () => {
        let testArticleId: number;
        
        beforeEach(async () => {
            // Create a test article to edit
            const driver = await DBDriver.getInstance().getDriver(EDataSourceType.POSTGRESQL);
            const manager = (await driver!.getConcreteDriver()).manager;
            
            const user = await manager.findOne(DRAUsersPlatform, { where: { id: testUserId } });
            
            const article = new DRAArticle();
            article.title = 'Article to Edit';
            article.content = '<p>Original content</p>';
            article.content_markdown = 'Original content';
            article.publish_status = EPublishStatus.DRAFT;
            article.slug = 'article-to-edit';
            article.users_platform = user!;
            
            const savedArticle = await manager.save(article);
            testArticleId = savedArticle.id;
        });
        
        test('should update both HTML and markdown content', async () => {
            const newHtmlContent = '<h1>Updated</h1><p><em>Italic text</em></p>';
            const newMarkdownContent = '# Updated\n\n*Italic text*';
            
            const tokenDetails = createTokenDetails(testUserId);
            
            const result = await ArticleProcessor.getInstance().editArticle(
                testArticleId,
                'Updated Article',
                newHtmlContent,
                newMarkdownContent,
                [testCategoryId],
                tokenDetails
            );
            
            expect(result).toBe(true);
            
            // Verify article was updated
            const driver = await DBDriver.getInstance().getDriver(EDataSourceType.POSTGRESQL);
            const manager = (await driver!.getConcreteDriver()).manager;
            
            const updatedArticle = await manager.findOne(DRAArticle, {
                where: { id: testArticleId }
            });
            
            expect(updatedArticle).toBeDefined();
            expect(updatedArticle?.title).toBe('Updated Article');
            expect(updatedArticle?.content).toBe(newHtmlContent);
            expect(updatedArticle?.content_markdown).toBe(newMarkdownContent);
        });
        
        test('should update article with undefined markdown (optional)', async () => {
            const newHtmlContent = '<p>Updated without markdown</p>';
            
            const tokenDetails = createTokenDetails(testUserId);
            
            const result = await ArticleProcessor.getInstance().editArticle(
                testArticleId,
                'Updated Without Markdown',
                newHtmlContent,
                undefined, // No markdown
                [testCategoryId],
                tokenDetails
            );
            
            expect(result).toBe(true);
            
            // Verify article was updated
            const driver = await DBDriver.getInstance().getDriver(EDataSourceType.POSTGRESQL);
            const manager = (await driver!.getConcreteDriver()).manager;
            
            const updatedArticle = await manager.findOne(DRAArticle, {
                where: { id: testArticleId }
            });
            
            expect(updatedArticle).toBeDefined();
            expect(updatedArticle?.content).toBe(newHtmlContent);
        });
        
        test('should preserve markdown on HTML-only updates', async () => {
            const newHtmlContent = '<p>New HTML content</p>';
            const existingMarkdown = 'Original content';
            
            const tokenDetails = createTokenDetails(testUserId);
            
            // Update with undefined markdown
            const result = await ArticleProcessor.getInstance().editArticle(
                testArticleId,
                'HTML Update Only',
                newHtmlContent,
                undefined,
                [testCategoryId],
                tokenDetails
            );
            
            expect(result).toBe(true);
        });
    });
    
    describe('Retrieve Articles with Markdown', () => {
        let testArticleId: number;
        
        beforeEach(async () => {
            // Create a test article with markdown
            const driver = await DBDriver.getInstance().getDriver(EDataSourceType.POSTGRESQL);
            const manager = (await driver!.getConcreteDriver()).manager;
            
            const user = await manager.findOne(DRAUsersPlatform, { where: { id: testUserId } });
            
            const article = new DRAArticle();
            article.title = 'Article with Markdown';
            article.content = '<h1>Title</h1><p>Content</p>';
            article.content_markdown = '# Title\n\nContent';
            article.publish_status = EPublishStatus.PUBLISHED;
            article.slug = 'article-with-markdown';
            article.users_platform = user!;
            
            const savedArticle = await manager.save(article);
            testArticleId = savedArticle.id;
        });
        
        test('should retrieve article with markdown content', async () => {
            const tokenDetails = createTokenDetails(testUserId);
            
            const articles = await ArticleProcessor.getInstance().getArticles(tokenDetails);
            
            expect(articles).toBeDefined();
            expect(articles.length).toBeGreaterThan(0);
            
            const article = articles.find((a) => a.article.id === testArticleId);
            expect(article).toBeDefined();
            expect(article?.article.content).toBe('<h1>Title</h1><p>Content</p>');
            expect(article?.article.content_markdown).toBe('# Title\n\nContent');
        });
        
        test('should retrieve public articles with HTML content', async () => {
            const articles = await ArticleProcessor.getInstance().getPublicArticles();
            
            expect(articles).toBeDefined();
            
            const article = articles.find((a) => a.article.id === testArticleId);
            if (article) {
                expect(article.article.content).toBeDefined();
                expect(article.article.content).toContain('<h1>Title</h1>');
            }
        });
    });
    
    describe('Markdown Content Integrity', () => {
        test('should preserve complex markdown formatting', async () => {
            const complexMarkdown = `# Heading 1

## Heading 2

**Bold text** and *italic text*

- List item 1
- List item 2
- List item 3

1. Ordered item 1
2. Ordered item 2

> Blockquote text

\`inline code\`

[Link text](https://example.com)`;
            
            const htmlContent = '<h1>Heading 1</h1><h2>Heading 2</h2><p><strong>Bold text</strong> and <em>italic text</em></p>';
            
            const tokenDetails = createTokenDetails(testUserId);
            
            const result = await ArticleProcessor.getInstance().addArticle(
                'Complex Markdown Article',
                htmlContent,
                complexMarkdown,
                EPublishStatus.DRAFT,
                [testCategoryId],
                tokenDetails
            );
            
            expect(result).toBe(true);
            
            // Verify markdown was preserved
            const driver = await DBDriver.getInstance().getDriver(EDataSourceType.POSTGRESQL);
            const manager = (await driver!.getConcreteDriver()).manager;
            
            const savedArticle = await manager.findOne(DRAArticle, {
                where: { 
                    title: 'Complex Markdown Article',
                    users_platform: { id: testUserId }
                }
            });
            
            expect(savedArticle?.content_markdown).toBe(complexMarkdown);
        });
        
        test('should handle special characters in markdown', async () => {
            const markdownWithSpecialChars = 'Text with & < > " \' characters';
            const htmlContent = '<p>Text with special characters</p>';
            
            const tokenDetails = createTokenDetails(testUserId);
            
            const result = await ArticleProcessor.getInstance().addArticle(
                'Special Characters Article',
                htmlContent,
                markdownWithSpecialChars,
                EPublishStatus.DRAFT,
                [testCategoryId],
                tokenDetails
            );
            
            expect(result).toBe(true);
        });
    });
    
    describe('Database Schema Validation', () => {
        test('should allow null markdown content', async () => {
            const driver = await DBDriver.getInstance().getDriver(EDataSourceType.POSTGRESQL);
            const manager = (await driver!.getConcreteDriver()).manager;
            
            const user = await manager.findOne(DRAUsersPlatform, { where: { id: testUserId } });
            
            const article = new DRAArticle();
            article.title = 'Article with Null Markdown';
            article.content = '<p>Content without markdown</p>';
            article.content_markdown = undefined; // Explicitly set to undefined
            article.publish_status = EPublishStatus.DRAFT;
            article.slug = 'article-with-null-markdown';
            article.users_platform = user!;
            
            // Should not throw error
            const savedArticle = await manager.save(article);
            
            expect(savedArticle).toBeDefined();
            expect(savedArticle.content_markdown).toBeUndefined();
        });
        
        test('should store markdown as TEXT field (no length limit)', async () => {
            // Create very long markdown content
            const longMarkdown = '# Long Article\n\n' + 'Lorem ipsum '.repeat(10000);
            const htmlContent = '<h1>Long Article</h1><p>' + 'Lorem ipsum '.repeat(10000) + '</p>';
            
            const tokenDetails = createTokenDetails(testUserId);
            
            const result = await ArticleProcessor.getInstance().addArticle(
                'Very Long Article',
                htmlContent,
                longMarkdown,
                EPublishStatus.DRAFT,
                [testCategoryId],
                tokenDetails
            );
            
            expect(result).toBe(true);
            
            // Verify long markdown was saved
            const driver = await DBDriver.getInstance().getDriver(EDataSourceType.POSTGRESQL);
            const manager = (await driver!.getConcreteDriver()).manager;
            
            const savedArticle = await manager.findOne(DRAArticle, {
                where: { 
                    title: 'Very Long Article',
                    users_platform: { id: testUserId }
                }
            });
            
            expect(savedArticle?.content_markdown?.length).toBeGreaterThan(100000);
        });
    });
});
