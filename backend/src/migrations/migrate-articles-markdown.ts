/**
 * Migration Script: Add Markdown to Existing Articles
 * 
 * This script converts existing HTML articles to markdown format.
 * It uses TurndownService to convert HTML to markdown.
 * 
 * Run with: npm run migrate:articles-markdown
 */

import { DBDriver } from '../drivers/DBDriver.js';
import { EDataSourceType } from '../types/EDataSourceType.js';
import { DRAArticle } from '../models/DRAArticle.js';
import TurndownService from 'turndown';

async function migrateArticlesToMarkdown() {
    console.log('🚀 Starting article markdown migration...');
    
    try {
        // Initialize database connection
        const driver = await DBDriver.getInstance().getDriver(EDataSourceType.POSTGRESQL);
        if (!driver) {
            throw new Error('Failed to get database driver');
        }
        
        const manager = (await driver.getConcreteDriver()).manager;
        
        // Initialize Turndown service for HTML to Markdown conversion
        const turndownService = new TurndownService({
            headingStyle: 'atx',          // Use # style for headings
            hr: '---',                     // Horizontal rule style
            bulletListMarker: '-',         // Use - for bullet lists
            codeBlockStyle: 'fenced',      // Use ``` for code blocks
            fence: '```',                  // Code fence marker
            emDelimiter: '*',              // Use * for emphasis
            strongDelimiter: '**',         // Use ** for strong
            linkStyle: 'inlined',          // Use [text](url) for links
            linkReferenceStyle: 'full',    // Link reference style
        });
        
        // Find all articles without markdown content
        const articlesWithoutMarkdown = await manager
            .createQueryBuilder(DRAArticle, 'article')
            .where('article.content_markdown IS NULL')
            .orWhere('article.content_markdown = :empty', { empty: '' })
            .getMany();
        
        console.log(`📊 Found ${articlesWithoutMarkdown.length} articles without markdown content`);
        
        if (articlesWithoutMarkdown.length === 0) {
            console.log('✅ All articles already have markdown content!');
            return;
        }
        
        let successCount = 0;
        let errorCount = 0;
        const errors: Array<{ articleId: number; title: string; error: string }> = [];
        
        // Process each article
        for (const article of articlesWithoutMarkdown) {
            try {
                console.log(`\n📝 Processing article ${article.id}: "${article.title}"`);
                
                // Convert HTML to markdown
                const markdown = turndownService.turndown(article.content || '');
                
                // Update article with markdown content
                await manager.update(DRAArticle, { id: article.id }, {
                    content_markdown: markdown
                });
                
                console.log(`   ✅ Converted ${article.content?.length || 0} chars HTML → ${markdown.length} chars Markdown`);
                successCount++;
                
            } catch (error) {
                console.error(`   ❌ Error processing article ${article.id}:`, error);
                errorCount++;
                errors.push({
                    articleId: article.id,
                    title: article.title,
                    error: error instanceof Error ? error.message : String(error)
                });
            }
        }
        
        // Print summary
        console.log('\n' + '='.repeat(60));
        console.log('📊 MIGRATION SUMMARY');
        console.log('='.repeat(60));
        console.log(`✅ Successfully converted: ${successCount} articles`);
        console.log(`❌ Failed conversions: ${errorCount} articles`);
        console.log(`📈 Total processed: ${articlesWithoutMarkdown.length} articles`);
        
        if (errors.length > 0) {
            console.log('\n❌ ERRORS:');
            errors.forEach(({ articleId, title, error }) => {
                console.log(`   Article ${articleId} "${title}": ${error}`);
            });
        }
        
        console.log('\n✨ Migration complete!');
        
    } catch (error) {
        console.error('❌ Migration failed:', error);
        throw error;
    }
}

// Run migration if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
    migrateArticlesToMarkdown()
        .then(() => {
            console.log('✅ Script finished successfully');
            process.exit(0);
        })
        .catch((error) => {
            console.error('❌ Script failed:', error);
            process.exit(1);
        });
}

export { migrateArticlesToMarkdown };
