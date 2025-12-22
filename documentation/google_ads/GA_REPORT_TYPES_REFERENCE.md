# Google Ads Report Types & Schema Reference

## Overview

This document provides a comprehensive reference for all Google Ads report types, their database schemas, sample data, and query examples. Use this as a guide when working with synced Google Ads data in the AI Data Modeler or when writing custom SQL queries.

**Database Schema**: `dra_google_ads`  
**Table Naming**: `{report_type}_{data_source_id}`  

---

## Table of Contents

1. [Campaign Performance](#campaign-performance)
2. [Keyword Performance](#keyword-performance)
3. [Geographic Performance](#geographic-performance)
4. [Device Performance](#device-performance)
5. [Data Dictionary](#data-dictionary)
6. [Sample Queries](#sample-queries)
7. [Best Practices](#best-practices)

---

## Campaign Performance

### Description

The Campaign Performance report provides daily metrics for each advertising campaign, including impressions, clicks, cost, conversions, and conversion value. This is the most commonly used report for tracking overall campaign ROI and performance trends.

**Report Type ID**: `campaign`  
**Table Name**: `dra_google_ads.campaigns_{data_source_id}`

### Database Schema

| Column | Type | Nullable | Description | Example |
|--------|------|----------|-------------|---------|
| `id` | SERIAL | No | Auto-increment primary key | `1` |
| `date` | DATE | No | Report date (YYYY-MM-DD) | `2024-01-15` |
| `campaign_id` | VARCHAR(255) | No | Unique Google Ads campaign identifier | `12345678901` |
| `campaign_name` | TEXT | Yes | Campaign display name | `"Summer Sale 2024"` |
| `campaign_status` | VARCHAR(50) | Yes | Campaign status (ENABLED, PAUSED, REMOVED) | `"ENABLED"` |
| `impressions` | BIGINT | Yes | Number of times ad was shown | `10000` |
| `clicks` | BIGINT | Yes | Number of clicks on ad | `500` |
| `cost` | DECIMAL(15,2) | Yes | Total cost in account currency | `250.50` |
| `conversions` | DECIMAL(10,2) | Yes | Number of conversions | `50.00` |
| `conversion_value` | DECIMAL(15,2) | Yes | Total conversion value in account currency | `5000.00` |
| `ctr` | DECIMAL(10,4) | Yes | Click-through rate (0.0-1.0) | `0.0500` |
| `average_cpc` | DECIMAL(10,2) | Yes | Average cost-per-click | `0.50` |
| `average_cpm` | DECIMAL(10,2) | Yes | Average cost-per-thousand impressions | `25.05` |
| `customer_id` | VARCHAR(255) | No | Google Ads customer account ID | `"123-456-7890"` |
| `synced_at` | TIMESTAMP | Yes | Timestamp when record was synced | `2024-01-16 10:30:00` |

### Indexes

```sql
-- Unique constraint to prevent duplicate records
UNIQUE(date, campaign_id)

-- Recommended additional indexes
CREATE INDEX idx_campaigns_date ON dra_google_ads.campaigns_{id}(date);
CREATE INDEX idx_campaigns_status ON dra_google_ads.campaigns_{id}(campaign_status);
CREATE INDEX idx_campaigns_customer ON dra_google_ads.campaigns_{id}(customer_id);
```

### Sample Data

```sql
INSERT INTO dra_google_ads.campaigns_42 (
  date, campaign_id, campaign_name, campaign_status, 
  impressions, clicks, cost, conversions, conversion_value,
  ctr, average_cpc, average_cpm, customer_id, synced_at
) VALUES
  ('2024-01-15', '12345678901', 'Summer Sale 2024', 'ENABLED', 
   10000, 500, 250.50, 50.00, 5000.00, 
   0.0500, 0.50, 25.05, '123-456-7890', NOW()),
  ('2024-01-15', '98765432109', 'Brand Awareness', 'ENABLED',
   25000, 300, 150.00, 15.00, 1500.00,
   0.0120, 0.50, 6.00, '123-456-7890', NOW()),
  ('2024-01-16', '12345678901', 'Summer Sale 2024', 'ENABLED',
   12000, 600, 300.00, 60.00, 6000.00,
   0.0500, 0.50, 25.00, '123-456-7890', NOW());
```

### Calculated Metrics

**ROAS (Return on Ad Spend)**:
```sql
SELECT 
  campaign_name,
  date,
  cost,
  conversion_value,
  CASE 
    WHEN cost > 0 THEN ROUND((conversion_value / cost)::numeric, 2)
    ELSE 0
  END as roas
FROM dra_google_ads.campaigns_42
WHERE date >= '2024-01-01'
ORDER BY date DESC, roas DESC;
```

**Conversion Rate**:
```sql
SELECT 
  campaign_name,
  date,
  clicks,
  conversions,
  CASE 
    WHEN clicks > 0 THEN ROUND((conversions / clicks * 100)::numeric, 2)
    ELSE 0
  END as conversion_rate_percent
FROM dra_google_ads.campaigns_42
WHERE date >= '2024-01-01'
ORDER BY conversion_rate_percent DESC;
```

**Cost Per Conversion**:
```sql
SELECT 
  campaign_name,
  SUM(cost) as total_cost,
  SUM(conversions) as total_conversions,
  CASE 
    WHEN SUM(conversions) > 0 THEN ROUND((SUM(cost) / SUM(conversions))::numeric, 2)
    ELSE 0
  END as cost_per_conversion
FROM dra_google_ads.campaigns_42
WHERE date BETWEEN '2024-01-01' AND '2024-01-31'
GROUP BY campaign_name
ORDER BY cost_per_conversion ASC;
```

---

## Keyword Performance

### Description

The Keyword Performance report provides detailed metrics for search keywords, including quality scores, match types, and keyword-level conversions. Essential for optimizing keyword bids and identifying high-performing search terms.

**Report Type ID**: `keyword`  
**Table Name**: `dra_google_ads.keywords_{data_source_id}`

### Database Schema

| Column | Type | Nullable | Description | Example |
|--------|------|----------|-------------|---------|
| `id` | SERIAL | No | Auto-increment primary key | `1` |
| `date` | DATE | No | Report date | `2024-01-15` |
| `campaign_id` | VARCHAR(255) | No | Campaign identifier | `12345678901` |
| `campaign_name` | TEXT | Yes | Campaign name | `"Summer Sale 2024"` |
| `ad_group_id` | VARCHAR(255) | No | Ad group identifier | `98765432109` |
| `ad_group_name` | TEXT | Yes | Ad group name | `"Running Shoes"` |
| `keyword_id` | VARCHAR(255) | No | Keyword identifier | `11223344556` |
| `keyword_text` | TEXT | Yes | Keyword text | `"best running shoes"` |
| `match_type` | VARCHAR(50) | Yes | Match type (EXACT, PHRASE, BROAD) | `"PHRASE"` |
| `impressions` | BIGINT | Yes | Impressions | `5000` |
| `clicks` | BIGINT | Yes | Clicks | `250` |
| `cost` | DECIMAL(15,2) | Yes | Cost | `125.00` |
| `conversions` | DECIMAL(10,2) | Yes | Conversions | `25.00` |
| `ctr` | DECIMAL(10,4) | Yes | Click-through rate | `0.0500` |
| `average_cpc` | DECIMAL(10,2) | Yes | Average CPC | `0.50` |
| `quality_score` | INTEGER | Yes | Quality Score (1-10 scale) | `8` |
| `customer_id` | VARCHAR(255) | No | Customer account ID | `"123-456-7890"` |
| `synced_at` | TIMESTAMP | Yes | Sync timestamp | `2024-01-16 10:30:00` |

### Indexes

```sql
UNIQUE(date, keyword_id)

CREATE INDEX idx_keywords_date ON dra_google_ads.keywords_{id}(date);
CREATE INDEX idx_keywords_campaign ON dra_google_ads.keywords_{id}(campaign_id);
CREATE INDEX idx_keywords_quality ON dra_google_ads.keywords_{id}(quality_score);
CREATE INDEX idx_keywords_match_type ON dra_google_ads.keywords_{id}(match_type);
```

### Sample Data

```sql
INSERT INTO dra_google_ads.keywords_42 (
  date, campaign_id, campaign_name, ad_group_id, ad_group_name,
  keyword_id, keyword_text, match_type,
  impressions, clicks, cost, conversions, ctr, average_cpc, quality_score,
  customer_id, synced_at
) VALUES
  ('2024-01-15', '12345678901', 'Summer Sale 2024', '98765432109', 'Running Shoes',
   '11223344556', 'best running shoes', 'PHRASE',
   5000, 250, 125.00, 25.00, 0.0500, 0.50, 8,
   '123-456-7890', NOW()),
  ('2024-01-15', '12345678901', 'Summer Sale 2024', '98765432109', 'Running Shoes',
   '22334455667', 'running shoes sale', 'EXACT',
   3000, 180, 90.00, 20.00, 0.0600, 0.50, 9,
   '123-456-7890', NOW()),
  ('2024-01-15', '12345678901', 'Summer Sale 2024', '11111111111', 'Athletic Wear',
   '33445566778', 'athletic clothing', 'BROAD',
   8000, 120, 60.00, 8.00, 0.0150, 0.50, 6,
   '123-456-7890', NOW());
```

### Analysis Queries

**Top Keywords by Conversion Rate**:
```sql
SELECT 
  keyword_text,
  match_type,
  SUM(clicks) as total_clicks,
  SUM(conversions) as total_conversions,
  ROUND((SUM(conversions) / NULLIF(SUM(clicks), 0) * 100)::numeric, 2) as conversion_rate,
  AVG(quality_score) as avg_quality_score
FROM dra_google_ads.keywords_42
WHERE date BETWEEN '2024-01-01' AND '2024-01-31'
  AND clicks > 50  -- Minimum threshold
GROUP BY keyword_text, match_type
ORDER BY conversion_rate DESC
LIMIT 20;
```

**Quality Score Distribution**:
```sql
SELECT 
  quality_score,
  COUNT(*) as keyword_count,
  SUM(impressions) as total_impressions,
  SUM(clicks) as total_clicks,
  ROUND(AVG(average_cpc)::numeric, 2) as avg_cpc
FROM dra_google_ads.keywords_42
WHERE date >= '2024-01-01'
  AND quality_score IS NOT NULL
GROUP BY quality_score
ORDER BY quality_score DESC;
```

**Match Type Performance**:
```sql
SELECT 
  match_type,
  COUNT(DISTINCT keyword_id) as unique_keywords,
  SUM(impressions) as total_impressions,
  SUM(clicks) as total_clicks,
  SUM(cost) as total_cost,
  SUM(conversions) as total_conversions,
  ROUND((SUM(conversions) / NULLIF(SUM(cost), 0))::numeric, 2) as conversions_per_dollar
FROM dra_google_ads.keywords_42
WHERE date BETWEEN '2024-01-01' AND '2024-01-31'
GROUP BY match_type
ORDER BY conversions_per_dollar DESC;
```

---

## Geographic Performance

### Description

The Geographic Performance report shows advertising metrics broken down by geographic location (country, region/state, city). Useful for identifying high-performing markets and optimizing location targeting.

**Report Type ID**: `geographic`  
**Table Name**: `dra_google_ads.geographic_{data_source_id}`

### Database Schema

| Column | Type | Nullable | Description | Example |
|--------|------|----------|-------------|---------|
| `id` | SERIAL | No | Auto-increment primary key | `1` |
| `date` | DATE | No | Report date | `2024-01-15` |
| `country_code` | VARCHAR(10) | Yes | ISO country code | `"US"`, `"GB"`, `"CA"` |
| `country_name` | TEXT | Yes | Country name | `"United States"` |
| `region_code` | VARCHAR(50) | Yes | Region/state code | `"CA"`, `"NY"` |
| `region_name` | TEXT | Yes | Region/state name | `"California"`, `"New York"` |
| `city_name` | TEXT | Yes | City name | `"Los Angeles"`, `"New York"` |
| `impressions` | BIGINT | Yes | Impressions | `5000` |
| `clicks` | BIGINT | Yes | Clicks | `250` |
| `cost` | DECIMAL(15,2) | Yes | Cost | `125.00` |
| `conversions` | DECIMAL(10,2) | Yes | Conversions | `25.00` |
| `conversion_value` | DECIMAL(15,2) | Yes | Conversion value | `2500.00` |
| `customer_id` | VARCHAR(255) | No | Customer account ID | `"123-456-7890"` |
| `synced_at` | TIMESTAMP | Yes | Sync timestamp | `2024-01-16 10:30:00` |

### Indexes

```sql
UNIQUE(date, country_code, region_code, city_name)

CREATE INDEX idx_geographic_date ON dra_google_ads.geographic_{id}(date);
CREATE INDEX idx_geographic_country ON dra_google_ads.geographic_{id}(country_code);
CREATE INDEX idx_geographic_region ON dra_google_ads.geographic_{id}(region_code);
```

### Sample Data

```sql
INSERT INTO dra_google_ads.geographic_42 (
  date, country_code, country_name, region_code, region_name, city_name,
  impressions, clicks, cost, conversions, conversion_value,
  customer_id, synced_at
) VALUES
  ('2024-01-15', 'US', 'United States', 'CA', 'California', 'Los Angeles',
   8000, 400, 200.00, 40.00, 4000.00,
   '123-456-7890', NOW()),
  ('2024-01-15', 'US', 'United States', 'NY', 'New York', 'New York',
   6000, 300, 150.00, 30.00, 3000.00,
   '123-456-7890', NOW()),
  ('2024-01-15', 'GB', 'United Kingdom', 'ENG', 'England', 'London',
   4000, 200, 100.00, 20.00, 2000.00,
   '123-456-7890', NOW());
```

### Analysis Queries

**Top Countries by ROAS**:
```sql
SELECT 
  country_name,
  SUM(cost) as total_cost,
  SUM(conversion_value) as total_conversion_value,
  SUM(conversions) as total_conversions,
  ROUND((SUM(conversion_value) / NULLIF(SUM(cost), 0))::numeric, 2) as roas
FROM dra_google_ads.geographic_42
WHERE date BETWEEN '2024-01-01' AND '2024-01-31'
GROUP BY country_name
HAVING SUM(cost) > 100  -- Minimum spend threshold
ORDER BY roas DESC
LIMIT 10;
```

**Top Cities by Volume**:
```sql
SELECT 
  country_name,
  region_name,
  city_name,
  SUM(impressions) as total_impressions,
  SUM(clicks) as total_clicks,
  SUM(cost) as total_cost,
  SUM(conversions) as total_conversions,
  ROUND((SUM(clicks)::numeric / NULLIF(SUM(impressions), 0) * 100)::numeric, 2) as ctr_percent
FROM dra_google_ads.geographic_42
WHERE date BETWEEN '2024-01-01' AND '2024-01-31'
  AND city_name IS NOT NULL
GROUP BY country_name, region_name, city_name
ORDER BY total_cost DESC
LIMIT 20;
```

**Regional Performance Comparison**:
```sql
SELECT 
  country_code,
  region_name,
  COUNT(DISTINCT city_name) as cities_count,
  SUM(impressions) as total_impressions,
  SUM(clicks) as total_clicks,
  SUM(cost) as total_cost,
  SUM(conversions) as total_conversions,
  ROUND((SUM(cost) / NULLIF(SUM(conversions), 0))::numeric, 2) as cost_per_conversion
FROM dra_google_ads.geographic_42
WHERE date BETWEEN '2024-01-01' AND '2024-01-31'
  AND country_code = 'US'
GROUP BY country_code, region_name
ORDER BY total_cost DESC;
```

---

## Device Performance

### Description

The Device Performance report shows metrics segmented by device type (mobile, desktop, tablet). Essential for understanding how users interact with ads across different devices and optimizing mobile bid adjustments.

**Report Type ID**: `device`  
**Table Name**: `dra_google_ads.devices_{data_source_id}`

### Database Schema

| Column | Type | Nullable | Description | Example |
|--------|------|----------|-------------|---------|
| `id` | SERIAL | No | Auto-increment primary key | `1` |
| `date` | DATE | No | Report date | `2024-01-15` |
| `device_type` | VARCHAR(50) | No | Device type (MOBILE, DESKTOP, TABLET) | `"MOBILE"` |
| `impressions` | BIGINT | Yes | Impressions | `5000` |
| `clicks` | BIGINT | Yes | Clicks | `250` |
| `cost` | DECIMAL(15,2) | Yes | Cost | `125.00` |
| `conversions` | DECIMAL(10,2) | Yes | Conversions | `25.00` |
| `conversion_value` | DECIMAL(15,2) | Yes | Conversion value | `2500.00` |
| `ctr` | DECIMAL(10,4) | Yes | Click-through rate | `0.0500` |
| `average_cpc` | DECIMAL(10,2) | Yes | Average CPC | `0.50` |
| `customer_id` | VARCHAR(255) | No | Customer account ID | `"123-456-7890"` |
| `synced_at` | TIMESTAMP | Yes | Sync timestamp | `2024-01-16 10:30:00` |

### Indexes

```sql
UNIQUE(date, device_type)

CREATE INDEX idx_devices_date ON dra_google_ads.devices_{id}(date);
CREATE INDEX idx_devices_type ON dra_google_ads.devices_{id}(device_type);
```

### Sample Data

```sql
INSERT INTO dra_google_ads.devices_42 (
  date, device_type, impressions, clicks, cost, conversions, conversion_value,
  ctr, average_cpc, customer_id, synced_at
) VALUES
  ('2024-01-15', 'MOBILE', 15000, 600, 300.00, 45.00, 4500.00,
   0.0400, 0.50, '123-456-7890', NOW()),
  ('2024-01-15', 'DESKTOP', 8000, 400, 200.00, 50.00, 5000.00,
   0.0500, 0.50, '123-456-7890', NOW()),
  ('2024-01-15', 'TABLET', 2000, 50, 25.00, 5.00, 500.00,
   0.0250, 0.50, '123-456-7890', NOW());
```

### Analysis Queries

**Device Performance Comparison**:
```sql
SELECT 
  device_type,
  SUM(impressions) as total_impressions,
  SUM(clicks) as total_clicks,
  SUM(cost) as total_cost,
  SUM(conversions) as total_conversions,
  SUM(conversion_value) as total_conversion_value,
  ROUND((SUM(clicks)::numeric / NULLIF(SUM(impressions), 0) * 100)::numeric, 2) as ctr_percent,
  ROUND((SUM(conversions) / NULLIF(SUM(clicks), 0) * 100)::numeric, 2) as conversion_rate,
  ROUND((SUM(conversion_value) / NULLIF(SUM(cost), 0))::numeric, 2) as roas
FROM dra_google_ads.devices_42
WHERE date BETWEEN '2024-01-01' AND '2024-01-31'
GROUP BY device_type
ORDER BY total_cost DESC;
```

**Daily Device Trends**:
```sql
SELECT 
  date,
  device_type,
  impressions,
  clicks,
  cost,
  conversions,
  ROUND((conversion_value / NULLIF(cost, 0))::numeric, 2) as roas
FROM dra_google_ads.devices_42
WHERE date >= '2024-01-01'
ORDER BY date DESC, device_type;
```

**Mobile vs Desktop Efficiency**:
```sql
WITH device_metrics AS (
  SELECT 
    device_type,
    SUM(cost) as total_cost,
    SUM(conversions) as total_conversions,
    SUM(conversion_value) as total_conversion_value
  FROM dra_google_ads.devices_42
  WHERE date BETWEEN '2024-01-01' AND '2024-01-31'
    AND device_type IN ('MOBILE', 'DESKTOP')
  GROUP BY device_type
)
SELECT 
  device_type,
  total_cost,
  total_conversions,
  total_conversion_value,
  ROUND((total_cost / NULLIF(total_conversions, 0))::numeric, 2) as cost_per_conversion,
  ROUND((total_conversion_value / NULLIF(total_cost, 0))::numeric, 2) as roas,
  ROUND((total_cost / SUM(total_cost) OVER () * 100)::numeric, 2) as percent_of_spend
FROM device_metrics
ORDER BY total_cost DESC;
```

---

## Data Dictionary

### Common Terms

| Term | Definition |
|------|------------|
| **Impression** | Number of times an ad is shown |
| **Click** | Number of times users click on an ad |
| **CTR (Click-Through Rate)** | Clicks divided by impressions (percentage of impressions that result in clicks) |
| **CPC (Cost Per Click)** | Average cost paid for each click |
| **CPM (Cost Per Mille)** | Cost per thousand impressions |
| **Conversion** | Desired user action (purchase, signup, etc.) tracked via conversion tracking |
| **Conversion Value** | Total monetary value of conversions |
| **ROAS (Return on Ad Spend)** | Conversion value divided by cost (revenue generated per dollar spent) |
| **Quality Score** | Google's 1-10 rating of keyword quality and relevance |
| **Match Type** | How closely a keyword must match a search query (EXACT, PHRASE, BROAD) |
| **Customer ID** | Unique identifier for Google Ads account (format: XXX-XXX-XXXX) |

### Metric Calculations

**Click-Through Rate (CTR)**:
```
CTR = (Clicks / Impressions) × 100%
```

**Conversion Rate**:
```
Conversion Rate = (Conversions / Clicks) × 100%
```

**Cost Per Conversion**:
```
Cost Per Conversion = Total Cost / Total Conversions
```

**Return on Ad Spend (ROAS)**:
```
ROAS = Conversion Value / Cost
```

**Average CPC**:
```
Average CPC = Total Cost / Total Clicks
```

**Average CPM**:
```
Average CPM = (Total Cost / Impressions) × 1000
```

### Status Values

**Campaign Status**:
- `ENABLED`: Campaign is active and serving ads
- `PAUSED`: Campaign is paused, not serving ads
- `REMOVED`: Campaign has been deleted

**Match Types**:
- `EXACT`: Keyword must exactly match search query
- `PHRASE`: Search query must contain keyword phrase in order
- `BROAD`: Search query can loosely match keyword (most flexible)

**Device Types**:
- `MOBILE`: Smartphones
- `DESKTOP`: Desktop and laptop computers
- `TABLET`: Tablet devices

---

## Sample Queries

### Cross-Report Analysis

**Campaign Performance with Geographic Breakdown**:
```sql
SELECT 
  c.campaign_name,
  g.country_name,
  g.region_name,
  SUM(g.impressions) as impressions,
  SUM(g.clicks) as clicks,
  SUM(g.cost) as cost,
  SUM(g.conversions) as conversions,
  ROUND((SUM(g.conversion_value) / NULLIF(SUM(g.cost), 0))::numeric, 2) as roas
FROM dra_google_ads.campaigns_42 c
LEFT JOIN dra_google_ads.geographic_42 g 
  ON c.date = g.date 
  AND c.customer_id = g.customer_id
WHERE c.date BETWEEN '2024-01-01' AND '2024-01-31'
  AND g.country_code IS NOT NULL
GROUP BY c.campaign_name, g.country_name, g.region_name
HAVING SUM(g.cost) > 50
ORDER BY roas DESC
LIMIT 20;
```

**Device Performance by Campaign**:
```sql
SELECT 
  c.campaign_name,
  d.device_type,
  SUM(d.impressions) as impressions,
  SUM(d.clicks) as clicks,
  SUM(d.cost) as cost,
  SUM(d.conversions) as conversions,
  ROUND((SUM(d.clicks)::numeric / NULLIF(SUM(d.impressions), 0) * 100)::numeric, 2) as ctr_percent,
  ROUND((SUM(d.cost) / NULLIF(SUM(d.conversions), 0))::numeric, 2) as cost_per_conversion
FROM dra_google_ads.campaigns_42 c
LEFT JOIN dra_google_ads.devices_42 d 
  ON c.date = d.date 
  AND c.customer_id = d.customer_id
WHERE c.date BETWEEN '2024-01-01' AND '2024-01-31'
GROUP BY c.campaign_name, d.device_type
ORDER BY c.campaign_name, cost DESC;
```

**Keyword Quality Score Impact on Performance**:
```sql
SELECT 
  CASE 
    WHEN quality_score >= 8 THEN 'High (8-10)'
    WHEN quality_score >= 5 THEN 'Medium (5-7)'
    WHEN quality_score IS NOT NULL THEN 'Low (1-4)'
    ELSE 'Unknown'
  END as quality_tier,
  COUNT(DISTINCT keyword_id) as keyword_count,
  SUM(impressions) as total_impressions,
  SUM(clicks) as total_clicks,
  SUM(cost) as total_cost,
  ROUND(AVG(average_cpc)::numeric, 2) as avg_cpc,
  ROUND((SUM(clicks)::numeric / NULLIF(SUM(impressions), 0) * 100)::numeric, 2) as ctr_percent
FROM dra_google_ads.keywords_42
WHERE date BETWEEN '2024-01-01' AND '2024-01-31'
GROUP BY quality_tier
ORDER BY 
  CASE quality_tier
    WHEN 'High (8-10)' THEN 1
    WHEN 'Medium (5-7)' THEN 2
    WHEN 'Low (1-4)' THEN 3
    ELSE 4
  END;
```

### Time-Series Analysis

**Daily Campaign Performance Trend**:
```sql
SELECT 
  date,
  campaign_name,
  impressions,
  clicks,
  cost,
  conversions,
  ROUND((conversions / NULLIF(clicks, 0) * 100)::numeric, 2) as conversion_rate,
  ROUND((conversion_value / NULLIF(cost, 0))::numeric, 2) as roas,
  -- 7-day moving average
  ROUND(AVG(cost) OVER (
    PARTITION BY campaign_name 
    ORDER BY date 
    ROWS BETWEEN 6 PRECEDING AND CURRENT ROW
  )::numeric, 2) as cost_7d_avg
FROM dra_google_ads.campaigns_42
WHERE date >= '2024-01-01'
  AND campaign_status = 'ENABLED'
ORDER BY date DESC, campaign_name;
```

**Week-over-Week Comparison**:
```sql
WITH weekly_metrics AS (
  SELECT 
    DATE_TRUNC('week', date) as week_start,
    campaign_name,
    SUM(impressions) as impressions,
    SUM(clicks) as clicks,
    SUM(cost) as cost,
    SUM(conversions) as conversions
  FROM dra_google_ads.campaigns_42
  WHERE date >= DATE_TRUNC('week', CURRENT_DATE) - INTERVAL '4 weeks'
  GROUP BY week_start, campaign_name
)
SELECT 
  campaign_name,
  week_start,
  cost,
  conversions,
  LAG(cost) OVER (PARTITION BY campaign_name ORDER BY week_start) as prev_week_cost,
  ROUND((
    (cost - LAG(cost) OVER (PARTITION BY campaign_name ORDER BY week_start)) /
    NULLIF(LAG(cost) OVER (PARTITION BY campaign_name ORDER BY week_start), 0) * 100
  )::numeric, 2) as cost_change_percent
FROM weekly_metrics
ORDER BY campaign_name, week_start DESC;
```

### AI Data Modeler Sample Queries

**Natural Language**: "What were my top 5 campaigns by ROAS last month?"

**Generated SQL**:
```sql
SELECT 
  campaign_name,
  SUM(cost) as total_cost,
  SUM(conversion_value) as total_conversion_value,
  SUM(conversions) as total_conversions,
  ROUND((SUM(conversion_value) / NULLIF(SUM(cost), 0))::numeric, 2) as roas
FROM dra_google_ads.campaigns_42
WHERE date >= DATE_TRUNC('month', CURRENT_DATE - INTERVAL '1 month')
  AND date < DATE_TRUNC('month', CURRENT_DATE)
  AND campaign_status = 'ENABLED'
GROUP BY campaign_name
ORDER BY roas DESC
LIMIT 5;
```

**Natural Language**: "Show me keyword performance for keywords with quality score above 7"

**Generated SQL**:
```sql
SELECT 
  keyword_text,
  match_type,
  AVG(quality_score) as avg_quality_score,
  SUM(impressions) as total_impressions,
  SUM(clicks) as total_clicks,
  SUM(cost) as total_cost,
  SUM(conversions) as total_conversions,
  ROUND((SUM(clicks)::numeric / NULLIF(SUM(impressions), 0) * 100)::numeric, 2) as ctr_percent
FROM dra_google_ads.keywords_42
WHERE quality_score > 7
  AND date >= CURRENT_DATE - INTERVAL '30 days'
GROUP BY keyword_text, match_type
ORDER BY total_conversions DESC
LIMIT 20;
```

**Natural Language**: "Compare mobile vs desktop conversion rates this week"

**Generated SQL**:
```sql
SELECT 
  device_type,
  SUM(clicks) as total_clicks,
  SUM(conversions) as total_conversions,
  ROUND((SUM(conversions) / NULLIF(SUM(clicks), 0) * 100)::numeric, 2) as conversion_rate,
  SUM(cost) as total_cost,
  ROUND((SUM(cost) / NULLIF(SUM(conversions), 0))::numeric, 2) as cost_per_conversion
FROM dra_google_ads.devices_42
WHERE date >= DATE_TRUNC('week', CURRENT_DATE)
GROUP BY device_type
ORDER BY conversion_rate DESC;
```

---

## Best Practices

### Query Optimization

1. **Always Use Date Filters**:
   ```sql
   -- Good
   WHERE date BETWEEN '2024-01-01' AND '2024-01-31'
   
   -- Bad (scans entire table)
   -- No date filter
   ```

2. **Use Appropriate Indexes**:
   ```sql
   -- Queries on status benefit from index
   WHERE campaign_status = 'ENABLED'
   
   -- Queries on device type benefit from index
   WHERE device_type = 'MOBILE'
   ```

3. **Avoid SELECT ***:
   ```sql
   -- Good
   SELECT campaign_name, cost, conversions FROM ...
   
   -- Bad (retrieves unnecessary columns)
   SELECT * FROM ...
   ```

4. **Use EXPLAIN for Large Queries**:
   ```sql
   EXPLAIN ANALYZE
   SELECT ...
   ```

### Data Analysis

1. **Set Minimum Thresholds**: Filter out low-volume data for more meaningful insights
   ```sql
   HAVING SUM(clicks) > 100
   ```

2. **Handle Division by Zero**: Always use `NULLIF` to prevent division errors
   ```sql
   ROUND((SUM(conversions) / NULLIF(SUM(clicks), 0))::numeric, 2)
   ```

3. **Use Aggregations**: Group data for trends and patterns
   ```sql
   GROUP BY DATE_TRUNC('week', date), campaign_name
   ```

4. **Compare Time Periods**: Use window functions for trends
   ```sql
   LAG(cost) OVER (PARTITION BY campaign_name ORDER BY date)
   ```

### Schema Management

1. **Regular Cleanup**: Archive or delete old data you no longer need
   ```sql
   DELETE FROM dra_google_ads.campaigns_42 
   WHERE date < CURRENT_DATE - INTERVAL '2 years';
   ```

2. **Monitor Table Size**:
   ```sql
   SELECT 
     schemaname,
     tablename,
     pg_size_pretty(pg_total_relation_size(schemaname||'.'||tablename)) AS size
   FROM pg_tables
   WHERE schemaname = 'dra_google_ads'
   ORDER BY pg_total_relation_size(schemaname||'.'||tablename) DESC;
   ```

3. **Vacuum Regularly**: Maintain database performance
   ```sql
   VACUUM ANALYZE dra_google_ads.campaigns_42;
   ```

### AI Data Modeler Integration

1. **Use Descriptive Table Aliases**: Helps AI understand context
   ```sql
   SELECT c.campaign_name, k.keyword_text
   FROM dra_google_ads.campaigns_42 c
   JOIN dra_google_ads.keywords_42 k ON c.date = k.date
   ```

2. **Add Comments to Complex Queries**: Aids natural language understanding
   ```sql
   -- Calculate ROAS for campaigns with minimum $100 spend
   SELECT campaign_name, ...
   ```

3. **Create Views for Common Queries**: Simplify AI-generated SQL
   ```sql
   CREATE VIEW campaign_daily_summary AS
   SELECT 
     campaign_name,
     date,
     SUM(cost) as cost,
     SUM(conversions) as conversions,
     ROUND((SUM(conversion_value) / NULLIF(SUM(cost), 0))::numeric, 2) as roas
   FROM dra_google_ads.campaigns_42
   GROUP BY campaign_name, date;
   ```

---

## Related Documentation

- [Google Ads Technical Documentation](./GOOGLE_ADS_DOCUMENTATION.md)
- [Google Ads User Guide](./GA_USER_GUIDE.md)
- [Google Ads API Integration Guide](./GA_API_INTEGRATION_GUIDE.md)
- [Google Ads TypeScript Types](./GA_TYPES_REFERENCE.md)

### External Resources

- [Google Ads API Field Reference](https://developers.google.com/google-ads/api/fields/v16/overview)
- [PostgreSQL Documentation](https://www.postgresql.org/docs/)
- [Google Ads Query Language (GAQL)](https://developers.google.com/google-ads/api/docs/query/overview)
