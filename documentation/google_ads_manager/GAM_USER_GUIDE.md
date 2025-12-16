# Getting Started with Google Ad Manager

**Complete User Guide for Google Ad Manager Integration**

---

## Table of Contents

1. [Introduction](#introduction)
2. [Prerequisites](#prerequisites)
3. [Connecting Your GAM Account](#connecting-your-gam-account)
4. [Configuring Sync Settings](#configuring-sync-settings)
5. [Managing Scheduled Syncs](#managing-scheduled-syncs)
6. [Monitoring Sync Status](#monitoring-sync-status)
7. [Exporting Data](#exporting-data)
8. [Using GAM Data in AI Data Modeler](#using-gam-data-in-ai-data-modeler)
9. [Best Practices](#best-practices)
10. [Common Use Cases](#common-use-cases)

---

## Introduction

The Google Ad Manager (GAM) integration allows you to import advertising performance data, revenue metrics, and inventory analytics directly into the Data Research Analysis Platform. This integration enables you to:

- **Unified Reporting:** Combine GAM data with Google Analytics, CRM, and other data sources
- **Automated Syncs:** Schedule automatic data imports hourly, daily, weekly, or monthly
- **Custom Analytics:** Build custom dashboards and reports using the AI Data Modeler
- **Historical Analysis:** Access and analyze historical advertising performance
- **Real-time Monitoring:** Track sync status and receive notifications

---

## Prerequisites

Before connecting your Google Ad Manager account, ensure you have:

### Required Access

1. **Google Ad Manager Account**
   - Access to a Google Ad Manager network
   - Minimum required role: **Read-only** (for viewing reports)
   - Recommended role: **Trafficking** or **Admin** (for full access)

2. **Google Account**
   - A Google account with access to your GAM network
   - OAuth 2.0 consent granted for the application

3. **Platform Access**
   - Active account on Data Research Analysis Platform
   - Project created and access permissions

### Permissions Needed

The integration requires the following Google API scope:
- `https://www.googleapis.com/auth/dfp` (Google Ad Manager API)

This scope allows the application to:
- Read network and ad unit information
- Generate and download reports
- Access revenue and performance data

---

## Connecting Your GAM Account

### Step 1: Navigate to Data Sources

1. Log in to the Data Research Analysis Platform
2. Navigate to your project
3. Click **"Data Sources"** in the sidebar
4. Click **"+ Add Data Source"** button

### Step 2: Select Google Ad Manager

1. Find **"Google Ad Manager"** in the list of available sources
2. Click **"Connect"** to begin the setup wizard

### Step 3: Authenticate with Google

1. Click **"Sign in with Google"** button
2. Select your Google account
3. Review the permissions requested:
   - View and manage your Google Ad Manager data
   - Access your GAM network information
4. Click **"Allow"** to grant permissions

**Security Note:** Your credentials are securely stored and encrypted. The platform only requests read-only access to your GAM data.

### Step 4: Select Your Network

1. After authentication, you'll see a list of GAM networks you have access to
2. Select the network you want to connect
3. Review the network details:
   - Network Code
   - Network Name
   - Display Name
   - Time Zone

### Step 5: Configure Data Source

1. **Connection Name:** Enter a descriptive name (e.g., "Main GAM Network - Production")
2. **Report Types:** Select which reports to sync:
   - ☑ Revenue & Earnings
   - ☑ Inventory Performance
   - ☑ Orders & Line Items
   - ☑ Geography Performance
   - ☑ Device & Browser
3. **Date Range:** Choose initial sync period
   - Last 7 days
   - Last 30 days
   - Last 90 days
   - Custom date range

### Step 6: Complete Setup

1. Review your configuration
2. Click **"Connect & Sync"** to:
   - Save the connection
   - Start the initial data sync
3. You'll be redirected to the sync status page

**Initial Sync Time:** Depending on the date range and report types selected, initial sync may take 2-10 minutes.

---

## Configuring Sync Settings

### Advanced Sync Configuration

After connecting your GAM account, you can configure advanced sync settings:

#### Accessing Advanced Settings

1. Navigate to your project's **Data Sources**
2. Find your GAM connection
3. Click the **gear icon** (⚙️) to open settings
4. Click **"Advanced Sync Configuration"**

#### Available Settings

**1. Sync Frequency**

Choose how often data should sync automatically:

- **Manual:** Only sync when triggered manually
- **Hourly:** Sync every hour at minute 0 (recommended for real-time dashboards)
- **Daily:** Sync once per day at midnight UTC
- **Weekly:** Sync once per week on Sunday at midnight UTC
- **Monthly:** Sync on the 1st of each month at midnight UTC

```
Example: Hourly sync runs at:
- 00:00, 01:00, 02:00, ... 23:00 UTC
```

**2. Date Range Presets**

Set the default date range for syncs:

- **Last 7 days:** Most recent week of data
- **Last 30 days:** Previous month
- **Last 90 days:** Quarterly data
- **Custom:** Specify exact start and end dates

**3. Report Field Selection**

Customize which dimensions and metrics to include:

**Revenue Report:**
- Dimensions: Date, Ad Unit ID, Ad Unit Name, Country
- Metrics: Total Earnings, Impressions, Clicks, CTR, eCPM

**Inventory Report:**
- Dimensions: Date, Ad Unit ID, Size, Device Category
- Metrics: Impressions, Clicks, CTR, Fill Rate, Available Impressions

**4. Dimension Filters**

Filter data by specific dimensions:

```javascript
Example filters:
- Ad Unit: "Homepage" OR "Article Pages"
- Country: "US", "CA", "UK"
- Device: "DESKTOP" OR "MOBILE"
```

**5. Data Validation**

Enable optional data quality checks:

- ☑ **Incremental Sync:** Only import new/changed data
- ☑ **Deduplication:** Remove duplicate records
- ☑ **Data Validation:** Verify data integrity before storing
- ☑ **Max Records:** Limit records per report (default: unlimited)

**6. Notifications**

Configure email notifications:

- ☑ **Notify on Completion:** Receive email when sync completes successfully
- ☑ **Notify on Failure:** Receive alert emails when sync fails
- **Email Recipients:** Add multiple email addresses (comma-separated)

```
Example notification emails:
- admin@yourcompany.com
- analytics@yourcompany.com
- developer@yourcompany.com
```

#### Saving Configuration

1. Review all settings
2. Click **"Save Configuration"**
3. If frequency is set to automatic, the scheduler will create a cron job
4. Click **"Sync Now"** to test with new settings

---

## Managing Scheduled Syncs

### Scheduler Dashboard

Access the scheduler dashboard to manage all automated syncs:

#### Viewing Scheduled Jobs

1. Navigate to **Admin** → **GAM Dashboard**
2. Click **"Scheduler"** tab
3. View all scheduled jobs with:
   - Data Source Name
   - Schedule (cron expression)
   - Status (Active/Paused)
   - Last Run
   - Next Run
   - Run Count

#### Scheduler Controls

**Pause a Job:**
1. Find the job in the list
2. Click **"Pause"** button (⏸️)
3. Job stops running but remains configured
4. Use case: Temporary maintenance or testing

**Resume a Job:**
1. Find the paused job
2. Click **"Resume"** button (▶️)
3. Job resumes at next scheduled time

**Trigger Manually:**
1. Find any job (active or paused)
2. Click **"Trigger Now"** button (🚀)
3. Job executes immediately, regardless of schedule
4. Use case: Ad-hoc data refresh needed

**Cancel a Job:**
1. Find the job to remove
2. Click **"Cancel"** button (🗑️)
3. Confirm cancellation
4. Job is permanently removed (can be rescheduled later)

**Update Schedule:**
1. Click **"Edit Schedule"** button (✏️)
2. Modify frequency settings
3. Save changes
4. New schedule takes effect immediately

#### Scheduler Statistics

View overall scheduler health:

- **Total Jobs:** Number of configured sync jobs
- **Active Jobs:** Currently running schedules
- **Paused Jobs:** Temporarily disabled schedules
- **Total Runs:** Cumulative execution count

---

## Monitoring Sync Status

### Real-time Sync Monitoring

Track sync progress in real-time:

#### Sync Status Page

1. Navigate to **Data Sources**
2. Click on your GAM connection
3. View the **Sync Status** panel

**Status Indicators:**

- 🟢 **Completed:** Sync finished successfully
- 🔵 **Running:** Sync in progress
- ⏸️ **Pending:** Waiting to start
- 🔴 **Failed:** Sync encountered errors
- 🟡 **Partial:** Some reports failed

#### Sync History

View historical sync operations:

1. Click **"Sync History"** tab
2. See list of all past syncs with:
   - Start Time
   - End Time
   - Duration
   - Records Synced
   - Status
   - Error Messages (if failed)

**Filtering Options:**
- Filter by status (Completed, Failed, Partial)
- Filter by date range
- Search by specific report type

#### Performance Metrics

Track sync performance:

- **Average Duration:** Mean sync time
- **Success Rate:** Percentage of successful syncs
- **Records Per Sync:** Average data volume
- **Last 24 Hours:** Recent sync activity

### Email Notifications

If configured, receive automated emails:

**Success Notification:**
```
Subject: ✅ GAM Sync Completed - Main Network

Your Google Ad Manager sync has completed successfully.

Data Source: Main GAM Network - Production
Network Code: 12345678
Report Types: Revenue, Inventory
Records Synced: 45,230
Duration: 4m 32s
Started: 2025-12-16 14:00:00 UTC
Completed: 2025-12-16 14:04:32 UTC

View Details: [Link to Dashboard]
```

**Failure Notification:**
```
Subject: ❌ GAM Sync Failed - Main Network

Your Google Ad Manager sync has failed.

Data Source: Main GAM Network - Production
Network Code: 12345678
Error: Rate limit exceeded

Troubleshooting Steps:
1. Check API quota usage
2. Verify network permissions
3. Review error logs in dashboard

View Details: [Link to Dashboard]
Contact Support: [Support Link]
```

---

## Exporting Data

### Available Export Formats

Export synced GAM data in multiple formats:

#### CSV Export

**Best for:** Excel analysis, data migration

1. Navigate to **Data Sources** → Your GAM connection
2. Click **"Export"** tab
3. Select **"CSV"** format
4. Configure export:
   - **Date Range:** Choose period to export
   - **Report Type:** Select specific report
   - **Fields:** Choose columns to include
5. Click **"Generate Export"**
6. Download CSV file when ready

**CSV Structure:**
```csv
date,ad_unit_id,ad_unit_name,country,total_earnings,impressions,clicks,ctr,ecpm
2025-12-01,123456,Homepage,US,450.25,125000,450,0.36,3.60
2025-12-01,123457,Article Page,US,320.80,95000,280,0.29,3.38
```

#### Excel Export (XLSX)

**Best for:** Formatted reports, pivot tables

1. Select **"Excel"** format
2. Configure options:
   - **Include Charts:** Add visual summaries
   - **Formatting:** Apply styles and colors
   - **Multiple Sheets:** One sheet per report type
3. Generate and download

**Excel Features:**
- Pre-formatted columns
- Automatic number formatting
- Header row styling
- Optional pivot tables

#### JSON Export

**Best for:** API integrations, custom applications

1. Select **"JSON"** format
2. Configure structure:
   - **Nested Objects:** Hierarchical structure
   - **Flat Array:** Simple list format
3. Generate and download

**JSON Structure:**
```json
{
  "export_metadata": {
    "data_source": "Main GAM Network",
    "network_code": "12345678",
    "date_range": {
      "start": "2025-12-01",
      "end": "2025-12-31"
    },
    "exported_at": "2025-12-16T14:30:00Z"
  },
  "data": [
    {
      "date": "2025-12-01",
      "ad_unit_id": "123456",
      "ad_unit_name": "Homepage",
      "total_earnings": 450.25,
      "impressions": 125000
    }
  ]
}
```

### Scheduled Exports

Automate regular exports:

1. Click **"Schedule Export"** button
2. Configure schedule:
   - **Frequency:** Daily, Weekly, Monthly
   - **Format:** CSV, Excel, JSON
   - **Delivery:** Email or cloud storage
3. Save schedule

**Email Delivery:**
- Exports sent as attachments (up to 25MB)
- Larger exports: Download link provided

### Export History

Track all exports:

1. Click **"Export History"** tab
2. View past exports with:
   - Export Date
   - Format
   - File Size
   - Download Link (available for 30 days)

---

## Using GAM Data in AI Data Modeler

### Creating Data Models

Leverage GAM data in custom models:

#### Step 1: Access Data Modeler

1. Navigate to **AI Data Modeler**
2. Click **"Create New Model"**

#### Step 2: Select Data Source

1. Choose **"Google Ad Manager"** from available sources
2. Select your connected GAM network
3. Choose tables/reports to include:
   - `revenue_{network_id}`
   - `inventory_{network_id}`
   - `orders_{network_id}`
   - `geography_{network_id}`
   - `device_{network_id}`

#### Step 3: Build Model with AI

Use natural language to create models:

**Example Prompts:**

```
"Show me total revenue by ad unit for the last 30 days"

"Compare mobile vs desktop performance with impressions and CTR"

"Find top performing ad units by eCPM in the US"

"Create a report showing daily revenue trends with forecast"
```

**AI Data Modeler Features:**
- Automatic JOIN creation across tables
- Smart field selection
- Calculated metrics (CTR, eCPM, fill rate)
- Aggregations and grouping
- Filtering and sorting

#### Step 4: Refine and Save

1. Review the generated model
2. Adjust fields, filters, or calculations
3. Test with sample data
4. Save the model with a descriptive name
5. Share with team members

### Sample Data Models

**1. Revenue Performance Dashboard**
```sql
-- Generated by AI Data Modeler
SELECT 
  date,
  ad_unit_name,
  SUM(total_earnings) as revenue,
  SUM(impressions) as impressions,
  ROUND(SUM(total_earnings) / SUM(impressions) * 1000, 2) as ecpm
FROM dra_google_ad_manager.revenue_12345678
WHERE date >= CURRENT_DATE - INTERVAL '30 days'
GROUP BY date, ad_unit_name
ORDER BY revenue DESC;
```

**2. Geographic Performance**
```sql
-- Top countries by revenue
SELECT 
  country,
  SUM(total_earnings) as total_revenue,
  SUM(impressions) as total_impressions,
  ROUND(AVG(ctr), 4) as avg_ctr
FROM dra_google_ad_manager.geography_12345678
GROUP BY country
HAVING SUM(impressions) > 10000
ORDER BY total_revenue DESC
LIMIT 20;
```

**3. Device Performance Comparison**
```sql
-- Mobile vs Desktop
SELECT 
  device_category,
  COUNT(DISTINCT date) as days,
  SUM(total_earnings) as revenue,
  ROUND(AVG(ecpm), 2) as avg_ecpm,
  ROUND(AVG(fill_rate) * 100, 2) as avg_fill_rate
FROM dra_google_ad_manager.device_12345678
WHERE date >= CURRENT_DATE - INTERVAL '7 days'
GROUP BY device_category
ORDER BY revenue DESC;
```

---

## Best Practices

### Sync Configuration

**1. Choose Appropriate Frequency**

- **Real-time Dashboards:** Hourly syncs
- **Daily Reports:** Daily syncs at off-peak hours
- **Historical Analysis:** Weekly or monthly syncs
- **Cost Optimization:** Less frequent syncs reduce API usage

**2. Optimize Date Ranges**

- Initial setup: Last 90 days for historical context
- Ongoing syncs: Last 7-30 days to minimize data volume
- Avoid overlapping ranges to prevent duplicates

**3. Select Relevant Report Types**

- Only sync reports you actively use
- Disable unused reports to improve sync speed
- Add new reports as needs evolve

### Data Management

**1. Regular Monitoring**

- Check sync status daily
- Review error notifications promptly
- Monitor API quota usage

**2. Data Retention**

- Keep 90-365 days of data for trend analysis
- Archive older data if not needed
- Use exports for long-term storage

**3. Performance Optimization**

- Enable incremental sync for large datasets
- Use dimension filters to reduce data volume
- Schedule syncs during low-traffic hours

### Security

**1. Access Control**

- Limit GAM connection access to authorized users
- Use read-only GAM roles when possible
- Regularly review OAuth tokens

**2. Data Privacy**

- Comply with GDPR and data protection regulations
- Mask or exclude sensitive data if needed
- Use secure export methods

### Troubleshooting

**1. Failed Syncs**

- Check error message in sync history
- Verify OAuth token is valid
- Confirm API quotas not exceeded
- Review GAM network permissions

**2. Missing Data**

- Verify date range configuration
- Check report type selection
- Ensure ad units are active in GAM
- Confirm data exists in GAM for the period

**3. Performance Issues**

- Reduce date range
- Decrease sync frequency
- Enable incremental sync
- Contact support for optimization

---

## Common Use Cases

### 1. Executive Revenue Dashboard

**Objective:** Track daily revenue performance

**Setup:**
- Sync: Hourly
- Reports: Revenue, Geography
- Date Range: Last 30 days

**Data Model:**
```
"Show me daily revenue, impressions, and eCPM trends 
with comparison to previous period"
```

**Visualizations:**
- Line chart: Revenue over time
- Bar chart: Top ad units by revenue
- Map: Revenue by country
- KPI cards: Total revenue, avg eCPM, growth rate

---

### 2. Inventory Utilization Analysis

**Objective:** Optimize ad inventory

**Setup:**
- Sync: Daily
- Reports: Inventory, Device
- Date Range: Last 90 days

**Data Model:**
```
"Analyze fill rates and available impressions by ad unit 
and device category, identify underutilized inventory"
```

**Insights:**
- Find ad units with low fill rates
- Identify high-demand placements
- Optimize pricing strategies

---

### 3. Campaign Performance Tracking

**Objective:** Monitor advertiser campaigns

**Setup:**
- Sync: Daily
- Reports: Orders, Revenue
- Date Range: Current month

**Data Model:**
```
"Track line item delivery, pacing, and revenue by advertiser 
for active campaigns"
```

**Metrics:**
- Delivery progress
- Revenue per advertiser
- Campaign pacing
- Forecasted completion

---

### 4. Geographic Expansion Analysis

**Objective:** Identify growth opportunities

**Setup:**
- Sync: Weekly
- Reports: Geography, Device
- Date Range: Last 12 months

**Data Model:**
```
"Compare revenue, impressions, and eCPM across countries 
month-over-month, identify emerging markets"
```

**Analysis:**
- Revenue trends by country
- Growth rates
- Market penetration
- Expansion opportunities

---

### 5. Cross-Platform Analytics

**Objective:** Unified digital analytics

**Setup:**
- GAM + Google Analytics + CRM
- Sync: Daily
- Combined data models

**Data Model:**
```
"Join GAM revenue with GA sessions and CRM customer data 
to calculate revenue per user and lifetime value"
```

**Unified Metrics:**
- Revenue per session
- Customer acquisition cost
- Lifetime value
- Marketing ROI

---

## Support

### Getting Help

**Documentation:**
- [API Integration Guide](./GAM_API_INTEGRATION_GUIDE.md)
- [Report Types Reference](./GAM_REPORT_TYPES_REFERENCE.md)
- [Troubleshooting Guide](./GAM_TROUBLESHOOTING_GUIDE.md)

**Technical Support:**
- Email: support@dataresearchanalysis.com
- Help Center: https://help.dataresearchanalysis.com
- Community Forum: https://community.dataresearchanalysis.com

**Office Hours:**
- Monday-Friday: 9 AM - 6 PM EST
- Response Time: Within 24 hours

---

**Document Version:** 1.0  
**Last Updated:** December 16, 2025  
**Maintained By:** Data Research Analysis Team

