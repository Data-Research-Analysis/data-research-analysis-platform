# Getting Started with Google Ads

> **Last reviewed:** 2026-10-22 (Google Ads API v25, 11 sync types, MCC support).

**Complete User Guide for Google Ads Integration**

---

## Table of Contents

1. [Introduction](#introduction)
2. [Prerequisites](#prerequisites)
3. [Connecting Your Google Ads Account](#connecting-your-google-ads-account)
4. [Configuring Data Collection](#configuring-data-collection)
5. [Managing Data Syncs](#managing-data-syncs)
6. [Working with Google Ads Data](#working-with-google-ads-data)
7. [Using Google Ads Data in AI Data Modeler](#using-google-ads-data-in-ai-data-modeler)
8. [Best Practices](#best-practices)
9. [Common Use Cases](#common-use-cases)

---

## Introduction

The Google Ads integration allows you to import campaign performance data, keyword metrics, and advertising analytics directly into the Data Research Analysis Platform. This integration enables you to:

- **Unified Analytics:** Combine Google Ads data with CRM, revenue, and web analytics
- **ROI Tracking:** Calculate true return on ad spend by joining with sales data
- **Automated Data Syncs:** Import data on-demand with configurable date ranges
- **Custom Analysis:** Build custom dashboards and reports using the AI Data Modeler
- **Cross-Channel Attribution:** Merge Google Ads data with other marketing platforms

---

## Prerequisites

Before connecting your Google Ads account, ensure you have:

### Required Access

1. **Google Ads Account**
   - Access to an active Google Ads account
   - Minimum required role: **Standard Access** (for read-only data access)
   - Recommended role: **Admin** for full account visibility

2. **Google Account**
   - A Google account with access to your Google Ads account
   - OAuth 2.0 consent for the application
   - Developer token configured (handled by platform)

3. **Platform Access**
   - Active account on Data Research Analysis Platform
   - Project created with appropriate permissions

### Permissions Needed

The integration requires the following Google API scope:
- `https://www.googleapis.com/auth/adwords` (Read access to Google Ads)

This scope allows the application to:
- View Google Ads accounts you have access to
- Read campaign performance data
- Access keyword metrics and Quality Scores
- View geographic and device performance
- Read historical advertising data

**Note:** The integration uses **read-only** access and cannot modify your Google Ads campaigns or settings.

---

## Connecting Your Google Ads Account

### Step 1: Navigate to Data Sources

1. Log in to the Data Research Analysis Platform
2. Navigate to your project
3. Click **"Data Sources"** in the sidebar
4. Click **"+ Add Data Source"** button

### Step 2: Select Google Ads

1. Find **"Google Ads"** in the list of available data sources
2. Click **"Connect"** to begin the setup wizard

### Step 3: Authenticate with Google

The connection wizard guides you through three main steps:

#### Authentication (Step 1)

1. Click **"Sign in with Google"** button
2. Select your Google account
3. Review the permissions requested:
   - View and download your Google Ads data
   - See your primary Google Account email address
4. Click **"Allow"** to grant permissions

**Security Note:** Your credentials are securely stored and encrypted. The platform only requests read-only access to your Google Ads data. Access tokens are refreshed automatically.

**OAuth Process:**
- The platform uses OAuth 2.0 for secure authentication
- Refresh tokens are stored encrypted in the database
- Access tokens expire after 1 hour and are automatically renewed
- You can revoke access at any time from your Google Account settings

#### Account Selection (Step 2)

1. After authentication, the platform fetches all Google Ads accounts you have access to
2. Review the list of available accounts
3. Select the account you want to connect
4. View account details:
   - Customer ID (format: 123-456-7890)
   - Account name
   - Currency code
   - Time zone

**Account Format:** Accounts are displayed with their Customer ID and descriptive name

**Multiple Accounts:** You can connect multiple Google Ads accounts by repeating this process. Each account becomes a separate data source.

#### Configuration (Step 3)

1. **Data Source Name:** Enter a descriptive name (e.g., "Google Ads - Q4 Campaigns")

2. **Report Types:** Select any of the 11 sync types:
   - ☑ Campaign settings, ad groups, ads, conversion actions
   - ☑ Campaign and ad-group performance
   - ☑ Demographic, device, geographic, placement, and keyword performance
   - Leave all selected for the default full sync.

3. **Date Range:** Choose the historical data period:
   - **Last 30 days** - Recent performance data
   - **Last 90 days** - Quarterly analysis
   - **Custom Range** - Specify exact start and end dates

4. Review your configuration
5. Click **"Connect & Sync"** to:
   - Save the connection
   - Start the initial data sync

**Initial Sync Time:** The first sync may take 2-5 minutes depending on the amount of data and number of report types selected.

---

## Configuring Data Collection

> **Last reviewed:** 2026-10-22. The connector uses Google Ads API **v25** and supports manager (MCC) accounts.

### Understanding Google Ads Data Structure

Google Ads data is split into **settings** tables (campaigns, ad groups, ads, conversion actions) and **daily performance** tables (campaign, ad group, demographic, device, geographic, placement, keyword).

The integration supports **11 sync types**:

| Sync type | What it gives you | Typical use |
|---|---|---|
| `campaigns` | Campaign settings: budget, bidding strategy, status, channel type, start/end dates | Budget and structure audits |
| `ad_groups` | Ad group settings and CPC bid | Ad group structure/bid review |
| `ads` | Ad headlines, descriptions, final URLs, ad type | Creative and landing-page audits |
| `insights` | Campaign daily performance | ROAS, CPA, spend trends |
| `ad_group_insights` | Ad group daily performance | Ad group optimization |
| `demographic_insights` | Age range + gender performance | Audience targeting |
| `device_insights` | Device performance | Device bid adjustments |
| `geographic_insights` | Country/region/city performance | Geo expansion and budget allocation |
| `placement_insights` | Network/placement/slot performance | Placement exclusions |
| `keyword_insights` | Keyword performance + Quality Score | Keyword and match-type optimization |
| `conversion_actions` | Conversion action configuration, attribution, lookbacks | Conversion tracking audits |

Each sync type gets its own table in the `dra_google_ads` schema. Physical table names are hash-based (`ds{data_source_id}_{hash}`); the UI shows the logical name. See [GA_REPORT_TYPES_REFERENCE.md](GA_REPORT_TYPES_REFERENCE.md) for exact columns.

### Manager (MCC) accounts

If you select a manager account, the connector detects it and expands its client accounts (up to 10). Each client account is synced into its own tables, and `customer_id` identifies the client. Metrics cannot be requested directly from a manager account — that is why the expansion happens automatically.

### Date Range

Date ranges determine how much historical data is synced:
- **Last 30 days:** default; recent performance for quick analysis
- **Last 90 days:** quarterly trends and seasonal patterns
- **Custom:** specific campaign date ranges or historical backfills

**Google Ads API limits:** historical data is available up to 25 months in the past.

### Date Range

Date ranges determine how much historical data is synced:
- **Last 30 days:** Recent performance for quick analysis
- **Last 90 days:** Quarterly trends and seasonal patterns
- **Custom:** Specific campaign date ranges or historical backfills

**Google Ads API Limits:** Historical data available up to 25 months in the past.

---

## Managing Data Syncs

### Manual Sync

To trigger a sync manually:

1. Navigate to **Data Sources**
2. Find your Google Ads connection
3. Click **"Sync Now"** button
4. Monitor sync progress in real-time

**Use Cases for Manual Sync:**
- After launching new campaigns
- When you need immediate updated data
- Testing the connection
- One-time historical data pull

### Monitoring Sync Status

**Real-time Status:**
1. Navigate to your data source
2. View the **"Last Sync"** timestamp
3. Check **"Sync Status"** indicator:
   - 🟢 **Success:** Sync completed without errors
   - 🔵 **In Progress:** Sync currently running
   - 🔴 **Failed:** Sync encountered an error
   - 🟡 **Partial:** Some data synced, some failed

**Sync Progress:**
Shows number of records synced per report type:
```
Campaign Performance: 720 rows
Keyword Performance: 3,450 rows
Geographic Performance: 280 rows
Device Performance: 90 rows
```

### Troubleshooting Sync Issues

**Common Issues:**

1. **"Authentication Failed"**
   - Access token may have expired
   - Solution: Reconnect your account

2. **"Rate Limit Exceeded"**
   - Google Ads API quota reached
   - Solution: Wait for quota reset or reduce data volume

3. **"No Data Returned"**
   - Account may have no traffic in the selected period
   - Check your Google Ads account directly

4. **"Customer ID Not Found"**
   - Account may have been deleted or access revoked
   - Reconnect with valid account

---

## Working with Google Ads Data

### Accessing Synced Data

All Google Ads data is stored in PostgreSQL under the `dra_google_ads` schema. Physical tables are hash-named per data source and sync type; the logical name (`insights`, `keyword_insights`, `geographic_insights`, …) is stored in `dra_table_metadata`.

**Table Naming Convention:**
```
dra_google_ads."ds{data_source_id}_{md5[:8]}"
```

**Example (Data Source ID 42):**
- `dra_google_ads."ds42_ab12cd34"` — `insights` (campaign daily performance)
- `dra_google_ads."ds42_bc23de45"` — `keyword_insights`
- `dra_google_ads."ds42_cd34ef56"` — `geographic_insights`
- `dra_google_ads."ds42_de45fa67"` — `device_insights`

Settings tables (`campaigns`, `ad_groups`, `ads`, `conversion_actions`) are separate physical tables.

### Querying Data

#### Direct SQL Queries

**Example: Campaign performance last 7 days:**
```sql
SELECT
  date_start,
  campaign_name,
  SUM(spend) AS total_spend,
  SUM(conversions) AS total_conversions,
  SUM(conversion_value) AS total_revenue,
  ROUND(SUM(conversion_value) / NULLIF(SUM(spend), 0), 2) AS roas
FROM dra_google_ads."ds42_ab12cd34"
WHERE date_start >= CURRENT_DATE - INTERVAL '7 days'
GROUP BY date_start, campaign_name
ORDER BY date_start DESC, total_spend DESC;
```

**Example: Top keywords by conversions:**
```sql
SELECT
  keyword_text,
  match_type,
  SUM(clicks) AS total_clicks,
  SUM(spend) AS total_spend,
  SUM(conversions) AS total_conversions,
  ROUND(AVG(quality_score), 1) AS avg_quality_score,
  ROUND(SUM(spend) / NULLIF(SUM(conversions), 0), 2) AS cost_per_conversion
FROM dra_google_ads."ds42_bc23de45"
WHERE date_start >= CURRENT_DATE - INTERVAL '30 days'
  AND conversions > 0
GROUP BY keyword_text, match_type
ORDER BY total_conversions DESC
LIMIT 20;
```

**Example: Geographic ROI analysis:**
```sql
SELECT
  country,
  SUM(spend) AS ad_spend,
  SUM(conversions) AS conversions,
  SUM(conversion_value) AS revenue,
  ROUND((SUM(conversion_value) - SUM(spend)) / NULLIF(SUM(spend), 0) * 100, 2) AS roi_percent
FROM dra_google_ads."ds42_cd34ef56"
WHERE date_start >= CURRENT_DATE - INTERVAL '30 days'
GROUP BY country
HAVING SUM(spend) > 100
ORDER BY roi_percent DESC;
```

> ROAS is not stored; compute it as `conversion_value / NULLIF(spend, 0)`.

---

## Using Google Ads Data in AI Data Modeler

### Creating Data Models with Google Ads

The AI Data Modeler allows you to create custom reports using natural language:

#### Step 1: Access Data Modeler

1. Navigate to **AI Data Modeler**
2. Click **"Create New Model"**

#### Step 2: Select Google Ads Data Source

1. Choose **"Google Ads"** from available sources
2. Select your connected account
3. Choose tables to include

#### Step 3: Build Model with AI

Use natural language to describe your analysis:

**Example Prompts:**

**Campaign ROI Analysis:**
```
"Show me campaign performance with ROI for the last 30 days, 
sorted by highest return on ad spend"
```

**AI Generated Model:**
```sql
SELECT
  campaign_name,
  SUM(spend) AS total_spend,
  SUM(conversions) AS total_conversions,
  SUM(conversion_value) AS total_revenue,
  ROUND(SUM(conversion_value) / NULLIF(SUM(spend), 0), 2) AS roas,
  ROUND((SUM(conversion_value) - SUM(spend)) / NULLIF(SUM(spend), 0) * 100, 2) AS roi_percent
FROM dra_google_ads."ds42_ab12cd34"
WHERE date_start >= CURRENT_DATE - INTERVAL '30 days'
GROUP BY campaign_name
ORDER BY roas DESC;
```

**Keyword Optimization:**
```
"Find keywords with high cost but low conversions that need optimization"
```

**AI Generated Model:**
```sql
SELECT
  keyword_text,
  match_type,
  quality_score,
  SUM(spend) AS total_spend,
  SUM(conversions) AS total_conversions,
  SUM(clicks) AS total_clicks,
  ROUND(AVG(ctr) * 100, 2) AS avg_ctr_percent,
  ROUND(SUM(spend) / NULLIF(SUM(conversions), 0), 2) AS cost_per_conversion
FROM dra_google_ads."ds42_bc23de45"
WHERE date_start >= CURRENT_DATE - INTERVAL '30 days'
GROUP BY keyword_text, match_type, quality_score
HAVING SUM(spend) > 50 AND SUM(conversions) < 5
ORDER BY total_spend DESC;
```

### Combining Google Ads with Other Data Sources

**Example: Join Google Ads with CRM Revenue**

```
"Show me ad spend vs actual revenue by campaign, 
joining Google Ads with Salesforce opportunities"
```

**AI Generated Model:**
```sql
SELECT
  ga.campaign_name,
  SUM(ga.spend) AS ad_spend,
  SUM(ga.conversions) AS ga_conversions,
  COUNT(DISTINCT opp.id) AS opportunities,
  SUM(opp.amount) AS actual_revenue,
  ROUND(SUM(opp.amount) / NULLIF(SUM(ga.spend), 0), 2) AS true_roas,
  ROUND(SUM(opp.amount) / NULLIF(COUNT(DISTINCT opp.id), 0), 2) AS avg_deal_size
FROM dra_google_ads."ds42_ab12cd34" ga
LEFT JOIN salesforce.opportunities opp
  ON ga.date_start = DATE(opp.created_date)
  AND opp.lead_source = 'Google Ads'
WHERE ga.date_start >= CURRENT_DATE - INTERVAL '30 days'
GROUP BY ga.campaign_name
ORDER BY true_roas DESC;
```

---

## Best Practices

### Data Configuration

**1. Choose Appropriate Report Types**
- **Campaign performance (`insights`):** Essential for all users
- **Keyword performance (`keyword_insights`):** Critical for search campaigns
- **Geographic Performance:** Important for multi-region businesses
- **Device Performance:** Key for mobile-first or cross-device strategies

**2. Select Optimal Date Ranges**
- **30 days:** Recent performance, quick syncs
- **90 days:** Seasonal trends, quarterly analysis
- **Custom:** Specific campaign periods or historical backfills

**3. Monitor API Quota**
- Google Ads API has rate limits
- Large data ranges may hit limits
- Sync during off-peak hours if needed

### Data Management

**1. Regular Data Refreshes**
- Sync manually after campaign changes
- Keep data current for accurate reporting
 - Verify sync completion

**2. Data Quality Checks**
- Compare totals with Google Ads UI
- Check for missing dates
- Validate conversion tracking

**3. Query Optimization**
- Always include date filters
- Use indexed columns (date, campaign_id, keyword)
- Aggregate before complex joins

### Security

**1. Access Control**
- Limit Google Ads connection access to authorized users
- Use read-only Google Ads roles when possible
- Regularly review OAuth tokens

**2. Data Privacy**
- Ensure compliance with advertising policies
- Review data retention settings
- Mask sensitive customer data if needed

---

## Common Use Cases

### 1. Campaign ROI Dashboard

**Objective:** Track advertising ROI and profitability

**Setup:**
- Report Types: `insights` (campaign performance)
- Analysis: Ad spend vs revenue

**Data Model:**
```
"Create a dashboard showing:
- Total ad spend and revenue
- ROAS by campaign
- Cost per conversion
- Top 5 campaigns by ROI"
```

**Metrics:**
- Return on ad spend (ROAS)
- Return on investment (ROI %)
- Cost per acquisition (CPA)
- Conversion rate

---

### 2. Keyword Optimization

**Objective:** Identify high-performing and underperforming keywords

**Setup:**
- Report Types: `keyword_insights`
- Analysis: Quality Score, CPC, conversions

**Data Model:**
```
"Analyze keywords showing:
- Keywords with Quality Score below 5
- High-cost keywords with low conversions
- Best performing keywords by ROAS
- Keyword match type performance comparison"
```

**Actions:**
- Pause low-performing keywords
- Increase bids on high-ROAS keywords
- Improve ad relevance for low Quality Scores
- Add negative keywords

---

### 3. Geographic Expansion

**Objective:** Identify growth opportunities by location

**Setup:**
- Report Types: `geographic_insights`
- Analysis: Regional ROI and volume

**Data Model:**
```
"Show geographic performance:
- Top countries by revenue
- Regions with high conversion rates
- Underserved markets with potential
- ROI by location"
```

**Strategy:**
- Increase budgets in high-ROI regions
- Test new geographic markets
- Adjust bids by location
- Localize ads for top regions

---

### 4. Mobile vs Desktop Strategy

**Objective:** Optimize bids and creative by device

**Setup:**
- Report Types: `device_insights`
- Analysis: Device-specific metrics

**Data Model:**
```
"Compare device performance:
- Mobile vs desktop conversion rates
- Average order value by device
- Click-through rates by device
- Cost per conversion by device"
```

**Optimizations:**
- Adjust mobile bid modifiers
- Create mobile-specific ads
- Optimize landing pages by device
- Test responsive vs mobile ads

---

### 5. Attribution Analysis

**Objective:** Understand true campaign contribution

**Setup:**
- Report Types: all 11 (campaign/ad group/ads settings + insights)
- Combined: Google Ads + Google Analytics + CRM

**Data Model:**
```
"Build attribution model:
- First-click attribution by campaign
- Multi-touch attribution across channels
- Assisted conversions from Google Ads
- Customer journey from ad click to purchase"
```

**Insights:**
- True marketing channel contribution
- Campaign synergies
- Optimal budget allocation
- Customer acquisition paths

---

## Support

### Getting Help

**Documentation:**
- [Report Types Reference](./GA_REPORT_TYPES_REFERENCE.md)
- [API Integration Guide](./GA_API_INTEGRATION_GUIDE.md)
- [Type definitions](../../backend/src/types/IGoogleAds.ts)

**Technical Support:**
- Email: support@dataresearchanalysis.com
- Help Center: https://help.dataresearchanalysis.com
- Community Forum: https://community.dataresearchanalysis.com

**Office Hours:**
- Monday-Friday: 9 AM - 6 PM EST
- Response Time: Within 24 hours

---

**Document Version:** 1.0  
**Last Updated:** December 23, 2025  
**Maintained By:** Data Research Analysis Team
