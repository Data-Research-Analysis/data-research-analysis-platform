# Google Ad Manager Troubleshooting Guide

**Comprehensive Problem Resolution Reference**

---

## Table of Contents

1. [Quick Diagnostics](#quick-diagnostics)
2. [OAuth & Authentication Issues](#oauth--authentication-issues)
3. [Connection Problems](#connection-problems)
4. [Sync Failures](#sync-failures)
5. [Scheduler Issues](#scheduler-issues)
6. [Data Quality Problems](#data-quality-problems)
7. [Export Failures](#export-failures)
8. [Performance Issues](#performance-issues)
9. [Email Notification Problems](#email-notification-problems)
10. [API Errors](#api-errors)
11. [Database Issues](#database-issues)
12. [Network & Firewall](#network--firewall)
13. [Known Limitations](#known-limitations)
14. [Diagnostic Tools](#diagnostic-tools)
15. [Getting Support](#getting-support)

---

## Quick Diagnostics

### Pre-Flight Checklist

Before troubleshooting, verify these basics:

- [ ] User is logged in with valid JWT token
- [ ] Project exists and user has access
- [ ] Internet connection is stable
- [ ] Backend service is running
- [ ] Database is accessible
- [ ] No active maintenance windows

### Quick Status Checks

**Check Backend Status:**
```bash
curl http://localhost:3002/health
```

**Expected Response:**
```json
{
  "status": "healthy",
  "services": {
    "database": "connected",
    "scheduler": "running"
  }
}
```

**Check Scheduler Status:**
```bash
curl -H "Authorization: Bearer YOUR_TOKEN" \
  http://localhost:3002/api/scheduler/stats
```

---

## OAuth & Authentication Issues

### Issue: "OAuth Authentication Failed"

**Symptom:**
- Unable to complete Google OAuth flow
- Error: "OAuth authentication failed"
- Redirect loop after Google consent

**Possible Causes:**
1. Invalid OAuth credentials
2. Redirect URI mismatch
3. Incorrect scope configuration
4. Browser blocking cookies

**Solutions:**

**1. Verify OAuth Credentials:**

Check environment variables:
```bash
# Backend environment
echo $GOOGLE_CLIENT_ID
echo $GOOGLE_CLIENT_SECRET
echo $GOOGLE_REDIRECT_URI
```

Ensure values match Google Cloud Console:
- Navigate to: https://console.cloud.google.com/apis/credentials
- Find your OAuth 2.0 Client ID
- Verify Client ID and Secret
- Check "Authorized redirect URIs" includes: `http://localhost:3002/api/google-ad-manager/oauth/callback`

**2. Fix Redirect URI Mismatch:**

Update `.env` file:
```bash
GOOGLE_REDIRECT_URI=http://localhost:3002/api/google-ad-manager/oauth/callback
```

Restart backend:
```bash
docker-compose restart backend.dataresearchanalysis.test
```

**3. Enable Required API:**

Enable Google Ad Manager API in Google Cloud Console:
- Navigate to: https://console.cloud.google.com/apis/library
- Search: "Google Ad Manager API"
- Click "Enable"

**4. Clear Browser Cookies:**

Clear cookies for `localhost` and `accounts.google.com`, then retry OAuth flow.

---

### Issue: "Access Token Expired"

**Symptom:**
- Error: "Invalid credentials" or "Access token expired"
- 401 Unauthorized responses
- Syncs failing after working previously

**Possible Causes:**
1. OAuth tokens expired (typically after 1 hour)
2. Refresh token not saved or invalid
3. Token not being refreshed automatically

**Solutions:**

**1. Check Token Expiry:**

Query database:
```sql
SELECT 
  id, 
  connection_name, 
  encrypted_credentials->>'token_expiry' as expiry
FROM data_sources
WHERE type = 'google-ad-manager'
  AND id = 42;
```

If expiry < current timestamp, tokens need refresh.

**2. Manual Token Refresh:**

Re-authenticate the connection:
1. Navigate to Data Sources
2. Click on GAM connection
3. Click "Reconnect"
4. Complete OAuth flow again

**3. Verify Refresh Token:**

Check database:
```sql
SELECT 
  id,
  encrypted_credentials->>'refresh_token' IS NOT NULL as has_refresh_token
FROM data_sources
WHERE type = 'google-ad-manager'
  AND id = 42;
```

If `has_refresh_token` is `false`, re-authenticate with `access_type=offline` and `prompt=consent`.

**4. Force Consent Screen:**

When generating OAuth URL, ensure:
```javascript
const authUrl = oauth2Client.generateAuthUrl({
  access_type: 'offline',  // Critical for refresh token
  prompt: 'consent',       // Forces consent screen
  scope: 'https://www.googleapis.com/auth/dfp'
});
```

---

### Issue: "Insufficient Permissions"

**Symptom:**
- Error: "User does not have permission to access this network"
- 403 Forbidden responses
- Can't fetch networks

**Possible Causes:**
1. User lacks GAM network access
2. Network access revoked
3. Wrong Google account

**Solutions:**

**1. Verify GAM Access:**

Log into Google Ad Manager:
- Navigate to: https://admanager.google.com
- Ensure you can access the network
- Check your role: Admin > User Access

Required role: Minimum "Trafficker" or "Read-only"

**2. Check Network Code:**

Verify network code in connection:
```sql
SELECT 
  id,
  connection_name,
  api_config->>'network_code' as network_code
FROM data_sources
WHERE type = 'google-ad-manager'
  AND id = 42;
```

Compare with GAM:
- In GAM, go to Admin > Global Settings
- Check "Network Code"

**3. Re-authenticate with Correct Account:**

Delete connection and recreate with the correct Google account that has GAM access.

---

## Connection Problems

### Issue: "Network Not Found"

**Symptom:**
- Error: "Network with code XXXXXXXX not found"
- Empty networks list after OAuth

**Possible Causes:**
1. Invalid network code
2. Network access removed
3. Network archived/deleted

**Solutions:**

**1. Verify Network Code:**

Get available networks:
```bash
curl -X GET http://localhost:3002/api/google-ad-manager/networks \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"access_token": "YOUR_ACCESS_TOKEN"}'
```

**2. Check GAM Account:**

Log into GAM and verify:
- Network still exists
- You have access
- Network is not archived

---

### Issue: "Connection Already Exists"

**Symptom:**
- Error: "A connection for this network already exists"
- Can't create duplicate connection

**Possible Causes:**
1. Connection already created for this network
2. Previous connection not deleted

**Solutions:**

**1. Find Existing Connection:**

```sql
SELECT 
  id,
  connection_name,
  api_config->>'network_code' as network_code,
  status
FROM data_sources
WHERE type = 'google-ad-manager'
  AND api_config->>'network_code' = '12345678';
```

**2. Options:**

- **Use Existing:** Navigate to existing connection and update settings
- **Delete & Recreate:** Delete old connection first
- **Update:** Use PUT endpoint to modify existing connection

---

## Sync Failures

### Issue: "Sync Failed - Rate Limit Exceeded"

**Symptom:**
- Error: "Rate limit exceeded"
- HTTP 429 responses
- Sync stops mid-way

**Possible Causes:**
1. GAM API quota exhausted
2. Too many concurrent requests
3. Large date range

**Solutions:**

**1. Check API Quota:**

Google Cloud Console:
- Navigate to: APIs & Services > Dashboard
- Select "Google Ad Manager API"
- View quota usage

Default limits:
- 10,000 requests per day
- 100 requests per 100 seconds per user

**2. Reduce Sync Frequency:**

Change from hourly to daily:
```http
PUT /api/google-ad-manager/connections/42/advanced-config
{
  "advanced_sync_config": {
    "frequency": {
      "type": "daily"
    }
  }
}
```

**3. Reduce Date Range:**

Sync smaller periods:
```json
{
  "date_range_preset": "last_7_days"
}
```

**4. Implement Exponential Backoff:**

Service automatically retries with exponential backoff. Wait 15-30 minutes and retry.

---

### Issue: "Sync Failed - Invalid Report Configuration"

**Symptom:**
- Error: "Invalid report configuration"
- Specific report types failing

**Possible Causes:**
1. Invalid dimension/metric combination
2. Report type not supported by network
3. Date range too old (>3 years)

**Solutions:**

**1. Verify Report Configuration:**

Check sync history logs:
```sql
SELECT 
  id,
  sync_metadata->>'error_details' as error_details
FROM sync_history
WHERE data_source_id = 42
  AND status = 'failed'
ORDER BY created_at DESC
LIMIT 1;
```

**2. Use Standard Report Types:**

Stick to supported report types:
- `revenue`
- `inventory`
- `orders`
- `geography`
- `device`

**3. Reduce Date Range:**

GAM historical data limits:
- Standard: 36 months
- Older data may not be available

Update configuration:
```json
{
  "date_range": {
    "start": "2025-11-16",
    "end": "2025-12-16"
  }
}
```

---

### Issue: "Sync Stuck in 'Running' State"

**Symptom:**
- Sync status shows "running" for hours
- No progress updates
- Can't start new sync

**Possible Causes:**
1. Service crashed mid-sync
2. Database connection lost
3. Long-running query

**Solutions:**

**1. Check Backend Logs:**

```bash
docker-compose logs --tail=100 backend.dataresearchanalysis.test
```

Look for:
- Errors
- Timeouts
- Database issues

**2. Check Sync Status:**

```bash
curl -H "Authorization: Bearer YOUR_TOKEN" \
  http://localhost:3002/api/google-ad-manager/sync/42/status
```

**3. Force Sync Cancellation:**

Update database directly:
```sql
UPDATE sync_history
SET status = 'failed',
    sync_metadata = jsonb_set(
      sync_metadata,
      '{error}',
      '"Manual cancellation - sync stuck"'
    )
WHERE data_source_id = 42
  AND status = 'running';
```

**4. Restart Backend:**

```bash
docker-compose restart backend.dataresearchanalysis.test
```

---

### Issue: "Partial Sync - Some Reports Failed"

**Symptom:**
- Sync status: "partial"
- Some report types succeeded, others failed

**Possible Causes:**
1. Network issues mid-sync
2. Specific report configuration invalid
3. Data availability issues

**Solutions:**

**1. Review Failed Reports:**

Check sync history:
```sql
SELECT 
  sync_metadata->'report_statuses' as report_statuses
FROM sync_history
WHERE data_source_id = 42
  AND status = 'partial'
ORDER BY created_at DESC
LIMIT 1;
```

**2. Re-run Failed Reports:**

Trigger sync for specific report types:
```bash
curl -X POST http://localhost:3002/api/google-ad-manager/sync/42 \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -d '{
    "report_types": ["inventory", "geography"]
  }'
```

**3. Disable Problematic Reports:**

Remove failing report types from configuration:
```http
PUT /api/google-ad-manager/connections/42
{
  "api_config": {
    "report_types": ["revenue", "orders"]
  }
}
```

---

## Scheduler Issues

### Issue: "Scheduled Syncs Not Running"

**Symptom:**
- Scheduler shows jobs, but they don't execute
- "Next Run" time passes without execution
- No sync history entries

**Possible Causes:**
1. Scheduler service not initialized
2. Cron expression invalid
3. Job is paused
4. Backend restarted

**Solutions:**

**1. Check Scheduler Initialization:**

Backend logs:
```bash
docker-compose logs backend.dataresearchanalysis.test | grep -i scheduler
```

Expected output:
```
✅ SchedulerService initialized
🔄 Scheduler service initialized and ready
```

**2. Verify Job Status:**

```bash
curl -H "Authorization: Bearer YOUR_TOKEN" \
  http://localhost:3002/api/scheduler/jobs/42
```

Check `status` field - should be `active`, not `paused`.

**3. Resume Paused Job:**

```bash
curl -X POST \
  -H "Authorization: Bearer YOUR_TOKEN" \
  http://localhost:3002/api/scheduler/jobs/42/resume
```

**4. Verify Cron Expression:**

Check job schedule:
```sql
SELECT 
  id,
  api_config->'advanced_sync_config'->'frequency'->>'type' as frequency
FROM data_sources
WHERE type = 'google-ad-manager'
  AND id = 42;
```

Valid frequencies:
- `manual` - No schedule
- `hourly` - `0 * * * *`
- `daily` - `0 0 * * *`
- `weekly` - `0 0 * * 0`
- `monthly` - `0 0 1 * *`

**5. Restart Scheduler:**

```bash
docker-compose restart backend.dataresearchanalysis.test
```

Wait 30 seconds for scheduler to initialize.

---

### Issue: "Job Schedule Not Updating"

**Symptom:**
- Changed frequency but schedule not updated
- Cron expression still shows old value

**Possible Causes:**
1. Cache not cleared
2. Job not replaced properly
3. Advanced config not saved

**Solutions:**

**1. Force Schedule Update:**

Cancel and reschedule:
```bash
# Cancel
curl -X DELETE \
  -H "Authorization: Bearer YOUR_TOKEN" \
  http://localhost:3002/api/scheduler/jobs/42

# Reschedule
curl -X POST \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  http://localhost:3002/api/scheduler/jobs/42 \
  -d '{"frequency": "hourly"}'
```

**2. Verify Advanced Config Saved:**

```sql
SELECT 
  api_config->'advanced_sync_config'->'frequency'
FROM data_sources
WHERE id = 42;
```

**3. Restart Backend:**

Sometimes requires service restart to apply changes.

---

## Data Quality Problems

### Issue: "Missing Data / Gaps in Data"

**Symptom:**
- Expected data not in database
- Date gaps in reports
- Incomplete records

**Possible Causes:**
1. Sync date range doesn't include period
2. Data not available in GAM for period
3. Filters excluding data
4. Failed syncs

**Solutions:**

**1. Check Sync History:**

```sql
SELECT 
  date,
  status,
  records_synced,
  sync_metadata->>'date_range' as date_range
FROM sync_history
WHERE data_source_id = 42
ORDER BY created_at DESC
LIMIT 10;
```

**2. Verify Date Range:**

Ensure sync configuration includes the missing period:
```http
PUT /api/google-ad-manager/connections/42/advanced-config
{
  "date_range_preset": "last_90_days"
}
```

**3. Check Filters:**

Review dimension filters in advanced config:
```sql
SELECT 
  api_config->'advanced_sync_config'->'filters'
FROM data_sources
WHERE id = 42;
```

Remove restrictive filters if needed.

**4. Manual Re-sync:**

Trigger sync for specific date range:
```bash
curl -X POST http://localhost:3002/api/google-ad-manager/sync/42 \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -d '{
    "date_range": {
      "start": "2025-11-01",
      "end": "2025-11-30"
    }
  }'
```

---

### Issue: "Duplicate Records"

**Symptom:**
- Same data appearing multiple times
- Inflated revenue/impression numbers
- Duplicate rows in database

**Possible Causes:**
1. Deduplication disabled
2. Multiple syncs without incremental mode
3. Database constraint missing

**Solutions:**

**1. Enable Deduplication:**

```http
PUT /api/google-ad-manager/connections/42/advanced-config
{
  "advanced_sync_config": {
    "validation": {
      "deduplication": true,
      "incremental_sync": true
    }
  }
}
```

**2. Check Database Constraints:**

Verify unique constraints exist:
```sql
-- Revenue table
SELECT constraint_name, constraint_type
FROM information_schema.table_constraints
WHERE table_name = 'revenue_12345678'
  AND constraint_type = 'UNIQUE';
```

**3. Clean Up Duplicates:**

```sql
-- Find duplicates
SELECT 
  date, ad_unit_id, country, COUNT(*)
FROM dra_google_ad_manager.revenue_12345678
GROUP BY date, ad_unit_id, country
HAVING COUNT(*) > 1;

-- Remove duplicates (keep latest)
DELETE FROM dra_google_ad_manager.revenue_12345678 a
USING dra_google_ad_manager.revenue_12345678 b
WHERE a.id < b.id
  AND a.date = b.date
  AND a.ad_unit_id = b.ad_unit_id
  AND a.country = b.country;
```

---

## Export Failures

### Issue: "Export Timeout"

**Symptom:**
- Export generation takes too long
- HTTP timeout errors
- Large exports failing

**Possible Causes:**
1. Too much data to export
2. Database query slow
3. Server memory limit

**Solutions:**

**1. Reduce Date Range:**

```bash
curl -X POST http://localhost:3002/api/google-ad-manager/export/42 \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -d '{
    "format": "csv",
    "report_type": "revenue",
    "date_range": {
      "start": "2025-12-01",
      "end": "2025-12-07"
    }
  }'
```

**2. Limit Fields:**

```json
{
  "fields": ["date", "ad_unit_name", "total_earnings", "impressions"]
}
```

**3. Use Streaming Export:**

For very large exports, use chunked/streaming response.

**4. Increase Timeout:**

Backend configuration:
```javascript
// backend/src/routes/export.ts
app.timeout = 300000; // 5 minutes
```

---

### Issue: "Export File Corrupted"

**Symptom:**
- Downloaded file won't open
- Excel shows "file corrupted" error
- CSV has formatting issues

**Possible Causes:**
1. Network interruption during download
2. Encoding issues
3. File generation error

**Solutions:**

**1. Re-download Export:**

Use the same export ID to download again:
```bash
curl -H "Authorization: Bearer YOUR_TOKEN" \
  http://localhost:3002/api/google-ad-manager/export/42/download/export_jkl012mno \
  -o report.csv
```

**2. Try Different Format:**

If Excel fails, try CSV:
```json
{
  "format": "csv"
}
```

**3. Check File Size:**

Large files (>25MB) may have issues:
```bash
curl -I http://localhost:3002/api/google-ad-manager/export/42/download/export_jkl012mno
```

Check `Content-Length` header.

---

## Performance Issues

### Issue: "Slow Sync Performance"

**Symptom:**
- Syncs taking >10 minutes
- Timeout errors
- High CPU usage

**Possible Causes:**
1. Large date range
2. Too many report types
3. Database performance
4. Network latency to GAM API

**Solutions:**

**1. Optimize Date Range:**

Sync smaller periods more frequently:
```json
{
  "date_range_preset": "last_7_days",
  "frequency": {
    "type": "daily"
  }
}
```

**2. Reduce Report Types:**

Only sync needed reports:
```json
{
  "report_types": ["revenue", "inventory"]
}
```

**3. Enable Incremental Sync:**

```json
{
  "validation": {
    "incremental_sync": true
  }
}
```

**4. Database Optimization:**

Add indexes:
```sql
CREATE INDEX CONCURRENTLY idx_revenue_date_ad_unit 
ON dra_google_ad_manager.revenue_12345678(date, ad_unit_id);

ANALYZE dra_google_ad_manager.revenue_12345678;
```

**5. Scale Backend:**

Increase resources:
```yaml
# docker-compose.yml
services:
  backend.dataresearchanalysis.test:
    deploy:
      resources:
        limits:
          cpus: '2.0'
          memory: 4G
```

---

### Issue: "High Memory Usage"

**Symptom:**
- Backend container running out of memory
- OOM (Out of Memory) errors
- Service crashes

**Possible Causes:**
1. Large batch processing
2. Memory leaks
3. Insufficient container limits

**Solutions:**

**1. Increase Memory Limit:**

```yaml
# docker-compose.yml
services:
  backend.dataresearchanalysis.test:
    deploy:
      resources:
        limits:
          memory: 4G
```

**2. Reduce Batch Size:**

Process smaller chunks:
```javascript
// backend/src/drivers/GoogleAdManagerDriver.ts
const BATCH_SIZE = 1000; // Reduce from 5000
```

**3. Monitor Memory:**

```bash
docker stats backend.dataresearchanalysis.test
```

**4. Restart Backend:**

```bash
docker-compose restart backend.dataresearchanalysis.test
```

---

## Email Notification Problems

### Issue: "Email Notifications Not Sending"

**Symptom:**
- No emails received for sync completion/failure
- Email config enabled but silent

**Possible Causes:**
1. Email service not configured
2. SMTP credentials invalid
3. Email blocked by spam filter
4. Notification config not saved

**Solutions:**

**1. Verify Email Configuration:**

Check environment variables:
```bash
echo $SMTP_HOST
echo $SMTP_PORT
echo $SMTP_USER
echo $SMTP_FROM
```

**2. Test SMTP Connection:**

```bash
curl -v telnet://$SMTP_HOST:$SMTP_PORT
```

**3. Check Notification Settings:**

```sql
SELECT 
  api_config->'advanced_sync_config'->'notifications'
FROM data_sources
WHERE id = 42;
```

Should show:
```json
{
  "notify_on_completion": true,
  "notify_on_failure": true,
  "email_recipients": ["admin@example.com"]
}
```

**4. Check Spam Folder:**

Emails may be filtered as spam. Add sender to whitelist.

**5. Backend Logs:**

```bash
docker-compose logs backend.dataresearchanalysis.test | grep -i email
```

Look for SMTP errors.

---

## API Errors

### Error Code Reference

| Error Code | HTTP Status | Description | Solution |
|------------|-------------|-------------|----------|
| `AUTH_FAILED` | 401 | Authentication failed | Check JWT token validity |
| `INVALID_TOKEN` | 401 | Token invalid/expired | Refresh JWT token |
| `OAUTH_ERROR` | 400 | OAuth flow error | Restart OAuth process |
| `NETWORK_NOT_FOUND` | 404 | GAM network not found | Verify network code |
| `CONNECTION_EXISTS` | 409 | Connection already exists | Use existing or delete first |
| `SYNC_IN_PROGRESS` | 409 | Sync already running | Wait for completion |
| `RATE_LIMIT_EXCEEDED` | 429 | API rate limit hit | Wait and retry with backoff |
| `VALIDATION_ERROR` | 400 | Request validation failed | Check request payload |
| `DATABASE_ERROR` | 500 | Database operation failed | Check database connection |

### Common API Errors

**401 Unauthorized:**
```json
{
  "success": false,
  "error": {
    "code": "INVALID_TOKEN",
    "message": "JWT token invalid or expired"
  }
}
```

**Solution:** Refresh JWT token and retry.

**429 Too Many Requests:**
```json
{
  "success": false,
  "error": {
    "code": "RATE_LIMIT_EXCEEDED",
    "message": "Rate limit exceeded",
    "details": {
      "retry_after": 3600
    }
  }
}
```

**Solution:** Wait `retry_after` seconds before retrying.

---

## Database Issues

### Issue: "Database Connection Failed"

**Symptom:**
- Error: "Could not connect to database"
- Service won't start
- Sync failures

**Solutions:**

**1. Check Database Container:**

```bash
docker-compose ps database.dataresearchanalysis.test
```

Should show "Up" status.

**2. Restart Database:**

```bash
docker-compose restart database.dataresearchanalysis.test
```

**3. Check Connection String:**

```bash
echo $DATABASE_URL
```

**4. Test Connection:**

```bash
docker-compose exec database.dataresearchanalysis.test psql -U postgres -c "SELECT 1;"
```

---

### Issue: "Table Does Not Exist"

**Symptom:**
- Error: "relation does not exist"
- Can't query GAM tables

**Possible Causes:**
1. Initial sync not completed
2. Table creation failed
3. Wrong network code

**Solutions:**

**1. Verify Tables Exist:**

```sql
SELECT table_name
FROM information_schema.tables
WHERE table_schema = 'dra_google_ad_manager'
  AND table_name LIKE '%12345678%';
```

**2. Run Initial Sync:**

Tables are created during first sync:
```bash
curl -X POST http://localhost:3002/api/google-ad-manager/sync/42 \
  -H "Authorization: Bearer YOUR_TOKEN"
```

**3. Manual Table Creation:**

If needed, create tables manually (see schema in Report Types Reference documentation).

---

## Network & Firewall

### Issue: "Cannot Reach GAM API"

**Symptom:**
- Error: "Connection timeout"
- Error: "ECONNREFUSED"
- Network errors during sync

**Solutions:**

**1. Check Internet Connectivity:**

```bash
ping google.com
```

**2. Test GAM API Access:**

```bash
curl -I https://ads.google.com/apis/ads/publisher/v202311
```

**3. Check Firewall Rules:**

Ensure outbound HTTPS (443) allowed to:
- `ads.google.com`
- `accounts.google.com`
- `oauth2.googleapis.com`

**4. Proxy Configuration:**

If behind corporate proxy, set environment:
```bash
export HTTP_PROXY=http://proxy.company.com:8080
export HTTPS_PROXY=http://proxy.company.com:8080
```

---

## Known Limitations

### Data Availability

- **Historical Data:** GAM API provides up to 36 months of historical data
- **Real-time Data:** ~1 hour delay for most metrics
- **Date Range:** Maximum 186 days per report request
- **Request Limits:** 10,000 requests per day per project

### Feature Limitations

- **Custom Dimensions:** Not supported in v1
- **Forecasting:** Not available through API
- **Saved Reports:** Cannot import custom saved reports from GAM UI
- **Real-time Bidding:** RTB data not included

### Performance Considerations

- **Large Networks:** Networks with 10,000+ ad units may experience slower syncs
- **Concurrent Syncs:** Maximum 10 concurrent syncs per connection
- **Export Size:** Exports limited to 100MB (approximately 1M records)

---

## Diagnostic Tools

### Backend Logs

**View Real-time Logs:**
```bash
docker-compose logs -f backend.dataresearchanalysis.test
```

**Search Logs:**
```bash
docker-compose logs backend.dataresearchanalysis.test | grep -i "error\|warning"
```

**Filter by Service:**
```bash
docker-compose logs backend.dataresearchanalysis.test | grep "SchedulerService"
```

### Database Queries

**Check Connection Status:**
```sql
SELECT 
  id,
  connection_name,
  status,
  last_sync_at,
  api_config->>'network_code' as network_code
FROM data_sources
WHERE type = 'google-ad-manager';
```

**Recent Sync History:**
```sql
SELECT 
  id,
  data_source_id,
  status,
  started_at,
  completed_at,
  records_synced,
  sync_metadata->>'error' as error_message
FROM sync_history
WHERE data_source_id = 42
ORDER BY started_at DESC
LIMIT 10;
```

**Check Data Volume:**
```sql
SELECT 
  COUNT(*) as total_records,
  MIN(date) as earliest_date,
  MAX(date) as latest_date,
  SUM(total_earnings) as total_revenue
FROM dra_google_ad_manager.revenue_12345678;
```

### API Testing

**Health Check:**
```bash
curl http://localhost:3002/health
```

**Test Authentication:**
```bash
curl -H "Authorization: Bearer YOUR_TOKEN" \
  http://localhost:3002/api/google-ad-manager/connections
```

**Scheduler Status:**
```bash
curl -H "Authorization: Bearer YOUR_TOKEN" \
  http://localhost:3002/api/scheduler/stats
```

---

## Getting Support

### Before Contacting Support

Gather this information:

1. **Error Message:** Full error text and stack trace
2. **Reproduction Steps:** How to reproduce the issue
3. **Environment:**
   - Platform version
   - Browser (if frontend issue)
   - Docker version
   - OS version
4. **Screenshots:** Error messages, UI state
5. **Logs:** Relevant backend logs (last 100 lines)
6. **Configuration:** Connection settings (redact credentials)

### Support Channels

**Email Support:**
- Email: support@dataresearchanalysis.com
- Include: All information from "Before Contacting Support"
- Response Time: Within 24 hours (weekdays)

**Help Center:**
- URL: https://help.dataresearchanalysis.com
- Search knowledge base
- Browse FAQs
- Submit ticket

**Community Forum:**
- URL: https://community.dataresearchanalysis.com
- Ask questions
- Share solutions
- Connect with other users

**Emergency Support:**
- For production-critical issues
- Email: emergency@dataresearchanalysis.com
- Include "URGENT:" in subject line

### Submit Bug Report

Include:

```
**Summary:** Brief description of the issue

**Steps to Reproduce:**
1. Step one
2. Step two
3. Step three

**Expected Behavior:** What should happen

**Actual Behavior:** What actually happens

**Error Message:**
```
[Paste full error message]
```

**Environment:**
- Platform Version: 
- Browser:
- OS:
- Docker Version:

**Additional Context:**
[Any other relevant information]
```

---

**Document Version:** 1.0  
**Last Updated:** December 16, 2025  
**Maintained By:** Data Research Analysis Team

