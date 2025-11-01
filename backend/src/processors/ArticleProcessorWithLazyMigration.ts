/**
 * Lazy Migration Utility: HTML to Markdown Conversion
 * 
 * This utility provides lazy markdown conversion for existing articles.
 * Articles are converted from HTML to markdown on first edit if markdown is missing.
 * 
 * This approach avoids bulk migration and converts articles as needed.
 */

import { ITokenDetails } from '../types/ITokenDetails.js';
import { DBDriver } from '../drivers/DBDriver.js';
import { EDataSourceType } from '../types/EDataSourceType.js';
import { DRAArticle } from '../models/DRAArticle.js';

/**
 * Simple HTML to Markdown converter (basic implementation)
 * For production, consider using a library like Turndown
 */
class SimpleHTMLToMarkdown {
    convert(html: string): string {
        let markdown = html;
        
        // Remove extra whitespace
        markdown = markdown.trim();
        
        // Convert headings
        markdown = markdown.replace(/<h1[^>]*>(.*?)<\/h1>/gi, '# $1\n\n');
        markdown = markdown.replace(/<h2[^>]*>(.*?)<\/h2>/gi, '## $1\n\n');
        markdown = markdown.replace(/<h3[^>]*>(.*?)<\/h3>/gi, '### $1\n\n');
        markdown = markdown.replace(/<h4[^>]*>(.*?)<\/h4>/gi, '#### $1\n\n');
        markdown = markdown.replace(/<h5[^>]*>(.*?)<\/h5>/gi, '##### $1\n\n');
        markdown = markdown.replace(/<h6[^>]*>(.*?)<\/h6>/gi, '###### $1\n\n');
        
        // Convert strong/bold
        markdown = markdown.replace(/<strong[^>]*>(.*?)<\/strong>/gi, '**$1**');
        markdown = markdown.replace(/<b[^>]*>(.*?)<\/b>/gi, '**$1**');
        
        // Convert emphasis/italic
        markdown = markdown.replace(/<em[^>]*>(.*?)<\/em>/gi, '*$1*');
        markdown = markdown.replace(/<i[^>]*>(.*?)<\/i>/gi, '*$1*');
        
        // Convert links
        markdown = markdown.replace(/<a[^>]*href=["']([^"']*)["'][^>]*>(.*?)<\/a>/gi, '[$2]($1)');
        
        // Convert images
        markdown = markdown.replace(/<img[^>]*src=["']([^"']*)["'][^>]*alt=["']([^"']*)["'][^>]*>/gi, '![$2]($1)');
        markdown = markdown.replace(/<img[^>]*src=["']([^"']*)["'][^>]*>/gi, '![]($1)');
        
        // Convert code
        markdown = markdown.replace(/<code[^>]*>(.*?)<\/code>/gi, '`$1`');
        
        // Convert blockquotes
        markdown = markdown.replace(/<blockquote[^>]*>(.*?)<\/blockquote>/gi, (match, content) => {
            return content.split('\n').map((line: string) => `> ${line.trim()}`).join('\n') + '\n\n';
        });
        
        // Convert unordered lists
        markdown = markdown.replace(/<ul[^>]*>(.*?)<\/ul>/gis, (match, content) => {
            let listItems = content.match(/<li[^>]*>(.*?)<\/li>/gi) || [];
            return listItems.map((item: string) => {
                const text = item.replace(/<\/?li[^>]*>/gi, '').trim();
                return `- ${text}`;
            }).join('\n') + '\n\n';
        });
        
        // Convert ordered lists
        markdown = markdown.replace(/<ol[^>]*>(.*?)<\/ol>/gis, (match, content) => {
            let listItems = content.match(/<li[^>]*>(.*?)<\/li>/gi) || [];
            return listItems.map((item: string, index: number) => {
                const text = item.replace(/<\/?li[^>]*>/gi, '').trim();
                return `${index + 1}. ${text}`;
            }).join('\n') + '\n\n';
        });
        
        // Convert paragraphs
        markdown = markdown.replace(/<p[^>]*>(.*?)<\/p>/gi, '$1\n\n');
        
        // Convert line breaks
        markdown = markdown.replace(/<br\s*\/?>/gi, '\n');
        
        // Remove remaining HTML tags
        markdown = markdown.replace(/<[^>]*>/g, '');
        
        // Decode HTML entities
        markdown = markdown.replace(/&amp;/g, '&');
        markdown = markdown.replace(/&lt;/g, '<');
        markdown = markdown.replace(/&gt;/g, '>');
        markdown = markdown.replace(/&quot;/g, '"');
        markdown = markdown.replace(/&#39;/g, "'");
        markdown = markdown.replace(/&nbsp;/g, ' ');
        
        // Clean up extra newlines
        markdown = markdown.replace(/\n{3,}/g, '\n\n');
        
        return markdown.trim();
    }
}

/**
 * Article Migration Utility
 */
export class ArticleMigrationUtility {
    private static instance: ArticleMigrationUtility;
    private htmlToMarkdown = new SimpleHTMLToMarkdown();
    
    private constructor() {}
    
    public static getInstance(): ArticleMigrationUtility {
        if (!ArticleMigrationUtility.instance) {
            ArticleMigrationUtility.instance = new ArticleMigrationUtility();
        }
        return ArticleMigrationUtility.instance;
    }
    
    /**
     * Convert HTML content to markdown
     */
    convertHTMLToMarkdown(html: string): string {
        return this.htmlToMarkdown.convert(html);
    }
    
    /**
     * Check if article needs markdown migration
     */
    async articleNeedsMigration(articleId: number): Promise<boolean> {
        const { user_id } = tokenDetails;
        const driver = await DBDriver.getInstance().getDriver(EDataSourceType.POSTGRESQL);
        
        if (!driver) {
            return false;
        }
        
        const manager = (await driver.getConcreteDriver()).manager;
        const article = await manager.findOne(DRAArticle, { 
            where: { 
                id: articleId,
                users_platform: { id: user_id }
            } 
        });
        
        if (!article) {
            return false;
        }
        
        // Convert HTML to markdown
        const markdown = this.htmlToMarkdown.convert(article.content);
        
        // Update article with markdown
        await manager.update(DRAArticle, { id: articleId }, {
            content_markdown: markdown
        });
        
        console.log(`✅ Article ${articleId} converted: ${article.content?.length || 0} chars HTML → ${markdown.length} chars Markdown`);
        
        return true;
    }
    
    /**
     * Batch convert all articles without markdown
     */
    async convertAllArticlesWithoutMarkdown(tokenDetails: ITokenDetails): Promise<{
        total: number;
        converted: number;
        failed: number;
    }> {
        const { user_id } = tokenDetails;
        const driver = await DBDriver.getInstance().getDriver(EDataSourceType.POSTGRESQL);
        
        if (!driver) {
            return { total: 0, converted: 0, failed: 0 };
        }
        
        const manager = (await driver.getConcreteDriver()).manager;
        
        // Find all articles without markdown for this user
        const articles = await manager
            .createQueryBuilder(DRAArticle, 'article')
            .where('article.users_platform_id = :userId', { userId: user_id })
            .andWhere('(article.content_markdown IS NULL OR article.content_markdown = :empty)', { empty: '' })
            .getMany();
        
        let converted = 0;
        let failed = 0;
        
        for (const article of articles) {
            try {
                const markdown = this.htmlToMarkdown.convert(article.content);
                await manager.update(DRAArticle, { id: article.id }, {
                    content_markdown: markdown
                });
                converted++;
                console.log(`✅ Converted article ${article.id}: "${article.title}"`);
            } catch (error) {
                failed++;
                console.error(`❌ Failed to convert article ${article.id}:`, error);
            }
        }
        
        return {
            total: articles.length,
            converted,
            failed
        };
    }
}
