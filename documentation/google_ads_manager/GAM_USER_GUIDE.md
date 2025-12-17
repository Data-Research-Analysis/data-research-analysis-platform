# Google Ad Manager - User Guide

**Getting Started with Google Ad Manager Integration**

> **Current Implementation**: This guide describes the **simplified v1.0 release** with core features only.
>
> For complete feature status, see [`CURRENT_IMPLEMENTATION_STATUS.md`](./CURRENT_IMPLEMENTATION_STATUS.md)

---

## Table of Contents

1. [Introduction](#introduction)
2. [Prerequisites](#prerequisites)
3. [Connecting Your GAM Account](#connecting-your-gam-account)
4. [Using GAM Data in AI Data Modeler](#using-gam-data-in-ai-data-modeler)
5. [Best Practices](#best-practices)
6. [Common Use Cases](#common-use-cases)
7. [Support](#support)

---

## Introduction

The Google Ad Manager (GAM) integration allows you to import advertising performance data directly into the Data Research Analysis Platform. This integration enables you to:

- **Unified Reporting**: Combine GAM data with Google Analytics, CRM, and other data sources
- **Automated Syncs**: Schedule automatic data imports daily or weekly
- **Custom Analytics**: Build custom dashboards and reports using the AI Data Modeler
- **Historical Analysis**: Access and analyze historical advertising performance

### Available in v1.0

- ✅ OAuth 2.0 authentication
- ✅ Network selection
- ✅ **Revenue Report**: Ad revenue, impressions, clicks, CPM, CTR
- ✅ **Geography Report**: Country, region, city performance
- ✅ Sync frequencies: Daily, Weekly, Manual
- ✅ Fixed date range: Last 30 days

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

**Security Note**: Your credentials are securely stored and encrypted. The platform only requests read-only access to your GAM data.

### Step 4: Select Your Network

1. After authentication, you'll see a list of GAM networks you have access to
2. Select the network you want to connect
3. Review the network details:
   - Network Code
   - Network Name
   - Display Name
   - Time Zone

### Step 5: Configure Data Source

1. **Connection Name**: Enter a descriptive name (e.g., "Main GAM Network - Production")
2. **Report Types**: Select which reports to sync:
   - ☑ Revenue Report
   - ☑ Geography Report
3. **Sync Frequency**: Choose how often to sync:
   - Manual: On-demand only
   - Daily: Every day at 2:00 AM
   - Weekly: Every Sunday at 2:00 AM

**Note**: Date range is fixed at "Last 30 days" in v1.0.

### Step 6: Complete Setup

1. Review your configuration
2. Click **"Connect & Sync"** to:
   - Save the connection
   - Start the initial data sync
3. You'll be redirected to the sync status page

**Initial Sync Time**: Depending on the amount of data, initial sync may take 2-5 minutes.

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
   - `geography_{network_id}`

#### Step 3: Build Model with AI

Use natural language to create models:

**Example Prompts**:

```
"Show me total revenue by ad unit for the last 30 days"

"Compare mobile vs desktop performance with impressions and CTR"

"Find top performing ad units by CPM in the US"

"Create a report showing daily revenue trends"
```

**AI Data Modeler Features**:
- Automatic JOIN creation across tables
- Smart field selection
- Calculated metrics (CTR, CPM)
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
SELECT 
  date,
  ad_unit_name,
  SUM(revenue) as total_revenue,
  SUM(impressions) as impressions,
  ROUND(SUM(revenue) / SUM(impressions) * 1000, 2) as cpm
FROM dra_google_ad_manager.revenue_12345678
WHERE date >= CURRENT_DATE - INTERVAL '30 days'
GROUP BY date, ad_unit_name
ORDER BY total_revenue DESC;
```

**2. Geographic Performance**
```sql
SELECT 
  country_name,
  SUM(revenue) as total_revenue,
  SUM(impressions) as total_impressions,
  ROUND(AVG(ctr), 4) as avg_ctr
FROM dra_google_ad_manager.geography_12345678
GROUP BY country_name
HAVING SUM(impressions) > 10000
ORDER BY total_revenue DESC
LIMIT 20;
```

---

## Best Practices

### Sync Configuration

**1. Choose Appropriate Frequency**

- **Daily Reports**: Daily syncs at 2:00 AM (recommended)
- **Weekly Analysis**: Weekly syncs on Sunday at 2:00 AM
- **Ad-hoc Analysis**: Manual syncs on demand

**2. Monitor Sync Status**

- Check sync status in Data Sources list
- Review sync history for errors
- Ensure syncs complete successfully

**3. Select Relevant Report Types**

- Only sync reports you actively use
- Start with Revenue report for basic needs
- Add Geography report for location insights

### Data Management

**1. Regular Monitoring**

- Check sync status weekly
- Review data quality in AI Data Modeler
- Monitor for any API quota issues

**2. Data Retention**

- Platform stores last 30 days automatically
- Use exports for long-term storage if needed
- Create snapshots of important data models

### Security

**1. Access Control**

- Limit GAM connection access to authorized users
- Use read-only GAM roles when possible
- Regularly review OAuth tokens

**2. Data Privacy**

- Comply with GDPR and data protection regulations
- Be aware of what data is being synced
- Use secure export methods

---

## Common Use Cases

### 1. Executive Revenue Dashboard

**Objective**: Track daily revenue performance

**Setup**:
- Sync: Daily
- Reports: Revenue, Geography
- Date Range: Last 30 days

**Data Model**:
```
"Show me daily revenue, impressions, and CPM trends 
with comparison to previous period"
```

**Visualizations**:
- Line chart: Revenue over time
- Bar chart: Top ad units by revenue
- Map: Revenue by country
- KPI cards: Total revenue, avg CPM, growth rate

---

### 2. Geographic Expansion Analysis

**Objective**: Identify growth opportunities

**Setup**:
- Sync: Weekly
- Reports: Geography
- Date Range: Last 30 days

**Data Model**:
```
"Compare revenue and impressions across countries, 
show month-over-month growth"
```

**Analysis**:
- Revenue trends by country
- Growth rates
- Market penetration
- Expansion opportunities

---

### 3. Cross-Platform Analytics

**Objective**: Unified digital analytics

**Setup**:
- GAM + Google Analytics + CRM
- Sync: Daily
- Combined data models

**Data Model**:
```
"Join GAM revenue with GA sessions and CRM customer data 
to calculate revenue per user"
```

**Unified Metrics**:
- Revenue per session
- Customer acquisition cost
- Lifetime value
- Marketing ROI

---

## Support

### Getting Help

**Documentation**:
- [Current Implementation Status](./CURRENT_IMPLEMENTATION_STATUS.md)
- [Report Types Reference](./GAM_REPORT_TYPES_REFERENCE.md)
- [Troubleshooting Guide](./GAM_TROUBLESHOOTING_GUIDE.md)
- [Quick Reference](./QUICK_REFERENCE_GAM.md)

**Technical Support**:
- Email: support@dataresearchanalysis.com
- Help Center: https://help.dataresearchanalysis.com
- Community Forum: https://community.dataresearchanalysis.com

**Office Hours**:
- Monday-Friday: 9 AM - 6 PM EST
- Response Time: Within 24 hours

---

## Frequently Asked Questions

**Q: Why can't I select hourly sync?**  
A: Hourly sync is not available in v1.0. Daily and weekly syncs are sufficient for most use cases.

**Q: Where can I set custom date ranges?**  
A: Custom date ranges are not available in v1.0. The fixed "Last 30 days" preset is used.

**Q: Why don't I see Inventory, Orders, or Device reports?**  
A: Only Revenue and Geography reports are available in v1.0. Additional reports are planned for future releases.

**Q: Where is the admin dashboard?**  
A: There is no pre-built dashboard. Use AI Data Modeler to create custom dashboards tailored to your needs.

**Q: Can I sync multiple networks?**  
A: Yes! Add each network as a separate data source connection.

---

**Document Version**: 2.0 (Updated for Simplified Release)  
**Last Updated**: December 17, 2025  
**Status**: Current Implementation
