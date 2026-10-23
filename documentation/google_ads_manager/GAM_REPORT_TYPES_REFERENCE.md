# Google Ad Manager Report Types Reference

> **Last reviewed:** 2026-10-22 against `GAMReportType` (`backend/src/types/IGoogleAdManager.ts`) and `GoogleAdManagerDriver.ensureTablesExist()`.

## Overview

The GAM connector writes each report type into the `dra_google_ad_manager` schema. Physical table names are generated per data source **and network**:

```
dra_google_ad_manager."ds{dataSourceId}_{md5[:8]}"
```

The logical report type is shown in `dra_table_metadata`.

## Important: advertised vs implemented report types

| Surface | Values |
|---|---|
| UI / `GET /google-ad-manager/report-types` advertises **5** | `revenue`, `inventory`, `orders`, `geography`, `device` |
| Driver implements **6** | `revenue`, `geography`, `device`, `ad_unit`, `advertiser`, `time_series` |

Consequences:

- `inventory` and `orders` are advertised but **fall back to the revenue query** (they do not produce inventory/order-specific schemas).
- `ad_unit`, `advertiser`, and `time_series` are implemented but **not selectable from the advertised list**.
- This mismatch is a known defect recorded in [architecture/07-integrations.md](../architecture/07-integrations.md).

## Implemented report types

### 1. `revenue`

Ad revenue, impressions, clicks, CPM, CTR, fill rate by ad unit and country.

| Column | Type | Notes |
|---|---|---|
| `id` | SERIAL | PK |
| `date` | DATE | Report date |
| `ad_unit_id` | VARCHAR(255) | |
| `ad_unit_name` | TEXT | |
| `country_code` | VARCHAR(10) | |
| `country_name` | VARCHAR(255) | |
| `impressions` | BIGINT | |
| `clicks` | BIGINT | |
| `revenue` | DECIMAL(15,2) | |
| `cpm` | DECIMAL(10,2) | |
| `ctr` | DECIMAL(10,4) | |
| `fill_rate` | DECIMAL(10,4) | |
| `network_code` | VARCHAR(255) | |
| `synced_at` | TIMESTAMP | |
| `extended_metrics` | JSONB | Extra API metrics |

Unique key: `(date, ad_unit_id, country_code)`.

### 2. `geography`

Performance by country, region, and city.

| Column | Type |
|---|---|
| `id` | SERIAL |
| `date` | DATE |
| `country_code` | VARCHAR(10) |
| `country_name` | VARCHAR(255) |
| `region` | VARCHAR(255) |
| `city` | VARCHAR(255) |
| `impressions` | BIGINT |
| `clicks` | BIGINT |
| `revenue` | DECIMAL(15,2) |
| `network_code` | VARCHAR(255) |
| `synced_at` | TIMESTAMP |
| `extended_metrics` | JSONB |

Unique key: `(date, country_code, region, city)`.

### 3. `device`

Performance by device category, browser, and operating system.

| Column | Type |
|---|---|
| `id` | SERIAL |
| `date` | DATE |
| `device_category` | VARCHAR(50) |
| `browser_name` | VARCHAR(100) |
| `operating_system` | VARCHAR(100) |
| `impressions` | BIGINT |
| `clicks` | BIGINT |
| `revenue` | DECIMAL(15,2) |
| `ctr` | DECIMAL(10,4) |
| `cpm` | DECIMAL(10,2) |
| `network_code` | VARCHAR(255) |
| `synced_at` | TIMESTAMP |
| `extended_metrics` | JSONB |

Unique key: `(date, device_category, browser_name, operating_system)`.

### 4. `ad_unit`

Ad unit performance with ad-server and fill metrics.

| Column | Type |
|---|---|
| `id` | SERIAL |
| `date` | DATE |
| `ad_unit_id` | VARCHAR(255) |
| `ad_unit_name` | TEXT |
| `impressions` | BIGINT |
| `clicks` | BIGINT |
| `revenue` | DECIMAL(15,2) |
| `ad_server_impressions` | BIGINT |
| `ad_server_clicks` | BIGINT |
| `ctr` | DECIMAL(10,4) |
| `fill_rate` | DECIMAL(10,4) |
| `ecpm` | DECIMAL(10,2) |
| `network_code` | VARCHAR(255) |
| `synced_at` | TIMESTAMP |
| `extended_metrics` | JSONB |

Unique key: `(date, ad_unit_id)`.

### 5. `advertiser`

Advertiser/order/line-item delivery.

| Column | Type |
|---|---|
| `id` | SERIAL |
| `date` | DATE |
| `advertiser_id` | VARCHAR(255) |
| `advertiser_name` | TEXT |
| `order_id` | VARCHAR(255) |
| `order_name` | TEXT |
| `line_item_id` | VARCHAR(255) |
| `line_item_name` | TEXT |
| `impressions` | BIGINT |
| `clicks` | BIGINT |
| `revenue` | DECIMAL(15,2) |
| `ctr` | DECIMAL(10,4) |
| `cpm` | DECIMAL(10,2) |
| `network_code` | VARCHAR(255) |
| `synced_at` | TIMESTAMP |
| `extended_metrics` | JSONB |

Unique key: `(date, advertiser_id, order_id, line_item_id)`.

### 6. `time_series`

One row per day with network totals.

| Column | Type |
|---|---|
| `id` | SERIAL |
| `date` | DATE (unique) |
| `impressions` | BIGINT |
| `clicks` | BIGINT |
| `revenue` | DECIMAL(15,2) |
| `unfilled_impressions` | BIGINT |
| `ad_requests` | BIGINT |
| `ctr` | DECIMAL(10,4) |
| `fill_rate` | DECIMAL(10,4) |
| `ecpm` | DECIMAL(10,2) |
| `network_code` | VARCHAR(255) |
| `synced_at` | TIMESTAMP |
| `extended_metrics` | JSONB |

## Sample queries

```sql
-- Daily revenue by ad unit
SELECT date, ad_unit_name, revenue, impressions, ctr
FROM dra_google_ad_manager."ds42_ab12cd34"
ORDER BY date DESC, revenue DESC;

-- Revenue by country
SELECT country_name, SUM(revenue) AS revenue, SUM(impressions) AS impressions
FROM dra_google_ad_manager."ds42_ab12cd34"
GROUP BY country_name
ORDER BY revenue DESC;

-- Network daily trend
SELECT date, revenue, ad_requests, fill_rate
FROM dra_google_ad_manager."ds42_ab12cd34"
ORDER BY date;
```

## Rate limits

GAM uses a token-bucket limiter (`RateLimiterRegistry.createForGAM()`): **10 requests/minute**, burst 20, minimum 100 ms spacing. `RetryHandler` wraps report calls. See [GAM_API_INTEGRATION_GUIDE.md](GAM_API_INTEGRATION_GUIDE.md).
