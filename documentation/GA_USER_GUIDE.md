# Getting Started with Google Analytics

**Complete User Guide for Google Analytics 4 Integration**

---

## Table of Contents

1. [Introduction](#introduction)
2. [Prerequisites](#prerequisites)
3. [Connecting Your Google Analytics Account](#connecting-your-google-analytics-account)
4. [Configuring Data Collection](#configuring-data-collection)
5. [Managing Data Syncs](#managing-data-syncs)
6. [Working with GA4 Data](#working-with-ga4-data)
7. [Data Export](#data-export)
8. [Using GA4 Data in AI Data Modeler](#using-ga4-data-in-ai-data-modeler)
9. [Best Practices](#best-practices)
10. [Common Use Cases](#common-use-cases)

---

## Introduction

The Google Analytics 4 (GA4) integration allows you to import website analytics data, user behavior metrics, and conversion tracking directly into the Data Research Analysis Platform. This integration enables you to:

- **Unified Analytics:** Combine GA4 data with other data sources (CRM, advertising, e-commerce)
- **Automated Data Syncs:** Schedule automatic data imports hourly, daily, or weekly
- **Custom Analysis:** Build custom dashboards and reports using the AI Data Modeler
- **Historical Data:** Access and analyze historical website performance
- **Cross-Platform Insights:** Merge GA4 data with other platforms for comprehensive attribution

---

## Prerequisites

Before connecting your Google Analytics account, ensure you have:

### Required Access

1. **Google Analytics 4 Property**
   - Access to a GA4 property (not Universal Analytics)
   - Minimum required role: **Viewer** (for read-only data access)
   - Recommended role: **Editor** or **Administrator**

2. **Google Account**
   - A Google account with access to your GA4 property
   - OAuth 2.0 consent for the application

3. **Platform Access**
   - Active account on Data Research Analysis Platform
   - Project created with appropriate permissions

### Permissions Needed

The integration requires the following Google API scope:
- `https://www.googleapis.com/auth/analytics.readonly` (Read-only access to Google Analytics)

This scope allows the application to:
- View Google Analytics properties you have access to
- Read analytics data and reports
- Access historical performance metrics
- View user behavior and traffic data

**Note:** The integration uses **read-only** access and cannot modify your GA4 configuration or data.

---

## Connecting Your Google Analytics Account

### Step 1: Navigate to Data Sources

1. Log in to the Data Research Analysis Platform
2. Navigate to your project
3. Click **"Data Sources"** in the sidebar
4. Click **"+ Add Data Source"** button

### Step 2: Select Google Analytics

1. Find **"Google Analytics"** in the list of available data sources
2. Click **"Connect"** to begin the setup wizard

### Step 3: Authenticate with Google

The connection wizard guides you through three main steps:

#### Authentication (Step 1)

1. Click **"Sign in with Google"** button
2. Select your Google account
3. Review the permissions requested:
   - View and download your Google Analytics data
   - See your primary Google Account email address
4. Click **"Allow"** to grant permissions

**Security Note:** Your credentials are securely stored and encrypted. The platform only requests read-only access to your GA4 data. Access tokens are refreshed automatically.

**OAuth Process:**
- The platform uses OAuth 2.0 for secure authentication
- Refresh tokens are stored encrypted in the database
- Access tokens expire after 1 hour and are automatically renewed
- You can revoke access at any time from your Google Account settings

#### Property Selection (Step 2)

1. After authentication, the platform fetches all GA4 properties you have access to
2. Review the list of available properties
3. Select the property you want to connect
4. View property details:
   - Property name and ID
   - Associated account
   - Time zone and currency settings (if configured)

**Property Format:** Properties are displayed in format "properties/123456789"

**Multiple Properties:** You can connect multiple GA4 properties by repeating this process. Each property becomes a separate data source.

#### Configuration (Step 3)

1. **Data Source Name:** Enter a descriptive name (e.g., "Website GA4 - Production")
2. **Sync Frequency:** Choose how often data should sync:
   - **Manual:** Only sync when you trigger it manually
   - **Hourly:** Sync every hour (recommended for real-time dashboards)
   - **Daily:** Sync once per day at midnight UTC
   - **Weekly:** Sync once per week on Sunday at midnight UTC

3. Review your configuration
4. Click **"Connect & Sync"** to:
   - Save the connection
   - Start the initial data sync

**Initial Sync Time:** The first sync may take 2-5 minutes depending on the amount of historical data. Default sync pulls the last 30 days of data.

---

## Configuring Data Collection

### Understanding GA4 Data Structure

Google Analytics 4 uses an event-based data model:
- **Dimensions:** Attributes of your data (date, country, page path, traffic source)
- **Metrics:** Quantitative measurements (users, sessions, page views, conversions)

The integration automatically syncs 6 predefined report types:

#### 1. Traffic Overview
**Purpose:** High-level traffic and engagement metrics

**Dimensions:**
- `date` - Report date
- `sessionSource` - Traffic source (google, direct, facebook, etc.)
- `sessionMedium` - Traffic medium (organic, cpc, referral, etc.)

**Metrics:**
- `sessions` - Total sessions
- `totalUsers` - Total users
- `newUsers` - First-time visitors
- `screenPageViews` - Page views
- `averageSessionDuration` - Avg. session duration (seconds)
- `bounceRate` - Bounce rate (%)

**Table:** `dra_google_analytics.traffic_overview_{data_source_id}`

#### 2. Page Performance
**Purpose:** Analyze individual page performance

**Dimensions:**
- `pagePath` - Page URL path
- `pageTitle` - Page title

**Metrics:**
- `screenPageViews` - Page views
- `averageSessionDuration` - Time on page (seconds)
- `bounceRate` - Page bounce rate (%)

**Table:** `dra_google_analytics.page_performance_{data_source_id}`

#### 3. User Acquisition
**Purpose:** Track how users first discovered your site

**Dimensions:**
- `date` - Report date
- `firstUserSource` - Initial traffic source
- `firstUserMedium` - Initial traffic medium
- `firstUserCampaignId` - Campaign ID (if applicable)

**Metrics:**
- `newUsers` - New users acquired
- `sessions` - Sessions from new users
- `engagementRate` - Engagement rate (%)
- `conversions` - Conversion count

**Table:** `dra_google_analytics.user_acquisition_{data_source_id}`

#### 4. Geographic Data
**Purpose:** Analyze traffic by location

**Dimensions:**
- `country` - Country name
- `city` - City name

**Metrics:**
- `totalUsers` - Total users
- `sessions` - Total sessions
- `screenPageViews` - Page views
- `averageSessionDuration` - Avg. session duration (seconds)

**Table:** `dra_google_analytics.geographic_{data_source_id}`

#### 5. Device & Technology
**Purpose:** Understand device and browser usage

**Dimensions:**
- `deviceCategory` - Device type (desktop, mobile, tablet)
- `operatingSystem` - OS (Windows, iOS, Android, etc.)
- `browser` - Browser (Chrome, Safari, Firefox, etc.)

**Metrics:**
- `totalUsers` - Total users
- `sessions` - Total sessions
- `screenPageViews` - Page views
- `bounceRate` - Bounce rate (%)

**Table:** `dra_google_analytics.device_{data_source_id}`

#### 6. Events
**Purpose:** Track custom events and conversions

**Dimensions:**
- `date` - Event date
- `eventName` - Event name (page_view, click, purchase, etc.)

**Metrics:**
- `eventCount` - Number of times event fired
- `eventValue` - Total event value
- `conversions` - Conversion count

**Table:** `dra_google_analytics.events_{data_source_id}`

### Date Range

By default, syncs pull data from the **last 30 days**. The integration uses relative date ranges:
- `startDate: '30daysAgo'`
- `endDate: 'today'`

**Historical Data:** Google Analytics 4 API provides data up to 14 months in the past. For older data, exports may be required.

---

## Managing Data Syncs

### Manual Sync

To trigger a sync manually:

1. Navigate to **Data Sources**
2. Find your Google Analytics connection
3. Click **"Sync Now"** button
4. Monitor sync progress in real-time

**Use Cases for Manual Sync:**
- After making changes to your website
- When you need immediate data updates
- Testing the connection
- One-time historical data pull

### Scheduled Syncs

Configure automatic syncs:

1. Go to your GA4 data source
2. Click **"Settings"** (gear icon)
3. Change **"Sync Frequency"**:
   - **Hourly:** Best for real-time dashboards
   - **Daily:** Standard for most use cases
   - **Weekly:** For historical/trend analysis
   - **Manual:** Full control over sync timing

4. Save changes

**Sync Behavior:**
- Hourly: Runs at minute 0 of every hour (1:00, 2:00, 3:00...)
- Daily: Runs at midnight UTC (00:00)
- Weekly: Runs Sunday at midnight UTC

### Monitoring Sync Status

**Real-time Status:**
1. Navigate to your data source
2. View the **"Last Sync"** timestamp
3. Check **"Sync Status"** indicator:
   - 🟢 **Success:** Sync completed without errors
   - 🔵 **In Progress:** Sync currently running
   - 🔴 **Failed:** Sync encountered an error
   - 🟡 **Partial:** Some data synced, some failed

**Sync History:**
1. Click **"View History"** button
2. See list of past syncs with:
   - Start time and duration
   - Status (success/failed)
   - Rows synced per table
   - Error messages (if any)

**Example Sync History:**
```
Dec 17, 2025 10:00 AM - Success (2m 34s)
  ✅ Traffic Overview: 720 rows
  ✅ Page Performance: 1,245 rows
  ✅ User Acquisition: 180 rows
  ✅ Geographic: 450 rows
  ✅ Device: 90 rows
  ✅ Events: 3,200 rows
  
Dec 17, 2025 09:00 AM - Success (2m 41s)
  ✅ Traffic Overview: 720 rows
  ...
```

### Troubleshooting Sync Issues

**Common Issues:**

1. **"Authentication Failed"**
   - Access token may have expired
   - Solution: Reconnect your account

2. **"Rate Limit Exceeded"**
   - GA4 API quota reached (15,000 requests/day)
   - Solution: Reduce sync frequency or wait for quota reset

3. **"No Data Returned"**
   - Property may have no traffic in the selected period
   - Check your GA4 property directly

4. **"Partial Sync"**
   - Some report types failed while others succeeded
   - Check error details in sync history
   - Retry sync for failed reports

See [GA_TROUBLESHOOTING_GUIDE.md](./GA_TROUBLESHOOTING_GUIDE.md) for detailed solutions.

---

## Working with GA4 Data

### Accessing Synced Data

All GA4 data is stored in PostgreSQL under the `dra_google_analytics` schema.

**Table Naming Convention:**
```
dra_google_analytics.{report_type}_{data_source_id}
```

**Example:**
- Data Source ID: 42
- Tables:
  - `dra_google_analytics.traffic_overview_42`
  - `dra_google_analytics.page_performance_42`
  - `dra_google_analytics.geographic_42`
  - etc.

### Querying Data

#### Direct SQL Queries

**Example: Get last 7 days of traffic:**
```sql
SELECT 
  date,
  SUM(sessions) as total_sessions,
  SUM(total_users) as total_users,
  SUM(new_users) as new_users
FROM dra_google_analytics.traffic_overview_42
WHERE date >= CURRENT_DATE - INTERVAL '7 days'
GROUP BY date
ORDER BY date DESC;
```

**Example: Top traffic sources:**
```sql
SELECT 
  session_source,
  session_medium,
  SUM(sessions) as total_sessions,
  SUM(total_users) as users
FROM dra_google_analytics.traffic_overview_42
WHERE date >= CURRENT_DATE - INTERVAL '30 days'
GROUP BY session_source, session_medium
ORDER BY total_sessions DESC
LIMIT 10;
```

**Example: Page performance:**
```sql
SELECT 
  page_path,
  page_title,
  screen_page_views,
  ROUND(average_session_duration, 2) as avg_duration,
  ROUND(bounce_rate, 2) as bounce_pct
FROM dra_google_analytics.page_performance_42
ORDER BY screen_page_views DESC
LIMIT 20;
```

#### Using AI Data Modeler

See [Using GA4 Data in AI Data Modeler](#using-ga4-data-in-ai-data-modeler) section below.

---

## Data Export

### Available Export Formats

Export your GA4 data in multiple formats:

1. **CSV** - Comma-separated values
2. **Excel (XLSX)** - Microsoft Excel format
3. **JSON** - JavaScript Object Notation

### Exporting Data

1. Navigate to your GA4 data source
2. Click **"Export"** button
3. Select **Export Options:**
   - **Report Type:** Choose which report to export
   - **Date Range:** Select time period
   - **Format:** CSV, Excel, or JSON
4. Click **"Generate Export"**
5. Download file when ready

**Export Limits:**
- Maximum 10,000 rows per export
- Files expire after 7 days
- Large exports may take 1-2 minutes to generate

### Scheduled Exports

Set up recurring exports:

1. Click **"Schedule Export"**
2. Configure:
   - **Frequency:** Daily, Weekly, Monthly
   - **Format:** CSV, Excel, JSON
   - **Recipients:** Email addresses
3. Exports are automatically emailed on schedule

**Email Example:**
```
Subject: GA4 Data Export - Traffic Overview

Your scheduled Google Analytics export is ready.

Report: Traffic Overview
Period: Dec 1 - Dec 15, 2025
Rows: 4,320
Format: CSV

[Download Export] (link valid for 7 days)
```

---

## Using GA4 Data in AI Data Modeler

### Creating Data Models with GA4

The AI Data Modeler allows you to create custom reports using natural language:

#### Step 1: Access Data Modeler

1. Navigate to **AI Data Modeler**
2. Click **"Create New Model"**

#### Step 2: Select GA4 Data Source

1. Choose **"Google Analytics"** from available sources
2. Select your connected GA4 property
3. Choose tables to include

#### Step 3: Build Model with AI

Use natural language to describe your analysis:

**Example Prompts:**

**Traffic Analysis:**
```
"Show me daily sessions and users for the last 30 days"
```

**AI Generated Model:**
```sql
SELECT 
  date,
  SUM(sessions) as total_sessions,
  SUM(total_users) as total_users,
  SUM(new_users) as new_users,
  ROUND(AVG(bounce_rate), 2) as avg_bounce_rate
FROM dra_google_analytics.traffic_overview_42
WHERE date >= CURRENT_DATE - INTERVAL '30 days'
GROUP BY date
ORDER BY date;
```

**Source Attribution:**
```
"Compare sessions by traffic source and show conversion rates"
```

**AI Generated Model:**
```sql
SELECT 
  t.session_source,
  t.session_medium,
  SUM(t.sessions) as total_sessions,
  SUM(u.conversions) as total_conversions,
  ROUND(
    (SUM(u.conversions)::DECIMAL / NULLIF(SUM(t.sessions), 0)) * 100, 
    2
  ) as conversion_rate
FROM dra_google_analytics.traffic_overview_42 t
LEFT JOIN dra_google_analytics.user_acquisition_42 u
  ON t.date = u.date 
  AND t.session_source = u.first_user_source
WHERE t.date >= CURRENT_DATE - INTERVAL '30 days'
GROUP BY t.session_source, t.session_medium
ORDER BY total_sessions DESC;
```

**Geographic Insights:**
```
"Show me top 10 countries by users with average session duration"
```

**AI Generated Model:**
```sql
SELECT 
  country,
  SUM(total_users) as total_users,
  SUM(sessions) as total_sessions,
  ROUND(AVG(average_session_duration), 2) as avg_duration,
  SUM(screen_page_views) as total_pageviews
FROM dra_google_analytics.geographic_42
GROUP BY country
ORDER BY total_users DESC
LIMIT 10;
```

### Combining GA4 with Other Data Sources

**Example: Join GA4 with CRM Data**

```
"Show me sessions and revenue by marketing campaign,
joining Google Analytics with Salesforce opportunities"
```

**AI Generated Model:**
```sql
SELECT 
  ua.first_user_campaign_id as campaign,
  COUNT(DISTINCT ua.date) as days_active,
  SUM(ua.sessions) as total_sessions,
  SUM(ua.new_users) as new_users,
  COUNT(DISTINCT opp.id) as opportunities,
  SUM(opp.amount) as total_revenue,
  ROUND(
    SUM(opp.amount) / NULLIF(SUM(ua.new_users), 0), 
    2
  ) as revenue_per_user
FROM dra_google_analytics.user_acquisition_42 ua
LEFT JOIN salesforce.opportunities opp
  ON ua.first_user_campaign_id = opp.campaign_id
  AND opp.created_date >= ua.date
WHERE ua.date >= CURRENT_DATE - INTERVAL '30 days'
GROUP BY ua.first_user_campaign_id
ORDER BY total_revenue DESC;
```

---

## Best Practices

### Sync Configuration

**1. Choose Appropriate Frequency**
- **Hourly:** Real-time dashboards, time-sensitive reporting
- **Daily:** Standard analytics, day-over-day comparisons
- **Weekly:** Historical trends, month-over-month analysis
- **Manual:** Ad-hoc analysis, testing

**2. Monitor API Quota**
- GA4 API has a daily limit of 15,000 requests
- Each sync uses ~60-100 requests (depending on data volume)
- Hourly syncs: ~2,400 requests/day (well within limits)
- Reduce frequency if quota issues occur

**3. Plan for Data Freshness**
- GA4 data has a 24-48 hour processing delay for some metrics
- Real-time reports show recent data but may be incomplete
- Use daily syncs for accurate historical reporting

### Data Management

**1. Regular Monitoring**
- Check sync status daily
- Review error notifications
- Verify data completeness

**2. Data Retention**
- GA4 retains data for 14 months by default
- Export historical data before it expires
- Archive old exports for long-term storage

**3. Query Optimization**
- Always include date filters in queries
- Use indexed columns (date, source, country)
- Aggregate data before complex joins

### Security

**1. Access Control**
- Limit GA4 connection access to authorized users
- Use read-only GA4 roles when possible
- Regularly review OAuth tokens

**2. Data Privacy**
- Ensure compliance with GDPR and privacy regulations
- Mask or exclude PII if needed
- Review GA4 data retention settings

---

## Common Use Cases

### 1. Executive Dashboard

**Objective:** Track key website performance metrics

**Setup:**
- Sync: Daily
- Reports: Traffic Overview, Page Performance
- Metrics: Sessions, Users, Bounce Rate, Conversions

**Data Model:**
```
"Create an executive dashboard showing:
- Daily sessions and users (7-day trend)
- Traffic sources breakdown (pie chart)
- Top 5 pages by views
- Bounce rate and session duration averages"
```

**Visualizations:**
- Line chart: Sessions over time
- Pie chart: Traffic by source/medium
- Table: Top pages
- KPI cards: Key metrics

---

### 2. Marketing Attribution

**Objective:** Analyze campaign performance and ROI

**Setup:**
- Sync: Daily
- Reports: User Acquisition, Traffic Overview, Events (conversions)
- Combined: GA4 + Advertising spend data

**Data Model:**
```
"Show marketing attribution:
- New users by campaign and source
- Conversion count per campaign
- Cost per acquisition (if spend data available)
- Return on ad spend"
```

**Metrics:**
- Acquisition rate by channel
- Conversion rate by campaign
- Revenue per user by source

---

### 3. Content Performance Analysis

**Objective:** Understand which content performs best

**Setup:**
- Sync: Weekly
- Reports: Page Performance
- Analysis: Page views, time on page, bounce rate

**Data Model:**
```
"Analyze content performance:
- Top 20 pages by views
- Pages with longest session duration
- Pages with highest bounce rate
- Trending content (week-over-week growth)"
```

**Insights:**
- Identify high-performing content
- Find pages needing improvement
- Optimize content strategy

---

### 4. User Behavior Tracking

**Objective:** Track user journeys and engagement

**Setup:**
- Sync: Daily
- Reports: Events, Page Performance, Traffic Overview
- Analysis: Event sequences, path analysis

**Data Model:**
```
"Track user behavior:
- Most common events by user type
- Event conversion funnel
- Average events per session
- High-value user segments"
```

**Applications:**
- Optimize user flows
- Identify drop-off points
- Improve conversion rates

---

### 5. Geographic Expansion Planning

**Objective:** Identify growth opportunities by region

**Setup:**
- Sync: Weekly
- Reports: Geographic, Device
- Analysis: Regional performance, device preferences

**Data Model:**
```
"Analyze geographic performance:
- Users and sessions by country
- Engagement rate by region
- Device category preferences by country
- Identify high-growth markets"
```

**Strategy:**
- Target underserved markets
- Localize content for top regions
- Optimize for regional device preferences

---

## Support

### Getting Help

**Documentation:**
- [Report Types Reference](./GA_REPORT_TYPES_REFERENCE.md)
- [API Integration Guide](./GA_API_INTEGRATION_GUIDE.md)
- [Troubleshooting Guide](./GA_TROUBLESHOOTING_GUIDE.md)

**Technical Support:**
- Email: support@dataresearchanalysis.com
- Help Center: https://help.dataresearchanalysis.com
- Community Forum: https://community.dataresearchanalysis.com

**Office Hours:**
- Monday-Friday: 9 AM - 6 PM EST
- Response Time: Within 24 hours

---

**Document Version:** 1.0  
**Last Updated:** December 17, 2025  
**Maintained By:** Data Research Analysis Team
