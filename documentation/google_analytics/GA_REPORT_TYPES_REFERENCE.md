# Google Analytics Report Types Reference

**Comprehensive Guide to GA4 Data Structure and Schema**

---

## Table of Contents

1. [Overview](#overview)
2. [Traffic Overview Report](#traffic-overview-report)
3. [Page Performance Report](#page-performance-report)
4. [User Acquisition Report](#user-acquisition-report)
5. [Geographic Report](#geographic-report)
6. [Device & Technology Report](#device--technology-report)
7. [Events Report](#events-report)
8. [Data Dictionary](#data-dictionary)
9. [Sample Queries](#sample-queries)
10. [Best Practices](#best-practices)

---

## Overview

The Google Analytics 4 integration imports six standardized report types, each stored in dedicated database tables. All reports follow a consistent naming pattern:

```
dra_google_analytics.{report_type}_{data_source_id}
```

### Report Type Summary

| Report Type | Purpose | Key Dimensions | Key Metrics | Update Frequency |
|------------|---------|----------------|-------------|------------------|
| **Traffic Overview** | Overall traffic analysis | date, source, medium | sessions, users, bounce rate | Hourly/Daily |
| **Page Performance** | Page-level metrics | pagePath, pageTitle | pageViews, duration | Daily |
| **User Acquisition** | New user tracking | source, medium, campaign | newUsers, conversions | Daily |
| **Geographic** | Location analysis | country, city | users, sessions | Daily/Weekly |
| **Device** | Device/browser usage | deviceCategory, OS, browser | users, sessions | Daily/Weekly |
| **Events** | Event tracking | eventName, date | eventCount, conversions | Hourly/Daily |

### Common Fields Across All Reports

All report tables include these standard fields:

- `id`: Primary key (auto-increment integer)
- `synced_at`: Record insert/update timestamp (TIMESTAMP)

### Schema Structure

All tables reside in the `dra_google_analytics` schema, created automatically during first sync.

---

## Traffic Overview Report

### Description

The Traffic Overview report provides high-level traffic and engagement metrics, showing how users arrive at your site and interact with it.

**Business Use Cases:**
- Daily traffic monitoring
- Source/medium performance analysis
- Bounce rate optimization
- User growth tracking
- Traffic source attribution

### Database Schema

**Table Name:** `dra_google_analytics.traffic_overview_{data_source_id}`

| Column | Type | Nullable | Description |
|--------|------|----------|-------------|
| `id` | SERIAL | NO | Primary key |
| `date` | DATE | NO | Report date (YYYY-MM-DD) |
| `session_source` | VARCHAR(255) | YES | Traffic source (google, facebook, direct, etc.) |
| `session_medium` | VARCHAR(255) | YES | Traffic medium (organic, cpc, referral, email, etc.) |
| `sessions` | INTEGER | YES | Total sessions |
| `total_users` | INTEGER | YES | Total users (new + returning) |
| `new_users` | INTEGER | YES | First-time visitors |
| `screen_page_views` | INTEGER | YES | Total page views |
| `average_session_duration` | DECIMAL(10,2) | YES | Avg. session duration in seconds |
| `bounce_rate` | DECIMAL(5,2) | YES | Bounce rate as decimal (0.45 = 45%) |
| `synced_at` | TIMESTAMP | NO | Record sync timestamp |

### Indexes and Constraints

```sql
-- Primary key
PRIMARY KEY (id)

-- Unique constraint
UNIQUE (date, session_source, session_medium)

-- Recommended indexes
CREATE INDEX idx_traffic_date ON traffic_overview_{data_source_id}(date);
CREATE INDEX idx_traffic_source ON traffic_overview_{data_source_id}(session_source);
CREATE INDEX idx_traffic_medium ON traffic_overview_{data_source_id}(session_medium);
```

### Sample Data

```sql
| id | date       | session_source | session_medium | sessions | total_users | new_users | screen_page_views | avg_session_duration | bounce_rate |
|----|------------|----------------|----------------|----------|-------------|-----------|-------------------|---------------------|-------------|
| 1  | 2025-12-17 | google         | organic        | 1250     | 980         | 450       | 4500              | 145.50              | 0.42        |
| 2  | 2025-12-17 | google         | cpc            | 850      | 720         | 520       | 3200              | 128.20              | 0.48        |
| 3  | 2025-12-17 | direct         | (none)         | 650      | 550         | 120       | 2100              | 180.30              | 0.35        |
| 4  | 2025-12-17 | facebook       | social         | 420      | 380         | 290       | 1450              | 95.40               | 0.55        |
```

### Sample Queries

**Daily Traffic Summary:**
```sql
SELECT 
  date,
  SUM(sessions) as total_sessions,
  SUM(total_users) as total_users,
  SUM(new_users) as new_users,
  ROUND(AVG(bounce_rate) * 100, 2) as avg_bounce_rate_pct
FROM dra_google_analytics.traffic_overview_42
WHERE date >= CURRENT_DATE - INTERVAL '7 days'
GROUP BY date
ORDER BY date DESC;
```

**Top Traffic Sources:**
```sql
SELECT 
  session_source,
  session_medium,
  SUM(sessions) as total_sessions,
  SUM(total_users) as total_users,
  ROUND(AVG(average_session_duration), 2) as avg_duration,
  ROUND(AVG(bounce_rate) * 100, 2) as avg_bounce_rate_pct
FROM dra_google_analytics.traffic_overview_42
WHERE date >= CURRENT_DATE - INTERVAL '30 days'
GROUP BY session_source, session_medium
ORDER BY total_sessions DESC
LIMIT 10;
```

**Week-over-Week Growth:**
```sql
WITH this_week AS (
  SELECT SUM(sessions) as sessions, SUM(total_users) as users
  FROM dra_google_analytics.traffic_overview_42
  WHERE date >= DATE_TRUNC('week', CURRENT_DATE)
),
last_week AS (
  SELECT SUM(sessions) as sessions, SUM(total_users) as users
  FROM dra_google_analytics.traffic_overview_42
  WHERE date >= DATE_TRUNC('week', CURRENT_DATE - INTERVAL '7 days')
    AND date < DATE_TRUNC('week', CURRENT_DATE)
)
SELECT 
  this_week.sessions as this_week_sessions,
  last_week.sessions as last_week_sessions,
  ROUND(((this_week.sessions - last_week.sessions)::DECIMAL / 
    NULLIF(last_week.sessions, 0)) * 100, 2) as sessions_growth_pct,
  this_week.users as this_week_users,
  last_week.users as last_week_users,
  ROUND(((this_week.users - last_week.users)::DECIMAL / 
    NULLIF(last_week.users, 0)) * 100, 2) as users_growth_pct
FROM this_week, last_week;
```

---

## Page Performance Report

### Description

The Page Performance report analyzes individual page metrics to identify high-performing content and pages needing optimization.

**Business Use Cases:**
- Content performance analysis
- Landing page optimization
- Identifying popular content
- Finding high-bounce pages
- Content strategy planning

### Database Schema

**Table Name:** `dra_google_analytics.page_performance_{data_source_id}`

| Column | Type | Nullable | Description |
|--------|------|----------|-------------|
| `id` | SERIAL | NO | Primary key |
| `page_path` | VARCHAR(2048) | YES | URL path (e.g., /products/item-123) |
| `page_title` | VARCHAR(500) | YES | Page title from HTML <title> tag |
| `screen_page_views` | INTEGER | YES | Total page views |
| `average_session_duration` | DECIMAL(10,2) | YES | Avg. time on page (seconds) |
| `bounce_rate` | DECIMAL(5,2) | YES | Page bounce rate (decimal) |
| `synced_at` | TIMESTAMP | NO | Record sync timestamp |

### Indexes and Constraints

```sql
PRIMARY KEY (id)
UNIQUE (page_path)
CREATE INDEX idx_page_path ON page_performance_{data_source_id}(page_path);
```

### Sample Queries

**Top Pages by Views:**
```sql
SELECT 
  page_path,
  page_title,
  screen_page_views,
  ROUND(average_session_duration, 2) as avg_duration_sec,
  ROUND(bounce_rate * 100, 2) as bounce_rate_pct
FROM dra_google_analytics.page_performance_42
ORDER BY screen_page_views DESC
LIMIT 20;
```

**High Bounce Rate Pages:**
```sql
SELECT 
  page_path,
  page_title,
  screen_page_views,
  ROUND(bounce_rate * 100, 2) as bounce_rate_pct
FROM dra_google_analytics.page_performance_42
WHERE screen_page_views > 100
ORDER BY bounce_rate DESC
LIMIT 15;
```

**Longest Engagement Pages:**
```sql
SELECT 
  page_path,
  page_title,
  ROUND(average_session_duration, 2) as duration_sec,
  ROUND(average_session_duration / 60, 2) as duration_min,
  screen_page_views
FROM dra_google_analytics.page_performance_42
WHERE screen_page_views > 50
ORDER BY average_session_duration DESC
LIMIT 10;
```

---

## User Acquisition Report

### Description

The User Acquisition report tracks how new users first discovered your site, essential for understanding marketing effectiveness.

**Business Use Cases:**
- Marketing channel analysis
- Campaign ROI tracking
- User acquisition cost calculation
- Attribution modeling
- Growth marketing optimization

### Database Schema

**Table Name:** `dra_google_analytics.user_acquisition_{data_source_id}`

| Column | Type | Nullable | Description |
|--------|------|----------|-------------|
| `id` | SERIAL | NO | Primary key |
| `date` | DATE | NO | Report date |
| `first_user_source` | VARCHAR(255) | YES | Initial traffic source |
| `first_user_medium` | VARCHAR(255) | YES | Initial traffic medium |
| `first_user_campaign_id` | VARCHAR(255) | YES | Campaign identifier |
| `new_users` | INTEGER | YES | New users acquired |
| `sessions` | INTEGER | YES | Sessions from new users |
| `engagement_rate` | DECIMAL(5,2) | YES | Engagement rate (decimal) |
| `conversions` | INTEGER | YES | Conversion count |
| `synced_at` | TIMESTAMP | NO | Record sync timestamp |

### Indexes and Constraints

```sql
PRIMARY KEY (id)
UNIQUE (date, first_user_source, first_user_medium, first_user_campaign_id)
CREATE INDEX idx_acquisition_date ON user_acquisition_{data_source_id}(date);
CREATE INDEX idx_acquisition_source ON user_acquisition_{data_source_id}(first_user_source);
```

### Sample Queries

**Acquisition by Channel:**
```sql
SELECT 
  first_user_source,
  first_user_medium,
  SUM(new_users) as total_new_users,
  SUM(sessions) as total_sessions,
  SUM(conversions) as total_conversions,
  ROUND(AVG(engagement_rate) * 100, 2) as avg_engagement_pct,
  ROUND((SUM(conversions)::DECIMAL / NULLIF(SUM(new_users), 0)) * 100, 2) 
    as conversion_rate_pct
FROM dra_google_analytics.user_acquisition_42
WHERE date >= CURRENT_DATE - INTERVAL '30 days'
GROUP BY first_user_source, first_user_medium
ORDER BY total_new_users DESC;
```

**Campaign Performance:**
```sql
SELECT 
  first_user_campaign_id as campaign,
  SUM(new_users) as new_users,
  SUM(conversions) as conversions,
  ROUND((SUM(conversions)::DECIMAL / NULLIF(SUM(new_users), 0)) * 100, 2) 
    as conversion_rate_pct
FROM dra_google_analytics.user_acquisition_42
WHERE date >= CURRENT_DATE - INTERVAL '30 days'
  AND first_user_campaign_id IS NOT NULL
GROUP BY first_user_campaign_id
ORDER BY conversions DESC;
```

---

## Geographic Report

### Description

The Geographic report analyzes traffic distribution by location, helping identify regional opportunities and preferences.

**Business Use Cases:**
- Geographic expansion planning
- Content localization strategy
- Regional marketing campaigns
- International SEO optimization
- Time zone targeting

### Database Schema

**Table Name:** `dra_google_analytics.geographic_{data_source_id}`

| Column | Type | Nullable | Description |
|--------|------|----------|-------------|
| `id` | SERIAL | NO | Primary key |
| `country` | VARCHAR(100) | YES | Country name |
| `city` | VARCHAR(100) | YES | City name |
| `total_users` | INTEGER | YES | Total users from location |
| `sessions` | INTEGER | YES | Total sessions |
| `screen_page_views` | INTEGER | YES | Total page views |
| `average_session_duration` | DECIMAL(10,2) | YES | Avg. session duration (seconds) |
| `synced_at` | TIMESTAMP | NO | Record sync timestamp |

### Indexes and Constraints

```sql
PRIMARY KEY (id)
UNIQUE (country, city)
CREATE INDEX idx_geo_country ON geographic_{data_source_id}(country);
```

### Sample Queries

**Top Countries:**
```sql
SELECT 
  country,
  SUM(total_users) as total_users,
  SUM(sessions) as total_sessions,
  SUM(screen_page_views) as total_pageviews,
  ROUND(AVG(average_session_duration), 2) as avg_duration
FROM dra_google_analytics.geographic_42
GROUP BY country
ORDER BY total_users DESC
LIMIT 20;
```

**Top Cities by Country:**
```sql
SELECT 
  country,
  city,
  total_users,
  sessions,
  screen_page_views,
  ROUND(average_session_duration, 2) as avg_duration
FROM dra_google_analytics.geographic_42
WHERE country = 'United States'
ORDER BY total_users DESC
LIMIT 15;
```

---

## Device & Technology Report

### Description

The Device & Technology report analyzes user device types, operating systems, and browsers.

**Business Use Cases:**
- Mobile optimization priorities
- Browser compatibility testing
- Device-specific content
- Technical performance analysis
- UX optimization by platform

### Database Schema

**Table Name:** `dra_google_analytics.device_{data_source_id}`

| Column | Type | Nullable | Description |
|--------|------|----------|-------------|
| `id` | SERIAL | NO | Primary key |
| `device_category` | VARCHAR(50) | YES | Device type (desktop, mobile, tablet) |
| `operating_system` | VARCHAR(100) | YES | OS (Windows, iOS, Android, macOS, etc.) |
| `browser` | VARCHAR(100) | YES | Browser (Chrome, Safari, Firefox, Edge, etc.) |
| `total_users` | INTEGER | YES | Total users |
| `sessions` | INTEGER | YES | Total sessions |
| `screen_page_views` | INTEGER | YES | Total page views |
| `bounce_rate` | DECIMAL(5,2) | YES | Bounce rate (decimal) |
| `synced_at` | TIMESTAMP | NO | Record sync timestamp |

### Indexes and Constraints

```sql
PRIMARY KEY (id)
UNIQUE (device_category, operating_system, browser)
CREATE INDEX idx_device_category ON device_{data_source_id}(device_category);
```

### Sample Queries

**Device Category Breakdown:**
```sql
SELECT 
  device_category,
  SUM(total_users) as total_users,
  SUM(sessions) as total_sessions,
  ROUND(AVG(bounce_rate) * 100, 2) as avg_bounce_rate_pct,
  ROUND((SUM(total_users)::DECIMAL / 
    (SELECT SUM(total_users) FROM dra_google_analytics.device_42)) * 100, 2) 
    as user_share_pct
FROM dra_google_analytics.device_42
GROUP BY device_category
ORDER BY total_users DESC;
```

**Browser Performance:**
```sql
SELECT 
  browser,
  SUM(total_users) as total_users,
  SUM(sessions) as total_sessions,
  ROUND(AVG(bounce_rate) * 100, 2) as avg_bounce_rate_pct
FROM dra_google_analytics.device_42
GROUP BY browser
ORDER BY total_users DESC
LIMIT 10;
```

**Mobile vs Desktop:**
```sql
SELECT 
  CASE 
    WHEN device_category = 'mobile' THEN 'Mobile'
    WHEN device_category = 'desktop' THEN 'Desktop'
    ELSE 'Other'
  END as device_type,
  SUM(total_users) as users,
  SUM(sessions) as sessions,
  ROUND(AVG(bounce_rate) * 100, 2) as bounce_rate_pct
FROM dra_google_analytics.device_42
GROUP BY device_type
ORDER BY users DESC;
```

---

## Events Report

### Description

The Events report tracks custom events and user interactions, essential for understanding user behavior and conversions.

**Business Use Cases:**
- Conversion tracking
- User engagement analysis
- Goal completion monitoring
- E-commerce tracking
- Custom interaction analysis

### Database Schema

**Table Name:** `dra_google_analytics.events_{data_source_id}`

| Column | Type | Nullable | Description |
|--------|------|----------|-------------|
| `id` | SERIAL | NO | Primary key |
| `date` | DATE | NO | Event date |
| `event_name` | VARCHAR(255) | YES | Event name (page_view, click, purchase, etc.) |
| `event_count` | INTEGER | YES | Number of times event fired |
| `event_value` | DECIMAL(10,2) | YES | Total event value (for valued events) |
| `conversions` | INTEGER | YES | Conversion count |
| `synced_at` | TIMESTAMP | NO | Record sync timestamp |

### Indexes and Constraints

```sql
PRIMARY KEY (id)
UNIQUE (date, event_name)
CREATE INDEX idx_events_date ON events_{data_source_id}(date);
CREATE INDEX idx_events_name ON events_{data_source_id}(event_name);
```

### Sample Queries

**Top Events:**
```sql
SELECT 
  event_name,
  SUM(event_count) as total_count,
  SUM(event_value) as total_value,
  SUM(conversions) as total_conversions
FROM dra_google_analytics.events_42
WHERE date >= CURRENT_DATE - INTERVAL '30 days'
GROUP BY event_name
ORDER BY total_count DESC
LIMIT 20;
```

**Daily Event Trend:**
```sql
SELECT 
  date,
  event_name,
  event_count,
  event_value,
  conversions
FROM dra_google_analytics.events_42
WHERE event_name IN ('purchase', 'add_to_cart', 'begin_checkout')
  AND date >= CURRENT_DATE - INTERVAL '14 days'
ORDER BY date DESC, event_count DESC;
```

---

## Data Dictionary

### Field Type Reference

| Field Type | PostgreSQL Type | Description | Example Values |
|------------|----------------|-------------|----------------|
| **id** | SERIAL | Auto-incrementing primary key | 1, 2, 3... |
| **date** | DATE | Calendar date (YYYY-MM-DD) | 2025-12-17 |
| **session_source** | VARCHAR(255) | Traffic source | google, facebook, direct |
| **session_medium** | VARCHAR(255) | Traffic medium | organic, cpc, referral |
| **page_path** | TEXT | URL path | /products/item-123 |
| **page_title** | TEXT | Page title | "Product Name - Site" |
| **sessions** | INTEGER | Session count | 1250 |
| **total_users** | INTEGER | User count | 980 |
| **screen_page_views** | INTEGER | Page view count | 4500 |
| **average_session_duration** | DECIMAL(10,2) | Duration in seconds | 145.50 |
| **bounce_rate** | DECIMAL(5,2) | Bounce rate (decimal) | 0.42 = 42% |
| **synced_at** | TIMESTAMP | Sync timestamp | 2025-12-17 10:30:00 |

### Common GA4 Terminology

- **Session:** A period of user interaction with your site (typically 30 minutes of inactivity ends a session)
- **User:** Unique visitor identified by Client ID or User ID
- **Event:** User interaction (page view, click, scroll, video play, etc.)
- **Conversion:** Completed goal or key event
- **Bounce Rate:** Percentage of sessions with no engagement (no additional page views or events)
- **Engagement Rate:** Percentage of engaged sessions (>10 seconds OR 2+ page views OR conversion)

---

## Sample Queries

### Cross-Report Analysis

**Traffic Source Performance with Page Data:**
```sql
SELECT 
  t.session_source,
  t.session_medium,
  SUM(t.sessions) as total_sessions,
  COUNT(DISTINCT p.page_path) as unique_pages_visited,
  ROUND(AVG(p.average_session_duration), 2) as avg_duration
FROM dra_google_analytics.traffic_overview_42 t
CROSS JOIN dra_google_analytics.page_performance_42 p
WHERE t.date >= CURRENT_DATE - INTERVAL '7 days'
GROUP BY t.session_source, t.session_medium
ORDER BY total_sessions DESC;
```

**Geographic Device Preferences:**
```sql
SELECT 
  g.country,
  d.device_category,
  SUM(g.total_users) as users,
  ROUND(AVG(d.bounce_rate) * 100, 2) as bounce_rate_pct
FROM dra_google_analytics.geographic_42 g
CROSS JOIN dra_google_analytics.device_42 d
WHERE g.country IN ('United States', 'Canada', 'United Kingdom')
GROUP BY g.country, d.device_category
ORDER BY g.country, users DESC;
```

### Time-Series Analysis

**7-Day Rolling Average:**
```sql
SELECT 
  date,
  SUM(sessions) as daily_sessions,
  AVG(SUM(sessions)) OVER (
    ORDER BY date 
    ROWS BETWEEN 6 PRECEDING AND CURRENT ROW
  ) as rolling_7day_avg
FROM dra_google_analytics.traffic_overview_42
WHERE date >= CURRENT_DATE - INTERVAL '30 days'
GROUP BY date
ORDER BY date;
```

---

## Best Practices

### Query Optimization

1. **Always Use Date Filters:** Limit data scanned
2. **Index Awareness:** Queries on indexed columns perform better
3. **Appropriate Aggregations:** Use GROUP BY to reduce result size
4. **Avoid SELECT *:** Specify only needed columns

### Data Freshness

- **Sync Frequency:** Daily recommended for most use cases
- **GA4 Processing Time:** 24-48 hour delay for complete data
- **Real-time Reports:** May show incomplete metrics
- **Historical Data:** GA4 API provides up to 14 months

### Data Quality

- **NULL Values:** Some dimensions may be NULL (unknown/not set)
- **Decimals:** Rates stored as decimals (0.42 = 42%)
- **Timestamps:** All in UTC
- **Data Sampling:** GA4 may sample large datasets (>10M events)

---

**Document Version:** 1.0  
**Last Updated:** December 17, 2025  
**Maintained By:** Data Research Analysis Team
