# Phase 7: Migration Strategy for Existing Articles

## Overview

This phase provides strategies for converting existing articles (that only have HTML content) to include markdown format. Two approaches are available:

1. **Lazy Migration** (Recommended) - Convert articles on-demand when they're edited
2. **Bulk Migration** - Convert all articles at once using a migration script

---

## Strategy 1: Lazy Migration (Recommended)

### **Benefits:**
- ✅ No downtime required
- ✅ Gradual migration as articles are edited
- ✅ No risk of mass data corruption
- ✅ Articles that are never edited don't use resources
- ✅ Zero impact on production

### **Implementation:**

#### File: `/backend/src/utilities/ArticleMigrationUtility.ts`

**Features:**
1. **HTML to Markdown Converter** - Simple built-in converter
2. **Single Article Migration** - Convert one article at a time
3. **Batch Migration** - Convert all articles for a user
4. **Migration Status** - Check migration progress

**Usage Example:**

```typescript
import { ArticleMigrationUtility } from '../utilities/ArticleMigrationUtility.js';

// Convert single article
const util = ArticleMigrationUtility.getInstance();
await util.convertArticleToMarkdown(articleId, tokenDetails);

// Check migration status
const status = await util.getMigrationStatus();
console.log(`Migration Progress: ${status.migrationProgress}%`);
console.log(`With Markdown: ${status.withMarkdown}`);
console.log(`Without Markdown: ${status.withoutMarkdown}`);
```

### **Integration with Edit Flow:**

When a user edits an existing article without markdown:

```typescript
// In ArticleProcessor.editArticle()
if (!contentMarkdown && article.content && !article.content_markdown) {
    // Lazy migration: convert HTML to markdown
    const migrationUtil = ArticleMigrationUtility.getInstance();
    contentMarkdown = migrationUtil.convertHTMLToMarkdown(article.content);
    console.log('✅ Lazy migration: Converted HTML to markdown on edit');
}
```

This happens transparently - the user doesn't even know migration occurred.

---

## Strategy 2: Bulk Migration

### **Benefits:**
- ✅ Migrate all articles at once
- ✅ Complete control over timing
- ✅ Can be run during maintenance window
- ✅ Progress tracking and error reporting

### **Risks:**
- ⚠️ Requires downtime or careful coordination
- ⚠️ Large databases may take significant time
- ⚠️ Potential for data issues if conversion fails

### **Implementation:**

#### File: `/backend/src/migrations/migrate-articles-markdown.ts`

**Features:**
1. **Batch Processing** - Handles large numbers of articles
2. **Error Handling** - Continues even if individual conversions fail
3. **Progress Reporting** - Shows detailed progress
4. **Summary Statistics** - Reports success/failure counts

**Usage:**

```bash
# Using npm script (add to package.json)
npm run migrate:articles-markdown

# Or directly with tsx
npx tsx src/migrations/migrate-articles-markdown.ts
```

**Expected Output:**

```
🚀 Starting article markdown migration...
📊 Found 150 articles without markdown content

📝 Processing article 1: "Getting Started Guide"
   ✅ Converted 5234 chars HTML → 4891 chars Markdown

📝 Processing article 2: "Advanced Features"
   ✅ Converted 8123 chars HTML → 7654 chars Markdown

...

============================================================
📊 MIGRATION SUMMARY
============================================================
✅ Successfully converted: 148 articles
❌ Failed conversions: 2 articles
📈 Total processed: 150 articles

✨ Migration complete!
```

---

## HTML to Markdown Conversion

### **Supported HTML Elements:**

| HTML | Markdown | Status |
|------|----------|--------|
| `<h1>` - `<h6>` | `#` - `######` | ✅ |
| `<strong>`, `<b>` | `**bold**` | ✅ |
| `<em>`, `<i>` | `*italic*` | ✅ |
| `<a href="">` | `[text](url)` | ✅ |
| `<img src="">` | `![alt](url)` | ✅ |
| `<code>` | `` `code` `` | ✅ |
| `<blockquote>` | `> quote` | ✅ |
| `<ul><li>` | `- item` | ✅ |
| `<ol><li>` | `1. item` | ✅ |
| `<p>` | Plain text + newlines | ✅ |
| `<br>` | Newline | ✅ |

### **HTML Entities:**

| Entity | Converted To |
|--------|--------------|
| `&amp;` | `&` |
| `&lt;` | `<` |
| `&gt;` | `>` |
| `&quot;` | `"` |
| `&#39;` | `'` |
| `&nbsp;` | Space |

### **Limitations:**

- ⚠️ **Tables**: Not converted (requires table extension)
- ⚠️ **Nested Lists**: Limited to 2-3 levels
- ⚠️ **Custom HTML**: May not convert perfectly
- ⚠️ **Complex Styling**: CSS classes and inline styles are removed

### **For Better Conversion:**

Consider installing `turndown` library for production:

```bash
cd backend
npm install turndown
npm install --save-dev @types/turndown
```

Then update `migrate-articles-markdown.ts` to use Turndown instead of SimpleHTMLToMarkdown.

---

## Migration Monitoring

### **Check Migration Status:**

```typescript
import { ArticleMigrationUtility } from './utilities/ArticleMigrationUtility.js';

const util = ArticleMigrationUtility.getInstance();
const status = await util.getMigrationStatus();

console.log(`Total Articles: ${status.totalArticles}`);
console.log(`With Markdown: ${status.withMarkdown}`);
console.log(`Without Markdown: ${status.withoutMarkdown}`);
console.log(`Progress: ${status.migrationProgress}%`);
```

### **Database Query:**

```sql
-- Count articles with markdown
SELECT COUNT(*) as with_markdown
FROM dra_articles
WHERE content_markdown IS NOT NULL AND content_markdown != '';

-- Count articles without markdown
SELECT COUNT(*) as without_markdown
FROM dra_articles
WHERE content_markdown IS NULL OR content_markdown = '';

-- Migration progress percentage
SELECT 
    COUNT(*) as total,
    SUM(CASE WHEN content_markdown IS NOT NULL AND content_markdown != '' THEN 1 ELSE 0 END) as with_markdown,
    ROUND(100.0 * SUM(CASE WHEN content_markdown IS NOT NULL AND content_markdown != '' THEN 1 ELSE 0 END) / COUNT(*), 2) as progress_percent
FROM dra_articles;
```

---

## Recommended Approach

### **For New Deployments:**
✅ Use **Lazy Migration** - Zero disruption, gradual conversion

### **For Existing Systems with Many Articles:**
1. Start with **Lazy Migration** enabled
2. Monitor migration progress over 2-4 weeks
3. If progress is slow, run **Bulk Migration** during maintenance window
4. Keep lazy migration enabled for any remaining articles

### **Implementation Steps:**

1. **Deploy Code Changes** ✅ (Already done in Phases 1-4)
   - Database schema updated
   - Frontend ready
   - Backend ready

2. **Enable Lazy Migration** (Optional Enhancement)
   - Modify `ArticleProcessor.editArticle()` to check for missing markdown
   - Automatically convert on first edit

3. **Monitor Progress**
   - Track conversion statistics
   - Review any conversion errors
   - Validate markdown quality

4. **Optional: Run Bulk Migration**
   - Choose low-traffic time
   - Run migration script
   - Verify all articles converted

---

## Testing Migration

### **Test Single Article:**

```typescript
// Get an article without markdown
const article = await manager.findOne(DRAArticle, {
    where: { 
        content_markdown: IsNull() // or equals ''
    }
});

// Convert it
const util = ArticleMigrationUtility.getInstance();
const success = await util.convertArticleToMarkdown(article.id, tokenDetails);

// Verify
const updated = await manager.findOne(DRAArticle, { 
    where: { id: article.id } 
});
console.log('Original HTML length:', article.content.length);
console.log('Converted Markdown length:', updated.content_markdown.length);
console.log('Markdown preview:', updated.content_markdown.substring(0, 200));
```

### **Test Conversion Quality:**

1. Pick a complex article with:
   - Multiple heading levels
   - Bold and italic text
   - Lists (ordered and unordered)
   - Links and images
   - Blockquotes
   - Code snippets

2. Convert it
3. Open for editing
4. Verify formatting is preserved
5. Make small edit and save
6. Check public view still renders correctly

---

## Rollback Strategy

If migration causes issues:

1. **Individual Article:**
   ```sql
   UPDATE dra_articles
   SET content_markdown = NULL
   WHERE id = <article_id>;
   ```

2. **All Articles:**
   ```sql
   UPDATE dra_articles
   SET content_markdown = NULL;
   ```

3. **Re-migrate:**
   - Fix conversion issues
   - Run migration again
   - Articles with `content_markdown = NULL` will be re-converted

---

## Performance Considerations

### **Lazy Migration:**
- Near-zero performance impact
- Conversion happens once per article
- < 100ms per article typically

### **Bulk Migration:**
- CPU: Moderate (regex processing)
- Memory: Low (processes one article at a time)
- Database: Moderate (many UPDATE queries)
- Time: ~50-100 articles per second

**For 1000 articles:**
- Estimated time: 10-20 seconds
- Database load: Acceptable
- Recommended: Run during low-traffic period

**For 10,000+ articles:**
- Consider batching (100-500 at a time)
- Add progress checkpoints
- Monitor database connection pool

---

## Troubleshooting

### **Issue: Markdown looks wrong**
**Solution:** Check HTML source for non-standard tags or complex nesting

### **Issue: Images not converting**
**Solution:** Verify image URLs use standard `<img src="">` format

### **Issue: Lists not formatted correctly**
**Solution:** Ensure HTML lists use proper `<ul>/<ol>` and `<li>` tags

### **Issue: Special characters corrupted**
**Solution:** Check database character encoding (should be UTF-8)

### **Issue: Conversion takes too long**
**Solution:** Process in smaller batches, add pagination to bulk migration

---

## Success Criteria

✅ All articles have `content_markdown` field populated
✅ Markdown faithfully represents original HTML content
✅ Articles can be edited and re-saved without data loss
✅ Public article view continues to display correctly
✅ No performance degradation

---

## Phase 7 Status

- ✅ Lazy migration utility created
- ✅ Bulk migration script created
- ✅ HTML to Markdown converter implemented
- ✅ Migration monitoring tools ready
- ✅ Documentation complete
- ⏳ Ready for deployment

**Next Steps:** Choose migration strategy and begin monitoring existing articles.
