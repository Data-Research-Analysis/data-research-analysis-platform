# Google Ad Manager Report Types Reference

**Comprehensive Guide to GAM Data Structure and Schema**

---

## Table of Contents

1. [Overview](#overview)
2. [Revenue & Earnings Report](#revenue--earnings-report)
3. [Inventory Performance Report](#inventory-performance-report)
4. [Orders & Line Items Report](#orders--line-items-report)
5. [Geography Performance Report](#geography-performance-report)
6. [Device & Browser Report](#device--browser-report)
7. [Data Dictionary](#data-dictionary)
8. [Sample Queries](#sample-queries)
9. [Best Practices](#best-practices)

---

## Overview

The Google Ad Manager integration imports five standardized report types, each stored in dedicated database tables. All reports follow a consistent naming pattern:

```
dra_google_ad_manager.{report_type}_{network_id}
```

### Report Type Summary

| Report Type | Purpose | Key Metrics | Update Frequency |
|------------|---------|-------------|------------------|
| **Revenue** | Financial performance | Earnings, eCPM, RPM | Hourly/Daily |
| **Inventory** | Ad inventory utilization | Fill rate, available impressions | Daily |
| **Orders** | Campaign delivery | Delivery %, pacing | Daily |
| **Geography** | Geographic performance | Revenue by country | Daily/Weekly |
| **Device** | Device/browser analysis | Performance by platform | Daily/Weekly |

### Common Fields Across All Reports

All report tables include these standard fields:

- `id`: Primary key (auto-increment integer)
- `data_source_id`: Foreign key to connection (integer)
- `date`: Report date (DATE format: YYYY-MM-DD)
- `created_at`: Record insert timestamp (TIMESTAMP)
- `updated_at`: Record update timestamp (TIMESTAMP)

---

## Revenue & Earnings Report

### Description

The Revenue report provides detailed financial performance metrics, showing earnings, impressions, clicks, and calculated rates across your ad inventory.

**Business Use Cases:**
- Daily revenue tracking
- Ad unit performance analysis
- eCPM optimization
- Revenue forecasting
- Advertiser billing verification

### Database Schema

**Table Name:** `dra_google_ad_manager.revenue_{network_id}`

| Column | Type | Nullable | Description |
|--------|------|----------|-------------|
| `id` | INTEGER | NO | Primary key |
| `data_source_id` | INTEGER | NO | Data source reference |
| `date` | DATE | NO | Report date |
| `ad_unit_id` | VARCHAR(255) | YES | Ad unit identifier |
| `ad_unit_name` | TEXT | YES | Ad unit display name |
| `country` | VARCHAR(10) | YES | ISO country code (US, CA, UK, etc.) |
| `total_earnings` | DECIMAL(15,2) | YES | Total revenue in network currency |
| `impressions` | BIGINT | YES | Total ad impressions |
| `clicks` | BIGINT | YES | Total ad clicks |
| `ctr` | DECIMAL(8,6) | YES | Click-through rate (clicks/impressions) |
| `ecpm` | DECIMAL(10,2) | YES | Effective CPM (earnings per 1000 impressions) |
| `created_at` | TIMESTAMP | NO | Record creation time |
| `updated_at` | TIMESTAMP | NO | Last update time |

### Indexes

```sql
-- Primary key
PRIMARY KEY (id)

-- Foreign key
FOREIGN KEY (data_source_id) REFERENCES data_sources(id) ON DELETE CASCADE

-- Performance indexes
INDEX idx_revenue_date (date)
INDEX idx_revenue_ad_unit (ad_unit_id)
INDEX idx_revenue_country (country)
INDEX idx_revenue_date_ad_unit (date, ad_unit_id)
```

### Calculated Metrics

**eCPM (Effective Cost Per Mille):**
```sql
ecpm = (total_earnings / impressions) * 1000
```

**CTR (Click-Through Rate):**
```sql
ctr = (clicks / impressions)
```

**RPM (Revenue Per Mille):**
```sql
rpm = (total_earnings / impressions) * 1000  -- Same as eCPM
```

### Sample Data

```sql
| id  | date       | ad_unit_name | country | total_earnings | impressions | clicks | ctr    | ecpm |
|-----|------------|--------------|---------|----------------|-------------|--------|--------|------|
| 1   | 2025-12-01 | Homepage     | US      | 450.25         | 125000      | 450    | 0.0036 | 3.60 |
| 2   | 2025-12-01 | Sidebar      | US      | 320.80         | 95000       | 280    | 0.0029 | 3.38 |
| 3   | 2025-12-01 | Homepage     | CA      | 125.50         | 45000       | 150    | 0.0033 | 2.79 |
```

### Sample Queries

**Daily Revenue by Ad Unit:**
```sql
SELECT 
  date,
  ad_unit_name,
  SUM(total_earnings) as revenue,
  SUM(impressions) as impressions,
  SUM(clicks) as clicks,
  ROUND(AVG(ecpm), 2) as avg_ecpm
FROM dra_google_ad_manager.revenue_12345678
WHERE date >= CURRENT_DATE - INTERVAL '30 days'
GROUP BY date, ad_unit_name
ORDER BY date DESC, revenue DESC;
```

**Top Performing Ad Units:**
```sql
SELECT 
  ad_unit_name,
  SUM(total_earnings) as total_revenue,
  SUM(impressions) as total_impressions,
  ROUND(AVG(ecpm), 2) as avg_ecpm,
  COUNT(DISTINCT date) as days_active
FROM dra_google_ad_manager.revenue_12345678
WHERE date >= CURRENT_DATE - INTERVAL '30 days'
GROUP BY ad_unit_name
HAVING SUM(impressions) > 10000
ORDER BY total_revenue DESC
LIMIT 10;
```

**Revenue Trends with MoM Comparison:**
```sql
WITH current_month AS (
  SELECT SUM(total_earnings) as revenue
  FROM dra_google_ad_manager.revenue_12345678
  WHERE date >= DATE_TRUNC('month', CURRENT_DATE)
),
previous_month AS (
  SELECT SUM(total_earnings) as revenue
  FROM dra_google_ad_manager.revenue_12345678
  WHERE date >= DATE_TRUNC('month', CURRENT_DATE - INTERVAL '1 month')
    AND date < DATE_TRUNC('month', CURRENT_DATE)
)
SELECT 
  current_month.revenue as current_revenue,
  previous_month.revenue as previous_revenue,
  ROUND(((current_month.revenue - previous_month.revenue) / previous_month.revenue) * 100, 2) as growth_pct
FROM current_month, previous_month;
```

---

## Inventory Performance Report

### Description

The Inventory report tracks ad unit utilization, showing fill rates, available impressions, and delivery performance across your inventory.

**Business Use Cases:**
- Inventory optimization
- Yield management
- Capacity planning
- Pricing strategy
- Ad unit performance

### Database Schema

**Table Name:** `dra_google_ad_manager.inventory_{network_id}`

| Column | Type | Nullable | Description |
|--------|------|----------|-------------|
| `id` | INTEGER | NO | Primary key |
| `data_source_id` | INTEGER | NO | Data source reference |
| `date` | DATE | NO | Report date |
| `ad_unit_id` | VARCHAR(255) | YES | Ad unit identifier |
| `ad_unit_name` | TEXT | YES | Ad unit display name |
| `ad_unit_size` | VARCHAR(50) | YES | Ad size (e.g., "728x90", "300x250") |
| `device_category` | VARCHAR(50) | YES | Device type (DESKTOP, MOBILE, TABLET) |
| `impressions` | BIGINT | YES | Delivered impressions |
| `clicks` | BIGINT | YES | Total clicks |
| `ctr` | DECIMAL(8,6) | YES | Click-through rate |
| `fill_rate` | DECIMAL(6,4) | YES | Fill rate (impressions/available) |
| `available_impressions` | BIGINT | YES | Total available impressions |
| `created_at` | TIMESTAMP | NO | Record creation time |
| `updated_at` | TIMESTAMP | NO | Last update time |

### Indexes

```sql
PRIMARY KEY (id)
FOREIGN KEY (data_source_id) REFERENCES data_sources(id) ON DELETE CASCADE
INDEX idx_inventory_date (date)
INDEX idx_inventory_ad_unit (ad_unit_id)
INDEX idx_inventory_device (device_category)
INDEX idx_inventory_date_ad_unit (date, ad_unit_id)
```

### Calculated Metrics

**Fill Rate:**
```sql
fill_rate = impressions / available_impressions
```

**Unfilled Impressions:**
```sql
unfilled_impressions = available_impressions - impressions
```

**Utilization Rate:**
```sql
utilization_rate = (impressions / available_impressions) * 100
```

### Sample Data

```sql
| id | date       | ad_unit_name | ad_unit_size | device_category | impressions | available_impressions | fill_rate |
|----|------------|--------------|--------------|-----------------|-------------|----------------------|-----------|
| 1  | 2025-12-01 | Homepage     | 728x90       | DESKTOP         | 125000      | 150000               | 0.8333    |
| 2  | 2025-12-01 | Sidebar      | 300x250      | DESKTOP         | 95000       | 100000               | 0.9500    |
| 3  | 2025-12-01 | Homepage     | 320x50       | MOBILE          | 200000      | 250000               | 0.8000    |
```

### Sample Queries

**Low Fill Rate Ad Units:**
```sql
SELECT 
  ad_unit_name,
  ad_unit_size,
  AVG(fill_rate) as avg_fill_rate,
  SUM(available_impressions) as total_available,
  SUM(impressions) as total_filled,
  SUM(available_impressions - impressions) as unfilled
FROM dra_google_ad_manager.inventory_12345678
WHERE date >= CURRENT_DATE - INTERVAL '7 days'
GROUP BY ad_unit_name, ad_unit_size
HAVING AVG(fill_rate) < 0.80
ORDER BY unfilled DESC;
```

**Device Performance:**
```sql
SELECT 
  device_category,
  COUNT(DISTINCT ad_unit_id) as ad_units,
  SUM(impressions) as total_impressions,
  SUM(available_impressions) as total_available,
  ROUND(AVG(fill_rate) * 100, 2) as avg_fill_rate_pct
FROM dra_google_ad_manager.inventory_12345678
WHERE date >= CURRENT_DATE - INTERVAL '30 days'
GROUP BY device_category
ORDER BY total_impressions DESC;
```

---

## Orders & Line Items Report

### Description

The Orders report tracks campaign delivery, pacing, and performance for advertisers and line items.

**Business Use Cases:**
- Campaign monitoring
- Delivery tracking
- Pacing analysis
- Advertiser reporting
- Revenue forecasting

### Database Schema

**Table Name:** `dra_google_ad_manager.orders_{network_id}`

| Column | Type | Nullable | Description |
|--------|------|----------|-------------|
| `id` | INTEGER | NO | Primary key |
| `data_source_id` | INTEGER | NO | Data source reference |
| `date` | DATE | NO | Report date |
| `order_id` | VARCHAR(255) | YES | Order identifier |
| `order_name` | TEXT | YES | Order display name |
| `line_item_id` | VARCHAR(255) | YES | Line item identifier |
| `line_item_name` | TEXT | YES | Line item display name |
| `advertiser_name` | TEXT | YES | Advertiser name |
| `impressions` | BIGINT | YES | Delivered impressions |
| `clicks` | BIGINT | YES | Total clicks |
| `ctr` | DECIMAL(8,6) | YES | Click-through rate |
| `total_earnings` | DECIMAL(15,2) | YES | Revenue from line item |
| `delivery_percentage` | DECIMAL(6,2) | YES | % of goal delivered |
| `created_at` | TIMESTAMP | NO | Record creation time |
| `updated_at` | TIMESTAMP | NO | Last update time |

### Sample Queries

**Campaign Delivery Status:**
```sql
SELECT 
  advertiser_name,
  order_name,
  SUM(impressions) as delivered_impressions,
  AVG(delivery_percentage) as avg_delivery_pct,
  SUM(total_earnings) as revenue
FROM dra_google_ad_manager.orders_12345678
WHERE date >= CURRENT_DATE - INTERVAL '7 days'
GROUP BY advertiser_name, order_name
ORDER BY revenue DESC;
```

---

## Geography Performance Report

### Description

The Geography report shows performance metrics broken down by country and region.

**Business Use Cases:**
- Geographic targeting
- Market expansion analysis
- Regional pricing
- International growth

### Database Schema

**Table Name:** `dra_google_ad_manager.geography_{network_id}`

| Column | Type | Nullable | Description |
|--------|------|----------|-------------|
| `id` | INTEGER | NO | Primary key |
| `data_source_id` | INTEGER | NO | Data source reference |
| `date` | DATE | NO | Report date |
| `country` | VARCHAR(10) | YES | ISO country code |
| `region` | VARCHAR(255) | YES | Region/state name |
| `city` | VARCHAR(255) | YES | City name |
| `impressions` | BIGINT | YES | Total impressions |
| `clicks` | BIGINT | YES | Total clicks |
| `ctr` | DECIMAL(8,6) | YES | Click-through rate |
| `total_earnings` | DECIMAL(15,2) | YES | Revenue |
| `ecpm` | DECIMAL(10,2) | YES | Effective CPM |
| `created_at` | TIMESTAMP | NO | Record creation time |
| `updated_at` | TIMESTAMP | NO | Last update time |

### Sample Queries

**Top Countries by Revenue:**
```sql
SELECT 
  country,
  SUM(total_earnings) as revenue,
  SUM(impressions) as impressions,
  ROUND(AVG(ecpm), 2) as avg_ecpm,
  ROUND(AVG(ctr) * 100, 2) as avg_ctr_pct
FROM dra_google_ad_manager.geography_12345678
WHERE date >= CURRENT_DATE - INTERVAL '30 days'
GROUP BY country
ORDER BY revenue DESC
LIMIT 20;
```

---

## Device & Browser Report

### Description

The Device report analyzes performance across different devices, browsers, and operating systems.

**Business Use Cases:**
- Mobile optimization
- Browser compatibility
- Platform strategy
- User experience

### Database Schema

**Table Name:** `dra_google_ad_manager.device_{network_id}`

| Column | Type | Nullable | Description |
|--------|------|----------|-------------|
| `id` | INTEGER | NO | Primary key |
| `data_source_id` | INTEGER | NO | Data source reference |
| `date` | DATE | NO | Report date |
| `device_category` | VARCHAR(50) | YES | DESKTOP, MOBILE, TABLET |
| `browser` | VARCHAR(100) | YES | Browser name (Chrome, Safari, etc.) |
| `operating_system` | VARCHAR(100) | YES | OS name (Windows, iOS, Android, etc.) |
| `impressions` | BIGINT | YES | Total impressions |
| `clicks` | BIGINT | YES | Total clicks |
| `ctr` | DECIMAL(8,6) | YES | Click-through rate |
| `total_earnings` | DECIMAL(15,2) | YES | Revenue |
| `ecpm` | DECIMAL(10,2) | YES | Effective CPM |
| `fill_rate` | DECIMAL(6,4) | YES | Fill rate |
| `created_at` | TIMESTAMP | NO | Record creation time |
| `updated_at` | TIMESTAMP | NO | Last update time |

### Sample Queries

**Mobile vs Desktop Performance:**
```sql
SELECT 
  device_category,
  SUM(total_earnings) as revenue,
  SUM(impressions) as impressions,
  ROUND(AVG(ecpm), 2) as avg_ecpm,
  ROUND(AVG(fill_rate) * 100, 2) as avg_fill_rate_pct
FROM dra_google_ad_manager.device_12345678
WHERE date >= CURRENT_DATE - INTERVAL '7 days'
GROUP BY device_category
ORDER BY revenue DESC;
```

---

## Data Dictionary

### Field Type Reference

| Field Type | PostgreSQL Type | Description | Example Values |
|------------|----------------|-------------|----------------|
| **id** | INTEGER | Auto-incrementing primary key | 1, 2, 3... |
| **data_source_id** | INTEGER | Foreign key to data_sources table | 42 |
| **date** | DATE | Calendar date (YYYY-MM-DD) | 2025-12-16 |
| **ad_unit_id** | VARCHAR(255) | GAM ad unit identifier | "123456789" |
| **ad_unit_name** | TEXT | Human-readable ad unit name | "Homepage - ATF Leaderboard" |
| **country** | VARCHAR(10) | ISO 3166-1 alpha-2 country code | "US", "CA", "GB" |
| **total_earnings** | DECIMAL(15,2) | Revenue in network currency | 450.25, 1250.00 |
| **impressions** | BIGINT | Ad impression count | 125000, 1500000 |
| **clicks** | BIGINT | Click count | 450, 5200 |
| **ctr** | DECIMAL(8,6) | Click-through rate (decimal) | 0.003600 = 0.36% |
| **ecpm** | DECIMAL(10,2) | Effective CPM | 3.60, 12.50 |
| **fill_rate** | DECIMAL(6,4) | Fill rate (decimal) | 0.8500 = 85% |
| **created_at** | TIMESTAMP | Record insertion timestamp | 2025-12-16 14:30:25 |
| **updated_at** | TIMESTAMP | Last modification timestamp | 2025-12-16 15:45:10 |

### Common GAM Terminology

- **Ad Unit:** Placement on your site where ads appear
- **Line Item:** Individual ad campaign within an order
- **Order:** Container for related line items (usually one per advertiser)
- **Impressions:** Number of times an ad was displayed
- **Clicks:** Number of times an ad was clicked
- **CTR:** Click-through rate (clicks / impressions)
- **eCPM:** Effective cost per thousand impressions
- **Fill Rate:** Percentage of ad requests that were filled
- **Delivery:** Progress of line item toward its goal

---

## Sample Queries

### Cross-Report Analysis

**Revenue by Device and Country:**
```sql
SELECT 
  d.device_category,
  g.country,
  SUM(d.total_earnings) as device_revenue,
  SUM(g.total_earnings) as geo_revenue,
  ROUND(AVG(d.ecpm), 2) as device_ecpm,
  ROUND(AVG(g.ecpm), 2) as geo_ecpm
FROM dra_google_ad_manager.device_12345678 d
JOIN dra_google_ad_manager.geography_12345678 g 
  ON d.date = g.date 
  AND d.data_source_id = g.data_source_id
WHERE d.date >= CURRENT_DATE - INTERVAL '7 days'
GROUP BY d.device_category, g.country
ORDER BY device_revenue DESC;
```

### Time-Series Analysis

**7-Day Rolling Average:**
```sql
SELECT 
  date,
  SUM(total_earnings) as daily_revenue,
  AVG(SUM(total_earnings)) OVER (
    ORDER BY date 
    ROWS BETWEEN 6 PRECEDING AND CURRENT ROW
  ) as rolling_7day_avg
FROM dra_google_ad_manager.revenue_12345678
WHERE date >= CURRENT_DATE - INTERVAL '30 days'
GROUP BY date
ORDER BY date;
```

---

## Best Practices

### Query Optimization

1. **Use Date Filters:** Always include date ranges to limit scans
2. **Index Awareness:** Queries on indexed columns (date, ad_unit_id) perform better
3. **Aggregations:** Use appropriate GROUP BY to reduce result size
4. **JOINs:** Join on date + data_source_id for best performance

### Data Freshness

- **Hourly Sync:** Data available within 1 hour of occurrence
- **Daily Sync:** Data available next day at 00:00 UTC
- **Historical Data:** Typically available up to 90-365 days

### Data Quality

- **NULL Values:** Some dimensions may be NULL (unknown/aggregated)
- **Decimals:** Financial and rate fields use precise decimal types
- **Timestamps:** All times in UTC
- **Currency:** Revenue in network's configured currency

---

**Document Version:** 1.0  
**Last Updated:** December 16, 2025  
**Maintained By:** Data Research Analysis Team

