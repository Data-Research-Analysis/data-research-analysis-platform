# Google Ad Manager - Troubleshooting Guide

**Solving Common Issues with GAM Integration**

> **Last reviewed:** 2026-10-22. The driver implements 6 report types; the UI advertises 5. See [GAM_REPORT_TYPES_REFERENCE.md](GAM_REPORT_TYPES_REFERENCE.md).

---

## Table of Contents

1. [Authentication Issues](#authentication-issues)
2. [Connection Problems](#connection-problems)
3. [Sync Failures](#sync-failures)
4. [Data Quality Issues](#data-quality-issues)
5. [Performance Problems](#performance-problems)
6. [Feature Availability](#feature-availability)
7. [Getting Additional Help](#getting-additional-help)

---

## Authentication Issues

### Problem: "Failed to authenticate with Google"

**Symptoms**:
- OAuth flow fails
- "Authentication failed" error message
- Unable to proceed past Step 1

**Solutions**:

1. **Verify Google Account Access**
   - Ensure you're signed into the correct Google account
   - Confirm the account has access to GAM network
   - Check that account has read permissions in GAM

2. **Clear Browser Cookies**
   ```
   - Chrome: Settings → Privacy → Clear browsing data
   - Select "Cookies and other site data"
   - Clear and try again
   ```

3. **Try Incognito/Private Mode**
   - Open browser in incognito/private mode
   - Attempt connection again
   - This bypasses cached credentials

4. **Check OAuth Consent Screen**
   - Ensure you clicked "Allow" not "Deny"
   - Review all requested permissions
   - Grant all required scopes

---

### Problem: "Token expired" error

**Symptoms**:
- Connection worked before but now fails
- "Token has been expired or revoked" message

**Solutions**:

1. **Re-authenticate**
   - Go to Data Sources
   - Delete the existing GAM connection
   - Create a new connection
   - Complete OAuth flow again

2 **Check Token Status**
   - Tokens auto-refresh, but may fail if revoked
   - Ensure OAuth consent hasn't been revoked in Google Account settings
   - Go to myaccount.google.com/permissions

---

## Connection Problems

### Problem: "No networks found"

**Symptoms**:
- After authentication, network list is empty
- "No Google Ad Manager networks found" message

**Solutions**:

1. **Verify GAM Access**
   - Log into ad.google.com/adsense/app
   - Confirm you can see networks there
   - Check account role (needs Read or higher)

2. **Check Account Permissions**
   - Minimum role required: Read-only
   - Contact GAM admin if you don't have access
   - May need to be added to network

3. **API Enablement**
   - Ensure Google Ad Manager API is enabled
   - Check Google Cloud Console for API status
   - May need admin to enable for organization

---

### Problem: Network selection fails

**Symptoms**:
- Can see networks but can't select one
- Error when clicking network

**Solutions**:

1. **Refresh Network List**
   - Go back to Step 1
   - Re-authenticate
   - List should refresh

2. **Check Network Status**
   - Ensure network is active in GAM
   - Inactive networks won't sync
   - Contact GAM admin

---

## Sync Failures

### Problem: "Sync failed" status

**Symptoms**:
- Sync shows "Failed" status
- Red error indicator
- Data not appearing in database

**Solutions**:

1. **Check Error Message**
   - View sync history in Data Sources
   - Read specific error message
   - Common errors:
     - "Rate limit exceeded" → Wait and retry
     - "Network not found" → Network may have been deleted
     - "Insufficient permissions" → Check GAM role

2. **Verify Network Access**
   - Log into GAM directly
   - Ensure network still exists
   - Check you still have access

3. **Retry Sync**
   - Click "Sync Now" button
   - Wait for completion
   - Check sync status

4. **Check API Quotas**
   - GAM API has rate limits
   - Daily sync won't hit limits
   - Manual frequent syncs may

---

### Problem: Sync takes too long

**Symptoms**:
- Sync running for > 10 minutes
- "Syncing..." status won't complete

**Solutions**:

1. **Wait Patiently**
   - Large accounts may take 5-10 minutes
   - Check sync history for progress
   - Look for "Running" status

2. **Check Network Load**
   - GAM API may be slow during peak hours
   - Try syncing at off-peak times
   - Consider daily automatic sync instead

3. **Contact Support if Stuck**
   - If > 30 minutes, likely an issue
   - Note the data source ID
   - Contact support with details

---

## Data Quality Issues

### Problem: Missing data in tables

**Symptoms**:
- Tables exist but have few/no rows
- Expected ad units not showing
- Date gaps in data

**Solutions**:

1. **Check Date Range**
   - The default range is the last 30 days; explicit start/end dates are supported
   - Confirm the requested period actually has activity in GAM

2. **Verify GAM Has Data**
   - Log into GAM directly
   - Run same report for same period
   - Confirm data exists in GAM

3. **Check Report Types**
   - Implemented: revenue, geography, device, ad_unit, advertiser, time_series
   - inventory/orders are advertised but run the revenue query
   - See "Feature Availability" below

4. **Review Sync History**
   - Check if sync completed successfully
   - Look for "records synced" count
   - If 0, may indicate no data for period

---

### Problem: Data doesn't match GAM UI

**Symptoms**:
- Numbers in platform don't match GAM reports
- Revenue totals differ
- Impression counts off

**Solutions**:

1. **Check Date Range Alignment**
   - Ensure comparing same dates
   - Platform uses UTC timezone
   - GAM uses network timezone

2. **Verify Report Configuration**
   - Check which dimensions included
   - Some aggregation differences normal
   - GAM UI may show real-time, sync is delayed

3. **Allow for Sync Delay**
   - Data syncs daily at 2 AM (or weekly)
   - Not real-time
   - Yesterday's data available today

---

## Performance Problems

### Problem: Queries are slow

**Symptoms**:
- AI Data Modeler queries timeout
- Long load times for dashboards
- Database slow to respond

**Solutions**:

1. **Optimize Queries**
   - Add date range filters
   - Limit result set size
   - Use indexes columns (date, ad_unit_id)

2. **Check Data Volume**
   - Large networks = more data
   - Consider aggregating data
   - Use summary tables

3. **Review Index Usage**
   - Tables automatically indexed
   - Complex JOINs may be slow
   - Contact support for query optimization

---

## Feature Availability

### Problem: "Why can't I select [Feature X]?"

**✅ Implemented in the driver**:
- Revenue, Geography, Device, Ad Unit, Advertiser, Time Series reports
- Hourly, Daily, Weekly, and Manual sync frequencies
- Optional custom date ranges (default: last 30 days)
- OAuth authentication and network selection

**⚠️ Advertised but mapped to Revenue**:
- Inventory Performance
- Orders & Line Items

**❌ Not implemented**:
- Separate inventory/order schemas
- Pre-built GAM dashboards (use AI Data Modeler)
- GAM-specific export panel (use platform export)

---

### Problem: "Where is the hourly sync option?"

**Answer**: Hourly sync is supported. Set `sync_frequency` to `hourly` or choose it in the connection wizard. Only GA4, GAM, Google Ads, and Meta are eligible for automatic scheduler runs.

---

### Problem: "How do I set custom date ranges?"

**Answer**: Pass `start_date` and `end_date` (ISO 8601) when creating the data source or syncing. If omitted, the connector uses the last 30 days.

---

### Problem: "Where are Inventory/Orders/Device reports?"

**Answer**: Device, ad unit, advertiser, and time-series reports are implemented in the driver. Inventory and Orders are advertised in the UI but currently run the revenue query; they do not have separate schemas yet.

## Best Practices to Avoid Issues

1. **Use Daily Automatic Sync**
   - More reliable than manual
   - Scheduled during off-peak hours
   - Reduces rate limit issues

2. **Monitor Sync Status Weekly**
   - Check for failures
   - Address issues promptly
   - Review sync history

3. **Keep Account Access Current**
   - Ensure team members have proper roles
   - Remove old/unused connections
   - Re-authenticate if role changes

4. **Start Simple**
   - Begin with just Revenue report
   - Add Geography once comfortable
   - Test thoroughly before relying on data

5. **Document Your Setup**
   - Note which networks connected
   - Track sync schedules
   - Document any customizations

---

**Document Version**: 2.0 (Updated for Simplified Release)  
**Last Updated**: December 17, 2025  
**Status**: Current Implementation
