# Google Analytics Troubleshooting Guide

**Solutions for Common GA4 Integration Issues**

---

## Table of Contents

1. [Quick Diagnostics](#quick-diagnostics)
2. [OAuth & Authentication Issues](#oauth--authentication-issues)
3. [Connection Problems](#connection-problems)
4. [Sync Failures](#sync-failures)
5. [Data Quality Issues](#data-quality-issues)
6. [Query Problems](#query-problems)
7. [Performance Issues](#performance-issues)
8. [API Error Reference](#api-error-reference)
9. [Known Limitations](#known-limitations)
10. [Diagnostic Tools](#diagnostic-tools)
11. [Getting Support](#getting-support)

---

## Quick Diagnostics

### Checklist for Common Issues

Before deep troubleshooting, verify these basics:

- [ ] **OAuth Token Valid:** Access token not expired (< 1 hour old)
- [ ] **Refresh Token Available:** Long-lived refresh token stored
- [ ] **Property Access:** Google account has Read & Analyze permissions
- [ ] **Property ID Correct:** Valid GA4 property ID (numeric)
- [ ] **JWT Token Valid:** Platform authentication token not expired
- [ ] **Network Connectivity:** Can reach both platform API and Google APIs
- [ ] **Sync Frequency Valid:** One of: manual, hourly, daily, weekly
- [ ] **GA4 API Quota:** Not exceeded daily limit (15,000 requests)
- [ ] **Database Connection:** PostgreSQL accessible
- [ ] **Schema Exists:** `dra_google_analytics` schema created

### Quick Health Check Query

Run this SQL query to check data source health:

```sql
SELECT 
  id,
  name,
  connection_details->>'property_id' as property_id,
  sync_frequency,
  last_sync,
  CASE 
    WHEN last_sync IS NULL THEN 'Never synced'
    WHEN last_sync < NOW() - INTERVAL '2 days' THEN 'Stale (>2 days)'
    WHEN last_sync < NOW() - INTERVAL '1 day' THEN 'Aging (>1 day)'
    ELSE 'Fresh'
  END as sync_health
FROM dra_data_sources
WHERE type = 'google_analytics'
ORDER BY last_sync DESC NULLS LAST;
```

---

## OAuth & Authentication Issues

### Issue 1: "OAuth token expired or invalid"

**Symptoms:**
- API calls return 401 Unauthorized
- Error message: "Token has been expired or revoked"
- Cannot list properties or trigger syncs

**Causes:**
- Access token expired (after 1 hour)
- Refresh token revoked
- User revoked access in Google Account settings
- OAuth credentials invalid

**Solutions:**

**Solution A: Token Refresh (Most Common)**

The platform automatically refreshes tokens before sync operations, but manual intervention may be needed:

```javascript
// Manual token refresh
const refreshAccessToken = async (refreshToken) => {
  const response = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      refresh_token: refreshToken,
      client_id: YOUR_CLIENT_ID,
      client_secret: YOUR_CLIENT_SECRET,
      grant_type: 'refresh_token'
    })
  });

  const { access_token, expires_in } = await response.json();
  
  // Update data source with new access token
  await updateDataSourceTokens(dataSourceId, access_token);
  
  return access_token;
};
```

**Solution B: Reconnect Data Source**

If refresh token is revoked:

1. Navigate to Data Sources page
2. Find the GA4 data source
3. Click "Reconnect" or "Re-authenticate"
4. Complete Google OAuth flow again
5. Grant permissions

**Solution C: Check Token Storage**

Verify tokens are stored correctly in database:

```sql
SELECT 
  id,
  name,
  connection_details->>'access_token' as has_access_token,
  connection_details->>'refresh_token' as has_refresh_token,
  LENGTH(connection_details->>'access_token') as access_token_length,
  LENGTH(connection_details->>'refresh_token') as refresh_token_length
FROM dra_data_sources
WHERE type = 'google_analytics' AND id = 58;
```

Expected: Both tokens should be present with length > 100 characters

**Prevention:**
- Implement proactive token refresh (< 55 minutes)
- Handle 401 errors with automatic token refresh
- Monitor token expiry times
- Store refresh tokens securely

---

### Issue 2: "Insufficient permissions"

**Symptoms:**
- Can authenticate but cannot access properties
- Error: "You do not have access to this property"
- Properties list empty

**Causes:**
- Google account lacks GA4 property permissions
- Wrong Google account used for OAuth
- Property shared with different email
- OAuth scope not granted

**Solutions:**

**Solution A: Verify GA4 Permissions**

1. Log into [Google Analytics](https://analytics.google.com/)
2. Navigate to Admin → Property Access Management
3. Verify your email has "Viewer" or "Analyst" role (minimum)
4. If missing, request access from property administrator

**Solution B: Re-authenticate with Correct Account**

```javascript
// Force account selection in OAuth flow
const authUrl = `https://accounts.google.com/o/oauth2/v2/auth?` +
  `client_id=${CLIENT_ID}&` +
  `redirect_uri=${REDIRECT_URI}&` +
  `response_type=code&` +
  `scope=https://www.googleapis.com/auth/analytics.readonly&` +
  `access_type=offline&` +
  `prompt=select_account`;  // Force account selection

window.location.href = authUrl;
```

**Solution C: Check OAuth Scope**

Verify the correct scope is requested:

Required scope: `https://www.googleapis.com/auth/analytics.readonly`

**Solution D: Property Sharing**

If property is in a different organization:

1. GA4 Admin → Property Settings → Property Access Management
2. Add your email with appropriate role
3. Wait a few minutes for permissions to propagate
4. Re-authenticate

**Prevention:**
- Document which Google account has property access
- Use service accounts for production integrations
- Implement permission checks before data source creation

---

### Issue 3: "Invalid OAuth client credentials"

**Symptoms:**
- OAuth flow fails immediately
- Error: "invalid_client"
- Cannot initiate authentication

**Causes:**
- Incorrect client ID or client secret
- OAuth credentials not enabled
- Redirect URI mismatch
- API not enabled in Google Cloud Console

**Solutions:**

**Solution A: Verify OAuth Credentials**

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Select your project
3. Navigate to APIs & Services → Credentials
4. Find your OAuth 2.0 Client ID
5. Verify:
   - Client ID matches environment variable
   - Client secret matches environment variable
   - Redirect URIs include your callback URL

**Solution B: Enable Google Analytics API**

1. Google Cloud Console → APIs & Services → Library
2. Search for "Google Analytics Data API"
3. Click "Enable"
4. Wait 1-2 minutes for propagation

**Solution C: Check Redirect URI**

Common mismatch issues:

```javascript
// ❌ Wrong - protocol mismatch
// Configured: http://localhost:3000/auth/callback
// Used: https://localhost:3000/auth/callback

// ✅ Correct - exact match
// Configured: https://your-domain.com/auth/google/callback
// Used: https://your-domain.com/auth/google/callback
```

**Solution D: Environment Variables**

Verify configuration:

```bash
# Check environment variables
echo $GOOGLE_OAUTH_CLIENT_ID
echo $GOOGLE_OAUTH_CLIENT_SECRET
echo $GOOGLE_OAUTH_REDIRECT_URI

# Should output valid values
```

**Prevention:**
- Store credentials in secure environment variables
- Document OAuth setup process
- Test OAuth flow in staging before production
- Use different OAuth clients for dev/staging/prod

---

## Connection Problems

### Issue 4: "Cannot find property ID"

**Symptoms:**
- Property ID invalid error
- Empty properties list
- "Property not found" error

**Causes:**
- Wrong property ID format (using measurement ID instead)
- Property deleted
- Universal Analytics property (GA3) instead of GA4
- Account access revoked

**Solutions:**

**Solution A: Find Correct Property ID**

GA4 Property ID is numeric (e.g., "123456789"), not the measurement ID (G-XXXXXXXXXX)

1. Log into [Google Analytics](https://analytics.google.com/)
2. Click Admin (bottom left)
3. Under Property column, click "Property Settings"
4. Find "Property ID" (numeric value)

**Solution B: Verify GA4 vs Universal Analytics**

```javascript
// GA4 Property ID: Numeric
const ga4PropertyId = "123456789";  // ✅ Correct

// NOT measurement ID or tracking ID
const wrongId1 = "G-ABC123XYZ";     // ❌ Measurement ID
const wrongId2 = "UA-123456-1";     // ❌ UA Tracking ID
```

**Solution C: List Available Properties**

Use API to see what properties are accessible:

```javascript
const response = await fetch(
  'https://your-domain.com/api/google-analytics/properties',
  {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${jwtToken}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ access_token: oauthAccessToken })
  }
);

const { properties } = await response.json();
console.log('Available properties:', properties);
```

**Prevention:**
- Use property selection UI (not manual entry)
- Validate property ID format (numeric only)
- Store property display name alongside ID
- Document property IDs in team wiki

---

### Issue 5: "Database connection failed"

**Symptoms:**
- Sync fails with database error
- "Cannot create schema" error
- "Relation does not exist" error

**Causes:**
- PostgreSQL connection lost
- Insufficient database permissions
- Schema not created
- Table name conflicts

**Solutions:**

**Solution A: Verify Database Connection**

```sql
-- Check PostgreSQL connectivity
SELECT version();

-- Check schema exists
SELECT schema_name 
FROM information_schema.schemata 
WHERE schema_name = 'dra_google_analytics';

-- If schema missing, create it
CREATE SCHEMA IF NOT EXISTS dra_google_analytics;
```

**Solution B: Check Database Permissions**

```sql
-- Verify user has schema creation privileges
SELECT 
  has_schema_privilege('dra_google_analytics', 'CREATE') as can_create,
  has_schema_privilege('dra_google_analytics', 'USAGE') as can_use;

-- Grant necessary permissions
GRANT CREATE, USAGE ON SCHEMA dra_google_analytics TO your_db_user;
```

**Solution C: Check Connection Pool**

```javascript
// If using connection pooling, verify pool size
const pool = new Pool({
  host: process.env.DB_HOST,
  port: process.env.DB_PORT,
  database: process.env.DB_NAME,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  max: 20,  // Increase if needed
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 5000,
});

// Test connection
try {
  await pool.query('SELECT NOW()');
  console.log('Database connection OK');
} catch (error) {
  console.error('Database connection failed:', error);
}
```

**Prevention:**
- Monitor database connection health
- Implement connection retry logic
- Set appropriate connection pool limits
- Log database errors for debugging

---

## Sync Failures

### Issue 6: "Sync fails with timeout"

**Symptoms:**
- Sync starts but never completes
- Timeout error after 5-10 minutes
- Status stuck at "in_progress"

**Causes:**
- Large dataset (millions of rows)
- GA4 API rate limiting
- Network connectivity issues
- Database write bottleneck

**Solutions:**

**Solution A: Reduce Date Range**

Modify sync to use smaller date ranges:

```javascript
// Instead of 30 days, sync in weekly chunks
const syncInChunks = async (dataSourceId, startDate, endDate) => {
  const chunks = [];
  let current = new Date(startDate);
  const end = new Date(endDate);

  while (current < end) {
    const chunkEnd = new Date(current);
    chunkEnd.setDate(chunkEnd.getDate() + 7);
    chunks.push({
      start: current.toISOString().split('T')[0],
      end: chunkEnd.toISOString().split('T')[0]
    });
    current = chunkEnd;
  }

  for (const chunk of chunks) {
    await syncDateRange(dataSourceId, chunk.start, chunk.end);
    await new Promise(resolve => setTimeout(resolve, 5000)); // Pause between chunks
  }
};
```

**Solution B: Increase Timeout Settings**

```javascript
// Adjust timeout for sync operations
const syncConfig = {
  timeout: 600000,  // 10 minutes
  retries: 3,
  retryDelay: 30000
};
```

**Solution C: Check Database Performance**

```sql
-- Find slow running queries
SELECT 
  pid,
  now() - query_start as duration,
  query,
  state
FROM pg_stat_activity
WHERE state != 'idle'
  AND query LIKE '%google_analytics%'
ORDER BY duration DESC;

-- Kill stuck queries if necessary
SELECT pg_terminate_backend(pid) 
FROM pg_stat_activity 
WHERE state = 'active' 
  AND query LIKE '%google_analytics%'
  AND now() - query_start > interval '10 minutes';
```

**Prevention:**
- Implement incremental syncs (only new data)
- Use batched inserts for better performance
- Monitor sync duration trends
- Set realistic timeout values

---

### Issue 7: "GA4 API quota exceeded"

**Symptoms:**
- Error: "Quota exceeded for quota metric 'Queries' and limit 'Queries per day'"
- Sync fails mid-process
- HTTP 429 or 503 errors

**Causes:**
- Too many API requests in 24 hours
- Multiple data sources syncing simultaneously
- Hourly sync frequency with many report types
- Shared GA4 property with other tools

**Solutions:**

**Solution A: Check Quota Usage**

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Navigate to APIs & Services → Dashboard
3. Click "Google Analytics Data API"
4. View Quotas & System Limits
5. Check "Queries per day" usage

**Solution B: Reduce Sync Frequency**

```sql
-- Change hourly syncs to daily
UPDATE dra_data_sources
SET sync_frequency = 'daily'
WHERE type = 'google_analytics'
  AND sync_frequency = 'hourly';
```

**Solution C: Implement Request Batching**

```javascript
// Batch multiple dimensions/metrics in single request
const runBatchedReport = async (propertyId, reportConfigs) => {
  // Instead of 6 separate API calls, combine where possible
  const combinedDimensions = [...new Set(
    reportConfigs.flatMap(config => config.dimensions)
  )];
  
  const combinedMetrics = [...new Set(
    reportConfigs.flatMap(config => config.metrics)
  )];

  // Single API call instead of multiple
  return await analyticsDataClient.runReport({
    property: `properties/${propertyId}`,
    dimensions: combinedDimensions.map(d => ({ name: d })),
    metrics: combinedMetrics.map(m => ({ name: m })),
    dateRanges: [{ startDate: '30daysAgo', endDate: 'today' }]
  });
};
```

**Solution D: Request Quota Increase**

For production use with high volume:

1. Google Cloud Console → APIs & Services → Google Analytics Data API
2. Click "Quotas & System Limits"
3. Click "Edit Quotas" or "Request Increase"
4. Provide justification and requested limit
5. Wait for approval (typically 24-48 hours)

**Prevention:**
- Monitor quota usage regularly
- Use daily sync frequency for most use cases
- Implement quota usage tracking
- Consider GA4 360 for higher limits

---

### Issue 8: "NaN or null values in metrics"

**Symptoms:**
- Bounce rate shows as NaN
- Metrics contain unexpected null values
- Data completeness issues

**Causes:**
- Low traffic (insufficient data)
- GA4 data processing delay
- Sampling applied by GA4
- Dimension filter too restrictive

**Causes:**
- Division by zero in calculated metrics
- GA4 processing incomplete
- Low sample size
- Data freshness issues

**Solutions:**

**Solution A: Handle NaN in Queries**

```sql
-- Replace NaN with NULL or 0
SELECT 
  date,
  session_source,
  sessions,
  COALESCE(NULLIF(bounce_rate, 'NaN'::DECIMAL), 0) as bounce_rate
FROM dra_google_analytics.traffic_overview_42
WHERE date >= CURRENT_DATE - INTERVAL '7 days';
```

**Solution B: Wait for Complete Data**

GA4 data processing takes 24-48 hours. For recent dates:

```javascript
// Exclude yesterday and today for complete data
const endDate = new Date();
endDate.setDate(endDate.getDate() - 2);  // 2 days ago

const startDate = new Date(endDate);
startDate.setDate(startDate.getDate() - 30);

// Sync with complete data only
await syncDateRange(dataSourceId, startDate, endDate);
```

**Solution C: Check Sampling**

```sql
-- Add metadata to track sampling
ALTER TABLE dra_google_analytics.traffic_overview_42
ADD COLUMN IF NOT EXISTS is_sampled BOOLEAN DEFAULT FALSE;

-- Query to identify sampled data
SELECT 
  date,
  COUNT(*) as rows,
  SUM(CASE WHEN is_sampled THEN 1 ELSE 0 END) as sampled_rows
FROM dra_google_analytics.traffic_overview_42
GROUP BY date
HAVING SUM(CASE WHEN is_sampled THEN 1 ELSE 0 END) > 0;
```

**Prevention:**
- Exclude recent incomplete dates from syncs
- Document data freshness expectations
- Handle NULL/NaN in application logic
- Consider GA4 360 to reduce sampling

---

## Query Problems

### Issue 9: "Query returns no data"

**Symptoms:**
- SQL queries return empty result sets
- Expected data not appearing
- Table exists but has 0 rows

**Causes:**
- Sync never ran successfully
- Date range mismatch
- Wrong table name
- No traffic in selected period

**Solutions:**

**Solution A: Verify Sync History**

```sql
-- Check if sync ran successfully
SELECT 
  id,
  name,
  last_sync,
  (connection_details->>'last_sync_status') as sync_status
FROM dra_data_sources
WHERE type = 'google_analytics' AND id = 58;

-- Check sync history table
SELECT *
FROM dra_google_analytics.sync_history
WHERE data_source_id = 58
ORDER BY synced_at DESC
LIMIT 5;
```

**Solution B: Check Table Naming**

```sql
-- List all GA4 tables for this data source
SELECT tablename
FROM pg_tables
WHERE schemaname = 'dra_google_analytics'
  AND tablename LIKE '%_58';

-- Common naming pattern
-- Correct: traffic_overview_58
-- Incorrect: traffic_overview_42 (wrong ID)
```

**Solution C: Verify Data Exists**

```sql
-- Check row counts
SELECT 
  'traffic_overview' as report_type,
  COUNT(*) as rows,
  MIN(date) as earliest_date,
  MAX(date) as latest_date
FROM dra_google_analytics.traffic_overview_58
UNION ALL
SELECT 
  'page_performance',
  COUNT(*),
  NULL,
  NULL
FROM dra_google_analytics.page_performance_58;
```

**Solution D: Trigger Manual Sync**

If no data found, trigger a sync:

```bash
curl -X POST https://your-domain.com/api/google-analytics/sync/58 \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{}'
```

**Prevention:**
- Monitor successful sync completion
- Implement sync alerts
- Verify data after first sync
- Document expected data volumes

---

### Issue 10: "Slow query performance"

**Symptoms:**
- Queries take > 10 seconds
- Dashboard slow to load
- Database high CPU usage

**Causes:**
- Missing indexes
- Full table scans
- Large result sets
- Unoptimized queries

**Solutions:**

**Solution A: Add Indexes**

```sql
-- Recommended indexes for performance
CREATE INDEX IF NOT EXISTS idx_traffic_date_58 
  ON dra_google_analytics.traffic_overview_58(date);

CREATE INDEX IF NOT EXISTS idx_traffic_source_58 
  ON dra_google_analytics.traffic_overview_58(session_source);

CREATE INDEX IF NOT EXISTS idx_traffic_medium_58 
  ON dra_google_analytics.traffic_overview_58(session_medium);

-- Composite index for common filters
CREATE INDEX IF NOT EXISTS idx_traffic_date_source_58 
  ON dra_google_analytics.traffic_overview_58(date, session_source);
```

**Solution B: Optimize Queries**

```sql
-- ❌ Slow - No date filter
SELECT * FROM dra_google_analytics.traffic_overview_58;

-- ✅ Fast - With date filter and specific columns
SELECT 
  date,
  session_source,
  SUM(sessions) as total_sessions
FROM dra_google_analytics.traffic_overview_58
WHERE date >= CURRENT_DATE - INTERVAL '30 days'
GROUP BY date, session_source;
```

**Solution C: Use EXPLAIN ANALYZE**

```sql
-- Identify slow query parts
EXPLAIN ANALYZE
SELECT 
  session_source,
  SUM(sessions) as total_sessions
FROM dra_google_analytics.traffic_overview_58
WHERE date >= '2025-11-01'
GROUP BY session_source;

-- Look for:
-- - "Seq Scan" (bad) vs "Index Scan" (good)
-- - High execution time
-- - Large row counts
```

**Solution D: Table Maintenance**

```sql
-- Vacuum and analyze for better statistics
VACUUM ANALYZE dra_google_analytics.traffic_overview_58;

-- Check table bloat
SELECT 
  schemaname,
  tablename,
  pg_size_pretty(pg_total_relation_size(schemaname||'.'||tablename)) as size
FROM pg_tables
WHERE schemaname = 'dra_google_analytics'
ORDER BY pg_total_relation_size(schemaname||'.'||tablename) DESC;
```

**Prevention:**
- Create indexes proactively
- Use date filters in all queries
- Limit result set sizes
- Regular database maintenance
- Monitor query performance

---

## Performance Issues

### Issue 11: "Sync takes too long (> 30 minutes)"

**Symptoms:**
- Sync duration increasing over time
- Database CPU spikes during sync
- Memory usage high

**Causes:**
- Data volume growth
- Inefficient insert patterns
- Index rebuilding overhead
- Network latency

**Solutions:**

**Solution A: Batch Inserts**

```javascript
// Instead of individual inserts
for (const row of rows) {
  await db.insert(row);  // ❌ Slow
}

// Use batch inserts
const batchSize = 1000;
for (let i = 0; i < rows.length; i += batchSize) {
  const batch = rows.slice(i, i + batchSize);
  await db.batchInsert(batch);  // ✅ Fast
}
```

**Solution B: Temporary Disable Indexes**

```sql
-- For large data loads
DROP INDEX IF EXISTS idx_traffic_date_58;
DROP INDEX IF EXISTS idx_traffic_source_58;

-- Load data...

-- Recreate indexes after load
CREATE INDEX idx_traffic_date_58 
  ON dra_google_analytics.traffic_overview_58(date);
CREATE INDEX idx_traffic_source_58 
  ON dra_google_analytics.traffic_overview_58(session_source);
```

**Solution C: Incremental Syncs**

```javascript
// Only sync new data since last sync
const lastSyncDate = await getLastSyncDate(dataSourceId);

const syncConfig = {
  dateRanges: [{
    startDate: lastSyncDate,  // Not '30daysAgo'
    endDate: 'today'
  }]
};
```

**Solution D: Parallel Processing**

```javascript
// Sync report types in parallel
const reportTypes = [
  'traffic_overview',
  'page_performance',
  'user_acquisition',
  'geographic',
  'device',
  'events'
];

await Promise.all(
  reportTypes.map(type => syncReportType(dataSourceId, type))
);
```

**Prevention:**
- Implement incremental sync from day one
- Monitor sync duration trends
- Use appropriate batch sizes
- Consider scheduled off-peak syncs

---

### Issue 12: "High memory usage during sync"

**Symptoms:**
- Out of memory errors
- Process crashes during sync
- Server becomes unresponsive

**Causes:**
- Loading entire dataset into memory
- Large result sets from GA4 API
- Memory leaks
- Insufficient server resources

**Solutions:**

**Solution A: Stream Processing**

```javascript
// ❌ Load all data at once
const allData = await fetchAllDataFromGA4();
await insertToDatabase(allData);

// ✅ Process in chunks
async function* fetchDataStream() {
  let pageToken = null;
  do {
    const response = await fetchPage(pageToken);
    yield response.rows;
    pageToken = response.nextPageToken;
  } while (pageToken);
}

for await (const chunk of fetchDataStream()) {
  await insertChunk(chunk);
  // Chunk processed and garbage collected
}
```

**Solution B: Monitor Memory**

```javascript
const formatMemory = () => {
  const used = process.memoryUsage();
  return {
    rss: `${Math.round(used.rss / 1024 / 1024)} MB`,
    heapUsed: `${Math.round(used.heapUsed / 1024 / 1024)} MB`,
    heapTotal: `${Math.round(used.heapTotal / 1024 / 1024)} MB`
  };
};

// Log memory during sync
console.log('Memory before sync:', formatMemory());
await syncData();
console.log('Memory after sync:', formatMemory());
```

**Solution C: Limit Concurrent Operations**

```javascript
// Limit concurrent syncs
const Bottleneck = require('bottleneck');

const limiter = new Bottleneck({
  maxConcurrent: 2,  // Only 2 syncs at a time
  minTime: 1000      // 1 second between syncs
});

const syncWithLimit = limiter.wrap(syncDataSource);
```

**Prevention:**
- Use streaming/chunking patterns
- Implement memory monitoring
- Set resource limits
- Horizontal scaling for multiple syncs

---

## API Error Reference

### Complete Error Code List

| Error Code | HTTP Status | Description | Solution |
|------------|-------------|-------------|----------|
| **INVALID_TOKEN** | 401 | OAuth token expired or invalid | Refresh token or re-authenticate |
| **INSUFFICIENT_PERMISSIONS** | 403 | Missing GA4 property access | Grant property permissions |
| **PROPERTY_NOT_FOUND** | 404 | Property ID invalid or inaccessible | Verify property ID and access |
| **INVALID_PROPERTY_ID** | 400 | Property ID format invalid | Use numeric property ID |
| **RATE_LIMIT_EXCEEDED** | 429 | Too many requests | Implement backoff retry |
| **QUOTA_EXCEEDED** | 503 | GA4 API daily quota exceeded | Wait for reset or request increase |
| **VALIDATION_FAILED** | 400 | Request validation error | Fix validation errors |
| **UNAUTHORIZED** | 401 | Missing or invalid JWT | Provide valid JWT token |
| **FORBIDDEN** | 403 | Insufficient platform permissions | Request access from admin |
| **RESOURCE_NOT_FOUND** | 404 | Data source not found | Verify data source ID |
| **INTERNAL_SERVER_ERROR** | 500 | Server error | Check logs, retry |
| **SERVICE_UNAVAILABLE** | 503 | GA4 API temporarily down | Retry after delay |
| **TIMEOUT** | 504 | Request timeout | Increase timeout or reduce data volume |
| **DATABASE_ERROR** | 500 | Database operation failed | Check database connectivity |
| **SYNC_IN_PROGRESS** | 409 | Sync already running | Wait for completion |

### Example Error Responses

**Rate Limit Error:**
```json
{
  "error": "RATE_LIMIT_EXCEEDED",
  "message": "Too many sync requests. Please wait before trying again.",
  "retryAfter": 60,
  "timestamp": "2025-12-17T14:30:00Z"
}
```

**Validation Error:**
```json
{
  "error": "VALIDATION_FAILED",
  "message": "Request validation failed",
  "details": [
    {
      "field": "sync_frequency",
      "value": "every_hour",
      "message": "Invalid value. Must be one of: manual, hourly, daily, weekly"
    }
  ]
}
```

**GA4 API Error:**
```json
{
  "error": "QUOTA_EXCEEDED",
  "message": "Google Analytics API daily quota limit reached",
  "details": {
    "quotaLimit": 15000,
    "quotaUsed": 15000,
    "resetTime": "2025-12-18T00:00:00Z"
  }
}
```

---

## Known Limitations

### GA4 API Limitations

1. **Data Freshness:** 24-48 hour delay for complete data
2. **Historical Data:** 14 months retention via API
3. **Daily Quota:** 15,000 requests/day (standard properties)
4. **Sampling:** Applied to queries > 10M events
5. **Dimensions:** Max 9 dimensions per report
6. **Metrics:** Max 10 metrics per report
7. **Date Range:** Max 1 year per request
8. **Real-time Data:** Limited availability

### Platform Limitations

1. **Sync Frequency:** Minimum hourly (more frequent not recommended)
2. **Concurrent Syncs:** Limited to prevent resource exhaustion
3. **Table Naming:** Cannot be customized (follows pattern)
4. **Schema Changes:** Requires manual migration
5. **Data Retention:** Follows database retention policy
6. **Export Formats:** CSV, JSON only
7. **Custom Reports:** Not yet supported (presets only)

### Performance Considerations

1. **Large Properties:** > 10M events/day may require optimization
2. **Many Data Sources:** > 50 sources may need horizontal scaling
3. **Historical Backfill:** Limited to 14 months
4. **Query Complexity:** Complex joins may be slow
5. **Index Overhead:** Many indexes slow writes

---

## Diagnostic Tools

### Database Diagnostics

```sql
-- Check table sizes
SELECT 
  tablename,
  pg_size_pretty(pg_total_relation_size(schemaname||'.'||tablename)) as size,
  (SELECT COUNT(*) FROM dra_google_analytics."||tablename) as row_count
FROM pg_tables
WHERE schemaname = 'dra_google_analytics'
ORDER BY pg_total_relation_size(schemaname||'.'||tablename) DESC;

-- Check index usage
SELECT 
  schemaname,
  tablename,
  indexname,
  idx_scan as scans,
  pg_size_pretty(pg_relation_size(indexrelid)) as size
FROM pg_stat_user_indexes
WHERE schemaname = 'dra_google_analytics'
ORDER BY idx_scan DESC;

-- Check active connections
SELECT 
  datname,
  count(*) as connections
FROM pg_stat_activity
GROUP BY datname;
```

### API Health Check

```javascript
async function checkGAHealth(dataSourceId) {
  const health = {
    platform: false,
    google_oauth: false,
    ga4_api: false,
    database: false
  };

  try {
    // Platform API
    const status = await fetch(
      `https://your-domain.com/api/google-analytics/sync-status/${dataSourceId}`,
      { headers: { 'Authorization': `Bearer ${jwtToken}` } }
    );
    health.platform = status.ok;

    // OAuth token validity
    const ds = await getDataSource(dataSourceId);
    const tokenCheck = await verifyOAuthToken(ds.access_token);
    health.google_oauth = tokenCheck.valid;

    // GA4 API
    const properties = await listProperties(ds.access_token);
    health.ga4_api = properties.length > 0;

    // Database
    const dbCheck = await query('SELECT 1');
    health.database = dbCheck.rowCount === 1;
  } catch (error) {
    console.error('Health check failed:', error);
  }

  return health;
}
```

### Log Analysis

```bash
# Check for errors in logs
tail -f /var/log/app.log | grep -i "google.analytics\|error\|failed"

# Count errors by type
grep "google_analytics" /var/log/app.log | grep -i "error" | \
  awk '{print $5}' | sort | uniq -c | sort -rn

# Find slow syncs
grep "sync_duration" /var/log/app.log | \
  awk '$NF > 300 {print $0}' | tail -20
```

---

## Getting Support

### Before Contacting Support

Gather this information:

1. **Data Source ID:** Find in platform UI or database
2. **Error Message:** Complete error text
3. **Timestamp:** When issue occurred
4. **Recent Changes:** Any configuration changes
5. **Sync History:** Last successful sync time
6. **GA4 Property ID:** Numeric property ID
7. **Browser/Environment:** If UI issue

### Support Channels

1. **Documentation:** Check all 4 GA documentation guides
2. **Community Forum:** Search existing issues
3. **Email Support:** support@your-domain.com
4. **Emergency:** Use on-call pager for production outages

### Issue Report Template

```markdown
**Issue Summary:**
Brief description of the problem

**Data Source Details:**
- Data Source ID: 58
- Property ID: 123456789
- Sync Frequency: daily
- Last Successful Sync: 2025-12-16 14:30:00

**Error Details:**
- Error Message: "OAuth token expired"
- HTTP Status Code: 401
- Timestamp: 2025-12-17 14:30:00 UTC

**Steps to Reproduce:**
1. Navigate to...
2. Click...
3. Error appears

**Expected Behavior:**
What should happen

**Actual Behavior:**
What actually happens

**Workarounds Tried:**
- Tried refreshing token
- Restarted sync manually

**Environment:**
- Browser: Chrome 120
- OS: Windows 11
- Account: user@example.com
```

---

**Document Version:** 1.0  
**Last Updated:** December 17, 2025  
**Maintained By:** Data Research Analysis Team
