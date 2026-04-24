# Sitemap Implementation

## Overview
Data Research Analysis platform provides dual-format sitemap support for optimal SEO and search engine discovery:
- **XML Sitemap**: Standard sitemap protocol with metadata (priority, lastmod, changefreq)
- **Text Sitemap**: Simple plain-text URL list for legacy compatibility

Both formats are dynamically generated from the `dra_sitemap_entries` database table and cached for 1 hour.

## Access URLs

### Production
- **XML**: https://www.dataresearchanalysis.com/sitemap.xml
- **TXT**: https://www.dataresearchanalysis.com/sitemap.txt
- **Backend XML**: https://api.dataresearchanalysis.com/sitemap.xml
- **Backend TXT**: https://api.dataresearchanalysis.com/sitemap.txt

### Development
- **XML**: http://localhost:3000/sitemap.xml (frontend) or http://localhost:3002/sitemap.xml (backend)
- **TXT**: http://localhost:3000/sitemap.txt (frontend) or http://localhost:3002/sitemap.txt (backend)

## Architecture

### Singleton Processor Pattern
Business logic lives in `SitemapProcessor` singleton. Routes are thin HTTP handlers.

```
┌─────────────────┐
│ Frontend Proxy  │  Nuxt server routes
│ /sitemap.xml    │  → Proxy to backend
│ /sitemap.txt    │
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│ Backend Routes  │  Express thin routes
│ /sitemap.xml    │  → Call processor methods
│ /sitemap.txt    │  → Set headers/status
└────────┬────────┘
         │
         ▼
┌─────────────────────────────┐
│ SitemapProcessor (Singleton)│
├─────────────────────────────┤
│ generateXmlSitemap()        │  Business logic
│ generateTextSitemap()       │  XML formatting
│ getPublishedSitemapEntries()│  Priority normalization
│ escapeXml()                 │  URL escaping
└─────────────────────────────┘
         │
         ▼
┌─────────────────┐
│ dra_sitemap_    │  PostgreSQL
│ entries table   │
└─────────────────┘
```

### Database Schema

**Table**: `dra_sitemap_entries`

| Column | Type | Description |
|--------|------|-------------|
| `id` | int | Primary key |
| `url` | varchar(2048) | Full URL to include in sitemap |
| `publish_status` | enum | `PUBLISHED` or `DRAFT` |
| `priority` | int | Priority 0-100 (normalized to 0.0-1.0 in XML) |
| `created_at` | timestamp | Creation timestamp |
| `updated_at` | timestamp | Last modification timestamp |
| `users_platform_id` | int | Foreign key to user who created entry |

## XML Sitemap Structure

### Field Mappings

| Database Field | XML Tag | Transformation |
|---------------|---------|----------------|
| `url` | `<loc>` | XML-escaped (`&`, `<`, `>`, `"`, `'`) |
| `updated_at` | `<lastmod>` | ISO 8601 format (`YYYY-MM-DDTHH:MM:SS.sssZ`) |
| `priority` | `<priority>` | Normalized: `priority / 100` (0-100 → 0.0-1.0) |
| Static value | `<changefreq>` | Always `"weekly"` |

### Example XML Output

```xml
<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  <url>
    <loc>https://www.dataresearchanalysis.com/</loc>
    <lastmod>2026-04-24T10:30:00.000Z</lastmod>
    <changefreq>weekly</changefreq>
    <priority>1.0</priority>
  </url>
  <url>
    <loc>https://www.dataresearchanalysis.com/features</loc>
    <lastmod>2026-04-20T15:45:00.000Z</lastmod>
    <changefreq>weekly</changefreq>
    <priority>0.8</priority>
  </url>
</urlset>
```

## Text Sitemap Structure

Simple newline-delimited URL list:

```
https://www.dataresearchanalysis.com/
https://www.dataresearchanalysis.com/features
https://www.dataresearchanalysis.com/pricing
```

## Backend Implementation

### Files

#### Processor
- **Path**: `backend/src/processors/SitemapProcessor.ts`
- **Methods**:
  - `generateXmlSitemap(): Promise<string>` — Generate XML format
  - `generateTextSitemap(): Promise<string>` — Generate text format
  - `getPublishedSitemapEntries(): Promise<ISitemapEntry[]>` — Fetch published entries
  - `escapeXml(str: string): string` — Sanitize URLs for XML

#### Routes
- **TXT Route**: `backend/src/routes/sitemap.ts`
  - Mount: `/sitemap.txt`
  - Handler: `GET /` → calls `processor.generateTextSitemap()`
  
- **XML Route**: `backend/src/routes/sitemap-xml.ts`
  - Mount: `/sitemap.xml`
  - Handler: `GET /` → calls `processor.generateXmlSitemap()`

#### Mount Points
- **File**: `backend/src/index.ts`
- **Imports**:
  ```typescript
  import sitemap from './routes/sitemap.js';
  import sitemapXml from './routes/sitemap-xml.js';
  ```
- **Mounts**:
  ```typescript
  app.use('/sitemap.txt', sitemap);
  app.use('/sitemap.xml', sitemapXml);
  ```

## Frontend Implementation

### Proxy Routes
Frontend Nuxt server routes proxy backend sitemaps to serve from `www.dataresearchanalysis.com` domain.

#### Files
- **TXT Proxy**: `frontend/server/routes/sitemap.txt.get.ts`
- **XML Proxy**: `frontend/server/routes/sitemap.xml.get.ts`

Both proxies:
1. Fetch from backend `${apiBase}/sitemap.[xml|txt]`
2. Set proper content-type headers
3. Add 1-hour cache control
4. Return 503 on backend failure

## Caching Strategy

- **Duration**: 1 hour (`max-age=3600`)
- **Type**: Public cache (CDN-friendly)
- **Headers**: Set on both backend routes and frontend proxies
- **Invalidation**: Automatic after 1 hour; no manual cache busting needed

## Admin Management

### Adding URLs to Sitemap

1. Navigate to Admin Panel: `/admin`
2. Click "Add Sitemap URL" or go to `/admin/sitemap`
3. Enter URL, priority (0-100), and publish status
4. Click "Save"
5. URL appears in sitemap within 1 hour (after cache expires)

### Priority Guidelines

| Priority | Use Case | Example URLs |
|----------|----------|--------------|
| 100 | Homepage, critical pages | `/`, `/features`, `/pricing` |
| 80 | Important content | `/blog`, `/docs`, `/about` |
| 50 | Standard pages | Blog posts, articles |
| 30 | Low priority | Archive pages, old content |
| 0 | Included but minimal importance | Legal pages |

**Note**: Priority is normalized in XML sitemap (100 → 1.0, 50 → 0.5, etc.)

## Search Engine Submission

### Google Search Console
1. Go to https://search.google.com/search-console
2. Select your property
3. Navigate to "Sitemaps" in left menu
4. Enter: `sitemap.xml`
5. Click "Submit"

### Bing Webmaster Tools
1. Go to https://www.bing.com/webmasters
2. Select your site
3. Navigate to "Sitemaps"
4. Enter: `https://www.dataresearchanalysis.com/sitemap.xml`
5. Click "Submit"

### robots.txt Reference
Both sitemaps are listed in `/robots.txt`:
```
Sitemap: https://www.dataresearchanalysis.com/sitemap.xml
Sitemap: https://www.dataresearchanalysis.com/sitemap.txt
```

## Testing

### Backend Testing
```bash
# Text sitemap
curl http://localhost:3002/sitemap.txt

# XML sitemap
curl http://localhost:3002/sitemap.xml

# Verify headers
curl -I http://localhost:3002/sitemap.xml
```

### Frontend Testing
```bash
# Text sitemap (proxied)
curl http://localhost:3000/sitemap.txt

# XML sitemap (proxied)
curl http://localhost:3000/sitemap.xml
```

### XML Validation
- **Online Validator**: https://www.xml-sitemaps.com/validate-xml-sitemap.html
- **Google Validator**: Submit via Google Search Console and check for errors

### Expected Headers
```
Content-Type: application/xml; charset=utf-8  (XML)
Content-Type: text/plain; charset=utf-8       (TXT)
Cache-Control: public, max-age=3600
```

## Security Considerations

### XML Injection Prevention
All URLs are escaped using `escapeXml()` helper:
- `&` → `&amp;`
- `<` → `&lt;`
- `>` → `&gt;`
- `"` → `&quot;`
- `'` → `&apos;`

This prevents malicious URLs from breaking XML structure or injecting content.

### Access Control
- **Public Routes**: Both sitemaps are publicly accessible (no authentication)
- **Admin CRUD**: Creating/editing entries requires admin authentication
- **Publish Status**: Only `PUBLISHED` entries appear in sitemaps (drafts are hidden)

## Future Enhancements

### Not Implemented (Potential Future Work)
- ✓ Sitemap index file (for >50,000 URLs)
- ✓ Automatic regeneration triggers (on publish/unpublish)
- ✓ Configurable `changefreq` per entry
- ✓ Image/video sitemap support
- ✓ News sitemap for blog posts
- ✓ Automatic ping to search engines on update
- ✓ Gzip compression for large sitemaps
- ✓ Sitemap analytics (crawl stats tracking)

## Troubleshooting

### Sitemap Not Updating
- **Issue**: Changes not reflected in sitemap
- **Cause**: 1-hour cache
- **Solution**: Wait up to 1 hour, or manually clear CDN cache

### XML Validation Errors
- **Issue**: Invalid XML structure
- **Cause**: Unescaped special characters in URLs
- **Solution**: Verify `escapeXml()` is applied to all `<loc>` values

### 503 Error on Frontend
- **Issue**: Frontend proxy returns 503
- **Cause**: Backend is down or unreachable
- **Solution**: Check backend health, verify `NUXT_API_URL` env variable

### Empty Sitemap
- **Issue**: Sitemap contains no URLs
- **Cause**: No entries with `publish_status = PUBLISHED`
- **Solution**: Publish sitemap entries via admin panel

## Related Files

### Backend
- Models: `backend/src/models/DRASitemapEntry.ts`
- Types: `backend/src/types/ISitemapEntry.ts`, `backend/src/types/EPublishStatus.ts`
- Processor: `backend/src/processors/SitemapProcessor.ts`
- Routes: `backend/src/routes/sitemap.ts`, `backend/src/routes/sitemap-xml.ts`
- Admin Routes: `backend/src/routes/admin/sitemap.ts`

### Frontend
- Proxies: `frontend/server/routes/sitemap.txt.get.ts`, `frontend/server/routes/sitemap.xml.get.ts`
- Store: `frontend/stores/sitemap.ts`
- Admin UI: `frontend/pages/admin/sitemap/`, `frontend/pages/admin/sitemap/[entryid]/`

### Configuration
- robots.txt: `frontend/public/robots.txt`
- Database Schema: `documentation/database/database-schema.dbml`
